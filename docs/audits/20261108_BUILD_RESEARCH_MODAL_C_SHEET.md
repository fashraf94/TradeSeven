# Build report — Research Modal Build C: the sheet, in battle (dark)

**Run:** 2026-11-08 · **Spec of record:** `docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md` (the build prompt, verbatim, first commit) · **Branch:** `claude/research-modal-sheet` · **PR:** draft, not merged · **Flag:** `RESEARCH_MODAL_SHEET_MODE = 'off'`

**Smoke (phone):** https://trade-seven-nywqnm7it-fais-projects-bc179554.vercel.app/?sheetFixture=held_tf — and `held_cp`, `held_legacy`, `bench_incumbent`, `unexamined`, `budget_out`, and `held_redzone` (the sheet and Bomb mode on, a held stock in the red zone: it opens on 💣, FQ-9). Never-merge branch `claude/research-modal-sheet-smoke` @ `70c42057`: the mode forced `'on'`, the fixtures from committed JSON (no production read), the Ask answered by a canned reply marked **SMOKE ONLY** (no model call, nothing charged).

## 0. Ruling pass — 2026-11-08

You ruled on all eight questions in §12 and added FQ-9. The rulings are recorded in the spec's new dated section (*Rulings and corrections — 2026-11-08*, the end of `docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md`). They are built at `b0fb9db9`, `f407394f`, `b669d0a1` and `f68ddc83`; every check in §2 and §10 was re-run on `f68ddc83`, and the smoke was rebuilt from it with a `held_redzone` fixture.

| Ruling | What was built | Rows | Mutants (round 5) |
|---|---|---|---|
| **FQ-1** — BC-3 step 1 searches the latest check that LOOKED at the name | Step 1 now quotes the first sentence naming the stock in the latest check whose evidence or candidates name it, at that check's time (`latestLine.js latestVoicedCheckOn`). **Reading:** a check whose model call failed or was budget-skipped still is not a check (the A2 reading, carried over); its real stamps still feed the check-read and risk items. The chart's check pin names the same check. | `latestLine.test.js`: rule 1, a check that never looked, a newer non-looking rationale, "checked, nothing said" at the newest look, a sold name's sentence, a failed look skipped. `packs.test.js`: the pin skips a failed check. | R5-F1a, F1b, F1c — killed |
| **FQ-2** — *Looked at {time} · not held now* | A name not held that a check examined (sold, an exit flag, an older list) gets that stance, after the bench stance; on the idea's list it still carries the idea chip. | `packs.test.js`: a sold name, an exit-flagged name, a name on the list, a failed check is not a look. The modal on screen. | R5-F2a, F2b — killed |
| **FQ-3** — 💣 with the sheet on | As built. | — | — |
| **FQ-4** — one Ask per question per opening | As built. | — | — |
| **FQ-5** — an exit flag, *What it flagged · exit · {time}* | Rule 3 quotes a `potential_exit` flag on any name, held or not, in its own words, after a naming sentence and after a call. The eyebrow is the ruling's words, with no archetype between them. | `latestLine.test.js`: exit quoted, held too, the order. The modal on screen. | R5-F5a, F5b, F5c — killed |
| **FQ-6** — the visible viewport | Sheet mode on a phone: the modal is `100dvh` (else `100vh`), border-box so its 1 px border sits inside that height; mode off untouched. The fold row at 390×664 found the action row 1 px under the screen before the border-box line (the app ships content-box). | `sheetOpen.test.js` (the helper); the modal: `100dvh` / `100vh` / mode off unchanged, border-box in sheet mode only; the browser row at 390×664: the whole action row inside the visible viewport, every Layer 0 fixture. | R5-F6a–F6e — killed |
| **FQ-7** — axis tags | Accepted as built. | — | — |
| **FQ-8** — guard data lines are in scope | Recorded in the spec's dated rulings section. | — | — |
| **FQ-9** — 💣 in the red zone at open | `Sheet/sheetOpen.js opensInRedZone` runs Build A's own pieces (the ladder, `toGo`, the session clock, the red-zone machine) once, in the modal's first render, on the price the screen holds: the held mount's controlled quote, else `wsPrice`, else the asset's price. In the band with the market open → the Bomb tab and 💣; else, or with no price, the sheet. Never set again. | `sheetOpen.test.js`: in the band, the band edge as Bomb mode prints it ($103.25 in, $103.24 out), past an unbanked rung, market closed, no price, crypto / legacy / not held / no Bomb mode. The modal: in → 💣, out → the sheet, the held mount's quote against the asset's own price (both ways), no price, never switched after open (both ways). The browser: `held_redzone` → 💣, `held_tf` with Bomb mode → the sheet. | R5-F9a–F9g — killed; F9e survived once (the held asset already carries the scored price), killed after the row made the quote and the price disagree |

Round 5 is 20 mutants, 20 killed, every file restored byte for byte. One limit to state plainly: a headless browser has no toolbar, so it cannot tell `100dvh` from `100vh`. The rows pin the choice and the geometry; **the iPhone check (§11) is still the proof for Safari.**

## 1. Verdict

| | Status | What the player sees | What they saw before |
|---|---|---|---|
| **The flag** | Built and shipped **dark**: `RESEARCH_MODAL_SHEET_MODE = 'off'`. With it off, every existing test passes and the modal, the battle screen and `chat.js` are byte-identical (three goldens); the only edits to existing test files are the flag-pin guard's note and ruling lines in three census files (§3, FQ-8). The server refuses a sheet Ask too unless the mode admits the owner. Turning it on is a separate one-line PR (`'allowlist'` first). | Nothing changes until the flag moves. | — |
| **Layer 0 and the fold** | Built and **measured**: at 390×844 and 430×932 every held, unexamined and out-of-messages stock opens with the whole of Layer 0 above the action row and no inner scroll; 320×568 scrolls (allowed); no sideways scroll anywhere. With Safari's bars showing the modal takes the visible viewport (FQ-6): Layer 0 scrolls there and the whole action row stays on screen (measured at 390×664). | Tapping a stock in a live agent battle opens on one screen: where it stands ("Holding since Wed 10/14 · entry $100.75 · +2.4% · +15 banked"), the archetype's latest sentence about it in quotes, a short 1D chart with the record's pins, three questions in the order the score calls for, a tucked *About · Wall St* row, and the Ask button with *→ Cockpit*. | The 💣 Bomb tab and chart, and an AI Analysis tab with canned company questions. |
| **The latest sentence** | Built: quoted, never written. The first sentence naming the stock in the latest check that LOOKED at it, at that check's time (FQ-1) → else its latest call → else its flag on the latest list, in its own words: an exit flag as *What it flagged · exit · {time}* (FQ-5), a bench flag as *What it flagged* → else "Checked at 1:15 · nothing said about EOG" / "Last looked at …" / "hasn't looked at this one". A name a check examined that is not held now reads *Looked at {time} · not held now* (FQ-2). | "*AAPL is still printing higher lows above VWAP, so the trend is intact and the position stays.*" — Trend Follower · Wed 12:45 | Nothing from the agent on the research screen. |
| **The packs and their order** | Built: 3–5 items per question, from the battle's own record and the archetype's own config, ordered by that archetype's weights (six archetypes pinned word for word). Free. Each item says where it came from and whether the server can re-read it. | "Does this protect the lead?" → *+15 banked at the checks · next check 1:15*, *0.9% off its high since Wed 10/14*, *Trend Follower on Aggressive: swaps out 0.9 ATR below entry, or after 3 checks in a row under VWAP ending 0.7% below; past +1.5 ATR, a dip under its 5-min average sells it*, the game's idea, what you told it. | — |
| **The Ask and its budget** | Built: ONE message from the battle's chat 10, through the same chat route, filed to chat as the same exchange; the agent answers from the pack, every item marked verified (re-read by the server) or unverified (with why). The answer is scrolled into view; a question once asked is not offered again; a double tap sends one. A failed turn says "No message was used" only when the route answered before charging. | "Ask Trend Follower: does this protect the lead? · 1 message · 7 left" → the answer under the items, *✓ filed to chat*. | Asking meant leaving for the chat tab and typing. |
| **Pins and the Idea layer** | Built: the entry, its calls and your answers, and the latest check as dots on the 1D chart; the entry and the idea's levels as lines (the idea behind an *Idea* pill). One label open at a time, shown as a caption (never clipped, never under the chart's logo); a check's pin says what it did for this stock (*decided* / *flagged*); tapping an item opens its own pin. | Tapping "+2.4% since entry" opens "● Entry · Wed 10:02"; tapping the rung item draws "next rung · $103.77". | No record on the chart. |
| **The cockpit door and the incumbent** | Built: a bench call's *Research* opens the sheet on "Is this better than what's stalled?" with the held name the call would replace side by side (marked unverified: it comes from the call, which the server does not re-read). *→ Cockpit* returns to the cockpit. | "ETH is the name it would replace · 6 quiet checks in a row; Trend Follower counts a name stalled at 5", then the rankings side by side. | Research opened on the Bomb tab with no link back. |
| **The mounts** | Built: all three battle mounts (held gated, non-held gated, legacy) hand the sheet the screen's own document, row, header pair, directive and cockpit door — no second subscription, no new price request (measured: the same quote, series and profile requests as the sheet-off view; one rankings read only when the stalled question opens; one POST only on Ask). With Bomb mode also on, a measured held stock already in the red zone when the modal opens opens on 💣 instead, decided once at open (FQ-9). | The sheet wherever a stock is tapped in battle — or 💣, when that stock is about to bank. | — |

**The eight questions in §12 were ruled on 2026-11-08, with FQ-9 added; §0 records each ruling and what was built.** Still open: the iPhone check (§11).

## 2. Cut, commits, checks

