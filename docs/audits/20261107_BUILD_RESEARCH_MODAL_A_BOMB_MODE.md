# Research Modal Build A — Bomb mode (Fuse, red zone, one sheet), dark — build report

**Run:** November 7, 2026, one local Claude Code session (Opus 5.5) in the desktop app's worktree `.claude/worktrees/research-modal-bomb-mode-f9b8c6` (local branch `claude/research-modal-bomb-mode-f9b8c6`; the app suffixes worktree branches), pushed by refspec as **`claude/research-modal-bomb-mode`**. Spec of record: `docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md` (the branch's first commit).
**Smoke preview (never merge):** https://trade-seven-gr1n05orc-fais-projects-bc179554.vercel.app — open it with `?bombFixture=held`, `approaching`, `banked` (the bank lands 5 s after load), `closed`, `preview` or `legacy_no_entry`. Branch `claude/research-modal-bomb-smoke` @ `4801fc34` = the code head `8a508641` + `RESEARCH_MODAL_BOMB_MODE` forced `'on'` + the fixture loader (`src/smoke/`; fixtures generated from the real corrected-battle harness, a fixed clock, no production read). All six states were opened on the deployed preview and read back.
**Status:** DRAFT PR, flag `RESEARCH_MODAL_BOMB_MODE = 'off'`. Not merged, not flipped, CI not watched. **STOP.** The flip to `'allowlist'` (the founder and FT_QA) is a separate one-line PR after merge — and, because of the STOP below, after a ruling on legacy battles.

## 1. Verdict

