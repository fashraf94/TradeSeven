# Research Modal Direction V2 — Amendment B (the Command Center's record in the modal)

**Date:** November 2, 2026 · **Amends:** `RESEARCH_MODAL_DESIGN_DIRECTION_V2_OCT17_2026.md` and `RESEARCH_MODAL_BUILD_PLAN_V1_OCT29_2026.md` · **Folds in:** the Command Center chat's cut `RESEARCH_MODAL_COMMAND_CENTER_CUT_NOV02_2026.md` (proposed R-19–R-21, the Phase 0 addendum K–N, the six capabilities and Build E), read against `COMMAND_CENTER_PURPOSE_V1_1_NOV02_2026.md`.
**Status:** rulings R-19–R-21 adopted as amended below (approve-by-default). Phase 0 prompt V2 (`PHASE0_PROMPT_RESEARCH_MODAL_V2_NOV02_2026.md`) supersedes the Oct 29 prompt and carries K–O.

## 1. The two modes, restated under Purpose V1.1

| | In battle | Browse |
|---|---|---|
| Opened from | the Battle View, cockpit (incl. "Who comes in?"), bench, tape, holdings | search, Discover, FantasyTimes, the hub's Research panel, a Film Room card |
| Partner | the equipped archetype (R-12) | none speaks; the loop's records show with provenance |
| Charts | 1D · 1W · 💣 (Bomb mode hangs off the entry price) | 1D · 1W only — the 💣 pill and the Bomb tab are absent |
| Door | → Cockpit | → Shared Research, once it exists; until then no door (never a dead button) |
| Action row (R-4′) | *Ask {Archetype}: {question} · 1 message* · → Cockpit | *Watchlist* · *Work this idea* (R-21); for an account outside the idea-record gate, *Watchlist* alone (§3) |

## 2. Rulings adopted (approve-by-default)

**R-19 · The loop's record is a record source, not a tab — adopted, with the News-row amendment.** Everything the Command Center writes about a stock lands where the design already has a place: the idea record in the stance line and on the chart (R-20); `symbolDayEvidence` as event pins and a row; a Huddle plan item naming the stock in *What you told it · from this morning's huddle*; `setupEvidence` in the Technical tab's Daily-setup row (R-17); `researchWork` behind the stance's *from research ›* and as the six-lens card's first source; `themeDayEvidence` as a Theme chip beside Sector (browse). No "Shadow" tab, no Shadow voice.
*Amendment B-1 (honesty).* **"What it read" is a claim about the agent's input and stays one.** In battle the News row keeps the items the trading brain was actually shown (its existing fenced input), labeled *What it read · from the check*. Reporters' typed items render as *What moved · reporters*, on the chart as pins and in their own row. The two merge into one line only when an item provably sat in the agent's input (same source story); otherwise they stay apart. In browse, where no agent read anything, the row is *What moved* alone.

**R-20 · The idea on the chart — adopted, as a layer.** When the stock sits in one of the player's ideas, the chart draws the version's conditions as two labeled lines (*live above $154 · wrong below $147*) and each daily close since the idea's first deploy as a dot on its side of the line; the stance reads the idea record's own review evidence, never a number the modal computed. One drawing on all three clocks (R-16).
*Amendment B-2 (clutter).* The idea drawing is an **Idea** pill beside SMA and S/R — on by default when the stock is in an idea, dots on the 1D view only, the label-collision rule (R-11′(d)) applies.
*Amendment B-3 (fold).* The stance shows the statement truncated to one line; the full statement, its state and *from research ›* open on tap. Layer 0 still fits the fold (R-13). In V1 the mark is *testing since {date}* plus the review's names-vs-market line; *held / didn't / can't tell* arrives when the Film Room stores it.

**R-21 · "My read" is the seed of an idea record — adopted.** A player's read on a stock is a draft idea: filed as a draft version (origin `manual`, state reason `player_authored`) through the existing route, direction and horizon chips mapping to `horizonEnum`. Browse's action row becomes *Watchlist · Work this idea*; until Shared Research exists, *Work this idea* files the draft and stops; after, it opens Shared Research with the stock preset. V2 §2.2's "stored on the agent's record with user provenance" is withdrawn — one record per idea.
*Open to Phase 0 (K):* which list the draft hangs on — a new one-stock list per read, a per-player scratch list, or the player's choice — and how the hub's Research panel groups them.

**R-22 (new) · The gate degrades by omission.** Idea records exist today only for the cockpit allowlist (`HYPOTHESIS_RECORDS_ENABLED` + `COCKPIT_ALLOWLIST_UIDS`; Purpose V1.1 §8, decision 3). For an account outside the gate, the idea stance, the Idea layer, *from research ›* and *Work this idea* are absent — not "Not in an idea yet", not a disabled control. The modal is one more consumer of that decision; it does not force it.

## 3. The six capabilities and Build E — adopted as the cut's §4 writes them

Each is a reader in the modal over a record another arc writes; none adds a model call or a store. (1) Event pins + the News/What-moved row → **Build E**; (2) setup history under the Daily-setup row → **Build B**; (3) the pack carries the idea's statement and today's plan item → **Build C**; (4) the idea replayed over stored bars → the Practice Field's drill clock; (5) the Theme chip → **Build E**; (6) research-first in the six-lens card → **Build D**. Build E is the only new build: two readers on surfaces C already built, gated on the reporters-to-evidence slice. The writer requirements the cut lists (item kinds and sources on `symbolDayEvidence`; a by-symbol index on `setupEvidence`; `researchWork` findable by symbol) are filed by the modal build that needs them, with Phase 0's N answer attached.

## 4. Build plan V1, amended

| Step | Change |
|---|---|
| 0 | Phase 0 runs with prompt **V2** (K–O added; §G, §I, §A updated). Still first; still needs no other arc. |
| A | unchanged |
| C | the record source now includes the idea record (R-19, R-20), the plan item and `symbolDayEvidence`; the pack gains its two loop items; the News row split per B-1 |
| B | R-17 plus setup history, once Phase 0's N says how the store is read by symbol |
| D | R-21 (My read → draft idea) and research-first; gated additionally on the idea-record gate widening or an allowlist-only V1 |
| **E** (new) | event pins, What-moved row, Theme chip; gate: reporters-to-evidence on `main` |
| after | the Shared Research feasibility review (CC chat) reads the Phase 0 report from `origin/claude/phase0-research-modal` — its kickoff V2 already says so; the §5 cut from the Oct 29 plan is no longer needed |

## 5. Standing

R-1–R-18 as amended stand. The design of record (three Claude Design files) stands; R-19–R-22 change what the chart and the stance carry, not their look, so no further design round. The Phase 0 report is the next document.
