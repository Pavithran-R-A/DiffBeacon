/**
 * DiffBeacon Field Manual page: Swiss technical-instrument hierarchy, oxide
 * signal accents, asymmetrical rail/map/ledger layout, and observation language.
 */

import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';
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
          <span className="attention-row__count">{formatNumber(item.fileCount)} files</span>
        </div>
        <p>{item.description}</p>
        <div className="file-pile">
          {item.files.slice(0, 3).map((file) => (
            <code key={file}>{file}</code>
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
    <section className="empty-map" aria-live="polite">
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
                  {item.relatedFiles.slice(0, 2).map((file) => (
                    <code key={file}>{file}</code>
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
    <section className="map-section" aria-live="polite">
      <div className="map-header">
        <div>
          <span className="eyebrow">REVIEW ATTENTION MAP / RESULT</span>
          <h2>Look here first.</h2>
          <p>Structurally sensitive surfaces are ordered before ordinary implementation churn.</p>
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
          <span>recommended starting sequence</span>
        </div>
        <div className="order-strip__items">
          {report.reviewOrder.slice(0, 5).map((item) => (
            <span key={item.surface}>
              <b>{String(item.position).padStart(2, '0')}</b>
              {item.title}
            </span>
          ))}
          {report.reviewOrder.length > 5 && (
            <span>
              <b>+{report.reviewOrder.length - 5}</b>more
            </span>
          )}
        </div>
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

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  const byteCount = useMemo(() => new TextEncoder().encode(diff).length, [diff]);
  const isOverLimit = byteCount > MAX_DIFF_BYTES;

  function analyze() {
    if (isOverLimit) {
      setNotice('This diff is larger than 8 MiB. Trim it before analyzing locally.');
      return;
    }
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
    setNotice('Synthetic example loaded. Nothing was sent anywhere.');
  }

  function onDiffChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDiff(event.target.value);
    if (report !== null) setReport(null);
    setNotice('Draft diff changed. Analyze when ready.');
  }

  function onDiffKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      analyze();
    }
  }

  function copyReport() {
    if (!report) return;
    void navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
    setNotice('JSON report copied to your clipboard.');
  }

  return (
    <div className="app-frame">
      <aside className={mobileRail ? 'rail rail--open' : 'rail'}>
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
              document.getElementById('diff-input')?.focus();
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
            className="mobile-menu"
            type="button"
            aria-label="Open navigation"
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
              LOCAL ONLY
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
                ZERO NETWORK
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
              <div className={isOverLimit ? 'privacy-note privacy-note--warn' : 'privacy-note'}>
                <ShieldCheck size={15} />
                <span>
                  <strong>Your diff stays in this browser.</strong> No source upload, backend,
                  telemetry, or remote AI.
                </span>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={analyze}
                disabled={isOverLimit}
              >
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
                      {report.summary.diagnostics > 0 ? 'WITH DIAGNOSTICS' : 'READY'}
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
              onClick={copyReport}
            >
              <Clipboard size={16} />
            </button>
          </section>
        </div>
        <footer className="workspace-footer">
          <span>DIFFBEACON / 0.1.0</span>
          <span>DETERMINISTIC ATTENTION ROUTING</span>
          <span>LOCAL BY DEFAULT</span>
        </footer>
      </main>
    </div>
  );
}
