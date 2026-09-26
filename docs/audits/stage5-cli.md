# DIFFBEACON STAGE 5 — CLI REPORT

```text
STATUS:                  PASS
STARTING SHA:            4e5bd44900556b22563c007730b25e16b03bb4cf  (rescue/stage0-source tip at start)
PRODUCT COMMITS:         5a4789781554c9cec0ba83f50bda40de490d36d3  fix: qualify DiffBeacon CLI
                         2dfaf51c1754e4c1eadd04e394396e3864d3ac76  fix: build the CLI bundle inside its entrypoint contract suite
                         ae1ec89a04e0a011fbcd5bc8618076692f8a2066  test: cover empty stdin and a Unicode repository path
ENDING SHA (qualification commit): ae1ec89a04e0a011fbcd5bc8618076692f8a2066
REPORT COMMIT:                     this document, committed as 'docs: record DiffBeacon Stage 5 CLI qualification'
FOLLOW-UP COMMIT:                  the next commit on rescue/stage0-source, message 'docs: record DiffBeacon Stage 5 CI observation'; it edits only this manifest-excluded file
BRANCH:                  rescue/stage0-source
ORIGIN MAIN SHA:         e0ff98143bfe39c80c338518d006525a846a8739  (unchanged; not merged, not moved)
PUSHED:                  yes — normal non-forced `git push origin rescue/stage0-source`. This line is
                         written before the push and confirmed by it; the remote state, the single CI
                         observation and any divergence are recorded in CI OBSERVATION at the end.
```

The stage prompt suggested two commits. The product work landed as three, because the second
and third were each caused by a measurement rather than by a plan change: a clean-clone
qualification cell proved that the entrypoint suite could not run in a fresh checkout, and the
PHASE 1 matrix audit proved two of its own rows had no executed coverage. Splitting keeps each
repair attached to the evidence that demanded it. Nothing was folded into the report commit.

## Identity gate

Verified before any edit: `git remote get-url origin` →
`https://github.com/Pavithran-R-A/DiffBeacon.git`, `git branch --show-current` →
`rescue/stage0-source`, `git rev-parse HEAD` → `4e5bd449…`, `origin/main` → `e0ff9814…`, and
`git merge-base --is-ancestor 888fe10c80feab7ad0e88003cf016a47a34c1bb8 HEAD` succeeded, so
Stage 4 was present in history. Baseline measured before edits: 24 test files / 545 tests on
Windows, 544 passed + 1 skipped in a Linux container, `SOURCE_MANIFEST.txt` at 105 entries,
latest Actions run `36218953127` already recorded as `EXTERNAL CI BLOCKED`. Nothing differed
from the expected starting state, so work proceeded.

## CLI CONTRACT

- **Commands.** `review` is the only command. Any other first token is a usage error:
  `DiffBeacon: Unknown command: "frobnicate". The only command is review.` (exit 2).
- **Ranges.** exactly one two-endpoint range, `A...B` or `A..B`. A plain revision is refused
  (see RANGE SEMANTICS). Option-looking tokens, whitespace, shell metacharacters and revisions
  over 240 characters are refused before Git is asked (`packages/cli/src/revisions.ts`).
- **stdin.** `review --stdin` reads a unified diff from standard input as a byte stream, capped
  at `MAX_DIFF_BYTES = 8 * 1024 * 1024`. A range and `--stdin` together are a usage error.
- **Formats.** `pretty` (default), `json`, `markdown`, value always a separate argument.
- **Output.** `--output <file>` writes the report to that file and leaves stdout empty.
- **Exit codes.** five codes, 0/1/2/3/4, and the severity of an observation never selects one.
- The CLI never mutates or fetches the target repository: every Git call is a read
  (`rev-parse`, `diff`, `--is-shallow-repository`) through an argument vector with `shell:false`.

## ARGUMENT MATRIX

All 45 PHASE 1 rows. `before` is `stage5/probe-before.txt` / `stage5/probe-before-2.txt`
against the starting bundle, plus `stage5/before-stdin-920b5630.txt` for the stdin boundary
rows. `after` is `stage5/probe-cli-rows-a.txt` (argv rows measured against the final bundle,
sha256 `b4faa11d…`), `stage5/after-stdin-new.txt` (stdin boundary rows),
`stage5/bin-smoke-windows.txt` (installed-bin rows) and the four qualification cells, in which
the named test executes and passes. D = defect found, R = repaired, — = measured conforming.

