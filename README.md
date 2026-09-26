# DiffBeacon

**Deterministic attention routing for pull requests.** See what changed, what evidence is present, and where human review should start.

DiffBeacon helps a maintainer understand a pull request before reading every changed line. It parses a unified diff, classifies observable review surfaces, reports neutral evidence relationships, and produces a deterministic review order.

> DiffBeacon maps review attention. It does **not** determine whether a pull request is safe to merge.

## What it does

DiffBeacon reports changed surfaces such as CI/build, authentication/access, database/schema, infrastructure, explicit API contracts, dependencies, tests, documentation, generated files, and runtime implementation. Its evidence language is deliberately narrow: “no test-file content changes were observed in this diff” is valid; “this pull request has no tests” is not. A renamed file is classified from both its old and new path, so moving code out of `src/auth/` still reports the authentication/access surface. A pure file-mode change is classified but never used to claim that a companion file is missing, and a line share is only stated when the diff actually reported the line counts behind it.

The core engine has no runtime network requirement and can run in Node or in a browser. The browser demo analyzes pasted unified diffs locally. No source upload, backend, account, database, analytics, telemetry, or runtime LLM is part of v0.1.

## Quick start

The repository is an unpublished npm workspace. For local development, use Node 22 or newer and npm 10+.

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

Actual output for a four-file diff piped through `node packages/cli/dist/index.js review --stdin`:

```text
DiffBeacon
──────────

4 files changed    +18  -5

REVIEW ATTENTION
────────────────
FOCUS  Authentication / Access
       1 file · +3  -1
CHECK  Runtime Implementation
       3 files · +17  -4
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

DiffBeacon only ever starts its own trusted bundle; the reviewed repository's scripts, package lifecycle hooks, build configuration, test code, Git hooks, external diff or textconv programs, and its own `action.yml` are never launched or installed. `tests/stage6.action-security-boundary.test.ts` proves it behaviorally with sentinels on every one of those surfaces, paired with live controls showing the same fixture does execute a program when an ordinary Git command is allowed to use it.

### Which reference is safe

**`uses: ./` is for trusted development only, and is not the recommended consumer pattern.** Under `on: pull_request`, `actions/checkout` delivers the _pull request's_ tree, so `uses: ./` loads the `action.yml` and bundle the contributor just wrote — the reviewed change picks the code that runs, inside a base-privileged context that may hold a token, and the pull request never has to be interesting for that to matter. DiffBeacon's own guards do not rescue this: the event-name check lives _inside_ the pull-request-controlled bundle, so it runs only after the attacker's entrypoint has started. Use `uses: ./` only where the Action source is already trusted — a workflow on a trusted branch of this repository, reviewing this repository's own commits.

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

`pull_request_target` is not a workaround. It grants base-branch privileges and a trusted checkout while the pull request still controls the code under review, DiffBeacon needs none of the extra access, and the Action rejects the event outright rather than reviewing it.

### Checkout contract

- `fetch-depth: 0` (or otherwise sufficient history). The default shallow checkout is not guaranteed to contain the pull request's base commit, and the Action resolves `base...head` inside that workspace; a missing base fails the step with a message naming the shallow or partial clone.
- `persist-credentials: false`. DiffBeacon performs no authenticated Git operation after checkout, so the runner's credentials do not need to survive into the steps that read untrusted code.
- `permissions: contents: read` and nothing more. The review writes only to `$GITHUB_STEP_SUMMARY`.

Continuous integration here runs the CLI and Action quality gates against trusted source; no workflow consumes the Action on a pull request, and no hosted consumer run has been qualified.

## Browser demo

Run the static demo locally:

```bash
npm run dev
```

The demo is a React + Vite application under `client/`. Paste a unified diff, choose **Analyze diff**, and read the Review Attention Map. The input guard is 8 MiB to bound browser memory use for an accidental enormous paste. The same `packages/core` engine powers the CLI, Action, and web demo.

For a repository-subpath GitHub Pages deployment, set the Vite `base` to `/<repository>/` as described in the [Vite static deployment guide][1]. This MVP does not deploy Pages.

## Architecture

| Workspace         | Responsibility                                                                                                | Runtime boundary                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/core`   | Unified diff parsing, normalized file model, detectors, evidence relationships, order, renderers, JSON Schema | No filesystem, child process, Git, GitHub, terminal, or network imports |
| `packages/cli`    | Secure Git range collection, stdin mode, pretty/JSON/Markdown output                                          | Node process only; safe argument-vector Git execution                   |
| `packages/action` | Pull-request event SHA validation, diff collection, Job Summary output                                        | GitHub runner; bundled Node 24 artifact                                 |
| `client/`         | Static interactive demo with local analysis and accessible UI                                                 | Browser only; no source-code upload                                     |
| `docs/`           | Research, architecture, detector authoring, security boundaries                                               | Maintainer and contributor documentation                                |

