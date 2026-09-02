# Exit-Behavior Rebalance — Ask 2 (Rescoped) Phase 0 Anchor-Confirm (build gate)

**Date:** 2026-09-02
**Serves:** the Ask 2 (Rescoped) Build Kickoff V1 (2026-09-01) · reads with `20260819_EXIT_BEHAVIOR_ASK1_BUILD_REVIEW` (Ask 1 record), `20260815_EXIT_BEHAVIOR_TIER2_FOUNDER_RULINGS_V1` (R8, four-layer precedence), `20260816_…_ADDENDUM_V1_1`, `EXIT_BEHAVIOR_REBALANCE_TIER2_FABLE_DESIGN_REVIEW_V1` (F10), `20260819_EXIT_BEHAVIOR_ASK3_BUILD_REVIEW` (§8 module-scope lesson), `DR13_EVAL_IDENTITY_BLOCK_ARC_BRIEF` (the 840-decision harness record).
**Type:** READ-ONLY anchor-confirm (BUILD_RULES §3). No code written, no file staged. **HARD STOP for founder review.**

## Session preamble (BUILD_RULES §2 / §3)

| | |
|---|---|
| **Branch** | `claude/ask2-kickoff-v1-rescoped-qo34tm` |
| **HEAD SHA** | `de4113fd9821719bfcaef38b5cad7ee100e6edf3` |
| **Base** | Identical to `origin/main` (`de4113fd`, "Merge #801") — 0 commits ahead, fresh off main |
| **Tree** | Clean (`git status --short` empty) |
| **`git fetch origin`** | Run as the first action of the session (§3); `origin/main` re-confirmed at `de4113fd` |
| **Mode** | READ-ONLY. Reading fenced files is §1-permitted; nothing edited or staged |

---

## EXECUTIVE VERDICT

| # | Gate | Verdict | One line |
|---|---|---|---|
| 1 | The 13 MUST anchors (tiered) | **PASS — all 13 exact at HEAD** | Zero drift from the pre-check's line numbers; the flat6 twins are enumerated below (§2) since the pre-check gave tiered lines only |
| 2 | Harness coordination (`evalIdentityBlocks.js`) | **CLEAR — proceed** | Last touched by `5a23d001` (2026-08-10, wire-a7 merge); no branch anywhere has touched it since (`git log --all --since=2026-08-10`) — the parallel harness workstream has not entered the file |
| 3 | The §8 CONVICTION framing (bookmark: "can silently nullify a user's profit target") | **STALE — corrected** | The executor is model-independent: `applyGuardrails` block 2c fires on gain-from-entry vs target, then `agent-evaluate.js:2114-2125` overwrites the model's decision and floors conviction to 70. A conviction HOLD cannot block a deployed target. The MUSTs' real cost is narrower: they constrain the **discretionary** profit-taking/rotation Ask 1 sanctioned, and rule-driven swaps below X |
| 4 | The A9 tension (R8 clause vs "the block is inert") | **CONFIRMED as stated — honesty fix only** | The harness's `actionDivergence` compares `decision` and `symbols` only (`scripts/paired-eval-harness.js:200-201`, `:386-387`); `conviction` is extracted (`:98`) but never compared; `rationale` is never extracted. The yield clause therefore ships as an honesty fix with **no** behavioral claim (§4) |
| 5 | Which surface is "the compiler" for SX-04 × mb-08 | **RESOLVED — `compileBuild.js`, with a consequence** | It is the ONE place both halves are visible (`userGuardrails` = `deployedStrategy.guardrails`, and the rule set). But it runs only under `COMPILER_ENABLED`, which is `false` and `DARK_BY_DESIGN`. The declaration will be **doubly dark** in production until the compiler flips (§6) — founder decision 3 |
| 6 | Precedence documents | **4 of 5 ABSENT from the repo** | `20260822_ASK2_REQUIREMENTS_BOOKMARK`, `ARCHETYPE_AGENT_AUDIT_20260821`, `PRE_ASK2_RULES_PRECEDENCE_CHECK`, `20260831_COMMAND_CENTER_UNIFICATION_HANDOVER` are not in any tree or branch. The kickoff carried everything load-bearing; every claim was re-verified against code instead (§1) |
| 7 | Ready to build? | **YES — pending 5 founder decisions (§10)** | None is blocking-by-safety; each changes what ships or what the prompt says, so they are yours |

