# The Controller — Battle View design brief for BaggerBomb (V1.2)

**Date:** September 1, 2026
**Status:** Design brief V1.2, for Claude Design, Sol, and CC Phase 0. Not a build spec. **Supersedes V1 / V1.1.**
**Prepared by:** Fable, with Flash (founder). Design authority for this arc lives in the framework chat.
**Suggested commit location:** `docs/design/COMMAND_CENTER_CONTROLLER_DESIGN_BRIEF_V1_2.md`
**Companions:** `COMMAND_CENTER_COCKPIT_DESIGN_BRIEF_V1.md` (the Command Center) · `SCOUTING_ASSIGNMENTS_CONCEPT_V1_1.md` · `PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V1.md` · framework V1.2

**What changed in V1.2 (Sol pass one, disposed Sep 1 — Appendix B):** this page is the **new Battle View**, not the Command Center (placement ruling). "Four verbs" narrowed to four *primary* verbs with the exceptions named (§2.3). The turn is a *confirmed* check, not a clock time (§2.1, §4). Why? gets a source contract and an absence state (§5.1). Direct's receipts are specified in two tiers, floor and ceiling (§5.3). *This turn* gets a state model (§3). The `Shown` row mark is removed (§5.2). The first shipping phase is corrected: no inert Direct control beside the live chat (§8). Honesty rule 8 added (§6).

This brief is self-contained for a designer. Appendix A maps it to framework rulings; Appendix B records Sol's findings and their disposition.

---

## 1. What we are designing, in one paragraph

FantasyTrades is "DraftKings for stocks": no real money, AI agents manage virtual portfolios in timed battles. BaggerBomb is the first game and the easy entry point. The agent picks the portfolio and trades it; the magic is watching it play. The user never trades — the agent has full authority. The user's role is to **understand the agent's thinking (curiosity)** and to **influence it and see, truthfully, what happened to that influence (confidence)**.

**The agent is the character. The Battle View is the controller.** Four primary verbs, a visible turn, and — for every input — either a proven receipt or an honest silence. It should feel powerful and inviting, like a game. It must never claim more than the system can prove.

---

## 2. The three ideas the design must carry

### 2.1 The check is the turn — and a turn is a confirmed check
The agent evaluates the book roughly every 15 minutes during market hours. Design the game as turn-based: between checks the user queues moves; when a check completes, the queued moves resolve and receipts land. **A turn is the evaluation's own completion write, not a wall-clock moment.** The next check time is always approximate (`~1:02 PM`). If a check does not arrive when expected, nothing resolves and the interface says so; there is no theatrical landing on a schedule.

### 2.2 Actions live on pieces
The position is the unit of play. Every verb is performed on a piece (or on the whole book from the score header), and its result lands on that piece. The tape is the record, not the place where you act.

### 2.3 Four primary verbs
Two amplify curiosity, two amplify confidence. Every control on the page resolves to one of these, to the turn, or to the tape.

| Side | Verb | What the user does | What comes back | Cost |
|---|---|---|---|---|
| Curiosity | **Why?** | Taps a piece (or the score) | The engine's own text about that piece from the last confirmed check, plus scoring facts — or an honest absence state | **Free** (a pure read; §5.1) |
| Curiosity | **Show it** | Gives the character a ticker name, or a tweet / screenshot / note (Signal Drop) | Whatever the research path actually returns, as a card in the tape, with a *flag for next deploy* door | One message (name) · own pipeline (drop) |
| Confidence | **Direct** | Files one standing instruction in the character's vocabulary | Acknowledgment now; a proven receipt at a confirmed check, or nothing | One message |
| Confidence | **Draw the line** *(later arc — leave room, do not design)* | Sets a take-profit and stop on a piece | The piece travels toward a line the user drew | A "move" |

**Named exceptions (not verbs, not hidden):**
- **The follow-up field** at the bottom of the tape is free-form conversation with the character. It costs a message. It may carry a directive in the character's vocabulary; if it does, it goes through the same gate as Direct and gets the same receipts. This is the shipped chat, kept.
- **Flag for next deploy** is Show it's forward path: a write to the agent's next-deploy candidates. No budget. Its durable state and replacement behavior are a discovery item (item 20).
- **An assignment answer** (companion concept) is a Direct of the weakest kind, *preference*. It is not a fifth verb.

