/**
 * Stage 8, PHASE 36: filenames whose bytes cannot be decoded as UTF-8. Two different kinds of
 * evidence are in scope here, and they are kept apart on purpose. A structural Git path whose
 * C-quoted bytes are not valid UTF-8 cannot be represented losslessly by the string-valued report
 * model, so the parser diagnoses it and withholds the path instead of publishing U+FFFD as identity.
 * Whether a real Git really produces that form for a real undecodable name can only be measured where
 * such a file can exist, which is a POSIX filesystem — so that block is Linux-only, runs the shipped
 * diff collector, and skips here with a recorded reason rather than having its answer typed in by hand.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  analyzeDiff,
  decodeGitPath,
  parseUnifiedDiff,
  renderJson,
  renderMarkdown,
  renderPretty,
} from '../packages/core/src/index.js';
import { collectGitDiffAsync } from '../packages/cli/src/git.js';
import {
  createFixtureRepository,
  removeFixtureRepository,
  type FixtureRepository,
} from './git-repository-fixture.js';

const POSIX = process.platform !== 'win32';
const REPLACEMENT = '\uFFFD';
/** One half of a surrogate pair cannot be encoded as UTF-8, so it must never reach a report name. */
const SURROGATE_HALF = /[\uD800-\uDFFF]/;
const CONTROL = /\p{Cc}/u;

/**
 * The shape real Git writes when a name needs C-quoting: the quotes wrap the `a/` and `b/` prefix
 * along with the path. Measured on this host with a non-ASCII name in `../stage8/probe-git-quote*`.
 */
function quotedPatch(inner: string): string {
  return [
    `diff --git "a/${inner}" "b/${inner}"`,
    'new file mode 100644',
    'index 0000000..b680253',
    '--- /dev/null',
    `+++ "b/${inner}"`,
    '@@ -0,0 +1 @@',
    '+changed',
    '',
  ].join('\n');
}

function plainPatch(name: string): string {
  return [
    `diff --git a/${name} b/${name}`,
    'new file mode 100644',
    'index 0000000..b680253',
    '--- /dev/null',
    `+++ b/${name}`,
    '@@ -0,0 +1 @@',
    '+changed',
    '',
  ].join('\n');
}

/** 0xFF, the octet no UTF-8 sequence can start with, spelled the way Git spells it. */
const INVALID_OCTET = 'src/bad\\377name.ts';
/** A valid two-byte é followed by the undecodable octet, in one name. */
const MIXED_NAME = 'src/caf\\303\\251\\377.ts';

describe('a header carrying bytes no UTF-8 decoder can represent', () => {
  it('diagnoses an undecodable quoted path instead of publishing a lossy filename', () => {
    const parsed = parseUnifiedDiff(quotedPatch(INVALID_OCTET));
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({
      oldPath: null,
      newPath: null,
      displayPath: '<unknown path>',
      surfaces: [],
    });
    expect(parsed.files[0]?.displayPath).not.toMatch(SURROGATE_HALF);
    expect(parsed.diagnostics.map((entry) => entry.code)).toEqual([
      'malformed-header',
      'malformed-header',
    ]);
  });

  it('withholds a mixed valid/invalid byte path instead of keeping only its decodable prefix', () => {
    const parsed = parseUnifiedDiff(quotedPatch(MIXED_NAME));
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]?.displayPath).toBe('<unknown path>');
    expect(parsed.files[0]?.displayPath).not.toContain('café');
    expect(parsed.diagnostics.map((entry) => entry.code)).toEqual([
      'malformed-header',
      'malformed-header',
    ]);
  });

  it('keeps the lossy decoder helper separate from structural path identity', () => {
    const parsedName = parseUnifiedDiff(quotedPatch(INVALID_OCTET)).files[0]?.displayPath ?? '';
    const decoded = decodeGitPath(`"${INVALID_OCTET}"`);
    expect(parsedName).toBe('<unknown path>');
    expect(decoded).toBe(`src/bad${REPLACEMENT}name.ts`);
    expect(decoded).not.toMatch(SURROGATE_HALF);
  });

  it('reads the other C escapes a quoted header carries', () => {
    // Each expectation is the byte C quoting names, not the letter that follows the backslash.
    const decoded: [string, string][] = [
      ['src/tab\\tname.ts', 'src/tab\tname.ts'],
      ['src/quote\\"name.ts', 'src/quote"name.ts'],
      ['src/back\\\\slash.ts', 'src/back\\slash.ts'],
      ['src/newline\\nname.ts', 'src/newline\nname.ts'],
      ['src/bell\\aname.ts', 'src/bell\u0007name.ts'],
      ['src/backspace\\bname.ts', 'src/backspace\u0008name.ts'],
      ['src/formfeed\\fname.ts', 'src/formfeed\u000cname.ts'],
      ['src/vtab\\vname.ts', 'src/vtab\u000bname.ts'],
      ['src/carriage\\rname.ts', 'src/carriage\rname.ts'],
      ['src/oct\\101.ts', 'src/octA.ts'],
    ];
    for (const [inner, expected] of decoded) {
      const parsed = parseUnifiedDiff(quotedPatch(inner));
      expect(parsed.files, inner).toHaveLength(1);
      expect(parsed.diagnostics, inner).toEqual([]);
      expect(parsed.files[0]?.displayPath, inner).toBe(expected);
    }
  });

  it('decodes an escaped tab to the tab itself, then keeps it out of the terminal paint', () => {
    const patch = quotedPatch('src/tab\\tname.ts');
    const name = parseUnifiedDiff(patch).files[0]?.displayPath ?? '';
    // The tab is real data in a real filename, so the report keeps it; the display policy is what
    // turns it into a space where a terminal would otherwise act on it.
    expect(name).toContain('\t');
    for (const line of renderPretty(analyzeDiff(patch)).split('\n'))
      expect(line).not.toMatch(CONTROL);
  });

  it('accepts the raw form, where the byte arrived already replaced before any parsing', () => {
    const parsed = parseUnifiedDiff(plainPatch(`src/bad${REPLACEMENT}name.ts`));
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]?.displayPath).toBe(`src/bad${REPLACEMENT}name.ts`);
    expect(parsed.diagnostics).toEqual([]);
  });

  it('prints a literal replacement code point as ordinary text in all three formats', () => {
    const patch = plainPatch(`src/bad${REPLACEMENT}name.ts`);
    const name = parseUnifiedDiff(patch).files[0]?.displayPath ?? '';
    const report = analyzeDiff(patch);
    const pretty = renderPretty(report);
    const markdown = renderMarkdown(report);
    expect(pretty).toContain(REPLACEMENT);
    expect(markdown).toContain(REPLACEMENT);
    expect(renderJson(report)).toContain(REPLACEMENT);
    // A control character that survived into the paint would be interpreted by the terminal, so
    // every rendered line is checked on its own: a whole multiline string always contains
    // newlines, and a newline is itself a control character.
    for (const line of pretty.split('\n')) expect(line).not.toMatch(CONTROL);
    for (const line of markdown.split('\n')) expect(line).not.toMatch(CONTROL);
    // Measured shape: the name appears in exactly two Markdown lines — the changed-files table row
    // and the evidence "Observed in:" line — and in both it is code-span text, never bare markup.
    const rows = markdown.split('\n').filter((line) => line.includes(name));
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toContain('`' + name + '`');
    expect(rows.some((row) => row.startsWith('| added | '))).toBe(true);
    expect(name).toBe(`src/bad${REPLACEMENT}name.ts`);
    expect(markdown).not.toContain('\\377');
    expect(pretty).not.toContain('\\377');
  });

  it('round-trips a literal replacement code point through JSON next to ordinary names', () => {
    const report = analyzeDiff(
      `${plainPatch(`src/bad${REPLACEMENT}name.ts`)}${plainPatch('src/ok.ts')}`,
    );
    expect(report.summary.changedFiles).toBe(2);
    expect(JSON.parse(renderJson(report))).toEqual(report);
    expect(renderJson(report)).not.toMatch(SURROGATE_HALF);
  });
});