| #   | form                                        | before                                                                                | after                                                                                                                                                              | coverage                                                                                                                                                                                                                               |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | no arguments                                | help on stdout, exit 0                                                                | usage on stdout, exit 0, unchanged                                                                                                                                 | `stage5.cli-arguments` "prints usage for no arguments, --help and -h, all to stdout with exit 0"                                                                                                                                       |
| 2   | `--help`                                    | exit 0, 428 bytes, unchanged                                                          | unchanged                                                                                                                                                          | same test + "lists the short aliases it accepts"                                                                                                                                                                                       |
| 3   | `-h`                                        | exit 0, unchanged                                                                     | unchanged                                                                                                                                                          | same test                                                                                                                                                                                                                              |
| 4   | `--version`                                 | exit 0, `0.1.0\n`                                                                     | unchanged; equals `packages/cli/package.json`                                                                                                                      | "prints the package version for --version and -v"; `package-smoke` asserts the installed shim prints the package version                                                                                                               |
| 5   | `-v`                                        | exit 0                                                                                | unchanged                                                                                                                                                          | same test                                                                                                                                                                                                                              |
| 6   | `review A...B`                              | exit 0 but summary read `1 files changed` (D)                                         | exit 0, `1 file changed`                                                                                                                                           | R — `stage5.cli-formats` (11 tests); real ranges in `stage5.cli-adversarial-refs`                                                                                                                                                      |
| 7   | `review A..B`                               | exit 0, same grammar defect                                                           | exit 0                                                                                                                                                             | `stage5.cli-adversarial-refs` "reviews release/1.2..HEAD / HEAD~1..HEAD / HEAD^..HEAD / BASE..HEAD as a real two-endpoint comparison"                                                                                                  |
| 8   | `review A` (plain revision)                 | **accepted**, exit 0, `git diff A --` compared the revision with the working tree (D) | exit 2, message names the reason (R)                                                                                                                               | "rejects a plain revision instead of silently comparing against the working tree", "rejects a single revision even when it names a real ref"; `cli.test.ts`                                                                            |
| 9   | `review --stdin`                            | exit 0                                                                                | unchanged for a well-formed diff                                                                                                                                   | `stage5.cli-output`, `stage5.cli-stdin`, `package-smoke`                                                                                                                                                                               |
| 10  | pretty default                              | `1 files` form, colour decision not asserted                                          | plain text, singular grammar                                                                                                                                       | `stage5.cli-formats` "reports the same one-file count through pretty, markdown and json"                                                                                                                                               |
| 11  | `--format pretty`                           | worked                                                                                | unchanged                                                                                                                                                          | `stage5.cli-formats`                                                                                                                                                                                                                   |
| 12  | `--format json`                             | worked, schema `1`                                                                    | unchanged                                                                                                                                                          | `stage5.cli-formats`, `stage5.cli-output` "keeps stdout empty for json and markdown reports too"                                                                                                                                       |
| 13  | `--format markdown`                         | worked                                                                                | unchanged                                                                                                                                                          | `stage5.cli-formats`, `stage5.cli-output-paths`                                                                                                                                                                                        |
| 14  | `--output <file>`                           | **echoed the whole report to stdout as well** (D)                                     | file written, stdout 0 bytes, exactly one trailing newline (R)                                                                                                     | `stage5.cli-output` (8 tests); `package-smoke` proves it through the installed shim (`fileStdoutBytes=0`)                                                                                                                              |
| 15  | invalid format                              | exit 1, raw error shape (D)                                                           | exit 2 `Invalid --format value: "xml". Choose pretty, json, or markdown.` (R)                                                                                      | "rejects an unknown option and points at help" family; measured in `probe-cli-rows-a.txt`                                                                                                                                              |
| 16  | missing `--format` value                    | exit 1                                                                                | exit 2 `--format requires a value, and none was supplied.`                                                                                                         | "reports a missing --format value as missing, not invalid"                                                                                                                                                                             |
| 17  | missing `--output` value                    | exit 1                                                                                | exit 2 `--output requires a value…`                                                                                                                                | "reports a missing --output value as missing"; `stage5.cli-output-paths` "reports a missing value instead of writing a file named after a later flag"                                                                                  |
| 18  | unknown option                              | exit 1                                                                                | exit 2 `Unknown option: "--bogus". Run diffbeacon --help for the accepted forms.`                                                                                  | "rejects an unknown option and points at help"                                                                                                                                                                                         |
| 19  | multiple ranges                             | exit 1                                                                                | exit 2 (range + range is the range/stdin conflict message)                                                                                                         | "rejects a second positional range"                                                                                                                                                                                                    |
| 20  | range + `--stdin`                           | exit 1                                                                                | exit 2 `Use either a revision range or --stdin, not both: got "HEAD~1...HEAD" and --stdin.`                                                                        | "rejects mixing a range with --stdin"                                                                                                                                                                                                  |
| 21  | duplicate `--stdin`                         | exit 0, silently accepted (D)                                                         | exit 2 "supplied more than once… the last value does not silently win" (R)                                                                                         | "rejects repeated mode, format and output selectors instead of letting the last one win"                                                                                                                                               |
| 22  | duplicate `--format`                        | exit 0, last one won (D)                                                              | exit 2 (R)                                                                                                                                                         | same test                                                                                                                                                                                                                              |
| 23  | duplicate `--output`                        | exit 0, last one won (D)                                                              | exit 2 (R)                                                                                                                                                         | same test                                                                                                                                                                                                                              |
| 24  | option-looking output value                 | exit 1 (D)                                                                            | exit 2 missing-value, and no file named `--format` is created (R)                                                                                                  | "refuses to consume another recognized option as the --output filename"; contrasted by "still allows an output filename that merely begins with a dash"                                                                                |
| 25  | empty stdin                                 | exit 0, 295 bytes, `0 files changed`                                                  | unchanged, and now asserted                                                                                                                                        | `stage5.cli-stdin` "reads zero bytes as an empty diff instead of raising" + "reports zero changed files with exit 0 for an empty pipe" (added this stage; see COVERAGE CLOSURE)                                                        |
| 26  | exact byte limit                            | **rejected** with exit 1 because the bound counted re-encoded bytes (D)               | accepted, exit 0, 8388608 bytes measured (R)                                                                                                                       | `stage5.cli-stdin` "takes the limit exactly in two-byte text whose chunk cuts land mid-sequence"; `after-stdin-new.txt` L1                                                                                                             |
| 27  | above byte limit                            | exit 1, `DiffBeacon error: …` (D)                                                     | exit 3 with the actionable `No diff available: the diff is larger than the 8388608 byte analysis limit. Narrow the range, or use --stdin with a bounded diff.` (R) | `stage5.cli-stdin` "rejects one byte over the limit", "stops reading as soon as the limit is exceeded"; `after-stdin-new.txt` O1                                                                                                       |
| 28  | Unicode stdin                               | corrupted: `unicod???.ts` when a chunk cut a sequence                                 | exact `unicodé.ts` (R)                                                                                                                                             | `stage5.cli-stdin` "returns the text unchanged when the whole diff arrives in one chunk"; `before/after-stdin` U1 pair                                                                                                                 |
| 29  | Unicode split across chunks                 | U+FFFD on both halves (D)                                                             | reassembled, no U+FFFD at 1/2/3/7/11-byte and 5-byte cuts (R)                                                                                                      | "reassembles multi-byte sequences split across chunks", "matches the unsplit read for a hunk cut every five bytes", "flushes a trailing incomplete sequence once instead of dropping it"                                               |
| 30  | invalid Git revision                        | exit 1 for every shape                                                                | exit 2 for syntax (`HEAD 1...HEAD`, `$(touch PWNED)`, `-HEAD`), exit 3 for a well-formed but unresolvable ref (`nope-at-all`) (R)                                  | "rejects a range whose endpoints are missing", "names the whole range when one side is invalid", "keeps a rejected revision echo bounded"; `cli.test.ts`                                                                               |
| 31  | non-Git working directory                   | exit 1                                                                                | exit 3, operational not usage                                                                                                                                      | "reports a missing repository as an operational diff-unavailable failure"; `package-smoke` (`noRepositoryExit=3`)                                                                                                                      |
| 32  | valid repository from a nested subdirectory | worked                                                                                | unchanged, paths stay root-relative                                                                                                                                | `stage5.cli-repository` "reads the enclosing repository from a subdirectory, with root-relative paths"                                                                                                                                 |
| 33  | repository path with spaces                 | worked                                                                                | unchanged                                                                                                                                                          | "reads the inner repository when one repository lives inside another"; `stage5.git-determinism` "analyzes a repository whose working directory contains spaces"; `cli.integration`                                                     |
| 34  | repository path with Unicode                | untested (coverage gap)                                                               | asserted against a real fixture at `répo été 報告` (exit 0, `1 file changed`)                                                                                      | `stage5.cli-repository` "reviews a repository located in a path containing Unicode and spaces" (added this stage)                                                                                                                      |
| 35  | detached HEAD                               | worked                                                                                | unchanged                                                                                                                                                          | "reviews a detached head as long as both endpoints exist"                                                                                                                                                                              |
| 36  | shallow clone, both endpoints present       | worked                                                                                | unchanged                                                                                                                                                          | "reviews a shallow clone whose requested depth really is present" (real `git clone --depth 2 file:///…`)                                                                                                                               |
| 37  | shallow clone, base unavailable             | exit 1, generic                                                                       | exit 3 naming `HEAD~1`, the word `shallow`, and the `--stdin` way round (R)                                                                                        | "names the missing revision and the --stdin way round for a one-commit shallow clone"                                                                                                                                                  |
| 38  | output path with spaces                     | exit 1                                                                                | exit 0, file written                                                                                                                                               | `stage5.cli-output-paths` "writes a report whose name contains spaces and non-ASCII characters"                                                                                                                                        |
| 39  | output path with Unicode                    | exit 0                                                                                | unchanged, now asserted                                                                                                                                            | same test (`rapport été 報告.txt`)                                                                                                                                                                                                     |
| 40  | unwritable output target                    | exit 1                                                                                | exit 4, named target, nothing written, no partial file left (R)                                                                                                    | "refuses a nonexistent parent directory with exit 4 and writes no report", "refuses a directory supplied as the file target with exit 4"; `stage5.cli-output` "names the target, writes nothing to stdout and leaves no report behind" |
| 41  | installed npm bin on Windows                | untested (placeholder in the PHASE 1 probe)                                           | `.cmd` shim runs `--version`, `--help`, stdin review, `--output` with empty stdout, a real Git range, exit 3 outside a repository and exit 2 for `review HEAD`     | `npm run package-smoke` through `scripts/npm-bin-shim.mjs`; `bin-smoke-windows.txt`; `tests/npm-helper.test.ts`                                                                                                                        |
| 42  | installed npm bin on Linux                  | untested                                                                              | same contract through the POSIX symlink, in both Linux cells                                                                                                       | `npm run package-smoke` in the `linux-node24` and `linux-node22` cells                                                                                                                                                                 |
| 43  | stdout/stderr discipline                    | errors collapsed into exit 1 with raw shapes                                          | reports on stdout only; refusals on stderr only, one line, `DiffBeacon: ` prefix; stdout empty on every refusal (R)                                                | "covers usage, no-diff and unwritable-output without dumps or escapes"; "keeps every usage rejection out of Git: no repository message leaks"                                                                                          |
| 44  | ANSI / colour behaviour                     | escape sequences reached report files; `NO_COLOR` ignored (D)                         | colour only on a TTY with no `--output`; plain on pipe, plain under `NO_COLOR`, never in a file (R)                                                                | `stage5.cli-output` colour contract (5 tests)                                                                                                                                                                                          |
| 45  | operational exit codes                      | everything nonzero was `1`                                                            | documented 0/1/2/3/4 set, and levels never change it (R)                                                                                                           | "never uses the severity of an observation as an exit code"; `package-smoke` proves 2 and 3 survive the Windows shim                                                                                                                   |

