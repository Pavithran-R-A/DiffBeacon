> **HISTORICAL / INTERNAL WORKING NOTES — not current project status and not a roadmap.** Stage 10
> moved this file here by Git rename from the repository root (`todo.md`). It is the sequence of
> execution checklists an operator pasted from each stage's instruction attachment while working;
> every item in it is checked because each checklist belonged to a stage that already closed. The
> files it names (`AUDIT_HANDOFF_STAGE3A.md`, `EXPORT_VERIFICATION.md`,
> `diffbeacon-stage3a-fixed.zip`) are the root paths and archives of that era, not the current
> tree — the two documents now live as legacy records beside this file.
>
> Nothing here is a pending action. Current capability lives in
> [`README.md`](../../../README.md); what remains before publication is stated in
> [`docs/releasing.md`](../../releasing.md) and the `NEXT` sections of the stage reports in
> [`docs/audits/`](../). The banner text above is the only Stage 10 addition; the checklists
> below are preserved verbatim.

# Stage 3A Execution Checklist

- [x] Read the entire authoritative Stage 3A instruction from the attached file.
- [x] Recover and inspect the complete original `/home/ubuntu/diffbeacon` source repository.
- [x] Freeze the pre-fix Git state, source tree, workspaces, test count, build, verification, and known audit defects.
- [x] Replace the unified-diff parser with an explicit metadata/hunk/binary state machine.
- [x] Fix Git path-pair parsing, quoted/octal/Unicode decoding, binary path adversaries, and orthogonal status/binary fields.
- [x] Implement bounded asynchronous Git diff collection shared by CLI and Action, with graceful oversize errors.
- [x] Centralize Markdown escaping for all untrusted report values and add hostile-filename coverage.
- [x] Fix mode-only nullable counts and suppress test-evidence relationships for pure mode-only changes.
- [x] Correct Rails/Drizzle detector coverage, narrow API-contract matching, and add positive/negative detector QA.
- [x] Remove POSIX-only verification commands and add cross-platform process/filesystem helpers.
- [x] Redesign verification to prove source completeness, run source-first gates, and verify Action bundle freshness.
- [x] Add real linting, substantial parser/security/large-diff/Action/browser-oriented tests, and truthful CI claims.
- [x] Remove unrelated Manus/template code and assets; make the production web build self-contained with repository-owned assets and Pages base support.
- [x] Expand Action and npm package smoke tests, including real Git ranges and adversarial/large inputs.
- [x] Create `SOURCE_MANIFEST.txt`, `EXPORT_VERIFICATION.md`, `AUDIT_HANDOFF_STAGE3A.md`, and `diffbeacon-stage3a-fixed.zip`.
- [x] Extract the ZIP into a new directory and run npm ci, build, tests, verify, and completeness checks against the extracted copy.
- [x] Save the final audit-ready checkpoint without publishing or deploying publicly.

## Stage 3B Execution Checklist

- [x] Read the entire authoritative Stage 3B instruction attachment.
- [x] Freeze and reproduce the confirmed Stage 3A baseline before changes.
- [x] Implement authoritative added/deleted/rename parser state with real temporary Git regressions.
- [x] Implement the Windows-safe trusted npm JavaScript-CLI process helper and tests.
- [x] Remove every Manus/Forge storage dependency and replace decorative artwork without remote assets.
- [x] Verify Pages base-path portability and production static-asset resolution.
- [x] Rebuild and include the fresh Action bundle without general transient build output.
- [x] Synchronize documentation, privacy gates, CI claims, and historical audit wording.
- [x] Expand tests and run source-first, adversarial, build, browser, and package verification.
- [x] Create and verify `diffbeacon-stage3b-release-candidate.zip` from source.
- [x] Save the final release-gate checkpoint without publishing or deploying publicly.

## New authoritative instruction execution checklist

- [x] Read `/home/ubuntu/upload/pasted_content_4.txt` in full and record its acceptance criteria.
- [x] Implement every applicable requirement against the existing DiffBeacon project without regressing Stage 3B hardening.
- [x] Run the required tests, audits, builds, and clean-copy/export checks from the new instruction.
- [x] Update the final artifacts and report, then deliver the requested stop state.

## Stage 3C release-gate checklist

- [x] Preserve Stage 3B parser, security, Action, web privacy, packaging, and archive fixes.
- [x] Add the Windows-native real npm `.cmd` bin-shim smoke boundary without general shell execution.
- [x] Replace locale-sensitive canonical report ordering with explicit code-unit ordering.
- [x] Add Unicode/cross-locale determinism, shim architecture, CLI metadata, and Vite-host regressions.
- [x] Add `engines.node >=22` to the publishable CLI manifest and verify packed metadata.
- [x] Run the complete Stage 3C source-first quality sequence.
- [x] Create and clean-verify `diffbeacon-stage3c-pre-ci.zip`.
- [x] Save the Stage 3C checkpoint and deliver the `READY FOR REAL REMOTE CI` stop state.

## New authoritative instruction execution checklist

- [x] Read `/home/ubuntu/upload/pasted_content_5.txt` in full and record its acceptance criteria.
- [x] Implement every applicable requirement without regressing the completed Stage 3C fixes.
- [x] Run all required tests, audits, builds, and clean-export checks.
- [x] Update the final artifacts and deliver the exact requested stop state.

## New authoritative instruction execution checklist — pasted_content_6

- [x] Read `/home/ubuntu/upload/pasted_content_6.txt` in full and record its acceptance criteria.
- [x] Implement every applicable requirement without regressing the completed Stage 4 fixes.
- [x] Run all required tests, audits, builds, and clean-export checks.
- [x] Update the final artifacts and deliver the exact requested stop state.

## Final submodule-determinism hardening checklist

- [x] Add fixed `--ignore-submodules=none` and `--submodule=short` collector flags while preserving all existing flags and omitting `--binary`.
- [x] Add the real local-submodule configuration regression and narrow security documentation update.
- [x] Run the complete existing quality gate and report its exact test count.
- [x] Create `diffbeacon-final-github-ci-v2.zip`, clean-extract it, run `npm ci` and `npm run check`, and report archive fingerprints.
