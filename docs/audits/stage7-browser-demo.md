# DIFFBEACON STAGE 7 — BROWSER DEMO REPORT

```text
STATUS:                  PASS (browser demo qualified in a real Chromium on Windows; no hosted
                         Safari/macOS qualification; hosted CI contributes nothing — see 'Hosted CI')

STARTING SHA:            3f1f314c4826fcf162e1f24f13dd5529a469e6be  (rescue/stage0-source tip at start;
                         no Stage-7 commit existed on GitHub)
QUALIFIED PRODUCT SHA:   d2b482e6a9dc2b0118dc97fd2d744fa886de38e9  ('fix: qualify DiffBeacon browser
                         demo') — every browser run, gate result and qualification-matrix cell below
                         is on this tree: the cells clone this commit, and the ten gates were run on
                         a working tree whose tracked content is identical to it.
ENDING BRANCH SHA:       the commit this document is made in — 'docs: record DiffBeacon Stage 7
                         browser qualification', made directly on top of the QUALIFIED PRODUCT SHA
                         above, and the tip pushed to rescue/stage0-source. It is named by subject and
                         parent rather than by hash: a commit cannot contain its own hash, and this
                         stage's instruction is not to create a further commit whose only content is a
                         later identifier (so the hosted-CI run ID below is kept in the Stage 7
                         evidence directory, not in a second commit).
BRANCH:                  rescue/stage0-source
ORIGIN MAIN SHA:         e0ff98143bfe39c80c338518d006525a846a8739  (unchanged; not merged, not moved)
```

## What Stage 7 is

Stage 7 qualifies the **browser demo only**: one Vite/React page that takes a unified diff pasted into
a textarea and renders the report produced by the already-qualified Stage 2-4 engine
(`analyzeDiff`) in the visitor's own browser tab. It adds no backend, no API, no account, no
telemetry, no cloud storage and no persistence, and it does not change `packages/core`,
`packages/cli` or `packages/action`.

Every browser statement in this report was executed by `playwright-core@1.63.0` against a real,
already-installed Chromium. No browser result below was produced by a DOM emulator, a snapshot
library, or a claim about "what the code should do".

```text
REAL BROWSER           Chromium 151.0.7922.34 (headless), userAgent HeadlessChrome/151.0.0.0
                       platform Win32, Windows 10.0.26200 x64
                       executable %LOCALAPPDATA%\ms-playwright\chromium-1234\chrome-win64\chrome.exe
                       driver playwright-core 1.63.0 — no browser download, no user profile,
                       no browser binary or profile inside the repository
VIEWPORT MATRIX        desktop 1440x900 · tablet 768x1024 · phone 375x812 · small phone 320x568
                       (mobile-drawer, focus, live-region, reduced-motion and review-order cases run
                       at 375x812; the overflow sweep runs all four sizes; target sizes are measured
                       at 375x812 and 1440x900)
```

## RED baseline

The baseline that Stage 7 had to clear was measured, not assumed.

```text
RED LOG                ../stage7/green-1.log   — the filename is MISNAMED: the file is the
                         consolidated RED baseline, not a green run. Do not read it as a pass.
MEASURED               84 browser scenarios · 27 failed · 57 passed · 4 files · 600.62 s
                         run with --no-file-parallelism (one file at a time)
EARLIER NOTE           the tablet-overflow scenario that timed out in an earlier 3-way parallel
                         attempt passed in this serial run: that timeout was HARNESS CONTENTION
                         (three Chromium suites plus builds on one machine), not a product defect.
                         No application repair was made for it, and none was needed.
```

The 27 RED scenarios, verbatim from the baseline log:

| #   | File          | Scenario                                                                                  |
| --- | ------------- | ----------------------------------------------------------------------------------------- |
| 1   | accessibility | moves focus into the diff textarea when the Diff input rail item is used                  |
| 2   | accessibility | shows every result row immediately when reduced motion is requested                       |
| 3   | accessibility | keeps a closed drawer out of the tab order and an open drawer in it                       |
| 4   | accessibility | leaves the menu button clickable while the drawer is open                                 |
| 5   | accessibility | publishes expansion state and the element it controls                                     |
| 6   | accessibility | returns focus to the menu button when Escape closes the drawer                            |
| 7   | accessibility | keeps primary controls large enough to hit with a finger (the over-constrained test — D1) |
| 8   | accessibility | announces state changes from exactly one live region, not from the whole result           |
| 9   | build         | ships script, style, and html only                                                        |
| 10  | build         | loads with no console error, no failed request, and no missing file                       |
| 11  | build         | serves the app at /DiffBeacon/ with no missing asset                                      |
| 12  | contract      | counts files with the grammar the count calls for                                         |
| 13  | contract      | reports the parser diagnostic count it actually has, and no more                          |
| 14  | contract      | uses review-navigation language rather than risk language                                 |
| 15  | contract      | uses singular grammar for one diagnostic and plural for several                           |
| 16  | contract      | accepts input at exactly the limit and rejects one byte more                              |
| 17  | contract      | fails closed when typing on a full draft would cross the limit                            |
| 18  | contract      | never stores a draft above the limit even when the value is replaced directly             |
| 19  | contract      | refuses an over-limit paste before it reaches the draft                                   |
| 20  | contract      | describes local analysis without claiming the page never used the network                 |
| 21  | contract      | loads the synthetic example into the textarea and maps it                                 |
| 22  | contract      | keeps the whole sequence readable at a phone viewport                                     |
| 23  | contract      | lists every review-order entry instead of truncating the sequence                         |
| 24  | contract      | pairs each position and title with the engine reason, in engine order                     |
| 25  | security      | says the copy was blocked when the clipboard write is rejected                            |
| 26  | security      | says the report could not be copied when the clipboard API does not exist                 |
| 27  | security      | describes privacy as a local analysis boundary instead of an impossible network claim     |

## DEFECTS — old behaviour, the RED test that proved it, the repair, the GREEN proof

Each repair was written against a test that had already been shown to fail. `git diff` is the
record of the old behaviour; the removed lines are quoted where the wording itself was the defect.

### D1 — the target-size test asserted a standard it did not quote (TEST defect, fixed first)

```text
OLD      tests/stage7.browser-accessibility.test.ts required every control to be >= 44 x 44 CSS px
           and named WCAG as the reason. Scenario 7 therefore RED on 34 x 34 icon buttons.
FACT     WCAG 2.2 AA Success Criterion 2.5.8 (Target Size (Minimum)) is a 24 x 24 CSS px minimum,
           with spacing / equivalent-target exceptions. 44 x 44 is the WCAG 2.5.5 AAA target and is
           also Apple/Android platform guidance — it is NOT the AA minimum.
REPAIR   The TEST was corrected before any product code: the scenario is now
           'meets the WCAG 2.2 AA 24 x 24 target-size criterion, or the spacing exception', it
           measures real boxes in the real engine, applies 24 x 24 with the documented spacing
           exception, and prints the measured sizes so the claim can be audited.
           44 x 44 is kept only as a DiffBeacon DESIGN TARGET and is labelled as such; Stage 7 PASS
           does not rest on it, and it is nowhere presented as a WCAG AA requirement.
KEPT     ../stage7/green-1.log scenario 7 preserves the evidence that the original test was
           over-constrained. No legitimate keyboard or focus requirement was weakened: the Tab-order,
           focus-visibility, Escape and Ctrl+Enter scenarios all still assert.
GREEN    scenario passes at 375x812 and 1440x900; measurements in
           ../stage7/target-size-measurements.txt and inside ../stage7/green-full-2.log.
```

