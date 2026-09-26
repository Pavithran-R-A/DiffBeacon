# Security Architecture

DiffBeacon is designed to analyze untrusted change descriptions without executing the changed project. The key distinction is between **reading Git data** and **running repository behavior**. v0.1 does the first and explicitly refuses to do the second.

## Threat surface and controls

| Input                   | Threat                                                                                                                            | Control                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revision/range argument | Shell injection, option confusion, object ambiguity                                                                               | Reject whitespace/control/metacharacters and option-leading tokens; resolve with bounded `git rev-parse --verify --quiet --end-of-options` argv; use `shell: false`                                                                                       |
| Diff text               | Parser confusion, resource exhaustion, terminal/Markdown/HTML injection                                                           | Parse line-by-line; never evaluate; browser input cap at 8 MiB; sanitize terminal controls; escape Markdown table/HTML characters                                                                                                                         |
| File path               | Path traversal-looking or markup-looking display text                                                                             | Treat as an opaque label; pass `--` to Git; never use diff paths as filesystem targets; render as text                                                                                                                                                    |
| PR event metadata       | Untrusted SHA/ref injection                                                                                                       | Action accepts only `pull_request`, and only full commit object IDs (40 hexadecimal, or 64 for SHA-256) from `pull_request.base.sha`/`.head.sha`; it runs Git in `GITHUB_WORKSPACE`, never the process' own location                                      |
| Target repository       | Arbitrary code execution                                                                                                          | No hooks, scripts, test/build commands, changed-file execution, dependency installation, or shell sourcing                                                                                                                                                |
| Git behavior            | Config-dependent patch shape, hidden/expanded submodule diffs, external diff/text-conversion execution, unbounded binary payloads | `--no-ext-diff --no-textconv --no-color --src-prefix=a/ --dst-prefix=b/ --ignore-submodules=none --submodule=short --diff-algorithm=myers --find-renames=50% -l1000 --unified=3`; omit `--binary` because the parser only needs structural binary markers |
| GitHub token            | Excessive write capability                                                                                                        | Recommended workflow permission is `contents: read` with `persist-credentials: false`; the Action writes only `$GITHUB_STEP_SUMMARY` and authenticates to nothing                                                                                         |
| Source code             | Unwanted upload                                                                                                                   | Browser path is local-only; no backend or telemetry dependency                                                                                                                                                                                            |

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
   └─ git diff --no-ext-diff --no-textconv --no-color \
              --src-prefix=a/ --dst-prefix=b/ \
              --ignore-submodules=none --submodule=short \
              --diff-algorithm=myers --find-renames=50% -l1000 \
              --unified=3 RANGE --
```

The CLI and Action never construct `exec('git diff ' + userInput)`. Small repository-root and revision-resolution metadata queries use bounded argument-vector execution; the actual diff uses a bounded asynchronous `spawn` stream. Both boundaries use `shell: false`, and diff collection explicitly owns prefixes (`--src-prefix=a/ --dst-prefix=b/`), submodule handling (`--ignore-submodules=none --submodule=short`), the Myers algorithm, a 50% rename threshold, and a bounded rename limit of 1000. Submodule pointer changes are therefore collected in fixed short form and cannot be hidden or expanded by repository Git configuration. Command-line prefixes take precedence over `diff.noprefix`, `diff.srcPrefix`, `diff.dstPrefix`, and `diff.mnemonicPrefix`, and are used instead of `--default-prefix` because that option is not available on older still-common Git releases that the explicit pair supports. `--binary` is intentionally omitted: ordinary `Binary files ... differ` markers preserve classification without emitting `GIT binary patch` payloads. The Action uses trusted event SHAs and the same vectorized `git diff` invocation. It does not use `pull_request_target` or a privileged checkout of untrusted code.

## Action trust domains

The Action separates two things a careless workflow merges:

- **the code that runs** — the bundle named by `action.yml`'s `runs.main`, resolved from the
  workflow's own trusted checkout of DiffBeacon;
- **the data it reads** — the reviewed repository at `GITHUB_WORKSPACE`, plus the event JSON at
  `GITHUB_EVENT_PATH`.

Only the first is ever started. `GITHUB_WORKSPACE` is required and is the sole directory Git
runs in, so the Action cannot be redirected by the process' working directory; the diff
vectors above are pinned, and `--no-ext-diff --no-textconv` mean repository-configured diff
drivers cannot name a program.
`tests/stage6.action-security-boundary.test.ts` exercises this against a repository whose
package lifecycle scripts, `.npmrc`, Git hooks, external diff, textconv driver, executable
files, and pull-request-authored `action.yml` and Action bundle each write a sentinel when
run, and pairs every "nothing ran" assertion with a live control proving the same fixture does
execute a program under an unprotected Git command.

Because a runner takes its entrypoint from the checked-out tree, `uses: ./` under
`on: pull_request` makes the reviewed change the one that selects the code that runs — the
bundle's own event guard cannot help, since it is inside the bundle being replaced. The reason
that form is refused is untrusted code execution, not a claim about credentials: GitHub normally
restricts a fork pull request's `GITHUB_TOKEN` to read-only and withholds secrets, and repository
settings can change the details, so no universal statement is made about any one pull request's
token privileges. DiffBeacon's boundary is the stricter one — the repository under review must
never choose or run the reviewer. That form is limited to trusted development on this repository's
own branches; consumers are directed to an independently referenced, reviewed commit SHA, which
does not exist until the Stage 11 release. `pull_request_target` runs the base branch's workflow in
the base repository's context, where the default checkout is the base branch rather than the pull
request, and it can carry more trust than an ordinary fork event; the hazard is a workflow that
then checks out or executes the pull request's code inside that context, which DiffBeacon neither
needs nor offers, so the event gate refuses the trigger rather than treating it as a workaround,
and the Job Summary is the Action's only output.

## Rendering boundary

The core report contains strings but no HTML. The browser renders React text nodes and `<code>` children, not HTML strings. The Markdown renderer replaces backslashes, pipes, backticks, angle brackets, and newlines before placing dynamic values into tables or headings. The pretty renderer removes control characters before printing path and evidence text.

## What this does not prove

These controls reduce the intended attack surface but do not constitute a claim of “100% secure.” Git implementations, operating systems, dependency supply chains, CI configuration, and future adapters require independent review. The audit should pay particular attention to revision validation, parser edge cases, Markdown escaping, Action workflow permissions, and package-bundle provenance.
