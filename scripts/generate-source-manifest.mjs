import { writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { renderSourceManifest, trackedSourceFiles } from './source-manifest.mjs';

const root = process.cwd();
writeFileSync(path.join(root, 'SOURCE_MANIFEST.txt'), renderSourceManifest(root), 'utf8');
console.log(`SOURCE_MANIFEST.txt: ${trackedSourceFiles(root).length} files`);