Measured target sizes, real engine, real layout (all pass the 24 × 24 AA criterion):

| Control                    | phone 375x812 | desktop 1440x900 | vs 24 AA | vs 44 design target |
| -------------------------- | ------------- | ---------------- | -------- | ------------------- |
| `.rail-item` (inactive)    | 215.0 × 39.0  | 195.0 × 39.0     | pass     | pass (width)        |
| `Open navigation`          | 34.0 × 34.0   | not rendered     | pass     | below (by design)   |
| `Switch to dark mode`      | 34.0 × 34.0   | 34.0 × 34.0      | pass     | below (by design)   |
| `Show product note`        | not rendered  | 34.0 × 34.0      | pass     | below (by design)   |
| `Copy current JSON report` | 34.0 × 34.0   | 34.0 × 34.0      | pass     | below (by design)   |
| `.primary-button`          | 291.0 × 40.0  | 141.6 × 40.0     | pass     | pass (width)        |

The four 34 × 34 icon controls satisfy 24 × 24 outright; they sit below the 44 × 44 DiffBeacon
design target, which is recorded here as a design observation rather than a standards failure.

### D2 — focus went to a container, not to the input

```text
OLD      client/src/pages/Home.tsx: document.getElementById('diff-input')?.focus();
           — the rail item focused the <section> wrapper, so the caret never landed in the textarea.
RED      scenario 1 (accessibility).
REPAIR   textareaRef = useRef<HTMLTextAreaElement>(null) wired with ref={textareaRef} on the textarea;
           the rail handler calls textareaRef.current?.focus(). No positive tabIndex was added
           anywhere; no focus trap was added.
GREEN    'moves focus into the diff textarea …' passes: document.activeElement is the textarea.
```

### D3 — the mobile drawer lied about itself (four RED scenarios)

```text
OLD      <aside className={mobileRail ? 'rail rail--open' : 'rail'}>  — no id, no aria-expanded, no
           aria-controls; the closed drawer was still in the tab order because the mobile rule painted
           it with inset: 0 auto 0 0 and no visibility change; the full-height drawer covered the menu
           button; Escape did nothing at all.
RED      scenarios 3, 4, 5, 6 (accessibility).
REPAIR   Home.tsx — stable id="rail-nav" on the aside, aria-expanded={mobileRail} and
           aria-controls="rail-nav" on the button, label toggles Open navigation / Close navigation,
           a menuButtonRef keydown listener that closes on Escape and then focuses the button.
           index.css — the mobile rule becomes inset: 62px auto 0 0 with min-height: 0,
           overflow-y: auto, visibility: hidden when closed and visibility: visible when open, so a
           closed drawer leaves the tab order and the trigger stays clickable.
GREEN    all four scenarios pass, including 'keeps a closed drawer out of the tab order and an open
           drawer in it' and 'returns focus to the menu button when Escape closes the drawer'.
```

### D4 — two big live regions announced the whole result

```text
OLD      <section className="empty-map" aria-live="polite"> and
         <section className="map-section" aria-live="polite"> — the entire map was a live region, so
           every re-render announced a wall of text, and the status line was not announced at all.
RED      scenario 8 (accessibility).
REPAIR   both aria-live attributes removed; exactly one dedicated polite live region remains,
         <div className="input-status" aria-live="polite">, which carries the notice text.
GREEN    'announces state changes from exactly one live region, not from the whole result' passes
         (the test counts aria-live elements and asserts the changed text is inside that one region).
NOTE     This qualifies the DOM contract for assistive technology. It is NOT a screen-reader
         certification: no AT product was run, and Stage 7 makes no such claim.
```

### D5 — reduced motion hid the content instead of calming it

```text
OLD      index.css zeroed animation-duration/transition-duration to 1ms under
           prefers-reduced-motion, but left the staggered animation-delay in place on rules whose
           base state is opacity: 0 (.attention-row, .ledger-item) — so rows were invisible until
           their delay elapsed.
RED      scenario 2 (accessibility).
REPAIR   the reduced-motion block now zeroes animation-duration, animation-delay,
         transition-duration and transition-delay (!important, scroll-behavior: auto) AND states the
         end condition directly: .attention-row, .ledger-item { opacity: 1; transform: none }.
GREEN    'shows every result row immediately when reduced motion is requested' passes — content is
         visible immediately; nothing is hidden or removed based on animation state, and no content
         is gated on motion.
```

### D6 — the shipped build 404ed and carried placeholder junk (three RED scenarios)

```text
OLD      client/index.html declared no icon, so every page load asked the static host for
           /favicon.ico and got a 404; client/public/.gitkeep was copied into dist/, which broke the
           "only the file types we mean to ship" rule.
RED      scenarios 9, 10, 11 (build).
REPAIR   client/favicon.svg added — a 5-line local SVG (viewBox 0 0 32 32, three shapes, no
           base64 payload, no remote URL); <link rel="icon" type="image/svg+xml"
           href="./favicon.svg" /> added to the head; client/public/.gitkeep deleted; a duplicate
           <meta name="description> that claimed "local-first, deterministic" was removed, leaving
           one accurate description.
GREEN    'loads with no console error, no failed request, and no missing file', 'loads its own
         favicon over the network, with no remote icon behind it' (the href resolves on the app
         origin under /assets/ and returns 200 image/*), 'ships script, style, html, sourcemaps and
         the local favicon only' (extensions limited to .css .html .js .map .svg, and no .gitkeep),
         and the sub-path trio below.
```

### D7 — the input guard ran after the oversized text was already stored (four RED scenarios)

```text
OLD      const byteCount = useMemo(() => new TextEncoder().encode(diff).length, [diff]);
         const isOverLimit = byteCount > MAX_DIFF_BYTES;  — the limit was a property of the ALREADY
         STORED draft: onChange wrote the value first (setDiff(event.target.value)) and the page then
         merely disabled the Analyze button, so an over-limit paste or fill lived in React state, in
         the DOM, and in the byte label.
RED      scenarios 16, 17, 18, 19 (contract).
REPAIR   one shared gate, used by every path that can change the draft:
           function trySetDiff(nextValue: string): boolean — measures with TextEncoder, and if
           utf8Bytes(nextValue) > MAX_DIFF_BYTES it refuses the proposal, keeps the last valid
           controlled value, and says so. Accepted edits invalidate the report; refused ones do not.
           onChange routes through trySetDiff; the byte limit is the engine's own MAX_DIFF_BYTES,
           imported from @core — no second copy of the number, and the value itself was not altered
           (still 8 MiB). No streaming editor, no chunked buffer.
GREEN    'shares the engine byte limit' (MAX_DIFF_BYTES === 8 * 1024 * 1024), 'refuses an over-limit
         paste before it reaches the draft', 'accepts input at exactly the limit and rejects one byte
         more', 'fails closed when typing on a full draft would cross the limit', 'never stores a
         draft above the limit even when the value is replaced directly' (fill() of limit+1 bytes),
         'counts a multi-byte paste in UTF-8 bytes, not code units' (€ / 中 / 🚀), and 'keeps ordinary
         typing inside the limit working as expected'.
8 MiB INPUT  The boundary scenarios paste genuine 8 MiB strings built from MAX_DIFF_BYTES, not
         abbreviations: header + 'a'.repeat(MAX_DIFF_BYTES - utf8Length(header)) is accepted at
         exactly 8 388 608 bytes and one further byte is refused; the refusal keeps the previously
         valid draft byte-for-byte. Paste ceilings of 45 s are test allowances, not product budgets.
```

