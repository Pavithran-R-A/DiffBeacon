# DIFFBEACON STAGE 1 — CROSS-PLATFORM REPAIR REPORT

Repair of the eight concrete Stage-1 defects (D1–D8). This report does not replace
`docs/audits/stage1-rebaseline.md`; that baseline and its BLOCKED decision remain on disk and
unchanged.

## STATUS

`PASS — Stage 1 LOCAL cross-platform baseline qualified. EXTERNAL CI BLOCKED (account billing),
which does not gate local qualification.`

No parser, detector, ordering, CLI-surface, browser, security-model, publication, or release work
was attempted.

```text
STARTING SHA:        416bd99eedf13ae808b30c85208808dbe1265946  (Stage 1 re-baseline HEAD)
REPAIR COMMIT:       813dc91d12de01afdde1563e96418efab5db00f7  fix: close DiffBeacon Stage 1 cross-platform baseline
ENDING SHA:          a202c5b… + this report's documentation-only successor (see COMMIT / PUSH)
BRANCH:              rescue/stage0-source
ORIGIN MAIN SHA:     e0ff98143bfe39c80c338518d006525a846a8739  (untouched; not merged, no PR, no tag)
REPOSITORY:          https://github.com/Pavithran-R-A/DiffBeacon.git
QUALIFIED TREE:      813dc91d12de01afdde1563e96418efab5db00f7 (bundle sha256 f5d36189…)
```

## FILES

`24 files changed, 792 insertions(+), 379 deletions(-)` in the repair commit.

FILES ADDED (6):

- `.gitattributes`
- `packages/action/src/entry.ts`
- `scripts/source-manifest.mjs`
- `scripts/source-manifest.d.mts`
- `tests/git-repository-fixture.ts`
- `tests/stage6.source-manifest.test.ts`

FILES CHANGED (18): `README.md`, `SOURCE_MANIFEST.txt`, `docs/architecture/security.md`,
`packages/action/README.md`, `packages/action/dist/index.js`, `packages/action/src/index.ts`,
`packages/cli/src/git.ts`, `scripts/action-smoke.mjs`, `scripts/generate-source-manifest.mjs`,
`scripts/npm-bin-shim.mjs`, `scripts/npm-bin-shim.d.mts`, `scripts/package-smoke.mjs`,
`scripts/verify.mjs`, `tests/action.test.ts`, `tests/cli.integration.test.ts`,
`tests/stage3b.real-git.test.ts`, `tests/stage3c.release.test.ts`,
`tests/stage5.git-determinism.test.ts`.

FILES DELETED: none.

## D1 EOL

- **Policy.** New `.gitattributes`: `* text=auto eol=lf` for the whole tree, plus `-text` for
  `.bootstrap/**`, `.bootstrap2/**` and binary/image extensions so forensic payloads and opaque
  binaries are never converted. Worktree bytes therefore equal blob bytes for text files on every
  platform, which is what makes `prettier --check`, source hashing, and build input platform
  independent.
- **Windows default-checkout proof.** `cell-win24` and `cell-win22` are clones made with
  `git -c core.autocrlf=true clone …` (Git-for-Windows 2.55.0, the configuration that produced the
  original 82-file `format:check` failure). In both: 107 tracked files, `status_before_ci=[]`,
  `git diff --check` exit 0, and a byte census of the worktree reporting
  `text_files_sampled=86 text_files_with_cr_bytes=0`. `npm run format:check` then passes
  (exit 0) instead of failing for 82 files.
- **Forensic hash proof.** Adding `.gitattributes` changed no forensic byte: `git diff --stat
2543f93 813dc91 -- .bootstrap .bootstrap2` is empty, and for all 7 tracked forensic paths the
  working-tree file is byte-identical to `git cat-file blob HEAD:<path>`.
  `.bootstrap2/payload.tar.xz` is still 11,250 bytes with sha256
  `9d6aa37835ee072a3208d8952442ddb993e3481241958bc77257a9e7b43a898b`, XZ magic `fd 37 7a 58 5a 00`
  intact and its 49 `0x0D` bytes preserved (a CRLF-normalized copy of that file would be
  corruption). Chunk sizes unchanged: `.bootstrap/chunk00..02` 8,204 bytes each,
  `.bootstrap2/chunk00..02` 15,000 bytes each.

## D2 GIT COMPATIBILITY

- **Final argument strategy (no guessed minimum version).** Compatibility was preserved rather
  than restricted. `packages/cli/src/git.ts` now ships one fixed vector, with the prefix pair
  stated explicitly instead of relying on `--default-prefix` (Git ≥ 2.41):

  ```text
  git diff --no-ext-diff --no-textconv --no-color \
      --src-prefix=a/ --dst-prefix=b/ \
      --ignore-submodules=none --submodule=short \
      --diff-algorithm=myers --find-renames=50% -l1000 \
      --unified=3 <RANGE> --
  ```

  No `engines`/README Git minimum was introduced, and no CI matrix cell was narrowed.

