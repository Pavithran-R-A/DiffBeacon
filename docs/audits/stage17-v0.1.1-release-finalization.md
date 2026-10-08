# Stage 17 — v0.1.1 consumer release finalization

Status: **CLOSED — `diffbeacon@0.1.1` is the published release, its GitHub Release exists, and a
second repository ran the Action at its release commit.** This record changes no tag, publishes no
package, and re-states nothing it has not measured.

Baseline: the immutable release commit `a89d8bb7d048bfd4e016e494428d04f060e82112`, which Stage 16
tagged as `v0.1.1` and the publish workflow shipped. Stage 17 was run on 2026-10-08 from a working
clone of that commit at `stage11/rc`, on a host measuring `node v24.21.0`, `npm 11.19.0`, registry
`https://registry.npmjs.org/`. Times in this record are UTC.

Every number below was re-measured during this stage rather than copied from
[`stage14-v0.1.0-consumer-release.md`](stage14-v0.1.0-consumer-release.md),
[`stage15-v0.1.1-hardening.md`](stage15-v0.1.1-hardening.md) or
[`stage16-v0.1.1-preparation.md`](stage16-v0.1.1-preparation.md). Those records stay as written.

## 1. Scope and prohibitions observed

Four phases, in order: verify the existing release state; create the GitHub Release if absent;
qualify the published artifact as a consumer would; then repair the current-facing documentation and
re-qualify it.

Nothing in this stage was allowed to touch an already-irreversible surface, and none of it did:

- No `npm publish`, no `npm unpublish`, no re-publish of `0.1.0` or `0.1.1`. Neither version is
  overwriteable, and the brief forbade a release for documentation-only changes.
- No tag creation, move, deletion, or force-push. The remote ref inventory was read before Phase B
  (`phaseA-git.txt`) and re-read after it (`phaseB-refs-after.txt`); the two are byte-identical for
  `refs/heads/main`, `refs/tags/v0.1.0` and `refs/tags/v0.1.1`.
- No Git history rewrite, no branch deletion, no repository deletion. The temporary consumer
  repository was closed and **archived** (§4.6), which is reversible.
- No credential was requested, read, printed, or committed. Nothing in this stage needed one beyond
  the `gh` session already authorized for the repository owner; the npm registry reads were anonymous.

## 2. Phase A — release state, independently verified

### 2.1 Git surfaces (`phaseA-git.txt`)

| Surface                                   | Measured                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `refs/heads/main`                         | `a89d8bb7d048bfd4e016e494428d04f060e82112`                                              |
| `refs/tags/v0.1.1` (annotated tag object) | `4012aa50f83a894445975d5713cb29976bf00a61`                                              |
| `v0.1.1^{}` (peeled to commit)            | `a89d8bb7d048bfd4e016e494428d04f060e82112`                                              |
| `refs/tags/v0.1.0` / peel                 | `5311ee05e3199b84854d719453b8939c5c482dc7` → `5a50b52028ead78942ea3fc3bee93ba26e0a79cc` |
| Release commit tree                       | `f95dd3e2a9bcc9d15aaa699e404a970bb23a750a`                                              |
| Release commit subject                    | `chore(release): prepare DiffBeacon v0.1.1 candidate (#7)`                              |

The tag object was read locally as well as through the API: it names type `commit`, the tag
`v0.1.1`, and `a89d8bb…`, so the release is anchored to a commit and not to a moving branch.

### 2.2 npm registry (`phaseA-npm.txt`, `attestation-0.1.1.json`)

- `diffbeacon` → `version 0.1.1`; `versions` is exactly `["0.1.0","0.1.1"]`; `dist-tags.latest` is
  `0.1.1`.
- `dist.shasum` `4f71c7672aa000cf68903345d651e3c302965c67`; `dist.integrity`
  `sha512-y6rzeixqK5T4ieC6wkS60hzMmtZ+00wkhA+25stfMGMByYW/MfU/y2oAuqsvSW40ycJKS0recD3wk7pgWiLaGw==`;
  `engines.node` `>=22`.
- `0.1.0` is still present and unchanged: shasum `42851024caac71787f74b6fac4bea2fcbab06231`.
- Registry publish times: `0.1.1` at `2026-10-08T06:59:56.410Z`, `0.1.0` at `2026-10-06T07:12:58.935Z`.

### 2.3 Provenance re-derived, not restated (`phaseA-provenance.txt`)

The tarball was fetched over HTTPS (HTTP 200), written to `diffbeacon-0.1.1.tgz`, and hashed on this
host: **19 025 bytes**, sha512
`cbaaf37a2c6a2b94f889e0bac244bad21ccc9ad67ed34c24840fb6e6cb5f306301c985bf31f53fcb6a00baab2f496e34c9c24a4b4ade703df093ba605a22da1b`,
and `sha1sum` answers `4f71c7672aa000cf68903345d651e3c302965c67` — the registry's own `dist.shasum`.
The published bytes therefore match the file the registry describes.

