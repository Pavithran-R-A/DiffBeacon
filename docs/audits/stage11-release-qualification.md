# Stage 11 — v0.1.0 release-candidate qualification

STATUS: **PASS for the engineering gate; PUBLIC RELEASE NOT AUTHORISED** — see §11 for the two
operator prerequisites that remain open.

STARTING SHA: `1bd99c12a9d7d75183be0ba442fc2d7023ef1c69` (`1bd99c1`), the tip of
`origin/rescue/stage0-source` and the ending qualified SHA of Stage 10.

COMMITS CREATED BY THIS STAGE (each pushed, each verified against the remote):

| Commit      | Message                                                                          | What it changes                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9c38ed0`   | `chore(deps): clear release-blocking development audit`                          | `package-lock.json` (two `brace-expansion` resolutions) and `SOURCE_MANIFEST.txt`                                                                  |
| `889f52b`   | `fix(browser): ship a production demo artifact with project-relative sourcemaps` | `vite.config.ts`, `tests/stage7.browser-harness.ts`, `tests/stage7.browser-build.test.ts`, `SOURCE_MANIFEST.txt` (3 file digests)                  |
| this report | `docs: record v0.1.0 release qualification`                                      | the current documents listed in §9, `tests/stage10.docs-contract.test.ts`, the Stage 9 workflow header comment, `SOURCE_MANIFEST.txt`, this report |

BRANCH: `release/v0.1.0`, created in PHASE B from the current tip of
`origin/rescue/stage0-source` — not from `main`. Normal forward pushes only; no force-push
occurred at any point in this stage.

`origin/main`: `e0ff98143bfe39c80c338518d006525a846a8739` — **not touched**. It is an ancestor of
the candidate (`git merge-base --is-ancestor origin/main origin/rescue/stage0-source` → exit 0).
`origin/rescue/stage0-source`: `1bd99c12a9d7d75183be0ba442fc2d7023ef1c69` — **not touched, not
deleted**. `origin/rescue/stage9-selfhosted-ci`, `origin/tmp/stage9-selfhosted-smoke` and the
local `tmp-d1-proof` branch were left in place, per the safety rules.

Everything below is a measurement taken on 2026-10-04 unless a line says otherwise. Raw logs, the
field-level `npm audit --json` records, job logs and clean-clone cell output live **outside** the
repository, in `…/904c4a23/stage11/`, because they name host paths and carry credential-shaped
canary text. The in-tree documents cite that evidence by content, not by path.

---

## 1. PHASE A — inherited state, and why the host could not be the only oracle

Executed from the repository root and captured (`phaseA-git-state.txt`, `phaseA-env.txt`):
`git remote -v` resolved `origin` to `https://github.com/Pavithran-R-A/DiffBeacon.git` for both
fetch and push — the remote is exactly `Pavithran-R-A/DiffBeacon`. `git status --short` showed the
two recurring pnpm debris files (`pnpm-lock.yaml`, `pnpm-workspace.yaml`); they were left
untracked and unstaged, and are not in any commit here. `git branch -avv` is the table quoted in
the header. `git fetch origin --prune` exited 0 and removed nothing.

Environment at the start of the run: 16 logical CPUs, 15.60 GB total / 10.75 GB free memory, 348
processes, and volume `C:` at 475.1 GB with 15 GB free (96.8 % used). A WSL probe
(`wsl-probe-out.txt`, `wsl-probe3.txt`) found no `node` and no `npm` on that side and a 99 %-full
data volume, so WSL could not serve as the Linux qualification cell. The host is a shared machine
under the same disk pressure that produced the Stage 10 timing failures. PHASE C therefore did not
reproduce that environment and compensate in the tests: the Linux and browser cells were pushed to
GitHub-hosted runners (PHASE F), which is what the brief directs when the volume is severely
constrained. No timing assertion was enlarged, no test was skipped, and no worker setting was
committed to make a number green.

## 2. PHASE B — the release branch

