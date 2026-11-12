# BUILD PROMPT — Research Modal Build A: Bomb mode (spec + build, dark)

**Date:** November 7, 2026 · **Session:** fresh LOCAL Claude Code session, Opus, its own worktree cut from `origin/main`. **Attach nothing:** every input is on `main` (listed in §0.2). This document is the spec of record. Commit it as the first commit at `docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md`.
**Branch:** `claude/research-modal-bomb-mode` · **Ends as:** a DRAFT pull request plus a never-merge smoke branch (§8). Do not merge, do not flip, do not watch CI.
**Report:** `docs/audits/<run date>_BUILD_RESEARCH_MODAL_A_BOMB_MODE.md`, committed on the branch, with a copy outside the tree.

---

## 0. Before any code

1. `git fetch origin`. Record the `origin/main` HEAD you cut from. Read `CLAUDE.md` and `docs/BUILD_RULES.md`. They are binding, especially §1 (fence), §2 (branch discipline and the review threshold), §3 (session documents), §8 (deliverables), §9 (display agreement), §10 (color tokens) and §11 (motion tokens).
2. **Read these, in this order, from `main`:**
   - `docs/audits/20261102_PHASE0_RESEARCH_MODAL.md`, especially §A, §B, §C, §D, §H, §J and §5. Every anchor below comes from it and was read at `40641486`.
   - `docs/design/research-modal/RESEARCH_MODAL_DESIGN_DIRECTION_V2_OCT17_2026.md` §2.4.
   - `docs/design/research-modal/RESEARCH_MODAL_CONCEPT_V1_1_AMENDMENT_A_OCT17_2026.md`. R-11′ governs the Bomb views.
   - `docs/design/research-modal/RESEARCH_MODAL_REDESIGN_CONCEPT_V1_1_OCT17_2026.md` §2.4–§2.6.
   - The batch-1 Claude Design file in `docs/design/research-modal/`, screens 5–6. It is the design of record for Bomb mode, with two exceptions. Its **Bricks chart (5b) is retired** (Amendment A). Its **ENTRY / BANKED / NEXT tiles are retired** in favour of the ladder rail (R-11′(c)). Open it in a browser.
3. **The design rule** (from the cockpit arc): the mockup contributes structure, behaviour and vocabulary. The skin comes from the shipped tokens (§10). There are no new hex values; the red-zone heat accent is a derived token. The mockup's example numbers are examples. Every number on screen comes from a record named in §3.
4. **Reconciliation gate (read-only, before any code).** Confirm each anchor in §3 at your HEAD by meaning, not by line number, and record any drift in the report. The gate STOPs on any of these:
   - (a) A rung banks on anything other than a scoring check. The clock depends on this; Phase 0 §C says checks only.
   - (b) `nextEligibleSlot` is not importable client-side as `cockpitModel.js` imports it.
   - (c) The server's legacy rung-test baseline precedence (Phase 0 §C: `swapPrice || startingPrices[sym] || previousClose`) differs from what you find.
   - (d) Any file this build needs is on the §1 fence list.

   For each STOP, report what you found and which section it breaks. Do not improvise.

## 1. What this build is (plain terms)

When a player opens a stock they hold in a live agent battle and taps 💣, they get a **game instrument** instead of a candlestick chart with lines on it:
- **The Fuse.** A vertical rail from entry to the top rung. The three scoring rungs sit on the rail with their points. The live price is a glowing bead on the rail. A thin ghost line beside the rail shows the stock's last two weeks.
- **The red zone.** When the price comes within 0.5% of the next rung, the view switches by itself to a goal-line view:
  - the rung is drawn across the top;
  - a pulse trace shows the last hour;
  - the biggest number on screen is the distance to the rung;
  - a clock counts down to the next scoring check;
  - a chip shows the live price and the price the last check scored.

  When a rung banks, a short *+15 banked* moment plays. After the close the view shows *Market closed · last tick 3:59 PM*, never a fake bar.
- **One sheet under both views.** The ladder rail (entry → rungs, banked rungs lit, brick ticks between rungs, *1.0% · 2 bricks to +30* above the next one) and a single line saying what has to happen.