The attestation (npm publish spec `v0.1`, SLSA provenance `v1`) binds that same sha512 to the subject
`pkg:npm/diffbeacon@0.1.1`, names workflow `.github/workflows/publish.yml` at `refs/tags/v0.1.1` in
this repository, records `gitCommit` `a89d8bb7d048bfd4e016e494428d04f060e82112`, names the builder
`https://github.com/actions/runner/github-hosted`, and points its invocation at
`…/actions/runs/37740211385/attempts/1`. Unpacked, the tarball is **74 394 bytes** across exactly four
files — `LICENSE` 1 080, `dist/index.js` 68 871, `package.json` 761, `README.md` 3 682.

### 2.4 Workflow runs (`phaseA-runs.txt`, `phaseA-runs-verified.txt`)

| Run           | Workflow | Event / ref     | SHA       | Result                          |
| ------------- | -------- | --------------- | --------- | ------------------------------- |
| `37740211385` | Publish  | push / `v0.1.1` | `a89d8bb` | 1 job, 18 steps, 0 non-success  |
| `37740211315` | CI       | push / `v0.1.1` | `a89d8bb` | 5 jobs, 57 steps, 0 non-success |
| `37722256817` | CI       | push / `main`   | `a89d8bb` | 5 jobs, 57 steps, 0 non-success |

Each job ran on a GitHub-hosted runner (`GitHub Actions 10000088xx`), so the publish identity is
GitHub's, not this host's. The CI lanes are `ubuntu-latest` and `windows-latest` at Node 22 and 24
plus the real-Chromium browser lane on `ubuntu-latest` / Node 24. The inventory of runs for
`a89d8bb…` contains exactly these three; nothing else was executed at the release commit.

## 3. Phase B — the GitHub Release

Before creating anything, absence was proven rather than assumed: `releases/tags/v0.1.1` answered
HTTP 404 and `gh release list` showed only `DiffBeacon v0.1.0` (`phaseB-pre.txt`,
`release-tags-v011-pre.json`). A 404 from that endpoint is evidence of absence for a repository this
session can read; it was not inferred from an empty list.

The Release was then created (`phaseB-create.txt`, `phaseB-release.txt`) and read back through the API
(`phaseB-readback.txt`, `release-v011-readback.json`, `phaseB-readback-node.txt`):

- id **`406586383`**, URL `https://github.com/Pavithran-R-A/DiffBeacon/releases/tag/v0.1.1`,
  title `DiffBeacon v0.1.1`, `tag_name` `v0.1.1`.
- `draft=false`, `prerelease=false`, published `2026-10-08T08:15:27Z`, **`assets` = `[]`** — no build
  artifact was attached, per the brief.
- `target_commitish` reads `main`; that field is a label, not the resolved target, so the commit was
  read separately: `/commits/v0.1.1` → `a89d8bb7d048bfd4e016e494428d04f060e82112`, and the ref/tag
  chain `refs/tags/v0.1.1` → `4012aa50f83a894445975d5713cb29976bf00a61` → commit `a89d8bb…` was
  re-read from the API after publication.
- The v0.1.0 Release is untouched: id `404432804`, `draft=false`, `prerelease=false`, 0 assets,
  published `2026-10-06T07:28:16Z`. The full inventory after Phase B contains exactly two Releases.

The notes body is `release-notes-v0.1.1.md`, kept outside the repository. It states the npm version,
the exact source SHA, the fixes that shipped, and the documented limitations, and it does not claim a
Marketplace listing, a Trusted Publisher rule, or a capability §6 does not support.

## 4. Phase C — consumer qualification of the published release

### 4.1 Clean-directory npm install (`phaseC-npm-install.txt`, `phaseC-npm-smoke.txt`)

`consumer-npm-v011/` was created empty, **outside every Git repository** (proven by
`git rev-parse --show-toplevel` answering `fatal: not a git repository`), and nothing was installed
from the working clone. `npm install diffbeacon@0.1.1` exited 0 with empty stderr; `npm ls --depth=0`
shows exactly one dependency, `diffbeacon@0.1.1`; the installed manifest reports `bin`
`{"diffbeacon":"dist/index.js"}`, license `MIT`, `engines.node` `>=22`, and `dependencies` `null` —
zero runtime dependencies. The lockfile's `integrity` for the installed package is byte-identical to
the registry `dist.integrity` of §2.2, so what ran is the published artifact.

`--version` printed `0.1.1` through both `node_modules/.bin/diffbeacon` and `npx --no-install`, each
exit 0. `--help` prints the `DiffBeacon 0.1.1` header and the documented usage surface.

