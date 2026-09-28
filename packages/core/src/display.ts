/**
 * DiffBeacon display boundary: text taken from a repository or a command line must
 * not reach a terminal or a line reader still able to act. Three classes decide the
 * repair, so the fix matches the hazard instead of flattening every odd code point:
 * a code that could move the cursor down leaves one space behind so neighbouring
 * words cannot fuse into a false name; a code a terminal could execute leaves the
 * surface's own marker; a bidi formatting control has no width of its own, so
 * removing it cannot leave a gap in the name either.
 *
 * Deliberately absent: confusable homoglyphs, non-ASCII punctuation, emoji, and the
 * ordinary left-to-right and right-to-left text of every script. Those are content,
 * and content is only ever displayed.
 */

/** Where a terminal or a line reader could start a new line (or a new column). */
const LINE_SHAPING = /\r\n|[\t\u000a-\u000d\u0085\u2028\u2029]/g;

/** C0 other than the line shapers, DEL, the 8-bit C1 set — U+009B and U+009D are the
 * single-code forms of the CSI and OSC sequences a terminal then parses. */
const EXECUTABLE = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g;

/** Bidi formatting controls: ALM, LRM, RLM, RLE/LRE/RLE-family overrides, and the
 * isolates. They reorder the trusted text printed beside them. */
const REORDERING = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Neutralise every display control in `value`. `marker` is what the calling surface
 * prints where a code it could have executed stood, so a CLI message can keep its
 * plain spacing while the field-manual output shows an explicit placeholder.
 */
export function neutralizeDisplayControls(value: string, marker: string): string {
  return value.replace(REORDERING, '').replace(LINE_SHAPING, ' ').replace(EXECUTABLE, marker);
}