The JSON report is versioned at schema `1`. It intentionally contains no risk score, safety percentage, merge confidence, or other meaningless numeric verdict.

## Detector extension

Detectors are small modules in `packages/core/src/detectors/registry.ts`. To add one, define a stable ID, title, description, explicit path matcher, positive fixture, negative fixture, and documentation update. See [`docs/detectors/authoring-detectors.md`](docs/detectors/authoring-detectors.md).

The initial implementation uses conservative path conventions. It does not dynamically execute third-party detectors, infer arbitrary semantic API changes, or treat every security-related word as proof of an authentication change.

## Privacy and security model

Diff text, paths, revision names, and pull-request metadata are treated as untrusted input. DiffBeacon resolves small Git metadata queries through bounded argument-vector process execution and collects the actual diff through a bounded asynchronous `spawn` stream. Both use `shell: false`; revision tokens are validated, Git resolves commits before diffing, and `--src-prefix=a/ --dst-prefix=b/`, `--ignore-submodules=none`, `--submodule=short`, `--diff-algorithm=myers`, `--find-renames=50%`, and `-l1000` make the parsed patch format deterministic and independent of repository diff configuration. The explicit prefixes are used instead of `--default-prefix` because that option is unavailable on older still-common Git releases; it was measured as rejected by Git 2.39.5 while the prefix pair produces byte-identical output there and on newer versions. External diff/text conversion and full binary patch payloads are disabled because DiffBeacon classifies, never applies, patches; `--` terminates the pathspec. Myers is selected for reproducibility, not because it is objectively superior. It does not source repository scripts, install target dependencies, run changed tests/builds, or execute files from the analyzed repository.

The browser never injects diff-derived content through unsafe HTML APIs. The Markdown renderer escapes table-breaking and HTML-looking path characters. The Action uses `node24`, a bundled artifact, trusted event SHAs, and a read-only `contents: read` workflow model.

Read the full boundary in [`docs/architecture/security.md`](docs/architecture/security.md) and [`SECURITY.md`](SECURITY.md).

## What DiffBeacon is not

DiffBeacon is not an AI code reviewer, security scanner, correctness checker, merge gate, risk model, test oracle, documentation completeness checker, or cloud SaaS. It does not know whether unchanged tests cover a change. It observes the pasted or checked-out diff only.

## Development commands

| Command                 | Purpose                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `npm run format:check`  | Check formatting for DiffBeacon-owned files                                                |
| `npm run lint`          | Run ESLint with warnings treated as errors                                                 |
| `npm run typecheck`     | Run strict TypeScript typechecking                                                         |
| `npm test`              | Run parser, detector/evidence, renderer, CLI-input, and Action-event tests                 |
| `npm run build`         | Build the core declarations, CLI bundle, Action bundle, and static web demo                |
| `npm run package-smoke` | Pack the CLI, inspect the tarball, install it in a clean project, invoke the real bin shim |
| `npm run action-smoke`  | Run the bundled Action against a temporary Git repository and inspect the Job Summary      |
| `npm run verify`        | Check artifacts and run package/Action smoke tests                                         |
| `npm run check`         | Execute the complete local quality gate                                                    |

## Limitations

Path-based classification cannot understand arbitrary source-code semantics. A pasted diff does not reveal the complete repository state, whether unchanged tests cover a modification, or whether a manifest normally has a lockfile. Contract-file detection does not detect every public API change. Generated-file heuristics, rename forms, quoting, and unusual Git output have edge cases. DiffBeacon is an attention aid, not a security scanner or merge decision system.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md), [`AGENTS.md`](AGENTS.md), and the detector authoring guide before changing behavior. Every detector needs positive and negative tests. Do not add risk/safety scores or overclaiming language. Do not publish, release, or create a public repository from this workspace without explicit maintainer authorization.

## License

MIT. See [`LICENSE`](LICENSE).

## References

[1]: https://vite.dev/guide/static-deploy 'Deploying a Static Site — Vite'
