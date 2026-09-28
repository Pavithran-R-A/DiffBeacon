export interface SecretFinding {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly digest: string;
  readonly length: number;
}

export interface ClassifiedFinding extends SecretFinding {
  readonly reason: string;
}

export interface ScannedFile {
  readonly file: string;
  readonly content: string;
}

export interface ClassificationEntry {
  readonly file: string;
  readonly rule: string;
  readonly reason: string;
}

export interface ClassificationReport {
  readonly findings: SecretFinding[];
  readonly classified: ClassifiedFinding[];
  readonly unclassified: SecretFinding[];
  readonly stale: ClassificationEntry[];
}

export interface SecretRule {
  readonly id: string;
  readonly pattern: RegExp;
}

export const SECRET_RULES: SecretRule[];
export const KNOWN_FINDINGS: ClassificationEntry[];

export function scanText(file: string, content: string): SecretFinding[];
export function scanRepositoryFiles(root?: string): ScannedFile[];
export function scanDirectoryFiles(root: string): ScannedFile[];
export function scanDirectory(root: string): SecretFinding[];
export function classifyFiles(files: ScannedFile[]): ClassificationReport;
