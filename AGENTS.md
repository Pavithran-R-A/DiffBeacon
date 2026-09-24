# AGENTS.md

This repository is DiffBeacon, deterministic review-attention infrastructure. Coding agents must preserve the following boundaries.

## Non-negotiable rules

- Never execute code belonging to the analyzed target repository.
- Never install dependencies from the analyzed repository.
- Never run its tests, builds, hooks, scripts, or executables.
- Preserve deterministic analysis; do not add runtime LLM calls, network calls, or nondeterministic timestamps.
- Treat observation as observation, not judgment. Do not introduce risk/safety percentages, merge confidence, or “safe to merge” language.
- Detectors require positive and negative tests.
- Update documentation when detector behavior, schema, or security behavior changes.
- Run the meaningful local quality gates before claiming completion.
- Never fabricate test results, package availability, adoption, users, contributors, or review outcomes.
- Do not publish or release without explicit maintainer authorization.

## Core boundaries

`packages/core` must run in Node and the browser without filesystem, child-process, Git, GitHub, React, terminal, or network dependencies. CLI Git calls must use fixed argument arrays and validation. The web demo must keep pasted diff data local and render hostile paths as text.

## Audit discipline

When reporting progress, distinguish implemented code from executed verification. Record unresolved uncertainty in `AUDIT_HANDOFF.md` rather than hiding it.
