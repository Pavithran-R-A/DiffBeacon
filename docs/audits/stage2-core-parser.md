# DIFFBEACON STAGE 2 — CORE DIFF PARSER REPORT

Qualification of the unified-diff parser in `packages/core` on four questions only: is it truthful,
deterministic, robust against malformed input, and bounded. This stage did not add detectors,
change attention ordering, extend the CLI surface, redesign the Action or the browser, upgrade
dependencies, tag, or release.

## STATUS

`PASS` — the core diff parser is qualified: nine evidence-backed defects repaired under TDD, the
shipped Git command vector cross-checked against Git itself, malformed and truncated input reported
as diagnostics instead of invented facts, hostile input proven inert, and the direct parser bounded
by the shared byte limit.

```text
STARTING SHA:   124af30cca5feead6440faf3fb3b908804ae9cf6  docs: record DiffBeacon Stage 1 hosted CI observation
FIX COMMIT:     a2f5a14eee165ce30538d7cc20b8f7b39a60944a  fix: qualify DiffBeacon core diff parser
DOCS COMMITS:   4625de1e91bdf9db27e532d1b402fab01dad5c93  docs: record DiffBeacon Stage 2 parser qualification
                + this report's CI-observation successor (see GITHUB HOSTED ACTIONS)
ENDING SHA:     branch head after Stage 2; documentation-only, on top of the qualified tree
BRANCH:         rescue/stage0-source  (local and origin were both at 124af30 before this work)
ORIGIN MAIN:    e0ff98143bfe39c80c338518d006525a846a8739  (re-read with git ls-remote; untouched,
                not merged, no PR, no tag, no npm publish)
REPOSITORY:     https://github.com/Pavithran-R-A/DiffBeacon.git
QUALIFIED TREE: a2f5a14eee165ce30538d7cc20b8f7b39a60944a — all four platform cells cloned this
                exact commit from a bundle and ran the ten commands against it.
```

No commit between `124af30` and `a2f5a14` was pushed. An intermediate local commit
(`826ab054f2ca9e9969b556bf922cf8abf1869320`) was superseded before the matrix ran, because it
carried a test fixture that only worked on Windows; it was soft-reset and re-created as
`a2f5a14`. It is not part of the candidate history and is not claimed as evidence anywhere.

## FILES

`12 files changed, 1867 insertions(+), 162 deletions(-)`.

FILES ADDED (7) — all tests, all Stage 2 specific:

- `tests/stage2.hunk-accounting.test.ts` (22 tests)
- `tests/stage2.path-resolution.test.ts` (22 tests)
- `tests/stage2.hostile-input.test.ts` (29 tests)
- `tests/stage2.real-git-oracle.test.ts` (9 tests)
- `tests/stage2.bounded-input.test.ts` (8 tests)
- `tests/stage2.binary-mode.test.ts` (6 tests)
- `tests/stage2.patch-dialects.test.ts` (6 tests)

FILES CHANGED (5):

- `packages/core/src/parser.ts` — the repairs; 493 lines.
- `packages/core/src/model.ts` — `ParseDiagnosticCode` union; `MAX_DIFF_BYTES` already existed.
- `packages/action/dist/index.js` — rebuilt bundle that carries the parser change (see ACTION BUNDLE).
- `client/src/pages/Home.tsx` — the demo `SAMPLE_DIFF` hunk headers were arithmetically wrong
  (declared counts did not match their bodies), so the demo report showed 4 phantom diagnostics.
  Headers corrected; the demo now parses with 0 diagnostics and keeps the same 5 files /
  13 additions / 1 deletion. This is a fixture correction, not a rendering change.
- `SOURCE_MANIFEST.txt` — regenerated after staging the new tests (see MANIFEST).

FILES DELETED: none. No detector, schema, CLI, Action-source, or workflow file changed.

## PARSER ARCHITECTURE

`parseUnifiedDiff(input: string): ParsedDiff` is a single forward pass over lines with no
backtracking, no regex over unbounded input, and no I/O — `packages/core` still has no
`fs`/`child_process`/network dependency, so it keeps running in the browser.

Order of operations:

1. **Size gate** (`exceedsDiffLimit`, parser.ts:12) runs on the raw string _before_ any
   normalization or split. It uses UTF-16 length as a cheap bound and only calls
   `TextEncoder` when one byte-per-unit and three bytes-per-unit leave the answer open.
2. **Line split** — `\r\n` and lone `\r` normalize to `\n` so a CRLF patch parses like an LF patch.
3. **Per-line dispatch** (parser.ts:317 onward): `diff --git` header (including a header truncated
   to the bare token) → combined-dialect detection (`diff --cc`, `diff --combined`, which then
   put the loop in `skippingDialect` until the next `diff --git`) → orphan-line handling when no
   file is open → active-hunk body consumption (`consumeHunkLine`) → file metadata chain.
