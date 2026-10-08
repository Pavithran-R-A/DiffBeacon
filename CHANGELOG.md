# Changelog

This project aims at [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Its first release, `0.1.0`, reached the
npm registry and GitHub on 2026-10-06; the published release today is `0.1.1`, published on
2026-10-08. Capability details live in [`README.md`](README.md) and
[`docs/architecture/`](docs/architecture/), not here.

## Unreleased

No behaviour change is pending here. The Stage 17 pass that finalised the `v0.1.1` consumer release
left the repository documentation, the consumer Action example pin and this file pointing at the
published release; it changed no code, and it is recorded in
[`docs/audits/stage17-v0.1.1-release-finalization.md`](docs/audits/stage17-v0.1.1-release-finalization.md).

## 0.1.1 — 2026-10-08

Shipped as `diffbeacon@0.1.1` on npm at `2026-10-08T06:59:56.410Z`, from commit
`a89d8bb7d048bfd4e016e494428d04f060e82112`, which the annotated tag `v0.1.1` (tag object
`4012aa50f83a894445975d5713cb29976bf00a61`) names. Unlike `0.1.0`, this publication went through
`.github/workflows/publish.yml`: pushing that tag ran the workflow on a GitHub-hosted runner holding
only `contents: read` and `id-token: write`, and it published with provenance as Actions run
`37740211385` — 18 steps, every one success, and no credential in the repository, its settings or the
file. The same tag also ran `ci.yml` green in all five lanes (run `37740211315`), and `main` at that
commit had already been green (run `37722256817`). GitHub Release `406586383` — "DiffBeacon v0.1.1" at
<https://github.com/Pavithran-R-A/DiffBeacon/releases/tag/v0.1.1> — was published from the tag on
`2026-10-08T08:15:27Z` with no draft, no prerelease and no attached assets, so the Action bundle in
the tree stays the only copy of itself.

Measured 2026-10-08 from directories that were not this repository: `npm view diffbeacon version`
reports `0.1.1` and `dist-tags` is `{"latest":"0.1.1"}`, while `0.1.0` is still listed and unchanged;
the published tarball is 19025 bytes packed and 74394 unpacked across exactly `LICENSE`, `README.md`,
`dist/index.js` and `package.json`, MIT-licensed, `engines.node: ">=22"`, zero runtime dependencies,
and its downloaded bytes hash to the registry's `dist.shasum` `4f71c7672aa000cf68903345d651e3c302965c67`;
npm's attestation for `pkg:npm/diffbeacon@0.1.1` binds that digest to `.github/workflows/publish.yml`
at `refs/tags/v0.1.1` with `gitCommit = a89d8bb7d048bfd4e016e494428d04f060e82112`. A clean directory
installed `diffbeacon@0.1.1`, read `0.1.1` from `--version`, and ran eleven `review --stdin` /
`--output` cases over real `git diff` output plus three usage controls at exit `2`/`2`/`3`. A second
temporary consumer repository ran the Action pinned to the full release SHA on an ordinary
`pull_request` event — Actions run `37749736010`, job `113219738037`, five steps all success, `pull-requests: write`
nowhere, no PAT — and its Job Summary carried a real Review Attention Map for that pull request. The
pull request was closed and the repository archived, not deleted.

[`docs/audits/stage17-v0.1.1-release-finalization.md`](docs/audits/stage17-v0.1.1-release-finalization.md)
records those measurements, including the one that could not be retrieved through any API: GitHub
serves a Job Summary panel to a signed-in session only, so the published review body was reproduced
from the byte-identical bundle over the byte-identical commit range and labelled as a reproduction.
[`docs/audits/stage14-v0.1.0-consumer-release.md`](docs/audits/stage14-v0.1.0-consumer-release.md)
remains the record of the first release, which this one does not overwrite.

### Fixed

- Validate similarity percentages against the v1 JSON Schema and test emitted reports against it.
- Reject malformed, contradictory and undecodable Git diff metadata instead of inventing paths,
  statuses or out-of-range values; preserve Git's true path separator semantics.
- Snapshot Git range revisions and bound captured process output.
- Validate GitHub Action event shapes and keep its committed bundle reproducible.
- Scan tracked secrets and hash source-manifest symlinks without following paths outside the checkout.
- Escape display controls in serialized JSON and copied browser reports without changing parsed data.
- Harden Pages deployment qualification, main-branch dispatch and deployment-token isolation.
- Strengthen automated regression tests for parser, CLI, Action, browser, supply-chain and release
  workflows.

## 0.1.0 — 2026-10-06

Shipped as `diffbeacon@0.1.0` on npm at `2026-10-06T07:12:58.935Z`, from commit
`5a50b52028ead78942ea3fc3bee93ba26e0a79cc`, which the annotated tag `v0.1.0` names and GitHub Release
`404432804` points at (published `2026-10-06T07:28:16Z`, no draft, no prerelease, no attached
assets). Measured 2026-10-06: `npm view diffbeacon version` reports `0.1.0`, the published tarball is
byte-identical to the qualified pack, a throwaway project installed and ran it, and a separate
consumer repository ran the Action at that SHA on its `pull_request` event.
[`docs/audits/stage14-v0.1.0-consumer-release.md`](docs/audits/stage14-v0.1.0-consumer-release.md)
is the record of those measurements and [`docs/releasing.md`](docs/releasing.md) is the checklist the
release followed. [`docs/audits/stage11-release-qualification.md`](docs/audits/stage11-release-qualification.md)
records the qualification runs behind the shipped code, and
[`docs/audits/stage12-public-source-pages.md`](docs/audits/stage12-public-source-pages.md) records the
public-source and Pages measurements.

### Added

- **Core** — dependency-free unified-diff parser: explicit metadata/hunk/binary state machine, 8 MiB
  (`8388608` byte) bound, quoted and octal path decoding, renames read from both paths, `null` counts
  for mode-only changes; normalized file model shared by Node and browser.
- **Detectors** — eleven path surfaces (CI / Build, Authentication / Access, Database / Schema,
  Dependencies, API / Contracts, Configuration, Infrastructure / Deployment, Tests, Documentation /
  Changelog, Generated Files, Runtime Implementation), each with positive and negative fixtures.
- **Attention and ordering** — evidence relationships that claim only what the diff showed, a Review
  Attention Map, and a deterministic review order from one policy table. `FOCUS`/`CHECK`/`NOTE` are
  navigation bands, never severity, risk, confidence, or probability.
- **Renderers** — pretty, Markdown, and JSON at `schemaVersion: "1"`, with hostile display controls
  neutralized at render time while JSON keeps raw values.
- **CLI** — `review <rev>...<rev>` / `<rev>..<rev>` / `--stdin`, `--format`, `--output`,
  `--`, `NO_COLOR`, exit codes `0`/`1`/`2`/`3`/`4`, fixed-argument-vector Git with `shell: false`.
- **GitHub Action** — bundled `node24` artifact; `pull_request` only, full 40-character object IDs,
  Job Summary as its only output, no inputs or outputs, `contents: read` only, no token; never
  executes, installs, or tests the reviewed repository.
- **Browser demo** — static React + Vite page analyzing a pasted diff locally, with an 8 MiB pre-analysis
  guard and no upload, backend, storage, analytics, or runtime LLM. The build is pinned to production
  mode and rewrites sourcemap names against the project root, so the artifact contains no
  development-mode React and no path to the machine that built it.
- **Security hardening** — untrusted-input model, terminal and Markdown display-control
  neutralization, Git argv and ambient-environment boundary, workspace isolation for the Action, a
  seeded deterministic fuzz corpus, and a credential scan of the tracked tree.
- **Package and CI qualification** — `npm pack`/tarball inspection, clean-consumer install of the
  real bin shim on Windows and Linux, reproducible Action bundle rebuild, `SOURCE_MANIFEST.txt` drift
  gate, four-cell clean-clone matrix (Windows and Linux × Node 22 and 24), one executed
  self-hosted GitHub Actions qualification run (`36562157439`), and the same workflow then running green
  on GitHub-hosted runners — Actions run `37191968216` at commit
  `889f52b6e53095fea978fafbe50017ff71e543db` on 2026-10-04, all five jobs: the four source cells and
  the real-Chromium browser lane.
- **Public source and live demo** — the repository is public with `main` as its default branch, GitHub
  private vulnerability reporting is enabled for it, and `.github/workflows/pages.yml` deploys the
  static demo through `actions/configure-pages`, `actions/upload-pages-artifact` and
  `actions/deploy-pages`, each pinned to a resolved immutable commit SHA. Measured 2026-10-04: Pages
  run `37217200407` concluded `success` and GitHub reports the site at
  `https://pavithran-r-a.github.io/DiffBeacon/`, where a pasted diff still analyzes with zero outbound
  requests.
- **Published release surfaces** — `diffbeacon@0.1.0` on npm (MIT, `engines.node: ">=22"`, no runtime
  dependencies, four-file tarball byte-identical to the qualified pack), the annotated `v0.1.0` tag on
  the release commit, and the public GitHub Release with no attached assets. The Action was verified at
  that tag: `runs.using: node24`, `runs.main: packages/action/dist/index.js`, and the bundled artifact
  hashing to `45660da735388dee35fc581e94490d2aacc295b2382f8bea23ab12dff2350049`. Consumer-side proof
  covers installing and running the package from the registry in a throwaway project and one hosted
  `pull_request` run in a separate repository whose job concluded `success`. No GitHub Marketplace
  listing was requested or created, and no moving version tag was made — the documented consumer pin is
  the full commit SHA.

### Not included, on purpose

No merge gate, verdict, score, severity, confidence, or probability; no AI or LLM reviewer; no
vulnerability scanner; no hosted service, account, or telemetry; no pull-request comments, labels, or
check runs; no execution of the analyzed repository.
