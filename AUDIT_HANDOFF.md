# DiffBeacon Audit Handoff

This handoff describes the unpublished v0.1 MVP state prepared for independent audit. It records commands actually run in the sandbox and distinguishes implemented behavior from claims that still require maintainer review.

## Final validated name

The validated working name is **DiffBeacon**. The intended unscoped npm package name is `diffbeacon`. The exact registry command `npm view diffbeacon name version` returned a genuine `E404 Not Found` response from the npm registry. `npm search diffbeacon --json` produced no result lines in the environment. `GET https://api.github.com/repos/diffbeacon/diffbeacon` returned JSON `404 Not Found`.

These checks support using the name for this unpublished local MVP. They are not trademark clearance, account reservation, package publication, or a guarantee of future availability.

## Architecture and workspace structure

| Area              | Current implementation                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`   | Dependency-free deterministic parser, normalized file model, detector registry, evidence relationships, review order, JSON/Markdown/pretty renderers, v1 JSON Schema |
| `packages/cli`    | `diffbeacon review <range>`, `--stdin`, pretty/JSON/Markdown formats, output support, safe Git argv execution, revision validation                                   |
| `packages/action` | Node 24 JavaScript Action source, event SHA validation, read-only diff collection, Job Summary output, committed `dist/index.js` bundle                              |
| `client/`         | React + Vite static browser demo using the same core; local textarea analysis, sample diff, empty/result-oriented visual system, light/dark mode, mobile layout      |
| `docs/`           | Research validation, architecture overview/security, detector notes and contributor guide                                                                            |
| `.github/`        | CI matrix for Ubuntu/Windows and Node 22/24, Dependabot, issue forms, PR template                                                                                    |

The report schema is versioned as `schemaVersion: "1"`. It contains summary counts, normalized files, attention observations, evidence observations, and deterministic review order. It contains no risk score, safety percentage, merge confidence, or verdict field.

## Detector list

The registered detectors are `ci-build`, `auth-access`, `database-schema`, `dependencies`, `api-contracts`, `configuration`, `infrastructure`, `tests`, `documentation`, `generated`, and `runtime`. Matching is conservative and path-based. The README and `docs/detectors/initial-detectors.md` describe each detector’s intended boundary.

## Evidence-rule list

The core reports the following neutral relationships when their prerequisites are observable in the diff: runtime files without observed test-file changes; authentication/access files without observed test-file changes; database/schema files without observed test-file changes; dependency manifest without observed lockfile change; lockfile without observed dependency manifest change; contract definition without observed documentation or changelog change; and a documented generated-file volume observation when generated files make up at least half of changed files or changed lines and at least two generated files are present.

All relationship copy is framed as “observed” or “not observed in this diff.” It does not accuse an author of forgetting tests or documentation.

## Security invariants

The CLI and Action use argument-vector Git execution. CLI revisions reject whitespace, control characters, shell metacharacters, and option-leading tokens; valid revision tokens are resolved with `git rev-parse --verify --quiet --end-of-options` before `git diff`. Git diff collection uses `--no-ext-diff`, `--no-textconv`, `--no-color`, `--binary`, and `--`.

The project does not execute repository hooks, scripts, tests, builds, changed files, or dependency installation from an analyzed repository. The browser renders diff-derived values as React text and caps pasted input at 8 MiB. Markdown and pretty output sanitization are tested. The Action metadata uses `node24`; the example workflow requests only `contents: read` and does not post comments or modify the repository.

## Exact verification commands and results

| Command                 | Result                                                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                | Passed; installed 127 npm packages from `package-lock.json`.                                                                                                                           |
| `npm run format:check`  | Passed; all non-scaffold DiffBeacon-owned files matched Prettier.                                                                                                                      |
| `npm run lint`          | Passed; ESLint returned exit 0.                                                                                                                                                        |
| `npm run typecheck`     | Passed; strict TypeScript check returned exit 0.                                                                                                                                       |
| `npm test`              | Passed: 7 test files, 32 tests.                                                                                                                                                        |
| `npm run build`         | Passed: core declarations, CLI bundle, Action bundle, and Vite static production build.                                                                                                |
| `npm run verify`        | Passed after build: artifact assertions, CLI version/help, package smoke, Action smoke.                                                                                                |
| `npm run check`         | Passed end-to-end after the final implementation revision.                                                                                                                             |
| `npm run build:action`  | Passed; `packages/action/dist/index.js` created.                                                                                                                                       |
| `npm run action-smoke`  | Passed; bundled Action wrote a 981-byte Job Summary for a temporary two-commit repository.                                                                                             |
| `npm run package-smoke` | Passed; tarball contained 3 files, installed into a clean consumer, actual bin shim returned `0.1.0` and help, and the installed package analyzed a sample diff with `changedFiles=1`. |

The Stage 3B web build is storage-free: decorative artwork is implemented with CSS-only motifs, and production output is checked for managed-storage, Forge, telemetry, and browser-network residue. Any remaining Vite CSS warnings are tooling diagnostics only and do not authorize reintroducing runtime asset or analytics dependencies.

## Test coverage summary

The tests cover modified/added/deleted/renamed/binary/mode-only files, `/dev/null`, CRLF, no-trailing-newline input, quoted and space-containing paths, code-like strings resembling diff headers, empty and malformed input, each primary detector family through the analysis fixtures, evidence language, stable JSON output, Markdown/terminal escaping, CLI revision validation, Action SHA validation, real Git ranges, paths with spaces, hostile filenames, and no shell-side-effect regression.

## Package evidence

`npm pack ./packages/cli` produced `diffbeacon-0.1.0.tgz` in a temporary directory. The inspected tarball contained `README.md`, `package.json`, and `dist/index.js`, with no tests, environment files, or `node_modules`. The package was installed into a clean temporary consumer. The npm-generated `.bin/diffbeacon` shim was invoked for `--version` and `--help`; the installed entrypoint then performed a real stdin review.

The tarball was not published and no package release was created.

## GitHub Action evidence

`action.yml` points to `packages/action/dist/index.js` and declares `using: node24`. The committed bundle was rebuilt after the source revision. The Action smoke harness created a temporary Git repository, supplied base/head SHAs through a simulated pull-request event, invoked the bundle, and checked the resulting Job Summary. No GitHub API, PAT, comment, or repository write was used.

## Web evidence

The static production build passed with no backend or runtime secret dependency in the application path. The dev server was restarted successfully after dependency restoration and reported Vite 8.2.1 with no TypeScript/LSP errors. Desktop and 390px mobile screenshots were captured after the final visual revision. The desktop pass showed the Field Manual rail, local diff instrument, Review Attention Map empty state, evidence-packet cues, and boundary note. The mobile pass showed the collapsed navigation, readable masthead, stacked diff instrument, and responsive empty state.

The browser demo uses no source upload or analysis request. The visual review intentionally keeps the landing masthead compact and uses oxide orange as a signal color rather than a general gradient or verdict indicator.

## CI configuration

`.github/workflows/ci.yml` runs `npm ci` and `npm run check` on `ubuntu-latest` and `windows-latest` for Node 22 and Node 24. It requests `contents: read` and does not require secrets. This matrix is configuration evidence; it has not been executed by GitHub Actions in this unpublished repository.

## Known limitations and uncertainty

Path heuristics cannot understand arbitrary source semantics. DiffBeacon cannot know whether unchanged tests cover a runtime modification, whether a repository uses a lockfile, whether documentation is complete, or whether a contract change is publicly breaking. Generated-file heuristics and unusual Git rename/quoting forms have edge cases. The Action assumes checkout history contains the referenced base/head commits.

The repository has not been published, tagged, released, listed in the Marketplace, deployed to GitHub Pages, or connected to a public GitHub repository. Windows CI is configured but has not executed on a remote runner in this sandbox; report status as **REMOTE CI EXECUTION PENDING**. The web demo contains no managed-storage asset URLs or Forge storage dependency.

## Repository state

The repository is at `/home/ubuntu/diffbeacon` on branch `main`. The first logical implementation commit is `3af4e0f` (`Build DiffBeacon v0.1 deterministic review infrastructure`). The audit handoff is the follow-up commit containing this file; the exact final hash is recorded by the final `git log -1 --format=%H` command after this file is committed. No public remote was created and no publishing operation was attempted.

## Files for special scrutiny

An independent auditor should start with `packages/cli/src/index.ts` and `packages/action/src/index.ts` for process-boundary safety; `packages/core/src/parser.ts` for quoted paths, rename and binary behavior; `packages/core/src/detectors/registry.ts` for false positives; `packages/core/src/analyze.ts` for evidence wording and order; `packages/core/src/render.ts` for Markdown/terminal escaping; `tests/cli.integration.test.ts` for shell-injection regressions; `action.yml` and `.github/workflows/ci.yml` for runtime/permissions; and `client/src/pages/Home.tsx` for hostile-path rendering and local-only behavior.

**READY FOR INDEPENDENT AUDIT**
