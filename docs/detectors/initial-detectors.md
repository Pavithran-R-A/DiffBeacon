# Initial Detector Notes

A detector answers exactly one question: **does this changed path belong to a review
surface a human should look at?** It never answers whether the change is correct,
risky, or complete. Every rule below is a path convention, and every convention has a
boundary where it stops proving anything.

## Classification contract

| Fact                  | Rule                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detector authority    | The `oldPath` and `newPath` values the parser proved, never `displayPath`. `displayPath` exists for presentation.                                                                                                                                                                                                            |
| Renames               | Surfaces are the deterministic union over both sides, ordered by detector registration. `package.json → package.old.json` is still a dependency-manifest surface change.                                                                                                                                                     |
| Added / deleted files | One side is `null`; classification uses the side that exists.                                                                                                                                                                                                                                                                |
| Unproven paths        | The parser's `<unknown path>` presentation sentinel is filtered out before matching, so a file whose paths could not be proven claims no surface, no attention row, no review-order entry, and no evidence. A real file literally named `<unknown path>` is treated the same way, which is the safe direction of this trade. |
| Mode-only changes     | Still classified — a `chmod` on `package.json` genuinely touches the dependencies surface. They are excluded from relationship evidence, because "no lockfile changed alongside this" is a claim about content, and a pure mode change shows no content.                                                                     |
| Line counts           | A nullable count means "not observed", never zero. Evidence that needs counts is only stated when every content-bearing file reports them and no hunk was diagnosed as miscounted.                                                                                                                                           |
| Multiple surfaces     | Deliberate. `src/auth/session.ts` is truthfully both `auth-access` and `runtime`; forcing one surface per file would lose information.                                                                                                                                                                                       |

## `ci-build`

- Recognizes: GitHub workflow and composite-action directories, and named pipeline or
  build-entry conventions.
- Examples: `.github/workflows/ci.yml`, `.github/actions/example/action.yml`,
  `Jenkinsfile`, `buildkite.yml`, `azure-pipelines.yml`, `.circleci/config.yml`,
  `Makefile`, `Taskfile.yml`.
- Does not: infer build impact from arbitrary source code, or from prose that merely
  names a pipeline tool. `docs/workflows.md`, `buildkite-notes.md`, and `Makefile.md`
  are documentation, not CI. `.github/ISSUE_TEMPLATE/bug.yml` matches no surface.

## `auth-access`

- Recognizes: path segments `auth`, `authorization`, `permissions`, `rbac`, `acl`,
  `access-control`, and clearly delimited `auth`/`identity`/`session`/`permission`
  filename stems.
- Examples: `src/auth/session.ts`, `src/authorization/policy.ts`,
  `src/permissions/edit.ts`, `src/rbac/roles.ts`, `acl/lists.ts`,
  `access-control/gate.ts`, `session-store.ts`.
- Does not: match a word that merely contains the stem — `src/authentic.ts` and
  `src/author.ts` are runtime only — and does not treat "looks security-ish" as
  authentication. `src/oauth/client.ts` is a known miss: `oauth` is not one of the
  delimited stems. Nothing here indicates a vulnerability or its absence.

## `database-schema`

- Recognizes: migration directories (`migrations`, `migration`, `alembic`, `prisma`),
  Rails-style `db/migrate/**`, Drizzle `drizzle/**` and `db/drizzle/**`, and schema
  filenames `schema.prisma`, `schema.sql`, `*.migration.sql`.
- Examples: `db/migrate/001_add_users.rb`, `migrations/20200101_init.sql`,
  `alembic/versions/abc.py`, `prisma/schema.prisma`, `drizzle/0001_users.sql`.
- Does not: infer schema mutation from SQL-shaped text inside source, from an internal
  `src/schemas/form.ts`, or from prose such as `docs/migration-guide.md`. A `.rb` or
  `.py` migration is also `runtime`, which is a truthful overlap, not a bug.

## `dependencies`

