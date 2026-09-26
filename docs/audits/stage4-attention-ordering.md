# DIFFBEACON STAGE 4 — ATTENTION ORDERING REPORT

```text
STATUS:                  PASS
STARTING SHA:            7647df403021eb319b52aa49ba762eb239087a25  (rescue/stage0-source tip at start)
STARTING STAGE-3 CLOSURE: 8dd9953edb327475b043bba87ee4e37632ea1e5c  (verified present in history)
ENDING SHA (qualification commit): d2ff91a5ee32e0ed16c5652e0000d68cddf607fd
REPORT COMMIT:                     888fe10c80feab7ad0e88003cf016a47a34c1bb8 (this document, before the CI observation)
FOLLOW-UP COMMIT:                  the next commit on rescue/stage0-source, message 'docs: record DiffBeacon Stage 4 CI observation'; it is the Stage 4 branch tip and edits only this manifest-excluded file
BRANCH:                  rescue/stage0-source
ORIGIN MAIN SHA:         e0ff98143bfe39c80c338518d006525a846a8739  (unchanged; not merged, not moved)
PUSHED:                  yes, normal non-forced push of rescue/stage0-source
```

## Identity gate

Verified before any edit: `git remote get-url origin` →
`https://github.com/Pavithran-R-A/DiffBeacon.git`, `git branch --show-current` →
`rescue/stage0-source`, `git rev-parse HEAD` → `7647df40…`, `origin/main` →
`e0ff9814…`, and `git merge-base --is-ancestor 8dd9953d HEAD` succeeded. Stage 3 was
qualified `PASS`. Nothing differed, so work proceeded.

## ORDERING ARCHITECTURE

Review ordering is now one explicit, private policy table in
`packages/core/src/analyze.ts`:

```ts
const reviewPolicy: Record<
  SurfaceId,
  { order: number; level: AttentionLevel; label: string; rationale: string }
> = { … };
```

- The `Record<SurfaceId, …>` shape makes an omitted or duplicated surface a compile
  error, not a silent default. Measured with a scratch probe outside the repository
  (`stage4/policy-completeness-probe.txt`): a `Record` literal missing one member of a
  surface union fails `tsc --strict` with `TS2741: Property 'runtime' is missing`.
  Under the pre-repair code no such check existed.
- `reviewPriority` is derived by sorting the keys on their written-out `order`
  numbers, so the sequence cannot depend on how the object literal happens to be
  laid out and cannot inherit detector registration order.
- `levelFor()` reads the same entry, so a surface's band and its position can never
  disagree; `reasonFor()` reads the same entry's `label` and `rationale`, so the
  explanation is produced from the policy that places the surface.
- Nothing is exported from the table except through `analyzeDiff()` behavior. The
  suites observe position, band, title and reason text through the public report, as
  required, rather than importing internal structures.
- Ordering inputs are: the classified surface set of files the parser proved, and the
  policy table. Not inputs: changed-line magnitude, file counts, rename direction,
  hunk validity, evidence-relationship outcomes, or locale.

## OLD POLICY

```ts
const reviewPriority: SurfaceId[] = ['ci-build', 'auth-access', … , 'generated']; // 11 entries
function levelFor(surface: SurfaceId): AttentionLevel {
  if (['ci-build', 'auth-access', 'database-schema', 'infrastructure'].includes(surface)) return 'FOCUS';
  if (['api-contracts', 'runtime', 'dependencies', 'configuration'].includes(surface)) return 'CHECK';
  return 'NOTE';
}
reason: `DiffBeacon recommends looking at ${title} earlier in this review.`
sortFiles: [...files].sort((a, b) => compareCanonicalText(a.displayPath, b.displayPath));
```

Two structures encoded one policy, a surface absent from both membership lists
silently defaulted to `NOTE`, a surface absent from the array silently vanished from
the order, the reason text restated the recommendation it was supposed to explain, and
the file sort key could tie between distinguishable entries.

