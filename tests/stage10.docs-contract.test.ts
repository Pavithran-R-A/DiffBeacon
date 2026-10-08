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

/** The current half, measured 2026-10-04: the current CI itself ran on hosted runners. */
const CURRENT_HOSTED_EXECUTION = /37191968216/;

/**
 * Claims that were true when Stage 10 closed and are now falsified by measurement, each with the
 * evidence that moved: Actions run `37191968216` allocated GitHub-hosted runners to the
 * recovered-source `ci.yml` at commit `889f52b6e53095fea978fafbe50017ff71e543db` and passed every
 * lane, including the browser contract's `ubuntu-latest` cell, and the tracked lockfile audits at
 * `found 0 vulnerabilities` on both the release surface and the development tree in a clean
 * `npm ci` clone of the same commit. Kept as patterns rather than quoted prose, so repairing a
 * document cannot put the false claim back into a tracked file by copying the guard.
 */
const STALE_CURRENT_STATE_CLAIMS: RegExp[] = [
  /(?:has|had) never been allocated/i,
  /github-hosted runner images[^.]{0,140}unqualified/i,
  /\.github\/workflows\/ci\.yml`? is an unexecuted contract/i,
  /ubuntu-latest[^.]{0,40}(?:cell|lane)[^.]{0,80}(?:unmeasured|never|unqualified)/i,
  /hosted Linux browser cell[^.]{0,80}(?:never|unmeasured|unqualified)/i,
  /(?:development[- ]tree|development)[^.]{0,40}(?:audit|audits)[^.]{0,80}(?:1 high|one high)/i,
  /`npm audit --audit-level=high`? reports[^.]{0,20}(?:1 high|one high)/i,
  // Stage 14 falsified this second group: `diffbeacon@0.1.0` reached the public registry on
  // 2026-10-06T07:12:58.935Z, the annotated `v0.1.0` tag was pushed at the release commit, and the
  // GitHub Release was published from it. Each pattern below is a publication negative that a
  // document could still carry after those facts became true. Scoped narrowly on purpose:
  // CODE_OF_CONDUCT.md's "has not published a moderation address" stays true and must stay matched
  // by nothing here.
  /\*\*not published\*\*/i,
  /not published to the npm registry yet/i,
  /no version of diffbeacon is published/i,
  /no published diffbeacon action version exists/i,
  /`npm view diffbeacon` returns `404`/i,
  /there are still zero tags and zero github releases/i,
  /it has not made its first release/i,
  /so `npx diffbeacon[^`]*` does not resolve/i,
  /consumption of the Action[^.]{0,160}still never[^.]{0,60}measured/i,
  /reviewed commit SHA[^.]{0,160}does not exist until the Stage 11 release/i,
  /trailing whitespace[^.]{0,160}(?:trimmed|displayed as)/i,
  // Stage 17 falsified a third group, on 2026-10-08: `diffbeacon@0.1.1` is the published `latest`,
  // the annotated `v0.1.1` tag and GitHub Release `406586383` exist, the tokenless publish workflow
  // has executed, and a second consumer repository ran the Action at the v0.1.1 release commit.
  // Each pattern below was true while `0.1.0` was the only release, so a document that keeps it is
  // now a defect rather than a history entry. Patterns, not quoted prose, for the same reason as
  // above: repairing a sentence must not paste the false claim back into a tracked file.
  /diffbeacon v0\.1\.0 is released/i,
  /`"latest":"0\.1\.0"`/,
  /v0\.1\.1 release candidate, not yet published/i,
  /current public npm package and github release remain `?v0\.1\.0`?/i,
  // A second sweep, run after the first four landed, found claims the vocabulary above had never
  // covered: `SECURITY.md` still named `0.1.0` as the published and supported surface, and
  // `docs/README.md` still said the runbook forbade a second publication and that the consumer
  // example's pin was dated 2026-10-06. Each pattern below is one of those sentences and was
  // confirmed to match the committed (pre-repair) file and to match nothing in the repaired tree —
  // see `guard-sweep.txt` and `guard-sweep2.txt` in the Stage 17 evidence directory. A checker only
  // catches the wording it was written with, so the next release pass is expected to widen this
  // group again rather than trust it.
  /published surface is `?diffbeacon@0\.1\.0`?/i,
  /supported (?:version|surface)[^.]{0,80}`?0\.1\.0`?/i,
  /open-source project at `?0\.1\.0`?/i,
  /authorises publishing a second time/i,
  /pinned on 2026-10-06/i,
];

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

describe('current limitation prose matches parser dialect handling', () => {
  it('does not describe unsupported copy detection as rename-like two-sided classification', () => {
    const text = flatRead('docs/limitations.md');
    expect(text).toMatch(/copy detection is outside the supported vector/i);
    expect(text).not.toMatch(/copy from[^.]{0,160}classified from both paths/i);
  });

  it('documents bounded similarity metadata rather than accepting arbitrary percentages', () => {
    expect(flatRead('docs/limitations.md')).toMatch(/similarity[^.]{0,160}0%[^.]{0,80}100%/i);
  });
});

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
  it.each(CURRENT_DOCS)('%s makes no unbacked availability claim', (file) => {
    const text = read(file);
    expect(text).not.toMatch(/TODO|FIXME|XXX\b/);
    // Every install instruction must be runnable against the registry today. An unpinned
    // `npm install diffbeacon` / `npx diffbeacon` would resolve whatever `latest` happens to be
    // rather than the qualified release, which is the promise the documentation makes.
    expect(text, `${file} carries an unpinned install instruction`).not.toMatch(
      /(?:npm (?:install|i)|npx)(?:\s+--?\w[\w-]*)*\s+diffbeacon(?![@\w-])/i,
    );
    expect(text).not.toMatch(
      /listed on the github marketplace|marketplace listing (?:is live|exists)/i,
    );
  });

  it('keeps changelog releases dated and candidates marked unreleased', () => {
    const text = read('CHANGELOG.md');
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings)
      expect(heading).toMatch(/^(?:Unreleased|\d+\.\d+\.\d+ — \d{4}-\d{2}-\d{2})$/);
    // Both shipped releases are dated from the registry and Release timestamps, and a free
    // `Unreleased` candidate section has to exist for the work that follows them.
    expect(headings).toContain('0.1.0 — 2026-10-06');
    expect(headings).toContain('0.1.1 — 2026-10-08');
    expect(headings).toContain('Unreleased');
  });

  it('keeps the status block dated, dated-true, and pointed at the release runbook', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/Published on npm\?\s*\|\s*Yes/);
    // The current release, each value re-measured in Stage 17 on 2026-10-08.
    for (const fact of [
      'diffbeacon@0.1.1',
      'v0.1.1',
      'a89d8bb7d048bfd4e016e494428d04f060e82112',
      '406586383',
      '2026-10-08',
      '37740211385',
      '37749736010',
    ])
      expect(readme, `README omits the current release fact ${fact}`).toContain(fact);
    // The first release stays named, with the measurements that dated it: `0.1.0` is consumed and
    // immutable, so a status block that drops it invites someone to treat it as reclaimable.
    for (const fact of [
      'diffbeacon@0.1.0',
      'v0.1.0',
      '5a50b52028ead78942ea3fc3bee93ba26e0a79cc',
      '404432804',
      '2026-10-06',
    ])
      expect(readme, `README omits the historical release fact ${fact}`).toContain(fact);
    expect(readme).not.toContain('<REVIEWED_FULL_COMMIT_SHA>');
    expect(readme).toMatch(/36562157439/);
    expect(readme).toContain('docs/releasing.md');
  });

  it('keeps the deployed demo labelling itself with the published version', () => {
    // The footer is a release statement people read on the live Pages site, so it cannot be a
    // literal someone remembers to bump. It has to equal the published package's own version.
    const footer = read('client/src/pages/Home.tsx');
    const { version } = JSON.parse(read('packages/cli/package.json')) as { version: string };
    expect(footer).toContain(`DIFFBEACON / ${version}`);
  });

  it('states the measured registry count in the detector intro', () => {
    expect(read('docs/detectors/initial-detectors.md')).toMatch(
      /checked against both by[\s\n]*`tests\/stage10\.docs-contract\.test\.ts`/,
    );
  });
});

