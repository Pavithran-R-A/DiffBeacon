# DiffBeacon Design Brainstorm

> **DESIGN RESEARCH — not product documentation and not a claim about output.** Stage 10 moved
> this file here by Git rename from the repository root (`ideas.md`); its content is unchanged. It
> is the pre-implementation exploration that chose the "Field Manual" visual language the browser
> demo still uses (`--oxide: #cc5a27` and the file-header wording in `client/src/index.css` and
> `client/src/pages/Home.tsx`).
>
> The `Probability:` values under each candidate theme are the brainstorm's own subjective ranking
> of which direction to pursue. They are **not** output of any kind: DiffBeacon computes no
> probability, confidence, score, severity, or merge verdict for a diff or a file, and no report
> field carries such a value. Read [`docs/architecture/overview.md`](../architecture/overview.md)
> and [`docs/detectors/`](../detectors/) for what the engine actually emits, and
> [`docs/research/validation.md`](validation.md) for the dated external research behind these
> decisions.

## Approach 1 — Instrument Panel

### Theme Name

Instrument Panel

### Very Brief Intro

A dark, high-contrast developer instrument inspired by observability consoles and terminal phosphor. Compact signals and amber markers make attention feel measurable without pretending to be a verdict.

### Probability

0.07

## Approach 2 — Paper Trail

### Theme Name

Paper Trail

### Very Brief Intro

A warm editorial workspace that treats a pull request like an evidence packet: annotated, legible, and calm. Ink-black text, archival redaction marks, and tabular detail favor trust over spectacle.

### Probability

0.04

## Approach 3 — Field Manual

### Theme Name

Field Manual

### Very Brief Intro

A disciplined, utility-first interface that borrows from technical manuals, map legends, and engineering notebooks. It uses strict hierarchy, measured color, and visible provenance to turn a diff into a navigable review brief.

### Probability

0.08

## Selected Approach — Field Manual

### Design Movement

Swiss International Typographic Style fused with contemporary developer-tool information design.

### Core Principles

1. **Evidence before interpretation:** every label describes something observed in the diff, never a hidden judgment.
2. **Structured asymmetry:** a narrow utility rail and offset content columns create a reading path that feels like a real instrument, not a centered marketing card.
3. **Material legibility:** paper-white surfaces, ink-black typography, and oxide-orange signals provide calm contrast and unmistakable hierarchy.
4. **Surgical motion:** movement confirms state changes and reveals relationships; it never decorates the page.

### Color Philosophy

The interface is grounded in **chalk, ink, and oxide**. Chalk (`#F4F1EA`) gives the workspace the tactile calm of an annotated field sheet. Ink (`#161A1D`) is used for primary reading and code. Oxide orange (`#CC5A27`) is the ownable signal color: it feels like a physical review marker rather than a danger badge. Muted steel-blue is reserved for neutral structure and metadata. Dark mode inverts the paper/ink relationship while retaining the same oxide signal so the product remains recognizably DiffBeacon in either mode.

### Layout Paradigm

Use a persistent left utility rail, an offset masthead, and a split review workspace. The primary map occupies the visual center; a narrow evidence column sits on the right; the diff input is a shallow horizontal instrument at the top rather than a giant centered hero. On mobile, the rail collapses into a compact header and the columns stack in review order.

### Signature Elements

1. A **beacon mark** made from a vertical signal bar intersecting a small outlined ring, used in the header and result state.
2. **Review-attention flags** rendered as compact, squared tabs with a left rule and a short label (FOCUS / CHECK / NOTE), never pill-shaped risk badges.
3. A **ruled evidence ledger** with hairline separators, monospace counts, and small provenance notes.

### Interaction Philosophy

Interactions should feel like operating a precise instrument: explicit, reversible, and immediately legible. Analyze actions move the user from a neutral empty state into a populated map with a short measured reveal. Hover and focus states strengthen rules and labels rather than adding glow. Keyboard focus remains visible and all primary actions are reachable without a pointer.

### Animation

Use 160–220ms ease-out transitions for controls and 240ms staged reveals for analysis results. The map header arrives first, attention rows cascade in 35ms intervals, and evidence ledger items follow. Only transform and opacity are animated. The signal mark may draw its ring once on first analysis; no looping or floating motion is used. All non-essential motion is disabled under `prefers-reduced-motion`.

### Typography System

Use system UI for interface text (`ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) and a compact monospace stack (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`) for counts, paths, and schema labels. Headlines use a heavy 700–800 weight with tight tracking; section labels use uppercase 11px monospace with 0.16em tracking; body copy stays 14–16px with 1.55 line-height. Do not introduce a remote font dependency.

### Brand Essence

**DiffBeacon routes human attention through the evidence already present in a pull request, for maintainers who want a faster first read without an opaque reviewer.**

Personality: **observant, disciplined, candid**.

### Brand Voice

Headlines are direct and quietly confident. CTAs describe the action, not an outcome. Microcopy uses “observed,” “not observed,” and “review first” instead of “safe,” “risky,” or “correct.”

Example lines:

> **Start with what changed.**

> **Analyze diff — keep the evidence local.**

### Wordmark & Logo

The wordmark is set in a compact uppercase grotesk with a custom cut through the “A” implied by the beacon ring. The standalone mark is a vertical oxide bar passing through an open black ring; the bar represents a signal, while the open ring represents a review surface that still needs human context. It appears at a readable 30–34px size in the header and becomes the favicon mark.

### Signature Brand Color

**Oxide signal — `#CC5A27`**. It is warm, physical, and reserved for attention routing rather than severity.

## Style Decisions

- Treat the “Review Attention Map” as the product surface, not a marketing illustration.
- Never use risk/safety language, percentage gauges, or gradients that imply a verdict.
- Keep the entire demo local and offline after load; the UI must state that pasted diffs stay in the browser.
- Use a dense but breathable field-manual layout: rail, instrument header, map, evidence ledger.
- The first screen reads as an operating workspace before a marketing hero: the Review Attention Map and diff instrument are the main visual subject, while headline copy functions as a compact masthead.
- Oxide `#CC5A27` is reserved for signal bars, primary action, active attention markers, and the beacon mark; it does not become a general decorative emphasis color.
- Brand copy sounds like a field note or instrument label: concise, observational, and action-specific, using phrases like “observed,” “local,” “review first,” and “no verdict.”