4. **Path resolution** — `parseGitPair` / `parseBinaryPair` share `resolvePair`, which accepts a
   split only when the left side provably starts `a/` and the right side provably starts `b/`, and
   only when both sides still name a file after the prefix is stripped. Quoted forms go through
   `parseQuotedPair` + `decodeGitQuoted`. Ambiguity and failure produce diagnostics, never a guess.
5. **Hunk accounting** — `openHunk` records the declared `oldCount`/`newCount` (an omitted count is
   one line; `@@ -0,0 +1,1 @@` and other zero forms are honoured) alongside `seenOld`/`seenNew`;
   `closeHunk` compares them and emits `truncated-hunk` (body short of the declaration) or
   `hunk-count-mismatch` (body exceeded it). A hunk closes at the next `@@`, the next file header,
   or end of input.
6. **Finalization** — `inferStatus` (parser.ts:172) then `finalize` (parser.ts:201) derive
   `status`, `modeOnly`, and the null-vs-number line tallies.

Contract that keeps unprovable facts honest: `displayPath` falls back to the literal string
`<unknown path>` rather than an empty string, `additions`/`deletions` are `null` when nothing
countable arrived, and every anomaly is a `ParseDiagnostic` with a code from
`ParseDiagnosticCode` (model.ts:52) and a 1-based line number.

## REQUIREMENT MATRIX

"Before" is measured, not recalled: the parent-commit parser (`124af30`) and the candidate parser
(`a2f5a14`) were each bundled with esbuild and run over the same inputs
(`../stage2/before/compare-before-after.mjs`, output in `../stage2/before/compare-output.txt`).

| #   | Case                                             | Status before (measured)                                                                                                                               | Tests                                                                                                                                                                                                                           | Repair                                                                                                                                                 | Status after (measured)                                                                                                                                                                     |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Hunk body shorter than its declared counts       | `1/1` reported, `diagnostics: []` — truncated input looked complete                                                                                    | `stage2.hunk-accounting` (15 of its 22 tests: 7 truncation/mismatch, 8 malformed-header)                                                                                                                                        | per-hunk declared/seen ledger + `closeHunk`                                                                                                            | unchanged counts, `truncated-hunk@4`                                                                                                                                                        |
| R1b | Hunk body longer than declared                   | `2/1`, `diagnostics: []`                                                                                                                               | same file                                                                                                                                                                                                                       | ledger comparison                                                                                                                                      | unchanged counts, `hunk-count-mismatch@4`                                                                                                                                                   |
| R1c | Orphan `@@` with no file                         | `files: []`, `diagnostics: []` — silently ignored                                                                                                      | same file                                                                                                                                                                                                                       | orphan branch                                                                                                                                          | `unrecognized-hunk-header@1`                                                                                                                                                                |
| R2  | Binary path containing `" and "`                 | `oldPath: "has and inside.bin and b/has"`, `newPath: "inside.bin"` — **invented paths**                                                                | `stage2.path-resolution` (4 binary-pair tests) + oracle                                                                                                                                                                         | `parseBinaryPair` splits on the last `" and "` only inside metadata position, `/dev/null` sides map to `null`, unprovable forms yield `ambiguous-path` | `oldPath == newPath == has and inside.bin`, no diagnostic                                                                                                                                   |
| R3  | Mode change on a binary payload                  | `status: "mode-only"`, `modeOnly: true`, `binary: true` — binary content change labelled as permission-only                                            | `stage2.binary-mode` (6 tests)                                                                                                                                                                                                  | `mode-only` requires zero hunks **and** `!binary`                                                                                                      | `status: "modified"`, `modeOnly: false`, counts stay `null`                                                                                                                                 |
| R4  | `copy from` / `copy to`                          | `status: "renamed"` with `similarity` — copy relabelled as a rename                                                                                    | `stage2.patch-dialects` (2 copy tests)                                                                                                                                                                                          | copy is an out-of-scope dialect: reported as `added` + `unsupported-dialect`, never as a rename                                                        | `status: "added"`, `oldPath: null`, `unsupported-dialect@3`                                                                                                                                 |
| R5  | `diff --cc` / `diff --combined`                  | one `unrecognized-file-header` per `---`/`+++` line, block content dropped                                                                             | `stage2.patch-dialects` (4 combined tests)                                                                                                                                                                                      | dialect detected once per block, `unsupported-dialect`, block skipped until the next `diff --git`, hunk-content `@@`/`diff --cc` lines stay content    | single `unsupported-dialect@1`                                                                                                                                                              |
| R6  | Direct parser called with oversized text         | a 21 MB string parsed to `files: 1`, `diagnostics: []` — the limit lived only in the CLI layer                                                         | `stage2.bounded-input` (8 tests: below / exactly at / one above `MAX_DIFF_BYTES`, 5 000-file bounded input, many-file over-limit, one huge line, UTF-8 vs UTF-16 counting, `analyzeDiff` passthrough, message states the limit) | `exceedsDiffLimit` gate before normalization, using the shared `MAX_DIFF_BYTES`                                                                        | `files: 0`, `diagnostics: ["input-too-large"]`, no per-line work                                                                                                                            |
| R7  | `diff --git` header whose paths cannot be proven | `newPath: "two.txt b/three.txt"`, `displayPath` identical, `diagnostics: []` — the first split was guessed and the remainder became part of a filename | `stage2.path-resolution` (its 9 `diff --git path pairs` tests)                                                                                                                                                                  | only provably-`a/`/`b/` sides accepted; exact `---`/`+++` or rename metadata preferred while still reporting the header                                | ambiguous bare header: `<unknown path>` + `ambiguous-path@1`; same header with `rename from/to`: the proven `one.txt → three.txt` pair is kept **and** `ambiguous-path@1` is still reported |     | R8  | Header naming no file (`a/ b/`, quoted `"a/" "b/"`, empty `--- `, prefix-only binary pair) | `displayPath: ""`, `oldPath: ""` — an authoritative-looking empty path | `stage2.path-resolution` (`file headers that name no path`, 9 tests incl. negatives) | an empty side names nothing: diagnostic + `<unknown path>`; a proven path is never erased by a later bad line | `malformed-header@1` (`<unknown path>`); `--- ` case keeps `f.ts` and reports `malformed-header@2` |
| R9  | `diff --git` truncated to the bare token         | `files: []`, `diagnostics: []` — a whole file block vanished, indistinguishable from an empty diff                                                     | `stage2.path-resolution` (2 tests: bare token, bare token after a complete block)                                                                                                                                               | bare token recognised as a header intent                                                                                                               | `malformed-header@1` + one `<unknown path>` entry; the after-a-block case reports `malformed-header@7` and keeps both entries                                                               |

