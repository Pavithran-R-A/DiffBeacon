# Stage 10 — OSS documentation qualification

STATUS: **PASS**

STARTING SHA: `8415cfefa9bc23a512e0b9a5e298c267591ebcfe` (`8415cfe`), branch `rescue/stage0-source`
ENDING QUALIFIED SHA: `fdf7fe85b8d2ba250c1830e582e107c5a5ce5fe8` (`fdf7fe8`) — the commit the clean-copy
proof in PHASE 20 was run against. The commit that adds this report changes only
`docs/audits/stage10-oss-documentation.md` (this file, which `scripts/source-manifest.mjs` excludes by
prefix and `tests/stage10.docs-contract.test.ts` excludes from its current-document scan set),
`docs/architecture/security.md`, `tests/stage10.docs-contract.test.ts` (§7 defect 2) and
`SOURCE_MANIFEST.txt`; no `packages/**`, `client/**`, `.github/**`, `action.yml`, lockfile or
`package.json` path differs from `fdf7fe8`. The clean-copy cell of §13 was re-run against that report
commit before it was pushed, so the record and the proof are the same tree except for those four
documentation and test-contract paths.

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
21 Markdown files under `docs/audits/`, `docs/recovery/` and `docs/research/`. The test asserts these
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
| `docs/limitations.md`                 | **PASS** | New file. States the limits as current facts: no published package, no hosted runner ever allocated, hosted-Linux browser cell never measured, no intake channels, observation-not-judgment scope, and the platform-gated skips.                                                                                                                                                                                                                                                        |
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

**Mutation proof (`stage10/mutation-proof.sh`, 14 labelled mutations, each restored from the index):**

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
| `vitest run tests/stage10.docs-contract.test.ts --project source` | 0     | 1 file, 39/39 (40/40 at the report commit — §7)                                                                                        |
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

Test totals for the record: **65 test files** (59 `source` + 6 `browser`), **1 102 cases**; under the
skip flag 968 ran and 134 were skipped with an explicit reason (the 2 source skips are the
platform-gated invalid-UTF-8-path cases, which only a POSIX filesystem can create). The browser
project's **132 cases across 6 files** were **not** re-executed in Stage 10 — they are the 132 skips in
the aggregate line above (see §9 for why).

Those totals are `fdf7fe8`'s, and the version of the contract test that ships in this record commit has
one case more (§7 defect 2). Measured on the host tree at exactly the content this commit stores, with
the same two environment settings: **59 test files passed / 6 skipped, 969 passed / 134 skipped
(1 103 cases), `npm run check` exit 0**, secret scan still `12/12/0/0`, package-smoke and action-smoke
unchanged (`stage10/p22-host-check-before-commit.txt`, outside the repository). The mutation harness was
re-run against that 40-case file too: 14 of 14 labelled mutations killed, `1 failed | 39 passed`, the
length mutation `2 failed | 38 passed`, worktree restored from the index afterwards
(`stage10/p21-mutation-summary-40cases.txt`).

Node 22 check, done inside the same clean copy with the portable `v22.23.3` (npm 10.9.9), labelled
honestly as a host run on Windows rather than a runner run: docs-contract **39/39** (40/40 against the
report commit's version of the test), full source suite
**59 files, 968 passed / 2 skipped**, both exit 0, worktree pristine afterwards. Nothing here is a
GitHub-hosted Node 22 run; no hosted runner has ever been allocated.

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

## 14. Files changed / moved / deleted

- **Changed: 22 files** across the two Stage 10 commits — 11 modified (`README.md`, `CHANGELOG.md`,
  `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `AGENTS.md`, `SOURCE_MANIFEST.txt`,
  `docs/architecture/overview.md`, `docs/architecture/security.md`,
  `docs/detectors/initial-detectors.md`, `docs/recovery/README.md`), 5 added (`docs/README.md`,
  `docs/limitations.md`, `docs/releasing.md`, `docs/examples/attention-map-sample.diff`,
  `tests/stage10.docs-contract.test.ts`), 6 renamed; `+971 / −84` in `1883676` and `+2 / −2` in
  `fdf7fe8`.
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
2. GitHub-hosted runners have still never been allocated a step of this repository, so `ci.yml`'s
   hosted lanes and the hosted Ubuntu browser cell remain **unqualified**; the qualified CI evidence is
   self-hosted only (Actions run `36562157439`).
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