## RANGE SEMANTICS

- `A...B` — merge-base comparison, passed to Git verbatim as one argv element after
  `--end-of-options`. Nine real two-endpoint shapes are reviewed against a real fixture
  repository (`release/1.2..HEAD`, `release/1.2...HEAD`, `v1.2..HEAD`, `HEAD~1..HEAD`,
  `HEAD~1...HEAD`, `HEAD^..HEAD`, `<sha>..HEAD`, `<sha>...HEAD`, `release/1.2..HEAD^{}`), each
  asserting the file count the fixture actually has.
- `A..B` — direct comparison, same handling.
- Plain revision — **rejected**, exit 2. `git diff <rev> --` compares a revision with the
  index and working tree, so accepting it would silently analyse uncommitted state and would
  make the same command mean two different things depending on the caller's dirty files. Before
  this stage `review HEAD` returned exit 0 with a `0 files changed` report, which is the
  ambiguity the prompt required removed. No working-tree feature was added in its place.
- A revision is one opaque token: no NUL/control characters, no whitespace, no
  `` $ ; | & < > ` `` and no leading dash, at most 240 characters. Safe ordinary syntax
  (`release/1.2`, `HEAD^`, `HEAD~1`, `^{}`) stays accepted; the rejection message names the
  whole range as the user typed it, bounded and quoted.

## HELP

`--help`, `-h`, `review --help`, `review -h` and a bare `diffbeacon` all print the same usage to
stdout with exit 0 and never touch Git or stdin (proved by running the no-argument case inside a
temporary non-repository). The text lists only the forms the parser accepts, including `--` as
the end of options, and the Exit codes block states that level never changes the code. Two
guards keep it true: every `--flag` word in `packages/cli/README.md` must appear in `--help`, and
the help text must not claim npm registry availability.

## VERSION

`--version` and `-v` (also after `review`) print `0.1.0` from `packages/cli/package.json` to
stdout, exit 0, and work outside any repository. `npm run package-smoke` compares the version the
installed shim reports with the installed package metadata, so the three cannot drift.

## EXIT CODES

| code | meaning                                                                                                   | proven by                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0    | a report was produced — help, version, any observation level                                              | `stage5.cli-arguments`, `stage5.cli-formats`                                            |
| 1    | unexpected internal failure, one bounded line, no stack                                                   | `stage5.cli-errors` "collapses a stdin failure into exit 1 with no stack trace"         |
| 2    | usage error: unknown command/option, bad range syntax, missing or repeated selector                       | `stage5.cli-arguments`, `stage5.cli-adversarial-refs`; `package-smoke` through the shim |
| 3    | no diff available: non-repository, unresolvable or missing history, shallow, failing Git, over-limit diff | `stage5.cli-repository`, `stage5.cli-stdin`, `package-smoke` through the shim           |
| 4    | the `--output` file could not be written                                                                  | `stage5.cli-output`, `stage5.cli-output-paths`                                          |

FOCUS, CHECK and NOTE observations never affect the code: one test reviews a diff whose report is
full of FOCUS rows and asserts exit 0.

## ERRORS

Every user-visible failure is one line starting `DiffBeacon: `. Measured samples:
invalid arguments → `Invalid --format value: "xml". Choose pretty, json, or markdown.`; invalid
refs → `No diff available: git cannot resolve revision "nope-at-all". The ref may not exist, or
history may be incomplete, as in a shallow or partial clone. Read a prepared diff with --stdin.`;
non-Git → exit 3 operational message naming the directory; shallow → names the missing revision
and the workaround; oversize → `the diff is larger than the 8388608 byte analysis limit. Narrow
the range, or use --stdin with a bounded diff.`; file write → `Could not write …`, naming the
target. Bounding lives in `packages/cli/src/errors.ts`: `echo()` quotes an untrusted value, caps
it at 120 characters and replaces control characters, `boundedSingleLine()` collapses multi-line
Git stderr to one printable line of at most 512 characters plus `...(truncated)`. A 4 000-character
`--output` name and a coloured, 20 KB Git error both come out as a single bounded line, and no
case prints `at …` stack frames or a raw `Error:` dump. PHASE 21 was deliberately kept to the
known CLI failure classes; broad hostile-output sanitisation remains Stage 8 work.

## SHALLOW

Real clones made with `git clone --depth N file:///…`, because a plain local path clone copies
every object and is not shallow at all.

