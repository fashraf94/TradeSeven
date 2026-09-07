# Phase A3 — smoke rulings and the A3.6 session (V1)

**Date:** September 4, 2026
**For:** CC — the next session on `claude/character-pane-phase-a3-rulings-rq17ta`. Attach with the seed and `PHASE_A3_RULINGS_AND_AMENDMENTS_V1.md` (commit the rulings document to `docs/design/` as this session's first docs commit — debt 5). **Model:** Opus build; **Fable review** at the end of this session (five lenses, one worktree each, the harness proven able to report a survivor first). The handover is written **after** the review record, never before.
**From:** Flash, with Fable (arc authority). Founder smoke Sep 4 on the `smoke/character-pane` preview.

## 1. Fixes first — one commit each, before any A3.6 work

| # | Defect (founder smoke) | Fix |
|---|---|---|
| F1 | **Bench and Tape render below the board on desktop**; only Chat stays in the right column. | All three sections render inside the pane's column at the same position; Chat is hidden (not unmounted — hazard 45) beneath Bench or Tape. A mounted row: with the pane open on Bench, the section's container is a descendant of the pane column and the Chat tree is still present. |
| F2 | **The avatar and the agent's name are far apart; the name truncates (`SHAD…`, `S..`) under the segmented control.** | Header row: avatar and name adjacent on the left; the segmented control sized to its content; the name never truncates — on narrow widths the archetype line hides first, then the name wraps. A style-contract row at 390 px and 1280 px. |
| F3 | **The mobile avatar sits in the scrolling board, not the viewport.** | `position: fixed` to the visual viewport (the `visualViewport` rule from A2.4), bottom-right, above the board and the tab bar; the bubble travels with it; the board reserves its clearance at the bottom. A row that the avatar's container is fixed and outside the scroll container. |

## 2. Bench — the shape fix (this session, no new data)
- **Sentence-first.** For the check used (ruling 11), render each sentence of `rationale` that names at least one bench symbol **once**, verbatim, with the bench symbols it names as chips on the sentence. A sentence naming five names is one card with five chips, not five cards. The order is the sentence order in the rationale.
- **The roster as chips.** `Not named at the {t} check` once, as a line, followed by the remaining symbols as a wrapped row of chips. No per-symbol line.
- The header stays: the watchlist's name as subtitle; `Named at the {t} check` (the slot used — the flip-prep ruling).
- Tests: a rationale naming three bench symbols in one sentence renders one card with three chips; the roster row count is one; the mutation that re-introduces per-symbol duplication must fail.

## 3. Bench — organization (a two-question discovery in this session, read-only, then a founder line)
The founder wants the bench organized by conviction and/or sector, not a flat list. Two facts decide what is honest and cheap:
1. **Sector per symbol on the client.** Is there a readable sector for bench symbols on the battle doc, the equipped-watchlist snapshot, or an existing client map (the archetype sector-preference data, the universe taxonomy)? `file:line` or NOT FOUND.
2. **The archetype's fit score per symbol.** The scouting board's `archetypeScore` (0–100, the post-rank output the Phase 0 V2 cited) — is it readable from the Battle View without a new endpoint (a persisted ranking on the doc, or the existing `scouting-board.js` read; cost, latency, cache)? The watchlist is already "ranked by composite score" — is that the same number?
**Report both; do not build.** If both are FOUND: chips ordered by fit score within sector groups, the score shown as a small number labelled as the ranking's (`fit 86`), never as a prediction — built as A3.7 after the founder's line. If only the score: one row ordered by it. If neither: the shape fix stands.

## 4. Then A3.6 — event motion, as seeded (D-97)
The bagger moment on the persisted crossing (rulings 7–10), the trade card's arrival fade (once per mount, in both places it now renders — handover §7), the bubble's second source for `Bagger · {sym} hit {pct}` seeded silently.

## 5. Then the review, then STOP
Fable, five lenses, the survivor proof first. Handover after the record. The founder's second smoke on a refreshed `smoke/character-pane` (rebased onto this branch's head), then the founder opens the A3 PR.

*The thesis held in the smoke: everything agentic now has one home. What remains is making that home sit where it should and read as a bench, not a list.*
