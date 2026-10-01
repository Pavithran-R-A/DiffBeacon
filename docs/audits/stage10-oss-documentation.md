# Stage 10 — OSS documentation qualification

STATUS: **PASS**

STARTING SHA: `8415cfefa9bc23a512e0b9a5e298c267591ebcfe` (`8415cfe`), branch `rescue/stage0-source`
ENDING QUALIFIED SHA: `243f35906071c33603be5f2f8c976fd25f4a3792` (`243f359`) — the commit that carries
this report. It changes only `docs/audits/stage10-oss-documentation.md` (this file, which
`scripts/source-manifest.mjs` excludes by prefix and `tests/stage10.docs-contract.test.ts` excludes
from its current-document scan set), `docs/architecture/security.md`,
`tests/stage10.docs-contract.test.ts` (§7 defect 2) and `SOURCE_MANIFEST.txt`; no `packages/**`,
`client/**`, `.github/**`, `action.yml`, lockfile or `package.json` path differs from the preceding
candidate `fdf7fe8`, which is the commit PHASE 20's first clean-copy cell was run against. §13 records
the same cell re-run inside a clean clone of `243f359`. The measured lines that run added one
successor commit touching this file alone: no gate reads it (outside the manifest, outside the
contract scan set, outside every shipped artifact), so the proof and the pushed tip are the same tree
except for this report.

BRANCH: `rescue/stage0-source` (normal forward push only)
`origin/main`: `e0ff98143bfe39c80c338518d006525a846a8739` — **not touched by Stage 10**
`origin/rescue/stage9-selfhosted-ci`: `b6e884260e84557807fd9fc2867783e3f8756bee` — **not touched, not
deleted**, per the Stage 10 brief

Everything below is a measurement taken on 2026-09-30 on this host unless a line says otherwise. Raw
logs, the claim matrix, the field-level `npm audit --json` record and the clean-copy cell live
**outside** the repository, in `…/904c4a23/stage10/`, because they name host paths and carry
credential-shaped canary text; the in-tree current documents cite them by content, not by path.

---

## 1. Document inventory

38 tracked Markdown files (`git ls-files -- '*.md'` at `fdf7fe8`); 39 at the report commit, this file
being the one addition (`docs/audits/` → 18).

| Location               | Count                    | What                                                                                             |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| repository root        | 6                        | `README.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `AGENTS.md` |
| `docs/` (top level)    | 3                        | `README.md` (index), `limitations.md`, `releasing.md`                                            |
| `docs/architecture/`   | 2                        | `overview.md`, `security.md`                                                                     |
| `docs/detectors/`      | 2                        | `initial-detectors.md`, `authoring-detectors.md`                                                 |
| `docs/examples/`       | 1 (`.yml`) + 1 (`.diff`) | consumer workflow example, sample diff input                                                     |
| `docs/audits/`         | 17                       | 13 stage reports + 4 relocated pre-Stage-1 working notes (`docs/audits/legacy/`)                 |
| `docs/recovery/`       | 2                        | recovery index + the Stage 0 forensic record                                                     |
| `docs/research/`       | 2                        | design brainstorm + index                                                                        |
| `packages/*/README.md` | 3                        | `core`, `cli`, `action`                                                                          |
| `.github/`             | 1                        | pull-request/issue template prose                                                                |

## 2. Current vs historical classification

**Current-facing (a staleness scan must pass on these):** the 13 files in `CURRENT_DOCS`
(`tests/stage10.docs-contract.test.ts:20-34`) — the 6 root files, `docs/README.md`,
`docs/limitations.md`, `docs/releasing.md`, both architecture documents, both detector documents.
The three `packages/*/README.md` files are current-facing too and are bound by their own stage tests
(`stage5.cli-arguments`, `stage5.cli-formats`, `stage9.package-contents`,
`stage6.action-workflow-docs`), which is why they are not duplicated into `CURRENT_DOCS`.

**Historical records (must not masquerade as current status; prose may legitimately be stale):** the
**22** Markdown files tracked at `8c6a7e6` under `docs/audits/` (18, this report included),
`docs/recovery/` (2) and `docs/research/` (2). The "21" written earlier in this stage's working notes
belonged to the `fdf7fe8` snapshot, where `docs/audits/` still held 17 files; that snapshot is labelled
as such here rather than left as the final figure. The test asserts these
three prefixes are outside the scan set, so purpose-preserved stale statements cannot silently fail
CI, and equally cannot silently read as current claims.

## 3. Claim matrix summary

62 claims audited, each as `claim → code (path:line) → test → run → verdict`
(`stage10/claim-matrix.md`, kept out of the repository because it quotes host paths and canary text):

| Verdict                          | Count | Disposition                                                                                                 |
| -------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| supported as written             | 42    | left alone; re-verified against current source/tests                                                        |
| repaired in place                | 14    | reworded, narrowed, split, or re-measured against the current tree                                          |
| relocated as a historical record | 6     | Git rename + dated "not current project status" banner                                                      |
| removed outright, no replacement | 0     | every defective claim was replaced by a true, narrower, measured statement rather than deleted into silence |
| fabricated claims introduced     | 0     | see §9 — absent intake channels stayed absent                                                               |

The 14 repaired rows: `#37` hosted-vs-self-hosted CI provenance, `#39` browser-lane wording, `#40`
secret-scan reading, `#41` dependency-audit position, `#42` pre-audit phrasing, `#43` the
`package.json` overlap hedge, `#46` the CHANGELOG heading, `#47` the SECURITY contact claim, `#49`
the Code of Conduct contact claim, `#50` CONTRIBUTING per-change commands, `#57` the AGENTS.md
handoff pointer, `#58` the README example, `#59` README:131, `#60` the Action README runner claim.
The 6 relocated rows: `#51`–`#56`.

## 4. Per-file verdicts