- available-history fixture — depth 2 clone, `HEAD~1...HEAD` reviewed, exit 0, `2 files changed`.
- missing-history fixture — depth 1 clone. The test first proves with Git itself that
  `rev-parse --verify HEAD~1^{commit}` throws, then requires exit 3, empty stdout and a message
  containing `HEAD~1`, `shallow` and `--stdin`. Detection uses
  `git rev-parse --is-shallow-repository` through the same argument-vector boundary, only to
  improve the message. Nothing is fetched, and no command mutates the target repository; the
  complete clone of the same source is also reviewed as the control.

## STDIN

`readStdinDiff()` decodes the whole stream with one `StringDecoder('utf8')` and counts raw bytes
as they arrive, so neither the result nor the limit depends on where the pipe cut. 2-, 3- and
4-byte sequences are split by chunk sizes 1, 2, 3, 7 and 11, by a 5-byte hunk cut over 400
lines, and by a 1 048 575-byte cut over the full 8 MiB limit; every case compares against the
same bytes decoded in one pass and asserts no U+FFFD. A trailing lone lead byte is flushed once
rather than dropped. Boundary measurements against the final bundle: 8 388 608 bytes accepted
(exit 0), 8 388 609 rejected (exit 3), and an endless stream stops after the ninth 1 MiB chunk
instead of being buffered forever. An engineered 81 157-byte diff whose 64 KiB chunk cut lands
inside `+++ b/unicodé.ts` now yields the exact path, where the starting bundle produced
`unicod.ts`.

