/**
 * DiffBeacon CLI design reminder: dense field-manual output, explicit action
 * verbs, and no claim beyond what the diff exposes. Never interpolate input into a shell.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { analyzeDiff, renderJson, renderMarkdown, renderPretty } from '../../core/src/index.js';
import {
  DiffUnavailableError,
  EXIT_CODES,
  OutputWriteError,
  UsageError,
  boundedSingleLine,
  echo,
} from './errors.js';
import { collectGitDiffAsync, readStdinDiff } from './git.js';
import { validateRange } from './revisions.js';
export { validateRange, validateRevision } from './revisions.js';

const packageManifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };
export const VERSION = packageManifest.version;

const FORMATS = ['pretty', 'json', 'markdown'] as const;
type Format = (typeof FORMATS)[number];

type Source = { kind: 'git'; range: string } | { kind: 'stdin' };

interface Options {
  format: Format;
  output: string | null;
  source: Source;
}

type Command = { kind: 'help' } | { kind: 'version' } | { kind: 'review'; options: Options };

/** Option names that consume a following value; a value may never be one of these. */
const OPTION_WORDS = new Set([
  '--stdin',
  '--format',
  '--output',
  '--help',
  '--version',
  '-h',
  '-v',
]);

function help(): string {
  return `DiffBeacon ${VERSION}

Deterministic attention routing for pull requests.

Usage:
  diffbeacon review <rev>...<rev> [--format pretty|json|markdown] [--output <file>]
  diffbeacon review <rev>..<rev> [--format pretty|json|markdown] [--output <file>]
  diffbeacon review --stdin [--format pretty|json|markdown] [--output <file>]
  diffbeacon --help        diffbeacon -h
  diffbeacon --version     diffbeacon -v

Arguments:
  <rev>...<rev>            Three-dot range: changes on the head side since the merge base.
  <rev>..<rev>             Two-dot range: changes between two commits.
  A single revision is rejected. DiffBeacon analyses one comparison between two
  endpoints and never compares a revision against the working tree.

Options:
  --stdin                  Read the unified diff from standard input instead of Git.
  --format <name>          pretty (default), json, or markdown. The value is a separate
                           argument; --format=json is not accepted.
  --output <file>          Write the report to <file> instead of stdout.
  --                       End of options: later words are read as revisions only.
  -h, --help               Show this help.
  -v, --version            Print the version.

Each selector may appear at most once; --stdin, a revision range, --format and
--output are not repeated. Diff input is capped at 8 MiB (8388608 bytes).

Colour: pretty output is coloured only on an interactive terminal. Set NO_COLOR
to disable it.

Exit codes:
  Exit 0   A report was produced. Observed attention levels never change this.
  Exit 1   Unexpected internal failure.
  Exit 2   Usage error: unknown command or option, bad range syntax, repeated selector.
  Exit 3   No diff available: not a Git repository, unresolvable revision, shallow or
           partial history, a failing git process, or a diff over the size limit.
  Exit 4   The --output file could not be written.

The analysis reports changed surfaces, observed evidence, and a suggested review order.
It does not determine whether a pull request is safe to merge.
`;
}

function missingValue(option: string): UsageError {
  return new UsageError(
    `${option} requires a value, and none was supplied. Run diffbeacon --help for the accepted forms.`,
  );
}

function repeated(option: string): UsageError {
  return new UsageError(
    `Option ${option} was supplied more than once. Each option is given at most once; the last value does not silently win.`,
  );
}

function unknownOption(word: string): UsageError {
  return new UsageError(
    `Unknown option: ${echo(word)}. Run diffbeacon --help for the accepted forms.`,
  );
}

