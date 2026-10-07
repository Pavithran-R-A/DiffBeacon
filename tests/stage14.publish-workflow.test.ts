import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Stage 14, Phase O: the gate a *future* npm release passes through without this repository ever
// holding an npm credential. Stage 14 published `diffbeacon@0.1.0` by hand, so this workflow has
// never run — which is exactly why its contract is asserted against the committed text. Everything
// below is a guard over a publication path someone else will take using the tree as it stands, so a
// widened permission, a token in the open, or a registry write that outruns its own checks has to be
// caught by a reviewed commit rather than by a run that already published.

const repository = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const file = '.github/workflows/publish.yml';

/** Reads the workflow, or fails the calling case with the reason rather than throwing at import. */
function workflow(): string {
  const absolute = path.join(repository, file);
  const text = existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
  expect(text, `${file} does not exist`).not.toBe('');
  return text;
}

const usesLines = (text: string) =>
  [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(.+)$/gm)].map((match) => match[1]?.trim() ?? '');

/** Permission grants are dedented `scope: read|write` lines; anything naming a token is also caught. */
const grantLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        /^[a-z][a-z-]*(?:-[a-z-]+)*: (?:read|write)$/.test(line) ||
        (/token/i.test(line) && !line.startsWith('#')),
    );

const runsOnValues = (text: string) =>
  [...text.matchAll(/^\s*runs-on:\s*(.+)$/gm)].map((match) => match[1]?.trim() ?? '');

/**
 * What the runner acts on: every line that is not a YAML comment. Configuration-key guards read this
 * rather than the raw file so prose can name the key it forbids — a comment explaining why
 * cancellation is unsafe must not itself fail the guard that keeps cancellation unsafe.
 */
const body = (text: string) =>
  text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

/** The `on:` block only, which is where a trigger is declared rather than merely discussed. */
const triggerBlock = (text: string) => /^on:\n((?:[ \t].*\n|\n)+)/m.exec(text)?.[1] ?? '';

/** Each step command in file order, so a sequence can be asserted instead of assumed. */
const runCommands = (text: string) =>
  [...text.matchAll(/^ {8}run: \|$|^ {8}run: (.+)$/gm)].map((match) => (match[1] ?? '').trim());

