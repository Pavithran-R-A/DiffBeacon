# Stage 14 — v0.1.0 consumer release

This is a record of what was measured at a specific commit on a specific date, not current project
status. Later stages write their own. Nothing here is rewritten to make the repository look tidier;
corrections are appended with the date they were made.

**Scope.** Stage 14 took the already-qualified release candidate from its commit to a published npm
package, an immutable tag, a GitHub Release, and a demonstration that a repository other than this one
can consume the Action. Phases A–G (candidate selection, clean-clone qualification, artifact packing,
the pre-publication consumer smoke, and the pause at the interactive npm login/2FA boundary) are
recorded in §16 alongside this document's own phases, because they are the qualification that the
publication consumed.

**Measured commit.** `5a50b52028ead78942ea3fc3bee93ba26e0a79cc` — subject
`docs(release): date-anchor publication wording in shipped READMEs`. `main`, `origin/main`, and
`git ls-remote origin refs/heads/main` all named it at every phase boundary in this record, and the
annotated tag `v0.1.0` names it still.

**Date.** 2026-10-06. Timestamps below are registry/API/GitHub values in UTC, read from the services
that produced them, not host clocks.

**What this stage was authorized to change publicly.** One npm package (published by the package owner,
not by this pass), one annotated tag, one GitHub Release, one temporary consumer repository owned by the
same account, documentation in this repository, and one new workflow file. No pre-existing repository
was modified or deleted; no credential was read, printed, or committed.

---

## 1. Phase H — the public registry, read without credentials

Publication happened between the Stage 14 pause and this resumption; the operator performed it. This
pass verified the result rather than trusting the announcement, and published nothing.

| Question                                | Measured answer                                                                                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which account owns the package?         | `pavithran29`. Username only; `npm owner ls` also returns that account's registry email, deliberately not reproduced here. No auth configuration, token, or `.npmrc` content was read or printed at any point in this stage. |
| Version on the registry                 | `npm view diffbeacon@0.1.0 version` → `0.1.0`                                                                                                                                                                                |
| Distribution tags                       | `{"latest":"0.1.0"}` — one tag, pointing at the qualified version                                                                                                                                                            |
| Versions in the package's history       | `["0.1.0"]` only                                                                                                                                                                                                             |
| Publish time (registry `time` document) | `0.1.0` → `2026-10-06T07:12:58.935Z`; created `2026-10-06T07:12:58.684Z`; modified `2026-10-06T07:12:59.145Z`                                                                                                                |
| Tarball URL                             | `https://registry.npmjs.org/diffbeacon/-/diffbeacon-0.1.0.tgz`                                                                                                                                                               |
| Declared engine, license, repository    | `{"node":">=22"}`, `MIT`, `git+https://github.com/Pavithran-R-A/DiffBeacon.git`                                                                                                                                              |
| Unpacked size claimed by the registry   | `62773` — equal to the qualified pack                                                                                                                                                                                        |

**Byte identity against the qualified artifact.** The tarball was downloaded from the public registry
and hashed: SHA-1 `42851024caac71787f74b6fac4bea2fcbab06231`, SHA-256
`ee8ab03031e93dea3f077c1d4476c5c7b921f373b046aff32b0c96e45a1e1517`, 16869 bytes. Both qualified packs
from Phase E (`artifact/`, `artifact2/`) carry the same three values and `cmp` reports
`IDENTICAL_BYTES` against each. So for this package the registry served back exactly what `npm pack`
produced — including tar metadata; this is a measurement, not an assumption, because a rewritten header
would show up here as a differing digest.

**Member-level identity.** The public tarball extracts to exactly four files — `LICENSE` (1080 B),
`README.md` (3071 B), `dist/index.js` (57861 B), `package.json` (761 B) — and each one's SHA-256 equals
the corresponding member of the qualified extraction
(`8e2f1a4f…`, `16c1e6f4…`, `0ceb2e1e…`, `538892c5…`).

**Material scan of the downloaded package, credential-free.** No `node_modules` path, no `.npmrc`, no
`.env`, no lockfile, no `pnpm-workspace.yaml`, no source maps; the secret-shape and private-material
pattern sweeps returned 0 findings each. The published `package.json` retains a workspace-relative
`build` script path; `npm install` does not run it and no `prepare`/`prepublish` script ships, so it is
not part of the consumer contract. Recorded as a known non-defect rather than repaired, because the
released version is immutable.

**Verdict: PASS.** The published surface is the qualified artifact, from a package owner identity that
was recorded as a username, verified without credentials, and with nothing published by this pass.

## 2. Phase I — independent re-measure of the public package

Run in `stage14/phaseI-consumer`, a directory that is not this repository and not a workspace member: a
private `package.json`, no `node_modules`, no `file:`/tarball reference, and a separate npm cache so the
fetch had to be real. Node `v24.21.0`, npm `11.19.0`.

| Step                                       | Result                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm install diffbeacon@0.1.0`             | exit 0 — `added 1 package, and audited 2 packages`, `found 0 vulnerabilities`                                                        |
| Lockfile provenance                        | `resolved: https://registry.npmjs.org/diffbeacon/-/diffbeacon-0.1.0.tgz`, integrity `sha512-VoD/M96+nUA/…` — the qualified integrity |
| Installed shape                            | real directory, `isSymlink=false`; files `LICENSE`, `README.md`, `dist`, `package.json`; version `0.1.0`                             |
| Installed bundle identity                  | `dist/index.js` SHA-256 `0ceb2e1e2ff3c8b77a793d654e1b66be3eaf5a685f6d8afcd1824b85524a4275` = the qualified CLI bundle                |
| Runtime dependencies                       | `dependencies={}`, `optionalDependencies={}`, `peerDependencies={}`                                                                  |
| `npx --yes diffbeacon@0.1.0 --version`     | exit 0, stdout exactly `0.1.0`, stderr 0 bytes                                                                                       |
| `./node_modules/.bin/diffbeacon --version` | exit 0, `0.1.0` (the installed bin shim, not a bundle path)                                                                          |

**Real analysis through the published package.** The 1150-byte sample diff
(SHA-256 `a9685b15e1b4a2b19f3cfa250ae7b39b14c7bbc6b2b5581c2513b953be7fabdd`, 49 lines, four
`diff --git` blocks) was piped into `review --stdin` three ways. Each exited 0 with empty stderr and
non-empty stdout: pretty 1602 B, markdown 2332 B, JSON 4984 B. Two JSON runs were byte-identical.

The JSON carried `schemaVersion` as the string `"1"` and exactly the six contract keys
(`schemaVersion`, `summary`, `files`, `attention`, `evidence`, `reviewOrder`) with no extras;
`summary` = 4 changed files, +16, −5, 0 binary, 0 mode-only, 0 generated, 0 diagnostics; three evidence
observations; review order 1 `auth-access` → 2 `runtime` → 3 `dependencies`. That is the same map the
repository-source tests assert, produced here by the artifact a consumer installs.

**Verdict: PASS**, from the public package rather than repository source.

## 3. Phase J — the annotated tag

Preflight, in the canonical repository: `HEAD` = `origin/main` = `ls-remote refs/heads/main` =
`5a50b520…`, worktree clean (0 status entries), and `git ls-remote --tags origin` returning **0 lines**
— no `v0.1.0` existed before this step.

`git tag -a v0.1.0 5a50b520… -m 'DiffBeacon v0.1.0'` at `2026-10-06T07:26:34Z`, then a normal push of
that single ref: `* [new tag] v0.1.0 -> v0.1.0`, exit 0. No `--force`, no wildcard, no other ref sent.