// The repository's hosted history spans two eras. Three bootstrap-era runs (Actions 32859849733,
// 31819615124 and 31818807881) were allocated hosted runners and executed setup and checkout steps
// before failing on archive extraction; the recovered-source `ci.yml` was allocated hosted runners
// on 2026-10-04 and passed every lane (run 37191968216). So no current document may deny hosted
// execution outright, and none may keep the older, narrower negative that the current workflow had
// never been allocated one. The contract below forbids both, and does not ask every document to
// retell the story.

describe('GitHub-hosted history is stated per era, not denied outright', () => {
  it.each(CURRENT_DOCS)('%s makes no all-history claim about hosted runners', (file) => {
    const text = flatRead(file);
    for (const absolute of HOSTED_HISTORY_ABSOLUTES) {
      expect(text, `${file} keeps an all-history hosted negative (${absolute.source})`).not.toMatch(
        absolute,
      );
    }
  });

  it.each(CURRENT_DOCS)('%s carries no claim the Stage 11 measurements falsified', (file) => {
    const text = flatRead(file);
    for (const stale of STALE_CURRENT_STATE_CLAIMS) {
      expect(text, `${file} keeps a claim falsified at 889f52b (${stale.source})`).not.toMatch(
        stale,
      );
    }
  });

  it('has a current document that separates the bootstrap era from current qualification', () => {
    const separated = CURRENT_DOCS.filter((file) => {
      const text = flatRead(file);
      return BOOTSTRAP_HOSTED_EXECUTION.test(text) && CURRENT_HOSTED_EXECUTION.test(text);
    });
    expect(
      separated.length,
      'no current document distinguishes the two hosted eras',
    ).toBeGreaterThan(0);
  });

  it('keeps the README and limitations recording the hosted run of the current CI', () => {
    for (const file of ['README.md', 'docs/limitations.md']) {
      expect(
        flatRead(file),
        `${file} no longer records the current CI running on GitHub-hosted runners`,
      ).toMatch(CURRENT_HOSTED_EXECUTION);
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
