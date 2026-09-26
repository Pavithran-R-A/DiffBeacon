import { describe, expect, it } from 'vitest';
import {
  analyzeDiff,
  compareCanonicalText,
  detectors,
  renderJson,
} from '../packages/core/src/index.js';
import type { ChangedFile, Detector } from '../packages/core/src/index.js';
import type { SurfaceId } from '../packages/core/src/model.js';
import {
  EXPECTED_ORDER,
  PATHS,
  SURFACES,
  addedFile,
  allSurfaceDiff,
  binaryChange,
  change,
  deletedFile,
  exhaustivePermutations,
  modeOnly,
  orderSections,
  rename,
  seededPermutations,
  truncated,
} from './stage4.order-fixtures.js';

// Stage 4 demands that the report be a function of what the diff shows, not of the
// order the diff happens to list it in. Each case below permutes a semantically
// equivalent input and requires byte-identical output.

const blocksFor = (surfaces: SurfaceId[]): string[] =>
  surfaces.map((surface) => change(PATHS[surface] as string, 2));

const expectInvariant = (blocks: string[], label: string): void => {
  const permutations = seededPermutations(blocks, 30).map((perm) => perm.join(''));
  const reference = renderJson(analyzeDiff(blocks.join('')));
  for (const [index, input] of permutations.entries()) {
    expect(renderJson(analyzeDiff(input)), `${label} permutation ${index}`).toBe(reference);
  }
};

describe('the report does not depend on the order the diff lists files', () => {
  it('is byte-identical across 40 seeded permutations of all eleven surfaces', () => {
    const blocks = blocksFor(SURFACES);
    const referenceReport = analyzeDiff(blocks.join(''));
    const reference = renderJson(referenceReport);
    const orders = [
      ...seededPermutations(blocks, 40),
      [...blocks].reverse(),
      [...blocks.slice(1), blocks[0] as string],
      [...blocks.slice(6), ...blocks.slice(0, 6)],
    ];
    for (const [index, order] of orders.entries()) {
      const report = analyzeDiff(order.join(''));
      expect(renderJson(report), `permutation ${index}`).toBe(reference);
      expect(orderSections(report), `permutation ${index}`).toBe(orderSections(referenceReport));
    }
    expect(orders).toHaveLength(43);
  });

  it('is byte-identical across every permutation of a five-surface subset', () => {
    const subset = [
      'ci-build',
      'auth-access',
      'runtime',
      'dependencies',
      'generated',
    ] as SurfaceId[];
    const blocks = blocksFor(subset);
    const permutations = exhaustivePermutations(blocks);
    expect(permutations).toHaveLength(120);
    const reference = renderJson(analyzeDiff(blocks.join('')));
    for (const order of permutations)
      expect(renderJson(analyzeDiff(order.join('')))).toBe(reference);
  });

  it('is byte-identical when a single surface owns several files in any order', () => {
    const blocks = [
      change('src/services/billing.ts'),
      change('src/services/ledger.ts'),
      change('lib/worker.ts'),
      change('src/index.ts'),
    ];
    const reference = orderSections(analyzeDiff(blocks.join('')));
    for (const order of exhaustivePermutations(blocks))
      expect(orderSections(analyzeDiff(order.join('')))).toBe(reference);
  });

  it('survives permutations of mixed change kinds: content, mode-only, binary, rename, truncated', () => {
    const blocks = [
      change('src/app.ts'),
      modeOnly('Makefile'),
      binaryChange('Dockerfile'),
      rename('src/auth/session.ts', 'src/state/token-store.ts'),
      truncated('docs/guide.md'),
      addedFile('db/migrate/002_add_roles.rb'),
      deletedFile('config/legacy.yml'),
      change('tests/app.test.ts'),
    ];
    expectInvariant(blocks, 'mixed kinds');
    const reference = renderJson(analyzeDiff(blocks.join('')));
    expect(renderJson(analyzeDiff([...blocks].reverse().join('')))).toBe(reference);
  });

  it('ignores the order of hunks inside one file whose totals are unchanged', () => {
    const first = `diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new\n@@ -20 +20 @@\n-old2\n+new2\n`;
    const second = `diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -20 +20 @@\n-old2\n+new2\n@@ -1 +1 @@\n-old\n+new\n`;
    expect(renderJson(analyzeDiff(first))).toBe(renderJson(analyzeDiff(second)));
  });

  it('is byte-identical when repeated on the same input', () => {
    const input = allSurfaceDiff() + truncated('src/app.ts');
    const outputs = new Set<string>();
    for (let repeat = 0; repeat < 20; repeat += 1) outputs.add(renderJson(analyzeDiff(input)));
    expect(outputs.size).toBe(1);
  });
});