`release/v0.1.0` did not exist remotely, so it was created from `origin/rescue/stage0-source` at
`1bd99c1` and pushed with `git push -u origin release/v0.1.0`. `git rev-parse HEAD` and
`git ls-remote origin refs/heads/release/v0.1.0` matched at creation and after every subsequent
push; the measured pairs are in §10.

## 3. PHASE D — the development dependency audit, resolved at its root cause

Before the change, in a clean `npm ci` install of the tracked lockfile
(`phaseD-audit-dev-before.json`, `.txt`; `phaseD-audit-release-before.txt`):

```
npm audit --omit=dev --audit-level=high   found 0 vulnerabilities   (exit 0)
npm audit --audit-level=high              1 high severity vulnerability
```

The single high was `brace-expansion <=1.1.20 || 4.0.0 - 5.0.11` (advisories
`GHSA-6j4f-fj2g-mc7p`, `GHSA-qhr7-859c-m2p7`, `GHSA-q2hr-2g5m-vwhr`, all denial-of-service) reached
by exactly two development chains:

```
node_modules/brace-expansion                                        1.1.18  via minimatch 3.1.5
node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion  5.0.9   via minimatch 10.2.6
```

Both dependents already accept the patched releases in their existing semver ranges, so
`npm update brace-expansion` (`phaseD-update-brace-expansion.txt`: "changed 3 packages") moved them
to **1.1.21** and **5.0.12**. No `package.json` field changed, `npm audit fix --force` was not run,
the lockfile was not hand-edited, and no audit threshold or `--audit-level` was lowered. After the
update, in the same tree:

```
npm audit --omit=dev --audit-level=high   found 0 vulnerabilities   (exit 0)
npm audit --audit-level=high              found 0 vulnerabilities   (exit 0)
```

`npm outdated` was **not available on the first three attempts**, all taken against this working
tree, and the audit records that rather than glossing it:

```
phaseD-outdated.txt        2026-10-04T08:40:24Z  ECONNRESET fetching typescript-eslint
phaseH-npm-outdated.txt    2026-10-04T10:07:52Z  ECONNRESET fetching @types/node           (exit 1)
phaseH-npm-outdated2.txt   2026-10-04T10:08:43Z  ECONNRESET fetching eslint-plugin-react-hooks (exit 1)
```

The fourth attempt, 2026-10-04T10:13:43Z, completed (`phaseH-npm-outdated3.txt`) and lists fifteen
entries, each an upstream release newer than the pinned one: `@eslint/js` 9.39.5 → 10.0.1,
`@types/node` 24.13.3 → 24.19.1 wanted → 26.6.4 latest, `@types/react` and `@types/react-dom`
19.2.x → 19.3.0, `@vitejs/plugin-react` 5.2.0 → 6.1.1, `eslint` 9.39.5 → 10.12.0, `globals`
16.5.0 → 17.13.0, `lucide-react` 0.453.0 → 1.52.0, `prettier` 3.9.6 → 3.9.9 wanted, `react` and
`react-dom` 19.2.8 → 19.3.0, `typescript` 5.9.3 → 7.0.2, `typescript-eslint` 8.67.0 → 8.71.0 wanted,
`vite` 8.2.1 → 8.3.2 wanted, `vitest` 4.1.11 → 5.0.3. The command's exit code was 1 because
outdated packages exist, which is its documented behaviour, not a failure.
None of these entries carries an advisory — the two audits above are the controlling dependency
evidence and both read zero — so the decision was to act only on the advisory chain and leave the
rest. Moving lint/build tooling would widen the change surface without closing a gate, and every
lockfile move would require re-qualifying the whole candidate.
`SOURCE_MANIFEST.txt` was regenerated for the new `package-lock.json` digest and the drift is one
line (`phaseD-lockfile-diff.txt`, `phaseD-manifest-regen.txt`). The full gate was then run before
committing, as the brief requires when dependency files change (§5).

## 4. The browser-lane defect — root cause, not a timeout

Hosted run `37190394247` had the four source cells green and the real-Chromium lane red at
`tests/stage7.browser-build.test.ts:451`, in "leaks no local machine path and no credential-shaped
string": `AssertionError: index-otw7iAVX.js: expected true to be false`
(`phaseF-run-37190394247-browser-job.log`).