Deleted from the vocabulary: menus of pre-written questions, a generic "Debate" button, a floating chat door, "watch this" or "hold X" buttons.

---

## 3. The page (live battle)

One page per live battle. Regions, in order of weight:

1. **Score header** — the shipped Battle View header: agent name and score on the left, CPU on the right, the tug-of-war bar between them. Add the **turn line** beneath: `Checked 12:47 PM · next ~1:02 PM`. Late-check state: `Last check 12:47 PM · next was due ~1:02 PM`. The tilde is deliberate and never becomes a due time.
2. **The board** — the shipped Matchups rows, unchanged in anatomy: section headers (Star picks · 2× each / Core holds · 1.5× each / Support plays · 1× each); per row your name and % change on the left, the two scores and the multiplier badge in the middle, the CPU's name on the right, a gauge under each side, distance-to-tier footnotes (`5.7% to Bust`, `2.5% to Bagger`). **Each row is a piece.**
3. **This turn** — a thin strip above the board (pinned above the board on mobile). **State model, strict:** it holds only unresolved, check-bound items —
   - the current directive: `Filed 11:20 · for the ~1:02 check` → leaves the strip as **Acted** (a trade cites it), **Replaced** (a newer directive superseded it before a check), or **Expired** (battle close / expiry reached);
   - an open scouting assignment, until its due check (companion concept).
   Research artifacts, signal drops, and answered items never sit here. Presence in the strip is itself a claim: *something is outstanding for the next check.* Empty state: `Nothing queued · next check ~1:02 PM`.
4. **The tape** — the day as a log: confirmed checks, trades (engine text), receipts, the character's replies, the user's inputs, research cards. Newest at the bottom. The follow-up field at the very bottom with its cost shown before the tap. Collapsed runs of quiet checks read `N checks · no change`, where *no change* means no change in anything user-visible — positions, scores, tiers, locks, **and directive disposition**. A check that only replaced a directive's state is not "no change."

**Desktop (1280):** header full width; board center (~60%); tape as a right column (~40%). No left column during a live battle.
**Mobile (390):** header, *This turn*, the board as the page; the tape is a **non-modal sheet** resting at a one-line peek (turn line + follow-up field) that pulls to half and full. The board stays visible and tappable at peek. The spec must define focus order, keyboard and screen-reader behavior, and scroll ownership at each detent — "non-modal" is not a semantics.

**Not on the live page:** identity and career record (Agent Hub), Deploy (no-battle state), Read and Equip (reachable from a small header control, not visible), Game Tape as a tab (linked from the tape).

---

## 4. The turn — designing the check

- **Before:** the turn line counts toward the next check. A discrete progress mark is fine; a continuous "live" pulse is not. Pieces are still. Ambient life (the starfield) belongs to the background, never to the character.
- **The landing (≤ 700 ms):** fires on the evaluation's completion write, never on the clock. Rows update top to bottom in sequence; queued items with a *proven* disposition stamp their receipts and slide into the tape; the turn line ticks to the check's own timestamp. One orchestrated moment per confirmed check. Respect reduced motion.
- **If the pieces, receipts, and timestamp arrive as separate writes,** the landing waits for the check's completion marker and renders once — it never plays twice for one check, and never plays for a partial one. (Discovery item 3 establishes what that marker is.)
- **After:** still again. Stillness is the honesty.

---

## 5. The verbs, one by one

### 5.1 Why? — tap a piece
- **Trigger:** tap a row. On both shells the row expands in place; on desktop the tape also scrolls to that piece's entries.
- **Source contract (C1):** Why? is a **pure read** of text the decision path already wrote, rendered verbatim with its own timestamp. In order of provenance:
  1. the engine's motive for any trade on this piece today (engine text, per trade);
  2. the engine's per-position reasoning from the last confirmed check — **only if discovery finds a persisted, timestamped, position-addressable record** (discovery item 1);
  3. the check-level evaluation summary for the whole book (engine text);
  4. scoring facts: distance to next tier, lock status, held since, entry.
  Nothing is generated behind the tap. If no model output exists for this piece, Why? shows the **absence state**, which is a real state: `No trade on SLB today · last check 12:47 PM · no change` followed by the facts. The panel header always names the check: `At the 12:47 PM check`. Footer: `The engine's own words`.
