# Stage 12 — public source repository and live browser surface

STATUS: **the two surfaces this stage owns are public and verified** — the source repository, whose
`main` branch carries the Stage 11 qualified candidate, and the browser demo, served by GitHub Pages
at the URL in §11.4. **No package surface was released** (§13): no npm publication, no `v0.1.0` tag,
no GitHub Release, no Marketplace listing. **One operator prerequisite remains open:
`CONDUCT_INTAKE_MANUAL_BLOCKER`** (§7), so the release process is not fully unblocked.

STARTING SHA: `c76567a4da0eb0590c85e89cd6f2a2f987fd4087` (`c76567a`), the Stage 11 qualified release
candidate and the tip of `origin/release/v0.1.0`.

Everything below is a measurement taken on 2026-10-04; times are UTC and each block names its own.
Raw transcripts, hosted-run JSON, the secret-scan output and the live-page browser log live
**outside** the repository, in `…/904c4a23/stage12/`, because they name host paths and carry
credential-shaped canary text. §14 maps each claim to the file holding its transcript.

---

## 1. What this stage was, and what it deliberately was not

Stage 12 begins **after** qualification. Its job was to make the project's source and browser surface
genuinely public and consumer-ready without touching the package release. It therefore did not
re-run Stage 11's four-cell clean-clone qualification matrix, did not rebuild or re-measure the
npm tarball surfaces, and did not create a tag or a Release.
[`stage11-release-qualification.md`](stage11-release-qualification.md) remains the qualification
record for `c76567a`; nothing here supersedes it.

The one rule that could pull qualification back into this stage is that a change to a **gate input**
must be shown green. Stage 12 changed gate inputs twice — once in CI/workflow configuration and once
in current documentation — and each of those commits was measured by a hosted run **of its own SHA**
(§10) rather than being folded into an earlier run. No lockfile, `package.json`, source file, build
configuration, or shipped artifact was changed by this stage, which is why the artifact-level
qualification in Stage 11 §6 still describes the bytes that are live.

## 2. Commits created by this stage

| Commit      | Message                                                           | Files it moves                                                                                                   | Its own hosted gate                                        |
| ----------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `dc1b307`   | `docs(security): enable private vulnerability reporting guidance` | `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/releasing.md`, `SOURCE_MANIFEST.txt` (3 digests)                      | CI run `37215399172` (§10)                                 |
| `76e2728`   | `ci(pages): deploy browser demo with GitHub Pages`                | `.github/workflows/pages.yml`, `tests/stage9.ci-contract.test.ts`, `SOURCE_MANIFEST.txt` (2 digests)             | CI run `37217173934` and Pages run `37217200407` (§8, §10) |
| this commit | `docs: record public source deployment`                           | `README.md`, `CHANGELOG.md`, `docs/README.md`, `docs/releasing.md`, `SOURCE_MANIFEST.txt` (4 digests), this file | reported in the stage scoreboard, not here — see §14       |

Every one of these commits is a normal forward push on `main`. No force-push, no history rewrite, no
branch or tag deletion occurred at any point in this stage; §5, §6 and §8 each re-read the refs to
prove it. `origin/rescue/stage0-source`, `origin/rescue/stage9-selfhosted-ci`,
`origin/tmp/stage9-selfhosted-smoke` and `origin/release/v0.1.0` are all still present with the SHAs
recorded in §5.2.

## 3. PHASE A — the boundary, stated before anything was changed

Measured 2026-10-04T13:40:22Z (`phaseA-boundary.txt`). The checked-out branch was
`release/v0.1.0` at `c76567a4da0eb0590c85e89cd6f2a2f987fd4087`, and `origin` resolved to
`https://github.com/Pavithran-R-A/DiffBeacon.git` for both fetch and push. `git fetch origin --prune`
exited 0 and `git status --short` was **empty at entry** — the pnpm files described in §14.3 arrived
later in the stage, not before it.

The topology that made §5.1 possible was measured, not assumed: `origin/main` was still the
pre-qualification `e0ff98143bfe39c80c338518d006525a846a8739`, `git merge-base --is-ancestor
origin/main origin/release/v0.1.0` exited **0**, and the ahead/behind count between them was `0 76` —
`main` held nothing the candidate lacked, and the candidate was 76 commits ahead. No local `main`
branch existed yet.

## 4. PHASE B — would publication expose anything? (read-only, before the fact)

This ran **before** the visibility change, because publication is the irreversible step
(`phaseB-CONCLUSION.md`, 13:49:45Z–14:13:12Z, on the candidate tree with a clean worktree at every
start and end check). No value was echoed to any terminal or log: the project's own scanner is
designed so a match's value never enters its report (`scripts/secret-scan.mjs:3`).

| Surface scanned                        | Measurement                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tracked tree                           | `npm run secret-scan` → `12 finding(s), 12 classified, 0 unclassified, 0 stale`, exit 0. All 12 are reviewed test fixtures (throwaway npmrc, a documented non-functional AWS example key id, 8 falsification canaries).                                                                                                                                            |
| Tracked configuration                  | `ENV_TRACKED_COUNT=0`; `.npmrc` is 42 bytes / 3 keys (`engine-strict`, `fund`, `audit`) with `AUTHKEY_HITS=0`; no `${{ secrets.* }}` reference exists in any workflow; the only address-shaped strings are `.invalid` fixtures and GitHub **noreply** addresses.                                                                                                   |
| Every historical blob                  | `stage12/tools/scan-history.mjs` replays the same 8 rules over `git rev-list --objects --all`: 801 objects, 417 blobs scanned, 13 findings across all history, **0 outside `tests/`**. Coverage was measured first: the clone's confined refspec had hidden two remote branches, so a full `+refs/heads/*` fetch was taken and the 5 tips matched `git ls-remote`. |
| Built artifacts                        | Tracked `packages/action/dist/index.js` and on-disk `packages/cli/dist/index.js`: 0 machine-path markers, 0 credential shapes.                                                                                                                                                                                                                                     |
| 68 Actions runs (public after PHASE E) | 21 GitHub-hosted qualification job logs: 0 credential shapes, 0 env-dump markers, 0 `C:\Users` markers. 6 self-hosted logs (fetched, all in retention): 0 credential shapes, **but they do publish machine-local absolute paths and the operator's local account names**.                                                                                          |

