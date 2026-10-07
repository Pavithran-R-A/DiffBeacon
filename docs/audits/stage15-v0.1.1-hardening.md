# Stage 15 — v0.1.1 hardening audit

Status: **IN PROGRESS**. This record must not be read as a release qualification or a publication claim.

Baseline reviewed: `main@e8fa37552134e9b47643901f4901cde4cadda81a` (the post-v0.1.0 Stage 14 tip).

This stage exists because a post-release line-by-line review found correctness and boundary cases that
were not disproved by the v0.1.0 release suite. v0.1.0 remains immutable; fixes are being prepared for
a later patch release.

## Confirmed findings being repaired

- Runtime JSON could preserve an out-of-range `similarity index` even though the published schema
  constrains similarity to 0 through 100.
- Quoted and extended Git path records accepted malformed/trailing material too permissively.
- Similarity metadata alone could incorrectly make a file look renamed.
- Mode metadata accepted malformed values that real Git does not emit.
- Rename/copy metadata could be incomplete or contradict the file header.
- A symbolic Git range could move between validation and diff collection unless both endpoints were
  resolved to commit object IDs first.
- Action event JSON parsing needed an explicit non-array object boundary.
- Secret scanning and source-manifest hashing needed to treat symlinks as tracked blobs rather than
  dereferencing arbitrary host paths.
- Secret scanning silently skipped NUL-bearing files.
- Detector path normalization treated a literal POSIX backslash filename byte as if it were a Git
  directory separator.
- The future publish workflow needed a fail-closed browser qualification in the publishing job itself
  and release-cache settings aligned with npm Trusted Publishing guidance.
- Current-facing documentation still contained a small number of pre-release statements after
  v0.1.0 was already live.
- Git mode parsing accepted any six octal digits instead of only file entry modes that Git can store.
- Contradictory add/delete/rename/copy/mode metadata could manufacture a status from hostile pasted
  input instead of falling back to the structural paths the parser had actually proved.
- Git stderr capture could exceed its intended bound when one emitted chunk was larger than the
  allowance.
- Raw JSON text could carry C1 or bidi-formatting controls that remain factual data after parsing but
  can still act on a terminal when the serialized report itself is printed or copied.
- The Pages workflow could be manually dispatched from a non-main ref and previously gave build/test
  code the same Pages/OIDC grants used by the deployment job.
- Git pathname quoting needed to be pinned explicitly, and undecodable repository filename bytes now
  fail closed rather than being silently normalized into replacement characters by the Git boundary.

## Evidence added in this branch

New and expanded tests cover runtime-to-schema conformance, similarity bounds, malformed Git modes,
quoted path records, real-Git path oracles, moving refs, Action event shapes, secret-scan byte bounds,
NUL-bearing files, symlink boundaries, detector backslash semantics, browser hostile corpus,
contradictory status metadata, Git stderr bounds, JSON display-control serialization, Pages deployment
credential isolation, pinned Git path quoting, the parser/collector split for undecodable filenames,
and the future publish workflow contract.

The tracked Action bundle and `SOURCE_MANIFEST.txt` are regenerated after source changes. Temporary
formatter/finalizer workflows used only to obtain repository-native Prettier/build output are removed
before candidate qualification.

## Qualification rule

Do not merge this branch and do not call v0.1.1 ready until the final exact branch tip has all five
ordinary CI jobs green (Ubuntu + Windows, Node 22 + 24, plus the real-Chromium lane), both npm audit
surfaces read zero high-or-higher vulnerabilities, the Action bundle has no drift, the source manifest
has no drift, package-smoke and action-smoke pass, and the final changed-file set contains no temporary
workflow.

No npm publish, tag, GitHub Release, Pages deployment, Marketplace submission, or v0.1.0 mutation is
authorized by this audit record.
