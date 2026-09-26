import { describe, expect, it } from 'vitest';
import {
  ATTENTION_LEVELS,
  SURFACE_IDS,
  analyzeDiff,
  detectors,
  renderJson,
  renderMarkdown,
  renderPretty,
} from '../packages/core/src/index.js';
import type {
  AttentionLevel,
  ReviewAttentionMap,
  SurfaceId,
  SurfaceObservation,
} from '../packages/core/src/model.js';
import {
  EXPECTED_ORDER,
  PATHS,
  SURFACES,
  addedFile,
  allSurfaceDiff,
  binaryChange,
  change,
  modeOnly,
  relativeOrder,
  rename,
  truncated,
} from './stage4.order-fixtures.js';

// Stage 4 qualifies the review order as a documented reading policy: one explicit
// sequence over every surface, derived bands, and no measurement of importance.
// Everything here is observed through analyzeDiff() so the policy is tested as
// user-visible behavior rather than as an internal table.

const surfacesIn = (report: ReviewAttentionMap): SurfaceId[] =>
  report.reviewOrder.map((item) => item.surface);
const positionsIn = (report: ReviewAttentionMap): [number, SurfaceId][] =>
  report.reviewOrder.map((item) => [item.position, item.surface]);
const observedUnion = (report: ReviewAttentionMap): Set<SurfaceId> =>
  new Set(report.files.flatMap((file) => file.surfaces));
/** The policy sequence restricted to the surfaces this diff actually proves. */
const policyOf = (report: ReviewAttentionMap): [number, SurfaceId, AttentionLevel][] =>
  EXPECTED_ORDER.filter((entry) => observedUnion(report).has(entry.surface)).map((entry, index) => [
    index + 1,
    entry.surface,
    entry.level,
  ]);
const orderEntry = (report: ReviewAttentionMap, surface: SurfaceId) =>
  report.reviewOrder.find((item) => item.surface === surface);
const attentionEntry = (report: ReviewAttentionMap, surface: SurfaceId) =>
  report.attention.find((item) => item.surface === surface);
const asAttention = (report: ReviewAttentionMap): [SurfaceId, AttentionLevel][] =>
  report.attention.map(
    (item: SurfaceObservation) => [item.surface, item.level] as [SurfaceId, AttentionLevel],
  );

