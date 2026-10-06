# Security Policy

DiffBeacon processes developer-controlled diff text and Git metadata. Its security boundary is
intentionally narrow: it analyzes the diff and does not execute the changed repository.

## Supported versions

The published surface is `diffbeacon@0.1.0`, released on 2026-10-06, together with the annotated
`v0.1.0` tag at commit `5a50b52028ead78942ea3fc3bee93ba26e0a79cc` and the Action bundle checked out at
that commit. Those three references are what "a supported version" means here.

Security work is assessed against the latest published release — the version
`npm view diffbeacon version` reports when you read this — and a fix ships as a new release instead of
rewriting the immutable `v0.1.0` tag, package, or history. No response time, no disclosure timeline,
no fix window, and no support period for older releases is promised: this is a single-maintainer
open-source project at `0.1.0`. Analysis you build from source yourself is analysis of the commit you
checked out; it is not a supported release. See [`CHANGELOG.md`](CHANGELOG.md) for what has shipped.

## Reporting a vulnerability

**Please do not disclose a suspected vulnerability in a public issue, discussion, pull request, or
commit.** Public space is not a security intake for this project.

Report it privately instead, through GitHub's private vulnerability reporting, which is enabled for
this repository. Verified on 2026-10-04, after the repository became public:
`GET /repos/Pavithran-R-A/DiffBeacon/private-vulnerability-reporting` answers `{"enabled":true}`,
and the public [security page](https://github.com/Pavithran-R-A/DiffBeacon/security) renders the
report form. Use it directly:
[Report a vulnerability](https://github.com/Pavithran-R-A/DiffBeacon/security/advisories/new). The
report is visible only to you and the repository's maintainers; it becomes public only if and when
an advisory is published from it.

DiffBeacon publishes no security email address, and this file is not going to invent one.

We cannot acknowledge receipt and we set no response target: there is **no SLA of any kind** for
this project. If you already have a direct channel to a maintainer, you may use it as well; either
way, please include the commit SHA you analyzed, the command or workflow you ran, and the smallest
reproducer you are authorized to share. Do not include secrets or data you are not authorized to
disclose.

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
