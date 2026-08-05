# Delight Layer · Task 4 — Signature Deploy (Hold-to-Deploy Sky Coupling)
## Phase 3 — closing report: acceptance matrix, Amendment C, contract, guards

**Spec:** Task 4 V1 §6 Phase 3. **Rulings closed:** R-T4-ARCH, R-T4-S1–S5, R-T4-SURGE, R-T4-A5, feel-pass rounds 1 and 2.
**Branch:** `claude/delight-deploy-sky-coupling-0q1kc6` · cumulative diff vs `origin/main`: **16 files, +2395/−19**.
**Status:** feature complete, merged-dark, cumulative review done and its findings fixed. Ready for the flip PR. **Both feel passes PASSED (A7).**

---

## 1. Executive verdict table

| Phase-3 item | Status | One-line |
|---|---|---|
| 1. Acceptance matrix A1–A7 | **CLOSED** | §2. All seven accounted for; A7 recorded from both feel passes. |
| 2. Event contract in both headers | **DONE** | Name, target, payload, malformed handling, ordering guarantee — plus the house pattern for the next custom event. |
| 3. State Map Amendment C | **RECORDED** | In the state-map chain itself (`warpStateMachine.js`), beside Amendment B, pointing at the R-T4-ARCH rationale. |
| 4. Unexercised rulings | **RECORDED, not deleted** | §4. R-T4-S3b and the BATTLE LIVE crossover describe unreachable states — flagged as flag-dependent. |
| 5. Census correction | **CARRIED** | §5. Six sites in code, four live at current flags. |
| BUILD_RULES §2 amendment | **DONE** | Operational definition replaces the `/code-review` command reference. |
| Cumulative review (per the new §2) | **DONE — 7 CONFIRMED / 13 REFUTED** | §7. All 7 fixed in `72c50773`, each mutation-checked. Two were real bugs this branch introduced. |
| Full suite | **GREEN** | 6755 passed / 53 skipped / **0 failed** (385 files). `vite build` ✓. Lint at the pre-existing 133-error `App.jsx` baseline. |

---

## 2. The acceptance matrix, closed

| # | Assertion | Status | Where it is discharged |
|---|---|---|---|
| **A1** | Flag OFF ⇒ no event dispatched, no listener effect; hold behaves byte-identically | **GREEN** | `starfield.intent.test.jsx` — dispatches nothing across hold/abort/commit and on the keyboard path; the sky registers no listener (the state stays `createIntentState()` by deep-equality); the button glow is absent. Plus `App.deploySettle.test.js` — the settle is inside the flag gate. Mutation-checked ×3 (remove the dispatch guard, un-gate the settle, un-gate the glow). |
| **A2** | Intent rows pure: monotone in progress; `max()` never lowers; abort exhale reaches state speed within bound; terminal clears; curve peak < endgame peak | **GREEN** | `warpStateMachine.test.js` — 116 rows total, ~40 of them intent/surge. Monotonicity, the upward-only identity, exact-zero exhale at `INTENT_EXHALE_MS`, and the D2 bound each have their own row. Mutation-checked (drop the `max()` → 8 rows fail). |
| **A3** | Event contract: `{progress}` shape, terminal `null` on abort **and** commit; listener ignores malformed payloads | **GREEN** | Both ends. Dispatch shape asserted through the *real* gesture (`starfield.intent.test.jsx`); malformed handling asserted by identity in the pure reducer (12 malformed shapes → same object). |
| **A4** | Reduced motion ⇒ intent no-ops, no loop scheduled, hold progress still communicated by the button | **GREEN** | `starfield.intent.test.jsx` — 21 intent events plus a terminal under `prefers-reduced-motion`: zero frames scheduled, zero repaints, `applyIntent` never called. And the button fill still reports ~50% at the half-way mark. |
| **A5** | Post-deploy settle: commit lands on BATTLE LIVE without an intermediate RESTING dip | **GREEN** (nuance ratified) | Projection half in `warpBattleAdapter.test.js` (the injected shape resolves LIVE, explicitly *not* RESTING; missing `expiresAt` still counts as live but capped; failure injects nothing). Site half in `App.deploySettle.test.js`. Per **R-T4-A5**, "arrives climbing" over the standard tier ease satisfies this row — the defect A5 existed to prevent (a two-minute RESTING sky during a live battle) is gone. |
| **A6** | No new Firestore read paths | **GREEN** | The existing `starfield.importguard.test.js` still passes untouched, and `App.deploySettle.test.js` adds a direct guard: the settle block may not contain `getDoc` / `getDocs` / `onSnapshot` / `collection(` / `query(`. The settle is a `setState` on state the app already holds. |
| **A7** | Founder feel gate: hold/abort/commit on desktop + phone; the abort reads as an exhale; the commit reads as one continuous moment | **SATISFIED** | **Round 1** (Phase 1): hold + abort judged; three tuning changes issued (T1/T2/T3) and applied. **Round 2** (Phase 2): commit beat, settle and abort exhale all **approved as-is, no further tuning**. Both passes run on desktop and phone via `?deploySkyCoupling=1`. Carried into the flip PR description. |

