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

Evidence rules compare observable surface sets. They say “not observed in this diff,” never “missing” or “forgotten.” The review order is a documented reading sequence, explained per entry and not a severity ranking; see [Review ordering policy](#review-ordering-policy).

## Review ordering policy

The order comes from one explicit table in `packages/core/src/analyze.ts`. Every review surface appears in it exactly once, with a written-out position, a band, a lowercase label used in reason text, and the reading rationale a reviewer sees beside the entry, so the sequence and its explanation cannot disagree. The sequence is read from those positions, never from how the table happens to be laid out, and nothing in it is derived from detector registration order, changed-file counts, changed-line magnitude, or the evidence relationships below.

### Review bands

```text
FOCUS  ci-build, auth-access, database-schema, infrastructure
CHECK  api-contracts, runtime, dependencies, configuration
NOTE   tests, documentation, generated
```

The three names are navigation bands, not severity tiers. FOCUS marks the surfaces that establish the frame a change lives in, CHECK the interface and behavior the change carries, and NOTE the supporting or derived material. They are not a risk score, no band carries a number, and DiffBeacon never uses a probability or a language model to place a surface. Position states a reading order for this diff only; it is not an assertion that one surface matters more than another in general, and a surface listed earlier is not a surface that must be reviewed first.

A file can match several surfaces, and it then appears once under each of them; that overlap boosts nothing anywhere. A renamed file is classified from the union of its old and new path, so moving code out of `src/auth/` still reports the authentication/access surface at the same position. A mode-only or binary change keeps its surfaces and its positions even though it reports no line counts, and a file whose paths the parser could not prove claims no surface, no entry, and no position.

Evidence and order are separate sections computed independently. The relationship rules read the same classified files, but their presence or absence does not change the order, and the order does not change the evidence.

Input order does not reach the report, so the output is independent of the order a diff lists files in. Files are compared by code-unit path, and a path alone does not always distinguish two diff blocks, so the comparison continues through every fact a file reports: status, additions, deletions, the binary and mode-only flags, both paths, both modes, similarity, the surface list, and the generated flag. Two entries that compare equal therefore report identical facts, which is what makes a permuted input produce byte-identical output.

## Schema

The report carries `schemaVersion: "1"` and is described in `packages/core/schema/review-attention-map.schema.json`. It contains summary counts, normalized files, attention observations, evidence observations, and review-order entries. It intentionally contains no risk score or merge verdict.

## Adapter boundaries

The CLI is the only adapter allowed to invoke Git. It validates revisions and resolves small repository metadata queries through bounded argument-vector process execution, then collects the actual diff through a bounded asynchronous `spawn` stream. Both boundaries use `shell: false`, disable external diff/text conversion, and use `--` before the pathspec. The Action uses trusted base/head SHAs from the event payload through the same safe Git collector. The browser adapter never invokes Git and only accepts pasted diff text.