- **Doors inside Why?:** `Ask a follow-up` (one message; the follow-up field, scoped to this piece) and `Direct` (§5.3). Nothing else.
- **Whole-book Why?:** tapping the score header opens the same panel for the book: the latest evaluation summary (engine text), then *This turn*, then the doors.
- **Cost:** free — *because* it is a pure read. The moment any model generation sits behind the tap, it is a follow-up and costs a message. (Founder ruling: Why? free.)

### 5.2 Show it — a name, or a thing you saw
- **A name:** the user types a ticker in the follow-up field or taps `Look into…` inside Why?. The result is a **research card** in the tape rendering *exactly what the existing research path returns* — no more. The three-beat copy (the lock, once, softly → evidence → *"If you like the case, I'll flag it for your next deploy"*) is the frame; the evidence rows are provisional until discovery items 18–19 establish the fields, latency, and cost. Cap 3 per battle; the ask costs one message; the research is free.
- **A thing you saw:** a tweet, screenshot, or note (Signal Drop, shipped). Mid-battle the card renders what that pipeline already produces — the thesis it read and related names — plus the next-deploy flag. The battle-page read path is engineering work (data request 8), not a design assumption.
- **No `Shown` mark on rows.** A row mark would read as "the character saw this," which nothing proves. The card in the tape is the whole record.
- **Rule:** evidence, never a trigger. The card never says what the character *will* do. The only forward path is next deploy.

### 5.3 Direct — file one standing instruction
- **Trigger:** `Direct` inside Why? (scoped to that piece) or from the score header (whole book).
- **The move list:** the character's vocabulary — a short list of what this archetype accepts (placeholder labels; the real list is the archetype's allowlist). An optional one-line note. **No free-form order here** — that is the point of the list. (Free-form lives in the follow-up field and goes through the same gate.)
- **Filing:** shows the current directive first (`Current: Protect the lead into the close — a new one replaces it`), then `File it · 1 message`. One slot; newest replaces oldest, visibly; the replaced one becomes **Replaced** in the tape.
- **Row marks:** a piece gets a `Directive` mark only when the directive deterministically names it (discovery item 4). If directives are book-level only, the mark sits on the score header and nowhere else. No inferred concern maps.
- **The three beats — two tiers.**
  1. *Lands now.* *This turn* shows `Filed 12:31 · for the ~1:02 check`. The composer collapses. This is a proven state (the write).
  2. *Acknowledged now.* The character may reply in voice — but the reply is **acknowledgment only**: `Got it.` It may not assert future consideration (`I'll weigh it at 1:02`) unless discovery item 2 proves every applicable check deterministically ingests the current directive. The *interface*, not the character, states the mechanics: `In front of the character at the next check, if still current.` → wording gated on the same proof.
  3. *Receipt at a confirmed check.*
     - **Floor (ships first):** `1:02 · Acted · trimmed TSLA ↳ from directive` when a trade cites the directive; **Replaced** when superseded; **Expired** at close. If none of these, the item simply stays `Filed`. Nothing else renders.
     - **Ceiling (gated on discovery item 2):** `1:02 · Heard · holding SLB — bust distance widened` / `1:02 · Declined — off-style for a Speculator`, only with an engine-produced per-directive acknowledgment and an engine motive.
     Design both tiers on the 3C frame, labelled *floor* and *ceiling*. The spec ships the floor first and says so in copy — never renders a ceiling state from inference.
- **Copy:** scoreboard language; the character *acted*, *held*, or *declined* — never *is about to*.

### 5.4 Draw the line — leave room only
A later arc puts the user's own take-profit and stop marks on the left gauge of a row. Do not design it. Keep the left gauge tall enough to carry two user marks later.

---

## 6. Honesty rules for the designer (non-negotiable)

1. The character acts at confirmed checks only. Never show it thinking, watching, or "about to" between checks.
2. Scoreboard language only. `2.5% to Bagger` is a fact; `close to trading` is a forecast — forbidden.
3. Everything the character says *about a trade* is the engine's own text, quoted. The voice model narrates the conversation, not the decision.
4. A queued move is a strong preference. Copy never promises execution. *Filed* is not *heard*; *heard* is not *will do*.
5. Receipts render only when proven. Floor by default; ceiling on evidence.
6. Nothing the interface computes is fed back to the character. Inputs are the user's words, moves, and drops.
7. Stillness is allowed. Empty *This turn* and the Why? absence state are truthful states, not failures.
8. **If the interface gives a human-readable verb to an internal event, the system needs evidence for exactly that verb.** (Sol.) Filed, Acted, Replaced, Expired, Checked are provable today; Heard, Holding, Declined, Seen, Shown are not.

