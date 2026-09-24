# DiffBeacon Stage 0 — Source Rescue & Repository Normalization

STATUS: **PASS (verified recovery)** — see *Caveats* for the two open items the auditor must rule on.

Executed locally on 2026-09-24 against a fresh clone of `Pavithran-R-A/DiffBeacon`.
All claims below were reproduced with real tools (`git`, Python 3.13 `base64`/`lzma`/
`zipfile`/`hashlib`, `xz 5.8.3`, `gzip`, `tar`, `unzip`, `npm 11.19.0` / Node 24.21.0).

## 1. Starting state

| Item | Value |
| --- | --- |
| Starting SHA (`origin/main`) | `e0ff98143bfe39c80c338518d006525a846a8739` |
| Commit message | `docs: rewrite README for developers` |
| Branches (local + remote) | `main` only |
| Tags | none |
| Stashes / reflog history / unreachable objects | none (fresh clone; `git fsck --full --unreachable --dangling` clean; 49 objects total, 12 blobs ever) |
| Paths ever present in all of history | the 10 bootstrap/README files only |
| Working tree at start | clean; no unrelated user changes to preserve |

The starting SHA matched the SHA supplied in the tasking. **No normal source tree has
ever existed in this repository's Git history** — commits `4dcb9cd` ("stage exact
verified DiffBeacon archive") and `7c862eb` ("import exact verified DiffBeacon source
tree") do **not** match their messages; `4dcb9cd` added only `payload.tar.xz` and
`7c862eb` added only `.github/workflows/bootstrap2.yml`. Message-based reasoning about
this repository is unsafe.

## 2. `.bootstrap2` — proof of failure

Each chunk is a single ASCII line, zero whitespace bytes, all characters valid Base64,
no `=` padding.

| Chunk | bytes/chars | SHA-256 |
| --- | --- | --- |
| `chunk00` | 15000 | `dc40e0504da85e679697961a5197e2800036f6585b0945ceebdc7cd2b8d73516` |
| `chunk01` | 15000 | `6671e3f0447326308b6c6c22ff6488ce7c49de67f0dd5b45551ecd37150e00bc` |
| `chunk02` | 15000 | `77a0d3fdb4672457da3df037b93ccf94acae5e25c88e79ad83bf556cefae4c4e` |

Concatenated in order with no inserted bytes: Base64 length 45000
(SHA-256 `500f7cab56dd097bbe86a626c76cf7ccd15117d3d50bfb55b784b9cd901b1e7f`), decoded
33750 bytes (SHA-256 `fcbd5ba77efe28ea43f7b62c93b9c6f0c7b848ee917aa44792d7baf83a3bf822`).

* Header magic `FD 37 7A 58 5A 00` — **present, valid XZ stream header**.
* Last 12 bytes `08 8F 8E B2 99 B5 A3 DD 27 A6 26 9F` — **no `59 5A` footer magic**.
* `xz -t` → exit 1, `Unexpected end of input`.
* `xz -l` → exit 1, `Compressed data is corrupt`.
* Python `lzma.decompress()` → raises `LZMAError: Compressed data ended before the
  end-of-stream marker was reached`.
* A non-raising `LZMADecompressor().decompress()` yields 150688 bytes with
  `eof=False`, `needs_input=True`, `unused_data=0` — i.e. it consumed 33750/33750 input
  bytes and still wanted more. **This is the definitive truncation proof.**
  Note: a bare `try/except` around `LZMADecompressor().decompress()` reports "success" on
  a truncated stream; integrity must be judged from `eof`, not from absence of an
  exception.

**`decoded(chunk00) == .bootstrap2/payload.tar.xz` is TRUE**, byte-for-byte
(11250 bytes, SHA-256 `9d6aa37835ee072a3208d8952442ddb993e3481241958bc77257a9e7b43a898b`).
The committed payload is therefore chunk00 alone — the first 11250 bytes of a ~33750+
byte stream — and is itself truncated (`xz -t` exit 1; `tar -xJf` fails with
`Lzma library error: No progress is possible`). The committed payload was **not
overwritten**.

Commit messages `payload 01/09`, `02/09`, `03/09` show a nine-chunk plan of which only
three chunks were ever committed. **`chunk03`–`chunk08` do not exist in this
repository.**

## 3. Older `.bootstrap` — valid archive, wrong contents

