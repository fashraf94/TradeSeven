# Phase A3 — rulings and amendments after Phase 0 (V1)

**Date:** September 4, 2026
**For:** CC — attach to the A3 build session with `PHASE_A3_SEED_CHARACTER_PANE_V1.md`. **Where this document and the seed disagree, this document wins.**
**From:** Flash, with Fable (arc authority).
**Source:** `docs/audits/20260904_BATTLE_VIEW_CHARACTER_PANE_PHASE_A3_PHASE0_REPORT.md` (`8e63ea65`, the branch's first commit).
**Branch:** `claude/character-pane-phase-a3-s4krjn` — push there. **Model:** Opus build; Fable review (five lenses, one worktree each, this document and the seed to every lens; prove the mutation harness can report a survivor before trusting a run of kills).

## 1. The two input gaps
1. **The brief is committed first.** The founder attaches `BATTLE_VIEW_CHARACTER_PANE_DESIGN_BRIEF_V1.md` to the build session; CC commits it to `docs/design/` as the branch's second docs-only commit, before the flag commit. The mock HTML bundles are attachments only, never committed.
2. **Renumbering accepted as §9 proposes:** the seed's rows land as **D-91 → D-98**; the seed's D-89 is the existing D-89. Commit messages and comments cite the renumbered rows; the phase headings map as §9 says.

## 2. The twelve decisions — ruled

| # | Decision | Ruling |
|---|---|---|
| 1 | The brief | Committed (§1.1). |
| 2 | Ledger | Renumbered (§1.2). |
| 3 | The avatar asset | **(a)** — the presence face (`AgentPresenceMount`) rendered static, `events` withheld, via a new `reactivityLevel` prop. It is the mark already on this board and it carries the agent's DNA accent. The Forge mech is not used. |
| 4 | Player-side accent | **`--ft-teal`.** |
| 5 | Copper and the radius | **Add `--ft-copper` and `--ft-copper-rgb`** to `tokens.css` + `tokenBaseline.json` from the legacy value — a token addition, not a new hex (hazard 42: the review, not the guard, enforces it). The bubble's radius is the literal `4`, once, commented; no radius token this arc. |
| 6 | The bug button | The hide seam lives at the **`App.jsx` mount**: `ClashBotWidget` takes a `hidden` prop, true when the character pane is on and the active screen is the agent Battle View. The pane's overflow opens it by dispatching a `CustomEvent('clashbot:open')` the widget subscribes to. A small widget render test covers `hidden` and the event; `App.jsx` stays covered by `vite build`. |
| 7 | The row's tier tag | **(c)** — the `BAGGER` tag *is* the shipped badge (live-merged); the burst, the footer and the bubble are the persisted-only additions and key on the persisted transition, never the live merge (hazard 37). The fuse's 400 ms live flash stays: it marks the price crossing, the burst marks the record — two events up to a tick apart, not one event twice (hazard 38, recorded). |
| 8 | `{mult}` | **The row's conviction tier multiplier** (`2× / 1.5× / 1×`), the mock's reading — it is the number the player is playing for. `banked` stands: the history is monotonic and the bonus banks by construction. |
| 9 | `{pct}` | **The bagger line** `+{baseATR}%` — the persisted threshold, the number the row reads at that price. |
| 10 | Higher tiers | **Bagger only** in A3.6; double and ten are the same path, ruled later. |
| 11 | Bench on an outage tick | **Scan back** to the last check with a rationale; label its slot; the absence line only when no entry today carries words. |
| 12 | Tape's bookmarks and the dot | **Keep the shipped bookmark control** in Tape (a moved client write, shipped behaviour). The bookmark dot goes to Tape's section header as a count (`Bookmarks · n`), nowhere on the board. |

## 3. The mocks — what is not built (report §3), confirmed
Not built: the avatar's 420 ms brighten and the badge pop (D-97 — the avatar never moves between events); the `New` divider, `Today ·` header and `{sym} · n entries` line; the dashed Assignments placeholder (an empty slot, no UI); the Chat tab's count pill; the bench `%` (no source); `Read · Equip` in the overflow (`Report a bug` alone); the `Command Center` back label (`Back` stays); the mock's own seam arithmetic (the shipped `computeTugOfWarWidth` is the seam); the `+` sign and text glow (`AnimatedScore` already signs); `vs` (the seed's `VS`).
Built as ruled: the sharp unstriped bubble; the segmented control as a real `tablist / tab / tabpanel` set with `aria-controls` / `aria-labelledby`; the bubble's eyebrow and line from `tapeKindEyebrow` and the `derivePeekLine` helpers, never composed.
**Hazard 43 ruled:** the bubble's eyebrow reuses the record edges' `LABEL_COLOR` for records and `text-muted` for speech; **the chat's eyebrows adopt the same colours under the pane flag** (a gated change in `AgentChat.jsx`, flag-off byte-identical) so the bubble and the stream never disagree about a kind.

## 4. Hazards 36 → 48 are build constraints, verbatim. Three restated as DO-NOTs
- DO NOT mount a second starfield; the arena header lets the existing canvas through (39).
- DO NOT unmount the Chat when Bench or Tape shows; one tree position across collapse / expand and sections (45).
- DO NOT assert a fade or a burst by timing; attribute or state only (47).

## 5. Debts outside the task — triage
| # | Debt | Disposition |
|---|---|---|
| 1 | The local `THRESHOLDS` copy in `computeProximity.js` and `TacticalRow.jsx` | Own small task, Opus: import `THRESHOLD_MULTIPLIERS`; a byte-identity test on the rows. After A3. |
| 2 | `ChamberFuse.onThresholdCross` dead wiring | Backlog; delete in the rows PR. |
| 3 | The presence face reacting to raw `statusFeed` on the duel surface | Moot under the pane (events withheld); backlog for flag-off. |
| 4 | The watchlist chip's raw hex | Leaves the header under the pane; the rows PR cleans flag-off. |

## 6. Ledger (append after D-90; the status line gains "amended Sep 4 with D-91 → D-98")
D-91 the character is the controller · D-92 Bench quotes the decider only (scan-back on outage) · D-93 the strip and the sheet retire under the pane flag (D-74 superseded) · D-94 Game Tape and the chip leave the header; Tape is a pane section with its bookmark control · D-95 the bug button retires into the overflow via the App mount seam · D-96 the arena header (`--ft-teal` vs `--ft-copper`, the shipped tug width as the seam, `VS`) · D-97 motion marks events, never states (the burst on the persisted crossing; the fuse flash marks the live one) · D-98 the bubble is sharp and unstriped; its eyebrow shares the stream's kind colours.

## 7. Go
Build session on the branch, Opus: the brief commit → the flag commit → A3.0 → A3.5 in the seed's order with these rulings, one commit each, every new file on both guard lists with baselines in its creating commit, the controller-on / pane-off golden captured from `8e63ea65` in a worktree (the mobile paint, hazard 46). STOP for the founder's smoke after A3.5; A3.6 in the next session; the §2 review at handoff.
