# DIFFBEACON STAGE 3 — DETECTOR SYSTEM REPORT

Qualification of the detector system in `packages/core`: eleven path-based detectors, the
classification path from parsed diff to surface, the evidence relationships built on those surfaces,
and the false-positive behaviour of every rule. The goal was narrow, deterministic, documented,
false-positive-resistant detectors that are truthful about what a changed path proves — not more
detectors.

## STATUS

`PASS` — every detector is qualified against a positive/negative corpus, a near-miss false-positive
corpus, rename semantics, unproven-path safety, mode-only semantics and count-dependent evidence.
Seven measured defects were repaired under TDD. The detector count did not change: 11 IDs before,
11 IDs after, no additions and no removals.

```text
STARTING SHA:   0d0d32008a77438f144a792c5f315e39b5fdeb01  docs: record DiffBeacon Stage 2 closure CI observation
FIX COMMIT:     eb7902d7c45b4908e2c578337f4407f35e9133f6  fix: qualify DiffBeacon detector system
ENDING SHA:     documentation-only commits on top of the qualified tree; `3722129` is the tip the
                single CI observation below was made against, and the commit that carries this
                sentence follows it. All of them touch only `docs/audits/`, so no hashed file changes.
BRANCH:         rescue/stage0-source
ORIGIN MAIN:    e0ff98143bfe39c80338518d006525a846a8739  (not merged, no PR, no tag, no npm publish)
REPOSITORY:     https://github.com/Pavithran-R-A/DiffBeacon.git
QUALIFIED TREE: eb7902d7c45b4908e2c578337f4407f35e9133f6 — every platform cell cloned this commit
                from a git bundle rather than from the working directory
```

Scope discipline observed: no Stage 4 attention-order redesign (`reviewPriority` and `levelFor()` are
byte-for-byte unchanged), no Stage 5 CLI expansion, no Stage 6 Action redesign, no Stage 7 browser
work, no Stage 8 security-hardening expansion, no package publication, no tag, no release, no
deployment. No existing test was deleted.

## DETECTOR INVENTORY — BEFORE / AFTER

|                            | Before (`0d0d320`) | After (`eb7902d`)                              |
| -------------------------- | ------------------ | ---------------------------------------------- |
| Registered detector IDs    | 11                 | 11                                             |
| Added IDs                  | —                  | 0                                              |
| Removed IDs                | —                  | 0                                              |
| Renamed IDs                | —                  | 0                                              |
| Generic `security` surface | absent             | still absent (see SECURITY-SENSITIVE DECISION) |

`ci-build`, `auth-access`, `database-schema`, `dependencies`, `api-contracts`, `configuration`,
`infrastructure`, `tests`, `documentation`, `generated`, `runtime` — identical set, identical
registration order, identical `SurfaceId` union.

What changed is the behaviour and the documented boundary of three rules (`configuration`, `runtime`,
`generated`) plus the shared classification and evidence plumbing that reads them — not the catalog.

## DETECTOR CONTRACT

A detector is `{ id, title, description, matches(path) }` — a pure path predicate with no filesystem,
network, Git, LLM or runtime access, and no state.

| Contract element | Guarantee after Stage 3                                                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority        | `consideredPaths(file)` = the parser-proven `oldPath` and `newPath`. `displayPath` is presentation only and is never matched.                                                                         |
| Unproven paths   | `UNKNOWN_PATH_SENTINEL` (`<unknown path>`) is exported from `model.ts` and filtered out, so an unproven file claims no surface, no attention row, no review-order entry and no evidence.              |
| Renames          | Surfaces are the deterministic union over both sides, ordered by registration. A file renamed out of a surface keeps reporting it.                                                                    |
| Added / deleted  | One side is `null`; the side that exists is used.                                                                                                                                                     |
| Mode-only        | Classified (a `chmod` on `package.json` genuinely touches `dependencies`) but excluded from every relationship, which is a claim about content.                                                       |
| Nullable counts  | `null` means "not observed", never zero. Count-dependent evidence is emitted only when every content-bearing file reports counts and no hunk was diagnosed as miscounted.                             |
| Multi-surface    | Deliberate and documented (`src/auth/session.ts` is `auth-access` + `runtime`).                                                                                                                       |
| Truthfulness     | No detector or message may state or imply vulnerability, coverage quality, correctness, production impact, or a merge recommendation. Enforced by a forbidden-word invariant over all generated copy. |
| Determinism      | Same input → identical report; classification never mutates its input. Covered by invariants.                                                                                                         |

## PER-DETECTOR QUALIFICATION MATRIX

