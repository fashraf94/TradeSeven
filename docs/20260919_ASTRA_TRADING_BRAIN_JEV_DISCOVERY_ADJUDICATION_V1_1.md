# Adjudication — Astra trading-brain and Jev discovery (V1.1)

**Adjudicates:** `docs/audits/20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY.md` (Astra, GPT-6, Codex worktree; read against local `main` @ `5ba40661`)
**Author:** Fable · **Date:** 2026-09-19 · **Supersedes:** V1 (same date)
**Status:** Adopted by founder, 19 Sep 2026 (stamped 22 Sep 2026; see status update at end). Rulings P-1–P-8 are approve-by-default; FR-1–FR-3 need Flash. Once blessed, they take D-numbers on the Command Center ledger.
**Companion:** `CAPTURE_BUILD_SCOPE_AMENDMENT_A_V1_1_SEP19_2026.md`
**Changes from V1 (from Astra's second opinion, Sep 19):** §3 restructured into measured / disabled / backlog / planned columns and narrowed; F02 latency enumerated per path; F06 split into three consumers; F08 given a repair owner (P-8); P-5's threshold-removal alternative moved to FR-1; P-6 defines "successful call"; J1's Sep 10/14 examples demoted to provenance-incomplete illustrations; §7 acceptance restored to the report's D5 contract. Astra reviewed from a copy of the report that began mid-J3; its points concern these documents' own consistency and stand regardless.
**Reader note:** §1 is plain terms. §2 onward is plumbing.

---

## 1. In plain terms

**The audit is trusted.** It found seven of our known problems on its own before reading any of our documents, added six new ones that hold up, made no claim we can fault, and marked every number it could not see as unverified. Its second-opinion review of these notes then tightened them in thirteen places, mostly on how records must be built so they can be trusted later.

**The brain's biggest problems are inputs and records, not the model.** In one tick the agent can be shown a portfolio it has already left. Some safety checks run only when the agent wakes. Held names get thinner evidence than bench names, and the Analyst is told to enforce a quality number it never sees. Explanations are recycled as facts.

**Jev is not going into the decision seat, the trigger, or the risk engine.** Astra and Fable agree; the Haiku ruling (D-24) stands. Jev's first job, if it earns one, is checking that the agent's explanations claim only evidence it actually received.

**The first Jev experiment cannot run yet.** It needs exact "what the agent saw, and what it said back" records for about twelve trading days, which we do not keep. The capture build creates them; twelve days is when collection starts to be enough, not the finish line. Realistic date: late October.

**Four small fixes go to Opus now.** Rebuild the agent's picture after a forced exit; fail safe when the guardrail check crashes; validate the model's answer fully; mark a news story seen only after a valid answer. Everything else lands in an arc already queued.

---

## 2. Grade of the audit

| Measure | Result |
|---|---|
| Known problems found unprompted (code-first) | 7: stops checked only when the loop wakes (G-1) · held names thinner than bench · eval ids repeat after 150 checks · two score sources in one tick · six archetypes through the same renderers · directive gate checks membership, not fit · skipped ticks leave no record |
| Known problems missed | 4: `rsPercentile ?? 50` reaching the decider · two `activeRules` projections disagreeing · `agent.config.risk` legacy read · Speculator charter Zone-4 hedge language. Fair misses. |
| New findings that hold | 6: post-exit state shown to the model (F01) · guardrail exception fails open to the proposal (F07) · tool result not validated to schema (F07) · news marked seen before the call (A7) · narration reads the live directive (A4) · prompt says only hard stops override LOCK while R11 defers all forced exits |
| Claims that fail against the ledger | 0 found |
| Coverage honesty | Every production figure marked UNVERIFIED; own experiment halts on "corpus insufficient"; declined to challenge D-24; corrected the discovery brief (the 98.9% near-neighbour catch came from one call; Directive Judge V1.1's two-call design is untested) |

---

## 3. What we know that the audit could not see

Four kinds of fact, kept apart. **Measured** bounds exposure. **Disabled** means a checked-in gate keeps the path off. **Backlog** means we already know; it bounds nothing. **Planned** names an owner; it bounds nothing either.

| Audit item | Measured | Disabled | Backlog / planned | Conclusion |
|---|---|---|---|---|
| F02 wake-dependent exits | Zero agents with a deployed guardrail; zero guardrail exits across 468 battles / 402 trades (Sep 17 census) | Legacy pending-proposal early return: dead under forced autopilot (`agent-evaluate.js:2410`) | G-1 owned by the exit-dials arc | See the per-path table below. Live exposure is bounded to the deployed-guardrail path, which has no deployments. |
| F04 trades cap feeds the score sum | Aggregate only: 402 trades across 468 battles. **Per-battle maximum not measured** (Amendment Phase 0 Q8). | — | — | Probably latent; confirm the maximum before saying so. Separate from the 150-evaluation cap, which is not bounded by this figure. |
| F04 eval ids repeat past 150 | — | — | On the ledger since Sep 16; capture build | Awareness only; Amendment A-1 defines the fix. |
| F03 held/candidate asymmetry | ~96% of eval prompts byte-identical across archetypes (harness arc, Sep 12; unit and denominator in that arc's report, not reproduced here) | — | Parity change drafted | Confirms direction; two specifics added (hot-bench synthetic ATR; Analyst lacks `fundamentalScore`). |
| A7 VWAP session absent | All 96 `vwap_failure` exits fall in May 6–Jun 12; none after the freshness gate | Session VWAP fails closed against EODHD's day-lagged feed since Jun 12 | Intraday arc: build 1 merged dark Sep 19; restoration requires the risk-use stage to be on and verified | The floor is inactive, not restored. The finding stays open on the intraday arc until risk-use activation is verified. |
| F06/F10 explanation laundering | — | `VOICE_GROUNDING_MODE = 'shadow'` | Walk to `'on'` gated on Flash's 20-pair read | Grounding covers narration and anticipation only (§4, F06a). |
| F08 lease vs budget | Nothing measured; no per-battle wall time recorded | — | Scaling arc instrumentation PR next | Unbounded. A correctness decision is needed, not only a measurement (P-8). |
| Jev evidence ledger | — | — | Directive Judge V1.1 asks the independent question in a separate call | Astra's correction accepted: that design is untested until the shadow trial. |

**F02 per path** (from the audit's own A1/A2):

| Path | Runs when | Deployed today | Status |
|---|---|---|---|
| S7 risk engine: bust avoidance, VWAP, LOCK, stepped trail, stagnation | Every tick with usable quotes, before the trigger gate | Yes | Not wake-dependent. Not part of F02's exposure. |
| S10 equipped guardrails: stop, trailing stop, enabled target | Only after a model wake | No agent has one deployed | Wake-dependent; latent. G-1 makes them always-run before dials ship. |
| Meeting-suppression special pass | While a gameplan meeting is pending | Rare | Deterministic pass exists; keep. |
| Legacy pending-proposal early return | Persisted legacy proposals only | None new since forced autopilot | Disabled in effect; retire with the legacy cleanup. |
| LOCK deferring all forced guardrails | On LOCK | Yes | Ruled (R11). Prompt sentence is the stale side (P-5). FR-3 for player-set stops. |

---

## 4. Finding dispositions

| Finding | Fable reading | Disposition · owner | Fence |
|---|---|---|---|
| F01 mixed pre/post-exit state; two score sources | Real decision-quality defect | Rebuild the whole decision snapshot after any forced swap before S9 (P-3, Opus task T1); one score source stays in the capture build | Handler-side; Phase 0 confirms |
| F02 | Per-path table above | Always-run check phase · exit-dials arc (P-2); stale LOCK sentence · parity change (P-5); FR-3 | Fenced |
| F03 | Known; two specifics added | Parity change scope grows (P-5) | Fenced |
| F04 | Ids: queued. Score sum: probably latent, maximum unmeasured | Amendment A-1 and A-7 | A-7 fenced |
| F05 | Three-level framing adopted as the test vocabulary | FR-1, FR-2; J2 later measures the preference level | Fenced when a constraint becomes a gate |
| **F06a** trade narration and anticipation paraphrase | Remedy is the grounding walk | Finish the walk; no judge (P-7) | None |
| **F06b** reflection grades and consolidation re-entering S2/S9 as fact | Not covered by grounding | Learning Phase B: reflection output labelled interpretation; lesson promotion deterministic over mined facts | None now |
| **F06c** receipts derive "acted" from the model's echo | This is F10; keep its own status | Heard/Acted semantics stay as documented; J1 may flag an overclaiming sentence, which does not prove the directive caused the action | None |
| F07 uneven degradation | Fail closed on the proposal only; anything already executed this tick stands | Opus tasks T2, T3 (P-6); typed unknowns → parity change | Handler-side for T2/T3 |
| F08 capacity and overlap | A correctness condition, not only a measurement | Scaling arc: measure (instrumentation PR) then repair (P-8) | None |
| F09 reconstructability | Exact packets, responses, alternatives and skip reasons not persisted | Amendment A-1–A-4 | Read-only on the assembler; transport hook |
| F10 controls have unequal proof | Keep own status (see F06c) | — | — |
| F11 protect the rails | Agreed | — | — |
| F12 Mandate seam incomplete | Partial fulfilment of D-23 | Note on the Mandate arc | — |
| F13, F14 | Notes | — | — |
| F15 experiment transport is not an adapter | Correct | Directive Judge shadow build: pin snapshot and abort on mismatch; no-retention mandatory; strict typed-result parsing | None |
| A7 news marked seen before the call | Small, real | Opus task T4 (P-6) | Handler-side |
| A4 narration reads the live directive | Retired when grounding is on | Capture freezes the control snapshot (A-5); no narration reader work | None |

---

## 5. Jev

**Verdict adopted.** Log-only explanation auditor first; nothing in S7, S8 or S9; D-24 untouched. "Cheapness buys coverage, not truth."

**Cards.** J1 accepted as the first experiment; J2 second, downstream of A-3 Tier 2 and a Flash-authored per-archetype rubric; J3 parked; S8 news-materiality parked.

**Experiment amendments (Fable → the executable prompt, when the corpus exists).**
1. Corpus = the capture build's per-check records (request and response as dispatched and received), exported read-only to local JSONL; no Firestore reads from the runner.
2. The Sep 10 and Sep 14 battles are **historical examples with incomplete provenance**: no exact packet exists for them. They may illustrate the failure class and the deterministic "indicator not in packet" check as far as tick-stamp evidence keys allow. They are never reconstructed from current data, never held-out, and never counted toward D5's bars.
3. J1 packets are expected to carry agent-authored and canonical-menu text only. The runner asserts this on the serialized payload (Amendment A-2 privacy test); it does not assume it from authorship.
4. Pins as Astra specified: Haiku `claude-haiku-4-5-20251001`; Jev by returned snapshot, abort on mismatch.
5. **Acceptance is D5 as written** (120 original contexts, development/held-out split by day, battle-level grouping, frozen labels, class counts). Twelve captured trading days is the collection milestone at which readiness is checked.

**Directive Judge shadow (separate chat):** proceeds on its own schedule with F15 folded in.

---

## 6. Answers to Astra's Part E

| # | Question | Answer | Status |
|---|---|---|---|
| 1 | Archive with exact decision prompts over ≥12 trading days, incl. HOLDs? | No. The DR-10 shadow corpus (Jul 24–Sep 14) holds prompts only on divergence; tick stamps hold keys and rounded values. Amendment A-2 creates the archive. | Fact |
| 2 | Deterministic stop/target checks on every eligible tick without a wake? | Yes by intent (G-1, exit-dials arc). | P-2 |
| 3 | Which archetype constraints become deterministic gates? | Founder ruling. | FR-1, FR-2 |
| 4 | Who owns richer capture and the claims-first oracle? | Capture: Command Center arc (Amendment A). Oracle: Harness arc. J1 borrows both schemas. | Fact |
| 5 | Observed peak eligible battles, per-stage tick times? | Not recorded; Jul figure ~2.5 s/battle untriggered, 15–20 s triggered; instrumentation PR next. | Fact |
| 6 | Pinned snapshot, no-retention routing, $15 cap? | Cap and pin: yes. Route: OpenRouter with no-retention is acceptable for J1 only if the A-2 payload test holds; direct TypeSafe stays the recommendation for the Directive Judge, subject to Flash reading the data policy. | Approve-by-default |

---

## 7. Proposed rulings

**Approve-by-default**
- **P-1 Jev scope.** Supersedes R-3's test-scoped "judge only". Jev may be a log-only auditor of persisted decision records (S9→S12) and, later, an offline comparator of archetype preference. It never gates, routes, wakes or delays any action in S7–S11. D-24 stands.
- **P-2 Always-run check phase.** Deployed deterministic exits are evaluated on every eligible tick regardless of model wake, preserving R11 until FR-3. Owner: exit-dials arc (G-1), rebased on the Opus tasks below.
- **P-3 One-tick coherence.** After any forced swap, the entire decision snapshot (held set, per-asset scores, header totals, prices, position metadata) is rebuilt before the model is asked. Acceptance compares components, not totals, on ticks with and without a forced swap. Opus task T1.
- **P-4 Capture build scope grows** per Amendment A V1.1.
- **P-5 Parity change scope grows:** fresh hot-bench names get real technicals or an explicit `unknown`, never a synthetic ATR presented as measured; the Analyst receives `fundamentalScore`; the "only hard stops override locks" sentence is corrected to the ruled behavior. Whether the Analyst's thresholds stay in the identity text is FR-1, not an implementation choice.
- **P-6 Fail-closed fixes.** (a) Guardrail evaluation exception → the model proposal becomes HOLD with failure category `guardrail_error`; anything already executed this tick stands. (b) Tool result validated against the full schema; invalid → HOLD with `invalid_tool_result` and the failing field named; no defaults filled. (c) A news story id is marked seen only after a **successful call**, defined as a tool result that passed (b) and was accepted, never an HTTP 200; after three failed wakes on one story it is marked seen with `seenReason: 'attempts_exhausted'`. Opus tasks T2, T3, T4. Fallback HOLDs are recorded as `holdKind: 'default_failure'`, distinct from a chosen HOLD.
- **P-7 No judge on narration.** The grounding walk retires trade narration and anticipation paraphrase; no Jev work on S12 text until grounding is `'on'`.
- **P-8 Scaling arc: measure, then repair.** Measure: lease/budget mismatch frequency and unbudgeted narration time join the instrumentation PR. Repair, as a build after it, owned by the scaling arc: the lease covers the handler's full budget or is renewed per battle; awaited narration and anticipation run under a deadline inside the remaining budget; overlapping invocations are detected and refused. The audit's Mandate revision envelope is the reference pattern.

**Founder rulings needed**
- **FR-1** Which archetype constraints become deterministic gates, and whether prompt-only thresholds stay in identity text. Candidate: Analyst quality floor (refuse < 40, core > 70), once P-5 supplies the score.
- **FR-2** Contrarian and the shared distressed veto: exemption with its own tighter guardrail, or distressed off-limits for everyone with the charter language moved.
- **FR-3** (exit-dials arc) A player-set stop that fires while a LOCK is active: honor the stop, or keep R11's deference.

---

## 8. Sequence

1. Merge the audit and this note as one docs PR.
2. Opus tasks T3 → T4 → T2 → T1, one branch each, each with a blind review pass before merge (`BUILD_PROMPT_EVAL_SMALL_FIXES_SEP19_2026.md`).
3. Capture build spec absorbs Amendment A V1.1 → CC Phase 0 → build. Parity change in parallel (P-5).
4. Twelve captured trading days → readiness check against D5 → Fable writes the J1 executable prompt.
5. FR-1–FR-3 whenever Flash is ready; none blocks steps 1–4.

---

Status update — Adopted by founder, 19 Sep 2026. The rulings in this adjudication were adopted in conversation on 19 Sep 2026 and are stamped here on 22 Sep 2026 so the committed artifact reflects the decision. Convention: conversation-blessed rulings are stamped on the committed document with the adoption date. No ruling text above is changed.
