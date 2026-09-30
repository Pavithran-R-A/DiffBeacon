# DiffBeacon Stage 3A Audit Handoff

> **HISTORICAL RECORD — not current project status.** Stage 10 moved this file here by Git
> rename from the repository root (`AUDIT_HANDOFF_STAGE3A.md`); its prose and measurements are
> unchanged. It describes the completed Stage 3A state only. Stage 3B supersedes its interim
> managed-storage artwork design, 18-test verification counts, and Stage 3A archive references,
> and Stages 4-9 supersede the CLI, Action, browser, security, packaging, and CI wording below.
> Nothing here is evidence about the current tree. For how the product works now, read
> [`README.md`](../../../README.md), [`docs/architecture/`](../../architecture/), and the stage
> reports in [`docs/audits/`](../).
>
> The records this handoff pointed at have themselves moved: `EXPORT_VERIFICATION.md` is now
> [`export-verification-stage4.md`](export-verification-stage4.md) beside this file, and
> `docs/audits/stage3a-before-fixes.md` is now
> [`../stage3a-before-fixes.md`](../stage3a-before-fixes.md). The Stage 3B final delivery report
> is [`../stage3-detector-system.md`](../stage3-detector-system.md).

## Stop state

This document records the fixed, unpublished DiffBeacon Stage 3A state. The repository is **ready for independent re-audit** after the final clean export verification described in `EXPORT_VERIFICATION.md`. No npm publish, GitHub repository push, GitHub Release, GitHub Pages deployment, or other public publication was performed.

DiffBeacon remains an observational tool. It maps changed files to review surfaces, observed evidence relationships, and a suggested first-read order. It does not determine correctness, exploitability, merge safety, confidence, or severity.

## Recovery and baseline

The original source repository was recovered at `/home/ubuntu/diffbeacon` before changes. The frozen baseline is documented in [`../stage3a-before-fixes.md`](../stage3a-before-fixes.md), including the original commit, source tree, 4-file/15-test baseline, clean-but-shallow build/verify result, and reproduced parser, large-diff, packaging, and static-asset findings.

## Fix matrix

| Stage 3A concern                                    | Implemented change                                                                                                                                                                                                                                        | Evidence                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Header-like hunk content corrupted metadata         | Replaced line-order parsing with an explicit metadata/hunk state boundary; `---`, `+++`, `index`, and `diff --git` content inside a hunk is counted as content.                                                                                           | `packages/core/src/parser.ts`; parser adversarial fixtures in `tests/core.test.ts` |
| Ambiguous Git paths                                 | Added quoted, space-containing, literal ` b/`, `/dev/null`, and Git octal UTF-8 path handling.                                                                                                                                                            | Core path fixtures and real-Git CLI integration tests                              |
| Binary status conflation                            | `binary` is now orthogonal to `added`, `modified`, `deleted`, `renamed`, and `mode-only`.                                                                                                                                                                 | Model, schema, binary matrix tests                                                 |
| Mode-only line counts                               | Mode-only additions/deletions are `null`, not zero; mode-only files do not trigger runtime/test evidence relationships.                                                                                                                                   | Parser and evidence tests                                                          |
| Rails/Drizzle detector gaps and API false positives | Added path-prefix matching for Rails/Drizzle migrations and narrowed API contracts to explicit formats and API schema/contract paths.                                                                                                                     | Detector QA fixtures                                                               |
| Markdown injection                                  | Centralized escaping and rendered untrusted paths in inert code spans.                                                                                                                                                                                    | Hostile filename renderer tests                                                    |
| Large Git diff `ENOBUFS`                            | Added a shared asynchronous streaming collector with an 8 MiB bound, clear oversize error, fixed argv, `shell: false`, and Git `--` path termination.                                                                                                     | Real Git large-range CLI test; expanded Action smoke                               |
| Windows portability                                 | Replaced POSIX `mkdir -p`, direct `node`/`npm` assumptions, and `npx` build calls with Node filesystem APIs, `process.execPath`, platform npm resolution, and esbuild’s Node API.                                                                         | Package/Action smoke harnesses and source scan                                     |
| Artifact-first verification                         | `scripts/verify.mjs` now asserts source completeness, rejects obsolete template code, checks privacy/network boundaries, runs format/lint/typecheck/tests/build, checks bundle freshness, then runs package and Action smoke tests.                       | `npm run verify`; `SOURCE_MANIFEST.txt`                                            |
| Manus/static-template residue                       | Removed `server/`, `shared/`, template component tree, maps/contexts/hooks/lib, template metadata, pnpm workspace/patches, and managed public assets.                                                                                                     | Source completeness verifier and ZIP manifest                                      |
| Large web artwork and static build                  | **Historical Stage 3A interim design:** moved generated images to managed web storage and added a Vite storage proxy. Stage 3B superseded this with CSS-only motifs, no storage proxy, no Forge environment references, and the same `BASE_PATH` support. | Stage 3A record; current evidence is in `EXPORT_VERIFICATION.md`                   |
| Pages readiness                                     | Added a manual build-only Pages artifact workflow and repository-path base support without adding a deployment trigger.                                                                                                                                   | `.github/workflows/pages.yml`, `vite.config.ts`                                    |
| Action hardening                                    | Read-only event SHA validation, no PR comments/labels/check-runs/merges, no network API, no checkout of untrusted code in the Action, minimum workflow permissions, and immutable workflow action pins.                                                   | `packages/action/src`, `action.yml`, `.github/workflows/`                          |