| Area | Status | What the player sees (mode on) | What they saw before |
|---|---|---|---|
| **⛔ STOP — §0.4(a) on legacy-scored positions** | **Found in review (lens A, A2; scoped by its refuter). Reported, not built around. Needs a ruling before the flip.** | Two faults, both on positions the **legacy** scorer rates. (1) On a **legacy (unstamped) battle** the **8:45 PM ET nightly bank** (`api/cron/agent-daily-scores.js:105-153`, `vercel.json:65-66`) re-scores each held name on a fresh quote and can bank a rung outside any check, while the ladder says a rung "scores only at a check". (2) The legacy ladder is a day ladder, re-based every night: from the day's last check (3:45 PM; 12:45 PM on an early close) until the date rolls, the sheet pairs today's rung with tomorrow's check (`Needs $102.50 · next check Mon 9:30 AM` when Monday tests $105.58). Fault 2 also reaches **starting crypto on a stamped battle** (crypto is legacy-scored everywhere). **Measured positions are not affected** (fill × frozen %, banked only by a check; the nightly run on a stamped battle re-scores nothing, `agent-daily-scores.js:70-72`). Recommended ruling, worded per position: **(i) V1 draws the held ladder only when the record is measured — every legacy-scored position (legacy stocks, all crypto) gets the labelled preview**; (ii) a legacy-aware variant later. Neither is built. | — |
| **The flag** | Built, ships `'off'` | Nothing changes until the flip. `'allowlist'` turns Bomb mode on per agent battle from the existing cockpit-status answer (asked once the battle names its owner); `'on'` for every in-battle mount. | — |
| **The held ladder** | Built (measured: clean; legacy: see STOP) | Tapping 💣 on a stock the agent holds draws the **Fuse**: a rail from entry to the top rung, the three rungs with points and prices, the live price as a glowing bead, two weeks of 30-minute closes as a ghost line with the scoring checks as dots. Measured positions use the committed context's exact targets — read from the live battle record, not the copy the modal froze at open (a named departure from §3.1, §5.1); legacy positions use the server's own baseline rule and its entry gate (no swap price and no starting price → "entry unavailable", as the server skips the rung test). | A candlestick chart with seven horizontal lines; a legacy held name anchored on yesterday's close even on the day it was swapped in. |
| **The scored chip** | Built | `live $160.27 · scored $160.19 at 1:00` — always in the red zone; elsewhere only when the two prices differ. A check from an earlier day names its day (`at Thu 1:15`); after the close it reads `last`. | Only the live price. |
| **The clock** | Built | `next check 1:15 · 03:44` from the evaluator's own schedule (`horizon.js`); `checking…` while the cron's queue runs (up to 5 minutes, or until the battle's score passes the slot); `Mon 9:30 AM` outside hours; nothing past the battle's end. | No clock. |
| **The red zone** | Built | Within 0.50 % of the next rung (the **displayed** %) the view switches itself to a goal-line view: the rung across the top, the last hour as one trace, the distance as the biggest number, the clock, the chip. It leaves past 0.75 %, when the rung banks, or at the close; it starts and stops its 15-second poll with the session (9:30 / 4:00). When rungs bank while the modal is open, one **+15 banked** moment plays once (two tiers at one check: one **+45** moment). After the close: `Market closed · last tick 3:59 PM`. | A 1-minute candle chart reached by tapping a small pill; on a weekend it drew a fake Saturday bar. |
| **The sheet** | Built | One sheet under both views: the ladder rail (entry → rungs, banked lit, brick ticks, `1.0% · 2 bricks to +30`) and one line of what has to happen (`Needs $163.12 at a check · next check 3:45`). | A threshold table, and "Entry Price" on stocks nobody bought. |
| **Preview and mounts** | Built | A stock the player does not hold — and a CPU row, and a ticker both sides hold when the row can't be told apart — gets the same Fuse labelled **Preview** with one baseline, yesterday's close, on the chart and the sheet alike; no clock, no red zone, nothing banked; "At +15", never "a check decides". Draft, search and watchlist modals lose the 💣 pill and the Bomb tab (a mount that asked to open on them opens on Analysis and 1D). | "Entry Price … scoring baseline" for any stock; two different baselines on the chart and the tab. |
| **No synthesized bar** | Built | Bomb views draw closed bars only and the live price as a separate mark. | A synthesized "live" candle — the Oct 17 Saturday bar opening at Thursday's close. |
| **Layout** | Measured | 320, 390 and 430 px in a real browser: six states plus the banked moment at each width — no horizontal scroll, no overlapping, clipped or truncated text. Lens D's refuter matrix (59 states, phones and desktop, two fonts, 1,534 renders) leaves one held-crypto state at 320×280 where the pill covers 12.7 px of a rung title (§11). | — |

**Review (BUILD_RULES §2).** Four lenses — A display honesty, B wiring and lifecycle, C test integrity, D mobile and motion — each answered by its own refuter on a fresh snapshot. 39 findings: none refuted; 3 narrower in reach or mis-rated (A1, A4, C11). The refuters broke 6 of the fixes and found 6 more partly holding; all were fixed again with rows and killed mutants, except three inherited or unreachable residuals that are reported (B1's stale-answer stop, the 2027 calendar, D10 below 200 px). Mutation over four rounds: **96 killed, 0 surviving, 2 equivalent** (§10). Full record in §11.

**Open for the founder (none blocks merging dark):** (1) the §0.4(a) STOP ruling before any flip — recommended: held ladder only for measured positions; (2) `FilmRoomScreen.jsx:179` is in battle per Phase 0 but outside the spec's §4.2 mount list — it loses 💣 under `'on'` (§6); (3) §4.1's "entry chunk byte-identical" cannot hold with a call-time flag (§13.4); (4) B1's inherited stale-answer stop and the one-hour 1-minute cache (§13.13) decide how live the trace is in the first hour.

## 2. Preamble

- `git fetch origin` first; **cut from `origin/main` = `d503dd07`** (merge of PR #1028). `main` did not move during the session; every Linux run is "the branch merged with `d503dd07`", a fast-forward (the branch contains it).
- Binding rules read: `CLAUDE.md`, `docs/BUILD_RULES.md` (§1, §2, §3, §8, §9, §10, §11). Inputs read from `main` in the prompt's order: the Phase 0 report (all of §A–§D, §H, §J, §2, §5), direction V2 §2.4, Amendment A (R-11′), concept V1.1 §2.4–§2.6, and the batch-1 design file (unpacked in the scratchpad; screens 5–6 read as code; Bricks and the ENTRY/BANKED/NEXT tiles retired as instructed).
- Commits: `748e84a8` spec · `b4b43d43` flag + mode-off goldens (generated at the pre-build product tree) · `8b6f56d3` the build · `3b3c0637` the mode-on suites · `10b33559` smoke-pass fixes · `daeca1a3` census ruling · `788a2f40` the M17 row · `9275f421` review lens A fixes · `0de2aa10` review lenses B and D fixes · `bd4f0e3b` review lens C rows · `9c2ed500` rows for the mutation re-run's survivors · `2e5e6abf` refuter A and B fixes · `cc3966c6` refuter C and D fixes · `8a508641` the sheet's left-clamp row · this report.

## 3. The §0.4 reconciliation gate — one STOP, found in review

| Check | Result | Evidence (read at `d503dd07`) |
|---|---|---|
| (a) a rung banks only at a scoring check | **STOP for legacy-scored positions** (every stock on an unstamped battle; for the evening re-base, crypto on any battle). **Holds for measured positions.** | **At the build I read only the 15-minute check and recorded "Holds"; review lens A (A2) found the second writer, and I confirmed it.** The nightly run `api/cron/agent-daily-scores.js` (`vercel.json:65-66`, `45 1 * * 2-6` = 8:45 PM ET in winter, 9:45 PM in summer, Mon–Fri) takes a corrected battle to `checkpointCorrectedDaily` and returns (`:70-72`) — no re-score. Every other battle is re-scored there, name by name: `entryPrice = swapPrice \|\| startingPrices[sym] \|\| 0`, skipped at ≤ 0 (`:113-114`), a fresh `currentPrice` (`:135`), and `calculateAssetScoreServer(…, history, …)` (`:144`), whose high-water mark is `max(historyMax, multiplier)` (`api/_utils/agentScoring.js:275-280`) — so a legacy rung **can bank at 8:45 PM**, outside every 15-minute check. Second fault, same battles: the legacy rung test re-bases on each day's previous close (`agent-evaluate.js:1301-1302`) and `thresholdHistory` resets with the day, so after the 3:45 PM last check (`horizon.js:79-80`) the legacy sheet's "Needs $X at a check · next check Mon 9:30 AM" pairs one day's rung with the next day's check. **Sections broken:** spec §0.4(a) and §3.3 (the clock names the check that decides), §3.1 (held legacy), BUILD_RULES §9. **Measured battles:** the rung is the fill × the frozen %, banked only by the check's `crossedTiers` (`src/utils/stockThresholdModel.js:71-74`; `stockThresholdAdmission.js:186`), unaffected. **What the build does today:** a legacy held name draws the full legacy ladder (with the server's entry gate). **What it does not do:** improvise a fix. **Scoping (lens A's refuter):** the nightly bank is legacy-battle only — a stamped battle goes to `checkpointCorrectedDaily` before the per-asset loop and writes only `dailyScores`/`lastDailyResetAt` (`stockThresholdAdmission.js:299-308`); but crypto on a stamped battle is scored by the legacy rung test (`agent-evaluate.js:1265` is stock-only, `:1454` writes its `thresholdHistory`), so the evening re-base reaches a starting crypto there (a swapped-in crypto keeps its `swapPrice` and does not re-base). Ruling options, worded per position: (i) **draw the held ladder only when `record.model === 'measured'`** — every legacy-scored position, all crypto included, gets the labelled preview (one condition in `selectBombRecord`/`bombView`; recommended); (ii) a legacy-aware ladder that names the 8:45 PM run and re-bases after the last check (a design question). |
| (b) `nextEligibleSlot` client-importable as `cockpitModel.js` imports it | **Holds** | `src/screens/battleView/cockpitModel.js:42` imports it from `api/_utils/callRecords/horizon.js:92`; Bomb mode imports it the same way (`BombMode/checkClock.js`). |
| (c) the legacy rung-test baseline precedence | **Holds as Phase 0 §C wrote it — drift is in the prompt's paraphrase** | Phase 0 §C (line 118) reads `swapPrice \|\| startingPrices[sym] (activation day) \|\| previousClose`; the prompt's §0.4(c) dropped "(activation day)". The code: `thresholdBaseline = swapPrice \|\| (isActivationDay ? (startingPrices[sym] \|\| previousClose) : previousClose)` (`agent-evaluate.js:1301-1302`), `isActivationDay` from `firstTradingDayOf(battle) ?? ET date of activatedAt ?? today` (`:1241-1244`), and Guard 2 (`resolveBadgeBaseline`, `:1281-1296`), which Phase 0 did not mention. The server has ONE shared, Node-clean function for this rule — `resolveThresholdBaseline` (`api/_utils/baselineValidation.js:271`); the build applies the precedence through it rather than writing a copy (BUILD_RULES §4). **Plus the entry gate** the rule sits behind: `entryPrice = swapPrice \|\| startingPrices[sym] \|\| 0`, ≤ 0 → no rung test (`agent-evaluate.js:1266-1274`, `agent-daily-scores.js:113-114`); missed at the build, found by lens A (A1), built (`ladder.js` → "entry unavailable"). |
| (d) any needed file on the §1 fence | **None** | Every file touched is in the spec's §5 list or new; fenced files are only *read* (`agentScoring.js`, `agent-evaluate.js`, `agent-daily-scores.js` for citations). No §2.3 ratchet basename is imported. |

**Anchor drift:** none by meaning; every Phase 0 line number cited by the spec still holds at `d503dd07` (`AssetResearchModal.jsx:308-313`, `useResearchData.js:654-722`, `stockThresholdModel.js:71-74`, `agent-evaluate.js:1266`, `:1301-1302`, `horizon.js:92`, `cockpitModel.js:42`). This build moves the modal's `bombData` to `:335`.

## 4. What was built (files)

New, under `src/components/Research/BombMode/`: `bombModeGate.js` (call-time resolver; unknown → off), `useBombModeForBattle.js` (allowlist via the Film Room gate's cached cockpit-status verdict, asked once the owner is known), `selectBombRecord.js` (the pure selector, and `agentBombContext`: the row's identity — `posKey`, else `positionId`, else "the CPU also holds this ticker → preview"), `ladder.js` (held measured / held legacy / preview / V4 adapters, the entry gate, brick and band math on displayed values), `redZone.js` (the machine and its constants), `checkClock.js` (the clock on `horizon.js`), `bombView.js` (ladder dispatch, the chip rule, the sheet templates, the honest trace), `bombCopy.js` (every string), `bombTheme.js` (tokens only; the red-zone heat as `color-mix` of `--ft-red` and `--ft-amber`), `useBombView.js` (the modal's state), `FuseChart.jsx`, `RedZone.jsx`, `BombSheet.jsx`, `BombPlot.jsx`, `useMeasuredWidth.js`. Flag: `src/config/researchModalFlags.js`.

Existing files (all in the spec's §5 list): `AssetResearchModal.jsx` (the `bombContext` prop, BA-5 with its Analysis/1D fallback, the view hook, the plot and sheet), `StockChart.jsx` (two optional props: `bombPlot`, `bombChip`; when the plot is owned the chart container is not rendered, so no chart is created), `useResearchData.js` (option `bombMode`: bomb/spectate return closed bars only), `AgentBattleScreen.jsx` (the gate hook, `bombContextFor` and one spread prop on each of the three mounts), `FreeAgentBar.jsx` and `BaggerBombBattleView.jsx` (one spread prop each). `BaggerBombTab.jsx`, `AnalysisDrawer.jsx` and `chartUtils.js` were not touched (the sheet swap and the tab gating happen at the modal's call sites).

Two existing **test** files carry data/comment-only edits, both required by the repo's own guards (spec §6 says no existing test is modified; no assertion was changed): `src/config/flagPinGuard.test.js` — the "RESEARCH_MODAL_BOMB_MODE intentionally ABSENT" note §4.1 asks for; `src/data/unconfirmedOutcome.census.test.js` — one census entry ruling the selector as an `evaluations` reader (the full suite fails until a new reader is ruled; it reads check dots only).

## 5. Decisions made in the build (for the founder's eye)

1. **Departure from §3.1 — the measured ladder reads the live record, not `bombData.measured`.** The spec says to reuse `bombData.measured`. On the shipped (non-gated) mount the modal freezes its asset at open for a same-symbol update, so `bombData` misses a check that lands while the modal is open — the smoke pass showed the chip saying `scored $160.41 at 1:15` while the ladder still showed +15 unbanked. The selector carries the **same committed context** `bombData.measured` is built from (`committedStockContext`, in `bombData.measured`'s own shape) from the live battle document; a test pins that the two are equal for the same battle. Nothing is re-derived.
2. **CPU positions get a preview.** "A held ladder needs a position in a live agent battle" is read as the player's agent's position. The row is identified by what the mount knows: the gated held view's `posKey`, else the asset's `positionId`; when it knows neither (the shipped path on an unstamped battle) and the CPU also holds the ticker, the row is a preview — never the agent's ladder on what may be the CPU's row (review A4). A finished battle has no held ladder.
3. **The red zone is the hook's spectate view.** Entering it asks `useResearchData` for `'spectate'` (the 1-minute series and its existing 15-second poll); leaving it asks for `'bomb'`. When the session opens or closes under an open red zone, the view re-opens itself so the poll starts at 9:30 and stops at 4:00 (review B1/B4; one more read of each series, the same requests a tap would make).
4. **Market closed is red zone state (c)** only when the last price is inside the 0.5 % band; otherwise the Fuse. A quote observed after the close is not a tick (no dot, `last` wording).
5. **The band is decided on the displayed %** (two decimals): what reads "0.50 %" is in (review A3).
6. **Motion:** the bead moves on `smooth`, the banked moment pops on `bouncy`; reduced motion makes both `instant`. No CSS loops (the mockup's pulsing ember/halo/heat loops are not built; the halo's brightness is static, set by the distance). The 1-second clock runs only while the red zone is on screen.
7. **Bricks:** the canonical multipliers are 1 · 1.5 · 2, so a brick is the threshold / 6 and the rungs sit on bricks 6 · 9 · 12; the to-go count rounds up; any other multiplier set omits the bricks.
8. **An unreadable stock-model stamp** (`stockModelRoute` → `'unavailable'`) gets "measured reward unavailable" with no clock — the evaluator skips that battle, so no check is promised (review A7).

## 6. Mount classification (19 JSX mounts in 17 files; Phase 0 §A)

| Mount | Mode on | Phase 0 §A class | Agrees? |
|---|---|---|---|
| `AgentBattleScreen.jsx` held (gated, controlled quote) | `bombContext {kind:'agent', held, record}` — held ladder for the agent's row (`posKey`), preview for a CPU row | in battle | yes |
| `AgentBattleScreen.jsx` non-held (gated) | `bombContext` — preview unless `positionId` is the agent's | in battle | yes |
| `AgentBattleScreen.jsx` legacy (shipped path; also the cockpit bench door) | `bombContext` — held or preview | in battle | yes |
| `BaggerBomb/FreeAgentBar.jsx` | `bombContext {kind:'bench'}` — preview (`'on'` only; no agent battle → `'allowlist'` is off) | in battle (bench) | yes |
| `screens/BaggerBombBattleView.jsx` | `{kind:'v4', dailyLevels}` on a V4 battle, else `{kind:'bench'}` (`'on'` only) | in battle, no partner | yes |
| `FilmRoomScreen.jsx:179` (legacy Film Room, untaped modes) | **no `bombContext` → loses 💣 and the Bomb tab under `'on'`; it asked to open on the Bomb tab and the 💣 view, so it opens on Analysis and 1D** | in battle ("tape") | **DISAGREES** — Phase 0 lists it in battle; the spec's §4.2 list omits it. Flagged for a ruling. |
| `draft/CommandConsole.jsx`, `draft/TopPerformersModal.jsx` (Snake Draft) | no `bombContext` → lose 💣 / Bomb tab under `'on'` | ambiguous (a battle screen with no agent) | flagged |
| `BaggerBomb/AssetPickerModal.jsx`, `DraftRoomScreen.jsx`, `League/draft/DraftBoardRoom.jsx`, `awaitingOpen/AwaitingOpenPodView.jsx`, `freeAgency/shared/FreeAgencyResearchModal.jsx`, `Dashboard/Watchlist/WatchlistContainer.jsx` | lose the Bomb tab (they showed it by derivation) | third class: draft / acquire | yes (FQ-5 ruled) |
| `discover/DiscoverPanel.jsx`, `Search/SearchDiscover.jsx`, `FantasyTimes/FantasyTimesFeed.jsx`, `FantasyTimes/StoryDetail.jsx`, `Forge/Watchlist/WatchlistAnalysisView.jsx` | unchanged (no 💣, no Bomb tab before or after) | browse | yes |

## 7. Request counts (Phase 0 §J / F3 call-count table)

Recorded by the mode-off goldens (every request in eight scenes) and the mode-on suites (the same recorder). §4.4 says request counts are unchanged in every scenario; **rows marked ≠ are where mode on differs** (review lens B, B2) — each is one more read of a series the modal already uses, no new endpoint.

| Scenario | Mode off | Mode on |
|---|---|---|
| Open on 💣 (held or bench) | `30m {days:20}` · `1d {days:5}` · quote/profile as before | identical |
| The 1-minute view | `1m {days:1}` when the player taps the distance pill, then the 15-second poll while open and the market is open | `1m {days:1}` when the **red zone** opens, then the same 15-second poll — the same request; the trigger is the zone (a held stock within 0.50 % of a rung during market hours) |
| ≠ A rung banks while the player is on the Fuse (B2a) | no request | the zone's moment opens the 1-minute view: `+1m`; leaving it after 5 minutes re-reads `30m` |
| ≠ Tapping 💣 inside the red zone (B2b) | — (no zone) | `+1m`, and the poll restarts |
| ≠ A held name opened after the close inside the band (B2c) | `30m`, `1d` | `+1m` once (the closed red zone's last bars), no poll |
| Leaving the red zone after 5 minutes (B2e) | leaving the 1-minute view re-reads `30m` after 5 minutes | the same rule — only the trigger (the zone, not a tap) differs |
| ≠ The session opens or closes under an open red zone (B1/B4, refuter B's R1) | no poll starts at 9:30; a running poll never stops at 4:00 | `+1m` at each transition (and `+30m` when the 30-minute series is older than 5 minutes — that answer is dropped, not cached); the poll starts at 9:30 / stops at 4:00 |
| ≠ 💣 opened with no asset `bombData` (no threshold, or a measured context unavailable at open; refuter B's R3) | `30m` · `1d {days:5}` · `1d {days:400}` — StockChart bounces the view to 1D | `30m` · `1d {days:5}` · `/api/volatility/thresholds` once when the asset has no threshold (BaggerBombTab's request) — stays on the Fuse |
| ≠ Navigating to another name from the 1-minute view (refuter B's R4) | the new name gets `1m` · `1d {days:5}` · `1d {days:400}` | `1m` · `1d {days:5}` · `30m {days:20}` (the zone is re-decided for the new name on the Fuse) |
| ≠ A mount that loses the Bomb tab but asked to open on it (FilmRoom pattern, B2d; refuter B's R5) | `30m {days:20}` · `1d {days:5}` | `1d {days:400}` only (it opens on 1D) — **fewer**: no 30-minute series fetched and thrown away |
| ≠ 2027 holidays and early closes (refuter B's R2) | — | the zone's calendar (`marketCalendar.js`, has 2027) and the poll's gate (`getMarketState`, 2026 only) disagree: the poll can restart after a 2027 early close or run on a 2027 holiday (§13.9) |
| Leaving the 1-minute view | back to the 30-minute series (in-memory, re-read after 5 minutes) | identical |
| Market closed | `1m` once, no poll | identical (`checkClock`/`sessionOpenAt` start no request) |
| Bomb tab without a threshold | `/api/volatility/thresholds` once per tab mount | identical (the sheet asks under BaggerBombTab's own condition; an asset carrying its threshold asks nothing — pinned) |
| `'allowlist'` | — | one cached cockpit-status verdict per owner, asked once the battle names its owner (B5) |
| Preview / V4 | as "Open on 💣" | identical — previews never enter the red zone |
| Mode off, any mount | — | the selector is never called; no verdict request; no timer |

## 8. The scored-source proofs (spec §3.2)

- **Measured:** `stockRewardContext` returns `currentPrice: quote.price` from the same `quote` whose `high = Math.max(h.high, quote.price)` decides `crossedTiers` (`src/utils/stockThresholdModel.js:71-74`, returned at `:85`); the check commits that context as `scoring.stockRewardContexts.agent.{positionId}` (`api/_utils/stockThresholdAdmission.js:182`). The selector reads `.currentPrice` at `.quoteEvidence.providerAsOf`. The decision quote is `prices[sym].current` unless it is a fallback or a previous-close stand-in (`stockThresholdAdmission.js:149-151`, called at `:161`).
- **Legacy:** the rung test reads `prices[asset.symbol]?.current` (`agent-evaluate.js:1265`); the risk loop stores `lastTickPrice[sym] = stag.lastTickPrice` (`:1967`), where `updateStagnationCounter` returns `lastTickPrice: currentPrice` and `currentPrice = prices[score.symbol]?.current` (`api/_utils/agentRiskManager.js:235-270`, `agent-evaluate.js:1939`). `prices` is built once per tick (`:1176-1186`) and only extended for new hot-bench names (`:1665`), never for a held name. Every non-CPU exit after scoring reaches the risk loop (`:1480-1937` scanned; the `isCpu` passive path round-trips the old pair, CPU battles only). `thresholdHistory` and `cronState.lastTickPrice` go out in one `battleRef.update` (the cron state is finalized onto the same update object), so one snapshot never pairs a new rung with an old scored price. `lastTickTimestamp` is the risk loop's wall clock (`nowMs`, `:1874`), not the provider's quote time — the chip says "at {time}" of that instant. (The 8:45 PM nightly bank writes neither field — see the STOP.)
- Neither source falls back to `evaluations[].evidence[SYM].px` (mutant M16 proves a row fails if it did).

## 9. Layout — measured in a real browser (spec §4.4)

The real modal on the fixture page (the smoke loader, run locally on Vite against placeholder Firebase settings), at **320×700, 390×760 and 430×860**, on the final product code (`9c2ed500`): the six states, plus the banked moment (measured 3.6 s after the bank, inside its 2.4 s beat), **21 renders**. For each: every text box in the plot and the sheet checked pairwise for overlap; every text box against its own SVG box and the plot's `overflow: hidden` box (clipping); every HTML element for `scrollWidth > clientWidth` (ellipsis truncation); every element for horizontal overflow; and the page's `scrollWidth`. **Result: 0 overlaps, 0 clipped, 0 truncated, 0 overflow, `scrollWidth` = viewport width, in all 21.** Plot heights 324 / 354 / 404 px. The mono labels drew in Consolas here (the stack starts with `ui-monospace`, which an iPhone draws as SF Mono — wider; lens D's refuter re-measured with a 0.6 em stand-in, §11).

Before the review, this record was 18 clean renders of the builder's six states — and lens D then found ten defects in **other** states (long labels with the live number, sub-cent prices, two banked tiers, bar lag, short desktop heights). All ten were fixed in `0de2aa10`; the label RULES (which label draws, where it is clamped, when the pill takes two lines) are pinned in `FuseChart.jsdom.test.jsx`, but **no vitest row measures a width** — jsdom has no layout. The widths are this record and the refuter's.

Note: the modal's own root is 100 % wide plus 0.8 px borders (the app ships `content-box`), clipped by `overflow: hidden` — pre-existing, not Bomb mode; the measure uses a 2 px tolerance for it.

## 10. Tests and mutation

**New tests (19 files, 273 rows at `8a508641`; spec §6 rows → files):**

| §6 row | File(s) | Rows |
|---|---|---|
| Flag | `src/config/researchModalFlags.test.js`, `BombMode/bombModeGate.test.js`, `BombMode/useBombModeForBattle.jsdom.test.jsx`, mode-off goldens `AssetResearchModal.bombModeOff.golden.test.jsx` (8 scenes: full HTML, every request, every chart-library call) and `AgentBattleScreen.bombModeOff.golden.test.jsx` (4 scenes) | 5 · 15 · 7 · 8 · 4 |
| Ladder | `BombMode/ladder.test.js` (measured, legacy precedence incl. the entry gate, preview, V4, bricks, band on displayed values), `BombMode/selectBombRecord.test.js` (incl. `agentBombContext`) | 21 · 24 |
| Scored and clock | `BombMode/checkClock.test.js` (incl. "no third clock" source scan), `BombMode/bombView.test.js` | 13 · 19 |
| Red zone | `BombMode/redZone.test.js`, `BombMode/useBombView.jsdom.test.jsx` (per-symbol reset, ghost rules, the 1-second clock) | 23 · 8 |
| Honesty | `BombMode/bombCopy.honesty.test.jsx` (rendered text, source, and an inline-copy scan that parses each component with acorn-jsx, with ten planted cases) | 53 |
| Mounts | `AgentBattleScreen.bombModeOn.jsdom.test.jsx`, `AgentBattleScreen.bombMounts.static.test.js` (each of the three spreads behind `bombModeOn`), `BaggerBomb/bombModeMounts.jsdom.test.jsx` | 8 · 5 · 6 |
| The modal end to end | `AssetResearchModal.bombModeOn.jsdom.test.jsx` (BA-1/4/5/6, red zone with call counts, banked moment, closed, crypto, entry unavailable, review rows A3/A8/C2/C3/C4/C7/C10/D6/N2, B1/B4 poll transitions, no threshold request for a measured position), `useResearchData.bombMode.jsdom.test.jsx` (no synthesized bar) | 30 · 8 |
| Motion | `BombMode/bombMotion.jsdom.test.jsx` (tokens, reduced motion instant, one 2.4 s beat, no timer after unmount) | 5 |
| Layout | `BombMode/FuseChart.jsdom.test.jsx` (the label rules: band, halo, pill and live-label boxes against every left-hand label, the sheet clamps at both ends; widths in §9 and §11) | 11 |

**Mutation** (`mutate.mjs`: each mutant edits one product line in a snapshot tree, runs the named test files under `TZ=UTC`, counts KILLED only on a non-zero exit with the JSON results file deleted first, restores the bytes and checks the SHA-256):

- **Round 1** (the build): **41 of 41 killed** — 40 at first; M17 (the measured scored price) survived, got its row (`788a2f40`) and was killed. Lens C showed M32 ("banked time only per BA-4") died by a crash, not its assertion; BA-4 is guarded anyway (lens C's C-B4 is killed by exactly the BA-4 row).
- **Round 2** (after the review fixes, a fresh snapshot of `bd4f0e3b`): 38 mutants — the builder's set touching the fixed code (M06–M08, M24–M25; M38's guard moved into `agentBombContext`, so N-A4c replaces it), lens C's 16 survivors re-pointed at the rows added for them, and 18 new ones on every review fix. **31 killed; 7 survived.** Five got rows (`9c2ed500`) and were then **killed by exactly those rows** (C-B2 per-symbol banked times, N-A3 / N-A3b the displayed-% band, N-B8 the 1-second clock off screen, N-D6b both rungs' seen time). **Two are equivalent:** C-X1 deletes StockChart's pre-existing "no `bombData` → 1D" bounce, which a hidden mount no longer reaches (it opens on 1D, B2d); N-B5b drops the explicit "`'allowlist'` without an ask → off", which `bombModeOn('allowlist')` already returns without a verdict.
- **Round 3** (refuter A and B fixes, `2e5e6abf`): **4 of 4 killed** — A7 crypto, A8 last tick, B3 daily ghost, N2 the 💣 view's threshold.
- **Round 4** (refuter C's survivors and the refuter C/D fixes, `cc3966c6`): 15 mutants, **14 killed**; R4-S1 (the sheet's left clamp) survived because the fixture never reached the clamp at the static render's 340 px — the row now mounts the sheet at a measured 270 px (`8a508641`) and kills it.
- **Totals: 41 + 36 + 4 + 15 = 96 mutants killed, 0 surviving; 2 equivalent.** Lens C's own two C1 mutants (the gated mounts, 0 of 2 killed at the time) are superseded by C-S1/C-S2, killed by the static guard. Every restore matched its SHA-256. The refuters ran their own sets on top (lens C refuter 44, every kill an assertion on the intended row).

<details><summary>Every mutant, every round (item · file · result · the row that failed)</summary>

**Round 1 (the build, `3b3c0637` + `10b33559`)** — 40 of 41 killed; every file restored byte for byte (SHA-256 checked by the runner: all match).

| # | Item | File | Result | Failing row (first) |
|---|---|---|---|---|
| M01 | Flag: unknown value → off | `bombModeGate.js` | KILLED | the value "ON" resolves "off" |
| M02 | Flag: allowlist resolves off without an agent battle | `bombModeGate.js` | KILLED | 'allowlist' resolves off for a mount with no agent battle, even on a yes |
| M03 | Flag: the selector is not called when off (screen) | `AgentBattleScreen.jsx` | KILLED | held_measured_chip — same markup, same modal props |
| M04 | Flag: byte-identical modal with the mode off | `StockChart.jsx` | KILLED | held_measured_controlled — same HTML, same requests, same chart calls |
| M05 | Flag: the off hook returns nothing (no plot, no sheet) | `useBombView.js` | KILLED | held_measured_controlled — same HTML, same requests, same chart calls |
| M06 | Ladder: legacy precedence — day 2+ never uses the starting price | `selectBombRecord.js` | KILLED | day 2+: previous close, the starting price is NOT used |
| M07 | Ladder: legacy precedence — the activation-day starting price is used | `ladder.js` | KILLED | activation day, starting price |
| M08 | Ladder: entry unavailable — never drawn from nothing | `ladder.js` | KILLED | entry unavailable: a held legacy name whose precedence yields nothing draws no rung |
| M09 | Ladder: measured banked = the committed context's crossed tiers | `selectBombRecord.js` | KILLED | a check that lands while the modal is open reaches the ladder on the shipped (non-controlled) mount… |
| M10 | Ladder: preview and chart share yesterday's close (one baseline) | `AssetResearchModal.jsx` | KILLED | the 💣 view is the Fuse, labelled Preview, no candle; the chart and the sheet share yesterday's clo… |
| M11 | Ladder: V4 levels only when they are today's | `ladder.js` | KILLED | V4: today's dailyLevels and their baseline; levels from another day are not used |
| M12 | Ladder: brick = threshold/6 (6 · 9 · 12) | `ladder.js` | KILLED | the canonical multipliers are 1 · 1.5 · 2, so brick = threshold/6 and the rungs sit on bricks 6 · 9… |
| M13 | Ladder: bricks omitted on other multipliers | `ladder.js` | KILLED | any other multiplier set omits the bricks (and the to-go label drops the brick count) |
| M14 | Ladder: the to-go bricks round up | `ladder.js` | KILLED | the to-go bricks round UP: 1.01 bricks to go reads 2 |
| M15 | Ladder: points from the constants module | `ladder.js` | KILLED | rungs = baseline × (1 + m × threshold/100) with the canonical multipliers; points from the constant… |
| M16 | Scored: legacy source is lastTickPrice (never evidence.px) | `selectBombRecord.js` | KILLED | legacy: no tick yet → no scored price (never evidence.px) |
| M17 | Scored: measured source is the context's currentPrice | `selectBombRecord.js` | **SURVIVED** |  |
| M18 | Scored: the chip's display rule (elsewhere only when they differ) | `bombView.js` | KILLED | elsewhere: only when they differ by at least one display unit |
| M19 | Scored: an earlier session's check names its day | `bombView.js` | KILLED | a scored check from an earlier session names its day; after the close the wording is last, not live |
| M20 | Clock: the next slot from nextEligibleSlot, never lastScoredAt + 15 | `checkClock.js` | KILLED | Mon Nov 9, 10:07:30 ET → next check 10:15, with mm:ss under fifteen minutes |
| M21 | Clock: checking… until lastScoredAt passes the slot | `checkClock.js` | KILLED | then rolls to the next slot once the battle is scored past it |
| M22 | Clock: at most five minutes in the queue | `checkClock.js` | KILLED | or after at most five minutes, scored or not |
| M23 | Clock: outside hours, the next slot's day and time | `checkClock.js` | KILLED | Saturday → Mon 9:30 AM |
| M24 | Red zone: enter at 0.50 % | `redZone.js` | KILLED | enter 0.5 %, leave past 0.75 % |
| M25 | Red zone: leave past 0.75 % | `redZone.js` | KILLED | enter 0.5 %, leave past 0.75 % |
| M26 | Red zone: a bank the modal sees plays the moment | `redZone.js` | KILLED | a check that lands while the modal is open reaches the ladder on the shipped (non-controlled) mount… |
| M27 | Red zone: the banked moment plays once | `redZone.js` | KILLED | a rung already banked at the first look never plays (no invented moment) |
| M28 | Red zone: market close | `redZone.js` | KILLED | a live zone leaves at the close: inside the ENTER band it is the frozen view (c), else the Fuse |
| M29 | Red zone: crypto never | `redZone.js` | KILLED | crypto never enters |
| M30 | Honesty: no synthesized bar on bomb/spectate with the mode on | `useResearchData.js` | KILLED | mode on: refused — the series ends at Thursday's last closed bar |
| M31 | Honesty: the trace gap is never interpolated | `bombView.js` | KILLED | observations at or before the last bar are dropped; later ones are dots, not line points |
| M32 | Honesty: banked time only per BA-4 | `useBombView.js` | KILLED | the 💣 view is the Fuse, labelled Preview, no candle; the chart and the sheet share yesterday's clo… |
| M33 | Honesty: the preview label never says entry | `bombCopy.js` | KILLED | the preview and V4 sheet lines and baseline labels |
| M34 | Honesty: an after-close quote is not a tick | `useBombView.js` | KILLED | the market closed: the frozen view, "Market closed · last tick", and the next check's day and time |
| M35 | Mounts: BA-5 — a browse/acquire mount loses 💣 and the Bomb tab | `AssetResearchModal.jsx` | KILLED | a browse mount (search / Discover / FantasyTimes) |
| M36 | Mounts: the free agent bar passes bombContext | `FreeAgentBar.jsx` | KILLED | 'on': bombContext { kind: 'bench' } |
| M37 | Mounts: the BaggerBomb battle view passes its V4 levels | `BaggerBombBattleView.jsx` | KILLED | 'on', a V4 battle: bombContext { kind: 'v4', dailyLevels } (the battle's own levels) |
| M38 | Mounts: the CPU's position gets a preview, never the agent's ladder | `AgentBattleScreen.jsx` | KILLED | the CPU's row of a shared ticker: a preview, never the agent's ladder |
| M39 | Ladder: a held ladder needs a live battle | `selectBombRecord.js` | KILLED | a finished battle holds nothing live → null (BA-1: a live agent battle) |
| M40 | Wiring: the red zone IS the spectate view (and leaves it) | `useBombView.js` | KILLED | a preview right at a rung never enters the red zone |
| M41 | Motion: reduced motion makes every transition instant | `FuseChart.jsx` | KILLED | reduced motion: every transition is `instant`, and the banked moment is a static state |

**M17 (the measured scored price)** — 1 of 1 killed; every file restored byte for byte (SHA-256 checked by the runner: all match).

| # | Item | File | Result | Failing row (first) |
|---|---|---|---|---|
| M17 | Scored: measured source is the context's currentPrice | `selectBombRecord.js` | KILLED | measured: the price the LATEST check read — not the position's high (two checks: 103, then 101) |

**Lens C C1 (gated mounts, pre-static-guard)** — 0 of 2 killed; every file restored byte for byte (SHA-256 checked by the runner: all match).

| # | Item | File | Result | Failing row (first) |
|---|---|---|---|---|
| C1a | Gated held mount: no bombContext with the mode off | `AgentBattleScreen.jsx` | **SURVIVED** |  |
| C1b | Gated non-held mount: no bombContext with the mode off | `AgentBattleScreen.jsx` | **SURVIVED** |  |

**Round 2 (after the review fixes, snapshot of `bd4f0e3b`)** — 31 of 38 killed; every file restored byte for byte (SHA-256 checked by the runner: all match).

| # | Item | File | Result | Failing row (first) |
|---|---|---|---|---|
| M06 | Ladder: legacy precedence — day 2+ never uses the starting price | `selectBombRecord.js` | KILLED | day 2+: previous close, the starting price is NOT used |
| M07 | Ladder: legacy precedence — the activation-day starting price is used | `ladder.js` | KILLED | activation day, starting price |
| M08 | Ladder: entry unavailable — never drawn from nothing | `ladder.js` | KILLED | entry unavailable: a held legacy name whose precedence yields nothing draws no rung |
| M24 | Red zone: enter at 0.50 % | `redZone.js` | KILLED | enter 0.5 %, leave past 0.75 % |
| M25 | Red zone: leave past 0.75 % | `redZone.js` | KILLED | enter 0.5 %, leave past 0.75 % |
| C-S1 | off: gated HELD mount leaks bombContext | `AgentBattleScreen.jsx` | KILLED | held (gated) mount: one spread, gated on bombModeOn, with its row identity |
| C-S2 | off: gated NON-HELD mount leaks bombContext | `AgentBattleScreen.jsx` | KILLED | non-held (gated) mount: one spread, gated on bombModeOn, with its row identity |
| C-B1 | BA-4: banked time names the check slot, not the scored instant | `useBombView.js` | KILLED | C4: a late queue (the 1:15 slot scored at 1:19:20) — the banked moment names the 1:15 check, never … |
| C-B2 | BA-4: banked times reset on a new symbol | `useBombView.js` | **SURVIVED** |  |
| C-B3 | BA-6: observations reset on a new symbol | `useBombView.js` | KILLED | a new symbol drops the old symbol's observed quotes (BA-6 dots never cross symbols) |
| C-C1 | sheet: checking… template | `bombView.js` | KILLED | C3: at the slot, before the battle is scored past it, the sheet says checking… |
| C-C2 | sheet: checking flag wired from the clock | `useBombView.js` | KILLED | C3: at the slot, before the battle is scored past it, the sheet says checking… |
| C-L1 | R-11'(d): inside the band the live label yields | `FuseChart.jsx` | KILLED | in band (0.38 %): no live label; the pill names the live price |
| C-L3 | halo brightens as distance shrinks | `FuseChart.jsx` | KILLED | closer → brighter; 3 % or more → the faint floor |
| C-H1 | inline JSX copy followed by an expression | `RedZone.jsx` | KILLED | RedZone.jsx types no copy inline in JSX text |
| C-H2 | inline JSX copy on its own line | `FuseChart.jsx` | KILLED | FuseChart.jsx types no copy inline in JSX text |
| C-X1 | BA-5 row: hidden mount falls back to 1D | `StockChart.jsx` | **SURVIVED** |  |
| C-G10 | on: sheet asks thresholds only when the asset carries none | `AssetResearchModal.jsx` | KILLED | C2: an asset that carries its threshold — the sheet asks the thresholds route nothing |
| C-G12 | on: the Bomb tab shows for every bombContext mount | `AssetResearchModal.jsx` | KILLED | C10: a preview with no asset threshold still shows the 💣 pill and the Bomb tab |
| N-A1 | A1 the server entry gate: no swap and no starting price → no rung test | `ladder.js` | KILLED | the ENTRY GATE: activation day, no starting price, no swap (the server returns before the rung test… |
| N-A3 | A3 the zone steps on the displayed % | `useBombView.js` | **SURVIVED** |  |
| N-A3b | A3 the Fuse band on the displayed % | `FuseChart.jsx` | **SURVIVED** |  |
| N-A4 | A4 a ticker the CPU also holds, row unknown → preview | `selectBombRecord.js` | KILLED | the agent's own chip on a ticker the CPU also holds: a preview, never a ladder that might be the CP… |
| N-A4b | A4 the posKey names the agent row (C-S3 after the move) | `selectBombRecord.js` | KILLED | the gated held view by posKey: the player's slot → the record; the CPU's slot or another slot → a p… |
| N-A4c | A4 the positionId names the agent row | `selectBombRecord.js` | KILLED | the CPU's row of a shared ticker: a preview, never the agent's ladder |
| N-A5 | A5 an unavailable stock stamp is unsupported, never the legacy ladder | `selectBombRecord.js` | KILLED | a stamp the reader refuses → model unsupported (unsupported_stock_model) |
| N-B1 | B1/B4 the session opening or closing re-opens the spectate view | `useBombView.js` | KILLED | B1: opened at 9:29 in a closed red zone — at 9:30 the zone opens and the 15-second poll starts |
| N-B3 | B3 the ghost keeps 30-minute bars only | `useBombView.js` | KILLED | the ghost keeps 30-minute bars only — minute bars left over after spectate → bomb are never drawn a… |
| N-B5 | B5 allowlist asks only once the owner is known | `useBombModeForBattle.js` | KILLED | 'allowlist' before the battle names its owner: off and nothing asked (one request per owner, review… |
| N-B5b | B5 'allowlist' without an ask reads off | `useBombModeForBattle.js` | **SURVIVED** |  |
| N-B7 | B7 no readable battle end → no bound, never a blank clock | `checkClock.js` | KILLED | no bound — a countdown, never a blank clock |
| N-B8 | B8 the 1-second clock only while the red zone is on screen | `useBombView.js` | **SURVIVED** |  |
| N-B2d | B2(d) BA-5: a hidden 💣 view opens on 1D | `AssetResearchModal.jsx` | KILLED | C7: the BA-5 fallback of a mount that opens on the Bomb tab and the 💣 view — Analysis is the open … |
| N-PILL | C10 the 💣 pill shows on an in-battle mount with no asset threshold | `AssetResearchModal.jsx` | KILLED | C10: a preview with no asset threshold still shows the 💣 pill and the Bomb tab |
| N-D6 | D6 two tiers banked at one check: one moment for both | `redZone.js` | KILLED | two tiers banking at ONE check play one moment for both (named by the higher), each marked played |
| N-D6b | D6 the seen time lands on every tier the moment banked | `useBombView.js` | **SURVIVED** |  |
| N-D2 | D2 the pill goes to two lines when one does not fit | `FuseChart.jsx` | KILLED | at 320 px a long in-band label goes to two lines; at 430 px it is one |
| N-D1 | D1 the sheet clamps its to-go label by its own width | `BombSheet.jsx` | KILLED | the label is centred over the next rung but clamped by its own drawn width |

**Round 2 survivors re-run against the rows added for them (`9c2ed500`)** — 5 of 5 killed; every file restored byte for byte (SHA-256 checked by the runner: all match).

| # | Item | File | Result | Failing row (first) |
|---|---|---|---|---|
| C-B2r | BA-4: banked times reset on a new symbol | `useBombView.js` | KILLED | a new symbol drops the banked times the modal saw for the old one (BA-4 never crosses symbols) |
| N-A3r | A3 the zone steps on the displayed % | `useBombView.js` | KILLED | A3: the zone enters on the DISPLAYED % — $0.82 below +30 is 0.5025 %, shown 0.50 %, and is in the r… |
| N-A3br | A3 the Fuse band on the displayed % | `FuseChart.jsx` | KILLED | the band reads the DISPLAYED % (review A3): 0.5025 % shows as 0.50 % and is in band |
| N-B8r | B8 the 1-second clock only while the red zone is on screen | `useBombView.js` | KILLED | the 1-second clock runs only while the red zone is on screen (review B8): on the 1D chart it ticks … |
| N-D6br | D6 the seen time lands on every tier the moment banked | `useBombView.js` | KILLED | D6: two tiers banked at one check — one moment for +45, and both rungs carry the check time the mod… |

**Round 3 — refuter A and B fixes (`2e5e6abf`)** — 4 of 4 killed; every file restored byte for byte (SHA-256 checked by the runner: all match).

| # | Item | File | Result | Failing row (first) |
|---|---|---|---|---|
| R3-A7 | A7 crypto on an unreadable stamp is unsupported too | `selectBombRecord.js` | KILLED | …and a crypto name on that battle too: the scorer skips the whole battle, so no check comes for it … |
| R3-A8 | A8 last tick never a 30-minute bar | `RedZone.jsx` | KILLED | A8: closed with no minute bars (the 30-minute fallback) — "Market closed", never a 30-minute bar's … |
| R3-B3 | B3 the ghost never takes daily bars | `useBombView.js` | KILLED | …nor the 1D chart's daily bars, still held while the 30-minute series loads after 1D → 💣 (refuter … |
| R3-N2 | N2 the 💣 view asks for its threshold | `AssetResearchModal.jsx` | KILLED | N2: the 💣 view opened without an asset threshold asks for one once and draws the Fuse — not "no la… |

**Round 4 — refuter C and D fixes and refuter C survivors (`cc3966c6`)** — 14 of 15 killed; every file restored byte for byte (SHA-256 checked by the runner: all match).

| # | Item | File | Result | Failing row (first) |
|---|---|---|---|---|
| R4-D2 | D2 the pill takes the first placement that covers no label | `FuseChart.jsx` | KILLED | a long in-band label at 320 / 360 / 375 px: every line fits the pill, and the pill covers no title,… |
| R4-D7 | D7 the left live label covers no title or pill | `FuseChart.jsx` | KILLED | the live label pushed left of the rail covers no rung title — a title carrying its seen check time … |
| R4-D7b | D7 a title box includes its seen check time | `FuseChart.jsx` | KILLED | the live label pushed left of the rail covers no rung title — a title carrying its seen check time … |
| R4-VB5 | C9 a new symbol resets the red-zone memory | `useBombView.js` | KILLED | a new symbol starts its own red-zone memory: rungs already banked on it are not a fresh bank (no fa… |
| R4-VO3 | ghost: only from the bomb view | `useBombView.js` | KILLED | the minute bars the red zone shows never become the ghost: 30-min → spectate (1-min) → back on the … |
| R4-G10b | C2 no threshold request off the Bomb tab and 💣 view | `AssetResearchModal.jsx` | KILLED | C10: a preview with no asset threshold still shows the 💣 pill and the Bomb tab |
| R4-G10c | C2 a measured position never asks | `AssetResearchModal.jsx` | KILLED | a measured position never asks the thresholds route — its rungs are the committed context (refuter … |
| R4-F4 | C6 the pill suffix on the displayed % | `FuseChart.jsx` | KILLED | the band reads the DISPLAYED % (review A3): 0.5025 % shows as 0.50 % and is in band |
| R4-F2 | C6 in band at exactly the displayed 0.50 % | `FuseChart.jsx` | KILLED | the band reads the DISPLAYED % (review A3): 0.5025 % shows as 0.50 % and is in band |
| R4-F3 | C6 the halo floor at 3 % | `FuseChart.jsx` | KILLED | closer → brighter; 3 % or more → the faint floor |
| R4-S1 | D1 the sheet label clamped at the left edge | `BombSheet.jsx` | **SURVIVED** |  |
| R4-L2 | C6 the right-hand live label searches for a clear slot | `FuseChart.jsx` | KILLED | right of the rail, the live label clears every rung label block (points + price) and the down ticks… |
| R4-H4 | C8 text after an expression | `FuseChart.jsx` | KILLED | FuseChart.jsx types no copy inline in JSX |
| R4-H5 | C8 text under a `>` alone on its line | `FuseChart.jsx` | KILLED | FuseChart.jsx types no copy inline in JSX |
| R4-H6 | C8 a literal child string | `RedZone.jsx` | KILLED | RedZone.jsx types no copy inline in JSX |

**Round 4 survivor re-run against its corrected row (`8a508641`)** — 1 of 1 killed; every file restored byte for byte (SHA-256 checked by the runner: all match).

| # | Item | File | Result | Failing row (first) |
|---|---|---|---|---|
| R4-S1r | D1 the sheet label clamped at the left edge | `BombSheet.jsx` | KILLED | …at the left end too: on a narrow sheet (270 px measured) a long label over the first rung stays in… |

</details>

## 11. The review record (BUILD_RULES §2: four lenses, each refuted)

Four review lenses ran on fresh snapshots (A, B, D at `10b33559`; C at `788a2f40`), each a separate agent with its own repro files. Each lens then got its **own refuter** on a fresh snapshot of `bd4f0e3b` (after the review fixes), handed that lens's findings and the fix commits and told to refute the findings and break the fixes. What a refuter broke was fixed and mutated again (rounds 3–4, §10). The full lens and refuter reports are in the session scratchpad; the dispositions are below.

**Totals.** 39 findings. Refuters: 35 CONFIRMED (B7 moot in production; B2's part (e) only a trigger change), 3 PARTLY (A1 and A4 narrower in reach, C11 mis-rated), **none refuted**. Of the fixes, refuters found **6 BROKEN** (A7 for crypto, A8, B3 for 1D → 💣, C8's scan, D2, D7) and **6 partly holding** (B1, B4 on 2027 dates, C2, C6, C9, D10). Every broken or partial fix was fixed again with a row and a killed mutant — except B1's inherited stale-answer stop, B4's 2027 calendar and D10 below 200 px, which are reported (§13).

### Lens A — display honesty, §9 (refuter: 17 probe rows)

| # | Finding (reviewer's rating) | Refuter on the finding | What the build did | Refuter on the fix → after |
|---|---|---|---|---|
| A1 | Legacy name with no swap and no starting price still gets a ladder; the server never rung-tests it (MAJOR) | PARTLY — real, but `startingPrices` covers the whole creation roster, bench and CPU (`decide.js:829-872`, `agentBattleService.js:174`); reaches hot-bench and catalyst swap-ins and Guard-1-dropped names | `ladder.js` entry gate → "entry unavailable" (`9275f421`) | HOLDS |
| A2 | Legacy rungs bank outside a check (nightly bank) and the ladder re-bases nightly (STOP) | CONFIRMED; nightly bank legacy-battle only; evening re-base also starting crypto on stamped battles | **STOP, reported** (§1, §3) | — |
| A3 | Band decided on raw %, shown rounded (MAJOR) | CONFIRMED | zone and Fuse band on `pctShown` (`9275f421`) | HOLDS (nit: the halo's brightness still reads the raw % — visual only) |
| A4 | A CPU row of a shared ticker gets the agent's ladder (MAJOR) | PARTLY — stock overlap reachable via hot-bench/catalyst swaps; the crypto leg cannot happen (`cpuOpponentGenerator.js:27,53,89`) | `agentBombContext` (`9275f421`) | HOLDS; cost: the agent's own row of a shared ticker becomes a preview on the shipped mount (§13.7) |
| A5 | Floor label always "−1%" (MINOR) | CONFIRMED | real % from displayed values | HOLDS (nit: the sign at a floor equal to live) |
| A6 | "$undefined" in the banked line (MINOR) | CONFIRMED (render; no path found) | `bankedLine` omits a missing part | HOLDS |
| A7 | Unreadable stamp promises a check (MINOR) | CONFIRMED, too narrow (crypto too) | stocks → "scoring model unavailable" | **BROKEN for crypto** → every name on that battle (`2e5e6abf`, R3-A7 killed) |
| A8 | "Last tick" time and price from two sources (MINOR) | CONFIRMED | reworded | **BROKEN** (30-minute fallback named a bar's open) → a tick is a minute bar or a quote seen while open; else "Market closed" (`2e5e6abf`, R3-A8 killed). The chip's "last $X" (the quote) and the trace's tick time stay two labelled facts. |
| — | The measured ladder from the live record (departure §5.1) | SAFE and necessary: deep-equal to `bombData.measured` at open; after a later check the record has the new `crossedTiers` and the frozen copy does not | named in §1 and §5.1 | — |
| N1 | (refuter) On stamped battles crypto `thresholdHistory` never resets while its baseline re-bases daily, so the Fuse can mark "+15 ✓" at a price the coin never reached — the check counts it the same way | LOW, a server-model question | reported (§13.12) | — |

### Lens B — wiring and lifecycle (refuter: 20 lifecycle probes + the reviewer's 17 repros re-run)

| # | Finding | Refuter on the finding | What the build did | Refuter on the fix → after |
|---|---|---|---|---|
| B1 | A red zone opened before 9:30 never gets its poll (major) | CONFIRMED | re-open the view at 9:30 / 4:00 (`0de2aa10`) | **PARTLY** — the poll starts, but the inherited rule that stops it after three stale answers (`useResearchData.js:488,504`) ends it at 9:31 when the series still ends yesterday; nothing re-opens it, and the one-hour server cache can serve yesterday's bars until ~10:29. Reported (§13.13); the row now serves realistic bars (`2e5e6abf`). |
| B2 | Request counts differ from mode off (minor) | CONFIRMED (a)(b)(c); (e) PARTLY (same 5-minute rule as mode off) | (d) fixed — the hidden mount opens on 1D; the rest in §7 | (d) HOLDS; refuter added R1–R5, now in §7 |
| B3 | The ghost can draw minute bars (minor) | CONFIRMED | spacing ≥ 30 min | **BROKEN for 1D → 💣** (daily bars passed) → 30–60 min only (`2e5e6abf`, R3-B3 killed) |
| B4 | The poll runs after the close (minor) | CONFIRMED | re-open at 4:00 | HOLDS on 2026 dates; **PARTLY** on 2027 holidays and early closes (two calendars, §13.9) — reported |
| B5 | Allowlist asks twice per cold mount (minor) | CONFIRMED | ask once the owner is known | HOLDS (the gate adds exactly one call) |
| B6 | The chart decides on the frozen `bombData` (minor) | CONFIRMED | `BOMB_MODE_PILL` stand-in | HOLDS; side effect N2 (a no-threshold preview's 💣 said "no ladder yet" until the tab opened) → the 💣 view asks for the threshold once (`2e5e6abf`, R3-N2 killed) |
| B7 | No clock without a battle end (nit) | CONFIRMED, moot (`expiresAt` is always written) | `MAX_SAFE_INTEGER` | HOLDS |
| B8 | The moment can play off screen; the 1 Hz clock runs on 1D (nit) | CONFIRMED | 1 Hz only on the bomb views | HOLDS; the off-screen moment reported (§13.10) |
| B9 | Mode-off goldens don't reach the gated mounts (nit) | CONFIRMED | per-mount static guard (`bd4f0e3b`) | HOLDS for the three mounts; a `bombContext` passed through a spread object built elsewhere would pass it (with refuter C's two-edit leaks) — reported (§13.14) |

### Lens C — test integrity (refuter: 44 mutants, every kill an assertion on the intended row)

| # | Finding | Refuter on the finding | What the build did | Refuter on the fix → after |
|---|---|---|---|---|
| C1 | Two of three screen mounts have no row | CONFIRMED | static guard | HOLDS (pattern-complete, not leak-complete — §13.14) |
| C2 | A new thresholds request is not caught | CONFIRMED | C2 row | **PARTLY** (X-G10b tab gate, X-G10c measured gate survived) → rows (`cc3966c6`; R4-G10b, R4-G10c killed) |
| C3 | "checking…" never rendered | CONFIRMED | C3 row | HOLDS |
| C4 | Fixture can't tell slot from scored instant | CONFIRMED | late-queue row | HOLDS |
| C5 | M32 killed by a crash | CONFIRMED (a record gap, not a test gap) | reported | — |
| C6 | R-11′(d) and the halo have no row | CONFIRMED | FuseChart rows | **PARTLY** (raw-% suffix, `<` for `<=`, halo `/6`, the sheet's left clamp, the right-hand slot search survived) → rows (`9c2ed500`, `cc3966c6`, `8a508641`; R4-F2/F3/F4/L2/S1r killed) |
| C7 | BA-5 row asserts less than its title | CONFIRMED | C7 row | HOLDS; StockChart's pre-existing 1D bounce is now equivalent (§10) |
| C8 | The inline-copy scan has holes | CONFIRMED | tightened regex | **BROKEN** (text after an expression, `>` alone on its line, text led by a colon) → the scan now parses JSX with acorn + acorn-jsx (`cc3966c6`; R4-H4/H5/H6 killed) |
| C9 | Per-symbol reset unguarded | CONFIRMED | row | **PARTLY** (banked times — row in `9c2ed500`; the zone memory) → row (`cc3966c6`, R4-VB5 killed) |
| C10 | No row for 💣 with a null `bombData` | CONFIRMED | C10 row | HOLDS |
| C11 | Cosmetic / near-equivalent survivors | PARTLY, mis-rated — the ghost from spectate bars is a network-latency window, not a flash | row (`cc3966c6`, R4-VO3 killed); the 1-minute trace-from-ghost flash stays near-equivalent | — |
| C12 | No layout row | CONFIRMED | rules rows only; widths measured (§9) | — |

### Lens D — mobile and motion (refuter: 1,534 renders in headless Edge, two fonts)

| # | Finding | Refuter on the finding | What the build did | Refuter on the fix → after |
|---|---|---|---|---|
| D1 | Sheet label runs off the screen | CONFIRMED | clamp by own width | HOLDS (smallest margin 6.7 px Consolas, 1.6 px at 0.6 em) |
| D2 | Pill text spills at 320 | CONFIRMED | width-sized pill, two lines | **BROKEN** — the 28 px two-line pill covered titles and the caption at 320/360/375 → placement by label boxes (`cc3966c6`): 43 of 45 flags gone (re-measured below) |
| D3 | Chip truncates at 320 | CONFIRMED | chip wraps | HOLDS |
| D4 | Trace-end label on the floor label | CONFIRMED | own row | HOLDS |
| D5 | Live label on the date axis | CONFIRMED | avoids the axis | HOLDS |
| D6 | Two tiers at one check: one moment, the lower | CONFIRMED | one moment for all, named by the highest, points summed | HOLDS (+45; three at once +95) |
| D7 | Rung rows collide at desktop heights | CONFIRMED | seen time moved into the title | **BROKEN** — the longer title met the live label pushed left of the rail at 320 → the left label is placed against the title boxes (`cc3966c6`): gone |
| D8 | "No minute bars yet" under the distance block | CONFIRMED (reach unproven) | own row | HOLDS |
| D9 | Sub-cent prices collide at 320 | CONFIRMED | 7 px for long prices | HOLDS (note: every 10+ character price drops to 7 px; prices print without thousands separators) |
| D10 | Red zone taller than its box | CONFIRMED (reach unproven) | min height 200 | **PARTLY** — 200–239 px clean; below 200 the wrapper clips the chip and clock (691×180). Reach unproven (a desktop container under ~444 px). Reported. |

**The re-measure after `cc3966c6`** (refuter D's harness, its 59 states × 13 sizes × 2 fonts = 1,534 renders, against its own run at `bd4f0e3b`): no horizontal scroll, no clipping, no truncation, no pill text outside its pill, no console errors. Phone sizes (320–430 × 280–440): flags 74 → 34 (default fonts) and 91 → 36 (0.6 em) — every D2 and D7 overlap gone. **Left at phone sizes:** (1) one new case, `crypto_inband_top_huge` at 320×280/324 (a held crypto over $100,000 inside the band of its top rung, both lower rungs banked): no placement is clear in a 37 px rung gap, so the pill takes the one that covers least and hides 12.7 × 7.8 px of the "+30" title (before the fix it covered the caption); (2) harness-only states (a held stock drawn on the Fuse at or over its rung, which in production is the red zone); (3) the banked moment's numeral box against the rung tag — box overlap, ink clear (refuter's zoomed screenshot); (4) the bead's 25 %-opacity halo over the right-aligned trace-end label (nit). Desktop sizes: flags unchanged (345 / 348) — the right-hand rung blocks (points over the price below) touch at plot heights 200–220, pre-existing.

**Motion** (refuter D): unchanged by every fix — two `motionToken` sites, no keyframes or CSS transitions in BombMode, reduced motion maps to `instant` (by the code path; not a render), one 2,400 ms moment timer, none after unmount; with the red zone off screen the clock ticks every 15 s.

## 12. Checks

All on Linux (WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `--maxWorkers=8` under `flock /tmp/pd-suite.lock`, the CI-shaped settings this machine uses), in a private worktree of the code head merged with `origin/main` = `d503dd07` (a fast-forward: the branch contains it). Exit codes are read from the run, not from piped output.

| Check | Tree | Result |
|---|---|---|
| Full vitest suite | `8a508641` + main `d503dd07` | **exit 0** — `Test Files 1313 passed \| 8 skipped (1321)` · `Tests 28948 passed \| 89 skipped (29037)` · 292 s |
| `npm run lint:gate` | same | **exit 0** (`--max-warnings 0`) |
| `vite build` | same | **exit 0** |
| Earlier full run on the same head | same | exit 1 — one row, `api/_utils/filmTape/tapeAstraReview.test.js` F1, `Test timed out in 5000ms`, while a 1,534-render Edge matrix loaded the host. Not a Bomb-mode file; it passed 3 of 3 alone in the same tree, and the quiet re-run above is the record. |
| Earlier full run, `9c2ed500` (before the refuters) | + main | exit 0 — `Test Files 1313 passed \| 8 skipped (1321)` · `Tests 28937 passed \| 89 skipped (29026)` |

The report commit that follows the code head adds this file only.

## 13. Found on the way — reported, not fixed

1. **The 1-minute series' age** — Phase 0 found a one-hour server cache on `historical_{SYM}_1m_1`. Not observed in this build: the smoke page answers the minute series from committed fixtures (no production read, spec §8), and today is a Saturday, so no live session exists to read the cache's age against. What the build adds is the trace-end label (`1-MIN BARS TO 12:56`), which shows the age on screen. Refuter B measured the consequence with the inherited poll rules (§13.13). Reading the cache's real age needs a weekday session — an item for the flip checklist. Lens D measured what that lag does to the trace label (D4, fixed): the label now has its own row.
2. **`baggerbombAdapter.js`'s second clock** — `deriveDueAt(lastCheckedAt) = last + 15 min` (`src/adapters/baggerbombAdapter.js:360`) still coexists with `horizon.js`; Bomb mode uses only `horizon.js` (a static row forbids `lastCheckedAt/lastScoredAt +` in BombMode sources). Not touched.
3. **The dead `setMarkers` call** (`StockChart.jsx:499-500`, `typeof bombSeries.setMarkers === 'function'` is false under lightweight-charts 5.1.0) — unreachable with the mode on (no chart is created on the bomb views); delete it at the `'on'` cleanup.
4. **The entry chunk is not byte-identical, and cannot be in this design.** The modal is statically in the entry chunk (`App.jsx` → `components/BaggerBomb` index → `FreeAgentBar` → the modal), and the flag is read at call time (spec §4.1), so nothing folds: unminified, the entry grew 8,985,766 → 9,052,448 bytes (+66,682) at the build and every lazy chunk's hash moved with it. The separate flag module keeps `featureFlags.js`'s namespace unchanged. The guarantee this build gives is **render** identity with the mode off (the goldens). §4.1's "keeps App.jsx's entry chunk byte-identical" is a spec tension for the founder.
5. **The modal freezes its asset at open on the shipped path** (`navAsset` re-syncs only on a symbol change), so the mode-off Bomb tab and 💣 chart show a measured context as of the open, not the latest check. Bomb mode no longer depends on it (§5.1); the mode-off path is unchanged.
6. **A preview's threshold** is what the Bomb tab uses today: the asset's (the bench builders give `DEFAULT_THRESHOLD = 2.5`) or `/api/volatility/thresholds`. In a measured-model battle a stock that entered would freeze its own measured %, so a preview's rungs there approximate what entry would give. Labelled Preview; a ruling could switch it.
7. **A ticker both sides hold, on the shipped mount.** The research asset carries a `positionId` only for a measured stock (`researchAssetBuilder.js:99-124`), so on a legacy battle (and for crypto) the shipped mount cannot tell the CPU's row from the agent's. It now gives the preview to BOTH rows of a ticker both sides hold (A4) — the agent's own row of that ticker loses its ladder there. The gated mount (dark, behind `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED`) tells them apart by `posKey`. Reachability: the CPU avoids the agent's symbols at creation (`cpuOpponentGenerator.js:23`, `decide.js:837`); an overlap needs a later agent swap into a CPU name — not checked on real battles.
8. **The legacy previous close is the client's daily bar**, Guard 2's own reference; the server's real-time `previousClose` may differ from it by under 0.5 ATR (Guard 2 accepts it unchanged in that band). The label says "yesterday's close".
9. **Two market calendars disagree from 2027-01-01** (lens B): `utils/marketCalendar.js` (the zone's open/closed answer, through `sessionOpenAt`) has 2027; `utils/marketHolidays.js` / `getMarketState` (the poll's gate in `useResearchData`) has only 2026. On a 2027 holiday or early close the zone and the poll will disagree. Not Bomb mode's file; one owner should hold both.
10. **The banked moment can be used up off screen** (lens B, B8): if the player is on 1D when a rung banks, the moment plays where nobody sees it; back on 💣 the banked time shows (BA-4) but the moment does not replay. Left as is — replaying would need a "seen" notion the spec does not define.
11. **`color-mix()` is a first in `src/`** (the red-zone heat and `tint()`): Safari before 16.2 does not support it. There the declaration is dropped and the element keeps whatever fill it would otherwise have — not tested on such a browser.
12. **Stamped-battle crypto: lifetime high-water mark, daily baseline** (lens A's refuter, N1). On a stamped battle, crypto `thresholdHistory` never resets while its baseline re-bases each day, so the Fuse can mark "+15 ✓" at a price the coin never reached that day — and the check counts the badge the same way, so the screen matches the score. A server-model question, not a §9 break.
13. **The first hour of a red zone opened before 9:30** (lens B's refuter). The build re-opens the view at 9:30 so the poll starts, but the inherited `useResearchData` rule stops the poll after three stale answers (`:488`, `:504`): if the minute series still ends yesterday at 9:30:45, the poll ends at 9:31 and nothing restarts it, and the one-hour server cache on `historical_{SYM}_1m_1` can serve the 9:29 answer until about 10:29. The quotes seen while open keep arriving as dots; the line stays on yesterday's bars. Not changed — widening the stale rule or adding re-opens adds requests §4.4 forbids without a ruling.
14. **The mount guard is pattern-complete, not leak-complete** (B9, C1 refuters). The static guard reads each mount's own spread; a `bombContext` built elsewhere and spread in (two edits on the dark gated path) would pass it, and the gated mounts never render in a test while `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED` is false. Catching that needs a screen harness with the integrity flag mocked on — accepted as a residual for now.
15. **Layout residuals** (lens D's refuter, §11): one held-crypto state at 320×280 with no clear spot for the pill (12.7 × 7.8 px over the "+30" title); the right-hand rung blocks touching at desktop plot heights 200–220 (pre-existing); below 200 px the plot wrapper clips the red zone's chip and clock (reach unproven); the pill falls to 7.5 px type when nothing larger fits.
16. **Windows-only rows:** `shadowCpuQuoteIntegrityFlags.test.js` and `AgentBattleScreen.controller.test.jsx` read source with `\n`-anchored patterns and fail on a CRLF checkout; both pass on Linux (the record). Pre-existing class.