## GIT

Every Git call is `execFileSync`/`spawn` with an argv array and `shell: false` — three call sites
in `packages/cli/src/git.ts`, structurally asserted ("disables the shell on every child-process
call", "never reaches for the shell-flavoured process APIs" reject `execSync(`/`spawnSync(`, and
"hands the revision over as one guarded argv entry" pins `--end-of-options`). No string-interpolated
shell command exists anywhere in the CLI.

- **Argument-vector proof by behaviour.** Ten shell-bearing ranges (`$(touch pwned-substitution)`,
  backtick, `;`, `|`, `>`, `&`, inner space, embedded newline, leading `--out=stdout`, a
  4 000-character name) are reviewed inside real repositories while the working directory is
  watched: each exits 2, writes nothing to stdout, and `readdirSync(work)` is still empty — so no
  substitution, redirection or side-effect file happened. A control test proves that marker check
  can see a file if one is created.
- **Hostile config.** `stage5.git-determinism` normalises structural flags and hostile repository
  diff configuration (`diff.*` drivers, rename/copy detection, textconv) to the same report, and
  "keeps the documented Git argument set equal to the shipped vector" ties `packages/action/README.md`
  to the code.
- **Range collection.** the collector streams stdout through the decoder, kills the child and
  reports exit 3 once the bound is crossed, and caps captured stderr at 64 KiB. The integration
  case "rejects a real Git range above the bounded analysis limit without ENOBUFS" replaces the
  old raw `ENOBUFS` crash; small metadata calls keep a 256 KiB `maxBuffer`.
