import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SURFACE_IDS, analyzeDiff, renderPretty } from '../packages/core/src/index.js';
import { detectors } from '../packages/core/src/detectors/registry.js';

// Stage 10, PHASES 14 and 17: documentation is a shipped surface, so its contract is enforced by
// a test rather than by a review pass. These cases bind the current-facing prose to the
// implementation it describes — the README's measured example, the detector list, the status
// claims, and the index that separates current documentation from historical evidence. They scan
// only the current set: `docs/audits/`, `docs/recovery/`, and `docs/research/` are records of
// what was true at a commit, and a staleness scan there would fail on purpose-preserved prose.

const repository = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (file: string) =>
  readFileSync(path.join(repository, file), 'utf8').replaceAll('\r\n', '\n');
const lf = (value: string) => value.replaceAll('\r\n', '\n');

const CURRENT_DOCS = [
  'README.md',
  'CHANGELOG.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'AGENTS.md',
  'docs/README.md',
  'docs/limitations.md',
  'docs/releasing.md',
  'docs/architecture/overview.md',
  'docs/architecture/security.md',
  'docs/detectors/initial-detectors.md',
  'docs/detectors/authoring-detectors.md',
];

const HISTORICAL_DIRECTORIES = ['docs/audits', 'docs/recovery', 'docs/research'];

/** Whitespace-flattened document text, so a wrapped sentence matches as one sentence. */
const flatRead = (file: string) => read(file).replaceAll(/\s+/g, ' ');

/**
 * Wording that makes an all-history claim about GitHub-hosted runners for this repository. The
 * bootstrap-era workflows (`docs/audits/stage1-rebaseline.md`, `docs/recovery/README.md`) did
 * receive hosted runners and execute steps, so each of these is false, not merely imprecise.
 * Kept as patterns rather than quoted prose: a verbatim copy of the claim would put it back into a
 * tracked file. A negative scoped to the current workflow is true and is not matched here.
 */
const HOSTED_HISTORY_ABSOLUTES: RegExp[] = [
  /no github-hosted job for this repository has ever been allocated/i,
  /no hosted job for this repository has ever been allocated/i,
  /github-hosted runner images[^.]{0,60}(?:have|has) never been allocated a job for this repository/i,
  /this repository's account has never been allocated/i,
  /github-hosted runners have (?:still )?never been allocated a step of this repository/i,
];

/** The bootstrap half of the distinction: hosted runners did execute this repository's steps. */
const BOOTSTRAP_HOSTED_EXECUTION =
  /bootstrap-era.{0,120}hosted runners.{0,120}(execut|receiv|ran)/i;

/** The current half: the recovered-source CI workflow has not itself been allocated hosted runners. */
const CURRENT_HOSTED_UNQUALIFIED =
  /(?:current|recovered-source)[^.]{0,80}(?:has not|has never)[^.]{0,80}hosted/i;

/** The unqualified-image claim a release decision depends on, stated for the current CI. */
const CURRENT_IMAGES_UNQUALIFIED = /github-hosted runner images[^.]{0,140}unqualified/i;