## POLICY DECISION — per surface

The measured defect set contained no wrong position: the audited sequence reproduced
the existing relative order exactly (see the pairwise tests). Re-ranking would have
required a claim that one surface objectively matters more, which this project
forbids, so **every surface keeps its old relative position and its old band**. What
changed is that each position now carries a stated reading rationale, and the band is
derived from the same entry instead of a second list.

| #   | Surface           | Band  | Old order | Decision | Review-workflow rationale now shipped                                                                                                           |
| --- | ----------------- | ----- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `ci-build`        | FOCUS | 1         | kept     | Pipeline and build definitions are read first because they show how the rest of the change is compiled, tested and published.                   |
| 2   | `auth-access`     | FOCUS | 2         | kept     | Access-control conventions follow the build frame and precede the code that relies on them, so the authorization boundary is established first. |
| 3   | `database-schema` | FOCUS | 3         | kept     | Schema and migration files define the shape of persisted data that later surfaces read and write.                                               |
| 4   | `infrastructure`  | FOCUS | 4         | kept     | Container and deployment definitions describe the environment the change runs in, completing the context before implementation.                 |
| 5   | `api-contracts`   | CHECK | 5         | kept     | Explicit contract files state what consumers see, so they are read before the implementation that satisfies them.                               |
| 6   | `runtime`         | CHECK | 6         | kept     | Implementation files carry the executable behavior of the change and are read after the context-setting surfaces above.                         |
| 7   | `dependencies`    | CHECK | 7         | kept     | Manifests and lockfiles name the third-party inputs that the implementation above resolves against.                                             |
| 8   | `configuration`   | CHECK | 8         | kept     | These files shape how the application and tooling apply the behavior listed above them.                                                         |
| 9   | `tests`           | NOTE  | 9         | kept     | Test files show what this diff verifies directly, which reads most usefully after the implementation context.                                   |
| 10  | `documentation`   | NOTE  | 10        | kept     | Prose files such as guides and changelogs explain the change after the code they describe.                                                      |
| 11  | `generated`       | NOTE  | 11        | kept     | Generated output is usually a consequence of the source above it, so it is read last.                                                           |

Rejected framing during qualification (and rejected in tests, not only in prose):
"most dangerous", "most likely to break", "highest severity", "review first because it
is unsafe", or any probability/confidence statement. The table's positions are a
reading convention for the diff in front of the reviewer.

## DEFECTS FOUND

Five defects, each proven before repair. All were repaired test-first; the corrected
RED record is `stage4/red-3.txt` — 23 failing tests, 88 passing, every one of them
either a genuine defect or a documentation assertion for work not yet written.

### 1. Review-order reasons were circular

- Input: `diff --git a/tests/app.test.ts b/tests/app.test.ts` content change.
- Before: `reason = "DiffBeacon recommends looking at Tests earlier in this review."`
- Violation: the entry explains itself by restating that DiffBeacon recommends it —
  the contract requires the reason to state what the surface is and why the policy
  places it there. Every one of the eleven entries had the same non-reason.
- Failing test: `stage4.order-language.test.ts` → `drops the circular recommendation
sentence entirely`, plus 11 per-surface rationale tests, `reports the same count as
the entry lists files…`, `says files changed, never that content or lines changed…`,
  and `stage4.attention-order.test.ts` → `keeps a manifest and its lockfile in one
dependencies entry`.
- Repair: `reasonFor()` composes the observed file count, the surface's policy label,
  and that same entry's rationale.
- After: `1 test file changed in this diff. Test files show what this diff verifies
directly, which reads most usefully after the implementation context.`

### 2. The policy was encoded twice, and both halves had silent defaults

- Evidence: `reviewPriority` (11-entry array) and `levelFor()` (two membership lists
  with a fallthrough `return 'NOTE'`), pre-repair source at `7647df4`.