---

## 3. State Map Amendment C, as recorded

Recorded in the state-map chain itself — `warpStateMachine.js`, in the STATE MAP V2 contract block directly beneath Amendment B, so a reader of the contract cannot miss it.

> **R-INPUT** is amended to admit a second input class: **user deploy intent** — *transient* (a ref, for the length of a hold plus its release, leaving no trace in the tier machine), *upward-only* (`speed = max(stateSpeed, intent)`), and *non-authoritative* (it decorates the machine's **output** at the consumption read; it never changes tier). **Battle state remains the sole authority for tier.**

**The part a future reader must not undo** (R-T4-ARCH, recorded at length in the overlay block the amendment points to): the `max()` is applied at the **consumption read** in `StarfieldBackground.step`, and never written back into `advanceWarp`'s `state.speed` or into `targetSpeed`.

That is not a style preference. `advanceWarp` computes its ease anchor from `prev.speed` and selects its ease *duration* from `prev.speed`/`prev.tier`. An intent-inflated speed written back into state would make the sky, on the frame a hold ends, believe it was easing down from the intent peak — re-anchoring the 15s tier ease (or the 30s decay) against a speed no battle ever justified, and corrupting the `targetMoved` guard with it. The tier machine must keep integrating as if no hold were happening; the hold only decorates what gets drawn. **A mutation test pins this**: moving `applyIntent` off the consumption read fails four rows.

---

## 4. Known-unexercised rulings (recorded, not deleted)

Commit `b236660f` established the reachability invariant: **with a battle live, every deploy hold is either unmounted or disabled**, and the sky's live set is a strict subset of the shells' — so a non-RESTING sky implies `isLive` implies no armed hold. Two things in the record therefore describe states no user can reach:

| Item | What it says | Status |
|---|---|---|
| **R-T4-S3b** | "A hold during a live ENDGAME adds nothing visible, by design." | **TRUE BUT UNEXERCISED.** ENDGAME requires a live battle, which disables every hold. Sound as a principle; never executed. |
| **Round-1 crossover table, BATTLE LIVE row** | "The hold does not clear the floor until ~45% of the press (~592ms) mid-battle." | **UNEXERCISED.** Correct arithmetic about an unreachable state. `INTENT_PEAK` is judged against RESTING alone, where the ramp starts at ~97ms. |

**They are retained rather than deleted, deliberately.** The invariant rests on ordinary render decisions — `deployDisabled` including `isLive`, and the Deploy section being gated on `!isLive`. Those are flags-and-layout choices a future change could reverse without anyone realising a tuning argument depended on them. If that happens, these rulings become live again and the analysis is already done.

`src/components/Dashboard/holdDuringLiveBattle.test.js` (9 rows, mutation-checked) fails the moment either mechanism is removed.

**The one way to exercise them:** the `?warpState=` dev override sets the sky's tier without touching `activeAgentBattles`, so `isLive` stays false and the holds stay armed. `?deploySkyCoupling=1&warpState=live` is the only way to feel a hold against a non-RESTING sky. An instrument, not a user state.

---

## 5. Phase 0 census correction, carried into the docs

The Phase 0 census reported **six hold sites**. That is correct *as code sites* and remains the right basis for the dispatch decision — but only **four render at current flags**:

| # | Site | Renders today? |
|---|---|---|
| 1 | `CommandDashboard.jsx:381` (filled, mobile) | **No** — `SCOUTING_BOARD_ENABLED = true` routes to the "See what it's eyeing" branch. Flag-off fallback. |
| 2 | `CommandDashboard.jsx:428` (muted, mobile) | Yes |
| 3 | `DeployStation.jsx:27` (mobile) | Yes, when not live |
| 4 | `desktop/DeployCard.jsx:38` | Yes, when not live |
| 5 | `ReadColumn.jsx:136` (filled, desktop) | **No** — same `boardEnabled` branch. Flag-off fallback. |
| 6 | `ReadColumn.jsx:183` (muted, desktop) | Yes |

Phase 0 noted the filled/muted mutual exclusivity but did not state which branch was live; that was under-stated and is corrected here and in the dispatcher header.

**Dispatch-in-the-hook stays correct precisely because of this.** `useHoldToDeploy` is the single home of the gesture and `HoldToDeployButton` its only importer, so one dispatch covers all six regardless of which are currently rendered — and covers nothing else. Had dispatch been placed at the call sites, this flag-dependence would have become a live correctness problem.

---

## 6. BUILD_RULES §2 amendment

`/code-review` does not exist in the Claude Code environment these sessions run in. The rule had been silently unmeetable twice — the Task 2 cumulative review and the Task 4 Phase 2 diff — and both times the session met the *intent* while having to disclose that the named command could not be run.

§2 now states the requirement **operationally**: at the threshold (≥10 files or ≥1500 lines, measured on the **cumulative branch diff**), the review must be multi-lens and adversarial, every finding independently refuted with a concrete repro, accompanied by an explicit `vite build`, mutation-checked where it adds tests, and written down in `docs/audits/`. A tool, where one exists, is a means rather than the requirement; and a session that *cannot* run the adversarial pass must say so in the PR rather than report the review as done.

Precedent cited in the rule: `audits/20260730_DELIGHT_STARFIELD_CUMULATIVE_CODE_REVIEW.md` (6 dimensions, 22 agents, 13 CONFIRMED / 3 REFUTED).

---

## 7. The cumulative review (per the amended §2)

**Method:** six independent lenses over the cumulative branch diff — pure-core correctness, wiring/lifecycle, the flag-off guarantee, the settle's blast radius, test integrity, cross-phase consistency. Every finding was then handed to an independent reviewer instructed to **refute** it with a concrete repro. 26 agents.

**Verdict: 20 raised · 7 CONFIRMED · 13 REFUTED.** All 7 fixed in `72c50773`. Explicit `vite build` ✓.

### 7.1 Confirmed — two real bugs this branch introduced

**C1 (found independently by two lenses) — the terminal-collision guard stranded `progress`.** `return prev` by identity discarded the abort's *other* job: clearing `progress`. The terminal branch is the only writer that ever nulls it, so a live frame arriving between a commit and a blocked abort left a hold value set permanently — the sky pinned above battle state, no gesture in flight, and no event able to bring it down. **This is exactly the "sky pinned forever" hazard the unmount terminal was written to prevent, reintroduced through a different door by the fix for a different hazard.**

Reachable: two hold buttons are mounted simultaneously (the muted CTA + DeployStation on mobile; ReadColumn + DeployCard on desktop), each with its own hook instance dispatching into the one `window` channel — so two pointers, or a pointer plus `Enter` on a focused second button, produce the sequence. Cosmetic in blast radius (drawn star speed only; `warpRef.current.speed` is never written back, per R-T4-ARCH) and it ships dark, which is why the refuter corrected severity to low. Fixed by closing the stream while keeping the punch authoritative:

```js
if (!committing && isSurging(prev, now, tuning)) {
  return prev.progress == null ? prev : { ...prev, progress: null };
}
```

The `prev.progress == null` short-circuit preserves the identity return the AUTHORITATIVE rows assert with `toBe()`.

**C2 (medium — the most user-visible) — the settle injected a stub the Battle View hydrates from.** Injecting flips `isLive`, which swaps Deploy for Manage — and `ManageStation` hands that same object to `handleOpenAgentBattle`, which builds the Battle View from `battle.portfolio` / `battle.opponent` / `gameMode` / `groupId`. The adapter-minimal entry had none of them, so **tapping "Manage · live" within the up-to-120s poll window opened an empty battle.** The entry now carries the real doc's shape, from data already in scope at the injection site.

**C3 — a backwards wall clock resurrected finished animations.** An NTP correction mid-session made `elapsed <= 0` read as "not started yet", replaying a finished surge or exhale at full strength; `isSurging` likewise treated negative elapsed as in-window, letting a dead surge keep swallowing abort terminals. All three readers now treat negative elapsed as stale — the same conservative-on-unprovable-clock rule the tier machine already follows.

**C4 — a test row that could not fail.** `holdDuringLiveBattle`'s desktop row asserted only `card > gate`, which a `DeployCard` moved *below* a closed gate would satisfy while rendering unconditionally. Now bounded.

**C5 — a false claim in a checked-in record.** The Phase 2 build report stated I had also corrected the poll citation in the `StarfieldBackground` header. **I had not** — only the mount-site citations were fixed. Both stale copies (`StarfieldBackground.jsx:61`, `warpBattleAdapter.js:7`) are now corrected, and the discrepancy is recorded here rather than quietly patched, because the wrong thing to do with an inaccurate record is to make it silently true.

**C6 — `docs/README.md` referenced this report before it existed.** Resolved by writing it.

### 7.2 Refuted — 13, and the pushback is the point

Nine of the thirteen were test-integrity claims that did not survive contact with the code: four alleged the flag-off guard and the R-T4-ARCH invariant had "zero coverage" (they are covered — by the deep-equality state assertion, the mutation-checked gate rows, and the four rows that fail when `applyIntent` moves off the consumption read); two alleged vacuous A5 rows; one alleged the muted variant's glow was uncovered. Four were consistency claims about docstrings that had in fact already been updated by the round-1 tuning commit, or that named values the reviewer had read from a stale line.

Two are worth recording because they show the review pushing back correctly:
- A proposal to pin `DEPLOY_SKY_COUPLING_ENABLED = false` with a value assertion was **refuted** — it would break CI the moment the founder flips the flag, which is precisely what BUILD_RULES §11's flip-reconciliation rule exists to manage.
- A claim that the payload contract still documented "Phase 1 semantics" was **refuted**: the terminal `reason` field was in the contract from the first commit, specifically so Phase 2 would not have to change a shipped contract.

---

## 8. What ships, and what the flip PR must say

**Merged dark:** `DEPLOY_SKY_COUPLING_ENABLED = false`. The intent channel, the surge, the settle and the button glow are all inert until the flip.

**NOT dark — ships live on merge (T3, founder-ruled):** `SPEED_RESTING` 0.12 → 0.08 and `SPEED_LIVE` 0.5 → 0.7. These are Task 2 tier values and are deliberately **not** gated behind a Task 4 flag, because holding a Task 2 tuning behind a Task 4 flag would couple two things that should stay independent. **This merge therefore changes production sky behaviour at rest and during live battles** — a departure from every previous merge in this arc being visually inert, and it must be named in the PR description.

**Standing obligation for the eventual flip PR** (BUILD_RULES §2/§11): it reconciles its own pins in the same commit — the value pins in `starfield.intent.test.jsx` and the `DEPLOY_SKY_COUPLING_ENABLED` docstring — and it names the R-T4-S1 consequence: flag-on also makes the "No battle live" card flip immediately on a successful deploy rather than up to 120s late.
