# Stock Research Modal — Redesign Concept V1.1

**Date:** October 17, 2026 · **Supersedes:** V1 (Oct 15). V1.1 adds R-11 (Bomb mode: the bomb chart, the red zone and the Bomb sheet as one instrument), folds R-7 into it, extends the Claude Design round to seven screens, and records that the honesty/wiring fixes are merged.
**Status:** concept, for founder rulings → one Claude Design round → direction V2 → read-only Phase 0 → spec
**Scope:** the stock research modal (`AssetResearchModal`): the Analysis, Technical and Bomb tabs, the two bomb charts (the 💣 two-week view and the 1-minute spectate view), a new action row, and the chart layer. Ranks, Smart Money and Sector are untouched in V1.
**Precondition (met):** the honesty and wiring fixes are on `main` — PR #971 (F1–F9), #973 (F3 + D-1–D-4), #976 (W-1–W-5). Nothing below depends on a flag.

## 0. The idea in one paragraph

The fantasy-football player card works because the human is the GM: the stats exist so *you* can start, sit or trade. In FantasyTrades the agent is the trader and the player is the partner. A generic research modal — company blurb, RSI gauge, an analyst "Buy" — is what every brokerage already ships, which is why today's modal reads as competent and not special. The one thing only this app can do is make the modal **the place where the player's read meets the agent's read on one stock, and where that meeting ends in a verb** — Ask, Direct, Draw the Line. And the one moment only this game has is **the red zone**: a stock within reach of banking points, watched tick by tick. Every tab below follows from the first; R-11 is built around the second.

## 1. Founder rulings (approve-by-default; say "approved" or amend by number)

| # | Ruling | What it changes for the player |
|---|---|---|
| R-1 | **Two modes, decided by where the modal was opened.** *In-battle* (opened from the Battle View, cockpit, bench, tape, holdings or any surface tied to an active game) → "our lens": the equipped agent. *Browse* (opened from search, Discover, watchlist, FantasyTimes, or anywhere with no active game context) → "six lenses": every archetype. When a battle is live, a one-tap chip switches a Browse modal to our-lens for that battle. | Tapping a stock mid-game shows what *your* agent thinks; tapping from search shows how six different traders would see it. |
| R-2 | **The agent's read is assembled from records, never generated on open.** Held or bench name → built from the eval receipts, tape beats and Why? the agent already wrote. Name it hasn't examined → the honest line "Shadow hasn't looked at this one" plus an Ask. The only thing that produces new agent text is the Ask, which goes through the cockpit's answer loop. | No surprise API cost, and the modal can never claim the agent "thinks" something it never thought. |
| R-3 | **Six lenses are verdicts first, voice second.** Each archetype's verdict (fits / passes / watching, with its reasons) comes from that archetype's real rules and signals — rank view, cautious register, charter constraints, risk rules — computed deterministically. One small model call narrates all six in voice, cached per stock per trading day, computed on first open. Labeled "archetype reads," never "your agent." | Six genuinely different takes when the archetypes genuinely differ — and a visible diagnostic when they don't (§4). |
| R-4 | **An action row ends every modal.** In-battle: **Ask** · **Direct** (pick this / bench this) · **Draw the Line**. Browse: **Watchlist** · **My read**. Every action travels existing paths — directives through the gate, the line through the exit dials when they ship. Nothing in the modal places a trade. | The modal stops ending in reading. |
| R-5 | **In battle, the chart is the agent's record.** Drawn on the chart: entry, bomb thresholds (already), stop/target when the dials exist, the levels it actually uses, and the tape beats as markers (where it checked, what it decided). Only what a record proves; no "the agent held off" until that outcome is provable (Amendment B's standing condition). | A chart that shows the game, not just the price. |
| R-6 | **The Technical tab reads the chart from computed facts, then narrates.** A three-row read stack — Weekly trend · Daily setup · Intraday trigger (intraday only for names with intraday snapshots, i.e. held/bench; otherwise the row says so) — plus named setups matched from the facts. The agent's narration is written from those facts and shown with them. No image-based chart reading as a source of truth. | "What is this chart saying" in the player's own multi-timeframe language, honestly. |
| R-7 | *Folded into R-11.* | — |
| R-8 | **Mobile first.** The modal stays a bottom sheet on mobile; desktop is the second layout, not the first. | Matches the rule that killed the cockpit layouts that didn't work on mobile. |
| R-9 | **Wall Street consensus stays as a chip, not a verdict.** The `Wall St: Buy · 24 analysts` chip remains in both modes, under the agent's read in battle. | Analysts are context, the agent is the voice. |
| R-10 | **Canned company questions are replaced by game questions; the company blurb stays, collapsed.** The five "What does this company do?" cards go. In battle, three Ask presets anchored to the playbook situations: *Does this help us catch up?* · *Does this protect the lead?* · *Is this better than what's stalled?* | The questions a player actually has mid-game. |
| R-11 | **Bomb mode: the bomb chart, the red zone and the Bomb sheet are one instrument, built on the ladder.** (a) The two-week bomb chart is redrawn as a game instrument, not a candlestick chart with lines on it — Claude Design draws two options (§2.5: the Fuse and the Bricks); (b) the red zone is an automatic mode that switches on within 1% of the next rung (band to be measured in Phase 0): the rung as the goal line, a pulse trace instead of candles, the distance as the biggest number on screen, a next-check clock, the live-vs-scored price labeled, a banked moment, and an honest closed-market state; (c) the threshold table becomes the ladder, shared by all three; (d) history and "live" are always drawn as two different things — the live price is a bead, a half-built brick or a trace, never a synthesized candle. | Scoring a BaggerBomb looks and feels like scoring, and the chart can never show a bar that didn't trade. |

