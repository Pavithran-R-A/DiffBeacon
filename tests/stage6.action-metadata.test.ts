import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { actionEntrypoint, readActionMetadata } from '../scripts/action-metadata.mjs';

// Stage 6, PHASES 2, 15 and 21: `action.yml` is the contract a runner actually consumes.
// These cases read it through the same narrow parser the smoke test uses, so metadata and
// behavior cannot drift apart, and they pin the v0.1 decision recorded in the Stage 6 report:
// NO ACTION OUTPUTS ADDED — the Job Summary is the Action's only output.

const repository = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const metadataSource = readFileSync(path.join(repository, 'action.yml'), 'utf8');
const metadata = readActionMetadata(metadataSource);
const bundlePath = path.join(repository, 'packages/action/dist/index.js');

describe('action.yml declares one reviewed entrypoint', () => {
  it('names itself and the review it performs', () => {
    expect(metadata.scalars.name).toBe('DiffBeacon');
    expect(metadata.scalars.description).toMatch(/pull-request diff/);
    expect(metadata.scalars.author).toBeTruthy();
    expect(metadata.blocks.branding?.icon).toBeTruthy();
  });

  it('runs exactly one Node 24 runtime and nothing else', () => {
    expect(metadata.blocks.runs).toEqual({
      using: 'node24',
      main: 'packages/action/dist/index.js',
    });
  });

  it('declares no lifecycle hook that would run beside the entrypoint', () => {
    for (const key of Object.keys(metadata.blocks.runs ?? {}))
      expect(
        key === 'pre' || key === 'post' || key.startsWith('pre-') || key.startsWith('post-'),
        `runs.${key} executes code the review does not control`,
      ).toBe(false);
  });

  it('takes no inputs and produces no named outputs; the Job Summary is the contract', () => {
    expect(metadata.blocks.inputs).toBeUndefined();
    expect(metadata.blocks.outputs).toBeUndefined();
    expect(metadata.scalars.inputs).toBeUndefined();
    expect(metadata.scalars.outputs).toBeUndefined();
  });

  it('points at the tracked bundle through a slash path', () => {
    expect(actionEntrypoint(metadata, repository)).toBe(bundlePath);
    expect(existsSync(bundlePath)).toBe(true);
    expect(metadataSource).not.toMatch(/\\/);
  });

  it('names no file that is not the bundled action entrypoint', () => {
    const tracked = readFileSync(path.join(repository, 'SOURCE_MANIFEST.txt'), 'utf8');
    expect(tracked).toContain('packages/action/dist/index.js\n');
    expect(tracked).toContain('action.yml\n');
  });
});

describe('entrypoint resolution refuses metadata the review cannot vouch for', () => {
  const withRuns = (runs: string) => readActionMetadata(`name: DiffBeacon\nruns:\n${runs}`);
  const main = '  main: packages/action/dist/index.js\n';

  it('refuses a runtime other than the qualified Node 24', () => {
    expect(() => actionEntrypoint(withRuns(`  using: node20\n${main}`), repository)).toThrow(
      /Node 24/,
    );
    expect(() => actionEntrypoint(withRuns(`  using: composite\n${main}`), repository)).toThrow(
      /Node 24/,
    );
  });

  it('refuses an entrypoint outside the bundle directory', () => {
    for (const target of ['evil/index.js', '../../outside.js', '/etc/passwd', './src/index.ts'])
      expect(
        () => actionEntrypoint(withRuns(`  using: node24\n  main: ${target}\n`), repository),
        target,
      ).toThrow(/bundled action entrypoint/);
  });

  it('refuses a pre or post hook and a missing entrypoint', () => {
    expect(() =>
      actionEntrypoint(
        withRuns(`  using: node24\n${main}  pre: packages/action/dist/setup.js\n`),
        repository,
      ),
    ).toThrow(/runs\.pre/);
    expect(() =>
      actionEntrypoint(withRuns(`  using: node24\n${main}  post-if: always()\n`), repository),
    ).toThrow(/runs\.post-if/);
    expect(() => actionEntrypoint(withRuns('  using: node24\n'), repository)).toThrow(
      /no runs\.main/,
    );
    expect(() => actionEntrypoint(readActionMetadata('name: x\n'), repository)).toThrow(
      /no runs: block/,
    );
  });
});

