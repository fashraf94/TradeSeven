# BUILD PROMPT — Research Modal Build C: the sheet, in battle (spec + build, dark)

**Date:** November 7, 2026
**Session:** fresh LOCAL Claude Code session, Opus, in its own worktree cut from `origin/main`. Attach nothing: every input is on `main` (§0.2).
**Spec of record:** this document. Commit it as the first commit at `docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md`.
**Branch:** `claude/research-modal-sheet`.
**Ends as:** a DRAFT pull request plus a never-merge smoke branch (§8). Do not merge, flip or watch CI.
**Report:** `docs/audits/<run date>_BUILD_RESEARCH_MODAL_C_SHEET.md`, committed on the branch, with a copy in `C:/Users/fashr/Documents/FantasyTrades/ResearchModal/`.
**Order:** if the Bomb mode allowlist flip (`claude/bomb-mode-allowlist`) is open when you start, cut after it merges or merge `main` before your final checks. Both PRs edit `src/config/researchModalFlags.js`.

---

## 0. Before any code

### 0.1 Setup

`git fetch origin`. Record the `origin/main` HEAD you cut from. Read `CLAUDE.md` and `docs/BUILD_RULES.md`. They are binding, especially:
- §1 the fence, and the §2.3 import-boundary ratchet;
- §2 branch discipline and the review threshold;
- §3 session documents;
- §8 deliverables;
- §9 display agreement;
- §10 color tokens;
- §11 motion tokens.

### 0.2 Read these, in this order, from `main`

1. `docs/audits/20261102_PHASE0_RESEARCH_MODAL.md`, which is the source of every anchor below (read at `40641486`): §A, §B, §E, §F, §I, §K, §L, §M, §N, §O; founder questions FQ-1, FQ-3, FQ-7 and FQ-8 (all ruled at their defaults on Nov 7); §3's row C; §5.
2. `docs/design/research-modal/RESEARCH_MODAL_DESIGN_DIRECTION_V2_OCT17_2026.md`: R-12–R-15, §2.1, §2.5 and §3. This is the design of record for the sheet.
3. `docs/design/research-modal/RESEARCH_MODAL_DIRECTION_V2_AMENDMENT_B_NOV02_2026.md`: R-19–R-22, B-1, B-2, B-3.
4. `docs/design/research-modal/RESEARCH_MODAL_BUILD_PLAN_V1_OCT29_2026.md`: R-16 and §6's cockpit hook.
5. The round-3 Claude Design file in `docs/design/research-modal/`, screen A (A0, A1, A2, and the Capital Preserver variants). Open it in a browser.
6. `docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md`:
   - §2's finding shape (the pack items use it, §3.2);
   - §4 `exchangeId` (the Ask mints one the same way, §4.3).
7. `docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md`, including its dated rulings section, and the Build A report's §0, §5 and §6.
   - The sheet reuses Build A's selector for entry and banked state, its flag module and its allowlist hook.
   - It inherits the measured-only ruling: a legacy-scored position never claims an entry or a ladder.

### 0.3 The design rule

The mockup contributes structure, behaviour and vocabulary. The skin comes from the shipped tokens (§10): no new hex values. The mockup's numbers and sentences are placeholders. Every number and every sentence on screen comes from a record named in §3, or from a template filled from one.

### 0.4 Reconciliation gate (read-only, before any code)

Confirm each anchor in §3 at your HEAD by meaning, not by line number, and record any drift in the report. The gate STOPs on any of these:
- (a) **`api/agent/chat.js` or `voiceLayerPrompt.js` is fenced, or the pack block cannot be added without editing a fenced file.** Phase 0 §E says neither.
- (b) **A chat turn can charge the per-battle budget without writing its exchange, or the other way round.** Phase 0 §E: one `fileDirectiveTransactional` update does both.
- (c) **`battle.cronState.stagnationTicks` is not the agent's own stagnation counter**, the one the forced-rotation rule reads.
- (d) **A config value the packs cite cannot be imported client-side.** These are the archetype weights, the forced-rotation and swap-window blocks, and the preset risk levers.
  - Report which one, omit the items that need it (§3.3), and continue.
  - **This one does not stop the build.**
- (e) **Any file this build needs is on the §1 fence list** (reading a fenced file is permitted; editing one is not).

For each STOP, report what you found and which section it breaks. Do not improvise.

## 1. What this build is (plain terms)

