# Stage 13 — release policy decision: conduct intake moves post-release

STATUS: POLICY DECISION RECORDED — NO CONDUCT CHANNEL EXISTS, NONE WAS INVENTED

Date of decision: **2026-10-05**. Decided by: the repository owner / maintainer, explicitly, in
writing. Executed by: this stage, documentation only.

Entry state, re-measured before editing anything: `main` = `origin/main` =
`git ls-remote origin refs/heads/main` = `85979940eef8750ccb4715c57a682d23a4e9e5ec`, worktree clean,
Stage 11 qualified candidate `c76567a4da0eb0590c85e89cd6f2a2f987fd4087` an ancestor of `main`, hosted
CI run `37221511785` success (five jobs) at that head, Pages run `37257883015` success,
`GET /repos/Pavithran-R-A/DiffBeacon/private-vulnerability-reporting` answering `{"enabled":true}`.

## 1. The decision

Private conduct-reporting intake is **not a prerequisite** for the DiffBeacon v0.1.0 consumer release.
The owner's instruction, verbatim in substance: it "is NOT a technical, npm, GitHub Release, GitHub
Action, GitHub Pages, or GitHub Marketplace prerequisite for DiffBeacon v0.1.0", and creating such a
channel is "a post-release governance enhancement, not a release prerequisite".

Consequently the identifier `CONDUCT_INTAKE_MANUAL_BLOCKER`, which Stage 12 emitted as its closing
verdict, is retired **as a release blocker**. From this commit forward the absence of a conduct
channel is reported as `POST_RELEASE_GOVERNANCE_TODO`.

Two things did not change, and were not allowed to change:

- **The Code of Conduct stays truthful.** It continues to state that no dedicated private
  conduct-reporting channel is configured. Nothing was removed, softened, or deleted to make a
  checklist row read green; the file was reclassified, not weakened.
- **Security and conduct remain separate surfaces.** GitHub Private Vulnerability Reporting stays the
  only security intake, remains enabled, and is not reused for conduct complaints. Public Issues and
  Discussions are not represented as private reporting channels — Discussions are disabled (that
  endpoint answers HTTP 410) and the issue tracker is public by construction.

## 2. Why the classification moved, stated honestly

This is a **maintainer judgment about release scope**, not a new measurement and not a repair. No
technical gate, artifact, audit surface, test, or workflow bears on conduct intake, and Stage 12
already established that no conduct channel could be configured from this environment without the
owner creating one out of band. Holding an unconfigured community-governance item in front of a
package that is otherwise qualified would have made documentation policy look like engineering
evidence, which is the opposite of this repository's discipline.

Stage 12's own conclusion was correct **at the time and under the brief it was given**, and its record
still says so. This file supersedes the _classification_; it supersedes no measurement.

## 3. What this stage was offered, and why nothing was published

Before the decision above, this stage received conduct-intake material in three passes and declined to
document any of it. The reason is recorded here so the refusal is auditable rather than mysterious:

1. A release brief whose channel value was the unresolved literal `<CONDUCT_CONTACT>`. PHASE 1 of that
   brief forbids documenting a placeholder, so it could not be satisfied by a placeholder.
2. The **body/copy** of a private conduct-report form — its fields, its privacy wording ("Absolute
   confidentiality cannot be guaranteed", "There is no guaranteed response-time SLA", do not submit
   passwords/tokens/keys), and its instruction to route vulnerabilities to Private Vulnerability
   Reporting instead. That is form text. It contained no URL, no address, and no form identifier.
3. An owner attestation: that the form was created, its responder URL opened, a test response
   submitted, the response confirmed privately accessible, and future submissions monitored — plus
   explicit permission to publish "this exact responder URL", with the instruction not to modify or
   shorten it. **The responder URL itself was never transmitted in any message or attachment.**

Read-only checks performed for that attempt, all of which returned nothing:

- a grep of the session attachment directory for form-host URLs (`forms.gle`, `tally.so`,
  `typeform.com`, `docs.google.com/forms`, Office forms, Fillout, formsubmit, and similar) — 0 matches;
- a grep for address-shaped strings across `CODE_OF_CONDUCT.md`, `SECURITY.md`, `README.md`,
  `docs/releasing.md`, `CONTRIBUTING.md` — 0 matches;
- `git ls-tree -r --name-only HEAD` — the only issue templates are `bug_report.yml`,
  `detector_proposal.yml`, `feature_request.yml`, all public, and no conduct template exists;
- `gh api repos/Pavithran-R-A/DiffBeacon/community/profile` — `{"coc":true,"bug":false,
"config":false,"supporting":false,"has_security_policy":null}`.

The standing rule "never invent email addresses, security contacts, SLAs or reporting channels" is why
a form body without a location was not written into the Code of Conduct: directing reporters to a form
whose address no one can read is strictly worse than stating plainly that no channel exists. No form
was created, no service was signed up for, and no address was composed. The external evidence note for
that attempt is `stage12/conduct-intake-attestation.txt`, kept outside the repository.

## 4. Evidence classes, kept distinct

The owner's test submission is **owner testimony**. This stage did not log into any mailbox and did not
send a report, and PHASE 1 of the earlier brief forbade both without separate authorization. Nothing
here measures whether submissions reach a human. The current-facing prose therefore claims only what
is checked: that no channel is configured. When a real channel is added post-release, the durable
proof remains what Stage 12 required — the channel resolves, and a submission is confirmed received by
the party who will monitor it — recorded before, not after, the Code of Conduct names it.

## 5. Files changed by this decision

Current-facing documentation only:

- `docs/releasing.md` — section 0's conduct row reclassified from an open prerequisite to a
  post-release governance item, and the section-0 preamble corrected so the prerequisite count matches
  (`Four of the five are now closed` no longer describes the file).
- `README.md` — the "Conduct intake?" status row's closing sentence, which pointed readers at
  `CONDUCT_INTAKE_MANUAL_BLOCKER` as an open prerequisite.
- `CODE_OF_CONDUCT.md` — the sentence that called a published, monitored intake "a release
  prerequisite"; the statement that none is configured is unchanged.
- `SOURCE_MANIFEST.txt` — regenerated; these three files are tracked source, so their digests move.
  `docs/audits/` is excluded from the manifest by `scripts/source-manifest.mjs`, so this record does
  not contribute a digest.

Not changed, deliberately: every pre-existing file under `docs/audits/` including
[`stage12-public-source-pages.md`](stage12-public-source-pages.md), which continues to record Stage
12's `CONDUCT_INTAKE_MANUAL_BLOCKER` verdict and its 2026-10-04 measurements; `SECURITY.md`;
`CONTRIBUTING.md`; `docs/limitations.md`; `CHANGELOG.md`; and every test file. No application source,
CLI, Action bundle, browser source, dependency, lockfile, CI workflow or Pages workflow was touched.