let repo: FixtureRepository | undefined;

describe.runIf(POSIX)('what a real Git writes for a name that is not valid UTF-8', () => {
  beforeAll(() => {
    repo = createFixtureRepository({ prefix: 'diffbeacon-stage8-bytes-', identity: 'bytes' });
    mkdirSync(path.join(repo.cwd, 'src'), { recursive: true });
    writeFileSync(path.join(repo.cwd, 'src', 'app.ts'), 'first\n');
    repo.commit('seed');
    // A name ext4 and tmpfs accept and no decoder can represent. It is written through a Buffer
    // path, and staged with `git add --all`, so the hostile bytes never enter an argv vector.
    writeFileSync(
      Buffer.concat([
        Buffer.from(path.join(repo.cwd, 'src/bad'), 'utf8'),
        Buffer.from([0xff]),
        Buffer.from('name.ts', 'utf8'),
      ]),
      'changed\n',
    );
    repo.commit('undecodable name');
  });

  afterAll(() => {
    if (repo) removeFixtureRepository(repo.root);
  });

  it('pins Git quoting and refuses to publish a lossy filename as a factual path', async () => {
    const patch = await collectGitDiffAsync('HEAD~1...HEAD', repo?.cwd ?? '');
    expect(patch).toContain('\\377');
    expect(patch).not.toContain(REPLACEMENT);

    const parsed = parseUnifiedDiff(patch);
    const report = analyzeDiff(patch);
    expect(report.files).toHaveLength(1);
    expect(report.summary.diagnostics).toBeGreaterThan(0);
    expect(parsed.diagnostics.map((entry) => entry.code)).toContain('malformed-header');
    expect(report.files[0]).toMatchObject({
      oldPath: null,
      newPath: null,
      displayPath: '<unknown path>',
      surfaces: [],
    });
    for (const line of renderPretty(report).split('\n')) expect(line).not.toMatch(CONTROL);
  });

  it('documents the external raw-text limitation when core.quotePath=false bypasses the collector pin', () => {
    const raw = execFileSync(
      'git',
      ['-c', 'core.quotePath=false', 'diff', '--no-color', 'HEAD~1...HEAD', '--'],
      {
        cwd: repo?.cwd ?? '',
        encoding: 'buffer',
        shell: false,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    console.info(
      'OBSERVED (core.quotePath=false): raw 0xFF present =',
      raw.includes(0xff),
      'quoted escape present =',
      raw.toString('utf8').includes('\\377'),
    );
    const report = analyzeDiff(raw.toString('utf8'));
    expect(report.files).toHaveLength(1);
    expect(report.summary.diagnostics).toBe(0);
    expect(report.files[0]?.displayPath).toContain(REPLACEMENT);
    expect(report.files[0]?.displayPath).not.toMatch(SURROGATE_HALF);
  });
});

if (!POSIX)
  console.warn(
    'stage8.invalid-byte-paths: the real-Git half is skipped because this host cannot create a ' +
      'filename whose bytes are not valid UTF-8; the decoder half above runs everywhere.',
  );
