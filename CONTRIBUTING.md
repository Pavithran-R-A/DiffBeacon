# Contributing to DiffBeacon

DiffBeacon is a deterministic review-attention engine. Contributions should improve clarity, evidence discipline, portability, or contributor experience without turning the project into an AI reviewer or merge gate.

## Before opening a change

Read the README, `AGENTS.md`, `SECURITY.md`, and the relevant architecture document. For detector work, read [`docs/detectors/authoring-detectors.md`](docs/detectors/authoring-detectors.md). Keep the core independent of Node filesystem APIs, child processes, Git, React, GitHub APIs, terminal formatting, and network access.

## Required quality gates

Run:

```bash
npm ci
npm run check
```

If changing the Action, run `npm run build:action` and `npm run action-smoke`. If changing the CLI packaging, run `npm run package-smoke`. Do not delete a failing test because an implementation is inconvenient; fix the behavior or demonstrate why the test is incorrect.

## Detector changes

Every detector needs a stable ID, a focused matcher, positive and negative tests, and an update to the detector documentation when its heuristics change. Use conservative language: a path match means “this surface changed,” not “this change is risky.”

## Security expectations

Never execute code from an analyzed repository. Never interpolate revisions into a shell string. Never add a remote upload path for source code. Never introduce LLM calls, risk percentages, merge-confidence labels, or write permissions for the v0.1 Action.

## Commit and review style

Use focused commits and explain behavior changes in the pull request description. Include the commands you actually ran and their results. Do not claim tests passed without running them.
