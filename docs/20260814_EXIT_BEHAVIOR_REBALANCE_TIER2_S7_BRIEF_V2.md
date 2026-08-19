> **Provenance note:** founder upload (byte-exact below this note), added at the Ask 3 build kickoff (2026-08-19) per founder instruction, same relay pattern as the Aug 16 addendum. Content below the rule is the founder's original, unmodified.

---

# Exit-Behavior Rebalance — Tier 2 §7 Design Brief V2
## For Fable: dual-adversarial design review, fenced scope
### Supersedes V1 (`20260813_EXIT_BEHAVIOR_REBALANCE_TIER2_S7_BRIEF_V1`) — updated with Tier 1 landings

**Date:** 2026-08-14
**Reads with:** Trading Brain Swap-Decision Audit + Ruled-Designs Verification Audit (HEAD `5103e834`) + Tier 1 build + code-review record (`20260814_SWAP_MOTIVE_OBSERVABILITY_TIER1_CODE_REVIEW`, branch `claude/swap-motive-observability-tier1`).
**Model note:** for **Fable** — novel design + invariant reasoning on fenced surfaces, §7 gated process. Three asks, separable; founder rules per-ask.
**Status:** DESIGN REVIEW, not a build order.

---

## The situation (established by the audits; unchanged)
1. The eval prompt's DECISION FRAMEWORK is **archetype-invariant** and **affirmatively prohibits profit-taking** ("Do NOT sell a winner just to 'bank' positive points"; "Your primary directive is P&L protection"; zero matches for `profit` across prompt/schema/identity).
2. When a user equips Exit Discipline (which ships — the dimension exists, the target persists, `emitRule_sx04` renders it), the prompt simultaneously contains "**Sell any position that gains 15% from entry**" as a soft preference — **a live self-contradiction**, with "constraints always override strategy preferences" biasing against the user's rule.
3. Losses have deterministic executors (stop-loss, bust-avoidance, VWAP failure, trailing stop); **gains have none** — `profitTarget` is a soft note, deliberately omitted from `SUPPORTED_GUARDRAIL_SHAPES` (`compileBuild.js`).
4. Ledger consequence: locked P&L skews heavily negative (−204 / −1319 / −1080).

## What Tier 1 changed (NEW — constraints and evidence for this review)

**T1-a. The field split is now load-bearing: `exitReason` ≠ `swapMotive`.** `exitReason` = which machinery produced the swap (provenance); `swapMotive` = the model's declared judgment (`defensive_cut / profit_take / momentum_rotation / upgrade`, nullable). **`exitReason` is byte-frozen by contract test** (`swapMotiveObservability.contract.test.js`) because four production subsystems key on its literal values:
- the **fenced deterministic hurdle-floor gate** (`agentArchetypeConfig.js` — `byReason[reason]` lookup; the reason is computed once and reused for the gate AND the stamp),
- receipt `source` derivation (regex-pinned),
- the learning L1 allowlist (`D3_DISCRETIONARY_EXIT_REASONS`, fail-closed),
- calibration partitioning.
**Design consequence for Ask 3:** the executor's new stamp (`exitReason:'profit_target'`) must be added to whichever of these four should see it — most notably the **learning allowlist** (should profit-target exits feed learning? presumably yes) — and any desire for **motive-aware hurdle gating** (e.g. a different hurdle for profit-takes vs defensive cuts) is a **fenced `agentArchetypeConfig` change** and must be proposed explicitly, not discovered mid-build.

**T1-b. A live edge case Ask 3 must handle: deterministic overrides can carry stale model output.** Tier 1's review found a guardrail-forced stop spreads the prior `haikuResult`, so a stale `swap_type` can ride on a forced swap (fixed display-side with deterministic-first precedence). The same pattern will exist for the profit-target executor: **when the executor forces an exit, it must not inherit or emit stale model-side fields** — its provenance must be unambiguous end to end (stamp, receipt, learning, ledger), not just at the display layer.

**T1-c. The motive baseline is accruing from Tier 1's merge.** Once ~a week of stamping exists: real defensive-vs-motive split (vs the founder's 80–90% eyeball), `profit_take` attempt-rate under the current prohibition, and the **undeclared rate** (the model may omit the optional motive — a high omission rate under the current prompt is itself evidence). **This data should be attached to the review when available; the design questions below do not block on it.**

## The design intent (founder-confirmed; unchanged)
- The agent should be **able** to take profit and rotate proactively, expressed through each archetype's character, modulated by equipped rules.
- A **user-set** target must hold deterministically; the agent's own profit-taking stays judgment.
- Crystallization math untouched.
- Downstream (Tier 3): research-driven gameplan sessions (screener/correlation tools) whose plans must be executable — this brief's outputs are what make them executable.

