# DIFFBEACON STAGE 6 — GITHUB ACTION REPORT

```text
STATUS:                  PASS (local Action qualification; hosted E2E remains UNQUALIFIED)

STARTING SHA:            7152152fb2356dac6556bc1afb31d7175eafaf86  (rescue/stage0-source tip at start)
QUALIFIED PRODUCT SHA:   1287514c18bd4615d4c2ee6583e3cfd26e4b4aaa  (all four cells run this commit)
ENDING BRANCH SHA:       this document's commit, 'docs: record DiffBeacon Stage 6 Action qualification'
BRANCH:                  rescue/stage0-source
ORIGIN MAIN SHA:         e0ff98143bfe39c80c338518d006525a846a8739  (unchanged; not merged, not moved)
```

PRODUCT COMMITS, in the order they were made:

| SHA                                        | subject                                                           | why it is a separate commit                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `c56ac10f348ad5ee68c0bb56b958f9b05ea5e6b8` | `fix: qualify DiffBeacon GitHub Action`                           | the Stage-6 contract work: event/SHA/workspace/summary gates, metadata-driven smoke, workflow example, documentation corrections |
| `eb6614180b161a6159ac0da3960682353cf5eddb` | `test: make the Stage 6 mode-only fixture survive Linux staging`  | a clean-clone Linux cell proved the fixture produced no mode change at all on Linux; found by measurement, not by inspection     |
| `1287514c18bd4615d4c2ee6583e3cfd26e4b4aaa` | `test: give the Stage 5 real-Git suite a measured Windows budget` | a clean-clone Windows cell proved the 20 s per-test budget was exceeded under nested bundle verification; no assertion changed   |

Nothing was folded into the report commit. `git merge-base --is-ancestor` was re-checked at the
start so Stage 5 (`7152152`) is present in history.

## Identity gate

Verified before any edit: `git remote get-url origin` →
`https://github.com/Pavithran-R-A/DiffBeacon.git`, `git branch --show-current` →
`rescue/stage0-source`, `git rev-parse HEAD` → `7152152f…`, `origin/main` → `e0ff9814…`.
Baseline measured before edits: 33 test files / 660 tests, `SOURCE_MANIFEST.txt` at 115 entries,
the starting Action bundle `c17dc9e6…` (45 494 bytes), and the previously inspected hosted
Actions run `36234342955` already recorded as `EXTERNAL CI BLOCKED`. Nothing differed from the
expected starting state.

## ACTION METADATA

`action.yml` is the whole interface, and `tests/stage6.action-metadata.test.ts` (22 tests) plus
`scripts/action-metadata.mjs` parse it and assert these values instead of duplicating them:

| field                    | value                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| `name`                   | `DiffBeacon`                                                       |
| `description`            | `Map review attention from observable pull-request diff evidence.` |
| `author`                 | `DiffBeacon maintainers`                                           |
| `branding`               | `color: orange`, `icon: eye`                                       |
| `runs.using`             | `node24`                                                           |
| `runs.main`              | `packages/action/dist/index.js`                                    |
| `runs.pre` / `runs.post` | none — no pre/post steps are declared or used                      |
| `inputs`                 | none — the Action reads only runner environment variables          |
| `outputs`                | none — the Job Summary is the v0.1 output surface (see OUTPUTS)    |

`scripts/verify.mjs:175` fails the build if the metadata ever drifts away from `using: node24`,
and `scripts/verify.mjs:178` fails if the committed bundle stops containing the Action error
prefix, so metadata and artifact cannot silently disagree.

## TRUST MODEL

Two domains, and the boundary is the point of the stage:

- **Trusted:** DiffBeacon's own code — `action.yml`, the committed bundle
  `packages/action/dist/index.js`, and the Node process the runner starts from the _base_
  branch's checkout of the Action reference.
- **Untrusted:** everything the pull request contributed — the checked-out workspace tree, its
  files, filenames, `.gitattributes`, `.npmrc`, `package.json`, Git hooks, Git configuration,
  any `action.yml` or bundle inside the pull request's own tree.
- **Exact separation:** the untrusted side is _data_, read through one
  `git diff --no-ext-diff --no-textconv …` invocation whose argument vector is fixed in
  `packages/cli/src/git.ts`. Git runs with `shell: false` in the directory named by
  `GITHUB_WORKSPACE`, and nothing from the reviewed tree is imported, required, installed, or
  spawned. There is no `npm ci` of the target, no `node <target file>`, no `sh <target file>`.

## CURRENT DOCUMENTATION DEFECT

What the repository said before this stage, and why it was unsafe:

- The README showed an `on: pull_request` workflow using `uses: ./`.
- `runs.main` is resolved from the checked-out tree, and under `on: pull_request` the checkout is
  the **pull request's** tree. So `uses: ./` makes the contributor's change choose the code that
  runs, and it runs with the base branch's permissions and token.
