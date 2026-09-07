# The Character Pane — Battle View design brief, Phase A3 (V1)

**Date:** September 3, 2026
**Status:** Design brief V1, for Claude Design. Not a build spec. Design first; the build seed follows the mock.
**Prepared by:** Fable, with Flash (founder). Founder rulings Sep 3: the bench lives in the pane; the bottom strip and the three-detent sheet are retired; the pane's sections at launch are Chat · Bench · Tape.
**Suggested commit location:** `docs/design/BATTLE_VIEW_CHARACTER_PANE_DESIGN_BRIEF_V1.md`
**Builds on:** `COMMAND_CENTER_CONTROLLER_DESIGN_BRIEF_V1_2.md` (the four verbs, the turn, the tape — all unchanged). Everything shipped in Phases A and A2 stays except the two containers this brief replaces.

This brief is self-contained for a designer. Appendix A maps it to the ledger.

---

## 1. What we are designing, in one paragraph

The Battle View has a board (your positions against the CPU's, each row a piece) and a conversation with your agent. The conversation has been living in the wrong containers: a strip at the bottom that reads as a footer, a sheet you pull up that reads as a drawer. Neither looks like the agent. **This brief makes the character the controller.** The agent's avatar floats on the board; it *speaks* when something real happens, it *opens* the agent's pane (Chat · Bench · Tape), and it's where a tapped piece sends you. On desktop the pane is the right half and the avatar is its controller; on a phone the pane opens over the board and closes back to it. Two states, not three detents. A footer becomes a character.

---

## 2. The three ideas the design must carry

### 2.1 The character is present, not docked
The avatar (the agent's existing robot mark, teal eyes) floats bottom-right on the board on both shells — the one persistent thing that isn't a row. Minimum 48 px hit target; sits above the board's scroll; never covers a row's tap targets at rest (the board reserves the space).

### 2.2 The character speaks only when something happened
When the tape gains an entry, a **speech bubble** appears beside the avatar: the entry's kind as an eyebrow (`Status check · 3:45 PM`, `Bench note`, `Trade note`, `Reply`, `Directive`) and its first line, one line, truncated; an **unread count** sits on the avatar. The bubble fades in once on arrival and then sits still. Nothing between entries: no pulse, no breathing, no "typing." If there is nothing new, the avatar stands alone. Tapping the bubble or the avatar opens the pane and clears the count.

### 2.3 The pane is the agent's mind: Chat · Bench · Tape
Tap the avatar → the pane, with a segmented header and a close control:
- **Chat** — the tape as built (messages, engine records, directive cards, the scope chip `CRM · All`, the composer at the bottom with its cost). Each entry carries its kind as an eyebrow.
- **Bench** — what the decider *named* on the bench at the last check and what it said, verbatim (`At the 3:45 PM check: "NOW would need to move +7.4% more just to lock in the bonus…"`); then the rest of the roster (the equipped watchlist and hot bench) with `Not named at the 3:45 PM check`. The watchlist's name lives here as the section's subtitle. Assignment cards land here later — leave a slot.
- **Tape** — the shipped Game Tape content, simplified: trade cards (the same cards the Chat shows), bookmarks, the activity log. The Time / P&L / Tier filters are dropped.

**Desktop:** the pane is the right column (~40%); the avatar sits in the pane's header as its controller and the segmented control lives beside it; **collapse** (a control in the pane header) folds the pane away entirely — the board takes the full width and the avatar floats bottom-right with its bubble. **Mobile:** the pane opens full-height over the board (the board dims beneath; a close returns to it, focus back on the avatar); the segmented header is the top of the pane; the composer is the bottom of Chat.

---

## 3. What changes on the page

| Today | After |
|---|---|
| Bottom strip (turn line · newest line · composer) on both shells | **Gone.** The turn line stays in the score header; the newest line is the bubble; the composer lives in the pane. |
| Three-detent sheet on mobile | **Gone.** Two states: pane closed (the board + the avatar) / pane open. |
| `Game Tape` button and the watchlist chip in the header | **Gone from the header.** Tape is a pane section; the watchlist name is the Bench section's subtitle. Mobile header = Back · the scores and bar · the turn line. |
| Bug-report button (floating, bottom-right) | **Retires** into the pane header's overflow (`···`). The avatar takes its spot. |
| The book panel (score header → Why?) opens the full check across the top of the board with no way to close it | **Collapsed by default:** the check's eyebrow, `Held`, `Woken by …`, the first sentence, `Read more`; a close control; expanding it scrolls within a bounded height, never past the board. |
| `Read the full check` on a row expands the top-of-board panel | **Opens the pane's Chat scrolled to that check card, expanded.** The full check lives in the tape; the board stays clean. |
| `In the chat · 5` on a row | **Unchanged in meaning;** opens the pane's Chat scoped to that stock. |
| *This turn* strip above the board | **Unchanged.** |

---

## 4. Honesty rules (the avatar edition — in addition to the Controller brief's eight)

1. **The avatar never moves between checks.** No idle animation, no eye blink, no glow that cycles. It may change once when the tape changes and once when the pane opens or closes.
2. **The bubble is a mirror of the tape.** It shows an entry that exists, with its real kind and time. It never composes a line of its own, never says "thinking," never shows a countdown.
3. **Unread means unseen tape entries**, counted from what the pane actually renders — never raw feed events the tape shows as nothing.
4. **The Bench section quotes the decider only.** The narrator's "Eyeing NOW" messages are Chat entries labelled `Bench note`; they never appear in Bench as if the decider said them.
5. Kind labels are facts about provenance: `Status check` (the decider's record), `Trade note` / `Bench note` / `Reply` (the character's speech), `Directive` (yours, with its receipt). No label may claim attention or intent.
6. Everything else in the Controller brief §6 stands — scoreboard language, discrete cadence, the fence between the interface's words and the character's.

---

## 5. Deliverables (in this order)

| # | Screen / state | Shell | Notes |
|---|---|---|---|
| 1 | Board with the pane **open on Chat**, scoped to CRM (`CRM · All`), the avatar in the pane header as its controller | Desktop | The resting working state. |
| 2 | Board full width, pane **collapsed**, the avatar floating bottom-right with a bubble (`Status check · 3:45 PM` + first line) and an unread count of 3 | Desktop | The state that replaces the strip. |
| 3 | Board, pane closed, the avatar with a bubble (`Bench note` + first line), the decluttered header | Mobile | The state that replaces the sheet at peek. |
| 4 | Pane **open on Chat** over the board, scoped to CRM, composer at the bottom, close control | Mobile | The state that replaces the sheet at full. |
| 5 | **Bench** section — two named names with the decider's sentences, the rest of the roster with `Not named…`, the watchlist name as subtitle, an empty assignment slot | Either | The new section. |
| 6 | **Tape** section — trade cards, bookmarks, activity log; no filters | Either | The simplified Game Tape. |
| 7 | The **book panel** collapsed (eyebrow · `Held` · `Woken by …` · first sentence · `Read more` · close) and expanded within its bounded height | Desktop | The fix. |
| 8 | Bubble states: nothing new (avatar alone) · one new · three new · market closed with nothing new | Either | Small board. |

Do not design: the Command Center cockpit, the no-battle state, the lever arc, assignments (the slot only), any change to the rows or *This turn*.

---

## 6. Quality bar and references
- **Feel:** a game character standing at the edge of the field, who says something when something happened and otherwise waits. A companion NPC's speech bubble, not a notification toast. The pane is the character's mind, not a settings drawer.
- **Restraint:** the avatar and its bubble are the one bold element on the board. The pane is quiet — the content is the design.
- **Copy:** plain, sentence case, the character in first person, the interface in facts. No exclamation marks.

---

## 7. Tokens, type, and fixtures
Same tokens, type, and existing components as the Controller brief V1.2 §10. The avatar is the existing agent mark (do not redraw it).
**Fixtures (Sep 3 battle):** `SHADOW −2` vs `CPU −21`; `Market closed · last check 3:45 PM · next Fri 9:30 AM ET`. Rows: CRM (−0.12%, $264.43, `7.1% to Bust`) vs MRK; CF (+0.53%, $137.81, `6.4% to Bagger`) vs IBM; HOOD (+1.31%, $124.72) vs HAL. Check card: `Status check · 3:45 PM · Held · Woken by a bench name outrunning the book` — *"I'm seeing strong bench outperformance — NOW up 6.97%, TSLA up 6.70%, CRWD up 4.99% — but my active positions are holding their own relative to the market."* Bench sentences (the decider, same check): *"NOW would need to move +7.4% more just to lock in the bonus; TSLA would need +6.6% more."* Bench note (the character): *"Eyeing NOW on the bench. It's showing massive relative strength today…"* Reply: *"I'll be straight with you — I don't have a fundamental data feed…"* Budget: `Messages: 2/10 battle · 0/5 review`.
**Strings (requests):** `Chat` · `Bench` · `Tape` · `Status check · {t} · {state}` · `Bench note` · `Trade note` · `Reply` · `Directive` · `{n} new` · `Close` · `Collapse` · `Read more` · `Not named at the {t} check` · `In the chat · {n}` · `{sym} · All`.

---

## 8. Questions the design should answer (do not wait on them)
1. Desktop, pane open: does the avatar live only in the pane header, or does a smaller mark also stay on the board's corner so the two states share an anchor?
2. Does the bubble speak for engine records (`Status check`) as well as the character's speech? Fable's lean: yes, with the kind eyebrow doing the work — a check landing is the biggest thing that happens all turn.
3. Mobile pane: a full-height sheet over the dimmed board, or a pushed page with the header retained? Pick one and show why.

---

## Appendix A — Traceability for the ledger

| This brief | Ledger | Status |
|---|---|---|
| The character is the controller: avatar + bubble + pane | new — **D-86** | Founder-blessed Sep 3 |
| The bench lives in the pane, quoting the decider only | new — **D-87**; C1 | Blessed |
| The bottom strip and three-detent sheet retired | supersedes **D-74** — **D-88** | Blessed |
| The book panel collapsed by default; `Read the full check` → the tape's card | new — **D-89** | Fix |
| Game Tape and the watchlist chip leave the header; Tape is a pane section | new — **D-90** | Blessed |
| The bug-report button retires into the pane overflow | new — **D-91** | Blessed |
| Kind eyebrows on every tape entry from the persisted exchange types | extends **D-84** | Blessed |
| Unread counts what the tape renders | the A2 handover's recorded item | Ruled |
| The four verbs, the turn, the scope, Why? V2 | D-43 … D-85 | Unchanged |

*Prepared September 3, 2026. Nothing here is a build instruction.*