- **Cut from** `origin/main` **`f095dc29`** (it already holds the Bomb mode allowlist flip, PR #1035). `origin/main` has not moved since (fetched 2026-11-08), so the branch IS the merged tree the checks ran on.
- **Commits** (oldest first): `37c5fe79` spec · `28bf8237` flag, its pin, the guard note, the three sheet-off goldens · `01e237d0` the build · `de16d116` the fold · `8e094607` the rows (the reviewed head) · `2b30ff72` mutation round 1 · `0b8ec484` the review fixes (lenses A–D) · `78a25de4` lens D refuter follow-ups, the fold row, the request counts · `d777461e` D1 simplified · `348fcfeb` the census ruling for the A2 fix · `31938a1a` the open pin's caption clear of the chart's attribution logo · `e27b51b4` a bench name's check pin says "What it flagged" · `d8600ca9` its row · `6f9df27b` this report · the ruling pass: `b0fb9db9` FQ-1, 2, 5, 6, 8, 9 · `f407394f` the pin row · `b669d0a1` FQ-9's held-mount row · `f68ddc83` FQ-6's border inside the viewport (the code head) · the report's ruling pass (docs only). `e27b51b4` and `31938a1a` came from looking at the deployed smoke, not from a number.
- **Checks** (Linux, WSL Ubuntu, Node v20.20.2, `TZ=UTC`, `flock /tmp/pd-suite.lock`, `--maxWorkers=8`, lock `40382e64edb6`):

| Check | Head | Exit | Result |
|---|---|---|---|
| Full suite (`npm run test:run`) | `f68ddc83` | 0 | Test Files 1367 passed \| 9 skipped (1376) · Tests 30006 passed \| 107 skipped (30113) |
| Rules (`npm run test:rules`, emulator) | `f68ddc83` | 0 | `Test Files  35 passed (35) · Tests  666 passed (666)` |
| `npm run lint:gate` | `f68ddc83` | 0 | no problems (`--max-warnings 0`) |
| `vite build` | `f68ddc83` — and the report commit (docs only) again before the push: the PR description records it | 0 | `✓ built in 15.53s` |

  The suite count includes the fold file, skipped there (it needs a fixture page; §6 records its run). Read from the log's `Test Files` line, exit asserted, never piped through `tail`.

## 3. The §0.4 reconciliation gate — no STOP

| Check | Result | Evidence (read at `f095dc29`) |
|---|---|---|
| (a) `chat.js` / `voiceLayerPrompt.js` fenced, or the pack block needs a fenced edit | **Holds — neither is fenced, no fenced file edited** | `api/agent/chat.js` imports none of the eleven §1 names (its import block, `:1-71`). `voiceLayerPrompt.js` *reads* two fenced exports (`computeTimeRemaining` from `agentEvalPromptAssembly.js:12`, `getArchetypeLabel` from `agentArchetypeConfig.js:17`) — §1-permitted — and is already in `PROMPT_CONTRIBUTING_MODULES` (`api/_utils/__fixtures__/promptHonestyRegistry.js:51`). The block is a new named input with a `null` default beside `callsBlock` (`voiceLayerPrompt.js:2897`, pushed after it at `:3347`). VERIFIED. |
| (b) a chat turn can charge without writing its exchange, or the reverse | **Holds** | `fileDirectiveTransactional` builds ONE payload `{ chatExchanges: arrayUnion(stamped), ...fields }` (`api/_utils/directiveWriter.js:91`) and every path writes it in one `update` or one batch (`:110`, `:115`, `:127`, `:132-135`, the ALREADY_EXISTS retry `:139`). `chat.js` passes the charge in `fields` (`chat.js:1149` call; `[budgetField]: FieldValue.increment(1)`). VERIFIED. |
| (c) `cronState.stagnationTicks` is not the counter forced rotation reads | **Holds, with a reading** | `agent-evaluate.js:1876` copies `battle.cronState.stagnationTicks`, updates it per held symbol (`:1979-1981`), hands it to the risk check as `cronMemory.stagnationTicks` (`:1996`) and finalizes it back onto `cronState` (`:2609` and the other `finalizeCronState` sites). The rule: `agentRiskManager.js:184-195` fires SWAP_OUT when `stagnationTicks >= forcedRotation.ticksThreshold` — **and** `withinAge` **and** `dailyPct < winnerThreshold`. BC-6's "stalled" is the counter alone; the template therefore never says the name *will* rotate. The threshold is the archetype's resolved block **clamped by the tempo dial**: `clampHftConfig({ hftConfig: resolveHftConfig(getArchetypeConfig(ctx.archetype), battle.gameMode), desiredTempo: desiredTempoOf(battle), dialEnabled: TEMPO_DIAL_ENABLED })` (`agent-evaluate.js:1909-1913`; `TEMPO_DIAL_ENABLED = true`), which `packs.js lensOf` now uses verbatim (review A1: the build first mirrored only `resolveHftConfig`, so a *measured* tempo's 7 read as 5). Reading: BC-6's "its own threshold" is the clamped one. VERIFIED. |
| (d) a config value the packs cite is not client-importable | **Holds — nothing omitted** | `ARCHETYPE_WEIGHTS` (`archetypeScoring.js:15`; already imported client-side by `src/hooks/useTrainingDraft.js:30`; its one import `archetypeScoringV2.js` imports `featureFlags.js` and `axisDerivation.js`, both Node/browser-clean), `ARCHETYPE_CONFIGS` / `getArchetypeConfig` / `resolveHftConfig` (`agentArchetypeConfig.js:36`, `:221`, `:233`; no imports), `PRESET_CONFIGS` / `getPresetConfig` (`agentPresetConfig.js:69`; no imports), `presetKeyOf` (`playerFieldReaders.js:37`; imports only the preset table), and — since review A1 — `clampHftConfig` / `desiredTempoOf` (`tempoDialClamp.js`, already imported client-side by `src/data/characterState.js:33`) with `TEMPO_DIAL_ENABLED` (`featureFlags.js`). All load in the browser bundle (vite build, §10). VERIFIED. |
| (e) a needed file is on the §1 fence | **None** | No fenced file is edited; fenced files are only read (`agentRiskManager.js`, `agent-evaluate.js`, `agentArchetypeConfig.js`, `archetypeScoring.js`, `agentBattleService.js` for citations; the three config modules imported read-only). The §2.3 ratchet: `src/components/Research/Sheet/packs.js` is the sheet's one direct importer of `archetypeScoring`, `agentArchetypeConfig` and `archetypeDisplay` — one baseline line, in the build commit. |


**Existing files beyond spec §5's list — reported, not stopped on (FQ-8).** Spec §5 says any existing file beyond its list is a STOP-and-report. The branch edits three more, each by data lines only, each demanded by a repo guard that fails ANY new reader until it is ruled in the same commit — the same class as the ratchet baseline §5 does list:

| File | Line(s) | Why the guard demands it |
|---|---|---|
| `src/data/unconfirmedOutcome.census.test.js` | `latestLine.js` as an `evaluations` reader (the build); `latestLine.js` as a `haikuError` reader (review A2) | every client file naming `evaluations`, and every one reading a decision field, must be ruled (review ER3-1, ERV3) |
| `api/_utils/hypothesisRecords/equippedHypothesisRefs.census.test.js` | `packs.js` and the test fixture as `equippedHypothesis` readers/writers | every file naming the equipped idea must be ruled |
| `api/_utils/hypothesisRecords/carriage.test.js` | `packs.js` in the carriage list | the idea's fields may travel only to listed readers |

No behaviour changes with them; without them the full suite is red. If you read §5 strictly, these were STOPs — FQ-8 asks.

Within a listed file, `AgentBattleScreen.jsx` (listed as "mount spreads and the bench handler only") also carries what those spreads hand the sheet: the mode hook (`useSheetModeForBattle`), the context helper the three spreads call (`sheetContextFor` — the screen's own battle, row, header standing, directive, calls) and the *→ Cockpit* door (`sheetCockpitDoor`, BC-12) — no other screen behaviour.

**Anchor drift (by meaning; recorded, none blocking):**
1. **`equippedHypothesis` / `equippedWatchlist` live under `agentContext`**, not at the battle's top level as §3.1's list reads (`agentBattleService.js:208-231` writes them inside `agentContext`; the Battle View reads `agentBattle.agentContext.equippedWatchlist`). The sheet reads `battle.agentContext.equippedHypothesis`.
2. **A check receipt's `chg` is the position's change from ENTRY**, not the day change §3.4 names (`tickStamps.js:176-180`, `:202`: "NOT the quote's session change"). The check-read item says *from entry*, and only on a measured position (BC-15: a legacy position never claims an entry).
3. **`atrX` is that change in the scorer's own unit** (`tickStamps.js:181-182`, `:203`; measured: the frozen measured %, `atrXUnit`), i.e. the distance in rung steps — the item says *1.05× a rung step (the first rung is 1.00×)*.
4. **The regime words** are `choppy | distressed | directional_expansion | directional_contraction` (`agentRegimeClassifier.js classifyStockRegime`), rendered *choppy / distressed / a widening trend / a narrowing trend*; any other value is left out.
5. **`trailStopATR` is not "trails 1.5 ATR behind the high"** (BC-5's example). The code arms the trail once the move from entry reaches `trailStopATR × ATR` and exits on a dip under the 5-minute 20-bar average (`agentRiskManager.js:166-172`); `bustBuffer` swaps out at that many ATR below entry (`:126-131`); `vwapFailureTicks` swaps out after that many checks IN A ROW beyond the dead band (`vwapDeadBandPct`), which must also hold on the firing check (`:137-144`); TRAIL_STOP is an exit (the cron swaps it out, `agent-evaluate.js:2004`). The lever item says exactly that: *Trend Follower on Aggressive: swaps out 0.9 ATR below entry, or after 3 checks in a row under VWAP ending 0.7% below; past +1.5 ATR, a dip under its 5-min average sells it* (review A13, A17).
6. **The governing preset is the battle's `strategyPreset`** through `presetKeyOf` (`agent-evaluate.js:1163`; unknown → `balanced`), not the archetype's `defaultPreset`. The packs use the check's preset.
7. **The huddle thread prefix** `plan:` is on `origin/claude/huddle-s1` only (`api/_utils/huddle/planTemplates.js:264-265`, unmerged). The sheet holds the value (`packs.js PLAN_THREAD_PREFIX`) and cites the line.
8. **The calls reader**: the screen holds one only while the cockpit is on (`AgentBattleScreen.jsx useCalls(agentBattleId, cockpitOn)`); the sheet reuses it then (`sheetContext.calls`) and otherwise opens ONE listener of the same shape (`useCalls`) only while the sheet is on.

## 4. The six archetypes' packs (the snapshot)

One fixture (a live measured battle holding AAPL, fill $100.75, +15 banked at the 12:45 check; ETH quiet; NVDA on the bench; live $103.20), every archetype on its default preset. The facts are pinned word for word in `src/components/Research/Sheet/__goldens__/packs.facts.golden.json` (each number re-worked by hand before it was committed); the order below is each pack's.

| Archetype (preset) | Does this help us catch up? | Does this protect the lead? | Is this better than what's stalled? |
|---|---|---|---|
| Trend Follower (Aggressive) | move_since_entry → rule_trend → rung_distance → idea → told_it | banked → drawdown → risk_lever → idea → told_it | incumbent → stalled → rank_scores → idea → told_it |
| Contrarian (Balanced) | rule_contrarian → check_read → rung_distance → idea → told_it | risk_lever → risk_verdict → drawdown → idea → told_it | rank_scores → rung_compare → incumbent → idea → told_it |
| Speculator (Aggressive) | check_read → rule_volatility → rung_distance → idea → told_it | drawdown → banked → risk_lever → idea → told_it | rank_scores → rung_compare → incumbent → idea → told_it |
| Capital Preserver (Defensive) | rule_sectors → move_since_entry → rung_distance → idea → told_it | risk_lever → risk_verdict → banked → idea → told_it | rank_scores → incumbent → stalled → idea → told_it |
| Diversifier (Balanced) | rule_sectors → rung_distance → move_since_entry → idea → told_it | risk_lever → risk_verdict → banked → idea → told_it | rank_scores → incumbent → stalled → idea → told_it |
| Fundamental Investor (Balanced) | rule_fundamentals → move_since_entry → rung_distance → idea → told_it | risk_lever → risk_verdict → banked → idea → told_it | rank_scores → incumbent → stalled → idea → told_it |

Every item, Trend Follower (the other five differ only where their config differs — the rule, the lever, the stall count, the ranking; all six are in the golden):

| Kind | Fact (as the sheet prints it) | Source label | Status |
|---|---|---|---|
| rung_distance | Next rung +30 at $103.77 · $0.57 (0.55%) to go | live price vs the next rung | unverified (live_quote) |
| move_since_entry | +2.4% since entry at $100.75 (Wed 10/14) | live price vs entry | unverified (live_quote) |
| check_read | The Wed 12:45 check saw a widening trend · +2.6% from entry · 1.05× a rung step (the first rung is 1.00×) · its tightest range in 7 days | the Wed 12:45 check | verified |
| rule_trend | Trend Follower ranks names by the technical trend first (40% of its ranking), then BaggerBomb fit (30%) | Trend Follower’s config | verified |
| standing | You trail +62 – +68 | the scoreboard | unverified (as_shown) |
| risk_lever | Trend Follower on Aggressive: swaps out 0.9 ATR below entry, or after 3 checks in a row under VWAP ending 0.7% below; past +1.5 ATR, a dip under its 5-min average sells it | its risk setting | verified |
| risk_verdict | Risk check at Wed 12:45: hold — close to the next rung | the Wed 12:45 check | verified |
| banked | +15 banked at the checks · next check 1:15 | the battle record | verified |
| drawdown | 0.9% off its high since Wed 10/14 ($104.10, Wed 10/14) | from the chart, as of Wed 10/14 | unverified (from_chart) |
| incumbent | ETH is the name it would replace · 6 quiet checks in a row; Trend Follower counts a name stalled at 5 | its call in the cockpit | unverified (from_cockpit) |
| stalled | Stalled by Trend Follower’s own count (5 quiet checks): ETH (6) | its stall counter | verified |
| rung_compare | At the last check: AAPL $0.37 from +30 | the battle record | verified |
| rank_scores | Trend Follower’s ranking: AAPL 78 · ETH 52 (rankings as of Wed 10/14) | the platform rankings | unverified (rankings_doc) |
| idea | This game’s idea: “Big caps with clean balance sheets keep leading while rates hold; buy the leaders on quiet pullbacks.” | this game’s idea | verified |
| told_it | “Keep AAPL through the close unless it loses VWAP.” | What you told it · Wed 11:40 | verified |

Where the archetypes differ:

| Archetype | Rule item | Risk lever | Stalled |
|---|---|---|---|
| Trend Follower | Trend Follower ranks names by the technical trend first (40% of its ranking), then BaggerBomb fit (30%) | Trend Follower on Aggressive: swaps out 0.9 ATR below entry, or after 3 checks in a row under VWAP ending 0.7% below; past +1.5 ATR, a dip under its 5-min average sells it | Stalled by Trend Follower’s own count (5 quiet checks): ETH (6) |
| Contrarian | Contrarian ranks names by names the platform scores low first (40% of its ranking), then volatility (20%) | Contrarian on Balanced: swaps out 0.85 ATR below entry, or after 2 checks in a row under VWAP ending 0.5% below; past +1.5 ATR, a dip under its 5-min average sells it | Stalled by Contrarian’s own count (6 quiet checks): ETH (6) |
| Speculator | Speculator ranks names by volatility first (60% of its ranking), then BaggerBomb fit (25%) | Speculator on Aggressive: swaps out 0.9 ATR below entry, or after 3 checks in a row under VWAP ending 0.7% below; past +1.5 ATR, a dip under its 5-min average sells it | Stalled by Speculator’s own count (3 quiet checks): ETH (6) |
| Capital Preserver | Capital Preserver ranks names by sector spread first (35% of its ranking), then fundamentals (30%) | Capital Preserver on Defensive: swaps out 0.75 ATR below entry, or after 1 check in a row under VWAP ending 0.3% below; past +1 ATR, a dip under its 5-min average sells it | Capital Preserver doesn’t rotate out of quiet names |
| Diversifier | Diversifier ranks names by sector spread first (30% of its ranking), then fundamentals (25%) | Diversifier on Balanced: swaps out 0.85 ATR below entry, or after 2 checks in a row under VWAP ending 0.5% below; past +1.5 ATR, a dip under its 5-min average sells it | Stalled by Diversifier’s own count (6 quiet checks): ETH (6) |
| Fundamental Investor | Fundamental Investor ranks names by fundamentals first (40% of its ranking), then the technical trend (30%) | Fundamental Investor on Balanced: swaps out 0.85 ATR below entry, or after 2 checks in a row under VWAP ending 0.5% below; past +1.5 ATR, a dip under its 5-min average sells it | Stalled by Fundamental Investor’s own count (6 quiet checks): ETH (6) |

## 5. Decisions made in the build (for the founder's eye)

1. **The mounts open on the sheet.** With the mode on, a stock tapped in battle opens on the Analysis tab and the 1D chart (§1 "opens on one line and a question"); the 💣 pill and the Bomb tab stay one tap away. The three mounts keep passing `defaultTab="baggerbomb" defaultTimeframe="bomb"`; the modal overrides them only when it is handed a `sheetContext` (`AssetResearchModal.jsx openTab`, `initialTimeframe`). With the mode off nothing changes (the goldens). **Ruled 2026-11-08 (FQ-9):** with Bomb mode also on, a measured held stock already in the red zone when the modal opens opens on 💣 instead — decided once at open, never switched.
2. **`sheetContext` carries more than §4.2 lists** — all of it data the screen already holds, so the sheet opens no second battle subscription: `battle` (the screen's subscribed document), `calls` (the cockpit's reader, when the cockpit is on), `standing` (the score as the header shows it — its own digits through `formatScoreDisplay` and its own lead, `comparison.lead` on a gated battle, else `displayPlayerScore` / `displayOpponentScore`; BUILD_RULES §9, review A6), `directive` (the slot THIS TURN shows), and optionally `rankings`. The archetype is read from the document (`battle.agentContext.archetype`); the `archetype` field is the screen's copy of that same read.
3. **The ordering table** (`packs.js KIND_FACTOR`) maps each item kind to one `ARCHETYPE_WEIGHTS` factor. The archetype's *entry rule* is one item whose kind names its top factor (`rule_trend`, `rule_sectors`, `rule_fundamentals`, …) — one plain-word template per factor — so different archetypes lead with different kinds, mechanically. *Defensiveness* (the protect-the-lead risk items' factor) is computed from the four preset risk levers across the three presets: aggressive 0, balanced 0.33, defensive 1. Ties: the stock's facts before the archetype's rule before the standing. The loop items (the idea, what you told it) carry no factor, ride last and are never cut.
4. **The token rule applies to BC-3 too.** A rationale sentence "names the symbol" only as a whole uppercase token of three or more letters (BC-10's rule): a one- or two-letter ticker (F, GE, ON, A) would match ordinary prose, so such a name falls through to its calls, its bench summary or the template.
5. **Verified means re-read by the server.** The client marks record kinds `verified` (they come straight from the battle document) and its computed kinds `unverified` with a reason (`live_quote`, `from_chart`, `rankings_doc`, `as_shown`). On an Ask the server re-runs the same builder over the battle it read; a record item it reproduces (same kind, same record id) is replaced by the SERVER's item, anything else is the client's words marked `unverified` (`not_on_record`). The server's row is always the agent's own position for the symbol — by its `positionId`, else by its own slot (`posKey`) — so a ticker the CPU also holds can never point it at the CPU's row and never hides the agent's (review A8, C2). Every pack line is one clean line at parse, at verify and at render (no line break of any kind, no tag, no bracket — the server's own items come from stored text too; review A12, B1, B2), and every unverified line tells the model why (review A14). The incumbent ("the name it would replace") is a client-side claim: the relation lives in the cockpit's call, which the server does not re-read (`from_cockpit`, review A7).
6. **The Ask is battle-mode only, and the server honours the flag.** `chat.js` refuses a sheet Ask in review mode (after the close, once the day's review exists) and with `leagueAsk` (400 `research_ask_battle_only`), and unless the sheet mode admits the owner — `'on'`, or `'allowlist'` and the cockpit allowlist names them, read at call time (403 `research_ask_off`; review N1) — all before any read or charge, so it can only ever spend the per-battle chat 10.
7. **A failed Ask says "No message was used" only when `chat.js` itself answered before its one write** — one of the statuses it returns there (400, 401, 403, 404, 405, 429, 502, 504) AND its JSON `error`; a platform gateway 502/504 with no JSON body (a kill after the write), a 500 or no answer says *check chat — a message may have been used* (review B7).
8. **The action row is the drawer's footer** (pinned under the scroll area), so it never scrolls away; on the sheet the chart is shorter (a quarter of the container on a phone, 150–210 px) and the drawer sits on the chart section's measured bottom (BC-2). Other tabs keep today's geometry.
9. **Crypto holdings get the sheet** (BC-15 names them): in sheet mode the drawer keeps the Analysis tab for a crypto asset, which it otherwise hides (`AnalysisDrawer analysisAlways`).
10. **"Stalled" never says "will rotate"**: the rotation also needs a fresh tick and a non-winning day (`agentRiskManager.js:184-189`), so the item states the counter against the archetype's own count.
11. **No News row, no "what it read"** (BC-14). The tucked row is *About* (the profile the modal already fetched, opened in place — no second request) and *Wall St* (the existing labelled consensus chip).
12. **The rankings** (`indexIntelligence/stockRankings`, `arch_scores`) are read once for the modal's life, only when *Is this better than what's stalled?* first opens (leaving the question never throws the read away; review N2) — the Ranks tab's own document; never a price request.
13. **The Ask's state is per stock** and its answer shows only under the question it answered; one POST is in flight per stock (a double tap sends one); a question once answered is not offered again on that opening — the button says *Asked … · the answer is below* (FQ-4); the answer card is scrolled into the drawer's view (review B5, B6, D1).
14. **The record on the chart:** markers are dots; the one open label is a caption over the chart, never canvas text the pane clips; only the open line shows an axis tag (FQ-7); a tapped item opens the record pin AT its instant (the entry, never the check later that day) and a price pin of its own is named for what its price is (*next rung · $103.77*); pins are re-applied after every series rebuild (review C1/D4, D5, D6, D8).
15. **Layer 0 shows two lines of the sentence** until it is tapped, and the eyebrow and the agent's name ellipsize, so a long sentence or a 20-character name keeps the fold and never widens the drawer at 320 (review D3).
16. **On 💣 / spectate the chart keeps the modal's full height** and the drawer moves down (FQ-3); the skeleton and the error box stand in for the whole sheet chart (its 44 px control row and its plot), so the drawer opens where it stays (review D2, D7).
17. **The template never claims "nothing said" about a check that said something**: a failed or budget-skipped call (`haikuError` set — the cron's canned rationale) is not a check (review A2). **Ruled 2026-11-08:** rule 1 quotes the latest check that LOOKED at the name, at its time (FQ-1); a `potential_exit` flag is quoted as *What it flagged · exit · {time}*, never as a bench flag (FQ-5); a name examined but not held reads *Looked at {time} · not held now* (FQ-2).
18. **Displayed numbers are the screen's own** (BUILD_RULES §9): the rung distance is Bomb mode's `toGo` (displayed rung and live price, two-decimal %); the drawdown names the day its bars start and never shows a high under the live price; the standing is the header's text and lead (review A5, A6, A11).

## 6. The fold (BC-2), measured

Headless Edge (DPR 2, touch), the real modal on the fixture page, animations off, at the code head. The same measurements are now a committed row (`src/components/Research/Sheet/sheetFold.browser.test.js`, 18 rows: every Layer 0 fixture at 390×844 and 430×932, the worst cases, 320 with no sideways scroll, the answer in view after an Ask, the open pin's label unclipped, no drawer jump on a slow or failed chart, the 💣 Fuse never under the drawer, and since the ruling pass the whole action row inside the visible viewport at 390×664 (FQ-6) and `held_redzone` opening on 💣 (FQ-9)). It runs when pointed at a fixture page (`SHEET_FOLD_URL=…`); CI skips it. **Run against the deployed smoke preview at the code head: 18 of 18 passed** (the smoke at `70c42057`). The tables below were re-measured there after FQ-6: the phone modal is now border-box in sheet mode, so every number is 1–2 px from the first measurements (the chart is 196 at 390×844), and at 390 the Layer 1 heading *Is this better than what's stalled?* wraps to two lines (Layer 1 scrolls).

**The chart's height in sheet mode** (reported, BC-2): a quarter of the container on a phone, 150–210 px (196 at 390×844, 210 at 430×932, 150 at 320×568); a third elsewhere, 180–260 px. The chart's control row is 44 px at every size. On 💣 the chart keeps the modal's full height (FQ-3).

| Fixture | Size | Layer | Chart | Sheet (top → bottom) | Action row (top → bottom) | Scroll area (content / visible) | Layer 0 above the row | Sideways scroll |
|---|---|---|---|---|---|---|---|---|
| held_tf | 390×844 | 0 | 196 | 387 → 754.7 | 778.8 → 843 | 392 / 392 | **yes** | none |
| held_cp | 390×844 | 0 | 196 | 387 → 754.7 | 778.8 → 843 | 392 / 392 | **yes** | none |
| held_legacy | 390×844 | 0 | 196 | 387 → 727.7 | 778.8 → 843 | 392 / 392 | **yes** | none |
| bench_incumbent | 390×844 | 1 | 196 | 387 → 923.2 | 767.8 → 843 | 548 / 381 | n/a (opens on Layer 1, BC-11) | none |
| unexamined | 390×844 | 0 | 196 | 387 → 679.5 | 778.8 → 843 | 392 / 392 | **yes** | none |
| budget_out | 390×844 | 0 | 196 | 387 → 754.7 | 780 → 843 | 393 / 393 | **yes** | none |
| held_tf | 430×932 | 0 | 210 | 400 → 767.7 | 868 → 931 | 468 / 468 | **yes** | none |
| held_cp | 430×932 | 0 | 210 | 400 → 767.7 | 868 → 931 | 468 / 468 | **yes** | none |
| held_legacy | 430×932 | 0 | 210 | 400 → 740.7 | 868 → 931 | 468 / 468 | **yes** | none |
| bench_incumbent | 430×932 | 1 | 210 | 400 → 926.2 | 855.8 → 931 | 538 / 456 | n/a (opens on Layer 1, BC-11) | none |
| unexamined | 430×932 | 0 | 210 | 400 → 692.5 | 868 → 931 | 468 / 468 | **yes** | none |
| budget_out | 430×932 | 0 | 210 | 400 → 767.7 | 868 → 931 | 468 / 468 | **yes** | none |
| held_tf | 320×568 | 0 | 150 | 340 → 707.7 | 502.8 → 567 | 380 / 163 | no — scrolls | none |
| held_cp | 320×568 | 0 | 150 | 340 → 707.7 | 502.8 → 567 | 380 / 163 | no — scrolls | none |
| held_legacy | 320×568 | 0 | 150 | 340 → 707.7 | 502.8 → 567 | 380 / 163 | no — scrolls | none |
| bench_incumbent | 320×568 | 1 | 150 | 340 → 909.9 | 491.8 → 567 | 582 / 152 | n/a (opens on Layer 1, BC-11) | none |
| unexamined | 320×568 | 0 | 150 | 340 → 632.5 | 502.8 → 567 | 305 / 163 | no — scrolls | none |
| budget_out | 320×568 | 0 | 150 | 340 → 707.7 | 502.8 → 567 | 380 / 163 | no — scrolls | none |

The review's worst cases (the fixture page's measurement parameters: a long sentence, a 20-character agent name — the app's cap — and Fundamental Investor):

| Fixture | Size | Layer | Chart | Sheet (top → bottom) | Action row (top → bottom) | Scroll area (content / visible) | Layer 0 above the row | Sideways scroll |
|---|---|---|---|---|---|---|---|---|
| held_tf · long=1 | 390×844 | 0 | 196 | 387 → 754.7 | 778.8 → 843 | 392 / 392 | **yes** | none |
| held_tf · name=The Momentum Machine · arch=analyst | 390×844 | 0 | 196 | 387 → 754.7 | 778.8 → 843 | 392 / 392 | **yes** | none |
| held_cp · long=1 · name=The Momentum Machine | 390×844 | 0 | 196 | 387 → 754.7 | 778.8 → 843 | 392 / 392 | **yes** | none |
| held_tf · long=1 | 320×568 | 0 | 150 | 340 → 707.7 | 502.8 → 567 | 380 / 163 | no — scrolls | none |
| held_tf · name=The Momentum Machine · arch=analyst | 320×568 | 0 | 150 | 340 → 707.7 | 502.8 → 567 | 380 / 163 | no — scrolls | none |
| held_cp · long=1 · name=The Momentum Machine | 320×568 | 0 | 150 | 340 → 707.7 | 502.8 → 567 | 380 / 163 | no — scrolls | none |

Viewports BC-2 does not name (Safari with its bars showing; a common Android size). Since FQ-6 the modal is the visible viewport there: Layer 0 may scroll, and the whole action row stays on screen:

| Fixture | Size | Layer | Chart | Sheet (top → bottom) | Action row (top → bottom) | Scroll area (content / visible) | Layer 0 above the row | Sideways scroll |
|---|---|---|---|---|---|---|---|---|
| held_tf | 390×664 | 0 | 152 | 342 → 709.7 | 598.8 → 663 | 380 / 257 | no — scrolls | none |
| unexamined | 390×664 | 0 | 152 | 342 → 634.5 | 598.8 → 663 | 305 / 257 | no — scrolls | none |
| held_tf | 430×739 | 0 | 170 | 361 → 728.7 | 675 → 738 | 380 / 314 | no — scrolls | none |
| unexamined | 430×739 | 0 | 170 | 361 → 653.5 | 675 → 738 | 314 / 314 | **yes** | none |
| held_tf | 360×780 | 0 | 180 | 371 → 738.7 | 714.8 → 779 | 380 / 344 | no — scrolls | none |
| unexamined | 360×780 | 0 | 180 | 371 → 663.5 | 714.8 → 779 | 344 / 344 | **yes** | none |

## 7. The mounts and the requests

| Mount (AgentBattleScreen.jsx) | When | The sheet's row | Bomb mode alongside |
|---|---|---|---|
| Gated, held (`:4205`) | a held name in a gated battle (the controlled quote) | `posKey`, held | its own `bombContext` when Bomb mode is on |
| Gated, non-held (`:4219`) | a bench / non-held name in a gated battle — the cockpit's bench door comes through here | `positionId` | same |
| Legacy (`:4233`) | a battle without the gate | `positionId` | same |

Each passes `sheetContext` only when the mode resolves on for that battle; with it off, no mount passes it (the screen golden).

**No new price request** (§3) — a committed row (`AssetResearchModal.sheetModeOn.jsdom.test.jsx`, "§3: no new price request"), the same asset and the same 1D view, sheet on vs off:

| Requests | Sheet off | Sheet on (Layer 0) | + the stalled question | + one Ask |
|---|---|---|---|---|
| Quote | 1 | 1 | 1 | 1 |
| Daily series | 1 | 1 | 1 | 1 |
| Other series | 0 | 0 | 0 | 0 |
| Company profile | 1 | 1 | 1 | 1 |
| Rankings document read | 0 | 0 | **1** (once for the modal's life) | 1 |
| `POST /api/agent/chat` | 0 | 0 | 0 | **1** |

The battle document, the calls and the standing come from the screen's own subscriptions (no second listener); the chart's daily bars are the modal's own.

## 8. Mutation (BUILD_RULES §2: revert the fix, show its row fails, restore byte for byte)

Every mutant ran on a fresh `git archive` of its head (`node run-mutants.cjs`): a mutant is KILLED only when the run exits non-zero AND names a failed row (a crashed worker is never a kill), and the file's SHA-256 is compared before and after. The browser mutants ran against the fixture page with the fold row, then the control (all 16 rows passing).

| Round | Head | Mutants | Killed | Notes |
|---|---|---|---|---|
| 1 — the build | `2b30ff72` | 55 | 55 | 52 by the build's rows; L5 and V2 by rows added for them; V3 equivalent there (its guard was removed). Plus 3 fold mutants in the browser, all caught. |
| 1 re-run | `0b8ec484` | 53 | **53** | 42 unchanged + 11 re-targeted where the review moved the code (F1b, F2b, L1b, L5b, S2b, P4b, P5b, V1b, V6b, B3b, M4b); S3 and V3 are superseded by R2-A6p, R2-C2, R2-A8. |
| 2 — the review fixes | `0b8ec484` | 57 | **57** | one per fix, one per test gap the review found |
| 3 — refuter D follow-ups | `78a25de4` | 3 | **3** | D7's control row; two §3 request mutants |
| 4 — seen on the deployed smoke | `d8600ca9` | 2 | **2** | the pin's "flagged" wording and its held-name guard (the guard's mutant survived once; the row that kills it was added) |
| 5 — the 2026-11-08 rulings | `f407394f`, `b669d0a1`, `f68ddc83` | 20 | **20** | FQ-1 ×3, FQ-2 ×2, FQ-5 ×3, FQ-6 ×5, FQ-9 ×7 (F9e survived once — the held asset already carries the scored price — and was killed after the row made the quote and the asset's price disagree) |
| Browser rows | `d777461e`, `31938a1a` | 9 | **9** | D1 ×2, D7 ×2, D2, D3 ×2, D6 ×2 (the second: the caption back under the attribution logo); control 16/16 after each run |

Every file restored: 199 of 199 SHA-256 equal. Rounds 2–5 and the browser mutants:

| Mutant | Reverts | File | Killed by | Restored |
|---|---|---|---|---|
| R2-N1 | N1: chat.js accepts a sheet Ask with the mode off | `api/agent/chat.js` | the sheet mode off (the shipped value): a sheet Ask is a 403 research_ask_off — no prompt, | SHA-256 ✓ |
| R2-N1b | N1: 'allowlist' admits every owner | `api/_utils/researchAsk.js` | 'allowlist' and the owner not listed: refused, nothing written | SHA-256 ✓ |
| R2-A12v | A12/B1: verified items keep the record's raw text | `api/_utils/researchAsk.js` | a verified item's words come from stored records, so they are made one clean line too (rev | SHA-256 ✓ |
| R2-A12r | A12/B1: the block renders the fact raw | `api/_utils/voiceLayerPrompt.js` | a VERIFIED item from a stored record (an idea statement) carrying a newline and a closing  | SHA-256 ✓ |
| R2-C6r | C6: the block renders the label raw | `api/_utils/voiceLayerPrompt.js` | a label with tags or a line break is cleaned too | SHA-256 ✓ |
| R2-B2 | B2: U+2028/U+2029 survive the pack text | `api/_utils/researchAskText.js` | the line separators the chat sanitizer leaves, and square brackets, are cleaned from a fac | SHA-256 ✓ |
| R2-B2b | B2: square brackets survive (an item prints its own [VERIFIED]) | `api/_utils/researchAskText.js` | the line separators the chat sanitizer leaves, and square brackets, are cleaned from a fac | SHA-256 ✓ |
| R2-A14 | A14: unverified lines carry no reason | `api/_utils/voiceLayerPrompt.js` | the pack is inside the injection guard's delimiters (wrapWithDelimiters), numbered, each i | SHA-256 ✓ |
| R2-A7a | A7/B3: the incumbent loses its client reason | `src/components/Research/Sheet/packs.js` | every GENUINE pack of every archetype re-reads clean: no true record item comes back not_o | SHA-256 ✓ |
| R2-A7b | A7/B3: the server verifies the incumbent again | `src/components/Research/Sheet/packs.js` | every GENUINE pack of every archetype re-reads clean: no true record item comes back not_o | SHA-256 ✓ |
| R2-A1 | A1: the tempo dial is ignored | `src/components/Research/Sheet/packs.js` | Trend Follower: standard 5 (ETH at 6 is stalled), measured 7 (it is not), aggressive 4 | SHA-256 ✓ |
| R2-A2a | A2: a failed/budget-skipped entry is 'the latest check' | `src/components/Research/Sheet/latestLine.js` | a FAILED or budget-skipped call (haikuError set: the cron's canned rationale) is not "the  | SHA-256 ✓ |
| R2-A2b | A2: the template always says 'nothing said' | `src/components/Research/Sheet/latestLine.js` | a HELD name never takes the bench branch (its summary makes the template "last looked at", | SHA-256 ✓ |
| R2-A2c | A2: the template prints the older looked-at check | `src/components/Research/Sheet/latestLine.js` | a newer budget-skipped rationale (no stamps): the template names THAT check — the one rule | SHA-256 ✓ |
| R2-CL4 | C4/CL4: a held name never on a check reads 'hasn't looked' | `src/components/Research/Sheet/latestLine.js` | 4a. a HELD name no check looked at, under a latest check: "checked" at that check (BC-3 "h | SHA-256 ✓ |
| R2-A4 | A4: a potential_exit is a bench flag | `src/components/Research/Sheet/latestLine.js` | a potential_exit candidate is never a bench flag: its note is not quoted as one, and the t | SHA-256 ✓ |
| R2-A10 | A10: an abbreviation after '(' splits | `src/components/Research/Sheet/latestLine.js` | "(vs. XLK)" and "“e.g. AAPL" never end a sentence | SHA-256 ✓ |
| R2-CL6 | C7/CL6: an opening quote or bracket no longer starts a sentence | `src/components/Research/Sheet/latestLine.js` | splits after . ! ? followed by whitespace and an uppercase letter, a digit, $ or an openin | SHA-256 ✓ |
| R2-A5 | A5: the rung distance from raw values (not toGo) | `src/components/Research/Sheet/packs.js` | live $102.2673, rung $103.7725: "$1.50 (1.47%) to go" — the displayed $103.77 − $102.27, o | SHA-256 ✓ |
| R2-CP2 | C7/CP2: a negative 'to go' is printed | `src/components/Research/Sheet/packs.js` | the live price at or past the next rung: no distance item (it banks only at a check — neve | SHA-256 ✓ |
| R2-CP8 | C3/CP8: the rung compare measured from entry | `src/components/Research/Sheet/packs.js` | every candidate item of every archetype: kind, fact, source label, status | SHA-256 ✓ |
| R2-A11a | A11: an older bar's high under the live price | `src/components/Research/Sheet/packs.js` | the live price above every bar's high: the high IS the live price | SHA-256 ✓ |
| R2-CP3 | C3/CP3: bars before the entry day count | `src/components/Research/Sheet/packs.js` | off the high: (110 − 103.20) / 110 = 6.2% — the entry day's bar on; an older, higher bar i | SHA-256 ✓ |
| R2-CP4 | C3/CP4: the drawdown over the live price | `src/components/Research/Sheet/packs.js` | off the high: (110 − 103.20) / 110 = 6.2% — the entry day's bar on; an older, higher bar i | SHA-256 ✓ |
| R2-CP6 | C3/CP6: the next check is 'now' | `src/components/Research/Sheet/packs.js` | every candidate item of every archetype: kind, fact, source label, status | SHA-256 ✓ |
| R2-A13 | A13: TRAIL_STOP reads as a hold | `src/components/Research/Sheet/sheetCopy.js` | TRAIL_STOP is an exit — the cron swaps it out — never "protect the gain" | SHA-256 ✓ |
| R2-A17 | A17: the lever drops 'in a row' and the dead band | `src/components/Research/Sheet/sheetCopy.js` | the lever says what the code does: swaps out N ATR below entry, after N checks IN A ROW un | SHA-256 ✓ |
| R2-A9 | A9: the rung item's label is 'live price vs entry' | `src/components/Research/Sheet/packs.js` | a tapped rung item draws its own line "next rung · $…", never "live price vs …" (review D5 | SHA-256 ✓ |
| R2-A6p | A6: the question order re-derived from rounded numbers | `src/components/Research/Sheet/packs.js` | the HEADER's lead decides, never the rounded digits: 1234.4 vs 1234.1 shows +1234 / +1234  | SHA-256 ✓ |
| R2-A6i | A6: the standing item ignores the header's text | `src/components/Research/Sheet/packs.js` | the standing item prints the header's own text and words its lead (review A6): "-2" / "+12 | SHA-256 ✓ |
| R2-A6s | A6: the screen does not hand the header's lead | `src/screens/AgentBattleScreen.jsx` | the context is the screen's own: the subscribed battle, the header's pair, THIS TURN's dir | SHA-256 ✓ |
| R2-A8 | A8: a position without positionId is unnamed (CPU shares the ticker) | `api/_utils/researchAsk.js` | a position with NO positionId (legacy / crypto) on a ticker the CPU also holds: the server | SHA-256 ✓ |
| R2-C2 | C2: the 'claimed' guard comes back (row only when the pack names a position) | `api/_utils/researchAsk.js` | every GENUINE pack of every archetype re-reads clean: no true record item comes back not_o | SHA-256 ✓ |
| R2-B5 | B5: the reply shows under any question | `src/components/Research/Sheet/useSheetView.js` | the answer shows ONLY under the question it answered (review B5) | SHA-256 ✓ |
| R2-B6 | B6: one Ask slot for every stock | `src/components/Research/Sheet/useSheetView.js` | a late answer for one stock never re-opens another stock's Ask while that one is in flight | SHA-256 ✓ |
| R2-CU8 | C7/CU8: no in-flight guard (a double tap sends two) | `src/components/Research/Sheet/useSheetView.js` | a double tap sends ONE POST (one Ask in flight per stock) | SHA-256 ✓ |
| R2-D1a | D1: an answered question is offered again | `src/components/Research/Sheet/useSheetView.js` | one POST: the question as the message, the pack as researchAsk; the reply renders; the chi | SHA-256 ✓ |
| R2-D1b | D1: the reply card is not brought into view | `src/components/Research/Sheet/AskReply.jsx` | the reply card is brought into the drawer's view on sending and on the answer (review D1) | SHA-256 ✓ |
| R2-B7 | B7: a gateway 5xx without JSON reads 'not charged' | `src/components/Research/Sheet/useSheetView.js` | a failed turn (504) says it was not charged only when the route answered before its write | SHA-256 ✓ |
| R2-N2 | N2: the rankings are read again after leaving the question | `src/components/Research/Sheet/useSheetView.js` | leaving the stalled question before the read lands keeps it; coming back reads nothing mor | SHA-256 ✓ |
| R2-CU2 | C7/CU2: an ended battle takes an Ask | `src/components/Research/Sheet/useSheetView.js` | status completed: the Ask is disabled and sends nothing | SHA-256 ✓ |
| R2-CU3 | C5/CU3: the incumbent follows a navigated stock | `src/components/Research/Sheet/useSheetView.js` | navigated to another stock inside the modal: Layer 0, no incumbent | SHA-256 ✓ |
| R2-D5a | D5a: a time pin matched by day (the last marker that day) | `src/components/Research/Sheet/useSheetView.js` | a tapped item with a time pin opens the record marker AT that instant — the entry, never t | SHA-256 ✓ |
| R2-D5b | D5b: a price pin's line titled with the item's source label | `src/components/Research/Sheet/useSheetView.js` | markers through createSeriesMarkers; the latest pin open; a tapped item moves the open lab | SHA-256 ✓ |
| R2-D12 | D12: '● on the chart' where no pin is drawn | `src/components/Research/Sheet/AnalysisSheet.jsx` | "● on the chart" only where the pin is drawn: a time pin is not on 1W (review D12) | SHA-256 ✓ |
| R2-C1L | C1/D4: price lines not re-applied after a height rebuild | `src/components/Research/StockChart.jsx` | a rebuild caused by the height (rotation, resize): the markers and the lines go onto the N | SHA-256 ✓ |
| R2-C1M | C1/D4: markers not re-applied after a height rebuild | `src/components/Research/StockChart.jsx` | a rebuild caused by the height (rotation, resize): the markers and the lines go onto the N | SHA-256 ✓ |
| R2-D8 | D8: every sheet line shows an axis tag | `src/components/Research/StockChart.jsx` | axisLabelVisible on the emphasized line alone | SHA-256 ✓ |
| R2-D6 | D6: the open label drawn as canvas marker text | `src/components/Research/StockChart.jsx` | one open label: the marker the caller gave text is a CAPTION over the chart, never canvas  | SHA-256 ✓ |
| R2-CK1 | C7/CK1: markers reach the library unsorted | `src/components/Research/StockChart.jsx` | an unsorted list (a tapped item's own pin appended last) is drawn sorted | SHA-256 ✓ |
| R2-D7s | D7: the skeleton at the full chart height | `src/components/draft/AssetResearchModal.jsx` | while the series loads, and when it fails, the box is the height the chart will take | SHA-256 ✓ |
| R2-D7e | D7: the error box at the full chart height | `src/components/draft/AssetResearchModal.jsx` | while the series loads, and when it fails, the box is the height the chart will take | SHA-256 ✓ |
| R2-D2 | D2: the 💣 view at the sheet's height | `src/components/draft/AssetResearchModal.jsx` | 1D at the sheet's height; 💣 at the modal's full chart height (the Fuse is never cut under | SHA-256 ✓ |
| R2-D3a | D3: three lines of the sentence at Layer 0 | `src/components/Research/Sheet/AnalysisSheet.jsx` | the quoted sentence shows two lines until tapped; the eyebrow and the name tag ellipsize,  | SHA-256 ✓ |
| R2-D3b | D3: the name tag wraps (no nowrap/ellipsis) | `src/components/Research/Sheet/AnalysisSheet.jsx` | the quoted sentence shows two lines until tapped; the eyebrow and the name tag ellipsize,  | SHA-256 ✓ |
| R2-D13 | D13: a hex colour in the sheet's theme | `src/components/Research/Sheet/sheetTheme.js` | sheetTheme.js: zero hex, zero rgb()/rgba(), zero transition={{ | SHA-256 ✓ |
| R2-CM1 | C5/CM1: the bench door never records the incumbent | `src/screens/AgentBattleScreen.jsx` | the context is the screen's own: the subscribed battle, the header's pair, THIS TURN's dir | SHA-256 ✓ |
| R3-D7c | D7 (refuter): the skeleton without the chart's control row | `src/components/draft/AssetResearchModal.jsx` | while the series loads, and when it fails, the box is the height the chart will take | SHA-256 ✓ |
| R3-REQ | §3: the sheet reads the rankings on open (a request before any question) | `src/components/Research/Sheet/useSheetView.js` | sheet on vs off on the same 1D view: the same quote, series and profile requests; nothing  | SHA-256 ✓ |
| R3-REQ2 | §3: the sheet asks for a second daily series | `src/components/Research/Sheet/useSheetView.js` | sheet on vs off on the same 1D view: the same quote, series and profile requests; nothing  | SHA-256 ✓ |
| R4-PF | a bench name's check pin says "What it decided" (the check only flagged it) | `src/components/Research/Sheet/packs.js` | a bench name the check only FLAGGED: its pin says "What it flagged", never "What it decide | SHA-256 ✓ |
| R4-PF2 | a held name's check pin says "What it flagged" (the guard on held/evidence dropped) | `src/components/Research/Sheet/packs.js` | a HELD name the check also listed (an exit flag) keeps "What it decided": the check had it | SHA-256 ✓ |
| R5-F1a | FQ-1: step 1 back to the latest rationale (not the check that looked) | `src/components/Research/Sheet/latestLine.js` | 4a. a name an earlier check looked at but no longer held (swapped out): still "checked", w | SHA-256 ✓ |
| R5-F1b | FQ-1: a failed check counts as the check that looked | `src/components/Research/Sheet/latestLine.js` | a FAILED check that looked at the name is not "the check that looked": the one before it i | SHA-256 ✓ |
| R5-F1c | FQ-1: the check pin names any look (a failed one too), not the quoted check | `src/components/Research/Sheet/packs.js` | the check pin names the check the voice line quotes: a newer FAILED check that stamped the | SHA-256 ✓ |
| R5-F2a | FQ-2: a name examined, not held, reads "Not examined" again | `src/components/Research/Sheet/packs.js` | "What it flagged · exit · Wed 12:45", the flag in its own words, and the stance "Looked at | SHA-256 ✓ |
| R5-F2b | FQ-2: the stance's look counts a failed check | `src/components/Research/Sheet/packs.js` | a FAILED check that stamped the name is not a look: still "Not examined" (the A2 reading) | SHA-256 ✓ |
| R5-F5a | FQ-5: an exit flag is not quoted | `src/components/Research/Sheet/latestLine.js` | "What it flagged · exit · Wed 12:45", the flag in its own words, and the stance "Looked at | SHA-256 ✓ |
| R5-F5b | FQ-5: the exit flag wears the bench flag's words | `src/components/Research/Sheet/AnalysisSheet.jsx` | "What it flagged · exit · Wed 12:45", the flag in its own words, and the stance "Looked at | SHA-256 ✓ |
| R5-F5c | FQ-5: the exit eyebrow carries the archetype between (not the ruling's words) | `src/components/Research/Sheet/AnalysisSheet.jsx` | "What it flagged · exit · Wed 12:45", the flag in its own words, and the stance "Looked at | SHA-256 ✓ |
| R5-F6a | FQ-6: the helper never answers 100dvh | `src/components/Research/Sheet/sheetViewport.js` | 100dvh where the browser has it; 100vh where it does not; mode off keeps 100vh | SHA-256 ✓ |
| R5-F6b | FQ-6: sheet mode keeps 100vh | `src/components/draft/AssetResearchModal.jsx` | 100dvh where the browser has it; 100vh where it does not; mode off keeps 100vh | SHA-256 ✓ |
| R5-F6c | FQ-6: mode off takes 100dvh too (mode off must be unchanged) | `src/components/draft/AssetResearchModal.jsx` | 100dvh where the browser has it; 100vh where it does not; mode off keeps 100vh | SHA-256 ✓ |
| R5-F9a | FQ-9: never opens on 💣 | `src/components/Research/Sheet/sheetOpen.js` | inside the band ($103.40: 0.36 % to +30) → the 💣 view and the Bomb tab, not the sheet | SHA-256 ✓ |
| R5-F9b | FQ-9: decided on every render (switches after open) | `src/components/draft/AssetResearchModal.jsx` | decided ONCE at open: a price that moves into the band after open never switches the sheet | SHA-256 ✓ |
| R5-F9c | FQ-9: the market's hours ignored | `src/components/Research/Sheet/sheetOpen.js` | the market closed (Wed 8:00 PM ET, Sat noon) → the sheet, even inside the band | SHA-256 ✓ |
| R5-F9d | FQ-9: the band judged on the raw % (not Bomb mode's printed %) | `src/components/Research/Sheet/sheetOpen.js` | the band edge as Bomb mode prints it: $103.25 is 0.50 % → in; $103.24 is 0.51 % → out | SHA-256 ✓ |
| R5-F9e | FQ-9: the held mount's quote ignored (the asset's price used) | `src/components/draft/AssetResearchModal.jsx` | the held mount decides from ITS controlled quote, never the asset's own price (the two dis | SHA-256 ✓ |
| R5-F9f | FQ-9: a name not held enters (the held guard dropped) | `src/components/Research/Sheet/sheetOpen.js` | never for crypto, a legacy-scored holding, a name not held, or a mount without Bomb mode | SHA-256 ✓ |
| R5-F9g | FQ-9: crypto enters | `src/components/Research/Sheet/sheetOpen.js` | never for crypto, a legacy-scored holding, a name not held, or a mount without Bomb mode | SHA-256 ✓ |
| R5-F6d | FQ-6: the modal's border outside the visible viewport (content-box) | `src/components/draft/AssetResearchModal.jsx` | 100dvh where the browser has it; 100vh where it does not; mode off keeps 100vh | SHA-256 ✓ |
| R5-F6e | FQ-6: mode off becomes border-box too (mode off must be unchanged) | `src/components/draft/AssetResearchModal.jsx` | 100dvh where the browser has it; 100vh where it does not; mode off keeps 100vh | SHA-256 ✓ |
| B-D1a | D1: the reply card is never scrolled into view | `src/components/Research/Sheet/AskReply.jsx` (browser) | the answer is in view when it lands, and the asked question is not off — AssertionError: expected 1011.15625 to be less than or equal to 781.75 | SHA-256 ✓ |
| B-D1b | D1: no scroll margin (the card flush with an edge that moves when the footer is re-measured) | `src/components/Research/Sheet/AskReply.jsx` (browser) | the answer is in view when it lands, and the asked question is not off — AssertionError: expected 782.15625 to be less than or equal to 781.75 | SHA-256 ✓ |
| B-D7 | D7: the skeleton without the control row | `src/components/draft/AssetResearchModal.jsx` (browser) | the drawer opens where it stays: no jump when a slow chart lands, and  — AssertionError: expected 44 to be less than or equal to 1 | SHA-256 ✓ |
| B-D7b | D7: the skeleton at the full chart height (the build before review) | `src/components/draft/AssetResearchModal.jsx` (browser) | the drawer opens where it stays: no jump when a slow chart lands, and  — AssertionError: expected 154 to be less than or equal to 1 | SHA-256 ✓ |
| B-D2 | D2: the 💣 view at the sheet's height | `src/components/draft/AssetResearchModal.jsx` (browser) | Bomb mode with the sheet on: the 💣 Fuse is never under the drawer (re — AssertionError: 390: expected 494 to be less than or equal to 389 | SHA-256 ✓ |
| B-D3a | D3: three lines of the sentence at Layer 0 | `src/components/Research/Sheet/AnalysisSheet.jsx` (browser) | the worst cases at 390×844 (review D3): a long sentence, a 20-characte — AssertionError: long=1: expected 397 to be less than or equal to 394 | SHA-256 ✓ |
| B-D3b | D3: the eyebrow never shrinks and the name tag wraps (the build before review) | `src/components/Research/Sheet/AnalysisSheet.jsx` (browser) | 320×568: no sideways scroll for any fixture, nor with a 20-character n — AssertionError: sheetFixture=held_cp: expected 4 to be less than or equal to 0 | SHA-256 ✓ |
| B-D6 | D6: the open label as canvas marker text (clipped at the pane edge) | `src/components/Research/StockChart.jsx` (browser) | the open pin's label is never clipped by the chart pane, nor under its — AssertionError: 320: expected null not to be null | SHA-256 ✓ |
| B-D6b | D6 (deployed look): the caption back at the pane's left edge, under the attribution logo | `src/components/Research/StockChart.jsx` (browser) | the open pin's label is never clipped by the chart pane, nor under its — AssertionError: 320: the label over the attribution logo: expected true to be false // Object.is equality | SHA-256 ✓ |

## 9. Review record (BUILD_RULES §2)

Four lenses, each on its own fresh snapshot of `8e094607` (the build + tests), each with its own refuter on another fresh snapshot. Every refuter re-ran the claims from the code with its own repros; none took the lens's word. The fixes land in `0b8ec484`, refuter D's refinements in `78a25de4` and `d777461e`, the census ruling for A2 in `348fcfeb`; each fix has a mutant (§8, rounds 2–3 and the browser rows).

| Id | Lens · severity | What was wrong | Refuter | Outcome |
|---|---|---|---|---|
| A1 | Honesty · should-fix | The stall count ignored the tempo dial (`clampHftConfig`, live: `TEMPO_DIAL_ENABLED = true`); a "measured" Trend Follower stalls at 7, the sheet said 5 — and the server *verified* it | CONFIRMED | **Fixed** — `lensOf` uses the cron's own composition; row: standard 5 / measured 7 / aggressive 4. Reading: BC-6's "its own threshold" is the clamped one |
| A2 | Honesty · should-fix | "Checked at 12:45 · nothing said about AAPL" printed about a check whose rationale was never searched (a newer budget-skipped entry, or a sold name's older check) | CONFIRMED (wider than claimed) | **Fixed** — a failed/skipped call (`haikuError` set) is not "the latest check"; the template names the check rule 1 searched, and says *nothing said* only when that check said nothing (else "Last looked at …"). **FQ-1** below |
| A3 | Honesty · ruling | A sold name that an earlier check looked at reads "Not examined in this game" (BC-15's letter) while the voice line says it was checked | CONFIRMED (needs ruling) | **Open — FQ-2** |
| A4 | Honesty · should-fix | A `potential_exit` candidate (a held name flagged to leave) was quoted as a bench flag | CONFIRMED | **Fixed** — exit flags are never bench flags; the fixture's `direction: 'long'` (outside the enum) corrected |
| A5 | §9 · should-fix | The rung distance from raw values: "$1.51 (1.5%)" where Bomb mode shows "$1.50 / 1.47%" | CONFIRMED | **Fixed** — Build A's `toGo` (displayed values, two-decimal %) |
| A6 | §9 · should-fix | The standing re-rounded the header's pair: "Tied 1234 – 1234" under "You lead by less than 1"; "-3 – 12" under "-2 / +12" | CONFIRMED | **Fixed** — the screen hands its own digits (`formatScoreDisplay`) and lead (`comparison.lead`) |
| A7 / B3 | Honesty, server · should-fix | "ETH is the name it would replace" came back VERIFIED on a hand-made POST: the relation lives in the cockpit's call, not the battle document | PARTLY (hand-made POST only) | **Fixed** — `incumbent` is a client kind (`from_cockpit`), never verified |
| A8 / B4 | Server · should-fix | True items came back `not_on_record` on a ticker the CPU also holds | CONFIRMED at 8e09, fixed at 2b30; residual for a position with no `positionId` | **Fixed** — such a position is named by its own slot (`posKey`); the all-archetype sweep row holds it (C2) |
| A9 | Honesty · nit | The rung item's label said "live price vs entry" | CONFIRMED | **Fixed** — "live price vs the next rung" |
| A10 | BC-3 · should-fix | "(vs. XLK)" split a sentence | CONFIRMED | **Fixed** — an abbreviation after a bracket or an opening quote |
| A11 | §9 · should-fix | "At its high since entry ($104.10)" with the live price at $105.50; the entry day's bar counts highs from before the fill | CONFIRMED | **Fixed** — the live price at/above every bar is the high; the item names the day its bars start ("since Wed 10/14"), never "since entry" |
| A12 / B1 | Honesty, server · should-fix | Verified items are the server's own objects, built from stored text (an idea statement, a directive, a signal summary) that can carry newlines and `</RESEARCH_ASK_PACK>` — it landed outside the delimiters | CONFIRMED | **Fixed** — every pack line is one clean line at parse, at verify and at render (`researchAskText.js`, composing the chat sanitizer) |
| A13 | Honesty · should-fix | TRAIL_STOP read "protect the gain"; the cron treats it as an exit | CONFIRMED | **Fixed** — "swap it out — its trailing stop tripped"; the lever says "a dip under its 5-min average sells it" |
| A14 | Honesty · should-fix | The prompt told the model every unverified item came from the player's screen — including record claims the server could not find | CONFIRMED | **Fixed** — each unverified line says why (`not_on_record` → "unconfirmed") |
| A15, A16 | nits | `SHEET_COPY.ideaPill` and `ITEM_TEMPLATE_KEYS` unused | CONFIRMED | **Removed** (the pill's label sits with its literal siblings SMA, S/R) |
| A17 | nit | "after 3 checks under VWAP" left out *in a row* and the dead band | CONFIRMED | **Fixed** — "after 3 checks in a row under VWAP ending 0.7% below" |
| B2 | Server · nit | U+2028/2029, NEL, \v, \f survive the chat sanitizer; brackets let a line print its own "[VERIFIED]" | PARTLY | **Fixed locally** (`researchAskText.js`); the shared `sanitizeChatText` is untouched (outside §5) |
| B5 | Client · should-fix | An answer showed under a different question (whose header said "free · no message spent") | CONFIRMED | **Fixed** — the reply shows only under its own question |
| B6 | Client · should-fix | A late answer for one stock re-opened another stock's Ask while its POST was in flight → a second charge | CONFIRMED (non-held / legacy mounts) | **Fixed** — the Ask state is per stock, with a synchronous in-flight guard |
| B7 | Client · should-fix (low) | A platform 502/504 with no JSON body (a kill after the write) was called "No message was used" | CONFIRMED | **Fixed** — "not charged" only when the route answered with its JSON `error` |
| N1 | Server · nit | `chat.js` accepted a sheet Ask with the mode off | CONFIRMED | **Fixed** — 403 `research_ask_off` unless the mode admits the owner (`'on'`, or `'allowlist'` and the cockpit allowlist) |
| N2 | Client · nit | Leaving the stalled question before the rankings read landed threw it away; coming back read again | PARTLY | **Fixed** — one read for the modal's life |
| N3 | Client · nit | While the screen's calls reader is loading, the sheet opens its own identical listener briefly | CONFIRMED, negligible | **Reported, not changed** (bounded to the loading window) |
| C1 / D4 | Tests, pins · should-fix | Pins left on a dead series after a height-only rebuild (rotation, resize) until the 30 s tick | PARTLY (heals in ≤ 30 s; height is the one real trigger) | **Fixed** — both pin effects carry the chart effect's dependencies |
| C2 | Tests · should-fix | Nothing pinned the 2b30ff72 server-row fix | CONFIRMED | **Pinned** — every genuine pack of every archetype re-reads with no `not_on_record` |
| C3 | Tests · should-fix | The six-archetype snapshot compared kinds only; 7 fact mutants survived | CONFIRMED | **Pinned** — the facts golden (every item's words and numbers) + hand-worked rows (drawdown base, bars before entry, next check, rung compare) |
| C4 | Tests · should-fix | No row for rationale-vs-call, bench-vs-call, calls delivered newest-first, an older candidates list; CL4 (the held arm) | CONFIRMED (CL4 is the `held && latest` arm) | **Pinned** |
| C5 | Tests · should-fix | BC-11 at the screen pinned only statically; the incumbent followed a navigated stock (CU3) | CONFIRMED | **Pinned** — the setter line; a hook row for navigation |
| C6 | Tests · should-fix | The label's sanitization had no row | CONFIRMED | **Pinned** |
| C7 | nits | CU8 double tap (upgraded to should-fix), CU1, CK1 sort, CP2 negative to-go, CU2 ended battle, CP14, CL6, the dead `failFirstCommit` | CONFIRMED / PARTLY | **Pinned / removed**; CU5, CP9, CP10, CP12 reported |
| D1 | Mobile · **blocker** | The answer landed below the fold (0 px visible) while the Ask button stayed live with the same label — a second tap spent a second message | CONFIRMED — blocker for the phone smoke and the flip | **Fixed** — the reply card is scrolled into the drawer's view; an answered question is not offered again ("Asked … · the answer is below") |
| D2 | Mobile · should-fix | With Bomb mode and the sheet on, the 💣 Fuse was cut in half under the drawer | CONFIRMED; fix (a) clips the Fuse at 320 (its 200 px floor) | **Fixed** — on 💣 / spectate the chart keeps its full height and the drawer moves down (the fold is the 1D view's; FQ-3) |
| D3 | Mobile · should-fix | A 3-line sentence or a 20-character agent name broke the fold; at 320 the name tag widened the drawer | PARTLY — narrower at 390 than claimed; the 320 overflow confirmed | **Fixed** — the sentence shows two lines until tapped; the eyebrow and the tag ellipsize |
| D5 | Pins · should-fix | A tapped item opened the wrong marker (matched by day), and a price pin's line was titled with the item's source label | CONFIRMED (both halves) | **Fixed** — matched by instant; the line is named for what its price is ("next rung · $103.77") |
| D6 | Pins · should-fix | The open marker's label was clipped at the pane's right edge and drawn over the OHLC overlay | CONFIRMED | **Fixed** — markers are dots; the one open label is a caption over the chart, clear of the chart library's attribution logo (an overlap seen on the deployed smoke, fixed at `31938a1a`) |
| D7 | Mobile · should-fix | The drawer opened ~154 px low and jumped when the chart landed (the skeleton kept the full height) | PARTLY — the box must also cover the 44 px control row | **Fixed** — the skeleton and the error box stand in for the whole sheet chart (control row + plot); a browser row measures no jump |
| D8 | Pins · nit | Axis tags stacked off their lines | CONFIRMED | **Fixed** — an axis tag only on the open line |
| D9–D11 | nits | Snap glitch (~250 ms), landscape action row off-screen at mid, tab switch rebuilds the chart | CONFIRMED (D9, D10); D11 REFUTED — by design | **Reported** (D11 is the design: the sheet geometry is the Analysis tab's) |
| D12 | nit | "● on the chart" on 1W where a time pin isn't drawn | CONFIRMED | **Fixed** |
| D13 | nit | The sheet's files outside the shared guards; raw `rgba()` in the About body | CONFIRMED | **Fixed** — the sheet's own guard (every module, planted rules); the About body on tokens |
| D14 | nit | The fold holds at screen sizes, not Safari's visible viewport (390×664: one question visible) | PARTLY — spec scope; no committed fold check | **Reported** (§6, FQ-6); the fold check is now a committed row |

## 10. Exit codes and the Test Files line

Every full Linux run of this branch, oldest first (WSL Ubuntu, Node v20.20.2, `TZ=UTC`, `flock /tmp/pd-suite.lock`, `--maxWorkers=8`, package-lock `40382e64edb6`; the exit code asserted and the `Test Files` line read from the log):

| Head | Exit | `Test Files` | `Tests` | Note |
|---|---|---|---|---|
| `8e094607` (the reviewed head) | 0 | 1363 passed \| 8 skipped (1371) | 29898 passed \| 89 skipped (29987) | |
| `d777461e` | **1** | 1 failed \| 1365 passed \| 9 skipped (1375) | 1 failed \| 29977 passed \| 105 skipped (30083) | the unconfirmedOutcome census: the A2 fix made `latestLine.js` read `haikuError`, unruled — ruled at `348fcfeb` (§3, FQ-8) |
| `348fcfeb` | 0 | 1366 passed \| 9 skipped (1375) | 29978 passed \| 105 skipped (30083) | |
| `31938a1a` | 0 | 1366 passed \| 9 skipped (1375) | 29978 passed \| 105 skipped (30083) | |
| `d8600ca9` | 0 | 1366 passed \| 9 skipped (1375) | 29980 passed \| 105 skipped (30085) | the first PR head's code |
| `b669d0a1` | 0 | 1367 passed \| 9 skipped (1376) | 30006 passed \| 107 skipped (30113) | the ruling pass |
| **`f68ddc83` (the code head)** | **0** | **1367 passed \| 9 skipped (1376)** | **30006 passed \| 107 skipped (30113)** | the final run |

- **Rules** (`npm run test:rules`, the Firestore emulator, Java 21): EXIT 0, `Test Files 35 passed (35)`, `Tests 666 passed (666)` at `d777461e`, `31938a1a`, `d8600ca9`, `b669d0a1` and `f68ddc83`.
- **`npm run lint:gate`:** EXIT 0 at every head above.
- **`vite build`:** EXIT 0 at `d777461e`, `31938a1a`, `d8600ca9`, `6f9df27b`, `b669d0a1` and `f68ddc83` (`✓ built in 15.53s`), and the report commit before the push.
- **The fold rows in a real browser** (`SHEET_FOLD_URL`): 18 of 18 against the deployed smoke preview at the code head.
- The suite's skipped files include the fold file (no page in CI) — 9 skipped at every head since it was added, 8 before.

## 11. The smoke

- **URL:** https://trade-seven-nywqnm7it-fais-projects-bc179554.vercel.app — open `/?sheetFixture=held_tf` (and the six others) on the phone.
- **Branch:** `claude/research-modal-sheet-smoke` @ `70c42057`, two commits on the code head `f68ddc83` — `b8373d6f` (the mode `'on'`) and `70c42057` (the `?sheetFixture` loader in `src/main.jsx`, `src/smoke/SheetSmokeScreen.jsx`, `src/smoke/sheetFixtures.battles.json`). Never merge it.
- **What it is:** the real modal, mounted exactly as the battle screen mounts it, on JSON fixtures shaped from real battle documents by the corrected-battle harness (no production read for the sheet). The clock is fixed at Wed Oct 14 2026, 1:07 PM ET. The Ask is answered on the page by a canned reply that says **SMOKE ONLY** — no model call, no message charged anywhere; the page then files the exchange to its own copy of the battle so *✓ filed to chat* lights.
- **`held_redzone`** (FQ-9): the sheet and Bomb mode both on, AAPL at $103.40 — $0.37 (0.36 %) under the +30 rung with the market open — so the modal opens on 💣 in the red zone; *Analysis* is one tap away.
- **Measurement parameters** (SMOKE ONLY, for the fold row and the review's worst cases): `&name=` (an agent name), `&arch=` (an archetype), `&long=1`, `&bars=1`, `&bomb=1` (Bomb mode on as well), `&delay=N`, `&fail=1`.
- **Please check on the iPhone:** the action row (Ask, → Cockpit) with Safari's bottom bar showing. Since FQ-6 the sheet's modal is the visible viewport (`100dvh`); a headless browser has no toolbar, so only a phone can confirm it.
- The modal's other tabs (Ranks, Technical …) on the smoke page are the app's own and read what they read in the app; the sheet reads nothing but its fixtures.

## 12. Found on the way, and the questions

**Questions for the founder** — all ruled on 2026-11-08 (§0): FQ-1, FQ-2, FQ-5, FQ-6 and FQ-9 built; FQ-3, FQ-4 and FQ-7 as built; FQ-8 in scope. Kept below as they were asked:

- **FQ-1 (BC-3, review A2):** BC-3 quotes the LATEST check's rationale and searches no older check. A name sold two checks ago, whose selling check said why, now shows "Last looked at Tue 11:00" — never "nothing said". Should step 1 also search the latest check that LOOKED at the name (its evidence or candidates), so that sentence is quoted?
- **FQ-2 (BC-15, review A3):** a name not held now that an earlier check examined (sold, or on an old candidates list) reads **"Not examined in this game"** — BC-15's letter ("any other name") — while its voice line says when it was looked at. Proposed: "Looked at Tue 11:00 · not held now".
- **FQ-3 (review D2):** with Bomb mode and the sheet on, the 💣 view keeps the modal's full chart height and the drawer moves down (the fold is the 1D view's). The alternative squeezes the Fuse into the sheet's 198 px, which needs the Fuse's 200 px floor lowered (it clips at 320).
- **FQ-4 (review D1):** once a question is answered, the Ask says "Asked Trend Follower · the answer is below" until another question is picked — a second Ask of the same question is not offered (each would spend a message). Allow it?
- **FQ-5 (review A4):** a check's *potential_exit* flag on a name is no longer quoted as a bench flag; the voice line says "Last looked at …". Quote it as "What it flagged · exit" instead?
- **FQ-6 (review D14):** the fold is met at the two named sizes; with Safari's bars (390×664) or at 360×780 Layer 0 scrolls (§6). Size the chart from the visible viewport?
- **FQ-7 (review D8):** only the open line shows its price tag on the axis (the tags stacked off their lines at the sheet's chart heights), so the entry's price tag shows only when its line is the open one.
- **FQ-8 (spec §5):** three existing test files beyond §5's list carry data lines only — the census and carriage rulings for the sheet's new readers (§3, after the gate table). They are the same class as the ratchet baseline §5 lists, and without them the full suite is red. Read §5 strictly and they were STOPs; were they in scope?

**Found on the way:**

- **iOS Safari, 100vh** (refuter D): ruled as FQ-6 — in sheet mode the phone modal is now `100dvh`, border-box. The new 390×664 row found the last pixel: with the app's content-box sizing, the modal's 1 px border put the action row's bottom at 665 in a 664 px screen. Mode off keeps `100vh`. The phone check (§11) still stands.
- **Pre-existing, mode-off, out of scope:** StockChart's S/R and highlight lines have the same gap the pins had (D4): a height-only rebuild (rotation, resize) drops them until the data changes.
- **Snap and landscape (D9, D10, nits):** during the ~250 ms drawer spring the action row sits off its rest place (the scroll height follows the target snap, not the motion value); on a landscape phone (844×390) the action row is below the screen at mid snap, reachable at full.
- **Action row height:** its label swap (two lines idle, one while answering) moves the scroll area's bottom 12 px on each Ask.
- **N3 (nit):** while the screen's calls reader is still loading, the sheet opens its own identical listener for that window.
- **C7 nits not pinned:** CU5 (the 1W harness serves no bars), CP9 (+0 banked), CP10 (a bench name on the frozen list), CP12.
- **Tooling:** worktrees share `node_modules`, so concurrent vite servers re-optimize one shared `node_modules/.vite` cache ("504 Outdated Optimize Dep", "Invalid hook call"); give each harness its own `cacheDir`.
- **Seen only on the deployed smoke, and fixed:** the open pin's caption sat under the chart library's attribution logo (`31938a1a`); a bench name's check pin read "What it decided" while the voice line said "What it flagged" (`e27b51b4`). Each now has a row and a mutant.
- The legacy mount passes `held: false` in the row; whether a name is held is decided from the battle document (`holdingOf`), never from that flag.