describe('the publish workflow is a gate, not a convenience', () => {
  it("fires on a release tag push and on no event that can carry someone else's code", () => {
    const text = workflow();
    const trigger = triggerBlock(text);
    expect(text).toMatch(/^on:\n {2}push:\n {4}tags:\n {6}- 'v\*'/m);
    expect(trigger).toContain('push:');
    // `pull_request_target` and its friends hand a run the base workflow's permissions; a publish
    // job must not be reachable that way even in principle.
    for (const forbidden of [
      'pull_request',
      'workflow_dispatch',
      'schedule:',
      'repository_dispatch',
      'issue_comment',
    ])
      expect(trigger, `publish.yml must not be triggered by ${forbidden}`).not.toContain(forbidden);
  });

  it('holds exactly the two grants Trusted Publishing needs, and no credential anywhere', () => {
    const text = workflow();
    expect([...grantLines(text)].sort()).toEqual(['contents: read', 'id-token: write']);
    // An npm token here would make the OIDC grant decorative: one long-lived secret in a
    // repository-wide automation role is the shape that outlives the release it was issued for.
    for (const forbidden of [
      'NODE_AUTH_TOKEN',
      'NPM_TOKEN',
      '_authToken',
      '.npmrc',
      'secrets.',
      'GITHUB_TOKEN',
    ])
      expect(text, `publish.yml must not reference ${forbidden}`).not.toContain(forbidden);
  });

  it('publishes from a GitHub-hosted runner, never a self-hosted one', () => {
    const text = workflow();
    const values = runsOnValues(body(text));
    expect(values.length).toBeGreaterThanOrEqual(1);
    for (const value of values) expect(value).toBe('ubuntu-latest');
    expect(body(text)).not.toContain('self-hosted');
    // The hosted label is what makes the minted OIDC token name this repository, file and commit.
    expect(text, 'the hosted-runner reason is undocumented').toMatch(
      /GitHub-hosted|hosted runner/i,
    );
  });

  it('pins every action to an immutable commit with the upstream tag named', () => {
    const references = usesLines(workflow());
    expect(references.length).toBeGreaterThanOrEqual(2);
    for (const reference of references) expect(reference).toMatch(/^[^@\s]+@[0-9a-f]{40} # v\d+$/);
  });

  it('refuses the version Stage 14 already published', () => {
    const text = workflow();
    expect(text).toMatch(/=\s*'0\.1\.0'/);
    expect(text).toMatch(/permanently consumed|is published and immutable/);
    expect(text, 'the 0.1.0 refusal must stop the run').toMatch(/'0\.1\.0'[^]*?exit 1/);
  });

  it('refuses to publish a version the registry already carries', () => {
    const text = workflow();
    expect(text).toMatch(/npm view "diffbeacon@\$\{version\}" version/);
    expect(text).toMatch(/already resolves|already on the registry/);
    // "the registry errored" is not "the version is absent"; treating one as the other publishes over
    // a consumed version the first time the network misbehaves.
    expect(text, 'a registry error must not read as absence').toMatch(
      /did not answer not-found|not-found/i,
    );
  });

  it('refuses a tag that does not name the version it publishes', () => {
    const text = workflow();
    expect(text).toContain("require('./packages/cli/package.json').version");
    expect(text).toMatch(/GITHUB_REF_NAME#v/);
    expect(text).toMatch(/does not name packages\/cli version[^]*?exit 1/);
  });

  it('publishes exactly the CLI workspace and proves the other two stay private', () => {
    const text = workflow();
    // One `npm publish` in the whole file and it names the CLI directory: a second invocation, a
    // `-w`/`--workspaces` form, or a bare `npm publish` from the repository root would publish
    // something this release never qualified.
    expect([...body(text).matchAll(/npm publish/g)].length).toBe(1);
    expect(runCommands(text)).toContain('npm publish ./packages/cli --provenance');
    expect(text).toMatch(/packages\/core packages\/action/);
    expect(text, 'a workspace that stopped being private must stop the run').toMatch(
      /is not private[^]*?exit 1/,
    );
  });

  it('gates the publication on the evidence a source lane of ci.yml already requires', () => {
    const text = workflow();
    for (const step of [
      'npm ci',
      'npm audit --omit=dev --audit-level=high',
      'npm audit --audit-level=high',
      'npm run verify',
      'npm run test:browser',
      'npm run package-smoke',
    ])
      expect(text, `publish.yml must run ${step}`).toContain(step);
    expect(text).toMatch(/node-version: '24'/);
    expect(text).toMatch(/11\.5\.1/);
    // `verify` keeps its embedded browser suites suppressed, then this publish job runs one
    // explicit fail-closed Chromium gate before the registry write. A separate ci.yml run may race
    // this workflow, so it cannot be the publication prerequisite.
    expect(text).toMatch(/DIFFBEACON_SKIP_BROWSER: '1'/);
    expect(text).toMatch(/DIFFBEACON_SKIP_BROWSER: '0'/);
    expect(text).toMatch(/DIFFBEACON_REQUIRE_BROWSER: '1'/);
    expect(text).toContain('npm run test:browser');
  });

  it('puts every gate ahead of the registry write', () => {
    const commands = runCommands(workflow());
    const publish = commands.findIndex(
      (command) => command === 'npm publish ./packages/cli --provenance',
    );
    expect(publish, 'the publish command is missing').toBeGreaterThan(-1);
    for (const gate of [
      'npm ci',
      'npm audit --omit=dev --audit-level=high',
      'npm audit --audit-level=high',
      'npm run verify',
      'npm run test:browser',
      'npm run package-smoke',
    ]) {
      const position = commands.indexOf(gate);
      expect(position, `publish.yml must run ${gate}`).toBeGreaterThan(-1);
      expect(position, `${gate} must run before the registry write`).toBeLessThan(publish);
    }
  });

  it('lets a run that can reach the registry finish once it has started', () => {
    const text = workflow();
    expect(text).toMatch(/^concurrency:\n {2}group: /m);
    // Cancelling an in-flight publish is how a version ends up consumed with no run recording it.
    expect(body(text)).not.toContain('cancel-in-progress');
    const timeouts = [...text.matchAll(/timeout-minutes: (\d+)/g)].map((match) => Number(match[1]));
    expect(timeouts.length).toBe(1);
    for (const timeout of timeouts) expect(timeout).toBeGreaterThan(0);
  });

  it('leaves the Action bundle and the Pages deploy out of a package publication', () => {
    const text = workflow();
    for (const forbidden of [
      'deploy-pages',
      'upload-pages-artifact',
      'configure-pages',
      'build:action',
      'build:web',
      'git push',
      'git tag',
      'force',
    ])
      expect(body(text), `publish.yml must not run ${forbidden}`).not.toContain(forbidden);
  });

  it('points at the runbook it implements', () => {
    expect(workflow()).toMatch(/docs\/releasing\.md/);
  });
});