- **Git 2.39.5 result.** `--default-prefix` is rejected outright by Git 2.39.5 (Debian bookworm):
  every probe case in `prefix-eq-node:24.txt` prints `default : REJECTED` and the pre-repair tree
  failed 7 tests plus both smokes there. With the explicit vector, the same 2.39.5 container
  produces the normalized header set `f65d1d2f2ef470e9…` for the empty baseline and for all eight
  hostile configuration sets, and the whole ten-gate sequence passes (Linux Node 24 / 22 cells).
- **Modern Git result.** Git 2.47.3 (`node:24-trixie`) and 2.55.0.windows.5 both report `EQUAL`
  for all nine cases: the explicit vector's output hash equals the old `--default-prefix` output
  hash (`f65d1d2f2ef470e9…`) — so the repair is a compatibility widening, not a behavior change.
- **Hostile prefix-config proof.** With no prefix flags at all, hostile config leaks into the
  headers (`none : 6a86dbb4d5db52d2…`), which is exactly the failure mode removed. The cases probed
  are `diff.noprefix`, `diff.srcPrefix`, `diff.dstPrefix`, src+dst, `diff.mnemonicPrefix`, all
  combined, and external-diff/textconv/algorithm config. Product-level proof is retained in tests
  (not moved into the harness only): `stage5.git-determinism.test.ts` asserts the static vector
  contains `'--src-prefix=a/'` and `'--dst-prefix=b/'` and **not** `'--default-prefix'`, and asserts
  a hostile-config diff still yields `diff --git a/old.ts b/new.ts` with every `diff --git` header
  matching `(?!"?(?:[ab])/)`. A third test keeps the documented flag set equal to the shipped
  vector so the docs cannot drift from the code.

## D3 ACTION WINDOWS

- **Root cause.** `packages/action/src/index.ts` gated execution on
  `import.meta.url === \`file://${process.argv[1]}\``. On Windows `process.argv[1]` is a drive-
  letter path, so that string comparison is never true and the bundle exited 0 having analysed
  nothing and written no Job Summary — a silent no-op.
- **Repair.** Entrypoint decision moved to `packages/action/src/entry.ts`:
  `isEntrypointUrl(import.meta.url, process.argv[1], process.cwd())` compares a
  `pathToFileURL(resolve(cwd, argv[1])).href` against the module URL, percent-decoding and
  case-folding only on `win32`. `index.ts` now runs its side effect only under that guard, so the
  bundle can be imported safely and executed correctly.
- **Regression test.** New `describe('Action entrypoint guard')` in `tests/action.test.ts`:
  fires for the absolute script path, fires for a spaced relative script path resolved against the
  working directory, stays silent when imported by a different entrypoint, and matches path case
  only on Windows (`'win32'` case-insensitive vs `'linux'` case-sensitive).
- **Windows action-smoke.** `gate-action-smoke-win-node24.txt` / `-win-node22.txt`:
  `bundled action wrote 1183 bytes; stdout=""; stderr=""; cliLeak=false; hostilePaths=true;
oversizeRejected=true` — a real Job Summary file, non-zero bytes, and no leaked CLI output.
- **Linux action-smoke.** Same gate exits 0 in all three Linux cells with a written summary.

## D4 WINDOWS PACKAGE SHIM

- **Repair.** `scripts/npm-bin-shim.mjs` was rewritten in plain JavaScript (it had stray TypeScript
  annotations) with a sibling `npm-bin-shim.d.mts`. `windowsCmdInvocation()` now emits
  `{ file: <ComSpec>, args: ['/d','/s','/c', '""<shim>" "--version""'],
windowsVerbatimArguments: true }`: `windowsVerbatimArguments` stops Node from re-escaping the
  quotes `cmd.exe` needs, and the extra outer wrap is the `/c` string-removal form that keeps the
  inner quoted batch path intact. `runNpmBinShim()` still uses `shell: false` and long-form
  arguments only.
- **Quoting/injection tests.** `accepts only the trusted shim path and internal long-form
arguments` rejects `-v` (short form), `--version; calc.exe` (metacharacter), a second positional
  argument, a non-`.cmd` path, a shim path containing `&` inside a directory name
  (`node_modules\run & calc \diffbeacon.cmd`), and a missing/empty `ComSpec`.
  `preserves spaces inside the quoted shim path and argument list` asserts the exact
  verbatim/wrapped command line for a spaced path. No test constructs a shell string from user
  input; the only inputs are a generated trusted shim path and internal long-form flags.
- **Actual `.cmd` proof.** New Windows-only test
  `executes a real spaced .cmd shim through the generated cmd.exe invocation` creates
  `…\temp\… with spaces\node_modules\.bin\diffbeacon.cmd` and runs it through
  `runNpmBinShim`, asserting the marker output. It passes on both Windows cells and is the only
  skipped test on Linux (`62 passed | 1 skipped`). This is why the original
  `'…\diffbeacon' is not recognized as an internal or external command` no longer appears.