describe('the review-order policy is one explicit, complete sequence', () => {
  it('places every surface exactly once, in the audited order, with the audited band', () => {
    const report = analyzeDiff(allSurfaceDiff());
    expect(surfacesIn(report)).toEqual(SURFACES);
    expect(positionsIn(report)).toEqual(
      SURFACES.map((surface, index): [number, SurfaceId] => [index + 1, surface]),
    );
    expect(asAttention(report)).toEqual(
      EXPECTED_ORDER.map((entry) => [entry.surface, entry.level]),
    );
    expect(policyOf(report)).toEqual(
      EXPECTED_ORDER.map((entry, index) => [index + 1, entry.surface, entry.level]),
    );
  });

  it('covers every SURFACE_ID exactly once, so no surface is unranked or doubled', () => {
    expect([...SURFACES].sort()).toEqual([...SURFACE_IDS].sort());
    expect(new Set(SURFACES).size).toBe(SURFACE_IDS.length);
    expect(ATTENTION_LEVELS).toEqual(['FOCUS', 'CHECK', 'NOTE']);
  });

  it('keeps band membership identical between attention and review order', () => {
    const report = analyzeDiff(allSurfaceDiff());
    const bySurface = new Map<SurfaceId, AttentionLevel>(asAttention(report));
    expect(report.reviewOrder).toHaveLength(report.attention.length);
    for (const entry of EXPECTED_ORDER)
      expect(bySurface.get(entry.surface), entry.surface).toBe(entry.level);
  });

  it.each(EXPECTED_ORDER.map((entry) => [entry.surface, entry.path] as const))(
    'gives %s the position its policy entry states',
    (surface, path) => {
      const report = analyzeDiff(change(path));
      const expected = EXPECTED_ORDER.find((entry) => entry.surface === surface);
      const sequence = policyOf(report);
      expect(positionsIn(report)).toEqual(sequence.map(([p, s]) => [p, s]));
      expect(orderEntry(report, surface)?.position).toBe(
        sequence.findIndex(([, named]) => named === surface) + 1,
      );
      expect(asAttention(report)).toEqual(
        expect.arrayContaining([[surface, expected?.level] as [SurfaceId, AttentionLevel]]),
      );
      expect(surfacesIn(report)).toContain(surface);
    },
  );

  it.each(EXPECTED_ORDER.map((entry) => [entry.surface, entry.path] as const))(
    'keeps %s at its policy position beside every other surface',
    (surface, path) => {
      for (const other of EXPECTED_ORDER) {
        if (other.surface === surface) continue;
        const report = analyzeDiff(`${change(path)}${change(other.path)}`);
        expect(surfacesIn(report), `${surface} + ${other.surface}`).toEqual(
          policyOf(report).map(([, named]) => named),
        );
        expect(positionsIn(report), `${surface} + ${other.surface}`).toEqual(
          policyOf(report).map(([position, named]) => [position, named]),
        );
      }
    },
  );

  it('does not inherit the detector registration order', () => {
    const registration = detectors.map((detector) => detector.id);
    const report = analyzeDiff(allSurfaceDiff());
    expect(surfacesIn(report)).not.toEqual(registration);
    expect(registration.at(-1)).toBe('runtime');
    expect(surfacesIn(report).indexOf('runtime')).toBe(5);
    expect(surfacesIn(report).indexOf('dependencies')).toBe(6);
    expect(registration.indexOf('dependencies')).toBe(3);
  });
});