## 2. The tabs, by mode

### Analysis — in-battle (our lens)

1. **Stance header.** One of: *Holding since {date} · entry ${x}* / *On the bench* / *In our universe, not examined* / *Not in our universe*. From the battle record.
2. **The read.** The agent's latest Why? line for this name and the last two tape beats that mention it. Verbatim from records, with timestamps. If the cockpit's call records exist for this battle, its open calls on this name render here as tiles (same vocabulary as the cockpit).
3. **Watching for.** The levels and triggers the agent's own machinery uses for this name (its stop, its target, the signals it was shown at the last check). Rendered from the check's receipt; if a signal was not shown to the agent, it is not listed as something the agent watches.
4. **Wire.** FantasyTimes stories on this ticker, newest first — the same stories the agent reads.
5. **Context chips.** `Wall St: …` (R-9), sector/industry, company blurb collapsed behind "About".
6. **Ask presets (R-10)** → cockpit answer loop.
7. **Action row:** Ask · Direct · Draw the Line.

### Analysis — browse (six lenses)

1. **Six-lens card.** Six rows, one per archetype: verdict chip (Fits / Passes / Watching) + one line in voice + a "why" disclosure listing the deterministic reasons. Header: "Archetype reads · as of {date}". If the player has an equipped archetype, its row is pinned first and marked.
2. **Rank snapshot.** Fundamental and technical sector ranks (from what the Ranks tab already computes), one line, tap → Ranks tab.
3. **Wire.** As above.
4. **Context chips** and collapsed blurb, as above.
5. **My read.** A one-line thesis the player writes about this stock (optional direction + horizon chips). Stored on the agent's record with user provenance so the agent sees it the next time it weighs the name. Not scored in V1 (§5).
6. **Action row:** Watchlist · My read.

### Technical — both modes

1. **Read stack.** Weekly trend · Daily setup · Intraday trigger. Each row: a verdict word, the two or three facts behind it, and a tap that highlights the supporting level or bar on the chart. Intraday row for held/bench names only; for others it reads "No intraday data for this name."
2. **Named setup.** When the facts match a defined setup ("2-week base breakout · RVOL 2.4× · RSI 73"), name it. Setups are a short defined list in V1 (to be authored; the Feb 2026 pattern detector and confluence scorer are reusable starting points — they still exist in the repo, unmounted).
3. **The facts.** RSI, MACD, 20/50/200-day MAs, volume vs 30-day average, 52-week range — as shipped after F1–F9 and the follow-ups.
4. **Levels.** Top two support, top two resistance, tap → drawn on the chart (already works).
5. **Narration.** Two or three sentences written from the facts above, in the equipped agent's voice in battle and in a neutral voice in browse. The facts are the receipt; the narration cites them.
6. **In battle: Draw the Line** — drag a target or stop onto the chart; the handle shows the % and the bomb rung it corresponds to; confirm files it through the dials path. Not available until the exit dials build lands; until then the button reads "Dials coming" and is disabled, never hidden-and-faked.