| ID                | Level | Positive evidence proven                                                                                                                                  | Negative / false-positive evidence proven                                                                                  | Documented boundary                                                                                                                                                                                     |
| ----------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci-build`        | FOCUS | workflows dir, composite actions dir, `Jenkinsfile`, `buildkite.yml`, `azure-pipelines.yml`, `.circleci/config.yml`, `Makefile`, `Taskfile.yml`           | `docs/workflows.md`, `buildkite-notes.md`, `Makefile.md`, `.github/ISSUE_TEMPLATE/bug.yml`                                 | path conventions only; prose naming a tool is not CI                                                                                                                                                    |
| `auth-access`     | FOCUS | `auth`, `authorization`, `permissions`, `rbac`, `acl`, `access-control` segments; delimited `auth`/`identity`/`session`/`permission` stems                | `src/authentic.ts`, `src/author.ts` (near-miss corpus); `src/oauth/client.ts` is a documented miss, not a tested case      | `src/oauth/client.ts` is a known miss; never implies a vulnerability                                                                                                                                    |
| `database-schema` | FOCUS | `migrations`, `migration`, `alembic`, `prisma` segments; `db/migrate/**`, `drizzle/**`, `db/drizzle/**`; `schema.prisma`, `schema.sql`, `*.migration.sql` | `src/schemas/form.ts`, `docs/migration-guide.md`                                                                           | overlap with `runtime` for `.rb`/`.py` migrations is truthful, not a bug                                                                                                                                |
| `dependencies`    | CHECK | 11 manifest names + 11 lockfile names, at any depth                                                                                                       | `package.example.json`, `package-lock-notes.md`                                                                            | manifest and lockfile remain separate facts inside one surface                                                                                                                                          |
| `api-contracts`   | CHECK | `openapi.*`, `swagger.*`, `.graphql`, `.gql`, `.proto`, `openapi` segment, `api/**` delimited `schema`/`contract`                                         | `src/api/client.ts`, `src/schemas/form.ts`, `docs/openapi-guide.md`                                                        | does not claim to catch every public-API change                                                                                                                                                         |
| `configuration`   | CHECK | `config` segment, plus one-word `config.<ext>` / `<word>.config.<ext>` / `<word>-config.<ext>`, `tsconfig.json`, `.env.example`                           | `src/configuration.ts`                                                                                                     | `vite.config.ts` / `webpack.config.js` are `configuration` only, no longer also `runtime`; `src/config/loader.ts` is deliberately both; extra-dot shapes such as `my.app.config.js` are a measured miss |
| `infrastructure`  | FOCUS | `Dockerfile`, `docker-compose*`, `.tf`, `.tfvars`, `terraform`, `kubernetes`, `k8s`, `helm`, `deploy`, `manifests`                                        | `deployment.ts` at the repository root, `docs/docker-notes.md`, `charts/app/templates/pod.yaml` (documented miss)          | `charts/app/templates/pod.yaml` is a known miss; no cloud/outage inference                                                                                                                              |
| `tests`           | NOTE  | `test`, `tests`, `spec`, `specs`, `__tests__`, `fixtures` segments; `*.test.*`, `*_test.go`, `test_*.py`                                                  | `src/contest.ts`, `src/latest.ts`, `src/test-utils/helper.ts`                                                              | never states whether coverage exists or is adequate                                                                                                                                                     |
| `documentation`   | NOTE  | `docs` segment, `README`/`CHANGELOG`/`CONTRIBUTING`/`SECURITY`/`CODE_OF_CONDUCT`, `release-notes*`, `.md`, `.mdx`                                         | code files with prose-like names                                                                                           | no judgement of documentation completeness                                                                                                                                                              |
| `generated`       | NOTE  | `dist`/`generated` segments, repository-root `build/`, `.generated.ts`, `.generated.js`, `.min.js`, `.map`                                                | `src/build/index.ts`, `packages/build/src/index.ts`, `src/builders/compiler.ts`, `vendor/min.js`, lockfiles inside `dist/` | `packages/app/build/index.js` is a known miss                                                                                                                                                           |
| `runtime`         | CHECK | 19 implementation extensions outside tests/docs/generated/config filenames                                                                                | `tests/app.test.ts`, `docs/guide.md`, `dist/app.js`, `vite.config.ts`                                                      | no semantic interpretation of code                                                                                                                                                                      |

## DEFECTS FOUND — MEASURED, REPRODUCED, REPAIRED

Every defect below was reproduced as a failing assertion against `0d0d320` before the production
change was written. The battery method (119 fixed diff inputs classified by the old and the new
build, then compared) is described in `## PROBE BATTERY`.

### D1 — a rename erased surfaces from the file that still carries them

- Pre-fix behaviour: classification read `displayPath` only, so a rename reported the destination
  path and nothing else. `package.json → package.old.json` classified as no surface at all.
- Failing fixture: rename hunk for `package.json → package.old.json` expected `["dependencies"]`
  plus `manifest-without-lockfile`; observed `[]` and no evidence.
- Root cause: `classifyFile()` matched `file.displayPath`, a presentation field, and the parser sets
  `displayPath` to the new path.
- Repair: exported `UNKNOWN_PATH_SENTINEL` from `model.ts`; added `consideredPaths()` and
  `matchesSurface()` in `registry.ts`; `classifyFile()` now unions matches over both proven paths.
- Post-fix: rename keeps the abandoned surface in `surfaces`, in the attention row, and in the
  review-order entry; the destination is what `displayPath` and the file list show.

### D2 — nested `build` directories turned hand-written code into generated output

- Pre-fix behaviour: `hasSegment(path, 'build')` matched any depth, so `src/build/index.ts` and
  `packages/build/src/index.ts` were classified `generated` and — because `runtime` excludes
  generated paths — vanished from `runtime` entirely.
- Failing fixture: `src/build/index.ts` expected `["runtime"]`; observed `["generated"]`.
- Root cause: a segment test was used where a directory-location test was meant; `build` is also a
  common hand-written module name.
- Repair: `isGeneratedPath()` now requires the repository-root output directory
  (`normalized.startsWith('build/')`) while `dist`/`generated` remain segment tests.
- Post-fix: nested `build` modules are `runtime`; root `build/out.js` is still `generated`.
  `packages/app/build/index.js` is now a documented miss rather than a silent misclassification.

### D3 — configuration files were also labelled runtime implementation

- Pre-fix behaviour: `vite.config.ts`, `webpack.config.js` classified as `["configuration",
"runtime"]`, overstating that a tooling config is application implementation.
- Failing fixture: `vite.config.ts` expected `["configuration"]`.
- Root cause: `runtime` subtracted only tests, documentation and generated output, never config
  filenames, while `configuration` carried its own hand-enumerated filename tests
  (`/(^|\.)config\.[^.]+$/`, `.config.js`, `.config.ts`, plus a duplicated `vite.config.ts` literal)
  that `runtime` could not see. `vite.config.ts`, `webpack.config.js` and `eslint.config.js` were all
  already `configuration` before the repair — verified by replaying the old predicate — so the defect
  was the overlap, not a missed config.
- Repair: one shared `isConfigFilename()` now used by both rules, so `configuration` and `runtime`
  read exactly the same convention. The convention broadened to any extension and to the
  dash-separated form (the replayed `before=["runtime"]` / `after=["configuration"]` for
  `rollup-config.js`) and narrowed for two exotic name shapes, measured below.
- Post-fix: bundler/tooling configs are `configuration` only. A hand-written module inside a config
  directory (`src/config/loader.ts`) is deliberately still both — that is documented, not suppressed.
- Measured boundary replay (`../stage3/probe/config-boundary.mjs`, output in
  `../stage3/probe/config-boundary.txt`; it loads the pre-repair bundle captured as
  `../stage3/probe/before/core.mjs` against the `eb7902d` detector build in the Windows/Node 22
  qualification clone, so the two sides are the real matchers, not paraphrases):
  `vite.config.ts`, `webpack.config.js`, `eslint.config.js` and `config.ts` moved
  from `["configuration","runtime"]` to `["configuration"]`; `app.config.json`, `jest.config.mjs` and
  `babel.config.cjs` were already `configuration` alone and are unchanged; `rollup-config.js` moved
  from `["runtime"]` to `["configuration"]`. Three exotic name shapes got narrower and are recorded as
  limitations: `my.app.config.js` and `.config.js` are now `runtime` only (the old inline regex
  accepted a `config.` reached through a second dot or a leading dot), and `.config.json` now matches
  no surface at all.

### D4 — mode-only changes produced relationship evidence about content they never showed

- Pre-fix behaviour: a pure mode change (`100644 → 100755`, zero content) was counted as a content
  change for relationship purposes, so `chmod` on `package.json` reported
  `manifest-without-lockfile`, and `chmod` on a test file suppressed genuine `runtime-without-tests`
  evidence.
- Failing fixture: mode-only `src/auth/session.ts` expected no `auth-without-tests`; observed one.
- Root cause: `evidenceFor()` read `files` directly with no notion of "the diff shows this file's
  content".
- Repair: all seven relationships are computed from `contentBearing = files.filter(f => !f.modeOnly)`
  (binary/mode-only semantics preserved elsewhere), and the messages now say "content changes".
- Post-fix: mode-only files are classified but can be neither the missing half nor the proving half
  of a relationship. Volume metrics likewise count content-bearing files.

### D5 — fabricated line-share numbers when counts were unknown

- Pre-fix behaviour: `generated-volume` always reported `generatedChangedLines`, `totalChangedLines`
  and `generatedLineShare`, summing `additions ?? 0` / `deletions ?? 0`. For a diff whose generated
  files were binary (counts `null`), it published `generatedLineShare: 0` next to the message
  "Generated-file changes account for a large share of this diff and may obscure the smaller
  hand-written change set." — a number and a claim the diff never supported, since the trigger had
  come from the file share.
- Failing fixture: binary generated files expected metrics limited to file-count keys and a message
  disclaiming a line share; observed `generatedLineShare: 0`.
- Root cause: nullable "not observed" was collapsed to `0`, and no check existed for
  count-affecting diagnostics.
- Repair: `countsTrustworthy` = no `malformed-hunk` / `truncated-hunk` / `hunk-count-mismatch`
  diagnostic AND every content-bearing file reporting both counts. The volume trigger becomes
  `generated >= 2 && (fileShare >= 0.5 || (countsTrustworthy && lineShare >= 0.5))`; when counts are
  untrustworthy only `generatedFiles`, `changedFiles` and `generatedFileShare` are emitted, with a
  message that states no line share is claimed.
- Schema impact: none. `evidence.metrics` is `additionalProperties: number` with no required keys, so
  omitting keys is schema-valid. No renderer prints metrics, so no output contract changed.

### D6 — manifest/lockfile predicates were rename-unaware

- Pre-fix behaviour: the relationship helpers called `isDependencyManifest(file.displayPath)`, so a
  renamed manifest produced surfaces (after D1) but no companion evidence.
- Failing fixture: rename `package.json → package.old.json` expected `manifest-without-lockfile`.
- Root cause: two different path-reading conventions in one module — surfaces via `classifyFile`,
  relationships via `displayPath`.
- Repair: `matchesSurface(file, isDependencyManifest / isLockfile)` for both sides.
- Post-fix: surfaces and relationships agree on exactly one notion of authority.

### D7 — evidence wording claimed facts about coverage and about the repository

- Pre-fix behaviour: the message read verbatim "Runtime files changed, but no test-file changes were
  observed in this diff. Confirm existing coverage is sufficient." — an instruction that presumes
  coverage exists and was forgotten.
- Root cause: copy drift, not a code defect; caught while qualifying D4.
- Repair: every relationship message is phrased as observation about this diff ("No test-file content
  changes were observed in this diff."). The "Confirm existing coverage is sufficient." sentence was
  removed. `README.md` and `AUDIT_HANDOFF.md` were corrected to quote the new strings.
- Post-fix: a forbidden-word invariant now guards `evidence.message`, attention and review-order copy.

## RENAMES

- Surfaces for a rename are the union over `oldPath` and `newPath`; nothing is subtracted because the
  destination is clean.
- A manifest renamed away still reports `dependencies` and still raises `manifest-without-lockfile`.
- A test file renamed away no longer counts as a test-file content change, so
  `runtime-without-tests` reappears — the correct reading, and covered by a test.
- `displayPath` remains the destination path, so the changed-file list, Markdown table and terminal
  rows are unchanged in shape.
- Rename detection is the parser's Stage 2 job; Stage 3 only consumed `oldPath`/`newPath`.

## UNKNOWN PATH

- `UNKNOWN_PATH_SENTINEL` is a single exported constant used by the parser's `finalize()` and by
  `consideredPaths()`, so the guarantee cannot depend on two literals agreeing.
- A file whose paths could not be proven contributes no surface, no attention row, no review-order
  entry, and no evidence — proven by test, including the case where a real repository file is
  literally named `<unknown path>` (same treatment; the safe direction, documented).
- Header-shaped diff content (`--- a/<unknown path>`) stays inert because parsing, not detectors,
  owns path provenance.

## GENERATED

`generated` recognises `dist` and `generated` segments, the repository-root `build/` directory, and
`.generated.ts`, `.generated.js`, `.min.js`, `.map` suffixes, with lockfiles excluded even under
`dist/`.

The Stage 3 decision on `build`: keep it, but only as a root-prefix rule. A nested `build` segment is
as often a hand-written module whose domain is building as it is output, and misclassifying source as
generated silently removes it from `runtime` — the worst direction of error, because the file
disappears from review attention. `packages/*/build/` output is accepted as a documented miss instead
of being guessed at.

Volume evidence stays objective and count-honest (see D5): a share of files is always provable, a
share of lines is stated only when every content-bearing file reported counts.

## RUNTIME

`runtime` is the residual implementation surface: 19 code extensions minus tests, documentation,
generated output and config filenames.

Config overlap was the Stage 3 finding (D3). Resolution: a configuration _file_ is not implementation
(`vite.config.ts` → `configuration` only), while a hand-written module in a configuration _directory_
is honestly both (`src/config/loader.ts` → `configuration`, `runtime`). That asymmetry is documented
rather than flattened, because collapsing it either hides source or overstates configs.

## MODE-ONLY

A mode change is classification evidence, not content evidence. `chmod` on `package.json` is
`dependencies`; `chmod` on `src/auth/session.ts` is `auth-access` + `runtime`. Neither can raise or
suppress a relationship, because a relationship asserts that some content did or did not appear
alongside other content. Mode-only files remain in the changed-file list, the summary
(`modeOnlyFiles`), attention rows and review order — suppression was considered and rejected as
untruthful about what the diff shows.

## EVIDENCE

Seven relationships, unchanged in kind, now honest in prerequisites: `runtime-without-tests`,
`auth-without-tests`, `database-without-tests`, `manifest-without-lockfile`,
`lockfile-without-manifest`, `contract-without-docs`, `generated-volume`.

| Rule                                                      | Proves                                                                                                                | No longer proves                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `*-without-tests` (3)                                     | no test-file content change was observed in this diff                                                                 | that coverage is missing, weak, or the author's fault                  |
| `manifest-without-lockfile` / `lockfile-without-manifest` | one side of a dependency pair changed in content, the other was not observed                                          | that the lockfile is stale or that installing will resolve differently |
| `contract-without-docs`                                   | a contract file changed with no documentation content change observed                                                 | that documentation is required or absent from the repository           |
| `generated-volume`                                        | generated files are ≥ half the content-bearing change set by file count, or by line count when counts are trustworthy | any line share when counts are null or a hunk was diagnosed            |

Nullable counts (`additions`, `deletions`) are read as "not observed"; `surfaceObservation` totals keep
the `?? 0` reduce because a per-surface line count is a summary of observed lines, and the JSON schema
requires those fields — that distinction is documented rather than silently changed.

## SECURITY-SENSITIVE DECISION

`NO NEW GENERIC SECURITY DETECTOR — insufficient narrow evidence.`

A `security-sounding` surface (matching `crypto`, `secret`, `token`, `password`, `oauth`, `tls` in
paths) would fire on documentation, fixtures, naming conventions and vendored code with no way to
bound the false positives by path alone, and it would blur the existing `auth-access` claim that IS
bounded and tested. `src/oauth/client.ts` staying outside `auth-access` is recorded as a known miss
instead of being patched with a vague rule. The decision, its reasoning and the alternative that was
rejected are written into `docs/detectors/authoring-detectors.md`.

## REGISTRY INVARIANTS

Covered by `tests/stage3.detectors.test.ts`:

- Registered detector IDs are exactly `SURFACE_IDS`, in the same order, with no duplicates.
- Every `description` ends with `changed.` — a sentence about observation.
- A forbidden-word regex over every detector title/description rejects vulnerability, severity,
  "safe to merge", coverage-quality and correctness language.
- `matches()` is deterministic across repeated calls and classifies without mutating its input.
- `matchesSurface`/`consideredPaths` never receive the sentinel.

## PROBE BATTERY

A 119-entry battery of synthetic diffs (surfaces, renames, mode-only, counts, truncation, binary,
hostile paths) was classified by the pre-fix build and by the repaired build outside the repository,
in `../stage3/probe/`.

- 105 entries identical before and after.
- 14 entries changed, and every change is one of D1–D7's intended effects (config/runtime boundary,
  nested `build`, rename surfaces, mode-only relationships, conditional line-share metrics).
- No entry lost a surface or gained one outside the documented repairs.

This is the measurement that shows the repairs did not drift: the change set is exactly the intended
set.

## DOCUMENTATION

- `docs/detectors/initial-detectors.md` — new "Classification contract" table (authority, renames,
  added/deleted, unproven paths, mode-only, nullable counts, deliberate multi-surface) plus per
  detector: Recognizes / Examples / Does-not, including every known miss.
- `docs/detectors/authoring-detectors.md` — what a detector may and may not claim, a 10-item required
  checklist for a new detector (stable ID, conservative matcher, positive test, negative test,
  false-positive regression, rename consideration, `<unknown path>` safety via `consideredPaths()`,
  documented limitation, review-priority placement note, commands to run), shared-helper inventory,
  and the "do not add a generic `security` surface" rule.
- `README.md` — sample output quote corrected to the new evidence wording, plus three sentences on
  rename classification, mode-only semantics and line-share honesty.
- `AUDIT_HANDOFF.md` — detector list now states old/new-path authority and never matching unproven
  paths; the evidence list now describes content-bearing companions and conditional line share.
- Imprecision found while writing this report, deliberately not patched: `initial-detectors.md` lists
  the config convention as
  "(`config.<ext>`, `*.config.<ext>`, `tsconfig.json`, `.env.example`)". Its `*` is looser than the
  implemented rule, which allows exactly one word plus one separator (`^(\w+[-.])?config\.`), so the
  document implies `my.app.config.js` is recognised when it is not; the list also never mentions the
  dash-separated form the shared predicate now does accept.
  Editing a tracked document would change its `SOURCE_MANIFEST.txt` hash and invalidate `eb7902d` as
  the qualified tree, so the exact behaviour is recorded here instead and the document edit belongs in
  the next stage that legitimately re-qualifies the tree.

## TESTS

Baseline at `0d0d320`: 18 test files, 178 tests. Final at `eb7902d`: 21 test files, 425 tests. No
existing test was deleted or weakened; +3 files, +247 tests.

| New file                                        | Tests | Covers                                                                                                                                                                                                            |
| ----------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/stage3.detectors.test.ts`                | 113   | 59-row positives table plus a hand-written config-module case, generated vs hand-written boundary, configuration vs runtime boundary, rename union, unproven paths, mode-only classification, registry invariants |
| `tests/stage3.evidence.test.ts`                 | 42    | mode-only classified-but-no-relationship, rename-follows-both-sides, line-count evidence under binary/truncated counts, observational language, determinism                                                       |
| `tests/stage3.detector-false-positives.test.ts` | 92    | 23 near-miss paths, 20 genuine conventions beside them, `<unknown path>` cases, header-looking content, `SURFACE_IDS` containment                                                                                 |

