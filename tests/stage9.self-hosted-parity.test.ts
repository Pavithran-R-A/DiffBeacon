import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hosted = readFileSync('.github/workflows/ci.yml', 'utf8');
const selfHosted = readFileSync('.github/workflows/ci-self-hosted-stage9.yml', 'utf8');

const usesLines = (text: string) =>
  [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(.+)$/gm)].map((match) => match[1]?.trim() ?? '');

const runCommands = (text: string) =>
  [...text.matchAll(/^\s+run:\s+(\S.*)$/gm)].map((match) => (match[1] ?? '').trim());

// Jobs start at a two-space key under `jobs:`; slicing from that key keeps the two-space keys of the
// `on:` and `concurrency:` blocks out of the inventory. Each job block then carries one lane's own
// flags, which is what the per-lane assertions below need to stay honest about.
const jobsOf = (text: string) => {
  const section = text.slice(text.indexOf('\njobs:\n'));
  const starts = [...section.matchAll(/^ {2}([a-z0-9][a-z0-9-]*):$/gm)]
    .map((match) => match[1])
    .filter((name): name is string => Boolean(name));
  return starts.map((name) => {
    const from = section.indexOf(`  ${name}:`);
    const next = starts
      .filter((other) => other !== name)
      .map((other) => section.indexOf(`  ${other}:`))
      .filter((index) => index > from);
    return { name, body: section.slice(from, next.length ? Math.min(...next) : section.length) };
  });
};

const selfHostedJobs = jobsOf(selfHosted);

