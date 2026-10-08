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
- **Copy detection is outside the supported vector.** A pasted `copy from`/`copy to` record gets an
  `unsupported-dialect` diagnostic and is represented conservatively as an added destination file.
  DiffBeacon's own Git invocation does not request copy detection; unlike a rename, the copy source
  is not carried into classification or relationship evidence.
- **Counts are observed, never inferred.** A hunk whose body does not match its header, a header that
  cannot be attributed to a file, or a diff that stops mid-record produces a typed diagnostic and a
  total in `summary.diagnostics`. Additions and deletions count the lines actually read; a binary or
  mode-only change reports `null` counts, not zero. Rename similarity is accepted only in Git's
  integer `0%` through `100%` form; malformed or out-of-range metadata is diagnosed and the
  report's nullable `similarity` field stays inside its JSON Schema bounds.
- **Input is bounded at 8 MiB.** One limit, `MAX_DIFF_BYTES` in `packages/core/src/model.ts`, applies
  to pasted browser input, CLI stdin, and the diff the CLI collects from Git. Larger input is an
  explicit failure, not a truncated report.
- **Naming oddities are display problems, not classification problems.** Traversal-, shell-, markup-,
  and Windows-device-shaped names are treated as opaque labels, never opened, and neutralised at paint
  time. Path parsing preserves meaningful trailing spaces in Git's unquoted headers and rename
  metadata; those names remain distinct in the raw report even though some target filesystems cannot
  create them. Detector structure follows Git's patch grammar: `/` is the separator. A literal
  backslash in a POSIX filename stays a filename byte instead of being reinterpreted as a synthetic
  directory boundary. JSON keeps those raw names as data after parsing, while its serialized text
  spells C1, bidi-formatting, and line-format controls as `\\uNNNN` escapes so printing JSON cannot
  turn a filename into terminal instructions or reorder the trusted text around it.

## Each adapter has its own edges

- **CLI.** Needs a real Git repository in the working directory and `git` on `PATH`. A shallow or
  partial clone that lacks the requested range fails with exit code 3 instead of reporting a partial
  review. Before starting `git diff`, both validated range endpoints are resolved together to full
  commit object IDs, so a symbolic ref moving between validation and collection cannot silently change
  the diff. It inherits the operator's Git environment unchanged, which is the point: the person
  running the command owns that environment.
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

- **GitHub-hosted coverage is only as wide as the run that passed.** The current CI workflow ran on
  GitHub-hosted runners on 2026-10-04: Actions run
  [`37191968216`](https://github.com/Pavithran-R-A/DiffBeacon/actions/runs/37191968216) at commit
  `889f52b6e53095fea978fafbe50017ff71e543db` concluded success in all five jobs — the source gates on
  `ubuntu-latest` and `windows-latest` at Node 24 and Node 22, and the real-Chromium browser lane,
  which reached a hosted success for the first time in this repository's history. Three earlier hosted
  runs of the same workflow (`36971746510`, `37188759053`, `37190394247`) each failed at a recorded
  step, so the green run qualifies the lanes it executed at the commit it ran at — not this workflow
  at any future commit. Cross-repository consumption was measured later: on 2026-10-06 the temporary
  public consumer repository ran the released Action pinned to
  `5a50b52028ead78942ea3fc3bee93ba26e0a79cc` in Actions run `37430396143`, and on 2026-10-08 a second
  temporary public consumer repository ran it pinned to
  `a89d8bb7d048bfd4e016e494428d04f060e82112` in Actions run `37749736010`; both completed
  successfully; each is a fixed release measurement, not proof about a future commit. Neither run
  makes the review text retrievable after the fact — GitHub exposes no Job Summary body through any
  API endpoint, so a past run's review is read in the web UI, and what these stages recorded from
  outside the browser was the Action's own replayed output plus the bundle fingerprint, as stated in
  [`docs/audits/stage17-v0.1.1-release-finalization.md`](audits/stage17-v0.1.1-release-finalization.md)
  §4.5. The hosted-CI
  claim is also scoped by era: the bootstrap-era workflows did receive
  GitHub-hosted runners and executed setup and checkout steps on them before failing during archive
  extraction (Actions runs `32859849733`, `31819615124` and `31818807881`, recorded in
  `docs/audits/stage1-rebaseline.md`); those are historical evidence, not product or release
  qualification. What has executed against the current workflow is recorded in
  [`docs/audits/stage11-release-qualification.md`](audits/stage11-release-qualification.md) and
  summarised in the README status table.
- **Platform-specific behaviour is measured only where the file can exist.** A name whose bytes are
  not valid UTF-8 can only be created on a POSIX filesystem, so that real-Git case runs on Linux and
  reports a recorded skip reason elsewhere; the Windows-only npm bin-shim case works the other way
  round. Both halves have now been seen on hosted runners: in Actions run `37191968216` the
  `ubuntu-latest` lanes ran `tests/stage8.invalid-byte-paths.test.ts` to completion (10 tests) and
  skipped the Windows bin-shim case, while the `windows-latest` lanes printed its recorded skip
  reason — 985 passed / 134 skipped on Linux against 984 passed / 135 skipped on Windows, out of 1119
  tests in each.
- **Dependency advisories move on their own.** Measured 2026-10-04 in a clean `npm ci` clone of commit
  `889f52b6e53095fea978fafbe50017ff71e543db`: `npm audit --omit=dev --audit-level=high` and
  `npm audit --audit-level=high` both print `found 0 vulnerabilities` and exit 0. That is a reading of
  a moment, not a property of the lockfile — the same tracked graph printed `1 high` on the
  development tree on 2026-09-30 and cleared only after a lockfile refresh, and either number can move
  again with no commit here. The two audit commands are a blocking step in CI and in
  [`docs/releasing.md`](releasing.md), so a move fails the gate rather than the prose.
- **A fuzz corpus is not an absence proof.** The seeded inputs guard the contract that was written
  down; they say nothing about inputs outside it.