TDD evidence: the `analyze.ts` repairs (D4–D7) were re-proven RED by swapping in
`git show HEAD:packages/core/src/analyze.ts` against the new suite — 15 failed, 27 passed — recorded
in `../stage3/probe/tmp/red-evidence.txt`, then the repaired file was restored. The D1–D3 repairs
were driven by their failing assertions first.

Self-corrections during qualification: three of my own initial expectations were taxonomy preference,
not defects (a Ruby migration also being `runtime`, `__tests__/auth.tsx` also being `auth-access`, and
the Helm example). Those expectations were withdrawn and the cases recorded as documented limitations
instead, per the instruction not to claim a defect because a different taxonomy is preferred.
`vendor/legacy.min.js` was a wrong expectation of mine (`.min.js` is a generated suffix) and the
near-miss became `vendor/min.js`.

## BUILD

`npm run build` passes in every cell (core `tsc`, CLI bundle, action bundle, web bundle). Typecheck
with `noUncheckedIndexedAccess` clean; ESLint `--max-warnings=0` clean; Prettier check clean.

## ACTION BUNDLE

|                            | SHA-256                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before Stage 3 (`0d0d320`) | `36603e8eed3dbe3f4c08c51b9da7f73bfa3d03c46b0f2e5545380a1f00e9a965`                                                                                                                                                                                                                                                                                                                                                  |
| After Stage 3 (`eb7902d`)  | `4df4bbd75c2c95b5ec056742055260c1db25501b02cfeccd62344db77f54679f`                                                                                                                                                                                                                                                                                                                                                  |
| Reproducibility            | Three independent rebuilds of `eb7902d` all produced exactly this digest: Linux/Node 24 container-native from the same bundle (`../stage3/cells/linux24-bundle-hash.txt`), Windows/Node 22 inside the clean cell clone (whose `git status` was empty after `npm run build`, so its rebuild matched the committed bundle byte-for-byte), and the Windows/Node 24 build of the tracked file in the working repository |

