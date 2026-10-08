# Stage 16 — DiffBeacon v0.1.1 release candidate

Status: **UNRELEASED — PREPARATION ONLY.** Nothing in this record authorizes publication.

The candidate starts from main commit `c17a6b032bbf8a97ab9fe090e85f234c1c77a36c`,
whose hosted CI run `37659210935` completed successfully in all five lanes. PR #6 merged
the Stage 15 hardening changes by squash without modifying the v0.1.0 tag or npm package.

This preparation changes only the public CLI workspace version to `0.1.1`, its matching
npm lockfile workspace entry, the pre-release changelog, the consumer README and a regression
test for lockfile/version parity. The private workspaces and root workspace stay at `0.1.0`
because they are not independent npm publications. The source manifest tracks the changed files.

## Before any v0.1.1 tag

1. Verify that all source and browser CI jobs succeed on the **exact release candidate SHA**.
2. Confirm clean package, Action and browser builds, manifest freshness, dependency audits and
   actual packed-tarball consumer smoke tests; record their output, not just intentions.
3. Set up and verify npm Trusted Publishing for `diffbeacon`, GitHub owner `Pavithran-R-A`,
   repository `DiffBeacon`, workflow filename `publish.yml`, allowing direct `npm publish`.
   This is a separate authenticated package-owner action.
4. Only after those gates pass, create and push an annotated immutable `v0.1.1` tag on the
   qualified release commit. The existing publish workflow will attempt irreversible npm publication.
5. Verify the public registry artifact, fresh consumer install and Action integration before
   creating the public GitHub Release and updating current-facing documentation.

Do **not** claim that `diffbeacon@0.1.1` exists on npm until independently verified there.
Do not create or move any tag in this preparation. Never republish or rewrite `v0.1.0`.
