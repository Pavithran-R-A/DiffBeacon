/**
 * Stage 8 hostile corpus: one shared set of bounded, inert strings that *look*
 * dangerous to a shell, Markdown parser, terminal, path resolver, or prototype
 * chain. Every entry is display data for DiffBeacon; none of it is executed, and
 * the network-looking entries point at reserved `.example`/`.invalid` hosts.
 *
 * Helpers here build real-Git-shaped patch text, so a hostile name reaches the
 * report through the same parser a repository would use rather than through a
 * hand-written report object.
 */

const PRINTABLE_ASCII = /^[ -~]*$/;

/** Git quotes a path when it holds anything outside printable ASCII, `"` or `\`. */
function needsQuoting(raw: string): boolean {
  return !PRINTABLE_ASCII.test(raw) || raw.includes('"') || raw.includes('\\');
}

function octalEscape(raw: string): string {
  let out = '';
  for (const byte of new TextEncoder().encode(raw)) out += `\\${byte.toString(8).padStart(3, '0')}`;
  return out;
}

export function gitPathToken(prefix: 'a/' | 'b/', raw: string): string {
  return needsQuoting(raw) ? `"${prefix}${octalEscape(raw)}"` : `${prefix}${raw}`;
}

/** A one-file modification diff whose path is exactly `raw`, quoted the way Git quotes it. */
export function diffForPath(raw: string, body = '-old\n+new'): string {
  return [
    `diff --git ${gitPathToken('a/', raw)} ${gitPathToken('b/', raw)}`,
    `--- ${gitPathToken('a/', raw)}`,
    `+++ ${gitPathToken('b/', raw)}`,
    '@@ -1 +1 @@',
    body,
    '',
  ].join('\n');
}

/** Several hostile paths in one diff, so a report can be observed with all of them at once. */
export function diffForPaths(paths: readonly string[]): string {
  return paths.map((path) => diffForPath(path)).join('');
}

/** A runtime `.ts` path that no rule treats as generated, test, docs, or config. */
export const CONTROL_PATH = 'src/controlled.ts';

export const SHELL_LOOKING_PATHS = [
  'src/$(touch PWNED).ts',
  'src/`touch PWNED`.ts',
  'src/a.ts; touch PWNED',
  'src/a.ts | tee PWNED',
  'src/a.ts && touch PWNED',
  'src/a.ts > PWNED',
  'src/a.ts < PWNED',
  'src/${touch PWNED}.ts',
  'src/a.ts\n&& touch PWNED',
] as const;

export const MARKUP_LOOKING_PATHS = [
  'src/<script>alert(1)</script>.ts',
  'src/<img src=x onerror=alert(1)>.ts',
  'src/<svg onload=alert(1)>.ts',
  'src/</textarea><script>alert(1)</script>.ts',
  'src/[link](javascript:alert(1)).ts',
  'src/![image](https://invalid.example/px.png).ts',
  'src/<details open>hidden</details>.ts',
  'src/<!-- comment -->.ts',
  'src/# heading.ts',
  'src/| pipe |.ts',
  'src/`backtick`.ts',
  'src/[click here](https://example.invalid/).ts',
] as const;

export const TRAVERSAL_LOOKING_PATHS = [
  '../secret.ts',
  '../../../../etc/passwd.ts',
  '..\\..\\Windows\\System32\\drivers\\etc\\hosts.ts',
  'C:\\Windows\\System32\\config.ts',
  '//server/share/config.ts',
  'file:///etc/passwd.ts',
  'src/../../outside.ts',
  'src/%2e%2e/%2e%2e/outside.ts',
  'src/....//....//outside.ts',
] as const;

export const OBJECT_SHAPE_PATHS = [
  '__proto__.ts',
  'src/constructor.ts',
  'src/constructor.prototype.ts',
  'prototype/x.ts',
  'src/toString.ts',
  'src/valueOf.ts',
  '{"__proto__":{"polluted":true}}.ts',
  'src/__proto__/polluted.ts',
] as const;

/** C0, DEL and C1 controls that a terminal would act on if they reached it. */
export const CONTROL_CHAR_PATHS = [
  'src/\u001b[31mRED.ts',
  'src/\u0007bell.ts',
  'src/\bbackspace.ts',
  'src/\t/tab.ts',
  'src/\r/carriage.ts',
  'src/a\nb.ts',
  'src/\u007fdel.ts',
  'src/\u009b[31mC1csi.ts',
  'src/\u009d0;http://example.invalid\u0007C1osc.ts',
  'src/\u0000nul.ts',
] as const;

/** Explicit bidi formatting controls: these reorder *display*, unlike ordinary RTL text. */
export const BIDI_CONTROL_PATHS = [
  'src/\u202aRLE.ts',
  'src/\u202bRLO.ts',
  'src/\u202dLRO.ts',
  'src/\u202ePDF.ts',
  'src/\u2066LRI\u2069.ts',
  'src/\u2067RLI\u2069.ts',
  'src/\u2068FSI\u2069.ts',
  'src/\u2069PDI.ts',
  'src/\u200eLRM.ts',
  'src/\u200fRLM.ts',
  'src/\u061cALM.ts',
  'src/\u2028line.ts',
  'src/\u2029para.ts',
  'src/\u200b\u200c\u200dzero.ts',
] as const;

export const MIXED_UNICODE_PATHS = [
  'src/café.ts',
  'src/السلام.ts',
  'src/שלום.ts',
  'src/文件.ts',
  'src/🎉emoji.ts',
  'src/e\u0301combining.ts',
  'src/a\u0300\u0301\u0302\u0303\u0304\u0305\u0306\u0307long-combining.ts',
  'src/\ud800lone-surrogate.ts',
  'src/́\u202d\u001b[31m\u4e2d\u6587.ts',
] as const;

/** Pipe-bearing names: the Changed-files table splits cells on an unescaped pipe. */
export const PIPE_PATHS = [
  'src/a|b.ts',
  'a|b`c.ts',
  'x\\|y.ts',
  '<script>|x.ts',
  'src/a\nb|c.ts',
  'src/\u202eRLO|pipe.ts',
  '| leading.ts',
  'trailing |',
  '||double||.ts',
] as const;

/**
 * Names the Windows namespace reserves or rewrites: device basenames with and without an
 * extension, a trailing dot, a trailing space, and the characters Win32 refuses. Used by the
 * path-shape phase on its own, the way `PIPE_PATHS` is used by the table phase, because these
 * are printable-ASCII names whose hazard is the filesystem rather than the display.
 */
export const WINDOWS_INVALID_PATHS = [
  'NUL',
  'src/NUL',
  'src/CON.ts',
  'src/com1.txt',
  'src/LPT9.md',
  'src/PRN',
  'src/AUX.json',
  'src/trailing-dot.',
  'src/trailing-space ',
  'src/a<b>c.ts',
  'src/a:b.ts',
  'src/a".ts',
  'src/a?.ts',
  'src/a*.ts',
] as const;

export const HOSTILE_PATHS: readonly string[] = [
  ...SHELL_LOOKING_PATHS,
  ...MARKUP_LOOKING_PATHS,
  ...TRAVERSAL_LOOKING_PATHS,
  ...OBJECT_SHAPE_PATHS,
  ...CONTROL_CHAR_PATHS,
  ...BIDI_CONTROL_PATHS,
  ...MIXED_UNICODE_PATHS,
];