describe('requirement matrix: which surfaces appear, and in what shape', () => {
  it('lists one entry per surface that has at least one matching file', () => {
    const report = analyzeDiff(`${change('src/app.ts')}${change('docs/guide.md')}`);
    expect(surfacesIn(report)).toEqual(['runtime', 'documentation']);
    expect(report.reviewOrder.map((item) => item.files)).toEqual([
      ['src/app.ts'],
      ['docs/guide.md'],
    ]);
  });

  it('keeps several files of one surface inside a single entry, in canonical order', () => {
    const report = analyzeDiff(
      `${change('src/services/billing.ts')}${change('src/services/ledger.ts')}${change('lib/worker.ts')}`,
    );
    expect(surfacesIn(report)).toEqual(['runtime']);
    expect(orderEntry(report, 'runtime')?.files).toEqual([
      'lib/worker.ts',
      'src/services/billing.ts',
      'src/services/ledger.ts',
    ]);
  });

  it.each([
    ['auth + runtime', 'src/auth/session.ts', ['auth-access', 'runtime']],
    ['ci + configuration', '.circleci/config.yml', ['ci-build', 'configuration']],
    ['contract + runtime', 'api/user_contract.ts', ['api-contracts', 'runtime']],
    ['schema + runtime', 'db/migrate/001_add_users.rb', ['database-schema', 'runtime']],
    ['config + runtime', 'src/config/loader.ts', ['runtime', 'configuration']],
  ] as [string, string, SurfaceId[]][])(
    'lists the multi-surface file %s under each surface once',
    (label, path, expected) => {
      const report = analyzeDiff(change(path));
      expect(surfacesIn(report), label).toEqual(expected);
      expect(positionsIn(report), label).toEqual(policyOf(report).map(([p, s]) => [p, s]));
      for (const entry of report.reviewOrder) expect(entry.files).toEqual([path]);
    },
  );

  it('does not let several multi-surface files boost a surface or duplicate an entry', () => {
    const single = analyzeDiff(change('src/auth/session.ts'));
    const stacked = analyzeDiff(
      `${change('src/auth/session.ts')}${change('src/auth/policy.ts')}${change('src/auth/sessions.ts')}`,
    );
    expect(surfacesIn(single)).toEqual(['auth-access', 'runtime']);
    expect(surfacesIn(stacked)).toEqual(['auth-access', 'runtime']);
    expect(positionsIn(stacked)).toEqual(positionsIn(single));
    expect(attentionEntry(stacked, 'auth-access')?.fileCount).toBe(3);
    expect(attentionEntry(single, 'auth-access')?.fileCount).toBe(1);
    expect(orderEntry(stacked, 'auth-access')?.files).toHaveLength(3);
  });

  it('orders generated output after the runtime change beside it', () => {
    const report = analyzeDiff(`${change('dist/bundle.js', 5)}${change('src/app.ts')}`);
    expect(surfacesIn(report)).toEqual(['runtime', 'generated']);
    expect(positionsIn(report)).toEqual([
      [1, 'runtime'],
      [2, 'generated'],
    ]);
  });

  it('orders tests after the runtime they verify, and documentation after the contract', () => {
    expect(
      surfacesIn(analyzeDiff(`${change('tests/app.test.ts')}${change('src/app.ts')}`)),
    ).toEqual(['runtime', 'tests']);
    expect(surfacesIn(analyzeDiff(`${change('docs/api.md')}${change('openapi.yml')}`))).toEqual([
      'api-contracts',
      'documentation',
    ]);
  });

  it('keeps a manifest and its lockfile in one dependencies entry', () => {
    const report = analyzeDiff(`${change('package.json')}${change('pnpm-lock.yaml')}`);
    expect(surfacesIn(report)).toEqual(['dependencies']);
    expect(orderEntry(report, 'dependencies')?.files).toEqual(['package.json', 'pnpm-lock.yaml']);
    expect(orderEntry(report, 'dependencies')?.reason).toContain('2 dependency');
  });

  it('pairs authentication and database changes with their tests without moving either', () => {
    const report = analyzeDiff(
      `${change('tests/session.test.ts')}${change('src/auth/session.ts')}${change('db/migrate/002_add_roles.rb')}`,
    );
    expect(surfacesIn(report)).toEqual(['auth-access', 'database-schema', 'runtime', 'tests']);
    expect(positionsIn(report)).toEqual([
      [1, 'auth-access'],
      [2, 'database-schema'],
      [3, 'runtime'],
      [4, 'tests'],
    ]);
  });

  it('reports the same positions for authentication with and without its companion evidence', () => {
    const withTests = analyzeDiff(
      `${change('src/auth/session.ts')}${change('tests/session.test.ts')}`,
    );
    const withoutTests = analyzeDiff(change('src/auth/session.ts'));
    expect(withoutTests.evidence.map((item) => item.kind)).toEqual([
      'runtime-without-tests',
      'auth-without-tests',
    ]);
    expect(withTests.evidence).toEqual([]);
    // Positions compact to 1..N over the surfaces a diff proves, so the invariant
    // is the shared subsequence, not a cross-report absolute index.
    const shared: SurfaceId[] = ['auth-access', 'runtime'];
    expect(relativeOrder(withTests, shared)).toEqual(['auth-access', 'runtime']);
    expect(relativeOrder(withoutTests, shared)).toEqual(['auth-access', 'runtime']);
    expect(orderEntry(withTests, 'auth-access')?.position).toBe(
      orderEntry(withoutTests, 'auth-access')?.position,
    );
  });

  it('keeps evidence presence out of the ordering of unrelated surfaces', () => {
    const alone = analyzeDiff(change('package.json'));
    const withCompanion = analyzeDiff(`${change('package.json')}${change('pnpm-lock.yaml')}`);
    expect(alone.evidence.map((item) => item.kind)).toEqual(['manifest-without-lockfile']);
    expect(withCompanion.evidence).toEqual([]);
    expect(relativeOrder(withCompanion, SURFACES)).toEqual(relativeOrder(alone, SURFACES));

    const withoutVolume = analyzeDiff(
      `${change('package.json')}${change('dist/a.js', 9)}${change('src/app.ts')}`,
    );
    const withVolume = analyzeDiff(
      `${change('package.json')}${change('dist/a.js', 9)}${change('dist/b.js', 9)}${change('src/app.ts')}`,
    );
    expect(withVolume.evidence.map((item) => item.kind)).toContain('generated-volume');
    expect(withoutVolume.evidence.map((item) => item.kind)).not.toContain('generated-volume');
    expect(relativeOrder(withVolume, SURFACES)).toEqual(relativeOrder(withoutVolume, SURFACES));
    expect(positionsIn(withVolume)).toEqual([
      [1, 'runtime'],
      [2, 'dependencies'],
      [3, 'generated'],
    ]);
  });

  it('classifies a malformed block beside a usable file without inventing a surface', () => {
    const report = analyzeDiff(`diff --git a/one.ts b/two.ts b/three.ts\n${change('src/app.ts')}`);
    expect(report.summary.diagnostics).toBeGreaterThan(0);
    expect(surfacesIn(report)).toEqual(['runtime']);
    expect(positionsIn(report)).toEqual([[1, 'runtime']]);
  });

  it('keeps a diagnosed hunk in the order its proven path claims', () => {
    const report = analyzeDiff(`${truncated('src/app.ts')}${change('docs/guide.md')}`);
    expect(report.summary.diagnostics).toBeGreaterThan(0);
    expect(surfacesIn(report)).toEqual(['runtime', 'documentation']);
    expect(orderEntry(report, 'runtime')?.files).toEqual(['src/app.ts']);
  });

  it('produces nothing for an empty diff', () => {
    const report = analyzeDiff('');
    expect(report.attention).toEqual([]);
    expect(report.reviewOrder).toEqual([]);
    expect(report.evidence).toEqual([]);
  });

  it('produces no fabricated surface for an unproven or unclassified path', () => {
    const sentinel = analyzeDiff('diff --git a/ b/\n--- \n+++ \n@@');
    expect(sentinel.attention).toEqual([]);
    expect(sentinel.reviewOrder).toEqual([]);
    const unclassified = analyzeDiff(change('notes.txt'));
    expect(unclassified.files[0]?.surfaces).toEqual([]);
    expect(unclassified.attention).toEqual([]);
    expect(unclassified.reviewOrder).toEqual([]);
    const both = analyzeDiff(`${change('notes.txt')}${change('src/app.ts')}`);
    expect(positionsIn(both)).toEqual([[1, 'runtime']]);
  });

  it('keeps positions contiguous from 1 for every subset', () => {
    const subsets = [
      ['documentation', 'generated'],
      ['ci-build', 'tests', 'generated'],
      ['auth-access', 'database-schema', 'api-contracts', 'runtime'],
      SURFACES,
    ] as SurfaceId[][];
    for (const subset of subsets) {
      const report = analyzeDiff(
        subset
          .map((surface) => {
            const path = PATHS[surface] as string;
            return change(path);
          })
          .join(''),
      );
      expect(positionsIn(report)).toEqual(
        surfacesIn(report).map((surface, index): [number, SurfaceId] => [index + 1, surface]),
      );
    }
  });
});

