import { execFileSync } from 'node:child_process';
import process from 'node:process';

const trustedShimArgument = /^--[A-Za-z0-9-]+$/;
// Characters cmd.exe expands or re-parses even inside double quotes.
const unsafeShimPathCharacters = /["%&|^<>\r\n]/;
// A review argument may only be a long option or a plain word: no whitespace, no quoting,
// and none of the characters cmd.exe treats as syntax.
const unsafeReviewCharacters = /[\s"'`%&|^<>()!]/;
const optionToken = /^--[A-Za-z][A-Za-z-]*$/;
const wordToken = /^[A-Za-z0-9][A-Za-z0-9._:/\\~-]*$/;

function assertTrustedArguments(args) {
  if (!Array.isArray(args) || args.some((arg) => !trustedShimArgument.test(String(arg))))
    throw new Error('npm bin shim arguments must be internal long-form flags.');
}

function assertTrustedShimPath(binPath) {
  if (typeof binPath !== 'string' || binPath.length === 0)
    throw new TypeError('npm bin shim path must be a non-empty string.');
  if (!binPath.replaceAll('\\', '/').toLowerCase().endsWith('/diffbeacon.cmd'))
    throw new Error('Windows npm bin shim helper requires a .cmd path.');
  if (unsafeShimPathCharacters.test(binPath))
    throw new Error('Windows npm bin shim path contains characters cmd.exe would reinterpret.');
}

function assertTrustedShimInput(binPath, args) {
  assertTrustedShimPath(binPath);
  assertTrustedArguments(args);
}

/**
 * Validate a full `review` argv before it reaches a command interpreter. The command name,
 * exactly one diff source, and shell-inert tokens are all required, because the smoke
 * harness has to run the same contract a user types rather than only its flags.
 */
export function assertReviewArguments(args) {
  if (!Array.isArray(args) || args[0] !== 'review')
    throw new Error('npm bin review arguments must start with the review command.');
  const tokens = args.slice(1);
  if (tokens.some((token) => typeof token !== 'string' || unsafeReviewCharacters.test(token)))
    throw new Error(
      `npm bin review arguments must be shell-inert words: ${tokens
        .filter((token) => unsafeReviewCharacters.test(String(token)))
        .join(', ')}`,
    );
  if (tokens.some((token) => !optionToken.test(token) && !wordToken.test(token)))
    throw new Error(
      `npm bin review arguments must be shell-inert words: ${tokens
        .filter((token) => !optionToken.test(token) && !wordToken.test(token))
        .join(', ')}`,
    );
  // Only words that are nobody's option value count as a diff source: `json` after
  // --format is a value, while `HEAD~1...HEAD` and `--stdin` each name one source.
  const valueTakingOptions = new Set(['--format', '--output']);
  let sources = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (valueTakingOptions.has(token)) {
      const value = tokens[index + 1];
      if (value === undefined || value.startsWith('--'))
        throw new Error(`npm bin review option ${token} needs a value.`);
      index += 1;
      continue;
    }
    if (token === '--stdin' || !token.startsWith('--')) sources += 1;
  }
  if (sources !== 1)
    throw new Error(
      'npm bin review arguments need exactly one diff source: --stdin or a revision range.',
    );
  return args;
}

const quoteCmdToken = (value) => `"${value}"`;

/**
 * Build the cmd.exe invocation for an npm-generated `.cmd` shim.
 *
 * Node escapes embedded quotes in an argv array as `\"`, which cmd.exe does not
 * unescape, so a pre-quoted command line passed as an ordinary argument fails
 * with `'"..."' is not recognized`. The command line is therefore assembled with
 * cmd.exe's own rules and handed over verbatim inside the outer quote pair that
 * `cmd /d /s /c` preserves.
 */
function cmdInvocation(comSpec, binPath, args) {
  if (typeof comSpec !== 'string' || comSpec.length === 0)
    throw new Error('Windows command interpreter path is unavailable.');
  const commandLine = `"${[binPath, ...args].map(quoteCmdToken).join(' ')}"`;
  return {
    file: comSpec,
    args: ['/d', '/s', '/c', commandLine],
    windowsVerbatimArguments: true,
  };
}

export function windowsCmdInvocation(comSpec, binPath, args = []) {
  assertTrustedShimInput(binPath, args);
  return cmdInvocation(comSpec, binPath, args);
}

/** The same cmd.exe invocation, but for a full review command line. */
export function windowsReviewInvocation(comSpec, binPath, args) {
  assertReviewArguments(args);
  assertTrustedShimPath(binPath);
  return cmdInvocation(comSpec, binPath, args);
}

export function npmBinShimInvocation(binPath, args = [], env = process.env) {
  assertTrustedArguments(args);
  if (process.platform !== 'win32') {
    if (!binPath.replaceAll('\\', '/').toLowerCase().endsWith('/diffbeacon'))
      throw new Error('Unix npm bin shim helper received an unexpected executable.');
    return { file: binPath, args };
  }
  return windowsCmdInvocation(env.ComSpec ?? env.COMSPEC, binPath, args);
}

/** Platform-aware invocation for a review command line through the installed bin. */
export function npmReviewInvocation(binPath, args, env = process.env) {
  assertReviewArguments(args);
  if (process.platform !== 'win32') {
    if (!binPath.replaceAll('\\', '/').toLowerCase().endsWith('/diffbeacon'))
      throw new Error('Unix npm bin shim helper received an unexpected executable.');
    return { file: binPath, args };
  }
  return windowsReviewInvocation(env.ComSpec ?? env.COMSPEC, binPath, args);
}

export function runNpmBinShim(binPath, args = [], options = {}) {
  const {
    file,
    args: invocationArgs,
    ...invocationOptions
  } = npmBinShimInvocation(binPath, args, options.env ?? process.env);
  return execFileSync(file, invocationArgs, {
    shell: false,
    windowsHide: true,
    ...options,
    ...invocationOptions,
  });
}