Investigation before any change showed the defect was in the **test harness**, not in the
assertion's budget:

- The harness spawned the Vite build with the test runner's own environment. Vite defaults `NODE_ENV`
  only when it is unset, so on a CI runner that already exports a development mode the artifact under
  audit was a **development** build — every `jsxDEV` call site carried an absolute source path, and
  React shipped in development mode. The bundle therefore did contain machine paths, which the
  assertion correctly reported.
- The same artifact passed on this Windows host because Vite writes POSIX separators into those
  paths while `USERPROFILE` uses backslashes, so the needle never matched locally. That is a false
  negative in the guard, and it hid a real defect in the shipped artifact.
- Sourcemap `sources` were named relative to the map file, so a build performed outside the
  repository produced entries escaping upwards into the host directory layout.

The repair (`889f52b`, three files: `vite.config.ts`, `tests/stage7.browser-harness.ts`,
`tests/stage7.browser-build.test.ts`) is an engineering fix to the build configuration and its
guards; it changes no threshold, no timeout and no skip:
`buildWeb()` now passes `NODE_ENV: 'production'` to the Vite child instead of inheriting the
runner's `NODE_ENV=test`; `vite.config.ts` adds a `sourcemapPathTransform` that resolves each
sourced entry and re-names it relative to the project root, which also makes the artifact independent
of where the repository was checked out; the build fingerprint includes the repository root so two
checkouts cannot reuse each other's cached artifact; leak needles are compared with separators
normalised, closing the Windows false negative; and a positive assertion now requires the shipped
bundle to be a production build whose sourcemap sources stay inside the project.

Red-then-green was measured on this host. With the separator-normalised comparison in place and the
production-mode environment not yet forced, the guard fails locally on the pre-fix tree:
`stage7.browser-build.test.ts (20 tests | 2 failed)`, the two failures being "leaks no local machine
path and no credential-shaped string" and the new "ships a production build whose sourcemaps point
inside the project" (`phaseG-browser-RED.txt`). After the fix the same file is
`Test Files 1 passed (1)`, `Tests 20 passed (20)` (`phaseG-browser-GREEN.txt`, engine
`chromium (chromium-1234); version=151.0.7922.34`).

## 5. PHASE E — the local engineering gate at `889f52b`

Each command was run against the tree at the candidate commit and captured under `stage11/`. The
working tree here is the one this stage built (its `node_modules` was installed with `npm ci` after
the PHASE D lockfile change); §7 records the independent clean clone.

