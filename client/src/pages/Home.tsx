/**
 * DiffBeacon Field Manual page: Swiss technical-instrument hierarchy, oxide
 * signal accents, asymmetrical rail/map/ledger layout, and observation language.
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Beaker,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  FileCode2,
  FileText,
  FolderGit2,
  GitBranch,
  Info,
  KeyRound,
  Layers3,
  Menu,
  Moon,
  Network,
  PanelLeft,
  Play,
  RefreshCw,
  ShieldCheck,
  Sun,
  TerminalSquare,
  Workflow,
  X,
} from 'lucide-react';
import {
  analyzeDiff,
  MAX_DIFF_BYTES,
  neutralizeDisplayControls,
  renderJson,
  type ReviewAttentionMap,
  type SurfaceObservation,
} from '@core/index';

const SAMPLE_DIFF = `diff --git a/.github/workflows/release.yml b/.github/workflows/release.yml
index 18a3a20..a1e2f91 100644
--- a/.github/workflows/release.yml
+++ b/.github/workflows/release.yml
@@ -8,4 +8,6 @@ jobs:
   release:
     runs-on: ubuntu-latest
+    permissions:
+      contents: write
     steps:
       - uses: actions/checkout@v4
diff --git a/src/auth/session.ts b/src/auth/session.ts
index c6b1f11..a5f9912 100644
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -12,2 +12,3 @@ export function readSession(token: string) {
-  return decode(token);
+  const session = decode(token);
+  return session && session.expiresAt > Date.now() ? session : null;
 }
diff --git a/db/migrations/20260412_add_sessions.sql b/db/migrations/20260412_add_sessions.sql
new file mode 100644
--- /dev/null
+++ b/db/migrations/20260412_add_sessions.sql
@@ -0,0 +1,4 @@
+create table sessions (
+  id text primary key,
+  expires_at timestamp not null
+);
diff --git a/package.json b/package.json
index 2d1d4a1..7ed1ab4 100644
--- a/package.json
+++ b/package.json
@@ -14,3 +14,4 @@
     "scripts": {
       "test": "vitest"
     },
+    "dependencies": { "jose": "^5.9.0" }
diff --git a/src/review/attention.test.ts b/src/review/attention.test.ts
new file mode 100644
--- /dev/null
+++ b/src/review/attention.test.ts
@@ -0,0 +1,4 @@
+import { describe, it, expect } from 'vitest';
+describe('attention', () => {
+  it('captures session expiry', () => expect(true).toBe(true));
+});
`;

const SURFACE_ICONS = {
  'ci-build': Workflow,
  'auth-access': KeyRound,
  'database-schema': Layers3,
  dependencies: Network,
  'api-contracts': GitBranch,
  configuration: TerminalSquare,
  infrastructure: FolderGit2,
  tests: Beaker,
  documentation: BookOpen,
  generated: RefreshCw,
  runtime: FileCode2,
} as const;

function formatNumber(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
}

function surfaceTone(level: SurfaceObservation['level']) {
  return level.toLowerCase();
}

function countNoun(count: number, singular: string, plural: string) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** The engine measures its input bound in UTF-8 bytes, so the browser must too. */
function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).length;
}

/**
 * Paint a repository name without letting an embedded bidi override mirror the rest of the
 * name, or an 8-bit control open a gap in the page's own text. Same policy as the terminal
 * renderer; the report keeps the raw name.
 */
function paintedName(value: string) {
  return neutralizeDisplayControls(value, '\uFFFD');
}

function AppMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'app-mark app-mark--compact' : 'app-mark'} aria-hidden="true">
      <span className="app-mark__ring" />
      <span className="app-mark__bar" />
    </span>
  );
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: typeof PanelLeft;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? 'rail-item rail-item--active' : 'rail-item'}
      onClick={onClick}
      type="button"
    >
      <Icon size={16} strokeWidth={1.8} />
      <span>{label}</span>
      {active && <span className="rail-item__dot" />}
    </button>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'plus' | 'minus' | 'plain';
}) {
  return (
    <div className="summary-stat">
      <span className="summary-stat__label">{label}</span>
      <span
        className={
          accent ? `summary-stat__value summary-stat__value--${accent}` : 'summary-stat__value'
        }
      >
        {value}
      </span>
    </div>
  );
}