### D8 — the page claimed more than a browser page can claim (three RED scenarios)

```text
OLD      <span>ZERO NETWORK</span>, <span>LOCAL ONLY</span>, <span>LOCAL BY DEFAULT</span> and
         setNotice('Synthetic example loaded. Nothing was sent anywhere.') plus
         <strong>Your diff stays in this browser.</strong> No source upload, backend, telemetry, or
         remote AI.
         A page delivered over HTTPS demonstrably did network activity, so "zero network" and
         "nothing was sent anywhere" were false as written, and "local only / local by default"
         overstated the same thing.
RED      scenarios 20 (contract), 27 (security), plus the chip sweep in the contract suite.
REPAIR   Masthead meta: LOCAL ANALYSIS. Chips: RUNS IN BROWSER and ANALYSIS IN THIS BROWSER.
         Privacy note: 'Your pasted diff is analyzed in this browser. Analysis does not upload it.
         There is no backend, API, or telemetry in the analysis path.' Example notice: 'Synthetic
         example loaded and mapped in this browser.' Every surviving claim is scoped to the analysis
         path; none claims the page never used a network.
GREEN    'describes local analysis without claiming the page never used the network' (asserts the
         workspace text matches none of /zero network/i, /nothing was sent anywhere/i,
         /local only|local by default/i) and 'describes privacy as a local analysis boundary instead
         of an impossible network claim' pass. The RED run of the widened assertion is preserved in
         ../stage7/red-privacy-chip-1.log (1 failed | 38 skipped) before the copy was changed.
PRIVACY (runtime observation, not copy)
         ../stage7/green-full-2.log + the security suite prove the behaviour the copy now claims:
         with a unique marker embedded in the analyzed diff, the request log between the click and
         the rendered report is EMPTY — 0 requests, 0 failed requests, 0 404s — and no recorded
         request contains the marker. Page bootstrap is counted separately and deliberately excluded
         from that window: the page must fetch its own HTML/JS/CSS/favicon to exist, which is exactly
         why "zero network" was removed instead of re-worded. The full interaction sweep (paste the
         hostile corpus, analyze, fill a marker diff, analyze, Load example, copy, theme toggle,
         clear) also produces 0 requests and leaves the injected sentinel global intact.
         The complete marker string is not reproduced in this report.
```

### D9 — clipboard success was claimed before (and without) the write (two RED scenarios)

```text
OLD      function copyReport() { void navigator.clipboard?.writeText(payload);
           setNotice('JSON report copied to your clipboard.'); }
         — the promise was dropped. With no clipboard API (a non-secure context) the optional
         chain returned undefined and the page still said "copied"; with a rejected write it caused
         an unhandled rejection and still said "copied".
RED      scenarios 25, 26 (security).
REPAIR   async copyReport(): if navigator.clipboard?.writeText is absent it says the browser exposes
         no clipboard write API and returns; otherwise it AWAITS the write, says copied only after the
         await resolves, and in catch says the browser refused the write. No document.execCommand
         fallback, no download link, no clipboard read in production code (the readText calls live
         only in the test files, to verify what was written).
GREEN    'writes the exact report JSON and only then says it was copied' (clipboard content ===
         analyzeDiff(diff) and the notice matches /copied/i), 'says the report could not be copied
         when the clipboard API does not exist' (served over a non-secure hostname; navigator.clipboard
         write API measured absent; notice matches could not/not available/blocked/failed and never
         'copied'; no page error), 'says the copy was blocked when the clipboard write is rejected'
         (writeText stubbed to reject with NotAllowedError; notice polled to a failure wording, the
         result layout is still there, 0 page errors, 0 console errors), and 'copies without
         downloading a file, and offers no download control'.
```

### D10 — the review order was truncated, reasonless, and carried an unproven claim (three RED scenarios)

```text
OLD      report.reviewOrder.slice(0, 5) with a '+N more' chip, position padded but no reason, and
         <p>Structurally sensitive surfaces are ordered before ordinary implementation churn.</p>
         — the browser dropped engine entries, invented a summary chip, and asserted a ranking
         rationale the engine does not promise.
RED      scenarios 22, 23, 24 (contract).
REPAIR   the whole sequence is rendered from the report itself — <ol className="order-list"> over
         report.reviewOrder.map() using the engine's own item.position, item.title and item.reason.
         No browser-side re-ranking, no browser-generated substitute rationale, no truncation. The
         claim line is replaced by 'The sequence below is the order the report asks you to read it
         in.' Layout moved from a wrapping strip to a two-column grid list that stays inside the page
         at 375x812.
GREEN    'lists every review-order entry instead of truncating the sequence' (every entry of
         analyzeDiff(SAMPLE_DIFF).reviewOrder is on screen — 6 for the example), 'pairs each position
         and title with the engine reason, in engine order', 'keeps the whole sequence readable at a
         phone viewport'.
```

### D11 — counts used the wrong grammar (two RED scenarios)

```text
OLD      {formatNumber(item.fileCount)} files   (always plural), and the diagnostics wording did not
         agree with its own number.
RED      scenarios 12, 15 (contract).
REPAIR   one shared client helper, countNoun(count, singular, plural), used for every client-visible
         count: attention-row file counts and the parser-diagnostic count. No engine data was
         changed — countNoun only chooses the English form.
GREEN    'counts files with the grammar the count calls for' and 'uses singular grammar for one
         diagnostic and plural for several'.
```

### D12 — diagnostics were presented as more than a count (three RED scenarios)

```text
OLD      a coarse WITH DIAGNOSTICS chip plus risk-flavoured wording; the surface implied the parser
         knew more than it records and implied that a diagnostic voided the observed files.
RED      scenarios 13, 14, 21 (contract, including the example-load case, which asserts the mapped
         example's real counts and order rather than a hand-written number).
REPAIR   the count is the whole statement: eyebrow 'PARSED WITH DIAGNOSTICS' / 'READY' driven by
         report.summary.diagnostics, and a note that reads '1 parser diagnostic was recorded …' or
         '2 parser diagnostics were recorded …' via countNoun plus subject-verb agreement, followed
         by 'A recorded diagnostic limits what the parser could confirm; it does not withdraw the
         files that were observed.' Nothing about the diagnostics' content is invented — the client
         has only the number, and it shows only the number. Review-navigation language is used
         everywhere instead of risk language, and no merge verdict is stated.
GREEN    'reports the parser diagnostic count it actually has, and no more', 'says nothing about
         diagnostics when the parser recorded none', 'uses review-navigation language rather than
         risk language', 'declines to state a merge verdict', 'loads the synthetic example into the
         textarea and maps it', 'produces the identical report when the example is loaded twice'.
```

