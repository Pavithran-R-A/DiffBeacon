# Release Checklist

This is the operator's runbook. **Nothing here authorises publishing the package.** Stage 10 changed
documentation only. Stage 11 qualified the release candidate: section 1's steps — the qualification
steps with no public side effects — were exercised against it on `release/v0.1.0`, step 6's matrix on
GitHub-hosted runners rather than on this host, and
[`docs/audits/stage11-release-qualification.md`](audits/stage11-release-qualification.md) §7 maps each
step to the commit, command and measurement that covers it, including which ones were executed in
a clean clone of the pushed candidate and which in the working tree. Step 8, having the release commit
reviewed as an artifact by a person, is an operator action and has not been done. **Stage 12 executed
section 2** and the demo-deployment part of section 6: the repository is public, `main` received the
qualified commit by fast-forward with no force-push and no rewrite, private vulnerability reporting is
enabled, nothing was deleted, and `.github/workflows/pages.yml` deploys the browser demo. Stage 12's
measurements are in [`docs/audits/stage12-public-source-pages.md`](audits/stage12-public-source-pages.md).
**Stage 14 executed sections 3, 4, 5 and the current-status part of section 6** on 2026-10-06:
`diffbeacon@0.1.0` is on the public registry, the annotated tag `v0.1.0` names the release commit and
the GitHub Release was published from it, a repository other than this one ran the Action at that
commit on an ordinary `pull_request` event with `contents: read` and no token, and the current-facing
prose was re-anchored in the same change that re-anchored the guards over it. Stage 14's measurements
are in
[`docs/audits/stage14-v0.1.0-consumer-release.md`](audits/stage14-v0.1.0-consumer-release.md).
**Stage 17 finalized the second release** on 2026-10-08: `diffbeacon@0.1.1` is the published `latest`,
the annotated `v0.1.1` tag names commit `a89d8bb7d048bfd4e016e494428d04f060e82112`, GitHub Release
`406586383` was created from that tag with no assets, the publish workflow ran rather than being
described, and a second consumer repository ran the Action at that commit. Stage 17 published nothing
itself, moved no tag, and its measurements are in
[`docs/audits/stage17-v0.1.1-release-finalization.md`](audits/stage17-v0.1.1-release-finalization.md).
Section 7 describes what to do if a step has to be undone; none of its corrective paths were taken.
The rows that still describe a step as ahead of you are steps to be taken by a human who has that
authority, in this order, with the result recorded back into a new stage report under
[`docs/audits/`](audits/).

Read [`docs/limitations.md`](limitations.md) first: it states what the product does not do, and a
release announcement must not exceed it.

## 0. Prerequisites, re-measured 2026-10-04 (conduct row reclassified 2026-10-05, release-surface row re-measured 2026-10-08)

Each row states a measured current state, not a hypothetical risk. All four **prerequisite** rows are
closed; do not start section 2 while one of them is open. The fifth row, conduct intake, ceased to be
a release prerequisite on 2026-10-05 by explicit maintainer decision — see
[`audits/stage13-release-policy-decision.md`](audits/stage13-release-policy-decision.md) §1 — and it
remains true that no such channel is configured.

