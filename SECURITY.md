# Security Policy

DiffBeacon processes developer-controlled diff text and Git metadata. Its security boundary is
intentionally narrow: it analyzes the diff and does not execute the changed repository.

## Supported versions

No version of DiffBeacon is published, so no release is currently supported. Analysis runs only from
source you build yourself, from the commit you checked out; see
[`CHANGELOG.md`](CHANGELOG.md) for the unreleased `0.1.0` candidate. If and when a release exists,
this section will name the versions that receive security work.

## Reporting a vulnerability

Do not open a public issue for a suspected security vulnerability.

**No private reporting channel is configured or verified yet.** This repository has not enabled —
and Stage 10 did not check or change — GitHub's private vulnerability reporting setting, there is no
published security address, and the issue tracker is not a security intake. Treating any of those as
available would be an invented promise. Configuring a real intake (private vulnerability reporting
or a monitored contact, plus a stated response target) is a **release prerequisite** recorded in
[`docs/releasing.md`](docs/releasing.md).

Until that exists, the honest statement is: DiffBeacon cannot acknowledge receipt, cannot promise a
response time, and offers no SLA of any kind. If you already have a direct channel to a maintainer,
use it; include the commit SHA you analyzed, the command or workflow you ran, and the smallest
reproducer you can share. Do not include secrets or data you are not authorized to disclose.

## Invariants

The following are design requirements, not a claim of perfect security:

1. Diff content and file paths are untrusted strings.
2. Revision arguments are rejected until validated and resolved.
3. Git is invoked with argument vectors, never shell interpolation.
4. External diff and text-conversion behavior are disabled where Git supports it.
5. No `eval`, repository hooks, changed-file execution, dependency installation, test execution,
   build execution, or shell sourcing occurs in analysis.
6. Browser rendering treats filenames as text and does not use `dangerouslySetInnerHTML` for
   diff-derived values.
7. Markdown output escapes table-breaking and HTML-looking path content.
8. The default Action model uses `contents: read`, requires no PAT, and does not request
   `pull-requests: write`.
9. No source-code upload service, runtime LLM, telemetry, or analytics path exists in v0.1.

## What this does not make DiffBeacon

DiffBeacon is not a security control, a vulnerability scanner, or a merge gate, and it should not be
placed in a pipeline as if it were one. These invariants narrow the intended attack surface; they do
not prove the absence of vulnerabilities in DiffBeacon, in Git, in the operating system, in the
dependency supply chain, or in a CI environment that runs it. A malformed or adversarial diff is
expected to yield an honest error or a report of what was actually parsed — never a claim about code
DiffBeacon did not see.

[`docs/architecture/security.md`](docs/architecture/security.md) holds the flow-level boundary
diagram, the specific controls, the tests that measure each one, and an explicit list of what those
controls leave open.
