# The measured read on the Chart view — spec of record V1.1

**Status:** spec of record, as built. **V1** (Claude Code, 18 Nov 2026): the read, its marks, the sheet, the unadjusted candles. **V1.1** (Claude Code, 19 Nov 2026): the checks on the page under a pinned chart, the Chart view first, today so far, the founder's wording rulings and three mark-drawing fixes.

**Basis:** the build prompt *The measured read on the Chart view* of 18 Nov 2026 and the build prompt *The checks on the page, the Chart view first* of 19 Nov 2026 (the AssetResearch planning chat); Claude Design round 6 (`docs/design/research-modal/Research Modal - Round 6 (standalone).html`), the design of record except where CP-1 replaces its screen B; the spec of record `docs/specs/CHART_EVIDENCE_SPEC_V1.md` (the read route); the founder's rulings ACX-1 – ACX-7 (15 Nov), CR-1 – CR-10 (18 Nov) and CP-1 – CP-6 with the answers to the 18 Nov report (19 Nov). **Built on:** V1 `main` at `2e069d42` (#1086); V1.1 `main` at `eb34d2fd` (#1095). **Reports:** `docs/audits/20261118_BUILD_CHART_READ.md` (V1), `docs/audits/20261119_BUILD_CHART_READ_ON_THE_PAGE.md` (V1.1).

**V1 — three PRs, each with `main` as its base, merged in order A → B → C:**

| PR | Branch | Holds | Flag |
|---|---|---|---|
| A | `claude/chart-read-engine` | the route's `previous`, the marks table, the wording, the change table (pure), their tests | `CHART_READ_MODE = 'off'` |
| B | `claude/chart-read-surface` (contains A) | the read, the marks on the chart, the Rule chip, the sheet, the unadjusted candles, this spec, the report, the round 6 file | `'off'` |
| C | `claude/chart-read-allowlist` (contains B) | `CHART_READ_MODE = 'allowlist'` and its pin, one commit | `'allowlist'` |

**V1.1 — two PRs, each with `main` as its base, merged A then B (no flag changes value):**

| PR | Branch | Holds |
|---|---|---|
| A | `claude/chart-read-fixes` | FX-1 – FX-4, FX-6, FX-8, FX-10 and their tests (FX-9 held: §1.4) |
| B | `claude/chart-read-on-the-page` (contains A) | CP-1 (the checks on the page), CP-2 (the Chart view first), CP-3 (today so far), this spec, the report |

### What V1.1 changes, in one list

- **The sheet goes (CP-1).** The checks are a section of the page under the read; the chart is pinned at the top of the Chart view with two heights (§6). No dialog, no focus trap, no Escape of its own; the read opens nothing.
- **The Chart view first (CP-2).** A stock opens on the Chart view at 1D where the shell is on and the read is not `'off'` (§13).
- **Today so far (CP-3).** One line comparing the header's price with the record's marks (§5.1).
- **Wording (FX-1, FX-2, FX-3, FX-6).** The change table's first row, the not-in-an-uptrend second line, three phrases on days without a session, three other-reading lines (§5, §6).
- **Marks (FX-4, FX-8, PG-3).** 1W with SMA on drops marks 1 – 3; squares never under a line, beside their own mark, inside the pane; lit labels stacked with leaders (§4).
- **Two older faults at 320 px (FX-10).** The battle mount's control bar wraps; the OHLC row stops before the price scale (§7.1).

---

## 1. Rulings adopted

