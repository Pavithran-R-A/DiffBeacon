/**
 * DiffBeacon core design reminder: attention levels are review order labels,
 * not severity, risk, safety, confidence, or merge recommendations.
 */

import { parseUnifiedDiff } from './parser.js';
import type {
  AttentionLevel,
  ChangedFile,
  EvidenceObservation,
  ParseDiagnostic,
  ParseDiagnosticCode,
  ReviewAttentionMap,
  ReviewOrderEntry,
  SurfaceId,
  SurfaceObservation,
} from './model.js';
import {
  classifyFile,
  detectors,
  isDependencyManifest,
  isLockfile,
  matchesSurface,
} from './detectors/registry.js';

// Diagnostics that prove a hunk's line accounting is wrong, which is the only
// reason a reported line count would mislead a share calculation.
const countDiagnostics: ParseDiagnosticCode[] = [
  'malformed-hunk',
  'truncated-hunk',
  'hunk-count-mismatch',
];

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

function evidenceFor(files: ChangedFile[], diagnostics: ParseDiagnostic[]): EvidenceObservation[] {
  const sorted = sortFiles(files);
  // A pure mode change carries no content, so it cannot support a statement about a
  // companion file being absent. Classification still labels the file; only the
  // relationship evidence is drawn from files whose content the diff shows.
  const contentBearing = sorted.filter((file) => !file.modeOnly);
  const onSurface = (surface: SurfaceId) =>
    contentBearing.filter((file) => file.surfaces.includes(surface));
  const testFiles = onSurface('tests');
  const runtimeFiles = onSurface('runtime');
  const authFiles = onSurface('auth-access');
  const databaseFiles = onSurface('database-schema');
  const contracts = onSurface('api-contracts');
  const docs = onSurface('documentation');
  const manifests = contentBearing.filter((file) => matchesSurface(file, isDependencyManifest));
  const lockfiles = contentBearing.filter((file) => matchesSurface(file, isLockfile));
  const generated = contentBearing.filter((file) => file.generated);
  // Nullable counts are unknown, not zero, and a diagnostic hunk has already
  // proved its counts unreliable, so a line share computed from either would be a
  // number the diff never showed. File counts stay provable, so those stand alone.
  const countsTrustworthy =
    !diagnostics.some((diagnostic) => countDiagnostics.includes(diagnostic.code)) &&
    contentBearing.every((file) => file.additions !== null && file.deletions !== null);
  const totalChangedLines = contentBearing.reduce(
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
      title: 'Runtime changes without observed test-file content changes',
      message:
        'Runtime files changed, but no test-file content changes were observed in this diff.',
      relatedFiles: names(runtimeFiles),
    });
  }
  if (authFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: 'auth-without-tests',
      title: 'Authentication/access changes without observed test-file content changes',
      message:
        'Authentication or authorization files changed. No test-file content changes were observed in this diff.',
      relatedFiles: names(authFiles),
    });
  }
  if (databaseFiles.length > 0 && testFiles.length === 0) {
    observations.push({
      kind: 'database-without-tests',
      title: 'Database/schema changes without observed test-file content changes',
      message:
        'Database or schema files changed. No test-file content changes were observed in this diff.',
      relatedFiles: names(databaseFiles),
    });
  }
  if (manifests.length > 0 && lockfiles.length === 0) {
    observations.push({
      kind: 'manifest-without-lockfile',
      title: 'Dependency manifest content change without observed lockfile content change',
      message:
        'A dependency manifest content change was observed. No lockfile content change was observed in this diff.',
      relatedFiles: names(manifests),
    });
  }
  if (lockfiles.length > 0 && manifests.length === 0) {
    observations.push({
      kind: 'lockfile-without-manifest',
      title: 'Lockfile content change without observed dependency manifest content change',
      message:
        'A lockfile content change was observed. No dependency manifest content change was observed in this diff.',
      relatedFiles: names(lockfiles),
    });
  }
  if (contracts.length > 0 && docs.length === 0) {
    observations.push({
      kind: 'contract-without-docs',
      title: 'Contract definition content change without observed documentation content change',
      message:
        'An API or contract definition changed. No documentation or changelog content change was observed in this diff.',
      relatedFiles: names(contracts),
    });
  }
  const fileShare = contentBearing.length === 0 ? 0 : generated.length / contentBearing.length;
  const lineShare = totalChangedLines === 0 ? 0 : generatedChangedLines / totalChangedLines;
  const volumeTriggered =
    generated.length >= 2 && (fileShare >= 0.5 || (countsTrustworthy && lineShare >= 0.5));
  if (volumeTriggered) {
    observations.push({
      kind: 'generated-volume',
      title: 'Generated-file volume',
      message: countsTrustworthy
        ? 'Generated-file changes account for a large share of this diff and may obscure the smaller hand-written change set.'
        : 'Generated files account for a large share of this content-bearing change set by file count. Not every file reports line counts, so no share of changed lines is stated.',
      relatedFiles: names(generated),
      metrics: countsTrustworthy
        ? {
            generatedFiles: generated.length,
            changedFiles: contentBearing.length,
            generatedFileShare: fileShare,
            generatedChangedLines,
            totalChangedLines,
            generatedLineShare: lineShare,
          }
        : {
            generatedFiles: generated.length,
            changedFiles: contentBearing.length,
            generatedFileShare: fileShare,
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
    evidence: evidenceFor(files, parsed.diagnostics),
    reviewOrder: makeReviewOrder(files),
  };
}
