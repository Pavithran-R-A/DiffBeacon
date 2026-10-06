import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const pages = readFileSync('.github/workflows/pages.yml', 'utf8');

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

describe('Stage 9 CI contract', () => {
  it('pins every action to an immutable commit with the upstream tag named', () => {
    const references = [...usesLines(workflow), ...usesLines(pages)];
    expect(references.length).toBeGreaterThanOrEqual(3);
    for (const reference of references) expect(reference).toMatch(/^[^@\s]+@[0-9a-f]{40} # v\d+$/);
  });

  it('keeps ci.yml read-only and holds pages.yml to the least privilege Pages needs', () => {
    // ci.yml analyses source only. One workflow-level `permissions: contents: read` is what GitHub
    // applies to every job, so the guard reads grant lines rather than nesting: any token scope, any
    // `write`, or a grant added by a future job has to be the same read-only line this one is.
    const ciGrants = grantLines(workflow);
    expect(ciGrants.length).toBeGreaterThanOrEqual(1);
    for (const grant of ciGrants) expect(grant).toBe('contents: read');
    expect(workflow).not.toMatch(/write/);
    expect(workflow).not.toMatch(/id-token/);
    expect(workflow).not.toMatch(/secrets\.|GITHUB_TOKEN/);

    // Build/test code receives only source read. The Pages write and OIDC mint are scoped to the
    // dedicated deployment job, so package scripts and browser tests never execute with deployment
    // credentials in their environment.
    const [beforeDeploy, deployJob] = pages.split(/^ {2}deploy:$/m);
    expect(deployJob, 'pages.yml must keep a dedicated deploy job').toBeDefined();
    expect(grantLines(beforeDeploy ?? '')).toEqual(['contents: read']);
    expect([...grantLines(deployJob ?? '')].sort()).toEqual([
      'contents: read',
      'id-token: write',
      'pages: write',
    ]);
    expect(pages).not.toMatch(/^permissions:/m);
    expect(pages).toMatch(/^ {4}environment:\n {6}name: github-pages/m);
    expect(pages).not.toMatch(/secrets\.|GITHUB_TOKEN/);
    expect(pages).not.toMatch(/deployments:|pull-requests:|security-events:|admin:/);
  });

  it('deploys the demo through the official Pages actions instead of stopping at an artifact', () => {
    for (const step of [
      'actions/checkout@',
      'actions/setup-node@',
      'npm ci',
      'npm run build:web',
      'actions/configure-pages@',
      'actions/upload-pages-artifact@',
      'actions/deploy-pages@',
    ])
      expect(pages, `pages.yml must run ${step}`).toContain(step);
    // The URL a consumer is sent to must come from GitHub's deploy step, not from prose.
    expect(pages).toMatch(/steps\.deployment\.outputs\.page_url/);
  });

  it('allows Pages to deploy only main after the same security and browser gates', () => {
    expect(pages).toMatch(/concurrency:\n {2}group: pages\n {2}cancel-in-progress: false/);
    const [buildJob] = pages.split(/^ {2}deploy:$/m);
    expect(buildJob).toMatch(/if: github\.ref == 'refs\/heads\/main'/);
    expect(buildJob).toMatch(/timeout-minutes: \d+/);
    expect(buildJob).toMatch(/DIFFBEACON_SKIP_BROWSER: '1'/);
    for (const step of [
      'npm run secret-scan',
      'npm audit --omit=dev --audit-level=high',
      'npm audit --audit-level=high',
      'npm run check',
      "DIFFBEACON_SKIP_BROWSER: '0'",
      "DIFFBEACON_REQUIRE_BROWSER: '1'",
      'npm run test:browser',
    ])
      expect(buildJob, `pages.yml build job must run ${step}`).toContain(step);
    expect(buildJob.indexOf('npm run test:browser')).toBeLessThan(
      buildJob.indexOf('npm run build:web'),
    );
  });

  it('runs nothing that could mutate the registry, the branch, or the site from ci.yml', () => {
    expect(workflow).not.toMatch(/pull_request_target/);
    expect(workflow).not.toMatch(/npm publish/);
    expect(workflow).not.toMatch(/--force|force-with-lease/);
    expect(workflow).not.toMatch(/actions\/deploy-pages|upload-pages-artifact/);
    for (const text of [workflow, pages]) {
      expect(text).not.toMatch(/npm publish/);
      expect(text).not.toMatch(/--force|force-with-lease/);
    }
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
