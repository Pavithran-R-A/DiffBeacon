import { execFileSync } from 'node:child_process';
import process from 'node:process';

const trustedShimArgument = /^--[A-Za-z0-9-]+$/;

function assertTrustedShimInput(binPath, args) {
  if (typeof binPath !== 'string' || binPath.length === 0)
    throw new TypeError('npm bin shim path must be a non-empty string.');
  const normalizedPath = binPath.replaceAll('\\', '/').toLowerCase();
  if (!normalizedPath.endsWith('/diffbeacon.cmd'))
    throw new Error('Windows npm bin shim helper requires a .cmd path.');
  if (!Array.isArray(args) || args.some((arg) => !trustedShimArgument.test(arg)))
    throw new Error('npm bin shim arguments must be internal long-form flags.');
}

function quoteCmdArgument(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function windowsCmdInvocation(comSpec, binPath, args = []) {
  assertTrustedShimInput(binPath, args);
  if (typeof comSpec !== 'string' || comSpec.length === 0)
    throw new Error('Windows command interpreter path is unavailable.');
  const commandLine = [quoteCmdArgument(binPath), ...args.map(quoteCmdArgument)].join(' ');
  return { file: comSpec, args: ['/d', '/s', '/c', commandLine] };
}

export function npmBinShimInvocation(binPath, args = [], env = process.env) {
  if (process.platform !== 'win32') {
    const normalizedPath = binPath.replaceAll('\\', '/').toLowerCase();
    if (!normalizedPath.endsWith('/diffbeacon'))
      throw new Error('Unix npm bin shim helper received an unexpected executable.');
    if (!Array.isArray(args) || args.some((arg) => !trustedShimArgument.test(arg)))
      throw new Error('npm bin shim arguments must be internal long-form flags.');
    return { file: binPath, args };
  }
  const comSpec = env.ComSpec ?? env.COMSPEC;
  return windowsCmdInvocation(comSpec, binPath, args);
}

export function runNpmBinShim(binPath, args = [], options = {}) {
  const invocation = npmBinShimInvocation(binPath, args, options.env ?? process.env);
  return execFileSync(invocation.file, invocation.args, {
    shell: false,
    windowsHide: true,
    ...options,
  });
}
