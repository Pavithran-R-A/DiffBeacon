# Security Architecture

DiffBeacon is designed to analyze untrusted change descriptions without executing the changed project. The key distinction is between **reading Git data** and **running repository behavior**. v0.1 does the first and explicitly refuses to do the second.

## Threat surface and controls

| Input                   | Threat                                                                                                                            | Control                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revision/range argument | Shell injection, option confusion, object ambiguity                                                                               | Reject whitespace/control/metacharacters and option-leading tokens; resolve with bounded `git rev-parse --verify --quiet --end-of-options` argv; use `shell: false`                                                                                                                                                                                                                                                                                                                 |
| Diff text               | Parser confusion, resource exhaustion, terminal/Markdown/HTML injection                                                           | Parse line-by-line; never evaluate; browser input cap at 8 MiB; paint-time display policy in `packages/core/src/display.ts` (see "Rendering boundary"); escape Markdown table/HTML characters                                                                                                                                                                                                                                                                                       |
| File path               | Path traversal-looking or markup-looking display text                                                                             | Treat as an opaque label; pass `--` to Git; never use diff paths as filesystem targets; render as text; measured over traversal-, shell-, markup-, and Windows-device-shaped names, of which none is ever opened — the only path the program honours is the operator's own explicit `--output`                                                                                                                                                                                      |
| PR event metadata       | Untrusted SHA/ref injection                                                                                                       | Action accepts only `pull_request`, and only full commit object IDs (40 hexadecimal, or 64 for SHA-256) from `pull_request.base.sha`/`.head.sha`; it runs Git in `GITHUB_WORKSPACE`, never the process' own location                                                                                                                                                                                                                                                                |
| Event JSON shape        | A well-formed but unusable payload leaking an engine error                                                                        | Anything that is not an object is refused with a message naming `GITHUB_EVENT_PATH` and the two fields the Action reads; arrays, strings, numbers, booleans and `null` each fail that check with the same stable message, and a 100,000-level nesting is stopped by the object-ID contract rather than by a depth limit of DiffBeacon's own                                                                                                                                         |
| Job Summary size        | An unbounded append to the one file the Action writes                                                                             | Before appending, the Action compares the UTF-8 size of the addition plus the existing file with the 1,048,576 bytes GitHub gives each step's summary and fails the review without writing a partial report. Passing that limit on the platform fails the summary **upload** and raises an error annotation; it does not by itself change the step's or job's status, so an unbounded append would have left DiffBeacon reporting success beside a review GitHub refused to publish |
| Target repository       | Arbitrary code execution                                                                                                          | No hooks, scripts, test/build commands, changed-file execution, dependency installation, or shell sourcing; measured on both adapters, each "nothing ran" case paired with a live control proving the same fixture does run a program when unprotected                                                                                                                                                                                                                              |
| Git behavior            | Config-dependent patch shape, hidden/expanded submodule diffs, external diff/text-conversion execution, unbounded binary payloads | `--no-ext-diff --no-textconv --no-color --src-prefix=a/ --dst-prefix=b/ --ignore-submodules=none --submodule=short --diff-algorithm=myers --find-renames=50% -l1000 --unified=3`; omit `--binary` because the parser only needs structural binary markers; `core.quotePath` true and false both parse to the same name                                                                                                                                                              |
| GitHub token            | Excessive write capability                                                                                                        | Recommended workflow permission is `contents: read` with `persist-credentials: false`; the Action writes only `$GITHUB_STEP_SUMMARY` and authenticates to nothing                                                                                                                                                                                                                                                                                                                   |
| Source code             | Unwanted upload                                                                                                                   | Browser path is local-only; no backend or telemetry dependency                                                                                                                                                                                                                                                                                                                                                                                                                      |

## From a range to a diff

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

Ambient Git variables are handled by two different policies, because the two callers have different
owners. `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`, `GIT_OBJECT_DIRECTORY` and
`GIT_ALTERNATE_OBJECT_DIRECTORIES` do select which repository Git reads, and a repository-local
`core.worktree` can move the reported root — all measured on Windows Git 2.55.0 and Linux Git 2.39.5,
not assumed.

- **The CLI inherits the operator's environment unchanged.** A developer running `diffbeacon` in their
  own shell owns that environment, and clearing selectors there would hide a misconfiguration without
  removing it: a workflow able to set them is already able to select the code that runs. The CLI keeps
  Git's own inheritance and fails bounded when the environment hides the revision.
