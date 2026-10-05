# DiffBeacon CLI

The CLI reviews a Git range using the shared local core. It uses argument-vector Git execution with external diff and text-conversion hooks disabled. It does not execute repository scripts, install repository dependencies, run tests, or upload source code. It never fetches, mutates, or cleans the repository it is pointed at.

As of the commit this tarball was packed from, `diffbeacon` is not published to the npm registry yet, so `npx diffbeacon …` does not resolve there; `npm view diffbeacon` is the authority on whether it resolves now. Build this repository and run the bundle, or install the packed tarball and use the `diffbeacon` bin:

```bash
npm run build
node packages/cli/dist/index.js review main...HEAD
node packages/cli/dist/index.js review main..release/1.2 --format markdown
git diff main...HEAD | node packages/cli/dist/index.js review --stdin
```

`engines.node` is `>=22`, which is a floor rather than a tested matrix: this package is qualified on Node 22.x and Node 24.x, and any other Node release installs it unqualified.

## Accepted forms

```text
review <rev>...<rev> [--format pretty|json|markdown] [--output <file>]
review <rev>..<rev>   [--format pretty|json|markdown] [--output <file>]
review --stdin        [--format pretty|json|markdown] [--output <file>]
--help, -h            --version, -v
```

- A single revision such as `review HEAD` is rejected: DiffBeacon analyses one comparison
  between two endpoints and never compares a revision against the working tree.
- `--format` and `--output` take their value as a separate argument; `--format=json` is rejected.
- Each selector appears at most once, and `--stdin` excludes a revision range.
- `--` ends option parsing; later words are read as revisions only.
- Diff input is capped at 8 MiB (8388608 bytes), for a pipe and for `git diff` alike.
- `--output <file>` writes the report to that file instead of stdout, as one UTF-8 text file
  ending in a single newline, with no terminal colour. Pretty output on stdout is coloured
  only for an interactive terminal; `NO_COLOR` disables it.

## Exit codes

| Code | Meaning                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0    | A report was produced. Observed attention levels never change this.                                                           |
| 1    | Unexpected internal failure.                                                                                                  |
| 2    | Usage error: unknown command or option, bad range syntax, repeated selector.                                                  |
| 3    | No diff available: not a repository, unresolvable or shallow history, a failing `git` process, or a diff over the size limit. |
| 4    | The `--output` file could not be written.                                                                                     |