---

## 1. Document availability (read this first)

Searched by filename and by content across the working tree and every remote branch (`find`, `grep -rIl`, `git log --all`): the four documents above are **not present**. What was used instead, all in-repo and read this session: the Ask 1 build record; Founder Rulings V1 + Addendum V1.1 (R8, R10, the four-layer precedence); Fable Design Review V1 (F10 — the origin of the SX-04 × mb-08 ruling and the yield clause); Brief V2; the Tier 2 Phase-0 verification; the Ask 3 build record (§8 — the module-scope flag lesson); `DR13_EVAL_IDENTITY_BLOCK_ARC_BRIEF.md:34` (the 840-paired-decision record) and `scripts/paired-eval-harness.js` (what it actually compared). `docs/audits/RANKS_ARCHETYPE_AUDIT_PHASE0_FINDINGS.md` (uploaded 2026-09-01) is a different audit (rank weights), not the archetype/agent audit the kickoff cites.

**Consequence:** the bookmark's *authored* content (the six gains-stances) is out of scope anyway; the pre-check's enumeration is reproduced in the kickoff and was verified line-by-line here. Nothing in this build depends on the absent documents' text. If the bookmark's exact §8 wording matters for the record, attach it and I will quote it rather than paraphrase.

---

## 2. Anchor-confirm — the 13 MUSTs at HEAD `de4113fd` (all VERIFIED by reading the line)