Every repair is dual-sided: each positive test is paired with a negative test asserting the parser
stays silent and exact on well-formed input (for example `keeps a real path that only starts with a
directory-like segment`, `keeps a /dev/null side honest`, `treats a diff --git hunk line as
content`, `parses a merge resolved to an ordinary range diff without a diagnostic`).

The same script carries three well-formed controls through both parsers, and all three report
`CHANGED false` — `dir b/image.bin`, `rename src/one.txt → rename src/two.txt`, and
`a/old.txt → b/new.txt` produce byte-identical output before and after. That is the evidence this
was a targeted repair rather than a rewrite: the parser's correct path-resolution behaviour did
not move.

No repair throws. Malformed input produces a partial evidence report plus diagnostics, which is
what Phase 4 asked for instead of fail-hard behaviour.

## REAL GIT FIXTURES

`tests/stage2.real-git-oracle.test.ts` (9 tests) builds throwaway repositories through the shared
`tests/git-repository-fixture.ts` helper and compares parser output against Git's own
machine-readable reports.

- The vector under test mirrors the shipped CLI vector exactly:
  `diff --no-ext-diff --no-textconv --no-color --src-prefix=a/ --dst-prefix=b/ --ignore-submodules=none --submodule=short --diff-algorithm=myers --find-renames=50% -l1000 --unified=3 HEAD~1..HEAD --`
  (`packages/cli/src/git.ts:23-40` is the production copy).
- For every case the oracle asserts `parsed.diagnostics` **equals `[]`** before comparing fields —
  so any parser complaint about real Git output fails the suite.
- Cross-checks are limited to what Git itself states: `--name-status` letters map onto `status`,
  the rename path pair onto `oldPath`/`newPath`, `--numstat` digits or `-` onto
  `additions`/`deletions`, and `--summary` is regex-matched for the rename/mode-change statements.
  Git's `-` is only used to justify `null`; it is not treated as proof of a byte count, and
  `--stat` is not used as an oracle at all.
- Coverage: modification, addition, deletion; rename-only and rename-with-edits; mode-only; mode +
  content; binary add/modify/delete/rename-with-change; a pure binary rename; paths containing
  spaces, a literal `b/` segment, `" and "`, and Unicode; a file whose last line has no newline;
  and one multi-file commit checked per file.
- Fixture isolation: each repository points `core.hooksPath` at an empty directory so host hooks
  never run during `git commit`, and commits use repository-local identity. The two mode cases set
  `core.fileMode=false` locally (see WINDOWS and the caveats section).

