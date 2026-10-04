# Stage 11 — v0.1.0 release-candidate qualification

STATUS: **PASS for the engineering gate; PUBLIC RELEASE NOT AUTHORISED** — see §11 for the two
operator prerequisites that remain open.

STARTING SHA: `1bd99c12a9d7d75183be0ba442fc2d7023ef1c69` (`1bd99c1`), the tip of
`origin/rescue/stage0-source` and the ending qualified SHA of Stage 10.

COMMITS CREATED BY THIS STAGE (each pushed, each verified against the remote):

| Commit      | Message                                                                          | What it changes                                                                                                                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `9c38ed0`   | `chore(deps): clear release-blocking development audit`                          | `package-lock.json` (two `brace-expansion` resolutions) and `SOURCE_MANIFEST.txt`                                                                                                                                                                                        |
| `889f52b`   | `fix(browser): ship a production demo artifact with project-relative sourcemaps` | `vite.config.ts`, `tests/stage7.browser-harness.ts`, `tests/stage7.browser-build.test.ts`, `SOURCE_MANIFEST.txt` (3 file digests)                                                                                                                                        |
| `860b43c`   | `docs: record v0.1.0 release qualification`                                      | the current documents listed in §9, `tests/stage10.docs-contract.test.ts`, the Stage 9 workflow header comment, `SOURCE_MANIFEST.txt`, this report                                                                                                                       |
| this commit | `docs: record v0.1.0 release qualification`                                      | this report only: §6's hosted run of `860b43c`, §7's clean-clone measurement of it, §9's re-measurement showing this edit moves no gate input, and §10's note about the pair this file cannot hold. No gate input changes, which is why the two commits share a message. |

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
untracked and unstaged, and are not in any commit here. They returned to the working tree during this
stage (file times 16:15 local, 10:45Z) and are what made the final local gate attempt fail; §9 records
the quarantine move rather than a deletion. `git branch -avv` is the table quoted in
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
(`phaseH-run-history.txt`, `phaseH-jobs-detail.txt`, `phaseF-run-list-after-A.txt`):

| Run           | Branch                 | Commit    | Created (UTC)        | Conclusion                  | What failed                                                                                                           |
| ------------- | ---------------------- | --------- | -------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `36971746510` | `rescue/stage0-source` | `1bd99c1` | 2026-10-02T06:03:37Z | failure                     | four source cells at "Dependency audit (development tree)"; browser lane at "Browser suites (real Chromium required)" |
| `37188759053` | `release/v0.1.0`       | `1bd99c1` | 2026-10-04T08:23:22Z | failure                     | same two steps, same reason                                                                                           |
| `37190394247` | `release/v0.1.0`       | `9c38ed0` | 2026-10-04T08:53:46Z | failure                     | four source cells **success**; browser lane red at `tests/stage7.browser-build.test.ts:451` (§4)                      |
| `37191968216` | `release/v0.1.0`       | `889f52b` | 2026-10-04T09:22:56Z | **success — all five jobs** | —                                                                                                                     |
| `37196432560` | `release/v0.1.0`       | `860b43c` | 2026-10-04T10:46:02Z | **success — all five jobs** | —; this is the run of the pushed record commit itself, so the candidate SHA has its own hosted measurement            |

### Run `37191968216` — the browser fix

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

### Run `37196432560` — the pushed record commit, i.e. the candidate SHA

<https://github.com/Pavithran-R-A/DiffBeacon/actions/runs/37196432560>, event push,
`release/v0.1.0`, head SHA `860b43c15b9e34688e4a4cb02b40b8a60dba434b`, created 2026-10-04T10:46:02Z,
last updated 2026-10-04T10:50:09Z, conclusion **success**, all five jobs (`gh run list` recorded in
`phaseF-run-list-after-A.txt`, job summaries in `phaseF-run-37196432560-watch.txt`, per-job
measurements in `phaseF-run-37196432560-jobs.txt`, raw logs as `runlog-<job ID>.txt`):

- **Source ubuntu-latest / Node 22** (job `111419183192`, Node 22.23.3) —
  `Test Files 59 passed \| 6 skipped (65)`, `Tests 998 passed \| 134 skipped (1132)`,
  `DiffBeacon source-first verification passed.`, `found 0 vulnerabilities` on both blocking audit
  steps, and `tests/stage8.invalid-byte-paths.test.ts (10 tests)` again with **no** skip.
- **Source ubuntu-latest / Node 24** (job `111419183196`, Node 24.21.0) — the same
  `998 passed \| 134 skipped (1132)`, verification passed, both audits at zero.