- Violation: two structures that "cannot silently disagree" is a Stage 4 requirement;
  a surface dropped from the array disappears from the order with no error, and a
  surface absent from both membership lists becomes `NOTE` with no error.
- Failing tests: `covers every SURFACE_ID exactly once, so no surface is unranked or
doubled`, `keeps band membership identical between attention and review order`,
  `gives every surface in a band the same band, whatever the diff looks like`.
- Repair: one `Record<SurfaceId, {order, level, label, rationale}>` table;
  `levelFor()` and `reasonFor()` read it; the sequence is sorted on `order`.
  Compile-time completeness proven separately (see `POLICY DECISION` note above).

### 3. Input order could reach the report through tied `displayPath` keys

- Investigation required by PHASE 12: **yes, duplicate `displayPath` can occur.** Two
  `diff --git` blocks in one patch may state the same path with different, separately
  proven facts. Stage 2 keeps blocks distinct (it does not merge or deduplicate them),
  and `summary.changedFiles` counts both, so the report legitimately holds two entries
  with one display path.
- Input A: `+line 1..3` added `dup.ts` then `-gone 1` deleted `dup.ts`.
  Input B: the same two blocks in the opposite order.
- Before (pre-repair probe, `stage4/probe-before.txt`): `D|IDENTICAL=false`,
  `D|jsonIdentical=false`; `E|IDENTICAL=false`, `E|jsonIdentical=false` for
  `src/app.ts` changed with 4 lines vs 1 line. Same facts, two different byte
  streams — a stable sort preserves input order for comparator-equal keys, which is
  exactly the violation PHASE 12 warned about.
- Failing tests: `keeps the same order for two diff blocks that share a display
path`, `orders same-path blocks by their reported line counts, not by diff order`,
  `breaks a same-path tie on mode, binary and surface facts`.
- Repair: `sortFiles` uses `compareFileFacts`, a lexicographic comparison over every
  field a `ChangedFile` reports — `displayPath`, `status`, `additions`, `deletions`,
  `binary`, `modeOnly`, `oldPath`, `newPath`, `oldMode`, `newMode`, `similarity`,
  `surfaces` (comma-joined; surface ids contain only `[a-z-]`, so the key cannot
  conflate two lists), `generated`. Nulls sort before values by explicit nullable
  comparators; text compares by code unit; no `localeCompare`, no `Intl.Collator`.
- After: `D|sectionsIdentical=true D|jsonIdentical=true
files=[["dup.ts","added",3],["dup.ts","deleted",0]]`,
  `E|sectionsIdentical=true E|jsonIdentical=true
files=[["src/app.ts","modified",1,1],["src/app.ts","modified",4,4]]`.
- Determinism argument: if two entries compare equal on all thirteen fields their
  serialized objects are identical, so no observable output can depend on which came
  first. That is why no further artificial tie-break (original index, hash) was added.

### 4. The primary CLI format could not show WHY

- Input: the eleven-surface diff, rendered with `renderPretty` (the CLI default).
- Before: the `REVIEW ORDER` block was only `1. CI / Build` … `11. Generated Files`;
  the reason existed in JSON and Markdown but nowhere a maintainer looks first. Under
  the explainability contract the stage could not be called complete.
- Failing tests: `makes the reason for every entry visible in Markdown and in pretty
output`, `keeps pretty order lines within a terminal width and loses no text`.
- Repair: each entry now prints its reason on indented continuation lines, word-wrapped
  so no line exceeds 80 columns. Deliberately minimal — the renderer's structure,
  headings, colour handling and other blocks were not redesigned.
- After: measured `maxLineWidth=80`; the block is read back by the test suite and
  equals the report entry for entry, so wrapping loses no text.

### 5. Band semantics were asserted nowhere and documented nowhere

- Before: `FOCUS/CHECK/NOTE` appeared in output and in `docs/architecture/overview.md`
  only as "a documented priority array … not a severity ranking"; nothing tested that
  a band is not a grade, and no document enumerated the bands.
