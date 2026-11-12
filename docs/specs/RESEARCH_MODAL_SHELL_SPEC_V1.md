# Research modal — the two-view shell: spec V1 (as built)

**Date:** Thu Nov 12, 2026 · **Status:** spec of record for the shell build (Build 2), dark.
**Design of record:** `docs/design/research-modal/RESEARCH_MODAL_DIRECTION_V2_AMENDMENT_C_20261112.md` (Amendment C, R-23–R-35), round 5 (screens A, A2, D, H) and round 4 (screen B) beside it.
**Flag:** `RESEARCH_MODAL_SHEET_MODE` (`src/config/researchModalFlags.js`), shipping `'off'`. No third flag (R-28).
**Build report:** `docs/audits/20261112_BUILD_RESEARCH_MODAL_SHELL.md`.

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
| R-27 | H1: three filled pills of equal width, two in browse; 💣 warms in a zone; no *Why?* door; *What's moving* first tab | Built in `ChartHeader.jsx` (`ShellPills`): `flex: 1` each, the active one filled with its accent, the others a hairline; 💣 warms with `HEAT` while `isZoneMode(bombView.mode)` and it is not the active pill. Round 5 H1's drawing gives 💣 a fixed 64 px; the ruling's letter (*equal width*) was built. |
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
- **SB-7 — the tab strip.** `ShellTabs.jsx`: *What's moving · Ranks · Smart Money · Sector*, `position: sticky; top: 0` inside the Analysis view's own scroll box, no scroll listener. Today's `CompeteTab` (+ `rankLabel`), `SmartMoneyTab` and `SectorTab`, with today's props, in full; a tab mounts only while shown (its reads go out on the tap, as the drawer's do). *What's moving* (`WhatsMoving.jsx`) is the Why? popup's content through the popup's own hook (`useWhyMoving`, extracted from `WhyMovingPopup.jsx`, the popup's markup unchanged), with the popup's exact props, **loaded on the player's tap** (§6.1), and the foot *From the wire and the day's bar · not {Agent}'s view* (no name in browse). `SectorETFRanksTab` applies nowhere: a sector ETF keeps today's modal (R-35).
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
| open | — | `analysis`; `bomb` when FQ-9 (`opensInRedZone`) or BD-7 (`opensOnBomb`) decided so at open | initial `'1D'`; `'bomb'` when opening on 💣 |
| analysis ↔ chart | pill | the other | none (the hook refetches nothing it holds) |
| analysis / chart | 💣 pill | `bomb` | `'bomb'` (Bomb mode's zone logic then moves it to `'spectate'` and back, as today) |
| bomb | Analysis / Chart pill | that view | the Chart view's last timeframe (`1D` or `1W`; `1D` if none) — in the pill's handler, never an effect |
| analysis | *see on chart ›* on a pack item | `chart` | `'1D'` when the pin is a time pin and the chart is on 1W; none otherwise. The item becomes the open one (never toggled closed by the link). |
| any | navigation (Ranks, Sector) to a stock | stays | none; the Analysis view scrolls to the top |
| any | navigation to a crypto / index / sector ETF | today's modal for that asset (R-35); back to the stock returns to the shell | — |

The Analysis view stays mounted while another view shows (its open tab and what that tab loaded survive a switch). The Chart and 💣 views mount on show. S/R is reset when the chart unmounts.

## 4. The mounts (every `<AssetResearchModal` site — 20 in 17 files; 18 pass `version={2}`, 2 take the default `version = 2`)

Off = today's modal. Shell (battle) = the archetype's Analysis view + Build C's action row. Shell (browse) = the stock's facts + the mount's action. Pills: 3 with a `bombContext`, else 2. Crypto, index and sector-ETF assets are today's modal at every value (R-35).

| # | Mount | `'off'` | `'allowlist'` | `'on'` |
|---|---|---|---|---|
| 1–3 | `AgentBattleScreen.jsx` — held (gated), non-held (gated), legacy (+ the cockpit bench door through them) | Off | Shell (battle), 3 pills — allowlisted owner's battle; else Off | Shell (battle), 3 pills |
| 4 | `BaggerBombBattleView.jsx` (`bombContext` v4 / bench) | Off | Off | Shell (browse), 3 pills — opens on Analysis (not its `defaultTab` 💣) |
| 5 | `BaggerBomb/FreeAgentBar.jsx` (`bombContext` bench) | Off | Off | Shell (browse), 3 pills |
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
2. **"The holding line, when held" (§3.2)** is built as Build C's stance for every kind: held, *On the bench · flagged at …*, *Looked at … · not held now* (FQ-2's ruling on screen), *Not examined in this game*. Build C's move chip reads *+2.4%*, not round 5's *+4.3% since entry* (the stance's text is Build C's, reused unchanged).
3. **Pills of equal width** (R-27's letter) — round 5 H1's drawing gives 💣 a fixed 64 px.
4. **The Ask's label** is *Ask {Agent}: {question}* (R-29), with Build C's cost line *· 1 message · N left* kept as built (SB-10), not round 5's *Ask · 1 msg*. The reply card's failure lines still name the archetype (`AskReply.jsx` reused unchanged).
5. **Build C's crypto sheet (BC-15) is not reachable** under R-35: a crypto holding in battle gets today's modal at every value until the crypto shell.
6. **Mounts with a `bombContext` but no `sheetContext`** (BaggerBomb battle view, free agent bar) get three pills over the browse content at `'on'` and open on Analysis, not their `defaultTab` 💣.
7. **The smoke's tabs read public market data** (§8).

## 7. Tests

- `AssetResearchModal.shell.jsdom.test.jsx` — the gate per mount (browse at each value, battle at `'allowlist'`, crypto identity, index, sector ETF, stock → ETF → back), the pills and the warm 💣, the state machine (1W restored; no refetch on a switch), the block order in battle and browse, today's tabs and props, the sticky strip, What's moving on a tap, the Chart view (trend lines, pins, Technical below, no stop price), the 💣 view, the browse action.
- `AssetResearchModal.sheetModeOn.jsdom.test.jsx` — Build C's rows re-driven through the shell; B1's row; a `sheetContext` at `'off'` ignored.
- `sheetGate.jsdom.test.jsx` (mode × mount × asset), `shellView.test.js`, `ranksLabel.test.js`, `CompeteTab.rankLabel.jsdom.test.jsx`, `WhyMovingPopup.hook.jsdom.test.jsx`, `sheetCopy.honesty.test.jsx` (SHELL_COPY, the new components, no agent-name literal), `shellFold.browser.test.js` (the 375-px fold, against a URL).
- Kill switch: `AssetResearchModal.sheetModeOff`, `AgentBattleScreen.sheetModeOff`, `AssetResearchModal.bombModeOff`, `AgentBattleScreen.bombModeOff` goldens unchanged.

## 8. The smoke branch (never merged)

`claude/research-modal-shell-smoke`, built from the PR head by git plumbing: the mode forced `'on'`; `?sheetFixture=held_tf | held_cp | held_legacy | bench_incumbent | unexamined | budget_out | held_redzone | browse_ceg` feeding Build C's committed battle fixtures (battle states with their `bombContext`, as Bomb mode `'on'` hands it; `browse_ceg` = Constellation Energy from search with *Add to Watchlist*). The Ask is answered by a canned *SMOKE ONLY* reply and What's moving by a canned *SMOKE ONLY* explanation — no model or provider call. Reading: the Ranks, Smart Money and Sector tabs are today's components and read what they read today — public market data only (`/api/stocks/peer-rankings`, `/api/stocks/sector-rankings`, and the read-if-true documents `indexIntelligence/stockRankings`, `stockTechnicalScores/{SYM}`, `institutionalHoldings/{SYM}`), read-only — so the founder can check that they show everything; no battle, user, agent or chat record is read.

## 9. State 2, recorded for the later build (Amendment C §6)

The order on open: the header and pills; the context strip (the question, each refinement, the group, the active conditions, the readings' time, *‹ Back to ranking*, *{Agent} · {Archetype}*); *For this question*; the finding with *Use across my bench*; *Compare with a holding*; the prepared answers; the game line; the Wall St · About line; the four tabs; the action row with a free-text Ask and *→ Cockpit*. The later build prepends its blocks to `battleBlocks`' list (R-34) and adds the free-text Ask to the action row.