| Command                                                                                   | Result                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                                                    | `All matched files use Prettier code style!` (`phaseE-format-check.txt`)                                                                                                                                                                                                                                |
| `npm run lint` (`--max-warnings=0`)                                                       | no output, exit 0 (`phaseE-lint.txt`)                                                                                                                                                                                                                                                                   |
| `npm run typecheck`                                                                       | `tsc --noEmit -p tsconfig.json`, exit 0 (`phaseE-typecheck.txt`)                                                                                                                                                                                                                                        |
| `npm run secret-scan`                                                                     | `secret scan: 12 finding(s), 12 classified, 0 unclassified, 0 stale` (`phaseE-secret-scan.txt`)                                                                                                                                                                                                         |
| `npm run test:source`                                                                     | `Test Files 59 passed (59)`; `Tests 984 passed \| 2 skipped (986)` (`phaseE-test-source.txt`)                                                                                                                                                                                                           |
| `npm test` (source + browser, real Chromium)                                              | `Test Files 65 passed (65)`; `Tests 1117 passed \| 2 skipped (1119)` (`phaseG-verify.txt`). The same command on the pre-fix tree printed `Tests 1116 passed \| 2 skipped (1118)` (`phaseE-test.txt`); the extra test is the production-build assertion §4 added.                                        |
| `npm run build`                                                                           | exit 0 (`phaseE-build.txt`)                                                                                                                                                                                                                                                                             |
| `npm run build:action` then `git diff --exit-code -- packages/action/dist/index.js`       | bundle rebuilt and byte-identical to the committed bundle (empty diff, `phaseE-action-bundle-diff.txt`)                                                                                                                                                                                                 |
| `npm run package-smoke`                                                                   | `package-smoke: 0.1.0; bin=true; engines=>=22; … tarballFiles=4; license=MIT; runtimeDependencies=0; artifactSecretFindings=0`                                                                                                                                                                          |
| `npm run action-smoke`                                                                    | `action-smoke: packages/action/dist/index.js wrote 1250 bytes to the Job Summary; stdout=""; cliLeak=false; hostilePaths=true; cleanWorkspace=true; oversizeRejected=true; partialSummary=false; pullRequestTargetRejected=true`                                                                        |
| `npm run manifest` then `git diff --exit-code -- SOURCE_MANIFEST.txt`                     | `SOURCE_MANIFEST.txt: 158 files`, no drift (`phaseE-manifest.txt`)                                                                                                                                                                                                                                      |
| `npm run verify`, then `npm run check` (package.json defines `check` as `npm run verify`) | `DiffBeacon source-first verification passed.`, `VERIFY_EXIT=0` and `CHECK_EXIT=0` — both run on the exact bytes of this commit, `verify` as `phaseH-verify-final.txt` and `check` as `phaseH-check-final.txt`; `phaseG-verify.txt` is the same gate at `889f52b`, before the documentation corrections |

The 2 skips are the platform-gated cases that record why they skip: the real-Git half of
`tests/stage8.invalid-byte-paths.test.ts`, which needs a POSIX filesystem to create a filename whose
bytes are not valid UTF-8. No browser test was converted into a skip; the browser project ran here
against a real Chromium and in CI against `/usr/bin/google-chrome` (§6).

## 6. PHASE F — GitHub-hosted CI on the release branch

`.github/workflows/ci.yml` needed no change in this stage: it already qualifies Node 22 and 24 on
`ubuntu-latest` and `windows-latest`, runs the source-first gate, keeps the real-Chromium lane, keeps
both dependency audits as blocking steps, verifies the committed Action bundle, and holds
least-privilege `contents: read` with no `pull_request_target`, no `id-token: write` and no
`pull_request_target` anywhere in `.github/workflows/`. What it needed was runners, and this is the
measured run history for the workflow as it ships
(`phaseH-run-history.txt`, `phaseH-jobs-detail.txt`):

| Run           | Branch                 | Commit    | Created (UTC)        | Conclusion                  | What failed                                                                                                           |
| ------------- | ---------------------- | --------- | -------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `36971746510` | `rescue/stage0-source` | `1bd99c1` | 2026-10-02T06:03:37Z | failure                     | four source cells at "Dependency audit (development tree)"; browser lane at "Browser suites (real Chromium required)" |
| `37188759053` | `release/v0.1.0`       | `1bd99c1` | 2026-10-04T08:23:22Z | failure                     | same two steps, same reason                                                                                           |
| `37190394247` | `release/v0.1.0`       | `9c38ed0` | 2026-10-04T08:53:46Z | failure                     | four source cells **success**; browser lane red at `tests/stage7.browser-build.test.ts:451` (§4)                      |
| `37191968216` | `release/v0.1.0`       | `889f52b` | 2026-10-04T09:22:56Z | **success — all five jobs** | —                                                                                                                     |

The green run's job IDs and per-lane measurements:

- **Source ubuntu-latest / Node 24** (job `111405890237`) —
  `Test Files 59 passed \| 6 skipped (65)`, `Tests 985 passed \| 134 skipped (1119)`, and
  `tests/stage8.invalid-byte-paths.test.ts (10 tests)` ran with **no** skip, i.e. the POSIX-only
  case executed on a hosted Linux runner. `DiffBeacon source-first verification passed.`
  (`phaseH-hosted-linux-node24-job.log`)
