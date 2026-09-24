import { execFileSync } from 'node:child_process';
import process from 'node:process';

/**
 * Return the trusted npm JavaScript CLI invocation used by npm-run scripts.
 * Running `process.execPath npm_execpath ...` avoids executing npm.cmd directly
 * on Windows and never requires shell interpolation.
 */
export function trustedNpmInvocation(args = [], env = process.env) {
  const npmExecPath = env.npm_execpath;
  if (!npmExecPath) {
    throw new Error('Cannot resolve npm JavaScript CLI: npm_execpath is not set.');
  }
  return { command: process.execPath, args: [npmExecPath, ...args] };
}

export function runTrustedNpm(args = [], options = {}) {
  const invocation = trustedNpmInvocation(args, options.env ?? process.env);
  return execFileSync(invocation.command, invocation.args, {
    shell: false,
    windowsHide: true,
    ...options,
  });
}