### D13 — `npm test` was not deterministic (TEST-INFRASTRUCTURE defect, found by measurement)

```text
SYMPTOM  the first full-suite gate run measured six 30 s page.goto timeouts plus one 60 s scenario
         timeout across the four Chromium suites, while the same four files alone finished 87/87 in
         about 60 s.
PROOF    ../stage7/red-parallel-repro-1.log (browser files alone, parallel: green) versus
         ../stage7/gate-test.log (whole suite: 8 failures). The defect was scheduling, not product.
REPAIR   claimBrowserSlot() in tests/stage7.browser-harness.ts: one cross-process advisory lock in
         the system temp directory, claimed in each browser file's beforeAll and released in
         afterAll, with a heartbeat rewrite and a 45 s stale-owner rule so a killed worker cannot
         wedge the queue. Browser suites therefore serialise with each other while the 38 source
         files keep their parallel scheduling, and no command-line flag is required to get a
         trustworthy 'npm test'.
         The hook budget was raised to 900 s as an explicitly documented SCHEDULING allowance for
         that queue. It is not a per-case allowance: an individual scenario still fails inside its
         own 60 s (contract: 120 s) test timeout.
GREEN    gate-05-npm-test-final.log — see TESTS below.
         PARTLY WRONG, and corrected in D14: the slot serialises the browser files against each
         other, which is what these runs measured, but it does not stop them contending with the 38
         source files, and that is the case that later failed inside `npm run verify`.
```

### D14 — the browser slot turned contention into a stall (TEST-INFRASTRUCTURE defect, found by measurement)

```text
SYMPTOM  the standalone suite passed (832/832, 273.10 s) while `npm run verify`, which runs the same
         suite inside it, did not: 7 failed files, 5 failed tests and 69 skipped. Three Chromium
         files died with `Error: Hook timed out in 900000ms` in their beforeAll, and unrelated
         real-Git suites overran too — stage2.real-git-oracle at 138 029 ms,
         stage6.action-security-boundary at 115 053 ms, and two stage6.action-runner shallow-checkout
         cases at 95 333 ms and 66 043 ms.
PROOF    ../stage7/gate-verify-final.log and ../stage7/gate-check-final.log, against
         ../stage7/gate-05-npm-test-final.log on the same tree. Same code, same machine, opposite
         result: the difference was what else was running. Host capacity at the time
         (../stage7/capacity.ps1): 16 logical CPUs, 15.6 GB RAM, 5.3 GB free, 59 % CPU idle.
CAUSE    my own D13 repair. The cross-process browser slot makes a worker wait inside beforeAll,
         but vitest keeps that worker checked out of the pool for the whole wait, so four queued
         Chromium files hold pool slots while 38 source files - which are driving real Git, real
         filesystem and real temp repos - fight the remaining workers for the same CPU and disk.
         The lock did not remove the contention, it moved it into a hook timeout.
REPAIR   vitest.config.ts now declares two projects instead of one flat include: `source` (all of
         tests/ except the four Stage 7 browser files) at sequence.groupOrder 1, and `browser`
         (tests/stage7.browser-*.test.ts) at groupOrder 2. The browser project therefore starts only
         once the source project has finished, so a Chromium process is never scheduled against a
         temp-repo suite, and the existing slot still serialises the four Chromium files among
         themselves. No timeout was raised for this, no test was quarantined, skipped or deleted,
         and no scenario was changed — the only edits are the project split and the fact that
         browser-file hooks now wait on each other rather than on the whole repository.
GREEN    gate-05-npm-test-sequenced-1.log — 42 files, 833 tests, 0 failed, 0 skipped, 334.10 s.
         Gates 9 and 10 on that same tree: `npm run verify` passed (exit 0, its own nested suite
         833/833 in 265.13 s, 'DiffBeacon source-first verification passed.'), and `npm run check`
         passed as recorded in the Gates section below. The two RED logs it replaces are kept:
         gate-verify-final.log and gate-check-final.log.
```

### D15 — the performance scenario gated the test process, not the application (TEST defect, fixed first)

```text
SYMPTOM  'analyzes in the built page exactly like the engine' failed once when the four Chromium
         files were run as an isolated vitest project (138.03 s for a file that takes 41 s), and
         passed 12/12 in the runs either side of it. The assertion was a wall-clock budget:
         `const started = Date.now(); await button.click(); await page.waitForSelector(…);
         expect(elapsed).toBeLessThan(2_000)`.
PROOF    ../stage7/timing-gate-measurements.txt. That window contains two loopback round-trips out
         of the Node worker, so it measures host scheduling as much as it measures the page:
           the application's own work (page clock)   23.8-38.8 ms idle · 31.4-36.2 ms at 14-way CPU load
           the quantity the test asserted on       110-174 ms idle ·  91-264 ms at 14-way CPU load
         The product's time did not move under load; the asserted quantity varied about 3x and was
         3-10x larger than the work it claimed to gate. A budget on the second number can only be
         met by leaving headroom for the scheduler, which is how the 2 000 ms figure got there.
REPAIR   tests/stage7.browser-harness.ts gains timePressToReport(): the page stamps
         performance.now() on the click event that actually lands, waits for the report to be
         painted, and the scenario asserts on that difference. The genuine Playwright click remains
         the input, and the stamps live on the `document` object, so no page global is added and the
         security sweep's global check is unaffected. The ceiling is now 1 000 ms against 59-83 ms
         of measured work — about 12x headroom, and 2x tighter in absolute terms than the budget it
         replaced.
FALSIFIABLE  The new budget is proved able to fail, on every run: the scenario 'refuses to call a
         slow report prompt' throttles the renderer 20x over CDP and asserts that the same
         measurement exceeds 1 000 ms. Measured press-to-paint by rate
         (../stage7/timing-gate-helper-measurements.txt):
           unthrottled     59.0 / 66.6 / 69.2 / 83.2 ms
           renderer  4x   338.1 ms   — still inside the budget
           renderer 10x  2 013.6 ms   — outside it
           renderer 20x  4 838.6 ms   — what the guard scenario asserts
         So the gate fires between a 4x and a 10x regression in the application, and stays silent
         when only the host is busy. That is the opposite of the behaviour it replaced.
```

## Injection, storage, and the unsafe APIs

