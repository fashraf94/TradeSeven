# The Cockpit — Design Brief V1

**Date:** 2026-09-22 · **Author:** Fable · **For:** the discovery pass, Claude Design, and Astra's review · **Status:** frame recommended; three rulings requested of the founder in §5.
**What this is:** the document that says what the cockpit is for and what it must never do, so that discovery can look for the right things and Claude Design can draw the right screens. It is not a spec. Nothing here names a file.

---

## 1. What the cockpit is

The Command Center section of the BaggerBomb Battle View becomes **the cockpit: the place where the player coaches the agent during a live game, and the game keeps score of the coaching.**

Every action a player takes there is two things at once — a move in this game, and a rep that shapes the agent from now on — and the cockpit shows the player that the rep landed.

This sits inside a reframe of the product the founder has already made in pieces: **BaggerBomb is where an agent earns its reps and its player learns to read what it does; League is where the two of them compete.** The cockpit is *how* you train, the Forge Record is *what* the training becomes, the Film Room is *where you check* whether it worked, and the Record travels with the agent to League. Say "training" sparingly in copy — it can read as "not the real game." Say "your agent's reps" and "your calls."

## 2. Who it is for

The average player: someone who has never heard of VWAP, who may open the app twice a day for two minutes, and who will decide in the first week whether this experience sticks. The expert layer already exists (the Why? panel, the tape); the cockpit's top layer is for the person who won't read it.

## 3. Three principles — binding on every component

**P1 — The game never waits for the player.** The agent checks every fifteen minutes; the player is usually elsewhere. The agent's own decision always stands. A player's answer, whenever it arrives, files as a directive that shapes the *next* check. An unanswered question becomes a review item, still a rep. (The failure mode is live in production: a pending gameplan meeting blocks a whole day's evaluation — bug G-2. The cockpit must never create a second one.)

**P2 — Nothing on the training surface is decorative.** A displayed "your agent now leans X" must be a thing that actually enters the decision path — a directive that was Heard at a check, a standing lean in the prompt, an equipped rule, a set dial — with its provenance. No XP, no badges for coaching, no "skills" that nothing decides on. The Forge Record discovery found suggestion writes nothing reads and disciplines nothing decides on; the cockpit inherits the founder's Film Room ruling that growth is never decorative.

**P3 — One glance for someone who doesn't know what VWAP is.** The top layer answers three questions with no numbers the player has to interpret: *What is my agent about to do? What can I tell it? What did my last call change?* Depth underneath — the same layered-depth rule the Film Room uses. Every intraday or technical fact shown carries the honesty labels the platform already uses (as-of time; "not seen by the agent" where that is true).

A fourth rule inherited from the whole arc: **the cockpit never says what the agent did not see.** Its cards are built from records the agent actually wrote, lint-checked where the platform already lint-checks them.

## 4. Components — as questions for discovery, with what each already has

Each component is stated as: what it shows · what the player can do · its states. That is the shape Claude Design needs.

**C1 — Decision board.** *Shows:* the agent's live called shots — the anticipation entries it already writes ("Eyeing HOOD on the bench. If it holds above …, I'll rotate it into Support") — as cards: symbol, direction, the condition in plain words, the agent's default. *Player can:* answer each with one of three — **Go if it triggers · Hold off · Ask me first** — each filing through the existing chip route as a directive against the archetype's menu. *States:* watching · triggered and acted (with what happened) · triggered and held off (player's call) · expired without triggering · dropped (only from a durable receipt, labeled "cited a signal the check didn't have"). *Has today:* the anticipation entries, the threshold lint (shadow-ready), the chip route, the Heard stamp. *Open:* whether "Ask me first" can be honored at the next check without violating P1 (it can — it converts the default to "hold and re-ask," never to "wait").

**C2 — Crossroads.** *Shows:* when the agent's candidates are genuinely close — "ZS, the steadier trend, or INTC, the breakout" — a card that names the fork the way the agent already does in chat. *Player can:* research each (the research surface with the agent's framing pre-loaded; Show It once grounding is on) and then pick, and the pick files as a directive. *States:* open · answered by the player · decided by the agent (player absent) with "agree for next time?" · expired. *Has today:* the elicitation targets the chat already pursues (risk appetite, concentration, sector convictions, loss reaction), suggested-action chips, the research modal. *This is Scouting Assignments V2 in a different coat, and it is the component that trains the player, not the agent — which matters because League scores the player's calls at 1.5× the agent's.*