## Architecture and security boundaries

The core is dependency-free and browser-compatible. It parses unified diff text, classifies paths through transparent detectors, computes only observable evidence relationships, and renders JSON, Markdown, and terminal output. The CLI and Action own the Node/Git process boundary. Git is invoked through fixed argument arrays with `shell: false`; revision inputs reject whitespace, control characters, shell metacharacters, and option-like values, and each revision is validated with `git rev-parse --verify --end-of-options` before diff collection.

The Action reads only `GITHUB_EVENT_PATH`, validates pull-request base/head SHAs, invokes the bounded local Git collector, and appends Markdown to `GITHUB_STEP_SUMMARY` when present. It does not call GitHub APIs, write repository state, post comments, set labels, create checks, merge pull requests, execute repository scripts, or evaluate diff content. Git external diff and text conversion are explicitly disabled.

The browser demo is local-only for user data. **The following Stage 3A artwork sentence is historical and superseded:** the current Stage 3B source contains no managed-storage CSS paths, storage proxy, Forge environment reference, `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, analytics, or debug collector. The user-visible copy says that pasted source stays in the browser and that no merge verdict is produced. The browser and CLI/Action share an 8 MiB input boundary.

These boundaries are intentionally narrower than a security scanner, policy engine, or AI reviewer. Detector matches are path heuristics, not semantic proof. Evidence relationships mean only that the named file categories were or were not observed in this diff; they do not establish that coverage, documentation, or a lockfile is absent from the repository.

## Verification summary

The final exact commands, extracted-copy results, archive hash, file count, and browser evidence are recorded in [`export-verification-stage4.md`](export-verification-stage4.md). The required checks are source-first and must be run from a clean extracted copy as well as the working tree:

```text
npm ci
npm run check
npm run manifest
```

The final run must report the full Vitest suite, real ESLint, strict TypeScript checking, source-driven core/CLI/Action/web builds, package tarball/bin and real Git-range smoke, adversarial Action smoke, and a production-output scan with no managed-storage or Forge references.

The definitive Stage 3A extracted-copy run above is historical. Stage 3B replaces it with the current record in `EXPORT_VERIFICATION.md`: 107 ZIP entries, 81 manifest files, 32 passing tests, a fresh Action bundle, storage-free production output, and byte-identical extracted manifest and Action bundle.

## Independent-audit targets

An independent auditor should review the parser against additional Git versions and `core.quotePath` settings, confirm copy detection behavior if it is added in a future release, inspect Unicode normalization expectations, and test diffs near the 8 MiB boundary under Windows Node 22 and 24. The detector suite should continue to grow with repository-specific positive and negative fixtures. The Pages workflow is deliberately build-only and must not be changed to deploy without an explicit release decision and separate permission review.

## References

[1]: https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax 'GitHub Actions metadata syntax reference'
[2]: https://docs.github.com/en/actions/reference/security/secure-use 'GitHub Actions secure use reference'
[3]: https://nodejs.org/en/about/previous-releases 'Node.js releases and support status'
[4]: https://vite.dev/guide/static-deploy 'Vite static deployment guide'