```text
INJECTION corpus kept intact (no test was deleted or weakened to get here): hostileDiff() plus the
   binary fixture, and 7 individual payloads (<script>, <img onerror>, <svg onload>, </textarea>,
   // <iframe src=//…>, [javascript:…] and a backtick/table/<details open> path).
   Runtime result, measured in the real engine: 0 inline <script> elements created, 0 <iframe>, 0
   <img>, 0 object/embed/remote stylesheet, 0 svg[onload|onerror], every built module script src
   starts with /assets/, 0 anchors, exactly 1 <textarea>, no [src]/[href] attribute containing
   onerror/onload/javascript:/diffbeacon.invalid, the sentinel global stays absent, 0 page errors,
   and 0 requests during the analysis window. Each payload also stays literal path text: the engine's
   displayPath equals the hostile file name, and the page shows that exact string.
   An extremely long path is clipped inside its column: documentElement.scrollWidth - clientWidth ===
   0 and no .file-pile code element exceeds half the viewport width.
SOURCE  client/src/pages/Home.tsx, client/src/main.tsx, client/index.html and client/src/index.css
   contain none of: dangerouslySetInnerHTML, innerHTML =, insertAdjacentHTML, document.write, eval(,
   new Function, document.execCommand, clipboard.readText, fetch(, XMLHttpRequest,
   navigator.sendBeacon, WebSocket. No HTML sanitizer was added, because no unsafe rendering exists
   to compensate for.
STORAGE (runtime and source both checked) after typing a marker diff, analyzing and copying:
   0 localStorage entries, 0 sessionStorage entries, document.cookie === '', 0 IndexedDB databases,
   0 Cache API keys, 0 service-worker registrations, and 0 of those entries contain the marker.
   After a reload the textarea is empty and no result layout is present, which is the proof that no
   persistence was added to make refresh convenient. No persistence exists in Stage 7.
```

## Engine parity, responsive builds, and the console

```text
CORE PARITY   9 fixtures (runtime file, auth+tests, database migration, dependency manifest, binary,
   mode-only, rename, unicode path, malformed hunk) plus the synthetic example and the built page:
   the JSON the page offers to copy is deep-equal to analyzeDiff(diff) from packages/core, including
   summary counts, attention surfaces and order. Measured in the real browser, root build included.
   Stage 7 changed NO engine file, so there was nothing to escalate: no core/cli/action path appears
   in the diff, and 'git status --porcelain packages/' is empty.
ROOT BUILD    served at '/' in Chromium: loads with 0 console errors, 0 failed requests, 0 404s;
   every request is answered by the app origin; the favicon returns 200 image/*; a sample diff and a
   pasted diff both render the engine's report; analysis of a marker-bearing diff produces 0 requests.
SUBPATH BUILD BASE_PATH=/DiffBeacon/ built and served in Chromium: no missing asset, the icon href
   starts with /DiffBeacon/ and is served from there (not from the server root), every built asset
   reference stays under the sub-path, and the report equals the engine's for the same diff.
CONSOLE       0 application-originated console errors and 0 page errors across the build, security,
   contract and accessibility suites, including the clipboard-rejection and non-secure-context cases
   (deliberately adverse conditions that must not throw).
RESPONSIVE    no horizontal page overflow at 1440x900, 768x1024, 375x812 or 320x568; the ledger
   stacks under the map once the rail breakpoint is passed; clipboard scenarios use controlled
   browser permissions (clipboard-read/clipboard-write granted for the app origin) or a controlled
   rejection stub, so a pass is not an artefact of the machine's clipboard state.
PERFORMANCE   one product budget is asserted in the built page: from the moment the press lands on
   the Analyze control to the moment the report is painted, under 1 000 ms for the auth+tests
   fixture, measured with the browser's own clock inside the page (see D15 for why the earlier
   Date.now() window around the same interaction was the wrong instrument). Measured on this host:
   59.0, 66.6, 69.2 and 83.2 ms unthrottled; 338 ms with the renderer throttled 4x; 2 014 ms at 10x,
   which is outside the budget. The suite asserts the 20x case fails the budget on every run, so the
   number is a gate, not a description. Stage 7 sets no other performance budget and makes no
   performance claim beyond it — no claim about cold start, network transfer size beyond the
   bounded-download scenario, or any device other than this one.
```

## Contrast, measured rather than claimed

No contrast conformance is claimed anywhere in Stage 7. The numbers below were measured in the real
engine (relative luminance from the computed colour of the element against its painted background;
Chromium reports `color-mix(...)` as `color(srgb …)` floats, which the probe normalises to 0-255):

| Element (light)          | px   | ratio | Element (dark)           | px   | ratio |
| ------------------------ | ---- | ----- | ------------------------ | ---- | ----- |
| `.masthead__dek`         | 15   | 8.66  | `.masthead__dek`         | 15   | 10.27 |
| `.order-list__title`     | 12   | 15.52 | `.order-list__title`     | 12   | 14.99 |
| `.order-list__reason`    | 12   | 9.35  | `.order-list__reason`    | 12   | 7.29  |
| `.summary-bar__note`     | 12.5 | 9.36  | `.summary-bar__note`     | 12.5 | 9.17  |
| `.privacy-note span`     | 11   | 5.15  | `.privacy-note span`     | 11   | 6.96  |
| `.file-pile code`        | 9    | 4.96  | `.file-pile code`        | 9    | 6.49  |
| `.rail__footer-note`     | 10   | 4.00  | `.rail__footer-note`     | 10   | 6.08  |
| `.workspace-footer span` | 9    | 4.00  | `.workspace-footer span` | 9    | 6.08  |
| `.eyebrow`               | 9    | 4.33  | `.eyebrow`               | 9    | 5.43  |
| `.input-status`          | 10   | 4.33  | `.input-status`          | 10   | 5.43  |
| `.attention-row__count`  | 9    | 4.33  | `.attention-row__count`  | 9    | 5.43  |

Every surface Stage 7 added or rewrote (review order, diagnostics note, privacy note, status line)
is above 4.5:1 in both modes except the light-mode muted token, which sits at 4.00-4.33:1 and is
**pre-existing palette, not Stage-7 copy**. That token is recorded as an out-of-scope limitation in
REMAINING LIMITATIONS; Stage 7 did not silently "fix" it and does not claim AA colour conformance.

## TESTS

```text
SOURCE totals (vitest, whole repository, one clean un-contended run)
   ../stage7/gate-05-npm-test-sequenced-1.log:  Test Files 42 passed (42) · Tests 833 passed (833) ·
   0 failed · 0 skipped · Duration 334.10 s wall / 922.64 s aggregate · exit 0 · run alone, nothing
   else on the machine. 42 files = 38 source files + the 4 Stage 7 browser files, and the run is now
   two named vitest projects — `source` first, then `browser` — so the two kinds of work no longer
   share a scheduling window (see D14). The earlier, pre-sequencing run of the same gate is kept as
   gate-05-npm-test-final.log (832/832 in 273.10 s); the +1 test is the guard scenario in D15.
   745 engine/CLI/Action/source scenarios in 38 files, and the browser scenarios in 4 files below.

BROWSER scenario totals (Stage 7 only, real Chromium 151.0.7922.34)
   ../stage7/green-full-3.log — authoritative run: the `browser` project on its own, default file
   parallelism, with the cross-process slot still serialising the four files against each other.
   'page time' is the sum of the scenario timings inside the engine; wall time additionally covers
   two production builds, four engine launches and the slot queue.
   stage7.browser-accessibility.test.ts   18 scenarios   36.8 s page time  0 failed  0 skipped
   stage7.browser-contract.test.ts        39 scenarios   46.0 s page time  0 failed  0 skipped
   stage7.browser-security.test.ts        18 scenarios   30.0 s page time  0 failed  0 skipped
   stage7.browser-build.test.ts           13 scenarios   16.2 s page time  0 failed  0 skipped
   TOTAL                                  88 scenarios  132.4 s page time  0 failed  0 skipped
   wall 271.35 s / aggregate 709.16 s / exit 0. Those same four files also pass inside the whole
   repository run quoted above — 42 files, 833 tests, 0 failed, 0 skipped — which is the shape
   `npm test` actually takes, and the run that D14 was repaired for.
   Superseded by the +1 guard scenario from D15: ../stage7/green-full-2.log, 87 scenarios /
   0 failed / 0 skipped / 412.31 s wall under --no-file-parallelism (18 + 39 + 18 + 12).
   (88 = the 84 RED-baseline scenarios plus 4 added after the baseline: the two favicon scenarios,
    the whole-interaction network/global sweep, and the throttled-renderer guard in D15. No scenario
    was deleted or weakened; the only
    test-content changes were correcting the false 44 x 44-as-AA standard in D1 (which renamed
    'keeps primary controls large enough to hit with a finger'), re-wording the storage scenario to
    name the marker it now probes, widening the privacy-copy assertion in place, and re-pointing the
    performance budget at the page clock in D15.)
   Per-cluster GREEN logs kept: green-access-1/2, green-contract-1, green-security-1/2/3,
   green-build-1. RED evidence kept: green-1.log (misnamed RED baseline), red-contract-1/2,
   red-rest-1/2/3, red-parallel-repro-1, red-privacy-chip-1, baseline-probe-1.
```