| Prerequisite                      | State measured 2026-10-04                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status and what closing it means                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development-tree dependency audit | **Closed.** In a clean `npm ci` clone of `889f52b6e53095fea978fafbe50017ff71e543db`, both `npm audit --omit=dev --audit-level=high` and `npm audit --audit-level=high` print `found 0 vulnerabilities` and exit 0. The `brace-expansion` advisory that failed this gate on 2026-09-30 was cleared by `npm update brace-expansion` in commit `9c38ed0e52255e9eee52186cfb3451f60e289e5d` — no `package.json` change, no `npm audit fix --force`, no threshold change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Re-measure on the exact commit you intend to release; the advisories move without a commit here, and the audit step in CI fails the run rather than the prose if they move again.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Security reporting channel        | **Closed.** GitHub private vulnerability reporting is enabled for this repository. Verified on 2026-10-04, after the repository became public: `GET /repos/Pavithran-R-A/DiffBeacon/private-vulnerability-reporting` answers `{"enabled":true}` and the public `/security` page renders the report form. [`SECURITY.md`](../SECURITY.md) now directs reporters there, still publishes no address, and still promises no response time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Nothing further to configure for security intake. Re-verify the setting if the repository is transferred or its visibility changes, and keep `SECURITY.md` describing only what is actually enabled.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Conduct reporting channel         | **Not configured — post-release governance item, not a release prerequisite since 2026-10-05.** [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) still states plainly that no conduct intake exists, and Stage 12 measured on 2026-10-04 that none can be configured from this environment: GitHub private vulnerability reporting is a vulnerability intake and is not reused for conduct complaints, discussions are disabled (the endpoint answers HTTP 410), there is no `CODEOWNERS` file, and the issue tracker is public by construction. Stage 12 closed with `CONDUCT_INTAKE_MANUAL_BLOCKER`, which was that stage's accurate verdict under the brief it was given; the 2026-10-05 decision changed the **classification**, not any measurement, and §1 of that record carries the status identifier that replaces it.                                                                                                                                                                                                                                                                                                                                                              | The repository owner creates a monitored private intake — a dedicated address or form the maintainers actually read, with who watches it and how reports are archived — publishes it in `CODE_OF_CONDUCT.md`, and proves it with a test report before advertising it. Until that is real this row stays unclosed, and **no step below waits on it**: the release process is not gated on community-governance infrastructure. When the owner does build one, publish it in `CODE_OF_CONDUCT.md` in the same change that verifies it. Inventing an address, form, or response-time promise to make this row read closed is prohibited. |
| A CI environment that runs        | **Closed for the commit that ran.** Actions run [`37191968216`](https://github.com/Pavithran-R-A/DiffBeacon/actions/runs/37191968216) executed `.github/workflows/ci.yml` on GitHub-hosted runners at `889f52b6e53095fea978fafbe50017ff71e543db` on 2026-10-04 and passed all five jobs, including the real-Chromium browser lane on `ubuntu-latest`. Stage 12 took the same measurement on `main`: run `37209952904` at the qualified commit `c76567a4da0eb0590c85e89cd6f2a2f987fd4087`, run `37215399172` at `dc1b307d02b1377080405c223551762df7fb81a1`, and run `37217173934` at `76e27288814ad5e2422b5ba13414dff0ea131977`, each with all five jobs success. Three earlier hosted runs of the same workflow failed at recorded steps, and the bootstrap era remains separate history (runs `32859849733`, `31819615124`, `31818807881` on other commits).                                                                                                                                                                                                                                                                                                                             | Let `ci.yml` run green on the **exact** commit you intend to release, and record the run ID with its SHA. A green run at an earlier commit does not qualify a later one; the lane history is in [`docs/audits/stage11-release-qualification.md`](audits/stage11-release-qualification.md), and the Stage 12 runs in [`docs/audits/stage12-public-source-pages.md`](audits/stage12-public-source-pages.md).                                                                                                                                                                                                                            |
| Release-surface identity          | **Re-measured by Stage 17 on 2026-10-08, from outside the repository.** `npm view diffbeacon version` reports `0.1.1`, `versions` is `["0.1.0","0.1.1"]`, and `dist-tags.latest` is `0.1.1`; `git ls-remote --tags` shows the annotated `v0.1.1` (object `4012aa50f83a894445975d5713cb29976bf00a61`) peeling to release commit `a89d8bb7d048bfd4e016e494428d04f060e82112`; the GitHub API reports Release `406586383` published from that tag with no draft, no prerelease and no attached assets; the npm attestation for the published tarball names that same commit and a GitHub-hosted builder; and a repository other than this one ran the Action at that commit. Both earlier surfaces still hold and cannot be reclaimed: Release `404432804` at `v0.1.0` → `5a50b52028ead78942ea3fc3bee93ba26e0a79cc` is unchanged, and `0.1.0` is still on the registry with its original shasum. A GitHub Marketplace listing was not requested and was not created, so that surface is unchanged. Stage 12's repository-surface measurements still stand: `GET /repos/Pavithran-R-A/DiffBeacon` reports `"visibility": "public"` with `"default_branch": "main"`, and Pages serves the demo. | Read each surface back immediately after the step that flips it, and again after any later commit, from a directory that is not this repository. A number restated from an earlier stage report is not a measurement; the surfaces move without a commit here.                                                                                                                                                                                                                                                                                                                                                                        |

## 1. Pre-release qualification (no public side effects)

1. Check out the intended release commit in a **clean clone** (`git clone`, then `npm ci`) — never a
   working tree with host debris or a foreign lockfile.
2. Run `npm run verify`. It is one ordered gate: source-completeness, format, lint, typecheck, tests,
   build, artifact freshness, secret scan, manifest drift, CLI startup, package smoke, Action smoke.
3. Confirm the committed Action bundle equals a fresh rebuild
   (`npm run build:action` then `git diff --exit-code -- packages/action/dist/index.js`).
4. Confirm `SOURCE_MANIFEST.txt` is current (`npm run manifest` changes nothing).
5. Re-measure the audit surfaces and write the numbers down with the date and the commit:
   `npm audit --omit=dev --audit-level=high`, then `npm audit --audit-level=high`.
6. Run the clean-clone matrix on both operating systems at Node 22 and Node 24, and the real-Chromium
   browser suite where an engine is installed. Record skipped cells with their reason instead of
   dropping them.
7. Pack without publishing (`npm pack --dry-run` from `packages/cli`) and confirm the tarball contains
   exactly the intended files — the bundle, `README.md`, `package.json`, `LICENSE` — and nothing else.
8. Have the release commit reviewed as the artifact: the bundle and the workflow pins are part of the
   diff under review, not build-time surprises.

Stop here if any step fails, and record why in a stage report rather than proceeding with a caveat.

## 2. Make the repository public and settle its main branch

**Executed on 2026-10-04 by Stage 12**, measured in
[`docs/audits/stage12-public-source-pages.md`](audits/stage12-public-source-pages.md). Step 1's
agreement is the Stage 12 brief itself. Step 2: the repository reports `"visibility": "public"`,
`"private": false`, `"default_branch": "main"`; issues are enabled with 12 labels; private vulnerability
reporting answers `{"enabled":true}`; the conduct intake from section 0 is still open; and there is
**no** branch protection to settle — `main` had zero rulesets before the visibility change and zero
after, and the legacy protection endpoint answers `404`, so none was added or removed. Steps 3 and 4:
`main` was advanced to the qualified commit `c76567a4da0eb0590c85e89cd6f2a2f987fd4087` by a
fast-forward push only — no force-push, no rewrite — and that SHA was read back from the remote.
Stage 12 then added documentation and Pages-workflow commits on top of it, so `main`'s head is a
successor of the qualified commit rather than equal to it; each successor is gated by its own green
`ci.yml` run, recorded with its SHA in the Stage 12 record, which is the same discipline step 4 asks
for. Step 5: nothing was deleted — the rescue branches and `release/v0.1.0` all remain on the remote.

1. Agree the visibility change and the default branch with the maintainers before doing either.
2. Make the repository public, then re-check the settings that documentation depends on: issues
   enabled or disabled as intended, branch protection on `main` if used, and the security/conduct
   intake from section 0.
3. Merge the qualified branch into `main` by ordinary review. Do not rewrite the branch, do not
   force-push, and do not merge a commit that was not the one qualified in section 1.
4. Confirm the release commit SHA on `main` equals the SHA qualified in section 1. If they differ, the
   qualification no longer applies and section 1 must be re-run against the new SHA.
5. Delete nothing yet — including the temporary Stage 9 branch and its workflow — until the release is
   recorded; they are the evidence for what was measured.

## 3. Publish the npm package

**Executed twice: by hand on 2026-10-06 for `diffbeacon@0.1.0`, and through this section's own gate on
2026-10-08 for `diffbeacon@0.1.1`.** The `0.1.0` publication was performed by the package owner from
the tarball qualified in section 1; Stage 14 did not publish, did not authenticate as a publisher, and
did not read any registry credential. What Stage 14 did was read the public registry without
credentials, prove the published tarball byte-identical to the qualified pack (SHA-256 `ee8ab03031e93dea3f077c1d4476c5c7b921f373b046aff32b0c96e45a1e1517`),
and install and run the package from a fresh directory that was not this repository. The measurements
are in
[`docs/audits/stage14-v0.1.0-consumer-release.md`](audits/stage14-v0.1.0-consumer-release.md).

`0.1.1` went the other way: Stage 16 pushed the annotated tag, `.github/workflows/publish.yml` ran on a
GitHub-hosted runner and published it (Actions run `37740211385`, 18 steps, all green, no credential in
this repository), and Stage 17 then re-fetched the published tarball and hashed it — 19025 bytes,
`dist.shasum` `4f71c7672aa000cf68903345d651e3c302965c67`, SHA-256
`9d3c1d085523bd60969a92e9f68936c0cbad8dac9d3d44cb84b29b6c36f9505f` — and installed and ran it from a
clean directory. Those measurements are in
[`docs/audits/stage17-v0.1.1-release-finalization.md`](audits/stage17-v0.1.1-release-finalization.md).

Both versions are now permanently consumed and immutable: never publish over either, never
`npm unpublish` one because a later commit looks better, and never re-run this section for them. The
steps below are the procedure for the **next** version.

1. Confirm the package you are publishing is `packages/cli` (`diffbeacon`), that its version matches
   the intended release, and that the two private workspace packages stay private.
2. Confirm a Trusted Publisher rule exists for `diffbeacon`, naming this repository and **this
   workflow file**. npm's own CLI carries the operation —
   `npm trust github diffbeacon --file publish.yml --repo Pavithran-R-A/DiffBeacon --allow-publish`
   (`--dry-run` prints the claim it would make and contacts nothing). The rule is recorded at the
   registry endpoint `/-/package/diffbeacon/trust`, which the CLI's dry run names, and the CLI also
   prints the package's page on `www.npmjs.com` as the human-facing route. Either route authenticates
   as a package owner and requires two-factor verification, so it is an owner action that an audit pass
   cannot perform and cannot verify from outside — the read is gated the same way as the write, and
   asking the registry anonymously answers with a request for a one-time password. Creating the rule is
   not a credential: nothing token-shaped is minted, stored, or needed. The workflow file name is part
   of the claim, so renaming `publish.yml` breaks publication until the rule is updated in the same
   change.
3. Publish by pushing the annotated release tag (section 4), not by running a publish command from
   this machine. `.github/workflows/publish.yml` fires on a `v*` tag push on a GitHub-hosted runner,
   holds exactly `contents: read` and `id-token: write`, mints the short-lived OIDC credential that
   npm exchanges for the upload, refuses `0.1.0` by name, refuses a tag that does not equal
   `packages/cli`'s own version, refuses a version the registry already answers for (which is what
   would stop a second attempt at `0.1.1`), refuses a registry
   that answers anything _other_ than not-found, requires npm 11.5.1 or newer, confirms the other two
   workspace packages are still private, and only then runs `npm ci`, both audit surfaces,
   `npm run verify`, a fail-closed real-Chromium `npm run test:browser`, and
   `npm run package-smoke` before `npm publish ./packages/cli --provenance`. The explicit browser
   step belongs to the publish job itself: a tag push also starts `ci.yml`, but two workflows run
   independently, so a green browser job elsewhere cannot be a prerequisite for an irreversible
   registry write unless the publish job waits for it. The workflow has now run, once, and shipped:
   `0.1.1` was published by it rather than by a hand. The one-time shape of that execution is the
   reason section 1's "run it on the exact commit" rule applies here as it does anywhere — the run
   that published is identified by its ID (`37740211385`) and its commit (`a89d8bb…`), not by this
   paragraph.
