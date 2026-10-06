import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VERSION, main } from '../packages/cli/src/index.js';

// Stage 5 qualifies the CLI contract a user actually types: which argument forms are
// accepted, what each rejection costs, and which exit code a script can branch on.
// Every case here runs through `main()`, the same function the shipped entrypoint calls,
// so help text, parser decisions and exit codes are proved together rather than assumed.

const EXIT = { ok: 0, unexpected: 1, usage: 2, diffUnavailable: 3, outputUnwritable: 4 } as const;

async function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  const err = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
  try {
    return { code: await main(args), stdout, stderr };
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
}

const temporary: string[] = [];

/** A real directory that is not a Git repository, used to prove usage errors never
 *  reach Git: anything failing before the repository lookup cannot return 3. */
function outsideRepository(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage5-nogit-'));
  temporary.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporary.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

describe('help and version never touch Git or stdin', () => {
  it('prints usage for no arguments, --help and -h, all to stdout with exit 0', async () => {
    const previous = process.cwd();
    process.chdir(outsideRepository());
    try {
      for (const args of [[], ['--help'], ['-h']]) {
        const result = await run(args);
        expect(result.code, args.join(' ')).toBe(EXIT.ok);
        expect(result.stdout).toContain('Usage:');
        expect(result.stderr).toBe('');
      }
    } finally {
      process.chdir(previous);
    }
  });

  it('accepts --help and -h after the review command', async () => {
    for (const args of [
      ['review', '--help'],
      ['review', '-h'],
    ]) {
      const result = await run(args);
      expect(result.code, args.join(' ')).toBe(EXIT.ok);
      expect(result.stdout).toContain('Usage:');
      expect(result.stderr).toBe('');
    }
  });

  it('prints the package version for --version and -v', async () => {
    const manifest = await import('../packages/cli/package.json', { with: { type: 'json' } });
    for (const args of [['--version'], ['-v'], ['review', '--version'], ['review', '-v']]) {
      const result = await run(args);
      expect(result.code, args.join(' ')).toBe(EXIT.ok);
      expect(result.stdout).toBe(`${manifest.default.version}\n`);
      expect(result.stdout).toBe(`${VERSION}\n`);
      expect(result.stderr).toBe('');
    }
  });

  it('works outside a Git repository', async () => {
    const previous = process.cwd();
    process.chdir(outsideRepository());
    try {
      expect((await run(['--version'])).code).toBe(EXIT.ok);
      expect((await run(['--help'])).code).toBe(EXIT.ok);
    } finally {
      process.chdir(previous);
    }
  });

  it('does not claim npm registry availability in help', async () => {
    const result = await run(['--help']);
    expect(result.stdout.toLowerCase()).not.toMatch(/npx diffbeacon|npm install -g/);
  });
});

describe('usage failures are rejected before any Git process runs', () => {
  it('rejects a plain revision instead of silently comparing against the working tree', async () => {
    const result = await run(['review', 'abc1234']);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr).toContain('two-endpoint');
    expect(result.stderr).toContain('..');
  });

  it('rejects a single revision even when it names a real ref', async () => {
    const result = await run(['review', 'HEAD']);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr).not.toContain('0 files changed');
  });

  it('rejects a range whose endpoints are missing', async () => {
    for (const range of ['...', 'HEAD~1...', '...HEAD', 'HEAD~1..', '..HEAD']) {
      const result = await run(['review', range]);
      expect(result.code, range).toBe(EXIT.usage);
      expect(result.stderr, range).toContain(JSON.stringify(range));
    }
  });

  it('names the whole range when one side is invalid', async () => {
    const result = await run(['review', 'HEAD~1...']);
    expect(result.stderr).toContain('HEAD~1...');
  });

  it('keeps a rejected revision echo bounded', async () => {
    const long = 'r'.repeat(4_000);
    const result = await run(['review', long]);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr.length).toBeLessThan(400);
    expect(result.stderr).not.toContain('r'.repeat(500));
  });

  it('rejects a second positional range', async () => {
    const result = await run(['review', 'HEAD~1...HEAD', 'HEAD~1..HEAD']);
    expect(result.code).toBe(EXIT.usage);
  });

  it('rejects mixing a range with --stdin', async () => {
    expect((await run(['review', 'HEAD~1...HEAD', '--stdin'])).code).toBe(EXIT.usage);
  });

  it('rejects a command with neither range nor --stdin', async () => {
    const result = await run(['review']);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr).toContain('--stdin');
  });

  it('rejects an unknown command as a usage failure', async () => {
    const result = await run(['analyze', 'HEAD~1...HEAD']);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr).toContain('--help');
  });

  it('rejects an unknown option and points at help', async () => {
    const result = await run(['review', '--turbo', 'HEAD~1...HEAD']);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr).toContain('--turbo');
    expect(result.stderr).toContain('--help');
  });

  it('distinguishes an unsupported --format=value form from an invalid value', async () => {
    const equals = await run(['review', 'HEAD~1...HEAD', '--format=json']);
    expect(equals.code).toBe(EXIT.usage);
    expect(equals.stderr).toContain('--format json');
    const invalid = await run(['review', 'HEAD~1...HEAD', '--format', 'yaml']);
    expect(invalid.code).toBe(EXIT.usage);
    expect(invalid.stderr).toContain('pretty');
    expect(invalid.stderr).toContain('yaml');
    expect(equals.stderr).not.toBe(invalid.stderr);
  });

  it('reports a missing --format value as missing, not invalid', async () => {
    const result = await run(['review', 'HEAD~1...HEAD', '--format']);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr).toContain('requires a value');
  });

  it('reports a missing --output value as missing', async () => {
    const result = await run(['review', 'HEAD~1...HEAD', '--output']);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr).toContain('requires a value');
  });

  it('refuses to consume another recognized option as the --output filename', async () => {
    for (const value of ['--format', '--output', '--stdin']) {
      const result = await run(['review', 'HEAD~1...HEAD', '--output', value, 'json']);
      expect(result.code, value).toBe(EXIT.usage);
      expect(result.stderr, value).toContain('--output');
    }
  });

  it('still allows an output filename that merely begins with a dash', async () => {
    const previous = process.cwd();
    const directory = outsideRepository();
    process.chdir(directory);
    try {
      const result = await run(['review', 'HEAD~1...HEAD', '--output', '-dash.txt']);
      // It gets past argument parsing, so the failure is the repository lookup, not usage.
      expect(result.code).toBe(EXIT.diffUnavailable);
    } finally {
      process.chdir(previous);
    }
  });

  it('treats -- as the end of options', async () => {
    const previous = process.cwd();
    process.chdir(outsideRepository());
    try {
      const result = await run(['review', '--', 'HEAD~1...HEAD']);
      expect(result.stderr).not.toContain('Unknown option');
      expect(result.code).toBe(EXIT.diffUnavailable);
    } finally {
      process.chdir(previous);
    }
  });

  it('rejects repeated mode, format and output selectors instead of letting the last one win', async () => {
    const cases: string[][] = [
      ['review', '--stdin', '--stdin'],
      ['review', 'HEAD~1...HEAD', '--format', 'json', '--format', 'markdown'],
      ['review', 'HEAD~1...HEAD', '--output', 'a.txt', '--output', 'b.txt'],
    ];
    for (const args of cases) {
      const result = await run(args);
      expect(result.code, args.join(' ')).toBe(EXIT.usage);
      expect(result.stderr, args.join(' ')).toContain('more than once');
    }
  });
});