| Fact                            | Value                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tag object (annotated)          | `5311ee05e3199b84854d719453b8939c5c482dc7`                                                                               |
| Peeled target `v0.1.0^{commit}` | `5a50b52028ead78942ea3fc3bee93ba26e0a79cc` — exactly the release commit                                                  |
| Tag message                     | `DiffBeacon v0.1.0`                                                                                                      |
| Tagger                          | `Pavithran R A <pavithran.ra@users.noreply.github.com>`                                                                  |
| Hosted cross-check              | `refs/tags/v0.1.0` → `object.type=tag`; `git/tags/5311ee05…` → target `5a50b520…`; `/tags` lists `v0.1.0` at `5a50b520…` |
| Remote tag refs after the push  | `v0.1.0` and `v0.1.0^{}` only — **no `@v1`, no other moving tag**                                                        |

Host note, disclosed rather than bypassed: the machine's global `core.hooksPath` shim printed
`Can't find lefthook in PATH` during the push. The push completed with exit 0 regardless;
`--no-verify` was not used.

**Immutability now applies.** `v0.1.0` will not be moved, recreated, deleted, or force-pushed. `main`
advances past it in this very stage; the tag does not follow.

**Verdict: PASS.**

## 4. Phase K — the GitHub Release

Preflight: the release list was empty (count 0). Created from `v0.1.0` at
`2026-10-06T07:28:12Z` with no assets, then read back through the API.

| Field                  | Measured value                                                               |
| ---------------------- | ---------------------------------------------------------------------------- |
| `id`                   | `404432804`                                                                  |
| `tag_name`             | `v0.1.0`                                                                     |
| `name`                 | `DiffBeacon v0.1.0`                                                          |
| `created_at`           | `2026-10-06T07:26:34Z`                                                       |
| `published_at`         | `2026-10-06T07:28:16Z`                                                       |
| `draft` / `prerelease` | `false` / `false`                                                            |
| Assets                 | 0                                                                            |
| URL                    | `https://github.com/Pavithran-R-A/DiffBeacon/releases/tag/v0.1.0` (HTTP 200) |
| Body length            | 3388 characters                                                              |

The body describes routing to the four surfaces, the pinned npm/npx instructions, the Action pin, the
browser demo, `engines.node >=22` as a floor rather than a tested matrix, private vulnerability
reporting, and the limitations — including the explicit denials that this is not a vulnerability
scanner, not an AI/LLM reviewer, not a merge-safety verdict, not a correctness oracle, and not a
test-coverage oracle. No bundle, tarball, or build output is attached: the Action's artifact is the
bundle already committed in the tree, and an attached copy would be a second, unreviewed one.

One API quirk is recorded rather than smoothed over: in the release-list view `commit_sha` is `null`
even though `target_commitish` reads `main`. The release's actual target was proven the authoritative
way — `gh api repos/…/commits/v0.1.0` → `5a50b52028ead78942ea3fc3bee93ba26e0a79cc`, and the public
release page links that same commit.

**Verdict: PASS.**

## 5. Phase L — the Action as published, at the tag

`action.yml` exists at `v0.1.0` (blob `7c2c1504…`, at the repository root where GitHub requires it)
with `runs.using: node24` and `runs.main: packages/action/dist/index.js`. Both were read twice — from
the tagged tree and from `raw.githubusercontent.com` at ref `v0.1.0` — and the two texts agree.

The bundle at that path is blob `5a32311b…`, 49418 bytes, SHA-256
`45660da735388dee35fc581e94490d2aacc295b2382f8bea23ab12dff2350049`, computed independently from
(a) the git blob at the tag, (b) the public raw file at the tag, and (c) the clean public clone checked
out at the release commit. All three equal the digest the pre-publication hosted run qualified, so the
Action a consumer pins today is byte-for-byte the artifact run `37296796659` executed. Nothing was
rebuilt, re-uploaded, or replaced to get there.

Consumer references, documented as two different things:

| Form                                                                | Property                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Pavithran-R-A/DiffBeacon@5a50b52028ead78942ea3fc3bee93ba26e0a79cc` | Recommended. Immutable, resolves to exactly the reviewed commit, cannot silently move.                                      |
| `Pavithran-R-A/DiffBeacon@v0.1.0`                                   | Exists and peels to the same commit; convenience only, and GitHub still warns on non-SHA pins in a `pull_request` workflow. |

No moving major/minor tag was created, so there is nothing to re-point and no alias that could later
drift to an unreviewed commit.

**Verdict: PASS.**

## 6. Phase M — consumed by a repository that is not this one

One temporary public repository, `Pavithran-R-A/diffbeacon-consumer-smoke-20261006`, created after
confirming the name returned HTTP 404 (so no existing repository was touched). Its `main` baseline
commit is `c8faef7264cf2b5ed8a65a93e475caf4e761feb6`; its feature branch `smoke/attention-sources` is
`5df1d1eb15736fde8eb52615b598eeb319b89695`. Contents are synthetic: a README, a `package.json`, and
files under `src/auth/` and `src/runtime/` chosen to exercise four real detector surfaces.

Its workflow — `.github/workflows/diffbeacon.yml` — is exactly the documented consumer form:
`on: pull_request`, `permissions: contents: read`, `actions/checkout` at
`3d3c42e5aac5ba805825da76410c181273ba90b1` with `fetch-depth: 0` and `persist-credentials: false`, then
`uses: Pavithran-R-A/DiffBeacon@5a50b52028ead78942ea3fc3bee93ba26e0a79cc`. No `uses: ./`, no
`pull_request_target`, no PAT, no `secrets.*`, no write permission, no `run:` step.

| Measurement           | Value                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Pull request          | `#1`, `main` ← `smoke/attention-sources`, opened not-draft, later closed                                      |
| Actions run           | `37430396143`, event `pull_request`, status completed, conclusion **success**                                 |
| Job                   | `112159653885` (`attention`), success, `07:33:27Z` → `07:33:33Z`                                              |
| Steps                 | Set up job, checkout, **`Run Pavithran-R-A/DiffBeacon@5a50b520…`**, checkout post, complete job — all success |
| DiffBeacon step log   | 153 bytes, group markers only: the Action writes to the summary, not stdout/stderr                            |
| Check-run annotations | 1, and it is GitHub's own `ubuntu-latest` → Ubuntu 26 migration notice, **not** a DiffBeacon finding          |

**The Job Summary content could not be retrieved from the hosted side, and that is recorded as a
limitation of this evidence rather than worked around silently.** The Checks API returns
`{"title":null,"summary":null,"text":null}` for Actions job summaries; the job endpoint and the run-log
archive contain no summary document; the anonymous job-page HTML carries only the step list and the
annotation count; four candidate summary URLs 404'd, at which point guessing was stopped. Reading the
panel in a browser requires a signed-in session, and this brief forbids handling credentials, so none
was requested, entered, read, or printed.

What was done instead, labelled for what it is: the bundle extracted from the tag itself
(`45660da7…`, §5) was run locally against a fresh anonymous clone of that exact repository, with the
event file carrying the two object IDs re-verified from the hosted PR object. Exit 0, stdout empty,
stderr empty, and `GITHUB_STEP_SUMMARY` written with 2664 bytes; two runs produced byte-identical
summaries (SHA-256 `5fdacb71cee252f0eae252bd9a1a81497a8f10a7dbbfbea52e111bf78747b2e2`). The map it
contains is a genuine Review Attention Map for the synthetic changes — 5 files, +26/−4, FOCUS
`Authentication / Access` (1), CHECK `Runtime Implementation` (3), CHECK `Dependencies` (1), NOTE
`Documentation / Changelog` (1), three evidence observations, a four-step review order, and the standing
"does not determine whether a pull request is safe to merge" line.