- DiffBeacon's own guards do not rescue this: the event-name check lives _inside_ the
  pull-request-controlled bundle, so it only executes after the attacker's entrypoint has already
  started. Saying "the `GITHUB_TOKEN` is read-only" would not fix it either — code execution is
  the problem, not token scope.
- Correction, applied in `README.md:100-129`, `packages/action/README.md:35-81` and
  `docs/architecture/security.md:57-62`: `uses: ./` is documented as trusted-development-only, the
  consumer pattern is an independently referenced commit SHA, and the SHA is a documented
  placeholder because no reviewed release exists. `tests/stage6.action-workflow-docs.test.ts`
  (16 tests) and the Stage-5 determinism suite now assert the exact placeholder form in both
  READMEs, so a real-looking SHA cannot be reintroduced by accident.

## EVENT CONTRACT

- Supported: `pull_request`, matched exactly against `GITHUB_EVENT_NAME`.
- Rejected: every other value, and an absent or empty value. Measured rows: `push`,
  `workflow_dispatch`, `Pull_Request`, empty string, and a 4 000-character name containing an
  ESCAPE byte.
- Rejection happens **first**, before the event file is opened and before Git is consulted; row 36
  proves this with a workspace that is not a repository at all — the failure is the event message,
  not "not a Git repository".
- Rejected names are echoed only through `echo()` (`packages/cli/src/errors.ts`): control
  characters become spaces, output is capped at 120 characters with a literal ` ...(truncated)`.
  Row 35 keeps the message under 300 characters with no raw escape byte.

## SHA CONTRACT

- Accepted: `^[0-9a-f]{40}$` or `^[0-9a-f]{64}$` — full SHA-1 or SHA-256 object IDs, lower case,
  no surrounding whitespace.
- Rejected: 7-character and other abbreviations, 39, 41 and 65 characters, UPPERCASE, whitespace
  padding, `refs/heads/main` and other revision syntax, `$(touch PWNED)`, non-string JSON values,
  and a payload with no `pull_request` key.
- Rationale: GitHub's event object names commits by full object ID, so anything else is either a
  guess or an attack. Validating the shape before Git starts means the range can only ever be
  `base...head` between two complete objects the event itself named; abbreviated IDs are also
  ambiguous and can denote different commits in different clones.
- A rejected value is never echoed. `objectId()` names only the endpoint (`base.sha` / `head.sha`),
  so a hostile event cannot put text into the Action's own message.

## WORKSPACE

- `GITHUB_WORKSPACE` is required and is the only directory Git is run in. Absent, empty, or
  whitespace-only fails (`GITHUB_WORKSPACE is required: …`).
- cwd-separation proof, measured both ways: row 24 (cwd is a Git repo, workspace is not a repo)
  and row 25 (cwd is repo A, workspace is unrelated repo B) both failed **open** before this stage
  — exit 0 with a full review, because the Action inherited the process directory. Both now fail
  closed. `tests/stage6.action-runner.test.ts:133` runs the positive control: the process working
  directory is a _different_ repository and the report produced is the workspace's.
- Workspace paths containing spaces and non-ASCII characters review normally (row 28, and
  `stage6.action-runner.test.ts:181,202`).

## SUMMARY

- `GITHUB_STEP_SUMMARY` is required. Before this stage a missing summary variable produced exit 0
  with no output anywhere (row 20) — a run that reviewed the pull request and showed nobody.
- Success: exactly one Markdown report is appended, byte-for-byte the `markdown` format, terminated
  by exactly one newline, with any pre-existing content preserved (row 23: `endsOnce=true`).
- Failure: nothing is appended. The summary write is the last statement in `runAction()`
  (`packages/action/src/index.ts:49-60`, appending at `:41`), so event, SHA, workspace,
  diff-collection and size errors all leave the file untouched — measured in rows 06, 20, 22, 29,
  32, 34 and 37 (`summary=absent`).
- Partial-write policy: the whole report is one `appendFileSync` of a rendered string; there is no
  streaming write to the summary, so a truncated review block is not a reachable state. A write that
  fails (directory, nonexistent parent) is reported as an Action failure with the stable message
  `The review could not be appended to GITHUB_STEP_SUMMARY: it must name a writable file provided
by the runner.` (rows 21, 22) instead of the raw `EISDIR` it leaked before.

## PR TOPOLOGY

Fixture: a real repository with a common root, then diverging branches, and the reviewed range
taken from the event SHAs.

```text
        root (base's parent)
          |\
          | \___ base-only.ts  (base branch only)   -> excluded from the report
          |
          \____ head-only.ts  (head branch only)   -> shown in the report
```

