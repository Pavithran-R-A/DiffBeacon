// Stage 4 shared fixtures. Not a suite: vitest only collects tests/**/*.test.ts.
//
// The expected sequence below IS the audited ordering policy, written as an
// independent statement rather than read back from the implementation: FOCUS
// carries the surfaces that set the boundary and environment a change lives in,
// CHECK the interface and executable behavior, NOTE the supporting and derived
// surfaces. Positions inside a band follow the reading order each rationale
// describes; none of it is a claim about danger, quality or likelihood.

import type { AttentionLevel, SurfaceId } from '../packages/core/src/model.js';

export interface ExpectedPolicyEntry {
  surface: SurfaceId;
  level: AttentionLevel;
  label: string;
  path: string;
  rationaleCue: RegExp;
}

export const EXPECTED_ORDER: readonly ExpectedPolicyEntry[] = [
  {
    surface: 'ci-build',
    level: 'FOCUS',
    label: 'CI/build',
    path: '.github/workflows/ci.yml',
    rationaleCue: /read first/i,
  },
  {
    surface: 'auth-access',
    level: 'FOCUS',
    label: 'authentication/access',
    path: 'src/auth/session.ts',
    rationaleCue: /authorization boundary/i,
  },
  {
    surface: 'database-schema',
    level: 'FOCUS',
    label: 'database/schema',
    path: 'db/migrate/001_add_users.rb',
    rationaleCue: /shape of persisted data/i,
  },
  {
    surface: 'infrastructure',
    level: 'FOCUS',
    label: 'infrastructure/deployment',
    path: 'Dockerfile',
    rationaleCue: /environment the change runs in/i,
  },
  {
    surface: 'api-contracts',
    level: 'CHECK',
    label: 'API/contract',
    path: 'openapi.yml',
    rationaleCue: /before the implementation/i,
  },
  {
    surface: 'runtime',
    level: 'CHECK',
    label: 'runtime implementation',
    path: 'src/app.ts',
    rationaleCue: /after the context-setting surfaces/i,
  },
  {
    surface: 'dependencies',
    level: 'CHECK',
    label: 'dependency',
    path: 'package.json',
    rationaleCue: /third-party inputs/i,
  },
  {
    surface: 'configuration',
    level: 'CHECK',
    label: 'configuration',
    path: 'config/app.yml',
    rationaleCue: /how the application/i,
  },
  {
    surface: 'tests',
    level: 'NOTE',
    label: 'test',
    path: 'tests/app.test.ts',
    rationaleCue: /after the implementation context/i,
  },
  {
    surface: 'documentation',
    level: 'NOTE',
    label: 'documentation',
    path: 'docs/guide.md',
    rationaleCue: /after the code/i,
  },
  {
    surface: 'generated',
    level: 'NOTE',
    label: 'generated',
    path: 'dist/bundle.js',
    rationaleCue: /read last/i,
  },
];

export const SURFACES = EXPECTED_ORDER.map((entry) => entry.surface);
export const PATHS = Object.fromEntries(
  EXPECTED_ORDER.map((entry) => [entry.surface, entry.path]),
) as Record<SurfaceId, string>;

/** One content-bearing change to `path`, `lines` added and `lines` removed. */
export const change = (path: string, lines = 1): string => {
  const body = [
    ...Array.from({ length: lines }, (_unused, index) => `-old ${index + 1}`),
    ...Array.from({ length: lines }, (_unused, index) => `+new ${index + 1}`),
  ].join('\n');
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,${lines} +1,${lines} @@\n${body}\n`;
};

export const modeOnly = (path: string): string =>
  `diff --git a/${path} b/${path}\nold mode 100644\nnew mode 100755\n`;

export const binaryChange = (path: string): string =>
  `diff --git a/${path} b/${path}\nindex 0000000..1111111\nBinary files a/${path} and b/${path} differ\n`;

export const rename = (from: string, to: string): string =>
  `diff --git a/${from} b/${to}\nsimilarity index 92%\nrename from ${from}\nrename to ${to}\n--- a/${from}\n+++ b/${to}\n@@ -1 +1 @@\n-old\n+new\n`;

export const truncated = (path: string): string =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,3 +1,3 @@\n-only line\n`;

export const addedFile = (path: string, lines = 3): string => {
  const body = Array.from({ length: lines }, (_unused, index) => `+line ${index + 1}`).join('\n');
  return `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines} @@\n${body}\n`;
};

export const deletedFile = (path: string, lines = 1): string => {
  const body = Array.from({ length: lines }, (_unused, index) => `-gone ${index + 1}`).join('\n');
  return `diff --git a/${path} b/${path}\ndeleted file mode 100644\n--- a/${path}\n+++ /dev/null\n@@ -1,${lines} +0,0 @@\n${body}\n`;
};

/** A diff with one content change per surface, in `surfaces` order. */
export const allSurfaceDiff = (surfaces: SurfaceId[] = SURFACES, lines = 2): string =>
  surfaces.map((surface) => change(PATHS[surface], lines)).join('');

/**
 * Deterministic seeded permutations (LCG, fixed seed): the same set of orders on
 * every run and every platform, so a recorded pass is reproducible.
 */
export function seededPermutations<T>(items: readonly T[], count: number, seed = 20260926): T[][] {
  let state = seed;
  const next = (): number => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const out: T[][] = [];
  for (let iteration = 0; iteration < count; iteration += 1) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(next() * (index + 1));
      const held = copy[index] as T;
      copy[index] = copy[swapWith] as T;
      copy[swapWith] = held;
    }
    out.push(copy);
  }
  return out;
}

export function exhaustivePermutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    exhaustivePermutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

/**
 * Sections that must never move when unrelated file blocks are reordered.
 */
export function orderSections(report: unknown): string {
  const value = report as {
    attention: { surface: string; level: string; files: string[] }[];
    evidence: { kind: string; relatedFiles: string[] }[];
    reviewOrder: {
      position: number;
      surface: string;
      title: string;
      reason: string;
      files: string[];
    }[];
  };
  return JSON.stringify({
    attention: value.attention.map((item) => [item.surface, item.level, item.files]),
    evidence: value.evidence.map((item) => [item.kind, item.relatedFiles]),
    reviewOrder: value.reviewOrder.map((item) => [
      item.position,
      item.surface,
      item.files,
      item.reason,
    ]),
  });
}

/**
 * The relative sequence of `subset` surfaces as review-order positions. Positions
 * compact to 1..N for whatever surfaces a diff proves, so invariance claims about
 * presence/absence of unrelated surfaces must compare the shared subsequence only.
 */
export function relativeOrder(report: unknown, subset: readonly SurfaceId[]): SurfaceId[] {
  const value = report as { reviewOrder: { surface: SurfaceId }[] };
  return value.reviewOrder
    .map((item) => item.surface)
    .filter((surface) => (subset as readonly string[]).includes(surface));
}