---

## 7. What engineering must deliver, in order
1. **The Why? source contract** (discovery item 1) — Why? ships first, so this is first.
2. **The check completion marker** (item 3) — the turn depends on it.
3. **The per-directive receipt** (item 2 / framework item 8) — the ceiling for Direct. If NOT FOUND, the minimum non-fenced write is a founder ruling, not a workaround.
4. **A deterministic directive → piece concern map** (item 4), or book-level marks only.
5. Client-readable message budget (cost before the tap).
6. Signal Drop read path into the battle page (data request 8); research path fields, latency, cost (items 18–19); next-deploy candidates landing (item 20).

---

## 8. Deliverables (in this order)

| # | Screen / state | Shell | Notes |
|---|---|---|---|
| 1 | Live page, all four verbs live, nothing queued | Desktop + mobile (peek) | The resting state. Calm and inviting, not empty. |
| 2 | Why? open on a row — with content, and the absence state | Desktop + mobile | In-place expansion; the two doors. Both variants. |
| 3 | Direct, three frames: choosing → landed (`Filed · for the ~1:02 check`, row mark if deterministic) → receipt after a confirmed check, **floor and ceiling variants** | Desktop; mobile for frame 2 | The hero flow. Label the tiers. |
| 4 | Show it: a research card in the tape | Desktop | Frame only; evidence rows marked provisional. No row mark. |
| 5 | The check landing, and the late-check state | Either shell | Fires on the completion write. ≤ 700 ms, once per check. |
| 6 | Mobile sheet at half and full | Mobile | The tape as the replay; follow-up field with cost. |
| 7 | **First shipping phase:** Why? live, *This turn* live (showing the current directive from the existing chat, floor states), the tape live, the shipped follow-up field unchanged — **no Direct control on the page yet** | Desktop | The existing chat remains the directive path exactly as today, so nothing is shown as disabled that already works. The structured Direct control arrives as its own phase, live, with floor receipts. Same layout, so nothing re-cuts. |

Do not design: the no-battle state, pre-open / after-close phases (only the turn line changes: `First check at 9:30 AM ET`, `Market closed · next check Tue 9:30 AM ET`, `Battle complete`), Read and Equip panels, the lever arc, league games, the Agent Hub, the Command Center cockpit (own brief).

---

## 9. Quality bar and references
- **Feel:** a turn-based game resolving a turn (queue → confirmed check → receipts), not a live ticker. A sports app's live match page for the header + board relationship. Apple Maps' sheet for the mobile tape.
- **Restraint:** one bold element — the check landing. Everything else quiet. Before finishing each screen, remove one thing.
- **Copy:** plain verbs, sentence case, the character in first person, the interface in facts. No exclamation marks. Names, not system words.

---

## 10. Tokens, type, and fixtures

**Colors (existing, do not invent):** background `#0D0E12` · surface `#15171E` · raised `#1C1A27` · hairlines `rgba(255,255,255,.07)` / `.12` · ink `#F4F5F8` · ink-2 `#9A9DAB` · ink-3 `#5E6170` · teal (Battle View accent) `#5EEAD4` · gold `#F0C75E` · copper `#E8927C` · agent accent `#2E6FE8` · up `#3DDC97` · down `#FF4D5E`.
**Type:** Schibsted Grotesk for UI and prose; JetBrains Mono for numbers, symbols, timestamps, and tags.
**Existing components to keep as-is:** the Battle View score header and tug-of-war bar; the Matchups rows; the chat bubbles and slim trade notification line; the Game Tape view (linked, not redesigned).