- Failing tests: the three documentation-binding cases (`publishes the band table in
architecture documentation`, `documents exactly the sequence analyzeDiff produces`,
  `states that evidence relationships do not move the order`) plus
  `never lets a band name read as a grade in either renderer`.
- Repair: `docs/architecture/overview.md` gained a `### Review bands` section whose
  fenced table is parsed by the test suite and compared against the live
  `analyzeDiff()` output, so documentation and shipped policy cannot drift; README,
  `packages/core/README.md` and both detector docs now state the same contract.

## INPUT ORDER DETERMINISM

All proofs use fixed, seeded and exhaustive permutations — no `Math.random()`, no
timing input; the seeded generator is a documented LCG with seed `20260926`, so a
recorded pass is reproducible on any machine.

| Experiment                                                                       | Orders compared                        | Result                                                                                                |
| -------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| All eleven surfaces, whole-file blocks permuted                                  | 40 seeded + reverse + 2 rotations = 43 | byte-identical `renderJson`, and identical attention/evidence/review-order sections                   |
| Five-surface subset                                                              | all 120 permutations (exhaustive)      | byte-identical                                                                                        |
| Four files inside one surface                                                    | all 24 permutations (exhaustive)       | identical order sections                                                                              |
| Mixed kinds: content, mode-only, binary, rename, truncated, added, deleted, test | 30 seeded + reverse                    | byte-identical                                                                                        |
| Distinct-path corpus of 12 paths, including Unicode                              | 30 seeded                              | byte-identical, code-unit order preserved                                                             |
| Two hunks swapped inside one file                                                | 2                                      | byte-identical                                                                                        |
| Same input analysed 20 times                                                     | 20                                     | 1 distinct output                                                                                     |
| Duplicate `displayPath`, distinguishable facts                                   | forward + reversed                     | identical after defect 3 repair                                                                       |
| Detector registration order rotated by 4, and reversed                           | 3 orders                               | identical sections, with non-vacuity proven: `files[].surfaces` order visibly changed in the same run |

## SORTING

`compareCanonicalText` retained: plain code-unit `<`/`>` comparison, no locale, no
collator, antisymmetric and transitive (swept over a 26-value corpus including the
empty string and `-0`-free comparisons). `tests/stage3c.release.test.ts` still pins
the corpus order and forbids `localeCompare`/`Intl.Collator` in `analyze.ts`.

**Duplicate-`displayPath` finding: duplicates are reachable, and they mattered.** See
defect 3; the tie-break is now total over reported facts, which is the strongest
available answer — no arbitrary residual key was invented.

## MULTI-SURFACE FILES

A file that matches several surfaces is listed once under each of those surfaces and
nowhere twice; three stacked authentication files do not move `auth-access` anywhere
(`does not let several multi-surface files boost a surface or duplicate an entry`,
and the pairwise positions suite covers all 110 ordered surface pairs). Surface
overlap is not a weight anywhere in the code path.

## RENAMES

The eight directed cases are qualified in both directions (`runtime→auth`,
`auth→runtime`, `generated→runtime`, `runtime→generated`, `docs→contract`,
`contract→docs`, `config→runtime`, `runtime→config`): the union of old-path and
new-path surfaces feeds the order, each surface contributes one entry, the renamed
file is listed once per entry, and the forward and reversed diffs produce identical
positions. Nothing depends on which side the diff names first.

## MODE-ONLY, BINARY, DIAGNOSTICS

A mode-only or binary change keeps its surface, its band and its position even though
it reports no line counts (`keeps the surface of a mode-only change to …`,
`orders a mode-only authentication file by policy, not by its missing line counts`,
`orders the binary … file by policy`). Because those changes show no content, their
reasons say `files changed` and never `content` or `line`; that distinction is
asserted over the corpus rather than left to reading. A hunk diagnosed as truncated
stays in the order its proven path claims, and a malformed block beside a usable file
contributes a diagnostic without inventing a surface.