- **Source ubuntu-latest / Node 22** (job `111405890256`) — success.
- **Source windows-latest / Node 24** (job `111405890255`) —
  `Test Files 59 passed \| 6 skipped (65)`, `Tests 984 passed \| 135 skipped (1119)`, with
  `stage8.invalid-byte-paths.test.ts (10 tests \| 2 skipped)` printing its recorded reason
  ("this host cannot create a filename whose bytes are not valid UTF-8").
  `DiffBeacon source-first verification passed.` (`phaseH-hosted-windows-node24-job.log`)
- **Source windows-latest / Node 22** (job `111405890243`) — success.
- **Browser lane ubuntu-latest / Node 24** (job `111405890064`) —
  `Test Files 6 passed (6)`, `Tests 133 passed (133)`, engine reported as
  `browser engine: /usr/bin/google-chrome; version=154.0.8037.57` in all six files. This is the
  first time a real Chromium suite in this repository reached success on a GitHub-hosted runner.
  (`phaseH-hosted-browser-job.log`)

Run URL: <https://github.com/Pavithran-R-A/DiffBeacon/actions/runs/37191968216>. Runner image
`Version: 20260927.320.1` on `ubuntu-latest` as reported in the job logs.

The three red runs are recorded rather than quietly dropped: two failed at the development-tree
audit step that PHASE D closed, and one failed at the browser assertion that §4 repaired. This
workflow's hosted history is distinct from the bootstrap-era archive-import runs
(`32859849733`, `31819615124`, `31818807881`), which were allocated hosted runners and failed during
archive extraction; see `docs/audits/stage1-rebaseline.md`. The only executed lane of
`.github/workflows/ci-self-hosted-stage9.yml` remains self-hosted run `36562157439`, whose runners
were unregistered afterwards.

## 7. Clean-clone measurement of the candidate tree

A separate clone of `889f52b6e53095fea978fafbe50017ff71e543db` (`stage11/gq-889f52b`, outside the
working tree) installed with `npm ci`: `added 214 packages in 31s`, `NPM_CI_EXIT=0`
(`phaseG2-cleanclone-npm-ci-889f52b.txt`). npm printed its `install-scripts` notice for
`esbuild@0.28.2` postinstall; that is npm's default policy message, not an error, and the exit code
is 0. In that clone at 2026-10-04T09:35:04Z on Node `v24.21.0` / npm `11.19.0`
(`phaseG2-audits-889f52b.txt`, with the raw `--json` records preserved as
`phaseG2-audit-release-json-889f52b.json` and `phaseG2-audit-full-json-889f52b.json`):

```
npm audit --omit=dev --audit-level=high   found 0 vulnerabilities   RELEASE_AUDIT_EXIT=0
npm audit --audit-level=high              found 0 vulnerabilities   FULL_AUDIT_EXIT=0
```

### Mapping to `docs/releasing.md` section 1

Rows marked **pending** are stated as pending: they are executed by PHASE G on a clean clone of the
pushed candidate and recorded by the follow-up commit, not claimed here.

| Runbook step                          | Where it was executed                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 clean clone, `npm ci`               | executed: `stage11/gq-889f52b`; pending: the PHASE G clone of the pushed candidate                                                                                                         |
| 2 `npm run verify`                    | executed: local tree (§5) and `npm run check` on the finished documentation tree (§9); pending: the clean clone of the pushed candidate                                                    |
| 3 bundle equals a rebuild             | executed: `git diff --exit-code -- packages/action/dist/index.js` empty in the local tree (§5); pending: the same check in the clean clone                                                 |
| 4 `SOURCE_MANIFEST.txt` current       | executed: `npm run manifest` byte-identical, 158 files (§5); pending: the same check in the clean clone                                                                                    |
| 5 both audits, dated and committed    | executed: `found 0 vulnerabilities`, exit 0 on both, in a clean `npm ci` clone of `889f52b` at 2026-10-04T09:35:04Z; pending: re-measured on the pushed candidate                          |
| 6 matrix, both OSes at Node 22/24     | **GitHub-hosted runners**, not this host: the four source cells plus the real-Chromium `ubuntu-latest` cell of run `37191968216` (§6). Skips carry their printed reason on both platforms. |
| 7 `npm pack --dry-run`, file list     | **pending** — PHASE G on the pushed candidate, with the installed-tarball consumer smoke in a temporary directory outside the repository                                                   |
| 8 release commit reviewed as artifact | **not done** — an operator action; the bundle and the workflow pins are part of the diff a reviewer would read                                                                             |

