# Security Policy

DiffBeacon processes developer-controlled diff text and Git metadata. Its security boundary is intentionally narrow: it analyzes the diff and does not execute the changed repository.

## Reporting a vulnerability

Do not open a public issue for a suspected security vulnerability. Contact the maintainers through the private channel configured for the eventual public repository. This unpublished workspace does not yet advertise a public security contact or guarantee a response-time SLA.

## Invariants

The following are design requirements, not a claim of perfect security:

1. Diff content and file paths are untrusted strings.
2. Revision arguments are rejected until validated and resolved.
3. Git is invoked with argument vectors, never shell interpolation.
4. External diff and text-conversion behavior are disabled where Git supports it.
5. No `eval`, repository hooks, changed-file execution, dependency installation, test execution, build execution, or shell sourcing occurs in analysis.
6. Browser rendering treats filenames as text and does not use `dangerouslySetInnerHTML` for diff-derived values.
7. Markdown output escapes table-breaking and HTML-looking path content.
8. The default Action model uses `contents: read`, requires no PAT, and does not request `pull-requests: write`.
9. No source-code upload service, runtime LLM, telemetry, or analytics path exists in v0.1.

See [`docs/architecture/security.md`](docs/architecture/security.md) for the flow-level explanation and test locations.