4. Verify from outside the repository: `npm view diffbeacon version`, `npm view diffbeacon
dist.tarball`, then install the published tarball into a throwaway directory, run its `--version`
   and one real `review --stdin`, and confirm its output matches the source tests' expectation.
5. Record the published version, the SHA it was built from, and the install check in the stage report.
   If the version is wrong, `npm deprecate` it rather than republishing over it, and say so.

## 4. Create the tag and the GitHub Release

**Executed on 2026-10-06 by Stage 14** for `v0.1.0`, **on 2026-10-08 by Stage 16** for `v0.1.1`, and
**on 2026-10-08 by Stage 17** for the `v0.1.1` Release. Stage 14's steps ran after the registry and
public-install verifications in
section 3 passed. Step 1: the annotated tag `v0.1.0` (tag object `5311ee05e3199b84854d719453b8939c5c482dc7`)
was created at exactly the release commit `5a50b52028ead78942ea3fc3bee93ba26e0a79cc` and pushed alone —
no wildcard, no force-push, and `main` already named that commit. Step 2: `git ls-remote --tags`
peels it to that SHA. Steps 3 and 4: GitHub Release `404432804` was created from the tag, published
(not draft, not prerelease) with **zero attached assets**, so the Action's reviewed bundle in the tree
remains the only copy of itself. That tag is now public forever: do not move, recreate or delete it; a
defect found afterwards is fixed forward onto `main` and shipped as a later version.

