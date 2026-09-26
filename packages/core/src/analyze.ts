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

// The one authority for review ordering. `order` is a reading sequence a reviewer can
// check against the rationale, `level` is a navigation band, and the two can never
// disagree because they are the same entry. Nothing here is derived from file counts,
// changed-line magnitude, detector registration order, or any measurement of
// importance: the bands label where to start reading, not how dangerous a change is.
const reviewPolicy: Record<
  SurfaceId,
  { order: number; level: AttentionLevel; label: string; rationale: string }
> = {
  'ci-build': {
    order: 1,
    level: 'FOCUS',
    label: 'CI/build',
    rationale:
      'Pipeline and build definitions are read first because they show how the rest of the change is compiled, tested and published.',
  },
  'auth-access': {
    order: 2,
    level: 'FOCUS',
    label: 'authentication/access',
    rationale:
      'Access-control conventions follow the build frame and precede the code that relies on them, so the authorization boundary is established first.',
  },
  'database-schema': {
    order: 3,
    level: 'FOCUS',
    label: 'database/schema',
    rationale:
      'Schema and migration files define the shape of persisted data that later surfaces read and write.',
  },
  infrastructure: {
    order: 4,
    level: 'FOCUS',
    label: 'infrastructure/deployment',
    rationale:
      'Container and deployment definitions describe the environment the change runs in, completing the context before implementation.',
  },
  'api-contracts': {
    order: 5,
    level: 'CHECK',
    label: 'API/contract',
    rationale:
      'Explicit contract files state what consumers see, so they are read before the implementation that satisfies them.',
  },
  runtime: {
    order: 6,
    level: 'CHECK',
    label: 'runtime implementation',
    rationale:
      'Implementation files carry the executable behavior of the change and are read after the context-setting surfaces above.',
  },
  dependencies: {
    order: 7,
    level: 'CHECK',
    label: 'dependency',
    rationale:
      'Manifests and lockfiles name the third-party inputs that the implementation above resolves against.',
  },
  configuration: {
    order: 8,
    level: 'CHECK',
    label: 'configuration',
    rationale:
      'These files shape how the application and tooling apply the behavior listed above them.',
  },
  tests: {
    order: 9,
    level: 'NOTE',
    label: 'test',
    rationale:
      'Test files show what this diff verifies directly, which reads most usefully after the implementation context.',
  },
  documentation: {
    order: 10,
    level: 'NOTE',
    label: 'documentation',
    rationale:
      'Prose files such as guides and changelogs explain the change after the code they describe.',
  },
  generated: {
    order: 11,
    level: 'NOTE',
    label: 'generated',
    rationale:
      'Generated output is usually a consequence of the source above it, so it is read last.',
  },
};

// Sorting on the written-out `order` rather than on key insertion order keeps this
// sequence independent of how the table happens to be laid out.
const reviewPriority: SurfaceId[] = (Object.keys(reviewPolicy) as SurfaceId[]).sort(
  (left, right) => reviewPolicy[left].order - reviewPolicy[right].order,
);

const attentionDescriptions: Record<SurfaceId, { title: string; description: string }> =
  Object.fromEntries(
    detectors.map((detector) => [
      detector.id,
      { title: detector.title, description: detector.description },
    ]),
  ) as Record<SurfaceId, { title: string; description: string }>;

function levelFor(surface: SurfaceId): AttentionLevel {
  return reviewPolicy[surface].level;
}

function reasonFor(surface: SurfaceId, fileCount: number): string {
  const policy = reviewPolicy[surface];
  return `${fileCount} ${policy.label} ${fileCount === 1 ? 'file' : 'files'} changed in this diff. ${policy.rationale}`;
}

export function compareCanonicalText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareNullableText(left: string | null, right: string | null): number {
  if (left === null) return right === null ? 0 : -1;
  if (right === null) return 1;
  return compareCanonicalText(left, right);
}

function compareNullableCount(left: number | null, right: number | null): number {
  if (left === null) return right === null ? 0 : -1;
  if (right === null) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareFlag(left: boolean, right: boolean): number {
  if (left === right) return 0;
  return left ? 1 : -1;
}

/** Every fact a `ChangedFile` reports, in comparison order. */
const fileComparators: ((left: ChangedFile, right: ChangedFile) => number)[] = [
  (left, right) => compareCanonicalText(left.displayPath, right.displayPath),
  (left, right) => compareCanonicalText(left.status, right.status),
  (left, right) => compareNullableCount(left.additions, right.additions),
  (left, right) => compareNullableCount(left.deletions, right.deletions),
  (left, right) => compareFlag(left.binary, right.binary),
  (left, right) => compareFlag(left.modeOnly, right.modeOnly),
  (left, right) => compareNullableText(left.oldPath, right.oldPath),
  (left, right) => compareNullableText(left.newPath, right.newPath),
  (left, right) => compareNullableText(left.oldMode, right.oldMode),
  (left, right) => compareNullableText(left.newMode, right.newMode),
  (left, right) => compareNullableCount(left.similarity, right.similarity),
  // Surface ids use only [a-z-], so a comma-joined key cannot conflate two lists.
  (left, right) => compareCanonicalText(left.surfaces.join(','), right.surfaces.join(',')),
  (left, right) => compareFlag(left.generated, right.generated),
];

/**
 * A total order over every fact a file reports: two entries can only compare equal
 * when their serialized objects are identical, so no reported list can depend on
 * the order the diff happened to state them in.
 */
function compareFileFacts(left: ChangedFile, right: ChangedFile): number {
  for (const compare of fileComparators) {
    const result = compare(left, right);
    if (result !== 0) return result;
  }
  return 0;
}

function sortFiles(files: ChangedFile[]): ChangedFile[] {
  return [...files].sort(compareFileFacts);
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
      reason: reasonFor(surface, matching.length),
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