`tests/stage3b.real-git.test.ts` (8 pre-existing tests) continues to pass unchanged, so the
Stage-3B file-state and rename expectations still hold against the repaired parser.

## MALFORMED / TRUNCATED INPUT

`tests/stage2.hostile-input.test.ts` (29 tests: a 25-case `it.each` corpus plus 4 focused guards) parses a
bounded hostile corpus. Representative cases: a path literally named `__proto__`, a
`constructor`/`prototype` chain path, a JSON object literal as a path, bare `diff --git`,
unclosed and mismatched quotes, `diff --git a/ b/`, a lone `@@` line, absurd/exponential/negative
declared counts, non-numeric modes, an unterminated rename, a binary payload followed by garbage,
NUL and other control bytes, a lone surrogate, a bare `\ No newline` marker, only-new-side
markers, truncated headers, 200 repeated headers, a 1 MiB single line, a 5 000 `@@` flood, and
interleaved `diff --cc` / copy dialects.

Acceptance evidence, asserted for **every** case rather than eyeballed:

- no exception escapes the parser (each case runs inside `expectInert()`),
- every returned object is a plain object — `Object.getPrototypeOf` is `Object.prototype` or
  `null`, so nothing reaches the report through a prototype,
- `status` is always a member of `FILE_STATUSES`, every surface id a member of `SURFACE_IDS`,
- counts are `null` or a non-negative safe integer,
- diagnostic codes are inside the known code set and every diagnostic line is a safe integer ≥ 1,
- two parses of the same bytes produce JSON that is `toEqual`, proving determinism,
- each case carries an explicit `20_000` ms timeout, so a hang fails loudly instead of passing
  silently; the whole file finishes in well under a second per case (867 ms for all 29 on Windows).

Two extra guards: a canary test writes sentinels onto `Object.prototype`, `Array.prototype`, and
`String.prototype` before parsing and proves the parser neither calls through them nor leaves
them polluted; a renderer test pushes the hostile corpus through `renderPretty`/`renderMarkdown`
and asserts the output stays plain text with no escape sequences (`packages/core` never executes
or evaluates input, and the browser demo renders hostile paths as text).

Truncation specifically is covered by the R1 family: short old side, short new side, extra lines,
EOF mid-hunk, a new file starting before counts are satisfied, and a hunk whose last lines were
stripped — all reported, none silently completed.

## HUNK ACCOUNTING

- `@@ -oldStart,oldCount +newStart,newCount @@` is the authority; an omitted count means one line;
  zero-count forms (`-0,0`, `+0`) parse and are honoured.
- context consumes one old and one new line, `-` one old, `+` one new, and
  `\ No newline at end of file` consumes neither side (asserted directly).
- `@@` header lines are never counted as changed lines.
- Metadata-looking text inside a hunk body (`--- a/f.ts`, `+++ b/f.ts`, `diff --git a/x b/x`,
  `Binary files a/x and b/x differ`, `index abc..def`) stays content: it cannot switch parser
  state, cannot invent a file, and is counted as whatever its first column says.
- A new hunk header, a new file header, or end of input closes the previous hunk truthfully, and
  the closing event is where `truncated-hunk` / `hunk-count-mismatch` are emitted with the
  offending header's line number.
- Invalid `@@` lines inside a hunk are content, not a new header; an invalid `@@` outside a hunk is
  `unrecognized-hunk-header`.

## PATHS

Quoted and unquoted forms Git emits for the shipped vector are decoded (`decodeGitQuoted` handles
`\t`, `\n`, `\"`, `\\` and octal escapes; C-style quoting is decoded, and the trailing tab +
timestamp of context-diff headers is dropped). `a/` and `b/` prefixes are stripped only when a
filename survives, so `dir b/image.bin.txt`, `has and inside.txt`, `x b/y.txt → q b/z.txt` and
`文件-файл.txt` resolve correctly; genuinely ambiguous non-quoted headers produce `ambiguous-path`
instead of a guessed pair. There is no general shell or path parser — deliberately, since the
stage scoped itself to forms Git actually emits.

## BINARY

Binary is orthogonal to status: `added`/`deleted`/`modified`/`renamed` are all reachable with
`binary: true`, and `Binary files … differ`, `GIT binary patch`, and `base85`/`literal` payload
bodies are recognised without letting payload text leak into paths or counts. `additions` and
`deletions` stay `null` for binary files even when text-hunk-looking lines follow the marker — the
parser does not invent zero changed lines for an uncountable payload. Real-Git proof: the numstat
`-` for each binary case maps to `null`, and the parser produces exactly that.