## UNKNOWN PATH AND EMPTY INPUT

The `<unknown path>` presentation sentinel and unclassified paths claim no surface, so
they produce no attention row, no review-order entry and no evidence; positions remain
contiguous from 1 for every subset that does appear, and an empty diff yields three
empty sections. No placeholder reaches a policy input.

## EVIDENCE / ORDER SEPARATION

The existing separation between `evidence` and `reviewOrder` is retained rather than
merged: evidence states relationships, order states a reading sequence, and the two are
computed independently. New invariance tests prove the separation is real: with and
without `auth-without-tests`, with and without `manifest-without-lockfile`, and with
and without `generated-volume`, the relative sequence of the shared surfaces is
unchanged (`reports the same positions for authentication with and without its
companion evidence`, `keeps evidence presence out of the ordering of unrelated
surfaces`). No hidden boost was introduced; there is no boost mechanism in the code.

## EXPLAINABILITY

Every entry now answers "what surface, how many files, why here" from the policy that
places it. Copy invariants enforced across a 16-input hostile corpus: no circular
recommendation text; the only digit in a reason is the observed file count; no
percentage; reason title equals the attention row title; and no wording from
`risk*/sever*/vulnerab*/danger*/unsafe/insecure/safe/confidence/probabilit*/likely/
mergeab*/coverage/score/critical/importan*/percent/has no tests/must review`, nor
`should/must/need/block/approv*/reject*`. Binary and mode-only reasons stay truthful
about files, not content.

## LEVEL SEMANTICS

`FOCUS`, `CHECK` and `NOTE` are navigation bands. They are tested to be exactly the
three documented names, exactly one per surface across the whole hostile corpus,
identical between the attention row and the review-order entry, and never rendered
with severity, risk, critical, urgency, priority, confidence or grade wording in
Markdown, pretty or JSON output. Documentation states the same in one place that the
test suite parses.

## SCHEMA

**Schema version unchanged: YES — still `"1"`.** No structural field was added,
removed or renamed; only the text of `reviewOrder[].reason` improved, which the schema
already describes as a string. No stop condition was reached: the explainability
contract was satisfiable inside the existing shape.

## TESTS

| Metric               | Before Stage 4         | After Stage 4          |
| -------------------- | ---------------------- | ---------------------- |
| Test files collected | 21                     | 24                     |
| Tests (Windows)      | 434                    | 545                    |
| Tests (Linux)        | 433 passed + 1 skipped | 544 passed + 1 skipped |

New files: `tests/stage4.attention-order.test.ts` (68), `tests/stage4.order-language.test.ts`
(28), `tests/stage4.order-determinism.test.ts` (15), plus the non-collected fixture
module `tests/stage4.order-fixtures.ts`. The historical `tests/stage4.release.test.ts`
was kept and still passes — `SURFACE_IDS` was deliberately **not** reordered, because
that array is the schema/classification vocabulary, not the review order. The
intentional Linux skip remains `tests/stage3c.release.test.ts:123` (Windows `cmd.exe`
shim cell).

## BUILD

`npm run build` clean on all four cells and in the working repository (core, cli,
action, web). `npm run typecheck`, `npm run lint --max-warnings=0` and
`npm run format:check` clean.

## ACTION BUNDLE

| Observation                                                               | SHA-256                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Committed bundle before Stage 4 (`7647df4:packages/action/dist/index.js`) | `04badcd97da60ed3e68892fc0fccd1a866cb584a754895c3f0fdd1aa16e42114` |
| Rebuild 1 after the repair                                                | `f8e39809bbbbd170a64c88bb6bde206ef4d45463a6f08000be2c5be9efa4d493` |
| Rebuild 2, immediately after rebuild 1                                    | `f8e39809bbbbd170a64c88bb6bde206ef4d45463a6f08000be2c5be9efa4d493` |
| Rebuild inside the clean Windows Node 24 clone                            | `f8e39809bbbbd170a64c88bb6bde206ef4d45463a6f08000be2c5be9efa4d493` |
| Rebuild inside the clean Linux Node 24 container (Git 2.39.5)             | `f8e39809bbbbd170a64c88bb6bde206ef4d45463a6f08000be2c5be9efa4d493` |