- **Source windows-latest / Node 24** (job `111419183198`, Node 24.21.0) and **Node 22**
  (job `111419183230`, Node 22.23.3) — `Tests 997 passed \| 135 skipped (1132)` each, verification
  passed, both audits at zero, with `stage8.invalid-byte-paths` printing its recorded Windows reason.
- **Browser lane ubuntu-latest / Node 24** (job `111419183205`) —
  `Test Files 6 passed (6)`, `Tests 133 passed (133)`, engine
  `/usr/bin/google-chrome; version=154.0.8037.57`.

Runner images: `ubuntu-24.04` Version `20260927.320.1` and `windows-2025-vs2026` Version
`20260925.250.1`. The per-lane totals are 13 tests higher than run `37191968216` (985 → 998 on
Linux, 984 → 997 on Windows) and the run total is 1132 rather than 1119: that is exactly the 13
per-document stale-claim cases §9 added to `tests/stage10.docs-contract.test.ts`, so the hosted
count and the local count agree on the candidate's own bytes.

The three red runs are recorded rather than quietly dropped: two failed at the development-tree
audit step that PHASE D closed, and one failed at the browser assertion that §4 repaired. This
workflow's hosted history is distinct from the bootstrap-era archive-import runs
(`32859849733`, `31819615124`, `31818807881`), which were allocated hosted runners and failed during
archive extraction; see `docs/audits/stage1-rebaseline.md`. The only executed lane of
`.github/workflows/ci-self-hosted-stage9.yml` remains self-hosted run `36562157439`, whose runners
were unregistered afterwards.

## 7. Clean-clone measurement of the pushed candidate

### 7.1 The authoritative clone: `stage11/gq-final-860b43c…`

PHASE G cloned `https://github.com/Pavithran-R-A/DiffBeacon.git` with `--no-checkout`, detached at
`860b43c15b9e34688e4a4cb02b40b8a60dba434b`, and confirmed the clone's own identity before installing:
`HEAD=860b43c15b9e34688e4a4cb02b40b8a60dba434b`, `DETACHED=HEAD`, `git status --porcelain` → **0
entries**, Node `v24.21.0`, npm `11.19.0`. Start 2026-10-04T10:46:26Z, end 2026-10-04T11:06:40Z; the
single log is `phaseG-final-860b43c15b9e34688e4a4cb02b40b8a60dba434b.txt` and the raw `--json` audit
records are `phaseG-final-release-860b43c….json` and `phaseG-final-full-860b43c….json`, all outside
the repository.

| Command in the clean clone                                                                | Measured result                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                                  | `added 214 packages in 30s`, `NPM_CI_EXIT=0`                                                                                                                                                                |
| `npm run verify`                                                                          | `Test Files 65 passed (65)`, `Tests 1130 passed \| 2 skipped (1132)`, `secret scan: 12 finding(s), 12 classified, 0 unclassified, 0 stale`, `DiffBeacon source-first verification passed.`, `VERIFY_EXIT=0` |
| `npm run check` (package.json defines `check` as `verify`)                                | the same totals, `package-smoke: 0.1.0; … tarballFiles=4; license=MIT; runtimeDependencies=0; artifactSecretFindings=0`, `action-smoke: … pullRequestTargetRejected=true`, `CHECK_EXIT=0`                   |
| `npm audit --omit=dev --audit-level=high`                                                 | `found 0 vulnerabilities`, `RELEASE_AUDIT_EXIT=0` (2026-10-04T11:05:57Z)                                                                                                                                    |
| `npm audit --audit-level=high`                                                            | `found 0 vulnerabilities`, `FULL_AUDIT_EXIT=0` (same minute)                                                                                                                                                |
| `npm run build:action` then `git diff --exit-code -- packages/action/dist/index.js`       | `BUILD_ACTION_EXIT=0`, `ACTION_BUNDLE_DIFF_EXIT=0` — the rebuild is byte-identical to the committed bundle, sha256 `45660da735388dee35fc581e94490d2aacc295b2382f8bea23ab12dff2350049`                       |
| root `action.yml` resolution                                                              | `using: node24`, `main: packages/action/dist/index.js`, `ACTION_METADATA_RESOLVES=yes bytes=49418 sha256=45660da7…` — the metadata resolves to the same fresh bundle it just verified                       |
| `npm run manifest` then `git diff --exit-code -- SOURCE_MANIFEST.txt`                     | `SOURCE_MANIFEST.txt: 158 files`, digest `06915c81408e2c484b5ed57b588bad60d220271bffae1ab46530fc5ea5351489` before **and** after, `MANIFEST_DIFF_EXIT=0`                                                    |
| `npm pack --dry-run` from `packages/cli`                                                  | `diffbeacon@0.1.0`, four entries — `1.1kB LICENSE`, `3.0kB README.md`, `57.9kB dist/index.js`, `761B package.json` — `package size: 16.8 kB`, `total files: 4`, `PACK_DRY_EXIT=0`                           |
| `npm pack` + `tar -tzf`                                                                   | `diffbeacon-0.1.0.tgz`, sha256 `3a7870e4be2cd983263c129a0dbc1a8ed93ef141889b7bd4925c43937f1c359f`, contents exactly `package/LICENSE`, `package/README.md`, `package/dist/index.js`, `package/package.json` |
| the packed manifest                                                                       | `NAME=diffbeacon`, `VERSION=0.1.0`, `ENGINES={"node":">=22"}`, `BIN={"diffbeacon":"dist/index.js"}`, `FILES=["dist","README.md","LICENSE"]`, `DEPS={}` — no test, source, build-script or host file ships   |
| `npm install <that tarball>` in `stage11/consumer-860b43c…`, a directory outside the repo | `added 1 package`, `CONSUMER_INSTALL_EXIT=0`, `node_modules/.bin` holds `diffbeacon`, `diffbeacon.cmd`, `diffbeacon.ps1`                                                                                    |
| `review --stdin --format markdown` from the installed package                             | `REVIEW_EXIT=0`, 1064 bytes of well-formed report, `REVIEW_ERR` empty                                                                                                                                       |
| the clone after all of it                                                                 | `CLONE_STATUS_AFTER=0 entries` — the gate left no tracked file modified                                                                                                                                     |

