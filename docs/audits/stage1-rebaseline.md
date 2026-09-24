# DIFFBEACON STAGE 1 — RECOVERED SOURCE RE-BASELINE

STATUS: BLOCKED

STARTING SHA: `2543f93153b956f0b00744202e27e271708761aa`
ENDING SHA: the Phase-15 commit that contains this file (a Stage-1 report commit on top of
`2543f93…`; a file cannot record its own SHA, so it is stated in the stage response)
BRANCH: `rescue/stage0-source`
ORIGIN MAIN SHA: `e0ff98143bfe39c80c338518d006525a846a8739`

Phase 0 reconfirmation: branch `rescue/stage0-source`, `HEAD = 2543f93…`, `origin/main = e0ff981…`,
`git rev-list --left-right --count origin/main...HEAD = 0 2` (exactly two commits ahead), no tags,
clean working tree, no `pnpm-lock.yaml` / `pnpm-workspace.yaml` tracked or on disk, no pnpm
introduced. `.github/workflows/` contains only `ci.yml` and `pages.yml`.

## SOURCE TREE

- Total tracked files at HEAD: 100.
- Workspace layout: npm workspaces (`root: "packages/*"`), `lockfileVersion: 3`, `"type": "module"`.
- Packages:
  - `diffbeacon-workspace@0.1.0` — root, `private: true`, MIT, no `engines` beyond
    `engines.node: ">=22"`, no entrypoint (script host only).
  - `diffbeacon-core@0.1.0` (`packages/core`) — `private: true`, exports `.` →
    `./dist/index.js` + `./dist/index.d.ts`, `files: ["dist","README.md"]`, build =
    `tsc -p tsconfig.json` (declaration + declarationMap + sourceMap).
  - `diffbeacon@0.1.0` (`packages/cli`) — the only publishable package (no `private`),
    `bin.diffbeacon = dist/index.js`, `files: ["dist","README.md"]`, `engines.node: ">=22"`,
    repository/homepage/bugs point at `Pavithran-R-A/diffbeacon`.
  - `diffbeacon-action@0.1.0` (`packages/action`) — `private: true`, no `main`/`exports`; it is a
    bundle producer only.
- Non-package source: `client/` (6 tracked files: `index.html`, `public/.gitkeep`, `src/App.tsx`,
  `src/index.css`, `src/main.tsx`, `src/pages/Home.tsx`), `tests/` (10 Vitest specs),
  `scripts/` (11 files), `docs/` (11 files), `.github/` (7 files), `.bootstrap/` (3) and
  `.bootstrap2/` (4) retained forensic material, `RECOVERY_STAGE0.md`, `SOURCE_MANIFEST.txt`.
- Browser/demo build: Vite with `root: client`, `build.outDir: <repo>/dist`, `base` from
  `BASE_PATH` (default `/`), sourcemaps on.
- Action runtime: `action.yml` → `using: node24`, `main: packages/action/dist/index.js`
  (a committed bundle, 31,941 bytes, git blob `cb009f8b4c803ed89853605982e2344aeffbb94f`).
- CI matrix (`.github/workflows/ci.yml`): `push` + `pull_request` + `workflow_dispatch`,
  `permissions: contents: read`, `fail-fast: false`, 25-minute timeout,
  matrix `[ubuntu-latest, windows-latest] × [node 22, 24]`, steps `npm ci` then `npm run check`,
  pinned `actions/checkout@3d3c42e…` and `actions/setup-node@8207627…`. `pages.yml` is
  `workflow_dispatch`, builds with `BASE_PATH="/<repo>/"` and only _uploads_ a Pages artifact
  (`actions/upload-pages-artifact@fc324d3…`); it never deploys.
- Verification contract: `check → npm run verify → node scripts/verify.mjs`, which asserts source
  completeness + "no obsolete surface" (rejects `server/`, `shared/`, `template.json`,
  `components.json`, `pnpm-workspace.yaml`, `patches/`, `client/src/components/…`), then runs
  `format:check → lint → typecheck → test → build`, asserts fresh artifacts, then
  `package-smoke → action-smoke`. `npm run check` is therefore an aggregate/repeated verification
  path, not an independent test suite.
- Node/npm assumptions: `engines.node ">=22"` + `.npmrc engine-strict=true`; `.nvmrc = 22`;
  no `packageManager` pin; `.npmrc` also sets `fund=false` and `audit=false` (installs do not
  audit by default).
- Manifest policy (`scripts/generate-source-manifest.mjs`): walks the filesystem, excludes
  `.git`, `node_modules`, `dist`, `coverage`, `.manus`, `.manus-logs`, `SOURCE_MANIFEST.txt` and
  the five historical `diffbeacon-*.zip` names; header line is hardcoded
  `# DiffBeacon Stage 5 source manifest`.

## ENVIRONMENTS

Environment A — Windows native (primary cell, executed):

- Windows 10.0.26200, `MINGW64_NT-10.0-26200` (Git Bash 3.6.10-710e5275), `x86_64` /
  `PROCESSOR_ARCHITECTURE=AMD64`.
- `node v24.21.0`, `npm 11.19.0`, `git version 2.55.0.windows.5`.
- Source: `git clone --no-hardlinks` of the local repo at exactly `2543f93…` → 100 tracked files,
  no `node_modules`, clean status. Host default `core.autocrlf=true` applies (CRLF worktree).
- Windows/Node 22 cell: **NOT EXECUTED**. The host has only Node 24 and no version manager;
  installing a second global Node would modify global system configuration, which Stage 1
  forbids. No Node 22 Windows result is claimed.
- Second Windows worktree (`win-lf2`) created with `-c core.autocrlf=false` at the same SHA, used
  only to separate line-ending effects from real formatting problems, and to run `npm run verify`
  against an LF tree.

Environment B — Linux (executed):

- Native WSL distro probe: `Ubuntu 26.04 LTS`, kernel `6.18.33.2-microsoft-standard-WSL2`,
  `x86_64`, `git 2.53.0`, but **no native `node`/`npm`** — the only `npm` on PATH was
  `/mnt/c/Program Files/nodejs/npm` (Windows interop), which would have produced a fake Linux
  cell. Nothing was qualified there.