- Base SHA and head SHA come only from `pull_request.base.sha` / `pull_request.head.sha`.
- Range form is `base...head`, i.e. Git's three-dot merge-base diff: changes introduced on the head
  side since the common ancestor.
- Merge checkout behaviour: row 31 runs the Action where the checked-out `HEAD` is the _merge_
  commit and the event names the branch tips; the report is built from the event SHAs, so the
  reviewed content is the pull request's own changes, not the merge artifact.
- `head-only` is present and `base-only` is absent in the summary for every successful row
  (01-05 before repair, 28, 30-33, 37-40 after).
- Empty pull request (`base == head`, row 30) succeeds with a zero-file report rather than an error.

## MISSING HISTORY

Row 29 (absent base in a full clone) and row 37 (a genuine depth-1 clone, reachable only through a
`file:///` URL — a local-path `--depth 1` clone is really a full clone) both fail with exit 1, no
summary, and:

```text
DiffBeacon Action error: No diff available: git cannot resolve revision "<full base id>". The ref may not exist, or history may be incomplete, as in a shallow or partial clone. Read a prepared diff with --stdin.
```

The Action never fetches, deepens, or rewrites the checkout to make itself work; it names the
missing object and stops. Documented remedy is a full checkout (`fetch-depth: 0`). Caveat recorded
honestly: the sentence offers `--stdin`, which is CLI wording — a workflow consumer cannot use it,
so the actionable part for a consumer is the history depth.

## UNTRUSTED CODE EXECUTION

`tests/stage6.action-security-boundary.test.ts` (8 tests) builds one repository whose every
plausible execution surface is booby-trapped and runs the **committed bundle** against it:

| surface in the reviewed repository                                                        | trap                                            | result                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `package.json` scripts `preinstall`, `install`, `postinstall`, `prepare`, `build`, `test` | each writes a distinct sentinel                 | no sentinel; DiffBeacon never installs the target                                                                         |
| `.npmrc` with `ignore-scripts=false` and a fake registry token                            | invites script execution + reads a credential   | not read, not used                                                                                                        |
| Git hooks `pre-commit`, `post-checkout` in the path Git is actually configured to use     | write a sentinel outside the repo               | no sentinel — the review commits nothing; the fixture's own `core.hooksPath` isolation proves the hooks would fire if run |
| `.gitattributes` `*.ts diff=hostile` + `diff.hostile.textconv`                            | textconv driver writes a sentinel               | no sentinel                                                                                                               |
| `diff.external`                                                                           | repository-wide external diff writes a sentinel | no sentinel                                                                                                               |
| `action.yml` owned by the pull request, with `runs.pre` and `runs.main`                   | executes the pull-request bundle                | never parsed or executed by DiffBeacon                                                                                    |
| `packages/action/dist/index.js` inside the reviewed repo                                  | writes a sentinel when imported                 | no sentinel — the code that runs is resolved from the Action checkout, outside the workspace                              |
| `scripts/evil.js`, `evil.sh`, `evil.ps1`, `bin/launch-me.sh` (mode 100755)                | execute on read/hook/checkout                   | no sentinel; the workspace stays clean                                                                                    |

- Live controls, first: three tests prove the textconv, external-diff and hook traps really fire
  under plain `git diff` / `git commit` in the same fixture. A guard that passes only because the
  trap is inert proves nothing, so the controls are part of the evidence.
- `reviewing a booby-trapped repository creates no sentinel anywhere in it` asserts the sentinel
  list is empty, and the workspace `git status --porcelain` stays empty (`dirty=""`, row 33).
- Row 39 is the honest boundary case: if `$GITHUB_STEP_SUMMARY` is pointed _inside_ the reviewed
  repository — which runners do not do — the report is written there and the workspace becomes
  dirty (`?? review-output.md`). The Action cannot make the reviewed tree read-only; it relies on
  the runner's own summary path. Documented, not claimed as a control.
- **Result:** no execution surface of the reviewed repository was reached, on Windows or Linux.

## GIT CONFIG

Hostile repository-level configuration is set by the fixture and then ignored: `diff.noprefix`,
`diff.mnemonicPrefix`, `diff.srcPrefix=zzz/`, `diff.dstPrefix=yyy/`, `diff.renameLimit=1`,
`diff.algorithm=histogram`, plus the two diff-time programs above. The vector pins
`--src-prefix=a/ --dst-prefix=b/`, `--ignore-submodules=none --submodule=short`,
`--diff-algorithm=myers`, `--find-renames=50%`, `-l1000`, `--unified=3`, `--no-ext-diff`,
`--no-textconv`, `--no-color`, and prefixes are pinned rather than `--default-prefix` because the
latter is missing on older Git still in use. Row 33 shows a successful run with hostile shape
config, and `the report is identical with and without hostile diff configuration` compares the two
reports byte-for-byte. Submodule pointer changes stay in fixed short form.

