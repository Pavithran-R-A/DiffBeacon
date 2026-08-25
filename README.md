# DiffBeacon

DiffBeacon helps a reviewer decide where to start when a pull request touches a lot of different parts of a repository.

It parses a unified Git diff, groups changed files into review surfaces such as authentication, CI, database, dependencies and tests, and produces an ordered attention map. The goal is not to decide whether a PR is safe; it is to give a human reviewer a useful first pass before reading every changed line.

## Quick start

The repository is an npm workspace. For local development, use Node.js 22+ and npm 10+.

```bash
npm ci
npm run check
```

Review a Git range:

```bash
npx diffbeacon review main...HEAD
```

Other useful forms:

```bash
npx diffbeacon review main...HEAD --format markdown
npx diffbeacon review main...HEAD --format json
git diff main...HEAD | npx diffbeacon review --stdin
```

## Example output

```text
DiffBeacon

4 files changed    +18  -4

REVIEW ATTENTION
FOCUS  Authentication / Access
CHECK  Dependencies

EVIDENCE
Authentication or authorization files changed.
No test-file changes were observed in this diff.

REVIEW ORDER
1. Authentication / Access
2. Runtime Implementation
3. Dependencies
```

The wording is intentionally based on evidence in the diff. For example, DiffBeacon can say that no test files changed; it cannot know that a PR has "no tests" or that unchanged tests do not cover the change.

## Where it runs

The same core package is used by three interfaces:

```text
packages/core/     diff parsing, detectors, ordering and renderers
packages/cli/      command-line interface
packages/action/   GitHub Action integration
client/            local browser demo
docs/              architecture and detector documentation
```

The browser demo analyzes pasted diff text locally. The core package itself has no network dependency.

## GitHub Action

The bundled Action writes its result to the GitHub Job Summary and only needs read access to repository contents.

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

For a real deployment, pin the Action reference to a reviewed tag or commit appropriate for your workflow.

## Adding a detector

Detectors live in `packages/core/src/detectors/registry.ts`. A new detector should have a stable ID, a narrowly defined path matcher, positive and negative fixtures, and documentation explaining what the signal means.

See [`docs/detectors/authoring-detectors.md`](docs/detectors/authoring-detectors.md) for the current convention.

## Security notes

Diff text, filenames and revisions are treated as untrusted input. Git commands are executed with argument vectors rather than through a shell, and the tool does not install or run code from the repository it is reviewing.

The full reasoning and implementation details are in [`docs/architecture/security.md`](docs/architecture/security.md) and [`SECURITY.md`](SECURITY.md).

## Development

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify
```

`npm run check` runs the complete local quality gate, including the package/Action smoke checks used by this repository.

## Limitations

DiffBeacon uses observable diff/path information, not semantic program analysis. It cannot prove correctness, test coverage, security or merge readiness. It is an attention aid for reviewers, not a replacement for review.

## License

MIT — see [`LICENSE`](LICENSE).