| # | Ruling |
|---|---|
| CR-1 | The design of record is round 6, screens A – F and H, with the changes below. Screen G (the Ask's answer) is a later build. **V1.1:** screen B (the sheet) is replaced by CP-1. |
| CR-2 | Each mark number names exactly one value, from a fixed table per rule set (§4). The same number means the same thing on every stock. |
| CR-3 | The checks are grouped by purpose, not by passed and failed (§6). The sector rank is context, shown apart from the rule. |
| CR-4 | Marks are short ticks on the record's day, never lines to the chart's edge. With SMA on, the 20-day and 50-day marks sit on the drawn averages (§9: within half a cent). |
| CR-5 | A "Rule" chip joins SMA · S/R · Idea, on by default. It shows and hides the marks. |
| CR-6 | The "what changed" line ships in this build. |
| CR-7 | The 1D candles are unadjusted wherever the read shows (ACX-3), marked once as *prices unadjusted*. |
| CR-8 | The read is named by the playbook's strategy, not by an archetype: eyebrow *Setup check · daily*; the checks' footer *Rule set tf-setup-v1 · built as Trend Follower's setup check*. |
| CR-9 | The read is keyed by rule set and strategy family (`MARK_TABLES`, `RULE_SET_COPY` by `setupVersion`): a second detector adds a table and a wording set and changes no existing one. |
| CR-10 | No archetype line, identity check or plan in this build. |

### 1.1 The founder's rulings of 19 Nov 2026 (V1.1)

| # | Ruling | Built |
|---|---|---|
| CP-1 | **The checks sit on the page under a pinned chart.** The pull-up sheet goes. | Yes (§6) |
| CP-2 | **A stock's modal opens on the Chart view,** once the build confirms what that costs per open. | Yes (§13): a cold-cache Chart open makes 0 more provider requests than an Analysis open |
| CP-3 | **A "today so far" line:** the header's price against the record's marks, never counted as part of the check. | Yes (§5.1) |
| CP-4 | **One checklist for every archetype.** The archetype later sets which strategies lead and adds an "agent's fit" group for its own limits. Never six different checklists. | No — recorded only |
| CP-5 | **A plan card under the checks:** a stop and a target picked from the numbered marks, with planned loss, planned gain and reward against risk; designed first; built on trader v1's own plan check so the numbers come from one place. | No — recorded only |
| CP-6 | **The plan card is proposed to the BaggerBomb revamp chat** as where the player and the agent agree a plan. | No — recorded only |

No placeholder is built for CP-4 – CP-6.

### 1.2 The answers to the 18 Nov report (adopted)

| # | Answer |
|---|---|
| Readings R-1 – R-12 | Approved as built; R-8 (the sheet's room) is replaced by CP-1. |
| Q-1 | Change → FX-1. |
| Q-2 | Change → FX-2. |
| Q-3 | Reword all three → FX-3. |
| Q-4 | On 1W with SMA on, marks 1 – 3 are not drawn → FX-4 (approved by default; the founder may overrule after seeing it). |
| Q-5 | Accepted: the one-time redraw stays (adjusted, then raw when the read lands). Revisit when the read opens to everyone. |
| Q-6 | Two lines approved, three amended → FX-6. |
| Q-7 | Accepted (the intraday copy guard names the one pair *no reading*). |

### 1.3 Readings made where the prompts are silent or the code differs (approve-by-default; the reports list them)

V1 (18 Nov), approved:

| # | Reading |
|---|---|
| R-1 | **The uptrend is two recorded checks, not three.** `regime_stack` chains `[C, SMA_fast] > [SMA_fast, SMA_slow]` and records one result. The three uptrend rows and RD-7's words read each pair from that check's own recorded sides with its own operator (the evaluator's strict comparison, no tolerance); row 1 is the recorded `pullback_close` check (the same sides). The pairs must AND to the recorded result, else the record is not shown (`unshown`). The two downward mirror checks are not rows; they decide `regime: 'downtrend'`, which the second line reflects. |
| R-2 | **The client's gate is the route's answer.** `'allowlist'` and `'on'` make one request on a stock's Chart view; a 404 `chart_read_unavailable` (not admitted) or a 400 (not one of the ranked stocks) is no slot. `'off'` makes no request. |
| R-3 | **RD-7 at equality.** A failed check is worded true at equality too: *closed at its 20-day ({1})*, *the 20-day is level with the 50-day*, *the 50-day is flat over five sessions*. |
| R-4 | **Mark 4 is the `pullback_touch` check's `lhs`**, sitting on the most recent of the three sessions whose low is that value. |
| R-5 | **Mark 3's day** is five sessions before the record's day, counted on the daily series' own dates (the same on 1D and 1W). |
| R-6 | **The candles are unadjusted under every read that shows** (any answer, a quiet state included); after a failed read, or with no slot, they stay today's. |
| R-7 | **The Battle chart's read** keeps its lead, drops its second line and carries round 6 F's note *Daily marks are on 1D and 1W, not on these 30-minute bars.* |
| R-8 | *Replaced by CP-1 (V1.1).* (V1: while the sheet was open the action row gave way and the plot yielded height to about 42 % of the view.) |
| R-9 | **The other pattern's group** reads *not present* in quiet ink in either valid state, unless that pattern is satisfied too. |
| R-10 | **An unknown rule set**: one line, *Measured by rule set {x}; this app can't show that rule's marks yet.*; no marks, no checks. A record whose numbers cannot be worded is one line, *This record can't be shown.* |
| R-11 | **An earlier record the projection cannot read** throws (500), never a null `previous`. A refused `read` still carries its `previous`. |
| R-12 | **Prices print half up from the record's shortest decimal** (`format.js`), never `toFixed`'s binary rounding (141.105 → $141.11). |

V1.1 (19 Nov), approve-by-default:

| # | Reading |
|---|---|
| R-13 | **OV-2's "opened from Battle Research".** The Battle View says so: `sheetContext.openedFromResearch` whenever the row came from the Battle Research surface (a research question's row — state 2, which also carries `research` — the opening's list in state 1, and the reference holding). Those open on Analysis. `sheetContext.rankings` is not read for it: it is a general channel. |
| R-14 | **A late shell appearance is not an open.** `viewOnShellAppear` (a late per-battle verdict, an index or fund → stock) keeps its rule. |
| R-15 | **"At" is equal as printed.** The header's digits (`priceText`) and the mark's cents (`format.js`) are compared exactly as decimal numbers; with a 2-decimal header that is equality to the cent. A mark is compared at its printed cent, never its raw double (a 20-day of 195.605 prints $195.61, and $195.61 in the header is *at* it). |
| R-16 | **Today so far on a behind read and on the Battle chart.** TD-1 does not exclude a behind read: it shows. On the Battle chart (no second line) it sits under the lead. |
| R-17 | **When the chart compacts.** When the checks' top edge reaches the pinned chart's lower edge (the read has scrolled under it); full again only back at the top (scrollTop 0). The two thresholds are apart so a change never undoes itself, and scroll anchoring is off on the Chart view while the checks show (the browser's anchoring moved the scroll position to the top instead and the chart flipped back: measured in Edge). |
| R-18 | **The motion.** The chart changes height at once (one rebuild); the page under it eases into place by the difference (`smooth`, a transform; reduced motion: `instant`). |
| R-19 | **FX-8's squares.** Every square is drawn after every line, so no line is ever drawn across a number. A square goes beside its own mark — each end at its own height, each end a square above and below, one or two squares further out — clear of every square and every other mark's line; else the nearest of those clear of every square (another mark's line then passes under it); only when all of those hold a square, further along its own side at its own height. A square never sits on another square while the pane has room, and never leaves the pane. In the compact chart, where all seven marks can share a few dollars, a square can sit over another mark's tick, and one or two can sit a few squares out along their own height. |
| R-20 | **FX-8's labels.** Lit labels closer than a label's height are stacked a full label apart, centred on their prices and kept inside the pane, at fixed coordinates (the library's own stacking moved a label's tick off its price); a moved label gets a short leader from its own price to it. |
| R-21 | **FX-10.** The OHLC row is bounded by the price scale's width as the library measures it (after each layout, resize and visible-range change), plus 8 px, and wraps; a chart that cannot be measured leaves the row as it was. The control bar wraps wherever it carries the Battle pill. |
| R-22 | **Focus order without a layer.** Each check row keeps a scroll margin equal to the pinned chart block's measured height plus 8 px, so Tab and Shift+Tab never leave a focused row under the chart; the chart's own controls focus without moving the page. |
| R-23 | **The Rule chip in the compact state** reads pressed and is disabled (every mark shows): the V1 rule L3-7 for the open sheet, carried over. |

### 1.4 Held for a ruling

**FX-9 — today's candle dated by the market's day.** Built and tested on its own branch, not shipped: the prompt's stop condition holds. Using the ET session date changes candles for devices in US time zones west of New York each night between midnight ET and the device's midnight (Central 1 h, Mountain 2 h, Pacific 3 h, Alaska 4 h, Hawaii 5 h; Friday evening drops Friday's patch). The report's question Q-1.

---

## 2. Phase 0

V1: the report `20261118_BUILD_CHART_READ.md` §2. V1.1: the report `20261119_BUILD_CHART_READ_ON_THE_PAGE.md` §2 (the eight findings, with the cost of a Chart open).

---

## 3. The route's addition (V1 PR A) — RD-1 – RD-5

`GET /api/research/setup-read` gains one body key, `previous` (`SETUP_READ_BODY_KEYS`):

```
{ answer, symbol, servedAt, sessionsTried, read, previous }
previous: null | { session, verdict, reason, pattern, regime, patternsSatisfied, checks: [{ id, result }] }
```

- Copied through `projectPreviousRecord` (`api/_utils/setupRead/projection.js`), the projection's own copy, so the same refusals hold. No facts, no prices.
- The session before `read.session` is `sessionBefore()`; null outside the calendar.
- Reads: `read`'s one or two, then one more when `read` is a record: 0 to 3 a call, through the route's single `readSnapshot` call site and the same 60-second cache. Read-only.
- The client read (`setupRead.js`) accepts exactly this body.

Unchanged in V1.1.

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

A mark exists only when its value is finite (MK-1). **Which marks show (MK-3, PG-3, V1.1):** at the chart's full height, the default set for the state — valid · Pullback 1, 4, 5, 6; valid · Breakout 1, 5; not in an uptrend 1, 2, 3; no pattern 1, 4, 5; stretched 1, 7 — with the Rule chip on, none with it off; with the chart compact, every mark that exists (the Rule chip pressed and disabled); and a tapped check's marks always, lit, whatever the chip says (`chartProps.js`). **FX-4:** on 1W with the SMA pill on (the chart draws 20- and 50-WEEK averages), marks 1, 2 and 3 are not drawn, lit or unlit; the checks' head says *On 1W the drawn averages are weekly; marks 1 to 3 are on 1D.*; a row still lists its numbers; SMA off or 1D brings them back (`weeklyAveragesHideMarks`; StockChart reports its SMA pill through `onToggleSMA`). A mark is cited as `tf-setup-v1 · 2026-11-17 · touch_low` (§12).

**How they are drawn** (`ruleMarksPrimitive.js`): a lightweight-charts 5 series primitive on the candle series. The library calls its pane view in its own render pass; the view places each mark with `timeToCoordinate` / `priceToCoordinate` at that moment, so the marks stay on their bars through pan, zoom, resize, rotation, price-scale drags and the chart's change of height (measured, the reports' browser sections). Neutral ink, solid, never dashed; a tick seven bars wide centred on its bar; the number in a 13 px square; a lit mark 2.4 px with a filled square and its value on the price scale. **FX-8 (V1.1):** every line and bracket is drawn before every square (no line across a number); each square is placed by R-19; a square and a bracket stay inside the pane (never under the price scale); lit labels closer than a label's height are stacked by R-20 with a leader from each price. Re-attached when the chart rebuilds its series; lit / unlit is `setScene` + `requestUpdate`. 1D and 1W only (`placeMarks.js`); on the Battle chart only the 20-day stub at the right edge, *20-day · daily · {Tue} close* (MK-5). The idea line, 💣's rungs, the entry line and the S/R lines are unchanged; no stop is drawn (MK-6).

---

## 5. The read (§5)

`chartRead.js` `readLineOf(body, { todayEt, todayIsSession, battle, sessionOpened, headerPrice })`, every word from `chartReadCopy.js`:

| State | When | Lead | Second line |
|---|---|---|---|
| `valid_pullback` | valid · pullback_resume | *Pullback and Resume · present — touched its 20-day ({1}) and closed back above it.* | *Volume isn't part of this pattern; participation is unconfirmed.* |
| `valid_breakout` | valid · breakout | *Trend Breakout · present — closed at or above the 20-session high ({5}) on {x}× average volume.* | — |
| `regime` | invalid · regime | *Not in an uptrend — {the failed checks}.* | **FX-2:** *It changes with {the failed checks as nouns}.* — *a close back above the 20-day*, *the 20-day back above the 50-day*, *the 50-day turning up*, in the checks' order, joined *a, b and c* — then *This is not a downtrend call.* unless `regime` is `downtrend` |
| `no_setup` | invalid · no_setup | *In an uptrend; no entry pattern today.* | *A pullback needs a low at or below the 20-day ({1}). A breakout needs a close at or above {5} on 1.5× average volume.* |
| `extended` | invalid · extended | *{pattern} pattern present, but stretched — the close is more than 2 ATR above the 20-day.* | *The check says wait.* |
| `unknown` | verdict unknown | *Not enough to read — {the missing facts}.* | — (no checks) |
| `refused` | answer refused | **FX-3:** *No read for this stock — {the reason}.* | — (no checks) |
| `absent` | answer absent | *Measured after each close; no read yet for this stock.* | — (no checks) |

The date: *as of Tue Nov 17 close*; behind (**FX-3**): *As of Mon Nov 16 close (the latest close isn't in yet)*. Footnotes: RD-8 *{Tuesday}'s close. Today's session is read after it ends.* on a trading day whose record is not in yet — never while the read is behind (**FX-3**), and replaced by today so far whenever that shows (TD-4); RD-10 *The split check couldn't run on this record.*; on Battle the R-7 note. A failed read: *Couldn't load the setup check* and *Try again* (RD-12). Never *will*, *likely*, *should buy*, *live*, or a stop or a target beside a price (RD-13; `sheetCopy.honesty.test.jsx` scans the copy).

**What changed** (`changeOf`, CR-6): the first matching row of `CHANGE_TABLE` — **FX-1:** previous `invalid · extended` whose `patternsSatisfied` holds today's valid pattern → *Since {Mon}: back within the stretch limit.* (the two *New since* rows never match that pair); not valid → valid · pullback; not valid → valid · breakout; valid → extended; valid → no_setup; uptrend → not; not → uptrend. "Not valid" is `invalid` only; an unknown on either side, no previous record, or an unlisted pair shows nothing.

**Where:** the band under the pinned chart, after the record-day chips; the checks follow it (§6). It is no longer a button (PG-5). No slot for crypto, an index or a sector fund (the shell is off for them, R-35; no request).

### 5.1 Today so far (CP-3, TD-1 – TD-6; V1.1)

`todayLineOf` (`chartRead.js`), one line under the second line (under the lead on the Battle chart):

*Today so far: {price} — {above | below | at} {Wed}'s 20-day (1), {above | below | at} {Wed}'s 50-day (2). Today's own numbers are read after the close.* — with *, above {Wed}'s 20-session high (5)* only when the price is above mark 5, and *, below {Wed}'s 20-session low (6)* only when it is below mark 6.

- **When (TD-1):** the read shows its checks; today (ET) is a trading session later than the record's; today's regular session has opened (`getSessionForDate(todayEt).openMs`, early closes and holidays included); the header has a price. A mark that does not exist drops its clause; with neither 1 nor 2, no line.
- **The price (TD-2):** the header's own digits through the header's own formatter (`ChartHeader`: `$` + `priceText(enrichedAsset.price)`), handed in by the modal; it follows the header. "At" by R-15.
- **TD-4:** it replaces RD-8's footnote whenever it shows. **TD-5:** no glyph, no count, no *holds*, *passes*, *would*, *will*, *likely* or *live*; it changes no mark, check, lead or change chip (a sweep in `sheetCopy.honesty.test.jsx`, rows in `chartRead.test.js`). **TD-6:** the same on the Battle chart.

---

## 6. The checks on the page (CP-1, PG-1 – PG-10; V1.1 — replaces V1's sheet)

`ChartReadChecks.jsx` over `checksOf(body, { sector, expanded })` (`chartRead.js`), a `<section aria-label="The checks">` of the Chart view under the read:

1. **The chart, pinned** (`[data-chart-pin]`, `position: sticky; top: 0`) at the top of the view — only while the checks show; with the read asked for, the chart sits in that wrapper from the start (it never remounts when the read lands); with the read off, today's markup (no wrapper, no listener).
2. **The record-day chips**, where a battle has them.
3. **The read** (§5).
4. **The checks**, in CR-3's order: one hint, *tap a check to light its mark* (and FX-4's line when it applies); **The uptrend** *{n} of 3*; **Pullback and Resume** *{n} of 2*; **The stretch guard**; **Trend Breakout** *the other pattern*; **Context, not part of the check** (the sector rank, `stockTechnicalScores/{SYM}.factors.sectorRSPercentile` and `updatedAt`, read once with `useTechnicalScore` when the checks render — PG-9 — or *no reading*); **The other reading** and **What separates them**; the footer.
5. **The Technical content**, as before.

- **PG-1 — no layer.** No dialog role, no focus trap, no Escape handling of its own; the action row and the Technical content stay. The V1 sheet (`ChartReadSheet.jsx`, the 42 % plot, the hidden action row, `readSheetFor`) is removed.
- **PG-2 — two heights.** At the top of the view, the shell's height; once the player scrolls into the checks (R-17), compact: a third of the view's height, never under 180 px (`min(shellChartH, max(180, round(view / 3)))`), still pinned; back at the top, full again. One change of height (one chart rebuild), never a resize per scroll frame; the page under the chart eases into place by the difference (R-18). Scroll anchoring off while the checks show. Never compact in a quiet state.
- **PG-3 — which marks show:** §4.
- **PG-4 — a tap** lights the row's marks and scrolls nothing; a second tap clears them; moving to another stock (or leaving the Chart view) clears it, collapses the patterns again and restores the full height.
- **PG-5 — the read opens nothing.** *Open the checks*, *Close the checks* and the sheet's own head are gone.
- **PG-6 — when the uptrend fails**, the pattern groups collapse to *Entry patterns are read only in an uptrend.*; a tap expands them (SH-3).
- **PG-7 — the quiet states** (unknown, refused, no record, an unknown rule set, a record that can't be shown, a failed read): one line, no checks, the chart at its full height, never pinned.
- **PG-8 — the Battle chart** keeps the read as built (the lead, the Battle note, today so far); the checks stay on the page; no mark but the one stub (MK-5).
- **PG-10 — one column** at every width; at 1280 the checks span the modal's width.
- **Focus order:** R-22.

Each row: its name, both sides with their numbers, its plain definition, its mark numbers (only those that exist); a row with no mark is not a button (L3-6). The other reading and what separates them (SH-5, **FX-6**):

| State | The other reading | What separates them |
|---|---|---|
| valid · Pullback and Resume | *A failed bounce in a weakening trend.* | *The next close against that session's own 20-day. That number doesn't exist yet; mark 1 is {Tue}'s.* |
| valid · Trend Breakout | *A breakout that slips back under the high it cleared.* | **FX-6:** *The next closes against the high it cleared (mark 5).* |
| not in an uptrend (regime not downtrend) | *A dip inside a trend that hasn't turned.* | *The three uptrend checks: a close above the 20-day, the 20-day above the 50-day, and the 50-day rising. Marks 1 and 2 are {Tue}'s; mark 3 is the 50-day five sessions earlier.* |
| not in an uptrend, regime downtrend | **FX-6:** *A bottom forming before the trend turns.* | as the row above |
| in an uptrend, no pattern | *A trend that is tiring, not pausing.* | **FX-6:** *A low at or below the 20-day with a close back above it, or a close at or above the 20-session high on 1.5× average volume. Marks 1 and 5 are {Tue}'s; each session has its own.* |
| stretched | *Strength that keeps going without a pullback.* | *The close coming back within the stretch limit while the pattern still holds. Mark 7 is {Tue}'s limit; each session has its own.* |

---

## 7. The unadjusted candles (UC-1 – UC-5)

`prepareChartData(rawData, { basis: 'raw' })` draws each candle as traded; absent, the candles are scaled by adjusted close ÷ close exactly as before. The modal passes it on 1D wherever the read shows (`chartProps.js`), with *prices unadjusted* under the OHLC row. The hook's live patch keeps the stored adjusted close on today's row (`useResearchData.js`), so only the raw path draws the live price as the last close (UC-4). 1W rows carry no adjusted close and the Battle bars are unscaled: unchanged (UC-5). Unchanged in V1.1.

### 7.1 Two older faults, fixed for everyone (FX-10; V1.1)

These change what a player sees with `CHART_READ_MODE` off. **The control bar** of a battle mount (1D · 1W · Battle · SMA · S/R · Idea) wraps and never runs past the screen, with or without the read (`StockChart.jsx`: wrap whenever the bar carries the Battle pill). **The OHLC row** stops 8 px before the price scale and wraps (R-21; `OHLCDisplay`'s opt-in `right`, its one importer `StockChart`). No golden moved.

---

## 8. Flags and the one opening constant

| Flag | Where | Value |
|---|---|---|
| `CHART_READ_MODE` | `src/config/researchModalFlags.js`, resolved at call time by `resolveChartReadMode()` | `'allowlist'` (unchanged in V1.1) |
| `RESEARCH_MODAL_OPENING_VIEW` (V1.1, OV-4) | beside the flags in `researchModalFlags.js`, resolved by `resolveOpeningView()` (`Sheet/shellView.js`; any other value or a missing export reads `'analysis'`); pinned by `researchModalOpeningView.test.js` | `'chart'` |

`'off'`: no request, no element, no wrapper, no listener, no library call; the Chart view and the opening view as before. `'allowlist'`: the route admits a player `isCockpitOwnerAllowlisted` names — the same players the shell's per-battle verdict admits at `RESEARCH_MODAL_SHEET_MODE = 'allowlist'`; the client asks and shows a slot only on a 200. From search the read appears once the shell itself is on for everyone (`RESEARCH_MODAL_SHEET_MODE = 'on'`, a separate founder flip). `'on'` is a later one-line founder PR.

---

## 9. Display agreement (BUILD_RULES §9)

One field, one formatter: a mark's price, the lead's and the checks' are one string (`format.js formatPrice` on the record's field; the lit mark's axis label is the same formatter). The 20-day and 50-day marks against the chart's drawn averages: the same float mean of the same raw closes; the record keeps 4 decimals, the chart rounds to 2. They print the same cent except when the 4-decimal value ends in exactly *5* at the third decimal: the read prints one cent above where the drawn line sits, half a cent away. The drawn line carries no number. `smaAgreement.test.js` pins both facts on evaluator-made records. **V1.1:** today so far prints the header's own string (the header's formatter) and compares it with each mark as the read prints it (R-15).

---

## 10. Tests and guards

Pure: `marks.test.js`, `chartRead.test.js` (every state from evaluator-made records, RD-7 and FX-2 for each combination of failed checks and a downtrend, every printed number to the cent, the 64-pair change matrix with FX-1's row, FX-3, FX-6, today so far — every clause, equality to the cent, a missing mark, each of TD-1's conditions alone, TD-4 – TD-6 — and the honesty sweep), `format.test.js`, `placeMarks.test.js` (placement; FX-8's three faults and the compact scene as Edge drew it), `chartProps.test.js` (PG-3, FX-4), `smaAgreement.test.js`, `chartUtils.basis.test.js`. Route: `setup-read.test.js`, `projection.test.js`. Screen (jsdom): `AssetResearchModal.chartRead.jsdom.test.jsx` (off means off; the read and today so far; the checks on the page; the two heights; the marks; FX-4; the opening view; display agreement), `AssetResearchModal.shell.jsdom.test.jsx` (the opening view on the Battle View's mounts), `StockChart.ruleMarks.jsdom.test.jsx`, `StockChart.narrow.jsdom.test.jsx` (FX-10), `useChartRead.jsdom.test.jsx`, `AgentBattleScreen.battleResearch.jsdom.test.jsx` (`openedFromResearch`). Guards: `chartRead.guards.test.js` (no colour literal, no inline motion), `sheetCopy.honesty.test.jsx` (the chart read's copy and today so far's sweep), `setupRead.test.js`, `setupEvidenceImportGuard.test.js`, `flagPinGuard.test.js`, `researchModalOpeningView.test.js` and `chartReadFlag.test.js` (the pins). Real browser: the reports' browser sections (Edge at 390, 320 and 1280; screenshots in `docs/audits/20261118_BUILD_CHART_READ/` and `docs/audits/20261119_BUILD_CHART_READ_ON_THE_PAGE/`).

---

## 11. Out of scope

The Ask's answer and *Save as a plan* (round 6 G); any archetype line, agent's fit group, identity check or rank (CP-4); a plan card, a stop, a target, reward against risk or game points (CP-5); a second detector; any change to the evaluator, its thresholds, the store, the sweep or the read route; a side-by-side layout on wide screens; the Technical content's own levels beyond the one line; the Battle chart's day label and the missing company names; any flag's value; any fenced file.

---

## 12. Built so trader v1 can use it (the contract other builds may rely on)

- **One evidence store.** The read comes only from the setup-evidence store through the read route. A later candidate list or decision receipt that shows a setup reads the same records.
- **Stable mark ids.** A plan or a receipt may cite a mark by rule set, session and id (`tf-setup-v1 · 2026-11-17 · touch_low`; `markCitation`). CP-5's plan card would pick its stop and target from these.
- **A read per family.** A new detector adds a table (`MARK_TABLES`) and a wording set (`RULE_SET_COPY`). It changes no existing one.
- **A fifth kind of line is reserved, not drawn:** a position's declared stop and target, when the game stores them.

---

## 13. The opening view (CP-2, OV-1 – OV-5; V1.1)

`openingView({ opensOnBomb, onChart })` with `onChart = shellOn && opensOnChart({ chartReadMode: resolveChartReadMode(), fromBattleResearch })` (`Sheet/shellView.js`, decided once at open):

- **OV-1, OV-3:** a stock opens on the Chart view at 1D wherever the shell is on and the read is not `'off'` — at today's flags, the agent Battle View's mounts whose per-battle verdict is true (the read route admits the same players); every browse mount once `RESEARCH_MODAL_SHEET_MODE` is `'on'`.
- **OV-2:** 💣's openings come first (FQ-9 in a zone, BD-7's door, BS-1's own defaultTab / defaultTimeframe); a row opened from Battle Research opens on Analysis (R-13); crypto, an index and a sector fund are not in the shell. A late shell appearance keeps `viewOnShellAppear` (R-14).
- **OV-4:** `RESEARCH_MODAL_OPENING_VIEW` — one line puts it back to Analysis.
- **OV-5:** with `CHART_READ_MODE` `'off'`, every mount opens exactly as before.

**What it costs (Phase 0):** every shell open already fetches the 1D/400-day daily series (one request; the 1D window and the series behind the Technical content are the same request). A Chart open adds the read route (the route's memory cache or 1 – 3 Firestore reads; `private, no-store`; never the provider) and the sector-rank document (one Firestore read). Provider requests per open: Analysis 0 warm / 1 cold; Chart 0 warm / 1 cold.