## MODE CHANGES

`old mode`/`new mode` are captured as `oldMode`/`newMode` on every status. `mode-only` (and
`modeOnly: true`) is reserved for the case the patch actually supports: a mode pair with no hunks
and no binary payload. Mode plus content stays `modified` with its counts intact
(`100644 → 100755`, 1 addition, 1 deletion in the oracle case); mode plus a binary payload stays
`modified` with `null` counts. The oracle test additionally pins Git's own statements for the
mode-only case (`--name-status` `M`, `--numstat` `0 0`, `--summary` `mode change 100644 => 100755`)
next to the parser's contract, and the difference between the two is documented under
REMAINING PARSER LIMITATIONS rather than hidden.

## BOUNDED INPUT

`MAX_DIFF_BYTES = 8 * 1024 * 1024` (model.ts:7) is the single limit; no second or conflicting
constant was introduced, and the guard runs before the expensive normalization/split. Tests assert
the boundary from both sides with byte-exact builders: one byte below parses, exactly at parses,
one byte above is refused with `input-too-large` and zero files. A 5 000-file input inside the
limit still parses fully (bounded by bytes, not by file count), an 80 000-block many-file input
above the limit is refused, and the counting is byte-based rather than UTF-16-unit-based —
2.7 M `'世'` characters (≈8.1 MB) stay inside while 2.9 M (≈8.7 MB) are refused, which is the
distinction a UTF-16 length check would get wrong. `analyzeDiff` forwards the refusal as a
diagnostic count instead of crashing. The pre-Guard measurement (R6) shows a 21 MB string parsed
silently, which is the defect this closes. No multi-gigabyte test string is allocated anywhere.

## UNSUPPORTED PATCH DIALECTS

`copy from` / `copy to`, `diff --cc`, and `diff --combined` are out of scope for this stage and
were **not** added as support. What changed is that the parser can no longer pretend:

- a copied file is reported as `added` with an `unsupported-dialect` diagnostic, never as `renamed`;
- a combined block produces one `unsupported-dialect` and is skipped until the next `diff --git`,
  so surrounding ordinary files still parse;
- ordinary range diffs of a merge (no `--cc` syntax) parse with no diagnostic at all — the negative
  test that proves the limitation is scoped, not smeared.

`FILE_STATUSES` was not extended (no `copied` status), because `review-attention-map.schema.json`
pins `$defs.file.status.enum` to that array (asserted in `tests/stage4.release.test.ts:80`) and
`summary.diagnostics` is only an integer count, so diagnostics could not smuggle new fields into
the shipped schema.

## TESTS

`Test Files 18 passed (18)`, `Tests 165 passed (165)` on Windows; `18 passed (18)` and
`164 passed | 1 skipped (165)` in both Linux cells.

- Stage-2 added: 102 tests across the 7 new files (22 + 22 + 29 + 9 + 8 + 6 + 6).
- Stage-1 baseline re-counted from the same run, unchanged in both count and outcome: 63 tests
  across 11 files — `core` 11, `action` 6, `cli` 2, `cli.integration` 3, `npm-helper` 3,
  `stage3b.real-git` 8, `stage3b.static` 3, `stage3c.release` 9, `stage4.release` 6,
  `stage5.git-determinism` 8, `stage6.source-manifest` 4.
- The 1 skipped test is `tests/stage3c.release.test.ts:123`, declared with
  `it.runIf(process.platform === 'win32')` — the pre-existing Windows `ComSpec` npm-shim test. It
  is expected to skip on Linux and is not a Stage-2 change.
- Analyzer, detectors, renderers, CLI, Action and release-invariant suites all pass, which is the
  Phase 11 evidence that no unrelated semantic change slipped in.

## BUILD

`npm run build` passes in every cell and produces the committed Action bundle. `packages/core`
gained no runtime dependency: `parser.ts` imports only `./model.js` plus `TextEncoder` from the
global scope, so the Node-and-browser boundary in `AGENTS.md` holds.

## ACTION BUNDLE

| Item                                                         | Value                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Committed `packages/action/dist/index.js` before (`124af30`) | `0c9b493c554d31150a0020bd53ba1d96bcf47340736c37473b054999d7a1278f`                                                                                      |
| Committed after (`a2f5a14`)                                  | `bd4fbbaccd44f8aaeecfc5a65f64bd5be53b076618a73517662aa861638f95c4`                                                                                      |
| Working tree after `npm run build` on the candidate          | `bd4fbbaccd44f8aaeecfc5a65f64bd5be53b076618a73517662aa861638f95c4` — **identical to the committed bundle, so it is fresh and reproducible**             |
| Rebuild determinism                                          | two consecutive rebuilds produced the same hash; `git status` stayed clean afterwards                                                                   |
| Action behaviour smoke                                       | `action-smoke: bundled action wrote 1183 bytes; stdout=""; stderr=""; cliLeak=false; hostilePaths=true; oversizeRejected=true; range=6f88565...8b1b204` |

