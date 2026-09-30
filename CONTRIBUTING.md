# Contributing to DiffBeacon

DiffBeacon is a deterministic review-attention engine. Contributions should improve clarity,
evidence discipline, portability, or contributor experience without turning the project into an AI
reviewer or merge gate.

## Before opening a change

Read [`README.md`](README.md), [`AGENTS.md`](AGENTS.md), [`SECURITY.md`](SECURITY.md), and the
relevant architecture document. For detector work, read
[`docs/detectors/authoring-detectors.md`](docs/detectors/authoring-detectors.md). Keep
`packages/core` independent of Node filesystem APIs, child processes, Git, React, GitHub APIs,
terminal formatting, and network access — that boundary is enforced by a permanent scan inside
`npm run verify`, not by convention.

## Environment

`engines.node` is `">=22"`, which is a floor, not a tested matrix: every gate in this workspace has
been run green on **Node 22.x and Node 24.x**, on Windows and on Linux, and on nothing else. `.nvmrc`
pins 22. `npm ci` requires npm 10 or newer, and the tests shell out to real Git, so a working `git`
on `PATH` is required.

## Required quality gates

```bash
npm ci
npm run check
```

`npm run check` is an alias for `npm run verify`, which runs, in order: the source-completeness and
no-obsolete-surface checks, `format:check`, `lint`, `typecheck`, `test`, `build`, the artifact
checks, `secret-scan`, the `SOURCE_MANIFEST.txt` drift check, the CLI `--version`/`--help` startup
probe, `package-smoke`, and `action-smoke`. A single gate failing fails the command.

## Which extra work your change owes

| Change                                             | What to run                                                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core, renderer, ordering, or other source behavior | `npm run test:source` while iterating, then the full `npm run check`.                                                                                                                                                           |
| CLI behavior or packaging                          | `npm run package-smoke` (it packs a real tarball and installs it into a throwaway project), then `npm run check`.                                                                                                               |
| Action source (`packages/action/src`)              | `npm run build:action`, commit the regenerated `packages/action/dist/index.js`, then `npm run action-smoke` and `npm run check`. A rebuild must be a no-op: CI asserts `git diff --exit-code -- packages/action/dist/index.js`. |
| Browser demo (`client/`)                           | `npm run build:web` plus `npm run test:browser`, which drives a real Chromium-class engine.                                                                                                                                     |
| Detector additions or matcher changes              | Positive **and** negative fixtures, a false-positive regression, rename behavior, unknown-path behavior, and a documentation update — see the authoring guide.                                                                  |
| Documentation only                                 | `npm run check` anyway: several committed tests read this prose and quote the CLI output.                                                                                                                                       |
| Adding, removing, or renaming any tracked file     | `npm run manifest`, then commit `SOURCE_MANIFEST.txt` in the same change. `npm run verify` fails on drift and never rewrites the tree.                                                                                          |

Browser suites skip with a printed reason when no engine is installed. Two flags make the intent
explicit: `DIFFBEACON_SKIP_BROWSER=1` keeps the Chromium cases out of a run that is there for other
reasons, and `DIFFBEACON_REQUIRE_BROWSER=1` fails the lane instead of skipping when no engine is
found. Setting both is rejected. The Chromium files share one serialized slot, so the lane takes
minutes per file rather than seconds; budget for it instead of raising its timeouts.

## What CI will and will not do for you

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) is the intended contract and targets
GitHub-hosted runners — **which this repository's account has never been allocated**, so a push or
pull request may show no runs at all. Do not read an absent run as a pass, and do not add a
workaround that executes pull-request code from a fork to get one. The only CI that has actually
executed here was a temporary, explicitly authorized self-hosted qualification lane (run
`36562157439`, recorded in
[`docs/audits/stage9-ci-package-qualification.md`](docs/audits/stage9-ci-package-qualification.md));
those runners are unregistered. Local gates are therefore the real contract for a contribution.

## Security expectations

Never execute code from an analyzed repository. Never interpolate revisions into a shell string.
Never add a remote upload path for source code. Never introduce LLM calls, risk percentages,
merge-confidence labels, or write permissions for the v0.1 Action. Never add a workflow triggered by
`pull_request_target`, and never commit a token, registration token, or OTP anywhere in the tree —
`npm run secret-scan` is a gate, not a formality.

## Commit and review style

Use focused commits and explain behavior changes in the pull request description. Include the exact
commands you ran and their real results, and name the platform and Node version you ran them on. Do
not claim tests passed without running them, and do not restate a number from an earlier stage report
as if you had measured it.
