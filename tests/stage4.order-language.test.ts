import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SURFACE_IDS,
  analyzeDiff,
  renderJson,
  renderMarkdown,
  renderPretty,
} from '../packages/core/src/index.js';
import type { ReviewAttentionMap, SurfaceId } from '../packages/core/src/model.js';
import {
  EXPECTED_ORDER,
  allSurfaceDiff,
  binaryChange,
  change,
  modeOnly,
  rename,
  truncated,
} from './stage4.order-fixtures.js';

// Stage 4 requires that a reviewer can read WHY an entry sits where it does, from
// observable facts and a documented policy — never from a score. These cases sweep
// the user-visible copy of every renderer and the documentation that binds it.

const corpus: [string, string][] = [
  ['one surface', change('src/app.ts')],
  ['all surfaces', allSurfaceDiff()],
  ['multi-surface file', change('src/auth/session.ts')],
  ['mode-only auth', modeOnly('src/auth/session.ts')],
  ['mode-only manifest', modeOnly('package.json')],
  ['binary infrastructure', binaryChange('Dockerfile')],
  ['binary generated', binaryChange('dist/bundle.js')],
  ['rename out of auth', rename('src/auth/session.ts', 'src/state/token-store.ts')],
  ['rename into generated', rename('src/app.ts', 'dist/app.js')],
  ['truncated hunk', truncated('src/app.ts')],
  ['malformed block', 'diff --git a/one.ts b/two.ts b/three.ts'],
  ['sentinel path', 'diff --git a/  b/ \n--- \n+++ \n@@'],
  ['empty', ''],
  ['unclassified', change('notes.txt')],
  ['hostile path', change('src/<a href="x">risk</a>.ts')],
  ['unicode path', change('src/文件-é.ts')],
];

const reports = corpus.map(([label, input]) => [label, analyzeDiff(input)] as const);
const claims = (report: ReviewAttentionMap): string[] => [
  ...report.reviewOrder.map((item) => `${item.title} ${item.reason}`),
  ...report.attention.map((item) => `${item.title} ${item.description} ${item.level}`),
];

const forbidden =
  /\b(risk\w*|sever\w*|vulnerab\w*|danger\w*|unsafe|insecure|safe|confidence|probabilit\w*|likely|mergeab\w*|coverage|score|critical|importance|important|severity)\b|\bpercent\b|has no tests|must review/i;

const labelFor = (surface: SurfaceId): string =>
  EXPECTED_ORDER.find((entry) => entry.surface === surface)?.label as string;

