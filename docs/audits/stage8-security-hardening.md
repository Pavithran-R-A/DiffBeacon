DIFFBEACON STAGE 8 — SECURITY HARDENING REPORT
==============================================

```text
STATUS:                  PASS (qualified on the local contracts measured in this pass, on a Windows
                         host with a real Chromium, across four clean-clone matrix cells — Windows
                         Node 24 and Node 22, Linux node:24 and node:22 — each running all ten gates
                         from scratch. One Windows Node 22 cell attempt is disclosed as a failed
                         browser-lane schedule and re-run to 10/10 in a fresh clone; see
                         QUALIFICATION MATRIX. No hosted Safari or macOS qualification. No security
                         verdict is made here: this report records the trust boundaries that were
                         attacked, the defects that were reproduced and repaired — five in the first
                         pass (R1–R5) and two in the closure pass (C-A, C-B, recorded under STAGE 8
                         CLOSURE below) — and the boundaries that were measured as already holding.

STARTING SHA:            74d79f948b5b3ecdf5299a9a06d93d07ec34bbd8  ('docs: close DiffBeacon Stage 7
                         browser audit' — the rescue/stage0-source tip at the start of Stage 8)
QUALIFIED PRODUCT SHA:   a5925547eb18ed742b269b73672130d34750c3a9  ('fix: harden DiffBeacon security
                         boundaries', parent = the STARTING SHA above; 28 files, +3,454/-51). Every
                         gate result, matrix cell, bundle digest and manifest count below is on this
                         tree: the cells clone this commit and the working-tree runs were made with
                         tracked content identical to it.
ENDING BRANCH SHA:       the commit this document is made in — 'docs: record DiffBeacon Stage 8
                         security qualification', made directly on top of the QUALIFIED PRODUCT SHA
                         above and pushed to rescue/stage0-source. It is named by subject and parent
                         rather than by hash: a commit cannot contain its own hash, and the single
                         hosted-CI observation below is kept in this stage's evidence directory rather
                         than in a further commit.
BRANCH:                  rescue/stage0-source
ORIGIN MAIN SHA:         e0ff98143bfe39c80c338518d006525a846a8739  (unchanged; not merged, not moved)
```

## What Stage 8 is

Stage 8 takes the already-qualified parser, CLI, Action and browser demo (Stages 2-7) and attacks
their remaining trust boundaries with hostile but bounded inputs, then repairs only what a reproduced
failure proves. It changes no product surface beyond the four files listed in DEFECTS FOUND, adds no
backend, no network use, no telemetry, no severity scoring, and no verdict language.

The governing premise is unchanged: a reviewed repository is **data**. DiffBeacon does not install,
execute, or import code from the repository it reviews, and no path in it asks a model what a diff
means.

Every number below came from a command run in this session; the evidence files live outside the
repository in `../stage8/` (working notes: `../stage8/notes-findings.md`).

## THREAT MODEL

The brief's PHASE 1 required a matrix over 17 trust domains with, for each, the attacker/control
source, trust status, existing control, existing tests, remaining plausible attack, whether a defect
was measured, and the repair. That matrix is recorded here because this document is its final home:
no earlier Stage 8 artifact contains it, and nothing in this pass should be read as claiming it was
delivered before.

| #   | Trust domain                      | Attacker / control source                                                                       | Trust                                                     | Control in place before Stage 8                                                                                                                                                                          | Tests                                                                                                                                               | Remaining plausible attack                                                                                                                                                                                                                | Measured defect                                                           | Repair                                                                                                                                                                                                                                |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Unified diff text                 | anything pasted into the demo, a diff file on disk, Git's own output                            | untrusted                                                 | line-at-a-time parser, published 8 MiB input bound, diagnostics instead of invented counts (Stage 2)                                                                                                     | `stage2.hostile-input`, `stage2.bounded-input`, `stage2.patch-dialects`, `stage8.hostile-corpus` (6), `stage8.numeric-edges` (7), `stage8.fuzz` (7) | an input that throws, hangs, or publishes a count the diff does not prove                                                                                                                                                                 | NO                                                                        | none                                                                                                                                                                                                                                  |
| 2   | Git revision / range argument     | workflow `with:` values, operator argv, a ref name that looks like an option                    | untrusted                                                 | pinned 12-flag vector + `--end-of-options`, argv-only start, `shell: false` (Stage 5/6)                                                                                                                  | `stage5.cli-adversarial-refs`, `stage6.action-security-boundary`, `stage8.git-boundary` (13)                                                        | an extra Git option smuggled through the range string                                                                                                                                                                                     | NO                                                                        | none — the `--src-prefix` control proved the pins load-bearing                                                                                                                                                                        |
| 3   | Repository-level Git config       | the reviewed repository's `.git/config`, `.gitattributes`                                       | untrusted                                                 | the pinned vector overrides the diff-affecting config (`--no-ext-diff`, `--no-textconv`, `--ignore-submodules=none`, `--submodule=short`, `--find-renames=50%`, `--unified=3`, `--diff-algorithm=myers`) | `stage8.git-boundary` external-diff trio, `stage8.no-target-execution` (5)                                                                          | `diff.external` or a textconv driver run while diffing                                                                                                                                                                                    | NO                                                                        | none — live sentinel controls show it runs under a plain `git diff` and never under the pin                                                                                                                                           |
| 4   | Ambient Git / process environment | the runner or operator environment, not the repository                                          | split — operator-owned for the CLI, shared for the Action | none, deliberately, for both callers (see GIT ENVIRONMENT)                                                                                                                                               | `stage8.git-boundary` ambient cases + `../stage8/probe-git-env.mjs`; after the closure pass, `stage8c.action-workspace-isolation` (17)              | redirection of `GIT_DIR` / `GIT_WORK_TREE` / `GIT_COMMON_DIR` / `GIT_OBJECT_DIRECTORY` / `GIT_ALTERNATE_OBJECT_DIRECTORIES`, or a repository-local `core.worktree`, moving which repository the Action diffs away from `GITHUB_WORKSPACE` | YES for the Action (C-A); NO for the CLI, measured and left unchanged     | Action-scoped only: `workspaceGitEnv()` for every Git process the Action starts. **CLI ambient Git policy remains operator-owned if left unchanged; the Action workspace policy is stricter.**                                        |
| 5   | Git output                        | Git itself, under a hostile repository (C-quoted paths, raw octets, mode lines, binary markers) | untrusted-but-structured                                  | `decodeGitQuoted` escape table, non-fatal UTF-8 decoding, streaming byte-capped collector                                                                                                                | `stage8.invalid-byte-paths` (10), `stage8.invalid-path-shapes` (7), `stage8.git-boundary` quotePath cases                                           | an undecodable octet producing a lone surrogate, a crash, or a rewritten name in the data                                                                                                                                                 | NO                                                                        | none — the non-fatal decoder is now pinned by two mutation controls                                                                                                                                                                   |
| 6   | Filename / path text              | the reviewed repository                                                                         | untrusted                                                 | display policy at paint time (added this stage); names are labels and are never opened                                                                                                                   | `stage8.hostile-corpus`, `stage8.browser-corpus` (30), `stage8.no-target-execution`, `stage8c.markdown-display-controls` (15)                       | a name that reorders or rewrites the trusted text around it                                                                                                                                                                               | YES                                                                       | R2 (terminal/CLI paint), R3 (browser paint), C-B (Markdown paint)                                                                                                                                                                     |
| 7   | Markdown output                   | a path or hunk text containing `\|`, backslash, markup, a heading marker, or a display control  | untrusted                                                 | code-span cell rendering (Stage 2/3 shapes); the shared display policy at the Markdown paint boundary (closure pass)                                                                                     | `stage8.markdown-security` (9), `stage8c.markdown-display-controls` (15)                                                                            | a path that splits a table row, opens a heading/section, or reorders the row it is reported in                                                                                                                                            | YES                                                                       | R1 (cell escaping), C-B (explicit-control paint)                                                                                                                                                                                      |
| 8   | Terminal output                   | ANSI/C1/bidi/zero-width text inside the diff                                                    | untrusted                                                 | none — `renderPretty` emitted name bytes verbatim before this stage                                                                                                                                      | `stage8.terminal-security` (12)                                                                                                                     | a name that changes cursor colour, scrolls the scrollback, or reorders the following trusted line                                                                                                                                         | YES                                                                       | R2                                                                                                                                                                                                                                    |
| 9   | JSON output                       | the same hostile text, consumed by a machine                                                    | untrusted                                                 | schema published by Stage 2-4; `displayPath` kept raw                                                                                                                                                    | `stage8.json-contract` (5), fuzz round-trip                                                                                                         | presentation hardening leaking into the data, or a non-finite count                                                                                                                                                                       | NO                                                                        | none — the policy is provably paint-only                                                                                                                                                                                              |
| 10  | Browser DOM                       | pasted diff text in the visitor's own tab                                                       | untrusted                                                 | React text children only; no markup sink; Stage 7 runtime injection proofs                                                                                                                               | `stage8.browser-bidi` (8), `stage8.browser-corpus` (30), `stage7.browser-security` (18, re-green)                                                   | a control sequence that visually reorders the page or escapes its box                                                                                                                                                                     | YES                                                                       | R3 (`paintedName`)                                                                                                                                                                                                                    |
| 11  | Action event JSON                 | `GITHUB_EVENT_PATH`, i.e. the runner-provided payload                                           | untrusted-in-shared-context                               | object-ID contract + required `pull_request` fields (Stage 6)                                                                                                                                            | `stage8.action-event-summary-paths` (10), `stage6.action-event`                                                                                     | a well-formed JSON value that is not the expected object                                                                                                                                                                                  | YES                                                                       | R5 (non-object rejection message)                                                                                                                                                                                                     |
| 12  | `GITHUB_WORKSPACE`                | the workflow that calls the Action                                                              | operator-controlled                                       | explicit workspace requirement, no implicit cwd search (Stage 6)                                                                                                                                         | `stage8.action-event-summary-paths`, `stage6.action-security-boundary`, `stage8c.action-workspace-isolation` (17)                                   | a path that is a file, missing, or space/UTF-8 bearing — and, until the closure pass, an ambient Git selector naming a different repository                                                                                               | NO for the path handling; the repository-identity half was the C-A defect | none needed for the path (every case fails closed with a stable message); C-A's `workspaceGitEnv()` makes the workspace authoritative over ambient Git identity, proven by that suite on Windows and re-run in the closure Linux cell |
| 13  | `GITHUB_STEP_SUMMARY`             | the report DiffBeacon itself generates                                                          | self-generated, platform-capped                           | append with no size check before this stage                                                                                                                                                              | `stage8.action-summary-bound` (4)                                                                                                                   | a large diff producing a summary over GitHub's documented 1,048,576-byte limit                                                                                                                                                            | YES                                                                       | R4 (fail-closed byte bound)                                                                                                                                                                                                           |
| 14  | CLI output path                   | the operator's `--output` argument                                                              | operator-owned                                            | single `writeFile` sink, no directory creation                                                                                                                                                           | `stage8.invalid-path-shapes`, `stage8.filesystem-boundary` (7)                                                                                      | traversal-looking segments or a reserved-looking basename                                                                                                                                                                                 | NO                                                                        | none — an intentional output path is honoured, a missing parent still exits 4                                                                                                                                                         |
| 15  | Package / build scripts           | the dependency tree and this repository's scripts                                               | semi-trusted                                              | npm-workspaces, pinned lockfile, `engine-strict=true`                                                                                                                                                    | `npm run package-smoke`, `npm run action-smoke`, `stage8.no-target-execution`                                                                       | a lifecycle script running while a target repository is reviewed                                                                                                                                                                          | NO                                                                        | none — measured zero sentinels, no `node_modules`, clean `git status`                                                                                                                                                                 |
| 16  | Dependencies                      | upstream packages reachable from the lockfile                                                   | semi-trusted                                              | zero runtime dependencies in all three published packages                                                                                                                                                | `npm audit --json` recorded in DEPENDENCY AUDIT                                                                                                     | an advisory that reaches a shipped artifact                                                                                                                                                                                               | NO (4 advisories, all build/test tooling)                                 | none in Stage 8; carried with evidence                                                                                                                                                                                                |
| 17  | GitHub workflow metadata          | `uses:` references and `permissions:` grants                                                    | supply chain                                              | all 3 `uses:` lines pinned to full commit SHAs; `permissions: contents: read` only                                                                                                                       | read and recorded in WORKFLOW SUPPLY CHAIN                                                                                                          | a mutable ref resolving to different code later                                                                                                                                                                                           | NO                                                                        | none — no pin churned; pin→tag _resolution_ left unverified (no network in this pass)                                                                                                                                                 |