Byte-identical rebuild across two consecutive builds, two platforms and two Node
majors. `npm run action-smoke` passes; the bundled Action summary grew from its
previous size to 1251 bytes because reason text is now present, and
`cliLeak=false; hostilePaths=true; oversizeRejected=true` still hold. **No Action
adapter source change was needed** — the bundle differs only because the core changed.

## MANIFEST

`npm run manifest` → `SOURCE_MANIFEST.txt: 105 files` (was 101).

- Added: `tests/stage4.attention-order.test.ts`, `tests/stage4.order-determinism.test.ts`,
  `tests/stage4.order-fixtures.ts`, `tests/stage4.order-language.test.ts`.
- Removed: none.
- Changed hashes (8): `README.md`, `docs/architecture/overview.md`,
  `docs/detectors/authoring-detectors.md`, `docs/detectors/initial-detectors.md`,
  `packages/action/dist/index.js`, `packages/core/README.md`,
  `packages/core/src/analyze.ts`, `packages/core/src/render.ts` — eight entries
  changed in total, all of them files this stage deliberately edited.
- Nothing unrelated drifted. Host residue reappeared once as untracked
  `pnpm-lock.yaml` / `pnpm-workspace.yaml` during the commit window; both were
  quarantined to `stage3/host-residue/` outside the repository and never entered the
  index or the manifest.
- `npm run verify` passes: manifest reproduced from the index, tracked files match,
  working tree clean.

## GITHUB ACTIONS

Hosted CI for this stage was observed once after the final push and not re-run; see
`CI OBSERVATION` at the end of this report. The observation confirmed what prior stages
measured on this branch: the run's four jobs received no runner and failed with zero
steps, so the hosted result is `EXTERNAL CI BLOCKED`. That is an external billing
condition, not a source defect, and CI configuration was not altered to hide it.

## EXACT COMMANDS RUN

```bash
# gate + RED
git remote get-url origin; git branch --show-current; git rev-parse HEAD; git rev-parse origin/main
git merge-base --is-ancestor 8dd9953edb327475b043bba87ee4e37632ea1e5c HEAD
npx vitest run tests/stage4.order-language.test.ts tests/stage4.attention-order.test.ts tests/stage4.order-determinism.test.ts
npm test

# repair + verification
npm run format
npm run typecheck
npm run lint
npm run test
npm run build
git show HEAD:packages/action/dist/index.js | sha256sum
npm run action-smoke
npm run package-smoke
cp SOURCE_MANIFEST.txt ../stage4/SOURCE_MANIFEST.before.txt
git add <the twelve Stage 4 files>
npm run manifest
git add SOURCE_MANIFEST.txt
npm run verify
git diff --check
npm run check

# qualification cells (scripts live outside the repository, in ../stage4)
bash ../stage4/run-cell-windows.sh EMPTY win-node24
bash ../stage4/run-cell-windows.sh ../stage1/node22/node-v22.23.3-win-x64 win-node22
bash ../stage4/run-cell-linux.sh node:24 linux-node24
bash ../stage4/run-cell-linux.sh node:22 linux-node22
node ../stage4/probe-after.mjs

# commit
git -c user.name='Qoder Stage4' -c user.email='stage4-ordering@local.invalid' commit -m 'fix: qualify DiffBeacon attention ordering'

# report, push, single CI observation
npx prettier --write docs/audits/stage4-attention-ordering.md
npm run format:check
git add docs/audits/stage4-attention-ordering.md
git -c user.name='Qoder Stage4' -c user.email='stage4-ordering@local.invalid' commit -m 'docs: record DiffBeacon Stage 4 ordering qualification'
git push origin rescue/stage0-source
gh run list --branch rescue/stage0-source -L 3 --json databaseId,headSha,status,conclusion,workflowName,createdAt
gh run view 36218540411 --json status,conclusion,headSha,number,startedAt,updatedAt,jobs
gh api repos/Pavithran-R-A/DiffBeacon/actions/runs/36218540411 --jq '{status,conclusion,billable}'
```