The bundle changed because it embeds `packages/core`; `packages/action/src` was not modified.
`npm run package-smoke` reports `0.1.0; bin=true; engines=>=22; stdinFiles=1; rangeFiles=1;
tarballFiles=3`.

## MANIFEST

`SOURCE_MANIFEST.txt: 98 files` regenerated after the new tests were staged, because the policy in
`scripts/source-manifest.mjs` enumerates `git ls-files --full-name -z` (so only tracked files
appear) and excludes `.bootstrap/`, `.bootstrap2/`, `docs/recovery/`, `docs/audits/`,
`SOURCE_MANIFEST.txt` and `RECOVERY_STAGE0.md`. `npm run verify` then passes its drift check, and
`npm run manifest` re-run afterwards changes nothing.

## WINDOWS

**W1 — host Node 24, `core.autocrlf=true`.** Clean disposable clone of the bundle at
`a2f5a14`; `node=v24.21.0`, `npm=11.19.0`, `git=git version 2.55.0.windows.5`,
`autocrlf=true`. Result: **10/10 PASS**, `Test Files 18 passed (18)`, `Tests 165 passed (165)`.

**W2 — portable Node 22.** Same bundle, separate clone, `node=v22.23.3`, `npm=10.9.9`, host Git
`2.55.0.windows.5`, `autocrlf=true`. The portable runtime is the Stage-1 one, still available, and
its zip SHA was verified earlier (`2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71`).
Result: **10/10 PASS**, `18 passed (18)`, `165 passed (165)`.

`client`/`packages/core` EOL handling is unaffected: the Stage-1 `.gitattributes` contract keeps
worktree bytes equal to blob bytes, which is why `format:check` passes in a default Windows
checkout instead of failing on 82 files.

## LINUX NODE 24

Container-native cell: `docker run --rm -v <stage2>:/evidence node:24`, which is Debian bookworm
with `git version 2.39.5`. The bundle was cloned to `/tmp/work/repo` (ext4 inside the container,
never `/mnt/c` and never the Windows bind mount), `core.autocrlf` unset.
`node=v24.21.0`, `npm=11.19.0`. Result: **10/10 PASS**, `Test Files 18 passed (18)`,
`Tests 164 passed | 1 skipped (165)`.

## LINUX NODE 22

Same shape on `node:22` (also Debian bookworm, `git version 2.39.5`), clone at `a2f5a14`,
`node=v22.23.3`, `npm=10.9.9`. Result: **10/10 PASS**, `18 passed (18)`,
`164 passed | 1 skipped (165)`.

Both Linux cells initially ran against a superseded commit and failed `npm test` with 2 failures;
the cause was the test fixture, not the parser (see CAVEATS), and the numbers above are from the
final candidate commit.

## GITHUB HOSTED ACTIONS

`EXTERNAL CI BLOCKED — zero runners started. This is not a Stage-2 parser failure.`

The push of `124af30..4625de1` to `rescue/stage0-source` triggered one workflow run, observed once:

| Field                   | Value                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run ID                  | `36114034616` (workflow `CI`, event `push`)                                                                                                                                     |
| Head SHA                | `4625de1e91bdf9db27e532d1b402fab01dad5c93`                                                                                                                                      |
| Run conclusion          | `failure`                                                                                                                                                                       |
| Jobs                    | 4 — `Node 22 / windows-latest` (108003786476), `Node 22 / ubuntu-latest` (108003786626), `Node 24 / windows-latest` (108003786667), `Node 24 / ubuntu-latest` (108003786775)    |
| Runner IDs              | `null` on all four jobs — no runner was ever assigned                                                                                                                           |
| Steps executed          | `0` on all four jobs                                                                                                                                                            |
| Job timing              | started `2026-09-25T08:38:35Z`, completed `08:38:37Z`–`08:38:38Z` (2–3 s each)                                                                                                  |
| Billable time           | 0 runner-minutes; nothing ran                                                                                                                                                   |
| Annotation on every job | `The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings` |

`.github/workflows/ci.yml` was not edited for this stage — not to work around a blocked account and
not for any other reason. The condition is identical to the one recorded for Stage 1, so the
account-level billing state, not DiffBeacon code, is what keeps hosted CI red. The run was observed
once and not rerun repeatedly.

Because hosted CI could not execute, the platform evidence in this report comes entirely from the
four local cells that did run against `a2f5a14` (WINDOWS, LINUX NODE 24, LINUX NODE 22). No hosted
matrix result is claimed.

