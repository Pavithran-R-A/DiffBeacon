import { execFileSync } from 'node:child_process';
import process from 'node:process';

const trustedShimArgument = /^--[A-Za-z0-9-]+$/;
// Characters cmd.exe expands or re-parses even inside double quotes.
const unsafeShimPathCharacters = /["%&|^<>\r\n]/;

function assertTrustedArguments(args) {
  if (!Array.isArray(args) || args.some((arg) => !trustedShimArgument.test(String(arg))))
    throw new Error('npm bin shim arguments must be internal long-form flags.');
}

function assertTrustedShimInput(binPath, args) {
  if (typeof binPath !== 'string' || binPath.length === 0)
    throw new TypeError('npm bin shim path must be a non-empty string.');
  if (!binPath.replaceAll('\\', '/').toLowerCase().endsWith('/diffbeacon.cmd'))
    throw new Error('Windows npm bin shim helper requires a .cmd path.');
  if (unsafeShimPathCharacters.test(binPath))
    throw new Error('Windows npm bin shim path contains characters cmd.exe would reinterpret.');
  assertTrustedArguments(args);
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
export function windowsCmdInvocation(comSpec, binPath, args = []) {
  assertTrustedShimInput(binPath, args);
  if (typeof comSpec !== 'string' || comSpec.length === 0)
    throw new Error('Windows command interpreter path is unavailable.');
  const commandLine = `"${[binPath, ...args].map(quoteCmdToken).join(' ')}"`;
  return {
    file: comSpec,
    args: ['/d', '/s', '/c', commandLine],
    windowsVerbatimArguments: true,
  };
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