"Do not call a hypothetical issue a defect until reproduced" was held: every YES row above has a RED
log and a falsification control named in DEFECTS FOUND, and every NO row was probed rather than
assumed.

## PRE-EXISTING CONTROLS (verified, not re-invented)

Confirmed on this tree by running the suites that pin them, not by reading them:

- 8 MiB input bound in the core parser and the CLI collector (Stage 2/5) — enforced in every Stage 8
  resource measurement.
- argv-only Git starts with `shell: false`, the pinned 12-flag vector and `--end-of-options`
  (Stage 5/6) — `stage8.git-boundary.test.ts` 13/13 green without changing the product.
- Hook, external-diff and install non-execution for the Action, with live control pairs (Stage 6):
  `tests/stage6.action-security-boundary.test.ts:274` (a real commit does fire `SENTINEL-pre-commit`),
  `:265` (an unprotected `git diff` does run the external diff), `:287`/`:303` (reviewing the
  booby-trapped repository leaves zero sentinels). No Stage 8 duplicate was added for these.
- Browser injection and privacy controls (Stage 7): zero network requests leaving the origin, zero
  storage use, no markup sink, 8 MiB pre-state input guard — all re-run green in this pass.
- Stable error messages and exit-code contract (Stage 5), the object-ID event contract (Stage 6),
  deterministic ordering (Stage 4), the manifest/verify gate (Stage 1).

## DEFECTS FOUND

Seven defects were reproduced across the two Stage 8 passes. The five the first pass found are R1–R5
below; the two the closure pass found are recorded as C-A (Action workspace isolation) and C-B
(Markdown display controls) in the closure section at the end of this document, which is their final
home. Each entry gives the input, the behavior before the repair, the
security-contract consequence, the RED proof, the repair, the GREEN proof, and the falsification
control that shows the new test would notice the repair disappearing.

### R1 — a pipe-bearing path could split a Markdown table row

- Input: a repository path containing `|`, e.g. `src/a|b.ts`, plus the pipe/backslash variants in the
  shared hostile corpus.
- Before: `renderMarkdown` interpolated `file.displayPath` straight into the Changed-files row
  (`packages/core/src/render.ts:149` builds `| status | path | additions | deletions | surfaces |`), so
  a pipe inside a repository path became a cell separator.
- Consequence: the repository controls the cell structure of a report a human reads — a name can
  shift the columns it is reported under, and a `#` or markup fragment in a path can present as
  structure rather than as data.
- RED: `../stage8/red-markdown-structure.log` — 6 failed cases in `stage8.markdown-security.test.ts`,
  including "keeps the Changed-files row at five cells when a path contains a pipe" and "keeps every
  table rectangular across the whole hostile corpus".
- Repair: `markdownTableCellCode()` (`packages/core/src/render.ts:51-54`) — every `|` in the cell is
  escaped, and the path is placed inside a code span so markup and heading markers stay text. A
  backslash is doubled **only when the cell contains a pipe**, because otherwise the escape that
  protects the pipe would itself consume the preceding backslash and change what the name reads as
  (the GFM rule the test cites, Example 200). The name stays one cell and still reads exactly.
- GREEN: `../stage8/green-markdown-structure.log`; the file is 9/9, and the whole source suite stayed
  green after the repair (`../stage8/source-suite-after-markdown-repair.log`).
