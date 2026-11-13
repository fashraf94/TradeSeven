# Research modal — the two-view shell: spec V1 (as built)

**Date:** Thu Nov 12, 2026 · **Status:** spec of record for the shell build (Build 2), dark.
**Design of record:** `docs/design/research-modal/RESEARCH_MODAL_DIRECTION_V2_AMENDMENT_C_20261112.md` (Amendment C, R-23–R-35), round 5 (screens A, A2, D, H) and round 4 (screen B) beside it.
**Flag:** `RESEARCH_MODAL_SHEET_MODE` (`src/config/researchModalFlags.js`), shipping `'off'`. No third flag (R-28).
**Build report:** `docs/audits/20261112_BUILD_RESEARCH_MODAL_SHELL.md`.
**Rulings and the pre-'on' fixes (2026-11-12):** §10 below; report `docs/audits/20261112_FLIP_AND_FIX_RESEARCH_MODAL_SHELL.md`. They override any section above where they differ. **The questions follow the row (2026-11-13):** §11. **The Battle chart (2026-11-13):** §12. The flag's `'allowlist'` step is its own founder PR (`claude/research-modal-sheet-allowlist`).

## 0. In plain terms

Under the flag, opening a stock no longer shows a chart with a drawer of tabs under it. It shows one of three full-screen views, switched by pills in the header: **Analysis** (opens first), **Chart**, and **💣** (only on a mount with Bomb mode). In an agent battle, the Analysis view is Build C's content — the archetype's lens on the stock — laid out as round 5 drew it. In browse, it is the stock's facts. Under the Analysis content sit four tabs of today's content: *What's moving · Ranks · Smart Money · Sector*.

With the flag `'off'` the modal is today's, byte for byte (the mode-off goldens). The build adds no store, no request, no provider call and no model call. Nothing the agent sees or trades changes.

## 1. Amendment C's rulings, as built

| # | Ruling | As built |
|---|---|---|
| R-23 | Voice label = the player's agent name + the archetype | *What it decided* carries `{Agent} · {Archetype} · {time}` (`SHELL_COPY.voiceLabel`), the name from `sheetContext.agentName`, never a literal; the archetype alone when the battle names no agent. The time is the quote's; an exit flag's eyebrow already names it. |
| R-24 | Two states of the Analysis view | State 1 built; state 2 recorded (§9), not built. |
| R-25 | First research version uses existing fields | Nothing of state 2 built. |
| R-26 | Tap first | Every action is a tap: pills, tabs, rows, *see on chart*, *Look it up*. No drag. |
| R-27 | H1: three filled pills of equal width, two in browse; 💣 warms in a zone; no *Why?* door; *What's moving* first tab | Built in `ChartHeader.jsx` (`ShellPills`): `flex: 1` each, the active one filled with its accent, the others a hairline; 💣 warms with `HEAT` while the view model is in a LIVE zone (`isLiveZoneMode`: approaching, banked, danger — never a shut market's frozen view) and it is not the active pill. Round 5 H1's drawing gives 💣 a fixed 64 px; the ruling's letter (*equal width*) was built. The header's change pill is the day's change only (the research hook's), shown once known. |
| R-28 | The shell is Build C's delivery under `RESEARCH_MODAL_SHEET_MODE` | Build C's record logic reused unchanged (`useSheetView`, `packs.js`, `latestLine.js`, `AskReply.jsx`, `sheetOpen.js`, the server path). Build C's layout — the shorter chart above the drawer, the drawer's mid snap and footer — is removed from the modal. `AnalysisDrawer`'s Build C props (`midY`, `footer`, `analysisAlways`) are no longer passed by anyone; their removal is for the cleanup PR. |
| R-29 | The pinned Ask as Build C built it, *Ask {Agent}: {question} · 1 msg* | `SheetActionRow` as built (its cost line `· 1 message · N left`, → Cockpit), addressed to the agent by name (the archetype when none). See reading §6.4. |
| R-30 | A door that doesn't exist yet is absent | No *Work this idea*, no technical-read strip, no placeholder row. |
| R-31 | Overlap carries the Lab's label and window | No overlap reading is shown in state 1 (state 2 only). |
| R-32 | Ranking labels are precise | The Ranks tab names the shown rank's group and day (`ranksLabel.js`, through `CompeteTab`'s one additive prop `rankLabel`). |
| R-33 | The agent's identity stays visible in the research state | State 2 (§9). |
| R-34 | State 2 is dark; the Analysis view is an ordered list of blocks | `AnalysisSheet.jsx` exports `battleBlocks` / `browseBlocks` (each `{ key, node }`) and `AnalysisBlocks`, which renders them in order; the later build prepends its blocks. No prop, branch or UI for state 2. |
| R-35 | Stocks first | `sheetModeOn` resolves off at every value for a crypto, an index or a sector ETF; the modal is then today's modal (a row pins crypto + `sheetContext` at `'on'` byte-equal to crypto at `'off'`). |

## 2. The build's rulings (SB-1–SB-14), as built