### 7.2 The consumer smoke, and the two harness defects its first pass contained

The first consumer pass asserted two things that turned out to be defects **in the harness, not in
the package**, so they were re-measured rather than quietly corrected afterwards
(`phaseG-recheck-860b43c15b9e34688e4a4cb02b40b8a60dba434b.txt`, run in a new directory
`stage11/consumer-recheck-860b43c…` against the same tarball digest `3a7870e4…`):

1. it looked for the Windows npm shim at `node_modules\bin\diffbeacon.cmd` instead of
   `node_modules\.bin\diffbeacon.cmd`, and so reported `VERSION_CMD_EXIT=1` with
   `The system cannot find the path specified.` At the correct path the same installed package
   answers `0.1.0`: `SHIM_POSIX_EXIT=0`, `SHIM_CMD_EXIT=0`, `SHIM_PS1_EXIT=0` and
   `DIRECT=0.1.0`, each printing exactly `0.1.0`.
2. it grepped the report for the needle `Secret`. DiffBeacon has no secret detector by design —
   `packages/core/src/detectors/registry.ts` documents that the registry "deliberately avoids
   generic 'security' labels", and the eleven surfaces in `SURFACE_IDS` contain no such id. The
   sample diff it used (`const secret = process.env.API_KEY`) is the safe pattern, so reporting no
   such finding is correct behaviour. The recheck instead asserts surfaces the product does claim,
   and the installed package produces them: a `.github/workflows/ci.yml` hunk yields
   `CI / Build` (`REVIEW_WF_EXIT=0`), and a two-file diff over `src/auth/session.ts` and
   `db/schema.sql` yields `REVIEW_SF_SURFACES=["auth-access","database-schema","runtime"]` with
   `reviewOrder` in the documented FOCUS-before-CHECK order, `schemaVersion "1"` and
   `summary={"changedFiles":2,"additions":2,"deletions":0,…}`.

Input that is not a diff at all produces a zero-file report and exit 0 (`HOSTILE_EXIT=0`, no stderr),
which is the Stage 5 stdin contract rather than a silent failure.

### 7.3 The earlier clean clone of `889f52b`

Before the record commit existed, the same procedure ran its audits in a separate clean clone of
`889f52b6e53095fea978fafbe50017ff71e543db` (`stage11/gq-889f52b`): `added 214 packages in 31s`,
`NPM_CI_EXIT=0`, and at 2026-10-04T09:35:04Z on Node `v24.21.0` / npm `11.19.0` both
`npm audit --omit=dev --audit-level=high` and `npm audit --audit-level=high` printed
`found 0 vulnerabilities` and exited 0 (`phaseG2-cleanclone-npm-ci-889f52b.txt`,
`phaseG2-audits-889f52b.txt`, raw JSON preserved). npm printed its `install-scripts` notice for
`esbuild@0.28.2` postinstall in both clones; that is npm's default policy message, not an error, and
the exit code is 0.