The report was committed before the push, so its `CI OBSERVATION` section was drafted
without a run to cite; the figures now in that section come from the two `gh` reads
above, made after `git push`. An earlier `gh run view` call in the same observation used
field names this CLI version does not expose (`runStarted`) and returned a field-list
error rather than run data; the corrected call is the one recorded here. The CI run was
never re-triggered, and no `gh run rerun` command was issued.

Each cell ran, in order: `npm ci`, `npm run format:check`, `npm run lint`,
`npm run typecheck`, `npm run test`, `npm run build`, `npm run package-smoke`,
`npm run action-smoke`, `npm run verify`, `npm run check`.

## LOCAL QUALIFICATION MATRIX

All four cells cloned `rescue/stage0-source` at `d2ff91a5…` with `--no-hardlinks` into
a fresh directory; every cell started and ended with a clean worktree
(`worktree_clean_at_start=0`, `untracked_after=0`).

| Cell                                                                | Node / npm         | Git              | autocrlf | Gates | Result                                  |
| ------------------------------------------------------------------- | ------------------ | ---------------- | -------- | ----- | --------------------------------------- |
| Windows host, disposable clone                                      | v24.21.0 / 11.19.0 | 2.55.0.windows.5 | `true`   | 10/10 | PASS — 24 files, 545 tests              |
| Windows host, portable Node 22                                      | v22.23.3 / 10.9.9  | 2.55.0.windows.5 | `true`   | 10/10 | PASS — 24 files, 545 tests              |
| Linux container `node:24`, source in `/tmp` (overlay, not `/mnt/c`) | v24.21.0 / 11.19.0 | 2.39.5           | unset    | 10/10 | PASS — 24 files, 544 passed + 1 skipped |
| Linux container `node:22`, source in `/tmp`                         | v22.23.3 / 10.9.9  | 2.39.5           | unset    | 10/10 | PASS — 24 files, 544 passed + 1 skipped |

Per-cell logs are kept outside the repository under
`stage4/cells/<cell>/logs/`, together with `env.txt`, `test-totals.txt`,
`worktree-after.txt` and the rebuilt bundle digest.

## WORKING TREE STATE

Clean at every commit point: `git status --short` lists only the files staged for this
stage, `git diff --check` is silent, and no disposable clone, container log, portable
runtime, manifest-excluded audit report, `node_modules`, or pnpm host file was ever
staged. `docs/audits/` stays out of the manifest by design, so this document adds no
manifest entry.

## REMAINING ORDERING LIMITATIONS

1. The sequence is a documented convention, not a measurement of importance. A team
   whose review habits differ can disagree with it; the policy is now explicit enough
   to argue with, which is the whole point, but disagreement costs a table edit and a
   test update, not a debate about unstated intent.
2. Positions are per-surface, not per-file. A one-line `Dockerfile` edit and a
   thousand-line one both put `infrastructure` at position 4; magnitude is deliberately
   excluded, so large and trivial changes on the same surface are indistinguishable in
   the order.
3. Reasons state a file count and a convention. They cannot say _which_ file in the
   surface is worth the reviewer's time; the `files` list is there for that, and the
   CLI/Action still does not rank files inside a surface.
4. Band names are still opaque to a first-time reader — `FOCUS` reads like a grade even
   though it is not. Renaming them would be a schema-visible copy change and was not in
   scope here.
5. The pretty `REVIEW ATTENTION` block still prints `1 files` for a single file. That
   wording is pre-existing, is an attention-row count rather than an ordering claim, and
   was left alone to keep this stage inside its boundary; the CLI stage is the natural
   place to fix it.
