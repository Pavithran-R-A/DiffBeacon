export interface TrustedNpmInvocation {
  command: string;
  args: string[];
}

export function trustedNpmInvocation(
  args?: string[],
  env?: NodeJS.ProcessEnv,
): TrustedNpmInvocation;
export function runTrustedNpm(args?: string[], options?: Record<string, unknown>): Buffer | string;
