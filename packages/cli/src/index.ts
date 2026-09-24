/**
 * DiffBeacon CLI design reminder: dense field-manual output, explicit action
 * verbs, and no claim beyond what the diff exposes. Never interpolate input into a shell.
 */

import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { analyzeDiff, renderJson, renderMarkdown, renderPretty } from '../../core/src/index.js';
import { collectGitDiffAsync, readStdinDiff } from './git.js';
export { validateRange, validateRevision } from './revisions.js';

const packageManifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };
export const VERSION = packageManifest.version;

type Format = 'pretty' | 'json' | 'markdown';

interface Options {
  format: Format;
  range: string | null;
  stdin: boolean;
  output: string | null;
}

function help(): string {
  return `DiffBeacon ${VERSION}

Deterministic attention routing for pull requests.

Usage:
  diffbeacon review <range> [--format pretty|json|markdown] [--output <file>]
  diffbeacon review --stdin [--format pretty|json|markdown] [--output <file>]
  diffbeacon --help
  diffbeacon --version

The analysis reports changed surfaces, observed evidence, and a suggested review order.
It does not determine whether a pull request is safe to merge.
`;
}

function parseArgs(args: string[]): Options {
  if (args[0] !== 'review') throw new Error('Expected the review command. Use --help for usage.');
  let range: string | null = null;
  let stdin = false;
  let format: Format = 'pretty';
  let output: string | null = null;
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--stdin') stdin = true;
    else if (arg === '--format') {
      const candidate = args[index + 1];
      if (candidate !== 'pretty' && candidate !== 'json' && candidate !== 'markdown')
        throw new Error('Format must be pretty, json, or markdown.');
      format = candidate;
      index += 1;
    } else if (arg === '--output') {
      output = args[index + 1] ?? null;
      if (output === null) throw new Error('--output requires a file path.');
      index += 1;
    } else if (arg?.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (range === null) range = arg ?? null;
    else throw new Error('Only one revision range may be supplied.');
  }
  if (stdin && range !== null) throw new Error('Use either a revision range or --stdin, not both.');
  if (!stdin && range === null) throw new Error('A revision range or --stdin is required.');
  return { format, range, stdin, output };
}

export async function execute(args: string[], cwd = process.cwd()): Promise<string> {
  const options = parseArgs(args);
  const diff = options.stdin
    ? await readStdinDiff()
    : await collectGitDiffAsync(options.range ?? '', cwd);
  const report = analyzeDiff(diff);
  const output =
    options.format === 'json'
      ? renderJson(report)
      : options.format === 'markdown'
        ? renderMarkdown(report)
        : renderPretty(report, {
            color: Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined,
          });
  if (options.output !== null) await writeFile(options.output, `${output}\n`, { encoding: 'utf8' });
  return output;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  try {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      process.stdout.write(help());
      return 0;
    }
    if (args[0] === '--version' || args[0] === '-v') {
      process.stdout.write(`${VERSION}\n`);
      return 0;
    }
    process.stdout.write(`${await execute(args)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown operational failure.';
    process.stderr.write(`DiffBeacon error: ${message}\n`);
    return 1;
  }
}

const launchedAsCli =
  /[\\/]\.bin[\\/]/.test(process.argv[1] ?? '') || process.argv[1]?.endsWith('index.js');
if (launchedAsCli && process.env.VITEST !== 'true')
  void main().then((code) => {
    process.exitCode = code;
  });

export { collectGitDiff, collectGitDiffAsync, DiffSizeLimitError } from './git.js';