PHASE G's full clean-clone gate on the _pushed candidate_ — `npm run verify`, `npm run check`, the
Action bundle freshness check, `npm pack --dry-run`, and the installed-tarball consumer smoke — is
recorded by a follow-up commit that updates this section in place. That commit touches no gate
input: `docs/audits/**` is excluded from `SOURCE_MANIFEST.txt` by prefix, is outside the
current-document scan set of `tests/stage10.docs-contract.test.ts`, and appears in no shipped
artifact.

## 8. Release-surface identity, re-measured on 2026-10-04

- `npm view diffbeacon` → registry `E404 Not Found`
  (`https://registry.npmjs.org/diffbeacon`), npm exit 1 (`phaseH-registry-889f52b.txt`). The name is
  **unpublished**; `0.1.0` stays unreleased in `CHANGELOG.md`.
- `git ls-remote --tags origin` → **0 tags** (`phaseH-remote-identity.txt`).
- `GET /repos/Pavithran-R-A/DiffBeacon/releases` → `[]`, 0 releases.
- `GET /repos/Pavithran-R-A/DiffBeacon/pages` → `404 Not Found`: no Pages deployment.
- `GET /repos/Pavithran-R-A/DiffBeacon` → `private: true`, `fork: false`, default branch `main`. The
  repository is **still private**; no Marketplace listing exists for it.
- `GET /repos/Pavithran-R-A/DiffBeacon/private_vulnerability_reports` → `{"message":"Not Found",
"status":"404"}`. GitHub answers the same way to a viewer without access, so **this lookup does
  not establish the setting**; it is recorded as inconclusive, and nothing in this stage changed it.

## 9. The documentation contract, and the prose the measurements falsified

PHASE H applied the repository's own mechanism: the guard was widened first and observed failing
before any document was edited (`phaseH-docs-RED.txt`: `Tests 6 failed \| 62 passed (68)`).
`tests/stage10.docs-contract.test.ts` now carries a `STALE_CURRENT_STATE_CLAIMS` table — claims
that were true when Stage 10 closed and that these measurements falsify (hosted runners never
allocated to this workflow, the `ubuntu-latest` browser cell unmeasured, the development audit
reporting one high) — plus `CURRENT_HOSTED_EXECUTION` (`37191968216`) as the required current-half
evidence, and it requires both `README.md` and `docs/limitations.md` to record the hosted run. The
first draft's pattern required the word "hosted" near "allocated" and so missed
`CONTRIBUTING.md`; widening it to `/(?:has|had) never been allocated/i` caught that file too, which
is the reason the guard is written as patterns rather than quoted prose.

Then the current-facing documents were updated with the measured facts and nothing else:
`README.md` (status table dated 2026-10-04, both hosted rows, the checkout-contract paragraph),
`docs/limitations.md` (hosted coverage, platform coverage including the hosted Linux measurement, the
advisory reading), `docs/architecture/security.md` ("what this does not prove"),
`docs/releasing.md` (§0 re-measured: the development-audit and CI-environment prerequisites closed,
security and conduct intake still open), `CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md` (the
inconclusive read-only lookup, stated as inconclusive), `docs/README.md`,
`packages/action/README.md` (local and hosted lanes, with consumption still unqualified), and the
header comment of `.github/workflows/ci-self-hosted-stage9.yml`, whose original authorization reason
is kept as dated history with a 2026-10-04 correction appended rather than deleted.

