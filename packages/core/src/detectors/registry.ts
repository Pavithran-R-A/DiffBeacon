/**
 * DiffBeacon core design reminder: the detector registry is a transparent
 * catalog of observations. It deliberately avoids generic “security” labels.
 */

import type { ChangedFile, SurfaceId } from '../model.js';
import {
  basename,
  extension,
  hasSegment,
  hasPathPrefix,
  isDependencyManifest,
  isDocumentationPath,
  isGeneratedPath,
  isLockfile,
  isTestPath,
  normalizedPath,
} from './shared.js';

export interface Detector {
  id: SurfaceId;
  title: string;
  description: string;
  matches: (path: string) => boolean;
}

const codeExtensions = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.cs',
  '.ex',
  '.exs',
  '.go',
  '.java',
  '.js',
  '.jsx',
  '.kt',
  '.php',
  '.py',
  '.rb',
  '.rs',
  '.sh',
  '.swift',
  '.ts',
  '.tsx',
]);

export const detectors: Detector[] = [
  {
    id: 'ci-build',
    title: 'CI / Build',
    description: 'Workflow, pipeline, or build-system files changed.',
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return (
        normalized.startsWith('.github/workflows/') ||
        normalized.startsWith('.github/actions/') ||
        [
          'jenkinsfile',
          'buildkite.yml',
          'azure-pipelines.yml',
          'circle.yml',
          'makefile',
          'taskfile.yml',
        ].includes(name) ||
        hasSegment(normalized, '.circleci')
      );
    },
  },
  {
    id: 'auth-access',
    title: 'Authentication / Access',
    description: 'Authentication, authorization, permissions, or access-control paths changed.',
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return (
        hasSegment(normalized, 'auth') ||
        hasSegment(normalized, 'authorization') ||
        hasSegment(normalized, 'permissions') ||
        hasSegment(normalized, 'rbac') ||
        hasSegment(normalized, 'acl') ||
        hasSegment(normalized, 'access-control') ||
        /(^|[-_.])(auth|identity|session|permission|authorization)([-_.]|$)/.test(name)
      );
    },
  },
  {
    id: 'database-schema',
    title: 'Database / Schema',
    description: 'Schema definitions or migration conventions changed.',
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return (
        hasSegment(normalized, 'migrations') ||
        hasSegment(normalized, 'migration') ||
        hasSegment(normalized, 'alembic') ||
        hasSegment(normalized, 'prisma') ||
        hasPathPrefix(normalized, 'db/migrate') ||
        hasPathPrefix(normalized, 'drizzle') ||
        hasPathPrefix(normalized, 'db/drizzle') ||
        name === 'schema.prisma' ||
        name === 'schema.sql' ||
        name.endsWith('.migration.sql')
      );
    },
  },
  {
    id: 'dependencies',
    title: 'Dependencies',
    description: 'Dependency manifests or lockfiles changed.',
    matches: (path) => isDependencyManifest(path) || isLockfile(path),
  },
  {
    id: 'api-contracts',
    title: 'API / Contracts',
    description: 'Explicit API, GraphQL, protobuf, OpenAPI, or Swagger definitions changed.',
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return (
        name === 'openapi.yml' ||
        name === 'openapi.yaml' ||
        name === 'openapi.json' ||
        name === 'swagger.yml' ||
        name === 'swagger.yaml' ||
        name === 'swagger.json' ||
        extension(path) === '.graphql' ||
        extension(path) === '.gql' ||
        extension(path) === '.proto' ||
        hasSegment(normalized, 'openapi') ||
        (hasPathPrefix(normalized, 'api') && /(^|[-_.])(schema|contract)([-_.]|$)/.test(name))
      );
    },
  },
  {
    id: 'configuration',
    title: 'Configuration',
    description: 'Application, build, or tooling configuration changed.',
    matches: (path) => {
      const name = basename(path);
      const normalized = normalizedPath(path);
      return (
        hasSegment(normalized, 'config') ||
        /(^|\.)config\.[^.]+$/.test(name) ||
        name.endsWith('.config.js') ||
        name.endsWith('.config.ts') ||
        name === 'tsconfig.json' ||
        name === '.env.example' ||
        name === 'vite.config.ts'
      );
    },
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure / Deployment',
    description:
      'Container, infrastructure-as-code, orchestration, or deployment manifests changed.',
    matches: (path) => {
      const normalized = normalizedPath(path);
      const name = basename(path);
      return (
        name === 'dockerfile' ||
        name.startsWith('dockerfile.') ||
        name.startsWith('docker-compose') ||
        extension(path) === '.tf' ||
        extension(path) === '.tfvars' ||
        hasSegment(normalized, 'terraform') ||
        hasSegment(normalized, 'kubernetes') ||
        hasSegment(normalized, 'k8s') ||
        hasSegment(normalized, 'helm') ||
        hasSegment(normalized, 'deploy') ||
        hasSegment(normalized, 'manifests')
      );
    },
  },
  {
    id: 'tests',
    title: 'Tests',
    description: 'Test files or test fixtures changed.',
    matches: (path) => isTestPath(path),
  },
  {
    id: 'documentation',
    title: 'Documentation / Changelog',
    description: 'Documentation, README, changelog, or release-note files changed.',
    matches: (path) => isDocumentationPath(path),
  },
  {
    id: 'generated',
    title: 'Generated Files',
    description: 'Files matching conservative generated-output conventions changed.',
    matches: (path) => isGeneratedPath(path),
  },
  {
    id: 'runtime',
    title: 'Runtime Implementation',
    description: 'Application or library implementation files changed.',
    matches: (path) =>
      codeExtensions.has(extension(path)) &&
      !isTestPath(path) &&
      !isDocumentationPath(path) &&
      !isGeneratedPath(path),
  },
];

export function classifyFile(file: ChangedFile): ChangedFile {
  const path = file.displayPath;
  const surfaces = detectors
    .filter((detector) => detector.matches(path))
    .map((detector) => detector.id);
  return { ...file, surfaces, generated: surfaces.includes('generated') };
}

export function detectorById(id: SurfaceId): Detector {
  const detector = detectors.find((candidate) => candidate.id === id);
  if (!detector) throw new Error(`Unknown detector: ${id}`);
  return detector;
}

export {
  isDependencyManifest,
  isDocumentationPath,
  isGeneratedPath,
  isLockfile,
  isTestPath,
} from './shared.js';