The same procedure at `v0.1.1`, measured the same way: the annotated tag (object
`4012aa50f83a894445975d5713cb29976bf00a61`) names commit `a89d8bb7d048bfd4e016e494428d04f060e82112`,
which `main` also named, and was pushed alone by Stage 16 — the push of that tag is what started the
publish run in section 3. Stage 17 first proved no Release existed for it (the tags endpoint answered
HTTP 404 while the Releases list showed only `v0.1.0`), then created Release `406586383` from the tag,
published, not draft, not prerelease, with **zero attached assets**, and read the tag → object → commit
chain back out of the API afterwards. `target_commitish` on a Release is a label rather than the
resolved commit, so the resolution was verified separately through `/commits/v0.1.1`. Neither tag was
moved, recreated, or deleted, and no branch was force-pushed.

1. Tag the **exact** commit qualified in section 1 and released in section 3, with an annotated tag
   (e.g. `v0.1.0`), and push that single tag — no wildcards, no force-push.
2. Confirm the tag points at that SHA (`git ls-remote --tags`).
3. Create the Release from that tag. Its body should carry what the product does, what it does **not**
   do (link [`docs/limitations.md`](limitations.md)), the verified-install command, and nothing that
   reads like a security guarantee.
4. Do not attach build outputs the repository does not already commit; the Action's artifact is the
   bundle in the tree, so a Release asset would be a second, unreviewed copy of it.