describe('Stage 9 self-hosted CI parity', () => {
  it('runs every command the hosted workflow runs', () => {
    const required = runCommands(hosted);
    expect(required.length).toBeGreaterThanOrEqual(7);
    for (const command of required)
      expect(selfHosted, `the self-hosted lane must run \`${command}\``).toContain(command);
  });

  it('gates each Stage 9 surface the alternative CI must not omit', () => {
    for (const step of [
      'npm run secret-scan',
      'npm audit --omit=dev --audit-level=high',
      'npm audit --audit-level=high',
      'npm ci',
      'npm run check',
      'npm run package-smoke',
      'npm run action-smoke',
      'git diff --exit-code -- packages/action/dist/index.js',
      'npm run test:browser',
    ])
      expect(selfHosted, `ci-self-hosted-stage9.yml must run ${step}`).toContain(step);
  });

  it('keeps the alternative lane on self-hosted runners only', () => {
    const runsOn = [...selfHosted.matchAll(/^ {4}runs-on:\s*(.+)$/gm)].map((match) => match[1]);
    expect(runsOn.length).toBeGreaterThanOrEqual(6);
    for (const line of runsOn) {
      expect(line).toContain('self-hosted');
      expect(line).toContain('diffbeacon-stage9');
      expect(line).not.toContain('ubuntu-latest');
      expect(line).not.toContain('windows-latest');
    }
  });

  it('leaves the hosted contract intact in ci.yml', () => {
    expect(hosted).toMatch(/os: \[ubuntu-latest, windows-latest\]/);
    expect(hosted).toMatch(/runs-on: \$\{\{ matrix\.os \}\}/);
    expect(hosted).toContain('Browser lane (ubuntu-latest / Node 24)');
  });

  it('qualifies both operating systems and both supported Node majors', () => {
    const names = selfHostedJobs.map((job) => job.name);
    for (const os of ['linux', 'windows'])
      expect(names.some((name) => name.includes(os))).toBe(true);
    for (const node of ['22', '24']) expect(names.some((name) => name.endsWith(node))).toBe(true);
    for (const os of ['linux', 'windows']) {
      expect(selfHosted).toMatch(
        new RegExp(`runs-on: \\[self-hosted, ${os}, x64, diffbeacon-stage9\\]`),
      );
    }
  });

  it('installs the Node the lane claims instead of trusting the ambient runtime', () => {
    for (const job of selfHostedJobs) {
      expect(job.body, `${job.name} must set up Node explicitly`).toContain(
        'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
      );
      expect(job.body).toMatch(/node-version: '(22|24)'/);
      expect(job.body).toContain('node_major_ok');
    }
  });

  it('reuses only the action pins the hosted workflow already trusts', () => {
    const hostedPins = new Set(usesLines(hosted));
    const references = usesLines(selfHosted);
    expect(references.length).toBeGreaterThanOrEqual(14);
    for (const reference of references) {
      expect(reference).toMatch(/^[^@\s]+@[0-9a-f]{40} # v\d+$/);
      expect(hostedPins, `${reference} is not a pin this repository already trusts`).toContain(
        reference,
      );
    }
  });

  it('keeps the alternative lane at read-only permissions with no credential reach', () => {
    const grants = selfHosted
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[a-z][a-z-]*(?:-[a-z-]+)*: read$/.test(line) || /token/i.test(line));
    expect(grants.length).toBeGreaterThanOrEqual(1);
    for (const grant of grants) expect(grant).toBe('contents: read');
    expect(selfHosted).not.toMatch(/write/);
    expect(selfHosted).not.toMatch(/id-token/);
    expect(selfHosted).not.toMatch(/secrets\.|GITHUB_TOKEN/);
  });

  it('runs nothing that could mutate the registry, the branch, or the site', () => {
    expect(selfHosted).not.toMatch(/pull_request/);
    expect(selfHosted).not.toMatch(/npm publish/);
    expect(selfHosted).not.toMatch(/--force|force-with-lease/);
    expect(selfHosted).not.toMatch(/actions\/deploy-pages|upload-pages-artifact/);
  });

  it('suppresses browser suites in the source lanes and requires them in the browser lane', () => {
    const browserJobs = selfHostedJobs.filter((job) => job.name.startsWith('browser'));
    expect(browserJobs.length).toBe(1);
    expect(browserJobs[0]?.body).toMatch(/DIFFBEACON_REQUIRE_BROWSER: '1'/);
    expect(browserJobs[0]?.body).not.toMatch(/DIFFBEACON_SKIP_BROWSER/);
    expect(browserJobs[0]?.body).toContain('npm run test:browser');
    const sourceJobs = selfHostedJobs.filter(
      (job) => job.name.startsWith('linux-node') || job.name.startsWith('windows-node'),
    );
    expect(sourceJobs.length).toBe(4);
    for (const job of sourceJobs) {
      expect(job.body).toMatch(/DIFFBEACON_SKIP_BROWSER: '1'/);
      expect(job.body).not.toMatch(/DIFFBEACON_REQUIRE_BROWSER/);
    }
  });

  it('proves the package surface from the tarball a clean consumer installs', () => {
    const packageJobs = selfHostedJobs.filter((job) => job.name.startsWith('package-'));
    expect(packageJobs.length).toBe(2);
    for (const job of packageJobs) {
      expect(job.body).toContain('npm pack ./packages/cli');
      expect(job.body).toContain('tar -tzf');
      expect(job.body).toContain('npm install --no-audit --no-fund');
      expect(job.body).toMatch(/diffbeacon\S*\s+--version/);
      expect(job.body).toMatch(/diffbeacon\S*\s+--help/);
    }
  });

  it('bounds every lane with a timeout', () => {
    const timeouts = [...selfHosted.matchAll(/timeout-minutes: (\d+)/g)].map((match) =>
      Number(match[1]),
    );
    expect(timeouts.length).toBe(selfHostedJobs.length);
    for (const timeout of timeouts) expect(timeout).toBeGreaterThan(0);
  });

  it('checks the workspace back to cleanliness in every lane', () => {
    for (const job of selfHostedJobs) {
      expect(job.body, `${job.name} must prove the workspace is clean`).toContain(
        'git status --porcelain --untracked-files=all',
      );
    }
  });

  it('propagates native exit codes in every PowerShell lane', () => {
    // PowerShell does not fail a step when a native command exits non-zero, so each `npm` call in a
    // PowerShell-defaulted job has to carry an explicit `$LASTEXITCODE` guard. Counted, not parsed
    // line by line: a lane that loses its guards drops below its own `npm` count and fails here.
    const powershellJobs = selfHostedJobs.filter((job) => /shell: powershell/.test(job.body));
    expect(powershellJobs.length).toBeGreaterThanOrEqual(3);
    for (const job of powershellJobs) {
      const npmCalls = (job.body.match(/^\s+npm \S/gm) ?? []).length;
      const guards = (job.body.match(/\$LASTEXITCODE/g) ?? []).length;
      expect(npmCalls, `${job.name} runs npm with no call to guard`).toBeGreaterThan(0);
      expect(guards, `${job.name} lost its exit-code guards`).toBeGreaterThanOrEqual(npmCalls);
    }
  });
});