### 4.2 Representative `review --stdin` cases (`phaseC-fixtures.txt`, `phaseC-cases-summary.txt`)

Fixtures are real `git diff` output, not hand-written diffs: the v0.1.1 release-prep change
(10 934 B), a 22-file rename change carrying `similarity index 79…93%` (107 230 B), two `R100`
workflow retirements (406 B), a legitimately empty range (0 B), a diff truncated mid-record (900 B),
the rename fixture with `86%` rewritten to `250%` twice (107 232 B), and a binary-content change
produced by `gzip` of real files (185 B).

| #   | case                     | format     | exit | stdout bytes      |
| --- | ------------------------ | ---------- | ---- | ----------------- |
| 1   | release-prep             | pretty     | 0    | 1 289             |
| 2   | legacy renames           | pretty     | 0    | 1 767             |
| 3   | R100 workflow retirement | pretty     | 0    | 903               |
| 4   | empty diff               | pretty     | 0    | 413               |
| 5   | truncated diff           | pretty     | 0    | 586               |
| 6   | bogus `similarity 250%`  | pretty     | 0    | 1 767             |
| 7   | binary + mode            | pretty     | 0    | 619               |
| 8   | legacy renames           | json       | 0    | 12 166            |
| 9   | legacy renames           | markdown   | 0    | 2 602             |
| 10  | release-prep             | json       | 0    | 5 649             |
| 11  | release-prep             | `--output` | 0    | 0 (file: 1 837 B) |

All eleven exited 0 with empty stderr. Case 6 — the out-of-range similarity class v0.1.1 repaired —
produces the same 1 767-byte pretty report as case 2, i.e. the malformed metadata is not trusted into
a different answer.

Three negative controls ran against the same installed binary with no diff on stdin: no arguments and
`--format=json` both exit **2** with usage on stderr, and a revision range outside a repository exits
**3** with `No diff available: the working directory is not a Git repository…`. Exit codes 2 and 3 are
distinct and the tool does not pretend to have analysed something.

### 4.3 Determinism and schema (`phaseC-determinism.txt`)

`schemaVersion` is the string `"1"`; two runs over one fixture produce byte-identical pretty and JSON
output; the release fixture yields 2 attention entries, 0 evidence observations and 2 order entries;
and shuffling the file records inside the diff leaves the emitted file count at 22, i.e. review order
is not input order.

### 4.4 Action qualification in a repository that is not this one (`phaseC-action-consumer.txt`)

A separate repository, `Pavithran-R-A/diffbeacon-consumer-smoke-20261008`, was created, its `main`
pushed at `f002dbeaa4f000ad7912d3dd795e64bf694d96da`, and PR #1 opened from
`feature/synthetic-session-renewal` at `71b63aa30ca7693ef121457ecc0806d922397e5c` — 1 commit,
7 files, +49 / −5. The consumer workflow is the documented form:

- trigger `pull_request` (an ordinary fork-safe event, not `pull_request_target`),
- `permissions: contents: read` and nothing else,
- `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` with `fetch-depth: 0` and
  `persist-credentials: false` — full history, no credential left on the runner,
- `uses: Pavithran-R-A/DiffBeacon@a89d8bb7d048bfd4e016e494428d04f060e82112`, the full release SHA,
- no `with:` inputs, no `run:` step, no secret reference.

