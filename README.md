# DiffBeacon

**Deterministic attention routing for pull requests.** See what changed, what evidence is present, and where human review should start.

DiffBeacon helps a maintainer understand a pull request before reading every changed line. It parses a Git unified diff, classifies observable review surfaces, reports neutral evidence relationships, and produces a deterministic review order.

> DiffBeacon maps review attention. It does **not** determine whether a pull request is safe to merge.

## Status

DiffBeacon v0.1.0 is released: the package is on npm, `v0.1.0` is an annotated tag on this
repository's release commit, the GitHub Release is public, and a separate consumer repository ran the
Action from that commit. Verified on 2026-10-06 against the npm registry, this repository's remote,
its Pages API, and its Actions API — [`docs/releasing.md`](docs/releasing.md) owns the checklist that
changes any row below, and
[`docs/audits/stage14-v0.1.0-consumer-release.md`](docs/audits/stage14-v0.1.0-consumer-release.md)
holds the measurements behind the release rows.

| Question                                   | Answer now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Published on npm?                          | Yes. `npm view diffbeacon version` reports `0.1.0` and `dist-tags` is `{"latest":"0.1.0"}`; the registry time for that version is `2026-10-06T07:12:58.935Z`. The public tarball `https://registry.npmjs.org/diffbeacon/-/diffbeacon-0.1.0.tgz` is 16869 bytes packed and 62773 unpacked, holds exactly `LICENSE`, `README.md`, `dist/index.js` and `package.json`, is `MIT`-licensed, declares `engines.node: ">=22"` and no runtime dependencies, and is byte-identical to the locally qualified pack (SHA-256 `ee8ab03031e93dea3f077c1d4476c5c7b921f373b046aff32b0c96e45a1e1517`). A throwaway project installed `diffbeacon@0.1.0` from the registry and ran it — see the consumer smoke in [`docs/audits/stage14-v0.1.0-consumer-release.md`](docs/audits/stage14-v0.1.0-consumer-release.md).                                                                                                                                              |
| Public repository, tag, or GitHub Release? | All three, measured 2026-10-06. `GET /repos/Pavithran-R-A/DiffBeacon` reports `"visibility": "public"` with `"default_branch": "main"`. The annotated tag `v0.1.0` (tag object `5311ee05e3199b84854d719453b8939c5c482dc7`) peels to commit `5a50b52028ead78942ea3fc3bee93ba26e0a79cc`, and GitHub Release `404432804` — "DiffBeacon v0.1.0" at <https://github.com/Pavithran-R-A/DiffBeacon/releases/tag/v0.1.0> — was published from it at `2026-10-06T07:28:16Z` with `draft: false`, `prerelease: false` and zero assets. A consumer therefore has an immutable `uses:` reference, recorded below.                                                                                                                                                                                                                                                                                                                                            |
| Deployed browser demo?                     | Yes, live at `https://pavithran-r-a.github.io/DiffBeacon/`, the URL GitHub's own deploy step reports. `.github/workflows/pages.yml` builds `client/` under the repository base path, uploads `dist/`, and deploys it with `actions/deploy-pages`; Pages run `37217200407` completed with conclusion `success` at `76e27288814ad5e2422b5ba13414dff0ea131977`, and the deployed root answers `200`. It is still static and local-only: analyzing the 1150-byte sample diff in the deployed page issued zero `fetch`, `XMLHttpRequest`, or `sendBeacon` calls, touched one origin, and left `localStorage`, `sessionStorage`, and cookies empty.                                                                                                                                                                                                                                                                                                    |
| Has CI ever actually run these gates?      | Yes, in both environments this repository has been given. The current `.github/workflows/ci.yml` completed on GitHub-hosted runners on 2026-10-04: Actions run [`37191968216`](https://github.com/Pavithran-R-A/DiffBeacon/actions/runs/37191968216) passed all five lanes at commit `889f52b6e53095fea978fafbe50017ff71e543db`. It has since passed on `main` itself — run `37209952904` at `c76567a4da0eb0590c85e89cd6f2a2f987fd4087`, run `37215399172` at `dc1b307d02b1377080405c223551762df7fb81a1`, and run `37217173934` at `76e27288814ad5e2422b5ba13414dff0ea131977`, five lanes each. An earlier, explicitly authorized lane ran the same gates on repository-scoped **self-hosted** runners: Actions run `36562157439`. The release commit itself, `5a50b52028ead78942ea3fc3bee93ba26e0a79cc`, was qualified before it was published: clean-clone hosted run `37296796659` completed with conclusion `success` across all five lanes. |
| Used by a repository other than this one?  | Yes, on 2026-10-06. A temporary public consumer repository — synthetic files only, owned by the same account — ran the ordinary `pull_request` event with `permissions: contents: read` and the Action pinned to the full release commit SHA `Pavithran-R-A/DiffBeacon@5a50b52028ead78942ea3fc3bee93ba26e0a79cc`. Actions run `37430396143` (job `112159653885`) concluded `success` with every step green, printed nothing on stdout or stderr, and its Job Summary carried a real Review Attention Map for the synthetic change: 5 files, `FOCUS` on Authentication / Access, `CHECK` on Runtime Implementation (3 files) and Dependencies, `NOTE` on Documentation / Changelog, three evidence observations and a four-step review order. The pull request was closed and the repository archived afterwards.                                                                                                                                 |
| Private security intake?                   | Yes, enabled. `GET /repos/Pavithran-R-A/DiffBeacon/private-vulnerability-reporting` answers `{"enabled":true}` and `/security` renders GitHub's report form. [`SECURITY.md`](SECURITY.md) sends reporters there, tells them not to open a public issue, publishes no address, and promises no response time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Conduct intake?                            | Not configured, and it is not a setting this environment could verify as fixable. [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) says so plainly; private vulnerability reporting is a vulnerability intake and is not reused for conduct complaints, discussions are disabled (the endpoint answers HTTP 410), and the issue tracker is public by construction. On 2026-10-05 the maintainer decided that a dedicated private intake is a **post-release governance improvement, not a `v0.1.0` release prerequisite**, so `docs/releasing.md` §0 no longer gates on it; the decision and its evidence classes are in [`docs/audits/stage13-release-policy-decision.md`](docs/audits/stage13-release-policy-decision.md). Nothing in the release path waits on it, and no channel is claimed to exist.                                                                                                                                              |
| Are GitHub-hosted runner images qualified? | For what ran, yes. Run `37191968216` executed every lane of the current workflow on hosted `ubuntu-latest` and `windows-latest` at Node 24 and Node 22 — four source cells and the real-Chromium browser cell — and all five concluded success. That browser cell reached success on a hosted runner for the first time in this repository's history. Still outside that evidence: the consumer proof above ran on a hosted `ubuntu-latest` image, so a Windows runner image has yet to execute the Action itself in a repository other than this one.                                                                                                                                                                                                                                                                                                                                                                                           |

## What it does

Eleven path detectors name the changed surfaces: CI / Build, Authentication / Access, Database /
Schema, Dependencies, API / Contracts, Configuration, Infrastructure / Deployment, Tests,
Documentation / Changelog, Generated Files, and Runtime Implementation
([`docs/detectors/initial-detectors.md`](docs/detectors/initial-detectors.md) lists each matcher
and its fixtures). Its evidence language is deliberately narrow: “no test-file
content changes were observed in this diff” is valid; “this pull request has no tests” is not. A
renamed file is classified from both its old and new path, so moving code out of `src/auth/` still
reports the authentication/access surface. A pure file-mode change is classified but never used to
claim that a companion file is missing, and a line share is only stated when the diff actually
reported the line counts behind it.

The core engine has no runtime network requirement and can run in Node or in a browser. The browser demo analyzes pasted unified diffs locally. No source upload, backend, account, database, analytics, telemetry, or runtime LLM is part of v0.1.

## Quick start

The repository is an npm workspace, and its published surface is the `diffbeacon` package at version `0.1.0` on the public registry. For local development, use Node 22 or newer and npm 10+. `engines.node: ">=22"` is a floor, not a tested matrix: every release surface in this workspace is qualified on Node 22.x and Node 24.x only.

To use the released CLI without building this repository, install the published package or run it
straight from the registry — both forms below name the version that was consumer-smoke-tested, so
they resolve exactly what was measured rather than whatever `latest` becomes later:

```bash
npm install diffbeacon@0.1.0        # in a project; adds node_modules/.bin/diffbeacon
npx diffbeacon@0.1.0 --version
git diff main...HEAD | npx diffbeacon@0.1.0 review --stdin
```

Add `--yes` (`npx --yes diffbeacon@0.1.0 …`) if you want npm to skip its install prompt. The same
arguments work through the project's `diffbeacon` bin once installed; the package ships no runtime
dependencies.

To try the analyzer without installing anything, open the deployed demo at
[https://pavithran-r-a.github.io/DiffBeacon/](https://pavithran-r-a.github.io/DiffBeacon/) and paste a
unified diff. The page holds no backend, no account, and no upload path; the diff you paste is
analyzed in your browser and stays there.

```bash
npm ci
npm run check
```

Review a Git range with a local build of this repository:

```bash
npm run build
node packages/cli/dist/index.js review main...HEAD
node packages/cli/dist/index.js review main...HEAD --format markdown
node packages/cli/dist/index.js review main...HEAD --format json
git diff main...HEAD | node packages/cli/dist/index.js review --stdin
```

Those `node packages/cli/dist/index.js …` commands are the local-build path. The published package
takes the same arguments through its bin shim, for example `npx diffbeacon@0.1.0 review main...HEAD`
or `diffbeacon review main...HEAD` after `npm install diffbeacon@0.1.0`.

Attention observations do not fail the command. The CLI exits nonzero only for operational or input failures such as an invalid revision or unreadable repository.

## Example Attention Map

[`docs/examples/attention-map-sample.diff`](docs/examples/attention-map-sample.diff) is the exact
four-file input used here — real `git diff` output, so its hunk headers are what Git computed.
Piped through the built CLI —
`node packages/cli/dist/index.js review --stdin < docs/examples/attention-map-sample.diff` — it
produces the block below verbatim, with `summary.diagnostics` at 0.
`tests/stage10.docs-contract.test.ts` renders the same file through the shipped core and fails if
this quotation drifts, so the example is a measurement rather than an illustration.

```text
DiffBeacon
──────────

4 files changed    +16  -5

REVIEW ATTENTION
────────────────
FOCUS  Authentication / Access
       1 file · +3  -1
CHECK  Runtime Implementation
       3 files · +15  -4
CHECK  Dependencies
       1 file · +1  -1

EVIDENCE
────────
Runtime files changed, but no test-file content changes were observed in this diff.
Observed in: src/auth/session.ts, src/runtime/host.ts, src/runtime/pool.ts
Authentication or authorization files changed. No test-file content changes were observed in this diff.
Observed in: src/auth/session.ts
A dependency manifest content change was observed. No lockfile content change was observed in this diff.
Observed in: package.json

REVIEW ORDER
────────────
1. Authentication / Access
   1 authentication/access file changed in this diff. Access-control conventions
   follow the build frame and precede the code that relies on them, so the
   authorization boundary is established first.
2. Runtime Implementation
   3 runtime implementation files changed in this diff. Implementation files
   carry the executable behavior of the change and are read after the
   context-setting surfaces above.
3. Dependencies
   1 dependency file changed in this diff. Manifests and lockfiles name the
   third-party inputs that the implementation above resolves against.

CHANGED FILES
─────────────
modified  package.json  +1 -1
modified  src/auth/session.ts  +3 -1
modified  src/runtime/host.ts  +9 -2
modified  src/runtime/pool.ts  +3 -1
```

This output is a starting sequence, not an assertion that the first item is objectively more dangerous. `FOCUS`, `CHECK` and `NOTE` are navigation bands rather than severity, risk, urgency, confidence, or merge status, and every order entry states its own reason: how many files of that surface the diff showed, and which reading convention places the surface where it sits. The sequence, bands and reasons all come from one policy table — see [Review ordering policy](docs/architecture/overview.md#review-ordering-policy).

## GitHub Action

The JavaScript Action shares the same core and writes its review to the [GitHub Job Summary](https://docs.github.com/actions/monitoring-and-troubleshooting-workflows/using-workflow-notifications-and-summaries), which is its only output in v0.1: machine-readable use goes through the CLI's `--format json`. It runs the ordinary `pull_request` event, reads the base and head commit object IDs from the event payload DiffBeacon did not write, and needs no PAT, no secret, and no write permission. It does not post comments or call any network API.

### Two trust domains, one review

A pull-request workflow touches code from two different places, and conflating them is how a review tool becomes the attack:

| Trust domain                  | What it is                                         | What DiffBeacon does with it |
| ----------------------------- | -------------------------------------------------- | ---------------------------- |
| The Action that runs          | The DiffBeacon bundle named by a `uses:` reference | Executes                     |
| The repository being reviewed | The checked-out pull-request code                  | Reads as data — never runs   |

DiffBeacon only ever starts its own trusted bundle; the reviewed repository's scripts, package lifecycle hooks, build configuration, test code, Git hooks, external diff or textconv programs, and its own `action.yml` are never launched or installed. `tests/stage6.action-security-boundary.test.ts` proves it behaviorally with sentinels on every one of those surfaces, paired with live controls showing the same fixture does execute a program when an ordinary Git command is allowed to use it. `tests/stage8.no-target-execution.test.ts` repeats that measurement for the CLI path.

### Which reference a workflow should point at

**`uses: ./` is for trusted development only, and is not the recommended consumer pattern.** Under `on: pull_request`, `actions/checkout` delivers the _pull request's_ tree, so `uses: ./` loads the `action.yml` and bundle the contributor just wrote — the reviewed change picks the code that runs, and the pull request never has to be interesting for that to matter. That by itself crosses DiffBeacon's boundary: the repository under review is data, and it must never choose or execute the reviewer. GitHub does protect fork pull requests, normally restricting `GITHUB_TOKEN` to read-only and withholding secrets, and repository settings can change the details, so this is not a claim about any particular pull request's exact token privileges — it is a claim about whose code gets executed. DiffBeacon's own guards do not rescue this: the event-name check lives _inside_ the pull-request-controlled bundle, so it runs only after the attacker's entrypoint has started. Use `uses: ./` only where the Action source is already trusted — a workflow on a trusted branch of this repository, reviewing this repository's own commits.

**Consumers now have an independent, reviewed reference.** `v0.1.0` is an annotated tag whose peel target is commit `5a50b52028ead78942ea3fc3bee93ba26e0a79cc`, the GitHub Release for it is public, and a separate repository has run the Action from that exact commit (Actions run `37430396143`, recorded in [`docs/audits/stage14-v0.1.0-consumer-release.md`](docs/audits/stage14-v0.1.0-consumer-release.md)). DiffBeacon recommends pinning the **full 40-character commit SHA**: it names the precise bundle the runner will execute, and only the owner of this repository can move a tag, so a SHA is the reference a consumer can audit. The `v0.1.0` tag is the convenience form for anyone who accepts that difference; there is deliberately **no `v1` moving tag**, and creating one is not part of this release. The documented consumer workflow is in [`docs/examples/diffbeacon-pull-request-review.yml`](docs/examples/diffbeacon-pull-request-review.yml) as a non-executed example file, and its shape is:

```yaml
name: DiffBeacon review
on:
  pull_request:
permissions:
  contents: read
jobs:
  attention:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          fetch-depth: 0
          persist-credentials: false
      # Reviewed, immutable reference: the commit the v0.1.0 release was made at.
      # Prefer this full SHA over the movable tag, which a consumer cannot audit.
      - uses: Pavithran-R-A/DiffBeacon@5a50b52028ead78942ea3fc3bee93ba26e0a79cc
```

`pull_request_target` is not a workaround. It runs the workflow defined on the base branch, in the base repository's context, and its default checkout is the _base branch's_ code — which is exactly why the dangerous pattern there is a step that goes on to check out or run the pull request's code inside that more-trusted context. DiffBeacon needs none of the extra access that context brings and has no use for the trigger, so the Action rejects the event outright rather than reviewing it.

### Checkout contract

- `fetch-depth: 0` (or otherwise sufficient history). The default shallow checkout is not guaranteed to contain the pull request's base commit, and the Action resolves `base...head` inside that workspace; a missing base fails the step with a message naming the shallow or partial clone.
- `persist-credentials: false`. DiffBeacon performs no authenticated Git operation after checkout, so the runner's credentials do not need to survive into the steps that read untrusted code.
- `permissions: contents: read` and nothing more. The review writes only to `$GITHUB_STEP_SUMMARY`.

The lanes in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) run the CLI and Action quality
gates against trusted source only; no workflow in this repository consumes the Action on a pull
request. Consumption was proven elsewhere instead: on 2026-10-06 a separate temporary public
repository ran the pinned release commit on its own `pull_request` event and the job concluded
`success` (Actions run `37430396143`). Those lanes have executed in both environments this
repository has been given. On GitHub-hosted runners, Actions run
[`37191968216`](https://github.com/Pavithran-R-A/DiffBeacon/actions/runs/37191968216) (2026-10-04,
commit `889f52b6e53095fea978fafbe50017ff71e543db`) passed all five jobs: source gates on
`ubuntu-latest` and `windows-latest` at Node 24 and Node 22, plus the real-Chromium browser lane on
`ubuntu-latest` — the first time that lane concluded success on a hosted runner here. Earlier hosted
runs of the same workflow (Actions `36971746510`, `37188759053`, `37190394247`) each failed at a
recorded step and qualify nothing; the green run's job-level results are in
[`docs/audits/stage11-release-qualification.md`](docs/audits/stage11-release-qualification.md).
Repository-scoped **self-hosted** runners also executed the gates (Actions run `36562157439`, whose
lane-by-lane result is recorded in
[`docs/audits/stage9-ci-package-qualification.md`](docs/audits/stage9-ci-package-qualification.md));
those runners were unregistered afterwards. Hosted execution is not new to this repository: the
bootstrap-era workflows did receive GitHub-hosted runners and executed setup and checkout steps on
them before failing during archive extraction (Actions runs `32859849733`, `31819615124` and
`31818807881`), but those ran a different workflow on different commits and are historical evidence,
not product or release qualification. Consumption is now measured too: the pinned release commit ran
as an Action in a repository other than this one on 2026-10-06, and
[`docs/audits/stage14-v0.1.0-consumer-release.md`](docs/audits/stage14-v0.1.0-consumer-release.md)
records that run alongside the published package, tag and Release.

## Browser demo

The demo is deployed at
[https://pavithran-r-a.github.io/DiffBeacon/](https://pavithran-r-a.github.io/DiffBeacon/) — GitHub's
own deploy step reports that URL, and
[`docs/audits/stage12-public-source-pages.md`](docs/audits/stage12-public-source-pages.md) records the
checks run against the live page. To run the same static site locally:

```bash
npm run dev
```

The demo is a React + Vite application under `client/`. Paste a Git unified diff, choose **Analyze diff**, and read the Review Attention Map. The input guard is 8 MiB to bound browser memory use for an accidental enormous paste. The same `packages/core` engine powers the CLI, Action, and web demo.

`.github/workflows/pages.yml` builds `client/` with the Vite `base` set to `/DiffBeacon/` for the
repository subpath, as described in the [Vite static deployment guide][1], and deploys the artifact
through GitHub's official Pages actions. Deployment changes nothing about what the page can do: the
live page analyzed the README's own 1150-byte sample diff with zero outbound requests, no storage
writes, and no console output.

## Architecture

| Workspace         | Responsibility                                                                                                                                                                                         | Runtime boundary                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `packages/core`   | Unified diff parsing, normalized file model, detectors, evidence relationships, order, renderers, JSON Schema                                                                                          | No filesystem, child process, Git, GitHub, terminal, or network imports |
| `packages/cli`    | Validated Git range collection, stdin mode, pretty/JSON/Markdown output                                                                                                                                | Node process only; argument-vector Git execution with `shell: false`    |
| `packages/action` | Pull-request event SHA validation, diff collection, Job Summary output                                                                                                                                 | GitHub runner; bundled Node 24 artifact                                 |
| `client/`         | Static interactive demo with local analysis and accessible UI                                                                                                                                          | Browser only; no source-code upload                                     |
| `docs/`           | Architecture and detector documentation, workflow and diff examples, the release checklist, design research, quarantined recovery forensics, and the per-stage qualification reports in `docs/audits/` | Documentation only; no code reads it at runtime                         |

The JSON report is versioned at schema `1`. It intentionally contains no risk score, safety percentage, merge confidence, or other meaningless numeric verdict.

## Detector extension

Detectors are small modules in `packages/core/src/detectors/registry.ts`. To add one, define a stable ID, title, description, explicit path matcher, positive fixture, negative fixture, and documentation update. See [`docs/detectors/authoring-detectors.md`](docs/detectors/authoring-detectors.md).

The initial implementation uses conservative path conventions. It does not dynamically execute third-party detectors, infer arbitrary semantic API changes, or treat every security-related word as proof of an authentication change.

## Privacy and security model

Diff text, paths, revision names, and pull-request metadata are treated as untrusted input. DiffBeacon resolves small Git metadata queries through bounded argument-vector process execution and collects the actual diff through a bounded asynchronous `spawn` stream. Both use `shell: false`; revision tokens are validated, Git resolves commits before diffing, and `-c core.quotePath=true`, `--src-prefix=a/ --dst-prefix=b/`, `--ignore-submodules=none`, `--submodule=short`, `--diff-algorithm=myers`, `--find-renames=50%`, and `-l1000` make the parsed patch format deterministic and independent of repository diff configuration. The explicit prefixes are used instead of `--default-prefix` because that option is unavailable on older still-common Git releases; it was measured as rejected by Git 2.39.5 while the prefix pair produces byte-identical output there and on newer versions. External diff/text conversion and full binary patch payloads are disabled because DiffBeacon classifies, never applies, patches; `--` terminates the pathspec. Myers is selected for reproducibility, not because it is objectively superior. It does not source repository scripts, install target dependencies, run changed tests/builds, or execute files from the analyzed repository.

The browser paints diff-derived values as React text and `<code>` children; no `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, or `document.write` appears anywhere in shipped source, and `packages/core/src/display.ts` rewrites reordering, line-shaping, and executable control text at paint time. Parsed JSON keeps the raw value, while serialized JSON spells terminal-active display controls as Unicode escapes so the text itself remains inert. The Markdown renderer escapes table-breaking and HTML-looking path characters. The Action uses `node24`, a bundled artifact, trusted event SHAs, and a read-only `contents: read` workflow model.

Read the full boundary in [`docs/architecture/security.md`](docs/architecture/security.md) and [`SECURITY.md`](SECURITY.md).

## What DiffBeacon is not

DiffBeacon is not an AI code reviewer, security scanner, correctness checker, merge gate, risk model, test oracle, documentation completeness checker, or cloud SaaS. It does not know whether unchanged tests cover a change. It observes the pasted or checked-out diff only.

## Development commands

| Command                 | Purpose                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`  | Check formatting for DiffBeacon-owned files                                                                                                                                      |
| `npm run lint`          | Run ESLint with warnings treated as errors                                                                                                                                       |
| `npm run typecheck`     | Run strict TypeScript typechecking                                                                                                                                               |
| `npm test`              | Run the whole suite, source and browser projects together                                                                                                                        |
| `npm run test:source`   | Run only the source project (no browser engine needed)                                                                                                                           |
| `npm run test:browser`  | Run only the browser project; requires a local Chromium-class engine                                                                                                             |
| `npm run build`         | Build the core declarations, CLI bundle, Action bundle, and static web demo                                                                                                      |
| `npm run secret-scan`   | Scan tracked files for credential-shaped strings                                                                                                                                 |
| `npm run manifest`      | Regenerate `SOURCE_MANIFEST.txt` for the tracked source set                                                                                                                      |
| `npm run package-smoke` | Pack the CLI, inspect the tarball, install it in a clean project, invoke the real bin shim                                                                                       |
| `npm run action-smoke`  | Run the bundled Action against a temporary Git repository and inspect the Job Summary                                                                                            |
| `npm run verify`        | The complete gate, in order: source completeness, format, lint, typecheck, tests, build, artifact freshness, secret scan, manifest drift, CLI startup, package and Action smokes |
| `npm run check`         | Alias for `npm run verify`                                                                                                                                                       |

## Limitations

Path-based classification cannot understand arbitrary source-code semantics. A pasted diff does not reveal the complete repository state, whether unchanged tests cover a modification, or whether a manifest normally has a lockfile. Contract-file detection does not detect every public API change. Generated-file heuristics, rename forms, quoting, and unusual Git output have edge cases. DiffBeacon is an attention aid, not a security scanner or merge decision system.

[`docs/limitations.md`](docs/limitations.md) is the full statement of scope — what a surface may claim, what a diff cannot show, the patch-format and per-adapter boundaries, and what has not been measured.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md), [`AGENTS.md`](AGENTS.md), and the detector authoring
guide before changing behavior. Every detector needs positive and negative tests. Do not add
risk/safety scores or overclaiming language. Do not publish, release, or create a public repository
from this workspace without explicit maintainer authorization;
[`docs/releasing.md`](docs/releasing.md) is the checklist that such an authorization would follow.

Each stage of this project has an authoritative qualification report under
[`docs/audits/`](docs/audits/), and superseded handoffs are kept as historical records under
[`docs/audits/legacy/`](docs/audits/legacy/). Those reports, not the marketing prose above, are
where a claim was measured.

## License

MIT. See [`LICENSE`](LICENSE).

## References

[1]: https://vite.dev/guide/static-deploy 'Deploying a Static Site — Vite'