Both prompt variants live in `api/_utils/agentEvalPromptAssembly.js`: tiered `buildEvalSystemPrompt` (`:199-409`) and flat6 `buildFlat6EvalSystemPrompt` (`:424-628`). Three of the 13 are already rendered from **shared helpers** (Ask 1's pattern) and therefore have one site; the identity-block trailer (`buildAgentIdentityBlock`, `:637-734`) is variant-neutral.

| # | MUST | Tiered (pre-check line → HEAD) | flat6 twin | Judgment | Reasoning |
|---|---|---|---|---|---|
| 1 | DEFAULT TO HOLD — "You need a compelling, data-backed reason to trade" | `:225` ✓ (`:225-227`) | `:446-448` | **QUALIFY** | An equipped user rule *is* a compelling reason; today the sentence lets the framework default outrank it |
| 2 | EV prohibition — "Do NOT sell a winner just to bank…" | `:92-98` ✓ | shared helper `renderEvSection` (`:89-120`) | **NO EDIT — already yielded** | `PROFIT_TARGET_EXECUTOR_ENABLED` is `true` at HEAD (`featureFlags.js:1845`), so `:92-98` is now the **deliberate-revert branch**, not live prose. The live branch (`:107-119`) already says "An exit needs a reason — a rule, a target, a thesis change…". Qualifying the dead branch would break the revert path's byte-identity for nothing |
| 3 | RELATIVE STRENGTH — "Do not panic-sell outperformers" | `:231-233` ✓ (`:231-234`) | `:452-455` | **QUALIFY** | A user's exit rule may legitimately sell an outperformer at its target |
| 4 | Late battle DEFENSIVE ONLY — "Do NOT chase momentum late" | `:241-243` ✓ | `:462-464` | **QUALIFY** | A user's equipped momentum/rotation rule can call for an offensive late swap; the framework default must not silently veto it |
| 5 | THRESHOLD PROXIMITY — "within 0.2x ATR of a bonus, HOLD" | `:250-254` ✓ | `:470-474` | **QUALIFY** | Prompt-layer only. The deterministic bonus-proximity LOCK (`agentRiskManager`, R6 deference) is a separate layer-1 fact and stays absolute at #10 |
| 6 | SECTOR AWARENESS — "Do not swap … same sector" | `:256-258` ✓ | `:476-478` | **QUALIFY** | A user's sector rule can prefer the same sector |
| 7 | §8 CONVICTION 70% — "you MUST output HOLD" | `:260-263` ✓ | `:480-483` | **QUALIFY, with the framing corrected (§3)** | Constrains discretionary and rule-driven swaps only; never the executor |
| 8 | NR7 — "Do NOT swap out NR7 stocks unless bleeding" | `:275-277` ✓ | `:495-497` | **QUALIFY** | A signal heuristic, not a floor |
| 9 | Distressed — "STRICT EXCLUSION. Do NOT buy distressed" | `:300-301` ✓ | `:520-521` | **KEEP ABSOLUTE** | It mirrors a deterministic engine check: a Haiku SWAP into a distressed name is blocked at `agent-evaluate.js:2149-2154`, and the forced-exit replacement defers on distressed (`agentGuardrails.js:526-548`, `agent-evaluate.js:3489-3496`). Qualifying the prose would promise a user rule can do what the engine refuses (the maxPosition label-lie class) |
| 10 | LOCKED — "LOCKED positions CANNOT be swapped out" | `:314` ✓ | `:533` | **KEEP ABSOLUTE** | Layer-1 fact: the risk LOCK is enforced deterministically (`agent-evaluate.js:2142`; guardrail `blocked_by_lock`) |
| 11 | ANTI-THRASH (COOLDOWN / ONE SWAP / NO ROUND-TRIPS) | `:347-354` ✓ | `:566-573` | **KEEP ABSOLUTE** | Physics: bench cooldowns, one-exit-per-eval, Knob C breaker — the anti-churn machinery R9's rollback trigger relies on. A user rule does not unlock a cooldown |
| 12 | SURVIVAL MODE — "primary directive is P&L protection" | `:192-194` ✓ (helper `renderSurvivalMode`, `:191-197`) | shared | **KEEP ABSOLUTE (and NO EDIT)** | `:193-194` is again the revert branch; the live text (`:196`) already de-frames it as a fact of the environment (Ask 1). The bust-override machinery is the one sanctioned place a platform floor overrides user directives |
| 13 | Institutional — "NEVER hold … ALWAYS override stale institutional signals" | `:711-714` ✓ | variant-neutral (identity trailer) | **QUALIFY (soft)** | Renders only when the user equipped institutional rules; the 135-day lag is a fact and stays, but "NEVER/ALWAYS" is a framework weighting default that outranks the user's own institutional rule today |

**Drift result:** zero line drift on all 13 tiered anchors. The only correction to the pre-check's framing is that #2 and #12 are now revert-path branches, not live prose (the flip landed 2026-08-26 on `claude/exit-behavior-joint-flip`, merged).

**Adjacent, un-enumerated absolutes (NOT touched unless you rule them in):** MARKET POSTURE `selective: Only swap on >80% conviction` / `defensive: Swaps are defensive only` (`:284-286`, `:504-506`); CLOCK mid-battle `>80%` (`:240`, `:461`); FORGE RULES "you must obey them unless Survival Mode activates" (`:342`, `:561` — this one already yields to the user's own rules by construction); S5 exit rule (`:307-308`). Scope discipline (§8) says list, don't creep.

---

## 3. The §8 framing, corrected (VERIFIED chain)

- `agentGuardrails.js:311-350` (block 2c): with the executor flag live and no stop breach, `pickBestTargetBreach` (`:640-666`) selects the most-breaching over-target position from gain-from-entry vs `targetFor(pos, value)`; `haikuResult` contributes only `originalDecision` to the override record.
- `agent-evaluate.js:2095-2103` calls it; `:2114-2125` materializes the forced SWAP over whatever the model said, and `:2123` sets `conviction: Math.max(haikuResult?.conviction || 0, 70)` — the §8 floor is *satisfied by construction* on a forced exit.
- On suppression ticks the R11 pass runs the same executor (`api/cron/agent-evaluate.js:3399-3403`).

**Therefore:** a conviction MUST cannot block a deployed profit target. The bookmark's "can silently nullify a user's profit target" was true pre-Ask-3 and is stale now. What the 13 MUSTs actually cost today: (a) the discretionary profit-taking and momentum rotation Ask 1 sanctioned; (b) swaps a user's *soft or prompt-layer* rule calls for (mb-08, th-05, sector/momentum rules), which the framework's HOLD defaults can still out-vote; (c) nothing on the deterministic target. The build record will say exactly this.

---

## 4. The A9 tension, stated honestly

`DR13_EVAL_IDENTITY_BLOCK_ARC_BRIEF.md:34` records 840 paired decisions, zero decision drift, and *interprets* the block as "conviction + rationale framing". The harness (`scripts/paired-eval-harness.js`) extracts `decision/symbolOut/symbolIn/conviction` (`:95-98`) and computes divergence on `decision` and `symbols` only (`:200-201`, `:386-387`). Conviction is never compared; rationale never extracted. So "identity-consistent reasoning" is an unmeasured assertion riding a measured null, exactly as the kickoff says.

Consequence for this build: the R8 yield clause corrects a shipped falsehood — `evalIdentityBlocks.js:58` ("refine … but never reverse") vs the engine that ranks `user_equipped: 1, archetype_default: 2` (`src/utils/ruleConflictReconciler.js:46-49`), drops the loser (`:444-446`), and is wired live at `api/agent/decide.js:262-265` under `CONFLICT_RECONCILER_INJECT_ENABLED = true` (`featureFlags.js:681`). It is **not** claimed to unblock profit-taking. If `profit_take` stays at zero post-Ask-2, the explanation lies on the measured-effective surface: the MUSTs of §2 (this build), no winner crossing a plausible threshold, or no equipped target.

---

## 5. Item 2 — the yield clause (mechanics)

- **Anchor:** `EVAL_IDENTITY_SUBORDINATION_CLAUSE`, `api/_utils/evalIdentityBlocks.js:57-58`; rendered once after every archetype render at `:176`; byte-locked by `evalIdentityBlocks.test.js:128-134`; block shape locked by `evalIdentityBlocks.flagOn.test.js:53-59`; 12 flag-on prompt snapshots in `evalIdentityBlock.injection.test.js` (`__dr13_snapshots__/`).
- **Live state:** `EVAL_IDENTITY_BLOCK_ENABLED = true` (`featureFlags.js:1503`) — the clause is in every eval prompt today, so the new text must sit behind the Ask 2 dark flag.
- **Plan:** keep the constant untouched (flag-off text of record); add `EVAL_IDENTITY_YIELD_CLAUSE` and a call-time `renderSubordinationClause()`; `renderEvalIdentityBlockForced` uses it. The six renders, the doc-parity lock, the 1050-char cap (renders only) and the harness `spliceEvalIdentityBlock` equivalence are untouched. Tests: byte-lock the new constant, assert the flag-on block shape, flag-off unchanged.
- **Proposed flag-on text (founder decision 1):**
  > Platform limits and enforced values override this identity. Equipped exit rules outrank my instinct: your equipped rules decide WHETHER an exit happens; this identity shapes only HOW.
  It carries R8's phrase verbatim and Ask 1's HOW/WHETHER vocabulary (`renderPrecedenceBlock`, `:129`). It reads as the agent's own subordination statement, as the identity blocks do.
- **Budget:** +~90 chars per prompt against the M7 ceilings (`composition.m7Budget.test.js:45`, 8,000 est.; `composition.m7e2eBudget.test.js:62`, 12,000) — negligible.

---

## 6. Item 3 — SX-04 × mb-08: the compiler is the right surface, and it is dark

**Where the two halves actually live:**
- The user's target is `deployedStrategy.guardrails[type='profitTarget']`, written by Strategy Dimensions → `dimensionMapper.js:1356` → `deployStrategyService.js:158-171` → `POST update-agent-settings` (`api/agent/update-agent-settings.js:204-220`). The battle freezes it as `agentContext.deployedGuardrails` (`agentBattleService.js:190`) and the executor fires on it.
- mb-08 ("Do not swap any stock with positive P&L until it reaches the {threshold} scoring threshold", `forgeKnowledgeBase.js:720-745`) is equipped as a bundle rule (`forgeCollections.js:63/236/440`) or via traits `patient-holder` / `let-winners-run` (`traitLibrary.js:359, :472`).
- The equip-time compile (`compileOnSettingsChange.writeCompiledBuildsInTx`, `:312-435`, called by all ten settings endpoints incl. equip-bundle and update-agent-settings) hands `compileBuild()` both: `userGuardrails` (`:396`) and the rule set (bundle snapshots with `sourceRef`, `compileBuild.js:203-208`; or the unified projection `delta.projectedRules`, `:193-201`, in candidate mode). `compileBuild` is pure, reads no flags (`:3-6`), and its schema validator does not reject additive keys (`archetypeBuildSchemas.js:108-…`).
- Neither existing conflict mechanism can see the pair: `FORGE_CONFLICT_PAIRS` (`forgeKnowledgeBase.js:3786`) is checked client-side on bundle add and sees bundle rules only; the reconciler's equip-time DETECT (`api/agent/equip-bundle.js:195-206`) reconciles bundle snapshots through a four-template descriptor table (`ruleConflictReconciler.js:74-115`) that knows neither sx-04 nor mb-08. `projectActiveRules` (`api/_utils/projectActiveRules.js:66-114`) is pure additive set-union — confirmed.

**The consequence to rule on:** `COMPILER_ENABLED = false`, `DARK_BY_DESIGN` ("flips ONLY via a deliberate founder PR with a green gate", `flagPinGuard.test.js:59-60`). A declaration built into `compileBuild` is therefore behind **two** dark flags and reaches no user until the compiler flips. That is consistent with R8's letter ("the compiler flags…") and with this build's dark contract, but it is not a live equip-time warning today.

**Proposed shape (Option A, recommended — R8's letter):** a pure detector in a new non-fenced module returning e.g. `[{ code: 'profit_target_vs_hold_veto', guardrailType: 'profitTarget', ruleId, sourceRef: 'mb-08', host: 'bundle'|'trait'|'projection', resolution: 'executor_wins', message }]`; `compileBuild` takes an opt-in input (purity kept: the caller reads the Ask 2 flag at call time inside the `enabled` path only, so dark endpoints never touch it); key present only when non-empty → dark builds' bytes and `contentHash` unchanged; surfaced on the CompiledBuild doc and in the `compilePreviews` response payload. **Coverage note:** in legacy compile mode trait-hosted rules are not in the equipped-bundle snapshots at all (only the PR 3.5 unified projection sees them). To cover the trait path without new Firestore reads I propose consulting `equippedTraits` against `traitLibrary.js` rule ids (labelled "by trait definition"). Founder decision 3 covers both the double-dark acceptance and the trait coverage.

**Option B (not recommended):** a non-dropping "declared" entry in the reconciler's equip-time report so the live toast shows it. It would need the reconciler to learn the profit-target guardrail (a deployedStrategy read at equip-bundle time), a `RECONCILER_VERSION` bump, and copy-rule work in `conflictSurfaceCopy.js` — a wider blast radius on a live surface than the kickoff sanctions.

Note for the record: sx-04 the *rule* carries `modes: 'season'` (`forgeKnowledgeBase.js:3380`); the pair detection keys on the profitTarget **guardrail**, not the sx-04 rule row, so `ruleModeGate` does not interfere.

---

## 7. Flag plan (founder decision 2 — the name)

- One new dark flag gates all three surfaces (the F11 one-flag discipline): proposed `EQUIPPED_RULE_PRECEDENCE_ENABLED = false` in `src/config/featureFlags.js` with a `// Pinned by:` pointer; dark pin `src/config/equippedRulePrecedenceFlags.test.js` (the `commandCenterSyncFlags.test.js` template); `DARK_BY_DESIGN` entry with runway note ("Ask 2 rescoped — flips after Ask 1+3 per R10, in its own one-line PR").
- **Every read is call-time** (`agentEvalPromptAssembly.js` helpers; `evalIdentityBlocks.js` clause renderer; `compileOnSettingsChange` inside the enabled path). Blast radius: ~34 test files mock `featureFlags` with hermetic whitelist factories; the ones that exercise `buildEvalSystemPrompt`/`buildAgentIdentityBlock`/`renderEvalIdentityBlock` under such a mock will need the new flag listed (the Ask 3 §8 per-file fix, explicit `false`, never a blanket `importOriginal` conversion). The full-suite run with exit code asserted is the mandatory check.

## 8. Goldens plan (acceptance 4)

Capture flag-off goldens from a reconstructed pre-edit tree (`git archive de4113fd`) under the LIVE flags (`PROFIT_TARGET_EXECUTOR_ENABLED=true`, `EVAL_IDENTITY_BLOCK_ENABLED=true`): both variants × six archetype keys (the DR-13 grid) + the identity-block trailer on the Ask 1 fixture (`__fixtures__/ask1PromptFixtures.js`, reused). Red-first flag-on suite written before the edit. Existing locks stay untouched and green: the 12 DR-13 snapshots, the P4 battery snapshots, the Ask 1 goldens (which pin the Ask-1-dark state), the clause byte-lock.

---

## 9. Fence statement (planned)

Fenced files to be edited: `api/_utils/agentEvalPromptAssembly.js` (the qualifiable MUSTs, helpers) and `api/_utils/evalIdentityBlocks.js` (clause only). No other fenced file. `agentArchetypeConfig.js` untouched (R5). No new `./` import enters the fenced assembler (the honesty tripwire surface is unchanged; the flag import already exists). No voice-layer file (`voiceLayerPrompt.js`, `archetypeAdjustments.js`) touched. Gate-7 locked call forms NO-EDIT.

---

## 10. Founder decisions at this STOP

1. **Yield clause text** — approve §5's wording, or supply the exact sentence you want byte-locked.
2. **Flag name** — `EQUIPPED_RULE_PRECEDENCE_ENABLED` (one flag, three surfaces), or a name of your choosing.
3. **Compiler declaration** — accept Option A knowing it is doubly dark until `COMPILER_ENABLED` flips; and include trait-hosted mb-08 coverage via the trait library (recommended) or bundle/projection coverage only.
4. **The four absolutes** — confirm #9 distressed, #10 LOCKED, #11 ANTI-THRASH, #12 SURVIVAL stay unqualified (my reasoning in §2), and #2 EV stays a no-edit (revert branch).
5. **Adjacent absolutes** — leave the un-enumerated MARKET POSTURE / CLOCK `>80%` / S5 lines untouched (my default), or rule them in.

## 11. Found, not fixed (§3 register)

- The four precedence documents are absent from the repo (§1) — attach if the record should quote them.
- The Ask 1 record's separate-tasking items (C-2 flat6 tier-multiplier stamp; CR-2 Tier-3 override hook; the explicit-object `featureFlags` mock migration) remain open and unrelated to this build.

**HARD STOP.** No code written. Awaiting the five decisions before the dark build begins.