function AttentionRow({ item, index }: { item: SurfaceObservation; index: number }) {
  const Icon = SURFACE_ICONS[item.surface] ?? CircleHelp;
  return (
    <article
      className="attention-row"
      style={{ '--row-delay': `${index * 38}ms` } as React.CSSProperties}
    >
      <div className={`attention-level attention-level--${surfaceTone(item.level)}`}>
        {item.level}
      </div>
      <div className="attention-row__icon">
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div className="attention-row__body">
        <div className="attention-row__heading">
          <h3>{item.title}</h3>
          <span className="attention-row__count">{countNoun(item.fileCount, 'file', 'files')}</span>
        </div>
        <p>{item.description}</p>
        <div className="file-pile">
          {item.files.slice(0, 3).map((file, fileIndex) => (
            <code key={`${fileIndex}:${file}`}>{paintedName(file)}</code>
          ))}
          {item.files.length > 3 && <span>+{item.files.length - 3} more</span>}
        </div>
      </div>
      <div
        className="attention-row__delta"
        aria-label={`${item.additions} additions and ${item.deletions} deletions`}
      >
        <span>
          <ArrowUpRight size={13} /> {formatNumber(item.additions)}
        </span>
        <span>
          <ArrowDownRight size={13} /> {formatNumber(item.deletions)}
        </span>
      </div>
      <ChevronRight className="attention-row__chevron" size={17} />
    </article>
  );
}

function EmptyMap({ onExample }: { onExample: () => void }) {
  return (
    <section className="empty-map">
      <div className="empty-map__mark">
        <AppMark />
      </div>
      <div className="empty-map__copy">
        <span className="eyebrow">02 / REVIEW ATTENTION MAP / STANDBY</span>
        <h2>No diff. No assumptions.</h2>
        <p>
          Nothing is observed yet. Paste a unified diff to produce the first review surface, then
          start with the evidence already present.
        </p>
        <button className="text-button" type="button" onClick={onExample}>
          Load the synthetic example <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="empty-map__guide" aria-hidden="true">
        <span>01 / INPUT</span>
        <span>02 / MAP</span>
        <span>03 / OBSERVE</span>
      </div>
    </section>
  );
}

