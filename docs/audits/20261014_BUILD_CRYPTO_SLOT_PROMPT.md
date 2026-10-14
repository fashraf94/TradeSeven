# Build — Crypto Slot paragraph (prompt-only, dark) + replay probe

**Date:** 14 Oct 2026 · **Prompt:** Fable, "BUILD PROMPT — Crypto Slot paragraph (prompt-only, dark) + replay probe", 14 Oct 2026 · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Base:** `main` @ `d5d8fa9b` (= `origin/main` after `git fetch origin`, re-fetched before the final checks: unchanged) · **Branch:** local `claude/crypto-slot-prompt-2786d6` (the app's worktree suffix), pushed by refspec as `claude/crypto-slot-prompt` · **Governing discovery:** `docs/audits/20261014_PHASE0_CRYPTO_SLOT.md` (commit `7d27c812`, cherry-picked here as `4209023e`) · **Report back to:** the Fable chat that issued the prompt.

**Fence contact:** `api/_utils/agentEvalPromptAssembly.js` (BUILD_RULES §1) — one import (with its comment) and one interpolation. §7-gated: §2 quotes the hunk in full for Flash's sign-off. **Do not merge before that sign-off.**

---

## Verdict

| Item | Result |
|---|---|
| The paragraph | Built as Fable wrote it, in the tiered (BaggerBomb agent game) eval system prompt only, between SCORING RULES and DECISION FRAMEWORK. The symbols are read from `CRYPTO_ASSETS`, never typed. |
| Flag | `CRYPTO_SLOT_PROMPT_ENABLED = false`. With the flag off, every eval prompt is byte-identical to the pre-build text. This is tested against a capture from the clean tree, and a reviewer independently confirmed it over 604 renders. |
| Fenced diff | `agentEvalPromptAssembly.js`: 10 lines added and 1 removed. That is an import with an 8-line comment, plus `${renderCryptoSlotBlock()}` in place of one blank line (§2). |
| Tests | Full Linux suite, CI-shaped: the baseline had 949 files with 0 failing. The final run (`ac6ba27e`, after the review fixes) has 951 files with 0 failing. The two extra files are the new ones. No new reds. 50 new rows. Mutation check: 29 of my mutants were all killed, and the reviewers' surviving mutants are now killed too. `vite build` is green. |
| Review (BUILD_RULES §2) | Four lenses and six independent refuters. 19 distinct findings: 0 blockers, 1 major in the build (the probe's bar) — fixed — and 1 major-rated finding that predates the build. **11 CONFIRMED, 8 PARTLY. Refuted sub-claims are listed in §5.** Every in-scope finding is fixed. Two findings predate the build and are reported for separate tasking (F7, F8). **One of them is a question for Fable before the flip (§5.3).** |
| Replay probe (§6) | **The bar FAILED.** crypto → stock fell from 26 to **10 of 144** (bar ≤ 2), and from 26 to **9 of the 26** refused (bar 0). The 14 refused checks that switched to BTC → ETH would all be refused by the hurdle (ETH down on the day). 0 replies talk about shorting. The block costs 222 tokens. Spend: $1.64. Per prompt §6.5: no re-wording, PR stays draft, **STOP for Fable** (§6 "Reading it"). |
| Flip | Not in this PR. §7 has the checklist. The dry run passed: the control turned exactly the 10 expected rows red; the full checklist moved exactly 10 files and left 0 failing. |

---

## §0 Gate

| Fact | Value |
|---|---|
| Session opening | Branch `claude/crypto-slot-prompt-2786d6`, HEAD `d5d8fa9b`, tree clean. |
| `git fetch origin` | Done first. `origin/main` = `d5d8fa9b` (Merge #957). Re-fetched before the final checks: unchanged, so the branch is the merged tree. |
| Phase 0 commit | `git fetch origin claude/phase0-crypto-slot` returned `7d27c812`. It contains `docs/audits/20261014_PHASE0_CRYPTO_SLOT.md` (one file, 450 lines). It was cherry-picked as the branch's first commit, `4209023e`. |
| Drift from the Phase 0's lines | **None.** The Phase 0 was read at `d5d8fa9b`, which is this build's base. Every line the build edits or relies on was re-read at HEAD: the splice point (`agentEvalPromptAssembly.js:362-364` before the edit), the identity pattern (`evalIdentityBlocks.js:148-151`, `:172-180`, anchor `:216`), the registry (`promptHonestyRegistry.js:46-58`), the pin pattern (`featureFlags.js:2103-2104`), the guard (`flagPinGuard.test.js:58-235`, integrity row `:385-397`), the ask1 mock (`ask1.test.js:27-36`), and the cron mocks (`offGolden.test.js:103-107`, `rollback.test.js:78-82`, `meetingCopy.baseline.test.js:69-72`). |
| Baseline suite | Run on **Linux**: WSL Ubuntu, a private clone at `4209023e`, `TZ=UTC`, `vitest run --maxWorkers=2` (the CI shape). Result: **949 files, 20,219 tests, 0 failing**, 88 skipped, exit 0. The baseline failing set is **∅**. I used Linux rather than the CRLF Windows checkout because its known platform-only reds would have turned "no new reds" into a set comparison instead of a zero. |
| Pre-change capture (§4.5) | Taken from the clean tree before any edit: six archetypes × tiered + flat6, live flags, with `EQUIPPED_RULE_PRECEDENCE_ENABLED` pinned false. At capture, the undefined-mode render was asserted equal to the tiered one. Committed as `api/_utils/__fixtures__/cryptoSlotPromptGoldens.json` (SHA-256 `019b6f39…41ce1`). Cross-check: all 12 prompts equal the Ask 2 goldens of record (`ask2PromptGoldens.json`) byte for byte. |

---

## §1 In plain terms

1. When the flag is turned on, the Trading Brain in the BaggerBomb agent game gets one short block that says what the game already enforces:
   - its third Support slot holds its one crypto (BTC, ETH, SOL, XRP, DOGE, ADA or BNB);
   - a crypto swaps only for a crypto, and a stock only for a stock;
   - so the crypto slot's moves are hold, or swap for the one crypto on the bench (cooldown, conviction and the hurdle floor still apply);
   - the sector-rotation rule is for stock slots only;
   - every position is long, and it cannot open or flip a short.
2. Nothing changes for the player until the flag is flipped. Today the flag is off and every prompt is byte-for-byte what it was.
3. The tournament (six stocks, no crypto) never gets the block. A test proves no "crypto" reaches its **system prompt** at either flag state; the build adds nothing anywhere else in the tournament.
4. The probe: with the block, the model proposed selling the crypto for a stock 10 times in 144 checks, against 26 without it. That misses Fable's bar (2 or fewer, and none on the 26 checks that were refused before). On those 26 it mostly switched to selling BTC for ETH on days ETH was down, which the game also refuses. The platform's own risk line was telling it to sell BTC on most of those checks. The PR stays draft for Fable.

---

## §2 The fenced hunk — for Flash's sign-off

`api/_utils/agentEvalPromptAssembly.js`, `git diff d5d8fa9b HEAD`, the whole fenced diff:

```diff
@@ -50,6 +50,15 @@ import { renderEvalIdentityBlock } from './evalIdentityBlocks.js';
 // byte-identical (the DR-13 flag-split pattern: fenced diff = this import +
 // one call site below).
 import { buildFundamentalsBlock } from './fundamentalsRender.js';
+// Crypto Slot paragraph (§7-gated fence contact, Fable build prompt
+// 2026-10-14; merges only with the founder's sign-off on this hunk —
+// docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md §2): the tiered template's YOUR
+// CRYPTO SLOT block — non-fenced pure module, dark behind
+// CRYPTO_SLOT_PROMPT_ENABLED; '' while dark, so the tiered template stays
+// byte-identical (the DR-13 flag-split pattern: this import + one
+// interpolation below; registered in PROMPT_CONTRIBUTING_MODULES in this
+// same commit). The flat6 template never carries it — no crypto there.
+import { renderCryptoSlotBlock } from './evalCryptoSlotBlock.js';
 
 // ==================== SYSTEM PROMPT ====================
 
@@ -360,7 +369,7 @@ Threshold penalties:
   -2.0x ATR → Meltdown: -35 pts
 
 When you swap out an asset, its current points are LOCKED permanently. The incoming asset starts scoring fresh from its price at swap time.
-
+${renderCryptoSlotBlock()}
 ━━━ DECISION FRAMEWORK ━━━
 
 ${renderDefaultToHold()}
```

| Changed line(s) | In plain words |
|---|---|
| `+// Crypto Slot paragraph …` (8 comment lines) | A note for the next reader. It says what the import is, that it is dark, that it follows the identity block's pattern, that the tournament template never gets it, and that the hunk merges only with your sign-off. Comments never reach the model. |
| `+import { renderCryptoSlotBlock } from './evalCryptoSlotBlock.js';` | Brings in the one function that renders the block. That function lives in a new file outside the fence. |
| `-` (a blank line) / `+${renderCryptoSlotBlock()}` | The blank line between the last scoring rule and DECISION FRAMEWORK now holds the block. With the flag **off**, the function returns nothing, so the line stays blank exactly as before. With the flag **on**, it returns the block, framed so there is one blank line above it and one below. This change is in the tiered template only. The tournament template has an identical-looking line (`:576-577` at HEAD), and that line is untouched. |

**What the model sees when the flag is on.** These are the bytes `renderCryptoSlotBlockForced()` returns, at that line:

```
…starts scoring fresh from its price at swap time.

━━━ YOUR CRYPTO SLOT ━━━

Your portfolio holds six stocks and one crypto. The crypto sits in your third Support slot. The crypto names in this game are BTC, ETH, SOL, XRP, DOGE, ADA and BNB — go by the symbol, since the Sector column can read Unknown after a swap.
- Crypto swaps only for crypto, and a stock swaps only for a stock. The platform refuses any swap that pairs a crypto with a stock, and that check ends as a HOLD.
- So your crypto slot has two moves: hold it, or swap it for the one crypto on your bench. The usual swap checks apply to that swap too: cooldown, conviction, and the hurdle floor (the incoming crypto must be up on the day and clear the one you hold by a margin).
- The SECTOR AWARENESS guidance applies to your stock slots only.
- Every position you hold, crypto included, is long. You cannot open or flip a short.

━━━ DECISION FRAMEWORK ━━━
```

**Formatting choices**, stated so they can be checked:
- The banner is followed by one blank line (prompt §4.1: `\n━━━ YOUR CRYPTO SLOT ━━━\n\n<paragraph>\n`).
- The paragraph is exactly §3's five lines, one line each and unwrapped.
- There is no blank line between the first sentence and the bullets, because §3 shows none.
- The words are §3's, unchanged. `{SYMBOLS}` is built from `CRYPTO_ASSETS` at call time.

### How each sentence is backed (final wording, at HEAD)

The Phase 0's table (§3 there) was written for its draft wording. This table replaces it for the final text. Sources:
- I read every citation in this session, or a review lens or refuter read it at `89774037`.
- `git diff d5d8fa9b HEAD` touches none of the non-test files cited: `api/cron/`, `api/agent/`, `agentSwapExecution.js`, `agentRiskManager.js`, `agentEvalToolSchema.js`.
- The "Holds except" column comes from the review (§5).

| Sentence | Backed by | Holds except |
|---|---|---|
| "six stocks and one crypto" / "third Support slot" | The draft is refused without a support crypto and a bench crypto (`api/agent/decide.js:1142-1143`). The crypto is appended last to Support (`:1258`); the fallback portfolio uses BTC/ETH (`:1210`, `:1212`). `createAgentBattle` accepts only the two modes (`agentBattleService.js:87-91`). | Two exceptions, both pre-existing. (a) After an approved gameplan-meeting leg moves the crypto out for a stock (F7, §5.3). (b) After a hand-built watchlist puts a crypto ticker into a stock slot at the draft (F8; no in-app path). |
| the seven names | `agentCryptoAssets.js:4-14`, rendered from the list at call time. Draft check `decide.js:1157-1162`. | — |
| "Sector column can read Unknown after a swap" | The executor writes no `sector` (`agentSwapExecution.js:416-424`, `:449-456`). The tables print `'Unknown'` (`agentEvalPromptAssembly.js:1483`, `:1512`). | True today; finding F1. |
| "Crypto swaps only for crypto, and a stock … for a stock" / "refuses … ends as a HOLD" | The validator's `isCrypto` match is at `agentSwapExecution.js:69-77`. It runs on every model SWAP (`agent-evaluate.js:3484`), which then becomes HOLD with `downgraded` (`:3508-3512`). The risk and guardrail exits are type-matched too (`agentRiskManager.js:445`, `agentGuardrails.js:506`). | The gameplan-meeting approval path calls `executeSwapServer` with no validator (F7, §5.3). |
| "two moves: hold it, or swap it for the one crypto on your bench" | Exactly one bench crypto, never the held symbol (`decide.js:1143`, `:1170-1172`, `:1262`). A crypto swap keeps one: the outgoing crypto replaces it (`agentSwapExecution.js:461-464`). The tool has HOLD/SWAP only (`agentEvalToolSchema.js:14`). | The platform's own risk/guardrail exits can also move the crypto. After a crypto swap, the bench crypto is the one just swapped out and is on a 24 h cooldown (`agentSwapExecution.js:455`), so in a one-day battle hold is the only move left (§5.3). |
| "cooldown, conviction, and the hurdle floor (… up on the day and clear the one you hold by a margin)" | Cooldown `agentSwapExecution.js:61-67`. Conviction ≥ 70 at `:79-82`. Hurdle at `agent-evaluate.js:3536-3590`, with `requireBenchPositive` on all six archetypes (`agentArchetypeConfig.js:57`, `:88`, `:117`, `:144`, `:175`, `:207`). "Up on the day" is `agentRiskManager.js:363`; the margin is `:367-382`. | The LOCK gate and the swap cap also apply; the prompt states both elsewhere ("LOCKED positions CANNOT be swapped out", `:448`; "ONE SWAP MAXIMUM", `:485`). The model cannot compute the margin: the held crypto's daily % is not in the prompt (only BTC's, on the macro line, `:1148`). |
| "SECTOR AWARENESS … stock slots only" | Rule 7 (`agentEvalPromptAssembly.js:297-307`); for the crypto slot, the rotation it suggests is always refused (Phase 0 Q4). | A user `maxSectorWeight` guardrail still counts the crypto (`agentGuardrails.js:776`). |
| "Every position … is long. You cannot open or flip a short." | No agent asset ever gets a `direction`: `CRYPTO_ASSETS` has none; the draft and `createAgentBattle` add only `sector` (`decide.js:1240-1241`, `agentBattleService.js:162`, `:424`). The executor takes no direction (`agentSwapExecution.js:222`) and copies only a stored one (`:425-427`). The tool has no direction field for a position (`agentEvalToolSchema.js:14`). | — |

**Fenced functions:**
- **Edited:** `buildEvalSystemPrompt`, in its tiered template literal (one interpolation). It is the only fenced function edited.
- **Not edited:** `buildFlat6EvalSystemPrompt`, `buildAgentIdentityBlock`, `buildLiveContextBlock`, and every other fenced file (`agentSwapExecution.js`, `agentScoring.js`, `decide.js`, `agentRiskManager.js`, …).
- **Called by the new tests:** `buildEvalSystemPrompt`.

---

## §3 Files changed

`git diff --stat d5d8fa9b HEAD`: 16 files before this report, 17 with it.

| File | Lines | Why |
|---|---:|---|
| `docs/audits/20261014_PHASE0_CRYPTO_SLOT.md` | +450 | The Phase 0, cherry-picked unchanged (prompt step 0.2) so it rides this PR to `main`. |
| `api/_utils/agentEvalPromptAssembly.js` (**fenced**) | +10 −1 | The splice (§2). |
| `api/_utils/evalCryptoSlotBlock.js` (new) | +119 | The block module. It imports only the flag and the crypto list, so the probe can import it in plain node. Its functions: <br>• `renderCryptoSlotBlock()`: reads the flag at call time. <br>• `renderCryptoSlotParagraph()`: the text of record; symbols from `CRYPTO_ASSETS`. <br>• `renderCryptoSlotBlockForced()`: flag-blind, for the probe (the `renderEvalIdentityBlockForced` precedent). <br>• `spliceCryptoSlotBlock()`: the probe's splice, locked by test to the flag-on production build (the `spliceEvalIdentityBlock` precedent). |
| `api/_utils/__fixtures__/promptHonestyRegistry.js` | +1 | Adds the module to `PROMPT_CONTRIBUTING_MODULES`, in the same commit as the splice (BUILD_RULES §1). The C-20 source sweep now covers it. |
| `src/config/featureFlags.js` | +43 | `CRYPTO_SLOT_PROMPT_ENABLED = false`, its docstring with THE FLIP MAP, and `// Pinned by: cryptoSlotPromptFlags.test.js`. Placed at the end of the file. |
| `src/config/cryptoSlotPromptFlags.test.js` (new) | +26 | The one-flag pin (the `equippedRulePrecedenceFlags.test.js` pattern). The row's title names no value, so the flip moves one literal. |
| `src/config/flagPinGuard.test.js` | +2 | `DARK_BY_DESIGN` entry with its runway note. Removed in the flip commit. |
| `api/_utils/agentEvalPromptAssembly.ask1.test.js` | +4 | Flip-proofing: the flag pinned `false` in its featureFlags mock. |
| `api/_utils/agentEvalPromptAssembly.ask2.test.js` | +4 | Flip-proofing. |
| `api/_utils/evalIdentityBlocks.ask2.test.js` | +3 | Flip-proofing. |
| `api/cron/agent-evaluate.callRecords.offGolden.test.js` | +2 −1 | Flip-proofing: the flag added to the object the mock returns. |
| `api/cron/agent-evaluate.callRecords.rollback.test.js` | +2 −1 | Flip-proofing. |
| `api/cron/agent-evaluate.meetingCopy.baseline.test.js` | +3 | Flip-proofing. |
| `api/_utils/evalCryptoSlotBlock.test.js` (new) | +331 | 49 rows (§4). |
| `api/_utils/__fixtures__/cryptoSlotPromptGoldens.json` (new) | +19 | The pre-change capture (§0). It is the flag-off text of record, under the flags it was captured with; the suite pins those flags, so no flip of any of them regenerates it. |
| `scripts/experiments/cryptoSlotProbe.mjs` (new) | +678 | The replay probe (§6). Writes only outside the repo. |
| `docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md` (new) | — | This report. |

**Not touched** (prompt §2 "Out"): the validator, executor, scorer, tool schema and its SHA pins, the draft path, the flat6 template, `formatRecentEvals` and its whitelist, the Voice Layer and player copy, every golden and snapshot, and F1–F6.

---

## §4 Tests

**Suite** (Linux, CI-shaped, private WSL clone, `TZ=UTC`, `--maxWorkers=2`):

| Run | Commit | Test files | Tests | Failing | Skipped | Exit |
|---|---|---:|---:|---:|---:|---:|
| Baseline | `4209023e` (= base + docs) | 949 | 20,219 | **0** | 88 | 0 |
| After the build | `aaebf8ec` | 951 (`944 passed │ 7 skipped`) | 20,269 | **0** | 88 | 0 |
| Final (after the review fixes) | `ac6ba27e` | 951 (`944 passed │ 7 skipped`) | 20,269 | **0** | 88 | 0 |

The two added files are exactly the new ones (`evalCryptoSlotBlock.test.js`, `cryptoSlotPromptFlags.test.js`), adding 50 tests. No file changed status.

**New rows:** 49 in `api/_utils/evalCryptoSlotBlock.test.js` and 1 in `src/config/cryptoSlotPromptFlags.test.js`. Four flags are mocked through getters with an `importOriginal` spread, so no row moves when any of them flips:
- the crypto flag and the Ask 2 flag are walked;
- `EVAL_IDENTITY_BLOCK_ENABLED` and `PROFIT_TARGET_EXECUTOR_ENABLED` are pinned at their capture values.

| Group | Rows | What they pin |
|---|---:|---|
| The module | 9 | <ul><li>Flag off → `''`; flag on → banner, blank line, paragraph.</li><li>The flag is read at call time (both states from one import), and the forced render ignores it.</li><li>The paragraph word for word, as a typed copy of §3 (the wording lock).</li><li>The symbol list equals `VALID_CRYPTO_SYMBOLS` joined "A, B, … and Z" and renders `BTC, ETH, SOL, XRP, DOGE, ADA and BNB`.</li><li>The render follows a mocked `CRYPTO_ASSETS`, so the list is read, not typed.</li><li>No `Do NOT sell`, forbidden signal or Ask 2 qualifier in the render or the module source.</li><li>The module is registered in `PROMPT_CONTRIBUTING_MODULES`.</li></ul> |
| Flag off | 13 | <ul><li>Each archetype's tiered prompt equals the capture, in explicit mode, `undefined` and an unknown mode.</li><li>Each flat6 prompt equals the capture.</li><li>The capture itself carries no "crypto" and exactly one anchor.</li></ul> |
| Flag on — placement | 13 | <ul><li>For each archetype × explicit / `undefined` / unknown mode, the prompt equals the capture with the block inserted at the blank line. So the block appears exactly once, after SCORING RULES and before DECISION FRAMEWORK, and nothing else moved.</li><li>The probe's splice of each flag-off prompt equals the flag-on build, **with the flag on and off**.</li><li>The splice refuses flat6, an already-spliced prompt, a prompt that already carries the banner, and a missing or doubled anchor.</li></ul> |
| flat6 | 2 | At both flag states, no flat6 system prompt contains "crypto" (case-insensitive) or the banner, and each equals the capture. This is the negative the Phase 0 (Q7) found missing. |
| Neighbours, flag on | 12 | <ul><li>Identity placement per archetype (`injection.test.js:88`'s shape), with identity before the crypto block.</li><li>The nine Ask 2 absolutes byte-identical in both variants, with Ask 2 off and on (ANTI-THRASH among them).</li><li>A sync row that fails if the Ask 2 suite's list changes and this copy does not.</li><li>Exactly seven qualifiers per prompt with both flags on.</li><li>No `Do NOT sell` in either variant.</li><li>C-20 forbidden signals absent; required signals present.</li></ul> |
| Pin | 1 | `CRYPTO_SLOT_PROMPT_ENABLED` is `false`. The flag-pin guard couples it to the `DARK_BY_DESIGN` entry. |

**Mutation check.** Run in my private clone. Each mutant was applied with an asserted single match, `node --check`ed, and run, then the clone was restored. The clone was clean after every round.

| Round | Run against | Result |
|---|---|---|
| 1 (the build) | `evalCryptoSlotBlock.test.js` + `agentEvalPromptAssembly.honesty.test.js` | **15 / 15 KILLED** |
| 2 (the review fixes) | the same suite + the probe's `selftest` | **14 / 14 KILLED** |
| Reviewer L3 | its own 22 mutants on the build head | 20 killed; its 2 survivors are among round 2's kills |

| Round 1 mutant | Rows failed | Round 2 mutant | Rows / selftest checks failed |
|---|---:|---|---:|
| Splice moved below the DECISION FRAMEWORK banner | 12 | Splice guard for an existing banner dropped (L3-6) | 1 |
| Splice moved above SCORING RULES | 18 | Splice helper uses the flag-gated render (L3-7) | 6 |
| Block added to the flat6 template | 1 | Probe: pair inverted | 11 |
| Symbol list hard-coded | 1 | Probe: every SWAP judged HOLD | 7 |
| Flag read at module scope | 21 | Probe: bar drops the refused clause | 2 |
| Flag check dropped | 8 | Probe: marker check drops the round-trip | 1 |
| Block rendered twice | 12 | Probe: last `tool_use` block read | 1 |
| Last sentence reworded to claim a short | 8 | Probe: bar ignores replies that never came back | 2 |
| "Do NOT sell" injected | 10 | Probe: bar ignores the refused count | 1 |
| Registry entry removed | 2 | Probe: malformed crypto → stock ignored | 1 |
| No blank line after the banner | 8 | Probe: tickers not normalised | 1 |
| Probe splice accepts flat6 | 1 | Probe: cap raised to $5.50 | 1 |
| Block only for the explicit tiered mode | 6 | Probe: "not up on the day" count inverted | 1 |
| Symbol join drops "and" | 10 | Probe: short detector loosened | 17 |
| Probe splice one line late | 6 | | |

**`vite build` and `lint:gate`.** All runs were in the Linux clone; `vite build` showed only the pre-existing CSS-syntax and chunk-size warnings.
- `vite build`: green at `89774037` and at `51ec041a`, the head with the complete report.
- `npm run lint:gate`: green at `51ec041a`, exit 0 with `--max-warnings 0`. It covers `scripts/` and the new test files.
- The only commit after `51ec041a` is the one adding this paragraph. `vite build` was re-run on that pushed head before the push.

**Token line (prompt §4.6).**
- **The block:** 845 characters, about 212 tokens at the repo's chars/4 convention.
- **The budget fixture:** `composition.m7e2eBudget`'s maximal eval request, run as a scratch copy with the flag forced off and on, goes from 9,093 to 9,304 estimated input tokens against its 12,000 budget. All 6 rows pass both ways.
- **The Phase 0's caution stands.** That fixture is a chars/4 estimate. The 25 Sep measurement put the real count of a similar request at 11,851, about 149 tokens under 12,000, which this block would use up.
- **Not a blocker.** That is a fixture margin, not a production ceiling: live requests already run 10,020–17,540 input tokens.
- **The real cost:** the probe measures the block's actual token count (§6).

---

## §5 Review (BUILD_RULES §2)

**Scope.** The cumulative branch diff at `89774037`: 16 files, +1,518 −3. This is past both thresholds (≥ 10 files, ≥ 1,500 lines).

**Isolation.**
- Each reviewer and refuter worked on its own `git -c core.autocrlf=false archive` snapshot in the session scratchpad. Lens L1 also had a base snapshot.
- `node_modules` was a junction only where tests ran.
- All were read-only on git and on the working tree, and none was primed with known findings.

**Lenses:**
- **L1**: fence and flag discipline, flag-off byte identity.
- **L2**: every sentence of the paragraph against the code.
- **L3**: tests, goldens, pins, flip-proofing, and the probe.
- **L4**: honesty.

Then six refuters, each told to refute with a concrete repro and to judge every finding on its own. L2-1 (= L4-2) had a refuter to itself. The two probe majors (L3-1, L3-2) shared one. The rest were batched by topic: the probe minors, the test nits, the wording and backing findings, and L1's three.

**Totals:**
- 24 raw findings (L1 3, L2 6, L3 8, L4 7), which collapse to **19 distinct** (L2 and L4 overlapped on five).
- **11 CONFIRMED, 8 PARTLY, 0 wholly refuted.**
- The refuted sub-claims are listed in §5.2.

### §5.1 Findings and dispositions

| ID | Sev. (after refuter) | Finding | Verdict | Disposition |
|---|---|---|---|---|
| L3-1 | **major** | The probe's bar could print PASSED over replies that never came back (errored/expired). It never checked that the refused subset was the full 26. A malformed reply naming crypto → stock was invisible to it. | CONFIRMED (the malformed part: PARTLY) | **Fixed** (`ac6ba27e`). The bar now reads PASSED / FAILED / **INCOMPLETE**: INCOMPLETE unless every request came back and the refused subset is 26. A malformed reply's carried crypto → stock pair counts against the bar. One retry batch is allowed for requests with no result, under the cumulative cap. |
| L2-1 = L4-2 | **minor** (dark build); must be settled before the flip | "The platform refuses any swap that pairs a crypto with a stock" is false platform-wide. The gameplan-meeting approval path runs `executeSwapServer` with no validator, and its sector-drag trigger can propose BTC → a stock. The refuter executed it end to end on the real code: the book ends with 7 stocks and 0 crypto, and the type rule then blocks the way back. A second route goes through the "Unknown" sector after a crypto swap. Approval needs a direct owner write; the approve card is not mounted on any live screen. | CONFIRMED (and widened) | **Not fixed here**: it predates the build (`agent-evaluate.js` unchanged; detector from `1cee05f5`, 27 Mar) and is outside its scope (BUILD_RULES §3). Reported as **F7** (§8). **Question for Fable, §5.3.** |
| L3-2 | medium | The probe's selftest never ran a schema-valid SWAP or HOLD through the judge (its synthetic swap lacked `riskAssessment`). Five judge/bar/plan mutants survived. | CONFIRMED | **Fixed.** The judge is now a pure `judgeRun()` + `applyBar()`. The selftest feeds schema-valid inputs and synthetic runs through the bar, and 12/12 probe mutants are killed. |
| L3-5 | minor | `plan` enforced 26 refused over `records.json` only, not over the planned set, and had no floor (all-excluded wrote an empty plan). | CONFIRMED (latent; did not fire) | **Fixed.** `plan` stops if any refused request is excluded or nothing is left. |
| L1-3 | nit | The flag docstring's flip map did not name the docstring and pin-header rewording BUILD_RULES §2 requires (repo convention; this report's §7 had it). | CONFIRMED (literal) | **Fixed** (`featureFlags.js` flip map). |
| L3-6 | nit | The splice helper's "already carries the banner" guard was untested. | CONFIRMED | **Fixed.** Added a banner-plus-anchor row. |
| L3-7 | nit | The probe-lock rows ran only with the flag on, so a gated render in the splice helper survived. | CONFIRMED | **Fixed.** The rows now run with the flag on and off. |
| L3-8 | nit | The suite depended on the live values of `EVAL_IDENTITY_BLOCK_ENABLED` and `PROFIT_TARGET_EXECUTOR_ENABLED` while calling its capture "never regenerated". | CONFIRMED (mechanics) / PARTLY (framing) | **Fixed** by pinning both at their capture values (`true`). Trade-off: if either is ever walked back, this suite still proves the crypto splice adds nothing at its capture flags, not at the reverted ones. Proving it at the reverted flags would be the revert PR's job, as for the Ask 2 suite. |
| L2-3 = L4-3 | nit | The list "cooldown, conviction, and the hurdle floor" reads as complete but leaves out LOCK and the swap cap. Guardrail stops bypass the hurdle. The model cannot compute "the margin". | CONFIRMED, with sub-claims refuted (§5.2) | Not the build's to change (Fable's wording). Recorded for Fable (§5.3). Backing table updated (§2). |
| L2-4 = L4-5 | nit | The platform's own risk and guardrail exits can move the crypto. After any crypto swap, the bench crypto is the one just swapped out, on a 24 h cooldown that outlasts the one-day battle, so "two moves" becomes one. | CONFIRMED | Recorded for Fable (§5.3). |
| L2-5 = L4-1 | nit–minor | Other model-visible text still says "stock" where the crypto slot is meant: the tool's "SWAP replaces one active position with a bench stock" (`agentEvalToolSchema.js:7`, `:16`) and the preamble's "tiered stock portfolio". | CONFIRMED | Out of scope: the tool is SHA-pinned, the preamble fenced. Recorded for Fable (§5.3). The probe's crypto → crypto count is the empirical read on it. |
| L1-1 | nit | Seven code comments cite this report, which was not yet committed at `89774037`. | PARTLY (the repo's normal order is cite then commit; a mis-pointer remained) | **Fixed** by committing this report. Its §2 now carries the sentence-backing table that `evalCryptoSlotBlock.js:55` points at. |
| L2-6 = L4-6 | nit | The Phase 0's backing table was written for the draft wording, and the module's pointer to "report §2" had nothing to land on. | PARTLY (the backing exists across the Phase 0's Q2/Q4) | **Fixed**: the backing table in §2 above. |
| L1-2 | nit | The fenced comment's "founder sign-off on this hunk" read as if sign-off had been given. | PARTLY, mostly refuted ("§7-gated" is the repo's word for required) | Reworded anyway, since it is accurate at every point in time: "merges only with the founder's sign-off on this hunk — build report §2". **This is the comment in the §2 hunk.** |
| L3-3 | minor | The "short as a position" heuristic had many false positives. | PARTLY. On the real corpus the false positives were trend-lane wording ("short/intermediate/long"). The "only 3 samples / rationale only" complaints follow the spec. | **Fixed.** The detector is now inclusion-based. On all 1,250 real rationales in the exhibits it finds **0** position hits, and the refuter counted 0 genuine ones. The spec's three-sample exhibit is kept; every match window is saved locally too. Other narrative fields are reported as a secondary line. |
| L3-4 | nit | Asset class was decided by bare symbol, so `$BTC`, `BTC-USD.CC` and `Bitcoin` read as stocks. | PARTLY (errs both ways; zero exposure in the data) | **Fixed.** Tickers are normalised. |
| L4-4 | nit | The probe did not count crypto → crypto proposals the hurdle floor would refuse. | PARTLY (not in the spec's list) | **Fixed.** `cryptoToCryptoIncomingNotUp` is counted (§6). |
| L4-7 | nit | "No crypto reaches the flat6 prompt" was broader than the test. The flat6 live context always has a `BTC: …%` macro line (pre-existing). | PARTLY (the `strategyBrief` half refuted) | **Fixed**: §1 item 3 now says "system prompt". |
| L2-2 | minor (pre-existing) | A hand-built watchlist naming a crypto ticker can reach the draft. `validatePortfolio` has no crypto exclusion on the stock arrays (the tournament sibling does), so a crypto could land in a stock slot. | PARTLY. No in-app path puts a crypto on a watchlist (every UI route searches the stock universe; client writes are denied), and the hotBench harm is refuted. | Not fixed (out of scope). Reported as **F8** (§8). |

### §5.2 Refuted sub-claims (recorded, not acted on)

**L2-1** — refuter tried to break it and could not.
- **Claim tested:** that something on the meeting path type-checks.
- **Refuted:** nothing does.
- **The refuter widened the finding:** the 'Unknown' route.

**L2-2**
- **Claim:** the hotBench mis-typing could cause a mixed swap.
- **Refuted:** an off-universe crypto never reaches the BENCH table. A proposal naming it ends in a throw or a refusal, never a mixed swap.

**L2-3 / L4-3**
- **Claim:** LOCK and the swap cap are "hidden".
- **Refuted:** the same prompt states both. With the profit-target executor on, it also names "hurdle floors, the swap-window breaker, cooldowns".
- **Claim:** the held crypto's daily % is never visible.
- **Refuted for BTC:** BTC's daily % is on the macro line.

**L2-4**
- **Claim:** "or a round trip".
- **Refuted:** the 24 h cooldown outlasts a one-day battle, so the move is simply gone.

**L2-6**
- **Claim:** the two sentences have no backing.
- **Refuted:** the backing exists in the Phase 0's Q2 and Q4.

**L3-1**
- **Claim:** re-sending needs a hand-edit of `manifest.json`.
- **Refuted:** plan's own STOP says to start a new run folder.

**L3-3**
- **Claims:** "only 3 samples" and "rationale only".
- **Refuted:** both match the spec.

**L3-4**
- **Claim:** "errs toward PASS".
- **Refuted as one-sided:** an exotic incoming symbol errs toward FAIL.

**L4-7**
- **Claim:** `strategyBrief` can carry crypto text into flat6.
- **Refuted:** it is a fixed string for tournament battles.

**L1-1**
- **Claim:** the citing-before-the-report order is a defect.
- **Refuted:** it is the repo's practice (four precedents), and the guard message fires only at flip time.

**L1-2**
- **Claim:** the comment claims a sign-off.
- **Refuted:** "§7-gated" means required; "§7-signed" means given.

### §5.3 For Fable — before the flip

1. **"The platform refuses any swap that pairs a crypto with a stock" (F7 / L2-1).** This is true for every swap the agent itself proposes, and the probe measures exactly that. It is not true platform-wide.
   - **The hole:** a gameplan meeting can propose BTC → a stock, and an approval runs it without the validator.
   - **The consequence:** after such a leg, every sentence of the paragraph is false for the rest of the battle.
   - **How reachable today:** only by a direct owner write to Firestore (the approve card is not mounted on any live screen).
   - **Options:**
     - (a) Fix F7 (type-match the meeting legs; keep crypto out of the drag trigger) before the flip, and keep the wording.
     - (b) Scope the sentence to the agent's own swaps.
     - (c) Accept the latent gap.
   - **The build does not re-word** (prompt §3).
2. **The check list** (L2-3): "cooldown, conviction, and the hurdle floor" leaves out LOCK and the swap cap, which the prompt states elsewhere. The "margin" cannot be computed from the prompt, except for a held BTC. The probe's `cryptoToCryptoIncomingNotUp` (§6) is the count of crypto → crypto proposals the "up on the day" step would refuse.
3. **"Two moves"** (L2-4): after any crypto swap, hold is the only move left for the rest of a one-day battle (24 h cooldown).
4. **"bench stock" in the tool description and "stock portfolio" in the preamble** (L2-5) still describe the crypto move as a stock move. Both texts are pinned or fenced and outside this build. The probe's crypto → crypto count shows whether the model reads past them.

---

## §6 Replay probe

**Outcome: the bar FAILED.** Per prompt §6.5 the paragraph is **not re-worded**, the PR stays **draft**, and the build **stops for Fable**.

| Bar (prompt §6.4) | Captured (no block) | Replay (with the block) | Bar |
|---|---:|---:|---|
| crypto → stock proposals, all 144 | 26 | **10** | ≤ 2 — **fails** |
| crypto → stock proposals, the 26 refused | 26 | **9** | 0 — **fails** |

**Run.** `scripts/experiments/cryptoSlotProbe.mjs` at `ac6ba27e`, after §5 was green (the final suite, the review fixes).

| Item | Value |
|---|---|
| Source | `sources.jsonl`, SHA-256 `6fb95a74…` (matches the Phase 0) |
| Requests | 144 tiered. All 144 spliced and verified by marker, 0 excluded. 26 are the refused ones (`pair_validation:asset_class_mix`). |
| Model and parameters | `claude-haiku-4-5-20251001` at temperature 0.4, `max_tokens` 2048/3072, tools and `tool_choice` as stored — all read from the requests, not chosen. |
| Batch | One Message Batch (`msgbatch_015dRHWPd6pm7dM3hQsZ9Q47`). 144 succeeded, 0 errored or expired; the bar was complete. Deleted on Anthropic's side after collection. |
| Cost | **$1.64** at batch prices: 2,262,202 input and 205,517 output tokens. Plan estimate $1.65; worst case $2.17; cap $5. |
| Block cost (measured) | **222 tokens** on every request (the reply's input tokens minus the stored request's recorded input tokens; min = max = 222). This is the real figure behind §4's chars/4 estimate of ~212. |

**Counts** (each reply judged with production's `validateTradeToolResult`):

| | All 144: captured | All 144: replay | Refused 26: captured | Refused 26: replay | Other 118: captured | Other 118: replay |
|---|---:|---:|---:|---:|---:|---:|
| HOLD | 102 | 109 | 0 | 2 | 102 | 107 |
| SWAP | 37 | 34 | 26 | 24 | 11 | 10 |
| — crypto → stock | 26 | **10** | 26 | **9** | 0 | 1 |
| — crypto → crypto | 0 | **14** | 0 | **14** | 0 | 0 |
| — stock → crypto | 0 | 0 | 0 | 0 | 0 | 0 |
| — stock → stock | 11 | 10 | 0 | 1 | 11 | 9 |
| Malformed (production would fail it closed to HOLD) | 5 | 1 | 0 | 0 | 5 | 1 |
| Malformed but naming crypto → stock | — | 0 | — | 0 | — | 0 |

**By archetype** (replay, with captured in brackets):

| Archetype | Requests | crypto → stock | crypto → crypto | stock → stock | HOLD |
|---|---:|---:|---:|---:|---:|
| Trend Follower | 112 | 5 (12) | 5 (0) | 8 (8) | 93 (87) |
| Diversifier | 24 | 5 (14) | 9 (0) | 1 (1) | 9 (9) |
| Contrarian | 8 | 0 (0) | 0 (0) | 1 (2) | 7 (6) |

**The 14 crypto → crypto proposals would all have been refused anyway.**
- All 14 are BTC → ETH, and all 14 sit in the refused subset.
- In every one, the request's own BENCH table shows ETH **down on the day** (−0.40% to −5.23%).
- So the hurdle floor's first step (`bench_not_positive`, `agentRiskManager.js:363`) would refuse every one (`cryptoToCryptoIncomingNotUp` = 14 of 14).
- All 14 rationales mention ETH's negative move, and none mentions the paragraph's "up on the day".

**What this adds up to on the 26 refused checks:**
- 23 of 26 replies still argue to sell BTC: 9 into a stock (the validator refuses) and 14 into a falling ETH (the hurdle refuses).
- 2 hold, and 1 swaps a stock for a stock.

**"short" as a position (D-1's concern).**
- 3 rationales use the word "short"; **0** use it as a position.
- 0 in the other player-visible fields (status feed, thesis, anticipation, hypothesis).
- The block did not lead the model to narrate a short.
- The three samples the prompt asks for are in the local exhibits; none qualified.

**The failing rationales' shapes** (the 24 crypto → stock and crypto → crypto replies). Counted from the replies, which stay in the local exhibits; no player text here.

| Shape | crypto → stock (10) | crypto → crypto (14) |
|---|---:|---:|
| Calls the held position "crypto" (the model knows what it holds) | 9 | 14 |
| States the crypto-slot rule or expects a refusal (full rationale, hypothesis, status feed and thesis searched) | 0 | — |
| Frames BTC as stagnant or the weakest link, and the incoming name as strong today | 10 | 14 |
| The request's RISK STATUS says `BTC: SWAP_OUT (stagnation)` | **8** | **13** |
| Cites that SWAP_OUT flag in its own reasoning | 3 | 8 |
| Mentions the Support tier or its 1.0x multiplier (rule 5's "low-impact" framing) | 7 | 9 |
| Frames the move as filling a sector gap (all Diversifier) | 4 | 1 |
| Mentions the incoming crypto's down day | — | 14 |

**Reading it — for Fable.** The block moved behaviour: crypto → stock fell 26 → 10, and the model tried crypto → crypto for the first time (0 → 14). It did not clear the bar. The shapes point at pressure the paragraph does not reach:

1. **The platform's own risk line tells the model to sell the crypto.**
   - `BTC: SWAP_OUT (stagnation)` sits in the RISK STATUS block of 27 of the 144 requests, including 22 of the 26 refused ones, and 21 of the 24 failing replies had it.
   - On those checks the one legal replacement was down on the day, so no legal move answers that flag.
   - Whether the risk manager should flag the crypto SWAP_OUT when no crypto replacement can clear the hurdle is a design question outside this build.
2. **The Diversifier's charter.** "does this candidate fill an under-represented sector" drives 4 of the 10 crypto → stock replies. The paragraph scopes rule 7, not the charter.
3. **Rule 5's framing.** "Support swaps are low-impact — safer to experiment": the Support tier or its 1.0x multiplier comes up in 16 of the 24. That is a mention count, not proof the rule drove the choice.
4. **"Up on the day" is ignored when it is visible.** Every crypto → crypto reply saw ETH's negative Daily% and proposed it anyway.

**Two different conflicts — not one item.**
- The SWAP_OUT pressure here is the platform's risk line asking the model to sell the crypto when no legal swap exists.
- §5.3 item 1 (F7) is a platform path that executes a crypto → stock swap the paragraph says is refused.
- Each needs its own answer.

**Limits of this read.**
- One sample per request at temperature 0.4.
- The 26 refused requests are not independent draws: they are repeated checks of a few battles, for example four consecutive checks of one Diversifier battle (all BTC → LLY).
- The bar is Fable's, applied as written.

**Local exhibits** (`%USERPROFILE%/ft-experiment-exhibits/crypto-slot-probe/`, outside the repo): `manifest.json` (plan, batch, command log with HEAD and script SHA), `requests.jsonl`, `results-0.jsonl`, `judge.json`, `short-samples.json`.

---

## §7 Flip commit checklist

The flip is its own small commit after Flash's sign-off on §2 and §6, never in this PR. **Settle §5.3 item 1 first.**

1. `src/config/featureFlags.js`: set `CRYPTO_SLOT_PROMPT_ENABLED = true`, and reword the docstring's "DARK — default FALSE" and "When FALSE (CURRENT)" lines.
2. `src/config/cryptoSlotPromptFlags.test.js`: the pin → `toBe(true)`, and reword its header comment's "ships FALSE".
3. `src/config/flagPinGuard.test.js`: drop the `CRYPTO_SLOT_PROMPT_ENABLED` entry from `DARK_BY_DESIGN`. The guard's integrity row fails if it stays.
4. Regenerate exactly the 7 tiered snapshots with `npx vitest run api/_utils/p4Equivalence.battery.test.js api/_utils/evalIdentityBlock.injection.test.js -u`:
   - `api/_utils/__p4_snapshots__/buildEvalSystemPrompt.analyst.snap.txt`
   - the six `api/_utils/__dr13_snapshots__/buildEvalSystemPrompt.identityOn.{analyst,contrarian,degen,diversifier,guardian,momentum_chaser}.snap.txt`

   Review the diff: each snapshot must gain exactly the block of §2 at the one point, and nothing else.
5. **Check that nothing else moves.** `git diff --stat` must list only the 3 files above plus the 7 snapshots. In particular none of these may appear:
   - the six flat6 snapshots (`…identityOn.flat6.*.snap.txt`) and `…flat6.analyst.snap.txt`
   - `ask1PromptGoldens.json`, `ask2PromptGoldens.json`, `cryptoSlotPromptGoldens.json`
   - `callRecordsOffGolden.json`, `callRecordsRollbackGolden.json`, `meetingCopyBaseline.json`

   Then run the full suite.

**Dry run of this checklist** (my private clone at `ac6ba27e`, the final code head; Linux, CI-shaped; the clone restored clean after each run):

| Run | What changed | Result |
|---|---|---|
| **Control**: the flag line alone | `featureFlags.js` (module value printed: `true`) | 951 files, 20,269 tests, **exactly 10 failing in 4 files**: 6 DR-13 tiered snapshot rows, 1 P4 tiered snapshot row, the pin row, and 2 flag-pin-guard rows (the pin contradiction and the `DARK_BY_DESIGN` integrity row). Nothing else, so the six suites' pins hold. |
| **Flip**: checklist steps 1–4 (flag, pin, guard entry, `-u`) | `-u` reported "7 updated". `git status` showed exactly 10 files: the 3 edited and the 7 snapshots. Each snapshot gained exactly the 8 lines of the block (banner, five paragraph lines, two blank lines) and lost none. | 951 files, 20,269 tests, **0 failing**. |

The docstring rewording of steps 1–2 was not part of the dry run, since it is prose with no test effect.

Two reviewers independently simulated the flip on Windows snapshots of `89774037`.
- **Flag line alone:** exactly 10 rows went red across 4 files:
  - 6 DR-13 tiered snapshot rows
  - 1 P4 snapshot row
  - the pin row
  - 2 flag-pin-guard rows (the pin contradiction and the `DARK_BY_DESIGN` integrity row)
- **The `-u` command:** reported "7 updated" and changed exactly the 7 files above.
- **Without the six suites' pins:** 39 rows would go red, so the pins are load-bearing.

---

## §8 Not in this build

The Phase 0's findings (`docs/audits/20261014_PHASE0_CRYPTO_SLOT.md` §4) and the review's new ones, each for separate tasking:

- **F1**: every swapped asset loses its `sector`, so both tables print "Unknown". Next task. The paragraph's "go by the symbol" clause stays while this is true; drop it when F1 lands.
- **F2**: for a short, the scorer's intraday extremes are negated but not swapped. Settle before the short task.
- **F3**: "held by a guardrail" names the wrong layer for pair-validation and other downgrades.
- **F4**: the status feed's hold beat can announce a swap that did not happen.
- **F5**: two copies of the crypto list (`api/_utils/agentCryptoAssets.js`, `src/constants/cryptoPool.js`).
- **F6**: the model never learns why a swap was refused (`formatRecentEvals`).
- **F7 (new, review L2-1 / L4-2)**: the gameplan-meeting approval path runs swaps without the validator. Its sector-drag trigger can pick the crypto, through its "Crypto" sector or "Unknown" after a crypto swap, and propose a stock for it.
  - Where: `api/cron/agent-evaluate.js` — `handleGameplanMeeting` around `:6064-6155`; the detector around `:6429-6540`.
  - Fix outline: type-match the legs, and keep crypto out of `draggingPositions`.
  - Settle before the flip (§5.3 item 1).
- **F8 (new, review L2-2)**: `validatePortfolio` (`api/agent/decide.js:1152-1154`) has no crypto exclusion on the stock arrays, unlike the tournament sibling (`:1286-1287`), and watchlist tickers are only shape-checked.
  - No in-app path reaches it today.
- **F9 (noticed in review)**: `PROFIT_TARGET_EXECUTOR_ENABLED`'s docstring still says "When FALSE (DEFAULT, merge-dark)" while the flag is `true` (`src/config/featureFlags.js:1971-1972`). Stale prose; BUILD_RULES §2's flip-reconciliation rule.
- **The short task (R-2 / R-4)**: a way to say it (tool), do it (executor), and see it (a direction cell). When it lands, the paragraph's last bullet gains its second half (Fable D-1).
