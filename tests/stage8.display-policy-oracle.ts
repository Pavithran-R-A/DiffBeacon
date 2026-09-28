/**
 * A test-only oracle for the display-control policy, written from the policy's own statement
 * rather than imported from `packages/core/src/display.ts`. The suites that check what a human
 * surface *paints* need to know the answer independently: if they reused the production function
 * they would pass against any repair, including one that quietly moved the boundary instead of
 * applying it. Kept out of `*.test.ts` naming so vitest treats it as a utility, the way
 * `stage8.hostile-corpus.ts` is.
 *
 * The classes are built from code points, not regex literals, for the same reason the terminal
 * suite builds them that way: a control-character class in a regex is a lint hazard in a test file
 * and adds nothing to the reading of the policy.
 */

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

/** Bidi formatting controls: ALM, LRM/RLM, the embedding and override family, the isolates. */
export const REORDERING_CODES = new Set<number>([
  0x061c,
  0x200e,
  0x200f,
  ...range(0x202a, 0x202e),
  ...range(0x2066, 0x2069),
]);

/** Anything that could start a line or a column for a reader, including U+2028 and U+2029. */
export const LINE_SHAPING_CODES = new Set<number>([
  0x0009,
  ...range(0x000a, 0x000d),
  0x0085,
  0x2028,
  0x2029,
]);

/** C0 other than the line shapers, DEL, and the 8-bit C1 set (U+009B and U+009D are CSI and OSC). */
export const EXECUTABLE_CODES = new Set<number>([
  ...range(0x0000, 0x0008),
  ...range(0x000e, 0x001f),
  ...range(0x007f, 0x009f),
]);

/**
 * Line-shaping codes that must never survive into a rendered document. A bare LF is excluded
 * because the report itself uses LF to separate its own lines; a CR, a vertical tab, a form feed,
 * U+0085, U+2028 and U+2029 can only have come from a name.
 */
const LINE_RESIDUE_CODES = new Set<number>([0x000d, 0x000b, 0x000c, 0x0085, 0x2028, 0x2029]);

/**
 * What a human surface is allowed to paint from `value`: a reordering control is removed (it has
 * no width, so its absence leaves no gap), a line shaper becomes one space — a CRLF pair is one
 * shaper, so it becomes one space too — and an executable control is shown as `marker`. Ordinary
 * text, including zero-width marks and the RTL text of every script, is content and passes through.
 */
export function paintAsHumanSurface(value: string, marker: string): string {
  let painted = '';
  const characters = [...value];
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index] as string;
    const code = character.codePointAt(0) as number;
    if (REORDERING_CODES.has(code)) continue;
    if (LINE_SHAPING_CODES.has(code)) {
      // The pair is one line break for a reader, so it is one space in the name.
      if (code === 0x000d && characters[index + 1]?.codePointAt(0) === 0x000a) index += 1;
      painted += ' ';
      continue;
    }
    painted += EXECUTABLE_CODES.has(code) ? marker : character;
  }
  return painted;
}

/** Every control the policy removes or reduces, named once each, searched across a document. */
export function survivingControls(rendered: string): string[] {
  const found = new Set<string>();
  for (const character of rendered) {
    const code = character.codePointAt(0) as number;
    if (REORDERING_CODES.has(code)) found.add('reordering control');
    else if (EXECUTABLE_CODES.has(code)) found.add('executable control');
    else if (LINE_RESIDUE_CODES.has(code)) found.add('line-shaping control');
  }
  return [...found];
}

/**
 * True when a name can reach a report unchanged, which a real Git path must be able to do: no
 * UTF-8 sequence holds a lone UTF-16 surrogate, so Git's own encoder replaces it before DiffBeacon
 * sees it. `stage8.hostile-corpus.test.ts` records that case; a fidelity sweep cannot assert
 * identity for a name Git itself could not have produced.
 */
export function representsUtf8Text(value: string): boolean {
  return new TextDecoder().decode(new TextEncoder().encode(value)) === value;
}
