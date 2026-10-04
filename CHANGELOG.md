# Changelog

This project aims at [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). It has not made its first release, so
there is exactly one section: the unreleased `0.1.0` candidate. Capability details live in
[`README.md`](README.md) and [`docs/architecture/`](docs/architecture/), not here.

## 0.1.0 — Unreleased

Declared in `packages/cli/package.json`, **not published**. Measured again on 2026-10-04: `npm view
diffbeacon` returns `404`, there are zero tags, zero GitHub Releases and no Marketplace listing, while
the source repository is public and the browser demo is deployed to GitHub Pages.
[`docs/releasing.md`](docs/releasing.md) is the checklist an explicit maintainer authorization would
follow, [`docs/audits/stage11-release-qualification.md`](docs/audits/stage11-release-qualification.md)
is the record of the qualification runs behind this section, and
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
  requests. The npm package, the `v0.1.0` tag, the GitHub Release and the Marketplace listing are
  untouched by this.

### Not included, on purpose

No merge gate, verdict, score, severity, confidence, or probability; no AI or LLM reviewer; no
vulnerability scanner; no hosted service, account, or telemetry; no pull-request comments, labels, or
check runs; no execution of the analyzed repository.