**Verdict: no credential blocker; publication was not blocked.** Nothing needed revocation or
rotation, so no history rewrite was performed or contemplated — which is also what the stage's
non-negotiable rules require. Two exposures are recorded as **accepted, non-credential** rather than
hidden: the self-hosted log paths above, and machine-local absolute paths already inside tracked
historical documents (`docs/audits/**`, `docs/recovery/**` and earlier root records — 15 files flagged
by the history scan, 0 of them credential findings). Those documents stay historical and unrewritten.
Deleting the six self-hosted runs would have removed the first exposure, but run deletion is
irreversible and the qualification evidence is not deletable, so no deletion was done.

## 5. PHASE C and E — `main` became the qualified candidate, and the repository became public

### 5.1 Fast-forward only (`phaseC-fastforward-correct.txt`, 14:35:16Z)

`git switch main` had failed at entry for a mundane reason measured in the same transcript: no local
`main` existed and `checkout.defaultRemote` was unset (`CONFIG_DEFAULT_REMOTE_EXIT=1`). Rather than
let Git guess, `main` was created explicitly against the remote branch (`branch 'main' set up to
track 'origin/main'`, exit 0), switched to, and then fast-forwarded:

- `git merge --ff-only origin/release/v0.1.0` → exit 0 (366-line stat in `phaseC-merge-stat.txt`).
- Before any push: `HEAD` = `c76567a…` = the candidate; `TREE` = `bbf296504b487a3d8ccda6728798c33bfbdc3ecd`
  = `CANDIDATE_TREE`; `git rev-list --left-right --count HEAD...origin/release/v0.1.0` printed `0 0`,
  tab-separated as Git emits it — no commits on either side, so nothing had diverged (the transcript's
  `TOPOLOGY` line); `git status --short` = 0 lines.
- `git push origin main` → `e0ff981..c76567a  main -> main`, exit 0. No `--force`, no `--no-verify`,
  and no second ref written.
- After a fresh `git fetch origin`: local `HEAD`, `refs/remotes/origin/main` and
  `git ls-remote refs/heads/main` were all `c76567a4da0eb0590c85e89cd6f2a2f987fd4087`
  (`ALL_THREE_IDENTICAL=yes`), and `TAG_LINES=0`.

### 5.2 Visibility, and the protection state as actually measured

`gh repo edit … --visibility public --accept-visibility-change-consequences` → exit 0
(14:58:46Z–14:58:54Z, `phaseE-visibility.txt`). The before/after reads are the record: before
`"private": true`; after `"private": false, "visibility": "public"`, `default_branch` `main`. Two
**unauthenticated** reads prove the world can read it: the repository page HTTP 200 and the raw
`README.md` HTTP 200.

The protection question was re-inspected after the visibility change rather than assumed
(`phaseE2-protection-recheck.txt`, 14:59:21Z–14:59:28Z):

- Repository rulesets: `[]` — zero, both before and after publication.
- Legacy branch protection on `main`: `{"message":"Branch not protected" … , "status":"404"}`.
- `GET /repos/…/branches/main`: `{"name":"main","protected":false}`.
- Organization rulesets: HTTP 404 (not readable/not applicable at this account level).

So **no branch protection was configured, and this record does not claim any**. The guards that
matter were behavioral instead: every push in this stage was a fast-forward (the `e0ff981..c76567a`,
`c76567a..dc1b307` and `dc1b307..76e2728` lines above), the only merge was `--ff-only`, and the
remote refs were re-read after each push. Adding a ruleset was deliberately not done: an
`update`-type ruleset would have blocked the legitimate pushes this stage still had to make.

One visible consequence of going public, recorded because it changes what the repository looks like:
Dependabot began opening pull requests. By 16:04:22Z five `dependabot/npm_and_yarn/*` branches existed
on the remote (they appear as `[new branch]` in the post-push fetch, having been created after the
14:37Z ref listing) and `open_issues_count` reads 5 with 12 repository labels. Nothing in this stage
merged, closed or commented on any of them.

## 6. PHASE F — private vulnerability reporting, closed

Capability was probed before it was written to, and the installed CLI's surface was checked first:
`OPTIONS` on the endpoint returned 204 (14:59:43Z, `phaseF1-capability.txt`), and `gh` exposes no
private-vulnerability-reporting command, so the authenticated REST endpoint was used rather than a
guessed CLI flag or an invented address.

`GET /repos/Pavithran-R-A/DiffBeacon/private-vulnerability-reporting` answered `{"enabled":false}`
both as a private repository (14:59:28Z) and immediately before the write (15:09:21Z). The write
sequence was measured, not assumed (`phaseF2-enable-attempt.txt`):

1. `POST` → `gh: Not Found (HTTP 404)`, exit 1, and the re-read still `{"enabled":false}` — the POST
   route changed nothing.
2. `PUT` → exit 0, and the re-read answered **`{"enabled":true}`**.