- Recognizes: an explicit list of manifests (`package.json`, `pyproject.toml`,
  `go.mod`, `Cargo.toml`, `Gemfile`, `pom.xml`, `build.gradle[.kts]`, `composer.json`,
  `requirements.txt`, `Pipfile`) and lockfiles (`package-lock.json`,
  `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, `poetry.lock`, `Pipfile.lock`,
  `Cargo.lock`, `go.sum`, `Gemfile.lock`, `composer.lock`, `gradle.lockfile`).
- Examples: `package.json`, `app/package.json`, `pnpm-lock.yaml`, `go.mod`.
- Does not: match look-alikes — `package.example.json` claims nothing and
  `package-lock-notes.md` is documentation. Manifest and lockfile remain separate
  facts inside the same surface so their relationship evidence stays meaningful.

## `api-contracts`

- Recognizes: `openapi.yml|yaml|json`, `swagger.yml|yaml|json`, `.graphql`, `.gql`,
  `.proto`, an `openapi` path segment, and `api/**` files whose name is delimited
  `schema` or `contract`.
- Examples: `openapi.yml`, `swagger.json`, `api/schema.graphql`, `proto/user.proto`,
  `api/user_contract.ts`.
- Does not: claim that every public API change is caught. Ordinary `src/api/client.ts`,
  internal `src/schemas/form.ts`, and `docs/openapi-guide.md` match nothing here.

## `configuration`

- Recognizes: a `config` path segment plus the config filename convention
  (`config.<ext>`, `*.config.<ext>`, `tsconfig.json`, `.env.example`).
- Examples: `config/app.yml`, `.circleci/config.yml`, `vite.config.ts`,
  `webpack.config.js`, `eslint.config.js`, `tsconfig.json`.
- Does not: label `src/configuration.ts` or any source file that merely contains the
  word "config". Boundary with `runtime`: a configuration _file_ is not "runtime
  implementation", so `vite.config.ts` is `configuration` only, while a hand-written
  module that happens to live in a config directory (`src/config/loader.ts`) is
  deliberately both.

## `infrastructure`

- Recognizes: `Dockerfile`/`docker-compose*`, `.tf`/`.tfvars`, and the path segments
  `terraform`, `kubernetes`, `k8s`, `helm`, `deploy`, `manifests`.
- Examples: `Dockerfile`, `docker-compose.yml`, `infra/main.tf`,
  `k8s/deployment.yaml`, `deploy/helm/release.yaml`, `deploy/prod/manifests.yaml`.
- Does not: infer cloud, environment, or outage impact. A top-level `deployment.ts`
  is runtime only, `docs/docker-notes.md` is documentation, and a Helm chart laid out
  as `charts/app/templates/pod.yaml` is a known miss because `charts/` is also used by
  unrelated data-visualisation code.

## `tests`

- Recognizes: `test`, `tests`, `spec`, `specs`, `__tests__`, `fixtures` segments, and
  filename conventions `*.test.*`, `*_test.go`, `test_*.py`.
- Examples: `tests/core.test.ts`, `test/unit.py`, `spec/models/user_spec.rb`,
  `__tests__/auth.tsx`, `pkg/server_test.go`, `tests/fixtures/user.json`.
- Does not: match `src/contest.ts` or `src/latest.ts`, whose names only contain the
  letters, and does not treat a helper such as `src/test-utils/helper.ts` as a test
  file. Matching this surface never states whether coverage exists or is good.

## `documentation`

- Recognizes: a `docs` segment, `README`/`CHANGELOG`/`CONTRIBUTING`/`SECURITY`/
  `CODE_OF_CONDUCT`, `release-notes*`, and `.md`/`.mdx` files.
- Examples: `docs/architecture/overview.md`, `README.md`, `CHANGELOG.md`,
  `SECURITY.md`, `docs/release-notes-2.md`, `notes.mdx`.
- Does not: judge documentation completeness or correctness. Because `.md` is accepted
  anywhere, prose that sits beside code (`docs/docker-notes.md`) is documentation, not
  infrastructure — which is the intended reading.

## `generated`

- Recognizes: a `dist` or `generated` path segment, the repository-root `build/`
  output directory, and the filename suffixes `.generated.ts`, `.generated.js`,
  `.min.js`, `.map`. Lockfiles are excluded even inside `dist/`.
- Examples: `dist/bundle.js`, `build/out.js`, `packages/action/dist/index.js`,
  `src/client.generated.ts`, `src/app.min.js`, `styles/app.css.map`.
- Does not: follow `build` into nested directories. `src/build/index.ts`,
  `packages/build/src/index.ts`, and `src/builders/compiler.ts` are hand-written
  implementation; treating them as generated output made them disappear from `runtime`,
  which is why the segment rule became a root-prefix rule.
- Known miss: per-package output such as `packages/app/build/index.js`, which is
  indistinguishable from hand-written `build` modules by path alone.
- Volume use is objective only: it reports a share of files, and a share of lines only
  when every content-bearing file actually reported counts.

## `runtime`

- Recognizes: implementation extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.rb`,
  `.go`, `.rs`, `.java`, `.kt`, `.php`, `.cs`, `.c`, `.cc`, `.cpp`, `.swift`, `.ex`,
  `.exs`, `.sh`) outside tests, documentation, generated output, and config filenames.
- Examples: `src/index.ts`, `lib/main.go`, `scripts/bootstrap.sh`,
  `db/migrate/001_add_users.rb`.
- Does not: interpret code semantics, and no longer calls `vite.config.ts` an
  implementation file. `tests/app.test.ts`, `docs/guide.md`, and `dist/app.js` are
  excluded by design; a rename out of one of those locations reports both surfaces.

## Review order

Detectors only claim surfaces; the sequence a reviewer is offered comes from a separate
policy table in `packages/core/src/analyze.ts`. That matters for how a detector is judged:

- Registration order has no effect on the review order, so a new detector can be appended
  without disturbing any existing entry.
- A file that matches several surfaces is listed once under each of them, and matching more
  surfaces raises nothing. Surface count is never a weight.
- A rename unions both sides, so the surface a file leaves behind keeps its entry and its
  position; the order does not depend on which side the diff names first.
- Mode-only and binary changes appear in the order their paths claim, with reasons phrased
  about files rather than content, because they report no line counts.
- Bands and positions are a reading sequence for this diff. They are not severity, risk,
  urgency, confidence, or coverage, and no rule in this registry infers any of those.

Every surface's position, band and rationale are documented together in
[`docs/architecture/overview.md`](../architecture/overview.md#review-ordering-policy).

## Evidence relationships

Relationship evidence is reported separately from surfaces, in this fixed order:
`runtime-without-tests`, `auth-without-tests`, `database-without-tests`,
`manifest-without-lockfile`, `lockfile-without-manifest`, `contract-without-docs`,
`generated-volume`.

- The companion side of every rule is read from content-bearing files only, so a
  mode-only change can never be the missing half of a relationship nor the half that
  proves one.
- `generated-volume` needs at least two content-bearing generated files plus a file
  share or line share of at least one half. When counts are missing or a hunk was
  diagnosed as miscounted, only the file-count metrics are emitted and the message says
  so, instead of reporting a share computed from unknown lines.
- Every message is phrased as what this diff did or did not show — "no test-file content
  changes were observed in this diff" — and never as a property of the repository.