**C3 — Protection strip.** *Shows:* per position, what is guarding it and what would fire — the armed state the capture build records (fired · evaluated and held · not evaluated · disarmed), and the risk numbers per mechanism when the capture build carries them. *Player can:* if the cockpit hosts controls (§5), set the two exit dials inside the archetype's permitted range. *States:* armed · disarmed (with the honest reason — today "no intraday feed" for the VWAP floor and trailing stop) · fired (with the receipt). *Has today:* the capture build (dark), the exit-dials arc's Tier 1 (`swap_type`, real `exitReason`), zero deployed guardrails in the platform's history — so this strip will be thin at first and must say so rather than fill space.

**C4 — The call log.** *Shows:* everything the player has told the agent this game, each as three things when they differ: **your words · filed as · heard at.** *Player can:* open the chat from any entry; nothing else — the log is a record. *States:* filed and heard · filed, not yet heard · not filed (fit mismatch: "the agent's reply didn't match the menu; no change made") · no change (research only). *Has today:* everything — this is the Film Room's directive card, live, on fields the platform already writes.

**C5 — Record glance.** *Shows:* what persists past this game — standing leans, equipped rules and dials, and "this game's calls → your Record" — one line each, provenance-backed, linking into the Forge Record. *Player can:* nothing here; it is the bridge. *States:* the honest empty state for a new agent ("nothing yet — your calls in this game start its record"). *Has today:* leans and rules are server-authoritative with provenance strings; the Record's user surface is the Forge Record stream's step 0, not built. **This component depends on that stream and may ship after the other four.**

**Chat** remains the door for anything freeform. No action in the cockpit requires it.

## 5. Rulings requested of the founder (approve-by-default unless you object)

**R-1 — Scope: controls, not projection only.** The cockpit hosts the exit dials (C3). The exit-dials chat asked; the answer is yes, with the archetype range as the rail. Consequence: the dials spec (exit bounds beside `cautiousRegister`) is sequenced into the cockpit's build.

**R-2 — "Ask me first" is honored as "hold and re-ask," never as "wait."** P1 applied to C1.

**R-3 — C5 ships last.** The four in-game components are the launch cockpit; the Record glance lands when the Forge Record's step 0 gives it something honest to show.

## 6. What the discovery pass must establish (read-only, one session)

1. The chip route end to end: what a tap files today, what the fit check adds at `'on'`, what a card would need to file a directive with a symbol and a condition attached.
2. Anticipation entries as a data source for C1: fields, lifetime, whether a "triggered" state is derivable from the next check's records, what the drop receipt carries.
3. The research modal and Show It: what can be pre-loaded, what grounding gates.
4. The capture build's armed-state record for C3 (writer, fields, flag).
5. The orphaned profit-target wiring the exit-dials census found — reusable or not.
6. The current Battle View's layout budget on mobile: what the top layer displaces.
7. Every place the Battle View writes to the battle document, so the cockpit adds readers and one flag-gated writer at most.

## 7. Claude Design — the package and the order

The founder will use Claude Design for the mockups. The package it needs is already mostly in the project:

- this brief (§1–§4 verbatim; the component blocks are written to be pasted one per prompt);
- the design system: `DESIGN_TOKENS.md`, `VISUAL_DESIGN_GUIDE.md`, `UI_PATTERNS.md`, and the gold-standard references (Snake Draft's `DraftBattleScreenV2`, the current Battle View's turn line, Why? panel and character pane) — so the cockpit looks like the game it lives in;
- the honesty vocabulary as fixed strings: the as-of line, "not seen by the agent," "no change made," "cited a signal the check didn't have," the four armed states;
- the empty and thin states named in §4 — the mockups must show those, not only the full-data ideal.

**Order:** the top layer first — one screen answering P3's three questions, mobile-first, before discovery finishes, because the founder decides by touching. Then, after discovery reports, the depth layers for C1–C4 on the states that actually exist. C5 waits. Each mockup returns here for a P1/P2/P3 check before it goes into the spec.

## 8. Gates on the build, stated once

The design does not wait. The build waits for: **grounding `'on'`** (the twenty-pair read — the single biggest gate, and it needs battles played with real chat), the **fit check flip** (so C1 and C4 file honestly), the **capture flip** (C3), and **held-position parity** (so cards about held names can show what they show for bench names). The intraday measurement clock does not gate the cockpit; player-facing diagnostics are available from the diagnostic flip.

## 9. Sequence

Brief (this) → founder rulings R-1–R-3 → discovery prompt (Opus, read-only) and top-layer mockups in Claude Design in parallel → spec V1 (Fable) citing discovery → Astra review → depth mockups → build prompt, gated per §8.
