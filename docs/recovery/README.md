# Recovery forensics — quarantined bootstrap workflows

**Status: these files are forensic records. They are not executable GitHub Actions
workflows.** They live outside `.github/workflows/` deliberately, so GitHub will not run
them. Their contents are byte-for-byte copies of the Git blobs that were committed on
`main` at `e0ff98143bfe39c80c338518d006525a846a8739`.

| File                        | Provenance                             | Bytes | SHA-256                                                            |
| --------------------------- | -------------------------------------- | ----- | ------------------------------------------------------------------ |
| `bootstrap2.failed.yml.txt` | was `.github/workflows/bootstrap2.yml` | 1595  | `666e2b9026f78ea17953dc608373d174b17fa2c37a538218ebceffb82617b4e5` |
| `bootstrap.failed.yml.txt`  | was `.github/workflows/bootstrap.yml`  | 190   | `51fe2183ab70b693924874e4cc1554cb38b459f8e02f1a8d397df22355e8e6ee` |

The raw Base64 chunk evidence is also retained, unchanged, at `.bootstrap/` and
`.bootstrap2/` in the repository root.

## Why these workflows existed

`DiffBeacon`'s first 12 commits never contained a normal source tree. Instead the author
staged the source as split Base64 payloads and used GitHub Actions to reassemble them at
build time:

1. **Bootstrap 1** (`.bootstrap/chunk00..02`, workflow `Disabled bootstrap helper`, job
   `build-candidate`) concatenated three chunks, ran `base64 --decode` to a `.tar.gz`,
   and asserted required files.
2. **Bootstrap 2** (`.bootstrap2/chunk00..02` plus a committed `payload.tar.xz`, workflow
   `Bootstrap exact verified DiffBeacon tree`, job `import`) extracted `payload.tar.xz`
   and asserted `package.json`, `.github/workflows/ci.yml`,
   `packages/action/dist/index.js`, `SOURCE_MANIFEST.txt`, and a file count of exactly 89.
   On success it created an orphan branch and ran
   `git push --force origin HEAD:refs/heads/candidate` with `contents: write`.

## Why they failed — from the real runner logs

Both causes were confirmed against GitHub Actions logs, not inferred.

**Bootstrap 2** — run `32859849733` (also `31819615124`), runner `1000002337`, step
`Extract exact verified archive payload`, exit code 2:

```text
tar -xJf .bootstrap2/payload.tar.xz -C /tmp/diffbeacon-source
xz: (stdin): Unexpected end of input
tar: Unexpected EOF in archive
tar: Unexpected EOF in archive
tar: Error is not recoverable: exiting now
##[error]Process completed with exit code 2.
```

Local reproduction: the committed `payload.tar.xz` is byte-for-byte equal to decoded
`chunk00` alone (11250 bytes) — roughly the first third of the intended stream.
Concatenating `chunk00..02` yields 45000 Base64 characters → 33750 bytes with a valid XZ
header (`FD 37 7A 58 5A 00`) but **no XZ footer**; `xz -t` reports `Unexpected end of
input`, and a decompressor consumes 33750/33750 input bytes and still reports
`eof=False, needs_input=True`. Chunks `03`–`08` from the `payload 01/09 … 03/09` commit
sequence were never committed and are not reachable from any ref, tag, stash or
unreachable object. **The payload is truncated, not mis-configured.**

**Bootstrap 1** — run `31818807881`, step `Reconstruct verified source archive`, exit
code 1:

```text
cat .bootstrap/chunk00 .bootstrap/chunk01 .bootstrap/chunk02 | base64 --decode > /tmp/diffbeacon-source.tar.gz
tar -xzf /tmp/diffbeacon-source.tar.gz -C /tmp/diffbeacon-source
test -f /tmp/diffbeacon-source/package.json
test -f /tmp/diffbeacon-source/.github/workflows/ci.yml
test -f /tmp/diffbeacon-source/packages/action/dist/index.js
##[error]Process completed with exit code 1.
```

The decode and `tar -xzf` **succeeded**; a required-file assertion then failed. That
archive is complete and valid (`gzip -t` clean) but contains **11 Markdown documents
only** — no `package.json`, no `packages/`, no tests, no manifest. Bootstrap 1 was
pointed at a documentation bundle.

## Recovery is complete

The real v0.1.0 source tree was recovered, manifest-verified 87/87, and imported on
`rescue/stage0-source`. Its attribution to this repository is proven independently:
partially inflating the truncated `.bootstrap2` stream exposes 35 tar headers whose 26
complete member payloads are byte-identical to the recovered tree, and whose
`todo.md`/`SOURCE_MANIFEST.txt` sizes match the recovered `-v2` variant specifically.
See [`stage0-source-recovery.md`](stage0-source-recovery.md) for the full evidence.

## Why they were quarantined rather than deleted

`bootstrap2.yml` requests `contents: write` and ends in a force-push plus an orphan-branch
rewrite. Leaving it executable in `.github/workflows/` keeps destructive machinery armed
for no remaining benefit, because its payload can never validate. At the same time it is
the primary record of how this repository was built, so deleting it outright would
destroy evidence. Moving it outside `.github/workflows/` satisfies both constraints.

Nothing in this directory is read by any workflow, test, or build script. The original
files remain permanently recoverable from Git history at `e0ff981`.

Note also that `scripts/verify.mjs` rejects a `pnpm-workspace.yaml` at the repository
root as an obsolete template surface; this project is npm-only.