### Bomb mode — both modes (R-11)

Bomb mode is what the modal becomes when the 💣 pill is on. It has three parts that share one spine, the ladder: entry → rung 1 → rung 2 → rung 3, each rung carrying its % and points, banked rungs lit, the next rung carrying "+X% to go".

**2.4 The sheet.** Entry price and time, points banked so far, the next rung and its distance, and one line of "what has to happen" (e.g. "needs $160.33 — above the $160 resistance"). Record-derived. The threshold table is retired; the ladder carries its numbers.

**2.5 The bomb chart (two weeks).** The game dynamic is a climb from entry through three rungs with points banked on touch, so the chart should look like a climb. Three directions; Claude Design draws the first two:

- **The Fuse.** A vertical rail — floor to summit — with the three rungs on it and the entry at the base; the live price is a bead on the rail that glows brighter as it nears a rung. Beside the rail, a thin ghost sparkline of the two-week path so the shape of the drive isn't lost, and the 15-minute checks as faint ticks on it. Timeless by design: it answers "where are we on the climb," not "when did we move." Same family as the cockpit's fuse rail; fits a phone upright.
- **Bricks.** The candles are replaced by bricks of a fixed size (a fraction of a percent of the entry price, chosen so a rung is a whole number of bricks away). The chart advances only when price completes a brick, so the climb looks like stacking toward the rung, and the distance is countable: *4 bricks to Bagger*. The live price is a half-built brick, not a candle — which solves the synthesized-candle problem by construction. Still reads left to right, still a recognized chart type (Renko), looks nothing like a brokerage chart.
- **The Drive (field).** The football metaphor made literal: the field runs left to right, yardage is % from entry, each scoring check is a play mark, the red zone is tinted near the next rung. Not drawn by default: the cockpit board already owns the field-style "you vs. opponent" overview, and a second field would compete with it. The founder may ask for it instead of one of the two above.

**2.6 The red zone (the 1-minute view).** A mode, not a chart style — entering it should feel like the broadcast cutting to a different camera.