### Mapping to `docs/releasing.md` section 1

| Runbook step                          | Where it was executed                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 clean clone, `npm ci`               | executed: `stage11/gq-final-860b43c…`, detached at the pushed candidate, `git status` clean before and after (§7.1)                                                                                           |
| 2 `npm run verify`                    | executed: the same clean clone, `VERIFY_EXIT=0` (§7.1); also the local tree (§5) and `npm run check` on the finished documentation tree (§9)                                                                  |
| 3 bundle equals a rebuild             | executed: `git diff --exit-code -- packages/action/dist/index.js` exit 0 in the clean clone, and in the local tree (§5)                                                                                       |
| 4 `SOURCE_MANIFEST.txt` current       | executed: `npm run manifest` left the digest `06915c81…` unchanged, 158 files, in the clean clone (§7.1)                                                                                                      |
| 5 both audits, dated and committed    | executed: `found 0 vulnerabilities` and exit 0 on both, in the clean clone of the pushed candidate at 2026-10-04T11:05:57Z (§7.1), and previously at `889f52b` (§7.3)                                         |
| 6 matrix, both OSes at Node 22/24     | **GitHub-hosted runners**, not this host: the four source cells plus the real-Chromium `ubuntu-latest` cell of runs `37191968216` and `37196432560` (§6). Skips carry their printed reason on both platforms. |
| 7 `npm pack --dry-run`, file list     | executed: §7.1 — the dry-run inventory, the `tar -tzf` contents, and the installed-tarball consumer smoke in `stage11/consumer-860b43c…`, outside the repository                                              |
| 8 release commit reviewed as artifact | **not done** — an operator action; the bundle and the workflow pins are part of the diff a reviewer would read                                                                                                |

Steps 1 through 5 and 7 ran on the exact bytes of the pushed candidate, and step 6 ran on them on
GitHub-hosted runners (§6, run `37196432560`). This section is the follow-up record §7 promised: it
changes no gate input. `docs/audits/**` is excluded from `SOURCE_MANIFEST.txt` by prefix, is outside
the current-document scan set of `tests/stage10.docs-contract.test.ts`
(`HISTORICAL_DIRECTORIES`), and appears in no shipped artifact — the packed manifest in §7.1 lists
`files` as `dist`, `README.md` and `LICENSE` only.

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

Everything above §9's last line describes commit `860b43c`. The follow-up commit that writes §6's
`37196432560` rows, §7 and the `860b43c` row of §10 changes **only** this file, and that neutrality was
measured rather than asserted. The gates that could notice such an edit ran as one driver on the
finished tree (`phaseH4-final-gates.txt`, 2026-10-04T11:38:22Z to 11:44:57Z; the same set on the
in-progress tree is `phaseH2-affected-gates.txt`, `phaseH2-docs-tests.txt` and
`phaseH2-docs-neighbours.txt` at 11:12:47Z and `phaseH3-final-gates.txt` at 11:17:59Z):
`npm run format` and `npm run format:check` exit 0 with `All matched files use Prettier code style!`;
`npm run secret-scan` at `12 finding(s), 12 classified, 0 unclassified, 0 stale` exit 0;
`npm run manifest` regenerating `SOURCE_MANIFEST.txt` over 158 files to a byte-identical result
(`EXIT=0`, `MANIFEST_DIFF_EXIT=0`, digest
`06915c81408e2c484b5ed57b588bad60d220271bffae1ab46530fc5ea5351489` unchanged) —
`scripts/source-manifest.mjs` excludes `docs/audits/` by prefix, which is the mechanism that makes the
neutrality measurable instead of assumed. The four files that bind document prose ran together:
`stage10.docs-contract.test.ts` (68 tests), `stage6.source-manifest.test.ts` (4),
`stage4.order-language.test.ts` (28) and `stage6.action-workflow-docs.test.ts` (16) —
`Test Files 4 passed (4)`, `Tests 116 passed (116)`, exit 0.