Run **`37749736010`** (job **`113219738037`**) completed with conclusion `success` on
`ubuntu-latest` on a GitHub-hosted runner: 5 steps, all successful — set up, checkout, the DiffBeacon
step, checkout post, complete. The event was `pull_request`; `head_sha` was the PR head; the checkout
log records the merge commit `d2468ed7ffc69cd485232a2948cf30ad7a4f3069` ("Merge 71b63aa… into
f002dbe…"), which is the tree DiffBeacon read. A grep of the job log for secret references found
**0** beyond the runner's own environment group; the single job annotation is GitHub's own notice that
`ubuntu-latest` migrates to Ubuntu 26 on 2026-10-19, not a DiffBeacon diagnostic.

### 4.5 What the hosted run's output could and could not be shown to be

The Action's only v0.1 output is the Job Summary written to `$GITHUB_STEP_SUMMARY`. **That body is not
retrievable from the GitHub API.** Measured, not assumed (`phaseC-summary-readback.txt`):
`/check-runs/113219738037` returns `output.title`, `output.summary` and `output.text` as `null`, and
`/actions/runs/37749736010/summary`, `/actions/jobs/113219738037/summary` and
`/actions/runs/37749736010/pipelines` each answer HTTP 404. The run's success is API evidence; the
rendered panel is visible in the web UI but is not machine-verifiable here.

Because the brief requires a recorded output, the panel body was **reproduced rather than retrieved**,
and the reproduction is bounded by three fingerprints that tie the bundle being replayed to the bundle
GitHub ran (`phaseC-bundle-fetch.txt`): `raw@<SHA>`, `raw@v0.1.1` and `git show` at the release commit
all yield **60 064 bytes** with sha256
`e37f412192346e903ae88e45b3506ad9fa909b90f5655f7eec7a098790c3db42`, and `action.yml` at that commit is
224 bytes declaring `using: node24`, `main: packages/action/dist/index.js`.

The replay (`phaseC-replay-run.txt`, `run-replay.sh`, `replay-clone/`) ran that byte-identical bundle
locally against an anonymous clone checked out at `refs/pull/1/merge`, with an event JSON whose object
IDs were taken from the hosted PR object. Two runs produced exit 0, no stdout/stderr, and a
**2 377-byte** summary whose sha256 is
`7bb9dd6c885f1218a542f64b365e9d0c972b9e9f95e66cd8dcbb55a5c725426d` on both — byte-identical. Three
controls against the same bundle fail closed: `pull_request_target` exits 1 with the unsupported-trigger
message, `push` exits 1 with the pull-request-only message, and removing `GITHUB_STEP_SUMMARY` exits 1
with the required-environment message. None wrote a summary.

So the accurate statement is: the Action ran successfully at the release commit on an ordinary
`pull_request` event in another repository with `contents: read`, full history and no credential; the
bundle it loaded is cryptographically identified three ways; and the summary content attributed to it
is a local reproduction against the PR's merge commit, labelled as such.

### 4.6 Disposition (`phaseC-disposition.txt`, `phaseC-disposition2.txt`)

PR #1 was closed without merging (`state=closed`, `merged=false`), then the repository was
**archived**, not deleted: `archived=true private=false default=main has_actions=true`. After
archiving, run `37749736010` and job `113219738037` still read back with conclusion `success`, and the
branches `main@f002dbe…` and `feature/synthetic-session-renewal@71b63aa…` still exist. Archiving halts
future execution while leaving the evidence reachable, which is the reversible option.

## 5. Phase D — current-facing documentation repair

The guards were written to fail first. Before any prose changed, the six re-anchored test files were
run and the failures recorded (`phaseD-red.txt`, `phaseD-red-stage5.txt`): 9 failures across the
documentation contracts, each naming a stale v0.1.0-shaped claim, plus
`expected 'uses: Pavithran-R-A/DiffBeacon@5a50b5…' to be '…@a89d8b…'` and
`expected 'npx diffbeacon@0.1.0 --version' to match /npx (?:--yes )?diffbeacon@0\.1\.1/`. No guard was
weakened; each repair either states a current-release fact, re-anchors an existing one, or adds a
binding that did not exist before:

| File                                        | Binding added or re-anchored                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/stage10.docs-contract.test.ts`       | nine new stale-claim patterns (four from the first pass, five from the second sweep below); CHANGELOG must carry `0.1.1 — 2026-10-08`; README status block must carry both the current (v0.1.1) and historical (v0.1.0) identifiers; new case pinning the demo footer to `packages/cli`'s version |
| `tests/stage6.action-workflow-docs.test.ts` | Action version/pin/consumer-run statements re-anchored to `v0.1.1`, `a89d8bb…`, run `37749736010`                                                                                                                                                                                                 |
| `tests/stage9.package-contents.test.ts`     | `packages/cli/README.md` must name `diffbeacon@0.1.1` and `npm install diffbeacon@0.1.1`                                                                                                                                                                                                          |
| `tests/stage5.cli-arguments.test.ts`        | every `npx diffbeacon` example must carry an explicit version pin                                                                                                                                                                                                                                 |
| `tests/stage5.git-determinism.test.ts`      | the reviewed Action reference and README version moved to the v0.1.1 release commit                                                                                                                                                                                                               |
| `tests/stage14.publish-workflow.test.ts`    | new case: `publish.yml`'s header must name run `37740211385` and must no longer deny its own execution                                                                                                                                                                                            |

Two of those are worth stating plainly because they are the kind of defect a doc pass usually misses.
The first is a **demo footer**: `client/src/pages/Home.tsx` renders the release label on the live
Pages site, and nothing pinned it, so it still read `DIFFBEACON / 0.1.0` after `0.1.1` shipped. It is
now required to equal the published package's own version. The second is the **publish workflow's
header comment**, which explained that the file had never run because Stage 14 published `0.1.0` by
hand. That sentence went false when the `v0.1.1` tag pushed the workflow through its own gate; a
committed comment that denies its execution contradicts the public registry.

Prose changes: `CHANGELOG.md` gained a dated `0.1.1 — 2026-10-08` section carrying the registry time,
the commit and tag objects, the publish and CI runs, the Release id, the tarball and attestation
fingerprints, the consumer smoke and Action run, and the Job-Summary disclosure; the eight `### Fixed`
entries moved under it; `## 0.1.0 — 2026-10-06` is preserved as written. `README.md`,
`packages/cli/README.md`, `packages/action/README.md`, `docs/releasing.md`, `docs/README.md`,
`SECURITY.md`, `docs/limitations.md`, `docs/architecture/security.md` and
`docs/examples/diffbeacon-pull-request-review.yml` were re-anchored the same way, with the consumer
example moving its `uses:` reference to the full v0.1.1 release SHA and its pin-provenance note
re-dated to the 2026-10-08 measurement that checked it.

Historical records were not rewritten: the Stage 14 and Stage 16 audits, the v0.1.0 rows in the
CHANGELOG, and the v0.1.0 Release/commit/tag identifiers inside the README status block all remain as
measured, and the new guards require the README to keep naming them alongside the current ones.

**A second sweep was necessary, and it found real defects the first pattern set could not see.** A
checker only catches the wording it was written with: the four patterns above key on "is released",
`"latest":"0.1.0"`, "not yet published" and "remain v0.1.0", and none of them matched `SECURITY.md`'s
"Supported versions" section, which still declared `diffbeacon@0.1.0` the published and supported
surface and the project "at `0.1.0`", nor `docs/README.md`, which still told a reader that
`docs/releasing.md` "authorises publishing a second time" was forbidden and that the consumer example's
pin was dated 2026-10-06. Both were repaired, and five more patterns were added:
`published surface is`?diffbeacon@0\.1\.0`?`, `supported (version|surface)…0\.1\.0`,
`open-source project at`?0\.1\.0``, `authorises publishing a second time`, and `pinned on 2026-10-06`.

Each new pattern was proven against the committed text rather than asserted. `guard-sweep.mjs` and
`guard-sweep2.mjs` ran every candidate against both `git show HEAD:<file>` (the unrepaired v0.1.0-shaped
prose) and the repaired working tree; the five selected patterns each matched at least one committed
file and matched nothing afterwards (`guard-sweep.txt`, `guard-sweep2.txt`). Three rejected candidates
were equally informative: `npm view diffbeacon version` reports `0.1.0` matches the CHANGELOG's dated
`Measured 2026-10-06` line, and "the annotated tag `v0.1.0` names the release commit" still appears in
the Stage 14 passage of `docs/releasing.md` §4 — both are true history, so a pattern that fires on them
would be a guard that punishes correct prose. `current…0.1.0` matched nothing at either revision and was
dropped rather than kept as unproven decoration.

The mutation control was then run inside the real harness, not only in the sweep script: the repaired
`SECURITY.md` and `docs/README.md` were copied out, the committed (unrepaired) versions were put back in
place, and `tests/stage10.docs-contract.test.ts` answered with exactly two failures —
`SECURITY.md keeps a claim falsified at 889f52b (published surface is …)` and
`docs/README.md keeps a claim falsified … (authorises publishing a second time)`
(`phaseD-mutation-control-red.txt`). The repaired files were restored from those copies and the same run
passed 71 of 71 (`phaseD-mutation-control-green.txt`). The full six-file guard set then ran green on the
repaired tree: 6 files, 150 tests, 0 failures (`phaseD-green-guards.txt`). No assertion was removed,
narrowed, or skipped to reach that number.

One host method note belongs in the record because it changed a conclusion mid-pass: `grep -c $'\r'` on
this Git Bash counts every line of an LF-only file, so it reported 320 carriage returns in `README.md`
and the same on files this stage never touched. A direct byte count with Node reported `CR=0` on every
modified file and on the new audit, which is what `.gitattributes` (`* text=auto eol=lf`) requires and
what earlier stages measured. The grep form is not a usable EOL check here.

## 6. Requalification

The local gates were run on the documentation tree described above, in the working clone, immediately
before it was committed. `npm run verify` — one ordered gate covering source-completeness,
`format:check`, `lint --max-warnings=0`, `typecheck`, the full `npm test`, five builds, the Action-bundle
freshness check, `secret-scan`, the `SOURCE_MANIFEST.txt` drift check, CLI startup, `package-smoke` and
`action-smoke` — finished with its own closing line, `DiffBeacon source-first verification passed.`, and
exit code 0 (`phaseE-verify.txt`). Inside it, `npm test` reported **68 test files passed, 1197 tests
passed, 6 skipped** in 297s, and `package-smoke` reported `0.1.1; bin=true; engines=>=22;
tarballFiles=4; license=MIT; runtimeDependencies=0; artifactSecretFindings=0` while `action-smoke`
reported a 1250-byte Job Summary write with `pullRequestTargetRejected=true` and `partialSummary=false`.
The browser lane was also run on its own for a named artifact: `npm run test:browser` gave
**6 files, 134 tests, 0 failures**, exit 0 (`phaseE-test-browser.txt`). Both audit surfaces printed
`found 0 vulnerabilities` (`phaseE-audits.txt`). The six documentation-guard files, run as a set on the
repaired tree, gave **6 files, 150 tests, 0 failures** (`phaseD-green-guards.txt`).

`npm run manifest` was re-run after the prose and guard changes and rewrote exactly 18 hash lines — the
18 files this stage modified — with the Action bundle line unchanged at
`e37f412192346e903ae88e45b3506ad9fa909b90f5655f7eec7a098790c3db42`, which is what a documentation-only
release pass should produce. The report itself is outside the manifest by design (`docs/audits/` is
excluded), so it adds no line.

The hosted numbers below were appended after this section was first written, each naming the exact
commit it ran at, because a green run at an earlier commit does not qualify a later one. No run in this
list was allowed to stand in for a commit it does not name.

The documentation branch `docs/v0.1.1-release-finalize` reached
`59fa9a2e82bba5c614c86057fb00e9fa9a6d4f82` (tree `c21c02dd023664f4012fd0485d6ec1de4370ce9a`, parent
`a89d8bb7d048bfd4e016e494428d04f060e82112`; 20 files changed, 757 insertions, 149 deletions). Two
GitHub-hosted CI runs executed at that SHA — the workflow fires on both events, so both are the same
commit measured twice, not two commits — and each concluded `success` with all five jobs green:
`37766172833` on `push` (jobs `113274272563` Ubuntu Node 24, `113274272585` Ubuntu Node 22,
`113274272588` Windows Node 24, `113274272625` Windows Node 22, `113274272318` browser lane) and
`37766218741` on `pull_request` (`113274426266`, `113274426354`, `113274426378`, `113274426297`,
`113274426030` in the same order), recorded in `phaseE-pr-ci.txt`. Pull request #8 was then merged as a
merge commit rather than squashed or rebased: `a1b35944b5fe6a35a810a9dd9a958b2c69e61f94`, with parents
`a89d8bb7d048bfd4e016e494428d04f060e82112` and `59fa9a2e82bba5c614c86057fb00e9fa9a6d4f82`, merged
2026-10-08T10:55:25Z, so the release commit and the documentation commit both remain reachable with the
SHAs this report already names (`phaseE-merge-commit.txt`). `refs/heads/main` read back
`a1b35944b5fe6a35a810a9dd9a958b2c69e61f94` from the git host, and the run that measured that SHA —
`37766671153`, event `push` — concluded `success` with its own five jobs green: `113275909983` Ubuntu
Node 24, `113275909808` Ubuntu Node 22, `113275909702` Windows Node 24, `113275909835` Windows Node 22,
`113275909536` browser lane (`phaseE-main-ci.txt`). The release surfaces were re-read after that merge
rather than trusted from §2: `npm view diffbeacon version` returns `0.1.1` with
`dist-tags.latest = "0.1.1"`, release `406586383` is still published, non-draft, non-prerelease, with
`assets=0`, the annotated `v0.1.1` object is still `4012aa50f83a894445975d5713cb29976bf00a61`, and the
newest `publish.yml` run is still `37740211385` at `a89d8bb…` — so nothing in the merge published or
moved anything (`phaseE-surfaces-reread.txt`).

Two things this section deliberately does not contain. It does not name a hosted run for the commit that
adds these lines: a record cannot hold the measurement of its own creation, and that run is readable
from the Actions history of `refs/heads/main` instead of being asserted here. And it makes no claim about
the deployed Pages demo, which is a manual-dispatch snapshot rather than a main-branch build; what the
live site currently renders is recorded in §7 as measured, not inferred.

No npm version was published for these documentation changes, and no tag was created or moved.

## 7. Open items and limitations this stage did not close

- **GitHub Marketplace listing** — never requested, never created. Every surface statement in this
  repository continues to say so.
- **npm Trusted Publisher rule** — the publish workflow succeeded and produced a GitHub-hosted
  attestation for `0.1.1`, which is what a Trusted Publisher claims. The rule itself is managed at a
  registry endpoint that authenticates as a package owner; this pass could not read it and does not
  claim it as its own measurement.
- **No Windows-hosted consumer run** — the Action was qualified on `ubuntu-latest` in a consumer
  repository. The Windows lanes qualify the source and CLI on hosted Windows; they are not evidence
  that a consumer ran the Action on Windows.
- **The Job Summary is not API-retrievable** (§4.5). A future pass cannot verify a hosted panel body
  from the API alone; the fingerprint-then-replay method used here is the substitute, and it must be
  labelled as one.
- **Mode-only changes are unobservable on this host** — `core.filemode=false`, so `chmod` leaves
  `git status` empty and the `modeOnlyFiles` counter stayed 0 because it was never exercised, not
  because it was tested and passed.
- **Conduct intake** remains unconfigured, per
  [`stage13-release-policy-decision.md`](stage13-release-policy-decision.md); it is a post-release
  governance item, not a release prerequisite, and no step here waited on it.
- **The published `0.1.1` tarball carries a stale README, and it always will.** The `README.md` inside
  the registry artifact is 3682 bytes, SHA-256
  `571da52cf1740c1813d659647e4851dbfb885941c3f5467795ed302b4904f4ec`, byte-identical to the README at the
  release commit, and it names `diffbeacon@0.1.0` as the version on the registry with `npm view diffbeacon
version` left as the authority. Measured by unpacking the fetched tarball (`diffbeacon-0.1.1.tgz`,
  19025 bytes, SHA-256 `9d3c1d08…`, re-derived in §2.3). This is not a defect that was missed: an
  immutable version cannot be edited in place, so the only corrections available are a new publication or
  a repository-level statement. Stage 17 chose the second, and `packages/cli/README.md` now says so where
  a reader of the source would otherwise trust the frozen copy. Anyone who reads the README through
  `npm root` rather than the repository will read `0.1.0`, and no prose change here reaches them.
- **The deployed Pages demo still renders `0.1.0`, and this stage did not change that.** The site is
  built only by a `workflow_dispatch` (`pages.yml` has no push or pull-request trigger), so merging a
  `client/` change to `main` does not republish anything. Measured on the live host rather than inferred:
  the newest `github-pages` deployment is dated 2026-10-05T03:04:17Z from run `37257883015` at commit
  `85979940eef8750ccb4715c57a682d23a4e9e5ec`, `index.html` serves a 719-byte shell whose bundle is
  `/DiffBeacon/assets/index-DDHzPMhP.js`, and that 233 059-byte bundle contains the version literal
  `0.1.0` once and `0.1.1` zero times (`phaseE-pages-readback.txt`, `live-index.js`). The merged source
  builds `0.1.1` in that footer, so a reader of the demo and a reader of the repository currently see
  different version strings. Closing the gap is one manual dispatch, and publishing a public site is a
  maintainer decision rather than a step this pass was authorised to take, so it was recorded instead of
  executed.
- **Pre-1.0 surface** — `0.1.x` makes no stability promise; a later release may change output shapes.
- The temporary consumer repository is archived. Nothing pre-existing was deleted.

## 8. Evidence files

All Stage 17 evidence lives outside this repository, under
`…/Documents/Qoder/2026-09-24/904c4a23/stage17-v0.1.1-finalize/`.

| Path                                                                                                                                                                                                       | What it holds                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `phaseA-git.txt`                                                                                                                                                                                           | remote refs, tag object contents, peel, release commit/tree, subject                                                                  |
| `phaseA-npm.txt`                                                                                                                                                                                           | registry version, shasum, integrity, `versions`, `dist-tags`, `0.1.0` unchanged                                                       |
| `phaseA-provenance.txt`, `attestation-0.1.1.json`                                                                                                                                                          | tarball fetch + hashes, attestation subject/workflow/commit/builder/invocation                                                        |
| `diffbeacon-0.1.1.tgz`                                                                                                                                                                                     | the published tarball as fetched (19 025 bytes)                                                                                       |
| `phaseA-runs.txt`, `phaseA-runs-verified.txt`                                                                                                                                                              | run identity, job/step counts, runner names, per-lane detail                                                                          |
| `run-37740211385.json`, `run-37740211315.json`, `run-37722256817.json`, `jobs-*.json`                                                                                                                      | raw API responses behind those numbers                                                                                                |
| `phaseB-pre.txt`, `release-tags-v011-pre.json`                                                                                                                                                             | the 404 proving the Release was absent before creation                                                                                |
| `phaseB-create.txt`, `phaseB-release.txt`, `release-v011-readback.json`, `phaseB-readback.txt`, `phaseB-readback-node.txt`, `phaseB-refs-after.txt`, `releases-list-pre.json`                              | creation, API read-back, tag chain, unchanged v0.1.0 Release, ref inventory after                                                     |
| `release-notes-v0.1.1.md`                                                                                                                                                                                  | the Release body as published                                                                                                         |
| `consumer-npm-v011/`, `phaseC-npm-install.txt`, `phaseC-npm-smoke.txt`, `phaseC-cli-help.txt`                                                                                                              | clean-directory install, lockfile integrity, `--version`, help surface                                                                |
| `consumer-diffs/`, `phaseC-fixtures.txt`, `phaseC-cases-summary.txt`, `run-consumer-cases.sh`, `binary-scratch/`                                                                                           | real-git fixtures, the eleven cases and three controls, the driver                                                                    |
| `phaseC-determinism.txt`                                                                                                                                                                                   | schema version, byte-identical repeats, input-order independence                                                                      |
| `consumer-repo-identify.txt`, `account-repos.json`, `phaseC-repo-create.txt`, `phaseC-repo-push.txt`, `phaseC-pr-branch.txt`, `phaseC-pr-create.txt`, `consumer-pr.json`                                   | the consumer repository, its refs, PR object                                                                                          |
| `phaseC-consumer-poll.txt`, `consumer-runs.json`, `run-37749736010.json`, `consumer-run-37749736010.json`, `consumer-jobs-37749736010.json`, `jobs-…`, `phaseC-hosted-run.txt`, `phaseC-hosted-detail.txt` | the hosted `pull_request` run, job, steps, permissions, annotation count                                                              |
| `consumer-job-113219738037.log`, `phaseC-hosted-log-probe.txt`, `job-113219738037.json`, `checkrun-113219738037.json`, `consumer-ann-113219738037.json`                                                    | job log, the merge commit checkout recorded there, check-run output fields                                                            |
| `action-bundle/`, `phaseC-bundle-fetch.txt`                                                                                                                                                                | the bundle from SHA, tag and `git show`, with sizes and digests, plus `action.yml`                                                    |
| `replay-clone/`, `run-replay.sh`, `phaseC-replay-run.txt`, `phaseC-summary-readback.txt`                                                                                                                   | the replayed summary, its two-run digest, the fail-closed controls, the API absence proof                                             |
| `phaseC-disposition.txt`, `phaseC-disposition2.txt`                                                                                                                                                        | close-then-archive and the post-archive reachability read                                                                             |
| `phaseD-red.txt`, `phaseD-red-stage5.txt`                                                                                                                                                                  | the failing guard run before any prose was repaired                                                                                   |
| `guard-sweep.mjs`, `guard-sweep.txt`, `guard-sweep2.mjs`, `guard-sweep2.txt`                                                                                                                               | candidate stale-claim patterns run against `git show HEAD:<file>` and the repaired tree, per file                                     |
| `phaseD-mutation-control-red.txt`, `phaseD-mutation-control-green.txt`                                                                                                                                     | the docs-contract suite against restored unrepaired prose (2 failures) and against the repaired files (71 passed)                     |
| `phaseD-green-guards.txt`                                                                                                                                                                                  | the six guard files on the repaired tree: 6 files, 150 tests, 0 failures                                                              |
| `mutation-control/SECURITY.md.repaired`, `mutation-control/docs-README.md.repaired`                                                                                                                        | the copies used to restore the repaired files after the red control                                                                   |
| `unpack-recheck/package/`                                                                                                                                                                                  | the published tarball unpacked again, holding the 3682-byte `README.md` whose SHA-256 is quoted in §7                                 |
| `phaseE-verify.txt`                                                                                                                                                                                        | the full ordered `npm run verify` gate on the final documentation tree, with its `verify_exit=0` line                                 |
| `phaseE-test-browser.txt`                                                                                                                                                                                  | `npm run test:browser` on the same tree: 6 files, 134 tests                                                                           |
| `phaseE-audits.txt`                                                                                                                                                                                        | both `npm audit` surfaces, each `found 0 vulnerabilities`, with adjacent exit codes                                                   |
| `phaseE-commit.txt`                                                                                                                                                                                        | the documentation commit: branch, SHA, tree, parent, `name-status` file list                                                          |
| `phaseE-pr-ci.txt`                                                                                                                                                                                         | the two hosted CI runs that measured the head SHA, each with five job IDs and conclusions, plus the repository merge-method read-back |
| `phaseE-merge.txt`                                                                                                                                                                                         | pre-merge `main` SHA, the merge call, and the PR read-back showing `MERGED` with its merge commit                                     |
| `phaseE-merge-commit.txt`                                                                                                                                                                                  | `refs/heads/main` after the merge, the merge commit's two parents and committer date, and the unchanged `v0.1.1` tag object           |
| `phaseE-main-ci.txt`                                                                                                                                                                                       | the post-merge `main` run at the merge SHA, with its five job conclusions                                                             |
| `phaseE-surfaces-reread.txt`                                                                                                                                                                               | registry version and `dist-tags`, Release `406586383`, tag object, and the newest publish/Pages runs, all re-read after the merge     |
| `phaseE-pages-readback.txt`, `live-index.js`                                                                                                                                                               | the live Pages deployment record, the served shell and bundle name, and the fetched bundle behind the §7 version-literal count        |