**This is a reconstruction of the summary body from the identical artifact over the identical commit
range, not a byte-for-byte retrieval of the hosted panel.** The hosted execution's own conclusion is
measured directly (success, all steps); its rendered content is proven here.

Disposition of the temporary repository: PR `#1` closed (`state CLOSED`), then the repository
**archived rather than deleted**. Deletion is irreversible and would destroy the one hosted artifact the
owner can still read and no API can return — the Job Summary panel — while archiving keeps that
evidence reachable, halts all future workflow execution on it, and stays reversible. No repository of
any kind was deleted in this stage. Cleanup is handed back:

```text
TEMP_CONSUMER_REPO_CLEANUP_REQUIRED
  gh repo delete Pavithran-R-A/diffbeacon-consumer-smoke-20261006 --yes
```

That command is destructive, needs a permission this pass does not hold, and must only be run after the
owner has read the panel above.

**Verdict: PASS with one recorded cleanup handoff.**

## 7. Phase N — current-facing documentation, and the guards over it

Order mattered: the guards were re-anchored **before** the prose, and the first test run was expected to
fail against the still-stale documents. It did — `tests/stage10.docs-contract.test.ts`,
`stage5.cli-arguments.test.ts`, `stage5.git-determinism.test.ts`, `stage6.action-workflow-docs.test.ts`
and `stage9.package-contents.test.ts` together reported **12 failed / 89 passed (101)**, every failure
naming a document that still asserted the pre-release state. (An earlier invocation of the same run
specified `--reporter=basic`, which vitest 4.1.11 removed; that startup error exit 1 qualified nothing
and is recorded so nobody reads it as a test result.)

What the re-anchored guards now require, in both directions:

- Eight publication negatives added to the staleness list — a document cannot say the package is
  unpublished, that `npm view diffbeacon` 404s, that there are zero tags/Releases, that no published
  Action version exists, that this is its first release, or that `npx diffbeacon…` does not resolve.
  Scoped so `CODE_OF_CONDUCT.md`'s still-true "has not published a moderation address" matches nothing.
- Every install instruction in a current document must name a released version; an unpinned
  `npm install diffbeacon` / `npx diffbeacon` now fails the gate.
- `CHANGELOG.md` headings must each be `Unreleased` or `X.Y.Z — YYYY-MM-DD`, and the released
  `0.1.0 — 2026-10-06` row must exist.
- The README status block must read `Published on npm? | Yes` and contain `diffbeacon@0.1.0`, `v0.1.0`,
  the full release SHA, and the release date — and must not contain the old placeholder token.
- Both Action READMEs and the example workflow must pin the reviewed SHA, cite the consumer Actions run
  and this record, reject a placeholder, reject `diffbeacon@v<digit>`, and keep every `uses:` reference
  a 40-character commit SHA.
- The CLI README must state `diffbeacon@0.1.0` and `npm install diffbeacon@0.1.0`, and must not say the
  registry is missing it or suggest a global install.

Documents changed: `README.md`, `CHANGELOG.md`, `SECURITY.md`, `docs/README.md`, `docs/releasing.md`,
`docs/examples/diffbeacon-pull-request-review.yml`, `packages/cli/README.md`,
`packages/action/README.md`, and this record. Historical Stage 10–13 audit reports,
`docs/recovery/`, and `docs/research/` were left exactly as written, including the statements there that
this release has since superseded — they are records of their own dates.

The `0.1.0` identity is not touched by any of this: a defect found after a release is fixed forward on
`main` and shipped later, never by moving the tag or editing the published version.

**Verdict: PASS.** GREEN measured after the prose change: `131 passed (131)`, `vitest_exit=0` from the
run itself (not from a pipe stage), across all five re-anchored guard files. The run was then repeated
after formatting, with the same result.

### 7.1 Guard mutation proofs

A guard that cannot fail proves nothing, so each repaired claim was reintroduced once and the guard
that owns it run against the mutation. Twelve mutations, each producing the named failure and each
restored byte-for-byte (`restored=IDENTICAL` against a pre-mutation SHA-256, then `sha256sum -c` over
all thirteen touched files: 13/13 `OK`). A control run after the last restoration returned
`131 passed (131)`, `control_exit=0`. No test file was edited by any mutation.

Script and per-mutation logs: `stage14/n3-mutation-proofs.sh`, `stage14/mutations/`.

| #   | Mutation applied                                                                             | Guard that named it                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | `SECURITY.md` re-denies publication ("No version of DiffBeacon is published.")               | `stage10 … SECURITY.md carries no claim the Stage 11 measurements falsified`                                                                  |
| N2  | CLI README re-denies the registry ("not published to the npm registry yet")                  | `stage9 … states the published version and the install path that was consumer-smoke-tested`                                                   |
| N3  | README install instruction unpinned (`npm install diffbeacon`)                               | `stage10 … README.md makes no unbacked availability claim`                                                                                    |
| N4  | `CHANGELOG.md` release heading undated (`## 0.1.0 — Unreleased`)                             | `stage10 … keeps changelog releases dated and candidates marked unreleased`                                                                   |
| N5  | Runbook re-denies the tag and Release ("there are still zero tags and zero GitHub Releases") | `stage10 … docs/releasing.md carries no claim the Stage 11 measurements falsified`                                                            |
| N6  | README re-denies the release ("It has not made its first release.")                          | `stage10 … README.md carries no claim the Stage 11 measurements falsified`                                                                    |
| N7  | Consumer example's Action reference returned to an unfilled slot                             | `stage6 … pins the reviewed release SHA rather than a placeholder`                                                                            |
| N8  | README's workflow block pins a moving tag (`@v1`)                                            | `stage6 … does not recommend a privileged trigger anywhere` **and** `stage5 … documents only runnable Action and CLI references` (2 failures) |
| N9  | CLI README unpins its `npx` example                                                          | `stage5.cli-arguments … pins every published-package example to the released version`                                                         |
| N10 | Action README drops the consumer Actions run id                                              | `stage6 … names the released Action version, its immutable pin, and its consumer proof`                                                       |
| N11 | CLI README names a version the registry does not have (`0.2.0`)                              | `stage9 … states the published version and the install path that was consumer-smoke-tested`                                                   |
| N12 | Action README replaces the release SHA with words                                            | `stage6 … names the released Action version, its immutable pin, and its consumer proof`                                                       |

Two notes on what these proofs do **not** claim. They show each guard rejects a reintroduced falsified
claim; they do not enumerate every wording a future author might invent, which is why the staleness
list is patterns rather than quoted prose and why the positive requirements (the release SHA, the
registry version, the consumer run id, the dated heading) exist alongside the negatives. And N8's two
failures are one mutation caught by two independent guards, not two mutations.

## 8. Phase O — tokenless npm publishing for the next release

**Executed on 2026-10-06 under TDD.** Two files were added and one guard file was widened:

| Path                                        | What it is                                                            | SHA-256                                                            |
| ------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `.github/workflows/publish.yml`             | the publication gate for a **future** version                         | `9b5833afd116dbc0ac78fb90d39ad5a72752a13787360bae8b1b0a036b65c1fe` |
| `tests/stage14.publish-workflow.test.ts`    | 13 contract cases over that file's committed text                     | `2f51aaa8c2cbadbcd1800c9360fddf7c1b1cb925c7dca6992fdf02967d851ed2` |
| `tests/stage6.action-workflow-docs.test.ts` | the workflow inventory now names `publish.yml` as the fourth workflow | (modified in place)                                                |