Re-verified at 16:58:03Z (`closing-measurement.txt`): still `{"enabled":true}`. The route was then
checked from outside the API rather than inferred (`phaseF3-verify-route.txt`, 15:12:19Z–15:12:24Z).
The PVR re-read again answered `{"enabled":true}`. An **unauthenticated** request to
`/Pavithran-R-A/DiffBeacon/security/advisories/new` returns HTTP 200 but with
`final_url=https://github.com/login?return_to=…advisories/new` — the form itself sits behind sign-in,
which is what a private intake should do, and this record does not claim the form is world-readable.
The repository's `/security` tab answers 200 at its own URL with no redirect, and its HTML advertises
the route: `Report a vulnerability` once, `advisories/new` once, `private vulnerability` once.
`gh advisories list --repo …` reports 0 existing advisories, and the repository read returns
`has_security_policy: null` with `topics: []`. An empty advisory list is **not** evidence of a
configured intake; the `enabled:true` read and the advertising page are, and the 0 is recorded because
a security intake is not the same thing as a published advisory.

`SECURITY.md` was then rewritten to match (`dc1b307`, §6 of `phaseFG-push.txt`): it directs reporters
to the private advisory form, states plainly that vulnerabilities must not be disclosed through public
issues, discussions, pull requests or commits, **publishes no address, and claims no response time or
SLA**. The supported-versions, invariants and "what this does not make DiffBeacon" sections were left
alone because they remain accurate.

## 7. PHASE G — conduct intake: `CONDUCT_INTAKE_MANUAL_BLOCKER`

The conduct route was looked for, read-only, on 2026-10-04T15:52:01Z (`phaseG-conduct-probe.txt`),
after the repository was public, so the probe reflects the state a real reporter would meet:

| Route considered                                     | Measured result                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GitHub private vulnerability reporting               | `{"enabled":true}` — and it is a **vulnerability** intake; using it for conduct complaints was rejected. |
| Issue tracker                                        | `has_issues: true`, i.e. public by construction; not a private misconduct route.                         |
| GitHub Discussions                                   | endpoint answers `{"message":"Discussions are disabled for this repo", "status":"410"}`.                 |
| `CODEOWNERS`                                         | `GET /repos/…/contents/CODEOWNERS` → `Not Found` (404).                                                  |
| Org-level private intake                             | org rulesets unreadable (404); no org surface was assumed.                                               |
| Any already-published moderation address in the tree | none — a sweep of tracked content found only `.invalid` fixtures and GitHub noreply addresses (§4).      |

No private, monitored conduct intake exists, and none can be created from this environment without
inventing an address, a watcher, or an SLA. This stage therefore records
**`CONDUCT_INTAKE_MANUAL_BLOCKER`** and names the owner action instead of advertising a channel:
the repository owner must create a monitored private intake — a dedicated address or form the
maintainers actually read, with who watches it and how reports are archived — publish it in
`CODE_OF_CONDUCT.md`, and prove it before advertising it. `CODE_OF_CONDUCT.md` was corrected in the
same commit to say exactly that, narrowing a claim that had become false while keeping the gap
visible. The technical public work (§5, §8, §11) was **not** blocked by this finding, and the
release process is not fully unblocked until it is real.

## 8. PHASE H — the browser demo deployed by GitHub Pages

### 8.1 What the workflow does

`.github/workflows/pages.yml` builds the same Vite production output the repository already
qualifies, and deploys it with the official Pages action chain: `actions/configure-pages` →
`actions/upload-pages-artifact` → `actions/deploy-pages`, in the `github-pages` environment, with
`permissions: contents: read, pages: write, id-token: write` and `BASE_PATH="/${{
github.event.repository.name }}/"` so the app resolves under `/DiffBeacon/`. It references no secret
and no `GITHUB_TOKEN` override.

Third-party Actions stay pinned by reviewed immutable commit SHA, as everywhere else in this
repository — the pinning policy was not loosened to match a documentation example. The releases list
was read first (16:05:26Z) and each tag was then resolved to its commit through the authenticated API
rather than copied from a blog post (16:06:13Z, `phaseH-pin-discovery.txt`, `phaseH-pin-shas.txt`;
each answer is `object_type: commit`, so the pin is a commit, not a mutable tag object):

| Action                          | Tag resolved | Immutable SHA pinned                                                          |
| ------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| `actions/checkout`              | v7           | `3d3c42e5aac5ba805825da76410c181273ba90b1` (the pin already reviewed here)    |
| `actions/setup-node`            | v7           | `820762786026740c76f36085b0efc47a31fe5020` (the pin already reviewed here)    |
| `actions/configure-pages`       | v6.0.0       | `45bfe0192ca1faeb007ade9deae92b16b8254a0d`                                    |
| `actions/upload-pages-artifact` | v5.0.0       | `fc324d3547104276b827a68afc52ff2a11cc49c9` (equals the existing reviewed pin) |
| `actions/deploy-pages`          | v5.0.1       | `368f82528645a54fb793d4d04e342629a3f51346`                                    |

The strongest of the three cross-checks is that `upload-pages-artifact`'s resolved SHA equals the pin
already in `ci.yml`: the same reviewed bytes, found by a second route.

### 8.2 Pages was enabled through the API, and the response was re-read

The method was discovered rather than guessed: `OPTIONS /repos/…/pages` answered 204, and `gh api
--help` was read to confirm how a method and payload fields are passed, because inventing CLI syntax
would have been a write against an unverified route. The state at 16:06:29Z was
`GET /repos/…/pages` → **HTTP 404** (`status: "Not Found"`, docs anchor
`pages#get-a-apiname-pages-site`) — no Pages site existed for the repository yet
(`phaseH-pages-probe.txt`).