/** Markdown link targets outside fenced code blocks and inline code; external/in-page dropped. */
function relativeLinkTargets(markdown: string): string[] {
  const targets: string[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const match of line
      .replaceAll(/(`+)(?:.+?)\1/g, '')
      .matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1] ?? '';
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const file = target.split('#')[0] ?? '';
      if (file.length > 0) targets.push(file);
    }
  }
  return targets;
}

/** The body of the first fenced block whose info string matches, or `null`. */
function fencedBlock(markdown: string, language: string): string | null {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === `\`\`\`${language}`);
  if (start === -1) return null;
  const end = lines.findIndex((line, index) => index > start && line.trim() === '```');
  if (end === -1) return null;
  return `${lines.slice(start + 1, end).join('\n')}\n`;
}

describe('the README example is a measurement, not an illustration', () => {
  const samplePath = 'docs/examples/attention-map-sample.diff';

  it('quotes the shipped renderer byte for byte', () => {
    const measured = renderPretty(analyzeDiff(read(samplePath)), { color: false });
    const quoted = fencedBlock(read('README.md'), 'text');
    expect(quoted).not.toBeNull();
    expect(quoted).toBe(lf(`${measured}\n`));
  });

  it('uses an input the parser reports no diagnostic for', () => {
    expect(analyzeDiff(read(samplePath)).summary.diagnostics).toBe(0);
  });

  it('keeps that input tracked in the manifest source set', () => {
    expect(read('SOURCE_MANIFEST.txt')).toContain(samplePath);
  });
});

/** The prose list of surface titles the README opens "What it does" with. */
function readmeSurfaceList(): string[] {
  const sentence = read('README.md')
    .replaceAll(/\s+/g, ' ')
    .match(/path detectors name the changed surfaces: (.+?) \(/);
  expect(sentence, 'README no longer states its detector list in prose').not.toBeNull();
  return (sentence?.[1] ?? '')
    .split(/,\s*(?:and\s+)?/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

describe('the detector documentation names exactly the shipped surfaces', () => {
  const detectorDoc = read('docs/detectors/initial-detectors.md');

  it('gives each ID a section, in registry order', () => {
    const headings = [...detectorDoc.matchAll(/^## `([^`]+)`$/gm)].map((match) => match[1]);
    expect(headings).toEqual([...SURFACE_IDS]);
  });

  it('states each registry title in the README list, in registry order', () => {
    expect(readmeSurfaceList()).toEqual(detectors.map((detector) => detector.title));
  });

  it('keeps the README list the same length as the registry it quotes', () => {
    expect(readmeSurfaceList().length).toBe(detectors.length);
    expect(detectors.length).toBe(SURFACE_IDS.length);
  });
});

describe('current-facing prose does not carry stale project status', () => {
  it.each(CURRENT_DOCS)('%s makes no unfulfilled publication or availability claim', (file) => {
    const text = read(file);
    expect(text).not.toMatch(/npm install --save diffbeacon/);
    expect(text).not.toMatch(/is now published|has been published|are now published/);
    expect(text).not.toMatch(/(?<!\bnot )\bpublished to the (?:npm )?registry/);
    expect(text).not.toMatch(/TODO|FIXME|XXX\b/);
  });

  it('keeps every changelog section a candidate rather than a shipped release', () => {
    const headings = [...read('CHANGELOG.md').matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) expect(heading).toMatch(/Unreleased/);
  });

  it('keeps the status block dated, dated-true, and pointed at the release runbook', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/not published/);
    expect(readme).toMatch(/36562157439/);
    expect(readme).toContain('docs/releasing.md');
  });

  it('states the measured registry count in the detector intro', () => {
    expect(read('docs/detectors/initial-detectors.md')).toMatch(
      /checked against both by[\s\n]*`tests\/stage10\.docs-contract\.test\.ts`/,
    );
  });
});

// Stage 10 closure: the repository's hosted history spans two eras, and current-facing prose used to
// collapse them into one all-history negative. Three bootstrap-era runs (Actions 32859849733,
// 31819615124 and 31818807881) were allocated hosted runners and executed setup and checkout steps
// before failing on archive extraction, while the recovered-source `ci.yml` that release
// qualification depends on has never been allocated one. Both facts are true; the contract below
// requires the second without licensing the first, and does not ask every document to retell the story.

describe('GitHub-hosted history is stated per era, not denied outright', () => {
  it.each(CURRENT_DOCS)('%s makes no all-history claim about hosted runners', (file) => {
    const text = flatRead(file);
    for (const absolute of HOSTED_HISTORY_ABSOLUTES) {
      expect(text, `${file} keeps an all-history hosted negative (${absolute.source})`).not.toMatch(
        absolute,
      );
    }
  });

  it('has a current document that separates the bootstrap era from current qualification', () => {
    const separated = CURRENT_DOCS.filter((file) => {
      const text = flatRead(file);
      return BOOTSTRAP_HOSTED_EXECUTION.test(text) && CURRENT_HOSTED_UNQUALIFIED.test(text);
    });
    expect(
      separated.length,
      'no current document distinguishes the two hosted eras',
    ).toBeGreaterThan(0);
  });

  it('keeps the README and limitations stating the current hosted images unqualified', () => {
    for (const file of ['README.md', 'docs/limitations.md']) {
      expect(
        flatRead(file),
        `${file} no longer states the current GitHub-hosted images unqualified`,
      ).toMatch(CURRENT_IMAGES_UNQUALIFIED);
    }
  });
});

describe('historical evidence stays separated from current documentation', () => {
  it('keeps every record outside the current-document scan set', () => {
    for (const directory of HISTORICAL_DIRECTORIES) {
      for (const file of CURRENT_DOCS) expect(file.startsWith(`${directory}/`)).toBe(false);
    }
  });

  it('leaves no working note at the repository root', () => {
    const rootMarkdown = readdirSync(repository)
      .filter((entry) => entry.endsWith('.md'))
      .sort();
    expect(rootMarkdown).toEqual([
      'AGENTS.md',
      'CHANGELOG.md',
      'CODE_OF_CONDUCT.md',
      'CONTRIBUTING.md',
      'README.md',
      'SECURITY.md',
    ]);
  });

  it('banners each relocated record', () => {
    for (const file of [
      'docs/audits/legacy/audit-handoff-v0.1-mvp.md',
      'docs/audits/legacy/audit-handoff-stage3a.md',
      'docs/audits/legacy/execution-checklists.md',
      'docs/audits/legacy/export-verification-stage4.md',
      'docs/recovery/stage0-source-recovery.md',
      'docs/research/design-brainstorm.md',
    ])
      expect(read(file)).toMatch(/not current project status|not product documentation|HISTORICAL/);
  });

  it('classifies every file under docs/ in the index', () => {
    const index = read('docs/README.md');
    const markdownFiles = (directory: string): string[] => {
      const absolute = path.join(repository, directory);
      if (!existsSync(absolute)) return [];
      return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
        const relative = path.posix.join(directory, entry.name);
        if (entry.isDirectory()) return markdownFiles(relative);
        return entry.name.endsWith('.md') ? [relative] : [];
      });
    };
    for (const file of markdownFiles('docs')) {
      const basename = path.posix.basename(file);
      const listed =
        index.includes(basename) || HISTORICAL_DIRECTORIES.some((d) => file.startsWith(`${d}/`));
      expect(listed, `${file} is unlisted in docs/README.md`).toBe(true);
    }
    expect(index).toContain('audits/');
    expect(index).toContain('recovery/');
    expect(index).toContain('research/');
  });
});

describe('documentation links resolve', () => {
  it('does not read a path inside inline code as a link', () => {
    // Reports quote hostile filenames such as `[link](example.invalid).ts` as data. They are
    // inline-code spans, not links, and must not be resolved against the filesystem.
    expect(
      relativeLinkTargets('names: ``back`tick.ts``, `[link](example.invalid).ts` done'),
    ).toEqual([]);
  });

  it.each(CURRENT_DOCS)('%s links to files that exist', (file) => {
    const directory = path.posix.dirname(file);
    for (const target of relativeLinkTargets(read(file))) {
      const resolved = path.join(repository, directory, target);
      expect(existsSync(resolved), `${file} links to missing ${target}`).toBe(true);
    }
  });
});
