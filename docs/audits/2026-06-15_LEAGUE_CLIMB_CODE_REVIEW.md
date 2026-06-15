# Code Review — League "Altitude Climb" standings (next-arc, dev/dark)

**Date:** 2026-06-15 · **Branch:** `claude/awesome-darwin-rq1e6n` · **Reviewed:** working-tree diff (pre-commit)
**Scope:** the Altitude Climb five-day pod-standings slice — 4 new files + 5 additive edits, behind
`?leagueClimb=1` / `LEAGUE_NEXT_ARC_ENABLED` (default OFF). `/code-review` is **mandatory** here
(>1,500 lines / ~9 files, BUILD_RULES §2) — this is the durable artifact (the explicit fix for the
PR #510 review skip).

## Method
`/code-review` at **high effort (recall-biased)**: 7 finder angles across 3 parallel agents —
correctness (line-by-line / removed-behavior / cross-file), cleanup (reuse / simplification /
efficiency), and integration+altitude against the 5 binding constraints — then a verify pass.

## Verdict
**Faithful, correct port. Zero binding-constraint violations. No high/medium correctness bug.**
All findings are low/info (latent guard gaps with no current trigger, plus maintainability/efficiency
notes). Three were fixed; the rest are logged with rationale below.

### Binding constraints — all UPHELD
1. **No layer-combine formula in the DOM** — ✅ the only `1.5/×/multiplier/ratio/formula` hits in
   `LeagueClimb*.jsx` are CSS/SVG values (stroke widths, font sizes) and code comments enforcing the
   rule. Player-detail label is exactly **"Two layers · one altitude"**; footer reads "combined into a
   single score of record." (`clbBook` computes each layer's *own* P&L for its panel — not a cross-layer weight.)
2. **No cut/advance/eliminate in training** — ✅ `CutLine` + `ADV/OUT` gated on `ctx==='ranked'`;
   `ClimbVerdict` mounts only in ranked; `ClimbFinish` (training) shows only the finish (the "top two
   would advance" line is subjunctive and explicitly "here it's just your finish").
3. **Reduced-motion safety** — ✅ `CountScore` gates on `matchMedia(prefers-reduced-motion)`; the SVG
   draw ref skips under reduce (now sets `stroke-dasharray:none` explicitly — see Fix 2); all CSS
   energy is covered by the global `index.css` guard.
4. **Flag inert** — ✅ nothing reads `LEAGUE_NEXT_ARC_ENABLED` (declaration + comments only); the climb
   is gated **solely** on the `?leagueClimb=1` param, so flag-on + no-param is byte-unchanged.
5. **Film-room sealed while live** — ✅ `sealed = mode==='live' && !s.you`; `CLBFilm` returns the masked
   panel *before* referencing `CLB_WHY` — no live-opponent reasoning reaches the DOM.

## Findings & disposition

| # | Sev | File:line | Finding | Disposition |
|---|-----|-----------|---------|-------------|
| 1 | low | `LeagueClimbStanding.jsx` ClimbPlayerSheet | `ranked.find(...).you` deref with no undefined guard (no current trigger — ids always valid) | **FIXED** — added `if (!s) return null;` |
| 2 | low | `LeagueClimbChart.jsx` draw `ref` | reduced-motion correctness rested on an *unset* `--len` resolving to a solid line (coincidental) | **FIXED** — under reduce, set `strokeDasharray='none'` explicitly |
| 3 | low | `leagueClimbFixtures.js` | built the full bracket state (`leagueState('open')`) at import just to read `.field` (4 of 16 seats) | **FIXED** — export `FIELD` from `leagueFixtures.js`, use it directly (no bracket build; also decouples climb from the bracket builder) |
| 4 | low | `LeagueClimbStanding.jsx` `ClimbSheet`/`CloseBtn` | a 3rd hand-copy of the bottom-sheet overlay shell (alongside `PodSheet`, `ActionLayer`) | **LOGGED** — the redesign already ships two un-shared copies; extracting a shared `LeagueSheet` shell is a separate cleanup touching merged files. Follow-up. |
| 5 | low | `LeagueClimb*` (6 sites) | `lastIdx = live?3:4` and `clbRankAt` re-derived per consumer | **LOGGED** — 4-seat re-sort, negligible; mirrors the design. Centralizing adds indirection for no real gain. |
| 6 | info | `LeagueClimbStanding.jsx:163-169` | training "top two would advance" teaching echo is the closest copy to constraint 2 | **LOGGED** — verified subjunctive/non-violating; treat the conditioning clause as load-bearing copy. |
| 7 | info | `LeagueScreen.jsx` | dev param read once at module load → preview is hard-load-only + sticky-for-session | **LOGGED** — matches the existing `?leagueRedesign=1` idiom; acceptable for a dev/dark param. |
| 8 | info | `leagueClimbFixtures.js` seam | `CLB_WHY` ships in the bundle; the seal is render-time, not data-time | **LOGGED** — correct for fixtures; the seam comment already notes the real adapter must conceal at the **data** layer (don't fetch a live opponent's WHY). |

## Re-verification after fixes
- `eslint` (9 changed files): **clean** (exit 0).
- `npm run build`: **green** (✓ built). Pre-existing chunk-size warning only.
- `vitest run` (equipSlots + leagueTournament): **104 passed**.
- No-leak re-grep of `LeagueClimb*.jsx` for `1.5/×/multiplier/ratio/formula`: only CSS/SVG + rule comments.
- Flag inertness: `LEAGUE_NEXT_ARC_ENABLED` has no readers (declaration + comments only).

**Conclusion:** ship-ready for the dev/dark slice. Items 4–8 are tracked notes for the later
real-data/adapter and lobby-entry phases, not blockers for this presentation slice.