- **package-smoke result.** exit 0 on Windows Node 24 and Node 22 and on all Linux cells:
  `package-smoke: 0.1.0; bin=true; engines=>=22; stdinFiles=1; rangeFiles=1; tarballFiles=3`.
  The three package tarballs contain `dist/index.js`, `package.json`, `README.md` for
  `@diffbeacon/core`, `@diffbeacon/cli`, `@diffbeacon/action` — unchanged from the baseline.
  `npm run manifest` and both smokes also isolate their temporary Git repositories via
  `core.hooksPath`, so the smoke gates no longer inherit host hooks either.

## D5 TEST HARNESS

- **Hook isolation.** `tests/git-repository-fixture.ts` is now the only way these suites create
  repositories: it `git init`s a temp repo, sets a repo-local identity, and sets
  `core.hooksPath=<repo>/isolated-empty-hooks` so the host's global
  `core.hooksPath` (`…\.codex\git-hooks`, whose scripts call a missing `lefthook`) cannot be
  inherited. `gitIn()` uses `execFileSync(..., { shell: false, windowsHide: true })`; submodule
  operations pass `-c core.hooksPath=<same isolated dir>`. Product-side hostile-config collection
  tests were **not** removed — the hostile `diff.*`/external-diff assertions still run against the
  real collector (see D2). The isolation is a harness change only; `packages/cli/src/git.ts` is
  unchanged in this respect.
- **Cleanup policy.** `removeFixtureRepository()` and both smoke scripts use
  `rmSync(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })` — bounded
  retries with a small fixed delay (≤ 1 s per removal), no unbounded cleanup loop.
- **Timeout policy.** The Git-spawning files set a per-file budget derived from measurement rather
  than a globally inflated timeout: `vi.setConfig({ testTimeout: 20_000, hookTimeout: 30_000 })` with the comment recording that
  the multi-repository cases need 5–8 s against Vitest's 5 s default. Pure unit suites keep the
  default. No suite-wide or CI-level timeout was inflated.
- **Windows run 1 exact result.** Canonical tree (`DiffBeacon`, Node 24.21.0)
  `npm run verify` → exit 0, `Test Files 11 passed (11)`, `Tests 63 passed (63)`,
  duration 23.27 s.
- **Windows run 2 exact result.** Clean disposable clone `cell-win24` from the committed SHA,
  `npm run test` → exit 0, `63 passed (63)` (26 s wall); the same clone then ran `verify` and
  `check`, each re-running the suite → `63 passed (63)` again. `cell-win22` (portable Node 22)
  adds three more clean-state runs at `63 passed (63)`. Six Windows suite runs from clean state
  after the repair, all identical, no flake.
- **Leaked temp directories after each run.** Census of `%LOCALAPPDATA%\Temp\diffbeacon-*` taken
  before and after each Windows cell: `diffbeacon_temp_before=0`, `diffbeacon_temp_after=0` for
  both cells. (Stale `diffbeacon-*` directories from the pre-repair session were removed before
  these runs; nothing new was left behind.)

## D6 MANIFEST

- **Policy.** `scripts/source-manifest.mjs` derives the list from the Git index, not the
  filesystem, and hashes those bytes: header `# DiffBeacon source manifest` followed by two policy
  lines, then `<sha256>  <path>` entries sorted by UTF-8 byte order (`Buffer.compare`), LF only,
  no timestamps. Exclusions: prefix rules `.bootstrap/`, `.bootstrap2/`, `docs/recovery/`,
  `docs/audits/`; exact names `SOURCE_MANIFEST.txt`, `RECOVERY_STAGE0.md`. `.gitignore`d output
  (`node_modules`, build `dist` except the committed Action bundle, coverage) is unreachable
  because only indexed paths are considered. Note the directory rule for `docs/audits/` excludes
  _all_ stage reports, including this one — the manifest is a product-source inventory, not an
  audit-log inventory.
- **Tracked-file enumeration.** `git ls-files --full-name -z` (`-z` so paths are raw UTF-8 and
  never octal-quoted; `--full-name` so the output is repository-relative). No shell interpolation
  anywhere; `execFileSync` with `shell: false` and an 8 MiB `maxBuffer`.
- **File count.** 107 tracked files, 16 excluded by policy, **91 manifest entries**. The 16:
  7 `.bootstrap*` forensic chunks, `RECOVERY_STAGE0.md`, `SOURCE_MANIFEST.txt` itself,
  3 `docs/recovery/*`, 4 historical `docs/audits/*` reports.