**Fixture data (live battle, Sep 1):** header `1Agent +0` vs `CPU +1`. Star picks 2×: MU (+0.00%, 0) vs IBM (+0.00%, 0), `5.7% to Bust` / `2.5% to Bagger`; CRM (+0.00%, 0) vs CI (−0.00%, 0), `7.2% to Bust` / `2.5% to Bust`. Core holds 1.5×: NOW (+0.00%, 0) vs SLB (+0.19%, +3), `4.4% to Bust` / `2.3% to Bagger`; DVN (+0.00%, 0) vs MAR (−0.03%, 0), `3.9% to Bagger` / `2.5% to Bust`. Support plays 1×: NVDA (+0.00%, 0) vs ITW (+0.04%, 0).
**Voice fixture (real):** *"Agent's live. I've deployed MU and CRM in Star to capture the tech momentum, with DVN in Core as an energy hedge. With the NFP print coming Friday, I'm bracing for some macro volatility across the board. Are you leaning into the tech strength this week, or are you looking to play the macro data more defensively?"*
**Budget fixture:** `Messages: 0/10 battle · 0/5 review`.
**Engine-text fixture (a check-level summary — treat as book-level until item 1 says otherwise):** *"Held SLB through the 12:45 bar — bust-tier distance widened on the reversal, no confirmation on the second bullish trigger, so the position stays as sized."*

---

## 11. Questions the design should answer (do not wait on them)
1. Where does whole-book Why? / Direct live — on the score header itself, or as a first "Book" row above Star picks?
2. Mobile peek: turn line + follow-up field, or turn line + *This turn*? Pick one and show why.
3. What does a row look like when its directive is Replaced mid-turn — does the mark fade, or does the strip carry the whole story?

---

## Appendix A — Traceability for the framework chat

| This brief | Framework / ruling | Status |
|---|---|---|
| Agent has full authority; user influences only | §2 | Locked, honored |
| Four primary verbs + named exceptions | D-27 applied as a cap; §6 (follow-up = shipped chat) | Instantiates D-27; Sol #4 narrowed |
| Why? free as a pure read; absence state | §6.2 changed for the read; C1 | Founder ruling; source contract = discovery item 1 (Sol #5) |
| Turn = confirmed check; landing on the completion write | §5.2 cadence honesty; F-6 | Sol #6 |
| Direct two tiers; acknowledgment-only voice; interface states mechanics | §8.1 floor / §8.2 ceiling; item 8; D-18 | Sol #1, #2 |
| This turn = unresolved check-bound items; Replaced terminal state | D-34 definition; §8.1 SUPERSEDED | Sol #8 |
| `Shown` removed; research card provisional | §7.1; items 18–19; data request 8 | Sol #7 |
| First shipping phase without an inert Direct | D-28 narrowed: inert doors only for capabilities that do not yet exist anywhere | Sol #3 |
| N checks · no change includes directive disposition | D-24 collapse rule | Sol (other points) |
| Mobile sheet accessibility semantics | spec requirement | Sol (advisory) |
| Placement: Battle View = controller; Command Center = cockpit | D-2 stands; Aug 31 own-portfolio ruling stands; D-37 stands | Founder, Sep 1 |
| Draw the line | D-39 | Room left; not designed |

## Appendix B — Sol pass one (Sep 1), disposition

| # | Finding | Severity | Disposition | Where |
|---|---|---|---|---|
| 1 | Direct requires the receipt ceiling | BLOCKER | Sustained — two tiers; floor ships first; ceiling gated | §5.3, §7 |
| 2 | "Heard. I'll weigh it" unsupported | MAJOR | Sustained — acknowledgment only; interface states mechanics, gated | §5.3 |
| 3 | Inert Direct beside live chat | BLOCKER | Sustained — first phase has no Direct control; chat stays the path | §8 |
| 4 | "Four verbs, no more" false | MAJOR | Narrowed — four primary verbs; exceptions named; flag is Show it's path | §2.3 |
| 5 | Why? source contract missing | BLOCKER | Sustained — contract + absence state; discovery item 1 first | §5.1, §7 |
| 6 | Turn = confirmed evaluation | MAJOR | Sustained — completion write; late-check copy | §2.1, §3, §4 |
| 7 | Show it outruns pipeline; Shown | MAJOR | Sustained — provisional card; Shown removed | §5.2 |
| 8 | This turn state model | MAJOR | Sustained — strict membership; Replaced | §3 |
| 9–11 | Split: freshness, gate, own-only | MAJOR | Sustained (11 narrowed: match totals are the scoreboard — founder to confirm) | Cockpit brief |
| 12 | Assignment trigger unproved | BLOCKER | Sustained — Phase 0 hard stop | Assignments V1.1 |
| 13 | Budget / force / copy / "your calls" | MAJOR | Sustained — answers are structured writes; preference weakest; Sol's copy; ahead-side deleted; "your calls" removed | Assignments V1.1 |

*Prepared September 1, 2026. Nothing here is a build instruction.*