## HOSTILE PATHS

Reported as data, never as commands or markup, in the same run: `$(touch PWNED).ts`,
``back`tick-angle.ts``, `semi;colon.ts`, `[link](example.invalid).ts`, `#hash-tilde~wave.ts`,
`unicodé-文件.ts`, `emoji-😀.ts`, `dir with spaces/payload.bin`, and the rename pair
`renamed-before.ts` → `renamed-after.ts`. Measured outcome: `| Changed files | 11 |` with the paths
escaped for Markdown, no `PWNED` file, workspace clean. Limitation stated plainly: the characters
Windows forbids in filenames (`| < > ? " *`) could not be created as fixture files on this host, so
they are covered by the parser and renderer suites rather than by a real-Git Windows path.

## BINARY

A modified and an added incompressible binary are classified structurally without `--binary`, so no
`GIT binary patch` payload is ever pulled into the summary: measured `| Binary files | 1 |` with the
`Binary files … differ` marker, and the oversize case stays bounded (see OVERSIZE).

## MODE-ONLY

`bin/launch-me.sh` changes only its mode, through `git update-index --chmod=+x` plus a real
`chmod 0755`: measured `| Mode-only files | 1 |` and the row `| mode-only | `bin/launch-me.sh` |`.
This is the case that exposed the first Linux cell failure — on Linux `git add --all` re-reads the
filesystem and dropped an index-only mode change, leaving a repository with **no** mode change; on
Windows the filesystem bit is not authoritative, so only the index form works. Both are now applied
(`eb66141`), and the assertions pass on all four cells.

## RENAME

`git mv` before the head commit: the report carries `renamed-after.ts` with rename detection forced
on at 50% similarity and `-l1000`, so a small `diff.renameLimit` in the repository cannot suppress
it.

## OVERSIZE

Row 32: a diff above the 8 388 608-byte analysis limit is rejected **before** the summary is
written — exit 1, `summary=absent`, message
`No diff available: the diff is larger than the 8388608 byte analysis limit. Narrow the range, or use --stdin with a bounded diff.`
Collection is a bounded async `spawn` stream, so the limit is enforced while reading, not after.

## PERMISSIONS

Documented minimal set: `permissions: contents: read` and nothing more; no write scope; no PAT; no
pull-request write permission; no `issues`, `checks`, `pull-requests` or `statuses` scope. The
Action authenticates to nothing — it writes only `$GITHUB_STEP_SUMMARY`, which is a local file the
runner provides. `docs/examples/diffbeacon-pull-request-review.yml` carries exactly that
`permissions:` block, and the workflow-docs suite asserts the example triggers on `pull_request`
with `contents: read`, and contains no write scope (`pull-requests:`, `contents: write`, `admin`,
`security-events: write`), no `secrets.` reference, no `run:` step, and no install or setup-node
command. It also asserts that no documented workflow **triggers** on `pull_request_target` — the
name itself does appear in prose, because the refusal is what the prose explains.

## CHECKOUT

Requirements documented in both READMEs and the example:

- `fetch-depth: 0` — the default shallow checkout is not guaranteed to contain the base commit, and
  the Action resolves `base...head` locally.
- `persist-credentials: false` — DiffBeacon performs no authenticated Git operation after checkout,
  so runner credentials must not survive into the steps that read untrusted code.
- Immutable reference: the full 40-character commit SHA of a reviewed DiffBeacon release, not a
  moving tag. The pinned upstream example is `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`
  (`v7`), re-verified against `refs/tags/v7` with `git ls-remote --tags` on 2026-09-26; provenance
  is recorded in `stage6/phase12-upstream-sha-provenance.txt` outside this repository.

## PULL_REQUEST_TARGET

v0.1 policy: **refused**. `GITHUB_EVENT_NAME == pull_request_target` fails with its own message
naming the reason (row 03, row 36, `packages/action/src/logic.ts:29`). It is not a fix for the
`uses: ./` problem — it keeps the base branch's token and checkout while the pull request still
controls the code under review — and DiffBeacon needs none of its extra privileges, because
`pull_request` already carries the same payload. The event gate is reachable in tests and inside
the bundle; it does not depend on workflow-level configuration.

## ACTION REFERENCE

Current state: DiffBeacon is a **private repository with no public tag, no release, and no published
Action**. There is therefore no reviewed DiffBeacon commit that a consumer can pin, and this stage
does not invent one. The example workflow and both READMEs use the literal placeholder
`uses: Pavithran-R-A/DiffBeacon@<REVIEWED_FULL_COMMIT_SHA>`, and the workflow-docs suite plus the
Stage-5 determinism suite assert that exact string in both READMEs, so a plausible-looking SHA
cannot be pasted in without failing the gates. Stage 11 owns publishing the reviewed reference.
Hosted public consumption does not exist yet, and the example file is deliberately not under
`.github/workflows/`; Stage 6 added no active workflow (`git log -1 -- .github/workflows/` still
points at `2543f93`, before this stage).