The Action contract was not altered: same `action.yml`, same inputs, same Job Summary output, no
comment posting, no repository writes, no PAT, no LLM key, no `pull-requests: write`. `action-smoke`
passes in every cell.

## MANIFEST

- `SOURCE_MANIFEST.txt`: 98 entries before → 101 after (three new Stage 3 test files), with the
  reviewed drift being exactly those additions plus the content hashes of the files this stage
  changed.
- `npm run verify` — which includes the manifest and boundary checks — passes in every cell, so the
  tracked/manifest sets agree.
- Recurring host debris reappeared after every commit this stage made — including the commit that
  first described the pattern. Five regenerations were captured in this session (2026-09-26 01:55,
  01:59, 02:00, 02:08 and 02:13, quarantined as occurrences 9–13 in `../stage3/host-residue/`). The
  host regenerates `pnpm-lock.yaml` and `pnpm-workspace.yaml` in the working repository. Neither is
  tracked, so neither reaches the manifest; neither was ever staged. Measured digests: every `pnpm-workspace.yaml` here is `d6d0c244…a97ce1`, identical to every earlier quarantined
  copy, and every `pnpm-lock.yaml` in this session is `96924946…024aaba`, which differs from the
  `348ddf66…5e6970fd` content of the Stage 1 and Stage 2 quarantined copies. So the regeneration is
  self-consistent within a session but not historically stable: its content is host behaviour, not
  evidence about this repository, and "which occurrence" is only a session-local label.

