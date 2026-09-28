import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const pages = readFileSync('.github/workflows/pages.yml', 'utf8');

const usesLines = (text: string) =>
  [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(.+)$/gm)].map((match) => match[1]?.trim() ?? '');

describe('Stage 9 CI contract', () => {
  it('pins every action to an immutable commit with the upstream tag named', () => {
    const references = [...usesLines(workflow), ...usesLines(pages)];
    expect(references.length).toBeGreaterThanOrEqual(3);
    for (const reference of references) expect(reference).toMatch(/^[^@\s]+@[0-9a-f]{40} # v\d+$/);
  });

  it('keeps every job at read-only contents permission', () => {
    // One workflow-level `permissions: contents: read` is what GitHub applies to every job, so the
    // guard reads grant lines rather than nesting: any token scope, any `write`, or a grant added by
    // a future job has to be the same read-only line this one is.
    const grants = [...workflow.split('\n'), ...pages.split('\n')]
      .map((line) => line.trim())
      .filter((line) => /^[a-z][a-z-]*(?:-[a-z-]+)*: read$/.test(line) || /token/i.test(line));
    expect(grants.length).toBeGreaterThanOrEqual(1);
    for (const grant of grants) expect(grant).toBe('contents: read');
    for (const text of [workflow, pages]) {
      expect(text).not.toMatch(/write/);
      expect(text).not.toMatch(/id-token/);
      expect(text).not.toMatch(/secrets\.|GITHUB_TOKEN/);
    }
  });

  it('runs nothing that could mutate the registry, the branch, or the site', () => {
    expect(workflow).not.toMatch(/pull_request_target/);
    expect(workflow).not.toMatch(/npm publish/);
    expect(workflow).not.toMatch(/--force|force-with-lease/);
    expect(workflow).not.toMatch(/actions\/deploy-pages|upload-pages-artifact/);
  });

  it('gates the Stage 9 surfaces explicitly', () => {
    for (const step of [
      'npm run secret-scan',
      'npm audit --omit=dev --audit-level=high',
      'npm audit --audit-level=high',
      'npm ci',
      'npm run check',
      'npm run test:browser',
      'git diff --exit-code -- packages/action/dist/index.js',
    ])
      expect(workflow, `ci.yml must run ${step}`).toContain(step);
  });

  it('qualifies source and package behaviour on the supported runtime matrix', () => {
    expect(workflow).toMatch(/os: \[ubuntu-latest, windows-latest\]/);
    expect(workflow).toMatch(/node: \[22, 24\]/);
    expect(workflow).toMatch(/cache: npm/);
    const timeouts = [...workflow.matchAll(/timeout-minutes: (\d+)/g)].map((match) =>
      Number(match[1]),
    );
    expect(timeouts.length).toBe(2);
    for (const timeout of timeouts) expect(timeout).toBeGreaterThan(0);
  });

  it('makes the browser lane fail closed instead of skipping silently', () => {
    const [sourceJob, browserJob] = workflow.split(/^ {2}browser:$/m);
    expect(browserJob, 'ci.yml must keep a dedicated browser job').toBeDefined();
    expect(sourceJob).toMatch(/DIFFBEACON_SKIP_BROWSER: '1'/);
    expect(sourceJob).not.toMatch(/DIFFBEACON_REQUIRE_BROWSER/);
    expect(browserJob).toMatch(/DIFFBEACON_REQUIRE_BROWSER: '1'/);
    expect(browserJob).not.toMatch(/DIFFBEACON_SKIP_BROWSER/);
  });
});
