/**
 * DiffBeacon core design reminder: attention levels are review order labels,
 * not severity, risk, safety, confidence, or merge recommendations.
 */

import { parseUnifiedDiff } from './parser.js';
import type {
  AttentionLevel,
  ChangedFile,
  EvidenceObservation,
  ReviewAttentionMap,
  ReviewOrderEntry,
  SurfaceId,
  SurfaceObservation,
} from './model.js';
import { classifyFile, detectors, isDependencyManifest, isLockfile } from './detectors/registry.js';

const reviewPriority: SurfaceId[] = [
  'ci-build',
  'auth-access',
  'database-schema',
  'infrastructure',
  'api-contracts',
  'runtime',
  'dependencies',
  'configuration',
  'tests',
  'documentation',
  'generated',
];

const attentionDescriptions: Record<SurfaceId, { title: string; description: string }> =
  Object.fromEntries(
    detectors.map((detector) => [
      detector.id,
      { title: detector.title, description: detector.description },
    ]),
  ) as Record<SurfaceId, { title: string; description: string }>;

function levelFor(surface: SurfaceId): AttentionLevel {
  if (['ci-build', 'auth-access', 'database-schema', 'infrastructure'].includes(surface))
    return 'FOCUS';
  if (['api-contracts', 'runtime', 'dependencies', 'configuration'].includes(surface))
    return 'CHECK';
  return 'NOTE';
}

export function compareCanonicalText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortFiles(files: ChangedFile[]): ChangedFile[] {
  return [...files].sort((a, b) => compareCanonicalText(a.displayPath, b.displayPath));
}

function surfaceObservation(surface: SurfaceId, files: ChangedFile[]): SurfaceObservation {
  const matching = sortFiles(files.filter((file) => file.surfaces.includes(surface)));
  return {
    surface,
    title: attentionDescriptions[surface]?.title ?? surface,
    description:
      attentionDescriptions[surface]?.description ?? 'Changed files matched this surface.',
    level: levelFor(surface),
    fileCount: matching.length,
    additions: matching.reduce((sum, file) => sum + (file.additions ?? 0), 0),
    deletions: matching.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
    files: matching.map((file) => file.displayPath),
  };
}

function evidenceFor(files: ChangedFile[]): EvidenceObservation[] {
  const sorted = sortFiles(files);
  const testFiles = sorted.filter((file) => file.surfaces.includes('tests') && !file.modeOnly);
  const runtimeFiles = sorted.filter((file) => file.surfaces.includes('runtime') && !file.modeOnly);
  const authFiles = sorted.filter((file) => file.surfaces.includes('auth-access'));
  const databaseFiles = sorted.filter((file) => file.surfaces.includes('database-schema'));
  const manifests = sorted.filter((file) => isDependencyManifest(file.displayPath));
  const lockfiles = sorted.filter((file) => isLockfile(file.displayPath));
  const contracts = sorted.filter((file) => file.surfaces.includes('api-contracts'));
  const docs = sorted.filter((file) => file.surfaces.includes('documentation'));
  const generated = sorted.filter((file) => file.generated);
  const totalChangedLines = sorted.reduce(
    (sum, file) => sum + (file.additions ?? 0) + (file.deletions ?? 0),
    0,
  );
  const generatedChangedLines = generated.reduce(
    (sum, file) => sum + (file.additions ?? 0) + (file.deletions ?? 0),
    0,
  );
  const observations: EvidenceObservation[] = [];
  const names = (items: ChangedFile[]) => items.map((file) => file.displayPath);

  if (runtimeFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: 'runtime-without-tests',
      title: 'Runtime changes without observed test-file changes',
      message:
        'Runtime files changed, but no test-file changes were observed in this diff. Confirm existing coverage is sufficient.',
      relatedFiles: names(runtimeFiles),
    });
  }
  if (authFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: 'auth-without-tests',
      title: 'Authentication/access changes without observed test-file changes',
      message:
        'Authentication or authorization files changed. No test-file changes were observed in this diff.',
      relatedFiles: names(authFiles),
    });
  }
  if (databaseFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: 'database-without-tests',
      title: 'Database/schema changes without observed test-file changes',
      message: 'Database or schema files changed. No test-file changes were observed in this diff.',
      relatedFiles: names(databaseFiles),
    });
  }
  if (manifests.length > 0 && lockfiles.length === 0) {
    observations.push({
      kind: 'manifest-without-lockfile',
      title: 'Dependency manifest without observed lockfile change',
      message: 'A dependency manifest changed. No lockfile change was observed in this diff.',
      relatedFiles: names(manifests),
    });
  }
  if (lockfiles.length > 0 && manifests.length === 0) {
    observations.push({
      kind: 'lockfile-without-manifest',
      title: 'Lockfile without observed dependency manifest change',
      message: 'A lockfile changed. No dependency manifest change was observed in this diff.',
      relatedFiles: names(lockfiles),
    });
  }
  if (contracts.length > 0 && docs.length === 0) {
    observations.push({
      kind: 'contract-without-docs',
      title: 'Contract definition without observed documentation change',
      message:
        'An API or contract definition changed. No documentation or changelog change was observed in this diff.',
      relatedFiles: names(contracts),
    });
  }
  const fileShare = sorted.length === 0 ? 0 : generated.length / sorted.length;
  const lineShare = totalChangedLines === 0 ? 0 : generatedChangedLines / totalChangedLines;
  if (generated.length >= 2 && (fileShare >= 0.5 || lineShare >= 0.5)) {
    observations.push({
      kind: 'generated-volume',
      title: 'Generated-file volume',
      message:
        'Generated-file changes account for a large share of this diff and may obscure the smaller hand-written change set.',
      relatedFiles: names(generated),
      metrics: {
        generatedFiles: generated.length,
        changedFiles: sorted.length,
        generatedFileShare: fileShare,
        generatedChangedLines,
        totalChangedLines,
        generatedLineShare: lineShare,
      },
    });
  }
  return observations;
}

function makeReviewOrder(files: ChangedFile[]): ReviewOrderEntry[] {
  const entries: ReviewOrderEntry[] = [];
  for (const surface of reviewPriority) {
    const matching = sortFiles(files.filter((file) => file.surfaces.includes(surface)));
    if (matching.length === 0) continue;
    entries.push({
      position: entries.length + 1,
      surface,
      title: attentionDescriptions[surface]?.title ?? surface,
      reason: `DiffBeacon recommends looking at ${attentionDescriptions[surface]?.title ?? surface} earlier in this review.`,
      files: matching.map((file) => file.displayPath),
    });
  }
  return entries;
}

export function analyzeDiff(input: string): ReviewAttentionMap {
  const parsed = parseUnifiedDiff(input);
  const files = sortFiles(parsed.files.map(classifyFile));
  const attention = reviewPriority
    .filter((surface) => files.some((file) => file.surfaces.includes(surface)))
    .map((surface) => surfaceObservation(surface, files));
  return {
    schemaVersion: '1',
    summary: {
      changedFiles: files.length,
      additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
      deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
      binaryFiles: files.filter((file) => file.binary).length,
      modeOnlyFiles: files.filter((file) => file.modeOnly).length,
      generatedFiles: files.filter((file) => file.generated).length,
      diagnostics: parsed.diagnostics.length,
    },
    files,
    attention,
    evidence: evidenceFor(files),
    reviewOrder: makeReviewOrder(files),
  };
}