describe('review-order reasons explain the policy instead of restating it', () => {
  it('drops the circular recommendation sentence entirely', () => {
    for (const [label, report] of reports)
      for (const item of report.reviewOrder) {
        expect(item.reason, label).not.toMatch(/recommends/i);
        expect(item.reason, label).not.toMatch(/earlier in this review/i);
        expect(item.reason, label).not.toBe(
          `DiffBeacon recommends looking at ${item.title} earlier in this review.`,
        );
      }
    const sample = analyzeDiff(change('src/app.ts'));
    expect(sample.reviewOrder[0]?.reason).not.toContain(sample.reviewOrder[0]?.title as string);
  });

  it.each(EXPECTED_ORDER.map((entry) => [entry.surface, entry.path] as const))(
    'states the observed file count and the policy rationale for %s',
    (surface, path) => {
      const report = analyzeDiff(change(path));
      const item = report.reviewOrder.find((entry) => entry.surface === surface);
      const count = item?.files.length as number;
      expect(item?.reason, surface).toMatch(
        new RegExp(
          `^${count} ${labelFor(surface).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} files? changed in this diff\\. `,
        ),
      );
      expect(item?.reason, surface).toMatch(
        EXPECTED_ORDER.find((e) => e.surface === surface)?.rationaleCue as RegExp,
      );
    },
  );

  it('reports the same count as the entry lists files, in singular or plural truthfully', () => {
    const one = analyzeDiff(change('src/app.ts'));
    const two = analyzeDiff(`${change('src/app.ts')}${change('lib/worker.ts')}`);
    expect(one.reviewOrder.find((i) => i.surface === 'runtime')?.reason).toMatch(
      /^1 runtime implementation file changed in this diff\. /,
    );
    expect(two.reviewOrder.find((i) => i.surface === 'runtime')?.reason).toMatch(
      /^2 runtime implementation files changed in this diff\. /,
    );
    expect(two.reviewOrder.find((i) => i.surface === 'runtime')?.files).toHaveLength(2);
  });

  it('carries no number except the observed file count', () => {
    for (const [label, report] of reports)
      for (const item of report.reviewOrder) {
        const withoutCount = item.reason.replace(/^\d+ /, '');
        expect(withoutCount, `${label} / ${item.surface}`).not.toMatch(/\d/);
        expect(item.reason, `${label} / ${item.surface}`).not.toContain('%');
      }
  });

  it('says files changed, never that content or lines changed, for mode-only and binary input', () => {
    for (const label of [
      'mode-only auth',
      'mode-only manifest',
      'binary infrastructure',
      'binary generated',
    ]) {
      const report = reports.find(([name]) => name === label)?.[1] as ReviewAttentionMap;
      expect(report.reviewOrder.length).toBeGreaterThan(0);
      for (const item of report.reviewOrder) {
        expect(item.reason, label).not.toMatch(/content|line/i);
        expect(item.reason, label).toMatch(/files? changed in this diff/i);
      }
    }
    for (const [, report] of reports)
      for (const item of report.reviewOrder) expect(item.reason).not.toMatch(/content/i);
  });

  it('keeps every user-visible claim free of judgment wording', () => {
    for (const [label, report] of reports)
      for (const claim of claims(report)) expect(claim, label).not.toMatch(forbidden);
  });

  it('never implies a merge decision, a probability or a ranking of importance', () => {
    for (const [, report] of reports)
      for (const item of report.reviewOrder)
        expect(item.reason).not.toMatch(
          /\b(should|must|needs?|before (merging|landing)|block|approv\w*|reject\w*)\b/i,
        );
  });

  it('names each surface with the detector title the attention row uses', () => {
    for (const [, report] of reports) {
      const titles = new Map(report.attention.map((item) => [item.surface, item.title]));
      for (const item of report.reviewOrder)
        expect(item.title, item.surface).toBe(titles.get(item.surface));
    }
  });
});

describe('attention levels stay navigation bands', () => {
  it('uses only the three documented band names', () => {
    for (const [label, report] of reports)
      for (const item of report.attention) {
        expect(['FOCUS', 'CHECK', 'NOTE'], `${label} ${item.surface}`).toContain(item.level);
      }
  });

  it('gives every surface in a band the same band, whatever the diff looks like', () => {
    const seen = new Map<SurfaceId, Set<string>>();
    for (const [, report] of reports)
      for (const item of report.attention) {
        const bands = seen.get(item.surface) ?? new Set<string>();
        bands.add(item.level);
        seen.set(item.surface, bands);
      }
    for (const [surface, bands] of seen) {
      expect([...bands], surface).toHaveLength(1);
      expect([...bands][0], surface).toBe(
        EXPECTED_ORDER.find((entry) => entry.surface === surface)?.level,
      );
    }
    expect([...seen.keys()].sort()).toEqual([...SURFACE_IDS].sort());
  });

  it('never lets a band name read as a grade in either renderer', () => {
    const report = analyzeDiff(allSurfaceDiff());
    const markdown = renderMarkdown(report);
    const pretty = renderPretty(report, { color: false });
    for (const text of [markdown, renderJson(report), pretty])
      expect(text).not.toMatch(
        /\b(risk|severity|critical|high priority|low priority|urgent|confidence)\b/i,
      );
    expect(markdown).toContain('FOCUS');
    expect(pretty).toContain('FOCUS');
  });
});