| File                                  | Verdict  | What Stage 10 did to it                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                           | **PASS** | Status block made dated and pointed at the runbook; the Attention Map example is now the shipped `docs/examples/attention-map-sample.diff` rendered through the built CLI, quoted byte-for-byte, with `summary.diagnostics` at 0, and bound by `tests/stage10.docs-contract.test.ts`; the hosted-vs-self-hosted CI sentence split into the two claims that are each separately true; browser-lane wording no longer implies a GitHub-hosted Ubuntu browser run.                         |
| `SECURITY.md`                         | **PASS** | Added a truthful _Supported versions_ section (nothing published ⇒ no supported release). Replaced "contact the maintainers through the private channel configured for the eventual public repository" with the measured state: no private intake is configured or verified, Stage 10 did not check or change the setting, and a real intake is a Stage 11 prerequisite recorded in `docs/releasing.md`. No address, SLA or setting was invented. Invariants 1–9 kept, re-wrapped only. |
| `CONTRIBUTING.md`                     | **PASS** | Per-change-type commands now name scripts that exist and were executed; no claim that a runner, Chromium or a hosted environment is available to a contributor; the Action-source row states the measured rebuild-must-be-a-no-op rule.                                                                                                                                                                                                                                                 |
| `CHANGELOG.md`                        | **PASS** | Heading changed from `0.1.0 — Unpublished MVP` to `0.1.0 — Unreleased`, and the section now lists the capabilities that are actually implemented, still with no publication claim.                                                                                                                                                                                                                                                                                                      |
| `docs/architecture/*`                 | **PASS** | `overview.md` replaces the speculative "configuration surface if a future detector makes that explicit" hedge with a measured overlap (`src/auth/session.ts` → `auth-access` + `runtime`). `security.md` now carries the re-measured secret-scan behaviour, the dependency-audit position as measured today, the action-pin `ls-remote` observation, the self-hosted CI qualification with its run id, and an explicit "what this does not prove" list.                                 |
| `docs/detectors/initial-detectors.md` | **PASS** | Sections are exactly the 11 registry IDs in registry order; the intro states the measured registry count and names the test that enforces the binding.                                                                                                                                                                                                                                                                                                                                  |
| `docs/limitations.md`                 | **PASS** | New file. States the limits as current facts: no published package, GitHub-hosted runner images unqualified for the current CI (with the bootstrap-era hosted execution separated from it in the same bullet), hosted-Linux browser cell never measured, no intake channels, observation-not-judgment scope, and the platform-gated skips.                                                                                                                                              |
| `docs/releasing.md`                   | **PASS** | New runbook. §0 lists the unsatisfied release prerequisites with today's measured state; §§1–7 are checklist text only (see §6).                                                                                                                                                                                                                                                                                                                                                        |

## 5. Historical-document treatment (PHASE 17)

Six root working notes were moved with `git mv`-equivalent renames so `git log --follow` still reaches
the original content, each with a short dated banner. Similarity indices from
`git diff -M --summary 8415cfe..fdf7fe8`:

```
AUDIT_HANDOFF.md           -> docs/audits/legacy/audit-handoff-v0.1-mvp.md        (92%)
AUDIT_HANDOFF_STAGE3A.md   -> docs/audits/legacy/audit-handoff-stage3a.md         (86%)
todo.md                    -> docs/audits/legacy/execution-checklists.md          (84%)
EXPORT_VERIFICATION.md     -> docs/audits/legacy/export-verification-stage4.md    (79%)
RECOVERY_STAGE0.md         -> docs/recovery/stage0-source-recovery.md             (93%)
ideas.md                   -> docs/research/design-brainstorm.md                  (86%)
```

79–93% similarity means banner + link retargeting only; the forensic prose is byte-unchanged. No
`docs/audits/stage*.md` report was rewritten into current-state prose, and none appears in the diff.
**Zero deletions; no destructive purge.** Current-facing pointers into `docs/audits/` were each read
and classified: they cite the _newest_ measurement record (Actions run `36562157439`) or a closed
display-control gap phrased as a record, and `AGENTS.md` now tells a contributor to record uncertainty
in the authoritative stage report under `docs/audits/` instead of the retired root handoff file.

## 6. External fact recheck (PHASE 13)

Read-only lookups against the live services on 2026-09-30; nothing was mutated:

| Question              | Command                                                       | Measured answer                                                 |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Repository visibility | `gh repo view … --json visibility,isPrivate,…`                | `isPrivate: true`, `visibility: PRIVATE`, default branch `main` |
| Tags                  | `gh api repos/…/tags`                                         | empty — no tags                                                 |
| Releases              | `gh api repos/…/releases`                                     | `[]`                                                            |
| npm                   | `npm view diffbeacon name version`                            | `404` — not published                                           |
| Own tags via git      | `git ls-remote --tags origin`                                 | empty                                                           |
| Pinned action         | `git ls-remote --tags https://github.com/actions/checkout v7` | `3d3c42e5aac5ba805825da76410c181273ba90b1 refs/tags/v7`         |

Consequence held in the docs: no `npx diffbeacon` / `npm i diffbeacon` as current capability, the
consumer example keeps its `<REVIEWED_FULL_COMMIT_SHA>` placeholder (a naive `uses: …@v1` appears
nowhere and is test-guarded), and the private repository means no consumer could run that example yet.

## 7. Documentation contract tests

`tests/stage10.docs-contract.test.ts` — 1 file, **40 cases**, `source` project. It binds: the README
example to the shipped renderer (`analyzeDiff` + `renderPretty`, byte-for-byte), the example input to a
zero-diagnostic parse and to a manifest-tracked path, the detector doc headings to `SURFACE_IDS` in
registry order, the README surface list to the registry titles/length, publication-claim and
`TODO/FIXME/XXX` scans to the 13 current files, the CHANGELOG heading rule, the status block's date and
run id, the historical/root-note/banner/index rules, and relative-link resolution for every current
file.

**Mutation proof (`stage10/mutation-proof.sh`, 15 labelled mutations; the 14 labels that reached the
summary stream are below, and §11 names the label the harness swallowed — each mutation was restored
from the index):**

```
TEETH OK [readme-example] [sample-diagnostics] [manifest-entry] [detector-sections]
TEETH OK [readme-titles] [readme-title-order] [readme-length] [stale-phrase]
TEETH OK [publication-claim] [status-run-id] [banner] [index]
TEETH OK [broken-link] [detector-intro]      WORKTREE RESTORED to the staged state
```

Each mutation failed exactly the named case (1 failed / 39 passed; the length mutation tripped 2), so
the documentation is a test-enforced contract, not a review artefact. Two defects in this stage's own
test were found and repaired rather than shipped:

1. A case named "…in registry order" had only been asserting list lengths, so it was renamed to say
   what it measures and the ordering assertion moved to the case that performs it.
2. The link helper skipped fenced blocks but not inline code, so a quoted hostile filename such as
   `` `[link](example.invalid).ts` `` — data that several reports carry — was read as a link target.
   Proven failing first (`expected [ 'example.invalid' ] to deeply equal []`), then fixed by stripping
   inline-code spans, and the whole mutation harness re-run afterwards to show the real-link detection
   was not lost.

## 8. Broken links