function EvidenceLedger({ report }: { report: ReviewAttentionMap }) {
  return (
    <aside className="ledger">
      <div className="ledger__header">
        <div>
          <span className="eyebrow">EVIDENCE LEDGER</span>
          <h2>Observed relationships</h2>
        </div>
        <span className="ledger__count">{String(report.evidence.length).padStart(2, '0')}</span>
      </div>
      {report.evidence.length === 0 ? (
        <div className="ledger__empty">
          <Check size={15} />
          <span>No unobserved companion change relationships surfaced.</span>
        </div>
      ) : (
        <div className="ledger__items">
          {report.evidence.map((item, index) => (
            <article
              className="ledger-item"
              key={item.kind}
              style={{ '--row-delay': `${index * 52}ms` } as React.CSSProperties}
            >
              <div className="ledger-item__marker">
                <span />
              </div>
              <div>
                <span className="ledger-item__kind">{item.kind.replaceAll('-', ' ')}</span>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                <div className="ledger-item__paths">
                  {item.relatedFiles.slice(0, 2).map((file, fileIndex) => (
                    <code key={`${fileIndex}:${file}`}>{paintedName(file)}</code>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="ledger__note">
        <Info size={14} />
        <span>
          “Not observed” describes this diff only. It is not a claim that coverage or documentation
          does not exist.
        </span>
      </div>
    </aside>
  );
}

function ReviewMap({ report }: { report: ReviewAttentionMap }) {
  return (
    <section className="map-section">
      <div className="map-header">
        <div>
          <span className="eyebrow">REVIEW ATTENTION MAP / RESULT</span>
          <h2>Look here first.</h2>
          <p>The sequence below is the order the report asks you to read it in.</p>
        </div>
        <div className="map-header__stamp">
          <span>SCHEMA</span>
          <strong>v{report.schemaVersion}</strong>
          <span>DETERMINISTIC</span>
        </div>
      </div>
      <div className="attention-list">
        {report.attention.map((item, index) => (
          <AttentionRow item={item} index={index} key={item.surface} />
        ))}
        {report.attention.length === 0 && (
          <div className="map-notice">
            <CircleHelp size={16} /> No recognized review surfaces in this diff.
          </div>
        )}
      </div>
      <div className="order-strip">
        <div className="order-strip__label">
          <span className="eyebrow">REVIEW ORDER</span>
          <span>every entry, in the reported sequence</span>
        </div>
        <ol className="order-list">
          {report.reviewOrder.map((item) => (
            <li key={item.surface}>
              <span className="order-list__position">{item.position}</span>
              <span className="order-list__title">{item.title}</span>
              <span className="order-list__reason">{item.reason}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function Home() {
  const [diff, setDiff] = useState('');
  const [report, setReport] = useState<ReviewAttentionMap | null>(null);
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [notice, setNotice] = useState('Ready for a unified diff.');
  const [mobileRail, setMobileRail] = useState(false);
  const [activeNav, setActiveNav] = useState('map');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  useEffect(() => {
    if (!mobileRail) return;
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setMobileRail(false);
      menuButtonRef.current?.focus();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileRail]);

  const byteCount = useMemo(() => utf8Bytes(diff), [diff]);

  /**
   * The only way draft text enters state. A proposal over the engine's byte limit is refused
   * before it is stored, so the last valid draft survives and no oversized text can reach
   * analyzeDiff(). The report is invalidated only for an edit that was actually accepted.
   */
  function trySetDiff(nextValue: string) {
    if (utf8Bytes(nextValue) > MAX_DIFF_BYTES) {
      setNotice('That input is larger than the 8 MiB limit, so it was not added to the draft.');
      return false;
    }
    setDiff(nextValue);
    if (report !== null) setReport(null);
    setNotice('Draft diff changed. Analyze when ready.');
    return true;
  }

  function analyze() {
    if (!diff.trim()) {
      setReport(null);
      setNotice('Paste a unified diff or load the synthetic example.');
      return;
    }
    setReport(analyzeDiff(diff));
    setNotice('Analysis complete locally in this browser.');
  }

  function loadExample() {
    setDiff(SAMPLE_DIFF);
    setReport(analyzeDiff(SAMPLE_DIFF));
    setNotice('Synthetic example loaded and mapped in this browser.');
  }

  function onDiffChange(event: ChangeEvent<HTMLTextAreaElement>) {
    trySetDiff(event.target.value);
  }

  function onDiffKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      analyze();
    }
  }

  async function copyReport() {
    if (!report) return;
    const payload = renderJson(report);
    if (!navigator.clipboard?.writeText) {
      setNotice(
        'This browser exposes no clipboard write API, so the JSON report could not be placed on the clipboard.',
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setNotice('JSON report copied to your clipboard.');
    } catch {
      setNotice(
        'This browser refused the clipboard write, so the JSON report is not available for pasting.',
      );
    }
  }

  return (
    <div className="app-frame">
      <aside id="rail-nav" className={mobileRail ? 'rail rail--open' : 'rail'}>
        <div className="rail__brand" aria-label="DiffBeacon">
          <AppMark compact />
          <span className="wordmark">
            <span>DIFF</span>
            <span className="wordmark__beacon">
              BEA<span className="wordmark__cut">C</span>ON
            </span>
          </span>
        </div>
        <div className="rail__section-label">WORKSPACE</div>
        <nav className="rail__nav" aria-label="Workspace navigation">
          <NavItem
            icon={PanelLeft}
            label="Attention map"
            active={activeNav === 'map'}
            onClick={() => {
              setActiveNav('map');
              setMobileRail(false);
            }}
          />
          <NavItem
            icon={FileText}
            label="Diff input"
            active={activeNav === 'input'}
            onClick={() => {
              setActiveNav('input');
              setMobileRail(false);
              textareaRef.current?.focus();
            }}
          />
        </nav>
        <div className="rail__section-label rail__section-label--lower">REFERENCE</div>
        <nav className="rail__nav" aria-label="Reference navigation">
          <NavItem
            icon={BookOpen}
            label="How it works"
            active={activeNav === 'docs'}
            onClick={() => {
              setActiveNav('docs');
              setMobileRail(false);
              setNotice(
                'DiffBeacon is deterministic: path surfaces, evidence relationships, and review order are documented.',
              );
            }}
          />
          <NavItem
            icon={ShieldCheck}
            label="Privacy model"
            active={activeNav === 'privacy'}
            onClick={() => {
              setActiveNav('privacy');
              setMobileRail(false);
              setNotice(
                'Your pasted diff stays in this browser. The analysis path has no backend or telemetry.',
              );
            }}
          />
        </nav>
        <div className="rail__footer">
          <div className="rail__version">
            <span className="status-dot" />
            LOCAL ENGINE <b>v0.1</b>
          </div>
          <div className="rail__footer-note">
            No account · no upload
            <br />
            No AI · no merge verdict
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="mobile-menu"
            type="button"
            aria-label={mobileRail ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileRail}
            aria-controls="rail-nav"
            onClick={() => setMobileRail(!mobileRail)}
          >
            <Menu size={19} />
          </button>
          <div className="topbar__crumb">
            <span>WORKSPACE</span>
            <ChevronRight size={13} />
            <strong>REVIEW ATTENTION</strong>
          </div>
          <div className="topbar__actions">
            <span className="local-chip">
              <span className="status-dot" />
              RUNS IN BROWSER
            </span>
            <button
              className="icon-button"
              type="button"
              aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
              onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
            >
              {mode === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              className="icon-button topbar__help"
              type="button"
              aria-label="Show product note"
              onClick={() =>
                setNotice(
                  'DiffBeacon maps attention; it never decides whether a pull request is safe to merge.',
                )
              }
            >
              <CircleHelp size={17} />
            </button>
          </div>
        </header>

        <div className="workspace__inner">
          <section className="masthead">
            <div className="masthead__eyebrow">
              <span className="signal-line" />
              FIELD NOTE 00 / DIFFBEACON
            </div>
            <h1>
              Start with the diff.
              <br />
              <em>Review the evidence in order.</em>
            </h1>
            <p className="masthead__dek">
              A local instrument for changed surfaces, observed relationships, and a sensible first
              read. No opaque reviewer. No merge verdict.
            </p>
            <div className="masthead__meta">
              <span>
                <GitBranch size={14} />
                UNIFIED DIFF
              </span>
              <span>
                <TerminalSquare size={14} />
                LOCAL ANALYSIS
              </span>
              <span>
                <ShieldCheck size={14} />
                OBSERVATION, NOT JUDGMENT
              </span>
            </div>
          </section>

          <section className="input-instrument" id="diff-input">
            <div className="input-instrument__topline">
              <div>
                <span className="eyebrow">01 / INPUT INSTRUMENT</span>
                <h2>Paste diff. Observe surfaces.</h2>
              </div>
              <div className="input-instrument__actions">
                <button className="ghost-button" type="button" onClick={loadExample}>
                  <Play size={13} />
                  Load example
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={!diff}
                  onClick={() => {
                    setDiff('');
                    setReport(null);
                    setNotice('Input cleared.');
                  }}
                >
                  <X size={13} />
                  Clear
                </button>
              </div>
            </div>
            <div className="textarea-wrap">
              <textarea
                ref={textareaRef}
                id="diff-textarea"
                aria-label="Unified diff input"
                value={diff}
                onChange={onDiffChange}
                onKeyDown={onDiffKeyDown}
                placeholder={'Paste a unified diff here…\n\nTip: Ctrl / Cmd + Enter to analyze'}
                spellCheck={false}
              />
              <div className="textarea-wrap__rail">
                <span>{String(byteCount).padStart(6, '0')} B</span>
                <span>MAX 8 MiB</span>
              </div>
            </div>
            <div className="input-instrument__bottom">
              <div className="privacy-note">
                <ShieldCheck size={15} />
                <span>
                  <strong>Your pasted diff is analyzed in this browser.</strong> Analysis does not
                  upload it. There is no backend, API, or telemetry in the analysis path.
                </span>
              </div>
              <button className="primary-button" type="button" onClick={analyze}>
                <span>Analyze diff</span>
                <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="input-status" aria-live="polite">
              <span
                className={
                  notice.includes('complete') || notice.includes('loaded')
                    ? 'status-dot status-dot--bright'
                    : 'status-dot'
                }
              />
              {notice}
              <span className="input-status__shortcut">⌘ / Ctrl + Enter</span>
            </div>
          </section>

          <div className="workspace__rule">
            <span>02 / MAP</span>
            <span>THE REVIEW SURFACE</span>
            <span className="workspace__rule-line" />
          </div>

          {report ? (
            <div className="result-layout">
              <div className="result-main">
                <div className="summary-bar">
                  <div className="summary-bar__title">
                    <span className="eyebrow">
                      ATTENTION MAP /{' '}
                      {report.summary.diagnostics > 0 ? 'PARSED WITH DIAGNOSTICS' : 'READY'}
                    </span>
                    <h2>
                      {report.summary.changedFiles === 0
                        ? 'No changed files observed.'
                        : 'A map of your first read.'}
                    </h2>
                  </div>
                  <div className="summary-stats">
                    <SummaryStat label="FILES" value={formatNumber(report.summary.changedFiles)} />
                    <SummaryStat
                      label="ADDITIONS"
                      value={`+${formatNumber(report.summary.additions)}`}
                      accent="plus"
                    />
                    <SummaryStat
                      label="DELETIONS"
                      value={`-${formatNumber(report.summary.deletions)}`}
                      accent="minus"
                    />
                    <SummaryStat
                      label="GENERATED"
                      value={formatNumber(report.summary.generatedFiles)}
                    />
                  </div>
                  {report.summary.diagnostics > 0 && (
                    <p className="summary-bar__note">
                      {countNoun(
                        report.summary.diagnostics,
                        'parser diagnostic',
                        'parser diagnostics',
                      )}{' '}
                      {report.summary.diagnostics === 1 ? 'was' : 'were'} recorded while reading
                      this diff. A recorded diagnostic limits what the parser could confirm; it does
                      not withdraw the files that were observed.
                    </p>
                  )}
                </div>
                <ReviewMap report={report} />
              </div>
              <EvidenceLedger report={report} />
            </div>
          ) : (
            <EmptyMap onExample={loadExample} />
          )}

          <section className="bottom-note">
            <div className="bottom-note__mark">
              <AppMark compact />
            </div>
            <div>
              <span className="eyebrow">THE BOUNDARY</span>
              <p>
                DiffBeacon maps review attention. It does <strong>not</strong> determine whether a
                pull request is safe to merge.
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Copy current JSON report"
              disabled={!report}
              onClick={() => void copyReport()}
            >
              <Clipboard size={16} />
            </button>
          </section>
        </div>
        <footer className="workspace-footer">
          <span>DIFFBEACON / 0.1.1</span>
          <span>DETERMINISTIC ATTENTION ROUTING</span>
          <span>ANALYSIS IN THIS BROWSER</span>
        </footer>
      </main>
    </div>
  );
}