After those edits the guard is green: `tests/stage10.docs-contract.test.ts (68 tests)` passing, and
with its two neighbour document-binding files `Test Files 3 passed (3)`, `Tests 100 passed (100)`
(`phaseH-docs-GREEN.txt`, `phaseH-docs-GREEN2.txt`). The full gate was then re-run on that
documentation tree: `Test Files 65 passed (65)`, `Tests 1130 passed | 2 skipped (1132)` — 13 more
than §5's 1119, which is exactly the 13 per-document stale-claim cases the widened guard added —
followed by build, artifact freshness, secret scan (12 classified, 0 unclassified, 0 stale),
manifest drift, CLI startup, package smoke and Action smoke, ending
`DiffBeacon source-first verification passed.` with `VERIFY_EXIT=0`
(`phaseH-verify-local2.txt`, started 15:36:27 and finishing 15:41 local, UTC+05:30). The first
attempt at that run failed for
a real reason rather than a flake: the documentation files had been edited after
`npm run manifest`, so `SOURCE_MANIFEST.txt` no longer matched the tracked source and
`scripts/verify.mjs` refused to rewrite the tree (`phaseH-verify-local.txt`: `VERIFY_EXIT=1`). The
fix was `npm run format` and `npm run manifest`, not a change to the check.

Three further prose corrections came after that pass, each one tightening a claim this report had
made ahead of its measurement: §3 now lists the three `npm outdated` attempts that failed with
`ECONNRESET` before the fourth succeeded; §9 no longer credits `phaseH-verify-local2.txt` with the
committed tree; and §7's runbook mapping labels each step executed or pending instead of describing
PHASE G's clean-clone work as already done. `docs/releasing.md` and `docs/README.md` were narrowed the
same way — section 1 is now "exercised", with §7 stating which steps ran where. The authoritative
gate for the committed tree is therefore the run named in §5: `npm run verify` and `npm run check` on
exactly the bytes this commit contains (`phaseH-verify-final.txt`, `phaseH-check-final.txt`).

## 10. Push verification

| After                   | `git rev-parse HEAD`                                                      | `git ls-remote origin refs/heads/release/v0.1.0`     | Match |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- | ----- |
| PHASE B branch creation | `1bd99c1…`                                                                | `1bd99c12a9d7d75183be0ba442fc2d7023ef1c69`           | yes   |
| `chore(deps)` commit    | `9c38ed0…`                                                                | `9c38ed0e52255e9eee52186cfb3451f60e289e5d`           | yes   |
| `fix(browser)` commit   | `889f52b…`                                                                | `889f52b6e53095fea978fafbe50017ff71e543db`           | yes   |
| this report's commit    | written by the record commit that appends the measured pair to this table | same value, read from `git ls-remote` after the push | yes   |

No push in this stage used `--force`, no branch or tag was deleted, and `main` was never written to.

## 11. Prerequisites still open for a public release

Two rows of `docs/releasing.md` §0 are not closable by engineering work in this repository, and they
are the reason this report says PASS for the gate and NOT AUTHORISED for the release:

1. **A security reporting channel.** `SECURITY.md` publishes no address and promises no response
   time. Enabling GitHub's private vulnerability reporting changes a repository security setting,
   which this stage is not permitted to do, and inventing a monitored intake address would be a false
   claim. A human with that authority must choose and verify one channel, then re-read `SECURITY.md`
   so its claims match the configuration.
2. **A conduct reporting channel.** `CODE_OF_CONDUCT.md` states plainly that no intake exists yet.
   Publishing the same or an equivalent monitored intake is an operator action.

Everything else that gates the release is either closed here or belongs to the release steps in
`docs/releasing.md` §§2–7, none of which has been executed: no tag, no GitHub Release, no npm
publish, no repository-visibility change, no Marketplace listing.

## 12. What this report does not claim

- The Action has never been consumed by another repository, and no release commit exists for a
  consumer to pin. Every Action result above is a local or in-repository lane.
- No GitHub-hosted run of a release tag exists, because there is no tag.
- The fuzz corpus guards the written contract; it is not an absence proof for inputs outside it.
- A green hosted run qualifies exactly the five lanes it executed on the two runner images it used,
  on the commit it ran, and nothing else.
- DiffBeacon does not decide whether a pull request is safe to merge.