## 5. Make the Action consumable

**Executed on 2026-10-06 by Stage 14.** Steps 1 and 2: the consumer example at
[`docs/examples/diffbeacon-pull-request-review.yml`](examples/diffbeacon-pull-request-review.yml)
pinned `5a50b52028ead78942ea3fc3bee93ba26e0a79cc`, the commit the annotated tag peels to, and the
guard that kept the example deliberately unrunnable was re-anchored in the same change to require that
SHA and reject any placeholder. Step 3, decided explicitly: **no moving version tag was created** —
neither a major nor a minor alias exists, none will be re-pointed, and the full commit SHA is
therefore the only Action reference this repository publishes, so its documentation cannot contradict
the release. Step 4: a repository other than this one ran the Action at that commit on an ordinary
`pull_request` event with `contents: read`, no PAT, no write permission, and no `uses: ./` anywhere in
its workflow; the Job Summary carried a genuine Review Attention Map for that pull request's synthetic
changes. Step 5 held: no `pull_request_target` workflow, write permission or token-consuming step was
used to prove any of it, and the temporary repository was archived rather than deleted so the hosted
run stays readable.

**Executed again on 2026-10-08 by Stage 17, and this time the pinned commit is a different one.** Steps
1 and 2: the same consumer example now pins
`a89d8bb7d048bfd4e016e494428d04f060e82112`, the commit the annotated `v0.1.1` tag peels to, and the guard
over the example was re-anchored to that SHA in the same change — the `5a50b52…` pin above was never
loosened, it was replaced, which is the only distinction that matters for a document a consumer copies.
Step 3 held unchanged: still no moving version tag, no major or minor alias, so the full commit SHA
remains the only Action reference this repository publishes. Step 4: a second consumer repository, on an
ordinary `pull_request` event with `contents: read`, no PAT, and no write permission, ran the Action at
that commit as hosted run [`37749736010`](https://github.com/Pavithran-R-A/diffbeacon-consumer-smoke-20261008/actions/runs/37749736010)
(job `113219738037`, five steps, all green); the checkout had full history, and the bundle that executed
was fetched three ways at that commit and hashed identically each time. What that run could not be made to
prove is recorded rather than glossed: GitHub exposes no Job Summary body through any API endpoint, so the
review text is reproduced from the Action's own replayed output rather than read back from the run, and the
consumer repository's pull request was closed and the repository archived, not deleted. The full
measurement, including the three control runs that must and did exit `1`, is in
[`audits/stage17-v0.1.1-release-finalization.md`](audits/stage17-v0.1.1-release-finalization.md) §4.

For the next release:

1. Publish only after the tag and the public repository exist; consumers pin the **full commit SHA** of
   the reviewed release, following [`docs/examples/diffbeacon-pull-request-review.yml`](examples/diffbeacon-pull-request-review.yml).
2. Re-pin that example to the new release commit in a reviewed commit. The guard over the example
   requires an immutable 40-character SHA and rejects a placeholder, so updating the example and
   updating the guard happen in the same reviewed change.
3. Keep the full-commit-SHA decision unless a moving tag is adopted deliberately, in which case record
   who may re-point it and how, and say so wherever the SHA recommendation is made today. DiffBeacon's
   own documentation recommends immutable SHAs and must not contradict the release it publishes.
4. Confirm from a consumer repository, on a pull request, with `contents: read` and no PAT, that the
   Action produces the Job Summary review and fails cleanly when the checkout lacks history.
5. Do not add a `pull_request_target` workflow, a write permission, or a token-consuming step to prove
   any of the above.

## 6. Public documentation and the demo

1. Re-read every current-status claim now that the state changed — README status table,
   `CHANGELOG.md`, `SECURITY.md`, `packages/cli/README.md` install lines, and
   `packages/action/README.md`. Any "not published", "no tag", or "does not resolve" sentence that the
   release makes false has to be rewritten in the same change, with the measurement that justifies it.
   **Done for `0.1.0` by Stage 14**, in the change that also re-anchored
   `tests/stage10.docs-contract.test.ts`: the publication negatives that prose used to carry are now
   forbidden there, so a repair cannot quietly reintroduce one. **Done again for `0.1.1` by Stage 17**,
   which re-read every one of those files and found two claims the second release had made false without
   announcing itself: the README status rows still named `0.1.0` as the published surface, and the publish
   workflow's own header asserted that it had never run. Both were rewritten in the change that re-anchored
   the guards, and the measurement that proves each guard bites — red against the unrepaired prose, green
   against the repaired — is recorded in
   [`audits/stage17-v0.1.1-release-finalization.md`](audits/stage17-v0.1.1-release-finalization.md) §5.
2. Pin every published-package instruction to a released version, and prove a fresh install before
   advertising it. For `0.1.0`, Stage 14 pinned the current-facing examples to `npm install
diffbeacon@0.1.0` and `npx --yes diffbeacon@0.1.0`, both measured against the public registry from a
   directory that was not this repository; the CLI README's "unavailable" warning was removed only after
   that install and run succeeded. **Re-measured for `0.1.1` on 2026-10-08 by Stage 17:** every
   current-facing install and `npx` line in `README.md` and `packages/cli/README.md` now names
   `diffbeacon@0.1.1`, and each was run against the public registry from a clean directory outside this
   repository before the wording landed — `--version` plus eleven `review --stdin` cases that exited `0`
   and three controls that exited `2`/`2`/`3`, recorded in
   [`audits/stage17-v0.1.1-release-finalization.md`](audits/stage17-v0.1.1-release-finalization.md) §4.2.
   An unpinned `latest` instruction is not how a qualified release is documented, and neither is a pinned
   line nobody installed. One consequence of pinning to an immutable version is worth stating for the next
   release too: the `README.md` inside a published tarball is frozen at its release commit, so it will name
   an older version as the registry release once a newer one exists. That text cannot be corrected without
   publishing a new version, so the repository's current-facing README carries the correction and the
   archived tarball keeps its own history.
3. Pages: **done for the demo on 2026-10-04 by Stage 12.** `.github/workflows/pages.yml` now builds
   `client/` under the repository base path, configures Pages, uploads `dist/`, and deploys it with
   `actions/deploy-pages`, pinned to resolved immutable commit SHAs; the site is live at
   `https://pavithran-r-a.github.io/DiffBeacon/`, the URL the deploy step itself reports. The demo
   stayed static and local-only, which is the part of this row that is a product constraint rather than
   a deployment detail: on the deployed page, analyzing a pasted diff produced zero `fetch`,
   `XMLHttpRequest` and `sendBeacon` calls, one origin, and no `localStorage`, `sessionStorage`, or
   cookie writes. Any change that would give the browser path a backend, telemetry, or a repository
   connection is a product change and needs its own stage, not a workflow edit.
4. Remove or mark as historical any root file that would read as current status after the release,
   using Git rename so the evidence survives; see [`docs/audits/legacy/`](audits/legacy/).

## 7. Rollback and abort

- **Before** the public steps, aborting costs nothing: stop, record what was measured, and leave the
  tree where it is. Documentation-only changes need no rollback.
- **After** an npm publish, the version is permanently consumed. `npm deprecate diffbeacon@<version>
"<reason>"` is the corrective; do not re-publish the same version number over it, and do not
  `npm unpublish` a version consumers may already have installed without deciding that publicly.
- **After** a tag or Release, do not move or delete the tag. Point a new annotated tag at a corrected
  commit, record the relationship between the two, and edit the Release notes to say what changed.
- **After** the Action was consumed, treat the exposed SHA as public forever: announce the replacement
  pin, and deprecate the Release rather than rewriting history.
- If the secret scan, manifest gate, or a bundle-freshness check fails after any step, that is a
  stop-and-record condition, not a warning to note afterwards.
- Whatever the outcome, write what actually happened — including a failed or skipped step — into a new
  report under [`docs/audits/`](audits/). An unexecuted checklist row must never be summarised as a
  pass.

## Ground rules for the operator

- One stage, one boundary. A release step that changes repository settings, registry state, or public
  visibility needs its own authorization; a passing test suite is not that authorization.
- Record commands and their real output. Never restate a number from an earlier stage report as if it
  were measured today; the audit condition in section 0 moved on its own, without a commit here.
- Never commit a credential, registration token, OTP, or cookie to any file in this repository,
  including this checklist and any stage report. `npm run secret-scan` is a gate, not a formality.
