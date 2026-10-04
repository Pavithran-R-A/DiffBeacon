# Release Checklist

This is the Stage 11 operator's runbook. **Nothing here authorises a release, and no step in sections
2 through 7 has been executed.** Stage 10 changed documentation only; it published no package,
created no tag or release, made no repository public, and changed no repository setting. Section 1's
steps — the qualification steps with no public side effects — have been exercised against the release
candidate on `release/v0.1.0`, step 6's matrix on GitHub-hosted runners rather than on this host, and
[`docs/audits/stage11-release-qualification.md`](audits/stage11-release-qualification.md) §7 maps
each step to the commit, command and measurement that covers it, including which ones were executed in
a clean clone of the pushed candidate and which in the working tree. Step 8, having the release commit
reviewed as an artifact by a person, is an operator action and has not been done. The package is still
not published, the repository is still private, and there is no tag, no Release, no Marketplace
listing and no Pages deployment. Every row in sections 2 through 7 is a step to be taken by a human
who has that authority, in this order, with the result recorded back into a new stage report under
[`docs/audits/`](audits/).

Read [`docs/limitations.md`](limitations.md) first: it states what the product does not do, and a
release announcement must not exceed it.

## 0. Prerequisites, re-measured 2026-10-04

Each row states a measured current state, not a hypothetical risk. Two of the five are now closed; do
not start section 2 while any row is open.

| Prerequisite                      | State measured 2026-10-04                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status and what closing it means                                                                                                                                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Development-tree dependency audit | **Closed.** In a clean `npm ci` clone of `889f52b6e53095fea978fafbe50017ff71e543db`, both `npm audit --omit=dev --audit-level=high` and `npm audit --audit-level=high` print `found 0 vulnerabilities` and exit 0. The `brace-expansion` advisory that failed this gate on 2026-09-30 was cleared by `npm update brace-expansion` in commit `9c38ed0e52255e9eee52186cfb3451f60e289e5d` — no `package.json` change, no `npm audit fix --force`, no threshold change.                                                                                | Re-measure on the exact commit you intend to release; the advisories move without a commit here, and the audit step in CI fails the run rather than the prose if they move again.                                                                                                          |
| Security reporting channel        | [`SECURITY.md`](../SECURITY.md) publishes no address and promises no response time. Stage 11 checked read-only on 2026-10-04: `GET /repos/Pavithran-R-A/DiffBeacon/private_vulnerability_reports` answered `404 Not Found`, which GitHub also returns when the viewer lacks access, so the setting is **not settled by that lookup**, and nothing here changed it.                                                                                                                                                                                 | Choose and verify one channel: a monitored address in `SECURITY.md`, or GitHub's private vulnerability reporting confirmed enabled in the repository's settings. Then re-read `SECURITY.md` so its claims match what is actually configured.                                               |
| Conduct reporting channel         | [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) states plainly that no intake exists yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Publish the same or an equivalent monitored intake.                                                                                                                                                                                                                                        |
| A CI environment that runs        | **Closed for the commit that ran.** Actions run [`37191968216`](https://github.com/Pavithran-R-A/DiffBeacon/actions/runs/37191968216) executed `.github/workflows/ci.yml` on GitHub-hosted runners at `889f52b6e53095fea978fafbe50017ff71e543db` on 2026-10-04 and passed all five jobs, including the real-Chromium browser lane on `ubuntu-latest`. Three earlier hosted runs of the same workflow failed at recorded steps, and the bootstrap era remains separate history (runs `32859849733`, `31819615124`, `31818807881` on other commits). | Let `ci.yml` run green on the **exact** commit you intend to release, and record the run ID with its SHA. A green run at an earlier commit does not qualify a later one; the lane history is in [`docs/audits/stage11-release-qualification.md`](audits/stage11-release-qualification.md). |
| Release-surface identity          | `npm view diffbeacon` returns `404`; the repository is private with zero tags and zero releases (measured 2026-10-04 through the GitHub API and the registry). No Marketplace listing exists.                                                                                                                                                                                                                                                                                                                                                      | Confirm each of these flips exactly when you expect it to, immediately before and after the step that flips it.                                                                                                                                                                            |

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

1. Confirm the package you are publishing is `packages/cli` (`diffbeacon`), that its version matches
   the intended release, and that the two private workspace packages stay private.
2. Authenticate through whatever mechanism the organisation's registry policy requires — a scoped,
   time-limited, single-package automation credential held only in the publishing environment. Never
   paste, commit, echo, or log a token value, and never put one in this document or in a stage report.
3. Publish with an explicit tag, e.g. `npm publish --tag latest`, from the clean clone built in
   section 1. Do not publish from a tree that has run `npm audit fix`.
4. Verify from outside the repository: `npm view diffbeacon version`, `npm view diffbeacon
dist.tarball`, then install the published tarball into a throwaway directory, run its `--version`
   and one real `review --stdin`, and confirm its output matches the source tests' expectation.
5. Record the published version, the SHA it was built from, and the install check in the stage report.
   If the version is wrong, `npm deprecate` it rather than republishing over it, and say so.

## 4. Create the tag and the GitHub Release

1. Tag the **exact** commit qualified in section 1 and released in section 3, with an annotated tag
   (e.g. `v0.1.0`), and push that single tag — no wildcards, no force-push.
2. Confirm the tag points at that SHA (`git ls-remote --tags`).
3. Create the Release from that tag. Its body should carry what the product does, what it does **not**
   do (link [`docs/limitations.md`](limitations.md)), the verified-install command, and nothing that
   reads like a security guarantee.
4. Do not attach build outputs the repository does not already commit; the Action's artifact is the
   bundle in the tree, so a Release asset would be a second, unreviewed copy of it.

## 5. Make the Action consumable

1. Publish only after the tag and the public repository exist; consumers pin the **full commit SHA** of
   the reviewed release, following [`docs/examples/diffbeacon-pull-request-review.yml`](examples/diffbeacon-pull-request-review.yml).
2. Replace that example's `<REVIEWED_FULL_COMMIT_SHA>` placeholder with the real SHA in a reviewed
   commit — the example is documentation, and the placeholder exists so no one can run it before a
   reviewed release exists. The test that guards the example requires it to stay non-runnable until
   then, so updating the example and updating the test happen in the same reviewed change.
3. Decide explicitly whether a moving version tag (`@v0`, `@v0.1.0`) is offered, and if it is, how it is
   re-pointed and who may re-point it. DiffBeacon's own documentation recommends immutable SHAs and must
   not contradict the release it publishes.
4. Confirm from a consumer repository, on a pull request, with `contents: read` and no PAT, that the
   Action produces the Job Summary review and fails cleanly when the checkout lacks history.
5. Do not add a `pull_request_target` workflow, a write permission, or a token-consuming step to prove
   any of the above.

## 6. Public documentation and the demo

1. Re-read every current-status claim now that the state changed — README status table,
   `CHANGELOG.md`, `SECURITY.md`, `packages/cli/README.md` install lines, and
   `packages/action/README.md`. Any "not published", "no tag", or "does not resolve" sentence that the
   release makes false has to be rewritten in the same change, with the measurement that justifies it.
2. Update `npx diffbeacon` guidance once the registry resolves it, and remove the "unavailable"
   warning from the CLI README only when a fresh install proves it.
3. Pages: `.github/workflows/pages.yml` currently builds and uploads an artifact and contains no
   deploy step. Decide whether to add one, and if you do, keep the demo static and local-only — the
   browser path must not gain a backend, telemetry, or a repository connection to be "deployed".
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
