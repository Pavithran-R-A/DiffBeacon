# Stage 3A Before-Fixes Baseline

## Source recovery

The complete original source repository survived at `/home/ubuntu/diffbeacon`. It is the authoritative source for this Stage 3A pass; no bundled-output reconstruction was required. The repository was on branch `main` at HEAD `812f6f5ac9d64402c1b3d53d8f0cfa3749fa78aa` before Stage 3A implementation changes. The only pre-fix working-tree change introduced for this stage was the required execution checklist at `todo.md`.

## Baseline repository state

The recovered source tree contained the DiffBeacon workspaces under `packages/core`, `packages/cli`, and `packages/action`, the static React/Vite application under `client`, build and verification scripts under `scripts`, the initial test suite under `tests`, the GitHub workflow, documentation, and the earlier audit handoff. It also still contained the static-template compatibility surface, including `server/`, `shared/`, `template.json`, `components.json`, `pnpm-workspace.yaml`, `patches/`, the unused shadcn component set, a Google Maps component, and Manus-managed preview files.

The root package exposed `build`, `verify`, `lint`, `typecheck`, `test`, `package-smoke`, and `action-smoke` scripts. Baseline test execution reported 4 test files and 15 tests passing. Baseline `npm run build` and `npm run verify` both returned exit code 0 in the recovered workspace, although the build emitted unresolved `/manus-storage/...` asset warnings and Tailwind/Lightning CSS at-rule warnings. This confirmed the specific Stage 3A concern: stale/prebuilt artifacts could make verification appear healthy even when a ZIP omitted source infrastructure.

## Defects observed before fixes

The parser source showed a metadata parser that continued to interpret `--- ` and `+++ ` lines after entering a hunk, so SQL/YAML/Markdown/shell content beginning with those prefixes could mutate file metadata. The same parser used `lastIndexOf(' b/')` for unquoted `diff --git` pairs, which is ambiguous for paths containing the literal substring ` b/`. Binary files were assigned `status: "binary"`, conflating binary state with added/deleted/modified/renamed status. Mode-only files reported numeric zero line counts rather than unknown counts.

The CLI and Action source used synchronous child-process collection without a controlled diff-size limit, so the reported >1 MiB `ENOBUFS` class was not prevented by design. The package smoke script used a POSIX `mkdir -p` subprocess, which was a concrete Windows portability defect. The Markdown renderer and detector surface were only covered by the original 15 tests and required the broader adversarial fixtures specified by Stage 3A.

The web build preserved `/manus-storage/...` asset references and the scaffold analytics/debug-collector surface. The production app therefore did not meet the Stage 3A self-contained static-build and local-privacy requirements. The existing CI file was present in the recovered source but needed to verify the complete source-first gate, including bundle freshness, packaging, and web checks, without claiming remote execution.

## Reproduction status at freeze

The source recovery, baseline test count, clean build/verify result, parser-state defect, ambiguous binary-path split, binary/status conflation, mode-only zero-count semantics, POSIX verification command, and Manus asset references were confirmed before edits. Large-diff, real Git binary-path, Unicode/octal, Markdown hostile-filename, and full browser/network reproductions were queued for the Stage 3A harness and were not claimed as already passed at this freeze point.

## Freeze commands

The freeze used `pwd`, `git status --short`, `git rev-parse HEAD`, a filtered source tree listing, package/workspace metadata inspection, `npm test -- --reporter=dot`, `npm run build`, and `npm run verify`. Their outputs are preserved in the terminal session record for this task; the exact post-fix evidence is recorded in `AUDIT_HANDOFF_STAGE3A.md` and `EXPORT_VERIFICATION.md`.
