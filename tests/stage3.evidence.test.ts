import { describe, expect, it } from 'vitest';
import { analyzeDiff, renderJson } from '../packages/core/src/index.js';
import type { EvidenceKind, ReviewAttentionMap } from '../packages/core/src/model.js';

// Stage 3: classification says which review surfaces a path belongs to; evidence
// says which relationships the diff shows between them. The two must not be
// confused, and no evidence may state a number the diff never reported.

const contentChange = (path: string, additions = 1, deletions = 1) => {
  const added = Array.from({ length: additions }, (_unused, index) => `+added ${index + 1}`);
  const removed = Array.from({ length: deletions }, (_unused, index) => `-removed ${index + 1}`);
  const oldCount = Math.max(deletions, 1);
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,${oldCount} +1,${additions} @@\n${[...removed, ...added].join('\n')}\n`;
};

const modeOnly = (path: string) =>
  `diff --git a/${path} b/${path}\nold mode 100644\nnew mode 100755\n`;

const binaryChange = (path: string) =>
  `diff --git a/${path} b/${path}\nindex 0000000..1111111\nBinary files a/${path} and b/${path} differ\n`;

const rename = (from: string, to: string) =>
  `diff --git a/${from} b/${to}\nsimilarity index 92%\nrename from ${from}\nrename to ${to}\n--- a/${from}\n+++ b/${to}\n@@ -1 +1 @@\n-old\n+new\n`;

const truncated = (path: string) =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,3 +1,3 @@\n-only line\n`;

const kinds = (report: ReviewAttentionMap): EvidenceKind[] =>
  report.evidence.map((item) => item.kind);

const only = (report: ReviewAttentionMap, kind: EvidenceKind) => {
  const matches = report.evidence.filter((item) => item.kind === kind);
  expect(matches).toHaveLength(1);
  return matches[0] as ReviewAttentionMap['evidence'][number];
};

describe('mode-only changes are classified but claim no relationship', () => {
  const paths = [
    'src/app.ts',
    'src/auth/session.ts',
    'db/migrate/001_add_users.rb',
    'package.json',
    'pnpm-lock.yaml',
    'openapi.yml',
    'docs/guide.md',
    'dist/bundle.js',
  ];

  it.each(paths)('reports the surface of the mode-only change to %s', (path) => {
    const report = analyzeDiff(modeOnly(path));
    expect(report.files[0]?.surfaces.length).toBeGreaterThan(0);
    expect(report.files[0]?.modeOnly).toBe(true);
  });

  it.each(paths)('claims no companion relationship for the mode-only change to %s', (path) => {
    expect(kinds(analyzeDiff(modeOnly(path)))).toEqual([]);
  });

  it('claims no generated volume from mode-only generated files', () => {
    const report = analyzeDiff(`${modeOnly('dist/a.js')}${modeOnly('dist/b.js')}`);
    expect(kinds(report)).toEqual([]);
    expect(report.summary.modeOnlyFiles).toBe(2);
  });

  it('still reports a relationship when content changes alongside the mode', () => {
    const report = analyzeDiff(
      `${contentChange('src/auth/session.ts')}${modeOnly('docs/guide.md')}`,
    );
    expect(kinds(report)).toEqual(['runtime-without-tests', 'auth-without-tests']);
  });

  it('lets a mode-only manifest stand beside a real lockfile change', () => {
    const report = analyzeDiff(`${modeOnly('package.json')}${contentChange('pnpm-lock.yaml')}`);
    expect(kinds(report)).toEqual(['lockfile-without-manifest']);
    expect(only(report, 'lockfile-without-manifest').relatedFiles).toEqual(['pnpm-lock.yaml']);
  });
});

describe('evidence follows both sides of a rename', () => {
  it('reports a manifest change when a manifest is renamed away', () => {
    const report = analyzeDiff(rename('package.json', 'package.old.json'));
    expect(kinds(report)).toEqual(['manifest-without-lockfile']);
    const observation = only(report, 'manifest-without-lockfile');
    expect(observation.relatedFiles).toEqual(['package.old.json']);
  });

  it('reports a lockfile change when a lockfile moves out of its convention', () => {
    const report = analyzeDiff(rename('yarn.lock', 'backups/yarn.lock'));
    expect(kinds(report)).toEqual(['lockfile-without-manifest']);
  });

  it('reports a contract change when a contract definition moves out', () => {
    const report = analyzeDiff(rename('openapi.yml', 'specs/api-spec.v1.txt'));
    expect(kinds(report)).toEqual(['contract-without-docs']);
  });

  it('lists one renamed file once even though both paths match', () => {
    const report = analyzeDiff(rename('package.json', 'nested/package.json'));
    expect(only(report, 'manifest-without-lockfile').relatedFiles).toEqual(['nested/package.json']);
  });

  it('treats a test file moved into source as an observed test change', () => {
    expect(kinds(analyzeDiff(rename('tests/auth.test.ts', 'src/auth/index.ts')))).toEqual([]);
    expect(kinds(analyzeDiff(rename('src/app.ts', 'tests/app.test.ts')))).toEqual([]);
  });

  it('carries the abandoned surface into attention and review order', () => {
    const report = analyzeDiff(rename('src/auth/session.ts', 'src/state/token-store.ts'));
    const attention = report.attention.find((item) => item.surface === 'auth-access');
    expect(attention?.files).toEqual(['src/state/token-store.ts']);
    expect(attention?.level).toBe('FOCUS');
    expect(report.reviewOrder.map((item) => item.surface)).toContain('auth-access');
  });
});

describe('line-count evidence states only observed counts', () => {
  it('reports a line share when every content-bearing count is observed', () => {
    const report = analyzeDiff(
      `${contentChange('dist/bundle.js', 40, 40)}${contentChange('dist/vendor.js', 40, 40)}${contentChange('src/app.ts', 2, 2)}`,
    );
    const observation = only(report, 'generated-volume');
    expect(observation.metrics).toMatchObject({
      generatedFiles: 2,
      changedFiles: 3,
      generatedChangedLines: 160,
      totalChangedLines: 164,
    });
    expect(observation.metrics?.generatedLineShare).toBeCloseTo(160 / 164);
  });

  it('withholds a line share when binary files report no counts', () => {
    const report = analyzeDiff(
      `${binaryChange('dist/bundle.js')}${contentChange('dist/vendor.js', 20, 20)}${contentChange('src/app.ts', 2, 2)}`,
    );
    const observation = only(report, 'generated-volume');
    expect(Object.keys(observation.metrics ?? {}).sort()).toEqual([
      'changedFiles',
      'generatedFileShare',
      'generatedFiles',
    ]);
    expect(observation.message).toMatch(/no share of changed lines/i);
    expect(renderJson(report)).not.toMatch(
      /generatedLineShare|generatedChangedLines|totalChangedLines/,
    );
  });

  it('withholds a line share when a hunk was diagnosed as miscounted', () => {
    const report = analyzeDiff(
      `${truncated('dist/bundle.js')}${contentChange('dist/vendor.js', 20, 20)}${contentChange('src/app.ts', 2, 2)}`,
    );
    expect(report.summary.diagnostics).toBeGreaterThan(0);
    const observation = only(report, 'generated-volume');
    expect(observation.metrics).not.toHaveProperty('generatedLineShare');
  });

  it('reports the file share alone when counts are unobserved', () => {
    const report = analyzeDiff(
      `${binaryChange('dist/a.js')}${binaryChange('dist/b.js')}${contentChange('src/app.ts')}`,
    );
    const observation = only(report, 'generated-volume');
    expect(observation.message).toMatch(/file count/i);
    expect(observation.metrics).toMatchObject({ generatedFiles: 2, changedFiles: 3 });
  });

  it('does not reach for volume below either threshold', () => {
    expect(kinds(analyzeDiff(contentChange('dist/only.js')))).toEqual([]);
    expect(
      kinds(
        analyzeDiff(
          `${contentChange('dist/a.js', 3, 3)}${contentChange('src/one.ts')}${contentChange('src/two.ts')}${contentChange('src/three.ts')}`,
        ),
      ),
    ).not.toContain('generated-volume');
  });
});

describe('relationship titles are as precise as relationship messages', () => {
  // A mode-only companion IS an observed change to that file. Because the premises
  // of these rules read content-bearing files only, a title saying "without observed
  // <companion> changes" contradicts a fact the same report displays.
  const cases = [
    {
      kind: 'runtime-without-tests' as const,
      companion: 'tests/app.test.ts',
      input: `${contentChange('src/app.ts')}${modeOnly('tests/app.test.ts')}`,
      claim: /test-file content change/i,
    },
    {
      kind: 'auth-without-tests' as const,
      companion: 'tests/session.test.ts',
      input: `${contentChange('src/auth/session.ts')}${modeOnly('tests/session.test.ts')}`,
      claim: /test-file content change/i,
    },
    {
      kind: 'database-without-tests' as const,
      companion: 'tests/migrations.test.ts',
      input: `${contentChange('db/migrate/001_add_users.rb')}${modeOnly(
        'tests/migrations.test.ts',
      )}`,
      claim: /test-file content change/i,
    },
    {
      kind: 'manifest-without-lockfile' as const,
      companion: 'pnpm-lock.yaml',
      input: `${contentChange('package.json')}${modeOnly('pnpm-lock.yaml')}`,
      claim: /lockfile content change/i,
    },
    {
      kind: 'lockfile-without-manifest' as const,
      companion: 'package.json',
      input: `${contentChange('pnpm-lock.yaml')}${modeOnly('package.json')}`,
      claim: /manifest content change/i,
    },
    {
      kind: 'contract-without-docs' as const,
      companion: 'docs/api.md',
      input: `${contentChange('openapi.yml')}${modeOnly('docs/api.md')}`,
      claim: /documentation content change/i,
    },
  ];

  it.each(cases)(
    'titles a missing $kind companion as a missing content change, not a missing file change',
    ({ kind, companion, input, claim }) => {
      const report = analyzeDiff(input);
      expect(kinds(report)).toContain(kind);
      expect(report.summary.modeOnlyFiles).toBe(1);
      expect(report.files.map((file) => file.displayPath)).toContain(companion);
      const observation = only(report, kind);
      expect(observation.title).toMatch(claim);
      expect(observation.message).toMatch(/content change/i);
    },
  );

  it('keeps every "without observed ... change" clause about content', () => {
    const corpus = [
      ...cases.map((item) => item.input),
      contentChange('src/app.ts'),
      `${contentChange('src/app.ts')}${contentChange('package.json')}`,
      `${contentChange('openapi.yml')}${binaryChange('dist/a.bin')}${binaryChange('dist/b.bin')}`,
      rename('package.json', 'package.old.json'),
      truncated('src/app.ts'),
    ];
    for (const input of corpus) {
      for (const item of analyzeDiff(input).evidence) {
        const claim = `${item.title} ${item.message}`;
        const missing = claim.match(/without observed (.+?) change/i);
        if (missing) expect(missing[1]).toMatch(/content/);
      }
    }
  });

  it('stays accurate and readable when no companion file appears at all', () => {
    const runtime = only(analyzeDiff(contentChange('src/app.ts')), 'runtime-without-tests');
    expect(runtime.title).toMatch(/test-file content change/i);
    expect(runtime.message).toMatch(/were observed in this diff/i);

    const manifest = only(analyzeDiff(contentChange('package.json')), 'manifest-without-lockfile');
    expect(manifest.title).toMatch(/lockfile content change/i);
    // No wording may imply a lockfile was seen and left unstaged.
    expect(`${manifest.title} ${manifest.message}`).not.toMatch(
      /missing|stale|absent|forgotten|exists/i,
    );
  });

  it('describes a contract change with no documentation in the diff at all', () => {
    const contract = only(analyzeDiff(contentChange('openapi.yml')), 'contract-without-docs');
    expect(contract.title).toMatch(/documentation content change/i);
    expect(`${contract.title} ${contract.message}`).not.toMatch(
      /undocumented|missing documentation|no documentation file/i,
    );
  });
});

describe('evidence language stays observational', () => {
  const forbidden =
    /\b(vulnerab\w*|unsafe|insecure|confidence|probabilit\w*|mergeab\w*|coverage|risk\w*|severity)\b|\bsafe\b|has no tests|percent/i;

  const corpus = [
    contentChange('src/auth/session.ts'),
    `${contentChange('src/app.ts')}${contentChange('package.json')}`,
    `${contentChange('openapi.yml')}${binaryChange('dist/a.bin')}${binaryChange('dist/b.bin')}`,
    rename('package.json', 'package.old.json'),
    modeOnly('Dockerfile'),
    truncated('src/app.ts'),
    'diff --git a/ b/\n--- \n+++ \n@@',
  ];

  const claimsFor = (report: ReviewAttentionMap): string[] => [
    ...report.evidence.map((item) => `${item.title} ${item.message}`),
    ...report.attention.map((item) => `${item.title} ${item.description}`),
    ...report.reviewOrder.map((item) => `${item.title} ${item.reason}`),
  ];

  it.each(corpus)('keeps every claim free of judgment wording: %s', (input) => {
    for (const claim of claimsFor(analyzeDiff(input))) expect(claim).not.toMatch(forbidden);
  });

  it('does make at least one claim for an ordinary content diff', () => {
    expect(claimsFor(analyzeDiff(contentChange('src/auth/session.ts'))).length).toBeGreaterThan(0);
  });

  it('describes test relationships as what was observed in this diff', () => {
    const report = analyzeDiff(contentChange('src/app.ts'));
    const observation = only(report, 'runtime-without-tests');
    expect(observation.message).toMatch(/were observed in this diff/i);
    expect(observation.message).not.toMatch(/no tests\b/i);
  });

  it('never names an unproven path in related files', () => {
    const reports = [
      analyzeDiff('diff --git a/ b/\n--- \n+++ \n@@'),
      analyzeDiff('diff --git a/one.ts b/two.ts b/three.ts'),
    ];
    for (const report of reports) {
      for (const item of report.evidence) expect(item.relatedFiles.join()).not.toContain('unknown');
    }
  });
});

describe('evidence is deterministic', () => {
  const input = `${contentChange('src/auth/session.ts')}${rename('package.json', 'package.old.json')}${binaryChange('dist/a.bin')}${modeOnly('Makefile')}`;

  it('produces byte-identical JSON for the same diff', () => {
    expect(renderJson(analyzeDiff(input))).toBe(renderJson(analyzeDiff(input)));
  });

  it('keeps evidence ordering independent of the order the diff lists files', () => {
    const reversed = `${modeOnly('Makefile')}${binaryChange('dist/a.bin')}${rename('package.json', 'package.old.json')}${contentChange('src/auth/session.ts')}`;
    expect(kinds(analyzeDiff(input))).toEqual(kinds(analyzeDiff(reversed)));
  });
});
