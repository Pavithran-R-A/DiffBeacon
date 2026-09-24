# DiffBeacon Stage 4 GitHub-CI Input Export Verification

## Purpose

This record verifies the small final hardening pass applied to the independently confirmed Stage 3C repository before it is used as input for real GitHub-hosted CI. No product feature or web redesign was added.

## Required archive

The final archive is `diffbeacon-stage4-github-ci.zip`. It must contain complete source, tests, documentation, `.github`, `package-lock.json`, `action.yml`, and the freshly rebuilt `packages/action/dist/index.js`. It excludes `.git`, `node_modules`, temporary repositories, npm tarballs, ordinary web/CLI build outputs, `.manus`, logs, project configuration, pnpm artifacts, and secrets.

The source manifest excludes generated output and sandbox-only directories by policy. The committed Action bundle is intentionally required by the archive even though ordinary `dist/` directories are excluded from manifest traversal.

## Stage 4 implementation evidence

The reusable Git revision validators now live in `packages/cli/src/revisions.ts`. Both `git.ts` and the executable CLI import that module; the reusable Git boundary no longer imports the CLI entrypoint, so Action bundling cannot pull in CLI parsing, help, version, or startup code.

The successful Action smoke captures stdout and stderr, requires exit code zero and empty stderr, rejects CLI banner/help/usage strings, checks the expected Job Summary and hostile-path behavior, and statically rejects CLI startup markers in the final bundle. The successful run reports `stdout=""`, `stderr=""`, and `cliLeak=false`.

The core renderer now uses only explicit `options.color`; it does not inspect `process.env`, `process.stdout`, or other Node facilities. A static scan covers every file under `packages/core/src`, and a runtime test executes `analyzeDiff`, `renderJson`, `renderMarkdown`, and `renderPretty`.

The CLI package manifest is the sole version authority. The source reads the package manifest, and package smoke reads the installed packed manifest, executes the real npm-created bin shim with `--version`, and requires exact equality. The core package is explicitly private for v0.1; root and Action remain private while the CLI remains publishable.

The schema uses the non-network identifier `urn:diffbeacon:schema:review-attention-map:v1`. Canonical model constants for file statuses, surface IDs, attention levels, and evidence kinds are compared with schema enums. Stable schema objects reject unexpected properties, and generated empty/report shapes remain schema version `1`.

Dependabot tracks both npm and GitHub Actions monthly. CI retains the Ubuntu/Windows and Node 22/24 matrix, `contents: read`, and immutable action pins while adding a 25-minute job timeout and branch/PR-scoped cancellation concurrency. Vite development and preview use localhost-safe defaults without wildcard hosting or `.manus.computer`.

## Required quality sequence

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run package-smoke
npm run action-smoke
npm run verify
npm run check
```

The final test count and command results are recorded in the external Stage 4 final report. The extracted archive must pass `npm ci` and `npm run check`, regenerate a byte-identical source manifest, preserve the Action bundle byte-for-byte, and produce storage-free production output.

## Publication and remote status

The expected v0.1 workspace intent is: root private, core private, Action private, CLI publishable. No npm publishing workflow, token, trusted publisher, GitHub Release workflow, Pages deployment, CodeQL, Scorecard, dependency-review workflow, success badge, Marketplace publishing, analytics, telemetry, LLM, PR comments, or merge gate was added.

No real GitHub-hosted Ubuntu or Windows runner has executed during this task. Status remains **REMOTE GITHUB CI STILL PENDING**.