6. Duplicate `displayPath` entries remain two entries in the report. Ordering is now
   deterministic over them, but nothing says whether a patch that repeats a path is
   well-formed — that is a parser-stage question, and guessing here would be worse.
7. Surface-level ordering does not understand cross-surface dependency (a migration
   that only makes sense with its model change still reads as two unrelated entries).
   Any fix would need semantics, which DiffBeacon explicitly refuses to have.

## STAGE 4 DECISION

**PASS.**

Ordering is deterministic and independent of irrelevant input order, proven by 43
seeded, 120 + 24 exhaustive, mixed-kind, hunk-order, repeat, duplicate-path and
registration-order experiments; it is explainable, because each entry now states its
own observed file count and the documented convention that places it, in all three
renderers; it is centralized, because position, band, label and rationale are one
compile-checked table; band semantics are qualified as navigation, not severity, in
tests and in documentation; multi-surface, rename, mode-only, binary, diagnostic,
unknown-path and empty inputs are all handled without fabrication or hidden boosting;
no numeric risk score, probability or confidence exists anywhere in the ordering path;
the schema is unchanged at `"1"`; the Action bundle rebuilds byte-identically on two
platforms; the manifest and `npm run verify` are consistent; and all ten gates pass in
four clean-clone cells.

## NEXT RECOMMENDED ROADMAP STAGE

**Stage 5 — CLI.** The ordering contract is now stable enough for the CLI to build on:
the remaining CLI-side gaps surfaced by this stage are output ergonomics (per-file
ordering inside a surface, the `1 files` attention-row wording, and whether the range
summary should surface the reason text differently).

**Do NOT begin Stage 5.** This authorization covered one roadmap stage only; Stage 5
requires its own qualification prompt.

## CI OBSERVATION

Made once, after the final non-forced push of `rescue/stage0-source`
(`7647df4..888fe10`), by listing and viewing the run that push produced. No re-run was
triggered and no CI configuration was changed.

| Field                   | Observed value                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Run                     | `36218540411` (workflow run number 18, workflow `CI`)                                                            |
| URL                     | <https://github.com/Pavithran-R-A/DiffBeacon/actions/runs/36218540411>                                           |
| Head SHA                | `888fe10c80feab7ad0e88003cf016a47a34c1bb8` (this report's commit)                                                |
| Trigger                 | `push` to `rescue/stage0-source`, `createdAt` 2026-09-26T04:40:45Z                                               |
| Jobs                    | 4 — `Node 24 / ubuntu-latest`, `Node 24 / windows-latest`, `Node 22 / ubuntu-latest`, `Node 22 / windows-latest` |
| Runner                  | none assigned to any job                                                                                         |
| Steps                   | `[]` for all four jobs — no checkout, no `npm ci`, no gate executed                                              |
| Job conclusions         | all four `failure`, each completing 2–38 s after queueing with no log output                                     |
| Run status / conclusion | `completed` / `failure`                                                                                          |
| `billable`              | `null`                                                                                                           |

Outcome: **EXTERNAL CI BLOCKED**. The four jobs failed before any step could run, which
is the signature of this account receiving no hosted runner rather than of a source or
gate defect — the same condition every previous stage on this branch recorded (for
example run `36214183341` at head `7647df4…`). The hosted result therefore does not
confirm and was not used to confirm Stage 4: the qualification evidence is the ten
gates plus the four clean-clone cells above, all of which ran locally and passed. CI
configuration was not modified to hide this, and the run was not re-triggered to make
the failure look different.

Recording this observation required a second commit to this file, so the follow-up
docs-only push produced one further run on the same branch with the same blocked
signature; it was read once from the same `gh run list` output and neither re-run nor
cancelled. Its identifier is not written into this document because doing so would
require another push and another run — the auditor receives it in the Stage 4 handoff
response instead.
