import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Decide whether this module is the process entrypoint, so the Action bundle runs
 * when a runner executes it directly but stays inert when imported for tests.
 *
 * A raw `import.meta.url === \`file://${process.argv[1]}\`` comparison is never true
 * on Windows: argv carries a backslashed path with literal spaces and an optional
 * lower-case drive letter, while `import.meta.url` is a percent-encoded
 * `file:///C:/...` URL. Both sides are converted to file URLs here, and the result
 * is compared case-insensitively on Windows because the filesystem ignores case
 * there, so a differently cased checkout path still launches the Action.
 */
export function isEntrypointUrl(
  moduleUrl: string,
  argvPath: string | undefined,
  cwd: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (!argvPath) return false;
  const argvUrl = pathToFileURL(resolve(cwd, argvPath)).href;
  return platform === 'win32'
    ? moduleUrl.toLowerCase() === argvUrl.toLowerCase()
    : moduleUrl === argvUrl;
}