- **Nested / spaces.** `--show-toplevel` resolves the repository root and Git is then run from
  that root, so a subdirectory, an inner repository, a detached head, a spaces path and a Unicode
  path all analyse the intended repository with root-relative paths.

## FORMATS

`pretty` is the default human report; `markdown` emits headings and a table; `json` emits
`schemaVersion: "1"` plus `summary` (changedFiles, additions, deletions, binaryFiles,
modeOnlyFiles, generatedFiles, diagnostics), files and attention entries, validated against
`packages/core/schema/review-attention-map.schema.json`. One test drives the same one-file diff
through all three and requires the same count in each, which is where the `1 files` grammar
defect was caught.

## COLOR

Colour is decided once: stdout must report itself as a TTY and no `--output` may be named. Tests
force `isTTY` on the real stream so the contract is proved under the only conditions where
getting it wrong is visible: coloured on a terminal, plain on a pipe, plain with `NO_COLOR` set,
and — the repaired defect — never an escape sequence inside a report file even when stdout is a
terminal.

## OUTPUT FILE

`--output` is a destination, not an echo: stdout stays empty for all three formats, the file ends
with exactly one newline, and a refusal names the target, writes nothing to stdout and leaves no
report behind. Adversarial names are written through real fixtures: `review notes - rapport été
報告.txt`, a nested existing directory, a name beginning with `-`, and a Unicode name. A missing
parent directory and a directory used as the target each exit 4 and create nothing. Not covered:
a permission-denied target. `chmod`-based fixtures are unreliable here (the container runs as
root and Windows ignores the bit), and no other reliable unwritable fixture was invented for
this stage.

## PACKAGE BIN

`npm pack` output is installed into a throwaway consumer and driven through the platform's own
shim, never `node dist/index.js`: `--version` equals the installed manifest, `--help` prints
`Usage:`, a stdin review parses, `--output` writes the file with zero stdout bytes, a real
`HEAD~1...HEAD` range in a real repository reports one file, `review HEAD~1...HEAD` outside a
repository exits 3 and `review HEAD` exits 2 with empty stdout, proving the codes survive
`cmd.exe`. Windows exercises `node_modules\.bin\diffbeacon.cmd`; Linux exercises the symlink, in
both `node:24` and `node:22` cells. `scripts/npm-cli.mjs`/`npm-bin-shim.mjs` keep project-owned
npm scripts off `npm.cmd` and refuse a non-review argv, and `action-smoke` reports `cliLeak=false`
so none of the CLI-only strings entered the Action bundle.

## STARTUP GUARD

The bundle runs the CLI only when it is the program being run, decided by comparing
`process.argv[1]` against its own resolved path. Three executed cases: running the bundle prints
the version; running it with a piped diff returns the parsed report; and importing the bundle
from an unrelated `index.js` in a temporary directory prints only `IMPORTED_AS_LIBRARY`. Before
the guard the third case dumped the whole help text into the importer's stdout.

## BOUNDED INPUT

stdin 8 MiB counted as bytes; Git stdout streamed with the same limit and a killed child;
`gitSmall` 256 KiB; Git stderr capped at 64 KiB per call; revision 240 characters; echoed value
120 characters; bounded detail line 512 characters; report and refusal stdout unchanged from
Stage 2/4 analysis limits. Every bound is asserted by a test at its exact edge, one side over,
and by the "stops reading as soon as the limit is exceeded" pull-count assertion.

## MACOS

Actual qualification: **NO**. There is no macOS environment in this session and none was faked.
Static review of the source (`stage5/record-20-macos-static.txt`) found nothing platform
specific to defeat a future run: paths are built with `path.*` and never string-joined with a
separator, the POSIX branch of `scripts/npm-bin-shim.mjs` uses the executable symlink, every Git
call is an argv vector with `shell: false`, stdin uses an explicit `StringDecoder('utf8')`, the
bundle carries `#!/usr/bin/env node` plus `chmodSync(..., 0o755)`, and file writes go through
`writeFileSync` on the resolved target. Recorded as: macOS source-compatible by portable
boundaries, but not runtime-qualified.

## TESTS

- starting: 24 files, 545 tests collected (Windows, measured on this stage's working tree before
  the first edit — recorded in `stage5/bundle-24-and-gates.txt`); 544 passed + 1 skipped on Linux.
  The two figures are the same 545 cases: the one Linux skip is a Windows-only shim case, so Linux
  executes 544 of 545. The Linux starting count was measured in the Stage-4 cells at `d2ff91a5`;
  `git diff --stat d2ff91a5 4e5bd449` shows the only difference to this stage's starting SHA is
  `docs/audits/stage4-attention-ordering.md`, which no test reads, so the figure carries over.
