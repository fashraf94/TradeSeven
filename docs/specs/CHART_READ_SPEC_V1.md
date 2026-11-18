# The measured read on the Chart view — spec of record V1

**Status:** spec of record, as built (Claude Code, 18 Nov 2026). **Basis:** the build prompt *The measured read on the Chart view* of 18 Nov 2026 (the AssetResearch planning chat); Claude Design round 6 (`docs/design/research-modal/Research Modal - Round 6 (standalone).html`); the spec of record `docs/specs/CHART_EVIDENCE_SPEC_V1.md` (the read route); the founder's rulings ACX-1 – ACX-7 (15 Nov) and CR-1 – CR-10 (18 Nov). **Built on:** `main` at `2e069d42` (#1086). **Report:** `docs/audits/20261118_BUILD_CHART_READ.md`.

**Three PRs, each with `main` as its base, merged in order A → B → C:**

| PR | Branch | Holds | Flag |
|---|---|---|---|
| A | `claude/chart-read-engine` | the route's `previous`, the marks table, the wording, the change table (pure), their tests | `CHART_READ_MODE = 'off'` |
| B | `claude/chart-read-surface` (contains A) | the read, the marks on the chart, the Rule chip, the sheet, the unadjusted candles, this spec, the report, the round 6 file | `'off'` |
| C | `claude/chart-read-allowlist` (contains B) | `CHART_READ_MODE = 'allowlist'` and its pin, one commit | `'allowlist'` |

---

## 1. Rulings adopted

