# DiffBeacon Architecture

DiffBeacon is organized around one pure analysis engine and three adapters. The engine receives a unified diff string and returns a versioned Review Attention Map. Adapters supply or display that map in their own environment.

```text
unified diff text
      │
      ▼
packages/core/parser.ts
      │  normalized changed files
      ▼
detector registry ──► surface observations
      │
      ├──────────────► evidence relationships
      ├──────────────► deterministic review order
      └──────────────► JSON / Markdown / pretty renderers
      │
      ├── packages/cli  : validated Git range or stdin
      ├── packages/action: trusted event SHAs + Job Summary
      └── client/       : browser textarea + local engine
```

## Core data flow

The parser recognizes Git file boundaries, path headers, mode metadata, rename metadata, binary markers, hunks, and line counts. A changed file is then classified by explicit path detectors. Surface matches can overlap: a `package.json` file is both a dependency manifest and potentially a configuration surface if a future detector makes that explicit.

Evidence rules compare observable surface sets. They say “not observed in this diff,” never “missing” or “forgotten.” The review order is a documented priority array used to recommend a starting sequence, not a severity ranking.

## Schema

The report carries `schemaVersion: "1"` and is described in `packages/core/schema/review-attention-map.schema.json`. It contains summary counts, normalized files, attention observations, evidence observations, and review-order entries. It intentionally contains no risk score or merge verdict.

## Adapter boundaries

The CLI is the only adapter allowed to invoke Git. It validates revisions and resolves small repository metadata queries through bounded argument-vector process execution, then collects the actual diff through a bounded asynchronous `spawn` stream. Both boundaries use `shell: false`, disable external diff/text conversion, and use `--` before the pathspec. The Action uses trusted base/head SHAs from the event payload through the same safe Git collector. The browser adapter never invokes Git and only accepts pasted diff text.