Stocks the player doesn't hold get the same Fuse in a labelled **preview**. It has no clock, no red zone and nothing banked. Surfaces outside a battle lose the 💣 pill and the Bomb tab. Everything ships **dark** behind one flag.

## 2. Rulings in this spec (approve-by-default; founder rulings of Nov 4 and Nov 7 already applied)

| # | Ruling | What the player sees |
|---|---|---|
| BA-1 | **Held vs preview.** A *held* ladder needs a position in a live agent battle (§3.1). Everything else that shows 💣 today gets a **preview** ladder anchored on one baseline, the previous close, labelled *Preview · rungs if it entered at yesterday's close ($X)*. Never "Entry Price". The chart and the sheet use the same baseline, which retires Phase 0 §A's two-baselines bug. | No more fake "entry price" on stocks nobody bought. |
| BA-2 | **Red zone: upside rungs, stocks only.** Downside tiers (bust and the two below it) are ticks in the Fuse's compressed below-entry region and are marked when hit. No red zone fires near them in V1, and crypto never enters the red zone (FQ-2). | The red zone always means "close to scoring". |
| BA-3 | **Band and hysteresis.** Enter at ≤ 0.5% of the next unbanked rung's price (FQ-2). Leave when the distance exceeds 0.75%, when that rung banks, or when the market closes. Constants live in one module. | No flicker at the edge. |
| BA-4 | **Banked times only when recorded.** A rung shows *banked · 1:15 PM* only if the record holds that instant, or if the modal saw it bank live. Otherwise it shows *+15 banked*. | No invented times. |
| BA-5 | **Browse and acquire mounts lose 💣 and the Bomb tab** (FQ-5, ruled). Only mounts that pass `bombContext` (§4.2) show them. | Draft, search and watchlist modals stop showing a Bomb tab for stocks nobody holds. |
| BA-6 | **The trace is honest about its age.** The red-zone trace draws the 1-minute bars up to their last bar, then the quote observations taken while the modal is open, as separate dots. The gap between them is visible and never interpolated (§3.5). | If the minute bars lag, the player sees the lag. |

## 3. The records Bomb mode reads (no new request, no new store)

### 3.1 The held ladder (agent battle, position held)

- **Measured model** (a position with `stockThresholdReceipt`):
  - entry = `receipt.fill`, entry time = `receipt.enteredAt`;
  - rungs = the targets `fill × (1 + k × scoringPct/100)` per tier, with downside tiers mirrored (`stockThresholdModel.js` ≈ :71–74);
  - banked = `scoring.stockRewardHistory.agent.{positionId}.crossedTiers`.

  The modal already builds this as `bombData.measured` (`AssetResearchModal.jsx` ≈ :308–313). **Reuse it; do not re-derive it.**
- **Legacy model:**
  - baseline = the server's rung-test baseline, in the server's precedence (Phase 0 §C: `swapPrice || startingPrices[sym] || previousClose`, `agent-evaluate.js` ≈ :1266, :1301–1302). Label which one it is: *from entry* or *from yesterday's close*. Write the precedence once, in the new selector, with a comment citing the server lines and a test pinning the precedence on fixtures.
  - rungs = the tier multipliers of the canonical constants module (`baggerBombScoring.js`) applied to the legacy threshold the scorer uses; cite the line;
  - banked = `thresholdHistory.{SYM}.maxMultiplier` mapped to tiers by the same multipliers.

  If the existing `bombData` baseline for a held legacy name differs from the server's, that is a §9 defect. Fix it in this build so the Fuse matches the server, and record it.
- **No entry:** if the precedence yields nothing (Phase 0 §5 "Day-2 entry price"), the ladder renders *entry unavailable*. It never draws from 0.
- **Points per tier:** from the canonical constants module only.

### 3.2 The scored price and the `LIVE · SCORED` chip (Phase 0 §C)

- **Live** = the modal's own quote (`wsPrice` or the controlled quote), unchanged.
- **Scored** = the price the latest check's rung test read:
  - measured: `scoring.stockRewardContexts.agent.{positionId}.currentPrice` at `quoteEvidence.providerAsOf`;
  - legacy: `cronState.lastTickPrice[SYM]` at `cronState.lastTickTimestamp[SYM]`.

  Prove in the report, with a cited line, that each is the value the rung test read. If either is not, STOP that source and report it; do not fall back to `evidence[SYM].px` without a ruling.