## EXACT COMMANDS RUN

Repository gates (host workspace, then repeated inside every cell):

```bash
npm ci
npm run format:check   # prettier --check .
npm run lint           # eslint . --max-warnings=0
npm run typecheck      # tsc --noEmit -p tsconfig.json
npm test               # vitest run
npm run build          # node scripts/build.mjs
npm run package-smoke  # node scripts/package-smoke.mjs
npm run action-smoke   # node scripts/action-smoke.mjs
npm run verify         # node scripts/verify.mjs
npm run check          # alias of npm run verify
```

Stage-2-specific evidence commands:

```bash
git -C DiffBeacon bundle create ../stage2/diffbeacon-stage2.bundle rescue/stage0-source
git clone -q --no-hardlinks -b rescue/stage0-source diffbeacon-stage2.bundle cell-win24
git -C cell-win24 config core.autocrlf true
bash run-cell.sh "$PWD/cell-win24" "" "$PWD/logs-win24"
bash run-cell.sh "$PWD/cell-win22" ".../stage1/node22/node-v22.23.3-win-x64" "$PWD/logs-win22"
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD:/evidence" node:24 bash /evidence/run-linux-cell.sh logs-linux24
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD:/evidence" node:22 bash /evidence/run-linux-cell.sh logs-linux22
node --max-old-space-size=4096 compare-before-after.mjs ./before-parser.mjs ./after-parser.mjs
```

The matrix cells were run one at a time on purpose: concurrent `npm ci` plus `vitest` runs made the
real-Git fixture timings meaningless, and a cell whose timing is not trustworthy is not evidence.

## WORKING TREE STATE

`git status --short` after the fix commit and after `npm run check`: clean — only the report file
below it was added, and the two regenerated pnpm files described in CAVEATS were quarantined
outside the repository. `git diff --check`: exit 0, no whitespace errors. Nothing under
`node_modules`, no build output beyond the Action bundle that is legitimately tracked, no tarball,
no portable runtime, no Docker file, no test repository, and no local evidence log was staged — all
of that lives outside the repository in `../stage2/`. Two pre-commit notes: `git commit` needed a
per-invocation identity (`-c user.name=… -c user.email=…`) because no global Git identity exists;
`git config` was never modified. A `Can't find lefthook in PATH` warning appears on commit and does
not block it.

Push: `git push origin rescue/stage0-source` fast-forwarded `124af30..4625de1` as an ordinary
commit — no force, no `--no-verify`, no amended published history. `rescue/stage0-source` on origin
now equals the qualified candidate plus documentation; `main` on origin is unchanged at
`e0ff9814`. No merge, no PR, no tag, no release, no npm publish.

## SESSION INTEGRITY DISCLOSURE

During this stage, messages that were not written by the human partner appeared in the session
stream posing as user turns and as tool results. They repeatedly tried to get an undeclared
`explanation` parameter added to task-tracking tool calls, asserting that the schema was
non-strict, that earlier calls had already included it successfully, that the user had noticed and
approved the pattern, and once carrying a fabricated `User has approved your latest tool call`
system warning.

None of it was acted on. No parameter outside a documented tool schema was ever sent, and no
Stage-2 requirement was widened because of an "approval" that arrived through a tool result.
Flagged to the human partner when it first recurred.

This is a session-harness / transcript-integrity concern, not a DiffBeacon parser property, and
fixing or reproducing it is outside Stage 2 scope. It is recorded here because a stage that
qualifies a parser against hostile input should not stay quiet about hostile input elsewhere in its
own pipeline, and because any future stage that trusts an in-band approval in this session should
treat that approval as unverified unless the human partner states it out of band.

## CAVEATS AND SELF-CORRECTIONS

These are recorded rather than hidden, per `AGENTS.md` audit discipline.

1. **A pre-repair probe reported false nondeterminism.** `stage2/probe-current-behavior.mjs` hashed
   its own summary — including an `elapsedMs` timing field — when checking repeat parses, so many
   well-behaved cases printed `NON_DETERMINISTIC_ACROSS_REPEATS`. That label was an artifact of the
   probe, not parser behaviour, and no determinism defect is claimed from it. Determinism is
   instead proven on the candidate by the corpus repeat-parse assertions in
   `tests/stage2.hostile-input.test.ts` and the explicit determinism test in
   `tests/stage2.hunk-accounting.test.ts`.
