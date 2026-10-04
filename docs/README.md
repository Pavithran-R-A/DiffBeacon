# Documentation Index

Every file here is one of two kinds, and the distinction matters more than the directory
layout:

- **Current documentation** describes how the code behaves _today_. Each statement is
  supported by the source, a committed test, or a measurement recorded with the commit and
  date it was taken. When support goes stale, the sentence is narrowed or deleted — a
  current-sounding file that no longer matches the implementation is a defect.
- **Historical evidence** records what a specific pass found at a specific commit. It is
  preserved as written, with a banner saying what it is. It is not project status, and it is
  not rewritten to make the repository look tidier.

## Current documentation

| Path                                                                                         | What it states                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`architecture/overview.md`](architecture/overview.md)                                       | How the product works: the pure core, the three adapters, classification, review ordering, parser diagnostics, and the display boundary.                                                                                                                                                                                        |
| [`architecture/security.md`](architecture/security.md)                                       | Each trust boundary and the code or committed test that enforces it, plus an explicit list of what the existing evidence does not prove.                                                                                                                                                                                        |
| [`detectors/initial-detectors.md`](detectors/initial-detectors.md)                           | The eleven shipped surfaces — matcher, what a match proves, examples, and what each detector deliberately misses.                                                                                                                                                                                                               |
| [`detectors/authoring-detectors.md`](detectors/authoring-detectors.md)                       | The checklist a new detector must satisfy before it is merged, and the limits on what a surface may claim.                                                                                                                                                                                                                      |
| [`limitations.md`](limitations.md)                                                           | The scope statement: what a surface may claim, what a diff cannot show, patch-format boundaries, per-adapter edges, and what has not been measured.                                                                                                                                                                             |
| [`releasing.md`](releasing.md)                                                               | The Stage 11 operator runbook. Its section 1 has been exercised against the release candidate (step 6's matrix on GitHub-hosted runners), and §7 of the Stage 11 audit maps each step to the commit and measurement that covers it; step 8 and **sections 2 through 7 have not, and nothing in the file authorises a release.** |
| [`examples/attention-map-sample.diff`](examples/attention-map-sample.diff)                   | The exact diff whose measured CLI output appears in the root README.                                                                                                                                                                                                                                                            |
| [`examples/diffbeacon-pull-request-review.yml`](examples/diffbeacon-pull-request-review.yml) | The intended future consumer workflow form. It sits outside `.github/workflows/` on purpose, is not executed by GitHub, and carries a placeholder Action SHA until Stage 11 publishes a reviewed pin.                                                                                                                           |

## Historical evidence — read as records, not status

| Path                                                             | What it is                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audits/`                                                        | One authoritative qualification report per stage, each naming the commit, environment, and commands it measured. These reports, not marketing prose, are the evidence behind a claim of qualification.         |
| `audits/legacy/`                                                 | Superseded handoffs, working checklists, and an export verification. Moved here by Git rename with content unchanged and a HISTORICAL banner added.                                                            |
| [`recovery/README.md`](recovery/README.md)                       | Forensic records of the quarantined bootstrap workflows, byte-for-byte copies of blobs that were on `main`. They are not executable workflows and live outside `.github/workflows/` so GitHub cannot run them. |
| [`research/design-brainstorm.md`](research/design-brainstorm.md) | Pre-implementation exploration that chose the browser demo's visual language. Its subjective rankings are not output of any kind.                                                                              |
| [`research/validation.md`](research/validation.md)               | Dated (2026-08-12) pre-implementation research used to make v0.1 decisions. Research findings, not current external facts.                                                                                     |

## Reading order

New to the project: [`../README.md`](../README.md) →
[`architecture/overview.md`](architecture/overview.md) →
[`detectors/initial-detectors.md`](detectors/initial-detectors.md) →
[`limitations.md`](limitations.md).

Changing behavior: [`../CONTRIBUTING.md`](../CONTRIBUTING.md) →
[`detectors/authoring-detectors.md`](detectors/authoring-detectors.md) →
[`architecture/security.md`](architecture/security.md).

Reviewing trust: [`../SECURITY.md`](../SECURITY.md) →
[`architecture/security.md`](architecture/security.md) →
[`audits/stage8-security-hardening.md`](audits/stage8-security-hardening.md).

## How these files stay honest

Committed tests bind documentation prose to implementation, so a doc cannot drift silently:
`tests/stage6.action-workflow-docs.test.ts` pins the security boundary wording and the
example workflow's provenance notes, `tests/stage4.order-language.test.ts` pins the ordering
language, `tests/stage5.cli-arguments.test.ts` and `tests/stage5.cli-formats.test.ts` pin the
CLI contract the README shows, and `tests/stage10.docs-contract.test.ts` binds the detector
list, the README's measured example, and the boundary between current docs and historical
records.
