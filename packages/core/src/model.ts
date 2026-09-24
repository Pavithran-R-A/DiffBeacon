/**
 * DiffBeacon core design reminder: Swiss field-manual information design; model
 * facts observed in a diff, never judgments about correctness, safety, or mergeability.
 */

export const SCHEMA_VERSION = '1' as const;
export const MAX_DIFF_BYTES = 8 * 1024 * 1024;

export const FILE_STATUSES = ['added', 'modified', 'deleted', 'renamed', 'mode-only'] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

export const SURFACE_IDS = [
  'ci-build',
  'auth-access',
  'database-schema',
  'dependencies',
  'api-contracts',
  'configuration',
  'infrastructure',
  'tests',
  'documentation',
  'generated',
  'runtime',
] as const;
export type SurfaceId = (typeof SURFACE_IDS)[number];

export const ATTENTION_LEVELS = ['FOCUS', 'CHECK', 'NOTE'] as const;
export type AttentionLevel = (typeof ATTENTION_LEVELS)[number];

export interface Hunk {
  header: string;
  additions: number;
  deletions: number;
}

export interface ChangedFile {
  oldPath: string | null;
  newPath: string | null;
  displayPath: string;
  status: FileStatus;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
  modeOnly: boolean;
  oldMode: string | null;
  newMode: string | null;
  similarity: number | null;
  surfaces: SurfaceId[];
  generated: boolean;
}

export interface ParseDiagnostic {
  code: 'malformed-header' | 'unrecognized-file-header';
  message: string;
  line: number;
}

export interface ParsedDiff {
  files: ChangedFile[];
  diagnostics: ParseDiagnostic[];
}

export interface SurfaceObservation {
  surface: SurfaceId;
  title: string;
  description: string;
  level: AttentionLevel;
  fileCount: number;
  additions: number;
  deletions: number;
  files: string[];
}

export const EVIDENCE_KINDS = [
  'runtime-without-tests',
  'auth-without-tests',
  'database-without-tests',
  'manifest-without-lockfile',
  'lockfile-without-manifest',
  'contract-without-docs',
  'generated-volume',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface EvidenceObservation {
  kind: EvidenceKind;
  title: string;
  message: string;
  relatedFiles: string[];
  metrics?: Record<string, number>;
}

export interface ReviewOrderEntry {
  position: number;
  surface: SurfaceId;
  title: string;
  reason: string;
  files: string[];
}

export interface ReportSummary {
  changedFiles: number;
  additions: number;
  deletions: number;
  binaryFiles: number;
  modeOnlyFiles: number;
  generatedFiles: number;
  diagnostics: number;
}

export interface ReviewAttentionMap {
  schemaVersion: typeof SCHEMA_VERSION;
  summary: ReportSummary;
  files: ChangedFile[];
  attention: SurfaceObservation[];
  evidence: EvidenceObservation[];
  reviewOrder: ReviewOrderEntry[];
}