### 8.1 Red, then green

`phaseO-red.txt`: with the test written first and no workflow file present, **13 failed (13)**,
each on `.github/workflows/publish.yml does not exist: expected '' not to be ''` — the cases fail on
the missing subject, not on an assertion accident. `phaseO-green.txt`: after the workflow was written,
**13 passed (13)**, `vitest_exit=0`. `phaseO-affected-tests.txt`: the four suites this phase touches
(`stage5.git-determinism`, `stage6.action-workflow-docs`, `stage10.docs-contract`,
`stage14.publish-workflow`) run **105 passed (105)** across 4 files, `vitest_exit=0`.

No guard was weakened to reach green. Two of my own assertions were wrong in ways that would have
made them decoration, and were corrected in place: a whole-file `not.toContain('npm publish .')`
matched _inside_ `npm publish ./packages/cli`, so the single-publish rule became a count of exactly one
`npm publish` over comment-stripped text plus an equality check on the extracted run command; and
configuration-key negatives scanned prose, so `'self-hosted'` and `'cancel-in-progress'` in explanatory
comments failed the run. The fix was to scope those guards to `body()` (the file without comment lines)
and the trigger to the `on:` block, which lets the workflow _explain_ why it avoids those things
without tripping the guard that forbids doing them.

### 8.2 What the workflow commits to

One trigger (`push` of a `v*` tag), one job, GitHub-hosted `ubuntu-latest`, Node 24, `timeout-minutes: 30`,
`concurrency.group: publish-${{ github.ref }}` with **no** `cancel-in-progress`, and exactly two
permissions: `contents: read` and `id-token: write`. No npm publishing token exists in the repository,
in its secrets, or in the file — no `NODE_AUTH_TOKEN`, no `NPM_TOKEN`, no `_authToken`, no `.npmrc`, no
`secrets.` reference, no `GITHUB_TOKEN` use. Both actions are pinned to 40-hex commit SHAs with the
upstream tag named (`actions/checkout@3d3c42e5…` `# v7`, `actions/setup-node@82076278…` `# v7`).

Thirteen steps in this order: checkout, setup-node, then five guards — **refuse `0.1.0` by name**,
**require tag == `packages/cli`'s version**, **require npm ≥ 11.5.1**, **confirm `packages/core` and
`packages/action` are still private**, **refuse a version the registry already carries, and refuse a
registry that answers anything other than not-found** — then `npm ci`, `npm audit --omit=dev
--audit-level=high`, `npm audit --audit-level=high`, `npm run verify`, `npm run package-smoke`, and
finally `npm publish ./packages/cli --provenance`. The source lane's browser contract
(`DIFFBEACON_SKIP_BROWSER: '1'`) is set because the same tag push also runs `ci.yml`'s `browser` job,
which is where the Chromium surface is qualified; the harness reports the suppression rather than
pretending those cases ran.

### 8.3 The guards executed, not just read

`stage14/extract-publish-steps.mjs` pulls every step out of the committed YAML into
`stage14/publish-steps/` (`steps.json` plus one `.sh` per block script), and `stage14/phaseO-gates.sh`
runs **the extracted byte-exact scripts** — the same text a runner would execute, not a paraphrase —
against fabricated inputs. Fifteen outcomes in `stage14/phaseO-gates.txt`, host
`node=v24.21.0 npm=11.19.0 bash=5.3.15(2)-release`:

- step 03: `v0.1.0` → exit 1 with the published-and-consumed message; `v0.1.1` and `v0.2.0` → exit 0.
- step 04: `v0.1.0` against `packages/cli` `0.1.0` → exit 0; `v0.2.0` and `v9.9.9-rc.1` against the
  same manifest → exit 1.
- step 05 (six fabricated `npm` shims on `PATH`, so the committed predicate is what decides): 10.9.9,
  11.4.0, 11.5.0 → exit 1; 11.5.1, 11.19.0, 12.0.0 → exit 0; the host's real npm → exit 0.
- step 06: the repository as committed → exit 0; a fixture where `packages/action` stopped being
  private → exit 1.
- step 07 against the **live public registry**: `0.1.0` → exit 1 (`already resolves to 0.1.0`), the
  absent `0.1.1` → exit 0, and an unreachable registry (`NPM_CONFIG_REGISTRY` pointed at a closed
  local port) → exit 1 with the ECONNREFUSED text rather than a not-found. That last case is the one
  that makes the first two mean something: a network failure is not evidence of absence.

Steps 08–12 (`npm ci`, both audits, `npm run verify`, `npm run package-smoke`) were **not** executed
here: running `npm ci` in this working tree would replace the installed tree mid-stage, and they are
the subject of Phase R's independent gates. Step 13, the publish itself, was executed by nothing in any
environment, this phase included.

### 8.4 Mutation proofs

`stage14/o-mutation-proofs.sh` reintroduces each defect the brief names, runs only
`tests/stage14.publish-workflow.test.ts`, then restores the file from its own backup and compares
digests. Final run: `stage14/phaseO-mutations-v2.txt`, logs in `stage14/mutations-o/`.

| ID  | Mutation                                              | Case that failed                                                                            | Result                       |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| O1  | drop `id-token: write`                                | holds exactly the two grants Trusted Publishing needs                                       | exit 1, `restored=IDENTICAL` |
| O2  | widen `contents` to `write`                           | same case                                                                                   | exit 1, `restored=IDENTICAL` |
| O3  | add a third write scope (`packages: write`)           | same case                                                                                   | exit 1, `restored=IDENTICAL` |
| O4  | authenticate with a long-lived npm token              | same case                                                                                   | exit 1, `restored=IDENTICAL` |
| O5  | move to a self-hosted runner                          | publishes from a GitHub-hosted runner                                                       | exit 1, `restored=IDENTICAL` |
| O6  | publish `packages/action` instead of `packages/cli`   | publishes exactly the CLI workspace **and** puts every gate ahead of the registry write (2) | exit 1, `restored=IDENTICAL` |
| O7  | compare the tag against a workspace-internal manifest | refuses a tag that does not name the version                                                | exit 1, `restored=IDENTICAL` |
| O8  | strip the leading `v` from nothing                    | refuses a tag that does not name the version                                                | exit 1, `restored=IDENTICAL` |
| O9  | add a `pull_request_target` trigger                   | publishes only from a tag push                                                              | exit 1, `restored=IDENTICAL` |
| O10 | allow a later tag to cancel a publish in flight       | keeps a publish that reached the registry running                                           | exit 1, `restored=IDENTICAL` |
| O11 | unpin `actions/checkout` to a movable tag             | pins every action to an immutable commit                                                    | exit 1, `restored=IDENTICAL` |
| O12 | gut the registry-absence check                        | refuses to publish a version the registry carries                                           | exit 1, `restored=IDENTICAL` |
| O13 | point the `0.1.0` refusal at `0.2.0`                  | refuses the version Stage 14 already published                                              | exit 1, `restored=IDENTICAL` |
| O14 | run the package smoke _after_ the registry write      | puts every gate ahead of the registry write                                                 | exit 1, `restored=IDENTICAL` |
| O15 | move `publish.yml` aside entirely                     | `stage6 … is documentation, not a workflow this repository runs` (1 failed, 15 passed)      | restored, digest `9b5833af…` |