## OUTPUTS

**Added: NO.** Decision and rationale:

- The Action declares no `outputs:` and writes nothing to `$GITHUB_OUTPUT`. The Job Summary is the
  whole v0.1 output contract.
- A JSON blob handed back through `$GITHUB_OUTPUT` would be a machine interface to design, version,
  and secure — a second contract without a consumer, and a new injection surface for path content in
  downstream steps.
- Nothing in Stage 6 needs it: the review is for humans on the pull request, and the CLI already
  provides `--format json --output -` for machine consumers outside Actions.
- Consequence documented: consumers who want structured data should run the CLI, not parse a summary.

## ERROR SURFACE

Every failure is one line on standard error, prefixed `DiffBeacon Action error: `, exit 1, with the
prefixed value passed through `echo()`; stdout stays empty and the summary stays untouched:

| condition                           | message                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_EVENT_NAME` absent or empty | `GITHUB_EVENT_NAME is required: DiffBeacon reviews the pull_request event and must know which event the runner delivered.`            |
| any other event name                | `Unsupported GITHUB_EVENT_NAME "<sanitised>": DiffBeacon reviews only the pull_request event.`                                        |
| `pull_request_target`               | dedicated message naming the base-privilege refusal                                                                                   |
| event path absent/empty             | `GITHUB_EVENT_PATH is required: DiffBeacon runs as a workflow step and reads its boundaries from the environment the runner exports.` |
| event file unreadable               | `GITHUB_EVENT_PATH could not be read: "<sanitised path>".`                                                                            |
| event file not JSON                 | `GITHUB_EVENT_PATH is not valid JSON for a workflow event.` (was `Unexpected end of JSON input`)                                      |
| base/head not a full object ID      | `Pull request event base.sha is not a full commit object ID: …` / same for `head.sha`; the value is never echoed                      |
| workspace absent/empty              | `GITHUB_WORKSPACE is required: …`                                                                                                     |
| workspace not a repository          | `No diff available: the working directory is not a Git repository. …`                                                                 |
| endpoint missing from the clone     | `No diff available: git cannot resolve revision "<object id>". …`                                                                     |
| diff over the limit                 | `No diff available: the diff is larger than the 8388608 byte analysis limit. …`                                                       |
| summary absent/empty                | `GITHUB_STEP_SUMMARY is required: …`                                                                                                  |
| summary not writable                | `The review could not be appended to GITHUB_STEP_SUMMARY: it must name a writable file provided by the runner.`                       |

Success is exit 0 with empty stdout. Raw Node error strings (`ENOENT`, `EISDIR`, `Unexpected end of
JSON input`) no longer reach the operator — measured rows 17, 18 and 21 before/after.

## TESTS

| measure    | starting (`7152152`) | final (`1287514`)                                       |
| ---------- | -------------------- | ------------------------------------------------------- |
| test files | 33                   | 38                                                      |
| tests      | 660                  | 745 (Windows: 745 passed; Linux: 744 passed, 1 skipped) |

New Stage-6 suites: `stage6.action-event.test.ts` 22, `stage6.action-runner.test.ts` 17,
`stage6.action-metadata.test.ts` 22, `stage6.action-security-boundary.test.ts` 8,
`stage6.action-workflow-docs.test.ts` 16 — 85 tests. `tests/action.test.ts` (6 tests) was kept and
still runs; no Stage-5 CLI test was removed or weakened. The one Linux skip is the pre-existing
Windows-only gate in `tests/stage3c.release.test.ts` (`runIf(win32)`), which is the expected
asymmetry and nothing else.

Mutation checks were run rather than trusting green output: neutralising the sanitiser and the
object-ID gate made exactly the intended assertions fail, which exposed two tautological event tests
that had been passing vacuously (a `JSON.stringify`-escaped control character is not the same as a
removed one). Those assertions now demand the space-replaced echo form and the absence of the
escaped spelling.

## BUILD

`npm run build` passes in all four cells: `build:core` (tsc), `build:cli`, `build:action`,
`build:web` (vite). No new runtime dependency was added; `scripts/action-metadata.mjs` parses the
one field pair it needs directly, avoiding a YAML library for a single check.

## ACTION BUNDLE

|               | value                                                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| before        | `c17dc9e64268dbc34733b774dfe69d72e6e4860ad1798f26dbc5d2f9ea7fb40b`, 45 494 bytes                                                                                             |
| after         | `5b088ecfe215f77a65ab109365574b5a6f583f4b05cb63370bde6629f41e6c6d`, 47 312 bytes                                                                                             |
| CLI bundle    | `b4faa11d92db1270d5b197cd9a56e1f1bed3d433f9075c0b6ef783664abf3ef8`, 57 152 bytes — a build artifact (`.gitignore` excludes `dist/`), not committed, and unchanged by Stage 6 |
| clean rebuild | in every cell, `bundle_after_build` equals `bundle_committed` for the Action bundle, and `cli_bundle_after_build` reproduced the same digest in all four cells               |

The committed bundle is fresh: it is rebuilt inside the clean clone by `npm run build` and compared,
so a stale artifact cannot pass. `scripts/action-smoke.mjs` then launches whatever `action.yml`
names from a working directory that is **not** the reviewed repository, and prints the same line in
all four cells: `packages/action/dist/index.js wrote 1250 bytes to the Job Summary; stdout="";
stderr=""; cliLeak=false; hostilePaths=true; cleanWorkspace=true; oversizeRejected=true;
partialSummary=false; pullRequestTargetRejected=true` over a freshly generated range.

## MANIFEST

`SOURCE_MANIFEST.txt` at `1287514`: 123 tracked entries (127 lines including the four header/blank
lines), SHA-256 `648c76e96dfa7dd374d83ccb4230f829208756809bee77af57f2c8a1ddbb88be`. Regenerated with
`npm run manifest` after every product change (115 → 123 entries; the eight new files are
`scripts/action-metadata.mjs`, its `.d.mts` sibling,
`docs/examples/diffbeacon-pull-request-review.yml` and the five Stage-6 suites). Drift check: `npm run verify` re-renders the manifest from the Git index and fails on any
mismatch, and it passed in all four cells — so the committed manifest, the committed bundles, and the
required-file list (`scripts/verify.mjs:84-102`) are consistent. `docs/audits/**` is manifest-excluded
by policy, so this report does not change the manifest.

## LOCAL QUALIFICATION MATRIX

Four clean-clone cells, one at a time, each cloning `1287514c…` into a disposable directory and
running all ten gates. Evidence lives outside this repository under `stage6/` (cell logs in
`stage6/cells/<name>/logs/`).

| cell           | node / npm                     | git                | HEAD        | gates      | tests                 | bundle rebuild    | untracked after | status |
| -------------- | ------------------------------ | ------------------ | ----------- | ---------- | --------------------- | ----------------- | --------------- | ------ |
| `win-node24`   | v24.21.0 / 11.19.0             | 2.55.0.windows.5   | `1287514c…` | 10/10 PASS | 38 files, 745 passed  | matches committed | 0               | PASS   |
| `win-node22`   | v22.23.3 / 10.9.9 (portable)   | 2.55.0.windows.5   | `1287514c…` | 10/10 PASS | 38 files, 745 passed  | matches committed | 0               | PASS   |
| `linux-node24` | v24.21.0 / 11.19.0 (`node:24`) | 2.39.5 (container) | `1287514c…` | 10/10 PASS | 744 passed, 1 skipped | matches committed | 0               | PASS   |
| `linux-node22` | v22.23.3 / 10.9.9 (`node:22`)  | 2.39.5 (container) | `1287514c…` | 10/10 PASS | 744 passed, 1 skipped | matches committed | 0               | PASS   |

Gates, in order: `npm ci`, `format:check`, `lint`, `typecheck`, `test`, `build`, `package-smoke`,
`action-smoke`, `verify`, `check`. Linux cells run in container-native `/tmp` (overlay), not a
Windows bind mount, and `package-smoke` printed the same line everywhere
(`0.1.0; bin=true; engines=>=22; stdinFiles=1; rangeFiles=1; fileStdoutBytes=0; noRepositoryExit=3;
usageExit=2; tarballFiles=3`).

Findings this matrix produced, each repaired and then re-measured:

1. `c56ac10` failed two assertions in **both Linux cells** (`missing bin/launch-me.sh`, unmatched
   `| Mode-only files | 1 |`). Root cause was platform asymmetry in the fixture, not the Action;
   repaired in `eb66141`, both Linux cells then passed.
2. `eb66141` failed `verify` and `check` in `win-node22` only:
   `tests/stage5.git-determinism.test.ts > keeps binary path/status fields exact without --binary for
all required states` was killed at 20 000 ms (reported 21 992 ms) inside `verify`'s nested test run,
   while the same file in the same cell passed that case in 14 908 ms standalone. The file's budget
   had been set from a 5-8 s observation; the same case measures 12 192 ms on the Windows Node-24
   host. Raised to 60 000 ms to match the other real-Git suites (`eb66141` → `1287514`); no
   assertion changed, and the case completed in 10 238 ms under `verify` in the re-run cell. This is
   an environment/test-harness budget defect, not an Action defect.

## CONTRACT MATRIX (PHASE 1)

`stage6/matrix-40-rows.md` holds all 40 AFTER rows paired with the 24 BEFORE rows, each row recording
exit status, whether the summary exists, report count, head-only/base-only presence, stdout bytes,
tail length, newline-termination, workspace dirtiness, and the error line. Ten rows flipped from
fail-open to fail-closed, covering six distinct contract defects, and 16 rows are new coverage:

| rows                  | contract                                                                                                   | before                                        | after                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| 01-05                 | absent `GITHUB_EVENT_NAME`, `push`, `pull_request_target`, `workflow_dispatch`, `Pull_Request`             | exit 0, full review written                   | exit 1, no summary, message names the trigger                  |
| 07, 12                | 7-character abbreviations, UPPERCASE object IDs                                                            | exit 0, review built from an ambiguous prefix | exit 1 before Git starts                                       |
| 20                    | missing `GITHUB_STEP_SUMMARY`                                                                              | exit 0, no output anywhere                    | exit 1, message requires it                                    |
| 24, 25                | workspace not a repo / unrelated repo while cwd is the PR repo                                             | exit 0, reviewed the wrong repository         | exit 1, workspace binding enforced                             |
| 08, 09, 11, 13-19, 21 | malformed SHA-shaped values, missing key, non-string, bad JSON, absent file, empty path, directory summary | mixed, three of them leaking raw Node errors  | stable endpoint-naming messages, no raw error, no echoed value |
| 23                    | pre-existing summary content                                                                               | report appended without a clean terminator    | one newline-terminated block, content preserved                |
| 06, 22, 26-33, 34-40  | new coverage                                                                                               | not probed                                    | measured, all conforming                                       |

Row 01 also carries a probe correction, recorded in the matrix header: the first AFTER probe run
defaulted `GITHUB_EVENT_NAME` to `pull_request` when the option was absent, so it was not probing the
absent case at all. The probe now omits the variable on an explicit null, and every row in the file
is from the corrected run (`stage6/probe-after-3.json`).

## HOSTED GITHUB ACTIONS

- Real hosted Action execution available: **NO**.
- Ordinary CI run after the final push: inspected once, per the stage rule; the previous inspected
  run `36234342955` had four jobs, no runner, zero steps and zero billable time. If the new run shows
  the same shape this stage records `EXTERNAL CI BLOCKED` and does not rerun. The CI observation is
  appended to the END OF THIS REPORT section below after the push.
- Runner allocation: none was granted; this is an account/billing condition outside DiffBeacon's
  source, and it did not change the local verdict.
- **Hosted E2E remains unqualified.** Everything above was produced by executing the committed
  bundle as a subprocess with runner-shaped environment, not by GitHub's runner. The Action is
  therefore locally qualified, not hosted-qualified, and no claim of hosted qualification is made
  here or in the READMEs.

## MACOS

Actual runtime qualification: **NO**. No macOS host or VM was available in this environment, so the
Action has not been executed on Darwin and nothing in this report should be read as macOS evidence.
The platform-specific code paths that matter (`isEntrypointUrl`'s case-insensitive comparison, the
`chmod`/index mode fixture) are covered by unit tests and by the Windows and Linux cells only.

## EXACT COMMANDS RUN

Local product work, in order (all inside `DiffBeacon/` unless noted):

```bash
git remote get-url origin; git branch --show-current; git rev-parse HEAD
git merge-base --is-ancestor 7152152fb2356dac6556bc1afb31d7175eafaf86 HEAD
npx --no-install vitest run tests/stage6.action-event.test.ts            # RED, then GREEN
npx --no-install vitest run tests/stage6.action-runner.test.ts
npx --no-install vitest run tests/stage6.action-metadata.test.ts
npx --no-install vitest run tests/stage6.action-security-boundary.test.ts
npx --no-install vitest run tests/stage6.action-workflow-docs.test.ts
npx --no-install vitest run tests/stage5.git-determinism.test.ts
npx --no-install prettier --write . ; npx --no-install prettier --check .
npx --no-install eslint . --max-warnings=0
npx --no-install tsc --noEmit -p tsconfig.json
npx --no-install vitest run
npm run build ; npm run package-smoke ; npm run action-smoke
node scripts/generate-source-manifest.mjs        # npm run manifest
npm run verify ; npm run check
node stage6/probe-before.mjs > stage6/probe-before.json        # outside the repo
node stage6/probe-after.mjs  > stage6/probe-after-3.json
node stage6/render-matrix.cjs                                  # -> stage6/matrix-40-rows.md
```

Contract probes against the committed bundle were driven by `stage6/probe-before.mjs` and
`stage6/probe-after.mjs` (24 and 40 scenarios; every repository they build lives under `os.tmpdir()`).
Cells, one at a time:

```bash
bash stage6/run-cell-windows.sh "" win-node24
bash stage6/run-cell-windows.sh "<portable node22 bin dir>" win-node22
bash stage6/run-cell-linux.sh node:24 linux-node24
bash stage6/run-cell-linux.sh node:22 linux-node22
```

Upstream pin provenance: `git ls-remote --tags https://github.com/actions/checkout refs/tags/v7`
(2026-09-26), recorded in `stage6/phase12-upstream-sha-provenance.txt`.

## WORKING TREE STATE

At the report commit the source working tree contains exactly two untracked files, both recurring
host debris that must never be staged: `pnpm-lock.yaml` and `pnpm-workspace.yaml`. They reappeared
during this stage after unrelated tool invocations, were left unstaged each time, and are quarantined
outside the repository at the end. No disposable target repository, evidence log, Docker output,
tarball, portable Node or local event file is inside the repository; all of it lives in `stage6/`
beside it. Each qualification cell ended with `untracked_after=0` in its own clone, and
`git diff --check` plus `npm run format:check` are clean.

## REMAINING ACTION LIMITATIONS

- No hosted execution evidence at all; the GitHub-side behaviour of `node24` runners, summary
  rendering, and permission enforcement is unverified.
- No published, reviewable Action reference exists, so no consumer can adopt the documented pattern
  yet; the example workflow is deliberately non-executable.
- No inputs, no outputs, no `pre`/`post`: consumers needing structured data must run the CLI.
- Only `pull_request` is supported; `pull_request_target` and every other trigger fail closed. Fork
  pull requests cannot be exercised locally, so the fork + secrets boundary is reasoned about in the
  docs, not measured.
- Missing history fails the step; the Action will not fetch or deepen a checkout to save itself, and
  the remedy sentence borrows CLI wording (`--stdin`) that a workflow step cannot use.
- A diff above 8 388 608 bytes fails the step; there is no chunking or paging.
- The reviewed tree is not made read-only. If `$GITHUB_STEP_SUMMARY` is pointed inside it — not
  something a runner does — the write lands there and dirties the workspace (row 39).
- The report reflects Git's rename/textconv configuration only as DiffBeacon pins it; a repository
  can still make its diff _larger or smaller_ legitimately, and the review is of whatever the range
  contains.
- Windows-illegal filename characters are covered by parser and renderer tests, not by a real-Git
  Windows path.
- Mode-only detection depends on Git index modes; a host without a usable executable bit cannot
  produce one from the filesystem.
- `AUDIT_HANDOFF.md` still carries pre-Stage-6 handoff text; documentation closure is Stage 10's work
  and was deliberately not attempted here.

## DISCLOSED CAVEATS

- TDD ordering deviation: `scripts/action-metadata.mjs` was written as a supporting harness for the
  smoke script before its asserting suite existed; `stage6.action-metadata.test.ts` then pinned it.
  The rest of the stage followed RED → GREEN, with the RED logs kept outside the repo
  (`stage6/red-*.txt`).
- The Stage-5 determinism suite's assertion about `uses:` references was **changed**, not weakened: it
  forbade any `uses: …DiffBeacon@…` string, which the intentional documented placeholder now violates,
  and it now requires the exact placeholder in both READMEs. This is a cross-stage contract update
  forced by Stage 6's own decision, and it is disclosed rather than presented as a repair.
- Two Linux cells failed once and one Windows cell failed once; both are documented above with their
  measurements instead of being re-run quietly until green.
- The `worktree_clean_at_start=0` figures describe the clones; the source tree carries the two pnpm
  files described in WORKING TREE STATE.
- Nothing in this stage claims the implementation "knows with certainty" what a runner will do; the
  claims are about what the bundle does when given the environment it reads.

## STAGE 6 DECISION

`PASS` for the local Action contract. Every PHASE 32 criterion that can be evidenced without a
GitHub-hosted runner is evidenced above: valid `node24` metadata, committed fresh bundle with
matching rebuild digests, the ordinary `pull_request` contract, full-object-ID SHA contract, explicit
workspace binding, a real diverged three-dot proof, correct Job Summary production with no partial
write on failure, the reviewed repository neither installed nor executed under sentinel traps, trusted
bundle separated from the reviewed workspace, hostile filenames and Git configuration inert, bounded
diff collection, minimal permissions documented, unsafe `uses: ./` guidance replaced, `pull_request_target`
refused, the future reference described as an immutable SHA with no fake release, and local Windows
and Linux qualification. The hosted-runner billing block alone does not make Stage 6 FAIL, and hosted
E2E is explicitly recorded as unqualified.

## NEXT RECOMMENDED ROADMAP STAGE

**Stage 7 — Browser Demo.** Stage 6 stops here; Stage 7 was not begun.

## END OF THIS REPORT — CI OBSERVATION