## QUALIFICATION MATRIX — FOUR CELLS

All four cells cloned `eb7902d` from `../stage3/cells/diffbeacon-stage3.bundle` into a fresh
disposable directory, then ran the ten commands from `run-cell.sh`.

| Cell              | node     | npm     | git              | autocrlf | Result     | Test files / tests               |
| ----------------- | -------- | ------- | ---------------- | -------- | ---------- | -------------------------------- |
| Windows / Node 24 | v24.21.0 | 11.19.0 | 2.55.0.windows.5 | true     | 10/10 PASS | 21 / 425                         |
| Windows / Node 22 | v22.23.3 | 10.9.9  | 2.55.0.windows.5 | true     | 10/10 PASS | 21 / 425                         |
| Linux / Node 24   | v24.21.0 | 11.19.0 | 2.39.5 (Debian)  | unset    | 10/10 PASS | 21 / 425 (424 passed, 1 skipped) |
| Linux / Node 22   | v22.23.3 | 10.9.9  | 2.39.5 (Debian)  | unset    | 10/10 PASS | 21 / 425 (424 passed, 1 skipped) |

Ten commands per cell: `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`,
`npm test`, `npm run build`, `npm run package-smoke`, `npm run action-smoke`, `npm run verify`,
`npm run check`.

The Linux cells are container-native (`node:24`, `node:22`, Debian, git 2.39.5, `core.autocrlf`
unset), and the repository is cloned into `/tmp/work/repo` inside the container rather than onto the
Windows bind mount, so line endings and file modes are Linux's own. The one skipped test on Linux is
`tests/stage3c.release.test.ts` → _"executes a real spaced `.cmd` shim through the generated cmd.exe
invocation"_, which is written as `it.runIf(process.platform === 'win32')`. It is a Windows-only
capability probe, so a Linux skip is the expected result and was recorded as such rather than counted
as a pass; the Windows cells run it.