| # | Ruling |
|---|---|
| CR-1 | The design of record is round 6, screens A – F and H, with the changes below. Screen G (the Ask's answer) is a later build. |
| CR-2 | Each mark number names exactly one value, from a fixed table per rule set (§4). The same number means the same thing on every stock. |
| CR-3 | The sheet groups checks by purpose, not by passed and failed (§6). The sector rank is context, shown apart from the rule. |
| CR-4 | Marks are short ticks on the record's day, never lines to the chart's edge. With SMA on, the 20-day and 50-day marks sit on the drawn averages (§9: within half a cent). |
| CR-5 | A "Rule" chip joins SMA · S/R · Idea, on by default. It shows and hides the marks. |
| CR-6 | The "what changed" line ships in this build. |
| CR-7 | The 1D candles are unadjusted wherever the read shows (ACX-3), marked once as *prices unadjusted*. |
| CR-8 | The read is named by the playbook's strategy, not by an archetype: eyebrow *Setup check · daily*; the sheet's footer *Rule set tf-setup-v1 · built as Trend Follower's setup check*. |
| CR-9 | The read is keyed by rule set and strategy family (`MARK_TABLES`, `RULE_SET_COPY` by `setupVersion`): a second detector adds a table and a wording set and changes no existing one. |
| CR-10 | No archetype line, identity check or plan in this build. |

### 1.1 Readings made where the prompt is silent or the code differs (approve-by-default, listed in the report)

| # | Reading |
|---|---|
| R-1 | **The uptrend is two recorded checks, not three.** `regime_stack` chains `[C, SMA_fast] > [SMA_fast, SMA_slow]` and records one result. The sheet's three uptrend rows and RD-7's words read each pair from that check's own recorded sides with its own operator (the evaluator's strict comparison, no tolerance); row 1 is the recorded `pullback_close` check (the same sides). The pairs must AND to the recorded result, else the record is not shown (`unshown`). The two downward mirror checks are not rows (§6's order lists none); they decide `regime: 'downtrend'`, which the lead's second line reflects (RD-7). |
| R-2 | **The client's gate is the route's answer.** The per-player allowlist verdict exists only on the server; the client's film-room verdict is per battle and a browse mount has none. So `'allowlist'` and `'on'` make one request on a stock's Chart view; a 404 `chart_read_unavailable` (not admitted) or a 400 (not one of the ranked stocks) is no slot. `'off'` makes no request. |
| R-3 | **RD-7 at equality.** A failed check is worded true at equality too: *closed at its 20-day ({1})*, *the 20-day is level with the 50-day*, *the 50-day is flat over five sessions*. |
| R-4 | **Mark 4 is the `pullback_touch` check's `lhs`** — the evaluator's recorded minimum of `pullbackLows[].low` (pinned equal), sitting on the most recent of the three sessions whose low is that value. |
| R-5 | **Mark 3's day** is five sessions before the record's day, counted on the daily series' own dates (the same on 1D and 1W). |
| R-6 | **The candles are unadjusted under every read that shows** (any answer, a quiet state included); after a failed read, or with no slot, they stay today's. |
| R-7 | **The Battle chart's read** keeps its lead, drops its second line and carries round 6 F's note *Daily marks are on 1D and 1W, not on these 30-minute bars.* |
| R-8 | **While the sheet is open** the action row gives way to it and the plot yields height to about 42 % of the view (round 6 B: a 300 px plot over 844), so the sheet starts at the plot's lower edge; on a short screen it takes at least 45 % of the view and rises over the plot's lower part. |
| R-9 | **The other pattern's group** reads *not present* in quiet ink in either valid state (the prompt names Pullback; Breakout is treated the same), unless that pattern is satisfied too. |
| R-10 | **An unknown rule set**: one line, *Measured by rule set {x}; this app can't show that rule's marks yet.*; no marks, no sheet. A record whose numbers cannot be worded (a needed fact null, an off-list reason, a chain that disagrees with its pairs) is one line, *This record can't be shown.* |
| R-11 | **An earlier record the projection cannot read** throws (500), never a null `previous`. A refused `read` still carries its `previous` (RD-1 names only a null read). |
| R-12 | **Prices print half up from the record's shortest decimal** (`format.js`), never `toFixed`'s binary rounding (141.105 → $141.11). |

---

## 2. Phase 0

The eight findings, with citations, are in the report §2 and PR A's description.

---

## 3. The route's addition (PR A) — RD-1 – RD-5

`GET /api/research/setup-read` gains one body key, `previous` (`SETUP_READ_BODY_KEYS`):

```
{ answer, symbol, servedAt, sessionsTried, read, previous }
previous: null | { session, verdict, reason, pattern, regime, patternsSatisfied, checks: [{ id, result }] }
```

- Copied through `projectPreviousRecord` (`api/_utils/setupRead/projection.js`), the projection's own copy, so the same refusals hold. No facts, no prices (`SETUP_READ_PREVIOUS_FIELDS`, `SETUP_READ_PREVIOUS_CHECK_FIELDS`).
- The session before `read.session` is `sessionBefore()` (noon UTC on the session's own date → `lastCompletedSessionAt`); null outside the calendar.
- Reads: `read`'s one or two, then one more when `read` is a record: 0 to 3 a call, all through the route's single `readSnapshot` call site and the same 60-second cache. Read-only as before.
- The client read (`setupRead.js`) accepts exactly this body: `previous` null or exactly its fields; `absent` carries `previous: null`.

---

## 4. The marks (MK-1 – MK-7)

`src/components/Research/ChartRead/marks.js`: one frozen table per rule set.

| # | Id | Value | Drawn as |
|---|---|---|---|
| 1 | `sma_fast` | `facts.SMA_fast` | a tick on the record's day |
| 2 | `sma_slow` | `facts.SMA_slow` | a tick on the record's day |
| 3 | `sma_slow_5ago` | `facts.SMA_slow_5ago` | a tick five sessions before |
| 4 | `touch_low` | the `pullback_touch` check's `lhs` | a bracket under the three sessions, a tick at the low |
| 5 | `swing_high` | `swingHigh.value` at `.date` | a tick at its bar |
| 6 | `swing_low` | `swingLow.value` at `.date` | a tick at its bar |
| 7 | `extension_limit` | the `extension` check's `rhs` | a tick on the record's day |

A mark exists only when its value is finite (MK-1). Shown by default (MK-3): valid · Pullback 1, 4, 5, 6; valid · Breakout 1, 5; not in an uptrend 1, 2, 3; no pattern 1, 4, 5; stretched 1, 7; with the sheet open, every mark that exists. A mark is cited as `tf-setup-v1 · 2026-11-17 · touch_low` (§12).

**How they are drawn** (`ruleMarksPrimitive.js`): a lightweight-charts 5 series primitive on the candle series. The library calls its pane view in its own render pass; the view places each mark with `timeToCoordinate` / `priceToCoordinate` at that moment, so the marks stay on their bars through pan, zoom, resize, rotation and price-scale drags (measured, report §5). Neutral ink, solid, never dashed; a tick seven bars wide centred on its bar; the number in a 13 px square; a lit mark 2.4 px with a filled square and its value on the price scale. Re-attached when the chart rebuilds its series; lit / unlit is `setScene` + `requestUpdate`. 1D and 1W only (`placeMarks.js`: 1D the day's own bar, 1W the week bar holding the day, no bar → nothing); on the Battle chart only the 20-day stub at the right edge, *20-day · daily · {Tue} close* (MK-5). The idea line, 💣's rungs, the entry line and the S/R lines are unchanged; no stop is drawn (MK-6).

---

## 5. The read (§5)

`chartRead.js` `readLineOf(body, { todayEt, todayIsSession, battle })`, every word from `chartReadCopy.js`:

| State | When | Lead | Second line |
|---|---|---|---|
| `valid_pullback` | valid · pullback_resume | *Pullback and Resume · present — touched its 20-day ({1}) and closed back above it.* | *Volume isn't part of this pattern; participation is unconfirmed.* |
| `valid_breakout` | valid · breakout | *Trend Breakout · present — closed at or above the 20-session high ({5}) on {x}× average volume.* | — |
| `regime` | invalid · regime | *Not in an uptrend — {the failed checks}.* | *It changes with closes back above the 20-day and the 50-day turning up. This is not a downtrend call.* (downtrend: the last sentence dropped) |
| `no_setup` | invalid · no_setup | *In an uptrend; no entry pattern today.* | *A pullback needs a low at or below the 20-day ({1}). A breakout needs a close at or above {5} on 1.5× average volume.* |
| `extended` | invalid · extended | *{pattern} pattern present, but stretched — the close is more than 2 ATR above the 20-day.* | *The check says wait.* |
| `unknown` | verdict unknown | *Not enough to read — {the missing facts}.* | — (no sheet) |
| `refused` | answer refused | *No read for this stock today — {the reason}.* | — (no sheet) |
| `absent` | answer absent | *Measured after each close; no read yet for this stock.* | — (no sheet) |

The date: *as of Tue Nov 17 close*; behind: *As of Mon Nov 16 close (today's isn't in yet)* (RD-9). Footnotes: RD-8 *{Tuesday}'s close. Today's session is read after it ends.* on a trading day whose record is not in yet (`src/utils/marketCalendar.js getSessionForDate`); RD-10 *The split check couldn't run on this record.*; on Battle the R-7 note. A failed read (network, 5xx, 429, a body outside the contract): *Couldn't load the setup check* and *Try again* (RD-12). Refusal reasons are the adapter's closed list (`ADAPTER_REFUSALS`, pinned equal). Never *will*, *likely*, *should buy*, *live*, or a stop or a target beside a price (RD-13; `sheetCopy.honesty.test.jsx` scans the copy).

**What changed** (`changeOf`, CR-6): the first matching row of `CHANGE_TABLE` — not valid → valid · pullback; not valid → valid · breakout; valid → extended; valid → no_setup; uptrend → not; not → uptrend. "Not valid" is `invalid` only; an unknown on either side, no previous record, or an unlisted pair shows nothing.

**Where:** the band between the plot and the Technical content, after the record-day chips (`AssetResearchModal.jsx`). No slot for crypto, an index or a sector fund (the shell is off for them, R-35; no request).

---

## 6. The sheet (SH-1 – SH-5)

`ChartReadSheet.jsx` over `sheetOf(body, { sector, expanded })`: the head (lead, date, *tap a check to light its mark*); **The uptrend** *{n} of 3*; **Pullback and Resume** *{n} of 2*; **The stretch guard**; **Trend Breakout** *the other pattern*; **Context, not part of the check** (the sector rank from `stockTechnicalScores/{SYM}.factors.sectorRSPercentile` and `updatedAt`, read with `useTechnicalScore` only while the sheet is open, or *no reading*); **The other reading** and **What separates them** per state; the footer. Each row: its name, both sides with their numbers, its plain definition, its mark numbers (only those that exist). A tap lights the row's marks and scrolls nothing; a second tap clears them. When the uptrend fails the pattern groups collapse to *Entry patterns are read only in an uptrend.*; a tap expands them. A layer: `role="dialog"`, `aria-modal`, focus moved in and trapped, Escape closes only the sheet, focus returns to the read; reduced motion: no rise.

---

## 7. The unadjusted candles (UC-1 – UC-5)

`prepareChartData(rawData, { basis: 'raw' })` draws each candle as traded; absent, the candles are scaled by adjusted close ÷ close exactly as before (pinned against the pre-build transform). The modal passes it on 1D wherever the read shows (`chartProps.js`), with *prices unadjusted* under the OHLC row. The hook's live patch keeps the stored adjusted close on today's row (`useResearchData.js`), so only the raw path draws the live price as the last close (UC-4). 1W rows carry no adjusted close and the Battle bars are unscaled: unchanged (UC-5).

---

## 8. Flags

| Flag | Where | Ships (A, B) | C |
|---|---|---|---|
| `CHART_READ_MODE` | `src/config/researchModalFlags.js`, resolved at call time by `resolveChartReadMode()` | `'off'` | `'allowlist'` |

`'off'`: no request, no element, no library call; the Chart view as before. The route answers 404 to everyone. `'allowlist'`: the route admits a player `isCockpitOwnerAllowlisted` names; the client asks and shows a slot only on a 200. From search the read appears once the shell itself is on for everyone (`RESEARCH_MODAL_SHEET_MODE = 'on'`, a separate founder flip). `'on'` is a later one-line founder PR.

---

## 9. Display agreement (BUILD_RULES §9)

One field, one formatter: a mark's price, the lead's and the sheet's are one string (`format.js formatPrice` on the record's field; the lit mark's axis label is the same formatter). The 20-day and 50-day marks against the chart's drawn averages: the same float mean of the same raw closes; the record keeps 4 decimals, the chart rounds to 2. They print the same cent except when the 4-decimal value ends in exactly *5* at the third decimal (a mean of x.xx495–x.xx4999…): the read prints one cent above where the drawn line sits, half a cent away. The drawn line carries no number. `smaAgreement.test.js` pins both facts on evaluator-made records.

---

## 10. Tests and guards

Pure: `marks.test.js`, `chartRead.test.js` (every state from evaluator-made records, RD-7 for each combination of failed checks and a downtrend, every printed number to the cent, the 64-pair change matrix, the honesty sweep), `format.test.js`, `placeMarks.test.js`, `chartProps.test.js`, `smaAgreement.test.js`, `chartUtils.basis.test.js`. Route: `setup-read.test.js` (previous present / absent / null, its fields, a planted field, an unreadable earlier record, the read counts), `projection.test.js`. Screen (jsdom): `AssetResearchModal.chartRead.jsdom.test.jsx`, `StockChart.ruleMarks.jsdom.test.jsx`, `useChartRead.jsdom.test.jsx`. Guards: `chartRead.guards.test.js` (no colour literal, no inline motion), `sheetCopy.honesty.test.jsx` (the chart read's copy), `setupRead.test.js` (one importer), `setupEvidenceImportGuard.test.js`, `flagPinGuard.test.js`. Real browser: the report §5 (Edge, 390 and 320; screenshots in `docs/audits/20261118_BUILD_CHART_READ/`).

---

## 11. Out of scope

The Ask's answer and *Save as a plan* (round 6 G); any archetype line, identity check, rank or plan; a second detector; any change to the evaluator, its thresholds, the store or the sweep; any stop or target on the chart; the Technical content's own levels beyond the one line; the Battle chart's day label and the missing company names; any fenced file.

---

## 12. Built so trader v1 can use it (the contract other builds may rely on)

- **One evidence store.** The read comes only from the setup-evidence store through the read route. A later candidate list or decision receipt that shows a setup reads the same records.
- **Stable mark ids.** A plan or a receipt may cite a mark by rule set, session and id (`tf-setup-v1 · 2026-11-17 · touch_low`; `markCitation`).
- **A read per family.** A new detector adds a table (`MARK_TABLES`) and a wording set (`RULE_SET_COPY`). It changes no existing one.
- **A fifth kind of line is reserved, not drawn:** a position's declared stop and target, when the game stores them.