describe('exit codes separate usage from operations', () => {
  it('reports a missing repository as an operational diff-unavailable failure', async () => {
    const previous = process.cwd();
    process.chdir(outsideRepository());
    try {
      const result = await run(['review', 'HEAD~1...HEAD']);
      expect(result.code).toBe(EXIT.diffUnavailable);
      expect(result.stderr).toContain('not a Git repository');
      expect(result.stderr).toContain('--stdin');
      expect(result.stderr).not.toContain('Command failed:');
      expect(result.stderr).not.toContain('at async ');
    } finally {
      process.chdir(previous);
    }
  });

  it('never uses the severity of an observation as an exit code', async () => {
    const previous = process.cwd();
    process.chdir(outsideRepository());
    try {
      const result = await run(['review', 'HEAD~1...HEAD', '--format', 'json']);
      expect(result.code).toBe(EXIT.diffUnavailable);
      expect(result.stdout).toBe('');
    } finally {
      process.chdir(previous);
    }
  });

  it('keeps every usage rejection out of Git: no repository message leaks', async () => {
    const previous = process.cwd();
    process.chdir(outsideRepository());
    try {
      for (const args of [
        ['review', 'abc1234'],
        ['review', '--turbo'],
        ['review', 'HEAD~1...HEAD', '--format', 'yaml'],
        ['review', 'HEAD~1...HEAD', '--stdin'],
        ['analyze', 'HEAD~1...HEAD'],
        ['review', 'HEAD~1...HEAD', '--stdin', '--stdin'],
      ]) {
        const result = await run(args);
        expect(result.code, args.join(' ')).toBe(EXIT.usage);
        expect(result.stderr, args.join(' ')).not.toContain('Git repository');
      }
    } finally {
      process.chdir(previous);
    }
  });
});

describe('help text describes only accepted forms', () => {
  it('documents both supported range shapes and rejects a plain revision', async () => {
    const help = (await run(['--help'])).stdout;
    expect(help).toContain('<rev>..<rev>');
    expect(help).toContain('<rev>...<rev>');
    expect(help).toContain('--stdin');
    expect(help).toContain('NO_COLOR');
  });

  it('documents the output-file and exit-code contract it actually implements', async () => {
    const help = (await run(['--help'])).stdout;
    expect(help).toMatch(/--output/);
    expect(help).toMatch(/instead of stdout/);
    for (const code of ['0', '1', '2', '3', '4']) expect(help).toContain(`Exit ${code}`);
    expect(help).toMatch(/8 MiB|8388608/);
  });

  it('lists the short aliases it accepts', async () => {
    const help = (await run(['--help'])).stdout;
    expect(help).toContain('-h');
    expect(help).toContain('-v');
  });

  it('documents every long option the package README advertises', async () => {
    const readme = readFileSync('packages/cli/README.md', 'utf8');
    const documented = new Set(readme.match(/--[a-z][a-z-]*/g) ?? []);
    expect(documented.size).toBeGreaterThan(0);
    const help = (await run(['--help'])).stdout;
    for (const option of documented)
      expect(help, `${option} is in the README but not in --help`).toContain(option);
  });

  it('pins every published-package example to the released version', () => {
    for (const file of ['README.md', 'packages/cli/README.md']) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      const npxLines = lines.filter((line) => line.includes('npx diffbeacon'));
      expect(npxLines.length, `${file} shows no npx example`).toBeGreaterThan(0);
      // `v0.1.0` is on the registry, so an npx example is now a promise about resolution: it has to
      // name the version that was actually consumer-smoke-tested, not a bare `latest`.
      for (const line of npxLines)
        expect(line, `${file} advertises an unpinned npx run`).toMatch(
          /npx (?:--yes )?diffbeacon@0\.1\.0/,
        );
    }
  });
});