- Falsification control: `../stage8/control-markdown-pipe-only-repair.log` — with only the
  conditional backslash doubling removed, exactly one case fails ("gives every pipe-bearing path exactly
  one Changed-files cell", 1 failed | 8 passed), because a name holding `\|` renders so that the
  backslash consumes the escape and the pipe becomes a real cell boundary under one of the readings the
  test tries. That is the proof the doubling is load-bearing, not decoration.
- Also pinned permanently (found while writing this case): "leaves no pipe that either escape reading
  could read as a cell boundary" — the test evaluates the row under both readings, not just one.

### R2 — display controls reached the terminal and the CLI message surface unmodified

- Input: names and hunk text carrying C1 controls (U+0080-U+009F), bidi formatting controls
  (U+202A-U+202E, U+2066-U+2069, U+061C), line separators (U+2028/U+2029), and the 0x00-0x1F range
  that a quoted Git header can decode (`\a \b \f \v \t \n \r`).
- Before: `renderPretty` and the CLI error/echo path wrote the bytes through, so a repository name
  could emit an escape sequence the terminal then acted on, or fold a message across several lines.
- Consequence: terminal-side injection into the operator's own session, and a report that could
  reorder the trusted text around a name (a bidirectional override makes `src/b.ts` display as
  `src/s.ts`-looking text).
- RED: `../stage8/red-terminal-controls.log` — 11 failed cases in `stage8.terminal-security.test.ts`
  (12 total; e.g. "never lets a name carry a sequence a terminal would execute", "quotes a C1 control
  so it cannot reach a terminal raw").
- Repair: `packages/core/src/display.ts` — `neutralizeDisplayControls(value, marker)` with three
  measured classes: REORDERING controls removed, LINE_SHAPING controls collapsed to one space,
  EXECUTABLE controls replaced by the surface's own marker (U+FFFD in the renderers, a space in CLI
  messages). Applied in `render.ts` (`terminalText`) and in `packages/cli/src/errors.ts`
  (`echo` / `boundedSingleLine`).
- GREEN: `../stage8/green-terminal-controls.log` (12/12) and the source suite after the repair
  (`../stage8/source-suite-after-terminal-repair.log`).
- Falsification controls: `control-terminal-bidi-mutation.log` and `control-terminal-c1-mutation.log`
  (each class independently load-bearing), `control-terminal-overbroad-mutation.log` (an over-broad
  variant that also strips ordinary RTL and zero-width joiners is refused by the suite), and
  `control-fuzz-terminal-neutralizer-removed.log` (identity `terminalText` fails exactly the
  fuzz terminal-output invariant).
- Deliberate non-repair: confusables, homoglyphs, ordinary RTL text and U+200B-U+200D are left alone.
  Stripping them would rewrite ordinary Persian/Arabic/Indic filenames, which is a display guess, not
  a control-character fact — and the brief forbids per-script confusable detection.

### R3 — the browser painted hostile names with their control characters intact

- Input: the same classes as R2, in a report rendered in the visitor's Chromium tab.
- Before: `client/src/pages/Home.tsx` put the raw name into the `<code>` children of `.file-pile` and
  `.ledger-item__paths`. React prevents markup injection, but a bidi override is not markup: it
  reorders the glyphs the visitor reads.
- Consequence: the page can show a path in an order the repository did not spell, which is exactly the
  trust the demo asks of a visitor deciding what to review.
- RED: `../stage8/red-browser-bidi.log` — 4 failed cases in `stage8.browser-bidi.test.ts`
  ("paints a bidi override name in the order the repository spelled it", "paints an 8-bit control as a
  marked gap that cannot reach the wire", …).
- Repair: `paintedName()` in `client/src/pages/Home.tsx`, which applies the same shared policy with the
  U+FFFD marker, used for both name surfaces.
- GREEN: `../stage8/green-browser-bidi.log` (8 cases) and `../stage8/green-browser-corpus.log`
  (29/29 in 159.63 s), plus the Phase 24 geometry case that grew the corpus file to 30 cases
  (`green-browser-corpus-phase24.log`, 30/30 in 250.02 s) — all in real Chromium.
- Falsification controls: `control-browser-paint-removed.log` and
  `control-browser-corpus-paint-removed.log` — with `paintedName` mutated to paint the raw name, 23 of
  the 24 per-entry corpus cases fail. `control-browser-overbroad-mutation.log` shows the over-broad
  variant is refused. Two truths are disclosed rather than smoothed: the 5 corpus-wide invariants
  survive that mutation (they are breadth/no-crash/no-network/no-XHR/clipboard checks, and no
  control-bearing name ranks into a painted slice when the whole corpus is in one report), and corpus
  entry 24 is two-sided (it asserts a U+200B-U+200D name is painted verbatim), so it cannot detect the
  mutation. Neither is counted as one of the 23.
- No component, class, or style token was changed: `control-css-containment-removed.log` proves the
  existing `overflow: hidden; text-overflow: ellipsis;` declarations are what keep an 800-character
  control-bearing name inside its box, and deleting them fails exactly the geometry case. The repair
  needed no layout redesign.

### R4 — the Action appended to `GITHUB_STEP_SUMMARY` with no size bound

- Input: a large but in-bounds diff. Reachability measured inside a permanent test: 30,000 changed
  files, 4,703,340 diff bytes (under the 8 MiB input bound) render to **1,958,803** summary bytes
  against GitHub's documented **1,048,576** byte limit.
- Before: `writeSummary` appended unconditionally. The platform record matters here, so it is stated
  precisely: GitHub gives each **step summary** 1 MiB, and passing that limit makes the upload of
  that step's summary fail and raises an error annotation — it does **not** by itself change the
  status of the step or the job. The unbounded append therefore could not corrupt a write midway;
  what it could do was let DiffBeacon finish successfully while GitHub later refused to publish the
  report the Action had just written.
- Consequence: a review artifact the Action believed it had delivered, with the job still green and
  no DiffBeacon message to explain the missing summary — the one output the Action owns. The guard
  moves that failure into the Action, where it names its own arithmetic instead of leaving it in a
  platform annotation beside an unrelated green check.
- RED: `../stage8/red-summary-bound.log` — 2 failed cases ("takes the summary up to the exact limit
  and no further", "names the arithmetic it used instead of truncating silently").
- Repair: `MAX_STEP_SUMMARY_BYTES = 1 * 1024 * 1024` with `summaryBytesBefore()` (`statSync`) — the
  addition's UTF-8 bytes plus the pre-existing file size are checked before appending, and the Action
  throws instead of writing. Refusal writes nothing partial.
- GREEN: `../stage8/green-summary-bound.log` (4/4). At the exact limit the write succeeds; one byte
  past it, it fails with the measured numbers in the message.
- Falsification controls: `control-summary-limit-raised.log` (raising the constant fails the bound
  cases) and `control-summary-ignore-existing.log` (forgetting the pre-existing bytes fails the
  append-to-a-non-empty-summary case).
- `partialSummary=false` is also what `npm run action-smoke` now reports, so the bound is exercised by
  the repository's own smoke gate, not only by the suite.

### R5 — a well-formed JSON `null` event leaked the engine's own error text

- Input: `GITHUB_EVENT_PATH` containing `null` (valid JSON, not an object).
- Before: the bundle dereferenced the parsed value and the message became the engine's
  "Cannot read properties of null …" text.
- Consequence: an operator sees an internal property-access message instead of a DiffBeacon contract
  statement, and the failure mode depends on which engine construct happened to be first.
- RED: `../stage8/red-action-event-null.log` — 1 failed case ("answers a JSON null event with a
  DiffBeacon message, not the engine property-access error").
- Repair: reject a non-object event in `packages/action/src/index.ts` with a message naming
  `GITHUB_EVENT_PATH` and the two fields the Action reads from it (`pull_request.base.sha`,
  `pull_request.head.sha`).
- GREEN: `../stage8/green-action-event-null.log`; the whole file is 10/10
  (`stage8.action-event-summary-paths.test.ts`), each case asserting a stable message, empty stdout,
  and no engine text or errno token in stderr.
- Falsification control: `control-event-null-guard.log` — removing the guard reproduces the engine
  text and fails the case.

## MARKDOWN

`stage8.markdown-security.test.ts` — 9 cases (6 structural, 3 presentation), GREEN after R1:

- a pipe-bearing path keeps the Changed-files row at five cells and gets exactly one cell;
- the full text stays inside its own cell (no split-on-unescaped-pipe hole);
- tables stay rectangular across the whole hostile corpus and one row is emitted per file for a whole
  diff;
- a path cannot open a heading or a section;
- markup, links and images in name text stay inside code spans;
- JSON keeps the raw path while Markdown shows one cell (the data/presentation split is asserted, not
  assumed).

Measured shape worth recording: a hostile name can legitimately appear on two Markdown lines (the
Changed-files row and an evidence `Observed in:` line), and the invalid-byte test pins that exact
structure — two lines, both code spans — rather than assuming one.

Closure-pass note: C-B made `renderMarkdown` apply the shared display policy at its paint boundary, so
this file's `presented()` helper now derives the expected text from the policy statement rather than
from the raw name. Its 9 cases, their structure, and their assertions are unchanged — no case was
deleted, relaxed, or skipped — and the change is disclosed here because it alters what one
previous-stage helper expects. `../stage8c/green-B-restored.log` records this file at 9/9 on the
closure tree.

## TERMINAL

`stage8.terminal-security.test.ts` — 12 cases. Coverage: no C1, separator, or bidi formatting control
reaches a rendered line for any hostile name; no name carries a sequence a terminal would execute; a
name cannot reorder the trusted text around it; the CLI message surface stays one bounded line,
including when it quotes a C1 control, a bidi control, a line separator, or collapses multi-line
process output; and the JSON report stays factual where the presentation layer neutralises.

Asserted per line, not per render: `/\p{Cc}/u` also matches the newlines that separate lines, so a
whole-string check would be a false green. That detail cost one RED run to find.

## JSON

`stage8.json-contract.test.ts` — 5 cases: raw-fact preservation for every hostile name, round-trip of
object-shape names without editing them, the schema version published by the previous stages
(`schemaVersion` is still the literal `'1'`, `packages/core/src/analyze.ts:362`), the surface
vocabulary, and the prototype canaries (see next section). `renderJson` and the browser clipboard
export emit the corpus byte-for-byte; the Phase 23 clipboard case asserts `JSON.parse(written)` equals
`analyzeDiff(corpus)` and that an ESC byte survives as `\u001b`. No Stage 8 repair rewrote a canonical
path, renamed a field, changed an exit code, or added a severity, score, or verdict to any report
field.

## PROTOTYPE POLLUTION

Canaries on `Object.prototype`, `Array.prototype` and `String.prototype` are installed around a
whole-corpus analysis and asserted untouched (`stage8.json-contract.test.ts`), and an owned `__proto__`
key parsed from an event-shaped payload stays a data key rather than entering the prototype chain. No
product change was needed: the parser builds plain objects from named fields and never merges attacker
keys into a shared object.

## PATH TRAVERSAL

- Display data: `../` and `%2e%2e%2f`-shaped names, Windows-invalid names, and pipe-bearing names all
  stay names. `stage8.invalid-path-shapes.test.ts` (7 cases) measures 15 device-like, trailing-dot and
  trailing-space names arriving as one file each with zero diagnostics and one Markdown row per name.
- Filesystem boundary: report names are never opened. A sandbox snapshot after running the CLI over
  all 15 Windows-invalid names was completely empty — that is the whole side-effect inventory for the
  class.
- The one write sink: `--output <dir>/NUL` really creates a regular file named `NUL` on Windows (Node's
  write API addresses the path rather than the device namespace) and the CLI honours the operator's
  target verbatim; `--output missing/nested/report.json` exits 4 and creates nothing. No product change:
  on POSIX `NUL` and `CON.ts` are ordinary filenames, so refusing them would encode a guess about the
  platform the report travels through instead of a property of a diff.
- Controls: making the CLI create parent directories and re-extend a reserved basename fails exactly the
  two matching cases (`control-shapes-mutation.log`); removing both header trims fails the two
  name-fidelity cases and leaves the other 5 green (`control-shapes-trim-preserved.log`).
- Recorded exception: `src/trailing-space ` is reported as `src/trailing-space`, traced to the trim in
  `decodeGitQuoted` (`packages/core/src/parser.ts:28`), which exists to recognise Git's C-quoted header
  form. Pinned as measured, not "fixed" — the name is a label that is never opened, so the worst case is
  two distinct names shown with one spelling. The first control attempt was a false negative worth
  recording: `stripDiffPrefix` and `decodeGitQuoted` each trim, so neutralising either alone changed
  nothing and the control had to disable both.

## GIT PROCESS

`stage8.git-boundary.test.ts` — 13 cases, no product change. Every Git start in shipped code is an
argv vector with `shell: false`; the range is placed after the pinned flags with `--end-of-options`
before the path separator. Refs that look like options, ranges with embedded spaces, and
`-`-prefixed names were probed through the existing Stage 5/6 suites and this file.
Falsification: dropping `--no-ext-diff` from the vector (`control-no-ext-diff-removed.log`) and
dropping the pinned prefixes (`control-src-prefix-removed.log`, failing exactly the four
prefix-dependent cases) both make the suite fail, so the pin is proven load-bearing rather than
decorative. Both bundles still contain all 12 flags verbatim after minification (see CLI / ACTION
BUNDLE).

## GIT ENVIRONMENT

Variables tested, with the result of each. "Neutralised" is split by caller because the two callers
have different owners: the CLI inherits the operator's environment, while the Action pins
`GITHUB_WORKSPACE` and therefore cannot treat the environment as trusted input (see C-A in the
closure section).

| Variable                                           | Measured effect                                                           | Neutralised by DiffBeacon?                                                                                                                                | Rationale                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GIT_DIR`                                          | selects the repository Git reads (`../stage8/probe-git-env.mjs` / `.log`) | CLI: NO (inherited, disposition recorded) — Action: YES, removed from the child environment                                                               | measured on Windows Git 2.55.0 and Linux Git 2.39.5; outranking it with a pinned work tree was not enough, because `GIT_DIR` pointing at another repository still won on Linux, so it is removed rather than overridden. |
| `GIT_WORK_TREE`                                    | selects the work tree                                                     | CLI: NO (inherited) — Action: YES, assigned the workspace value                                                                                           | an assigned value outranks the inherited one and a repository-local `core.worktree`, which no denylist can reach.                                                                                                        |
| `GIT_COMMON_DIR`                                   | redirects the common repository directory                                 | CLI: NO (inherited) — Action: YES, removed                                                                                                                | measured as a redirector.                                                                                                                                                                                                |
| `GIT_OBJECT_DIRECTORY`                             | selects the object store Git reads                                        | CLI: NO (inherited) — Action: YES, removed                                                                                                                | measured as a redirector.                                                                                                                                                                                                |
| `GIT_ALTERNATE_OBJECT_DIRECTORIES`                 | adds object stores Git may read                                           | CLI: NO (inherited) — Action: YES, removed                                                                                                                | measured: a range the workspace does not hold becomes reachable through it.                                                                                                                                              |
| `GIT_INDEX_FILE`                                   | no effect on a commit-to-commit range diff                                | NO, for both callers                                                                                                                                      | deliberately kept — a range consults no index, so removing it would be a guess about a name, not a control.                                                                                                              |
| `GIT_NAMESPACE`                                    | no effect on the Action's range, which names full object IDs              | NO, for both callers                                                                                                                                      | deliberately kept, for the same reason (Stage 6 accepts only full object IDs).                                                                                                                                           |
| repository-local `core.worktree`                   | moves `rev-parse --show-toplevel`                                         | CLI: not applicable to the diff's bytes — Action: YES, outranked by the pinned `GIT_WORK_TREE`                                                            | measured; this is the channel an environment denylist cannot close.                                                                                                                                                      |
| `GIT_EXTERNAL_DIFF`                                | would run an external diff program                                        | YES for both — the pinned `--no-ext-diff` makes it inert; the same fixture does run it unprotected                                                        | measured, and the control proves the non-vacuity                                                                                                                                                                         |
| `GIT_CONFIG_COUNT` + `GIT_CONFIG_KEY_n`/`_VALUE_n` | injects config such as `diff.external` or `core.worktree`                 | YES for both — `diff.external` blocked by the pin, proven against a live unprotected run; an injected `core.worktree` measured not to move the range diff | measured                                                                                                                                                                                                                 |
| pager-related variables                            | no live control reproducible on this host                                 | not claimed                                                                                                                                               | recorded as not-proven rather than as a verified defence                                                                                                                                                                 |

No "wipe the environment" change was made and no ambient variable is blindly cleared — the brief's
constraint against an environment-wide wipe is held, the Action's policy is the measured set rather
than a `GIT_`-prefix denylist, and the disposition is documented in
`docs/architecture/security.md`.

## GIT CONFIG

- `diff.external` from repository config: ignored under the pinned vector, executed under a plain
  `git diff` on the same fixture (live sentinel pair).
- `.gitattributes` textconv driver: ignored by `--no-textconv`; the fixture that carries it is the same
  one used for the CLI non-execution suite.
- Hooks: a real `git commit` in the fixture does fire `SENTINEL-pre-commit`; reviewing the repository
  leaves zero sentinels (Stage 6 permanent cases, `tests/stage6.action-security-boundary.test.ts:265`,
  `:274`, `:287`, `:303`).
- `core.quotepath` true and false both parse to `src/anom-ünïcode-日本.ts`.
- Submodules: `--ignore-submodules=none --submodule=short` are pinned; Stage 2's submodule-dialect
  coverage still applies unchanged.

## INVALID BYTE FILENAMES

- Executed: **YES**, on Linux (container, git 2.39.5) — and the decoder half executed **YES** on
  Windows.
- The split is deliberate: no Windows filesystem here can hold a filename whose bytes are not valid
  UTF-8, so only the patch-text half can be proven on this host, and the real-Git half is honestly
  skipped on Windows with the reason printed by the suite itself
  (`Tests 8 passed | 2 skipped (10)`, `../stage8/bytes-run-3.log`).
- Decoder half (every platform): `"\377"` in a quoted header decodes to one U+FFFD and never a lone
  surrogate half, with **zero** parse diagnostics; `src/bad\377name.ts` → `src/bad<U+FFFD>name.ts`;
  a mixed name keeps every decodable byte and replaces only the bad octet
  (`"src/caf\303\251\377.ts"` → `src/café<U+FFFD>.ts`); the escape text is never displayed as the name
  in the path, the pretty render, or the Markdown; both arrival paths (quoted and pre-decoded) agree;
  and each C-style escape a quoted header can carry decodes to the byte C names it — `\t \n \r \ \"`
  and `\a \b \f \v` → 0x09 0x0A 0x0D 0x5C 0x22 0x07 0x08 0x0C 0x0B, plus `\101` → `A`. Two of those
  were facts the first run caught rather than assumptions: a decoded `\a` really is U+0007 in the
  name, and `renderPretty` turns it into a space where a terminal would otherwise act on it.
- Real-Git half (Linux cell, `../stage8/run-linux-bytes.sh`, log `../stage8/linux-bytes-run.log`): a
  file whose name carries a raw 0xFF octet was committed through a `Buffer` path so the hostile bytes
  never entered an argv vector; through this repository's own `collectGitDiffAsync`. Under default
  `core.quotePath` git emits the quoted escape (raw octet absent); under `core.quotePath=false` the raw
  byte reaches the reader. Both through the product: one file, `summary.diagnostics === 0`, U+FFFD in
  the name, no surrogate half, no control character on any rendered pretty line. Result 10 passed (10),
  exit 0.
- **No product repair was needed.** The non-fatal `new TextDecoder().decode(...)` at
  `packages/core/src/parser.ts:65` is what makes this safe, and it is now pinned by controls:
  A — making it fatal throws `TypeError: The encoded data was not valid for encoding utf-8` and fails
  5 cases (5 failed | 3 passed | 2 skipped, `bytes-mutation-A.log`); B — loosening the octal
  regex `{3}` → `{2}` returns the literal escape text as the name (5 failed,
  `bytes-mutation-B.log`). After both, `packages/core/src/parser.ts` was restored from a
  byte-identical backup, `diff` reported no difference, and the suite was green again.

## RESOURCE BOUNDS

Measured with a temporary probe (`tests/stage8.probe-resources.test.ts`) that was deliberately **not**
kept in the suite because it costs 194 s per run; numbers from
`../stage8/probe-parser-resources.log`:

- file-count growth: 100 files → 45,088 output bytes; 1,000 → 446,493; 5,000 → 2,254,493 — linear,
  consistent with a line-at-a-time parser.
- one 1,000,000-character content line parses in about 1 ms and reports one addition: no per-character
  blow-up.
- diagnostics: 100 → 4,245 pretty bytes; 10,000 → 360,659 — about 36 bytes each, linear.
- at the published bound: 8,388,608 bytes → 65,536 file blocks in 18.0 s with 28,443,782 bytes of JSON;
  58,254 diagnostic blocks in 21.4 s with 24,933,874 bytes of JSON.
- memory: observed through the run as bounded streaming and block counts; the parser holds the file
  blocks it publishes, and nothing in the measurement produced a super-linear or hanging path.
- **No millisecond SLA was invented and no smaller product limit was introduced.** The bound that
  exists is the 8 MiB input bound already enforced since Stage 2; the byte counts above are recorded as
  the measured cost of a worst case so a future operator can see what 8 MiB actually buys.
- No public count can be `NaN` or `Infinity`: the fuzz invariants assert only finite numbers in the
  JSON and each count null or a whole non-negative number, with a null only on a binary or mode-only
  file (`stage8.numeric-edges.test.ts` 7 cases pin the header-edge versions of the same rule).

## ACTION SUMMARY

- Platform limit: 1,048,576 bytes, which GitHub documents for **each step's summary**. Passing it
  fails that step's summary upload and produces an error annotation; it does not itself change the
  step's or the job's status, which is why the Action checks the bound rather than trusting the
  platform to report one.
- Maximum generated summary measured: **1,958,803 bytes** from 30,000 changed files / 4,703,340 diff
  bytes — inside the input bound, above the platform bound, so the boundary is reachable rather than
  theoretical.
- Bound added: **YES** — `MAX_STEP_SUMMARY_BYTES = 1 * 1024 * 1024`, checked as
  `existing bytes + new bytes` before the append.
- Exact-limit behavior: a write that reaches the limit exactly succeeds; one byte more throws and
  writes **nothing** (no partial summary), with the arithmetic named in the message.

## OUTPUT AMPLIFICATION

Pretty, Markdown and JSON amplification at the 8 MiB bound is quantified in RESOURCE BOUNDS (roughly
25-28 MB of JSON from a maximal 8 MiB diff, ≈linear in file and diagnostic count). Stage 8 changed no
cap: the honest statement is that the input bound is the control and the output cost of using it
fully is now measured and recorded.

## EVENT FILE

Decision: **no DiffBeacon-specific event-file size cap is imposed.** `MAX_DIFF_BYTES` bounds the diff
the Action collects, not the event file it reads, and no smaller event limit was invented (the
record was corrected in the Stage 8 closure because an earlier sentence here described the event as
held to "the same 8 MiB input discipline", which is not what the code does). What the Action applies
is shape: the parsed event must be an object carrying `pull_request.base.sha` and
`pull_request.head.sha`, each a full commit object ID. Measured, inside a permanent test
(`stage8.action-event-summary-paths.test.ts`): an event fixture carrying approximately 8 MiB of extra
JSON alongside those fields is accepted and the review completes. Arrays, strings,
numbers, booleans, `null`, a 100,000-deep nesting (rejected on the object-ID contract), an unreadable
event path, a missing summary parent, a summary path that is a directory or runs through a file, and a
path containing spaces and `café` were each measured to fail closed with a stable message, empty stdout,
and no engine text or errno token leaking.

## SECRETS

`../stage8/scan-secrets.mjs` (one read per path; reports names and counts, never a value). Run on the
qualified SHA: **168 tracked paths, 167 scanned as text, 1 skipped as binary**
(`.bootstrap2/payload.tar.xz`, the Stage 0 quarantine archive) — `../stage8/scan-secrets-final.log`.
The same scan at the starting SHA covered 151 paths (168 − the 17 new Stage 8 files) and found the same
single hit, so no Stage 8 file introduced anything the scan flags.
Patterns: AWS key id, GitHub/npm/Slack tokens, private-key blocks, quoted credential
assignments, registry auth lines, long base64-looking key/token assignments.

Result: **1 hit**, and it is a canary — an `AKIA…`-shaped string inside
`tests/stage7.browser-security.test.ts:142` that the Stage 7 test uses to assert nothing leaves the
page. Zero hits in the committed Action and CLI bundles. `.npmrc` holds no registry auth line (only
`engine-strict=true`, `fund=false`, `audit=false`). No secret value was printed at any point.

## DEPENDENCY AUDIT

`npm audit --json` against the tracked `package-lock.json` — run read-only. **No `npm audit fix`, no
`--force`, no tree churn.** 266 dependencies in the tree; 4 advisories
(`../stage8/npm-audit.json`):

| Package          | Version audited       | Severity | Advisory                                                                                                | Reaches a shipped artifact?                                                                     | Fix available                                                          | Disposition                                                                                                                                                                                                     |
| ---------------- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest`         | 4.1.10 (lockfile pin) | moderate | Path traversal / arbitrary file read via `@vitest/mocker` redirect mock; affected 2.1.0-beta.1 - 4.1.10 | NO — test runner only; all three published packages declare `dependencies: {}`                  | yes (4.1.11)                                                           | Carried to Stage 9: the working tree already resolves 4.1.11 through its pnpm-layout `node_modules`, while the tracked npm lockfile still pins 4.1.10. Refreshing the lockfile needs its own qualification run. |
| `@vitest/mocker` | 4.1.10                | moderate | same advisory, range 2.1.0 - 4.1.10                                                                     | NO — transitive of the test runner                                                              | yes                                                                    | Same as above.                                                                                                                                                                                                  |
| `js-yaml`        | 4.3.1                 | high     | `maxTotalMergeKeys` does not limit CPU for empty merge sources; range 4.0.0 - 4.3.1                     | NO — transitive of `@eslint/eslintrc`, dev-only                                                 | yes (4.3.2, which the working tree already resolves for a second copy) | Carried to Stage 9.                                                                                                                                                                                             |
| `esbuild`        | 0.27.7                | low      | Arbitrary file read from the **development server on Windows**; range 0.27.3 - 0.28.0                   | NO — build-time tool for the demo site; DiffBeacon never ships, starts, or exposes a dev server | yes (0.28.2+, a Vite-coupled bump)                                     | Carried to Stage 9 as a dependency-tree decision, not a Stage 8 product change.                                                                                                                                 |

No advisory reaches a shipped artifact, and no fix was applied merely to reach "0 audit warnings" —
which the brief forbids, and which would have invalidated the qualification this report rests on.

Related supply-chain facts, measured rather than assumed:

- `npm ci` in a clean container printed npm 11.19.0's install-script notice for exactly one package,
  `esbuild@0.27.7`, whose `postinstall` is not covered by an allowlist; the repository has no
  `allowScripts` entry. The install completed (216 packages) with that script unrun. Recorded for the
  auditor as a property of the current tree, not a Stage 8 defect.
- No pin was bumped "because a newer tag exists".

## WORKFLOW SUPPLY CHAIN

- `.github/workflows/` contains `ci.yml` and `pages.yml`. All 3 `uses:` lines are full 40-character
  commit SHAs with the human-readable version as a trailing comment
  (`actions/checkout@3d3c42e5…` v7 twice, `actions/setup-node@82076278…` v7,
  `actions/upload-pages-artifact@fc324d35…` v5). Zero tag- or branch-form references, so nothing here
  resolves through a mutable ref.
- Permissions: `ci.yml:12` and `pages.yml:6` each carry exactly `permissions: contents: read`. Neither
  workflow references `secrets.*`, `GITHUB_TOKEN`, or a deploy key. `pages.yml` is
  `workflow_dispatch`-only with one job (build + upload artifact) and holds no `pages: write` or
  `id-token: write` grant.
- No workflow in this repository consumes the DiffBeacon Action, matching `README.md:100-131`:
  `uses: ./` is trusted-development-only and the consumer form is a reviewed full SHA that Stage 11 must
  publish first.
- Disclosed limitation of this repository's own CI: `ci.yml` triggers on `pull_request` and runs
  `npm ci` against the checked-out merge-commit manifest, so a fork pull request can cause dependency
  lifecycle scripts of its own modified `package.json` to run on a hosted runner. That is the ordinary
  Node-CI boundary, not a DiffBeacon product path: the Action installs nothing, runs no lifecycle
  script, and cannot be pointed at a tree it does not read with `git diff`.
- Not verified here: pin→tag _resolution_. Confirming that a SHA really is the tagged release needs a
  network lookup that is out of bounds for a local qualification pass, so it is recorded as unproven.

## DANGEROUS API SCAN

Across `packages/core/src`, `packages/cli/src`, `packages/action/src` and `client/src` (.ts/.tsx):
zero occurrences of `eval(`, `new Function(`, `execSync(`, `shell: true`, `innerHTML`, `outerHTML`,
`insertAdjacentHTML`, `document.write`, `dangerouslySetInnerHTML`, `document.cookie`, `sendBeacon`,
`localStorage`, `indexedDB`. The only process starts are `execFileSync` and one async `spawn` of `git`
in `packages/cli/src/git.ts`, both `shell: false`. The only write sinks in shipped code are
`appendFileSync` to `GITHUB_STEP_SUMMARY` and `writeFile` to an explicit `--output`.

Guarded permanently by `stage8.filesystem-boundary.test.ts` (7 cases), whose inventory covers 18 source
files in those four directories. Control: injecting `eval("x")` as a comment in
`packages/core/src/render.ts` fails exactly the new case and leaves the older core/client guards green
(`control-static-sink-scan.log`, exit 1). Two shared substrings are named rather than matched:
`exec(` appears in shipped source as `RegExp.prototype.exec` (`packages/core/src/parser.ts:165`) and
`spawn(` as the pinned Git start, so the guard checks `execSync(` and `shell: true` instead of a
substring that would produce permanent false positives.

## FUZZ

`stage8.fuzz.test.ts` — SEED `0x5eed1a11`, **1,500** mutated inputs built from 9 seed diffs and 14
fragments through 6 mutation kinds; 7 invariant cases, GREEN in 31.3 s (`green-fuzz.log`).

Properties asserted: the parser never throws; the JSON contains only finite numbers and no `Infinity`
or `NaN` text; every count is null or a whole non-negative number; a null count appears only on a
binary or mode-only file; no control character appears in any rendered terminal line; the analysis is
deterministic across 300 inputs; and JSON round-trips. One assertion was wrong before the first run
(it demanded a non-null integer where the model publishes `additions: number | null`,
`packages/core/src/model.ts:47`) and was corrected to the contract, not to the output. Control: making
`terminalText` the identity fails exactly the terminal-output invariant
(`control-fuzz-terminal-neutralizer-removed.log`, exit 1).

A fuzz corpus is not an absence proof; see REMAINING SECURITY LIMITATIONS.

## TESTS

- Starting count (Stage 7 tip `74d79f9`): **42 files / 839 tests**.
- Final Windows count (clean clone of `a592554`, node v24.21.0, git 2.55.0.windows.5):
  **57 files / 977 passed | 2 skipped (979)**, exit 0 — 495.90 s in the cell, 653.66 s on the working
  tree (`../stage8/cells/win-node24/logs/test.txt`, `../stage8/final-tree-full-suite.log`).
- Final Linux count (clean clones of `a592554`, git 2.39.5, no Chromium on the image):
  **51 files passed | 6 skipped (57)**, **846 passed | 133 skipped (979)**, exit 0 in both containers
  (15.39 s on `node:24`, 12.58 s on `node:22`). The 133 are the 132 browser cases plus the 1
  pre-existing `runIf(win32)` release case; the 2 Windows skips are the real-Git filename cases, which
  run on Linux instead — see QUALIFICATION MATRIX, where the arithmetic closes in both directions.
- Both skips are named by the suites themselves at run time — `stage8.invalid-byte-paths` prints why
  its real-Git half cannot run on this host, and each browser file prints the harness's
  "no Chromium-class browser engine is installed on this host" reason. Neither is a silent skip.
- Stage 8 added 15 suites, 140 cases, all named `tests/stage8.*.test.ts` except the shared corpus
  module:

| file                                                              | cases                     |
| ----------------------------------------------------------------- | ------------------------- |
| `stage8.hostile-corpus.test.ts` (over `stage8.hostile-corpus.ts`) | 6                         |
| `stage8.terminal-security.test.ts`                                | 12                        |
| `stage8.markdown-security.test.ts`                                | 9                         |
| `stage8.json-contract.test.ts`                                    | 5                         |
| `stage8.git-boundary.test.ts`                                     | 13                        |
| `stage8.numeric-edges.test.ts`                                    | 7                         |
| `stage8.invalid-path-shapes.test.ts`                              | 7                         |
| `stage8.action-event-summary-paths.test.ts`                       | 10                        |
| `stage8.action-summary-bound.test.ts`                             | 4                         |
| `stage8.no-target-execution.test.ts`                              | 5                         |
| `stage8.filesystem-boundary.test.ts`                              | 7                         |
| `stage8.fuzz.test.ts`                                             | 7                         |
| `stage8.invalid-byte-paths.test.ts`                               | 10 (2 skipped on Windows) |
| `stage8.browser-corpus.test.ts`                                   | 30                        |
| `stage8.browser-bidi.test.ts`                                     | 8                         |
| **sum**                                                           | **140**                   |

- Arithmetic check that nothing was lost: 839 + 140 = 979 and 42 + 15 = 57 — the growth is exactly the
  new suites, so **no previous-stage test was deleted or relaxed**. The single harness change is
  `vitest.config.ts`: the browser project's include glob widened from the Stage-7-specific pattern to
  `tests/stage*.browser-*.test.ts`, a superset, so the two new browser suites run under Chromium.
- `npm run package-smoke` and `npm run action-smoke` on the final tree:
  `package-smoke: 0.1.0; bin=true; engines=>=22; stdinFiles=1; rangeFiles=1; fileStdoutBytes=0;
noRepositoryExit=3; usageExit=2; tarballFiles=3` and
  `action-smoke: packages/action/dist/index.js wrote 1250 bytes to the Job Summary; stdout="";
stderr=""; cliLeak=false; hostilePaths=true; cleanWorkspace=true; oversizeRejected=true;
partialSummary=false; pullRequestTargetRejected=true; range=3a060e2...2ead762`.

## QUALIFICATION MATRIX

Ten gates (`npm ci`, `format:check`, `lint`, `typecheck`, `test`, `build`, `package-smoke`,
`action-smoke`, `verify`, `check`) run in order, from scratch, in four fresh disposable clones of the
QUALIFIED PRODUCT SHA `a5925547eb18ed742b269b73672130d34750c3a9` — never in the working tree, with no
`node_modules` and no `dist` carried over. Cells were run **one at a time**, because a concurrent
`npm ci` plus `vitest` makes the real-Git fixture timings untrustworthy, and an untrustworthy timing is
not evidence. Runners: `../stage8/tools/run-cell-windows.sh`, `../stage8/tools/run-cell-linux.sh`;
per-cell logs `../stage8/cells/<cell>/logs/`, per-cell headers `../stage8/cells/<cell>/env.txt`,
cell summaries `../stage8/cell-<cell>.log`.

Every cell's `node=`/`npm=`/`git=`/`HEAD=`/`autocrlf=` header was read before its result was believed;
all four report `HEAD=a5925547eb18ed742b269b73672130d34750c3a9` and `worktree_clean_at_start=0`.

```text
win-node24           Windows 10.0.26200 x64 · node=v24.21.0 npm=11.19.0 · git 2.55.0.windows.5 ·
                     core.autocrlf=true · npm ci 214 packages in 35 s · 10/10 PASS ·
                     test: 57 files passed · 977 passed | 2 skipped (979) · 495.90 s ·
                     build 572 ms → index-DDHzPMhP.js 233.05 kB ·
                     action bundle = 5f63ac2e…00d61 = the committed blob ·
                     cli bundle = 36102709…f5e151 ·
                     package-smoke/action-smoke the same lines as every other cell ·
                     untracked_after=0 · cell_status=0 · cell_exit=0
win-node22b          Windows, portable Node 22 (../stage1/node22/node-v22.23.3-win-x64) ·
                     node=v22.23.3 npm=10.9.9 · git 2.55.0.windows.5 · core.autocrlf=true ·
                     npm ci 214 packages in 2 m · 10/10 PASS ·
                     test: 57 files passed · 977 passed | 2 skipped (979) · 992.26 s ·
                     the same totals again in verify and in check (495.09 s) ·
                     build 906 ms → the same 233.05 kB asset · identical bundle digests ·
                     untracked_after=0 · cell_status=0 · cell_exit=0
linux-node24         Debian (node:24), container-native /tmp on overlay · node=v24.21.0 npm=11.19.0 ·
                     git 2.39.5 · core.autocrlf unset · npm ci 216 packages in 14 s · 10/10 PASS ·
                     test: 51 files passed | 6 skipped (57) · 846 passed | 133 skipped (979) ·
                     15.39 s · build 517 ms → the same 233.05 kB asset · identical bundle digests ·
                     untracked_after=0 · cell_status=0
linux-node22         Debian (node:22), overlay · node=v22.23.3 npm=10.9.9 · git 2.39.5 ·
                     autocrlf unset · npm ci 216 packages in 11 s · 10/10 PASS ·
                     test: 51 | 6 skipped · 846 passed | 133 skipped (979) · 12.58 s ·
                     build 335 ms → the same asset · identical bundle digests ·
                     untracked_after=0 · cell_status=0
```

THE SKIP ARITHMETIC CLOSES IN BOTH DIRECTIONS, AND EACH SKIP IS HONEST.

- Windows: the 2 skips are `stage8.invalid-byte-paths`' real-Git half, which needs a filesystem that
  can hold a filename whose bytes are not valid UTF-8; the suite prints its own reason
  (`the real-Git half is skipped because this host cannot create a filename whose bytes are not valid
UTF-8; the decoder half above runs everywhere`). Those 2 cases **do** run on Linux, where
  `stage8.invalid-byte-paths.test.ts` reports `(10 tests)` with no skip in both containers.
- Linux: the 133 = **132 browser cases** (the six Chromium files: 39 + 19 + 18 + 18 + 30 + 8) + **1**
  pre-existing `runIf(platform === 'win32')` case in `stage3c.release.test.ts`. Each of the six files
  printed the harness's own recorded reason, "no Chromium-class browser engine is installed on this
  host; Stage 7 refuses to present a DOM simulation as browser E2E". A DOM simulation was not passed
  off as browser E2E, and no browser case was deleted to make the Linux cells look clean.
- 977 + 2 = 846 + 133 = 979 in every cell: the same 979 cases were collected everywhere; only which
  ones could _execute_ differed by platform. Browser E2E qualification therefore travels on the two
  Windows cells, where all six files and all 132 cases ran for real.

BROWSERS NEVER RAN IN A SIMULATOR, AND NOTHING BROWSER-SIZED LEFT THE HOST. In the Windows cells each
of the six `tests/stage*.browser-*.test.ts` files executed on the machine's existing Chromium through
`playwright-core`; in the Linux cells the same files were recorded as skipped. No browser binary,
profile, screenshot or video exists in the repository or in any cell clone.

THE BUNDLE REBUILD IS BYTE-EXACT IN EVERY CELL. `bundle_after_build` equalled `bundle_committed`
(`5f63ac2e6a04a755b2f8617ec27ae3ffb8a20ca54eecf1c078030c516ae00d61`) in all four clones, and the CLI
bundle came out `361027099221776ebb76a52570e66982da45660042e6e7533400e79ba9f5e151` in all four — so
the committed Action bundle is reproducible from a clean clone on both git versions and both Node
majors, and no cell needed the working tree to build it.

THE ONE MEASURED ASYMMETRY WORTH KEEPING: the two npm 11.19.0 cells printed
`npm warn install-scripts … esbuild@0.27.7 (postinstall: node install.js) … not yet covered by
allowScripts`; the npm 10.9.9 cells do not print that notice at all. Nothing depended on it (the same
ten gates passed in those cells), the install completed, and the affected package is build/test
tooling with no runtime dependency in any shipped package. Recorded in DEPENDENCY AUDIT and carried to
Stage 9 rather than quietly dropped. Also visible: `node:24` installs 216 packages and Windows installs
214 — optional platform-specific packages, not a lockfile disagreement, since every cell installed from
the same tracked `package-lock.json` and produced the same bundles.

THE DISCLOSED FAILED ATTEMPT — `win-node22`, NOT COUNTED AS A PASS. The Node 22 Windows cell was first
run in a clone of the same SHA with the same header, and it passed the nine gates up to and including
`verify`, then **FAILED `npm run check`**: two browser files timed out inside `beforeAll`
("Hook timed out in 900000ms") — `stage7.browser-contract` (39) and `stage7.browser-build` (19) —
giving `Test Files 2 failed | 55 passed (57)`, `Tests 919 passed | 60 skipped (979)`
(`../stage8/cells/win-node22/logs/check.txt`). No assertion failed: the two files never entered their
bodies. The mechanism is the Chromium lane's single-slot queue (`tests/stage7.browser-harness.ts:253`,
`claimBrowserSlot()`, Stage 7's own 900 s `hookTimeout`) against Stage 8's widened lane of 6 files
instead of 4: the fourth and fifth acquisitions can wait longer than 900 s on a slower runtime.
Immediately after the failure an inventory showed **zero** `ms-playwright` chrome processes and zero
`node.exe` carrying a `stage8\cells` path (`../stage8/win-node22-orphan-inventory.txt`), so no leaked
browser and no stale slot held the lane. Disposition: re-run the whole cell in a fresh clone on an idle
host (`win-node22b`, PASS 10/10 above) and report both attempts. **What was _not_ done to obtain the
PASS**: no `hookTimeout` was raised, no test was skipped, no product file changed — editing four Stage 7
test files would move their tracked digests, force a manifest regeneration and a new candidate SHA, and
is CI-timing work owned by Stage 9.

THE HEADROOM READING, CORRECTED BY THE RE-RUN. In `win-node22b` the same six files completed in all
three full-suite gates, but their queue-inclusive spans moved a lot: `stage8.browser-corpus` ran
908.4 s in `test`, 395.8 s in `verify`, 304.4 s in `check`; `stage8.browser-bidi` ran 666.4 s, 621.1 s
and 45.5 s. Since a 908.4 s _file_ passed under a 900 s _hook_ budget, the timeout is per hook, not per
file — what crossed 900 s in the failed attempt was the wait inside `claimBrowserSlot()`, not total file
time. So the finding to carry to Stage 9 is precisely: **one Chromium lane, six files, a fixed 900 s
per-hook wait, and a measured span variance of roughly 300 s–908 s for the last-acquiring file on the
slower runtime.** That is scheduling headroom, not a security boundary.

## BROWSER — Stage 7 regressions

**YES — all 94 Stage 7 browser cases still green on this tree**, in real Chromium
(Chromium via `playwright-core`, headless, Windows), re-run from the clean clone:

```text
stage7.browser-contract.test.ts        39 passed
stage7.browser-accessibility.test.ts   18 passed
stage7.browser-security.test.ts        18 passed
stage7.browser-build.test.ts           19 passed
                                       ─── 94 passed
```

No Stage 7 test was edited, skipped, or relaxed to get there; the only harness change is the widened
browser glob reported above, which added the two Stage 8 browser suites (38 more cases) to the same
Chromium lane.

## BUILD

`npm run build` succeeds on the qualified SHA in every cell that ran it, and is reproducible: two
consecutive builds on the final tree produced identical digests (`phase42-build1.log`,
`phase42-build2.log`, and `diff` reports `phase42-digests-1.txt` identical to `-2.txt`), with the same
hashed assets in both (`index-9I3gIet4.css`, `index-R83CsIRS.js`). No timestamp, path, or hostname
marker is introduced by the build.

Two build numbers must be read separately, because they answer different questions:

- what an operator gets from the tracked lockfile: the clean `npm ci` clone built
  `dist/assets/index-DDHzPMhP.js` at **233.05 kB** (gzip 73.62, map 979.53) with the unchanged
  `index-9I3gIet4.css` at 19.20 kB, in 572 ms
  (`../stage8/cells/win-node24/logs/build.txt`). The CSS asset hash did not move at all, so the paint
  repair changed only the JS graph, as expected from a one-function addition to `Home.tsx`.
- what this host's working tree builds: 262.32 kB (`index-R83CsIRS.js`). The 29 kB difference is the
  previously recorded drift — the working tree's `node_modules` is a pnpm layout resolving newer
  React/Vite than `package-lock.json` pins, so a working-tree gate run can be green against a
  non-lockfile dependency graph. The CLI and Action bundle digests are identical in both cases, and
  only the clean-clone figures are treated as the shipped artifact's size.

## CLI BUNDLE

`packages/cli/dist/index.js` — 57,659 bytes, sha256
`361027099221776ebb76a52570e66982da45660042e6e7533400e79ba9f5e151`, 1,556 lines
(`../stage8/inspect-artifacts.log`, measured after a clean build). Contents: one `spawn(`, zero
`execFile(`, zero `execSync(`, zero `shell: true`; all 12 pinned revision/diff flags survive bundling
verbatim (`--no-ext-diff … --end-of-options`); zero hits for every markup sink, network API and browser
storage name; zero `http(s)` endpoints; zero local-machine markers (`C:\Users`, `/home/`, the username,
`AppData`). The only entry on the dangerous-name list is `child_process` — the module the single pinned
Git start uses.

## ACTION BUNDLE

`packages/action/dist/index.js` — the only shipped bundle that is tracked and the path
`action.yml:9` names: 48,839 bytes, sha256
`5f63ac2e6a04a755b2f8617ec27ae3ffb8a20ca54eecf1c078030c516ae00d61`, 1,294 lines, rebuilt and committed
inside `a592554` (its diff is +44 lines, the R4 bound plus the R5 message). Same scan results as the CLI
bundle: `child_process` only, one `spawn(`, zero evaluators, zero markup sinks, zero network APIs, zero
endpoints, zero machine markers, 12 pinned flags intact.

The demo site build (`dist/`, untracked) is 5 files whose only URL-shaped strings are the
SVG/MathML/XLink/XML namespace constants and React's `https://react.dev/errors/` string inside its
production error handler; none is fetched, and the corpus suite separately proves zero requests leave
the origin. `vite.config.ts:21` still sets `sourcemap: true`, so the build writes a 1,190,046-byte map
next to a 262,321-byte bundle with a `sourceMappingURL` reference. Measured content of the map: no
absolute local paths, no username, no marker of this machine. This is the pre-existing, Stage 1
documented setting (`docs/audits/stage1-rebaseline.md:331`); the map describes source that is already in
this repository's public tree and `dist/` is not a tracked or published artifact, so Stage 8 changed the
build configuration for none of it.

## MANIFEST

All Stage 8 paths were staged by name first (17 new: `packages/core/src/display.ts`, the 15
`tests/stage8.*.test.ts` files, and the shared `tests/stage8.hostile-corpus.ts`), then
`npm run manifest` reported **SOURCE_MANIFEST.txt: 145 files** (128 at the start of Stage 8 + 17), and
`npm run verify` passed end to end, exit 0: `DiffBeacon source-first verification passed.`
(`../stage8/phase41-manifest.log`, `../stage8/phase41-verify.log`).

## HOSTED CI

**EXTERNAL CI BLOCKED — no hosted run qualifies this stage, and none is claimed.**

- The single observation this stage permits is taken after the one forward push of `rescue/stage0-source`
  that carries this report, and is written **outside the repository** to
  `../stage8/ci-observation.md` (run ID, head SHA, jobs, runner assignment, steps, billable time). It is
  deliberately not copied into a further docs commit: a commit cannot contain its own hash, and the
  branch tip's own CI result can only be observed after the push, so recording it by committing again
  would start the infinite docs-commit chain this brief forbids. The evidence file is the record.
- The most recent hosted observation on this branch, made for the Stage 7 closure push and the state the
  account was in when Stage 8 started, is unchanged in shape:
  run `36328635359` (`CI`, head SHA `74d79f948b5b3ecdf5299a9a06d93d07ec34bbd8`, event push), completed
  with conclusion failure in 5 s — four jobs (Node 24 and Node 22 on `ubuntu-latest`, Node 24 and
  Node 22 on `windows-latest`), each 2–3 s end to end, each with **`steps: []`**, and
  `gh run view --log` answering "log not found". A job that never got a runner produces exactly that.
  Full record: `../stage7/ci-observation-closure.md`.
- Consequence for this stage's verdict: nothing of DiffBeacon's was checked out, installed, built or
  tested on a hosted runner. Hosted CI is therefore **unqualified**, and the qualification behind
  STAGE 8 DECISION is the ten local gates plus the four clean-clone matrix cells on `a592554`. Per the
  brief, a billing/runner-provisioning blockage alone does not make this stage FAIL when every local
  contract is qualified truthfully — and equally, it does not make a hosted claim.
- Not done, deliberately: no re-run was triggered, no workflow file was changed because of the
  blockage, no second docs-only commit was made to record a run ID, and no merge / PR / tag / release /
  publish / force-push was performed.

## MACOS

**NO.** Nothing was runtime-qualified on macOS or in hosted Safari. No Apple hardware or hosted macOS
runner was available in this pass, and the browser qualification is Chromium on Windows only. Any
macOS claim would be an extrapolation, so none is made.

## WORKING TREE

The candidate commit contains 28 paths and nothing else. The recurring untracked `pnpm-lock.yaml` /
`pnpm-workspace.yaml` debris (dropped by an external process, not by this repository's build) reappeared
after the product commit, was hashed (`d07aa982f2db4cda7b838ca41eea807ec299a8437faa716cf1d14d1cdec41a41`
/ `d6d0c24446d91ef762d37c6ba801bb516e65d7055aa9f8027fcd457409a97ce1`) and moved to
`../stage8/quarantine/pnpm-debris-2026-09-28-post-a592554/` rather than staged or deleted; `git status`
was re-checked after the move and the tree is clean at every commit point. Never staged, never
committed: `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
`node_modules`, `dist/` (except the tracked Action bundle that `action.yml` names), browser binaries or
profiles, screenshots, videos, audit scratch, fuzz logs, temporary repositories, sentinel files, npm
tarballs. `git diff --check` is clean and `npm run format:check` reports
"All matched files use Prettier code style!" on both commits.

## REMAINING SECURITY LIMITATIONS

Stated as limits, not as reassurance:

1. No claim of being secure, vulnerability-free, or hardened against everything — this report lists
   only the boundaries that were attacked and what measurement showed.
2. No hosted CI outcome is claimed as a qualification input beyond the single recorded observation.
3. macOS and Safari: zero runtime qualification.
4. GitHub Actions workflow pins were read, and all 3 are full SHAs, but pin→tag resolution was not
   verified (no network lookup in this pass).
5. Four dependency advisories are carried, all in build/test tooling with no path to a shipped
   artifact; the tracked lockfile pins `vitest` 4.1.10 while the host working tree resolves 4.1.11
   through a pnpm-layout `node_modules`, so a working-tree gate run can be green against a
   non-lockfile dependency graph. Only the clean-clone cells qualify artifact bytes and digests.
6. Fuzzing is 1,500 seeded mutations over 9 seeds — a property check, not an absence proof.
7. No live control was reproducible on this host for pager-related Git environment variables, so no
   pager defence is claimed.
8. Linux-only measurements (real invalid-UTF-8 filenames) ran in one container with git 2.39.5; other
   Linux Git versions are not covered by that measurement.
9. Ambient Git environment redirection (`GIT_DIR` and friends) is intentionally not neutralised; the
   reasoning and the bounded failure mode are recorded in GIT ENVIRONMENT.
10. The repository's own `ci.yml` can run a fork pull request's dependency lifecycle scripts on a
    hosted runner — the ordinary Node-CI boundary, disclosed rather than dressed up, and outside the
    DiffBeacon product path.
11. Display controls are neutralised at paint time, so a raw hostile name still exists in the JSON
    that a consumer may render through some other tool. That is the data-stays-factual rule; the
    downstream renderer is not DiffBeacon's.
12. Confusables, homoglyphs, ordinary RTL and zero-width joiners are deliberately left intact.
13. `docs/audits/AUDIT_HANDOFF.md` still contains a stale `--binary` reference and calls the CLI path
    "safe". It is a dated handoff record, so it was left as written and the staleness disclosed here;
    the current-state document is `docs/architecture/security.md`.
14. **Chromium lane headroom, measured on the Windows Node 22 cell.** The single-lane schedule
    Stage 7 established now carries 6 browser files instead of 4, because Stage 8 widened the include
    glob. In one `npm run check` run on Node 22, the 4th and 5th files in the queue spent their whole
    900 s `hookTimeout` waiting for the lane and failed _in `beforeAll`, before any assertion ran_
    (919 passed | 60 skipped); the same clone's standalone `test` gate and `verify` runs completed the
    lane with the slowest file at 840 s. Zero leaked browsers and zero stale slot files were present
    afterwards, so this is queue depth against a fixed budget — a CI-robustness item, owned by Stage 9,
    not a security boundary. Recorded in QUALIFICATION MATRIX with the log lines, and deliberately not
    papered over by raising a Stage 7 timeout in this stage.
    The re-run (`win-node22b`, a fresh clone of the same SHA on an idle host) passed all ten gates with
    the six files executing in each of its three full-suite runs, so the defect is intermittent, not
    deterministic — which is the worse property for a hosted schedule. The re-run also corrects a
    reading in this paragraph: its `test` gate completed `stage8.browser-corpus` in **908.4 s**, above
    the 900 s figure, and still passed, so the budget is per hook rather than per file; what crossed it
    in the failed attempt was the wait inside `claimBrowserSlot()`. The measured span for the
    last-acquiring file across the runs of both clones ranged 45.5 s to 1,057.1 s, so Stage 9 should
    treat lane sequencing (or lane-parallel slots) as an unresolved question with a very wide variance,
    not as a fixed number to tune against.

## STAGE 8 DECISION

**PASS.** The five reproduced defects (Markdown cell escaping, terminal/CLI display controls, browser
display paint, Job Summary byte bound, non-object event message) are repaired and each is pinned by a
GREEN suite plus at least one falsification control that fails when the repair is removed. The
boundaries probed and found already holding (Git argv and `shell: false`, hostile Git config,
non-execution of target code on both the Action and the CLI path, prototype pollution, traversal-shaped
names, the JSON contract, invalid-UTF-8 filename decoding, resource bounds at 8 MiB, workflow supply
chain, credential scan, dangerous-API scan) are recorded as measured, with their numbers.
`docs/architecture/security.md` now states those facts and nothing more. Full regression is green
(979 Windows cases, 94 Stage 7 browser cases among them) and the shipped bundles rebuild byte-for-byte.

The host-CI billing blockage that prevents Actions runs from receiving a runner does not change this
decision: every local contract above is qualified truthfully, and the blockage is recorded in HOSTED CI
as an external condition rather than treated as a product failure.

## NEXT RECOMMENDED ROADMAP STAGE

After this PASS: **Stage 9 — CI AND PACKAGE QUALIFICATION**, whose first decisions are already
documented by this pass (the lockfile refresh for `vitest`/`@vitest/mocker`, the `js-yaml` and `esbuild`
dispositions, the `allowScripts` question npm raised on a clean install, the runner-availability
observation, and the Chromium lane headroom item in REMAINING SECURITY LIMITATIONS 14 — a 6-file
serialized browser lane against a 900 s hook budget is exactly the kind of thing a hosted CI schedule
has to settle deliberately rather than inherit).

**DO NOT begin Stage 9.** Stage 8 stops here.

## STAGE 8 CLOSURE — ACTION WORKSPACE + MARKDOWN DISPLAY BOUNDARY

```text
AUDITOR RULING:
REPAIR REQUIRED
```

The first pass above qualified five defects (R1–R5). The auditor then reviewed that record and found two
contract claims the code did not keep, plus two places where this report described the platform and the
input bounds incorrectly. This closure pass reproduced both defects, repaired both, corrected both
records, and re-qualified the tree. It began from HEAD `41ec737fd4758ddbfb0c0305d838d86e85246c5f` on
`rescue/stage0-source` — the commit the report above was made in — and changed no other product surface.

### A — ACTION WORKSPACE DEFECT

- PRE-FIX: the Action documents `GITHUB_WORKSPACE` as the reviewed-repository boundary, but
  `packages/cli/src/git.ts` started every Git process with no explicit child environment, so each one
  inherited `process.env`. An ambient `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`,
  `GIT_OBJECT_DIRECTORY` or `GIT_ALTERNATE_OBJECT_DIRECTORIES` therefore moved the review to a different
  repository — measured, not assumed, on Windows Git 2.55.0.windows.5 and Linux Git 2.39.5. The
  requirement was not converted into a threat-model waiver because the workflow operator owns the
  environment: a pull request does not own the runner's environment, so the Action cannot treat that
  environment as trusted input.
- RED: `../stage8c/red-A-action-isolation.log` —
  `tests/stage8c.action-workspace-isolation.test.ts` runs the **committed Action bundle** the way a runner
  does (`GITHUB_WORKSPACE` = disposable repository A, an unrelated disposable repository B holding the
  objects the event could name, full 40-hex object IDs in the event, no fabricated SHA collision), once
  per selector. 10 of its 17 cases failed: the five single-selector redirects (`GIT_DIR`,
  `GIT_WORK_TREE`, `GIT_COMMON_DIR`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`), a
  workspace whose own `core.worktree` points elsewhere, the same `GIT_DIR` redirect against a workspace
  path containing spaces and against one containing non-ASCII characters, the case that must refuse a
  workspace which is not a repository even when `GIT_DIR` names one that is, and the case asserting that
  the rebuilt environment still runs nothing from the repository it reads.
- REPAIR: `workspaceGitEnv()` (`packages/action/src/index.ts`) rebuilds the child environment from the one
  the Action received, deletes the four measured redirecting selectors, and **assigns**
  `GIT_WORK_TREE = GITHUB_WORKSPACE` — assigned, not deleted, because the value outranks a
  repository-local `core.worktree`, the one channel no denylist reaches. It is handed to
  `collectGitDiffAsync` as one `GitProcessOptions.env`, which the shared collector passes to every Git
  process in the collection: `rev-parse --show-toplevel`, the `rev-parse --verify` of each range part, and
  the diff `spawn`. Sanitizing only the final spawn would not have been sufficient, and the test proves
  the earlier calls were the redirectable ones. `GIT_INDEX_FILE` and `GIT_NAMESPACE` are deliberately kept
  (measured not to redirect a full-object-ID range diff), and PATH, locale and runtime variables pass
  through — the policy is the measured set rather than a `GIT_`-prefix denylist, and no part of
  `process.env` is wiped.
- CLI POLICY: **unchanged.** The CLI inherits its operator's environment exactly as before, and the
  `stage8.git-boundary` (13 cases), Stage 5 CLI-contract and `stage8.no-target-execution` suites pass on
  the closure tree. Measurement found no CLI defect to repair, so the recorded operator-owned disposition
  stands.
- ACTION POLICY: **`GITHUB_WORKSPACE` is authoritative.** No ambient Git variable can move the Action's
  review off it, and the reviewed repository's own configuration cannot move the reported root. The Action
  policy is therefore stricter than the CLI policy, and this is the claim Domain 12 of the threat matrix
  previously declined to make.
- FALSIFICATION: `../stage8c/control-A-isolation-removed.log` — with `workspaceGitEnv()` neutralised to
  return the environment unchanged, exactly the same 10 cases fail again and the same 7 still pass, so the
  suite is proving the repair and not the fixture. The 7 cases that held before the repair are the
  non-redirecting channels the policy must not touch: the plain control (an environment naming nothing
  else), an alternate object store that the workspace legitimately holds, `core.worktree` injected through
  `GIT_CONFIG_COUNT` and through an ambient global config file (measured not to redirect), `GIT_NAMESPACE`
  and `GIT_INDEX_FILE` kept because a commit-to-commit range diff reads neither, and a linked worktree
  whose `.git` is a file. With the repair in place all 17 pass (`../stage8c/green-A-first-run.log`),
  including workspace paths containing spaces and containing non-ASCII characters, the refusal of a
  workspace that is not a repository even when `GIT_DIR` names one that is, and the assertion that the
  rebuilt environment still installs and runs nothing from the repository it reads. The `diff.external`
  sentinels are re-measured in the same run by `stage8.git-boundary` (its 13 cases, unchanged), so
  `--no-ext-diff --no-textconv` remain load-bearing rather than newly assumed.

### B — MARKDOWN DISPLAY CONTROL DEFECT

- PRE-FIX: `neutralizeDisplayControls()` was applied to the terminal, the CLI message surface and the
  browser, but `renderMarkdown()` interpolated `file.displayPath` and `relatedFiles` into the report
  without it, so U+202E, U+202A–U+202E, U+2066–U+2069, U+061C, the single-code CSI/OSC introducers
  U+009B and U+009D, and U+2028/U+2029 reached the human GitHub Job Summary intact.
- RED: `../stage8c/red-B-markdown-controls.log` — 12 of the 15 cases in
  `tests/stage8c.markdown-display-controls.test.ts` failed, each asserting the painted name rather than
  merely "no control present".
- JSON: **raw contract, unchanged.** `renderJson()` was not touched. `JSON.parse(renderJson(report))`
  still contains each original path byte for byte, and a sweep over the whole hostile corpus asserts that
  rendering a report to Markdown and to the terminal leaves `JSON.stringify(report)` unchanged — so a
  "repair" that sanitized the data model instead of the paint would fail. The parser output and the data
  model are not sanitized.
- MARKDOWN: **presentation contract.** The repair sits at the Markdown paint boundary —
  `markdownCode(paintedText(...))` for the `Observed in:` list and
  `markdownTableCellCode(paintedText(file.displayPath))` for the Changed-files row — using the existing
  shared policy with the renderers' U+FFFD marker. `paintedText()` is the former `terminalText()`, renamed
  because it now serves both human surfaces. Reordering controls are removed, line-shaping controls reduce
  to one space, executable controls show as U+FFFD, while ordinary Arabic and Hebrew text is preserved and
  U+200B/U+200C/U+200D stay painted verbatim per the existing measured policy. Terminal/Markdown parity is
  asserted over the corpus on the painted shape, since the two surfaces encode backtick, pipe and
  backslash differently.
- PIPE ESCAPE: the Stage 8 R1 GFM-pipe repair is preserved — its cases remain in
  `tests/stage8.markdown-security.test.ts` and the pipe-bearing hostile names are re-asserted with display
  controls in the closure suite.
- FALSIFICATION: `../stage8c/falsify-B-paint-removed.log` — reverting the two paint sites to the raw name
  fails 13 cases across the two Markdown suites (12 of the 15 closure cases plus 1 case of
  `stage8.markdown-security.test.ts`, whose expectation helper derives from the policy), and restoring them
  returns both files to 24 passed of 24 (`../stage8c/green-B-restored.log`, 15 + 9). The expectation helper
  the closure tests use is `tests/stage8.display-policy-oracle.ts`, a test-only module that re-derives the
  presentation from the policy's statement instead of importing `packages/core/src/display.ts`, so a repair
  that quietly moved the boundary cannot agree with itself.

### C — SUMMARY PLATFORM-RECORD CORRECTION

- OLD RECORD: this report said the platform's 1,048,576-byte limit would be exceeded "mid-write" and
  surface as a truncated or rejected summary. That is not what the platform does.
- CORRECT BEHAVIOR: GitHub gives **each step its own** 1 MiB step summary. Passing it fails that step's
  summary **upload** and raises an error annotation in the run; the upload failure does **not** itself
  change the status of the step or the job. The real pre-repair risk was a review DiffBeacon reported as
  successful beside a Job Summary GitHub refused to publish.
- GUARD: unchanged and still justified — `MAX_STEP_SUMMARY_BYTES = 1 * 1024 * 1024` and the
  existing-bytes-plus-addition check were not removed and the exact limit was not altered. The guard moves
  the failure into the Action, where it names the arithmetic and writes nothing partial. Corrected in
  R4/ACTION SUMMARY above and in `docs/architecture/security.md` (Job Summary row).

### D — EVENT SIZE RECORD CORRECTION

- OLD RECORD: the event file was described as held to "the same 8 MiB input discipline" as the diff. That
  is not what the code does, so the record was corrected rather than the code changed to fit it.
- MEASUREMENT: the Action applies no DiffBeacon-specific size cap to `GITHUB_EVENT_PATH`; `MAX_DIFF_BYTES`
  bounds the diff it collects, not the event it reads. An event fixture carrying approximately 8 MiB of
  extra JSON alongside valid `pull_request.base.sha`/`.head.sha` is accepted and the review completes —
  recorded as a permanent case in `tests/stage8.action-event-summary-paths.test.ts`.
- DECISION: no arbitrary event limit was invented to make the old prose true. Event validity is governed by
  shape and the full-object-ID contract. The corrected record is in EVENT FILE above and in
  `docs/architecture/security.md`.

## CLOSURE REGRESSION

- Targeted suites (PHASE 10), Windows, `../stage8c/phase10-targeted-windows-final.log`: 11 files, 115
  cases — `stage8.git-boundary`, `stage8c.action-workspace-isolation` (17),
  `stage8c.markdown-display-controls` (15), `stage6.action-runner`, `stage6.action-security-boundary`,
  `stage8.markdown-security`, `stage8.terminal-security`, `stage8.json-contract`,
  `stage8.action-summary-bound`, `stage8.action-event-summary-paths`, `stage8.no-target-execution`.
- Browser project (shared display code changed): `../stage8c/phase10-browser-windows.log` — 6 files, 132
  cases, real Chromium.
- Full gate chain on the working tree, Windows Node 24 (`../stage8c/phase11-full-windows-final.log`,
  `CHECK_EXIT=0`): `format:check`, `lint`, `typecheck`, `test`, `build`, `package-smoke`, `action-smoke`,
  `verify`, `check` all pass — `Test Files 59 passed (59)`, `Tests 1009 passed | 2 skipped (1011)`,
  `Duration 768.17 s`; `action-smoke` reports `partialSummary=false`, `cliLeak=false`,
  `oversizeRejected=true`, `cleanWorkspace=true`; `package-smoke` reports
  `0.1.0; bin=true; engines=>=22; tarballFiles=3`.
- Disclosed instability, three attempts before the run above: the first full run of the closure tree
  (`../stage8c/phase11-full-windows-2.log`) failed one browser case,
  `stage8.browser-corpus.test.ts` "paints name 6 exactly as the display policy decides", with
  `page.goto: net::ERR_NETWORK_CHANGED` at `tests/stage7.browser-harness.ts:378` — the host network stack
  changing underneath a live navigation, not an assertion about display controls. That run reported
  `Tests 1008 passed | 1 failed | 2 skipped (1011)`. The case was not altered, weakened or skipped. The
  second run (`phase11-full-windows-3.log`) stopped at `format:check` because a documentation edit landed
  mid-run, and the third (`phase11-full-windows-4.log`) reached the manifest gate, which is where PHASE 14
  had not yet been run. Only the final run is quoted as the result.

## CLOSURE QUALIFICATION MATRIX (CLEAN CLONES OF THE PRODUCT SHA)

Each cell is a fresh disposable clone of `98d0ab2fa7942d21e94b04305cd5fe04b2a0a9b1` made outside the
repository (`../stage8c/cells/`), with its own `npm ci` and all ten gate commands
(`npm ci`, `format:check`, `lint`, `typecheck`, `test`, `build`, `package-smoke`, `action-smoke`,
`verify`, `check`). `check` aliases `verify` and `verify` runs the whole suite, so each cell executes the
full suite three times.

- **Linux `node:24`, container-native `/tmp` — 10/10 PASS.** `node=v24.21.0 npm=11.19.0 git=2.39.5`,
  `core.autocrlf` unset, `worktree_clean_at_start=0`, `untracked_after=0`. `Test Files 53 passed | 6 skipped (59)`,
  `Tests 878 passed | 133 skipped (1011)`. The 6 skipped files and 133 skipped cases are the serialized
  browser lane (no Chromium in the container) plus the one pre-existing `runIf(win32)` release case; each
  skip prints its own reason, so nothing here is a silent pass. Evidence:
  `../stage8c/cell-linux-node24.log`, `../stage8c/cells/linux-node24/logs/`.
  This cell is also the Linux half of Finding A: in it `stage8c.action-workspace-isolation.test.ts` passed
  17/17 under Git 2.39.5 (4,636 ms), so the workspace-isolation contract is measured on both gitlines, not
  only on Windows Git 2.55.0.windows.5.
- **Windows Node 24 — 10/10 PASS.** `node=v24.21.0 npm=11.19.0 git=2.55.0.windows.5`, `autocrlf=true`,
  `worktree_clean_at_start=0`, `untracked_after=0`. `Test Files 59 passed (59)`,
  `Tests 1009 passed | 2 skipped (1011)`, `Duration 595.22 s`. The 2 skips are
  `stage8.invalid-byte-paths`' real-Git half (Windows cannot hold a filename whose bytes are invalid
  UTF-8), each printing its reason. All six browser files executed in real Chromium (85,666 ms to
  537,983 ms per file, inside the serialized lane's 900 s per-hook budget). Evidence:
  `../stage8c/cell-win-node24.log`, `../stage8c/cells/win-node24/logs/`.
- **Linux `node:22` — 10/10 PASS.** `node=v22.23.3 npm=10.9.9 git=2.39.5`, `worktree_clean_at_start=0`,
  `untracked_after=0`, `878 passed | 133 skipped (1011)`, same two bundle digests as the other cells.
  Evidence: `../stage8c/cell-linux-node22.log`, `../stage8c/cells/linux-node22/logs/`.
- **Windows Node 22 — 10/10 PASS.** The portable `node=v22.23.3 npm=10.9.9` runtime under
  `../stage1/node22/`, host `git=2.55.0.windows.5`, `autocrlf=true`, `worktree_clean_at_start=0`,
  `untracked_after=0`. `Test Files 59 passed (59)`, `Tests 1009 passed | 2 skipped (1011)`,
  `Duration 665.53 s`, with all six browser files executed in real Chromium (144,518 ms to 615,720 ms per
  file). Evidence: `../stage8c/cell-win-node22.log`, `../stage8c/cells/win-node22/logs/`. The `node=` line
  was read from the cell's own log before the result was believed, because a PATH prepend given in Windows
  drive-letter form silently resolves to the host Node 24 and turns a Node 22 cell into a duplicate Node 24
  cell; the POSIX form was used. This cell was run last and alone — it took materially longer than the
  Node 24 cells, and the brief's condition for spending that time ("if cheaply reusable") was met because
  the runtime was already on this host from Stage 1.
- `bundle_after_build` equals `bundle_committed` in every cell and equals the working-tree rebuild:
  `45660da735388dee35fc581e94490d2aacc295b2382f8bea23ab12dff2350049`. The rebuilt CLI bundle is
  `0ceb2e1e2ff3c8b77a793d654e1b66be3eaf5a685f6d8afcd1824b85524a4275` on Windows and Linux alike. No cell
  needed a workflow, timeout or test-hospitality change; no cell was run concurrently with another.

## CLOSURE RECORD

```text
STARTING SHA      41ec737fd4758ddbfb0c0305d838d86e85246c5f  (Stage 8 first-pass report commit)
PRODUCT SHA       98d0ab2fa7942d21e94b04305cd5fe04b2a0a9b1  fix: close DiffBeacon Stage 8 trust boundaries
                  10 files changed, 914 insertions(+), 65 deletions(-)
BRANCH            rescue/stage0-source
ORIGIN MAIN SHA   e0ff98143bfe39c80c338518d006525a846a8739   (untouched — no merge, no PR)
FINAL TEST TOTAL  Windows: 1009 passed | 2 skipped (1011)   ← 979 collected before the closure, +32 closure cases
                  Linux:    878 passed | 133 skipped (1011)  (same 1011 collected; 133 honest skips, no Chromium)
ACTION BUNDLE     45660da735388dee35fc581e94490d2aacc295b2382f8bea23ab12dff2350049
                  (was 5f63ac2e6a04a755b2f8617ec27ae3ffb8a20ca54eecf1c078030c516ae00d61 at 41ec737)
CLI BUNDLE        0ceb2e1e2ff3c8b77a793d654e1b66be3eaf5a685f6d8afcd1824b85524a4275  (untracked artifact)
MANIFEST          SOURCE_MANIFEST.txt 145 → 148 entries; 3 added, 0 removed, 6 changed hashes
                  sha256 859205c9d4f9ef96dc1b5d8690a58afac737776a2497b497cbf0e9e5a2a9e384
```

- **FINAL TEST TOTAL** moved from 979 collected cases to 1011 because the closure added two suites
  (17 + 15 = 32 cases). Not one previous-stage test was deleted, relaxed or duplicated to reach the number;
  the only change to an existing file's assertions was the disclosed derivation of
  `stage8.markdown-security.test.ts`'s expectation helper from the shared policy, with its 9 cases and its
  structure intact (`../stage8c/green-B-restored.log`).
- **MANIFEST**: added `tests/stage8c.action-workspace-isolation.test.ts`,
  `tests/stage8c.markdown-display-controls.test.ts`, `tests/stage8.display-policy-oracle.ts`; changed
  `docs/architecture/security.md`, `packages/action/src/index.ts`, `packages/action/dist/index.js`,
  `packages/cli/src/git.ts`, `packages/core/src/render.ts`,
  `tests/stage8.markdown-security.test.ts`. `docs/audits/**` remains excluded, so this report costs no
  manifest churn. `npm run manifest` then `npm run verify` are green (`../stage8c/phase14-manifest.log`).
- **HOSTED CI**: per HOSTED CI above, the single observation this closure permits is taken after the one
  forward push that carries it and is written **outside** the repository to
  `../stage8c/ci-observation.md` — a commit cannot contain its own hash, and recording the branch tip's CI
  result by committing again would start the docs-commit chain the brief forbids. The most recent hosted
  observation on this branch remains run `36328635359` (head `74d79f94…`): four jobs, 2–3 s each, every one
  with `steps: []` and no runner, conclusion failure — **EXTERNAL CI BLOCKED**. Nothing of DiffBeacon's was
  checked out, installed, built or tested on a hosted runner for this closure, no hosted claim is made, and
  the qualification behind the decision below is entirely the local gate chains and clean-clone cells
  recorded above. No re-run was triggered and no workflow file was changed because of the blockage.
- **WORKING TREE**: after the final `npm run check`, `git status --short --untracked-files=all` shows only
  files this closure intentionally created or modified; the pnpm debris that reappears in this working tree
  (`pnpm-lock.yaml`, `pnpm-workspace.yaml`) was hashed and moved out to `../stage8c/pnpm-debris/`, never
  staged, never deleted, and no `node_modules`, dist bundle (other than the tracked Action bundle), browser
  binary, profile, screenshot, log, sentinel or temporary repository is staged. `untracked_after=0` inside
  every clean-clone cell.

## STAGE 8 CLOSURE DECISION

**PASS.** Both defects the auditor identified are reproduced from the committed artifacts, repaired, and
pinned by GREEN suites that each carry a falsification control failing when the repair is removed: the
Action now holds `GITHUB_WORKSPACE` as the reviewed-repository boundary against every ambient Git selector
that measurably redirected it, on both gitlines, while the CLI's operator-owned inheritance is left as
recorded; Markdown now applies the shared display-control policy at the human presentation boundary while
JSON stays byte-exactly raw and the Stage 8 GFM pipe repair stays green. Both record corrections (per-step
1 MiB summary upload semantics; the absence of a DiffBeacon event-file size cap) are written into this
report and `docs/architecture/security.md` without weakening either guard. Full regression is green at
1011 collected cases on Windows and Linux, the shipped bundles rebuild byte-for-byte in every cell, and
the qualification ran on four clean clones of the product SHA — Windows Node 24 and Node 22, Linux
`node:24` and Linux `node:22` — each of them passing all ten gates.

## NEXT RECOMMENDED ROADMAP STAGE AFTER CLOSURE

Unchanged by this closure: **Stage 9 — CI AND PACKAGE QUALIFICATION**, whose first decisions are the ones
listed above plus the two this closure adds — the `GIT_*` child-environment policy now differing between the
CLI and the Action (Stage 9 must not unify them casually; the difference is measured), and the serialized
browser lane's headroom, which this closure re-measured at 85.7 s to 538.0 s per file on Windows Node 24
and 144.5 s to 615.7 s per file on Windows Node 22 — inside a 900 s per-hook budget on both, but with only
one file's worth of headroom left on the slower runtime.

**DO NOT begin Stage 9.** Stage 8 and its closure stop here.