Controls in the same file: with no mutation applied, `stage14.publish-workflow` **13 passed (13)** exit
0 and `stage6.action-workflow-docs` **16 passed (16)** exit 0, and the workflow digest after the whole
run equals the digest before it (`9b5833af…`), with `git status --porcelain` showing only
`?? .github/workflows/publish.yml`.

Disclosed rather than hidden: `phaseO-mutations.txt` is the first attempt at this run and it contains a
control that proved nothing. O7's find string was written with nested shell quoting, so it matched zero
times — `O7 occurrences 0 -> 0`, `vitest_exit=0` — and the file was untouched by it. The finding was
that the _proof_ was fake, not that the guard was. O7 was rewritten to mutate the quote-free path
substring (`./packages/cli/package.json` → `./packages/core/package.json`), re-run, and is the row in
the table above. Both files are kept as evidence.

### 8.5 What Phase O does not establish

- **The workflow has never run on a runner.** Every claim in §8.2 and §8.4 is measured against the
  committed text and the locally executed extracted scripts. Nothing here is evidence about GitHub's
  interpretation of the YAML.
- **No provenance has ever been minted or consumed.** `--provenance` is asserted to be present in the
  command; no attestation exists yet for any version, `0.1.0` included, which was published by hand.
- **Publication still cannot succeed until the npm-side rule in §9 exists.** A workflow with
  `id-token: write` and no trusted publisher gets a rejection at the registry, not a release.
- **The `0.1.0` refusal is a text guard, not a registry lock.** The registry's own immutability is what
  actually prevents re-publishing `0.1.0`; the guard is there so a mislabelled future tag cannot aim
  this job at a consumed version and produce a confusing failure.

### 8.6 Gates run for this phase, and one sweep failure classified

Measured after the runbook rewrite and the formatting pass, each command's exit read on the line
adjacent to it:

| Gate                                                     | Result                                                       | Evidence                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `npm run format:check`                                   | exit 0, "All matched files use Prettier code style!"         | `phaseO-format-check.txt`, `phaseO-format-check-final.txt` |
| `npm run lint` (`--max-warnings=0`)                      | exit 0                                                       | `phaseO-lint.txt`                                          |
| `npm run typecheck`                                      | exit 0                                                       | `phaseO-typecheck.txt`                                     |
| `npm run secret-scan`                                    | exit 0 — 12 findings, 12 classified, 0 unclassified, 0 stale | `phaseO-secret-scan.txt`                                   |
| secret scan scoped to `.github/workflows`                | 4 files, 0 findings, exit 0                                  | `phaseO-secret-scan-workflows.txt`                         |
| `stage5.git-determinism`, `stage6`, `stage10`, `stage14` | 105 passed, exit 0                                           | `phaseO-affected-tests.txt`                                |
| full `source` project, default parallelism               | 1 failed / 1010 passed / 2 skipped                           | `phaseO-source-project.txt`                                |
| full `source` project, `--maxWorkers=2`                  | 60 files, 1011 passed / 2 skipped, exit 0                    | `phaseO-source-project-constrained.txt`                    |

The one failure in the default-parallelism sweep was `stage5.cli-arguments > prints the package version
for --version and -v`, `Error: Test timed out in 5000ms` at 5050 ms. Classified before moving on, not
explained away: the same file in isolation is **30 passed** in 1.47 s with that case taking 245 ms
(`phaseO-isolate-stage5cli.txt`), and the whole project under two workers passes. That is host
contention on a shared machine under 60 concurrent files, not a CLI defect — so no timeout was raised,
no test was skipped, and no vitest configuration was changed. The full-project gate belongs to §11; it
is recorded here because Phase O ran it to prove the new workflow file collides with no existing guard.

## 9. Phase P — npm trusted-publisher configuration

**Determination made; configuration is not performable from this environment.**
`NPM TRUSTED PUBLISHER MANUAL CONFIG REQUIRED`.

The mechanism was read from the installed CLI rather than invented: npm 11.19.0 ships a
`trust` command family (`commands/trust/github.js`, `gitlab.js`, `circleci.js`, `list.js`,
`revoke.js`) built on `lib/trust-cmd.js`, which POSTs the claim to `/-/package/<name>/trust`. The
GitHub claim is `{ type: 'github', claims: { repository, workflow_ref: { file } } }` with permission
`createPackage` — exactly the pairing §8's workflow needs, and it is why the workflow file's _name_ is
part of the trust relationship.

- `npm trust github diffbeacon --file publish.yml --repo Pavithran-R-A/DiffBeacon --allow-publish
--dry-run` → **exit 0**, and it stops before the network: `createConfigCommand` returns on
  `--dry-run` ahead of the confirmation and the POST. Output recorded in
  `stage14/phaseP-trusted-publisher.txt`: the three dialogue lines npm prints — including
  `Two-factor authentication is required for this operation` — the resolved claim, and the three URLs
  it would touch. Nothing was created; `--dry-run` is the only mode this environment used.
- `npm trust list diffbeacon` (read-only GET of the same endpoint, no credentials supplied) →
  **exit 1**, `npm error code EOTP / This operation requires a one-time password`. So the current
  trust configuration cannot be read anonymously either: neither confirming nor creating a rule is
  possible without authenticating as the package owner through 2FA.

One artifact disclosure. That failed listing emitted a one-time npm web-authentication URL and its
`authId`. The evidence file has both replaced with `REDACTED-ONE-TIME-AUTH-ID`; nothing opened or
visited the URL, no token was retrieved, and no credential was read, printed, or stored. The npm debug
log for the same run
(`…/AppData/Local/npm-cache/_logs/2026-10-06T09_35_03_220Z-debug-0.log`) was checked for the same
string and does **not** contain it (`grep -c` → 0), so no copy of that artifact was left behind by
this phase.

What the owner has to decide, in either order and neither from here: create the rule through npm's
website or with `npm trust github …` without `--dry-run`, then let a future `v*` tag push exercise
`.github/workflows/publish.yml` once. Only the CLI route was measured here. The website route is where
the same record is managed, but its page path was not verified from this environment: an anonymous
fetch of the package's `access` URL returned HTTP 403, which is evidence about the fetcher, not about
the page. This stage used neither route, so the workflow's first real execution remains unmeasured.

## 10. Phase Q — GitHub Marketplace eligibility

**Determination made; publication is not performable from this environment, and no term was accepted.**
`MARKETPLACE MANUAL TERMS/UI REQUIRED`.

Nothing was listed, opted into, or published. Every Marketplace read in this phase was a read-only GET
(`gh api`, `gh repo view`, one anonymous page fetch, `gh help`), and the requirement that decides the
outcome is a legal acceptance by the account owner, which this stage may not perform on their behalf.

### 10.1 What the eligibility list asks for, and what was measured

The brief's list — public repository, a root `action.yml`/`action.yaml`, a unique Action name, and
Marketplace terms acceptance, with publication associated with a release — matches what GitHub's
current publishing documentation states, and each item was measured rather than assumed
(`stage14/phaseQ-marketplace.txt`):