- final: **33 files, 660 tests** on Windows; **659 passed + 1 skipped** in each Linux cell — the
  same single platform-conditional skip.
- new Stage-5 suites: `stage5.cli-arguments` (30), `stage5.cli-formats` (11), `stage5.cli-output`
  (8), `stage5.cli-output-paths` (6), `stage5.cli-entry` (3), `stage5.cli-errors` (6),
  `stage5.cli-adversarial-refs` (23), `stage5.cli-repository` (8), `stage5.cli-stdin` (9), plus
  two platform-aware cases in `tests/npm-helper.test.ts`.
- no existing test was deleted or weakened to reach green.
- the single skip is pre-existing and platform-conditional:
  `tests/stage3c.release.test.ts:123` is `it.runIf(process.platform === 'win32')`, so Linux
  reports one skipped case of 660. It is a Windows shim case, unrelated to Stage 5.

### Guards that passed on first run, and how each was still proved

Four rows of the matrix closed a coverage gap rather than a defect, so their tests passed
immediately — which proves nothing by itself. Each was mutation-proved (recorded in
`stage5/red-06-coverage-gaps.txt` and `stage5/red-05-docs-truthfulness.txt`) and is disclosed
here rather than presented as a repair: rejecting an empty pipe inside `readStdinDiff` failed
both new stdin cases while the other seven kept passing; dropping the fixture's nested path
failed only the Unicode repository case; injecting a README-only flag failed the README/`--help`
parity guard; and a fake README `npx` claim failed the publication guard. The same technique was
used earlier in the stage for the repairs themselves: removing the revision metacharacter class
and forcing `shell: true` in `git.ts` produced 17 failures including every real review, and
moving `packages/cli/src/errors.ts` out of the tree stopped `npm run verify` at
`assertSourceCompleteness`.

## BUILD

`npm run build` produces both bundles from source with esbuild; the CLI bundle is untracked and
rebuilt locally, the Action bundle is tracked. `npm run verify` re-checks artifact freshness, so
a stale bundle fails the gate. The CLI bundle digest was identical in all four cells and in the
host rebuild.

## ACTION BUNDLE

- before (tracked at the starting SHA): `f8e39809bbbbd170a64c88bb6bde206ef4d45463a6f08000be2c5be9efa4d493`
- final (committed): `c17dc9e64268dbc34733b774dfe69d72e6e4860ad1798f26dbc5d2f9ea7fb40b`
- clean rebuild after deleting the bundle: `c17dc9e6…`, byte-identical (`cmp` reports no
  difference), and reproduced in all four cells (`bundle_after_build` equals `bundle_committed`).
  The digest moved only because the `1 file` count grammar lives in the shared
  `packages/core/src/render.ts`. `action-smoke` still reports `cliLeak=false`, `hostilePaths=true`,
  `oversizeRejected=true`.

## MANIFEST

105 entries at the start, **115 entries** now,
`sha256(SOURCE_MANIFEST.txt) = e8535df5613ae18898cbcd26a192dc71d3b41a3a57d23e7189dd753f1a8e9354`.
Regenerated after staging, with every drift line reviewed: the ten new test suites, the new
`packages/cli/src/errors.ts` (also added to the required-source list in `scripts/verify.mjs`),
the repaired CLI sources, and the three manifest-only refreshes that followed each commit.
`docs/audits/**` is manifest-excluded, so this report adds no drift.

## GITHUB ACTIONS

See the CI OBSERVATION section at the end of this file: it is recorded after the push and is the
only observation made. No run was rerun, no workflow was edited, and no failure was attributed
to DiffBeacon without evidence.

## EXACT COMMANDS RUN

```bash
# host, Windows 10.0.26200 x64, Git Bash, Node v24.21.0 / v22.23.3, npm 11.19.0 / 10.9.9,
# Git 2.55.0.windows.5 (Windows) and 2.39.5 (containers), core.autocrlf=true on the host
git remote get-url origin; git branch --show-current; git rev-parse HEAD
git rev-parse origin/main; git merge-base --is-ancestor 888fe10c HEAD
npm ci
npm run format:check        # npx prettier --write on a file only after --check named it
npm run lint                # eslint . --max-warnings=0
npm run typecheck           # tsc --noEmit -p tsconfig.json
npx --no-install vitest run                                   # full suite
npx --no-install vitest run tests/<one suite>                  # per-cycle red/green runs
npm run build
npm run manifest
node scripts/verify.mjs ; npm run verify ; npm run check
npm run package-smoke ; npm run action-smoke
node stage5/probe-chunk-sizes.mjs ; node stage5/probe-chunk-sizes2.mjs   # real stdin chunk boundaries: file vs pipe
node stage5/probe-stdin.mjs <built CLI bundle path>                            # PHASE 9/10 boundaries
node stage5/probe-cli.mjs ; node stage5/probe-cli2.mjs                  # PHASE 1 argv rows against the built bundle
# all four probes live OUTSIDE the repository (in ../stage5) and were never staged
git clone --no-hardlinks -q DiffBeacon -b rescue/stage0-source stage5/cells/<cell>/DiffBeacon
bash stage5/run-cell-windows.sh "" win-node24
bash stage5/run-cell-windows.sh ".../stage1/node22/node-v22.23.3-win-x64" win-node22
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/DiffBeacon:/repo:ro" -v ".../stage5/cells/<cell>:/evidence" node:24 bash -lc '…'   # and node:22
# inside each cell: git config --global --add safe.directory "*"; git clone --no-hardlinks /repo; then
for gate in ci format:check lint typecheck test build package-smoke action-smoke verify check; do …; done
git add <named Stage-5 files> ; git -c user.name=… -c user.email=… commit -m …
git push origin rescue/stage0-source
```