| Chunk | bytes | SHA-256 |
| --- | --- | --- |
| `chunk00` | 8204 | `e464d812ce41c51fc02195d165a792c9a6f9671a23ac8663b39dbb4d635bd8c2` |
| `chunk01` | 8204 | `c6dcc5920b928ad0a885d68a4c1fa908601ed49ebce95d0fbae0a4bb38ab86ee` |
| `chunk02` | 8204 | `04dd6f0d1e8c08bcbec090d12a230967fcf1f97678e4206944c2a4a85ec31bc6` |

Concatenation: 24612 Base64 chars → 18458 bytes
(SHA-256 `858754d2d5a3d2e1823bb36c233e6cc315f76eb82b5851930d1c606350752ca6`), magic
`1F 8B 08 00`. `gzip -t` **passes** and `tar -tzvf` lists cleanly, so this archive is
*not* corrupt — contrary to the working assumption in the tasking.

It is **complete but irrelevant as a source recovery**: it contains 11 Markdown
documents only (`AGENTS.md`, `AUDIT_HANDOFF.md`, `AUDIT_HANDOFF_STAGE3A.md`,
`CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `EXPORT_VERIFICATION.md`,
`README.md`, `SECURITY.md`, `ideas.md`, `todo.md`), owner/group `root:oai_shared`,
mtime 2026-08-14 21:37. Zero `package.json`, zero `packages/`, zero tests, zero
`SOURCE_MANIFEST.txt`.

**Root cause of the historical Bootstrap1 exit code 1 is therefore identified:** the
`test -f /tmp/.../package.json` style required-file assertions failed, not archive
corruption. Bootstrap1 was pointed at a documentation bundle.

## 4. Recovery source found and its provenance

`EXPORT_VERIFICATION.md` (inside the docs-only archive) names the required artifact:
`diffbeacon-stage4-github-ci.zip`, "must contain complete source, tests, documentation,
`.github`, `package-lock.json`, `action.yml`, and the freshly rebuilt
`packages/action/dist/index.js`". Local, repository-associated archived artifacts were
then found in `C:\Users\Pavithran R A\Downloads`:

| File | bytes | mtime | SHA-256 |
| --- | --- | --- | --- |
| `diffbeacon.zip` / `diffbeacon (1).zip` (identical) | 132201 | 08-14 14:22 / 19:43 | `bb568fcb5629c6235d7dc321b12579d064d0bb49370cb795c5e7b834a2759a5c` |
| `diffbeacon-stage4-github-ci.zip` | 150585 | 08-13 20:10 | `074cdfb5cdbf0387e25a5d603accafab0298ba974b9c41e0ec4fb69509f4d61c` |
| `diffbeacon-final-github-ci.zip` | 153993 | 08-14 19:56 | `3a2ce38da8e5515baaf1cd24ba2ad8544bc97d71bbb7803bfba231df89884a63` |
| **`diffbeacon-final-github-ci-v2.zip`** | **154773** | **08-14 20:10** | **`33c252dc8a38490784cef2843629e9fd8e3cfcfa0ce1b026b64ad00d65d5be13`** |

Selection evidence:

* `diffbeacon (1).zip` / `diffbeacon.zip` is **incomplete** — 75 files, missing
  `.github/workflows/ci.yml` and all 15 `packages/core/` files listed in its own
  manifest. Rejected.
* `diffbeacon-stage4-github-ci.zip` is manifest-clean (86/86) but carries a **Stage 4**
  manifest and 88 files.
* The two `-final-github-ci` archives carry a **Stage 5** manifest, 89 files, and pass
  87/87. They differ in 7 files (`SOURCE_MANIFEST.txt`,
  `docs/architecture/security.md`, `packages/action/dist/index.js`,
  `packages/cli/src/git.ts`, `scripts/generate-source-manifest.mjs`,
  `tests/stage5.git-determinism.test.ts`, `todo.md`).
* **Decisive, independent link to the repository itself:** partially inflating the
  truncated `.bootstrap2` Base64 stream yields 150688 bytes containing 35 intact tar
  headers. 25 of the 25 complete member payloads were compared byte-for-byte against
  `diffbeacon-final-github-ci-v2.zip` and **all 26 matched exactly**; the only
  "difference" is `./package-lock.json`, truncated mid-file (declared 131949 bytes,
  48288 present) — which locates the truncation point precisely. Crucially the partial
  stream contains `./todo.md` at **5424 bytes**, the *v2* size (v1 has 4912), and
  `./SOURCE_MANIFEST.txt` at **8020 bytes**, the v2 manifest size.

So the truncated archive the repository was trying to bootstrap from **is** the
`diffbeacon-final-github-ci-v2` tree. The recovery source is not merely a plausible
candidate; it is the archive the bootstrap machinery was built around. Selected.

**89-file count explained.** `bootstrap2.yml` asserts `find -type f | wc -l == 89`. The
recovered tree has 89 files = 87 rows enumerated in `SOURCE_MANIFEST.txt` **+**
`SOURCE_MANIFEST.txt` itself **+** `packages/action/dist/index.js`. The latter two are
excluded from manifest traversal by documented policy (generated output / build
directory) while the committed Action bundle is intentionally required. Manifest
verification is therefore **complete and exact**, not approximate.

## 5. Integrity and import

* Zip CRC test clean; re-extracted twice, second extraction re-verified 87/87.
* All analysis wrote only to `forensics/` outside the source tree. Nothing overwrote
  `.bootstrap2/payload.tar.xz`. Bootstrap evidence from `main` is retained on this
  branch (all 7 `.bootstrap*` files).
* Files were imported through normal `cp` + `git add`. Because `core.autocrlf=true` is
  set globally, the staged index was re-verified against the manifest rather than
  trusted: **87/87 staged Git blobs hash-match**, and the two policy-excluded files are
  staged at exact byte sizes (8020, 31941).
* `node_modules`, dependency caches and forensic dumps were **not** staged.
* Recovered `README.md` replaces `main`'s rewritten README on this branch only;
  `main`'s version remains in Git history.

## 6. Structural validation performed

* `package.json` metadata: root `diffbeacon-workspace@0.1.0` private, workspaces
  `packages/*`; `diffbeacon-core@0.1.0` private; `diffbeacon-action@0.1.0` private;
  `diffbeacon@0.1.0` (CLI) publishable. This matches the documented v0.1 workspace
  intent in `EXPORT_VERIFICATION.md`.
* `package-lock.json`: lockfileVersion 3, name/version agree with root manifest, 267
  package entries.
* Layout: `packages/` 21, `scripts/` 11, `tests/` 10, `docs/` 8, `.github/` 7,
  `client/` 6 files.
* `npm ci` in an isolated copy: **success**, 213 packages.
* `npm test` in an isolated copy: **36 passed / 14 failed of 50** across
  7 passed / 3 failed files. Every failure is one of two Windows-host classes:
  `EPERM` on `%TEMP%\diffbeacon-stage5-git-*` recursive cleanup, and vitest 5000 ms
  timeouts in tests that spawn local Git repositories. No failure indicated source
  corruption or logic error. Linux CI is the appropriate arbiter; product behaviour was
  **not** modified in Stage 0.

## 7. Security review

Performed before import. No secret values are reproduced here.

* Filename sweep for `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa*`,
  `*credentials*`, `*secret*` → no matches.
* Content sweep for AWS access-key IDs, GitHub legacy and fine-grained tokens, Slack
  tokens, PEM private-key headers, `sk-` provider keys, npm automation tokens,
  assignments to `AWS_SECRET_ACCESS_KEY`/`password`/`client_secret` → no matches.
* Long opaque string literals in TS/TSX/JS/JSON/YAML → no matches.
* `.github/` references no `secrets.*` at all; CI is read-token, storage-free.
* `.npmrc` contains only `engine-strict`, `fund`, `audit` — no registry auth token.

## 8. Caveats / open items for the auditor

1. **`.github/workflows/bootstrap2.yml` is retained and is still armed.** It triggers on
   `push: [main]` with `contents: write` and ends in
   `git push --force origin HEAD:refs/heads/candidate`, plus `git switch --orphan` and a
   `find ... -exec rm -rf` of the checkout. It cannot succeed today (its payload is
   truncated) but it is destructive machinery pointed at a branch. It is preserved here
   as evidence. Recommend the auditor explicitly authorise disabling or quarantining it
   before this branch or any successor touches `main`. This was not done unilaterally.
2. Recovery provenance rests on locally present archives, not on a chain of trust from
   GitHub (the repo never held source). If the auditor requires an origin-bound
   attestation, the missing evidence is the complete `.bootstrap2` stream
   (`chunk03`–`chunk08`) or the upstream SHA-256 of
   `diffbeacon-final-github-ci-v2.zip`.
3. `SOURCE_MANIFEST.txt` regeneration was not executed (`npm run manifest`), so
   byte-identical manifest regeneration remains unverified.
4. The 14 Windows-only test failures are unreproduced-and-unfixed by design at this
   stage.

## 9. Decision

Source was imported because a complete, internally coherent, manifest-verified tree was
**proven** to exist as legitimate local material *and* independently linked
byte-for-byte to the repository's own truncated bootstrap stream. No file was authored
from README prose, no chunk was manufactured, no partial archive was silently promoted,
and canonical `main` was not modified.
