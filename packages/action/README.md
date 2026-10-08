# DiffBeacon GitHub Action

The Action is the same `packages/core` engine the CLI uses, wrapped for one job: read a
pull request's diff with `git diff`, and append the resulting [Review Attention
Map](../../README.md#what-it-does) to the [GitHub Job
Summary](https://docs.github.com/actions/monitoring-and-troubleshooting-workflows/using-workflow-notifications-and-summaries).

It does not post or edit comments, push, request a PAT or any secret, call a network API, or
install or run anything from the repository it is reviewing. Its Job Summary is its only
output: `action.yml` declares no `inputs` and no `outputs`, because the review already exists
in machine-readable form through the CLI's `--format json`, and a second copy in
`$GITHUB_OUTPUT` would be a second contract to keep in sync.

Because that is the only output, reading a past run's review back is a web-UI action: GitHub does not
expose a Job Summary body through any API endpoint. Measured on 2026-10-08, `/check-runs/{id}` returns
`output.summary` as `null` and the `/actions/runs/{id}/summary` and `/actions/jobs/{id}/summary` routes
answer HTTP 404, so the run's conclusion is machine-verifiable while its rendered content is not.
[`docs/audits/stage17-v0.1.1-release-finalization.md`](../../docs/audits/stage17-v0.1.1-release-finalization.md)
§4.5 records how the panel behind the consumer proof was nevertheless identified — the release bundle
hashed three ways, then replayed against the same merge commit.

## What it reads

The Action takes no inputs. Everything it needs comes from the four variables the runner
exports, and it fails with a named message rather than a stack trace if any is missing:

| Variable              | Used for                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `GITHUB_EVENT_NAME`   | Must be `pull_request`. Anything else — including `pull_request_target` — is refused.     |
| `GITHUB_EVENT_PATH`   | The event payload file, read for `pull_request.base.sha` and `pull_request.head.sha`.     |
| `GITHUB_WORKSPACE`    | The only directory `git` is run in. The Action never falls back to the process' location. |
| `GITHUB_STEP_SUMMARY` | The file the review is appended to. Required, so a silent no-output run cannot happen.    |

Both commit IDs must be full object IDs (40 hexadecimal characters, or 64 for a SHA-256
repository). Abbreviations, branch names, and anything shaped like shell or Git revision
syntax are rejected before Git starts, so the range can only ever be `base...head` between two
complete objects that the event itself named.

Exit status is `0` when the review reached the Job Summary and `1` for every failure, with the
reason on standard error prefixed `DiffBeacon Action error:`. On failure nothing is appended,
so a workflow's summary never carries a half-written review.

## Trust domains: why `uses: ./` is not the consumer pattern

`uses: ./` resolves to `action.yml` **in the checked-out tree**. Under `on: pull_request` that
tree is the contributor's, so the path form lets the change under review choose the code that
runs — before any DiffBeacon guard executes, because those guards live in the bundle being
chosen. The path form is therefore for trusted development and self-testing only: a workflow
on a trusted branch of this repository, reviewing this repository's own commits. It is not the recommended consumer
pattern, and no example in this repository presents it as one.

Consumers need the Action referenced independently of the repository being reviewed, by a reviewed
immutable commit SHA. That reference exists at each release: the annotated `v0.1.1` tag (object
`4012aa50f83a894445975d5713cb29976bf00a61`) peels to commit
`a89d8bb7d048bfd4e016e494428d04f060e82112`, whose `packages/action/dist/index.js` bundle is 60064
bytes hashing to `e37f412192346e903ae88e45b3506ad9fa909b90f5655f7eec7a098790c3db42` — a digest
measured three ways, through the raw URL at the SHA, at the tag, and out of the commit object — and a
repository other than this one has run it from that commit: Actions run `37749736010` on 2026-10-08,
recorded in
[`docs/audits/stage17-v0.1.1-release-finalization.md`](../../docs/audits/stage17-v0.1.1-release-finalization.md).
The first such proof ran at the `v0.1.0` release commit `5a50b52028ead78942ea3fc3bee93ba26e0a79cc`
(bundle `45660da735388dee35fc581e94490d2aacc295b2382f8bea23ab12dff2350049`, Actions run `37430396143`)
on 2026-10-06, in
[`docs/audits/stage14-v0.1.0-consumer-release.md`](../../docs/audits/stage14-v0.1.0-consumer-release.md).
Pin the **full commit SHA**: it names the exact bundle the runner will execute, and only this
repository's owner can move a tag, so a SHA is the reference a consumer can audit. The version tag
points at the same commit for anyone who prefers the shorter form; there is deliberately no moving
major tag, and creating one is not part of this release. Check for yourself what a reference resolves
to, with `git ls-remote --tags origin` and this repository's Releases page, and read the release
runbook in [`docs/releasing.md`](../../docs/releasing.md). The consumer shape is documented as a
non-executed example file in
[`docs/examples/diffbeacon-pull-request-review.yml`](../../docs/examples/diffbeacon-pull-request-review.yml):

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
      - uses: Pavithran-R-A/DiffBeacon@a89d8bb7d048bfd4e016e494428d04f060e82112
```

`pull_request_target` is not the alternative. It runs the base branch's workflow in the base
repository's context, and its default checkout is the base branch rather than the pull request —
that more-trusted context is why adding a pull-request checkout there, or otherwise running the
contributor's code inside it, is the well-known failure mode. DiffBeacon needs none of that access
and has no use for the trigger, so the Action refuses the event before reading the payload or
touching Git.

## Checkout requirements

- **Full history.** The Action resolves `base...head` locally, so the checkout must contain
  both commit object IDs from the event. `fetch-depth: 0` satisfies this; the default shallow
  checkout does not, and a shallow or partial clone is reported as such rather than as an
  empty diff.
- **`persist-credentials: false`.** DiffBeacon performs no authenticated Git operation after
  checkout, so the runner's credentials need not persist into the steps that read untrusted
  code.
- **`permissions: contents: read` and nothing more.** No write scope is used or needed.

## Layout and qualification

- `packages/action/src/index.ts` — entrypoint and runner contract
- `packages/action/src/logic.ts` — event gate and range construction
- `packages/action/src/entry.ts` — startup guard
- `packages/action/dist/index.js` — committed bundle that `action.yml` points at, rebuilt by
  `npm run build`

Behavior is covered by `tests/stage6.action-event.test.ts` (the event contract),
`tests/stage6.action-runner.test.ts` (workspace, summary, topology, missing history),
`tests/stage6.action-security-boundary.test.ts` (nothing in the reviewed repository runs),
`tests/stage6.action-metadata.test.ts` (`action.yml` and the shipped bundle), and
`tests/stage6.action-workflow-docs.test.ts` (this documentation). `node
scripts/action-smoke.mjs` launches the bundle path that `action.yml` names, from a working
directory outside the reviewed repository. All of it runs locally on Windows and Linux, and the same
lanes have passed in this repository's CI on GitHub-hosted runners (Actions run
[`37191968216`](https://github.com/Pavithran-R-A/DiffBeacon/actions/runs/37191968216) at commit
`889f52b6e53095fea978fafbe50017ff71e543db`, 2026-10-04). What was not qualified as of that commit is
consumption: no repository other than this one had run the Action, and no release commit existed for
one to pin. `docs/audits/` records the stage that changes either half of that sentence.