- **Entry.** Switches on automatically when the live price is within the red-zone band of the next unbanked rung (1% for the design; Phase 0 measures the typical 15-minute move per stock and proposes a measured band). Leaving the band switches it off after a short hold so it doesn't flicker.
- **The goal line.** The next rung is drawn as the top edge of the view — thick, carrying its points — with the price trace approaching it from below. The view's floor is the greater of (price − 1%) and the last banked rung.
- **The trace.** The 1-minute bars and the live ticks become one pulse line with the latest tick glowing; no candles. Closed bars are history, the live tick is live, and they are drawn differently.
- **Down and distance.** The biggest number on screen: *$0.06 to +15* (and the % under it). The existing pill's content, promoted.
- **The next-check clock.** Points bank at the scoring check, not at every tick (to be confirmed in Phase 0 — see §6). So the red zone has a built-in deadline: *next check 4:12*. The tension is whether the price is above the line when the check lands. If Phase 0 finds scoring is continuous, the clock is removed and nothing else changes.
- **Two clocks, labeled.** The live price (what the trace shows) and the scored price (what the check reads) are both named when they differ, so the player is never told a rung was touched when the scoring price never got there (the Price Authority spec's PA-0 question, carried here as a display rule).
- **The banked moment.** When a rung banks: the rung lights, *+15 banked* takes the screen for a beat, the ladder updates, and the next rung becomes the goal line. The game's touchdown graphic — the one place motion is allowed to be loud.
- **Honest states.** *SPECTATING* (not your position) and *your position* chips as today. Outside market hours: *Market closed · last tick 3:59 PM* with the trace frozen — never a synthesized bar stamped with today's date.
- **Later (not V1 build):** a mobile haptic pulse as the price nears the line; a cockpit tile — *EOG in the red zone · $0.06 to +15* — that opens the modal straight into the red zone (the broadcast cutting to the goal line). The tile belongs to the cockpit arc.

## 3. The chart layer

| Element | Source | When |
|---|---|---|
| Bomb ladder (rungs, banked state, "to go") | `dailyLevels` thresholds (measured v2 where present), battle record's banked points | Bomb mode, both views |
| Bomb chart body (Fuse bead / Bricks) | 30-minute bars (two trading weeks) + the live price | 💣 view |
| Red-zone trace | 1-minute bars (last hour) + live ticks | red zone |
| Next-check clock | the evaluation cron's schedule and the trading calendar | red zone (if scoring is check-sampled) |
| Entry line | battle record | in battle |
| Stop / target lines | exit dials (when shipped) | in battle |
| Agent's levels | the check receipt's shown signals | in battle |
| Tape-beat / check markers | tape beats and evaluation entries for this name | in battle |
| Tapped level | Technical tab | both |
| Read-stack highlight | Technical tab row tap | both |

The chart library already draws price lines, dashed S/R lines, a tapped-level line and trendlines; markers are a supported primitive. The Fuse is plain React/SVG; Bricks are computed from the 30-minute bars and drawn with the existing library or a small canvas; the red-zone trace is a line/area series. No new charting dependency and no new price request.

**Finding carried into Build A (Oct 17 screenshots):** the live-candle synthesizer draws today's whole move as one bar at the end of an intraday series — on the 💣 view a Thursday-to-live bar after the 30-minute data stops at Thursday, and on the 1-minute view a bar from the previous close ($152.62) to the live price stamped *Sat 10/17*, a day the market was closed. R-11(d) retires that rendering; until Build A, it is a known display defect.

## 4. The six-lens cost model (and the diagnostic it hides)

- **Verdicts are free.** Each archetype's verdict is computed from inputs the platform already has for every stock in the universe: the weekly ranks, the signals the ranking cron computes, and each archetype's constraints and cautious register. Phase 0 must confirm a per-stock verdict can be computed from those rules *without* editing any fenced file (reading fenced config is permitted; editing is not). If it cannot, the six-lens card waits for the archetype root refinement and browse mode ships with the rank snapshot only — no placeholder verdicts.
- **Voice is one call.** One Haiku call writes all six one-liners from the verdicts' reasons; cached in Firestore per stock per trading day; computed on first open only. At beta scale that is tens of calls a day, not thousands, because most of the universe is never opened on a given day.
- **The diagnostic.** If the six verdicts agree on most stocks, the card will show it — the Oct 13 concern made visible. Phase 0 runs the verdict function across the universe once and reports the agreement rate before any voice work is built. That number decides whether the six-lens card ships in V1 or after the root refinement.

## 5. Not in V1

- Scoring the player's "my read" against the agent's (a Practice Field idea; the read is stored now so it can be scored later).
- "Track this pattern" / pattern alerts.
- Reading a chart image with a vision model.
- Draw the Line before the exit dials ship (button present, disabled, labeled).
- Haptics and sound in the red zone; the red-zone cockpit tile (cockpit arc).
- Any change to Ranks, Smart Money or Sector.
- Cash-mode or League-specific variants.

## 6. Sequence

1. Honesty, F3 and wiring fixes — merged (#971, #973, #976).
2. This concept → founder rulings R-1–R-11.
3. One Claude Design round (§7) → founder read → direction V2 (structure, behavior and vocabulary from the mockup; skin from existing tokens, per the cockpit rule).
4. Read-only Phase 0: the modal's entry points and their game context; what the battle record, receipts and tape expose per symbol; **the scoring cadence — whether a rung banks only at the scoring check, the check schedule, and which price the check reads** (decides the next-check clock and the two-clock label); the 💣 and 1-minute data sources, their lag, and the live-candle synthesizer; the typical 15-minute move per stock (the red-zone band); whether a per-stock archetype verdict is computable without fence contact, and the universe agreement rate (§4); what the Feb 2026 pattern/confluence services still compute correctly.
5. Spec V1, then builds in this order, each dark behind one flag — **Build A** Bomb mode (fence-free, record-derived, the launch-visible excitement; retires the synthesized candle); **Build B** Technical read stack + chart layer; **Build C** in-battle Analysis from records + action row; **Build D** six-lens browse + my read (gated on §4). Order is the founder's call; this is the default.

## 7. Paste-ready Claude Design prompt

**Attach:** the five current-modal screenshots (MPC: Bomb tab with the daily chart, Analysis tab, Technical tab; EOG: the 💣 two-week chart, the 1-minute red-zone/spectate view), this document, and `docs/design/COCKPIT_V4_MOCKUP.html` (for the in-battle vocabulary — tiles, verbs, chips, the fuse rail).

---

You are redesigning the stock research modal for FantasyTrades, a stock-trading game in which an AI agent trades a virtual portfolio and the player coaches it. Read the attached concept (`RESEARCH_MODAL_REDESIGN_CONCEPT_V1_1_OCT17_2026.md`) fully before drawing; it defines the two modes, every tab's content, Bomb mode, and the rules below.

**What stays.** The five screenshots are the shipped modal. Its shell — the header with price and the Why? button, the timeframe pills (1D · 1W · 💣), the drag handle, the tab strip — and its visual skin (near-black background, the teal/green/amber/red accent set, monospace numerics, the card and pill styles) are fixed. Use them as the design system. Do not introduce new hex colors; derive any new state accent from the colors already on screen. The 1D and 1W candlestick charts stay as they are.

**What you redesign.** (1) The content of three tabs — Analysis, Technical, Bomb — and a new action row at the bottom of the sheet; (2) the two bomb charts — the 💣 two-week view and the 1-minute red-zone view — which should stop looking like brokerage charts and start looking like the scoring instrument of a game. Structure, hierarchy, behavior and wording are yours; the content inventory is not negotiable. The attached cockpit mockup shows the vocabulary the in-battle mode must share: tiles, the four verbs (Why? · Show It · Direct · Draw the Line), the chip language, the fuse rail. The modal should feel like a sheet of the same instrument, not a different app.

**Hard rules.**
- Mobile first: every screen as a bottom sheet at phone width, with the chart above it; one desktop variant for screens 1, 3, 4 and 6 only.
- Honesty: never show the agent claiming something the record cannot prove. "You said hold off" is fine; "the agent held off" is not. When the agent has not examined a stock, say so plainly and offer an Ask. History and the live price are always drawn as two different things — never a synthesized candle. Points bank at the scoring check (the concept's working assumption); the design must not imply that a touch between checks scores.
- Less text, more structure: the first cockpit round was rejected for throwing too much at the player. Every element earns its place; verdict words and chips before sentences.
- Actions feel like pressing buttons and getting results — the action row is the most important element on the sheet.
- The red zone is a mode, not a chart style: entering it should feel like the broadcast cutting to a different camera — same skin, one derived accent, more motion. The mockup is static, so describe the motion in the caption (what pulses, what lights, what the banked moment does).

**Deliver seven screens, in this order:**
1. In-battle Analysis — a held name (stance header, the read from records, watching-for, wire, chips, Ask presets, action row).
2. In-battle Analysis — a name the agent has not examined (the honest empty state + Ask).
3. Browse Analysis — the six-lens card with one row expanded, rank snapshot, wire, my read, action row.
4. Technical — the three-row read stack with one row tapped and its level highlighted on the chart, the named setup, the facts, and the Draw the Line control in its disabled "Dials coming" state.
5. The bomb chart — two options side by side at phone width, each with the ladder as its spine, one rung banked, the live price as a bead or half-built brick, "to next" readout, and the slimmed Bomb sheet beneath: **(a) the Fuse** and **(b) Bricks**, exactly as concept §2.5 describes them.
6. The red zone — three states: **(a) approaching** (within 1% of a rung: the rung as the goal line at the top of the view, the pulse trace, the distance as the biggest number, the next-check clock, the live-vs-scored chip, the SPECTATING or your-position chip); **(b) the banked moment** (the rung lit, "+15 banked", the ladder updated, the next rung now the goal line); **(c) market closed** (trace frozen, "Market closed · last tick 3:59 PM").
7. One free exploration: the chart and the agent's read as a single surface — what the "immersive" version of this modal could be if the sheet and the chart were not two things. No constraints beyond the skin and honesty rules.

For each screen, a one-line caption naming the state it shows. Do not write copy for the agent's voice beyond short placeholders; the voice is produced by the system, not the design.

---

## 8. Open questions for the founder (not blocking the Claude Design round)

- Q-1 In Browse mode with no equipped archetype at all (new user), do we show all six lenses or push archetype selection first? *Default: all six, with "equip one" as the row action.*
- Q-2 Should "my read" be visible in battle too (so the agent's read and the player's read sit side by side), or browse-only in V1 as written? *Default: browse-only in V1.*
- Q-3 Named setups: author the V1 list from your own multi-timeframe method, or start from the Feb 2026 pattern detector's list and prune? *Default: your method authors the list (five to eight setups); the detector is implementation.*
- Q-4 The red-zone band: 1% of the next rung for the design, replaced by a measured band (the stock's typical 15-minute move) after Phase 0? *Default: yes.*