- **Action bundle included:** YES (`packages/action/dist/index.js` is indexed and listed).
- **Committed hash.** `SOURCE_MANIFEST.txt` sha256
  `ce6ea98db1785b4578f9d11059996bafd6817fd68e802528cd6e0ca3d448f6cc` — identical in the canonical
  tree and in every disposable clone before regeneration.
- **Regenerated Windows hash.** `cell-win24`: `npm run manifest` →
  `ce6ea98db1785b45…`, `REGEN_IDENTICAL=yes`, `git status --porcelain` empty afterwards.
- **Regenerated Linux hash.** `linux-node24`, `linux-node22` (and the trixie control): committed
  and regenerated `ce6ea98db1785b45…`, `status_after_manifest_regen=[]`. Windows and Linux
  therefore agree byte-for-byte, which is the property the pre-repair generator lacked.
- **Untracked-file invariance test.** `cannot be changed by an untracked scratch file` writes
  `untracked-manifest-probe.txt` into the repository and asserts the rendered manifest is
  unchanged (pre-repair, regeneration absorbed untracked files: 98 → 101 entries).
- **Drift-gate test.** `scripts/verify.mjs` calls `assertManifestCurrent()` after
  `assertFreshArtifacts()` and compares rendered vs committed text without writing. Proved live on
  a disposable clone: appending a fake entry made `npm run verify` exit 1 with
  `SOURCE_MANIFEST.txt does not match the tracked source. Run \`npm run manifest\` and commit the
  result; verify never rewrites the source tree.` (`assertManifestCurrent`, verify.mjs:183); the
clone was then restored to a clean status. `verify` never rewrites the source tree.
- **Staleness now cannot pass quietly:** `npm run check` → `npm run verify` → drift gate, plus
  `.github/workflows/ci.yml` runs the same chain (hosted execution itself is blocked, see GITHUB
  ACTIONS).

## D7 DEPENDENCY AUDIT

Recorded, **not remediated**. No package was upgraded, no lockfile churn, and
`npm audit fix --force` was not run. `package-lock.json` is untouched by the repair commit
(sha256 `e5f5b61297e4385b96806eb6bab15240f6ff2675f2d6df2c6044a9cb143030b5` in both Windows cells).

- `npm audit` — 4 findings: `esbuild` **low**, direct (dev-time bundler, arbitrary file read when
  running the dev server on Windows); `vitest` **moderate**, direct → via `@vitest/mocker`
  (path traversal / arbitrary file read via redirect mock); `@vitest/mocker` **moderate**;
  `js-yaml` **high** (maxTotalMergeKeys does not bound CPU for empty merge sources).
- `npm audit --omit=dev` — 1 finding: `esbuild` **low**, direct.
- Structural notes carried forward unchanged: build tooling is declared in root `dependencies`
  rather than `devDependencies`, and `.npmrc` sets `audit=false`, so ordinary installs do not show
  this. Both are deliberate audit subjects for a later stage, not Stage-1 repairs.

## D8 README

Documentation now describes current reality, and limitations/caution language was kept or
strengthened rather than removed.

- Removed/deferred unreleased claims: `npx diffbeacon …` is replaced by a local-build sequence
  (`npm run build`, then `node packages/cli/dist/index.js review main...HEAD …`) with the explicit
  sentence that `diffbeacon` is not published to the npm registry yet, so `npx diffbeacon …` does
  not resolve today. `uses: Pavithran-R-A/diffbeacon@v1` is gone from `README.md` and
  `packages/action/README.md`; no document now contains a literal `uses: …diffbeacon@` reference.
  The Action example uses the only runnable form, `uses: ./`, and states that an owner-repo
  version-tag reference is not usable until such a tag exists in a public repository, that the
  committed bundle is `packages/action/dist/index.js`, that CI runs the quality gates rather than
  consuming the Action, and that a public release should pin `uses` to a reviewed tag or commit
  SHA.
- Current runnable commands: quick start installs with npm, builds, and runs the built CLI; the
  Git vector in `docs/architecture/security.md` (prose + table + safe-flow block) is the exact
  shipped argument list, including why the prefix pair precedes `diff.noprefix/srcPrefix/dstPrefix/
mnemonicPrefix` and why `--default-prefix` is not used.
- Tests updated: the assertion that required `uses: Pavithran-R-A/diffbeacon@v1` was replaced by
  `documents only runnable Action and CLI references`, which asserts the _absence_ of a tag-based
  `uses:` reference, the presence of `uses: ./` and of the "not published … yet" sentence, the
  presence of the built-CLI command, and that `package.json` keywords/repository/homepage/bugs
  still describe the intended release repository (so the intent is recorded without claiming the
  release). Tests assert truth, not a future state.
- Unchanged caution language: "It does not determine whether a pull request is safe to merge", the
  suggested-order-not-danger framing, and the "What this does not prove" section in
  `docs/architecture/security.md`.

## MATRIX

