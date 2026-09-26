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

The JavaScript Action shares the same core and writes a GitHub Job Summary. It does not post comments, modify the repository, require a PAT, require an LLM key, or request `pull-requests: write`.

Today the only runnable reference is the repository-local path form, because no published tag or marketplace entry exists yet:

```yaml
name: DiffBeacon
on:
  pull_request:
permissions:
  contents: read
jobs:
  attention:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: ./
```

`uses: ./` resolves the root [`action.yml`](action.yml) in the checked-out repository, so it works inside this repository only. The committed Action bundle is `packages/action/dist/index.js`. A public release should instead pin the `uses` reference to a reviewed tag or commit SHA; an owner-repo version-tag reference is not usable until such a tag exists in a public repository. The Action assumes the workflow provides the base and head commits in the local checkout; it does not execute code from the pull request. Continuous integration currently runs the CLI/Action quality gates rather than consuming the Action itself.

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