describe('file ordering has a total comparator, so equal display paths cannot drift', () => {
  const paths = [
    'A.ts',
    'a.ts',
    'aa.ts',
    'a-b.ts',
    'a.b.ts',
    'a/b.ts',
    '2.ts',
    '_x.ts',
    'ä.ts',
    'é.ts',
    '文件.ts',
    '😀.ts',
  ];

  it('orders distinct paths by frozen code units, never by locale', () => {
    const report = analyzeDiff(paths.map((path) => change(path)).join(''));
    expect(report.files.map((file) => file.displayPath)).toEqual([
      '2.ts',
      'A.ts',
      '_x.ts',
      'a-b.ts',
      'a.b.ts',
      'a.ts',
      'a/b.ts',
      'aa.ts',
      'ä.ts',
      'é.ts',
      '文件.ts',
      '😀.ts',
    ]);
    expectInvariant(
      paths.map((path) => change(path)),
      'code-unit corpus',
    );
  });

  it('keeps the same order for two diff blocks that share a display path', () => {
    const added = addedFile('dup.ts', 3);
    const deleted = deletedFile('dup.ts', 1);
    const forward = analyzeDiff(`${added}${deleted}`);
    const backward = analyzeDiff(`${deleted}${added}`);
    expect(renderJson(backward)).toBe(renderJson(forward));
    expect(
      reportFacts(forward).map((entry) => [entry.displayPath, entry.status, entry.additions]),
    ).toEqual([
      ['dup.ts', 'added', 3],
      ['dup.ts', 'deleted', 0],
    ]);
  });

  it('orders same-path blocks by their reported line counts, not by diff order', () => {
    const small = change('src/app.ts', 1);
    const large = change('src/app.ts', 4);
    const forward = analyzeDiff(`${large}${small}`);
    const backward = analyzeDiff(`${small}${large}`);
    expect(renderJson(forward)).toBe(renderJson(backward));
    expect(
      reportFacts(forward).map((entry) => [entry.status, entry.additions, entry.deletions]),
    ).toEqual([
      ['modified', 1, 1],
      ['modified', 4, 4],
    ]);
  });

  it('breaks a same-path tie on mode, binary and surface facts', () => {
    const mode = modeOnly('tied.ts');
    const content = change('tied.ts', 2);
    const binary = binaryChange('tied.ts');
    const pairs: [string, string][] = [
      [`${mode}${content}`, `${content}${mode}`],
      [`${binary}${content}`, `${content}${binary}`],
      [`${mode}${binary}`, `${binary}${mode}`],
    ];
    for (const [left, right] of pairs)
      expect(renderJson(analyzeDiff(left))).toBe(renderJson(analyzeDiff(right)));
  });

  it('lists a path twice within an entry only when the diff really holds two blocks', () => {
    const report = analyzeDiff(`${change('src/app.ts', 1)}${change('src/app.ts', 4)}`);
    const entry = report.attention.find((item) => item.surface === 'runtime');
    expect(entry?.files).toEqual(['src/app.ts', 'src/app.ts']);
    expect(entry?.fileCount).toBe(2);
    expect(report.summary.changedFiles).toBe(2);
  });

  it('sorts with a comparator that is antisymmetric and transitive on the corpus', () => {
    const corpus = [...paths, ...paths.map((path) => path.toUpperCase()), '', 'a', 'aa'];
    // Object.is(-0, 0) is false, so a negated zero must still compare equal.
    const negate = (value: number): number => (value === 0 ? 0 : -value);
    for (const left of corpus) {
      expect(compareCanonicalText(left, left)).toBe(0);
      for (const right of corpus) {
        expect(compareCanonicalText(left, right)).toBe(negate(compareCanonicalText(right, left)));
        for (const third of corpus) {
          if (compareCanonicalText(left, right) <= 0 && compareCanonicalText(right, third) <= 0)
            expect(compareCanonicalText(left, third)).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  it('orders two files whose paths are equal and facts are identical identically', () => {
    const block = change('same.ts', 2);
    const report = analyzeDiff(`${block}${block}`);
    expect(renderJson(report)).toBe(renderJson(report));
    expect(report.summary.changedFiles).toBe(2);
  });
});

function reportFacts(
  report: ReturnType<typeof analyzeDiff>,
): Pick<ChangedFile, 'displayPath' | 'status' | 'additions' | 'deletions'>[] {
  return report.files.map((file) => ({
    displayPath: file.displayPath,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
  }));
}

describe('review order is independent of detector registration order', () => {
  const input = allSurfaceDiff();

  const reordered = (shift: number): Detector[] => {
    const list = [...detectors];
    return [...list.slice(shift), ...list.slice(0, shift)];
  };

  const withDetectorOrder = <T>(order: Detector[], run: () => T): T => {
    const original = [...detectors];
    try {
      detectors.splice(0, detectors.length, ...order);
      return run();
    } finally {
      detectors.splice(0, detectors.length, ...original);
    }
  };

  it('holds the sections stable while detector order visibly changes surface order', () => {
    const reference = analyzeDiff(input);
    const referenceSections = orderSections(reference);
    const shuffled = reordered(4);
    expect(shuffled.map((detector) => detector.id)).not.toEqual(
      detectors.map((detector) => detector.id),
    );
    const shifted = withDetectorOrder(shuffled, () => {
      const report = analyzeDiff(input);
      expect(orderSections(report)).toBe(referenceSections);
      return report;
    });
    // The experiment must actually reach the detector-ordered part of the model,
    // otherwise the equality above proves nothing.
    expect(shifted.files.map((file) => file.surfaces.join('+')).join('|')).not.toBe(
      reference.files.map((file) => file.surfaces.join('+')).join('|'),
    );
    const reversed = withDetectorOrder([...detectors].reverse(), () =>
      orderSections(analyzeDiff(input)),
    );
    expect(reversed).toBe(referenceSections);
  });

  it('keeps the attention sequence equal to the policy order, not the registry order', () => {
    const report = analyzeDiff(input);
    expect(report.attention.map((item) => item.surface)).toEqual(
      EXPECTED_ORDER.map((entry) => entry.surface),
    );
    expect(detectors.map((detector) => detector.id)).not.toEqual(
      EXPECTED_ORDER.map((entry) => entry.surface),
    );
  });
});
