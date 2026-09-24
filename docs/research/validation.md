# DiffBeacon Phase Zero Validation

**Research date:** 2026-08-12 (GMT+5:30)

This short validation pass was used to make implementation decisions for DiffBeacon v0.1. It is not a claim that the project has been exhaustively benchmarked or that its name is globally protected.

## Sources consulted

| Area                      | Source                                                   | Decision-relevant finding                                                                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub JavaScript Actions | [Creating a JavaScript action — GitHub Docs][1]          | Current examples use `runs.using: node24`; consumers receive a packaged action, so dependencies should be bundled into the committed `dist/` artifact. The guide also warns that action code may process untrusted input.                                                                   |
| GitHub Actions security   | [Secure use reference — GitHub Docs][2]                  | Untrusted pull-request code must not be checked out in privileged workflows. Least privilege and explicit token permissions are recommended. DiffBeacon therefore analyzes Git data only, avoids `pull_request_target`, requests no write permission, and does not execute repository code. |
| Node support              | [Node.js Releases][3]                                    | Node 24 is Active LTS as of the research date; Node 22 is also LTS, while Node 20 is EOL. The project baseline is Node 22+ for local tooling, with the GitHub Action using the current Node 24 runtime.                                                                                     |
| Static web deployment     | [Deploying a Static Site — Vite][4]                      | A Vite build produces a static `dist` directory. GitHub Pages requires a repository-aware `base` path when deployed under `/<repo>/`; the web demo keeps this configurable and does not deploy in this task.                                                                                |
| npm packaging             | [npm pack — npm Docs][5]                                 | `npm pack` creates the installable tarball and supports a dry-run/pack-list inspection workflow. The package smoke test therefore builds, packs, inspects, installs into a clean temporary project, and invokes the real bin shim.                                                          |
| Name registry             | `npm view diffbeacon name version`                       | Returned the registry's genuine `E404 Not Found` response for `diffbeacon@*`; no package metadata was returned. A second `npm search diffbeacon --json` produced no result lines in this environment.                                                                                       |
| Exact GitHub name         | `GET https://api.github.com/repos/diffbeacon/diffbeacon` | Returned JSON `404 Not Found`. Search results showed unrelated Beacon projects, but no exact `diffbeacon/diffbeacon` repository. This is evidence for the local MVP only, not a trademark or global identity clearance.                                                                     |
| Current package versions  | npm registry checks                                      | At research time, the registry reported TypeScript `7.0.2`, Vitest `4.1.10`, Vite `8.2.1`, and historical `@vercel/ncc` `0.44.1` lookup data. The implementation locks its actual installed versions in the workspace lockfile rather than relying on floating ranges.                      |

## Important conclusions

DiffBeacon should be a TypeScript npm-workspaces monorepo with a dependency-light `packages/core` that accepts plain strings and returns plain data. The core must not import Node filesystem, child-process, GitHub, React, or terminal modules. This allows the same deterministic engine to run in the CLI, Action, and browser demo.

The GitHub Action should use `node24` in `action.yml`, commit a bundled JavaScript entrypoint, and produce a job summary rather than comments or repository mutations. The example workflow should set `permissions: contents: read`, use a non-privileged pull-request workflow, and document checkout depth requirements. No PAT, LLM key, or `pull-requests: write` permission is needed.

The browser demo should be a static Vite application. Its analysis path must be synchronous/local and must not call an API. It should state that pasted diffs stay in the browser and that the product maps review attention rather than determining whether a pull request is safe to merge.

## Naming result

The working name **DiffBeacon** is usable for this private, unpublished MVP based on the registry and exact GitHub checks above. The name is not published, registered, trademark-cleared, or guaranteed to remain available. The implementation must not publish it or create a public repository during this task.

## Version and tooling decisions

| Decision               | Chosen direction                                              | Rationale                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime baseline       | Node 22+ for local development; Node 24 for the GitHub Action | Node 22 and 24 are supported LTS lines; Action metadata follows current GitHub guidance.                                                                                                                                             |
| Package manager        | npm workspaces with a committed `package-lock.json`           | The deliverable explicitly requires real npm pack/bin testing and low contributor setup.                                                                                                                                             |
| Language               | Strict TypeScript                                             | Shared contracts, parser safety, and stable programmatic API are easier to audit.                                                                                                                                                    |
| Unit/integration tests | Vitest                                                        | It covers pure core tests, CLI subprocess tests, and Action/web-adjacent logic without introducing a second test runner.                                                                                                             |
| Action bundler         | `esbuild`                                                     | The active implementation uses esbuild to create a single committed JavaScript artifact without requiring consumers to install dependencies. The earlier `@vercel/ncc` lookup is historical research only, not the selected bundler. |
| Browser                | React + Vite, static only                                     | The product needs a polished interactive map while retaining zero backend, telemetry, and source-code upload.                                                                                                                        |
| Schema                 | Versioned JSON representation plus JSON Schema                | Consumers can pin the v0.1 shape and auditors can validate report output independently.                                                                                                                                              |

## Overlapping projects and positioning

GitHub's own pull-request experience and current pull-request dashboard increasingly support tracking, prioritizing, and acting on review work. Graphite and other review-workflow tools focus on review status, collaboration, and throughput. AI code-review projects such as GitHub Copilot code review and open-source AI review CLIs inspect code and produce feedback or suggestions.

DiffBeacon is intentionally narrower. It does not review code, run code, call an LLM, assign a risk score, or make a merge recommendation. Its differentiator is a deterministic **attention map** built from the diff's observable file structure and evidence relationships: changed surfaces, observed companion evidence, and neutral “not observed in this diff” statements. This makes it complementary to a code reviewer or review dashboard rather than a replacement for either.

## Naming and positioning caveats

The exact-name checks above are not legal advice and do not cover every package registry, domain, trademark database, or GitHub account configuration. Before any public release, a maintainer should repeat the checks, review trademark conflicts, and decide whether to reserve or rename the package.

## References

[1]: https://docs.github.com/en/actions/tutorials/create-actions/create-a-javascript-action 'Creating a JavaScript action — GitHub Docs'
[2]: https://docs.github.com/en/actions/reference/security/secure-use 'Secure use reference — GitHub Docs'
[3]: https://nodejs.org/en/about/previous-releases 'Node.js Releases'
[4]: https://vite.dev/guide/static-deploy 'Deploying a Static Site — Vite'
[5]: https://docs.npmjs.com/cli/v11/commands/npm-pack 'npm pack — npm Docs'