`POST /repos/Pavithran-R-A/DiffBeacon/pages` with `build_type=workflow` at 16:07:10Z returned exit 0
with the site resource (`phaseH-enable-pages.txt`), and the independent re-read at 16:08:00Z returned
the same object (`phaseH-pages-state2.txt`): `html_url: https://pavithran-r-a.github.io/DiffBeacon/`,
`build_type: workflow`, `source: {branch: main, path: /}`, `public: true`, `https_enforced: true`,
`cname: null`, `status: null` — plus `has_pages: true` on the repository itself. The workflow does not
create the site; it deploys into the site this step configured.

Three reads that did **not** produce what one might have wanted to claim, recorded so nobody later
reads them as evidence:

- `GET /repos/…/actions/environments` → 404 at 16:08:00Z **and** 404 again at 17:03:29Z, after the
  deploy succeeded. So this stage cannot show a `github-pages` environment object through that
  endpoint; what it shows is the `deploy` job completing (which is where the environment is consumed)
  and the served bytes in §11.
- `GET /repos/…/pages/deployments` and `pages/deployment-information` → 404 (16:36:36Z,
  `phaseK-rerun-measure.txt`). The deployment's own evidence is run `37217200407`, not this endpoint.
- `GET /repos/…/pages/health` → 422 `There isn't a cname for this page` (16:57:39Z,
  `closing-measurement.txt`), which is the expected shape for a `github.io` site with no custom
  domain, and is not treated as a failure.

One disclosure about method: a `WebFetch` of GitHub's Pages documentation returned an unrelated
document (a Python `requests` README). It was discarded and used as nothing; every claim in this
section comes from the authenticated calls and HTTP reads above.

### 8.3 The contract test was written failing first

`tests/stage9.ci-contract.test.ts` is the guard that binds `pages.yml` to the least privilege Pages
needs. It was extended **before** the workflow changed, and the RED run is recorded
(`phaseH-red-test.txt`, 16:08:42Z): 7 tests, **2 failed** —

- `keeps ci.yml read-only and holds pages.yml to the least privilege Pages needs`, failing because
  the grant set was `['contents: read']` where `['contents: read','id-token: write','pages: write']`
  is required (asserted **as a set**, so widening it fails as surely as dropping a grant does);
- `deploys the demo through the official Pages actions instead of stopping at an artifact`.

After the workflow was written, the same file ran 7/7 green (`phaseH-green-test.txt`). `ci.yml`'s own
grants were not widened by this commit; the test asserts both files in the same run.

A mutation control proved the new pages guard has teeth (`phaseH-grant-control.txt`, 16:18:37Z →
16:18:54Z): the workflow was backed up (1925 bytes), one grant line —
`permissions: pull-requests: write` — was injected into `pages.yml`, and the suite answered
`1 failed | 6 passed (7)` with `CONTROL_MUTATED_EXIT=1`, the failure naming the widened set
`['contents: read','id-token: write','pages: write','pull-requests: write']` against the three
required. `git checkout -- .github/workflows/pages.yml` restored it (`restore_exit=0`), the grant list
read back as the three intended lines with `pull_requests_present=0`, `cmp` against
`stage12/pages.yml.pristine` reported `pristine_identical=YES`, and the suite returned to 7/7 with
`CONTROL_RESTORED_EXIT=0`. No other file was touched by the control.

## 9. PHASE I — the named gates, run independently

`npm run verify` is the composite gate (source completeness → `format:check` → `lint` → `typecheck` →
`test` → `build` → artifact freshness → `secret-scan` → manifest drift → CLI `--version`/`--help` →
`package-smoke` → `action-smoke`), and it was run in full. Each gate that this stage's edits could
plausibly affect was also run **on its own** so a single composite exit was not the only evidence:

| Gate                                                                | Why it is named here                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm audit --omit=dev --audit-level=high`                           | the release-blocking production audit                                              |
| `npm audit --audit-level=high`                                      | the development audit Stage 11 cleared                                             |
| `npm run format:check`                                              | this stage edits four padded markdown tables                                       |
| `tests/stage10.docs-contract.test.ts`                               | binds doc prose to measured state, resolves every relative link, bans stale claims |
| `tests/stage9.ci-contract.test.ts` + `tests/stage3b.static.test.ts` | bind `pages.yml` privileges and the `BASE_PATH` build contract                     |
| `npm run secret-scan`                                               | the fail-closed credential gate                                                    |
| `npm run verify`                                                    | everything, in order, including the real-Chromium browser suite                    |

`npm run check` is not a second gate: `package.json:36` defines `"check": "npm run verify"`, so the
two commands are the same code path. Recording that is why `check` was not run a second time back to
back — duplicating a 12-minute browser run would have added contention, not coverage.

### 9.1 Results, gate by gate

The named gates were run twice over this stage, because the stage changed gate inputs twice. The
Pages tree (the bytes that became `76e2728`) was measured first; the documentation tree (that same
commit plus the four corrected documents and this record) was measured again, and only the second
set describes the commit this file ships in.

**Documentation tree, `phaseMN-gates-run2.txt`, 17:11:02Z → 17:22:56Z, `HEAD_BEFORE=76e2728`:**

| Gate                                                                        | Exit | Measured output                                         |
| --------------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `npm audit --omit=dev --audit-level=high`                                   | 0    | `found 0 vulnerabilities`                               |
| `npm audit --audit-level=high`                                              | 0    | `found 0 vulnerabilities`                               |
| `tests/stage10.docs-contract.test.ts` (alone)                               | 0    | `68 passed (68)` in 1 file                              |
| `tests/stage9.ci-contract.test.ts` + `tests/stage3b.static.test.ts` (alone) | 0    | `10 passed (10)` in 2 files                             |
| `npm run secret-scan`                                                       | 0    | `12 finding(s), 12 classified, 0 unclassified, 0 stale` |
| `npm run verify`                                                            | 0    | ends `DiffBeacon source-first verification passed.`     |

**Same tree, the five gates the brief names, each run on its own, `phaseI-named-gates.txt`,
17:24:08Z → 17:34:35Z:**

| Gate                   | Exit | Measured output                                          |
| ---------------------- | ---- | -------------------------------------------------------- |
| `npm run format:check` | 0    | `All matched files use Prettier code style!`             |
| `npm run lint`         | 0    | `eslint . --max-warnings=0` produced no output           |
| `npm run typecheck`    | 0    | `tsc --noEmit -p tsconfig.json` produced no output       |
| `npm run build`        | 0    | `1565 modules transformed`, `✓ built in 601ms`           |
| `npm run test:browser` | 0    | `6 passed (6)` files, `133 passed (133)` tests, 577.38 s |

`git status --short` after those five still listed exactly the six staged documentation paths, so
rebuilding did not dirty the tracked action bundle — the freshness property `verify` checks again.

**Pages tree, for comparison, `phaseI-pages-gates.txt` at 16:19:39Z** (HEAD `dc1b307`, with
`pages.yml`, the rewritten contract and the regenerated manifest staged): `format:check`, `lint`,
`typecheck` and `build` each exit 0; standalone contract suites `stage9.ci-contract` 7/7,
`stage3b.static` 3/3, `action-workflow-docs` 16/16, `source-manifest` 4/4, `stage10.docs-contract`
68/68. The browser project alone (`phaseI-test-browser.txt`) was `133 passed (133)`, and the full
composite (`phaseI-verify.txt`) reported `65 passed (65)` files and `1131 passed | 2 skipped (1133)`
and passed. The hosted runs in §10 reproduce the same gates on the pushed commits.

### 9.2 The composite runs that failed, and why they do not count

Two invocations of the named-gate script ran while this record did not yet exist.
`phaseMN-gates.txt` (16:53:11Z → 17:01:41Z) failed the docs contract standalone
(`4 failed | 64 passed (68)`, `DOCCONTRACT_EXIT=1`) and therefore failed `verify`; that run is the
measurement §12 cites. `phaseMN-gates-run1.txt` (17:01Z → 17:07:48Z) ended `VERIFY_EXIT=1` for the
same reason: its `npm test` started at 22:31:14 local (17:01:14Z) while this file was created only
later in that same window — run1's own closing `git status --short` at 17:07:48Z still lists it as
untracked `??` — and all four failures are the one finding — `… links to missing
docs/audits/stage12-public-source-pages.md` — with the rest of that run green
(`1127 passed | 4 failed | 2 skipped (1133)`, 64 of 65 files, 393.00 s). The cause was the ordering of
this stage's own work: the four documents were written to link here before the target existed, which is
precisely what the guard is for. No timeout was raised, no test was changed, and nothing in either run
was attributed to host contention. Totals from a run whose test command was cut short by these
failures are not used for any claim here.

Run2 is the authoritative measurement on the tree where the link resolves: same script, same host,
`VERIFY_EXIT=0` with those four assertions passing, and the five named gates green on their own
directly afterwards (§9.1).

The 6 lines `run2` printed under `git status --short` are this stage's intended staged set
(`README.md`, `CHANGELOG.md`, `docs/README.md`, `docs/releasing.md`, `SOURCE_MANIFEST.txt`, and this
file as `A`), captured before the commit existed; PHASE N's empty-status requirement is measured
after it, and is reported in §13's companion checks and the stage scoreboard.

The closing re-run of the prose-sensitive subset on the exact committed bytes is deliberately not
numbered here — see §14.2 for why a file cannot contain the measurement of itself, and the stage
scoreboard for that result.

## 10. PHASE K — hosted gates, one run per commit

`.github/workflows/ci.yml` runs five jobs. The job **names** are the same in every run; the job **ids**
are per-run, so they are listed per run rather than once. Every run below was read back from the API
with its own `head_sha` (the REST field is `head_sha`, not a display alias), is `status: completed` /
`conclusion: success`, event `push`, on `main`, and each job was inspected individually — by id,
status and conclusion — rather than inferred from the run-level badge. The five names are
`Browser lane (ubuntu-latest / Node 24)`, `Source windows-latest / Node 24`,
`Source ubuntu-latest / Node 24`, `Source windows-latest / Node 22`,
`Source ubuntu-latest / Node 22`.

| Run ID        | `head_sha`                           | When                                                   | Jobs, each `completed` / `success`                                                                                                                                       |
| ------------- | ------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `37209952904` | `c76567a…` (the qualified candidate) | created 14:37:39Z, all five jobs terminal by 14:42:08Z | `111458929251` Browser · `111458929269` ubuntu/N24 · `111458929311` windows/N24 · `111458929254` ubuntu/N22 · `111458929051` windows/N22 (`phaseD-run-37209952904.json`) |
| `37215399172` | `dc1b307…` (SECURITY.md commit)      | after §6's commit                                      | five jobs, all completed / success (`phaseK-rerun-measure.txt`)                                                                                                          |
| `37217173934` | `76e2728…` (pages.yml commit)        | `run_number 72`, created 16:32:59Z                     | `111479936854` Browser · `111479936974` windows/N24 · `111479936975` ubuntu/N24 · `111479937006` windows/N22 · `111479937052` ubuntu/N22 (`phaseK-rerun-measure.txt`)    |

Each `Source` job's own steps include `Secret scan`, `Dependency audit (release surface)`,
`Dependency audit (development tree)`, `Verify quality` and
`Action bundle freshness (committed artifact equals rebuild)`; the `Browser lane` runs
`Browser suites (real Chromium required)`. So the audits and the artifact check reported in §9 are not
only a local claim — the hosted runners perform them on the pushed commit, at both Node 22 and Node 24
and on both operating systems.

The Pages workflow was inspected separately from CI, because a green CI says nothing about a deploy.
It was dispatched deliberately at 16:33:18Z (`phaseH-dispatch.txt`) rather than left to chance, and run
`37217200407` — `run_number 1`, `name: Deploy browser demo to GitHub Pages`, event
`workflow_dispatch`, `head_sha` `76e2728…` — reached **status completed / conclusion success**,
created 16:33:25Z and last updated 16:33:53Z. Its two jobs were each inspected: `111480017632`
(`build`) and `111480061851` (`deploy`), both completed/success, with the build steps
`Build the repository-path web bundle` → `Configure Pages` → `Upload the built site` and the deploy
steps `Deploy the artifact to Pages` → `Report the deployed URL` all success
(`phaseH-watch.txt`). The watch loop polled until **both** the Pages run and CI run `37217173934` were
terminal (`BOTH_TERMINAL at poll=4`, 16:35:59Z) — the completion notice alone was not treated as
evidence.

A dispatch is not success by itself; the site was fetched afterward and re-fetched again (§11) so the
claim rests on served bytes, not on a job badge.

## 11. PHASE L — the deployed surface, measured

### 11.1 HTTP and asset references

Measured with direct HTTPS requests (`phaseL-http-1.txt`, re-read at 16:57:39Z in
`closing-measurement.txt`):

| URL                                        | status | content-type                            | bytes  |
| ------------------------------------------ | ------ | --------------------------------------- | ------ |
| `/DiffBeacon/`                             | 200    | `text/html; charset=utf-8`              | 719    |
| `/DiffBeacon/assets/index-DDHzPMhP.js`     | 200    | `application/javascript; charset=utf-8` | 233059 |
| `/DiffBeacon/assets/index-9I3gIet4.css`    | 200    | `text/css; charset=utf-8`               | 19209  |
| `/DiffBeacon/assets/favicon-snzof64s.svg`  | 200    | `image/svg+xml`                         | 349    |
| `/DiffBeacon/assets/index-DDHzPMhP.js.map` | 200    | `application/json; charset=utf-8`       | 979243 |
| `/src/main.tsx` (host root)                | 404    | —                                       | —      |
| `/DiffBeacon/src/main.tsx`                 | 404    | —                                       | —      |

The root response carries `Server: GitHub.com`, `Last-Modified: Sun, 04 Oct 2026 16:33:47 GMT` and
`Cache-Control: max-age=600`. The served document references exactly three assets, all hashed and all
under `/DiffBeacon/assets/`, plus the favicon — **no `/src/...` path appears anywhere in it**, which is
the shape of a built site rather than a dev server, and the two 404 probes above show that no
source-tree path is being served either. `<title>` reads `DiffBeacon — Review Attention Map`
(`phaseL-index.html`). The map row is the only listed URL that `index.html` does not reference; it is
reachable because the bundle's trailing `//# sourceMappingURL=index-DDHzPMhP.js.map` comment names it,
and §11.5 measures what that means.