One wording constraint discovered while doing this, and respected rather than worked around: the
literal token `POST_RELEASE_GOVERNANCE_TODO` cannot appear in `README.md`, `docs/releasing.md`, or
`CODE_OF_CONDUCT.md`, because `tests/stage10.docs-contract.test.ts` forbids a `TODO` marker in any
current-facing document. The identifier is therefore this record's vocabulary and the stage scoreboard's
vocabulary, while the current-facing files carry the same meaning in prose ("a post-release governance
improvement, not a release prerequisite"). The test was not modified; its no-unfinished-markers rule is
a real product invariant, and relaxing it to fit a status label would have been weakening a test for
convenience.

## 6. Gates

Run once each, independently, on the tree this commit contains. No double-back-to-back stress driver
was constructed and no timeout was altered. Recorded with the exit code read from the same command
invocation:

| Gate                   | Result                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check` | exit **0** — "All matched files use Prettier code style!"                                                                                                                              |
| `npm run lint`         | exit **0** — `eslint . --max-warnings=0`, no output                                                                                                                                    |
| `npm run typecheck`    | exit **0** — `tsc --noEmit -p tsconfig.json`                                                                                                                                           |
| `npm run secret-scan`  | exit **0** — `12 finding(s), 12 classified, 0 unclassified, 0 stale`                                                                                                                   |
| docs contract suite    | exit **0** — `tests/stage10.docs-contract.test.ts` **68 passed (68)**                                                                                                                  |
| `npm run manifest`     | exit **0** twice — 158 files; exactly **3** entries moved (`CODE_OF_CONDUCT.md`, `README.md`, `docs/releasing.md`); second run byte-identical; `docs/audits` contributes **0** entries |
| `npm run verify`       | exit **0** — `Test Files 65 passed (65)`, `Tests 1131 passed / 2 skipped (1133)`, "DiffBeacon source-first verification passed."                                                       |
| `npm run check`        | exit **0** — same totals (`65 passed (65)`, `1131 passed / 2 skipped (1133)`), Duration 410.55s, "DiffBeacon source-first verification passed."                                        |

`npm run check` is `"check": "npm run verify"` in the root `package.json` — the same code path, not an
independent second gate. It was still run once on its own, started only after `verify` exited rather
than alongside it, because two ordered gates writing `dist/` on this shared host would contend. Raw
output lives outside the repository in `stage13/gates-run1.txt`, `stage13/verify-run1.txt`,
`stage13/check-run1.txt`, and `stage13/check-run2-final-bytes.txt`.

The first `check` attempt did not pass, and the record says so rather than quoting only the green
attempt. `stage13/check-run1.txt` ends with `EXIT_check=1` after 212 lines whose vitest phase stopped
at 86 seconds with no `Test Files` summary line, no failing-case line, and no error text, and without
reaching the build, secret-scan, manifest or smoke phases that `verify` runs in order — that is the
signature of an incomplete or killed run, not of a tested assertion failing. The root cause was not
established, so nothing was repaired on the strength of it and nothing was blamed on host contention:
the attempt was classified as uninformative and superseded. The authoritative result above is the
second attempt on the final bytes, started 2026-10-05T06:34:02Z and ended 2026-10-05T06:41:57Z, which
completed the whole ordered sequence. No timeout was changed, no case was skipped, and no assertion
was weakened between the two attempts; the only difference between them is that this document stopped
being edited while the gate ran. Editing a tracked Markdown file during a running `format:check` was
itself a defect of this stage's sequencing, caught by that gate and corrected by formatting the file
and re-running the prose gates on the final bytes.

The docs-contract run also proves the wording constraint in §5 is a live guard rather than an
inconvenience. Mutation control: the literal status identifier was appended to `README.md`, the suite
re-run, and it failed exactly the intended case — `× README.md makes no unfulfilled publication or
availability claim`, `Tests 1 failed`, exit 1. `README.md` was then restored and its `sha256sum`
compared against the pre-mutation value:
`ab35a6d7cae538de4e849d24b6d759a2b2936c39d3573acb5bc77d67aa082959`, identical on both sides. No test
file was modified at any point in this stage.

## 7. What this does not prove

- It does not prove a conduct channel exists, works, or is monitored. None exists.
- It does not prove the owner's form is unreachable — only that no identifier for it reached this
  stage through any channel this stage can read.
- It does not qualify this commit. Hosted CI for the SHA this record is committed under is measured
  after the push and is recorded outside the repository (the run id cannot be inside the commit whose
  push creates it — the bounded self-reference rule Stage 11 and Stage 12 already apply).
- It does not publish anything: no npm version, no `v0.1.0` tag, no GitHub Release, no Marketplace
  listing.
- A green documentation-contract suite does not make any current-facing claim true. The contract only
  bans known-stale wording; the claims themselves still have to be re-measured against GitHub, the
  registry, and the deployed site, which is what the stage scoreboard and the hosted CI run for the
  committed SHA do.
