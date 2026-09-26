import { readFileSync } from 'node:fs';
import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../packages/cli/src/index.js';

// Stage 5, PHASE 12: the pretty renderer has to agree with the count it prints.
// Every case drives the shipped `main()` over a piped diff, so the grammar is proved at
// the boundary a reviewer reads rather than at the renderer call site.

const ONE_FILE = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1111111..2222222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1 +1 @@',
  '-export const one = 1;',
  '+export const one = 2;',
  '',
].join('\n');

const TWO_FILES = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1111111..2222222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1 +1 @@',
  '-export const one = 1;',
  '+export const one = 2;',
  'diff --git a/src/util.ts b/src/util.ts',
  'index 3333333..4444444 100644',
  '--- a/src/util.ts',
  '+++ b/src/util.ts',
  '@@ -1 +1,2 @@',
  '-export const two = 2;',
  '+export const two = 2;',
  '+export const three = 3;',
  '',
].join('\n');

const ONE_BINARY = [
  'diff --git a/assets/logo.png b/assets/logo.png',
  'Binary files a/assets/logo.png and b/assets/logo.png differ',
  '',
].join('\n');

const TWO_BINARY = [
  'diff --git a/assets/logo.png b/assets/logo.png',
  'Binary files a/assets/logo.png and b/assets/logo.png differ',
  'diff --git a/assets/icon.png b/assets/icon.png',
  'Binary files a/assets/icon.png and b/assets/icon.png differ',
  '',
].join('\n');

const restore: (() => void)[] = [];

afterEach(() => {
  for (const undo of restore.splice(0)) undo();
});

/** Pipe `diff` into the CLI and return exactly what `main()` wrote to stdout. */
async function render(diff: string, format = 'pretty'): Promise<string> {
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
  const previousStdin = Object.getOwnPropertyDescriptor(process, 'stdin');
  Object.defineProperty(process, 'stdin', {
    value: (async function* () {
      yield Buffer.from(diff, 'utf8');
    })(),
    configurable: true,
  });
  restore.push(() => {
    if (previousStdin) Object.defineProperty(process, 'stdin', previousStdin);
    out.mockRestore();
    err.mockRestore();
  });
  const code = await main(['review', '--stdin', '--format', format]);
  expect(code, stderr).toBe(0);
  return stdout;
}

describe('pretty counts agree with the grammar', () => {
  it('says one file changed for a one-file diff', async () => {
    expect(await render(ONE_FILE)).toContain('1 file changed');
  });

  it('never writes the ungrammatical one-file summary', async () => {
    expect(await render(ONE_FILE)).not.toContain('1 files changed');
  });

  it('keeps the plural for two files changed', async () => {
    expect(await render(TWO_FILES)).toContain('2 files changed');
  });

  it('says one file in an attention row covering a single file', async () => {
    expect(await render(ONE_FILE)).toContain('1 file ·');
  });

  it('never writes the ungrammatical one-file attention row', async () => {
    expect(await render(ONE_FILE)).not.toContain('1 files ·');
  });

  it('keeps the plural in an attention row covering two files', async () => {
    expect(await render(TWO_FILES)).toContain('2 files ·');
  });

  it('says one binary file for a single binary payload', async () => {
    expect(await render(ONE_BINARY)).toContain('1 binary file');
  });

  it('never writes the ungrammatical one-binary-file line', async () => {
    expect(await render(ONE_BINARY)).not.toContain('1 binary files');
  });

  it('keeps the plural for two binary files', async () => {
    expect(await render(TWO_BINARY)).toContain('2 binary files');
  });
});

describe('all three formats describe the same diff', () => {
  it('reports the same one-file count through pretty, markdown and json', async () => {
    expect(await render(ONE_FILE)).toContain('1 file changed');
    expect(await render(ONE_FILE, 'markdown')).toContain('| Changed files | 1 |');
    expect(JSON.parse(await render(ONE_FILE, 'json')).summary.changedFiles).toBe(1);
  });
});

describe('quoted output stays what the renderer can still produce', () => {
  it('keeps the ungrammatical one-file line out of the documented examples', () => {
    for (const file of ['README.md', 'packages/cli/README.md'])
      expect(readFileSync(file, 'utf8'), file).not.toContain('1 files');
  });
});