### 11.2 The app boots and analyzes a pasted diff, in a real browser

Driven in Chromium against the live URL. The page booted into `<div id="root">` with the H1
"Start with the diff. Review the evidence in order.", the input instrument, the standby map panel, the
boundary statement and the `DIFFBEACON / 0.1.0` footer. The input was the **exact bytes** of
[`docs/examples/attention-map-sample.diff`](../examples/attention-map-sample.diff) — 1150 bytes, 50
lines, first line `diff --git a/package.json b/package.json` — written through the native textarea value
setter plus an `input` event, and the byte counters agreed on both sides (`sampleBytes: 1150`,
`textareaBytes: 1150`, on-screen readout `001150 B`).

After "Analyze diff", the live region read "Analysis complete locally in this browser." and the map
rendered **FILES 4, ADDITIONS +16, DELETIONS −5, GENERATED 0**, with FOCUS "Authentication / Access"
(1 file), CHECK "Runtime Implementation" (3 files) and CHECK "Dependencies" (1 file) in that review
order, and a 3-entry evidence ledger (RUNTIME WITHOUT TESTS, AUTH WITHOUT TESTS,
MANIFEST WITHOUT LOCKFILE) carrying its "not observed describes this diff only" qualifier. That is the
same review the README shows for the same committed input, produced by the deployed artifact rather
than by a local build. Copy became enabled after analysis and Clear after paste, as the contract
requires.

### 11.3 Nothing leaves the browser

Before any content was entered, `window.fetch`, `XMLHttpRequest.prototype.open` and
`navigator.sendBeacon` were replaced with counters that held across paste **and** analysis. The page
then reported `{"fetch":0,"xhr":0,"beacon":0,"targets":[],"hookErrors":[]}` — **zero outbound requests
of any kind on the analysis path**, with the instrumentation itself installing without error. The
browser's own resource records name one origin for the whole session:
`https://pavithran-r-a.github.io`, the static host. Console output after load, after analysis, and
again after reload and re-analysis: no messages at all, so no fatal asset or base-path error and no
warning.

