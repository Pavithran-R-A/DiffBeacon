# DiffBeacon Stage 3B Before-Fixes Baseline

## Authoritative starting point

Stage 3B begins from the confirmed Stage 3A source repository at commit `12b2a35e85944f0186d6189f8fc221c2ec46a8fc`. The Stage 3A checkpoint and source-only archive were not rebuilt from scratch. The Stage 3A baseline had 18 passing tests, a source-first `npm run verify` gate, a secure Node 24 Action bundle, and the parser/security/detector fixes listed in `AUDIT_HANDOFF_STAGE3A.md`.

The only pre-implementation working-tree change for Stage 3B was the execution checklist in `todo.md`. The managed preview had required the Stage 3A artwork to be moved temporarily to managed storage; that temporary architecture is itself a Stage 3B release blocker and is recorded below rather than treated as an accepted final design.

## Findings reproduced or confirmed before fixes

The recovered source confirmed that the parser still inferred added/deleted state primarily from `/dev/null` content headers. Real Git can emit empty-file add/delete changes with only `new file mode` or `deleted file mode`, and Git binary patches use `GIT binary patch`; these cases require authoritative extended-header state. Rename metadata also existed as a separate fact but content changes were normalized as `modified`, which contradicts the required `renamed` status.

The project-owned npm invocations still needed a trusted JavaScript-CLI process helper rather than direct `npm.cmd` execution. The configured CI matrix contained Ubuntu and Windows with Node 22 and 24, but no remote Windows/Ubuntu execution was performed in this sandbox, so Stage 3B must report remote execution as pending rather than claim a pass.

The current browser source and Vite configuration still contained `/manus-storage/...`, `manus-storage-proxy`, and Forge environment names. These are not acceptable in the final public static demo. The final fix must replace the decorative imagery with CSS-only motifs or small repository-owned assets, remove the proxy and all Forge references, and prove the production `dist` tree contains no such strings or unresolved artwork URLs.

The current Pages workflow had repository-base support but required explicit verification of `BASE_PATH=/<repository>/` and a sensible local default. The release-candidate export also needed to include a freshly rebuilt `packages/action/dist/index.js` while excluding general web/CLI build output, `.manus`, temporary repositories, scratch files, logs, secrets, and dependencies.

The Stage 3A documentation and export record needed synchronization with Stage 3B’s final architecture, including the 8 MiB input boundary, real ESLint versus strict TypeScript commands, esbuild rather than `@vercel/ncc`, current checkout guidance, historical labeling for prior managed-storage findings, and the explicit remote-CI status.

## Baseline evidence

The Stage 3A release archive SHA-256 was `8c75ec2b827df817f39de7db86f3a9e25ca6e434a1f3c9429e8a8c6e0866affe`. It was a source-first archive and intentionally did not include the Action bundle; Stage 3B must create a distinct release-candidate archive that does. The baseline test count was 18 tests across four test files. No public repository, release, npm publish, Pages deployment, or Marketplace action was created.

## Stage 3B acceptance boundary

Stage 3B is complete only when real temporary Git repositories cover empty add/delete, text add/delete, binary add/delete/modify, rename-only, rename-with-content, binary rename, and Unicode rename; the npm helper is statically and behaviorally tested without unsafe shells; the browser production build is independent of Manus/Forge infrastructure; the Action bundle is fresh and present in the release candidate; a clean extracted copy passes `npm ci` and `npm run check`; and the final report ends with **READY FOR FINAL INDEPENDENT RELEASE GATE** without claiming remote CI execution that did not occur.