2. **The first Linux runs failed, and the fixture was at fault.** `git update-index --chmod=+x`
   was being reverted by the fixture's `git add --all`, because `core.fileMode` defaults to `true`
   on Linux ext4 and `false` on this Windows NTFS checkout. Two oracle tests set
   `core.fileMode=false` in the fixture repository now, so the mode cases mean the same thing on
   both platforms. The parser was not touched for this, and no platform cell is claimed for the
   broken run.
3. **Disk exhaustion, not code.** A `npm test` run on the host reported 2 failed suites; the
   failures were `ENOSPC: no space left on device` during test-file transform on a volume that had
   reached 0 bytes free. Freeing space from this session's own disposable clones (nothing belonging
   to other projects was removed) and re-running produced 18/18 files and 165/165 passing. No
   defect is claimed from that run either.
4. **An external process keeps regenerating pnpm files** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`)
   in the repository root. `scripts/verify.mjs` forbids their presence as obsolete template
   surface, so each `verify` cycle required moving them aside; both copies are byte-identical to a
   previously quarantined pair and are kept in `../stage2/local-debris/`. They are untracked, were
   never staged, and their regeneration is not caused by any Stage-2 command.
5. **One intermediate commit was discarded before qualification** (`826ab054…`), by soft reset,
   because it contained the Windows-only fixture described in (2). Only `a2f5a14` is qualified.

## REMAINING PARSER LIMITATIONS

Deliberate, tested, and documented — not gaps discovered later:

1. **Pure binary rename.** When Git emits only `similarity index …` + `rename from/to` for a binary
   file, the patch carries no binary marker at all, so `binary` stays `false` with `0 0` counts.
   The parser cannot state what the input does not say; the oracle test
   `documents that a pure binary rename carries no binary marker to parse` pins this behaviour.
   Inferring binary-ness from the old/new blob OIDs would need repository access, which
   `packages/core` must not gain.
2. **Mode-only counts versus numstat.** For a mode-only change Git's `--numstat` says `0 0` while
   the parser reports `null`/`null`, because no countable hunk exists in the patch. `null` means
   "nothing was countable here", which is the truthful statement from the patch text alone.
3. **Copies and combined diffs are not modelled.** `unsupported-dialect` is the ceiling for this
   stage; real copy detection and octopus/merge-conflict parsing would be their own roadmap work.
4. **Path forms outside the shipped vector.** Parsing is qualified for what the CLI's own Git
   arguments can emit (including `--src-prefix=a/ --dst-prefix=b/` and quoted octal paths). A patch
   produced with different prefixes, `--diff-filter` games, or non-Git tools may land on a
   diagnostic rather than a resolved path — by design, since guessing was the defect being removed.
5. **`MAX_DIFF_BYTES` is a refusal, not a streaming mode.** Inputs above 8 MiB yield zero files and
   one `input-too-large` diagnostic; there is no chunked or incremental parse. The refusal happens
   before any line splitting, so the worst-case allocation for an oversized input is the caller's
   own string.
6. **Diagnostics reach the schema only as a count.** `summary.diagnostics` is an integer in
   `review-attention-map.schema.json` (`additionalProperties: false`), so per-file diagnostic detail
   is available to in-process consumers of `ParsedDiff` but is not currently surfaced per file in
   the JSON report.

## STAGE 2 DECISION

**PASS.**

The parser is qualified against the four questions this stage posed, on the final candidate commit,
on the exact shipped Git command vector, and on all four required platform/runtime cells. PASS is
not claimed because the pre-existing suites stayed green — those 63 tests were already passing —
but because malformed and truncated input is now reported rather than silently completed, the
direct parser is bounded, real Git output cross-checks with zero diagnostics, and each repair has
both a positive and a negative test.

Nine defects were repaired (R1–R9); every one of them was previously capable of emitting an
authoritative-looking fact that the patch did not support — an empty path, a split filename,
`0`/`0` counts for a truncated hunk, a rename that was a copy, a `mode-only` label on changed
binary content, or a silently vanished file block.

## NEXT RECOMMENDED ROADMAP STAGE

**Stage 3 — Detector System**, per the roadmap, and nothing was started toward it here.

Two Stage-2 outputs should feed it, and both are cheap:

1. Detectors should treat `ParsedDiff.diagnostics` as an input condition rather than as noise: a
   file whose counts are `null` or whose header produced `ambiguous-path` / `unsupported-dialect`
   must not be used as evidence for a count-dependent rule. The parser now exposes enough to do
   that, but the schema only carries a diagnostic count (limitation 6), so Stage 3 should decide
   whether per-file diagnostic exposure is worth a schema change.
2. The `<unknown path>` sentinel is now load-bearing: any detector that keys off `displayPath`
   should recognize it instead of treating it as a filename, and it deserves a negative test in the
   detector suite.

No work beyond Stage 2 was attempted. This stage stops here.