- **SB-1 — the flag.** Docstring rewritten (`'off'` today's modal byte for byte; `'allowlist'` the shell for an allowlisted owner's agent-battle mounts; `'on'` every v2 mount, browse included). `resolveSheetMode` and the server's Ask gate (`api/_utils/researchAsk.js`) are untouched. The literal stays `'off'` and its pin row with it. Since the shell, the modal reads the mode itself: a `sheetContext` handed over at `'off'` is ignored (a row pins it).
- **SB-2 — the gate.** `sheetModeOn(mode, { agentBattle, verdict, asset })` (`sheetMode.js`, still import-free for the server): `asset` other than `'stock'` → off; `'on'` → on for every mount; `'allowlist'` → on only for an agent battle with a true verdict; `'off'` → off. The modal calls it on its displayed asset with `agentBattle = verdict = (sheetContext handed over)` — the battle screen hands `sheetContext` only when its per-battle gate resolved on, so its presence is the verdict. `useSheetModeForBattle` keeps its own answer: on at `'on'` only with a battle id (a screen with no battle yet passes no hollow context).
- **SB-3 — the header.** `ChartHeader`'s new optional `shell` prop renders the stock row (back, symbol, name, price, day change, close) and the pills; absent, the header is today's (same markup with no prop and with `shell={null}`).
- **SB-4 — three views, no drawer.** One view at a time at full height; no `AnalysisDrawer`, no chart on Analysis. State machine in §3.
- **SB-5 — Analysis in battle**: the ordered blocks *stance · decided · questions · wallSt · tabs*. Build C's `data-` attributes kept (`data-sheet-root`, `-layer`, `-stance`, `-chip`, `-idea`, `-voice`, `-voice-line`, `-questions`, `-question`, `-pack`, `-back`, `-weighs`, `-or-ask`, `-tucked`, `-about`, `data-pack-item`, `-status`). A pack item is no longer a toggle button (there is no chart beside it); its pin is reached by *see on chart ›* (`data-pack-see`).
- **SB-6 — Analysis in browse**: *browseAsk · wallSt · tabs*; today's five preset questions (`AnalysisQATab`) folded into one row, *Ask about this stock* (SQ-3); the mount's action row unchanged. A battle mount whose sheet has no model yet shows *wallSt · tabs* — never the preset questions (BC-1).
- **SB-7 — the tab strip.** `ShellTabs.jsx`: *What's moving · Ranks · Smart Money · Sector*, `position: sticky; top: 0` inside the Analysis view's own scroll box, no scroll listener. Today's `CompeteTab` (+ `rankLabel`), `SmartMoneyTab` and `SectorTab`, with today's props, in full; a tab mounts only while shown (its reads go out on the tap, as the drawer's do). *What's moving* (`WhatsMoving.jsx`) is the Why? popup's content through the popup's own hook (`useWhyMoving`, extracted from `WhyMovingPopup.jsx`, the popup's markup unchanged), with the popup's props but the header's own day change (§6.1b), **loaded on the player's tap** (§6.1), and the foot *From the wire and the day's bar · not {Agent}'s view* (no name in browse). `SectorETFRanksTab` applies nowhere: a sector ETF keeps today's modal (R-35).
- **SB-8 — the Chart view.** `StockChart` at the view's measured height less its 44 px control row and a 72 px peek (240–560 px), with 1D/1W, the automatic trend lines, SMA · S/R · Idea and Build C's pins (handed whenever the sheet is on; only the Chart view draws them); today's `TechnicalTabV2` below in the same scroll with `onLevelHighlight` wired (SQ-1). No stop price; no technical-read strip; no 💣 pill inside the chart (💣 is a view; with Bomb mode rolled back the legacy bomb chart keeps its pill).
- **SB-9 — the 💣 view.** The zone chip when in a zone, `BombPlot` at the Chart view's plot height, then `BombSheet` (the bar, *What has to happen*, the levels table). Nothing in `src/components/Research/BombMode/` changed (BombPlot already took `height`).
- **SB-10 — the action row.** In battle, Build C's `SheetActionRow`, pinned under every view (outside each view's scroll box); in browse, the mount's own action section, unchanged. The phone modal keeps FQ-6's `100dvh` (`visibleViewportHeight`) with its border inside it.
- **SB-11 — B1.** `packs.js` rung item: `pin: pricePin(go.rungShown)`. The facts golden (`packs.facts.golden.json`) carries no pin, so no golden line moved; a modal row pins the line at $103.78 = the fact's cent.
- **SB-12 — absent on purpose.** *Work this idea*; the technical-read strip; any state 2 UI; any Battle Research prop.
- **SB-13 — copy.** Every new string in `SHELL_COPY` (`sheetCopy.js`), scanned by `sheetCopy.honesty.test.jsx`; no agent name literal in the sheet's sources or the header (a row walks their ASTs). No "will", no agent verbs, no "live".
- **SB-14 — tokens and motion.** `--ft-*` through `sheetTheme.js` (`ST`, `tint`), `HEAT` from `bombTheme.js`; no new hex (the sheet's guard scans every module in `Sheet/`). View switches fade with the `fade` token (`motionToken`, instant under reduced motion): the Chart and 💣 views through a motion wrapper as they mount; the Analysis view, which stays mounted while hidden, through framer's `animate` each time it is shown.

## 3. The view state machine (`Sheet/shellView.js`, driven from the modal's handlers)

| From | Action | View | Timeframe set |
|---|---|---|---|
| open | — | `analysis`; `bomb` when FQ-9 (`opensInRedZone`) or BD-7 (`opensOnBomb`) decided so at open, or (BS-1, §10) on a mount with a `bombContext` and no `sheetContext` whose `defaultTab` / `defaultTimeframe` asks for the bomb | initial `'1D'`; `'bomb'` when opening on 💣 |
| analysis ↔ chart | pill | the other | none (the hook refetches nothing it holds) |
| analysis / chart | 💣 pill | `bomb` | `'bomb'` (Bomb mode's zone logic then moves it to `'spectate'` and back, as today) |
| bomb | Analysis / Chart pill | that view | the Chart view's last timeframe (`1D` or `1W`; `1D` if none) — in the pill's handler, never an effect |
| analysis | *see on chart ›* on a pack item | `chart` | `'1D'` when the pin is a time pin and the chart is on 1W; none otherwise. The item becomes the open one (never toggled closed by the link). |
| any | navigation (Ranks, Sector) to a stock | stays | none; the Analysis view scrolls to the top |
| any | navigation to a crypto / index / sector ETF | today's modal for that asset (R-35); back to the stock returns to the shell | — |
| today's modal | the shell appears on the open modal (a late `'allowlist'` verdict; a stock reached from an index or ETF) | the view of the series on screen: `bomb` on the bomb series with Bomb mode, `chart` for the legacy bomb chart, else `analysis` (`viewOnShellAppear`, review B2) | none |
| any | *Ask* from Chart or 💣 | `analysis` (the Ask's card is there) | as the pill switch |
| Chart or 💣 | an Ask's answer or failed turn lands (asked from Analysis, then the player switched) | `analysis` (refuter A1); away from Analysis an asked row reads *Asked {Agent} · the answer is on Analysis* | as the pill switch |

The Analysis view stays mounted while another view shows (its open tab and what that tab loaded survive a switch). The Chart and 💣 views mount on show. S/R is reset when the chart unmounts.

## 4. The mounts (every `<AssetResearchModal` site — 19 in 17 files; 17 pass `version={2}` (an 18th hit is a comment), 2 take the default `version = 2`)

Off = today's modal. Shell (battle) = the archetype's Analysis view + Build C's action row. Shell (browse) = the stock's facts + the mount's action. Pills: 3 with a `bombContext`, else 2. Crypto, index and sector-ETF assets are today's modal at every value (R-35).

| # | Mount | `'off'` | `'allowlist'` | `'on'` |
|---|---|---|---|---|
| 1–3 | `AgentBattleScreen.jsx` — held (gated), non-held (gated), legacy (+ the cockpit bench door through them) | Off | Shell (battle), 3 pills — allowlisted owner's battle; else Off | Shell (battle), 3 pills |
| 4 | `BaggerBombBattleView.jsx` (`bombContext` v4 / bench) | Off | Off | Shell (browse), 3 pills — opens on 💣 (its `defaultTimeframe` is the bomb; BS-1) |
| 5 | `BaggerBomb/FreeAgentBar.jsx` (`bombContext` bench) | Off | Off | Shell (browse), 3 pills — opens on 💣 (its `defaultTab` and `defaultTimeframe`; BS-1) |
| 6 | `FilmRoomScreen.jsx` (`isGameContext`, no `bombContext`) | Off | Off | Shell (browse), 2 pills |
| 7 | `BaggerBomb/AssetPickerModal.jsx` (`actionConfig`) | Off | Off | Shell (browse), its action |
| 8 | `Dashboard/Watchlist/WatchlistContainer.jsx` (*Add to Watchlist*) | Off | Off | Shell (browse), its action |
| 9 | `discover/DiscoverPanel.jsx` | Off | Off | Shell (browse), no action |
| 10 | `draft/CommandConsole.jsx` (`showActionButton`, no config → Close) | Off | Off | Shell (browse), Close |
| 11 | `draft/TopPerformersModal.jsx` | Off | Off | Shell (browse) |
| 12 | `FantasyTimes/FantasyTimesFeed.jsx` | Off | Off | Shell (browse) |
| 13 | `FantasyTimes/StoryDetail.jsx` | Off | Off | Shell (browse) |
| 14 | `Forge/Watchlist/WatchlistAnalysisView.jsx` | Off | Off | Shell (browse) |
| 15 | `freeAgency/shared/FreeAgencyResearchModal.jsx` (`actionConfig`) | Off | Off | Shell (browse), its action |
| 16 | `Search/SearchDiscover.jsx` | Off | Off | Shell (browse) |
| 17 | `screens/DraftRoomScreen.jsx` (ON THE CLOCK, Acquire) | Off | Off | Shell (browse), ON THE CLOCK banner + Acquire |
| 18 | `League/draft/DraftBoardRoom.jsx` (default v2; ON THE CLOCK, Acquire, `isAcquirable`) | Off | Off | Shell (browse), ON THE CLOCK + Acquire / Close |
| 19 | `Tournament/awaitingOpen/AwaitingOpenPodView.jsx` (default v2) | Off | Off | Shell (browse), Close |

(Rows 1–3 are three mounts in one file: 20 sites in all.)

## 5. Founder questions, as ruled (defaults applied)

| # | Question | Ruled |
|---|---|---|
| SQ-1 | Where does today's Technical tab content go? | Below the chart in the Chart view, same scroll. |
| SQ-2 | Crypto, index and sector-ETF assets? | Today's layout at every flag value (R-35); their shells are a follow-up. |
| SQ-3 | The browse Analysis tab's five preset AI questions? | Kept as one collapsed row until Build D replaces them. |

## 6. Readings — built one way, put to the founder

1. **What's moving loads on a tap.** The tab is the first one and mounts with the Analysis view; loading on mount would send `/api/why-moving` (a provider call) on every open, which the build forbids. It shows its title and *Look it up · from the wire and the day's bar ›*; one tap sends the popup's request, as the old *Why?* door did. Round 5 A draws it already loaded.
1b. **What's moving's number is the header's** (BUILD_RULES §9): the title prints (at two decimals, as the header), and the request carries, the day's change and price the header shows, the change only once known — the rule the controlled view's popup already followed. The request's inputs are frozen at the tap (a live tick never aborts and re-sends it — each re-send a provider call); a Retry is a new tap with the numbers then on screen. Today's popup sends the battle asset's own `percentChange` (for a held position, its change since entry) on the other mounts; the popup itself is unchanged.
2. **"The holding line, when held" (§3.2)** is built as Build C's stance for every kind: held, *On the bench · flagged at …*, *Looked at … · not held now* (FQ-2's ruling on screen), *Not examined in this game*. Build C's move chip reads *+2.4%*, not round 5's *+4.3% since entry* (the stance's text is Build C's, reused unchanged).
3. **Pills of equal width** (R-27's letter) — round 5 H1's drawing gives 💣 a fixed 64 px.
4. **The Ask's label** is *Ask {Agent}: {question}* (R-29), with Build C's cost line *· 1 message · N left* kept as built (SB-10), not round 5's *Ask · 1 msg*. The reply card's sending and failure lines (`AskReply.jsx`, unchanged) are handed the same name, so *Juno is answering…* / *Juno didn't answer* match the row (review A2); the answered card keeps *Its answer · {Archetype}* beside the agent's tag. The archetype when the battle names no agent. An Ask sent from Chart or 💣, or answered while the player looks there, brings the player to its card on the Analysis view (review A1).
5. **Build C's crypto sheet (BC-15) is not reachable** under R-35: a crypto holding in battle gets today's modal at every value until the crypto shell.
6. **Mounts with a `bombContext` but no `sheetContext`** (BaggerBomb battle view, free agent bar) get three pills over the browse content at `'on'`. *As first built they opened on Analysis, not their `defaultTab` 💣; the founder changed this on 2026-11-12 (BS-1, §10): they open on 💣 when their `defaultTab` or `defaultTimeframe` asks for the bomb.*
7. **The smoke's tabs read public market data** (§8).
8. **R-27's "warms … in the red zone or the Danger Zone"** is read as the LIVE zones (approaching, the banked moment, danger): after the bell the zone is frozen (Bomb mode greys its own chip, "never live"), and the pill stays cool (review A3). At first build the pill followed `isZoneMode`, which includes the frozen views.

## 7. Tests

- `AssetResearchModal.shell.jsdom.test.jsx` — the gate per mount (browse at each value, battle at `'allowlist'`, crypto identity, index, sector ETF, stock → ETF → back), the pills and the warm 💣, the state machine (1W restored; no refetch on a switch), the block order in battle and browse, today's tabs and props, the sticky strip, What's moving on a tap, the Chart view (trend lines, pins, Technical below, no stop price), the 💣 view, the browse action.
- `AssetResearchModal.sheetModeOn.jsdom.test.jsx` — Build C's rows re-driven through the shell; B1's row; a `sheetContext` at `'off'` ignored.
- `sheetGate.jsdom.test.jsx` (mode × mount × asset), `shellView.test.js`, `ranksLabel.test.js`, `CompeteTab.rankLabel.jsdom.test.jsx`, `WhyMovingPopup.hook.jsdom.test.jsx`, `sheetCopy.honesty.test.jsx` (SHELL_COPY, the new components, no agent-name literal), `shellFold.browser.test.js` (the 375-px fold, against a URL).
- Kill switch: `AssetResearchModal.sheetModeOff`, `AgentBattleScreen.sheetModeOff`, `AssetResearchModal.bombModeOff`, `AgentBattleScreen.bombModeOff` goldens unchanged.

## 8. The smoke branch (never merged)

`claude/research-modal-shell-smoke`, built from the PR head by git plumbing: the mode forced `'on'`; `?sheetFixture=held_tf | held_cp | held_legacy | bench_incumbent | unexamined | budget_out | held_redzone | browse_ceg` feeding Build C's committed battle fixtures (battle states with their `bombContext`, as Bomb mode `'on'` hands it; `browse_ceg` = Constellation Energy from search with *Add to Watchlist*). The Ask is answered by a canned *SMOKE ONLY* reply and What's moving by a canned *SMOKE ONLY* explanation — no model or provider call. Reading: the Ranks, Smart Money and Sector tabs are today's components and read what they read today — public market data only (`/api/stocks/peer-rankings`, `/api/stocks/sector-rankings`, and the read-if-true documents `indexIntelligence/stockRankings`, `stockTechnicalScores/{SYM}`, `institutionalHoldings/{SYM}`), read-only — so the founder can check that they show everything; no battle, user, agent or chat record is read.

## 9. State 2, recorded for the later build (Amendment C §6)

The order on open: the header and pills; the context strip (the question, each refinement, the group, the active conditions, the readings' time, *‹ Back to ranking*, *{Agent} · {Archetype}*); *For this question*; the finding with *Use across my bench*; *Compare with a holding*; the prepared answers; the game line; the Wall St · About line; the four tabs; the action row with a free-text Ask and *→ Cockpit*. The later build prepends its blocks to `battleBlocks`' list (R-34) and adds the free-text Ask to the action row.

## 10. The founder's rulings (2026-11-12) and the pre-'on' fixes (BS-1–BS-4), as built

The founder's flip-and-fix prompt of Nov 12 ruled on the build report's ten readings (report §3) and named the fixes that land before `'on'`. Its `'allowlist'` flip is a separate founder PR (`claude/research-modal-sheet-allowlist`). Report: `docs/audits/20261112_FLIP_AND_FIX_RESEARCH_MODAL_SHELL.md`.

### 10.1 The ten readings (build report §3)

| # | Reading | Ruling |
|---|---|---|
| 1 | What's moving loads on a tap | **Kept as built** |
| 2 | What's moving's number is the header's (§9) | **Kept as built** |
| 3 | The holding line is Build C's stance for every kind | **Kept as built** |
| 4 | Pills of equal width (R-27's letter) | **Kept as built** |
| 5 | The Ask's label and its card's lines | **Kept as built** |
| 6 | Build C's crypto sheet is not reachable (R-35) | **Kept as built** |
| 7 | Mounts with Bomb mode but no sheet open on Analysis | **Changed:** BS-1 below |
| 8 | The smoke's tabs read public market data | **Kept as built** |
| 9 | The 💣 pill warms in the LIVE zones only | **Kept as built** |
| 10 | The shell appearing mid-modal re-decides the view | **Kept as built** |

### 10.2 The pre-'on' fixes, as built

| ID | As built |
|---|---|
| **BS-1** | **A Bomb-only mount opens on 💣.** `shellView.bombOnlyOpensOnBomb({ defaultTab, defaultTimeframe })`: true when `defaultTab` is `'baggerbomb'` or `defaultTimeframe` is `'bomb'` or `'spectate'`. The modal adds it to the open-on-💣 decision only for a mount with a `bombContext` and **no** `sheetContext` (the BaggerBomb battle view, which always passes `defaultTimeframe="bomb"`; the free-agent bar, `defaultTab="baggerbomb"` and `defaultTimeframe="bomb"`), so both open on 💣 at `'on'` on the 30-minute series, as they do off the shell; a Bomb-mode mount that asks for neither opens on Analysis. The agent Battle View's mounts hand a `sheetContext` and keep FQ-9 and BD-7 unchanged. Review C5's row, which pinned reading 7 as first built, is rewritten to this. |
| **BS-2** | **See on chart holds the item, not its slot** (build report §12 A8). `useSheetView` keeps the open pack item by its key, `packs.itemKeyOf(item)` = its `kind` and `symbol` (fields every item already carries: the items are the Ask's `researchAsk.items` and the facts golden's, so no field is added). `candidateItems` builds at most one item per kind, so the key is unique within a pack (a row checks every archetype at three prices, with and without an incumbent). The open item is found by its key in the pack of the moment; one that has left the pack closes (its caption and its line go, the Chart view shows the record's latest pin as with nothing tapped) and stays closed if it comes back — reopening it is a new tap. `tapItem(i)` still takes the slot a tap lands on and stores that item's key. The refuter's repro is the row: `rung_distance` drops at $103.83 and `check_read` takes its slot; `check_read` is never opened. |
| **BS-3** | **The stock row at 320 px** (build report §12.7). The price and the day's change size by `clamp()`, as the tabs' labels do: `SHELL_PRICE_FONT = clamp(12px, 3.6vw, 14px)`, `SHELL_CHANGE_FONT = clamp(10px, 2.95vw, 11.5px)` — 12 / 10 px at 320, 13.5 / 11.06 px at 375, the old 14 / 11.5 px from 390 up. The name keeps its ellipsis. Measured in headless Edge on the real header inside the phone modal's box (100vw, border-box, a 1 px border; `shellHeader.browser.test.js`, run with `SHELL_HEADER_BROWSER=1`): at 320 and 375, GOOGL and BRK.A, with and without the back arrow, ✕'s 44 px box is inside the screen, and the name keeps at least 8 px. **The app prints a price with no thousands separator** (`priceText`: `$712345.67`); the build report's 2.2 px clip came from a measurement that substituted `$712,345.67`, 7.7 px wider. The rows draw both; the comma form with the refuter's ▼ 12.34% and a back arrow leaves the name 9.2 px at 320. Segoe UI and Consolas drew here; SF Pro and SF Mono on an iPhone are unmeasured. |
| **BS-4** | The 💣 preview's rung size for a stock the agent does not hold, in a battle scored by the measured ATR model: the rankings' ATR reading. Built in Bomb mode; recorded in `RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md`, "BS-4". It applies under the shell and off it alike. |

## 11. The questions follow the row (QF-0 – QF-10, 2026-11-13), as built

The founder's live battle test of Nov 13 found the questions the same for every stock — written for a bench candidate, so a held stock was asked "Is this better than what's stalled?", and under Capital Preserver (which never rotates quiet names) "stalled" was always empty. The build prompt of Nov 13 ruled QF-0 – QF-10. Report: `docs/audits/20261113_BUILD_RESEARCH_MODAL_QUESTIONS_AND_BATTLE_CHART.md`.

### 11.1 QF-0 — what a swap-out does to a held measured stock's points (read before any code)

- A measured battle's every swap goes through `executeCorrectedStockSwap` (`agentSwapExecution.js:227-229`). It scores the outgoing stock at the **swap's own exit quote** (`stockThresholdAdmission.js:258, 263`) and writes that `totalPoints` both as `closedTrade.lockedPoints` (`:269`) and as the position's closed score component (`:276`). On a measured battle the banked score is the sum of the closed components (`:173-175`; `agent-evaluate.js:1427-1430`).
- `totalPoints = round(gain × 10 × tierMultiplier + calculatePoints(crossedTiers))` (`baggerBombUtils.js:538-543`). `crossedTiers` holds both sides — upside tiers banked, downside tiers hit (negative) — and is lifetime: a history that loses a tier is refused (`stockThresholdModel.js:69-76`).
- So **a swap-out locks the gain part and every crossed rung at the exit price; holding keeps the gain part moving with the price while the rungs stay.** No archetype or preset names a take-profit rule; the exit rules a pack can quote are the preset's risk levers and the archetype's forced rotation, which the risk items already quote. QF-0 passed (no STOP).

### 11.2 As built

| ID | As built |
|---|---|
| **QF-1** | `packs.questionSetOf({ battle, symbol, nowMs, row, standing })` → `{ questions, notOnLadder }`: a held measured stock gets `take_profit` when its committed context's rungs from entry are > 0 at the last check, else `weakest_spot` (down, exactly flat, or no committed context yet), then the standing two in `standingOrder` (which replaces `questionOrder`); a stock you don't hold gets `better_than_stalled`, then the standing two; a held position the ladder does not score (crypto; any stock in a legacy-scored battle) gets the standing two and the line *{SYM} isn't on the measured ladder, so only the standing questions apply.* (`data-sheet-not-on-ladder`). `useSheetView` decides the set ONCE per opening (`sheetKey`) — the first render with a model — and keeps it, the standing order included; a pick outside the set is refused. |
| **QF-2** | `Sheet/book.js` (pure, Node-clean): `bookOf(battle)` reads every agent position in book order; a stock on a corrected battle with a valid `committedStockContext` is ranked by its `multiplier` (rungs from entry) **as printed** (one decimal, `rungsShownOf`), ties to the nearer next downside rung (`penaltyProximity.distance`, rungs), then book order. Crypto and legacy are *not on the ladder* — named, never ranked; a measured stock with no committed context yet is left out. On screen: *EQIX is −0.4 rungs from entry, the lowest of your 6 stocks · at the Wed 12:45 check · not on the ladder: ETH*. The check named is the latest `quoteEvidence.observedAt` among the ranked contexts (BD-8). |
| **QF-3** | `weakest_spot`'s candidates: `book_rank` (its place), `move_since_entry`, `quiet_ticks` (*{SYM}: N quiet checks in a row; {Archetype} counts a name stalled at T*, or *{Archetype} doesn't rotate out of quiet names*), `check_read`, `bench_alternative` (the names that can come in for this slot now — `swappable.swappableNames`, the bench door's own test: bench or hot bench, not held, not cooling down, same class — the highest `arch_scores` first; its rank among every ranked stock by that score; its rung size the same rankings row's `techRaw.atrPercent` at the bench sheet's one decimal, BS-4's reading, dropped outside BS-4's 96-hour window). |
| **QF-4** | `take_profit`'s candidates: `lock_now` (*Swapped out at the {time} check's $P, it would lock +T: +G from the gain, +B banked[, −H from downside rungs]* — `book.lockNowOf` calls `calculateAssetScoreV3` with the committed context, never a copy of the math; the split is the scorer's `basePoints` and `calculatePoints` over each side's crossed tiers), `rung_distance` (Build C's, `toGo`), `rung_down` (*$X (p%) down to entry at $E · $Y (q%) down to the next downside rung, Bust (−10) at $R* — `toGoDown`, displayed values), `risk_lever`, `risk_verdict`, `bench_alternative`. |
| **QF-5** | **The id `better_than_stalled` is kept** — `chat.js:1144` writes it into every research exchange, and a client from before the deploy would send it to the new server; only its text (*Is this better than our weakest holding?*) and pack changed. The compare is the bench door's incumbent when passed, else QF-2's weakest (`book_rank` naming the weakest; `rung_compare` and `rank_scores` compare against it). The stalled list joins only when the archetype rotates (`stalledItem` omits itself otherwise). |
| **QF-6** | `QUESTION_IDS` adds `weakest_spot`, `take_profit`; `ITEM_KINDS` adds `book_rank`, `quiet_ticks`, `bench_alternative`, `lock_now`, `rung_down`. The server's `researchAsk.js` validates against the same lists (one module), so a new id is accepted and an unknown one refused. `book_rank`, `quiet_ticks`, `lock_now` are server kinds (re-read from the battle); `rung_down` (live quote) and `bench_alternative` (rankings) are the screen's. Stored exchanges carry only `{ symbol, questionId }` and nothing reads them back. |
| **QF-7** | `voiceLayerPrompt.js` (non-fenced, already in `PROMPT_CONTRIBUTING_MODULES`; no new prompt module): `RESEARCH_ASK_QUESTION_GUIDE` adds one line after the answer rule, for `weakest_spot` and `take_profit` only, so every other Ask renders byte for byte as before. Both lines say the answer makes no trade, the player decides, and the archetype keeps its own rules. |
| **QF-8** | `useSheetView`'s `agentName` is `agentNameOf(ctx.agentName)` (`cockpit2bModel.js`) for a non-empty name; with none it is null and the sheet names the archetype (R-23), never "Your Agent". Every place the sheet names the agent reads `view.agentName`. |
| **QF-9** | Every new string is in `sheetCopy.js` (`QUESTION_TEXT`, `SHEET_COPY.bookRank`, `quietTicks`, `benchAlternative`, `lockNow`, `rungDown`, `notOnLadder`, `srcLiveDown`), scanned by `sheetCopy.honesty.test.jsx` with every branch of each new argument. *Take profit* appears only as the player's question; *swap* only as *Swapped out …, it would lock*. |

### 11.3 The pack cut (a reading)

The loop items (the idea, what you told it) are never cut, so with both present a pack has three places left. The items that answer a question are never cut either (`ANCHOR_KINDS`: take profit — `lock_now`, `rung_distance` (QF-7's instruction weighs the lock against it), `rung_down`; weakest — `book_rank`, `bench_alternative`; better than our weakest — the incumbent or `book_rank`), and the room left goes to the best-weighted others. The kept items are still shown in the archetype's order (§3.3), so an anchor can sit last.

### 11.4 The §2 review round (2026-11-13), as built

Four lenses with refuters (report §5). Built from the confirmed findings:

- **The set is kept per opening, one entry per `sheetKey`:** a row left by in-modal navigation and reached again keeps the set decided at its first opening.
- **The rankings read fires only for a question the row shows** (never for a pre-set question its set lacks).
- **`agentNameOf` lives in `src/screens/battleView/agentName.js`** (import-free; `cockpit2bModel.js` re-exports it; on the tokens and motion guards' battleView list), so the sheet takes the cockpit's rule without its module graph.
- **An incumbent the agent no longer holds is no incumbent:** the compare falls back to the weakest holding.
- **A held measured stock the check could not score is named** (*· no check yet: CAT*), so the count is never short; the top of the book reads *the highest*.
- **The bench alternative's rung size is labelled an estimate** (*estimated rung size: ATR reading 2.8%*), as 💣's preview labels the same number; its rank is the printed score's.
- **The CPU's row of a ticker the agent also holds** is never compared with itself (the next weakest), and the server re-reads its items as that row too (`researchAsk.verifyResearchItems`: both genuine readings; a forged item matches neither).
- **`take_profit` keeps `rung_distance`** (above).
- **Reading (A1, refuted):** `take_profit` is decided on the exact gain (the committed context's rungs from entry > 0), the prompt's letter; a position that prints *0.0 rungs* but sits above its fill is up (its pack prints a positive gain and no rungs figure). Deciding on the printed number would be a looser reading — put to the founder.
- **`atrReading.js`'s firebase import carries its `.js` extension** (packs.js puts it in the api/ graph; the archetypeRegistry guard).

## 12. The Battle chart (BC2-1 – BC2-7, 2026-11-13), as built

The record's dots (Build C's `recordPinsOf`: the entry, the calls, the answers, the check) were placed by DAY on the daily chart, so a one-day battle piled them all onto today's bar and a longer one onto each day's. The Chart view gains a Battle pill with the battle's own sessions in intraday bars. Report: `docs/audits/20261113_BUILD_RESEARCH_MODAL_QUESTIONS_AND_BATTLE_CHART.md`.

| ID | As built |
|---|---|
| **BC2-1** | In battle, when the battle document names its sessions (`timing.tradingDays`), the chart's pills read *1D · 1W · Battle* (`StockChart`'s optional `battlePill`; absent everywhere else, so the chart is today's). Battle draws candles over the battle's sessions up to today (`Sheet/battleChart.battleSpecOf`), regular session only (bars starting 9:30–16:00 ET), started by now, with the entry line. The bars load on the tap (or a timed item's *see on chart*), never on open and never on opening the Chart view (`Sheet/useBattleSeries`, `active` only while Battle shows). The pill's state lives in the modal; the research hook's 1D / 1W are untouched. |
| **BC2-2** | One trading day → 5-minute bars, two or more → 30-minute bars (by the battle's length, not the days elapsed). `api/stocks/historical.js` `TIMEFRAME_CONFIG['5m']` (EODHD intraday 5m, 5 days); `eodhdAPI.fetchHistoricalOHLCV` caches `5m` as intraday (5-minute TTL). The request is the research chart's own: `5m` with a fixed 5 days, `30m` with 💣's 20 days (the same client and server cache as the 💣 view), so one request per stock per bar size; a failed one is asked again only by a tap (Retry). A response the server fell back to daily bars for (`_meta.actualTimeframe` not the bar size, or bars with no time of day) is refused — *The battle's intraday bars are unavailable* — never drawn. |
| **BC2-3** | On Battle each marker sits on the bar that holds its instant (`battleChart.barTimeOf`: the last bar starting at or before it); an instant before the first session (an overnight entry: its fill quote's time) sits on the first bar, its label its own time. **Reading:** an instant after a close or between two sessions sits on the last bar before it. On 1D and 1W a day's markers merge into one (`dayMarkersOf`, id `day:YYYY-MM-DD`; 1W puts it on the week bar holding the day); the open day's caption is its count (*Wed · 6*), or the tapped item's own marker (Build C D5a). The library takes a tap on a marker (`subscribeClick` → `hoveredObjectId`), and a phone's dot is small, so the chips under the 1D / 1W chart are built too: *6 on Wed · Battle ›*, one per day of the record; either opens Battle. **Reading:** Battle shows the whole battle (fit to content), so "opens Battle at that day" is the day in view with the rest. |
| **BC2-4** | *See on chart* on a timed item (the lock at the check, a check, a call, an answer, the entry) opens Battle with its caption; on a price item it keeps the current pill (Battle stays Battle; 1D / 1W as §3). Opening the Chart view by its pill never starts on Battle: it starts on the Chart view's 1D / 1W pill as §3 (1D at first). **Reading:** §3's 1W memory is kept; "starts on 1D" is read as "never on Battle". A battle that names no sessions keeps today's behaviour (a time pin moves 1W to 1D). |
| **BC2-5** | On Battle, for a held measured stock, the next rung each way as price lines at Bomb mode's displayed prices (`battleChart.rungLinesOf`: `ladder.rungShown` at the live price's decimals — the strings `bombView.rungFacts` prints), titled *next rung +30 · $103.78* and *Bust −10 · $98.73*. None for a preview, legacy or crypto (`measuredLadder` only), none on 1D / 1W. Trend lines stay on 1D and 1W only (StockChart's own rule); no daily SMA over intraday bars. |
| **BC2-6** | Strings in `SHELL_COPY` (`timeBattle`, `battleUnavailable`, `battleEmpty`, `dayCount`, `dayChip`, `dayChipsLabel`) and `SHEET_COPY` (`lineRungUp`, `lineRungDown`), scanned by the honesty test; `--ft-*` through `ST` (the chips, the states); rung lines `gold` / `neg` tokens; no new motion (the Chart view's `fade` as before); candles the chart's own red and green. |

### 12.1 The §2 review round (2026-11-13), as built

Four lenses with refuters (report §5). Built from the confirmed findings; they override the table above where they differ:

- **Fresh bars in a live session.** The server caches the `5m` bars five minutes (`historical.js` `BATTLE_BARS_TIER`: memory 300 s, s-maxage 300, SWR 60), not TECHNICAL's hour; and Battle shown again once its bars are five minutes old asks again (`useBattleSeries` `REFRESH_MS`), keeping the old bars drawn while it does. Otherwise every later call, answer or check would sit on the cached last bar. **Reading:** `30m` keeps TECHNICAL (💣's own series and documented lag), so a multi-day battle's Battle can be up to an hour behind; a record item after its last bar sits on that bar, labelled with its own time.
- **Each answer is kept by its key** (symbol | bar size), so returning to a stock finds its own bars.
- **A way back to the 1D / 1W pill while Battle's bars load**, and Retry on *no bars yet* as on an error.
- **The Battle pill only on the stock the battle opened** (`isOriginal`), never on a stock reached by navigation inside the modal, and never for crypto (R-35 keeps crypto off the shell; the guard is belt and braces).
- **Each day's own session from the market calendar** (`getSessionForDate`: an early close ends at 1:00 PM ET); the fixed 9:30–16:00 only for a year the calendar does not cover.
- **The day merge and its chips come with the Battle pill:** a battle that names no sessions keeps Build C's one dot per record item on 1D (BC2-4's "today's behaviour"). Production battles all name their sessions (`agentBattleService.js`).
- **Battle's price scale takes in the entry and rung lines** (`autoscaleInfoProvider`), and the rung lines carry their axis price tag: an intraday range can sit inside one rung step, which put both lines off screen at first render.
- **S/R goes off while Battle's bars load** (the chart is unmounted, §3); **the sheet reads `timeframe: 'battle'` only while Battle shows**, so its 1D bars keep refreshing on Analysis.
- **Readings kept:** "opens Battle at that day" shows the whole battle; 1W puts one dot per day on the week bar; the 5-minute request covers five calendar days (battles are live only).