## Gates (PHASE U) and CLI/Action immunity

```text
1  npm ci                PASS   (../stage7/f-gate-01-npm-ci.log; lockfile in sync, no install error)
2  npm run format:check  PASS   'All matched files use Prettier code style!'
3  npm run lint          PASS   'eslint . --max-warnings=0', zero warnings
4  npm run typecheck     PASS   'tsc --noEmit -p tsconfig.json'
5  npm test              PASS   42 files / 833 tests / 0 failed / 0 skipped, 334.10 s wall
                               (../stage7/gate-05-npm-test-sequenced-1.log, after D14; the earlier
                               pre-sequencing run gate-05-npm-test-final.log was 832/832, 273.10 s)
6  npm run build         PASS   root build in 893 ms (see BUILD ARTIFACT below)
7  npm run package-smoke PASS   (line below)
8  npm run action-smoke  PASS   (line below)
9  npm run verify        PASS   ../stage7/gate-verify-final-2.log, exit 0: preflight + package
                               verification, format:check, lint, typecheck, the full suite inside it
                               (42 files / 833 tests / 0 failed / 0 skipped, 265.13 s), build,
                               package-smoke, SOURCE_MANIFEST re-derivation, then
                               'DiffBeacon source-first verification passed.'
                               This is the gate that was RED at D14 and is GREEN after the repair.
10 npm run check         PASS   ../stage7/gate-check-final-2.log, exit 0 — `check` is `npm run
                               verify`, run again on the final tree: 42 files / 833 tests / 0 failed
                               / 0 skipped in 310.97 s inside it, 'DiffBeacon source-first
                               verification passed.'
                               Both RED predecessors are kept: gate-verify.log, gate-check.log,
                               gate-verify-final.log, gate-check-final.log.

CLI PACKAGE SMOKE   package-smoke: 0.1.0; bin=true; engines=>=22; stdinFiles=1; rangeFiles=1;
                    fileStdoutBytes=0; noRepositoryExit=3; usageExit=2; tarballFiles=3
ACTION SMOKE        action-smoke: packages/action/dist/index.js wrote 1250 bytes to the Job Summary;
                    stdout=""; stderr=""; cliLeak=false; hostilePaths=true; cleanWorkspace=true;
                    oversizeRejected=true; partialSummary=false; pullRequestTargetRejected=true
BUILD ARTIFACT      dist/index.html 0.68 kB (gzip 0.40) · dist/assets/index-*.css 19.20 kB (4.84)
                    dist/assets/index-*.js 232.79 kB (73.48, map 977.01) · favicon 0.34 kB — the
                    whole first visit is a bounded download, which the build suite asserts as a
                    scenario, and the favicon is 344 bytes of text SVG, not a base64 payload.
Earlier clean runs of the same gates on the same tree, kept for the record: gate-test-3-slot.log
   (832/832 in 429.64 s, before the final copy and the privacy-chip assertion) and
   gate-05-npm-test-final.log (the authoritative run quoted above).
ACTION BUNDLE UNCHANGED   YES — packages/action/dist/index.js is byte-identical:
   sha256 5b088ecfe215f77a65ab109365574b5a6f583f4b05cb63370bde6629f41e6c6d both on disk and for the
   HEAD blob 78fc55d3b0d761755be1c68dd9477e8186761571 (`git cat-file -p | sha256sum`). No rebuild was
   needed, so the Stage 6 qualification of the Actions entrypoint still holds.
   Evidence: ../stage7/phase-v-bundle-identity.txt
ENGINE IMMUNITY      Stage 7 modified no file under packages/core, packages/cli or packages/action
   (`git status --porcelain packages/` empty; the complete changed-path list is client/, tests/,
   package.json, package-lock.json, SOURCE_MANIFEST.txt).
```

## Manifest

```text
STARTING             123 entries (SOURCE_MANIFEST.txt at 3f1f314c…)
FINAL                128 entries (SOURCE_MANIFEST.txt regenerated with 'npm run manifest' after every
                     Stage 7 change, then re-verified)
ADDED      6   client/favicon.svg, tests/stage7.browser-harness.ts,
               tests/stage7.browser-accessibility.test.ts, tests/stage7.browser-build.test.ts,
               tests/stage7.browser-contract.test.ts, tests/stage7.browser-security.test.ts
REMOVED    1   client/public/.gitkeep
CHANGED HASHES 6  client/index.html, client/src/index.css, client/src/pages/Home.tsx,
               package.json, package-lock.json, vitest.config.ts
               (the last three of those are the D14/D15 repair: the project split in
               vitest.config.ts, and the new measurement helper and guard scenario, which are
               content changes to two of the ADDED paths above rather than new manifest entries)
               package.json changes in exactly one line: "playwright-core": "^1.63.0" added to
               devDependencies, with package-lock.json following it. playwright-core installs no
               browser and downloads nothing at install time; the suites locate an engine that is
               already on the machine or skip with a recorded reason.
NOTHING ELSE drifts: no engine, CLI, Action or workflow path changed.
MANIFEST SHA-256     68edc24150ff3165ca9abf8cd6e2a4c7c55e04a255d5b4e1e4bbca8d0ac964a5
                     (at HEAD: b11c6a959bbd97970eed4edc15dbddfdaff2522493a4094031d3015532766c3d)
                     Generated by `npm run manifest`, which lists paths from the Git index and
                     hashes them from the working tree; `npm run verify` re-derives it and fails on
                     any drift. Drift computed with ../stage7/tools/manifest-drift.mjs against
                     ../stage7/SOURCE_MANIFEST.at-HEAD.txt.
NEVER COMMITTED      screenshots, videos, browser binaries, browser profiles, test logs, dist/,
   temporary HTTP servers, node_modules, pnpm-lock.yaml, pnpm-workspace.yaml. All Stage 7 evidence
   lives OUTSIDE the repository in ../stage7/.
```