Storage stayed empty: `localStorage` keys `[]`, `sessionStorage` keys `[]`, `document.cookie` `""` —
after a load and after a reload. Reloading the root returned the standby app ("Ready for a unified
diff.", byte counter `000000 B`, Clear and Copy disabled) with nothing restored from the previous
session, and the reloaded page still functioned: "Load example" + "Analyze diff" produced a full map
again. This is a measurement of the bytes GitHub Pages actually serves, not of the source's intent —
earlier in this project's history an artifact did embed host state at build time, which is exactly why
the check is repeated on the deployed copy.

### 11.4 The exact URL GitHub reports

```text
https://pavithran-r-a.github.io/DiffBeacon/
```

That string is not an inference from the repository name: it is the `html_url` of the Pages resource
returned by the enabling `POST` (16:07:10Z), the same field on the re-read `GET` at 16:08:00Z and again
at 16:58:03Z (`build_type: workflow`, `source: {branch: main, path: /}`, `public: true`,
`https_enforced: true`, `cname: null`), the value the deploy job's `Report the deployed URL` step
emitted, and the URL that returns 200 with `Last-Modified: Sun, 04 Oct 2026 16:33:47 GMT` — the
deployment minute of run `37217200407`. The bytes and the API agree.

The build served there is the one from `head_sha` `76e2728…`. This stage's last commit adds
documentation only, so a Pages re-dispatch was queued for the final SHA to keep "live site" and
"`main`" identical; its run id and conclusion are reported in the Stage 12 scoreboard for the reason in
§14.2, and the visible comparison is that the asset names above (`index-DDHzPMhP.js`,
`index-9I3gIet4.css`) are build outputs, so unchanged hashes across that re-dispatch are the evidence
that a documentation commit moved no shipped byte.

That comparison is hosted-build to hosted-build on purpose, because a local build is **not** byte-equal
to the deployed one here, and the record says so rather than glossing it: re-running the workflow's own
command locally at the same source bytes (`BASE_PATH="/DiffBeacon/" npm run build:web`, exit 0) emits
`index-R83CsIRS.js` (262 321 B) where GitHub serves `index-DDHzPMhP.js` (233 059 B), while the CSS hash
matches exactly. The two maps show the reason — the local one names its modules
`node_modules/.pnpm/react@19.3.0/…`, the deployed one `node_modules/react/…`. The working tree is
pnpm-resolved and the workflow runs `npm ci`, which is the standing Stage 11 §6 fact that only a clean
`npm ci` clone can qualify a shipped bundle. Nothing in this stage claims local reproduction of the
deployed bytes; every PHASE L claim is a measurement of the bytes GitHub actually serves.

### 11.5 The deployed source map is public, and it names nothing about the build host

`vite.config.ts:30` sets `sourcemap: true`, and `projectRelativeSource` (`vite.config.ts:9–13`, the
`sourcemapPathTransform`) rewrites every mapped source relative to the project root — the hardening
Stage 11 landed after a built artifact was found embedding host paths. Measured on the copy GitHub
serves, not on the config: the fetched map has 49 `sources`, of which **0** are absolute or drive-letter
prefixed and 0 begin with `..`; the strings `Pavithran`, `/home/runner`, `C:\`, `C:/`, `/Users/`,
`AppData` and `Documents` appear **0** times in `sources` and **0** times in `names`
(`tools/inspect-sourcemap.mjs`, run against `live-index.js` and `live-index.js.map` fetched over HTTPS
at 23:05 local / 17:35Z).

The map does embed `sourcesContent`, so the browser demo ships readable module source. Judged against
what this stage is allowed to leak, that is not a disclosure: the source repository is public under MIT
and carries the same text, and the one thing a map could expose that the repository does not — the
build machine's paths and identity — is the thing measured absent above. A credential-shape grep over
the served bundle returns `ghp_`, `github_pat_`, `npm_`, `Bearer `, `BEGIN ` and `secret` at 0
occurrences; `authorization` matches 5 times and `password` twice, and reading each in context, all
seven are ordinary code — DiffBeacon's own detector vocabulary ("Authentication / Access", the
`auth|identity|session|permission|authorization` path regex, the ledger wording "Authentication or
authorization files changed") and React's `input` type tables plus the app's keyboard-handling check.
Not one is a value, token or endpoint.

Suppressing maps would be a build-configuration change and a re-qualification of the shipped artifact,
so it is out of scope here (§15); it is recorded as a deliberate, measured surface instead of being
changed silently during a documentation stage.

## 12. PHASE M — what the documentation now says, and what it still may not

Current documentation was corrected to the measured state, and only to it:

- `README.md` — leads with "built, tested, and **not published** as a package", names the public
  source repository and the deployed demo with its run ID, records the zero-outbound-request
  measurement, states that private security intake exists, and states that conduct intake does not.
  The consumer-workflow section still says an independent reviewed reference for `uses:` does not
  exist yet, because no tag or Release exists.
- `CHANGELOG.md` — one `### Added` bullet for the public source and live demo, naming Pages run
  `37217200407`, and naming the surfaces this stage left untouched.
- `docs/releasing.md` — §0's five prerequisite rows re-measured (four closed, conduct open), §2
  marked **executed on 2026-10-04 by Stage 12** with the fast-forward and no-protection facts, and
  §6's deployment row marked done **for the demo** with the live measurement. Sections 3, 4, 5, the
  rest of 6, and 7 are untouched, and the file still states that nothing in it authorises publishing
  the package.
- `docs/README.md` — points at this record so a reader can tell current documentation from historical
  evidence.

What no document may now claim, and none does: that the npm package exists, that `npx diffbeacon`
works, that a `v0.1.0` tag or GitHub Release or Marketplace listing exists. Those words are the
subject of committed guards, not of hope: `tests/stage10.docs-contract.test.ts` fails the suite on
unfulfilled publication claims and on a link to a file that does not exist. That guard earned its keep
during this stage — the first run of it after these four documents were edited reported
`4 failed | 64 passed (68)`, all four the same finding, `… links to missing
docs/audits/stage12-public-source-pages.md` (`phaseM-docscontract-fail.txt`), because the documents
referenced this record before it was written. It is fixed by this file existing, not by weakening the
test, and the re-run is recorded in §9.

Historical records stay historical: `docs/audits/**`, `docs/recovery/**` and `docs/research/**` were
not rewritten to make the repository look tidier, and this file is one of them.

## 13. Unreleased surfaces, re-measured

| Surface              | Measurement (2026-10-04)                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| npm `diffbeacon`     | `npm view diffbeacon version` → `npm error code E404 / 404 Not Found - GET https://registry.npmjs.org/diffbeacon`                             |
| `v0.1.0` tag         | `git ls-remote origin refs/tags/v0.1.0` → empty; the local `git tag -l` list is empty too                                                     |
| Any tag at all       | `refs/tags` lines in `git ls-remote origin` → `0`                                                                                             |
| GitHub Release       | not created; no release ref exists                                                                                                            |
| Marketplace listing  | none; nothing was submitted                                                                                                                   |
| Consumer `uses:` pin | still a placeholder in `docs/examples/diffbeacon-pull-request-review.yml`, because there is still no immutable reviewed reference to hand out |

## 14. Evidence index, and the one thing a report cannot record

### 14.1 Files holding the transcripts above

All under `…/904c4a23/stage12/`: `phaseA-boundary.txt`, `phaseB-CONCLUSION.md` and its
`phaseB-*.txt` set, `phaseC-fastforward-correct.txt`, `phaseC-merge-stat.txt`,
`phaseC-push-verify.txt`, `phaseE-visibility.txt`, `phaseE2-protection-recheck.txt`,
`phaseF1-capability.txt`, `phaseF2-enable-attempt.txt`, `phaseF3-verify-route.txt`,
`phaseFG-push.txt`, `phaseG-conduct-probe.txt`, `phaseH-pages-probe.txt`,
`phaseH-enable-pages.txt`, `phaseH-pin-shas.txt`, `phaseH-red-test.txt`, `phaseH-green-test.txt`,
`phaseH-grant-control.txt`, `phaseH-dispatch.txt`, `phaseH-pages-commit-push.txt`,
`phaseI-pages-gates.txt`, `phaseI-verify.txt`, `phaseI-test-browser.txt`,
`phaseK-rerun-measure.txt`, `phaseL-http-1.txt`, `phaseL-index.html`, `phaseL-browser-verify.txt`,
`phaseM-docscontract-fail.txt`, `phaseMN-gates.txt`, `phaseMN-gates-run1.txt`,
`phaseMN-gates-run2.txt`, `phaseI-named-gates.txt`, `closing-measurement.txt`,
`interim-surface-check.txt`, the fetched `live-index.js` and `live-index.js.map`, and the `tools/`
scripts including `scan-history.mjs`, `inspect-sourcemap.mjs`, `phaseMN-gates-run1.sh` and
`phaseMN-gates-run2.sh`.

### 14.2 The residual self-reference, stated rather than chased

A commit cannot contain the hosted CI result of the push that contains it. Stage 11 measured this
loop, bounded it, and closed it; this stage does not reopen it with another record-only commit.
What is done here instead: every gate result recorded above belongs to a commit **earlier** than this
file, and this file's own tree was measured by the §9 gates and by the two hosted runs reported in the
Stage 12 scoreboard. The numbers in §9 were measured on a tree whose documents and manifest already
have their committed contents; `docs/audits/` is excluded from the manifest by
`scripts/source-manifest.mjs:22`, which is why adding this record moves no digest. The one
irreducible residue is that the digits naming the last re-run cannot be inside the bytes that run
checked. It is disclosed here, and nothing in this stage depends on it: no gate input changed after
`dc1b307` and `76e2728` were each measured green at their own SHA.

### 14.3 Worktree hygiene actually practiced

Untracked pnpm files (`pnpm-lock.yaml`, `pnpm-workspace.yaml`) reappeared during this stage, as they
have in earlier ones. They were **not** deleted, staged, or committed: each was moved to
`stage12/quarantine/20261004T165028Z-pnpm-{lock,workspace}.yaml`, outside the repository, with its
original name recorded. They matter because a pnpm-resolved `node_modules` in the working tree is why
only a clean `npm ci` clone can qualify shipped bundles (Stage 11 §6).

## 15. What this record does not authorise, and what is next

This file records a public source repository and a live demo. It does **not** authorise publishing
the npm package, creating `v0.1.0`, creating a GitHub Release, listing on the Marketplace, or
pointing any consumer repository's `uses:` at a reference this project has not reviewed for that
purpose. `docs/releasing.md` remains the runbook, and its sections 3–7 remain ahead.

One surface found during §11 is left as a maintainer decision rather than quietly reshaped here: the
deployed demo also serves a source map (§11.5). It is measured clean of host paths and credentials, so
it blocks nothing, but turning it off would be a `vite.config.ts` change and a re-qualification of the
shipped artifact — neither of which belongs in a documentation stage.

Next, in the order the runbook already states:

1. The repository owner closes `CONDUCT_INTAKE_MANUAL_BLOCKER` (§7) with a real monitored intake, and
   `CODE_OF_CONDUCT.md` is corrected to describe only what then exists.
2. Step 8 of §1 — a person reviews the release commit as the artifact, bundle and workflow pins
   included in the diff.
3. Only then the release section: publish `packages/cli` to the registry, tag the exact qualified
   SHA, create the Release, and hand consumers that immutable reference. Each of those flips a public
   surface, so each is measured immediately before and after, in a new stage record.
