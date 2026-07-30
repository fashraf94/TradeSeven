# Delight Layer — Task 2 (Battle-Weather Starfield) — Phase 3 Build Report

**Date:** July 30, 2026
**Spec:** DELIGHT_LAYER_STARFIELD_SPEC_V2 (LOCKED) + Amendment A + State Map Amendment B
**Rulings applied:** R-T2-S14 (ratifies the §4 interpretation), plus spec §5 Phase 3
**Branch:** `claude/delight-starfield-background-js9xtw` @ `d10952fb`
**Fence status:** **NON-FENCED.** No fenced file read or written in this phase. Zero `api/` contact.
**Status:** **Phase 3 COMPLETE.** Build work on Task 2 is done. Flags remain `false`. Awaiting the founder's second feel pass (running in parallel) and then the flip PR.

---

## 1. Executive summary

Phase 3 closes the remaining acceptance rows — A5 (tint) and A6 (no new reads) — and lands the docs note the spec asked for. It was built in parallel with the feel pass as greenlit; nothing here touches a tuning-exempt parameter, so incoming feel notes cannot conflict with it.

Two things worth your attention:

1. **Both new suites were mutation-checked, not trusted for passing** (§3). Four deliberate defects were planted and every one was caught, including a Firestore read smuggled **one hop away** from the entry files — the case a flat text grep cannot see. Each mutant was reverted and the tree re-verified byte-identical.
2. **The component header now carries a written handoff for whoever retires the price lines** (§4), because that PR will fail on a guard whose error message does not obviously point back at this arc.

**The full acceptance matrix is now closed except A7**, which is yours and in progress.

---

## 2. What shipped

| File | Status | Role |
|---|---|---|
| `src/components/starfield.tint.test.jsx` | NEW (222 ln) | **Row A5** — 8 jsdom rows against a recording canvas context. |
| `src/components/starfield.importguard.test.js` | NEW (154 ln) | **Row A6** — 7 rows, transitive import-graph walk. |
| `src/components/StarfieldBackground.jsx` | +17 | The Phase 3 docs note, incl. the R-T2-S6 handoff (§4). |
| `src/components/warpStateMachine.js` | +6/−7 | `resolveEaseMs` comment moved from "flagged" to the R-T2-S14 ratified scope. |
| `src/components/starfield.inert.test.jsx` | +5/−15 | The weak duplicate A6 check removed; points at its real home. |

**Suite: 351 files / 6,281 tests green. Build clean.**

### A5 — asserting what lands on the canvas, not what the helper returns

That distinction is the entire value of the row. Canvas has **no CSS parser**: `ctx.strokeStyle = 'var(--ft-accent)'` is not an error, it is silently **ignored**, and the previous style persists. The failure mode is an invisible or wrong-coloured field with no throw, no warning, and no failing unit test — the silent-failure class BUILD_RULES §10 exists for.

So the context stub records every `strokeStyle` / `fillStyle` write, and the rows assert: the resolved token lands (`#00d9ff` via `--ft-warp-tint → --ft-accent → --ft-cyan`); **no `var(` string ever** does; every written value is canvas-parseable; `ft-accent-changed` re-reads it (**and does not without the event** — values are read, never guessed); the listener is removed on unmount; and an unreadable token still paints the literal fallback rather than nothing.

Fixture strategy is inherited from `src/theme/cssTokens.test.js:6-16` — fs-read `tokens.css` and inject it as a `<style>`. vitest's `test.css` is unset, so an `import './tokens.css'` would resolve to an empty module and **every assertion in the file would pass vacuously**.

### A6 — promoted from a text grep to a callgraph walk

Phase 1 shipped a flat text check over two files, labelled "finalised in Phase 3". It now walks the real import graph from all three entry points (component, adapter, core), resolving relative specifiers and recursing, then asserts across the whole closure: no `firebase` package at any depth, no `firebase/config`, no Firestore read API, no `setInterval` (a repeating timer is a poll by another name — `setTimeout` stays allowed for the 200ms resize debounce), and a tight third-party allowlist so a heavyweight dependency in the background layer has to be a deliberate choice. One row also asserts the scan is non-empty, so a silently-broken walk cannot make the rest vacuous.