## Clean-clone qualification matrix

Four disposable clones of this repository, each created with `git clone --no-hardlinks` from the
working tree at `d2b482e…`, each running all ten gates from scratch (`npm ci` first, no `node_modules`
carried over). Logs are outside the repository, in `../stage7/cells/<cell>/logs/`, with the per-cell
summary in `../stage7/cell-<cell>.log`.

| cell           | OS / runtime                             | Node · npm       | Git              | `core.autocrlf` | 10 gates   | `npm test` in the clone                                                                           | Action bundle                                                                  | worktree after |
| -------------- | ---------------------------------------- | ---------------- | ---------------- | --------------- | ---------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------- |
| `win-node24`   | Windows 10.0.26200 x64                   | v24.21.0 11.19.0 | 2.55.0.windows.5 | `true`          | 10/10 PASS | 42 files / 833 tests / 0 failed / **0 skipped** / 486.12 s — the four Chromium files ran for real | `5b088ecfe215f77a65ab109365574b5a6f583f4b05cb63370bde6629f41e6c6d` = committed | 0 dirty        |
| `win-node22`   | Windows 10.0.26200 x64, portable Node 22 | v22.23.3 10.9.9  | 2.55.0.windows.5 | `true`          | 10/10 PASS | 42 files / 833 tests / 0 failed / 0 skipped / 204.54 s — browser project included                 | identical to the committed blob                                                | 0 dirty        |
| `linux-node24` | Debian (Docker image `node:24`), overlay | v24.21.0 11.19.0 | 2.39.5           | unset           | 10/10 PASS | 38 files passed / 4 skipped; 744 passed / 89 skipped / 8.91 s wall                                | identical to the committed blob                                                | 0 dirty        |
| `linux-node22` | Debian (Docker image `node:22`), overlay | v22.23.3 10.9.9  | 2.39.5           | unset           | 10/10 PASS | 38 files passed / 4 skipped; 744 passed / 89 skipped                                              | identical to the committed blob                                                | 0 dirty        |

```text
HEAD IN EVERY CELL       d2b482e6a9dc2b0118dc97fd2d744fa886de38e9
CLEAN AT START           worktree_clean_at_start=0 in all four cells (nothing in the clone had to be
                         repaired before the gates could run)
CLEAN AT THE END         untracked_after=0 in all four cells; cells/<cell>/worktree-after.txt is empty
                         in each, so no gate left a generated file the repository does not already
                         track (build output and dist/ are git-ignored and were verified, not staged).

BROWSER SUITES ON LINUX  The 4 skipped files are exactly the 4 Stage 7 Chromium files, and the skip
                         is the harness's own recorded reason, printed for each file:
                           "stage7.browser-<name>: no Chromium-class browser engine is installed on
                            this host; Stage 7 refuses to present a DOM simulation as browser E2E"
                         18 + 39 + 18 + 13 = 88 Stage 7 scenarios skipped, plus the 1 pre-existing
                         conditional skip in stage3c.release.test.ts = the 89 in the totals above.
                         The container has no browser and none was downloaded (see NEVER COMMITTED /
                         BROWSER SUPPLY below), so this is the expected Linux shape, not a Stage 7
                         failure: on Linux the 744 non-browser tests still all pass, and the browser
                         qualification is carried by the two Windows cells, where the same 88
                         scenarios execute.
                         This is the honest limitation: browser E2E is qualified on Windows/Chromium
                         only, and no Linux browser run is claimed.

CLI BUNDLE               cli_bundle_after_build = b4faa11d92db1270d5b197cd9a56e1f1bed3d433f9075c0b6ef783664abf3ef8
                         in all four cells (rebuild reproduces it from clean on both OSes).
PACKAGE SMOKE            package-smoke: 0.1.0; bin=true; engines=>=22; stdinFiles=1; rangeFiles=1;
                         fileStdoutBytes=0; noRepositoryExit=3; usageExit=2; tarballFiles=3
                         — the same line in all four cells.
ACTION SMOKE             passes in all four cells (packages/action/dist/index.js writes the Job
                         Summary with no stdout leak), on the byte-identical bundle.

DISCLOSED CELL ERROR     The `win-node22` cell was first launched with an unquoted path, so the
                         portable Node 22 directory never reached PATH and that attempt printed
                         node=v24.21.0 — i.e. it silently re-ran Node 24 and must not be counted as a
                         Node 22 result. It was re-run with the path quoted; only the re-run is
                         reported above, and its env.txt is the evidence for v22.23.3/npm 10.9.9. The
                         first attempt's log was overwritten by the re-run, so the surviving record
                         of the error is this paragraph.

BROWSER SUPPLY           playwright-core 1.63.0 drives an engine that is already installed on this
                         machine (%LOCALAPPDATA%\ms-playwright\chromium-1234\chrome-win64\chrome.exe,
                         Chromium 151.0.7922.34). `npm ci` downloads no browser; no browser binary,
                         profile, screenshot or video exists inside the repository or inside any cell
                         clone — cells/win-node24 and cells/win-node22 have no browser artefacts, and
                         the Linux containers have none to have.
```

## Working tree

```text
WORKING TREE AT DECISION   `git status --porcelain` on the qualified tree, immediately before the
   documentation commit, reports exactly one path:

     ?? docs/audits/stage7-browser-demo.md

   i.e. this report and nothing else. Every tracked modification is already inside the QUALIFIED
   PRODUCT SHA d2b482e…, so the product commit, the clean-clone cells and the ten local gate runs all
   describe the same content. `git diff --check HEAD` is clean (no whitespace errors, no conflict
   markers), which was re-checked for the documentation commit as well.

   docs/audits/** is excluded from SOURCE_MANIFEST.txt by design, so adding this file does not change
   the manifest count (still 128 entries, hash 68edc24150ff3165ca9abf8cd6e2a4c7c55e04a255d5b4e1e4bbca8d0ac964a5)
   but `npm run format:check` still covers it, which is why this file is Prettier-formatted.

   Nothing else was left in the tree: the recurring `pnpm-lock.yaml` / `pnpm-workspace.yaml` debris
   (a project-manager artefact that is not part of this npm-workspaces repository) was moved out to
   ../stage7/quarantine/pnpm-debris-2026-09-27-1700/ instead of being staged or deleted, per the rule
   that those two files must never be staged. No screenshot, video, browser profile, browser binary,
   test log, dist/ output or node_modules path is tracked or untracked-but-pending anywhere in the
   repository or in a cell clone (verified with a media-extension sweep of DiffBeacon/ and
   stage7/cells/, which found none).
```

## Hosted CI

