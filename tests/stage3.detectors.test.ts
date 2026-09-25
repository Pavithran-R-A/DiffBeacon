import { describe, expect, it } from 'vitest';
import {
  SURFACE_IDS,
  analyzeDiff,
  classifyFile,
  detectorById,
  detectors,
  parseUnifiedDiff,
} from '../packages/core/src/index.js';
import type { ChangedFile } from '../packages/core/src/model.js';

// Stage 3: a detector states only that a review surface changed, and it must say
// so for every path a diff can actually present — including a rename, which has
// two paths, and a header whose paths could not be proven.

const single = (path: string) =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n`;

const surfacesFor = (path: string): string[] => analyzeDiff(single(path)).files[0]?.surfaces ?? [];

const renameDiff = (from: string, to: string) =>
  `diff --git a/${from} b/${to}\nsimilarity index 92%\nrename from ${from}\nrename to ${to}\n--- a/${from}\n+++ b/${to}\n@@ -1 +1 @@\n-old\n+new\n`;

const renamedSurfaces = (from: string, to: string): string[] =>
  analyzeDiff(renameDiff(from, to)).files[0]?.surfaces ?? [];

const changedFile = (overrides: Partial<ChangedFile>): ChangedFile => ({
  oldPath: 'src/app.ts',
  newPath: 'src/app.ts',
  displayPath: 'src/app.ts',
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

describe('detector surface positives', () => {
  const positives: Array<[string, string[]]> = [
    ['.github/workflows/ci.yml', ['ci-build']],
    ['.github/actions/example/action.yml', ['ci-build']],
    ['Jenkinsfile', ['ci-build']],
    ['buildkite.yml', ['ci-build']],
    ['azure-pipelines.yml', ['ci-build']],
    ['.circleci/config.yml', ['ci-build', 'configuration']],
    ['Makefile', ['ci-build']],
    ['Taskfile.yml', ['ci-build']],
    ['src/auth/session.ts', ['auth-access', 'runtime']],
    ['authorization/policy.ts', ['auth-access', 'runtime']],
    ['src/permissions/edit.ts', ['auth-access', 'runtime']],
    ['src/rbac/roles.ts', ['auth-access', 'runtime']],
    ['acl/lists.ts', ['auth-access', 'runtime']],
    ['access-control/gate.ts', ['auth-access', 'runtime']],
    ['db/migrate/001_add_users.rb', ['database-schema', 'runtime']],
    ['migrations/20200101_up.sql', ['database-schema']],
    ['alembic/versions/abc.py', ['database-schema', 'runtime']],
    ['prisma/schema.prisma', ['database-schema']],
    ['drizzle/0001_users.sql', ['database-schema']],
    ['schema.sql', ['database-schema']],
    ['package.json', ['dependencies']],
    ['app/package.json', ['dependencies']],
    ['package-lock.json', ['dependencies']],
    ['go.mod', ['dependencies']],
    ['openapi.yml', ['api-contracts']],
    ['swagger.json', ['api-contracts']],
    ['api/schema.graphql', ['api-contracts']],
    ['proto/user.proto', ['api-contracts']],
    ['api/user_contract.ts', ['api-contracts', 'runtime']],
    ['config/app.yml', ['configuration']],
    ['tsconfig.json', ['configuration']],
    ['.env.example', ['configuration']],
    ['Dockerfile', ['infrastructure']],
    ['docker-compose.yml', ['infrastructure']],
    ['infra/main.tf', ['infrastructure']],
    ['k8s/deployment.yaml', ['infrastructure']],
    ['helm/production/values.yaml', ['infrastructure']],
    ['deploy/prod/manifests.yaml', ['infrastructure']],
    ['tests/core.test.ts', ['tests']],
    ['test/unit.py', ['tests']],
    ['spec/models/user_spec.rb', ['tests']],
    ['__tests__/auth.tsx', ['auth-access', 'tests']],
    ['tests/fixtures/user.json', ['tests']],
    ['pkg/server_test.go', ['tests']],
    ['docs/architecture/overview.md', ['documentation']],
    ['README.md', ['documentation']],
    ['CHANGELOG.md', ['documentation']],
    ['SECURITY.md', ['documentation']],
    ['docs/release-notes-2.md', ['documentation']],
    ['notes.mdx', ['documentation']],
    ['dist/bundle.js', ['generated']],
    ['build/out.js', ['generated']],
    ['packages/action/dist/index.js', ['generated']],
    ['src/api/client.generated.ts', ['generated']],
    ['src/app.min.js', ['generated']],
    ['styles/app.css.map', ['generated']],
    ['src/index.ts', ['runtime']],
    ['lib/main.go', ['runtime']],
    ['scripts/bootstrap.sh', ['runtime']],
  ];

  it.each(positives)('classifies %s as %j', (path, expected) => {
    expect(surfacesFor(path)).toEqual(expected);
  });

  it('keeps a hand-written module inside a config directory on both surfaces', () => {
    expect(surfacesFor('src/config/loader.ts')).toEqual(['configuration', 'runtime']);
  });
});

describe('generated matcher stays off hand-written source', () => {
  it.each([
    'src/build/index.ts',
    'src/build/pipeline.ts',
    'packages/build/src/index.ts',
    'packages/builder/src/build.ts',
    'src/builders/compiler.ts',
    'buildSrc/Plugin.kt',
  ])('treats %s as runtime implementation, not generated output', (path) => {
    expect(surfacesFor(path)).toContain('runtime');
    expect(surfacesFor(path)).not.toContain('generated');
  });

  it('still treats the conventional root build output as generated', () => {
    expect(surfacesFor('build/out.js')).toEqual(['generated']);
    expect(surfacesFor('build/artifacts/app.min.js')).toEqual(['generated']);
  });

  it('never reports a lockfile as generated output', () => {
    expect(surfacesFor('pnpm-lock.yaml')).toEqual(['dependencies']);
    expect(surfacesFor('dist/pnpm-lock.yaml')).toEqual(['dependencies']);
  });
});

describe('configuration and runtime boundary', () => {
  it.each(['vite.config.ts', 'webpack.config.js', 'eslint.config.js', 'config.ts'])(
    'reports %s as configuration without calling it runtime implementation',
    (path) => {
      expect(surfacesFor(path)).toEqual(['configuration']);
    },
  );

  it('keeps the deliberate auth/runtime multi-match intact', () => {
    expect(surfacesFor('src/auth/session.ts')).toEqual(['auth-access', 'runtime']);
  });

  it('excludes tests, documentation and generated output from runtime', () => {
    expect(surfacesFor('tests/app.test.ts')).toEqual(['tests']);
    expect(surfacesFor('docs/guide.md')).toEqual(['documentation']);
    expect(surfacesFor('dist/app.js')).toEqual(['generated']);
  });
});

describe('rename considers the old and the new path', () => {
  it('keeps the authentication surface when a file moves out of it', () => {
    expect(renamedSurfaces('src/auth/session.ts', 'src/state/token-store.ts')).toEqual([
      'auth-access',
      'runtime',
    ]);
  });

  it('reports the authentication surface when a file moves into it', () => {
    expect(renamedSurfaces('src/state/token-store.ts', 'src/auth/session.ts')).toEqual([
      'auth-access',
      'runtime',
    ]);
  });

  it('keeps the tests surface when a test file is moved out of the test tree', () => {
    expect(renamedSurfaces('tests/unit/auth.test.ts', 'src/auth/unit.ts')).toEqual([
      'auth-access',
      'tests',
      'runtime',
    ]);
  });

  it('reports both surfaces when generated output is moved into source', () => {
    expect(renamedSurfaces('dist/app.js', 'src/app.js')).toEqual(['generated', 'runtime']);
  });

  it('keeps the dependency surface when a manifest is renamed away', () => {
    expect(renamedSurfaces('package.json', 'package.old.json')).toEqual(['dependencies']);
  });

  it('lists each surface once even when both paths match it', () => {
    const surfaces = renamedSurfaces('src/auth/login.ts', 'src/auth/session.ts');
    expect(surfaces).toEqual(['auth-access', 'runtime']);
    expect(new Set(surfaces).size).toBe(surfaces.length);
  });

  it('orders surfaces by detector registration, not by path order', () => {
    const forwards = renamedSurfaces('tests/auth.test.ts', 'src/auth/index.ts');
    const backwards = renamedSurfaces('src/auth/index.ts', 'tests/auth.test.ts');
    expect(forwards).toEqual(backwards);
  });

  it('classifies an added file from its new path and a deleted file from its old path', () => {
    const added = analyzeDiff(
      'diff --git a/src/auth/guard.ts b/src/auth/guard.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/auth/guard.ts\n@@ -0,0 +1 @@\n+guard\n',
    );
    expect(added.files[0]).toMatchObject({ oldPath: null, surfaces: ['auth-access', 'runtime'] });
    const deleted = analyzeDiff(
      'diff --git a/src/auth/guard.ts b/src/auth/guard.ts\ndeleted file mode 100644\n--- a/src/auth/guard.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-guard\n',
    );
    expect(deleted.files[0]).toMatchObject({
      newPath: null,
      surfaces: ['auth-access', 'runtime'],
    });
  });
});

describe('unproven paths never reach a detector', () => {
  it('classifies the unknown-path sentinel as no surface at all', () => {
    const classified = classifyFile(
      changedFile({ oldPath: null, newPath: null, displayPath: '<unknown path>' }),
    );
    expect(classified.surfaces).toEqual([]);
    expect(classified.generated).toBe(false);
  });

  it('does not let a sentinel-shaped display path produce attention or evidence', () => {
    const report = analyzeDiff('diff --git a/ b/\n--- \n+++ \n@@');
    expect(report.files).toHaveLength(1);
    expect(report.files[0]?.displayPath).toBe('<unknown path>');
    expect(report.files[0]?.surfaces).toEqual([]);
    expect(report.attention).toEqual([]);
    expect(report.reviewOrder).toEqual([]);
    expect(report.evidence).toEqual([]);
  });

  it('reports no surfaces for an ambiguous header that is never proven', () => {
    const parsed = parseUnifiedDiff('diff --git a/one.ts b/two.ts b/three.ts');
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['ambiguous-path']);
    expect(classifyFile(parsed.files[0] as ChangedFile).surfaces).toEqual([]);
  });

  it('classifies from the proven paths an ambiguous header could not resolve', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/src/auth/one.ts b/two.ts b/three.ts\n--- a/src/auth/one.ts\n+++ b/src/state/two.ts',
    );
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['ambiguous-path']);
    expect(classifyFile(parsed.files[0] as ChangedFile).surfaces).toEqual([
      'auth-access',
      'runtime',
    ]);
  });

  it('classifies a copied file from the destination it does name', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/src/auth/copy-src.ts b/src/state/copy-dst.ts\nsimilarity index 95%\ncopy from src/auth/copy-src.ts\ncopy to src/state/copy-dst.ts\n--- a/src/auth/copy-src.ts\n+++ b/src/state/copy-dst.ts\n@@ -1 +1 @@\n-source\n+destination\n',
    );
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'unsupported-dialect',
    ]);
    expect(parsed.files[0]).toMatchObject({ status: 'added' });
    expect(classifyFile(parsed.files[0] as ChangedFile).surfaces).toEqual(['runtime']);
  });
});

describe('mode-only changes keep their surface but claim no relationship', () => {
  const modeOnly = (path: string) =>
    `diff --git a/${path} b/${path}\nold mode 100644\nnew mode 100755\n`;

  it.each([
    ['src/auth/session.ts', ['auth-access', 'runtime']],
    ['package.json', ['dependencies']],
    ['package-lock.json', ['dependencies']],
    ['openapi.yml', ['api-contracts']],
    ['tests/app.test.ts', ['tests']],
    ['docs/readme.md', ['documentation']],
    ['dist/app.js', ['generated']],
    ['Dockerfile', ['infrastructure']],
  ])('classifies the mode-only change to %s as %j', (path, expected) => {
    const report = analyzeDiff(modeOnly(path));
    expect(report.files[0]?.surfaces).toEqual(expected);
    expect(report.files[0]?.modeOnly).toBe(true);
  });
});

describe('registry invariants', () => {
  it('registers exactly one detector per documented surface id', () => {
    expect(detectors.map((detector) => detector.id)).toEqual([...SURFACE_IDS]);
  });

  it('keeps detector ids unique', () => {
    const ids = detectors.map((detector) => detector.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps detector order stable across repeated reads', () => {
    expect(detectors.map((detector) => detector.id)).toEqual(
      detectors.map((detector) => detector.id),
    );
  });

  it.each(
    detectors.map((detector) => [detector.id, detector.title, detector.description] as const),
  )('gives %s a non-empty observational title and description', (_id, title, description) => {
    expect(title.trim().length).toBeGreaterThan(0);
    expect(description.trim().length).toBeGreaterThan(0);
    expect(description.endsWith('changed.')).toBe(true);
  });

  it('resolves every registered id and rejects an unknown one', () => {
    for (const detector of detectors) expect(detectorById(detector.id)).toBe(detector);
    expect(() => detectorById('secrets' as (typeof SURFACE_IDS)[number])).toThrow(
      'Unknown detector: secrets',
    );
  });

  it('never words a detector as a safety, risk, or coverage judgment', () => {
    const forbidden =
      /\b(vulnerab\w*|safe|unsafe|secure|insecure|risk\w*|severity|confidence|probabilit\w*|mergeab\w*|coverage)\b/i;
    for (const detector of detectors) {
      expect(`${detector.title} ${detector.description}`).not.toMatch(forbidden);
    }
  });

  it('classifies the same file identically on every pass', () => {
    const file = changedFile({ oldPath: 'src/auth/session.ts', newPath: 'src/session.ts' });
    expect(JSON.stringify(classifyFile(file))).toBe(JSON.stringify(classifyFile(file)));
  });

  it('does not mutate the file it classifies', () => {
    const file = changedFile({ surfaces: [], generated: false });
    expect(classifyFile(file)).not.toBe(file);
    expect(file.surfaces).toEqual([]);
  });
});
