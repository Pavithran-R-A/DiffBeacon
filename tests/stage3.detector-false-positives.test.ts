import { describe, expect, it } from 'vitest';
import {
  SURFACE_IDS,
  analyzeDiff,
  classifyFile,
  parseUnifiedDiff,
} from '../packages/core/src/index.js';
import type { ChangedFile } from '../packages/core/src/model.js';
import { UNKNOWN_PATH_SENTINEL } from '../packages/core/src/model.js';

// Stage 3: every detector has to prove it ignores the neighbour that looks like it.
// Each near-miss below is paired with the genuine convention it resembles, because
// "matches my positive" proves nothing without "does not match its misleading twin".

const single = (path: string) =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n`;

const surfacesFor = (path: string): string[] =>
  analyzeDiff(single(path)).files.find((file) => file.displayPath === path)?.surfaces ?? [];

// Files arrive canonically sorted, so a shared diff is looked up by path rather
// than by position.
const surfacesTogether = (...paths: string[]): string[][] => {
  const report = analyzeDiff(paths.map(single).join(''));
  return paths.map(
    (path) => report.files.find((file) => file.displayPath === path)?.surfaces ?? [],
  );
};

const nearMisses: Array<[string, string[]]> = [
  ['src/authentic.ts', ['runtime']],
  ['src/author.ts', ['runtime']],
  ['src/contest.ts', ['runtime']],
  ['src/latest.ts', ['runtime']],
  ['src/schemas/form.ts', ['runtime']],
  ['src/configuration.ts', ['runtime']],
  ['src/build/index.ts', ['runtime']],
  ['packages/build/src/index.ts', ['runtime']],
  ['src/builders/compiler.ts', ['runtime']],
  ['src/api/client.ts', ['runtime']],
  ['deployment.ts', ['runtime']],
  ['vendor/min.js', ['runtime']],
  ['src/test-utils/helper.ts', ['runtime']],
  ['docs/docker-notes.md', ['documentation']],
  ['docs/migration-guide.md', ['documentation']],
  ['docs/workflows.md', ['documentation']],
  ['docs/openapi-guide.md', ['documentation']],
  ['buildkite-notes.md', ['documentation']],
  ['Makefile.md', ['documentation']],
  ['package-lock-notes.md', ['documentation']],
  ['package.example.json', []],
  ['.github/ISSUE_TEMPLATE/bug.yml', []],
  ['charts/app/templates/pod.yaml', []],
  ['src\\auth\\session.ts', ['runtime']],
  ['dir\\package.json', []],
  ['dist\\bundle.js', ['runtime']],
  ['.github\\workflows\\ci.yml', []],
];

const conventions: Array<[string, string[]]> = [
  ['src/auth/session.ts', ['auth-access', 'runtime']],
  ['src/authorization/policy.ts', ['auth-access', 'runtime']],
  ['tests/contest.test.ts', ['tests']],
  ['test/latest.py', ['tests']],
  ['prisma/schema.prisma', ['database-schema']],
  ['db/migrate/001_add_users.rb', ['database-schema', 'runtime']],
  ['migrations/20200101_init.sql', ['database-schema']],
  ['config/app.yml', ['configuration']],
  ['vite.config.ts', ['configuration']],
  ['build/out.js', ['generated']],
  ['packages/app/dist/index.js', ['generated']],
  ['src/client.generated.ts', ['generated']],
  ['openapi.yml', ['api-contracts']],
  ['deploy/helm/release.yaml', ['infrastructure']],
  ['Dockerfile', ['infrastructure']],
  ['Jenkinsfile', ['ci-build']],
  ['buildkite.yml', ['ci-build']],
  ['Makefile', ['ci-build']],
  ['package.json', ['dependencies']],
  ['pnpm-lock.yaml', ['dependencies']],
];

describe('near-miss paths carry no surface claim', () => {
  it.each(nearMisses)('classifies the near-miss %s as %j', (path, expected) => {
    expect(surfacesFor(path)).toEqual(expected);
  });

  it('does not let a near-miss borrow a surface from its neighbour in the same diff', () => {
    const [authFile, authenticFile, buildOut, buildSource, manifest, exampleManifest] =
      surfacesTogether(
        'src/auth/session.ts',
        'src/authentic.ts',
        'build/out.js',
        'src/build/index.ts',
        'package.json',
        'package.example.json',
      );
    expect(authFile).toEqual(['auth-access', 'runtime']);
    expect(authenticFile).toEqual(['runtime']);
    expect(buildOut).toEqual(['generated']);
    expect(buildSource).toEqual(['runtime']);
    expect(manifest).toEqual(['dependencies']);
    expect(exampleManifest).toEqual([]);
  });
});

describe('genuine conventions beside each near-miss', () => {
  it.each(conventions)('classifies %s as %j', (path, expected) => {
    expect(surfacesFor(path)).toEqual(expected);
  });
});

describe('Git path separators stay distinct from literal POSIX backslashes', () => {
  it('does not invent directory segments from backslash bytes', () => {
    expect(surfacesFor('src/auth/session.ts')).toEqual(['auth-access', 'runtime']);
    expect(surfacesFor('src\\auth\\session.ts')).toEqual(['runtime']);

    expect(surfacesFor('package.json')).toEqual(['dependencies']);
    expect(surfacesFor('dir\\package.json')).toEqual([]);

    expect(surfacesFor('dist/bundle.js')).toEqual(['generated']);
    expect(surfacesFor('dist\\bundle.js')).toEqual(['runtime']);
  });
});

describe('every corpus path reports only documented surfaces', () => {
  const corpus = [...nearMisses, ...conventions].map(([path]) => path);

  it.each(corpus)('keeps every surface claimed for %s inside SURFACE_IDS', (path) => {
    for (const surface of surfacesFor(path)) expect(SURFACE_IDS).toContain(surface);
  });
});

describe('unproven and sentinel presentation strings are never filenames', () => {
  const unproven = (overrides: Partial<ChangedFile>): ChangedFile => ({
    oldPath: null,
    newPath: null,
    displayPath: UNKNOWN_PATH_SENTINEL,
    status: 'modified',
    additions: 1,
    deletions: 1,
    binary: false,
    modeOnly: false,
    oldMode: null,
    newMode: null,
    similarity: null,
    surfaces: [],
    generated: false,
    ...overrides,
  });

  it('classifies the unknown-path sentinel as nothing at all', () => {
    expect(classifyFile(unproven({})).surfaces).toEqual([]);
    expect(classifyFile(unproven({})).generated).toBe(false);
  });

  it('classifies nothing when only one side of a rename was proven', () => {
    expect(classifyFile(unproven({ newPath: UNKNOWN_PATH_SENTINEL })).surfaces).toEqual([]);
  });

  it('treats a real file literally named like the sentinel as unproven', () => {
    const parsed = parseUnifiedDiff(
      `diff --git a/${UNKNOWN_PATH_SENTINEL} b/${UNKNOWN_PATH_SENTINEL}`,
    );
    expect(parsed.files[0]?.displayPath).toBe(UNKNOWN_PATH_SENTINEL);
    expect(classifyFile(parsed.files[0] as ChangedFile).surfaces).toEqual([]);
  });

  it('gives no surface, attention, order, or evidence for an unproven path', () => {
    const report = analyzeDiff('diff --git a/ b/\n--- \n+++ \n@@');
    expect(report.files[0]?.surfaces).toEqual([]);
    expect(report.attention).toEqual([]);
    expect(report.reviewOrder).toEqual([]);
    expect(report.evidence).toEqual([]);
    expect(report.summary.generatedFiles).toBe(0);
  });

  it('keeps header-looking text inside hunk content inert', () => {
    const report = analyzeDiff(`diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1 +1 @@
-const value = 'diff --git a/secret/auth.ts b/secret/auth.ts';
+const value = 'config/prod.yml';`);
    expect(report.files.map((file) => file.displayPath)).toEqual(['src/index.ts']);
    expect(report.files[0]?.surfaces).toEqual(['runtime']);
    expect(report.evidence.map((item) => item.kind)).toEqual(['runtime-without-tests']);
  });
});