- Approved substitute: Docker Engine `29.7.2` (Linux containers in the same WSL2 VM),
  three cells executed as container-native `/root/...` paths on overlayfs — **not** under
  `/mnt/c/...`:
  - `node:24` → Debian 12.15 bookworm, `node v24.21.0`, `npm 11.19.0`, `git 2.39.5`.
  - `node:22` → Debian 12 bookworm, `node v22.23.3`, `npm 10.9.9`, `git 2.39.5`.
  - `node:24-trixie` → Debian 13.7 trixie, `node v24.21.0`, `npm 11.19.0`, `git 2.47.3`.
- Linux source provenance: `git bundle create … rescue/stage0-source` (bundle sha256
  `9c40358119d232597940be2bf4ca08eafa552e103e10e686cf9fb569877bb4bd`, verified as complete
  history, contains exactly `2543f93153b956f0b00744202e27e271708761aa`), then `git clone` from
  that bundle inside each container and `git checkout 2543f93…`. No ZIP, no `/mnt/c` copy.
- Qualification clones used a `core.hooksPath` override to an empty directory so that a
  host-level global Git hook (see DEFECTS → D9) could not inject itself into the measurement.
- Matrix cells actually executed: Windows/24, Linux-Debian12/24, Linux-Debian12/22,
  Linux-Debian13/24. Not executed: Windows/22, and the real GitHub-hosted 4-cell matrix (D under
  GITHUB ACTIONS).

## INSTALL

`npm ci` in every environment started from no `node_modules`:

- Windows / node 24 / npm 11.19.0: exit 0, `added 213 packages in 12s`, wall 13.8s. One warning:
  `install-scripts … esbuild@0.27.7 (postinstall: node install.js)` is "not yet covered by
  allowScripts" (npm 11 install-script gating); esbuild still functioned because
  `@esbuild/win32-x64` was present and all build gates passed. No deprecations, no
  vulnerability line (`.npmrc audit=false`), no install-script failure.
  Post-install `git status --short` → empty; `package-lock.json` unchanged
  (worktree sha256 `9b8dbb35c43e10b535556e9543ae0844b4d062ab319c0739b484dab04dca9d3b`, i.e. the
  CRLF form of the committed blob).
- Windows LF worktree / node 24: `npm ci` exit 0, `git status --short` → empty.
- Linux bookworm / node 24 / npm 11.19.0: exit 0, `added 215 packages in 2m` (elapsed 95s cold),
  `git status --porcelain` after ci → empty, lockfile sha256
  `e5f5b61297e4385b96806eb6bab15240f6ff2675f2d6df2c6044a9cb143030b5` = committed blob hash.
- Linux bookworm / node 22 / npm 10.9.9: exit 0, `added 216 packages` (68s), lockfile sha256
  identical to the committed blob, status empty. (The package count differs by one between npm
  10 and npm 11 reporting, not between resolutions.)
- Linux trixie / node 24 / npm 11.19.0: exit 0, `added 215 packages in 59s`, status empty.

Conclusion: reproducible install is confirmed on all four executed cells; `npm ci` never mutated
tracked source or the lockfile.

## FORMAT

- `npm run format:check` on the Windows CRLF worktree (host `core.autocrlf=true`, repository
  ships no `.gitattributes`): **FAIL**, exit 1, "Code style issues found in 82 files"
  (every `.ts`/`.tsx`/`.mjs`/`.json`/`.md`/`.yml`/`.css`/`.html` source file, 2.9s).
- `npm run format:check` on the Windows **LF** worktree at the same SHA: **PASS** — "All matched
  files use Prettier code style!"
- Linux (all three cells): **PASS**, 2–3s.
- Root cause isolated by A/B on the same commit: the failure is purely checkout line endings
  (`prettier` `endOfLine` default `lf` vs a CRLF worktree), not real formatting debt in the
  recovered source. Not repaired in Stage 1 (D1).

## LINT

`npm run lint` = `eslint . --max-warnings=0`: **PASS** everywhere — Windows/24 (5.7s),
Windows LF, Linux/24, Linux/22, Linux-trixie (3–4s). Zero errors, zero warnings.

## TYPECHECK

`npm run typecheck` = `tsc --noEmit -p tsconfig.json` (strict, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `moduleResolution: Bundler`): **PASS**
everywhere — Windows/24 (3.5s) and all three Linux cells (3s).

## TESTS

Inventory from source and runtime: 10 test files (all `tests/**/*.test.ts`, `environment: node`),
50 Vitest tests discovered, 0 skipped, 0 todo. Per-file counts:
`core.test.ts` 11, `stage4.release.test.ts` 6, `stage5.git-determinism.test.ts` 6,
`stage3b.real-git.test.ts` 8, `stage3c.release.test.ts` 6, `stage3b.static.test.ts` 3,
`npm-helper.test.ts` 3, `cli.integration.test.ts` 3, `action.test.ts` 2, `cli.test.ts` 2.

Results per cell (Windows host hooks active = the unmodified default state of this machine):

- Linux trixie / node 24 / git 2.47.3: **10 files passed, 50 passed, 0 failed, 0 skipped**
  (duration 2.86s; tests 6.88s aggregate).
