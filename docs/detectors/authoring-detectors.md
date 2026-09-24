# Authoring Detectors

Detectors are deliberately small path-based modules. A contributor should be able to add one without understanding the CLI, Action, or browser adapters.

## Checklist

1. Choose a stable kebab-case detector ID and add it to `SurfaceId`.
2. Add a `Detector` entry with a clear title, one-sentence description, and explicit matcher.
3. Keep the matcher conservative. A path convention can identify a surface; it cannot prove semantic behavior.
4. Add at least one positive fixture and at least one negative fixture.
5. Register the detector in the registry and include it in the review-priority list if it belongs in the default order.
6. Add documentation explaining the convention and its false-positive boundary.
7. Run `npm test`, `npm run typecheck`, and `npm run format:check`.

## Example shape

```ts
{
  id: 'example-surface',
  title: 'Example Surface',
  description: 'Explicit example files changed.',
  matches: (path) => normalizedPath(path).startsWith('example/'),
}
```

The example should not match arbitrary source files merely because their contents contain the word “example.” Prefer directory, filename, or extension conventions that a maintainer can explain in one sentence.

## Ecosystem additions

Future focused additions could cover Django, Rails, Go, Rust, Android, Flutter, Terraform, Kubernetes, Next.js, Supabase, Prisma, Maven, and Gradle. These should land as small, reviewable rules rather than a broad semantic classifier. Do not dynamically execute third-party detector code in v0.1.
