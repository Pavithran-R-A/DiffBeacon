import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const excludedDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.manus',
  '.manus-logs',
]);
const excludedFiles = new Set([
  'SOURCE_MANIFEST.txt',
  'diffbeacon-stage3a-fixed.zip',
  'diffbeacon-stage3b-release-candidate.zip',
  'diffbeacon-stage3c-pre-ci.zip',
  'diffbeacon-stage4-github-ci.zip',
  'diffbeacon-final-github-ci.zip',
  'diffbeacon-final-github-ci-v2.zip',
  '.project-config.json',
]);

function collect(directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    const absolute = path.join(directory, name);
    const relative = path.relative(root, absolute).replaceAll(path.sep, '/');
    if (excludedDirectories.has(name) && statSync(absolute).isDirectory()) continue;
    if (excludedFiles.has(relative)) continue;
    if (statSync(absolute).isDirectory()) entries.push(...collect(absolute));
    else entries.push(relative);
  }
  return entries;
}

const files = collect(root).sort();
const lines = [
  '# DiffBeacon Stage 5 source manifest',
  '# Generated from the source tree; build output, dependencies, Git metadata, sandbox internals, and managed logs are excluded.',
  ...files.map((file) => {
    const hash = createHash('sha256')
      .update(readFileSync(path.join(root, file)))
      .digest('hex');
    return `${hash}  ${file}`;
  }),
  '',
];
writeFileSync(path.join(root, 'SOURCE_MANIFEST.txt'), lines.join('\n'), 'utf8');
console.log(`SOURCE_MANIFEST.txt: ${files.length} files`);