function parseArgs(args: string[]): Command {
  const first = args[0];
  if (first === undefined) return { kind: 'help' };
  if (first === '--help' || first === '-h') return { kind: 'help' };
  if (first === '--version' || first === '-v') return { kind: 'version' };
  if (first !== 'review')
    throw new UsageError(
      `Unknown command: ${echo(first)}. The only command is review. Run diffbeacon --help for usage.`,
    );

  let format: Format = 'pretty';
  let formatSeen = false;
  let output: string | null = null;
  let range: string | null = null;
  let stdin = false;
  let endOfOptions = false;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (endOfOptions) {
      if (range !== null)
        throw new UsageError(
          `Only one revision range may be supplied: got ${echo(range)} and ${echo(arg)}.`,
        );
      range = arg;
      continue;
    }
    if (arg === '--') {
      endOfOptions = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') return { kind: 'help' };
    if (arg === '--version' || arg === '-v') return { kind: 'version' };
    if (arg.startsWith('--') && arg.includes('=')) {
      const name = arg.slice(0, arg.indexOf('='));
      const value = arg.slice(arg.indexOf('=') + 1);
      if (name === '--format' || name === '--output')
        throw new UsageError(
          `Unsupported option form: ${echo(arg)}. Pass the value as a separate argument, for example ${name} ${boundedSingleLine(value, 40) || '<value>'}.`,
        );
      throw unknownOption(arg);
    }
    if (arg === '--stdin') {
      if (stdin) throw repeated(arg);
      stdin = true;
      continue;
    }
    if (arg === '--format') {
      if (formatSeen) throw repeated(arg);
      const value = args[index + 1];
      if (value === undefined || OPTION_WORDS.has(value)) throw missingValue(arg);
      if (!(FORMATS as readonly string[]).includes(value))
        throw new UsageError(
          `Invalid --format value: ${echo(value)}. Choose pretty, json, or markdown.`,
        );
      format = value as Format;
      formatSeen = true;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      if (output !== null) throw repeated(arg);
      const value = args[index + 1];
      if (value === undefined || OPTION_WORDS.has(value)) throw missingValue(arg);
      output = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('-')) throw unknownOption(arg);
    if (range !== null)
      throw new UsageError(
        `Only one revision range may be supplied: got ${echo(range)} and ${echo(arg)}.`,
      );
    range = arg;
  }

  if (stdin && range !== null)
    throw new UsageError(
      `Use either a revision range or --stdin, not both: got ${echo(range)} and --stdin.`,
    );
  if (!stdin && range === null)
    throw new UsageError(
      'A revision range or --stdin is required, and none was supplied. Run diffbeacon --help for usage.',
    );
  if (stdin) return { kind: 'review', options: { format, output, source: { kind: 'stdin' } } };
  const safeRange = validateRange(range ?? '');
  return { kind: 'review', options: { format, output, source: { kind: 'git', range: safeRange } } };
}

async function analyse(options: Options, cwd: string): Promise<void> {
  const diff =
    options.source.kind === 'stdin'
      ? await readStdinDiff()
      : await collectGitDiffAsync(options.source.range, cwd);
  const report = analyzeDiff(diff);
  const terminal = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
  const rendered =
    options.format === 'json'
      ? renderJson(report)
      : options.format === 'markdown'
        ? renderMarkdown(report)
        : // Colour is a property of the terminal, so a report file is always plain text.
          renderPretty(report, { color: terminal && options.output === null });
  const text = `${rendered}\n`;
  if (options.output === null) {
    process.stdout.write(text);
    return;
  }
  const target = options.output;
  try {
    await writeFile(target, text, { encoding: 'utf8' });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown cause';
    throw new OutputWriteError(
      `Could not write the report to ${echo(target)}: ${boundedSingleLine(reason)}`,
    );
  }
}

function reportFailure(error: unknown): number {
  const message = error instanceof Error ? error.message : 'unknown failure';
  if (error instanceof UsageError) {
    process.stderr.write(`DiffBeacon: ${message}\n`);
    return EXIT_CODES.usage;
  }
  if (error instanceof OutputWriteError) {
    process.stderr.write(`DiffBeacon: ${message}\n`);
    return EXIT_CODES.outputUnwritable;
  }
  if (error instanceof DiffUnavailableError) {
    process.stderr.write(`DiffBeacon: ${message}\n`);
    return EXIT_CODES.diffUnavailable;
  }
  process.stderr.write(`DiffBeacon: unexpected internal failure: ${boundedSingleLine(message)}\n`);
  return EXIT_CODES.unexpected;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  let command: Command;
  try {
    command = parseArgs(args);
  } catch (error) {
    return reportFailure(error);
  }
  if (command.kind === 'help') {
    process.stdout.write(help());
    return EXIT_CODES.ok;
  }
  if (command.kind === 'version') {
    process.stdout.write(`${VERSION}\n`);
    return EXIT_CODES.ok;
  }
  try {
    await analyse(command.options, process.cwd());
    return EXIT_CODES.ok;
  } catch (error) {
    return reportFailure(error);
  }
}

/**
 * True only when Node was pointed at this very file. A basename check would also fire
 * for any unrelated script named `index.js` that imports DiffBeacon as a library, which
 * would print a report into that program's stdout and set its exit code.
 */
function launchedAsCli(): boolean {
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  try {
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (launchedAsCli())
  void main().then((code) => {
    process.exitCode = code;
  });

export { collectGitDiff, collectGitDiffAsync, DiffSizeLimitError, readStdinDiff } from './git.js';
