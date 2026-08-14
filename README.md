# DiffBeacon

**Deterministic attention routing for pull requests.** See what changed, what evidence is present, and where human review should start.

DiffBeacon helps a maintainer understand a pull request before reading every changed line. It parses a unified diff, classifies observable review surfaces, reports neutral evidence relationships, and produces a deterministic review order.

> DiffBeacon maps review attention. It does **not** determine whether a pull request is safe to merge.

## What it does

DiffBeacon reports changed surfaces such as CI/build, authentication/access, database/schema, infrastructure, explicit API contracts, dependencies, tests, documentation, generated files, and runtime implementation. Its evidence language is deliberately narrow: “no test-file changes were observed in this diff” is valid; “this pull request has no tests” is not.

The core engine has no runtime network requirement and can run in Node or in a browser. The browser demo analyzes pasted unified diffs locally. No source upload, backend, account, database, analytics, telemetry, or runtime LLM is part of v0.1.

## Quick start

The repository is an unpublished npm workspace. For local development, use Node 22 or newer and npm 10+.

```bash
npm ci
npm run check
```

Review a Git range:

```bash
npx diffbeacon review main...HEAD
npx diffbeacon review main...HEAD --format markdown
npx diffbeacon review main...HEAD --format json
git diff main...HEAD | npx diffbeacon review --stdin
```

Attention observations do not fail the command. The CLI exits nonzero only for operational or input failures such as an invalid revision or unreadable repository.

## Example Attention Map

```text
DiffBeacon
──────────

4 files changed    +18  -4

REVIEW ATTENTION
────────────────
FOCUS  Authentication / Access
       1 files · +3  -1
CHECK  Dependencies
       1 files · +1  -0

EVIDENCE
────────
Authentication or authorization files changed. No test-file changes were observed in this diff.

REVIEW ORDER
────────────
1. Authentication / Access
2. Runtime Implementation
3. Dependencies
```

This output is a starting sequence, not an assertion that the first item is objectively more dangerous.

## GitHub Action

The JavaScript Action shares the same core and writes a GitHub Job Summary. It does not post comments, modify the repository, require a PAT, require an LLM key, or request `pull-requests: write`.

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
      - uses: Pavithran-R-A/diffbeacon@v1
```

The committed Action bundle is `packages/action/dist/index.js`. A future public release should pin the `uses` reference to a reviewed tag or commit. The Action assumes the workflow provides the base and head commits in the local checkout; it does not execute code from the pull request.

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

Diff text, paths, revision names, and pull-request metadata are treated as untrusted input. DiffBeacon resolves small Git metadata queries through bounded argument-vector process execution and collects the actual diff through a bounded asynchronous `spawn` stream. Both use `shell: false`; revision tokens are validated, Git resolves commits before diffing, and `--default-prefix`, `--diff-algorithm=myers`, `--find-renames=50%`, and `-l1000` make the parsed patch format deterministic. External diff/text conversion and full binary patch payloads are disabled because DiffBeacon classifies, never applies, patches; `--` terminates the pathspec. Myers is selected for reproducibility, not because it is objectively superior. It does not source repository scripts, install target dependencies, run changed tests/builds, or execute files from the analyzed repository.

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
