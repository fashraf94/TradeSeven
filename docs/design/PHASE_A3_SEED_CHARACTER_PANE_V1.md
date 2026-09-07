# Phase A3 seed — the character pane (V1)

**Date:** September 3, 2026
**For:** CC. **One task, one branch, all phases.** Session 1: in-session Phase 0 (read-only, `file:line`, STOP). Session 2+: the build. **Model:** Opus for the build; Fable for the review (this exceeds ten files: five lenses, one worktree per reviewer, the rulings documents to every lens).
**From:** Flash, with Fable (arc authority). **Founder approval:** both mocks approved Sep 3; one change (§2.1, the bubble).
**Branch:** new, harness-assigned; record it. **Cut from `main` after `fix/battle-view-flip-prep` merges** — A3 depends on the book-panel close, the kind eyebrows, and the unread source it delivers. The flip PR's state does not matter to A3.
**Flag:** `BATTLE_VIEW_CHARACTER_PANE_ENABLED = false`, pin, `DARK_BY_DESIGN`, first build commit. **Nested:** `isCharacterPaneOn() = isBattleViewControllerOn() && flag`. Pane off = the A2 containers exactly as merged (the strip, the detent sheet) — that is the fallback and it gets its own golden.
**Read from the repo:** `docs/design/BATTLE_VIEW_CHARACTER_PANE_DESIGN_BRIEF_V1.md` · `docs/audits/20260903_BATTLE_VIEW_CONTROLLER_PHASE_A2_HANDOVER.md` (the sheet hook, the strip, the goldens) · the flip-prep handover · the ledger (D-42 → D-91) · `docs/BUILD_RULES.md`. **Attach:** `The_Character_Pane_-_Battle_View__standalone_.html` and `Arena_header___bagger_moment__standalone_.html` — visual reference; every string in them is a request.

---

## 0. What A3 is, in game terms
The score header becomes the arena. The agent stands on the board as a character: it speaks when something happened, it opens its own pane (Chat · Bench · Tape), and a tapped piece sends you into it. The footer strip and the drawer go. When a piece hits its bagger, the row bursts once and the character says so. Nothing moves otherwise.

---

## 1. Phase 0 — in-session, read-only, then STOP
1. `useChatSheet.js` / `ChatSheet.jsx` / the desktop strip component: props, the detent machine, where the pane flag would branch so pane-off renders A2 byte-for-byte.
2. The score header component(s) on both shells: file, the tug-of-war bar, the `Tap for the book` hint, the avatar asset (the existing agent mark — `file:line`; do not redraw).
3. The Game Tape overlay (`Back to the battle`), the header `Game Tape` link, the watchlist chip, the bug-report button: files and mount points, so each can be hidden under the pane flag without touching flag-off.
4. **The bagger event source.** Where a player's piece's tier state is readable per snapshot — `computeProximity`'s `achievement`, the tier tag on the row, `thresholdHistory`, `lockedPoints` / banked points. Can "crossed into bagger between two snapshots" be derived from persisted scoring state alone, and once? Cite. If the only signal is a client-side comparison of two proximity results, say so — that is acceptable *if* the inputs are persisted.
5. The roster for Bench: `portfolio.bench`, `watchlist.hotBench`, `agentContext.equippedWatchlist.tickers` (A2 Phase 0 item 8), and the equipped watchlist's **name**.
6. The sentence helper from Why? V2 (`extractSentences`) — reusable with a bench key set?
7. Theme-guard lists for new files; the motion tokens available for a one-shot burst and a fade.
8. Fence and ratchet: `src/` + strings + tests only. Any `api/` contact is a STOP.

**STOP.** Report; the build starts next session.

---