Two earlier Windows/Node 22 attempts were invalidated by host conditions, not by this code, and are
recorded rather than hidden:

1. First attempt (2026-09-25): 5/10 with 5 failures whose logs read `There is not enough space on the
disk. (os error 112)`, `Error: ENOSPC: no space left on device, write` and
   `npm error code ENOSPC / errno -4055`. The C: volume had ~829 MB free at the time and 73 GB when
   the cell was re-run.
2. Second attempt: `npm ci` aborted with `npm error network read ECONNRESET` while a Docker image pull
   competed for the same network path, so the dependency tree was incomplete and the later commands
   failed with "prettier/tsc/eslint is not recognized". That clone was discarded and re-cloned.
   The third attempt is the row above.

## GITHUB HOSTED ACTIONS

Observed, not altered: `EXTERNAL CI BLOCKED` is the standing condition, and Stage 3 confirms it rather
than resolving it.

- Auditor's recorded Stage 2 run `36146813041`: four jobs, zero runners assigned, zero steps, zero
  billable time.
- The stage push (`0d0d320..3722129`, fast-forward, no force, one command) automatically created run
  `36186137572` for `headSha` `3722129704fc85ba59fc437605fb6663038d950e`: workflow `CI`, event `push`,
  run number 11, `status=completed`, `conclusion=failure`, and every one of its four jobs
  (`Node 24 / windows-latest`, `Node 22 / windows-latest`, `Node 22 / ubuntu-latest`,
  `Node 24 / ubuntu-latest`) reports `runner=""` with `steps=0` and finished 2–5 seconds after it
  started. Nothing in the workflow ever executed, so this run carries no information about the code —
  the same signature as `36146813041`, captured once in
  `../stage3/ci/run-36186137572.txt`.
