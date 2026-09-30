# What DiffBeacon Does Not Do

This is the honest scope of the product: the boundaries a reviewer should know before trusting a
report, and the questions DiffBeacon will never answer. It is written for someone deciding whether to
use DiffBeacon, not for someone maintaining it — for the code-level boundary and the measurements
behind it, see [`docs/architecture/security.md`](architecture/security.md).

## A surface names a location, not a property

Classification is eleven path conventions over the two paths the parser proved for a file. A match
means **this area was touched in this diff**, nothing more:

- it does not mean the change is wrong, unsafe, incomplete, or under-tested;
- it does not mean the area's other files are unaffected;
- a path that _looks_ like an area but breaks the convention is missed, and the detector notes name
  each deliberate miss ([`docs/detectors/initial-detectors.md`](detectors/initial-detectors.md));
- a path that matches a convention says nothing about what the words in the file do, because
  detectors never read hunk content.

There is no generic `security` surface on purpose. The closest thing, `auth-access`, reports that an
authentication or access-control path changed and states neither a vulnerability nor its absence.

## A diff is not a repository

Every report is derived from one unified diff and nothing else. So a report cannot know:

- whether a file that did **not** appear in the diff still covers, calls, or contradicts the change;
- whether unchanged tests exercise a modified function — DiffBeacon can only say no test-file content
  appeared in this diff, and it phrases evidence that way;
- whether a manifest normally has a lockfile in this repository, only whether one changed here;
- whether a changed contract file still matches its implementation, its consumers, or its docs;
- anything about build status, deployment state, runtime behaviour, incident history, or who is on
  call.

Evidence entries are relationships inside this diff. They are worded as "not observed in this diff",
never as "missing" or "forgotten", and they never assert a property of the repository as a whole.

## Patch-format boundaries

DiffBeacon parses the output of its own pinned `git diff base...head --` invocation, and a diff pasted
or piped in from elsewhere:

- **Combined merge diffs are refused.** `diff --cc` and `diff --combined` blocks are skipped with an
  `unsupported-dialect` diagnostic rather than being read as ordinary hunks, because they describe one
  file against several parents and the supported vector never produces them.
- **Copy detection is read, not interpreted.** A `copy from`/`copy to` record is classified from both
  paths, the same way a rename is.
- **Counts are observed, never inferred.** A hunk whose body does not match its header, a header that
  cannot be attributed to a file, or a diff that stops mid-record produces a typed diagnostic and a
  total in `summary.diagnostics`. Additions and deletions count the lines actually read; a binary or
  mode-only change reports `null` counts, not zero.
- **Input is bounded at 8 MiB.** One limit, `MAX_DIFF_BYTES` in `packages/core/src/model.ts`, applies
  to pasted browser input, CLI stdin, and the diff the CLI collects from Git. Larger input is an
  explicit failure, not a truncated report.
- **Naming oddities are display problems, not classification problems.** Traversal-, shell-, markup-,
  and Windows-device-shaped names are treated as opaque labels, never opened, and neutralised at paint
  time. One measured exception: Git's C-quoted header form is trimmed of trailing whitespace, so
  `src/x ` is displayed as `src/x`.

## Each adapter has its own edges

- **CLI.** Needs a real Git repository in the working directory and `git` on `PATH`. A shallow or
  partial clone that lacks the requested range fails with exit code 3 instead of reporting a partial
  review. It inherits the operator's Git environment unchanged, which is the point: the person running
  the command owns that environment.
- **GitHub Action.** Needs the workflow to check out enough history to diff both event SHAs, so
  `fetch-depth: 0` is required and the default shallow checkout does not qualify. It reads only the two
  commit object IDs from the event payload and writes only the Job Summary, whose size is checked
  against GitHub's own per-step limit before anything is appended. It runs on `pull_request` only.
- **Browser demo.** Has no repository access at all — no Git, no filesystem walk, no network call, no
  account, no storage. It analyses pasted text locally, so what it cannot see is whatever is not in
  the text you paste.

## Judgement it will never offer

No risk score, no severity number, no probability, no confidence value, no merge verdict, no
"safe to ship" label, no LLM in the analysis path, and no telemetry. The `FOCUS`, `CHECK`, and `NOTE`
labels are navigation bands that fix a reading order for this diff; they are not a ranking of what
matters, and a surface listed earlier is not a surface that must be reviewed first.

## What has not been measured

Documentation cannot certify its own evidence. The limits below are real and are tracked rather than
hand-waved:

- **GitHub-hosted runner images for the current CI are unqualified.** The recovered-source CI workflow
  used for release qualification has never been allocated a GitHub-hosted runner, so
  `.github/workflows/ci.yml` is an unexecuted contract and the browser contract's hosted
  `ubuntu-latest` cell has never been measured anywhere. The claim is scoped to that workflow, not to
  every era of this repository: the bootstrap-era workflows did receive GitHub-hosted runners and
  executed setup and checkout steps on them before failing during archive extraction (Actions runs
  `32859849733`, `31819615124` and `31818807881`, recorded in `docs/audits/stage1-rebaseline.md`).
  Those runs executed a different workflow on different commits, so they are historical evidence and
  not product or release qualification. What has executed against the current workflow is recorded in
  the Stage 9 report and summarised in the README status table.
- **Platform-specific behaviour is measured only where the file can exist.** A name whose bytes are
  not valid UTF-8 can only be created on a POSIX filesystem, so that real-Git case runs on Linux and
  reports a recorded skip reason elsewhere; the Windows-only npm bin-shim case works the other way
  round.
- **Dependency advisories move on their own.** The release surface audits clean; the development tree
  currently audits at one high advisory in lint tooling that reaches no shipped artifact. Both
  readings, their date, and the CI consequence are carried in
  [`docs/architecture/security.md`](architecture/security.md) and handed to
  [`docs/releasing.md`](releasing.md).
- **A fuzz corpus is not an absence proof.** The seeded inputs guard the contract that was written
  down; they say nothing about inputs outside it.
