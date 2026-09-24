export interface NpmBinShimInvocation {
  file: string;
  args: string[];
}

export function windowsCmdInvocation(
  comSpec: string | undefined,
  binPath: string,
  args?: string[],
): NpmBinShimInvocation;
export function npmBinShimInvocation(
  binPath: string,
  args?: string[],
  env?: NodeJS.ProcessEnv,
): NpmBinShimInvocation;
export function runNpmBinShim(
  binPath: string,
  args?: string[],
  options?: Record<string, unknown>,
): Buffer | string;