The full gate was then run on this tree instead of inherited from §5. Its first attempt failed within
four seconds, for a real reason rather than a flake: `assertNoObsoleteSurface` (`scripts/verify.mjs:45`)
found the recurring untracked `pnpm-workspace.yaml` in the working tree and threw `Obsolete template
surface remains: pnpm-workspace.yaml` (`phaseH3-verify-check.txt`: `VERIFY_EXIT=1`, `CHECK_EXIT=1`).
That is the pnpm debris pair §1 records; it is in no commit of this stage, so the repair was to move
both files to a quarantine directory outside the repository, `stage11/quarantine/` — nothing deleted, no
check weakened, no assertion removed — and re-run. Cleared, the gate is green end to end:
`npm run verify` and, because package.json defines `check` as `verify`, `npm run check`
(`phaseH3-verify-check2.txt`: `VERIFY_EXIT=0` from 11:20:27Z to 11:26:49Z, `CHECK_EXIT=0` to 11:35:36Z),
then `npm run verify` again on the finished prose (`phaseH4-final-gates.txt`: `VERIFY_EXIT=0` from
11:38:57Z to 11:44:57Z). Each reached `Test Files 65 passed (65)` and
`Tests 1130 passed | 2 skipped (1132)` — the totals §5 recorded, which is what a change that moves no
gate input should produce — then build, artifact freshness, the secret scan, manifest drift, CLI
startup, package smoke and Action smoke, ending `DiffBeacon source-first verification passed.`

One limit is stated rather than hidden. A commit cannot contain proof of its own hash, and the logs
named above are written before this commit exists. What the final run does establish is that afterwards
`git status --short` lists exactly one path, `docs/audits/stage11-release-qualification.md` — this file —
so every byte added after it is prose inside the one directory that both the source manifest and the
documentation contract exclude. That affected set was re-run once more after those last edits
(`phaseH5-commit-bytes.txt`, 2026-10-04T11:46:28Z to 11:47:25Z): format and `format:check` exit 0,
secret scan at the same 12 classified findings, `SOURCE_MANIFEST.txt` unchanged at 158 files with
`MANIFEST_DIFF_EXIT=0` and the same digest, the four document-binding files at
`Test Files 4 passed (4)` / `Tests 116 passed (116)`, and `git status --short` still this single path.
The hosted run of this commit, whose verification §10 describes, executes
the same ordered gate on the pushed tree from a clean checkout.

## 10. Push verification

| After                   | `git rev-parse HEAD` | `git ls-remote origin refs/heads/release/v0.1.0` | Match |
| ----------------------- | -------------------- | ------------------------------------------------ | ----- |
| PHASE B branch creation | `1bd99c1…`           | `1bd99c12a9d7d75183be0ba442fc2d7023ef1c69`       | yes   |
| `chore(deps)` commit    | `9c38ed0…`           | `9c38ed0e52255e9eee52186cfb3451f60e289e5d`       | yes   |
| `fix(browser)` commit   | `889f52b…`           | `889f52b6e53095fea978fafbe50017ff71e543db`       | yes   |
| `860b43c` (report A)    | `860b43c…`           | `860b43c15b9e34688e4a4cb02b40b8a60dba434b`       | yes   |

The `860b43c` push printed `889f52b..860b43c  release/v0.1.0 -> release/v0.1.0` with exit 0
(`phaseH-push-A.txt`), and the same value came back from `git ls-remote origin
refs/heads/release/v0.1.0`.

The row this report cannot write is its own. A commit's hash is produced by the commit, so the
follow-up documentation commit that adds §6's `37196432560` rows and §7 cannot contain its own
`rev-parse`/`ls-remote` pair; that pair is measured after the push, in `git rev-parse HEAD` and
`git ls-remote origin refs/heads/release/v0.1.0`, and reported to the release operator as the
branch tip together with the hosted run it triggers. Every push in this stage has followed the same
check, which is why the four rows above are all the pairs the file is able to hold.

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
- The per-lane counts quoted in `docs/limitations.md`, `docs/architecture/security.md`, `README.md`,
  `CONTRIBUTING.md`, `CHANGELOG.md` and `packages/action/README.md` are run `37191968216`'s at
  `889f52b`, which is what each of those sentences names. §6 records the candidate's own hosted run
  `37196432560` and its 13-tests-higher totals; refreshing the six current documents with those
  numbers would change gate inputs and would then need a qualification of its own, so the newest
  measurement lives here instead.
- The installed package produces the eleven documented surfaces and nothing else. It is not a secret
  scanner: no surface id in `SURFACE_IDS` claims one, and `packages/core/src/detectors/registry.ts`
  states the omission as design (§7.2).
- DiffBeacon does not decide whether a pull request is safe to merge.