- **The Action pins `GITHUB_WORKSPACE` as the repository boundary.** It cannot be treated as
  operator-owned, because the workspace is the thing being reviewed and the pull request does not own
  the runner's environment. Every Git process it starts — the repository-root and revision-resolution
  queries as well as the diff — is handed one rebuilt environment in which the four redirecting
  selectors above are removed and `GIT_WORK_TREE` is set to the workspace, which also outranks a
  repository-local `core.worktree`. Selectors that were measured not to redirect the range diff
  (`GIT_INDEX_FILE`, `GIT_NAMESPACE`) are deliberately kept, and PATH, locale and runtime variables
  pass through: the policy is the measured set, not a `GIT_`-prefix denylist.

`diff.external` and textconv drivers named by repository config, by `GIT_CONFIG_COUNT`, or by the
ambient environment are never reached, because `--no-ext-diff --no-textconv` are part of the pinned
vector; dropping
`--no-ext-diff` was measured to make the matching case fail, and dropping the explicit prefixes does
the same for the four cases that depend on them. No Git command is ever started through a shell, and no
`GIT_PAGER` defence is claimed: a live pager control could not be reproduced on the host this
qualification ran on, so that path is recorded as unproven rather than as covered.

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
execute a program under an unprotected Git command. `tests/stage8.no-target-execution.test.ts`
makes the same measurement of the operator-facing CLI path — a repository whose package lifecycle
scripts, `.npmrc`, external diff driver, hooks path and committed executable mode are all booby
trapped — and records that a review leaves no sentinel, no `node_modules`, no lockfile, an unchanged
manifest, and a clean `git status`, while the `100755` mode still reaches the report as data.

The Action's two other boundaries are the event payload and its single output file. The event JSON
must be an object: `null`, an array, a string, a number, and a boolean each fail with the same stable
message that names `GITHUB_EVENT_PATH` and the two fields read from it, and a deeply nested payload is
rejected by the object-ID contract rather than by a depth limit of DiffBeacon's own. On the output
side, a 30,000-file, 4,703,340-byte diff — inside the 8 MiB input bound — renders 1,958,803 bytes of
Job Summary against GitHub's own 1,048,576-byte limit, so the size is reachable, and the Action now
compares UTF-8 bytes (the addition plus the file already on disk) before appending and fails closed
without writing a partial report. No smaller product limit was invented; the guard is GitHub's number.

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

The core report contains strings but no HTML. The browser renders React text nodes and `<code>`
children, not HTML strings. The Markdown renderer replaces backslashes, pipes, backticks, angle
brackets, and newlines before placing dynamic values into tables or headings.

Control and bidi text is handled by one shared policy, `packages/core/src/display.ts`, applied where
text is painted — never inside the report data. It has three measured classes. Reordering controls
(U+061C, U+200E/U+200F, U+202A-U+202E, U+2066-U+2069) are removed, because they move the reader's
cursor through the rest of the line. Line-shaping controls (a CR/LF pair, tab, the other C0 line
breaks, U+0085, U+2028, U+2029) become one space, because their whole effect is to reshape the line.
Executable controls (the remaining C0 and the C1 range, including ESC) become the surface's own marker,
because a terminal interprets them. Everything else is left alone on purpose: confusables and
homoglyphs are not detected, ordinary Arabic and Hebrew text is not reordered or stripped, and the
zero-width formatters U+200B-U+200D are painted verbatim because they carry meaning in Persian, Arabic,
and Indic names while being unable to move a cursor, execute in a terminal, or reorder a line.

The policy is applied at each human surface's own paint boundary, not once in the parser: the terminal
report (`renderPretty`), the CLI message surface (`packages/cli/src/errors.ts`), the browser demo
(`paintedName` in `client/src/pages/Home.tsx`), and the Markdown report (`renderMarkdown`, which covers
the Changed-files row and an evidence `Observed in:` line). The Markdown surface was the last one still
printing control characters intact; closing it is recorded as C-B in
`docs/audits/stage8-security-hardening.md`. Because Markdown and the terminal encode a neutralised name
differently — Markdown escapes backtick, pipe and backslash for GFM — the two human renderers are held
to the same painted _shape_, and the exact encoding has its own cases.