| Requirement                             | Measurement                                                                                                                                                    | Result                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Public repository                       | `gh repo view … --json isPrivate,visibility` → `isPrivate: false`, `visibility: "PUBLIC"`                                                                      | met                                                                                                                     |
| Root metadata file                      | `gh api repos/…/contents/action.yml?ref=v0.1.0` → `path: action.yml`, 224 B, sha `7c2c1504…`; locally `git ls-tree v0.1.0` lists exactly one root `action.yml` | met, and met **at the release tag**, not just in the worktree                                                           |
| Declared name                           | `name: DiffBeacon` in that file                                                                                                                                | present                                                                                                                 |
| Name free of collisions                 | `gh api users/diffbeacon` → HTTP 404 (no such account); anonymous fetch of the listing URL for the derived slug → HTTP 404 (no such listing)                   | consistent with "unique", not proof of it — GitHub runs its own uniqueness/reserved-name/category check at publish time |
| A release to associate the listing with | `gh api repos/…/releases/tags/v0.1.0` → id `404432804`, `draft: false`, `prerelease: false`, published `2026-10-06T07:28:16Z`                                  | met (§4's release is the one a listing would attach to)                                                                 |
| Marketplace terms acceptance            | not attempted, by design                                                                                                                                       | **not met, and not meetable here**                                                                                      |

### 10.2 Why the remaining steps cannot be done from here

GitHub's documented route is nine browser steps: open the repository page, navigate to `action.yml`,
where "you'll see a banner to publish the action to GitHub Marketplace", click **Draft a release**,
then under "Release Action" select **Publish this Action to the GitHub Marketplace**, clear any label
problems until the page says "Everything looks good!", pick the **Primary Category** (and optionally
**Another Category**) from dropdowns, type the version in the tag field and a release title, and
"Complete all other fields and click **Publish release**" — with "Publishing requires you to use
two-factor authentication." Before any of it, "the repository owner must formally agree to" the
**GitHub Marketplace Developer Agreement**.

Two independent measurements confirm there is no non-interactive equivalent:

- `gh help marketplace` → ``Unknown help topic [`marketplace`]``; the CLI's Actions-related topics are
  `cache`, `workflow`, `variable`, `actions`, none of which publishes a listing.
- `gh help release create | grep -i -E 'marketplace|listing'` → no match (exit 1). The CLI can create
  the very release the documentation makes the publishing moment, yet carries no Marketplace option, so
  the listing is not reachable through it.

So the phase ends where the brief's second branch directs: the agreement plus an authenticated,
2FA-gated web form. Accepting a developer agreement is a legal act by a human; the instruction
"do NOT accept it silently" is the reason this stage stopped at the determination rather than driving
the browser to the form.

### 10.3 Consequence for v0.1.0, and the owner's route if they want the listing

Marketplace is optional for consumer-live status, and measurably so: §6's temporary consumer repository
ran the Action from `Pavithran-R-A/DiffBeacon@v0.1.0` with no listing in existence
(`gh api users/diffbeacon` and the slug fetch above both still answer 404). The Action's discoverability
is unchanged by this phase.

If the owner later wants the listing, the steps are exactly 10.2's nine, in a browser signed in as the
package/repository owner, beginning with the Developer Agreement acceptance; the tag field in step 7
must name a release, and this stage's constraint is that `v0.1.0` stays pinned at
`5a50b52028ead78942ea3fc3bee93ba26e0a79cc` and must not be moved or recreated to satisfy a Marketplace
form. Choosing a category (steps 5–6) is a positioning decision with no correct answer derivable from
the code, which is a further reason it was not made here.

## 11. Phase R — post-release gates on the released tree

Every gate below ran on this pass's own tree: HEAD still `5a50b52028ead78942ea3fc3bee93ba26e0a79cc`,
the Phase N/O changes staged, `v0.1.0` untouched. Each command was run on its own, with its exit code
recorded next to it; `npm run verify` and `npm run check` ran one after the other, never together.

### 11.1 The four independent gates

| Gate                    | Command                     | Exit | Output                                                          |
| ----------------------- | --------------------------- | ---- | --------------------------------------------------------------- |
| formatting              | `npm run format:check`      | 0    | `All matched files use Prettier code style!`                    |
| lint                    | `npm run lint`              | 0    | no findings (`--max-warnings=0`)                                |
| types                   | `npm run typecheck`         | 0    | no diagnostics                                                  |
| secrets, before staging | `npm run secret-scan`       | 0    | `12 finding(s), 12 classified, 0 unclassified, 0 stale`         |
| secrets, after staging  | `npm run secret-scan` again | 0    | the same twelve findings — see §11.2 for why this run is a real |
|                         |                             |      | coverage increase rather than a duplicate                       |

The first `format:check` run of this phase exited **1** on
`docs/audits/stage14-v0.1.0-consumer-release.md`: the Phase Q section's two tables needed prettier's
column alignment. Before writing anything, prettier's intended output was diffed against the file and
the only difference was column width — no prose moved — so `prettier --write` was applied to that one
path and the gate re-run to exit 0. That is a formatting repair, not a test weakening.

### 11.2 Coverage, stated exactly

`scripts/secret-scan.mjs:94` enumerates `git ls-files`, so the scan reads the **index**. The pre-staging
run therefore did not cover `.github/workflows/publish.yml`,
`tests/stage14.publish-workflow.test.ts`, or this record; after `git add` all three appear in the
enumeration (verified by `git ls-files | grep -E 'publish\.yml|stage14…'`), and the script excludes
nothing by directory — only `node_modules`, unreadable content, and a size cap
(`scanRepositoryFiles`, lines 110–118). The post-staging result is the one the commit is judged on.

### 11.3 The contract suites

`npx vitest run --project source --maxWorkers=2` over the ten guard files this phase touches —
docs contract, `ci.yml` contract, browser-lane contract, self-hosted parity, the new publish-workflow
contract, Action metadata, Action docs/workflow inventory, source manifest, secret-scan contract, and
package contents — gave **10 files / 176 passed**, exit 0. It ran twice: once before the manifest was
regenerated and once after staging and regeneration, with the same totals.

An earlier attempt at this run added `--reporter=basic`, which vitest 4.1.11 does not ship; it failed
to load the reporter and executed no test (`Failed to load url basic`). That is recorded in
`stage14/phaseR-contract-suites.txt` rather than dropped, because the run that produced the numbers
above is the one with the default reporter.

### 11.4 Why Phase S is one commit and not the two suggested

The brief suggested `ci(release): prepare trusted npm publishing` and
`docs(release): record v0.1.0 consumer launch`. That split was tested rather than argued, and it does
not hold. `stage14/phaseR-split-probe.txt` runs the **committed** version of
`tests/stage6.action-workflow-docs.test.ts` (extracted with `git show HEAD:…` into a temporary path,
executed, then deleted — `ls tests | grep -c splitprobe` returned 0 afterwards) against this pass's
worktree, where both the documentation and `publish.yml` are already in place. Three of its sixteen
cases fail:

1. `says plainly that no reviewed Action version exists yet` — the old assertion requires README to
   still carry `/no published|does not exist yet|not published/i`, which Phase N legitimately removed.
   So the documentation cannot be committed by itself.
2. `is documentation, not a workflow this repository runs` — `expected [ 'ci-self-hosted-stage9.yml',
…(3) ] to deeply equal [ 'ci-self-hosted-stage9.yml', …(2) ]`. The old inventory assertion breaks as
   soon as `publish.yml` exists. So the workflow file cannot be committed by itself either.
3. `keeps the DiffBeacon reference an unmistakable placeholder` — the old case demands the
   `<REVIEWED_FULL_COMMIT_SHA>` placeholder that Phase N replaced with the real 40-hex pin.

Both directions are therefore measured on the same tree: the released-state documentation and the
publish workflow are guarded by one and the same committed test file, so they are one change set. A
finer hunk-level split was not attempted: it would need hand-built patches rather than
`git add <paths>`, and `scripts/source-manifest.mjs:48-55` hashes the **working tree**, so any commit
whose content differs from the tree at generation time would carry a manifest naming digests that
commit does not contain. Making two commits here would mean pushing a commit that fails its own
guards, which the brief's "Never weaken tests" and this record's own standard both forbid.

Phase S therefore makes one commit of the 17 staged paths, with a subject that names both halves. That
is a deviation from the brief's suggested wording, made because the measurement says the suggested
split is not coherent; it is not a commit loop, and no gate input moved.

### 11.5 Manifest governance and the no-op proof

Staging added 17 paths and nothing else: 13 already-tracked modifications, 3 new files
(`.github/workflows/publish.yml`, `tests/stage14.publish-workflow.test.ts`, this record), and the
manifest itself once it was regenerated. `git status --porcelain` after staging shows no ` M` entry, so
every file is staged in full — no partial staging was used anywhere in this stage.

`npm run manifest` then changed `SOURCE_MANIFEST.txt` by **15 added lines and 13 removed lines**, and
the two sets reconcile exactly: 13 tracked files carry a new digest because their content changed, and
precisely two paths enter the manifest for the first time —

```
9b5833afd116dbc0ac78fb90d39ad5a72752a13787360bae8b1b0a036b65c1fe  .github/workflows/publish.yml
2f51aaa8c2cbadbcd1800c9360fddf7c1b1cb925c7dca6992fdf02967d851ed2  tests/stage14.publish-workflow.test.ts
```

— matching the Phase O digests. Path counts **158 → 160**, no path removed, counted by matching the
`<64 hex><two spaces><path>` entry pattern in both versions (`git show HEAD:SOURCE_MANIFEST.txt` answers
158, the staged file answers 160) — which is also what the generator itself prints
(`SOURCE_MANIFEST.txt: 160 files`). An earlier draft of this section said "159 → 161"; that came from
deriving the entry count as total lines minus three, while `scripts/source-manifest.mjs:15-20` emits a
four-line header — three comment lines and a blank one at line 19 — before the entries, so both numbers
were one too high. The correction was measured in gate 11 and the wrong figures are disclosed here and in
`stage14/phaseR-staging.txt` rather than quietly replaced. This record is under `docs/audits/`, which the
generator excludes, so it is tracked and scanned but not manifested; that is the documented policy, and
`grep -c 'docs/audits/' SOURCE_MANIFEST.txt` answers 0.

After `git add SOURCE_MANIFEST.txt`, `npm run manifest` ran a second time and
`git diff --exit-code -- SOURCE_MANIFEST.txt` returned **0**: regeneration is a no-op on the staged tree.

### 11.6 The drivers, sequentially, including the one run that failed

`npm run verify` → **exit 0**, ending `DiffBeacon source-first verification passed.`
`npm run check` (the same driver, run only after verify finished) → **exit 0**, with
**66 test files passed** and **1144 passed | 2 skipped (1146)**. The two skips are the pre-existing,
self-reporting host limitation in `tests/stage8.invalid-byte-paths.test.ts` — "the real-Git half is
skipped because this host cannot create a filename whose bytes are not valid UTF-8" — not a case this
phase silenced. No timeout was raised, no test was skipped or edited, and no vitest configuration was
changed for this host.

Gates 7 and 8 both ran with all 17 paths staged and nothing untracked (`phaseR-verify.txt` records
`staged paths: 17; untracked remaining: 0`), but this record's §10–§11 prose kept growing afterwards, so
their bytes were no longer the bytes about to be committed. Gate 10 therefore re-ran `npm run verify` on
the then-current content. That run **failed**: `FAIL browser tests/stage7.browser-contract.test.ts` with
`Error: page.goto: net::ERR_NETWORK_CHANGED at http://localhost:60330/`, totalling
`1 failed | 65 passed (66)` test files and `1105 passed | 41 skipped (1146)` tests, `verify_exit=1`
(`phaseR-verify-final.txt`, 10:33:03Z–10:38:21Z).

Per the standing rule for this host, the failure was classified before anything else was touched. The
failing suite alone — `npx vitest run --project browser`, no flags changed — produced
**6 files passed** and **133 tests passed**, `vitest_exit=0` (10:38:41Z–10:43:47Z). `ERR_NETWORK_CHANGED`
is Chromium reporting that the host's network stack reconfigured mid-navigation on a shared machine; it is
a property of the environment, not of the page under test. The counts bear that out: gate 10 skipped 41
tests where gate 10b skipped 2, and the 39-test difference is exactly the number of tests that moved from
skipped to passed, so no test disappeared or was renamed between the runs. This stage does not have the
per-file listing for the failed run (only the summary lines were retained), so it reports the arithmetic
rather than naming which browser files were truncated. Then the full driver ran a third time on the same
content: **exit 0**, 66 files, **1144 passed | 2 skipped**, the same 12-classified secret scan, the same
package- and Action-smoke lines (`phaseR-verify-final2.txt`, 10:44:02Z–10:49:51Z). No test, timeout, or
configuration was changed between the failed run and the passing one — only the retry. This stage
therefore records the failure and its classification rather than reporting only the green run.

The driver rebuilds the artifacts, so the rebuild doubled as a reproducibility check: after verify and
check, `git diff --exit-code -- packages/action/dist/index.js` returned **0** — the tracked Action
bundle came out byte-identical — and the worktree kept no unstaged modification.

### 11.7 Debris that had to be moved before the driver could run

`scripts/verify.mjs:29-46` fails closed if `pnpm-workspace.yaml` or another obsolete surface exists in
the working tree. Two untracked files left by a different package manager on this shared host
(`pnpm-lock.yaml` 81 844 B, digest `d4c66539…`; `pnpm-workspace.yaml` 50 B, digest `d6d0c244…`) were
therefore **moved**, not deleted, to `stage14/pnpm-debris-quarantine/` with their digests recorded in
`stage14/phaseR-debris-quarantine.txt`. They were never staged, and staging them would have been a
substantive error: the release was qualified against `package-lock.json`, not a pnpm resolution.

### 11.8 Gate 11 — the trailing record amendment, and the count it corrected

§11.6's failure disclosure and the new §15 rows were written after gate 10b, so the committed bytes of
this record are not the bytes gate 10b hashed. That gap is closed by naming the gates that do cover a
`docs/audits/**` edit and running them on the final content (`stage14/phaseR-final-amendment.txt`: first
pass 10:53:53Z–10:54:24Z, then a final pass that re-measures all five gates and compares this path's
digest in the index with its digest in the worktree — they answer equal, which is what makes the measured
bytes the committed bytes. The digest itself is quoted only in that evidence file, because writing a file's
own digest into the file would change the bytes the digest covers):

| Gate                 | Command                                         | Exit | Output                                                  |
| -------------------- | ----------------------------------------------- | ---- | ------------------------------------------------------- |
| format, file         | `npx prettier --check` on this record           | 0    | `All matched files use Prettier code style!`            |
| format, whole tree   | `npm run format:check`                          | 0    | same, over every matched file                           |
| secrets, final index | `npm run secret-scan`                           | 0    | `12 finding(s), 12 classified, 0 unclassified, 0 stale` |
| manifest             | `npm run manifest`, then `git diff --exit-code` | 0    | regeneration is a no-op                                 |
| worktree             | `git diff --name-only`, `git ls-files --others` | 0    | 0 unstaged paths, 0 untracked paths                     |

For the first of those writes, prettier's intended output was diffed against the file beforehand and the
only hunk was the §15 table's column widths — no prose moved. The final content was then measured rather
than assumed: `npx prettier <this file>` on stdout diffs **0** against the file itself
(`stage14/prettier/stage14-audit.r3.pretty`), i.e. the last edits were already in prettier's form and no
write was needed, and `npm run format:check` answers 0 over the whole tree. A full third `npm run verify` was **not** run after this edit, and
this section does not claim one — a prose-only change under a manifest-excluded, contract-excluded record
directory is covered by the five gates above. (`tests/stage10.docs-contract.test.ts:12,36` deliberately
treats `docs/audits/` as a record of what was true at a commit rather than a current-facing surface, so it
cannot be the guard for a §11 wording change.)

That amendment also corrected a number in §11.5: an earlier draft reported the manifest path count as
159 → 161, measured as total lines minus three. `scripts/source-manifest.mjs:15-20` emits a four-line
header, so the real counts are 158 → 160, which is what the entry-pattern count and the generator's own
`160 files` line both answer. The wrong figures remain in `stage14/phaseR-staging.txt` with the correction
appended beneath them.

## 12. Phases S–T — commits, push, and final `main` CI

_Not yet executed in this pass._

## 13. Phase U — Pages regression, read-only

_Not yet executed in this pass._

## 14. Phase V — final consumer audit and verdict

_Not yet executed in this pass._

## 15. Evidence index

All Stage 14 evidence lives outside this repository, under
`…/Documents/Qoder/2026-09-24/904c4a23/stage14/`. The files behind the numbers above:

| Path                                                                                 | Contents                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `phaseH-live-check.txt`                                                              | registry reads, tarball and member digests, material scans, H verdict                                                                    |
| `phaseH-public/`                                                                     | the tarball downloaded from the public registry                                                                                          |
| `phaseI-consumer-smoke.txt`                                                          | fresh-install run, three output formats, JSON contract, I verdict                                                                        |
| `phaseI-consumer/`, `phaseI-cache/`                                                  | the consumer project and its separate npm cache                                                                                          |
| `phaseJ-tag.txt`                                                                     | tag preflight, creation, push, hosted cross-check, J verdict                                                                             |
| `phaseK-release.txt`, `phaseK-release-body-readback.md`, `release-notes-v0.1.0.md`   | Release creation, API read-back, body as published                                                                                       |
| `phaseL-action-at-tag.txt`, `phaseL-bundle-at-tag.js`                                | tagged `action.yml`, three-source bundle digest, the extracted bundle                                                                    |
| `phaseM-consumer-smoke.txt`                                                          | consumer repository, PR, run/job/steps, summary read-back attempts, replay, disposition                                                  |
| `phaseM-replay/`                                                                     | the anonymous clone, event file, and two byte-identical replayed summaries                                                               |
| `phaseM-m13-checkrun-raw.json`                                                       | the raw check-run object showing `summary: null`                                                                                         |
| `m14-raw.txt`, `m14-archive.txt`                                                     | PR closure and archive read-back                                                                                                         |
| `n1-red.log`, `phaseN-docs.txt`                                                      | the failing guard run against stale docs, and the Phase N record                                                                         |
| `mutations/`, `n-mutation-proofs.sh`                                                 | Phase N's twelve doc mutations, their named failures and digest checks                                                                   |
| `phaseO-red.txt`, `phaseO-green.txt`, `phaseO-affected-tests.txt`                    | Phase O's 13-failed RED, 13-passed GREEN, and the 105-passed affected-suite run                                                          |
| `extract-publish-steps.mjs`, `publish-steps/`                                        | the committed workflow split into per-step scripts, plus the fabricated `npm` version shims                                              |
| `phaseO-gates.sh`, `phaseO-gates.txt`                                                | the extracted guard scripts executed against fabricated inputs, 15 recorded outcomes                                                     |
| `phaseO-mutations.txt`                                                               | the first mutation pass, including the O7 control that applied nothing — kept as written                                                 |
| `o-mutation-proofs.sh`, `phaseO-mutations-v2.txt`, `mutations-o/`                    | the corrected full mutation run: named failures, per-file digests, and green controls                                                    |
| `phaseP-trusted-publisher.txt`                                                       | `npm trust github --dry-run` (exit 0) and the owner-authenticated `trust list` rejection                                                 |
| `phaseQ-marketplace.txt`                                                             | Marketplace eligibility reads, the documented publishing steps, the CLI-route absence checks, and the determination                      |
| `phaseR-format-check.txt`, `phaseR-lint.txt`, `phaseR-typecheck.txt`                 | the three static gates, including the first format run's exit 1 and the prettier-only repair                                             |
| `phaseR-secret-scan.txt`, `phaseR-secret-scan-post-staging.txt`                      | the scan before staging, the same scan after it, and the coverage control that shows the index is what it reads                          |
| `phaseR-contract-suites.txt`                                                         | the 176-passed contract run, twice, plus the failed `--reporter=basic` attempt kept as written                                           |
| `phaseR-staging.txt`                                                                 | the 17 staged paths, the manifest's 15/13 line reconciliation, the two new entries, the no-op proof, and the appended 158/160 correction |
| `phaseR-split-probe.txt`                                                             | HEAD's Action guard against this tree: the three named failures that make the commit set atomic                                          |
| `phaseR-debris-quarantine.txt`, `pnpm-debris-quarantine/`                            | the two untracked pnpm files moved aside, with digests, and why `verify` requires that                                                   |
| `phaseR-verify.txt`, `phaseR-check.txt`                                              | the two drivers run sequentially, both exit 0, with the 66-file / 1144-passed totals and the byte-identical rebuild                      |
| `phaseR-verify-final.txt`, `phaseR-classify-browser.txt`, `phaseR-verify-final2.txt` | gate 10's `ERR_NETWORK_CHANGED` failure on the staged tree, the isolated 133-passed browser re-run, and gate 10b's exit 0                |
| `phaseR-final-amendment.txt`                                                         | gate 11: the five gates covering the §11.6/§11.8 wording, the 158 → 160 recount, and the clean-worktree counts                           |

## 16. What this stage did not establish

- **No hosted read of the consumer Job Summary panel.** §6 explains why and what replaced it. The
  `success` conclusion is measured; the rendered panel's exact bytes are not retrieved.
- **`engines.node: >=22` is a floor, not a tested matrix.** Qualification covered Node 22.x and 24.x;
  any other Node release installs and runs this unqualified.
- **A Windows runner has not executed the Action in a repository other than this one.** The consumer
  proof ran on a hosted Linux image.
- **Trusted publishing is not yet the publishing path.** §9 records that creating _or reading_ the npm
  trust rule requires an owner-authenticated, 2FA-verified action this environment cannot take. Until
  that rule exists, §8's workflow is a prepared contract, not a demonstrated release mechanism, and the
  first publication through it remains unmeasured.
- **Conduct intake remains unconfigured**, as a post-release governance item since 2026-10-05
  ([`stage13-release-policy-decision.md`](stage13-release-policy-decision.md)); this stage changed no
  measurement about it.
- **No Marketplace listing exists, and none was requested.** §10 measured the repository-side
  eligibility and read GitHub's publishing route; the GitHub Marketplace Developer Agreement was never
  shown, accepted, or worked around, because terms acceptance is an interactive human decision.
- **No independent human reviewed the release commit as an artifact.** Release-runbook step 1.8 stays
  recorded as an operator action that was not performed as a separate review.
