# Initial Detector Notes

| ID                | Recognizes                                                                        | Deliberate boundary                                                  |
| ----------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `ci-build`        | `.github/workflows/**`, `.github/actions/**`, common pipeline/build filenames     | Does not infer build impact from arbitrary source code               |
| `auth-access`     | Auth, authorization, permissions, RBAC, ACL, access-control paths                 | Does not treat every “security” filename as authentication           |
| `database-schema` | Migration directories, Alembic, Prisma, Rails-style migration paths, schema files | Does not infer database changes from arbitrary SQL strings in source |
| `dependencies`    | Manifests and lockfiles across common ecosystems                                  | Keeps manifest and lockfile evidence distinct                        |
| `api-contracts`   | OpenAPI/Swagger, GraphQL, protobuf, explicit schema paths                         | Does not claim to catch every public API change                      |
| `configuration`   | Meaningful config directories and common app/build/tool config files              | Does not label every dotfile as important                            |
| `infrastructure`  | Docker, Terraform, Kubernetes, Helm, deploy/manifests paths                       | Does not infer cloud impact from arbitrary deployment words          |
| `tests`           | Common test directories, fixtures, test/spec filename conventions                 | Does not prove coverage quality                                      |
| `documentation`   | README, docs, changelog, release notes, Markdown                                  | Does not prove documentation completeness                            |
| `generated`       | Explicit generated/dist/build output patterns, excluding lockfiles                | Uses volume only for an objective share observation                  |
| `runtime`         | Common implementation extensions outside tests/docs/generated paths               | Does not interpret code semantics                                    |