describe('the metadata reader cannot quietly skip an execution surface', () => {
  it('rejects a composite step list instead of parsing around it', () => {
    expect(() =>
      readActionMetadata('runs:\n  using: composite\n  steps:\n    - run: npm install\n'),
    ).toThrow(/nests deeper/);
  });

  it('rejects a top-level list item', () => {
    expect(() => readActionMetadata('- uses: actions/checkout@v7\n')).toThrow(/unsupported syntax/);
  });

  it('rejects nesting deeper than the shape it understands', () => {
    expect(() => readActionMetadata('runs:\n  inputs:\n    token:\n      default: x\n')).toThrow(
      /nests deeper/,
    );
  });

  it('rejects a key nested under nothing', () => {
    expect(() => readActionMetadata('  using: node24\n')).toThrow(/nests a key under nothing/);
  });

  it('rejects repeated keys rather than letting the last one win', () => {
    expect(() => readActionMetadata('name: a\nname: b\n')).toThrow(/repeats a top-level key/);
    expect(() => readActionMetadata('runs:\n  using: node20\n  using: node24\n')).toThrow(
      /repeats runs\.using/,
    );
  });

  it('rejects indentation it did not read, including tabs', () => {
    expect(() => readActionMetadata('runs:\n    using: node24\n')).toThrow(/indentation/);
    expect(() => readActionMetadata('runs:\n\tusing: node24\n')).toThrow(/indentation/);
  });

  it('rejects a flow mapping or sequence as a value', () => {
    expect(() => readActionMetadata('runs: { using: node24 }\n')).toThrow(/value form/);
    expect(() => readActionMetadata('name: [a, b]\n')).toThrow(/value form/);
  });

  it('reads a quoted value without its quotes', () => {
    expect(readActionMetadata('description: "Map review attention."\n').scalars.description).toBe(
      'Map review attention.',
    );
  });

  it('ignores comments and blank lines', () => {
    expect(readActionMetadata('# comment\n\nname: DiffBeacon\n').scalars.name).toBe('DiffBeacon');
  });
});

describe('the bundle a runner executes is the reviewed artifact', () => {
  const bundle = readFileSync(bundlePath, 'utf8');

  it('contains the Action runtime it claims to be', () => {
    for (const token of [
      'DiffBeacon Action error',
      '# DiffBeacon review',
      'GITHUB_EVENT_NAME',
      'GITHUB_EVENT_PATH',
      'GITHUB_WORKSPACE',
      'GITHUB_STEP_SUMMARY',
    ])
      expect(bundle, token).toContain(token);
  });

  it('carries no CLI startup surface', () => {
    for (const token of ['Usage:', 'diffbeacon review', 'launchedAsCli', '--format'])
      expect(bundle, token).not.toContain(token);
  });

  it('reaches no network, package-manager, or shell surface', () => {
    for (const token of [
      '@actions/',
      'octokit',
      'node:http',
      'node:https',
      'node:net',
      'node:tls',
      'node:dgram',
      'fetch(',
      'XMLHttpRequest',
      'WebSocket',
      'sendBeacon',
      'npm install',
      'npm ci',
      'yarn install',
      'pnpm install',
      'shell: true',
      'shell:!0',
    ])
      expect(bundle, token).not.toContain(token);
  });

  it('starts programs only through the Git boundary, never through a shell', () => {
    expect(bundle).toContain('node:child_process');
    expect(bundle).toContain('windowsHide');
    expect(bundle).not.toMatch(/shell:\s*(true|!0)/);
  });
});