- Linux bookworm / node 24 and / node 22 / git 2.39.5: **2 files failed, 8 passed;
  7 failed, 43 passed** — identical on both Node versions. Failing:
  `cli.integration.test.ts` (3: "reviews a temporary repository located in a path with spaces",
  "keeps real binary paths containing spaces and Unicode intact", "rejects a real Git range above
  the bounded analysis limit without ENOBUFS") and `stage5.git-determinism.test.ts` (4:
  "normalizes hostile repository diff configuration to the same report", "keeps binary
  path/status fields exact without --binary for all required states", "keeps a large
  incompressible binary change structural and bounded", "keeps local submodule pointer changes
  visible and short under hostile config"). Every one of the 7 has the identical root cause:
  `git diff … --default-prefix` is rejected by git 2.39.5, which prints its usage text and
  exits non-zero (D2). No assertion about DiffBeacon's output failed.
- Windows / node 24, host git hooks active (CRLF worktree): **3 files failed, 7 passed;
  14 failed, 36 passed** (96.7s). Two independent runs produced byte-identical failure _sets_
  (`run1` and `run2` diffed clean): `cli.integration.test.ts` 2, `stage3b.real-git.test.ts` 8,
  `stage5.git-determinism.test.ts` 4. Error classes: 26 `Error: Test timed out in 5000ms`
  occurrences, 3 `EPERM` occurrences on `rmSync` of `diffbeacon-stage5-git-*`.
- Windows / node 24, host git hooks neutralized via env-scoped `GIT_CONFIG_*`: **1 file failed,
  9 passed; 2 failed, 48 passed** (19.6s) — only the two heaviest `stage5` tests.
- Windows / node 24, LF worktree, host hooks neutralized, nothing else running: **3 files failed,
  7 passed; 13 failed, 37 passed** (87.2s), with the same 14-name family and per-test durations
  of 8.0s–23.3s for tests that took 1.2s–4.7s in the other Windows run.

Platform/version attribution:

- Windows-only (not seen on any Linux cell): the 8 `stage3b.real-git.test.ts` failures, and all
  `EPERM` cleanup errors.
- Linux-only (not seen on Windows): `cli.integration.test.ts > rejects a real Git range above the
bounded analysis limit without ENOBUFS` — it fails there only because git 2.39.5 rejects
  `--default-prefix`; it passes on Windows and on trixie.
- Node-version-specific: none. node 22 and node 24 produced identical results inside the same
  Linux image; the differences tracked OS image/Git version and Windows host state instead.
- Reproduced the previously reported Windows issues from the clean Stage-1 tree: the 5-second
  timeouts are real and the `EPERM` cleanup failures are real; they are **not** the same as a
  product fault — see the harness-vs-product determination below.
- `EPERM` leak measured directly: 24 leftover `diffbeacon-stage5-git-*` directories remained in
  `%TEMP%` after the Windows runs, confirming the cleanup path does not survive a Windows
  file-lock race.
- Harness-vs-product determination (Stage 1 does not fix either): the 5000 ms figure is Vitest's
  default `testTimeout`, not a product boundary; no test asserted a wrong analysis result on
  Windows, and the `EPERM` originates in `tests/stage5.git-determinism.test.ts:37` `afterEach`
  `rmSync` (harness cleanup), not in `packages/**`. So both Windows fault classes sit in the test
  harness and the host, though the timing budget is genuinely tight even in the best Windows run
  (4.66s observed for one test against a 5s ceiling), which is a real harness robustness defect
  (D5).
- Determinism caveat for the auditor: the Windows _failure count_ is not stable across repeated
  clean runs (2, 3, 13 and 14 all observed at the same commit); only the hooks-active failure
  _set_ was reproducible run-to-run.

## BUILD

`npm run build` = `node scripts/build.mjs` → `build:core` (tsc) → `build:cli` → `build:action` →
`build:web` (Vite): **exit 0 in every executed cell** (Windows 6.3s; Linux 3–4s).

- Core: `packages/core/dist` = 7 `.js` + 7 `.d.ts` (+ `.d.ts.map`/`.js.map` each). Public contract
  `exports["."] = { types: ./dist/index.d.ts, import: ./dist/index.js }`. Runtime import of the
  built `dist/index.js` in Node 24 yielded
  `ATTENTION_LEVELS, EVIDENCE_KINDS, FILE_STATUSES, MAX_DIFF_BYTES, SCHEMA_VERSION, SURFACE_IDS,
analyzeDiff, classifyFile, compareCanonicalText, decodeGitPath, detectorById, detectors,
escapeMarkdown, isDependencyManifest, isDocumentationPath, isGeneratedPath, isLockfile,
isTestPath, parseUnifiedDiff, renderJson, renderMarkdown, renderPretty`;
  `analyzeDiff()` + all three renderers returned correct output. Note there is no `renderText`;
  the text renderer is `renderPretty`.
- CLI: `packages/cli/dist/index.js`, 37,387 bytes, mode `0755`, `#!/usr/bin/env node` banner,
  `format esm`, `platform node`, `target node22`.
- Action: `packages/action/dist/index.js`, freshly built 31,941 bytes, `target node24`.
- Browser: `dist/index.html` (0.75 kB), `dist/assets/index-BAIxMOuS.js` (226,037 B),
  `dist/assets/index-BAIxMOuS.js.map` (952,858 B), `dist/assets/index-BOcz5Fr9.css` (18,709 B),
  `dist/.gitkeep`.

## CLI

Executed against the built bundle (`node packages/cli/dist/index.js …`) and against the installed
tarball:

- `--version` → `0.1.0`, exit 0 (Windows and Linux).
- `--help` → `DiffBeacon 0.1.0` + usage block containing `Usage:`, exit 0.
- stdin sample: `… | diffbeacon review --stdin --format json` → valid JSON,
  `schemaVersion "1"`, `summary.changedFiles 1`, `additions 1`, `deletions 1`.
- Real Git range: `review HEAD~1...HEAD --format json` in a temporary repository returned
  `summary.changedFiles 1` — verified inside `package-smoke` on Linux
  (`rangeFiles=1`) and by `tests/cli.integration.test.ts` on Windows (those two tests pass once
  the timeout budget is met) and on Linux/trixie.
- `bin.diffbeacon = dist/index.js` present in the packed manifest and wired by npm into the
  consumer's `node_modules/.bin/diffbeacon{,.cmd,.ps1}`.

## PACKAGE

- `npm pack ./packages/cli --dry-run --json` (Windows): `name diffbeacon`, `version 0.1.0`,
  `filename diffbeacon-0.1.0.tgz`, `size 10221`, `unpackedSize 38570`, `entryCount 3`,
  included paths exactly `README.md`, `dist/index.js`, `package.json`; nothing under
  `test`/`tests`/`node_modules`/`.env`; no source, no maps, no junk. (`--dry-run --json` does not
  surface `bin`/`engines`/`dependencies`; those were verified post-install instead.)
- `npm run package-smoke` **PASS on Linux**:
  `package-smoke: 0.1.0; bin=true; engines=>=22; stdinFiles=1; rangeFiles=1; tarballFiles=3`,
  which also proves: clean consumer `npm init --yes` + `npm install --ignore-scripts` of the real
  tarball, installed-shim `--version` matching the installed manifest version, `--help` via the
  shim, stdin review through `node_modules/diffbeacon/dist/index.js`, and a real Git-range review
  in a consumer repository whose path contains a space (`range repository`).
- `npm run package-smoke` **FAIL on Windows**, exit 1, aborting at the first installed-shim call.
  Root cause localized (D4) with a standalone probe; the packaged CLI itself is healthy on
  Windows: `npm install ../../packages/cli` into a clean consumer plus
  `cmd /d /c node_modules\.bin\diffbeacon.cmd --version` prints `0.1.0`.
- Nothing was published; no public npm availability is claimed (`diffbeacon` is not on the
  registry).

## ACTION

- `action.yml`: `runs.using: node24`, `runs.main: packages/action/dist/index.js`, branding only,
  no `permissions:` key (Action-level permissions are declared by the caller's workflow, so
  `contents: read` in `ci.yml`/`pages.yml` does not constrain a consuming workflow).
- Fresh bundle vs committed bundle: **byte-identical**.
  Fresh `packages/action/dist/index.js` sha256 `c92431c90208cee075ccaf79dab5bd6b2619a776cb8b4a240d310c8f711e23af`
  = `git cat-file blob HEAD:packages/action/dist/index.js | sha256sum` (git blob
  `cb009f8b4c803ed89853605982e2344aeffbb94f`, 31,941 bytes). Reproduced on Linux/trixie and on
  Windows. No rebuild was committed.
  Windows-only side effect recorded: after `npm run build`, `git status` marks the bundle `M` and
  `git diff` warns "LF will be replaced by CRLF the next time Git touches it", because
  `core.autocrlf=true` made the _checked-out_ copy CRLF (sha256 `bc80e9b9…`) while the build
  rewrote it as LF. Content equality with the committed blob is what matters, and it holds; the
  canonical repository was never touched by a build.
- `npm run action-smoke` **PASS on Linux**; the one-line report was:

  ```text
  action-smoke: bundled action wrote 1183 bytes; stdout=""; stderr=""; cliLeak=false; hostilePaths=true; oversizeRejected=true; range=97c0d90...b32d23e
  ```

  It really executes the bundle (`node packages/action/dist/index.js`) with `GITHUB_EVENT_PATH` /
  `GITHUB_STEP_SUMMARY` in a throwaway `git init` repository, and asserts: adversarial literal
  `$(touch PWNED).ts` and `unicodé-文件.ts` present in the summary, `dir b/image.bin` binary
  change, a Job Summary containing `# DiffBeacon review` and `Changed files`, **no `PWNED` file
  created** (no shell side effect), empty stdout/stderr, no CLI startup text in the summary or in
  the bundle, and an oversize range rejected with `larger than`.

- `npm run action-smoke` **FAIL on Windows**, exit 1: the summary file is never created and the
  script dies at `readFileSync(summaryPath)`. Root cause (D3): the Action bundle's ESM
  self-execution guard cannot match on Windows:

  ```ts
  if (import.meta.url === `file://${process.argv[1]}`) {
  ```

  `process.argv[1]` is `C:\Users\…\index.js` while `import.meta.url` is
  `file:///C:/Users/…/index.js` (extra host slash, forward slashes, percent-encoded spaces).
  Measured: guard equality is `false`. So `node packages/action/dist/index.js` on Windows exits 0
  having done nothing. The CLI avoids this by using `launchedAsCli`, which tests the `argv[1]`
  shape instead — that asymmetry is the actual defect.

- **LOCAL ACTION SMOKE ≠ REAL GITHUB-HOSTED ACTION EXECUTION.** Only the local smoke was
  executed. The Action has never run on a GitHub-hosted runner (see GITHUB ACTIONS), and on
  Windows the guard defect means a hosted Windows runner would very likely produce a silent
  no-op; that consequence is inferred from the local reproduction and is **not** verified
  remotely.

## BROWSER

- `npm run build:web` succeeds both alone and inside `npm run build` in every cell.
- Output: `dist/index.html` plus one hashed JS chunk, one `.js.map`, one CSS chunk.
- Asset references in `dist/index.html` are root-absolute by default:
  `src="/assets/index-BAIxMOuS.js"`, `href="/assets/index-BOcz5Fr9.css"`, so the artifact needs a
  static host (or the `BASE_PATH="/<repo>/"` build that `pages.yml` performs); opening
  `dist/index.html` directly from the filesystem will not resolve assets. This is a delivery
  observation, not a runtime server dependency.
- No backend/server API, upload endpoint or diff-exfiltration path appears in the app source or in
  the built bundle. Built-bundle token scan: `XMLHttpRequest` 0, `WebSocket` 0, `sendBeacon` 0,
  `axios` 0, `fetch(` **1** — and that single hit is Vite's module-preload helper
  (`…e.ep=!0;let n=t(e);fetch(e.href,n)…`), which only requests the build's own same-origin asset
  links. The only URL-looking strings in the bundle are XML namespace identifiers
  (`http://www.w3.org/1998/Math/MathML`, `/1999/xlink`, `/2000/svg`, `/XML/1998/namespace`) and
  React's `https://react.dev/errors/` message text; neither issues a request.
- `scripts/verify.mjs` asserts production web output and forbids network analysis APIs, and
  `tests/stage3b.static.test.ts` enforces the same on `client/` source. No deployment was
  performed and none is claimed.
- Live in-browser interaction with the demo was **not** executed in Stage 1; the no-upload/no-network
  conclusion here rests on source + built-bundle inspection and the existing tests, not on a
  sandboxed runtime observation.
- Recorded side effect of the build: source maps ship inside the Pages artifact and are ~4.2×
  the size of the app chunk (952,858 B vs 226,037 B), which rebuilds the entire TypeScript source
  in the published artifact. Observation only.

## MANIFEST

Independent re-derivation at Stage-1 HEAD in a pristine Linux clone (`/root/stage1-artifacts`,
100 tracked files, clean before):

- Committed `SOURCE_MANIFEST.txt` (blob sha256
  `4691d44baa17f49330a8cfd5eead0c08fb91aa80b76b80d8bf5b694099edcc16`): **87 entries**.
- After `npm run manifest` (exit 0): sha256
  `8a2e85ec53ff486312000195c18fc66af9ac570c2cc3d9058ad1e757fc3a167e`, **98 entries**.
- Byte-identical: **NO**.
- Delta: 11 paths **added**, 0 removed, and the added set is exactly Stage 0's own material —
  `.bootstrap/chunk00`, `chunk01`, `chunk02`; `.bootstrap2/chunk00`, `chunk01`, `chunk02`,
  `payload.tar.xz`; `RECOVERY_STAGE0.md`; `docs/recovery/README.md`,
  `docs/recovery/bootstrap.failed.yml.txt`, `docs/recovery/bootstrap2.failed.yml.txt`.
- The generator is therefore **not** idempotent against HEAD, and the committed manifest
  describes the pre-recovery snapshot, not the current tree. The header also still reads
  `# DiffBeacon Stage 5 source manifest`.
- A second regeneration on the Windows worktree produced **101 entries**, because the generator
  walks the filesystem rather than the Git index; the extra 3 entries were my own scratch files
  (`guard-check.mjs`, `packprobe/…`). So `npm run manifest` is currently a function of whatever
  happens to be on disk, including untracked files.
- `packages/action/dist/index.js` is tracked but is _absent_ from the manifest (`dist` is an
  excluded directory), so the manifest vouches for nothing about the one committed build
  artifact — verified: `grep -c 'packages/action/dist' SOURCE_MANIFEST.txt` → 0.
- Nothing regenerates or compares it: `grep -rn SOURCE_MANIFEST scripts/ tests/ .github package.json`
  yields only `scripts/generate-source-manifest.mjs` (the writer), and `scripts/verify.mjs:58`
  which merely asserts the file exists. `npm run check` therefore cannot detect manifest drift.
- Consequence for the Stage-0 record: the earlier "byte-identical regeneration" observation is
  not reproducible at Stage-1 HEAD; the whole difference is explained by Stage 0's own additions,
  so that measurement was necessarily taken against a tree without them. `SOURCE_MANIFEST.txt`
  was **not** edited in Stage 1 (restored with `git checkout --` after the probe; final
  `git status --porcelain | wc -l` = 0 in that copy).

## DEPENDENCY AUDIT

Explicit audits run; `npm audit fix` and `npm audit fix --force` were **not** run, and nothing was
upgraded.

- `npm audit` → exit 1, **4 vulnerabilities (1 low, 2 moderate, 1 high)**, identical counts on
  Windows/24, Linux bookworm/24, Linux bookworm/22 and Linux trixie/24 (so not environment- or
  Node-specific):
  - `js-yaml 4.0.0 - 4.3.1`, **high**, `GHSA-2883-xcg3-v3hh` ("maxTotalMergeKeys does not limit
    CPU use for empty merge sources"); installed 4.3.1, `dev: true` (reached through the ESLint
    YAML parser).
  - `@vitest/mocker 2.1.0 - 4.1.10`, **moderate**, `GHSA-82fw-gwwq-j7x9` (path traversal /
    arbitrary file read via a redirect mock); dev-only.
  - `vitest 2.1.0-beta.1 - 4.1.10`, **moderate** only as a transitive consequence of
    `@vitest/mocker`; dev-only.
  - `esbuild 0.27.3 - 0.28.0`, **low**, `GHSA-g7r4-m6w7-qqqr` ("arbitrary file read when running
    the development server on Windows"); installed 0.27.7.
  - npm reports "fix available via `npm audit fix`" for all four; none of the suggested fixes is
    a major/breaking jump (all are patch/minor ranges within the declared semver), but this stage
    did not attempt them.
- `npm audit --omit=dev` → exit 1, **1 low severity vulnerability**: `esbuild`.
- Structural cause worth flagging for the repair decision: the root manifest declares build
  tooling (`esbuild`, `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `lucide-react`) under
  `dependencies`, so a production-only audit is non-zero for a private workspace root. The
  publishable `diffbeacon` CLI package declares **no** runtime dependencies at all, and its
  tarball contains only `README.md`, `dist/index.js`, `package.json`.
- `.npmrc audit=false` means plain `npm ci`/`npm install` never reports these; only the explicit
  commands above do.
- Dependency currency inspected read-only via the lockfile and audit output; no `outreach`
  upgrades attempted.

## SECRET REVIEW

Repository-level review of tracked content only, no credential values emitted, no personal
directories scanned:

- Tracked filename classes: `.env*`, `*.pem`, `*.key`, `*.pfx`, `*.p12`, `*.jks`, `*.kdbx`,
  `id_rsa*`, `credentials`, `secret`, `token`, `*.exe`, `*.dll`, `*.zip`, `node_modules` → **0
  matches**.
- Unexpected binaries: byte-NUL scan across all 100 tracked files → **0 binary tracked files**
  (`.bootstrap*/chunk*`, `.bootstrap2/payload.tar.xz` are ASCII Base64 / an archive that Stage 0
  already documented; they are declared forensic material, not credentials).
- Content patterns (`git grep -I`, match counts only): GitHub `ghp_…` → 0; `github_pat_…` → 0;
  npm `npm_…` → 0; AWS `AKIA…` → 0; `-----BEGIN … PRIVATE KEY-----` → 0; generic
  `api_key|secret|password|token = "…"` assignments → 0.
- High-entropy candidates (runs of ≥80 base64 characters) occur only in `package-lock.json`
  (subresource-integrity hashes, expected) and inside the retained `.bootstrap`/`.bootstrap2`
  forensic chunks, whose decoded content was proven in Stage 0 to be the source archive.
- `.gitignore` covers `.env`, `.env.*` (with `!.env.example`), `node_modules/`, `coverage/`,
  `*.tgz`, `.manus-logs/`, editor directories; `.npmrc` contains registry configuration only
  (`engine-strict`, `fund`, `audit`) and no auth token.
- **Result: CLEAN** — no secret-class finding in tracked source at `2543f93…`.

## README CLAIM MATRIX

Read-only cross-check of `README.md` / `SECURITY.md` against source, tests and the executions
above. Rows marked **[executed]** were verified by commands run in this stage; the rest by code +
test reading.

- deterministic analysis — VERIFIED BY CODE + TEST **[executed for reproducibility of artifacts,
  not cross-process byte stability]**: JSON is byte-stable for identical input and locale-stable
  (`tests/core.test.ts`, `tests/stage3c.release.test.ts`); no cross-process byte-identity test
  exists, and `renderPretty` coloring is TTY/`NO_COLOR` dependent.
- Git range mode — VERIFIED BY CODE + TEST **[executed]**: `HEAD~1...HEAD` on temporary real
  repositories passes on Windows (when the timeout budget holds) and on Linux/trixie
  (`package-smoke … rangeFiles=1`); fails on git 2.39.5 (D2).
- stdin mode — VERIFIED BY CODE + TEST **[executed]**: `review --stdin --format json` through the
  installed tarball entrypoint returns `changedFiles: 1`.
- text output — VERIFIED BY CODE + TEST: `renderPretty`, asserted in `tests/core.test.ts` and
  `tests/stage4.release.test.ts`.
- markdown output — VERIFIED BY CODE + TEST: `renderMarkdown`, with hostile-path escaping asserted
  ("renders hostile filenames as inert code and never active Markdown/HTML").
- JSON output — VERIFIED BY CODE + TEST **[executed]**: `schemaVersion "1"` and enums pinned by
  `tests/stage4.release.test.ts`.
- GitHub Action exists — VERIFIED BY CODE + TEST **[executed locally only]**: `action.yml`
  `using: node24`, bundle executes under `GITHUB_STEP_SUMMARY`/`GITHUB_EVENT_PATH`; **never
  executed on a real runner**; and it is a silent no-op on Windows (D3).
- Job Summary written — VERIFIED BY CODE + TEST **[executed]**: `appendFileSync` to
  `GITHUB_STEP_SUMMARY`, content asserted (`# DiffBeacon review`, `Changed files`).
- minimal Action permissions (`contents: read`) — VERIFIED BY CODE ONLY: `ci.yml`/`pages.yml` use
  `contents: read` and the bundle contains no Octokit/`@actions`/token code, but `action.yml`
  declares no `permissions:` key, so a consuming workflow could grant more; unenforceable from
  this repository.
- browser-local analysis — VERIFIED BY CODE + TEST **[executed on the built bundle]**: no
  upload/network API in `client/` or in the shipped chunk (single `fetch(` = Vite modulepreload).
- no runtime LLM — VERIFIED BY CODE + TEST: static absence scan over `packages/core/src` and the
  web bundle; three manifests have zero runtime dependencies. Strength: source scan, not runtime
  enforcement.
- no backend — VERIFIED BY CODE + TEST: `verify.mjs` forbids obsolete `server/`/`shared/` surface;
  `pages.yml` builds a static bundle.
- no source upload — VERIFIED BY CODE + TEST **[executed as bundle token scan]**; not sandboxed at
  runtime.
- bounded input — VERIFIED BY CODE ONLY (partial TEST): `MAX_DIFF_BYTES = 8 MiB`
  (`packages/core/src/model.ts:7`) is enforced on the Git-range path and the Action path, and the
  oversize rejection is asserted by `action-smoke` **[executed]**; the stdin cap and the browser
  cap have **no** test, and `analyzeDiff()` itself enforces nothing.
- shell-safe Git execution — VERIFIED BY CODE + TEST **[executed]**: fixed argv arrays,
  `shell: false`, `--` pathspec, `rev-parse --end-of-options`, metacharacter rejection unit tests,
  and the literal `$(touch PWNED).ts` fixture with a `PWNED`-absence assertion.
- package/install commands — VERIFIED BY CODE ONLY / **partly CONTRADICTED**: every quoted npm
  script exists and `bin` is wired, but `npx diffbeacon …` as printed cannot resolve externally
  (`diffbeacon` is unpublished on the registry), the quick start omits the required
  `npm run build`, and `uses: Pavithran-R-A/diffbeacon@v1` references a tag that does not exist
  (`git tag --list` empty) while `tests/stage5.git-determinism.test.ts:67` asserts that README
  string, which test-locks an unverifiable reference.
- Additional understatement (not a falsehood): README lists 4 forced Git flags; the implementation
  forces 8 (`--no-ext-diff --no-textconv --no-color --default-prefix --ignore-submodules=none
--submodule=short --diff-algorithm=myers --find-renames=50% -l1000 --unified=3`), documented
  correctly in `docs/architecture/security.md`.
- Architectural note: `packages/cli` and `packages/action` import `packages/core` **by relative
  source path**, so `diffbeacon-core`'s built `dist` is never consumed by either shipped artifact;
  the README package table implies runtime separation.

## GITHUB ACTIONS

- Hosted CI is currently **unavailable before runner assignment** for this account. Both CI runs on
  `rescue/stage0-source` remain `completed/failure`: `36025766426` (2026-09-24T16:12:46Z) and
  `36028837289` (2026-09-24T16:39:01Z).
- Re-verified in this stage from the REST API: each run created exactly the four matrix jobs
  (`Node 22/24 × ubuntu/windows-latest`) with `runtime: null`, `steps: 0`, and
  `timing.billable` `UBUNTU.total_ms = 0` and `WINDOWS.total_ms = 0`. Nothing in the workflow
  executed, so **these are not product test results** and are not counted as failures of the
  recovered source.
- A previously obtained Actions annotation attributed the pre-start failure to the account's
  payment/spending-limit state — an external condition. Per instruction, no source or CI YAML was
  changed to make the pre-run failure disappear, and hosted CI was not repeatedly re-run.
- Historical bootstrap runs on `main` (`32859849733`, `31819615124`, `31818807881`) belong to the
  quarantined bootstrap machinery; their definitions are preserved non-executable under
  `docs/recovery/`.
- Consequence: the declared 4-cell CI matrix has **never** executed anywhere. The local
  substitutes in ENVIRONMENTS are the only qualification evidence, and they are labelled as
  local, not remote.

## EXACT COMMANDS RUN

Canonical repository (Phase 0): `git status --short`, `git status`, `git branch --show-current`,
`git rev-parse HEAD`, `git rev-parse origin/main`, `git fetch --all --tags --prune`,
`git branch -a -vv`, `git tag --list`, `git log --oneline --decorate -n 15`,
`git rev-list --left-right --count origin/main...HEAD`, `git ls-files | grep -i pnpm`.

Inventory / forensics: `git ls-files | wc -l`, `git ls-tree -r --name-only HEAD`, `cat` over every
manifest, config, script and doc listed in PHASE 1 of the brief,
`git cat-file blob HEAD:<path> | sha256sum` for `package-lock.json`, `SOURCE_MANIFEST.txt`,
`packages/action/dist/index.js` and the seven `.bootstrap*` paths,
`file` + byte-NUL scans for line endings and binary detection.

Environment creation: `git clone --no-hardlinks -c core.autocrlf=false …`,
`git checkout 2543f93…`, `git config core.hooksPath <empty-dir>`,
`git bundle create … rescue/stage0-source`, `git bundle verify …`, `wsl.exe -l -v` +
`command -v node/npm/git`, `docker version`, `docker pull node:24 node:22 node:24-trixie`,
`docker run --rm -v <out>:/out node:<tag> bash /out/run-qualify.sh <label>`.

Per environment: `node -v`, `npm -v`, `git --version`, `uname -a`, `df -T /root`,
`npm ci`, `git status --short`, `sha256sum package-lock.json`, `npm run format:check`,
`npm run lint`, `npm run typecheck`, `npm test`, `npm test -- --reporter=verbose`,
`npm run build`, `npm run package-smoke`, `npm run action-smoke`, `npm run verify`,
`npm run check` (identical to `verify`), `npm run manifest`, `npm audit`,
`npm audit --omit=dev`, `npm pack ./packages/cli --dry-run --json`,
`node packages/cli/dist/index.js --version|--help|review --stdin`, `git grep -I` pattern scans.

Windows timeout ablation: `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath
GIT_CONFIG_VALUE_0=<empty-dir> npm test` (env-scoped; no configuration was modified), plus a
standalone `shim-probe.mjs` that printed the exact `cmd.exe` argv and compared
`execFileSync` / `windowsVerbatimArguments` / unquoted behaviour.

## WORKING TREE STATE

- Canonical `DiffBeacon` working tree: clean at `2543f93…` before this report; the only intended
  change is the new file `docs/audits/stage1-rebaseline.md`.
- `.bootstrap/`, `.bootstrap2/` and `docs/recovery/`: untouched — all seven forensic files'
  worktree sha256 values still equal their `HEAD` blob hashes, and `git status` for those paths is
  empty. No pnpm material added.
- Qualification environments are disposable copies under `…/904c4a23/stage1/` (`win-env` CRLF,
  `win-lf2` LF) plus container trees; none of them is the canonical repo. Generated `node_modules`,
  `dist`, `packages/core/dist`, `packages/cli/dist`, tarballs, probe scripts
  (`guard-check.mjs`, `shim-probe.mjs`, `run-*.sh`, `probe2.sh`, the git bundle and per-gate logs)
  and the Linux copies stay outside the repository and are **not** staged.
- In the disposable Windows clone the rebuilt `packages/action/dist/index.js` shows as `M` for
  line-ending reasons only; it is byte-identical to the committed blob and will not be committed.
- Host residue created by the audit that is _not_ repo state: 24 leaked
  `%TEMP%\diffbeacon-stage5-git-*` directories (a symptom of D5) and Docker images
  `node:24`, `node:22`, `node:24-trixie`.

## DEFECTS FOUND

Ordered by technical dependency / earliest blocker, not by severity drama. **None repaired in
Stage 1.**

- **D1 — `format:check` is checkout-dependent (earliest chain blocker).** The repository ships no
  `.gitattributes`, and a Windows host with `core.autocrlf=true` (the Git-for-Windows default)
  gets a CRLF worktree, so `prettier --check` fails for 82 files. Because `verify.mjs` runs
  `format:check` first, `npm run verify` and `npm run check` abort on Windows before any test,
  build or smoke runs. Proven by A/B on the identical commit.
- **D2 — undeclared minimum Git version (earliest real product-capability blocker).**
  `packages/cli/src/git.ts` always passes `--default-prefix`. Git 2.39.5 (Debian 12, an image
  class CI has used) rejects it and prints its usage text, which produces 7 test failures plus
  `package-smoke` and `action-smoke` failures on that platform; Git 2.47.3, 2.53.0 and 2.55.0
  accept it. No minimum Git is declared in `engines`, README, SECURITY, `docs/architecture/*` or
  tested by any gate, and the CLI's error text ("git diff failed: usage: …") does not point at a
  version requirement.
- **D3 — the Action is a silent no-op on Windows (highest-severity product defect).**
  `packages/action/src/index.ts:26` gates execution on
  `import.meta.url === \`file://${process.argv[1]}\``, which is false for every Windows path, so
the bundle exits 0 without analysing anything or writing a Job Summary. The failure is silent by
construction: exit status success, empty stdout/stderr. The CLI already uses the correct
shape-based `launchedAsCli` test, so the two shipped entrypoints are inconsistent.
- **D4 — `npm run package-smoke` cannot verify the installed Windows bin shim.**
  `scripts/npm-bin-shim.mjs` builds `cmd.exe /d /s /c "<bin>" "<arg>"`; Node escapes the embedded
  quotes as `\"`, which `cmd.exe` does not unescape, so the batch path is taken literally with its
  quotes and fails "not recognized". Ablation: with `windowsVerbatimArguments` it instead breaks at
  the first space, and unquoted fails the same way — while the _same_ `.cmd` shim called directly
  prints `0.1.0`. It reproduces on a space-free 8.3 short path, so the mechanism is quote
  escaping, not spaces. Linux takes the non-`win32` direct-exec branch and passes. Consequence:
  the published-package bin contract is unverified by CI on Windows.
- **D5 — Windows test harness is not robust for Git-spawning tests.** Vitest's 5 s default
  `testTimeout` is applied to tests that create repositories and invoke Git repeatedly, and
  `tests/stage5.git-determinism.test.ts:37` uses a non-retrying `rmSync` for cleanup. Observed
  failure counts at one commit: 2, 3, 13, 14, with individual durations from 1.2 s to 23.3 s, and
  24 temp directories leaked. This is a harness defect (no product assertion ever failed), but it
  also means the Windows cell cannot give a trustworthy pass/fail signal.
- **D6 — `SOURCE_MANIFEST.txt` is stale and structurally blind (see MANIFEST).** 87 committed vs 98
  regenerated at HEAD; regeneration also absorbs untracked files (101 entries) because the
  generator scans the filesystem; the tracked Action bundle is excluded by the `dist` rule; and no
  gate or workflow compares the manifest, so drift cannot fail CI. This partially revises the
  Stage-0 reproducibility claim.
- **D7 — dependency hygiene.** 4 audit findings (1 low in the `--omit=dev` view, 1 high and 2
  moderate dev-only), build tooling declared in the root `dependencies`, and `.npmrc audit=false`
  which hides all of this from ordinary installs.
- **D8 — documentation overclaims.** `npx diffbeacon …` and `uses: …@v1` are not resolvable today,
  the quick start omits `npm run build`, the forced Git flag list is incomplete, the README implies
  package-level runtime separation that the relative source imports contradict, and
  `tests/stage5.git-determinism.test.ts:67` pins a README string that asserts an untagged release.
- **D9 — host-environment confounder (not a repository defect, recorded so the numbers can be
  read correctly).** This machine's global `core.hooksPath` points at
  `C:\Users\Pavithran R A\.codex\git-hooks`, whose `pre-commit`/`commit-msg` scripts each try to
  run a missing `lefthook`. Because `git init`ed test repositories inherit that config, every
  commit inside every Git-spawning test spawns two extra shells. Neutralizing it changed the
  Windows result from 14 failures to 2, which is why the Windows numbers in this report are
  labelled with their hook state. A clean CI Windows runner would not have this amplifier — but it
  would still sit under D1, D3, D4 and D5.

## EARLIEST UNRESOLVED DEFECT

**D1 — the missing `.gitattributes` / line-ending contract.** It is the first gate in the
repository's own verification chain and it aborts `npm run check` on Windows before any product
behaviour is exercised, so it prevents a clean Windows baseline and hides D2–D6 behind it. The
earliest defect that cannot be explained away by host checkout configuration is **D2** (minimum
Git version), which invalidates three gates on an entire OS image class; and the most severe
product defect is **D3**.

## REMAINING BLOCKERS

1. Hosted GitHub Actions remains externally unavailable (0 runners, 0 billable ms), so no CI-matrix
   cell — including any real GitHub Action execution — has ever been qualified. Not resolvable
   from the repository.
2. The Windows cell cannot pass `npm run check` while D1/D3/D4/D5 stand, and Windows/Node 22 was
   never executed at all.
3. The Linux baseline is trustworthy only on Git ≥ 2.47.3 (observed); the exact Git floor required
   by `--default-prefix` was not pinned down by this stage, and no supported-Git statement exists
   to test against.
4. `SOURCE_MANIFEST.txt` does not describe HEAD and cannot be made to until a policy decision is
   taken about the Stage-0 recovery material and the tracked Action bundle — an auditor decision,
   not an executor one.
5. No browser runtime observation (only static + built-artifact inspection).

## STAGE 1 DECISION

**BLOCKED — audit complete, baseline established with named caveats, defects deliberately left
unrepaired.**

- The recovered source is demonstrably **valid**: on a clean Linux copy of exact HEAD with a modern
  Git, `npm ci` is reproducible and immutable, and _every_ gate passes individually —
  format, lint, typecheck, 50/50 tests, build, `package-smoke`, `action-smoke` — and the aggregate
  `npm run verify` (hence `npm run check`) exits 0. The committed Action bundle rebuilds
  byte-identically, the CLI package is clean and self-contained, and the secret review is clean.
  This is the first trustworthy green baseline for this repository.
- It is **not** a PASS of the Stage-1 local qualification contract as written, because the Windows
  cell cannot complete the gates, the Node 22 Windows cell could not be executed, real
  product/platform defects remain open (D1–D8), and manifest reproducibility failed.
- It is **not** FAIL, because no evidence shows the recovered source itself to be invalid,
  incomplete or fabricated: no test ever reported a wrong analysis result, and the observed
  failures localize to checkout configuration, an undeclared external Git requirement, a
  Windows-specific entrypoint guard, two harness scripts, and a stale generated file.
- No completion percentage is asserted here; that calculation belongs to the auditor.

## RECOMMENDED NEXT REPAIR SCOPE

Suggested as a single controlled Stage-2 repair prompt, smallest-first, still excluding parser,
detector, CLI feature, Action redesign, browser redesign and release work:

1. Add a `.gitattributes` line-eol contract (recommend `* text=auto eol=lf` with explicit
   exceptions), then re-run `format:check`/`check` on a Windows CRLF-default host. One file, no
   product logic.
2. Resolve the minimum Git question: either stop passing `--default-prefix` (and prove the
   adversarial-fixture behaviour is unaffected) or detect/declare a tested floor and surface a
   version-aware error. Add a Git-version probe to `verify.mjs` output so the next baseline records
   it. Decide with a deliberate CI-image choice (Debian 12 vs 13) rather than by accident.
3. Replace the Action's `import.meta.url` guard with the same `argv[1]`-shape check the CLI uses,
   and re-run `action-smoke` on both platforms. One expression, one file.
4. Fix `scripts/npm-bin-shim.mjs` so the installed Windows `.cmd` shim can be invoked
   deterministically, then confirm `package-smoke` on Windows. Harness-only.
5. Give the Git-spawning test files an explicit, measured timeout budget and a retrying/leak-safe
   Windows cleanup, then re-measure the Windows failure count twice for stability. Test-only.
6. Decide the manifest policy (exclude the recovery material explicitly, or regenerate to 98 and
   change the header), make the generator enumerate tracked files rather than the raw filesystem,
   and wire a regeneration-and-compare step into `verify.mjs` so drift becomes a build failure.
7. Only then a documentation pass on the D8 overclaims (and un-pin the README assertion in
   `tests/stage5.git-determinism.test.ts:67` at the same time as the tag/publish decision).
8. Keep hosted CI out of scope until the account condition is cleared externally; when it is
   cleared, the first remote run should be treated as the _first_ real execution of this matrix,
   not as a regression check.
