import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Stage 6, PHASES 10-13, 23 and 24: documentation is part of the security boundary here.
// A correct Action that points people at an unsafe workflow has still shipped an unsafe
// product, so these cases read the shipped prose the way a consumer would.

const repository = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(repository, file), 'utf8');
const actionDocs = ['README.md', 'packages/action/README.md'];
const fixture = 'docs/examples/diffbeacon-pull-request-review.yml';

/** Every fenced block in a Markdown file, with its info string. */
function fencedBlocks(markdown: string): { language: string; body: string }[] {
  const blocks: { language: string; body: string }[] = [];
  let language: string | null = null;
  let body: string[] = [];
  for (const line of markdown.split('\n')) {
    const fence = /^```([^\n]*)$/.exec(line.trim());
    if (fence) {
      if (language === null) {
        language = fence[1] ?? '';
        body = [];
      } else {
        blocks.push({ language, body: body.join('\n') });
        language = null;
      }
      continue;
    }
    if (language !== null) body.push(line);
  }
  return blocks;
}

describe('the Action documentation keeps the two trust domains apart', () => {
  it('never presents `uses: ./` as a runnable consumer example', () => {
    for (const file of actionDocs)
      for (const block of fencedBlocks(read(file)))
        if (/^\s*(yaml|yml)/.test(block.language))
          expect(block.body, `${file} offers uses: ./ to consumers`).not.toContain('uses: ./');
  });

  it('names `uses: ./` as trusted-development only, in prose', () => {
    for (const file of actionDocs) {
      const text = read(file);
      expect(text, file).toContain('`uses: ./`');
      expect(text, file).toMatch(/trusted development/);
      expect(text, file).toMatch(/not.{0,40}recommended consumer/);
    }
  });

  it('names the released Action version, its immutable pin, and its consumer proof', () => {
    for (const file of actionDocs) {
      const text = read(file);
      expect(text, `${file} omits the released version`).toMatch(/v0\.1\.0/);
      expect(text, `${file} omits the reviewed release SHA`).toMatch(
        /5a50b52028ead78942ea3fc3bee93ba26e0a79cc/,
      );
      // Documentation that recommends a reference must show the recommendation working somewhere.
      expect(text, `${file} omits the consumer Actions run`).toMatch(/37430396143/);
      expect(text, `${file} drops the release runbook pointer`).toMatch(/docs\/releasing\.md/);
      expect(text, `${file} still denies the release`).not.toMatch(
        /no published|does not exist yet|not published/i,
      );
    }
  });

  it('does not recommend a privileged trigger anywhere', () => {
    for (const file of [...actionDocs, fixture]) {
      const text = read(file);
      expect(text, file).not.toMatch(/on:\s*\n\s*pull_request_target/);
      expect(text, file).not.toMatch(/uses:\s*\S+@v\d/);
    }
  });
});

describe('the future consumer workflow fixture', () => {
  const uses = () =>
    [...read(fixture).matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((match) => match[1] as string);

  it('is documentation, not a workflow this repository runs', () => {
    expect(fixture.startsWith('.github/')).toBe(false);
    // The inventory this repository actually runs. Stage 9's self-hosted qualification lane is a
    // workflow this repository does run, so it belongs here; the documented `pull_request` fixture
    // still does not, which is the point of the assertion. Stage 14 added `publish.yml`, which runs
    // only when someone pushes a future release tag, so it is a workflow of this repository rather
    // than an example — and it is guarded by `tests/stage14.publish-workflow.test.ts`, not here.
    expect(readdirSync(path.join(repository, '.github/workflows')).sort()).toEqual([
      'ci-self-hosted-stage9.yml',
      'ci.yml',
      'pages.yml',
      'publish.yml',
    ]);
    expect(read(fixture)).toMatch(/NOT A WORKFLOW|not.*run by GitHub|documentation/i);
  });

  it('triggers on the ordinary pull_request event with read-only permissions', () => {
    const text = read(fixture);
    expect(text).toMatch(/^on:\n {2}pull_request:\n/m);
    expect(text).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(text).not.toMatch(/pull-requests:|contents: write|admin|security-events: write/);
    expect(text).not.toMatch(/\bsecrets\./);
  });

  it('fetches the history the base...head range needs, and drops the credentials', () => {
    const text = read(fixture);
    expect(text).toMatch(/fetch-depth: 0/);
    expect(text).toMatch(/persist-credentials: false/);
    expect(text).toMatch(/PAT|authenticated/);
  });

  it('references external actions by full commit SHA, never a movable tag', () => {
    expect(uses().length).toBeGreaterThan(1);
    for (const reference of uses())
      if (!reference.includes('<')) expect(reference, reference).toMatch(/^[^@]+@[0-9a-f]{40}$/);
  });

  it('pins the reviewed release SHA rather than a placeholder', () => {
    expect(uses()).toContain('Pavithran-R-A/DiffBeacon@5a50b52028ead78942ea3fc3bee93ba26e0a79cc');
    const text = read(fixture);
    expect(text).not.toMatch(/REVIEWED_FULL_COMMIT_SHA|placeholder|TBD|FIXME/i);
    for (const reference of uses()) expect(reference, reference).toMatch(/^[^@]+@[0-9a-f]{40}$/);
    expect(text).toMatch(/pull_request/i);
  });

  it('runs nothing: no build, install, or shell step in the reviewed repository', () => {
    const text = read(fixture);
    expect(text).not.toMatch(/^\s*run:/m);
    expect(text).not.toMatch(/npm (ci|install)|pnpm|yarn/);
    expect(text).not.toMatch(/actions\/setup-node/);
  });

  it('records where its checkout pin came from', () => {
    const text = read(fixture);
    expect(text).toMatch(/refs\/tags\/v7/);
    expect(text).toMatch(/2026-09-26/);
    expect(text).toMatch(/ls-remote|verified/i);
  });
});

describe('consumer claims match the code Stage 6 shipped', () => {
  it('documents the Job Summary as the Action output', () => {
    for (const file of [...actionDocs, 'docs/architecture/security.md'])
      expect(read(file), file).toMatch(/Job Summary/);
  });

  it('states the event and object-ID contract the Action enforces', () => {
    const security = read('docs/architecture/security.md');
    expect(security).toMatch(/full commit object ID/);
    expect(security).toMatch(/40-character|40 hexadecimal|SHA-256/);
    expect(security).toMatch(/pull_request_target/);
    expect(security).toMatch(/GITHUB_WORKSPACE/);
    expect(security).not.toMatch(/7–64/);
  });

  it('ties the no-execution claim to the suite that proves it', () => {
    const security = read('docs/architecture/security.md');
    expect(security).toMatch(/stage6\.action-security-boundary\.test\.ts/);
  });

  it('documents the environment the Action reads', () => {
    for (const variable of [
      'GITHUB_EVENT_NAME',
      'GITHUB_EVENT_PATH',
      'GITHUB_WORKSPACE',
      'GITHUB_STEP_SUMMARY',
    ])
      expect(read('packages/action/README.md'), variable).toContain(variable);
  });

  it('keeps the demo pages and other docs free of the PR-local reference', () => {
    for (const file of ['client/src/pages/Home.tsx', 'docs/architecture/overview.md'])
      if (existsSync(path.join(repository, file)))
        expect(read(file), file).not.toContain('uses: ./');
  });
});