## 2. Rulings folded in (founder, Sep 3)
1. **The bubble is sharp, with no side stripe.** Corners at the smallest radius the tokens allow (≤ 4 px), no coloured edge; the kind eyebrow (`Bagger`, `Status check`, `Bench note` …) carries the colour as text only. The mock's rounded, striped bubble is superseded.
2. The bubble speaks for engine records as well as the character's speech (brief §8 Q2 — the bagger is the proof).
3. Mobile: the pane opens full-height over the dimmed board with a close (the mock's choice), not a pushed page.
4. The avatar stays in the pane header while the pane is open on desktop; no second mark on the board's corner.

---

## 3. Build phases — one commit each

### A3.0 — The arena header (D-92)
Both shells: the player's side tinted with the agent accent, the CPU's side with the copper, the tug-of-war bar as the seam with `VS` at the centre, deep near-black behind, the starfield as the floor; the agent mark beside the player's score; `Tap for the book` as the score-header hint; the turn line beneath, unchanged. Colours via `cssVar()` and the existing tokens only. The header must remain the loudest thing on the page *and* read the numbers first. Flag-off untouched.

### A3.1 — The avatar and the bubble (D-86, D-94)
The avatar floats bottom-right on the board (≥ 48 px target; the board reserves its space; never over a row's targets). On a **new rendered tape entry**: a bubble beside it — kind eyebrow + first line, one line, truncated — fades in once and sits still; an unread count on the avatar. No timer may create a bubble; only a tape change. Tap either → the pane (A3.2), count cleared. Reduced motion: no fade. Nothing idle, ever.

### A3.2 — The pane (D-86, D-88)
- **Desktop:** the right column (~40%) with the pane header — the avatar, `SHADOW · SPECULATOR`, the segmented control `Chat · Bench · Tape`, `···` (overflow), `Collapse`. Collapse folds the pane away: the board takes the full width, the avatar floats with its bubble. Expand restores the last section.
- **Mobile:** the pane opens full-height over the dimmed board; the same header with a close; focus moves into the pane on open and back to the avatar on close; body scroll locked while open.
- **Chat** = the tape as merged (kinds, records, directive cards, the composer with the scope chip *inside* it as the mock shows, the cost). `In the chat · n` and the row's `Read the full check` open the pane on Chat (scoped / scrolled to the card).
- The strip and the detent sheet are not rendered under the pane flag; exactly one `AgentChat` at a time.

### A3.3 — Bench (D-87)
Section header with the equipped watchlist's name as subtitle. **Named at the last decided check:** each bench symbol that the latest `evaluations[]` entry's `rationale` names, with its verbatim sentences (`extractSentences` keyed on the bench roster), under `At the {slot} check`. Then the rest of the roster with `Not named at the {slot} check`. Nothing else — no narrator text, no reason chips (the scouting-board join is a later item), an empty slot for assignments (no UI). Absence: if no decided check exists today, `No check yet today` and the roster.

### A3.4 — Tape (D-90)
The shipped Game Tape content moved into the pane: trade cards (the same component the Chat uses), bookmarks, the activity log; the Time / P&L / Tier filters dropped. Under the pane flag the header `Game Tape` link and the `Back to the battle` overlay are not rendered.

### A3.5 — Header declutter (D-90, D-91)
Under the pane flag: the watchlist chip leaves the header (its name lives in Bench); the bug-report button is not rendered on the board — `Report a bug` lives in the pane's `···` overflow. Mobile header = Back · the arena scores and bar · the turn line.

**Founder smoke after A3.5 — STOP.**

### A3.6 — Event motion (D-93)
One-shot, event-bound, reduced-motion aware, all via `motionToken`:
- **The bagger moment:** when a player's piece crosses into its bagger tier between snapshots (Phase 0 item 4), once per crossing: the row's burst (≤ 700 ms, then still), the `BAGGER` tag, the footer `Bagger hit · {mult}× banked` from persisted scoring, and the bubble `Bagger · {sym} hit {pct}`. Never on mount, never twice for one crossing (persist the last-seen tier per symbol in session state).
- **A trade card landing:** a fade on arrival.
- The check landing wash and the bubble's fade stay as built. **Nothing idle** — the ambient starfield may drift as it does today; the avatar never moves between events.

---

## 4. Tests — import what they guard
- Pane machine: closed → open (Chat) → section change → collapse → expand restores the section; mobile focus in/out; body scroll lock; one `AgentChat`.
- Bubble: appears on a tape change only (a fake-timer row proves a timer alone does nothing); count = unread rendered entries; cleared on open; sharp style contract (radius token, no border-left).
- Bench: a narrator exchange never renders in Bench (a mutation row); sentences verbatim; the roster's `Not named…`; the absence state.
- Bagger: fires once per crossing; a re-render does not re-fire; reduced motion renders the tag and footer with no burst.
- Header: token-only colours (theme guard); the numbers' accessible order (player, VS, CPU).
- Goldens: **controller-on / pane-off** captured from the pre-build commit (the A2 render) and compared; **flag-off** (the tabbed screen) unchanged.
- Copy guard on every new file; theme guards on every new file.

## 5. Strings (requests, into `battleViewCopy.js`)
`Chat` · `Bench` · `Tape` · `Collapse` · `Close` · `Report a bug` · `VS` · `Tap for the book` · `{n} new` · `Bagger · {sym} hit {pct}` · `Bagger hit · {mult}× banked` · `At the {t} check` · `Not named at the {t} check` · `No check yet today` · `Named at the last check` · the kind labels as merged. Copy-guard clean; no idle-attention words anywhere (including the Bench header).

## 6. DO-NOTs
All prior hazards and the A2/flip-prep guards stand. Plus: no idle motion on the avatar; the bubble never composes text; Bench never shows narrator speech; no new hex; the bagger fires from persisted tier state only, once; unread never reads the raw feed; one `AgentChat` per layout; no `api/` contact; no change to the rows, *This turn*, Why?, or the tape's contents.

## 7. Smoke (after A3.5; the branch preview with both query overrides if provided, else the pattern from Phase 0)
1. The arena header on both shells: teal side, copper side, the seam, the numbers readable first.
2. Desktop: the pane open on Chat; tap CRM → `In the chat · n` → scoped; collapse → the board full width, the avatar bottom-right; wait for a check → a bubble appears once and sits; tap it → the pane, count cleared.
3. Mobile: the board with the avatar; tap → the pane over the dimmed board; close → back to the avatar with focus.
4. Bench: the names the check named with their sentences; the rest `Not named…`; the watchlist name as subtitle.
5. Tape: trades as cards, no filters; no `Game Tape` in the header; no bug button on the board; `Report a bug` in the overflow.
6. (After A3.6) A bagger, if one occurs — or the fixture render test — the burst once, then the tag and the footer, and the bubble line.

## 8. Ledger (append after D-85)
| # | Ruling |
|---|---|
| **D-86** | The character is the controller: the avatar on the board, the bubble on a tape change, the pane (Chat · Bench · Tape) on both shells. |
| **D-87** | Bench quotes the decider only: the bench names the last decided check named, verbatim; the roster with `Not named…`; the watchlist's name as subtitle. |
| **D-88** | The bottom strip and the three-detent sheet are retired under the pane flag (D-74 superseded); pane-off renders A2 as merged. |
| **D-89** | The book panel is collapsed by default with a close; `Read the full check` opens the tape's card (shipped in flip-prep). |
| **D-90** | Game Tape and the watchlist chip leave the header; Tape is a pane section, simplified. |
| **D-91** | The bug-report button retires into the pane overflow. |
| **D-92** | The score header is the arena: agent accent vs copper, the bar as the seam, `VS`, tokens only. |
| **D-93** | Motion marks events, never states: the check wash, the bubble's arrival, a trade card landing, the bagger moment — each one-shot, from persisted state, once. The avatar never moves between events. |
| **D-94** | The bubble is sharp and unstriped; the kind eyebrow carries its colour as text. |

*A3 writes nothing server-side and asks the model nothing. It gives the game a character and a scoreboard.*
