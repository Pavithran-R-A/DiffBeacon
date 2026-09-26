# DiffBeacon Core

The core package parses unified diffs and produces a versioned Review Attention Map. It is intentionally deterministic and dependency-free at runtime. It does not determine correctness, safety, mergeability, or risk.

`analyzeDiff()` returns the whole map: normalized files, attention rows for the surfaces a diff matched, evidence relationships, and a review order. The order comes from one explicit policy table, so each entry's position and its reason text are stated together and cannot disagree. Band names (`FOCUS`, `CHECK`, `NOTE`) mark where reading starts; they are not severity, risk, urgency, confidence, quality, or merge status. Files are sorted by a total comparison over every fact a file reports, so reordering the input diff cannot reorder the output. See [Review ordering policy](../../docs/architecture/overview.md#review-ordering-policy).