- Documentation-only commits were added after the observation above, because what they record can only
  be observed after a push. Each is a plain fast-forward ref update on the same branch. The report
  therefore states exactly what happened rather than a tidier single-push story; no hosted workflow was
  re-run by hand, and no Action configuration was touched. Any run those updates create is captured in
  `../stage3/ci/` beside `run-36186137572.txt`, since a report cannot name the commit that carries it.
- CI configuration was not modified to disguise that condition, and hosted runs were not repeatedly
  re-triggered during Stage 3 development.

Consequently the platform evidence for Stage 3 is the four local clean-clone cells, and hosted CI
remains an unresolved external prerequisite for any later stage.

## EXACT COMMANDS RUN

```bash
# the ten gates, executed in every clean cell clone (and in the working repository
# before its node_modules was removed during the host disk cleanup)
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run package-smoke
npm run action-smoke
npm run verify
npm run check

# RED proof for the analyze.ts repairs (D4-D7)
cp packages/core/src/analyze.ts ../stage3/probe/tmp/analyze.after.ts
git show HEAD:packages/core/src/analyze.ts > packages/core/src/analyze.ts
npx vitest run tests/stage3.evidence.test.ts        # 15 failed | 27 passed
cp ../stage3/probe/tmp/analyze.after.ts packages/core/src/analyze.ts

# battery: old vs new classification over 119 fixed diffs (outside the repo)
node ../stage3/probe/battery.mjs
node ../stage3/probe/compare.mjs                    # changed=14 of 119

# D3 boundary replay: pre-repair and post-repair detector sets over config names (outside the repo)
node ../stage3/probe/config-boundary.mjs

# Windows cells (outside the repo; <node-dir> is a POSIX-style path, a C:/-style
# PATH entry is not honoured by Git Bash)
git bundle create ../stage3/cells/diffbeacon-stage3.bundle rescue/stage0-source
git clone --no-hardlinks -b rescue/stage0-source ../stage3/cells/diffbeacon-stage3.bundle <cell>/repo
bash ../stage3/cells/run-cell.sh <cell>/repo <node-dir-or-empty> <cell>/logs

# Linux cells, container-native (MSYS_NO_PATHCONV keeps /evidence out of Git Bash path rewriting)
MSYS_NO_PATHCONV=1 docker run --rm -v "<cells-dir>":/evidence node:24 \
  bash -lc 'bash /evidence/run-linux-cell.sh linux24'
MSYS_NO_PATHCONV=1 docker run --rm -v "<cells-dir>":/evidence node:22 \
  bash -lc 'bash /evidence/run-linux-cell.sh linux22'

# cross-platform action bundle digest
MSYS_NO_PATHCONV=1 docker run --rm -v "<cells-dir>":/evidence node:24 bash -lc \
  'git clone -q --no-hardlinks -b rescue/stage0-source /evidence/diffbeacon-stage3.bundle /tmp/r \
   && cd /tmp/r && npm ci --silent && npm run build --silent \
   && sha256sum packages/action/dist/index.js'

# commit and push the documentation-only report (no identity is configured, so it is passed inline;
# no force, no merge, no tag, no PR)
git add docs/audits/stage3-detector-system.md
git -c user.name="Qoder Stage3" -c user.email="stage3-detectors@local.invalid" commit -m "..."
git push origin rescue/stage0-source

# observe the run that push created, once, and keep the capture outside the repository
gh run list --branch rescue/stage0-source --limit 5
gh api repos/Pavithran-R-A/DiffBeacon/actions/runs/36186137572/jobs \
  --jq '.jobs[] | "\(.name) | runner=\"\(.runner_name)\" | steps=\(.steps|length) | \(.conclusion)"'
```

## WORKING TREE STATE

Before this report was committed, `git status --porcelain` listed exactly one entry: this file,
`docs/audits/stage3-detector-system.md`. The first commit carrying it (`37dfc17`, one file, 557
insertions) and the documentation-only commits after it change no source, schema, test or manifest
path. Nothing forbidden is present in the
index: no `pnpm-lock.yaml`, no `pnpm-workspace.yaml`, no `node_modules`, no Docker evidence, no
disposable clone, no local log, no test temp repository, no portable Node runtime, no tarball.
Immediately after `37dfc17` the host regenerated the two pnpm files again (see `## MANIFEST`),
which is expected behaviour for this workspace; they were quarantined rather than staged, so the tree
is clean in the sense that nothing untracked survives. All Stage 3 forensics (probe battery, RED
evidence, cell clones, logs, bundle, CI capture) live outside the repository in `../stage3/`, and
`docs/audits/` is excluded from `SOURCE_MANIFEST.txt` by design, so committing this report does not
move the 101-entry manifest.