In a live agent battle, tap a stock and the Analysis tab becomes the **sheet**: the equipped archetype's lens on that stock. It opens on one line and a question instead of three screens of cards.

- **On open (Layer 0):**
  - a stance line (*Holding since Tue 10/13 · entry $154.76 · +4.3% · +15 banked*);
  - the archetype's latest sentence about this stock, verbatim and timestamped (*Trend Follower · Fri 1:15*);
  - the chart with the record pinned to it as dots;
  - the three questions as big buttons: *Does this help us catch up?* · *Does this protect the lead?* · *Is this better than what's stalled?*;
  - a tucked row (*About* · *Wall St*);
  - two buttons: the Ask and *→ Cockpit*.

  All of it fits above the fold on a phone.
- **Tap a question (Layer 1):** an **evidence pack** of three to five facts, each with its source and time, and each lighting its pin on the chart.
  - The pack is built from records, with no model call, and costs nothing.
  - **The equipped archetype decides what leads.** Capital Preserver's *protect the lead* opens with its risk rule; Speculator's *catch up* opens with volatility and the distance to the rung.
  - The pack is labelled *What Trend Follower weighs*.
- **Tap Ask (Layer 2):** one message from the game's chat budget. The archetype answers in the modal, with the pack as its receipt, and the exchange appears in chat too. One exchange, two renderings.

Everything ships **dark** behind one flag. Browse mode (search, Discover, FantasyTimes) is unchanged; that is Build D.

## 2. Rulings in this spec (approve-by-default; founder rulings of Nov 4 and Nov 7 already applied)