Five cells, each a clean disposable clone of `813dc91d…` taken from the bundle
(`f5d36189…`), each running all ten commands individually. `verify` and `check` are both listed
because the prompt requires both; `check` is an alias for `verify`, so it is **not** an
independent suite.

| #   | Cell                                                                                                                                | Node / npm         | Git              | npm ci    | Gates 2–10 | Tests                                 | Temp leaks                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------- | --------- | ---------- | ------------------------------------- | ------------------------------------- |
| 1   | `win-node24` — Windows 10.0.26200, workspace path contains spaces, `core.autocrlf=true`                                             | v24.21.0 / 11.19.0 | 2.55.0.windows.5 | 0 (29 s)  | all 0      | 11 files, 63 passed (63)              | 0 before / 0 after                    |
| 2   | `win-node22` — same OS, portable Node in `<…>\stage1\node22\node-v22.23.3-win-x64` (spaced path), PATH modified only inside the run | v22.23.3 / 10.9.9  | 2.55.0.windows.5 | 0 (31 s)  | all 0      | 11 files, 63 passed (63)              | 0 / 0                                 |
| 3   | `linux-node24` — Debian 12 bookworm container, overlay fs `/root`, Git 2.39.5                                                       | v24.21.0 / 11.19.0 | 2.39.5           | 0 (346 s) | all 0      | 11 files, 62 passed \| 1 skipped (63) | not census-able (ephemeral container) |
| 4   | `linux-node22` — Debian 12 bookworm container, overlay fs `/root`, Git 2.39.5                                                       | v22.23.3 / 10.9.9  | 2.39.5           | 0 (284 s) | all 0      | 11 files, 62 passed \| 1 skipped (63) | not census-able                       |
| 5   | `linux-trixie-node24` — modern control, Debian 13 trixie container, overlay fs `/root`                                              | v24.21.0 / 11.19.0 | 2.47.3           | 0 (222 s) | all 0      | 11 files, 62 passed \| 1 skipped (63) | not census-able                       |

The one Linux skip is `executes a real spaced .cmd shim through the generated cmd.exe
invocation`, guarded by `it.runIf(process.platform === 'win32')`; it is a Windows-only contract by
design, so the comparable totals are 63 executed tests on Windows and 62 + 1 on Linux.

Node 22 evidence is a real portable runtime, not a Docker-only substitution:
`node-v22.23.3-win-x64.zip` sha256 `2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71`,
verified against the official `SHASUMS256.txt` for that distribution before use. The global Node
installation, PATH, registry and system settings were not modified; only the child process of that
cell had the portable directory prepended to its PATH.

## INSTALL

`npm ci` exit 0 in all cells. Windows installs report `added 213 packages` (Node 24) and
`added 214 packages` (Node 22); the containers report `added 215 packages` (linux-node24,
trixie) and `added 216 packages` (linux-node22) because of platform-specific optional
dependencies. The only npm warning is the pre-existing
`install-scripts … esbuild@0.27.7 (postinstall: node install.js)` notice. `package-lock.json`
sha256 `e5f5b61297e4385b…` in every cell; `status_after_ci=[]`, i.e. install never dirties the
tree.

## FORMAT

`prettier --check .` exit 0 in all cells ("All matched files use Prettier code style!"), including
the two Windows `core.autocrlf=true` clones — the D1 fix.

## LINT

`eslint . --max-warnings=0` exit 0 in all cells (zero warnings tolerated by the flag).

## TYPECHECK

`tsc --noEmit -p tsconfig.json` exit 0 in all cells, with `strict`,
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled.

## TESTS

- Total: **63** test cases in **11** files (baseline inventory was 50).
- Per cell: win-node24 `63 passed (63)` three times (`test`, `verify`, `check`);
  win-node22 `63 passed (63)` three times; linux-node24 and linux-node22
  `62 passed | 1 skipped (63)`; no failures and no other skips anywhere.
- Newly added (14) and newly removed (1), net +13:
  - `tests/action.test.ts` — `fires when Node reports the bundle itself as the script path`,
    `fires for a spaced relative script path resolved against the working directory`,
    `stays silent when the bundle is imported by a different entrypoint`,
    `matches path case only on Windows, where the filesystem is case-insensitive`
  - `tests/stage3c.release.test.ts` — `accepts only the trusted shim path and internal long-form
arguments`, `preserves spaces inside the quoted shim path and argument list`,
    `executes a real spaced .cmd shim through the generated cmd.exe invocation` (Windows-only)
  - `tests/stage5.git-determinism.test.ts` — `analyzes a repository whose working directory
contains spaces`, `documents only runnable Action and CLI references`,
    `keeps the documented Git argument set equal to the shipped vector`
  - `tests/stage6.source-manifest.test.ts` (new file) — `lists tracked product source and omits
forensic material`, `renders a timeless header and byte-consistent entries`,
    `cannot be changed by an untracked scratch file`, `orders paths by UTF-8 bytes so platforms
agree`
  - Removed: `uses the intended release repository without enabling publication` (it pinned the
    untagged `@v1` release claim; superseded by `documents only runnable Action and CLI
references`).

