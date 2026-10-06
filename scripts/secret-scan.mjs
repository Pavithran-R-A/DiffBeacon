#!/usr/bin/env node
// Deterministic secret scan for source and shipped artifacts.
// Findings are reported as file + rule + line + digest only: a match's value is never
// carried into the report, so running the gate cannot itself leak a credential.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_SCANNABLE_BYTES = 4 * 1024 * 1024;

export const SECRET_RULES = [
  {
    id: 'private-key',
    pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
  },
  {
    id: 'github-fine-grained-token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  },
  {
    id: 'github-token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  },
  {
    id: 'npm-token',
    pattern: /(?:_authToken\s*[:=]\s*\S{8,})|(?:\bnpm_[A-Za-z0-9]{36})/g,
  },
  {
    id: 'aws-access-key-id',
    // No leading word boundary: a key smuggled into a longer identifier still has to be caught.
    pattern: /(?:AKIA|ASIA)[0-9A-Z]{8,}/g,
  },
  {
    id: 'slack-token',
    pattern: /\bxox[baprs]-[0-9A-Za-z-]{8,}/g,
  },
  {
    id: 'credential-url',
    pattern: /\/\/[^\s/:@#"']{1,64}:[^\s@#"']{3,}@[^\s/"'@]{1,128}/g,
  },
  {
    id: 'secret-assignment',
    pattern:
      /\b(?:GITHUB_TOKEN|GH_TOKEN|NPM_TOKEN|API_KEY|ACCESS_TOKEN|CLIENT_SECRET|PRIVATE_TOKEN|PASSWORD|PASSWD|SECRET|TOKEN)\b\s*[:=]\s*["'`][^"'`\n]{8,}["'`]/g,
  },
];

// Bundles that ship but are not tracked in Git; the scan adds them to the tracked set.
const SHIPPED_ARTIFACTS = ['packages/cli/dist/index.js'];

const digestOf = (value) => createHash('sha256').update(value).digest('hex').slice(0, 16);

export function scanText(file, content) {
  const findings = [];
  const lines = content.split('\n');
  for (const rule of SECRET_RULES) {
    for (let index = 0; index < lines.length; index += 1) {
      for (const match of lines[index].matchAll(rule.pattern)) {
        if (match[0] === undefined) continue;
        findings.push({
          file,
          line: index + 1,
          rule: rule.id,
          digest: digestOf(match[0]),
          length: match[0].length,
        });
      }
    }
  }
  return findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.rule.localeCompare(b.rule) ||
      a.digest.localeCompare(b.digest),
  );
}

function readIfScannable(root, rel) {
  const abs = path.join(root, rel);
  try {
    const stat = statSync(abs);
    if (!stat.isFile()) return undefined;
    if (stat.size > MAX_SCANNABLE_BYTES)
      throw new Error(
        `Secret scan refuses ${rel}: ${stat.size} bytes exceeds the ${MAX_SCANNABLE_BYTES}-byte scan bound.`,
      );
    const content = readFileSync(abs, 'utf8');
    if (content.includes('\0')) return undefined;
    return content;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Secret scan refuses ')) throw error;
    return undefined;
  }
}

function gitTracked(root) {
  const listing = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  return listing.split('\0').filter((entry) => entry !== '');
}

function walk(dir, base, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') walk(abs, base, out);
    } else if (entry.isFile()) {
      out.push(path.relative(base, abs).split(path.sep).join('/'));
    }
  }
  return out;
}

export function scanRepositoryFiles(root = process.cwd()) {
  const relPaths = new Set(gitTracked(root));
  for (const artifact of SHIPPED_ARTIFACTS)
    if (statSafe(path.join(root, artifact))) relPaths.add(artifact);
  const files = [];
  for (const rel of [...relPaths].sort()) {
    if (rel.includes('/node_modules/')) continue;
    const content = readIfScannable(root, rel);
    if (content === undefined) continue;
    files.push({ file: rel, content });
  }
  return files;
}

export function scanDirectoryFiles(root) {
  return scanFilesFrom(walk(root, root, []).sort(), root);
}

export function scanDirectory(root) {
  return scanDirectoryFiles(root).flatMap((file) => scanText(file.file, file.content));
}

function scanFilesFrom(relPaths, root) {
  const files = [];
  for (const rel of relPaths) {
    const content = readIfScannable(root, rel);
    if (content === undefined) continue;
    files.push({ file: rel, content });
  }
  return files;
}

function statSafe(abs) {
  try {
    return statSync(abs).isFile();
  } catch {
    return false;
  }
}

// Every credential-shaped string this repository knowingly carries, reviewed in Stage 9. The gate
// is fail-closed: a shaped string with no entry here stops CI, and an entry whose file no longer
// produces that finding is reported as stale so this table cannot rot into decoration.
// Reason text is itself scanned, so entries describe a value instead of quoting it.
export const KNOWN_FINDINGS = [
  {
    file: 'tests/stage6.action-security-boundary.test.ts',
    rule: 'npm-token',
    reason:
      'Test fixture writes a throwaway npmrc holding a literal placeholder phrase into a temporary repository to prove the Action never reads registry credentials.',
  },
  {
    file: 'tests/stage7.browser-security.test.ts',
    rule: 'aws-access-key-id',
    reason:
      'Marker constant built from an example key id that AWS documents as non-functional; the case asserts no request leaves the page while it is analysed.',
  },
  ...[
    'private-key',
    'github-token',
    'github-fine-grained-token',
    'npm-token',
    'aws-access-key-id',
    'slack-token',
    'credential-url',
    'secret-assignment',
  ].map((rule) => ({
    file: 'tests/stage9.secret-scan.test.ts',
    rule,
    reason: `Falsification canary for the ${rule} detector: a synthetic string invented for this test so the rule cannot silently stop matching.`,
  })),
];

const keyOf = (entry) => `${entry.file}\u0000${entry.rule}`;

const existsInRepository = (rel) => statSafe(path.resolve(process.cwd(), rel));

export function classifyFiles(files) {
  const findings = [];
  for (const file of files) findings.push(...scanText(file.file, file.content));
  const classified = [];
  const unclassified = [];
  const stale = [];
  const consumed = new Set();
  for (const finding of findings) {
    // Content that does not come from a file on disk cannot be classified: the review would
    // attach a reason to a path the repository does not have.
    if (!existsInRepository(finding.file)) {
      stale.push({
        file: finding.file,
        rule: finding.rule,
        reason: 'reviewed content has no file at this path, so nothing here can be inspected',
      });
      continue;
    }
    const entry = KNOWN_FINDINGS.find((candidate) => keyOf(candidate) === keyOf(finding));
    if (entry === undefined) unclassified.push(finding);
    else {
      consumed.add(keyOf(entry));
      classified.push({ ...finding, reason: entry.reason });
    }
  }
  for (const entry of KNOWN_FINDINGS) {
    if (!consumed.has(keyOf(entry)) || !existsInRepository(entry.file)) stale.push({ ...entry });
  }
  return { findings, classified, unclassified, stale };
}

function format(finding) {
  return `${finding.file}:${finding.line} ${finding.rule} digest=${finding.digest} length=${finding.length}`;
}

function main() {
  const args = process.argv.slice(2);
  const dirFlag = args.indexOf('--dir');
  if (dirFlag !== -1 && args[dirFlag + 1] !== undefined) {
    const dir = path.resolve(args[dirFlag + 1]);
    const fileCount = scanDirectoryFiles(dir).length;
    const findings = scanDirectory(dir);
    for (const finding of findings) console.log(format(finding));
    console.log(
      `scanned ${fileCount} files in ${path.basename(dir)}: ${findings.length} finding(s)`,
    );
    process.exitCode = findings.length === 0 ? 0 : 1;
    return;
  }
  const report = classifyFiles(scanRepositoryFiles(process.cwd()));
  for (const finding of report.unclassified) console.error(format(finding));
  for (const entry of report.stale)
    console.error(`stale classification: ${entry.file} ${entry.rule}`);
  console.log(
    `secret scan: ${report.findings.length} finding(s), ${report.classified.length} classified, ` +
      `${report.unclassified.length} unclassified, ${report.stale.length} stale`,
  );
  process.exitCode = report.unclassified.length === 0 && report.stale.length === 0 ? 0 : 1;
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