| # | Ruling | What the player sees |
|---|---|---|
| BC-1 | **Scope.** The sheet replaces the Analysis tab's content on the agent Battle View's three mounts, and on the cockpit bench door through them, when `RESEARCH_MODAL_SHEET_MODE` resolves on. Every other mount, and every other tab, is unchanged. With the mode on, the in-battle Analysis tab no longer shows the Haiku preset questions (`AnalysisQATab` → `/api/ai-advisor`). The file stays; the mode-off path is untouched. | In a battle, the agent you chose speaks; nothing else answers for it. |
| BC-2 | **Layer 0 fits the fold.** Everything above the action row, the chart included, fits 390×844 and 430×932. At 320 px wide there is no horizontal scroll; the fold may scroll there, and you report its measure. The chart's height in sheet mode is chosen to fit, and reported. | One line and a question on open. |
| BC-3 | **The latest sentence is quoted, never written.** In order: <ol><li>the first sentence of the latest check's `rationale` that names the symbol as a whole word;</li><li>else the latest call record's `said` for this symbol;</li><li>for a bench name, the latest entry's `candidates[].signalSummary`;</li><li>else a template: *Checked at 1:15 · nothing said about EOG* (held), or *{Archetype} hasn't looked at this one* (never on a check).</li></ol>A rationale sentence is split by a deterministic rule pinned by tests, and never paraphrased. | The voice line is real, and says when it isn't. |
| BC-4 | **Packs are deterministic and archetype-ordered (R-15).** <ul><li>Three to five items, built from the battle document, the calls and the computed facts, ordered by the equipped archetype's config (§3.3).</li><li>An item with nothing behind it is omitted, never shown as "n/a".</li><li>Every item uses the research record's finding shape (§3.2), with `status` and `asOf`.</li><li>Tapping a question calls no model and spends nothing.</li><li>The pack's label is *What {Archetype} weighs*.</li></ul> | Different archetypes show different evidence first, mechanically. |
| BC-5 | **No stop price.** The record stores no stop or target (Phase 0 §B). A risk item shows the archetype's lever in plain words (*trails 1.5 ATR behind the high*) and the latest check's risk verdict (*Risk check at 1:15: hold*). It never computes a stop price. | Nothing implies a stop the agent never set. |
| BC-6 | **"Stalled" is the agent's own counter.** A held name is stalled when `cronState.stagnationTicks[SYM]` has reached the archetype's own `forcedRotation.ticksThreshold`. Capital Preserver has forced rotation off, so its pack says *Capital Preserver doesn't rotate out of quiet names* and lists none. | The game's own rule, not a guess. |
| BC-7 | **The Ask (FQ-1, FQ-8).** <ul><li>One message from the per-battle chat 10, through `chat.js`, labelled *· 1 message · {n} left*.</li><li>The server rebuilds the record items itself (`verified`). The client's computed facts ride as `unverified`, delimited by the injection guard.</li><li>The Ask's exchange gets an `exchangeId`, minted the way the contract's §4 mints it.</li><li>The reply card renders the response. Its *filed to chat* chip lights when the battle document holds that exchange id.</li><li>If the turn filed a directive, the card says so and shows its text.</li><li>With no messages left, the Ask is disabled: *No messages left this game*.</li></ul> | Asking costs exactly one message, and the player sees what it did. |
| BC-8 | **Pins.** <ul><li>The 1D chart draws the record as dots, through `createSeriesMarkers`: the entry day; calls naming the symbol; the player's answers to them; the latest check.</li><li>It draws price lines through a new `priceLines` prop: the measured entry, the idea's conditions.</li><li>One label is open at a time: the latest pin, or the one the tapped pack item points to.</li><li>1W draws the price pins only.</li></ul> | The chart is the agent's record (R-5). |
| BC-9 | **The idea layer (R-20, B-2, B-3), in battle only.** <ul><li>When the battle carries `equippedHypothesis` and the stock is on its frozen list or named in a condition, the stance gains *In this game's idea · since {deploy date}* and the statement truncated to one line (tap opens it).</li><li>An **Idea** pill draws the conditions as *live above $X* / *wrong below $Y*.</li><li>When nothing was carried, all of it is absent (R-22, by omission).</li></ul> | Your idea shows where it applies, and nowhere else. |
| BC-10 | **What you told it.** The battle's active directive is a pack item when its text names the symbol as a whole uppercase token of three or more letters, or a call-family directive's `action.symbol` is the symbol. <ul><li>It is labelled *What you told it · {time}*.</li><li>It reads *· from this morning's huddle* when its thread id starts with `plan:` (Huddle S1 spec V1.1 §4.5). Confirm the prefix on `main`, or on `origin/claude/huddle-s1` if unmerged.</li><li>No huddle record is read.</li></ul> | Your own instruction shows up next to the stock it's about. |
| BC-11 | **The cockpit's incumbent.** When the sheet opens from the cockpit's "Who comes in?" bench door, the screen passes the incumbent, the held name the call would replace (Phase 0 §A: in scope at the screen). The sheet then opens with *Is this better than what's stalled?* selected, and the incumbent in that pack side by side. From any other door there is no incumbent. | Scouting a swap shows both names. |
| BC-12 | **→ Cockpit** opens the battle's cockpit through the screen's existing path (the desktop pane or the phone section). It shows only when the cockpit is on for this battle; otherwise it is absent, never a dead button. | — |
| BC-13 | **Questions in standing order.** When the player trails, *catch up* comes first; when they lead, *protect the lead* comes first; when it's tied or unknown, the design's order. The standing comes from the score fields the Battle View already shows; cite them. | The question that matters now is on top. |
| BC-14 | **No News row in V1.** Phase 0 §N: there is none today, and the agent's news input isn't recorded per check (B-1). Build E adds it. The tucked row is *About* (the profile the modal already fetches) and *Wall St* (the labelled consensus chip from the honesty fixes). | Nothing claims what the agent read. |
| BC-15 | **Older-scored and unexamined names.** <ul><li>A legacy-scored or crypto holding gets a stance with no entry and nothing banked (*Holding since Tue 10/13*), and its packs omit rung items (Build A's ruling).</li><li>A bench name reads *On the bench · flagged at 1:15* when the latest entry's `candidates[]` holds it.</li><li>Any other name reads *Not examined in this game*, or *In this game's idea · not examined* when it is on the frozen list.</li></ul> | Honest about what the agent has and hasn't done. |

## 3. The records the sheet reads (no new store, no new price request)

### 3.1 Sources

- **The battle document**, which the screen already subscribes to:
  - `evaluations[]`: `rationale`, `timestamp`, `evidence[SYM]`, `candidates[]`, `triggers[]`;
  - the positions;
  - `equippedHypothesis` and `equippedWatchlist`;
  - `directive`;
  - `chatExchanges[]`;
  - `chatBudgetUsed`;
  - `cronState.stagnationTicks`;
  - the score fields;
  - `agentContext.archetype`, which is the archetype, read from the document and never from a prop (Phase 0 §A).
- **Entry and banked state:** Build A's `selectBombRecord`, measured only (BC-15).
- **The calls subcollection**, owner-readable, filtered client-side by `symbol`. The read is one subscription opened only while the sheet is visible. Report whether the screen already holds one, and reuse it if so.
- **Computed facts:** the modal's own daily series and facts grid. They are `status: 'unverified'` and labelled *from the chart, as of {date}*.
- **`indexIntelligence/stockRankings` `arch_scores`:** already read by the Ranks tab, for *better than what's stalled*.

### 3.2 The item shape (one vocabulary with Shared Research)

`{ kind, symbol, fact, source: { recordKind, recordId, label }, at, asOf, status, statusReason, pin }`, the research record's finding shape (contract §2) without `findingId` and `supersedes`.

- Packs are not stored.
- The modal's `recordKind` list is closed, defined once in the new pack module, and reuses the contract's spelling wherever a kind already exists (`call`, `hypothesisVersion`, `stockRankings`).
- `status` is `verified` only for an item the server can re-read from the battle (§4.3); otherwise it is `unverified` with a reason.

### 3.3 Ordering by archetype (R-15; ratchet entries in the same commit)

- **What the order is built from:** read-only imports of `ARCHETYPE_WEIGHTS` (`archetypeScoring.js`), each archetype's `forcedRotation` and `swapWindow` (`agentArchetypeConfig.js`), and the preset risk levers (`agentPresetConfig.js`).
- **The mapping:** write each item kind → factor mapping once, as a table in the new module.
- **The order:** an item's position = the archetype's weight on that factor, with ties broken by a fixed order. Protect-the-lead risk items take the preset's defensiveness as their factor.
- **Acceptance:**
  - for one fixture stock, at least four of the six archetypes give a different first item for some question;
  - Capital Preserver's *protect the lead* leads with a risk item;
  - Speculator's *catch up* leads with volatility or the distance to the rung.
- **The plain-word templates:** one per config value, held in a copy module under the honesty test. Phase 0 §F's table names what each cell can cite; a cell with nothing behind it is omitted.

### 3.4 The three packs (candidates; order per §3.3; three to five shown)

- **Catch up:**
  - the distance to the next rung and its points (measured only);
  - the move since entry;
  - what the latest check read (`evidence[SYM]`: the regime word, the day change, the ATR multiple, plain words);
  - the archetype's entry rule in plain words;
  - the standing.
- **Protect the lead:**
  - the latest risk verdict (`evidence[SYM].risk`);
  - the archetype's risk lever (BC-5);
  - the banked points and the next check (Build A's clock);
  - the drawdown from the high since entry (computed);
  - the standing.
- **Better than what's stalled:**
  - the stalled holdings (BC-6);
  - this stock's and their distance to a rung (measured only);
  - the archetype's ranking scores for each (`arch_scores`, *rankings as of {date}*);
  - the incumbent (BC-11);
  - a bench name's `signalSummary`.
- **The loop items, any pack:**
  - the idea's statement (BC-9);
  - what you told it (BC-10).

## 4. What to build

### 4.1 The flag

- `RESEARCH_MODAL_SHEET_MODE` = `'off' | 'allowlist' | 'on'`, shipping `'off'`.
- It lives in `src/config/researchModalFlags.js`, beside Build A's flag, with its own `_MODES` list, `// Pinned by:` line, pin row, call-time resolver (unknown → `'off'`) and `DARK_BY_DESIGN` note. It is never read at module scope.
- `'allowlist'` is answered per agent battle by the cockpit-status `allowlisted` verdict, through Build A's hook and cache. Add no route.

### 4.2 Client

- **New prop `sheetContext`** on the modal: `{ battleId, agentId, archetype, agentName, row: { held, positionId | posKey }, incumbent?, onOpenCockpit? }`.
  - It is passed only from `AgentBattleScreen.jsx`'s three mounts, and only when the mode is on (the Build A spread pattern).
  - The bench door gets its own handler that adds the incumbent. The two `onSymbolClick` doors don't.
- **New files under `src/components/Research/Sheet/`:**
  - `AnalysisSheet.jsx`: Layers 0–2;
  - `packs.js`: the pure builder, the item kinds and the ordering table;
  - `sheetCopy.js`: every string and template;
  - `latestLine.js`: BC-3;
  - `useSheetView.js`;
  - `AskReply.jsx`.
- **`StockChart.jsx`:**
  - new optional `priceLines` and `markers` props;
  - `markers` uses `createSeriesMarkers`, re-applied on every series rebuild;
  - a marker's `time` equals a bar's `time` (Phase 0 §N);
  - the Idea pill is a clone of the S/R effect (Phase 0 §L);
  - all of it is inert when the props are absent.
- **Motion:** tokens only. Reduced motion makes every transition instant.

### 4.3 Server (`api/agent/chat.js`, `voiceLayerPrompt.js`; both non-fenced, confirmed at §0.4)

- **The request:** an optional body field `researchAsk: { symbol, questionId, items[] }`. `questionId` comes from a closed list of three; `items` holds at most five, from closed kinds, each `fact` at most 200 characters.
- **The message:** the turn's `message` is the question as the player sees it (*Does this protect the lead? — EOG*), so the chat bubble reads naturally.
- **The server's own items:** it rebuilds the record items it can from the battle document it already reads (the check, the position, the calls, the directive, the idea) and marks them `verified`. Client items it cannot re-derive keep `status: 'unverified'`.
- **The prompt:** the pack goes in as a new named input with a `null` default (the `callsBlock` precedent), so every existing voice-layer golden is byte-identical, wrapped by the injection guard. The block tells the voice to answer the question from the items and its charter, to name the item it leans on, and never to state an unverified item as fact.
- **The exchange:**
  - it carries `exchangeId: randomUUID()`, minted when the object is built, before the write (contract §4);
  - it also carries `source: 'research_modal'` and `researchAsk: { symbol, questionId }`;
  - only research-modal Asks get the id; every other exchange is written exactly as on `main`;
  - the response returns `exchangeId` for a research Ask only.
- **The rest is unchanged:** budget, integrity gate, directive filing and model.

### 4.4 Honesty

- §9 display agreement for every number. A label and its number come from one source.
- The forbidden-terms test covers every new string and template. Never write *the agent held off*, *will bank*, *stop at $X*, or *what it read* (BC-14).
- The prompt honesty sweep covers the new block.

## 5. Fence, files

- **Fence:** none expected.
- **Ratchet:** each new client importer of a ratchet basename goes into the baseline in the same commit.
- **Expected existing files:**
  - `AssetResearchModal.jsx`, `AnalysisDrawer.jsx`, `StockChart.jsx`;
  - `AgentBattleScreen.jsx` (mount spreads and the bench handler only);
  - `api/agent/chat.js`, `api/_utils/voiceLayerPrompt.js` (or wherever `buildVoiceLayerPrompt` lives);
  - `researchModalFlags.js`;
  - the ratchet baseline;
  - `flagPinGuard.test.js` (the note only).

  Anything beyond these is a STOP-and-report.

## 6. Tests

New tests only. With the mode off, every existing test passes untouched, including the voice-layer goldens. Add rows for:

- **Flag:**
  - off, allowlist, on, unknown → off;
  - allowlist is off without a verdict;
  - the builder is never called when off;
  - a byte-identical render of the modal and the Battle View with the mode off;
  - a byte-identical prompt and exchange for a non-research chat turn.
- **Layer 0:**
  - each BC-3 branch;
  - each BC-15 stance;
  - BC-13's standing order;
  - the fold at 390×844 and 430×932, measured in a headless browser.
- **Packs:**
  - all three questions for all six archetypes on one fixture (snapshot);
  - §3.3's three acceptance rows;
  - omission of empty items;
  - BC-5 (no stop price anywhere);
  - BC-6, including Capital Preserver;
  - BC-10's token rule (two-letter tickers never match by text);
  - BC-11.
- **Ask:**
  - closed `questionId`, the item caps and kinds;
  - verified versus unverified;
  - the injection-guard wrap;
  - one budget charge;
  - the exchange id minted once across a retried transaction;
  - the response carries the id;
  - the chip lights only when the battle shows the id;
  - a filed directive is shown;
  - the budget-out state;
  - a failed turn says it wasn't charged only when it wasn't.
- **Pins:**
  - `createSeriesMarkers` called, re-applied after a rebuild;
  - marker times on bar times;
  - one open label;
  - 1W price pins only;
  - the Idea pill on and off, and absent without `equippedHypothesis`.
- **Mounts:** with the mode on, each in-battle mount gets the sheet; every other mount is unchanged.

**Mutation:** for every item above, revert the fix, show its test fails, and restore the file byte for byte (SHA-256).

## 7. Checks and review

- **The full suite, Linux and CI-shaped:**
  - WSL, Node 20, `TZ=UTC`, `flock /tmp/pd-suite.lock`, 8 workers;
  - on the branch merged with current `main`;
  - assert the exit code and read the `Test Files` line; never pipe through `tail`.
- **Also green:**
  - `npm run test:rules`;
  - `npm run lint:gate`;
  - `vite build`.
- **The review:** this build crosses the §2 threshold, so run four lenses, each with its own refuter on a fresh snapshot, as Build A did:
  - **(A) honesty:** sources, templates, verified versus unverified, BC-3 and BC-5;
  - **(B) wiring and the server path:** the flag-off identity, the budget, the exchange id, goldens and injection;
  - **(C) test integrity;**
  - **(D) mobile, the fold, pins and motion.**

  Fix every confirmed in-scope finding. Report the rest.

## 8. The smoke branch (never merged)

Push `claude/research-modal-sheet-smoke` from the PR head with three additions that exist only there:
- the mode forced `'on'`;
- `?sheetFixture=held_tf | held_cp | held_legacy | bench_incumbent | unexamined | budget_out` feeding committed JSON fixtures shaped from real battle documents (no production reads);
- the Ask answered by a canned client-side reply marked *SMOKE ONLY*, with no model call.

Put its Vercel preview URL at the top of the report. The founder opens the six fixtures on his phone, including Trend Follower and Capital Preserver on the same stock.

## 9. The report and the PR

Lead the report with a verdict table for the founder, who is non-technical. One row per area:
- the flag;
- Layer 0 and the fold;
- the latest sentence;
- the packs and their order;
- the Ask and its budget;
- pins and the Idea layer;
- the cockpit door and the incumbent;
- the mounts.

Its columns are *Status · What the player sees · What they saw before*.

Then include:
- the cut-from HEAD;
- the §0.4 results;
- the six-archetype pack snapshot as a table;
- the fold measurements;
- the mount table;
- the request-count table (no new price request);
- the mutation results;
- the review record;
- the `Test Files` line and exit codes;
- the smoke URL;
- found on the way.

Open a draft PR titled `feat(research-modal): Build C — the sheet in battle (packs, Ask, pins), dark`. Its body is the verdict table. **STOP.** The allowlist flip is a separate one-line PR after merge.

---

## Rulings and corrections — 2026-11-08 (founder, on the Build C report §12)

The prompt above stays as it was given. These rulings, made on the build report (PR #1036), override it where they differ.

1. **FQ-1 — BC-3 step 1.** Step 1 searches the latest check that LOOKED at the name (its evidence or its candidates) and quotes that check's first sentence naming it, attributed to that check's time. (Built reading: a check whose model call failed or was budget-skipped is not a check that looked — the A2 reading carried over.)
2. **FQ-2 — BC-15.** A name not held now that a check examined reads *Looked at {time} · not held now*, never *Not examined in this game*.
3. **FQ-3 — 💣 with the sheet on.** As built: the 💣 view keeps the modal's full chart height and the drawer moves down.
4. **FQ-4 — the Ask.** As built: no second Ask of the same question on one opening.
5. **FQ-5 — exit flags.** A `potential_exit` flag is quoted as *What it flagged · exit · {time}*, in its own words — never as a bench flag.
6. **FQ-6 — the visible viewport.** In sheet mode only, the phone modal is sized from the visible viewport (`100dvh`, falling back to `100vh`), so the action row is never under Safari's toolbar. The chart keeps its sizes; Layer 0 may scroll where the visible viewport is shorter than the named sizes. A fold row at 390×664 asserts the whole action row sits inside the visible viewport. Mode off unchanged.
7. **FQ-7 — axis tags.** Accepted as built: only the open line shows its price tag on the axis.
8. **FQ-8 — §5's file list.** In scope. Data lines a repo guard demands — census, carriage, ratchet — are the same class as the ratchet baseline §5 lists: adding one for a new reader, in the same commit, is not a STOP.
9. **FQ-9 — where the modal opens.** §5 decision 1 (the mounts open on the sheet) is accepted, with one exception: with Bomb mode also on, a measured held stock that is inside the red-zone band when the modal opens (the market open; Build A's red-zone machine; ≤ 0.5 %) opens on 💣 in the red zone instead of the sheet. Decided once at open, from the price the screen already holds; with no price yet, the sheet. Never switched after open.
