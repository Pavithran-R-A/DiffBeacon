/** Tracked source paths, manifest policy exclusions applied, in UTF-8 byte order. */
export function trackedSourceFiles(root?: string): string[];

/** Full `SOURCE_MANIFEST.txt` content for `root`, terminated by one newline. */
export function renderSourceManifest(root?: string): string;