Repo-wide check over all 39 tracked Markdown files with the shipped test's rule, including the
inline-code fix above (`stage10/p21-linkcheck.mjs`): **100 relative links checked, 0 broken** at the
report commit. An earlier pass over 38 files with the fence-only rule listed 101 candidates and flagged
one of them; the extra candidate was the inline-code fixture at
`docs/audits/stage6-github-action.md:241`, which defect 2 above retires by fixing the scanner rather
than by annotating the number away. One genuinely broken link was created and repaired inside this
stage: `docs/recovery/README.md` pointed at the pre-rename `RECOVERY_STAGE0.md` path and was retargeted
to `stage0-source-recovery.md`.

## 9. Command-example results (PHASE 16)

Executed for real, with exit codes (`stage10/p16-p17-examples-and-records.md` holds the table):

- `npm ci`, `npm run build`, `format:check`, `lint`, `typecheck`, `secret-scan`, `package-smoke`,
  `action-smoke`, `verify`, `check` → exit 0 (`npm ci` deliberately run in the PHASE 20 clean clone,
  not over the host's pnpm-resolved `node_modules`).
- CLI as documented: `--help` (0), `--version` → `0.1.0` (0), `review main...HEAD` (0, 10 334 B),
  `--format markdown` (0, 13 832 B), `--format json` (0, 86 540 B, `schemaVersion "1"`, keys
  `schemaVersion, summary, files, attention, evidence, reviewOrder`), `git diff main...HEAD | … --stdin`
  byte-identical to the range run (`cmp` clean), and the README example pipe with output equal to the
  fenced block byte-for-byte.
- Browser _documentation_ command: `npm run dev` started Vite 8.3.1 on `http://localhost:3000/`; the
  probe fetched `/` (200, 826 B) and `/src/main.tsx` (200, 2 282 B), found no analytics/iframe/WebSocket
  markers, and terminated only the PID it spawned. No Chromium suite was re-qualified — this stage
  changed prose, one example diff, `docs/**`, root `.md` files, the manifest and a `source`-project test,
  and the brief directs not to spend a long browser qualification on documentation edits. The browser
  contract's last real execution remains Actions run `36562157439` on self-hosted runners.
- `npm pack --dry-run` (4 files: `LICENSE`, `README.md`, `dist/index.js`, `package.json`),
  `git ls-remote` for own tags and for `actions/checkout v7`, both audit surfaces, and the
  rebuild-is-a-no-op check on `packages/action/dist/index.js`.
- Statically inspected, deliberately never executed: `docs/examples/diffbeacon-pull-request-review.yml`
  (parsed structurally with the workspace's own `js-yaml`: `pull_request` trigger only,
  `permissions: {contents: read}`, pinned `uses:` SHAs, no `id-token: write`, no `secrets.*`; the
  `pull_request_target` / `uses: ./` strings appear only in comments explaining why they are refused),
  `.github/workflows/ci.yml`, `ci-self-hosted-stage9.yml`, and `docs/releasing.md` §§2–7. The
  placeholder `uses:` line cannot be executed in Stage 10 — no tag, release, public repository or
  reviewed DiffBeacon SHA exists, and creating one is forbidden here.
- Disclosed harness errors (not product defects): one format loop ran `review main...HEAD markdown`
  without `--format` and got the documented usage exit 2; one `npm run dev` probe failed to parse the
  URL because Vite emits ANSI inside it.

## 10. SOURCE_MANIFEST

`npm run manifest` → entries **157 → 158**. First regeneration drift: 6 added, 5 removed, 9
hash-changed. Every entry is explained: the 4 relocated root working notes and
`RECOVERY_STAGE0.md`/`ideas.md` left the manifest because they entered manifest-excluded prefixes,
`docs/audits/**` is excluded by policy, and the additions are `docs/README.md`,
`docs/examples/attention-map-sample.diff`, `docs/recovery/README.md`, `docs/research/*` index,
`tests/stage10.docs-contract.test.ts` (net +1). A second regeneration for the re-measured
`docs/architecture/security.md` changed only that one hash line, and the PHASE 20 clean clone re-proved
the manifest is a no-op (`git diff --exit-code -- SOURCE_MANIFEST.txt` → exit 0). Nothing entered the
manifest unexplained, and no `pnpm-lock.yaml` / `pnpm-workspace.yaml` host debris was ever staged.

## 11. Tests, build, package, Action, secret scan, audit (PHASE 19 host + PHASE 20 clean copy)

At `fdf7fe8`, inside the clean clone, `DIFFBEACON_SKIP_BROWSER=1` (the repository's own lane flag, the
same one the source lanes of `ci.yml` set) and `LEFTHOOK=0`:

| Gate                                                              | Exit  | Result                                                                                                                                 |
| ----------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                          | 0     | 214 packages, 25 s (esbuild postinstall warned as uncovered by `allowScripts`)                                                         |
| `npm run format:check`                                            | 0     | All matched files use Prettier code style                                                                                              |
| `npm run lint`                                                    | 0     | `eslint . --max-warnings=0`, clean                                                                                                     |
| `npm run typecheck`                                               | 0     | `tsc --noEmit -p tsconfig.json`                                                                                                        |
| `npm run test:source`                                             | 0     | **59 files, 968 passed, 2 skipped (970 cases)**                                                                                        |
| `vitest run tests/stage10.docs-contract.test.ts --project source` | 0     | 1 file, 39/39 (40/40 in a clean clone of `243f359` — §13)                                                                              |
| `npm run build`                                                   | 0     | core `tsc`, CLI bundle, Action bundle, web `vite build`                                                                                |
| `npm run secret-scan`                                             | 0     | `12 finding(s), 12 classified, 0 unclassified, 0 stale`                                                                                |
| `npm run package-smoke`                                           | 0     | `bin=true; engines=>=22; tarballFiles=4; license=MIT; noRepositoryExit=3; usageExit=2`                                                 |
| `npm run action-smoke`                                            | 0     | 1 250-byte Job Summary; `cliLeak=false; hostilePaths=true; cleanWorkspace=true; oversizeRejected=true; pullRequestTargetRejected=true` |
| `git diff --exit-code -- SOURCE_MANIFEST.txt`                     | 0     | manifest current, not rewritten                                                                                                        |
| `npm audit --omit=dev --audit-level=high`                         | 0     | `found 0 vulnerabilities`                                                                                                              |
| `npm audit --audit-level=high`                                    | **1** | 1 high — by design, and documented as a Stage 11 prerequisite                                                                          |
| `npm run verify` / `npm run check`                                | 0     | aggregate gate, incl. full `npm test` → **65 files, 968 passed, 134 skipped (1102 cases)**                                             |
| `git diff --check`                                                | 0     | no whitespace errors                                                                                                                   |
| worktree after all gates                                          | —     | `git status --porcelain` empty                                                                                                         |

Test totals for the record: **65 test files** (59 `source` + 6 `browser`), **1102 cases**; under the
skip flag 968 ran and 134 were skipped with an explicit reason (the 2 source skips are the
platform-gated invalid-UTF-8-path cases, which only a POSIX filesystem can create). The browser
project's **132 cases across 6 files** were **not** re-executed in Stage 10 — they are the 132 skips in
the aggregate line above (see §9 for why).

Those totals are `fdf7fe8`'s. The contract test has three snapshots and they must not be collapsed into
one number: the version measured first carried **39** cases (`stage10/p17-mutation-summary-final.txt`,
`1 failed | 38 passed (39)`); the version that shipped in the _earlier_ Stage 10 record commit carried
**40** — one more, because the §7 defect-2 link-scanner repair added a case
(`stage10/p22-host-check-before-commit.txt`); and the version this hosted-history closure carries is
**55** (`stage10c/docs-contract-RED.txt`, `stage10c/docs-contract-GREEN.txt`). Measured on the host tree
at exactly the content that earlier commit stores, with the same two environment settings: **59 test
files passed / 6 skipped, 1103 cases (969 passed + 134 skipped)**, `npm run
check` exit 0, secret scan still `12/12/0/0`, package-smoke and action-smoke unchanged
(`stage10/p22-host-check-before-commit.txt`, outside the repository). The mutation harness was re-run
against that 40-case file too: each of the **14** labels its summary captured killed its named case
(`1 failed | 39 passed`), the length mutation `2 failed | 38 passed`, and the worktree was restored from
the index afterwards (`stage10/p21-mutation-summary-40cases.txt`). That saved log is the label set it
captured, not the harness's size: `stage10/mutation-proof.sh` carries **15** labelled mutations, and no
single summary file proves "15 of 15". Against the 55-case file the whole-harness re-run emits **14**
`TEETH OK` lines and **zero** `TEETH MISS` (`stage10c/mutation-proof-full-55cases.txt`, re-confirmed by
`stage10c/mutation-proof-full-rerun.txt`), and the 15th label — `root-note` — is proven by its own
per-label log (`stage10/mutation-log.txt.root-note`: `× leaves no working note at the repository root`,
`Tests 1 failed | 54 passed (55)`), because that case's `run_case` call redirects its stdout into the
file it then deletes. The summary stream plus the per-label log together account for all 15 labels.

Node 22 check, done inside the same clean copy with the portable `v22.23.3` (npm 10.9.9), labelled
honestly as a host run on Windows rather than a runner run: docs-contract **39/39** (40/40 against the
report commit's version of the test), full source suite
**59 files, 968 passed / 2 skipped**, both exit 0, worktree pristine afterwards. Repeated on the
`243f359` clone of §13 with the same portable runtime: docs-contract **40/40**, source suite
**59 files, 969 passed / 2 skipped (971 cases)**, both exit 0, worktree pristine afterwards
(`stage10/p22-node22-record.*`). Nothing here is a GitHub-hosted Node 22 run; the recovered-source CI
workflow used for release qualification has never been allocated a GitHub-hosted runner, which is a
different claim from saying this repository never received hosted runners at all (see §15 item 2).

## 12. Dependency audit position

Measured 2026-09-30 against the tracked lockfile, unchanged since 2026-09-28:

- `npm audit --omit=dev --audit-level=high` → **0 vulnerabilities, exit 0** (the only publishable
  package is `diffbeacon@0.1.0`, which declares no runtime dependencies).
- `npm audit --audit-level=high` → **1 high, exit 1**: `brace-expansion` (quadratic-time brace
  expansion, CPU DoS), transitive, **dev-only**, reached via
  `eslint@9.39.5 → minimatch@3.1.5 → brace-expansion@1.1.18` and
  `typescript-eslint@8.70.1 → @typescript-eslint/typescript-estree@8.70.1 → minimatch@10.2.6 →
brace-expansion@5.0.11`, under `GHSA-6j4f-fj2g-mc7p`, `GHSA-qhr7-859c-m2p7`, `GHSA-q2hr-2g5m-vwhr`.
  Neither shipped bundle contains the name, so no published CLI, Action or browser artifact can reach
  it; it is a risk to contributor/CI tooling. The full `--json` field record is kept out of the
  repository at `stage10/npm-audit-2026-09-30.md` and `stage10/npm-audit-full.json`.
- The old Stage 9 zero-advisory reading was **not** copied into any current document, and the
  superseded "four advisories" sentence was replaced with the measurement above. `npm audit fix`,
  `--force` and a hand-edited lockfile were **not** used; the advisories published upstream on
  2026-09-29 21:33Z against an unchanged tree, so the development-tree audit step of both workflows is
  expected to fail on any future run. Handed to Stage 11 as a prerequisite.

## 13. Clean-copy result

PHASE 20 (`stage10/p20-run-cell.sh`, driver log `stage10/p20-cell-node24-final.*`): a fresh
`git clone` of the local repository into a disposable directory, `git checkout fdf7fe8`, identity
recorded **from inside** the clone —

```
HEAD = fdf7fe85b8d2ba250c1830e582e107c5a5ce5fe8   tracked paths = 187   worktree status = clean
node = v24.21.0   npm = 11.19.0   git = 2.55.0.windows.5   platform = win32 x64 10.0.26200
```

then the 16 gates of §11 run in it. **15 exit 0; the one exit 1 is the development-tree audit step,
whose failure is itself the documented finding.** No self-hosted runner was re-registered for this, and
no new Actions run was created to record a docs commit.

The same driver (`stage10/p20-run-cell-record.sh`, logs `stage10/p20-cell-node24-record.*`) was then run
against a fresh clone of `243f359` — the commit that carries this report — so that the record and the
proof are the same object, not neighbours:

```
HEAD = 243f35906071c33603be5f2f8c976fd25f4a3792   tracked paths = 188   markdown = 39
worktree status = clean   node = v24.21.0   npm = 11.19.0   git = 2.55.0.windows.5
platform = win32 x64 10.0.26200
```

Result: **15 exit 0 and the same single by-design exit 1** (`npm ci` 214 packages; format/lint/typecheck
clean; `test:source` 59 files, 969 passed / 2 skipped; docs-contract **40/40**; build, secret scan
`12/12/0/0`, package-smoke and action-smoke as in §11; manifest a no-op; `npm run verify` and
`npm run check` exit 0 at **65 files, 1103 cases (969 passed + 134 skipped)**; `git diff --check`
clean; worktree empty after every gate). The tracked-path count moved 187 → 188 for the reason §15 item
6 records, and `docs/architecture/security.md` no longer states a number that this commit would
invalidate.

## 14. Files changed / moved / deleted

- **Changed: 23 unique paths across the 4 commits of the _pre-closure_ Stage 10 range
  `8415cfe..8c6a7e6`** —
  measured with `git diff --name-status -M` (11 modified, 6 added, 6 renamed) and
  `git rev-list --count` (4), aggregate `git diff --stat` **23 files changed, 1352 insertions,
  84 deletions**; per commit: `1883676` 22 files `+971/−84`, `fdf7fe8` 2 files `+4/−3`,
  `243f359` 4 files `+363/−6`, `8c6a7e6` 1 file `+35/−12`. The per-commit file counts overlap, so they
  do not sum to 23, and insertions are not additive across renames. This is not the complete Stage 10
  history: the hosted-history closure adds commits on top of this range, and those counts are recorded
  in the closure section at the end of this file.
  Modified: `README.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `AGENTS.md`, `SOURCE_MANIFEST.txt`, `docs/architecture/overview.md`, `docs/architecture/security.md`,
  `docs/detectors/initial-detectors.md`, `docs/recovery/README.md`. Added: `docs/README.md`,
  `docs/limitations.md`, `docs/releasing.md`, `docs/audits/stage10-oss-documentation.md`,
  `docs/examples/attention-map-sample.diff`, `tests/stage10.docs-contract.test.ts`. Renamed (6): the
  four `docs/audits/legacy/` records, `RECOVERY_STAGE0.md` and `ideas.md`.
  An earlier draft of this bullet read "Changed: 22 files across the two Stage 10 commits", which
  counted `1883676` plus `fdf7fe8` only; the corrected figure is this range, measured from Git.
- **Moved: 6** (§5), all as Git renames.
- **Deleted: 0.**
- The report commit adds 1 file (this one) and modifies 3 (`docs/architecture/security.md`,
  `tests/stage10.docs-contract.test.ts`, `SOURCE_MANIFEST.txt`), for the reasons in §7 and §15 item 6.
- Product surface untouched: no change under `packages/**` (other than nothing), `client/**`,
  `.github/**`, `action.yml`, `package.json` or `package-lock.json`.
- Working tree: `git status --porcelain` empty before and after every gate run; the recurring pnpm
  debris was neither staged nor removed.

## 15. Remaining documentation limitations (what this does not prove)

1. No published package, tag, release, Marketplace listing or Pages deployment exists, so every
   install/`npx`/`uses:` form in the docs is labelled a future capability and stays unexercised by a
   consumer.
2. The recovered-source `ci.yml` used for release qualification has never been allocated a
   GitHub-hosted runner, so its hosted lanes and the hosted Ubuntu browser cell remain
   **unqualified**; the qualified CI evidence for the current workflow is self-hosted only (Actions run
   `36562157439`). That statement is scoped to the current workflow. GitHub-hosted runners did execute
   this repository's bootstrap-era archive-import workflows (Actions runs `32859849733`, `31819615124`
   and `31818807881`) on other commits, and they qualify nothing here — the era distinction and the
   wording it forced into the current documents are recorded in the closure section at the end of this
   file. An earlier draft of this item made the scoped claim into an all-history negative, which the
   auditor rejected as false.
3. The browser suites were not re-run in Stage 10; the current browser claims rest on the Stage 7/8/9
   executions, and this stage changed no browser code.
4. No security or conduct intake channel exists. The docs now say so instead of implying one; creating
   and verifying one is a Stage 11 prerequisite, and Stage 10 deliberately did not read or change the
   repository's private-vulnerability-reporting setting.
5. The development-tree audit is failing (1 high, dev-only) and stays unfixed by design here.
6. Two measured numbers in prose age with the tree: the tracked-path count the secret-scan reads and
   the test totals. §11 keeps them dated and bound to `fdf7fe8`; `docs/architecture/security.md` no
   longer states a raw path total, because adding this report to the repository changes it and a
   document that invalidates its own measurement is the defect Stage 10 was chartered to remove.
7. The claim matrix and raw logs live outside the repository. The in-tree reports cite what was
   measured, not the host paths that hold the transcripts.

## 16. Stage 10 decision

**PASS — the current documentation is truthful, coherent and internally consistent with the shipped
code, and is release-ready as a _candidate_.** Every current-capability claim is either supported by a
measurement taken in this stage, narrowed to what the evidence shows, or removed from current-facing
prose; historical records keep their original statements under banners and no longer sit at the
repository root pretending to be status. Publication itself is **not** authorized by this stage and
remains blocked on the §15 prerequisites plus the §12 advisory, all of which are recorded in
`docs/releasing.md`.

NEXT RECOMMENDED: **Stage 11 — Release.** Do **not** begin Stage 11 from this report.

**Superseded on one point by the closure section at the end of this file.** The verdict above is the
documentation verdict. The hosted-history closure added a separate qualification requirement — one green
low-contention clean-copy source lane on the final candidate — and that lane is RED, so **Stage 10 as a
stage is BLOCKED** and the recommendation above is not available until it is cleared.

## STAGE 10 CLOSURE — GITHUB-HOSTED HISTORY TRUTHFULNESS

Closure run of 2026-10-01 on branch `rescue/stage0-source`, beginning at `8c6a7e6` (the Stage 10 tip
that carried the false claim; Stage 9's record is its parent `8415cfe`). Scope: one false factual claim
about GitHub-hosted runner history, the record counts in this file, and an attempt to prove the corrected
tree still satisfies every non-browser gate in one low-contention clean copy. The documentation work is
complete and measured; that last proof is where this closure **stopped**, and the decision below is
BLOCKED rather than PASS. No product, CI, workflow, dependency or browser file changed.

**AUDITOR RULING: REPAIR REQUIRED.** The reviewer measured this repository's Actions history and found
that current-facing documentation asserted an all-history negative that Git and the Actions API
contradict. The ruling named the runs, demanded era separation rather than a blanket rewrite of
historical records, and required the correction to be guarded by a failing test first.

**FALSE CLAIM.** The sentence, as it stood in five current documents before `9d7f06a`:

```
No GitHub-hosted job for this repository has ever been allocated a runner
```

with the same absolute phrased four other ways, each measured in the tree at `8c6a7e6`: "GitHub-hosted
runner images (`ubuntu-latest`, `windows-latest`) have never been allocated a job for this repository"
(README), "which this repository's account has never been allocated" (CONTRIBUTING), "No hosted job for
this repository has ever been allocated" (`docs/limitations.md`), and "GitHub-hosted runners have still
never been allocated a step of this repository" (this file's own §15 item 2). Each of those is an
all-history denial. What the evidence supports is narrower, and the narrowed form is what now ships: the
workflow used for release qualification has never been allocated a hosted runner.

**HISTORICAL GITHUB EVIDENCE.** Three bootstrap-era archive-import runs did receive GitHub-hosted
runners (`stage10c/hosted-history-evidence.txt`, raw API payloads, outside the repository):

| Run           | Date (UTC) | Job               | Runner                              | Steps that succeeded                   | Step that failed                       |
| ------------- | ---------- | ----------------- | ----------------------------------- | -------------------------------------- | -------------------------------------- |
| `32859849733` | 2026-08-25 | `import`          | `1000002337`, label `ubuntu-latest` | Set up job; Check out bootstrap commit | Extract exact verified archive payload |
| `31819615124` | 2026-08-14 | `import`          | `1000000218`, label `ubuntu-latest` | Set up job; Check out bootstrap commit | Extract exact verified archive payload |
| `31818807881` | 2026-08-14 | `build-candidate` | `1000000217`, label `ubuntu-latest` | Set up job; Check out bootstrap commit | Reconstruct verified source archive    |

All three concluded `failure`, on `main`, before the source recovery that produced today's tree.

**Hosted-CI history evidence (independent re-verification).** Re-queried live from the GitHub Actions
API on 2026-10-01 with the repository owner's authenticated `gh` CLI, read-only, transcript at
`stage10c/hosted-history-reverification.txt` (outside the repository):

```
$ gh api repos/Pavithran-R-A/DiffBeacon/actions/runs/<run>/jobs \
    --jq '.jobs[] | {name,runner_id,runner_name,labels,conclusion,steps:[.steps[]|{name,conclusion}]}'
$ gh api repos/Pavithran-R-A/DiffBeacon/actions/runs/<run> \
    --jq '{name,head_branch,created_at,conclusion}'      # plus .head_commit.id
```

Queried at 2026-09-30T20:16:38Z / 20:16:42Z / 20:16:45Z / 20:16:49Z UTC (all HTTP 200, `exit=0`):

- Run `32859849733` — workflow "Bootstrap exact verified DiffBeacon tree"
  (`.github/workflows/bootstrap2.yml`), head `e0ff981`, branch `main`, created 2026-08-25T14:29:45Z,
  conclusion `failure`. Job `import` ran on runner `1000002337` ("GitHub Actions 1000002337", labels
  `ubuntu-latest`): Set up job success, Check out bootstrap commit success, Extract exact verified
  archive payload **failure**, Create clean candidate branch skipped.
- Run `31819615124` — same workflow, head `7c862eb`, created 2026-08-14T16:30:03Z, `failure`. Job
  `import` on runner `1000000218`, `ubuntu-latest`, identical step pattern (extract failed).
- Run `31818807881` — workflow "Bootstrap exact DiffBeacon tree", head `81c0b6b`, created
  2026-08-14T16:19:46Z, `failure`. Job `build-candidate` on runner `1000000217`, `ubuntu-latest`:
  Set up job success, Check out bootstrap commit success, Reconstruct verified source archive
  **failure**.
- Run `36562157439` — workflow "CI (self-hosted Stage 9)", created 2026-09-29T11:30:22Z, conclusion
  **success**, 7 jobs (`total_count` from the API), every one labelled `self-hosted` +
  `diffbeacon-stage9` on runners `diffbeacon-stage9-linux` (id 22) and `diffbeacon-stage9-win` (id 21):
  four source lanes (Linux and Windows × Node 24 and 22), the real-Chromium browser lane (Windows /
  Node 24), and two package lanes (Linux and Windows / Node 24). **Zero** of its jobs ran on a
  GitHub-hosted runner.

Interpretation, and the line this closure had to stop blurring: hosted runners **were** allocated to
this repository's jobs in the bootstrap era, so any all-history denial is false; those jobs failed in
the archive-reconstruction steps and executed none of today's source, tests, workflow or artifacts, so
they qualify nothing current; and the only run that ever passed the recovered-source gates
(`36562157439`) did so on self-hosted runners, which were unregistered afterwards. Both statements are
therefore true at once and must be read together: the bootstrap era received hosted runners, and the
recovered-source `ci.yml` has never received one.

**WHAT THOSE RUNS PROVE.** GitHub-hosted runners have been allocated to jobs in this repository, and
the hosted environment itself reached the checkout step. The claim that no hosted runner was _ever_
allocated to _this repository_ is false, and is now prevented by test.

**WHAT THEY DO NOT PROVE.** Nothing about the recovered source. Those runs executed bootstrap-era
workflows against archive-import scripts on commits that predate the product tree; they built no
DiffBeacon artifact, ran no DiffBeacon test, and touched no file in `ci.yml`. They do not qualify the
current product, the current workflow, the hosted images, or the hosted `ubuntu-latest` browser cell.
The eras are recorded separately and must not be merged in either direction.

**CURRENT CI STATE.** `.github/workflows/ci.yml` (the recovered-source workflow) has never been
allocated a GitHub-hosted runner; it stays an unexecuted contract for hosted lanes, and the hosted
`ubuntu-latest` browser cell stays unmeasured. The only qualified modern CI evidence is self-hosted:
Actions run `36562157439` at `b6e8842`, whose repository-scoped runners were unregistered afterwards.
This closure registered no runner and dispatched no remote CI run.

**CURRENT DOCS FIXED** (all in `9d7f06a`, era-scoped, nothing else rewritten):

- `README.md` — status-table row 21 and the CI paragraph.
- `CONTRIBUTING.md` — the "a CI environment that runs" row of the gap table.
- `docs/limitations.md` — the hosted-runner-images limitation.
- `docs/releasing.md` — the CI prerequisite row.
- `docs/architecture/security.md` — the executed-CI caveat.
- this file — §11's Node 22 sentence, §15 item 2, and the record counts corrected below.

Historical records were **not** rewritten: the 22 audits/recovery/research documents keep their
original statements under their existing banners, including the Stage 9 report's statement that
`npm audit` reported 0 advisories at that qualification time, which was true then.

**CONTRACT TEST.** `tests/stage10.docs-contract.test.ts` grew three guard behaviours, written RED first
against the then-current documents: `7 failed | 48 passed (55)` (`stage10c/docs-contract-RED.txt`), then
GREEN `55 passed (55)` after the prose repair (`stage10c/docs-contract-GREEN.txt`, run 23:23, which measured
the repaired prose but predates the record commit at 00:03). The runs that prove the text as it now
stands are the post-record ones, each `55 passed (55)` exit 0:
`stage10c/docs-contract-after-closure-section.txt` (01:39) and
`stage10c/docs-contract-after-reverif.txt` (01:48), plus the final-candidate run recorded in the
clean-copy paragraph below. The guards are: a per-file scan of
the 13 current documents for every hosted-history absolute phrasing (five patterns), one case requiring
at least one current document to separate the bootstrap era from current qualification, and one case
keeping the README and `docs/limitations.md` stating the hosted images unqualified. The test does **not**
require every document to narrate the history — that would be the opposite defect.

**MUTATION PROOF.** `stage10c/mutation-proof-hosted-history.sh` broke each new guarantee once each —
7 labelled mutations, all `TEETH OK`, each killing exactly the named case (`1 failed | 54 passed (55)`),
worktree byte-identical to the staged tree afterwards (`stage10c/hosted-history-mutation-summary.txt`,
hashes in `hashes-before.txt` / `hashes-after.txt`). The original 15-label harness was re-run whole
against the 55-case file: 14 labels appear in its summary stream and the 15th (`root-note`) is proven by
its own per-label log, `stage10/mutation-log.txt.root-note`, because the harness redirects that case's
stdout into the file it then deletes; the tree was restored byte-identical afterwards
(`stage10c/mutation-proof-full-rerun.txt`).

**HISTORICAL DOC COUNT: 22** Markdown files under `docs/audits`, `docs/recovery` and `docs/research`,
measured inside the clean copy (`git ls-files -- docs/audits docs/recovery docs/research | grep -c
'\.md$'`). §2 now buckets 22 (18 audits, 2 recovery, 2 research) instead of the earlier 21, which was
`fdf7fe8`'s snapshot before this record existed.

**STAGE-10 RANGE — pre-closure vs final, kept distinct.** The _pre-closure_ Stage 10 range is
`8415cfe..8c6a7e6`: **4 commits** (`git rev-list --count`), **23 unique paths**
(`git diff --name-only -M`), and the historical Markdown bucket at that tree is **22** (18 under
`docs/audits`, 2 under `docs/recovery`, 2 under `docs/research`). The closure adds commits on top of it,
so the complete Stage 10 history is **not** "4 commits": with the hosted-history record commit the range
`8415cfe..9d7f06a` measures **5 commits / 23 unique paths / +1436 −84**, and at the report candidate the
range `8415cfe..078d25c` measures **6 commits / 23 unique paths / +1686 −84** (`git rev-list --count`,
`git diff --name-only -M`, `git diff --shortstat -M`). The commit that records the blocked PHASE 7 result
changes only this file, which is already inside that range, so the final Stage 10 range is **7 commits
over the same 23 unique paths** — checked after that commit with `git diff --name-only 078d25c..HEAD`,
which must list this report alone. Insertions and
deletions are not additive across renames, so the path count is a range's `git diff --name-only` total,
never a sum of per-commit file counts.

**DEPENDENCY AUDIT.** Unchanged and unrepaired, by design: `npm audit --omit=dev` → `found 0
vulnerabilities`; `npm audit` → **1 high** (`brace-expansion`, dev-only, reached through
`@typescript-eslint/typescript-estree`), exit 1 (`stage10c/audit-full-closure.txt`,
`stage10c/audit-omit-dev-closure.txt`). Full JSON preserved outside the repository from the earlier
measurement (`stage10/npm-audit-full.json`). No `npm audit fix`, no `--force`, no change to
`package.json` or `package-lock.json` in this closure. The advisory stays a Stage 11 prerequisite, and
the Stage 9 zero-advisory statement stays history rather than a current claim.

**BROWSER: NOT RERUN.** No browser or product file changed, so the 6 Chromium files / 132 cases were not
executed in this closure. The `source` project excludes them by configuration (`vitest.config.ts` removes
`tests/stage*.browser-*.test.ts` from that project), and the lanes that do include them were run with the
repository's own `DIFFBEACON_SKIP_BROWSER=1` — the flag `ci.yml` sets on its source jobs — which makes
each Chromium case report a recorded skip reason instead of launching an engine. Chromium was not started.

**SOURCE SUITE — three measurements, and the qualifying one is RED.** (1) The last clean host source lane
against the corrected tree was **59 test files passed, 984 passed | 2 skipped (986 cases)** in 107.50s
(`stage10c/test-source-closure.txt`, run 23:32 — measured against the repaired working tree, before the
record commit at 00:03). (2) The latest host re-run after the later report edits was **5 failed | 54
passed files, 5 failed | 970 passed | 11 skipped (986 cases)** in 203.43s
(`stage10c/source-lane-before-record-commit.txt`, run 01:40). (3) The PHASE 7 low-contention clean copy on
the final candidate `078d25c` was **5 failed | 54 passed files, 6 failed | 969 passed | 11 skipped (986
cases)** in 211.73s (`stage10c/p7-cell-node24-final.test-source.txt`, started 12:28). Measurement (1) is
not evidence that "the source lane is green" for this closure — it is a dated host number on an
unclean-tree state; (3) is the measurement the closure was chartered to produce, and it is **RED**. Every
one of the seven reported failures in (3) is a budget timeout and none is an assertion failure
(`stage10c/p7-blocked-source-lane-capture.txt` names each case, its budget, its measured time and its
error). (2) was classified as shared-host contention in `stage10c/cell-failure-classification.txt`; (3)
is classified below, with the host-load and disk-free state captured at the time of the run. The wider
aggregate lanes (`npm test`, which adds the browser
project) were **environmentally blocked** on this shared host during the closure and were classified
rather than weakened: repeated full runs produced 1-failed and 10-failed file sets with 22 of 23 counted
failures being timing budgets exceeded by Git-spawning cases, and the identical cases passed in isolation
(`stage8.filesystem-boundary` hostile-name case: 2691ms against its 5000ms budget; `stage3b.real-git` 8/8
alone). No timeout, retry, fixture or Vitest configuration was changed, and no worker setting was
committed; `--maxWorkers=2` and `--no-file-parallelism` were used as command-line diagnostics only.

**MANIFEST.** `npm run manifest` → `SOURCE_MANIFEST.txt: 158 files`, unchanged from Stage 10's qualified
count; regeneration re-run immediately before `git diff --exit-code -- SOURCE_MANIFEST.txt` → clean, both
on the host and inside the clean copy. `docs/audits/` is excluded from the manifest, so this closure
section moves no entry.

**CLEAN COPY ON THE RECORD COMMIT — 17 gates, not fully green.**
`stage10c/cell-node24-closure`, a fresh `file:///` clone checked out at `9d7f06a` with identity read from
inside it: `HEAD 9d7f06a…`, detached head over `rescue/stage0-source`, 188 tracked paths, 39 Markdown
paths, 22 historical Markdown, Node `v24.21.0`, npm `11.19.0`, git `2.55.0.windows.5`,
`win32 x64 10.0.26200`, pristine worktree before the gates (`p20-cell-node24-closure.identity.txt`).
Seventeen gates ran (`p20-cell-node24-closure.gates.txt`): **13 exit 0** — `npm-ci`, `format-check`,
`lint`, `typecheck`, `docs-contract` **55/55**, `build`, `secret-scan`
(`12 finding(s), 12 classified, 0 unclassified, 0 stale`), `package-smoke`, `action-smoke`,
`manifest-regen` (158 files), `manifest-noop`, `audit-omit-dev` (0 vulnerabilities), `git-diff-check` —
and **4 exit 1**, which are not four independent product defects: `test-source` (the contention
classification above), `audit-full` (the intentional, already-recorded dev-tree advisory), and `verify`
and `check`, aggregate scripts that re-run the source tests and therefore fail downstream of
`test-source`. This cell is **not** reported as fully green, and it is not the qualifying measurement;
the final-candidate cell below is the qualifying one, and it too is RED. Node 22 on the same tree: portable
`v22.23.3` with npm 10.9.9, docs
contract **55/55** exit 0, source lane under `--no-file-parallelism`
`1 failed | 983 passed | 2 skipped (986)` — the same single budget timeout as Node 24's serialized lane
(`1 failed | 58 passed (59)` files, `983 passed | 2 skipped`), so the two runtimes agree case-for-case.
Still a host run on Windows, not a GitHub-hosted runner run. Cell worktree pristine after all gates; no
runner registration, no new remote CI run, and no commit was created merely to record the predictable
hosted failure under an exhausted hosted allowance.

**FINAL-CANDIDATE CLEAN COPY (PHASE 7) — source lane RED, closure BLOCKED.**
`stage10c/cell-node24-final`, a fresh disposable `file:///` clone checked out at the report candidate
`078d25c87452dcd8200c517c039a00746ff95710`, identity read from inside it (`HEAD 078d25c…`, detached head,
pristine worktree, 188 tracked paths, 39 Markdown paths, 22 historical Markdown, Node `v24.21.0`, npm
`11.19.0`, git `2.55.0.windows.5`, `win32 x64 10.0.26200` — `p7-cell-node24-final.identity.txt`), gates
run serially by `stage10c/p7-run-cell-final.sh` with `DIFFBEACON_SKIP_BROWSER=1` and `LEFTHOOK=0`, one
Vitest process at a time and no Chromium. Result (`p7-cell-node24-final.gates.txt`): **13 gates exit 0**
— `npm-ci` (214 packages, 23 s), `format-check`, `lint`, `typecheck`, `docs-contract` **55/55**, `build`,
`secret-scan` (`12/12/0/0`), `package-smoke`, `action-smoke`, `manifest-regen` (158 files),
`manifest-noop`, `audit-omit-dev` (0 vulnerabilities), `git-diff-check` — and **4 exit 1**: `test-source`,
`audit-full` (the by-design dev-tree advisory), and `verify` + `check`, which re-run the source tests and
so fail downstream of `test-source` rather than independently.

The source lane is the reason this closure cannot be a PASS: **5 failed | 54 passed files, 6 failed | 969
passed | 11 skipped (986 cases)**, 211.73 s wall against 1827.30 s of aggregate test time. All seven
reported failures (six cases plus one `beforeAll` hook) are budget timeouts, none an assertion failure:
`stage5.cli-adversarial-refs` hook 10000 ms budget; `cli.integration` "path with spaces" 21073 ms and
"binary paths with spaces and Unicode" 20392 ms against 20000 ms; `stage3b.real-git` 28906 ms and 40297
ms against 20000 ms; `stage5.git-determinism` 75239 ms against 60000 ms; `stage8.filesystem-boundary`
hostile-name case 6087 ms against 5000 ms. Diagnostic re-runs on the same tree, serialized: the five
failing files together give `1 failed | 4 passed` files / `1 failed | 48 passed` tests
(`p7-failing-files-isolated.txt`), so the four Git-spawning files and five of the six cases pass without
parallel load; the hostile-name case still fails at 5609 ms and again at 5774 ms running its file alone
(`p7-hostile-name-alone.txt`), and it performs only `existsSync` on the reported names — no Git. Host
state at capture: 16 logical CPUs, 41.5 % processor time (1 s sample), 387 processes, 35 browser
processes and 8 idle `node` processes from other sessions, 7.78 GB free of 15.6 GB RAM, and **C: with
4.6 GB free of 476 GB (100 % used)** — the same volume the test fixtures and the clone live on, which had
6.5 GB free before this cell's `npm ci`. Full capture in `stage10c/p7-blocked-source-lane-capture.txt`.

What was **not** done, on purpose: no timeout, test, fixture, worker count or Vitest configuration was
changed to obtain a green number; no dependency, workflow, product or browser file was touched; the
PHASE 8 Node 22 targeted proof was not run, because the brief stops the pipeline at the first red
qualifying gate rather than re-measuring a red lane on a second runtime. The cell worktree was pristine
after the gates, no runner was registered and no remote CI run was dispatched. **This candidate is
therefore not qualified, and nothing from this closure has been pushed.**

**WORKING TREE.** `git status --porcelain` shows only the recurring untracked `pnpm-lock.yaml` /
`pnpm-workspace.yaml` debris, which was neither staged nor deleted; nothing else differs from HEAD after
the closure commits.

**STAGE 10 FINAL DECISION: BLOCKED.** The documentation objective is met and measured: the hosted-CI
history is stated per era in every current document, the false all-history negative is gone, its return
is prevented by a test proven to bite (docs contract **55/55**, five separate green runs plus an in-cell
run), the manifest is a 158-entry no-op, and 13 of 17 clean-copy gates are exit 0 on the final candidate.
The qualification objective is **not** met: PHASE 7 requires the source suite to complete green in the
low-contention clean copy, and it did not — 6 cases and 1 hook exceeded their budgets, and one of them now
exceeds its budget even when its file runs alone, which contention does not explain. Stage 10 stays open
at that one gate. Publication remains blocked on `docs/releasing.md`, whose prerequisites include the
dev-only advisory and a real hosted CI run; neither is implicated by the blocked lane.

**NEXT: clear the PHASE 7 source lane on a quieter or less-full host (or investigate the hostile-name
case's `existsSync` budget as its own stage), then re-qualify `078d25c` or its successor.** Do **NOT**
begin Stage 11.