- **Format:** `live $160.27 · scored $160.19 at 1:00`, using the shared `priceFormat.js`. It shows in the red zone always, and elsewhere only when the two differ by at least one display unit.

### 3.3 The next-check clock (Phase 0 §C)

- Compute it with `nextEligibleSlot(nowMs, { battleExpiresAtMs })` from `api/_utils/callRecords/horizon.js`, imported the way `cockpitModel.js` imports it. **Never** compute `lastCheckedAt + 15 min`. Do not touch `baggerbombAdapter.js`'s second clock; report it.
- **States:**
  - countdown to the slot (`next check 3:45`, with mm:ss under fifteen minutes);
  - at the slot, *checking…* until `scoreState.lastScoredAt` passes the slot, or for at most five minutes (the cron's queue), then roll to the next slot;
  - outside market hours, the next slot's day and time (*Mon 9:30 AM*, whatever `horizon.js` returns).

### 3.4 The 💣 view's data (Phase 0 §D)

- The ghost line uses the 30-minute series the view already fetches, closed bars only.
- Check dots come from `evaluations[].evidence[SYM].px` at each entry's `timestamp`, only since entry, and only where present.
- The live bead is the live quote.
- **No synthesized candle:** with the mode on, the bomb and spectate views do not run the live-candle synthesizer (`useResearchData.js` ≈ :654–722), including its high/low patching. The 1D synthesizer is untouched.

### 3.5 The red zone's data

- The trace is the spectate 1-minute series the view already fetches (and its existing 15-second poll), drawn as a line up to its last bar's time.
- The quote observations collected while the modal is open come after it, drawn as dots.
- Label the line's end (*1-min bars to 1:52*).
- No new request, no cache change. Report the observed age of the 1-minute series on the smoke branch: Phase 0 found a one-hour server cache on that key, which is a known limitation and a separate decision.

### 3.6 Bricks (Amendment A R-11′(a))

- Brick = the per-stock size that puts every upside rung on a whole brick. Phase 0 and the mockup imply rungs at 1, 1.5 and 2 times the threshold, which gives brick = threshold/6 and rungs at 6, 9 and 12 bricks.
- If the tier multipliers are not 1, 1.5 and 2, omit the brick ticks and report.
- The to-go label rounds bricks **up**.

### 3.7 The preview ladder (BA-1)

- The baseline is the previous close, from the source the 💣 chart uses today.
- The threshold comes from the source the Bomb tab uses today (`/api/volatility/thresholds`, or the asset's threshold when the mount supplies one).
- A V4 battle (`BaggerBombBattleView`) with `state.dailyLevels.assets[SYM]` uses those levels and that baseline instead.
- A preview has nothing banked, no clock, no red zone and no scored chip.

## 4. What to build

### 4.1 The flag: its own module, not `featureFlags.js`

- `RESEARCH_MODAL_BOMB_MODE` = `'off' | 'allowlist' | 'on'`, shipping **`'off'`**, in a new `src/config/researchModalFlags.js`. Follow the agent-form pattern (`agentFormFlags.js`): it keeps `App.jsx`'s entry chunk byte-identical.
- Write `RESEARCH_MODAL_BOMB_MODES`, a `// Pinned by:` line, a pin test, and a call-time resolver that maps any unknown value to `'off'`. Copy the Film Room cards flag (`filmRoomGate.js`, `filmRoomCardsFlags.test.js`).
- It is noted "intentionally ABSENT" from `DARK_BY_DESIGN`, the way the cards flag is. Never read the flag at module scope.
- **`'allowlist'`** is answered per agent battle by the existing cockpit-status verdict (`allowlisted`), through the cached helper the Film Room gate uses. Mounts with no agent battle resolve allowlist to off. Add no new route.

### 4.2 The mount contract

- A new optional modal prop, **`bombContext`**: `{ kind: 'agent', battleId, held: bool, record } | { kind: 'v4', dailyLevels } | { kind: 'bench' }`. Pass it only from the in-battle mounts:
  - `AgentBattleScreen.jsx`, its three mounts (held, gated non-held, legacy) and the cockpit bench door that routes through them;
  - `BaggerBomb/FreeAgentBar.jsx`;
  - `BaggerBombBattleView.jsx`.
- `record` comes from a **pure selector** in a new file, `selectBombRecord(battle, symbol, nowMs)`. It returns the held ladder (§3.1), the scored price (§3.2), `lastScoredAt`, `battleExpiresAtMs`, check dots (§3.4) and the model kind, or null.
- The screen calls the selector only when the mode resolves on. With the mode off, it is not called, and the screen renders byte-identically.
- With the mode on, a mount without `bombContext` shows no 💣 pill and no Bomb tab (BA-5). In the report, list every mount and its classification, and flag any that disagree with Phase 0 §A.

### 4.3 Components (new files under `src/components/Research/BombMode/`)

- **`FuseChart.jsx`.** Plain React and SVG, no chart library.
  - The rail runs from entry, or the preview baseline, to the top rung, with the compressed below-entry region holding the downside ticks.
  - It shows the rungs with points and price; the live bead, whose halo brightens as the distance shrinks; the ghost line with its check dots; the entry marker; and the banked rungs, lit, with a time only per BA-4.
  - The to-go pill uses brick wording (§3.6).
  - The label-collision rule (R-11′(d)) applies: inside the band, the live label yields to the rung label and the to-go pill carries the live number.
- **`RedZone.jsx`.** Three states:
  - **(a) approaching:** goal line, trace (§3.5), distance as the largest numeral, the % under it, the next-check clock, the `LIVE · SCORED` chip and the *your position* chip;
  - **(b) the banked moment**, the one loud animation. It plays once per position and tier per modal session, then re-bases to the next rung, or exits if none is within the band;
  - **(c) market closed:** trace frozen, *Market closed · last tick {time}*, and the next check's day and time.
- **`BombSheet.jsx`.**
  - The ladder rail: entry → three rungs, banked lit, brick ticks, and *{x}% · {n} bricks to +{pts}* above the next rung.
  - *What has to happen*, from templates only. Held: *Needs $163.12 at a check · next check 3:45*. After a bank: *+15 banked at the 1:15 check. Next: $163.12 at a check*. Preview: *Preview · rungs if it entered at yesterday's close ($X)*.
  - No resistance or level clause in V1 (that is Build B's data).
  - This replaces `BaggerBombTab`'s content when the mode is on; with the mode off, `BaggerBombTab` renders as today.
- **`redZone.js`.** A pure state machine with the BA-3 constants: inputs are the distance, banked tiers, market open and crypto; output is the mode.
- **`ladder.js`.** The adapters: held measured, held legacy, preview and V4. It also holds the brick math, the band math and the tier mapping, all pure.

### 4.4 Wiring

- When the mode is on and the 💣 pill is selected, `StockChart.jsx` hands the plot area to `FuseChart` or `RedZone` instead of the bomb and spectate candlestick paths. The existing `onToggleSR` and `priceLines` paths are untouched.
- `useResearchData.js` skips the synthesizer for the bomb and spectate views when on, and changes nothing else. Request counts are unchanged in every scenario, and the report proves it with the Phase 0 / F3 call-count table.
- Motion: tokens only (§11); reduced motion makes every transition instant and the banked moment a static state.
- Mobile first: the Fuse plus the sheet fit a 390 px viewport without horizontal scroll. Measure 320, 390 and 430 px in a headless browser and report the measurements.

## 5. Fence, files, honesty

- **Fence:** none expected (Phase 0 §J). A new client importer of a §2.3-ratchet basename is recorded in the baseline in the same commit.
- **Expected existing files:**
  - `AssetResearchModal.jsx`, `StockChart.jsx`, `useResearchData.js`, `BaggerBombTab.jsx`, `AnalysisDrawer.jsx`;
  - `AgentBattleScreen.jsx` (mount props and the selector call only), `FreeAgentBar.jsx`, `BaggerBombBattleView.jsx` (one prop each);
  - `chartUtils.js` only if the preview baseline needs it.

  Anything beyond these is a STOP-and-report.
- **Honesty:** §9 display agreement for every number. Each label and its number come from one source. Rung prices and to-go distances come from the same rounded value. The red-zone % is computed from the displayed live price. The forbidden-terms test covers every new string. Never write "the agent held", "will bank" or "entry price" on a preview.

## 6. Tests

New tests only. **No existing test is modified**: with the mode off, every existing test, including the controlled-quote reference rows and `StockChart.controlledSession`, passes untouched. Add rows for:

- **Flag:** off, allowlist, on and unknown → off; allowlist resolves off without an agent battle; the selector is not called when off; byte-identical render of the Battle View and the modal with the mode off on representative fixtures.
- **Ladder:**
  - measured and legacy held, each baseline-precedence branch, entry unavailable;
  - preview and V4;
  - brick math (6/9/12), brick omission on other multipliers, rounding up;
  - points from the constants module.
- **Scored and clock:**
  - both scored sources, the chip's display rule;
  - `nextEligibleSlot` countdown, *checking…* then roll after `lastScoredAt` or five minutes, the closed-market next slot;
  - a clock never computed from `lastCheckedAt + 15`.
- **Red zone:** enter at 0.50%, stay at 0.74%, leave at 0.76%; bank exits or re-bases; market close; crypto never; downside never; the banked moment plays once.
- **Honesty:**
  - no synthesized bar on bomb or spectate with the mode on (a weekend fixture reproduces the Oct 17 Saturday bar with the mode off and refuses it with the mode on);
  - the trace gap is not interpolated;
  - banked time only per BA-4;
  - the preview label never says "entry";
  - one baseline for the preview chart and sheet.
- **Mounts:** with the mode on, a browse mount shows no 💣 and no Bomb tab; each in-battle mount shows them.
- **Layout:** the three widths (§4.4).

**Mutation:** for every item above, revert the fix, show that its test fails, and restore the file byte for byte (SHA-256).

## 7. Checks and review

- **Full suite:** Linux CI-shaped (WSL, Node 20, `TZ=UTC`, `npm run test:run -- --maxWorkers=2`), on the branch merged with current `main`. Assert the exit code, read the `Test Files` line, never pipe through `tail`.
- `npm run lint:gate` and `vite build` both green.
- **Review:** this build crosses the §2 threshold, so run the multi-lens review: four lenses, each with its own refuter, as the wiring follow-up did.
  - **(A) Display honesty and §9:** every number's source, labels versus records, the preview wording.
  - **(B) Wiring and lifecycle:** the flag-off byte identity, the selector off-path, request counts, the clock's states.
  - **(C) Test integrity:** mutation, rows that cannot fail.
  - **(D) Mobile and motion:** the widths, reduced motion, label collision, the banked moment firing once.

  Fix every confirmed in-scope finding. Report the rest.

## 8. The smoke branch (never merged)

Push `claude/research-modal-bomb-smoke` from the PR head with two additions that exist **only** there:
- the mode forced to `'on'`;
- a query-param fixture loader, `?bombFixture=held|approaching|banked|closed|preview|legacy_no_entry`, that feeds the selector from committed JSON fixtures shaped from real battle documents (no production reads).

Put its Vercel preview URL at the top of the report. The founder opens the six states on his phone.

## 9. The report and the PR

The founder is non-technical, so lead the report with a verdict table: one row per area (the flag, the held ladder, the scored chip, the clock, the red zone, the sheet, preview and mounts, no synthesized bar, layout), with the columns *Status · What the player sees · What they saw before*. Then include:
- the cut-from HEAD;
- the §0.4 reconciliation results;
- the mount classification table;
- the call-count table;
- the scored-source proofs;
- the mutation results;
- the review record;
- the `Test Files` line and the exit code;
- the smoke URL;
- found on the way, reported and not fixed. Expected entries: the 1-minute cache age, `baggerbombAdapter`'s second clock, and the dead `setMarkers` call, which is now unreachable with the mode on and is deleted at the `'on'` cleanup.

Open a draft PR titled `feat(research-modal): Build A — Bomb mode (Fuse, red zone, one sheet), dark`. The body is the verdict table. **STOP.** The flip to `'allowlist'` (the founder and FT_QA) is a separate one-line PR after merge.

---

## Rulings and corrections — 2026-11-07 (founder, on the Build A report)

The prompt above stays as it was given. These rulings, made on the build report, override it where they differ.

1. **§0.4(a) STOP — rule (i).** V1 draws the held ladder only when the record is measured (`record.model === 'measured'`). Every legacy-scored position (legacy stocks, and all crypto on any battle) gets the preview. When the player's agent holds that position in a live battle, the sheet does not use the preview's "rungs if it entered at yesterday's close" line. It uses plain held wording instead: `Held · rungs shown from yesterday's close ($X) · this position's live ladder isn't shown here` (`BOMB_COPY.heldPreviewNeeds`, under the honesty test). It never says "entry price" or "will bank", and nothing is lit as banked. The legacy ladder code stays in place but unreachable from the views; it is deleted at the `'on'` cleanup unless a legacy-aware ladder is ruled later. No legacy-aware variant now. This supersedes §3.1's held legacy ladder, and the `legacy_no_entry` state in §8 now shows the held wording.
2. **`FilmRoomScreen.jsx:179` — accepted.** Under `'on'` it loses 💣 and the Bomb tab and opens on Analysis and 1D. A finished battle has no held ladder (BA-1), and the Film Room keeps its own chart.
3. **Correction to §4.1 — the entry chunk.** "It keeps `App.jsx`'s entry chunk byte-identical" cannot hold for a flag read at call time. The guarantee is **identical rendering with the mode off**: the mode-off goldens (`AssetResearchModal.bombModeOff.golden.test.jsx`, `AgentBattleScreen.bombModeOff.golden.test.jsx`) pin the full HTML, every request and every chart-library call.
4. **The first-hour trace — accepted as is.** BA-6 shows the gap: the minute line can stay on yesterday's bars in the first hour after the open, because of the inherited three-stale-answers poll stop and the server's one-hour cache of the 1-minute series. A flip-checklist item in the report covers it. During the allowlist, open a red zone on a weekday between 9:30 and 10:30 ET and record the age of the 1-minute series.

---

## Refinement — both directions (2026-11-10)

The founder's build prompt of Nov 10 ("Bomb mode: both directions, the Danger Zone, the levels table, then 'on' for everyone"), as built. It overrides the sections above where they differ. Report: `docs/audits/20261111_BUILD_BOMB_BOTH_DIRECTIONS.md`.

| ID | As built |
|---|---|
| **BD-1** | `ladder.js finish` also returns `nextDown` (the first unhit downside rung, bust → crash → meltdown) and `hitPoints`. A crossed downside rung carries `hit: true` (the internal `banked` flag stays for the legacy rows). `toGoDown(ladder, live, opts)` mirrors `toGo` in displayed values: `distance = liveShown − rungShown` (positive while above), `pct` of the displayed live price, `pctShown` to two decimals, bricks rounded up, `distance ≤ 0` = at or below the rung. `brickUnit` is one unit for both sides; `brickPlan(ladder, BUST_TIERS)` gives the downside's counts and ticks, omitted alone if the bust multipliers ever leave whole bricks (`bricksSupported(BUST_TIERS)` is pinned). `rungPct` is a rung's move from the displayed baseline to the displayed rung. Nothing is re-derived: a measured ladder's downside prices and hit states are the committed context's. |
| **BD-2** | `stepLead(prev, { up, down, zone })` in `ladder.js`, pure, on the unrounded brick distances: the first look takes the nearer side (a tie goes up); after that the lead moves only when the other side is at least one brick nearer (`LEAD_BAND_BRICKS = 1`); a side with no next rung never leads; a red zone forces up, a Danger Zone down. The state lives in `useBombView` beside the zone state, resets with the symbol, and is not persisted. |
| **BD-3** | The Fuse: one vertical scale (the same pixels per threshold above and below the baseline) whose window shows every rung (−2.12 to +2.22 thresholds, stretched up to ±3 for the live price, the bead held at the edge beyond). The downside rungs are drawn like the upside, in the risk red; a hit rung is solid and titled `BUST · HIT 1:15` (seen) or `BUST · HIT`. "Below · compressed" is gone; the faint red tint stays. The rail runs bottom rung → top rung, teal above the baseline and red below it to the bead; brick ticks on both sides. Two pills — the upside's above its next rung, the downside's below its next rung — the lead strong (gold or red, 9 px bold), the other quiet (ink-3, 8 px, thin border), placed by the existing box search (one more spot: snug on the rung title's box). The halo follows the lead and is red when down leads. On a crowded side, non-next rungs drop their price line first, then the next rung's price moves onto its points' line; a name or the points are never dropped. Rung % strings print at two decimals from the displayed prices, the same string as the bar and the table. |
| **BD-4** | The bar: Meltdown at the left end, TenBagger at the right, the baseline at its true place on one scale, downside marks red; every rung's points; prices on the baseline and each side's next rung only. One to-go line, lead first in its color and weight, the other quieter (`↓ 3.2% · 5 bricks to Bust −10 · ↑ 4.8% · 8 to +15`); inside the band the lead carries the live number. "What has to happen" is lead-aware (`needsFor` + `downAt`; `downIfAtCheck` + `upNeeds`; after a hit `downHitAt` + `downNextBelow`); Build A's banked and all-banked lines stay. |
| **BD-5** | `stepDangerZone` and the combiner `stepZones` in `redZone.js`, on the red zone's own constants (no second pair). Enter within 0.5 % above the next unhit downside rung (at or below is inside), stay to 0.75 %, leave past it, when that rung is hit (the next is judged at the enter band) or at the close (the frozen `dangerClosed` view). Never for a preview, a held-preview or a League battle (all reach it with `held` false), or crypto. A hit plays no moment; the machine reports the hits it saw (`freshHits`) so the view names the check. Both bands at once: the zone showing stays; a first look takes the nearer (tie → red); the red zone's banked moment always shows. The view is `RedZone side="down"`: the downside rung as the goal line in `BT.risk`, no amber heat, `to Bust −10 · 0.42%`, one quiet line `Bust · −10 · hit at the 1:15 check`; the chip reads `Danger zone`. The same spectate series. FQ-9: `sheetOpen.js` opens a measured held stock inside the Danger Zone band on 💣 too. |
| **BD-6** | Under "What has to happen", the levels table: TenBagger, Double Bagger, BaggerBomb, the baseline (`baselineText`), Bust, Crash, Meltdown, top to bottom by price, with one live marker row (`Live $268.09 · −0.8%`, `Last …` closed) where the displayed live price sits. Each row: emoji and name over `±x.xx% · $price`; points (bold, in color) over the state (`✓ banked 1:15`, `hit 1:15`, `next · N bricks`, else nothing). Prices, % and bricks come from `bombView.rungFacts` and the same `toGo` / `toGoDown` as the Fuse and the bar. A preview: the same rows, no states, a `Preview` note. A collapsed `Details` for a measured position carries `StockRewardDetails`' facts, unchanged, from the selector's `record.details` (the same committed context). |
| **BD-7** | `StockDispatchRow` takes `onSeeAllLevels`, which the screen passes only when `bombModeOn`: the Why? panel keeps the proximity line and replaces `StockRewardDetails` with one row, `See all levels ›`. It calls the screen's own door (the gated admission with the player's side, or the shipped modal) and remembers the symbol, so the mount passes `opensOnBomb` and the modal opens on 💣 even with the sheet on. Off, the panel and the goldens are unchanged. |
| **BD-8** | The scored chip names the check: `at the 1:00 check`, `at Mon's 3:45 check` for an earlier session, the time when no slot fits. **Built from `quoteEvidence.observedAt`** (the record's `scored.checkAtMs`), not the provider time `scored.atMs`: EODHD stamps its quotes about 16 minutes before the check reads them (report §1.1), and the provider time names the check two slots early. The sheet chip, the red-zone chip and the Danger Zone chip. |
| **BD-9** | The entry instant is `stockThresholdReceipt.fillQuote.quoteAsOf` (v2 Ruling 1), not `enteredAt`: the baseline label, the ghost line's entry split and `checkDotsOf`. During the session the two are about 16 minutes apart on EODHD's quotes (report §1.2). The Build C sheet's Entry marker reads the same record field. |
| **BD-10** | Every new string is in `bombCopy.js`; downside templates are keyed `down…` / `danger…` and downside nodes tagged `data-side="down"` / `data-level-side="down"`, so the honesty test enumerates them by construction: no downside string or node says "banked". No template says "will"; "Danger zone" is the only new name; no agent verb; no "entry" on a preview's table. |
