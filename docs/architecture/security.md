# Security Architecture

DiffBeacon is designed to analyze untrusted change descriptions without executing the changed project. The key distinction is between **reading Git data** and **running repository behavior**. v0.1 does the first and explicitly refuses to do the second.

## Threat surface and controls

| Input                   | Threat                                                                                                                            | Control                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Revision/range argument | Shell injection, option confusion, object ambiguity                                                                               | Reject whitespace/control/metacharacters and option-leading tokens; resolve with bounded `git rev-parse --verify --quiet --end-of-options` argv; use `shell: false`                                                            |
| Diff text               | Parser confusion, resource exhaustion, terminal/Markdown/HTML injection                                                           | Parse line-by-line; never evaluate; browser input cap at 8 MiB; sanitize terminal controls; escape Markdown table/HTML characters                                                                                              |
| File path               | Path traversal-looking or markup-looking display text                                                                             | Treat as an opaque label; pass `--` to Git; never use diff paths as filesystem targets; render as text                                                                                                                         |
| PR event metadata       | Untrusted SHA/ref injection                                                                                                       | Action accepts only 7–64 hexadecimal commit SHAs from the event payload                                                                                                                                                        |
| Target repository       | Arbitrary code execution                                                                                                          | No hooks, scripts, test/build commands, changed-file execution, dependency installation, or shell sourcing                                                                                                                     |
| Git behavior            | Config-dependent patch shape, hidden/expanded submodule diffs, external diff/text-conversion execution, unbounded binary payloads | `--default-prefix --ignore-submodules=none --submodule=short --diff-algorithm=myers --find-renames=50% -l1000 --no-ext-diff --no-textconv --no-color`; omit `--binary` because the parser only needs structural binary markers |
| GitHub token            | Excessive write capability                                                                                                        | Example permissions are `contents: read`; no comments or repository mutation                                                                                                                                                   |
| Source code             | Unwanted upload                                                                                                                   | Browser path is local-only; no backend or telemetry dependency                                                                                                                                                                 |

## Safe Git flow

```text
user range
   │
   ├─ reject control chars, whitespace, metacharacters, and option-leading tokens
   │
   ├─ split only into validated revision tokens
   │
   ├─ git rev-parse --verify --quiet --end-of-options TOKEN^{commit}
   │
   └─ git diff --default-prefix --ignore-submodules=none --submodule=short \
              --diff-algorithm=myers --find-renames=50% -l1000 \
              --no-ext-diff --no-textconv --no-color --unified=3 RANGE --
```

The CLI and Action never construct `exec('git diff ' + userInput)`. Small repository-root and revision-resolution metadata queries use bounded argument-vector execution; the actual diff uses a bounded asynchronous `spawn` stream. Both boundaries use `shell: false`, and diff collection explicitly owns prefixes, submodule handling (`--ignore-submodules=none --submodule=short`), the Myers algorithm, a 50% rename threshold, and a bounded rename limit of 1000. Submodule pointer changes are therefore collected in fixed short form and cannot be hidden or expanded by repository Git configuration. `--binary` is intentionally omitted: ordinary `Binary files ... differ` markers preserve classification without emitting `GIT binary patch` payloads. The Action uses trusted event SHAs and the same vectorized `git diff` invocation. It does not use `pull_request_target` or a privileged checkout of untrusted code.

## Rendering boundary

The core report contains strings but no HTML. The browser renders React text nodes and `<code>` children, not HTML strings. The Markdown renderer replaces backslashes, pipes, backticks, angle brackets, and newlines before placing dynamic values into tables or headings. The pretty renderer removes control characters before printing path and evidence text.

## What this does not prove

These controls reduce the intended attack surface but do not constitute a claim of “100% secure.” Git implementations, operating systems, dependency supply chains, CI configuration, and future adapters require independent review. The audit should pay particular attention to revision validation, parser edge cases, Markdown escaping, Action workflow permissions, and package-bundle provenance.
