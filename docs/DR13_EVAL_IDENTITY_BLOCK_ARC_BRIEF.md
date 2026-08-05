# CC ARC BRIEF — DR-13 Eval Identity Block (Archetype Constitutions → Live Swap Decisions)

**Date:** July 24, 2026 · **Program:** Archetype Architecture Phase 3, build track · **ONE TASK = ONE BRANCH.**
**Objective:** inject a versioned, mechanically-locked archetype identity block into the Haiku eval/swap system prompt — the channel that currently carries **zero** archetype constraint language (verified: `agentEvalPromptAssembly.js` never imports `ARCHETYPE_CONSTRAINTS`). This is the highest-value unbuilt item in the program: it is the only carrier of quality-floor and evidence-hierarchy language into swap decisions until deterministic substrates ship.

**⚠ FENCE:** `agentEvalPromptAssembly.js` is fenced (BUILD_RULES §1, added Jun 2026). The injection commit is a fence contact → **§7 sign-off required**. Phase 0 is read-only with a hard STOP.

---

## Phase 0 — Read-only discovery (STOP for founder review before any code)

1. Current `buildEvalSystemPrompt` structure (`agentEvalPromptAssembly.js`, called from `agent-evaluate.js:~1923`): section order, where archetype context (if any) currently appears, and the correct insertion point for an identity block — **early, before equipped-rule text, so identity frames rules**.
2. Token budget: current prompt size distribution per eval call; headroom for +175 tokens; per-tick cost impact at current Haiku pricing and call volume (the eval-budget history makes this a founder-visible number, not a footnote).
3. Archetype key availability at the call site (how the assembler learns which of the six archetypes is deciding), and behavior on unknown/missing key.
4. Existing off-state/byte-identity test patterns for this file (the P4-equivalence style) to reuse.
5. Confirm no other consumer of the prompt would break on a new leading section (schema/regex consumers, shadow logger).

## Design (pre-ruled — flag disagreements in Phase 0 rather than deviating silently)

**Source of truth:** the six golden renders in `docs/CONSTITUTION_*.md` (founder-approved, reviewer-locked, ≤175 tokens each). V1 ships them as **frozen constants** in a new unfenced module `api/_utils/evalIdentityBlocks.js`, keyed by archetype (`momentum_chaser`…`guardian`), each stamped `{promptSpecVersion, kernelIdentityVersion}`.

**The mechanical lock (this is what makes constants acceptable under DR-13's "never hand-authored" ruling):** a test **parses the golden-render blockquote out of each constitution markdown file and asserts byte-equality with the shipped constant**. Doc and code cannot drift; an edit to either without the other fails CI (which now exists and runs — #670). Plus a token-cap test (≤175 per render, tiktoken-approximate is fine) and a six-key completeness test. The true field-level renderer (assembling from registry kernel fields) is the registry-composition arc's job later; these tests make the constants a safe bridge, not a fork.

**Injection:** one guarded block in `buildEvalSystemPrompt` behind a new flag `EVAL_IDENTITY_BLOCK_ENABLED` (default **false**). Unknown/missing archetype key → **omit the block and log** (never substitute a default identity — a wrong identity is worse than none). Flag-off = **byte-identical prompt**, asserted by test.

**Commits:**
1. `evalIdentityBlocks.js` + doc-parity/token/completeness tests + flag (false) — fully dark, no fenced contact.
2. Fenced injection in `agentEvalPromptAssembly.js` + off-state byte-identity test + on-state golden prompt test (one full prompt snapshot per archetype with the flag forced on in-test). **This commit carries the §7 sign-off.**

## Validation before any flip (the flip PR is separate and founder-gated)

**Offline paired-eval harness** (script, not production): for a sample of recent real eval inputs (reuse shadow/fixture data where available; otherwise synthetic fixtures for all six archetypes), render the system prompt flag-off and flag-on, and emit: the diff (should be exactly the identity block), token deltas, and — if cheap to run — paired Haiku decisions on N≥10 identical inputs per archetype for founder review of decision drift. Deliver the harness output as a file with the Commit-2 handback. **No flip in this arc**; the flip PR follows founder review of the harness output, same pattern as #660.

> **UPDATE (DR-13 endgame — flip landed):** validation delivered via the `--dr13` battery in `scripts/paired-eval-harness.js` — 60 real-data swap-eligible fixtures × both variants across temperature 0 and 0.4 (k=3), **840 paired decisions, zero decision drift**; the block's effect is conviction + rationale framing, not measurable decision change at current gate settings. The flip (`EVAL_IDENTITY_BLOCK_ENABLED = true`) shipped in the founder flag-flip PR, sequenced **after** the separate `max_tokens 1024→2048` truncation-headroom PR (recent evals averaged 907/1024 output tokens with ~21% silently truncating the rationale tail).

## Out of scope
Registry field-level renderer · compat-cell content · any change to equipped-rule text or `ARCHETYPE_CONSTRAINTS` · prompt restructuring beyond the single inserted block · the flip itself.

**Handback per commit:** diff summary, test counts, and for Commit 2 the §7 disclosure + harness file. Founder merges manually; no PR subscriptions.
