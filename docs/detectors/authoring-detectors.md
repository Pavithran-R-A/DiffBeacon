# Authoring Detectors

Detectors are deliberately small path-based rules. A contributor should be able to add
one without understanding the CLI, Action, or browser adapters — and be able to explain
in one sentence what a match actually proves.

A detector proposal is **not** accepted because one positive path matches. It is accepted
when the matcher is conservative, the near-miss is rejected, the rename case is reasoned
about, and the limitation is written down.

## What a detector may claim

A surface states that a review area was touched. It may not state or imply:

- a vulnerability, or its absence;
- that a change is safe, risky, or mergeable;
- how confident DiffBeacon is, or a probability;
- that coverage, documentation, or production impact exists or is adequate;
- that a repository lacks something — only that this diff did not show it.

Word descriptions as observations: "Authentication or authorization files changed", not
"Authentication risk detected". Evidence text is checked by
`tests/stage3.evidence.test.ts`; detector titles and descriptions by
`tests/stage3.detectors.test.ts`.

## Required before a detector is merged

1. **Stable ID** — kebab-case, added to `SURFACE_IDS` in `packages/core/src/model.ts`, and
   exactly one registered detector per ID.
2. **Conservative matcher** — a directory, filename, or extension convention. Prefer
   `hasPathPrefix`/segment equality over substring tests: `build/` as a root prefix is a
   convention, `build` anywhere in a path is a guess that swallows `src/build/index.ts`.
3. **Positive fixture** — a path that must claim the surface, with the full expected
   surface list so an accidental overlap is visible.
4. **Negative fixture** — the misleading neighbour a real repository contains
   (`src/authentic.ts` beside `src/auth/session.ts`, `package.example.json` beside
   `package.json`, `docs/migration-guide.md` beside `db/migrate/…`), asserted to claim
   nothing new.
5. **False-positive regression** — the negative fixture lives in the corpus in
   `tests/stage3.detector-false-positives.test.ts`, so a later broadening breaks a test
   rather than shipping quietly.
6. **Rename consideration** — state what the surface should claim when a file moves in,
   and when it moves out. Classification unions `oldPath` and `newPath` in detector
   registration order and lists a renamed file once, so a matcher must be written to be
   true of either side; relationship evidence for a rename is tested in
   `tests/stage3.evidence.test.ts`.
7. **`<unknown path>` handling** — matchers receive only paths the parser proved. Never
   match against `displayPath`, and never let the `UNKNOWN_PATH_SENTINEL` presentation
   placeholder reach a matcher; `consideredPaths()` already filters it out.
8. **Documented limitation** — add a section to `docs/detectors/initial-detectors.md`
   naming at least one thing the detector deliberately misses, and why broadening it
   would cost more than it buys.
9. **Review-priority placement** — if the surface belongs in the default order, note that
   position, band, reason label and rationale are one entry of the policy table in
   `packages/core/src/analyze.ts`; adding an ID needs a deterministic position, not policy
   tuning. The detector registry has no ordering meaning, so registering a detector never
   moves a surface in the review order.
10. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`.

## Example shape

```ts
{
  id: 'example-surface',
  title: 'Example Surface',
  description: 'Explicit example files changed.',
  matches: (path) => hasPathPrefix(normalizedPath(path), 'example/'),
}
```

The matcher must not fire because file _contents_ mention "example" — detectors never see
hunk text — nor because an unrelated directory happens to contain the word.

## Shared helpers

`packages/core/src/detectors/shared.ts` holds the path vocabulary: `normalizedPath`,
`basename`, `hasSegment`, `hasPathPrefix`, `extension`, `isDependencyManifest`,
`isLockfile`, `isConfigFilename`, `isTestPath`, `isDocumentationPath`,
`isGeneratedPath`. A new rule should extend this file rather than inventing a second
notion of what a basename is, and any change to a shared predicate must keep the
`generated`/`runtime` and `configuration`/`runtime` boundaries tested.

## Ecosystem additions

Future focused additions could cover Django, Rails, Go, Rust, Android, Flutter,
Terraform, Kubernetes, Next.js, Supabase, Prisma, Maven, and Gradle. These should land as
small, reviewable rules rather than a broad semantic classifier. Do not dynamically
execute third-party detector code, and do not add a generic `security` surface: a name
that merely looks security-ish is exactly the false positive this registry exists to
avoid.