Mutation experiments were reverted from `/tmp` copies and confirmed by `git diff --stat` /
`git status --porcelain` showing no change; temporary consumers, probes and fixture repositories
were created outside the repository and removed by exact path.

## WORKING TREE STATE

`git status --short --untracked-files=all` is empty at the candidate SHA and again after this
report commit. `git diff --check` is clean. Untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`
reappeared twice during this stage from outside the session, with the same digests as every
previous occurrence (`96924946ca90…` and `d6d0c24446d9…`); both copies were hashed and moved to
`stage5/host-residue/2026-09-26-post-cli-commit/` and
`stage5/host-residue/2026-09-26-post-coverage-commit/`, never staged. Nothing else was added to
the repository: no tarball, no consumer, no cell log, no portable runtime and no evidence file
lives inside it — all of that is under `stage5/` outside the repository.

## REMAINING CLI LIMITATIONS

1. No permission-denied `--output` fixture; exit 4 is proved for a missing parent and a directory
   target only.
2. macOS is source-compatible but unqualified; `package-smoke` has never run there.
3. External Actions still cannot be executed end to end, so the bin contract is qualified by
   local cells rather than by the hosted matrix.
4. `--stdin` and a range are mutually exclusive but the CLI cannot read both even if a caller
   wants a combined report; that is the intended contract, not a bug.
5. The 8 MiB bound is a fixed constant, not a flag. Raising it is a design decision for a later
   stage.
6. Bounded, single-line error rendering covers the known CLI failure classes. A generic terminal
   sanitiser is deliberately absent — Stage 8 owns broad hostile-output hardening.
7. The parser is handwritten by design; `--format=json` is rejected rather than normalised, and
   `-f` is not an alias. Both are documented in `--help`.

## STAGE 5 DECISION

**PASS.** Every item the prompt required for PASS has executed evidence on the candidate SHA:
true two-endpoint range behaviour against real repositories, stdin UTF-8 chunk correctness with
raw byte counting, bounded stdin and Git collection, invalid arguments/refs/non-Git/shallow
handling, help and version, the stable five-code exit set across all three output formats,
`--output` semantics including adversarial names, the installed npm bin contract on Windows and
Linux, and Git execution through argument vectors only — the last proved both structurally and
behaviourally with a watched working directory. Ten gates pass in four clean-clone cells with one
deterministic CLI bundle digest and a clean tree afterwards.

## NEXT RECOMMENDED ROADMAP STAGE

**Stage 6 — GitHub Action.** Recommended, not started: this report ends at the Stage 5 boundary.

## CI OBSERVATION

Recorded after the push; this is the only observation made for Stage 5.

```text
push:                  4e5bd44..0e6cbce rescue/stage0-source -> rescue/stage0-source (fast-forward, non-forced)
run:                   36231520156
workflow:              CI
event / branch:        push / rescue/stage0-source
created:               2026-09-26T09:01:29Z    status: completed    conclusion: failure (4s total)
jobs:                  Node 22 / ubuntu-latest, Node 22 / windows-latest,
                       Node 24 / ubuntu-latest, Node 24 / windows-latest
steps per job:         0        startedAt-completedAt: 1-2 seconds each
```

All four matrix jobs were created and immediately failed with an empty `steps` array, so no
checkout, install, gate or test ever ran. This is the identical signature recorded for Stage 0
through Stage 4 (latest earlier run: `36218953127`): the account is not being given runners, so
the workflow cannot start. **EXTERNAL CI BLOCKED.** The failure is not attributable to DiffBeacon
and is not evidence about this stage's code.

No run was rerun, no workflow file was edited, no other branch was pushed to induce a different
result, and the four local clean-clone cells (PHASE 26) remain the only cross-platform
qualification evidence for Stage 5. Closing the external-CI gap is a Stage-9 (CI / package-release
qualification) responsibility, not something this stage worked around.