describe('mode-only, binary and rename cases keep their surface in the order', () => {
  const modeOnlyPaths: [SurfaceId, string][] = [
    ['ci-build', 'Makefile'],
    ['auth-access', 'src/auth/session.ts'],
    ['infrastructure', 'Dockerfile'],
    ['generated', 'dist/bundle.js'],
    ['dependencies', 'package.json'],
  ];

  it.each(modeOnlyPaths)('keeps the surface of a mode-only change to %s', (surface, path) => {
    const report = analyzeDiff(modeOnly(path));
    expect(surfacesIn(report)).toContain(surface);
    expect(report.summary.modeOnlyFiles).toBe(1);
    expect(orderEntry(report, surface)?.files).toEqual([path]);
  });

  it('orders a mode-only authentication file by policy, not by its missing line counts', () => {
    const report = analyzeDiff(`${modeOnly('src/auth/session.ts')}${change('docs/guide.md')}`);
    expect(positionsIn(report)).toEqual(policyOf(report).map(([p, s]) => [p, s]));
    expect(surfacesIn(report)).toEqual(['auth-access', 'runtime', 'documentation']);
  });

  it.each([
    ['infrastructure', 'Dockerfile'],
    ['generated', 'dist/bundle.js'],
  ])('orders the binary %s file by policy', (surface, path) => {
    const report = analyzeDiff(binaryChange(path));
    expect(surfacesIn(report)).toEqual([surface]);
    expect(report.files[0]?.binary).toBe(true);
  });

  const renameCases: [string, string, string, SurfaceId[]][] = [
    [
      'runtime into auth',
      'src/state/token-store.ts',
      'src/auth/session.ts',
      ['auth-access', 'runtime'],
    ],
    [
      'auth out to runtime',
      'src/auth/session.ts',
      'src/state/token-store.ts',
      ['auth-access', 'runtime'],
    ],
    ['generated into runtime', 'dist/legacy.js', 'src/legacy.ts', ['runtime', 'generated']],
    ['runtime into generated', 'src/app.ts', 'dist/app.js', ['runtime', 'generated']],
    ['docs into contract', 'docs/api.md', 'openapi.yml', ['api-contracts', 'documentation']],
    ['contract out to docs', 'openapi.yml', 'docs/api.md', ['api-contracts', 'documentation']],
    ['config into runtime', 'config/loader.ts', 'src/loader.ts', ['runtime', 'configuration']],
    ['runtime into config', 'src/loader.ts', 'config/loader.ts', ['runtime', 'configuration']],
  ];

  it.each(renameCases)('unions surfaces once for a rename: %s', (label, from, to, expected) => {
    const forward = analyzeDiff(rename(from, to));
    const backward = analyzeDiff(rename(to, from));
    expect(surfacesIn(forward), label).toEqual(expected);
    expect(positionsIn(forward), label).toEqual(policyOf(forward).map(([p, s]) => [p, s]));
    expect(positionsIn(backward), label).toEqual(positionsIn(forward));
    for (const report of [forward, backward])
      for (const entry of report.reviewOrder) expect(entry.files).toHaveLength(1);
  });

  it('carries the abandoned surface of a rename into the same entry', () => {
    const report = analyzeDiff(rename('src/auth/session.ts', 'src/state/token-store.ts'));
    expect(orderEntry(report, 'auth-access')?.files).toEqual(['src/state/token-store.ts']);
    expect(orderEntry(report, 'runtime')?.files).toEqual(['src/state/token-store.ts']);
  });
});