The data stays factual. `renderJson` and the clipboard export keep the raw value, so a control
character survives to a JSON consumer as an escape rather than being silently rewritten; the same is
true of a path that merely looks like `../`, a shell command, or a Windows device name, none of which
is ever opened. A name with trailing whitespace is the one measured exception: Git's C-quoted header
form is recognised by trimming, so `src/x ` is displayed as `src/x`.

Painting hostile text was measured in real Chromium over the shared corpus, including a name carrying a
U+202E override at 800 characters, where no `<code>` element escapes its own pile and the page's
horizontal overflow stays exactly zero; the containment comes from CSS that already existed, so no
layout change was made for it.

## Outputs, write sinks, and artifacts

Two places in shipped code write anything: the Action appends to `GITHUB_STEP_SUMMARY`, and the CLI
writes to an explicit `--output`. The `--output` target is the operator's own choice and is honoured
verbatim — including a basename a Windows shell reserves, where Node's write API really does create a
file with that name — while a target in a directory that does not exist exits with the CLI's
write-error code and creates nothing. Nothing on the report path reads `.npmrc`, writes Git config,
creates a temporary file, or makes a directory.

A permanent guard scans the four shipped source trees for the APIs none of them has a use for:
`eval(`, `new Function(`, `execSync(`, `shell: true`, and every markup, cookie, storage, and network
sink. It finds zero of each, and the only process starts remain `execFileSync` plus one asynchronous
`spawn` of `git`, both with `shell: false`. After a clean build, the tracked Action bundle and the
built CLI bundle each still carry the eleven pinned diff flags and the pinned revision-resolution
flags (`--verify`, `--quiet`, `--end-of-options`) verbatim, contain no `http(s)` endpoint and no marker
of the machine that built them, and reach no network, package-manager, or shell surface:
`tests/stage6.action-metadata.test.ts:169-196` requires the bundle to mention none of `node:http`,
`node:https`, `node:net`, `node:tls`, `node:dgram`, `fetch(`, `XMLHttpRequest`, `WebSocket`,
`sendBeacon`, `@actions/`, `octokit`, `npm install`, `npm ci`, `shell: true` or `shell:!0`, and then
requires the one process module it does carry to be `node:child_process` — the module the single `git`
start uses.

Report values are data, including the ones that look like instructions. A path is only ever a value in
the JSON, never a key, so a `__proto__`-shaped name cannot reach a prototype, and the canaries that
would have caught a mutation stay unwritten. A seeded fuzz (seed `0x5eed1a11`, 1,500 mutated inputs
built from nine seed diffs and fifteen fragments, in `tests/stage8.fuzz.test.ts:28-74`) holds the
contract across every one: the parser and
the three renderers never throw, every count is finite and a whole non-negative number or an honest
`null` on a binary or mode-only file, no rendered terminal line carries a control character, the same
input always yields the same report, and JSON round-trips unchanged.

A credential scan is a gate, not a report. `npm run secret-scan` reads every path `git ls-files`
reports, skips binary files and anything over its own size bound, and matches eight rules: a private
key, a GitHub fine-grained token, a GitHub token, an npm token, an AWS access-key id, a Slack token, a
credential-bearing URL, and a generic secret assignment. Measured on 2026-09-30 in a clean clone of
this candidate tree, it read every tracked path and reported 12 findings, all classified: an
`AKIA`-shaped marker in
`tests/stage7.browser-security.test.ts` and a placeholder npmrc in
`tests/stage6.action-security-boundary.test.ts`, each present so its own test can prove the program
never uses it, plus ten falsification canaries in `tests/stage9.secret-scan.test.ts` invented so no
rule can silently stop matching. The table of accepted findings is fail-closed in both directions: an
unclassified credential-shaped string stops the gate, and an accepted entry whose file no longer
produces that finding is reported as stale, so a removed canary cannot leave an expired allowance
behind. Output is file, rule, line, digest and length — never the matched value.

## What this does not prove

These controls reduce the intended attack surface but do not constitute a claim of “100% secure.” Git
implementations, operating systems, dependency supply chains, CI configuration, and future adapters
require independent review. The audit should pay particular attention to revision validation, parser
edge cases, Markdown escaping, Action workflow permissions, and package-bundle provenance.

