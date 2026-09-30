# DiffBeacon

**Deterministic attention routing for pull requests.** See what changed, what evidence is present, and where human review should start.

DiffBeacon helps a maintainer understand a pull request before reading every changed line. It parses a unified diff, classifies observable review surfaces, reports neutral evidence relationships, and produces a deterministic review order.

> DiffBeacon maps review attention. It does **not** determine whether a pull request is safe to merge.

## Status

DiffBeacon v0.1.0 is built, tested, and **not published**. Verified on 2026-09-30 against the npm
registry, this repository's remote, and its Actions API — [`docs/releasing.md`](docs/releasing.md)
owns the checklist that changes any row below.

| Question                                   | Answer now                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Published on npm?                          | No. `npm view diffbeacon` returns `404`; the CLI tarball exists only from `npm pack`, so `npx diffbeacon …` does not resolve.                                                                                                                                                                                                                                                                                         |
| Public repository, tag, or GitHub Release? | No. The repository is private, has zero tags and zero releases, so there is no immutable `uses:` reference a consumer could pin.                                                                                                                                                                                                                                                                                      |
| Deployed browser demo?                     | No. `client/` builds a self-contained static site, and `.github/workflows/pages.yml` only uploads a build artifact — it has no deploy step.                                                                                                                                                                                                                                                                           |
| Has CI ever actually run these gates?      | Yes, on repository-scoped **self-hosted** runners: GitHub Actions run `36562157439` executed the source lanes (Linux and Windows, Node 24 and Node 22), the real-Chromium browser lane (Windows / Node 24), and both package lanes.                                                                                                                                                                                   |
| Are GitHub-hosted runner images qualified? | No. GitHub-hosted runner images for the current CI remain unqualified: the recovered-source workflow used for release qualification has never been allocated a hosted runner, so `.github/workflows/ci.yml` is an unexecuted contract, and the browser contract's `ubuntu-latest` cell is unmeasured. Bootstrap-era hosted runs are the earlier, separate story told in [`docs/limitations.md`](docs/limitations.md). |

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

The repository is an unpublished npm workspace. For local development, use Node 22 or newer and npm 10+. `engines.node: ">=22"` is a floor, not a tested matrix: every release surface in this workspace is qualified on Node 22.x and Node 24.x only.

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

`diffbeacon` is not published to the npm registry yet, so `npx diffbeacon …` does not resolve today. After a published release the same arguments apply through the bin shim, for example `npx diffbeacon review main...HEAD`.

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

**Consumers need an independent, reviewed reference — which does not exist yet.** No public tag or release has been qualified, so there is no immutable DiffBeacon commit to hand out; Stage 11 owns publishing one. Until then, no `pull_request` workflow in another repository can consume DiffBeacon safely, and this README deliberately shows a placeholder instead of a fake SHA. The intended future consumer form, documented in [`docs/examples/diffbeacon-pull-request-review.yml`](docs/examples/diffbeacon-pull-request-review.yml) as a non-executed example file, is:

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
      # Placeholder, not a working reference: replace with the reviewed release's
      # full 40-character commit SHA once Stage 11 publishes one.
      - uses: Pavithran-R-A/DiffBeacon@<REVIEWED_FULL_COMMIT_SHA>
```

`pull_request_target` is not a workaround. It runs the workflow defined on the base branch, in the base repository's context, and its default checkout is the _base branch's_ code — which is exactly why the dangerous pattern there is a step that goes on to check out or run the pull request's code inside that more-trusted context. DiffBeacon needs none of the extra access that context brings and has no use for the trigger, so the Action rejects the event outright rather than reviewing it.

### Checkout contract

- `fetch-depth: 0` (or otherwise sufficient history). The default shallow checkout is not guaranteed to contain the pull request's base commit, and the Action resolves `base...head` inside that workspace; a missing base fails the step with a message naming the shallow or partial clone.
- `persist-credentials: false`. DiffBeacon performs no authenticated Git operation after checkout, so the runner's credentials do not need to survive into the steps that read untrusted code.
- `permissions: contents: read` and nothing more. The review writes only to `$GITHUB_STEP_SUMMARY`.

The lanes in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) run the CLI and Action quality
gates against trusted source only; no workflow in this repository consumes the Action on a pull
request, and no consumer repository has run it. Where those lanes have genuinely executed, they ran on
repository-scoped **self-hosted** runners — Actions run `36562157439`, whose lane-by-lane result is
recorded in [`docs/audits/stage9-ci-package-qualification.md`](docs/audits/stage9-ci-package-qualification.md).
GitHub-hosted runner images for the current CI remain unqualified. Hosted execution is not absent from
this repository's history: the bootstrap-era workflows did receive GitHub-hosted runners and executed
setup and checkout steps on them before failing during archive extraction (Actions runs
`32859849733`, `31819615124` and `31818807881`). Those runs executed a different workflow on different
commits and qualify nothing in the recovered source. The recovered-source CI workflow used for release
qualification has never been allocated a GitHub-hosted runner, so that half of the contract is
unexecuted rather than passing, and no hosted consumer run of the Action has been qualified anywhere.

## Browser demo

Run the static demo locally:

```bash
npm run dev
```

The demo is a React + Vite application under `client/`. Paste a unified diff, choose **Analyze diff**, and read the Review Attention Map. The input guard is 8 MiB to bound browser memory use for an accidental enormous paste. The same `packages/core` engine powers the CLI, Action, and web demo.

For a repository-subpath GitHub Pages deployment, set the Vite `base` to `/<repository>/` as described in the [Vite static deployment guide][1]. This MVP does not deploy Pages.

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

Diff text, paths, revision names, and pull-request metadata are treated as untrusted input. DiffBeacon resolves small Git metadata queries through bounded argument-vector process execution and collects the actual diff through a bounded asynchronous `spawn` stream. Both use `shell: false`; revision tokens are validated, Git resolves commits before diffing, and `--src-prefix=a/ --dst-prefix=b/`, `--ignore-submodules=none`, `--submodule=short`, `--diff-algorithm=myers`, `--find-renames=50%`, and `-l1000` make the parsed patch format deterministic and independent of repository diff configuration. The explicit prefixes are used instead of `--default-prefix` because that option is unavailable on older still-common Git releases; it was measured as rejected by Git 2.39.5 while the prefix pair produces byte-identical output there and on newer versions. External diff/text conversion and full binary patch payloads are disabled because DiffBeacon classifies, never applies, patches; `--` terminates the pathspec. Myers is selected for reproducibility, not because it is objectively superior. It does not source repository scripts, install target dependencies, run changed tests/builds, or execute files from the analyzed repository.

The browser paints diff-derived values as React text and `<code>` children; no `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, or `document.write` appears anywhere in shipped source, and `packages/core/src/display.ts` rewrites reordering, line-shaping, and executable control text at paint time while the JSON report keeps the raw value. The Markdown renderer escapes table-breaking and HTML-looking path characters. The Action uses `node24`, a bundled artifact, trusted event SHAs, and a read-only `contents: read` workflow model.

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