describe('renderers agree with the report they are given', () => {
  const report = analyzeDiff(allSurfaceDiff());

  /** The REVIEW ORDER block of pretty output, without headings or blank padding. */
  const prettyOrderLines = (pretty: string): string[] => {
    const start = pretty.indexOf('REVIEW ORDER\n');
    const end = pretty.indexOf('CHANGED FILES', start);
    return pretty
      .slice(start, end)
      .split('\n')
      .slice(1)
      .filter((line) => line.trim().length > 0 && !/^─+$/.test(line.trim()));
  };

  /** Reads back the numbered title lines and their indented reason continuations. */
  const prettyOrder = (pretty: string): { position: number; title: string; reason: string }[] => {
    const entries: { position: number; title: string; reason: string }[] = [];
    for (const line of prettyOrderLines(pretty)) {
      const head = /^(\d+)\. (.+)$/.exec(line);
      if (head) {
        entries.push({ position: Number(head[1]), title: head[2] as string, reason: '' });
        continue;
      }
      const continuation = /^ {3}(\S.*)$/.exec(line);
      const last = entries[entries.length - 1];
      if (continuation && last) last.reason = `${last.reason} ${continuation[1]}`.trim();
    }
    return entries;
  };

  it('numbers Markdown and pretty output with the same positions and titles as JSON', () => {
    const parsed = JSON.parse(renderJson(report)) as ReviewAttentionMap;
    expect(parsed.reviewOrder.map((item) => item.position)).toEqual(
      report.reviewOrder.map((item) => item.position),
    );
    const expected = report.reviewOrder.map((item) => ({
      position: item.position,
      title: item.title,
    }));
    const markdown = renderMarkdown(report);
    const pretty = renderPretty(report, { color: false });
    const markdownTitles = [...markdown.matchAll(/^(\d+)\. \*\*(.+?)\*\* — /gm)].map((match) => ({
      position: Number(match[1]),
      title: match[2],
    }));
    expect(markdownTitles).toEqual(expected);
    expect(prettyOrder(pretty).map(({ position, title }) => ({ position, title }))).toEqual(
      expected,
    );
  });

  it('shows no reordering of its own in either text renderer', () => {
    const markdown = renderMarkdown(report);
    const orderSection = markdown.slice(
      markdown.indexOf('## Review order'),
      markdown.indexOf('## Changed files'),
    );
    const titles = [...orderSection.matchAll(/\*\*(.+?)\*\*/g)].map((match) => match[1]);
    expect(titles).toEqual(report.reviewOrder.map((item) => item.title));
  });

  it('shows the same band names in attention as the report carries', () => {
    const pretty = renderPretty(report, { color: false });
    for (const item of report.attention) {
      expect(pretty).toContain(`${item.level}  ${item.title}`);
      expect(ATTENTION_LEVELS).toContain(item.level);
    }
    const markdown = renderMarkdown(report);
    for (const item of report.attention)
      expect(markdown).toContain(`| ${item.level} | ${item.title} |`);
  });

  it('makes the reason for every entry visible in Markdown and in pretty output', () => {
    const markdown = renderMarkdown(report);
    const pretty = renderPretty(report, { color: false });
    const prettyOrderEntries = prettyOrder(pretty);
    expect(prettyOrderEntries).toHaveLength(report.reviewOrder.length);
    for (const [index, item] of report.reviewOrder.entries()) {
      const cue = EXPECTED_ORDER.find((entry) => entry.surface === item.surface)?.rationaleCue;
      expect(markdown, item.surface).toMatch(cue as RegExp);
      expect(prettyOrderEntries[index]?.reason, item.surface).toBe(item.reason);
    }
  });

  it('keeps pretty order lines within a terminal width and loses no text', () => {
    const pretty = renderPretty(report, { color: false });
    for (const line of prettyOrderLines(pretty))
      expect(line.length, JSON.stringify(line)).toBeLessThanOrEqual(80);
    expect(prettyOrder(pretty).map((entry) => entry.reason)).toEqual(
      report.reviewOrder.map((item) => item.reason),
    );
  });

  /** The first stray control character in rendered text, newlines excepted. */
  const strayControl = (text: string): string | undefined =>
    [...text].find((character) => {
      const code = character.charCodeAt(0);
      return (code < 0x20 && code !== 0x0a) || code === 0x7f;
    });

  it('carries no path text and no active markup in either review-order section', () => {
    const hostile = analyzeDiff(addedFile('src/<img src=x onerror=alert(1)>.ts'));
    const markdown = renderMarkdown(hostile);
    const markdownSection = markdown.slice(
      markdown.indexOf('## Review order'),
      markdown.indexOf('## Changed files'),
    );
    const prettySection = prettyOrderLines(renderPretty(hostile, { color: true })).join('\n');
    expect(surfacesIn(hostile)).toEqual(['runtime']);
    for (const section of [markdownSection, prettySection]) {
      expect(section).not.toMatch(/<|>|onerror|img|\.ts/i);
      expect(section).not.toContain('\u001b');
      expect(strayControl(section)).toBeUndefined();
    }
  });
});