describe('ordering policy invariants hold across a hostile corpus', () => {
  it('emits no unknown surface, no duplicate surface, and contiguous positions', () => {
    for (const [label, report] of reports) {
      const names = report.reviewOrder.map((item) => item.surface);
      for (const name of names) expect(SURFACE_IDS).toContain(name);
      expect(new Set(names).size, label).toBe(names.length);
      expect(
        report.reviewOrder.map((item) => item.position),
        label,
      ).toEqual(names.map((_name, index) => index + 1));
      expect(
        report.attention.map((item) => item.surface),
        label,
      ).toEqual(names);
    }
  });

  it('restricts the order to the surfaces the files actually claim', () => {
    for (const [label, report] of reports) {
      const union = new Set(report.files.flatMap((file) => file.surfaces));
      expect(new Set(report.reviewOrder.map((item) => item.surface)), label).toEqual(union);
      for (const item of report.reviewOrder)
        expect(item.files.length, `${label} ${item.surface}`).toBeGreaterThan(0);
    }
  });

  it('keeps one entry per surface while a file may appear in several of them', () => {
    const report = analyzeDiff(
      `${change('src/auth/session.ts')}${change('.circleci/config.yml')}${change('api/user_contract.ts')}`,
    );
    const auth = report.reviewOrder.find((item) => item.surface === 'auth-access');
    const runtime = report.reviewOrder.find((item) => item.surface === 'runtime');
    const configuration = report.reviewOrder.find((item) => item.surface === 'configuration');
    expect(auth?.files.filter((path) => path === 'src/auth/session.ts')).toHaveLength(1);
    expect(runtime?.files).toEqual(['api/user_contract.ts', 'src/auth/session.ts']);
    expect(configuration?.files).toEqual(['.circleci/config.yml']);
    expect(report.reviewOrder.map((item) => item.surface)).toEqual([
      'ci-build',
      'auth-access',
      'api-contracts',
      'runtime',
      'configuration',
    ]);
  });
});

describe('the documented policy and the shipped policy are the same list', () => {
  const overview = readFileSync('docs/architecture/overview.md', 'utf8');

  it('publishes the band table in architecture documentation', () => {
    expect(overview).toMatch(/### Review bands/);
    for (const band of ['FOCUS', 'CHECK', 'NOTE']) expect(overview).toContain(band);
    expect(overview).toMatch(/navigation bands?/i);
    expect(overview).toMatch(/not severity/i);
    expect(overview).toMatch(/no risk score|not a risk score/i);
    expect(overview).toMatch(/independent of the order/i);
    expect(overview).toMatch(/probability|never uses a probability/i);
  });

  it('documents exactly the sequence analyzeDiff produces', () => {
    const heading = overview.indexOf('### Review bands');
    expect(heading).toBeGreaterThan(-1);
    const opened = overview.indexOf('```', heading);
    const block = overview.slice(opened + 3, overview.indexOf('```', opened + 3));
    const codes = [...block.matchAll(/^ *(FOCUS|CHECK|NOTE) +(.*)$/gm)].flatMap((match) => {
      const band = match[1];
      const listed = match[2];
      if (!band || !listed) return [];
      return listed
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
        .map((surface): [SurfaceId, string] => [surface as SurfaceId, band]);
    });
    const report = analyzeDiff(allSurfaceDiff());
    expect(codes).toEqual(
      report.attention.map((item) => [item.surface, item.level] as [SurfaceId, string]),
    );
    expect(codes.map(([surface]) => surface)).toEqual(
      report.reviewOrder.map((item) => item.surface),
    );
  });

  it('states that evidence relationships do not move the order', () => {
    expect(overview).toMatch(
      /evidence .*do(es)? not (change|move|alter)|do not (move|alter|change) .*order/i,
    );
  });

  it('keeps the root summary free of importance claims', () => {
    const readme = readFileSync('README.md', 'utf8').replaceAll('**', '');
    expect(readme).toMatch(/starting sequence/i);
    expect(readme).toMatch(/not an assertion|not a ranking/i);
    expect(readme).toMatch(/deterministic review order/i);
    expect(readme).toMatch(/does not determine whether a pull request is safe to merge/i);
  });
});