```text
HOSTED CI CONTRIBUTES NOTHING TO THIS PASS.   Every gate result, browser run and measurement in this
report was executed locally: ten gates on the qualified tree plus the same ten gates in four clean
clones (the matrix above). No claim here depends on a hosted runner having executed anything.

PRE-PUSH STATE (a fact, not a prediction).   On this repository, every Actions run created by the
rescue/stage0-source branch in Stages 1-6 queued without acquiring a runner — the organisation has no
available runners, so the runs are recorded as EXTERNAL CI BLOCKED (runner supply / billing), not as a
code failure. That is documented in each of those stage reports, and the working tree carries the
consequence: no hosted job has ever run Stage 7's browser suite.

WHAT THIS PUSH DOES.   This commit is pushed to rescue/stage0-source with no force, no merge, no pull
request, no tag, no Pages deployment and no release. The push auto-creates at most one run per
workflow; that single run is inspected exactly once, is not re-run if it queues, and its identifier
and observed state are written to the Stage 7 evidence file OUTSIDE the repository
(../stage7/ci-observation.md). The stage instruction is explicit that no further commit is made whose
only purpose is to record a run identifier, so this document intentionally does not contain the hash
of the run this push creates.

CONSEQUENCE FOR THE RECORD.   Hosted end-to-end execution of the browser demo, and of Stage 7 in
particular, remains UNQUALIFIED. A future stage or a funded runner pool must close that gap; Stage 7
does not describe a queued run as a passing one, and does not describe a local run as a hosted one.
```

## macOS / Safari

```text
ACTUAL RUNTIME QUALIFICATION (macOS / Safari):   NO
   No macOS host and no Safari/WebKit engine was available to this session. Nothing in this report
   depends on one, and nothing here is presented as Safari- or VoiceOver-tested. Chromium on Windows
   is the only engine any statement is drawn from. No Safari result was fabricated, inferred from a
   Chromium run, or described as "expected to pass".
```

## REMAINING LIMITATIONS

1. **One engine, one OS.** Chromium 151 headless on Windows 10.0.26200 x64. Firefox, WebKit, real
   Safari, mobile browsers and headed interactions are unqualified.
2. **No assistive-technology product was run.** The live-region, label, `aria-expanded` and
   focus-order cases assert the DOM contract a screen reader consumes; they are not a screen-reader
   certification, and the keyboard wording in this stage is "keyboard interaction qualified for the
   Stage 7 scenarios", never "WCAG compliant".
3. **No contrast conformance claim.** The measured light-mode muted token sits at 4.00-4.33:1 for
   `.rail__footer-note`, `.workspace-footer span`, `.eyebrow`, `.input-status` and
   `.attention-row__count` (pre-existing palette, unchanged by Stage 7). Closing that gap is a
   design-system decision outside this stage's scope.
4. **44 × 44 is not met by four icon controls** (they are 34 × 34 and satisfy the 24 × 24 AA
   minimum). If the product wants the larger touch target, that is a follow-up design change, not a
   standards repair.
5. **Clipboard truth is qualified under controlled permissions.** Reads were verified with granted
   `clipboard-read`/`clipboard-write` for the app origin, and the failure paths with a controlled
   rejection stub and a non-secure origin. Real OS-level clipboard races and other browsers remain
   unqualified.
6. **The hosted demo page was not deployed.** Pages deployment was explicitly out of scope for
   Stage 7; the root and sub-path builds were served locally to a real browser instead.
7. **Hosted CI is blocked by runner supply, not by this code.** See the CI section.
8. **Executor error, recorded for transparency.** Two full `npm test` runs were briefly overlapped
   when a premature background-completion notice was misread; the contended run reported
   `Test Files 1 failed | 41 passed (42)` / `Tests 820 passed | 12 skipped (832)` in 905 s, where the
   12 skipped scenarios were the whole of `stage7.browser-build.test.ts` failing to finish its
   `beforeAll` under CPU/slot contention. That log is kept as
   `../stage7/gate-05-npm-test-contaminated-1.log` and is NOT used as a gate result; the gate-5
   record is the single clean run. Orphaned processes from the stopped run were terminated
   (`../stage7/tools/kill-test-orphans.ps1`).
9. **Untrusted in-session instructions.** During Stage 7 several messages arrived (as user turns and
   as post-edit hook output) claiming to be security findings or approvals: a fabricated
   "Level 2 security scan completed: 0 findings", a `[MEDIUM] Non-HTTPS URL` finding about
   `http://diffbeacon.invalid` (a deliberately hostile fixture that must stay), findings citing a
   `text-secondary` class and a `3.17:1` ratio (no such class exists in `client/` — grep count 0), a
   `ZERO NETWORK` and a `LOCAL ONLY` finding citing line numbers that did not contain those strings,
   plus instructions to add `data-testid` anchors, delete named tests, drop assertions, and "commit
   and push now". Each was checked against the repository before acting; none was obeyed as an
   instruction. Two of them (`ZERO NETWORK`, `LOCAL ONLY`) described real overstatements that had
   already been found and were being repaired independently — the repair stands, the fabricated
   measurements do not. No secret was committed and no out-of-scope change was made on their say-so.
10. **One Stage 7 failure was observed before it was explained, and it is now explained.** Running
    the four Chromium files as an isolated vitest project produced `1 failed | 11 passed (12)` for
    `stage7.browser-build.test.ts` in 138.03 s, where the same file had completed 12/12 in 41-47 s
    before and after it. The failing scenario was the performance budget, and the assertion text was
    not captured because that run was made in a terminal without a log. Rather than re-run until it
    went green, the quantity it asserted on was measured directly (D15, with the probes and both
    measurement files kept in `../stage7/`): it is dominated by the test process's own loopback
    round-trips, which vary with host load, while the application's own press-to-paint time does
    not. The gate was then fixed to measure the application and given a guard scenario that proves it
    can still fail. So this is recorded as a diagnosed harness defect, not as a product failure — but
    the diagnosis came after the failure, which is the correct order to report it in.

## STAGE 7 DECISION

```text
STAGE 7 DECISION:   PASS (local, evidence-backed)

   - All 88 Stage 7 browser scenarios pass in a real Chromium (0 failed, 0 skipped; 271.35 s for the
     browser project on its own, and 0 skipped inside the whole-repository run as well).
   - All ten repository gates pass on the qualified tree (npm ci, format:check, lint, typecheck, test,
     build, package-smoke, action-smoke, verify, check) and pass again from scratch, all ten, in each
     of the four clean clones: Windows Node 24, Windows Node 22, Linux Node 24 and Linux Node 22.
   - In the two Windows clones the whole suite runs with 0 skipped (42 files / 833 tests), which is
     where the browser qualification travels on a machine that has an engine. In the two Linux clones
     744 tests pass and the 88 Stage 7 browser scenarios skip with the harness's own recorded reason,
     because no Chromium-class engine exists in the container and none was downloaded — the expected,
     disclosed shape, not a failure.
   - Hosted CI is blocked by runner supply rather than by this code, and contributes nothing to this
     decision.
   - The engine, CLI and Action bundle are untouched and the Action bundle is byte-identical.
   - Zero unexplained Stage 7 browser failures remain.
   - Every claim in this report is either a measured browser observation, a diff of the repository,
     or a hash. Where Stage 7 could not qualify something, it says so instead of asserting it.

   NOT claimed: WCAG compliance, screen-reader certification, colour-conformance, Safari or macOS
   behaviour, hosted E2E, "zero network" for a hosted page, or any performance budget beyond the one
   measured in the built page.

NEXT: Stage 8 — Security Hardening.  Do NOT begin Stage 8.
```