## BUILD

`npm run build` exit 0 in all cells: `build:core` (tsc), `build:cli` (esbuild, node22 target),
`build:action` (esbuild, node24 target), `build:web` (vite, 1564 modules transformed,
`dist/assets/index-*.js 255.27 kB │ gzip 79.89 kB`). `scripts/verify.mjs` re-checks artifact
freshness by hash (`assertFreshArtifacts`) and it passes in all cells, so no cell left a stale
bundle.

## CLI

From `verify` in each cell: `node packages/cli/dist/index.js --version` → `0.1.0`;
`--help` → the documented usage block, ending with the non-authoritative caveat ("It does not
determine whether a pull request is safe to merge."). Range and stdin analysis both run in
`package-smoke` (`rangeFiles=1; stdinFiles=1`). `diffbeacon` on PATH via `npx` remains
**not runnable today** and is documented as such (D8).

## PACKAGE

`package-smoke` exit 0 in every cell with `tarballFiles=3`; the three workspace tarballs contain
`dist/index.js`, `package.json`, `README.md`. Real Windows `.bin\diffbeacon.cmd` invocation now
passes (D4), which is the check that previously could not run on this platform. No npm
publication was attempted.

## ACTION

`action-smoke` exit 0 in every cell; on Windows it writes a real 1,183-byte Job Summary with empty
stdout/stderr, `cliLeak=false`, `hostilePaths=true`, `oversizeRejected=true`. The Action remains
read-only: `action.yml` is unchanged in the repair commit, permissions in the documented example
stay `contents: read`, there is no `pull-requests: write`, no PAT, no comment posting, and no
`pull_request_target`. The example uses `uses: ./` only, because no published tag exists.

## BROWSER

No browser-facing file changed (nothing under `client/` appears in the repair commit). The Vite
production build is exercised by `npm run build` in all five cells and the bundle-size line is
recorded above. No new manual browser verification was performed, because there was no UI change
to verify — this is a deliberate scope limit, not an oversight, and the browser demo section of
the README still describes the local-only path.

## MANIFEST

See D6. 107 tracked → 91 manifest entries; committed sha256 `ce6ea98db1785b45…`; regenerated
identical on Windows Node 24, Windows Node 22 and Linux; drift gate fails `verify` with exit 1
without rewriting the tree.

## DEPENDENCY AUDIT

See D7. Four findings unchanged, one of them in the `--omit=dev` view; no forced remediation.

## ACTION BUNDLE

- Committed hash before repair: `c92431c90208cee075ccaf79dab5bd6b2619a776cb8b4a240d310c8f711e23af`
  (`2543f93:packages/action/dist/index.js`).
- Rebuilt hash after the D3 entrypoint repair:
  `0c9b493c554d31150a0020bd53ba1d96bcf47340736c37473b054999d7a1278f`, rebuilt on Windows
  (`cell-win24`, `cell-win22`) and on Linux (`linux-node24`, `linux-node22`): the Linux cells print
  `committed_action_bundle_sha256` == `rebuilt_action_bundle_sha256` == `0c9b493c554d3115…`.
- Freshness result: PASS. The fresh bundle was deliberately rebuilt, reviewed as the only
  meaningful change (the entrypoint guard), committed with the source change, hashed in
  `SOURCE_MANIFEST.txt`, and re-verified by `assertFreshArtifacts` in every cell. Post-repair
  rebuilds never diverged, so no unattributed bundle was left in the tree.

## GITHUB ACTIONS

`EXTERNAL CI BLOCKED` — reconfirmed on the repaired tree, and CI YAML was **not** modified to
hide it.

- The content push `416bd99..a202c5b` to `rescue/stage0-source` automatically created CI run
  `36074158221` (`event=push`, `headSha=a202c5bf2843af0c67e4311598a8c495146eed69`,
  `createdAt=2026-09-24T23:43:39Z`, `status=completed`, `conclusion=failure`). It was observed
  once, as instructed; it was not re-run.
- Runner assignment: all four matrix jobs (`Node 22/24 × ubuntu/windows-latest`) completed with
  `runner_id: 0` and `steps: 0`, i.e. nothing was scheduled and no step executed.
- Billable time: `timing.billable` reports `UBUNTU.jobs=2, total_ms=0` and
  `WINDOWS.jobs=2, total_ms=0`; every individual `duration_ms` is 0.
- The run's `annotations` endpoint returned HTTP 404, so this stage records no annotation text as
  evidence; the runner/billing numbers above are the evidence. The prior annotation attributing
  the pre-start failure to the account's payment/spending-limit state is carried forward from
  `stage1-rebaseline.md` as the external cause.
- Consequence, stated plainly: these are **not** product test results and do not contradict the
  local matrix. The real GitHub-hosted 4-cell CI matrix has still never executed, and a hosted
  `uses: ./` Action run has never been observed. LOCAL ACTION SMOKE ≠ REAL GITHUB-HOSTED ACTION
  EXECUTION remains true after this repair.

## EXACT COMMANDS RUN

Identity and state (Phase 0 gate, re-proved before and after the work):

```bash
git remote get-url origin          # https://github.com/Pavithran-R-A/DiffBeacon.git
git branch --show-current          # rescue/stage0-source
git rev-parse HEAD                 # 416bd99… before the repair commit
git rev-parse origin/main          # e0ff981…
git ls-remote origin refs/heads/main refs/heads/rescue/stage0-source
git status --short
git diff --check
```

Canonical-tree verification, Windows Node 24 (host PATH Node):

```bash
npm run verify        # exit 0: 63 tests, format/lint/typecheck/build/freshness/manifest/CLI/smokes
npm audit             # 4 findings (recorded, not remediated)
npm audit --omit=dev  # 1 finding
git -c user.name="Qoder Stage1 Repair Executor" -c user.email="stage1-repair-executor@local.invalid" \
  commit -m "fix: close DiffBeacon Stage 1 cross-platform baseline"
```

D2 prefix-equivalence probes (one per Git, nine hostile-config cases each):

```bash
node ../stage1/prefix-eq.mjs                    # Windows Git 2.55.0.windows.5
MSYS_NO_PATHCONV=1 docker run --rm -v "<repo>/..:/out" node:24        node /out/prefix-eq.mjs   # Git 2.39.5
MSYS_NO_PATHCONV=1 docker run --rm -v "<repo>/..:/out" node:24-trixie node /out/prefix-eq.mjs   # Git 2.47.3
```

Matrix cells (bundle → clean disposable clone → ten gates each):

```bash
git bundle create …/diffbeacon-stage1-repair.bundle rescue/stage0-source   # f5d36189…, verified okay
git -c core.autocrlf=true clone -q <bundle> <cell>/diffbeacon && git checkout -q 813dc91d…
git config core.hooksPath <isolated-empty-hooks>
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
# wrapper used: stage1/repair-evidence/qualify-windows.sh (win-node24, win-node22 with portable Node 22)
#            stage1/repair-evidence/qualify-linux-v2.sh  (linux-node24, linux-node22, linux-trixie-node24)
MSYS_NO_PATHCONV=1 docker run --rm -v "dbq-npm-cache-<label>:/root/.npm" -v "<evidence>:/out" <image> \
  bash /out/qualify-linux-v2.sh <label>          # image: node:24 | node:22 | node:24-trixie
```

D1/D6 spot proofs (disposable clones only):

```bash
git ls-files -z -- '*.ts' '*.tsx' … | while read f; do grep -qU $'\r' "$f"; done   # 0 of 86 (Windows, autocrlf=true)
node scripts/generate-source-manifest.mjs && sha256sum SOURCE_MANIFEST.txt          # ce6ea98d… identical
git diff --stat 2543f93 813dc91 -- .bootstrap .bootstrap2                            # empty
git cat-file blob HEAD:<path>                                                        # byte-identical to worktree
printf '<fake entry>\n' >> SOURCE_MANIFEST.txt && npm run verify                     # exit 1 at assertManifestCurrent
```

Two harness mistakes are recorded rather than hidden: the first Windows cell skipped the
`git checkout` of the bundle ref (so the gates ran in an empty tree and reported exit 127), and the
first Linux cell was launched against `qualify-linux.sh` while that file was still being edited,
which garbled the running script after `npm ci` (exit 2, no gate evidence). Both were fixed by
adding the explicit checkout plus a `package.json` presence guard, and by freezing the script to
`qualify-linux-v2.sh` before launching. No product code was involved in either, and neither
produced a passing-but-meaningless cell.

## WORKING TREE STATE

```text
$ git status --short          # (canonical tree, before report commit)  clean
$ git diff --check            # clean
$ npm run format:check        # All matched files use Prettier code style!
```

Disposable clones (`cell-win24`, `cell-win22`, container `/root/dbq`) were left as scratch under
`stage1/` and outside the repository; none of their output was committed. `node_modules`, build
output, the Node 22 portable runtime, bundle/log evidence, and WSL/container copies are all
uncommitted by rule.

One host-environment fact that a future reader must not mistake for repository state: an external
process on this machine re-created untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` in the
canonical working tree at 04:24 (byte-identical to the copies captured during Stage 1 closure),
which is the condition `assertNoObsoleteSurface()` rejects. They were moved to
`stage1/host-residue/` (with their re-created twins) so `npm run verify` could run; they were never
staged, never committed, and are not part of the source tree. This npm project does not use pnpm.

## REMAINING DEFECTS

1. **External CI cannot execute** — account-level billing/runner assignment, not a repository
   defect. The `EXTERNAL CI BLOCKED` status is carried forward; the hosted Action path and hosted
   Windows/Linux CI remain unproven.
2. **D7 dependency findings** — unchanged by design: `js-yaml` high, `vitest`/`@vitest/mocker`
   moderate (dev-only), `esbuild` low (the only production-view finding), build tooling declared
   in root `dependencies`, and `.npmrc audit=false` masking findings from ordinary installs.
3. **Manifest excludes `docs/audits/` wholesale** — a directory rule chosen to keep forensic and
   stage-report material out of the product inventory. Consequence: new audit reports are outside
   the drift gate's coverage. Recorded as a policy trade-off, not a bug.
4. **`uses: ./` is the only Action form that runs** — and only inside this repository; marketplace
   / tag-pinned usage remains unrunnable until a public reviewed tag exists. Documented rather
   than released.
5. **Node 22 Windows and Linux cells depend on a Windows-only test being skipped** — the
   `.cmd` shim contract has no Linux analogue, so cross-platform parity of that specific test is
   by design.
6. **Gate 10 (`npm run check`) duplicates gate 9** — it is an alias for `verify`; running both is
   required by the prompt but the pair provides one suite, not two.
7. **Untouched Stage-1 non-defect backlog** — parser/detector expansion, ordering research,
   browser redesign and publication were explicitly out of scope and remain open roadmap work.

## STAGE 1 FINAL DECISION

`PASS — Stage 1 LOCAL BASELINE QUALIFIED (cross-platform), EXTERNAL CI BLOCKED AND RECORDED.`

All eight Stage-1 defects are closed at `813dc91d…`: the EOL contract is checkout-independent
without disturbing forensic bytes; the Git vector is deterministic on 2.39.5 through 2.55.0 and
immune to hostile `diff.*` config without declaring a guessed minimum version; the Action writes
a real Job Summary on Windows instead of exiting silently; the installed Windows bin shim is now
genuinely exercised and guarded against injection; the Windows harness is stable enough to be a
trustworthy signal (six clean-state suite runs, identical totals, zero leaked temp directories);
the manifest is index-derived, cross-platform byte-identical, untracked-immune and drift-gated;
dependency findings are recorded without forced remediation; and the documentation describes only
what runs today. Roadmap Stage 2 (feature work) is **not** authorized by this report.

## NEXT RECOMMENDED ROADMAP STAGE

Stage 2 should be **`HOSTED EXECUTION CLOSURE`, not feature expansion**: restore the ability to run
GitHub-hosted jobs (billing/runner access is a user/account action, outside this repository), then
let the unchanged `.github/workflows/ci.yml` prove the ten gates on a clean hosted Windows runner
and a clean hosted Linux runner with Git 2.39.x, and observe a real `uses: ./` Action run on a
pull request in this repository. Only after hosted execution is green does parser/detector/ordering
expansion become a safe next step, because every one of those areas is currently certified only by
locally executed gates.

If hosted CI cannot be restored, the alternative next stage is a **D7 hygiene stage** (dependency
and `audit=false` review, build tooling moved out of runtime `dependencies`) since that is the
largest remaining recorded-but-unfixed item that is fully addressable offline.

## COMMIT / PUSH

```text
REPAIR COMMIT:  813dc91d12de01afdde1563e96418efab5db00f7  fix: close DiffBeacon Stage 1 cross-platform baseline
REPORT COMMIT:  a202c5bf2843af0c67e4311598a8c495146eed69  docs: record DiffBeacon Stage 1 cross-platform repair evidence
ENDING SHA:     a202c5bf2843af0c67e4311598a8c495146eed69 (content of this section's own commit is the
                documentation-only successor, see below)
BRANCH:         rescue/stage0-source
PUSH RESULT:    416bd99..a202c5b  rescue/stage0-source -> rescue/stage0-source   (fast-forward, normal)
```

Normal forward history only. No `--force`, no `--force-with-lease`, no merge, `main` untouched at
`e0ff98143bfe39c80c338518d006525a846a8739`, no PR created, no tag, no release, no npm publication.
Commit identity was one-shot (`-c user.name=… -c user.email=…`,
`Qoder Stage1 Repair Executor <stage1-repair-executor@local.invalid>`); global Git configuration
was not read into or written out of the repository. The host's missing `lefthook` still prints
`Can't find lefthook in PATH` around commits made in the canonical tree; the commits themselves
succeeded, which is why that line appears in the command output.

One bookkeeping note so the history can be read correctly: the GITHUB ACTIONS evidence above
requires a push to exist before it can be observed, so the observation is carried by a
documentation-only successor commit rather than being invented in advance. That successor is the
only push after the content push, and its automatically created run was deliberately **not**
inspected, to honor "observe the run once / do not repeatedly rerun". It changes no source, test,
build script, workflow, or manifest content.