Specifically left open, each for a recorded reason rather than by assumption:

- **The CI that has run is not the CI the published workflow describes.** The recovered-source CI
  workflow used for release qualification has never been allocated a GitHub-hosted runner, so every
  lane in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — including the browser
  contract's `ubuntu-latest` cell — is an unexecuted contract rather than a passing result. Hosted
  execution is not absent from this repository's history: the bootstrap-era workflows did receive
  GitHub-hosted runners and executed setup and checkout steps before failing during archive extraction
  (Actions runs `32859849733`, `31819615124` and `31818807881`). Those runs executed a different
  workflow on different commits, so they are evidence of historical execution and of no product or
  release qualification. What has executed against the recovered source is
  the temporary self-hosted qualification lane: Actions run `36562157439` (2026-09-29, commit
  `b6e884260e84557807fd9fc2867783e3f8756bee`, branch `rescue/stage9-selfhosted-ci`) completed all
  seven jobs green on repository-scoped self-hosted runners — source gates on Linux and Windows at
  Node 24 and Node 22, the real-Chromium browser lane on Windows with Node 24, and both package lanes.
  Those runners were unregistered after the run, so nothing re-executes until Stage 11 supplies an
  environment.
- **The Action pins resolve to tag names, and that is all the lookup shows.**
  `git ls-remote --tags` against the two pinned actions maps the checkout commit
  `3d3c42e5aac5ba805825da76410c181273ba90b1` to `refs/tags/v7` and `refs/tags/v7.0.1`, and the
  setup-node commit `820762786026740c76f36085b0efc47a31fe5020` to `refs/tags/v7` and `refs/tags/v7.0.0`
  (measured 2026-09-30). That confirms each SHA is the commit a release tag points at; it does not
  attest that the tagged build is trustworthy, and verifying release provenance is a Stage 11 step.
- **Dependency advisories are carried, not closed.** Measured 2026-09-30 against the tracked lockfile:
  `npm audit --omit=dev --audit-level=high` reports 0 vulnerabilities and exits 0, because the only
  package marked publishable is the CLI (`diffbeacon@0.1.0`), which declares no runtime dependencies
  while `diffbeacon-core` and `diffbeacon-action` are `private: true`; `npm audit --audit-level=high`
  reports 1 high, `brace-expansion` reached only through development lint tooling
  (`eslint@9.39.5 → minimatch@3.1.5` resolving `1.1.18`, and
  `typescript-eslint@8.70.1 → @typescript-eslint/typescript-estree@8.70.1 → minimatch@10.2.6`
  resolving `5.0.9`) behind `GHSA-6j4f-fj2g-mc7p`, `GHSA-qhr7-859c-m2p7` and `GHSA-q2hr-2g5m-vwhr`, all
  denial-of-service on brace expansion. Neither shipped bundle contains the name, so no published
  artifact can reach it; it is a risk to a contributor's or a CI machine's tooling. Nothing was
  repaired here — `npm audit fix`, `--force`, and a hand-edited lockfile would each need their own
  qualification run. The condition moved by itself: this same lockfile printed
  `found 0 vulnerabilities` on both audit steps of every lane at 11:30Z on 2026-09-29, and the three
  advisories published at 21:33Z the same day, so the next run of either workflow fails its
  development-tree audit step with no change in this repository. It is handed to Stage 11 as a
  prerequisite in [`docs/releasing.md`](../releasing.md).
- **Cross-platform evidence exists only where something actually ran.** A filename whose bytes are not
  valid UTF-8 can only be created on a POSIX filesystem, so the real-Git half of
  `tests/stage8.invalid-byte-paths.test.ts` is gated to that platform; it ran and passed on the
  self-hosted Linux lanes of run `36562157439`, and on Windows it prints a recorded skip reason rather
  than typing in the answer. The Windows-only npm bin-shim case in `tests/stage3c.release.test.ts` is
  skipped on Linux on the same principle. Painting hostile names in a real browser was measured on
  self-hosted Windows; the hosted Linux browser cell has never been measured anywhere.
- **A fuzz corpus is not an absence proof.** The seeded 1,500 inputs guard the contract that was
  written down; they say nothing about inputs outside it.
- **DiffBeacon does not decide whether a pull request is safe to merge**, and none of these controls
  make it a code reviewer, a vulnerability scanner, or a risk model.