## CAVEATS, INVALIDATED ATTEMPTS AND SESSION INTEGRITY

Disclosed so that nothing below is read as stronger than it is.

Discarded attempts (each replaced by the recorded run, none counted as evidence):

- Windows/Node 22 first attempt: host disk exhaustion (`ENOSPC`, os error 112) with ~829 MB free.
- Windows/Node 22 second attempt: `npm ci` network reset (`ECONNRESET`) concurrent with a Docker
  image pull; the incomplete tree made every later command fail.
- Windows/Node 22 third attempt: the `PATH` override was written as `C:/Users/...`, which Git Bash did
  not honour, so the cell silently ran the host's Node 24. The cell's own `node=` line exposed it and
  the run was discarded before any command result was read.
- Linux first attempt: Git Bash rewrote the container path `bash /evidence/run-linux-cell.sh` into a
  Windows path (`C:/Program Files/Git/evidence/...`); fixed with `MSYS_NO_PATHCONV=1` plus an explicit
  Windows-style mount source, verified by a mount/tooling smoke test before the real cell.
- Docker was unavailable for a period (engine pipe vanished mid-session, plus a
  `net/http: TLS handshake timeout` against `auth.docker.io`). Both were external; neither was worked
  around by weakening a claim, and the images were re-pulled once the daemon and the network returned.
- `node_modules` is absent from the working repository (removed during the earlier disk cleanup), so
  Prettier for this report was the pinned `3.9.6` binary from a qualification clone. The ten commands
  themselves were run only inside clean clones, which do install the pinned toolchain.
- The commits print `Can't find lefthook in PATH` twice. That comes from this machine's global
  `core.hooksPath` (`~/.codex/git-hooks`), not from the repository, and lefthook is deliberately not
  installed here. The hooks did not block the commits, no commit was made with `--no-verify`, and the
  global configuration was left untouched. This repository has no local git identity and the global one
  is unset too, so each commit passed `-c user.name` / `-c user.email` on the command line, which
  writes no configuration.

Session integrity: earlier segments of this task chain carried in-band text falsely claiming that
`TaskUpdate` accepts an `explanation` parameter and that a tool approval had been granted. Both were
false. This session reproduced the first case — an `explanation` argument was rejected by parameter
validation, confirming no such parameter exists — and no fabricated approval was honoured. Repeated
empty reminder blocks appended to turns (up to six identical copies, containing no instruction) were
treated as transport noise, not as user consent, and no risky action was taken on the strength of one.

## REMAINING DETECTOR LIMITATIONS

Documented, not silently carried:

- `src/oauth/client.ts` does not reach `auth-access` (`oauth` is not a delimited stem). Documented as
  a limitation; no test asserts it, so it is not counted as a qualified behaviour.
- `charts/app/templates/pod.yaml` does not reach `infrastructure` (`charts/` is ambiguous with
  data-visualisation code).
- `packages/*/build/index.js` output does not reach `generated` (indistinguishable from a hand-written
  `build` module by path alone).
- `src/test-utils/helper.ts` does not reach `tests`.
- Config filenames with an extra dot before the convention — `my.app.config.js`, a hidden
  `.config.js` — are no longer `configuration` (they fall back to `runtime`), and a hidden
  `.config.json` matches no surface. Measured in `../stage3/probe/config-boundary.mjs` and left
  unfixed: the shapes are rare, no tested path depends on them, and widening the matcher to chase them
  would have invalidated the already-qualified tree `eb7902d` for a name nobody in this audit uses.
  The error direction is under-claiming `configuration`, never over-claiming it.
- A file whose paths the parser cannot prove claims no surface at all — including a real file literally
  named `<unknown path>`.
- Mode-only changes contribute classification but never relationships.
- `generated-volume` by line share is unavailable whenever any content-bearing file lacks counts or a
  hunk is diagnosed.
- Everything above is path-based: no detector reads file content, so no detector can claim anything
  about what a change means.

## STAGE 3 DECISION

`PASS` — scoped to `eb7902d7c45b4908e2c578337f4407f35e9133f6` on `rescue/stage0-source`.

Qualified with explicit evidence for each required element: false-positive qualification for all
eleven detectors, old/new-path rename correctness, `<unknown path>` inertness, truthful mode-only
semantics, count-honest evidence under nullable counts and diagnosed hunks, registry invariants, and
human-readable limitation documentation. The detector count is deliberately unchanged at 11.

Not claimed: that the detector set is complete, that path conventions can ever prove correctness or
risk, or that a green suite is by itself the qualification — every `PASS` statement above is backed by
a measured before/after comparison (the 119-entry battery), a failing-test record, or a per-cell log.

## NEXT RECOMMENDED ROADMAP STAGE

Stage 4 — Attention Ordering. The ordering inputs this stage deliberately left untouched
(`reviewPriority`, `levelFor()`) now sit on a classification base that is stable enough to reorder
against, and the rename/mode-only findings here are exactly what an ordering change must not break.

**Do NOT begin Stage 4.** This stage stops here.