The duplicate in `starfield.inert.test.jsx` was **removed** rather than left weaker-but-passing: one question should have one answer.

---

## 3. Mutation check — the suites actually bite

A passing test proves nothing until you have seen it fail. Both new suites were checked against deliberate defects:

| Mutant | Result |
|---|---|
| `resolveTint` stops guarding against `var()` | **1 A5 failure** |
| Component sources the tint from `cssVar()` instead of `readToken()` | **6 A5 failures** |
| Adapter imports `firebase/firestore` directly | **3 A6 failures** |
| `setInterval` planted in the **core**, one hop from the entry files | **1 A6 failure** |

Every mutant was reverted and the working tree re-verified byte-identical against HEAD before proceeding.

That last row is the one that justifies the rewrite: under the Phase 1 text check, a read smuggled into a module the entry file merely *imports* would have passed silently.

---

## 4. The written handoff for the price-line retirement (R-T2-S6)

Recorded in the component header, where the next person will actually be standing:

> The everywhere-swap PR — the one that finally deletes the price-line SVGs from `DesktopBackground.jsx` — **must, in the same commit**, (1) regenerate `src/theme/tokenGuardBaseline.json`, because deleting those SVGs removes 3 pinned R-H8 hexes, and (2) update the hard-coded exempt count in `src/theme/tokens.guard.test.js` (21 → 18).

Without both, that PR fails on a guard whose message does not obviously point back at this arc. **The v1 flip PR does not touch either file, because it deletes nothing.**

Every claim in that note was verified in place this session: `DesktopBackground.jsx` still carries exactly 2× `#00d9ff` and 1× `#8b5cf6`, and the R-BL21 row sits at `tokens.guard.test.js:185`.

---

## 5. Acceptance matrix — final state

| Row | Status |
|---|---|
| **A1** flag OFF ⇒ absent from the tree, roots opaque, `DesktopBackground` renders | **CLOSED** — `starfield.inert.test.jsx`, incl. source tripwires on all four conditional sites and the prop threading |
| **A2** tier selection, R-PREC (Amendment B), R-WINDOW, monotone ramp, eased transitions, decay, handoff | **CLOSED** — 74 rows in `warpStateMachine.test.js` |
| **A2s** scheduling decisions (reduced motion / hidden / flag-off / unmount) | **CLOSED** — pure rows, per R-T2-S8 |
| **A3/A4** loop pauses, static frame, no leak | **CLOSED** — pure decisions (A2s) + the narrow jsdom rig (R-T2-S12) + browser-observed in Phase 1 |
| **A5** tint from `readToken`, no `var(` on canvas, accent event re-reads | **CLOSED** — `starfield.tint.test.jsx`, mutation-checked |
| **A6** no new Firestore listener/poll | **CLOSED** — `starfield.importguard.test.js`, transitive, mutation-checked |
| **A7** founder feel gate | **OPEN — yours.** Desktop + mobile passed in the first pass; the two-game handoff and a real market-close endgame remain, both needing real battle data |

---

## 6. What remains before the flip

1. **A7 second feel pass** (in progress) — two-game handoff + real endgame. Setup constraints are in the Phase 2 report §5; the binding one is that a real handoff needs **two distinct ranked agents**, because the one-live-battle guard is per-agent.
2. **Defect #2 is REQUIRED before flip** (R-T2-S11) — `App.jsx:3902` resets the poll to `[]` on any fetch error, which would wrongly calm the sky mid-battle for up to 120s. Separately branched, not this one. **Not yet relayed to me.**
3. **The flip PR itself** — a one-line flag change carrying your A7 sign-off. It deletes nothing and touches neither `DesktopBackground.jsx` nor the token guard baseline.

Tuning-exempt parameters remain changeable on your word with no spec re-version: all speeds, the tier ease, the decay (including the R-T2-S14 descent), window constants, particle counts (220 desktop / 120 mobile), and the engine feel knobs — one named block at the top of `warpStateMachine.js`.

---

*End of Phase 3 build report. Task 2 build work complete; awaiting A7 and the flip.*