## ⚠ Honest framing (unchanged, and central)
Ask 3 **overturns a documented, principled reversal**: `compileBuild.js` omits `profitTarget` from enforcement *citing §9 — enforcing it "would promise enforcement the engine does not deliver."* That was correct when no executor existed. The proposal is to make the promise deliverable, not to un-comment a line. **Fable should attack sufficiency:** does the proposed executor actually honor the promise across the edge cases below?
Separately: the shipped Contrarian constitution **already dropped** "profit-taking into resistance" (its DEF doc calls it the archetype's most distinctive trait). Ask 2 must restore-or-reject **deliberately, with reasoning recorded** — not silently.

---

## Ask 1 — Resolve the prompt contradiction (FENCED: `agentEvalPromptAssembly.js`)
- The blanket prohibition **yields to an equipped user exit rule** (SX-04 renders must not fight the framework in the same prompt).
- Sanction profit-taking and momentum-rotation as legitimate motives — aligning with the now-live `swap_type` enum, so the prompt and the schema speak one language.
- Surface the **true crystallization cost** at decision time (base ×10 **plus badge effects** — `Gain%` alone is optimistically biased for degraded positions). Neutral information, not deterrent.
**Fable's design questions:** precedence language across framework / constraints / preferences / archetype stance; **what replaces the prohibition's anti-churn restraining function** (it exists partly because the model over-trades — removing it without a replacement discipline invites the churn the ledger already shows).

## Ask 2 — Per-archetype gains-stances (FENCED: identity blocks; content from the DEF docs)
- **Contrarian:** asymmetric exits — active profit-taking into resistance — **previously dropped from the shipped constitution; restore or rule against, with reasoning.**
- **Trend-Follower:** never cuts strength early; banks via tightened trails on confirmed reversal.
- **Speculator:** in fast, out fast; banks outsized spikes (forcedRotation already ON).
- **Fundamental Investor:** thesis-completion exits, clock-bound.
- **Capital Preserver / Diversifier:** per their DEF docs; least change.
**Fable's design question:** stances must modulate Ask 1's framework without re-creating a per-archetype contradiction — the TF-with-user-target case resolves by TF-native translation (trail-tighten to bank at no worse than X), not refusal and not fold.

## Ask 3 — The profitTarget deterministic executor (compiler NON-fenced; executor FENCED: risk/guardrail path)
Make a **user-set** target enforce, mirroring stop-loss (#9 — the proven precedent):
- `profitTarget` enters `SUPPORTED_GUARDRAIL_SHAPES` **only together with** a real executor: deterministic winner-side check, model-independent, stamping `exitReason:'profit_target'`.
- Scope: **user-set targets only** (Exit Discipline / the coming per-position lever). Agent-discretionary profit-taking stays character (Asks 1–2). Category A/B applied to the gain side.
- **Edge cases to resolve (expanded per T1):**
  - Gap-through (price blows past target between evals) — fire at next eval at market, or arm a trail?
  - LOCK interaction (position within 0.2×ATR of a bonus threshold — does an imminent badge defer the target?).
  - Target hit during a gameplan-suppression day; stop and target both armed; which fires on the same tick.
  - **Provenance purity (T1-b):** the executor's swap must not inherit/emit stale model-side fields (`swap_type` etc.) anywhere in the pipeline.
  - **Keyed-subsystem integration (T1-a):** which of the four `exitReason`-keyed systems should recognize `'profit_target'` — learning allowlist (recommend yes), hurdle gate (fenced; deterministic exits may bypass it as stops do — verify), receipt source, calibration partition. Explicit list, not discovery.
- **The §9 test:** after this, UI promise === engine delivery, exactly. (`maxPosition`'s label lie is fixed; profitTarget must launch promise-true.)

## Out of scope (unchanged)
Directive-gate numeric translation + per-position conversational lever (Tier 3, with archetype-integrity). Research tools for agents / gameplan sessions (Tier 3 anchor — the executor and precedence design should anticipate research-produced directives as future input). Crystallization math, scoring, HOLD/SWAP action space beyond the shipped motive enum.

## Process
Fable design review (attack all three asks; Ask 3's edge cases and Ask 1's anti-churn replacement hardest) → founder rules per-ask → §7 gated build: dual adversarial review on every fenced diff, `/code-review` at high effort regardless of size, calibration smoke where `agentArchetypeConfig`-adjacent, phased dark flags. Attach the Tier 1 motive baseline when ~a week has accrued.
