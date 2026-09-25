/**
 * DiffBeacon core design reminder: path heuristics are conservative signals,
 * not semantic proof. Keep the matching rules explicit and easy to test.
 */

export function normalizedPath(path: string): string {
  return path.replaceAll('\\', '/').toLowerCase();
}

export function basename(path: string): string {
  const normalized = path.replaceAll('\\', '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase();
}

export function hasSegment(path: string, segment: string): boolean {
  const normalized = normalizedPath(path);
  const needle = normalizedPath(segment).replace(/^\/+|\/+$/g, '');
  if (needle.includes('/')) {
    return (
      normalized === needle ||
      normalized.startsWith(`${needle}/`) ||
      normalized.endsWith(`/${needle}`) ||
      normalized.includes(`/${needle}/`)
    );
  }
  return normalized.split('/').includes(needle);
}

export function hasPathPrefix(path: string, prefix: string): boolean {
  const normalized = normalizedPath(path).replace(/^\/+/, '');
  const needle = normalizedPath(prefix).replace(/^\/+|\/+$/g, '');
  return normalized === needle || normalized.startsWith(`${needle}/`);
}

export function extension(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot) : '';
}

export function isDependencyManifest(path: string): boolean {
  const name = basename(path);
  return new Set([
    'package.json',
    'requirements.txt',
    'pyproject.toml',
    'pipfile',
    'cargo.toml',
    'go.mod',
    'gemfile',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'composer.json',
  ]).has(name);
}

export function isLockfile(path: string): boolean {
  const name = basename(path);
  return new Set([
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'poetry.lock',
    'pipfile.lock',
    'cargo.lock',
    'go.sum',
    'gemfile.lock',
    'composer.lock',
    'gradle.lockfile',
  ]).has(name);
}

export function isConfigFilename(path: string): boolean {
  const name = basename(path);
  return (
    /^(\w+[-.])?config\.[^.]+$/.test(name) || name === 'tsconfig.json' || name === '.env.example'
  );
}

export function isTestPath(path: string): boolean {
  const normalized = normalizedPath(path);
  const name = basename(path);
  return (
    ['test', 'tests', 'spec', 'specs', '__tests__', 'fixtures'].some((segment) =>
      hasSegment(normalized, segment),
    ) ||
    /(^|[._-])(test|spec)([._-]|$)/.test(name) ||
    name.endsWith('_test.go') ||
    name.startsWith('test_')
  );
}

export function isDocumentationPath(path: string): boolean {
  const name = basename(path);
  const normalized = normalizedPath(path);
  return (
    hasSegment(normalized, 'docs') ||
    /^(readme|changelog|contributing|security|code_of_conduct)(\.|$)/.test(name) ||
    name.startsWith('release-notes') ||
    name.endsWith('.md') ||
    name.endsWith('.mdx')
  );
}

export function isGeneratedPath(path: string): boolean {
  const normalized = normalizedPath(path);
  const name = basename(path);
  if (isLockfile(path)) return false;
  return (
    hasSegment(normalized, 'dist') ||
    // Only the repository-root `build/` output directory proves generated output. A
    // nested `build` segment is as often a hand-written module whose domain is
    // building, which would silently vanish from the runtime surface.
    normalized.startsWith('build/') ||
    hasSegment(normalized, 'generated') ||
    name.endsWith('.generated.ts') ||
    name.endsWith('.generated.js') ||
    name.endsWith('.min.js') ||
    name.endsWith('.map')
  );
}
