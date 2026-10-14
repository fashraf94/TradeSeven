# Phase 0 — Crypto Slot: what the game does, what the agent is told

**Date:** 14 Oct 2026 · **Prompt:** Fable, "PHASE 0 PROMPT — Crypto Slot: what the game does, what the agent is told", 14 Oct 2026 · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Base HEAD:** `d5d8fa9b26613b6ea711c4c6520715d29cb8bacd` (= `origin/main` after `git fetch origin main` at session start; tree clean) · **Branch:** local `claude/phase0-crypto-slot-85e582` (the app's suffix), pushed by refspec as `claude/phase0-crypto-slot`, no PR · **Report back to:** the Fable chat that issued the prompt.

**Read-only.** No file under `src/` or `api/` was edited; the only write is this report. No Firestore reads, no model calls. The test suite was not run (prompt §1.5). The local run folder `C:\Users\fashr\ft-experiment-exhibits\archetype-ablation-run\` exists, and its stored requests were counted for Q4 and Q5 (counts only, no player text; method in the appendix).

Every `file:line` below was read at `d5d8fa9b` in this session (VERIFIED) unless it is marked INFERRED. "Tiered" means the BaggerBomb agent game (`gameMode: 'baggerbomb_agent'`); "flat6" means the League Tournament agent layer (`'baggerbomb_tournament'`) (`src/constants/agentGameModes.js:36-37`).

---

## Verdict

| Question | Answer |
|---|---|
| **Q1** The crypto slot | Tiered game only. Exactly one, mandatory: the **third Support slot** (`support[2]`), plus exactly one crypto on the bench. 7 crypto names (BTC, ETH, SOL, XRP, DOGE, ADA, BNB). The tournament (flat6) has no crypto at all. |
| **Q2** The validator | Compares the boolean `isCrypto` field on the two assets, not a sector string or a symbol list. Crypto → crypto **passes** it. In practice the hurdle floor's "incoming name must be up on the day" step would have refused a crypto → crypto swap on 111 of the 144 tiered checks in the capture window. |
| **Q3** Short | **R-2 is expressible by the agent today: no.** The scorer inverts a short, but nothing on the agent path can set a direction: not the draft, not the trade tool, not the executor. Every agent crypto position is long. Per R-4, the build is prompt-only and the short becomes its own task. |
| **Q4** What the model sees | The word "Crypto" in the Sector column of two tables, and nothing else: no rule, no direction, "crypto" in 0 of 551 system prompts and 0 tool schemas. After any swap the label itself becomes "Unknown". A blocked swap comes back to the model as a plain `HOLD` carrying its own swap-arguing rationale; the refusal reason never reaches the next check (0 of 515). |
| **Q5** The bench | **The prompt's premise does not hold.** The bench carries exactly one crypto on every tiered check (144 of 144), including all 26 checks where the BTC → stock swap was refused. The model never proposed crypto → crypto (0 of 551). |
| **Q6** Where the sentence goes | Tiered system prompt only, one place: between `SCORING RULES` and `DECISION FRAMEWORK` (`api/_utils/agentEvalPromptAssembly.js:362-364`). The flat6 template must not carry it. |
| **Q7** Fence, tests, flag | One fenced file, the assembler, gets a one-line splice. No tool-schema change (Q3: nothing to express). There is no forbidden-terms test for "crypto" or "short". **Recommend a flag:** every prompt-text change to the assembler since 25 Jul shipped dark (Ask 1, Ask 2), and an unflagged change would now also move three SHA-pinned cron goldens whose rule forbids regenerating them. At the flip: 7 tiered snapshots move. |
| **Q8** The player's side | The Voice Layer knows no crypto-slot rule ("crypto" only as a display label; the four position-sense "short"s are all the player's tournament flip lever). A pair-validation refusal reaches the player as "Argued for a swap · held by a guardrail" plus the model's own swap argument — never the reason, and "guardrail" is the wrong layer. |

---

## §0 Position

| Fact | Value |
|---|---|
| `main` HEAD | `d5d8fa9b` (Merge #957, archetype ablation) = `origin/main` after `git fetch origin main` |
| Branch | local `claude/phase0-crypto-slot-85e582`; pushed as `claude/phase0-crypto-slot` |
| Tree | clean at start |
| `TICK_CAPTURE_ENABLED` | `true` — `src/config/featureFlags.js:2717` |
| `SWAP_IDENTITY_MODE` | `'shadow'` — `src/config/featureFlags.js:3194` (records the identity check; refuses nothing) |
| Eval model | `claude-haiku-4-5-20251001` — `api/_utils/agentEvalTransport.js:48` |
| Run folder | present; `sources.jsonl` SHA-256 `6fb95a74bcbdd8ae59580b48ec8896722938d07ddc1be4a58c1b463202144437`; 623 woken checks, **551 with a stored request body** (72 have none: the `copy_failed` timeouts) — **144 tiered, 407 flat6** |

**A correction to the prompt's file names.** The trade tool the Trading Brain is given is not in `agentEvalTransport.js` (that file holds the model id, timeouts and failure classes). It is `submit_trade_decision` in `api/_utils/agentEvalToolSchema.js:4-60`, built per check by `buildTradeDecisionTool` (`:496-501`) and sent at `api/cron/agent-evaluate.js:2900`. The golden snapshots that pin the eval system prompt are `buildEvalSystemPrompt.*.snap.txt`, not `buildStrategySystemPrompt.*` (those pin the Sonnet draft-strategy prompt) — see Q7.

**Denominators.** The experiment report counts 528 eligible requests. This report counts every stored body (551), because Q4 and Q5 ask what the model was shown, not whether its reply was valid. The two are not the same set and are not claimed to be.

---

## §1 In plain terms

1. In the tiered BaggerBomb agent game, every portfolio has one crypto position: the third Support slot. The bench always has one more crypto. The tournament has none.
2. The rule is a type match on `isCrypto`: crypto swaps only for crypto, stock only for stock. A crypto → crypto swap is legal at the validator, and the one bench crypto was always there to swap to. The model never once tried it; all 26 refusals were BTC → a stock.
3. The agent **cannot short** today. The scorer knows how to score a short, but no draft field, trade-tool field or executor path lets the agent set or flip a direction. Every agent crypto position is long.
4. The model is never told any of this. It sees "Crypto" in a sector column (and "Unknown" once a swap has happened), and the system prompt's rule 7 tells it to "rotate into a different sector". When it is refused, the next check sees only "HOLD" and its own rationale for the swap. It cannot learn why within the battle.
5. **Smallest honest fix:** one paragraph in the tiered system prompt only, naming the slot and the seven symbols, saying crypto swaps only for crypto and stocks only for stocks, and saying the crypto slot is the only slot the game lets go short but **the agent cannot open or flip a short — its crypto position is long**. Prompt-only, behind a flag (Q7). The short itself becomes its own task (R-4).

---

## §2 The questions

### Q1 — The crypto slot as the game defines it

**Slot kind, count, tier.**

| Where | What it says |
|---|---|
| `src/constants/agentGameModes.js:40-55` | Tiered: `portfolioSize: 7` — "2 star / 2 core / 2 support stocks + 1 support crypto" (`:43`), `composition { star: 2, core: 2, support: 3 }`, **`cryptoMandatory: true`** (`:46`), `benchStocks: 3`, **`benchCrypto: true`** (`:48`), `promptVariant: 'tiered'` (`:54`). |
| `src/constants/agentGameModes.js:56-73` | Flat6 (tournament): six stocks, **`cryptoMandatory: false`** (`:62`), **`benchCrypto: false`** (`:67`), `promptVariant: 'flat6'` (`:72`). |
| `api/agent/decide.js:1142-1143` | The draft is refused without one: "Missing support crypto", "Missing bench crypto". |
| `api/agent/decide.js:1157-1162`, `:1170-1172` | Both must be in the crypto list, and they must differ. |
| `api/agent/decide.js:1258`, `:1262` | `support: [...support_stocks, support_crypto]` → the crypto is **`support[2]`**; `bench.crypto` is a single object, not an array. |
| `api/_utils/agentBattleService.js:157-163` | Copied onto the battle: "crypto lives inside support[2] (isCrypto: true) — not a separate field" (`:158`); `bench.crypto` keeps its own field (`:162`). |
| `api/agent/decide.js:1286-1287`, `:1317` | Tournament: "Crypto not allowed in flat6"; bench `{ stocks: [], crypto: null }`. |
| `src/components/BaggerBomb/SlotBasedBuilder.jsx:48-56` | The player's own BaggerBomb game has the same shape: Support has 3 slots, `lastSlotCrypto: true`. |

**The crypto universe — 7 names, two copies.**

- `api/_utils/agentCryptoAssets.js:4-12` — `CRYPTO_ASSETS`: BTC, ETH, SOL, XRP, DOGE, ADA, BNB (each `isCrypto: true`, baseATR 5–7). `VALID_CRYPTO_SYMBOLS` at `:14`. This is the agent's list (draft validation `decide.js:7`, `:1157-1161`; quote routing `api/_utils/marketDataCache.js:21`, `:79`).
- `src/constants/cryptoPool.js:6-14` — `BAGGERBOMB_CRYPTO_POOL`, the same seven, for the player's game. Its header `agentCryptoAssets.js:2` says it "Mirrors src/constants/cryptoPool.js — kept separate since API can't import from src/" — a reason the June 2026 import rule retired (BUILD_RULES §4). The two lists agree today.

**Mandatory or optional.** Mandatory in the tiered game: the draft fails validation without it (`decide.js:1142`), the fallback portfolio hard-codes BTC in the slot and ETH on the bench (`decide.js:1210`, `:1212`), and the mode config says `cryptoMandatory: true`. Absent in the tournament. R-1 ("crypto only; fewer than ten names") **matches the code**: 7 names.

### Q2 — The validator

**The rule, quoted** (`api/_utils/agentSwapExecution.js:69-77`):

```js
    // 4. Asset type match (stock↔stock, crypto↔crypto)
    if (found && (benchAsset || hotBenchMatch)) {
      const activeAsset = getAssetAt(battle.portfolio, found.tier, found.slotIndex);
      // hotBench stocks are always non-crypto
      const incomingIsCrypto = benchAsset ? benchAsset.isCrypto : false;
      if (activeAsset && activeAsset.isCrypto !== incomingIsCrypto) {
        errors.push('Cannot swap stock for crypto or vice versa');
      }
    }
```

**What it compares:** the boolean **`isCrypto` field** on the held asset and on the incoming bench asset. Not the sector string (the "Crypto" label is a separate `sector` field written at battle creation, `agentBattleService.js:420-426`), and not a symbol list. A `hotBench` match is always treated as a stock (`:72-73`). (The prompt cites `:68-76`; the rule's comment opens at `:69` and the `if` closes at `:77`.)

**Crypto → crypto: permitted by this rule.** Both sides carry `isCrypto: true` (`agentCryptoAssets.js:5-11`), so `:74` is false. The bench lookup finds `bench.crypto` (`agentSwapExecution.js:532-541`, `:538`), and the executor has a crypto branch: the outgoing crypto replaces `bench.crypto` (`:461-464`).

**The other checks a crypto → crypto swap still meets**, in gate order (`api/cron/agent-evaluate.js:3441-3600`):

| Check | Applies to crypto → crypto? | Line |
|---|---|---|
| LOCK — held position near a bonus | Yes. The risk loop scores every held position, crypto included, and adds `LOCK` verdicts to `lockedPositions`. | `agent-evaluate.js:1797-1813`; gate `:3446-3451` |
| Distressed veto on the incoming name | Only if `stockRegimes[symbolIn] === 'distressed'`. Regimes come from `stockTechnicalScores` docs (`:1602-1606`), which crypto does not have (the assembler says so at `agentEvalPromptAssembly.js:1527-1528`). INFERRED: never fires for crypto. | `agent-evaluate.js:3465-3470` |
| Validator: in bench, not self, not already held | Yes. | `agentSwapExecution.js:46-59` |
| Validator: 24h cooldown | Yes, once a crypto has been swapped out it carries `cooldownUntil` (`:455`) and is locked for 24h. 0 of the 144 crypto bench rows in the window were locked. | `agentSwapExecution.js:61-67` |
| Validator: conviction ≥ 70 | Yes. | `agentSwapExecution.js:79-82` |
| **Hurdle floor** — `bench_not_positive` | **Yes, and it bites.** `requireBenchPositive: true` for every archetype (`api/_utils/agentArchetypeConfig.js:57`, `:88`, `:117`, `:144`, `:175`, `:207`); the incoming name's daily change must be above 0 (`api/_utils/agentRiskManager.js:363-364`). Crypto quotes are live (no `$0.00` cell in 144 crypto bench rows), but in the window the bench crypto was **down on the day in 111 of 144 tiered checks** and up in 33. | `agent-evaluate.js:3536-3544`, `:3585-3590` |
| **Hurdle floor** — `below_floor` | Yes. The incoming name must beat the outgoing one's daily move by `atrMultiplier` × the outgoing's ATR: 0.35 for the Trend Follower, 0.4 for the Diversifier and the Contrarian (`agentArchetypeConfig.js:53`, `:113`, `:140`). The ATR is the fresh rankings value when there is one, else the frozen `baseATR` (`api/_utils/hurdleAtr.js:50-55`). INFERRED: crypto has no rankings row, so BTC's 5% applies — ETH must beat BTC by about 1.75–2.0 points on the day. | `agentRiskManager.js:367-382` |
| Swap cap (circuit breaker) | Yes: 6 per 60 min (Trend Follower), 4 per 60 min (Diversifier, Contrarian). | `agentArchetypeConfig.js:59`, `:119`, `:146`; `agent-evaluate.js:3552-3558` |
| Reservation (tournament ledger) | No — `bypassed` on non-tournament battles. | `agent-evaluate.js:3678-3688` |
| Executor: a valid price for the incoming name | Yes. Crypto symbols route to EODHD `-USD.CC` (`marketDataCache.js:76-90`). | `agentSwapExecution.js:411-414` |

**In short:** crypto → crypto is legal and has a bench name to go to on every tiered check, but the hurdle floor makes it narrow: the bench crypto has to be up on the day and up by a couple of points more than the held one.

The platform's own deterministic layer already knows the rule: the emergency replacement picker matches "stock for stock, crypto for crypto" (`agentRiskManager.js:394-404`).

### Q3 — Direction

**How a position is short in code:** an optional `direction` field on the asset object, `'short'` or absent/`'long'` (`src/constants/cryptoPool.js:21-25`). Not an inverse symbol. In the player's own game, picking a crypto offers LONG ↑ / SHORT ↓ buttons, crypto rows only (`src/components/BaggerBomb/AssetPickerModal.jsx:73-81`, `:136-155`).

| Surface | Can the agent set direction? | Evidence |
|---|---|---|
| **Draft / deploy** (initial portfolio) | **No.** `submit_portfolio` takes symbols only: `support_crypto` and `bench_crypto` are plain strings (`api/_utils/agentToolSchema.js:75-78`, `:86-90`). The draft prompt says only "support_crypto: exactly 1 crypto from the available list" (`api/_utils/agentPromptAssembly.js:220`, `:222`). Enrichment spreads the `CRYPTO_ASSETS` entry, which has no `direction` (`decide.js:1239-1241`; `agentCryptoAssets.js:5-11`); `createAgentBattle` copies it and adds only `sector` (`agentBattleService.js:420-426`, `:162`). | every agent crypto starts with no `direction` = long |
| **Trade tool** `submit_trade_decision` | **No.** `decision` is `HOLD` or `SWAP` only (`agentEvalToolSchema.js:12-17`); a SWAP names `symbolOut` and `symbolIn` (`:18-26`). The file's only `direction` fields are the narration-only `anticipationCandidates` (`potential_entry` / `potential_exit`, `:169-173`) and the stored-only declarations (`entry` / `exit`, `:260-264`). Neither is a position direction. | — |
| `validateTradeToolResult` | **No.** It walks the schema's own properties (`api/_utils/agentEvalToolResultValidation.js:103-127`). A field the schema lacks is neither checked nor rejected, and nothing downstream reads one. | — |
| **Executor** `executeSwapServer` | **No.** It takes no direction argument (`agentSwapExecution.js:222`). It carries the stored one through: the closed trade and the outgoing bench entry record `outAsset.direction \|\| null` (`:401`, `:454`); the incoming crypto copies the bench asset's own `direction` if it has one (`:425-427`). There is no "flip" path. Since no agent crypto ever has a `direction`, every swap-in is long too. | — |
| **Scoring** `calculateAssetScoreServer` | **Supports short.** `direction === 'short'` negates the price change, the threshold change and both intraday extremes (`api/_utils/agentScoring.js:227-240`). Same baseATR, same thresholds, same tier multiplier (`:262-270`). The evaluator passes `direction` through (`agent-evaluate.js:1161`, `:1198`); so do the swap lock (`agentSwapExecution.js:343`) and the player's agent-battle screen (`src/screens/AgentBattleScreen.jsx:204-206`, `:252-254`). The canonical V3 scorer (`src/utils/baggerBombUtils.js:535-549`) and the player's V4 hook (`src/hooks/useBaggerBombBattleV4.js:732-734`, `:745`, `:750`) do the same. | — |

Where `'short'` is written in code: the player's crypto picker (`AssetPickerModal.jsx:155`) and the tournament **user-pick** flip (`api/tournament/flip.js:3-4`, `:156-157`, owner-only, on the user layer). Neither is an agent path. BUILD_RULES §7 states the tournament agent layer as "long-only V1" (`docs/BUILD_RULES.md:87`).

**Verdict: R-2 is expressible by the agent today — no.** Scoring would honour a short crypto position if one existed; no surface the agent controls can create one. Per R-4: **the build is prompt-only, and the short becomes its own follow-up task** (§4).

### Q4 — What the model sees

**ACTIVE POSITIONS** (`api/_utils/agentEvalPromptAssembly.js:1458-1487`, pushed at `:1163-1165`). Tiered header `Tier,Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%` (`:1466`), plus three cells with `PROFIT_TARGET_EXECUTOR_ENABLED` (`:1467`). The Sector cell is `asset?.sector || 'Unknown'` (`:1474`, rendered `:1479`). BTC shows as `support,BTC,Crypto,…` because `decide.js:796` maps every crypto symbol to `'Crypto'` and `createAgentBattle` stamps it (`agentBattleService.js:424`). **No direction column; nothing reads `asset.direction`.**

**BENCH** (`buildBenchCSV`, `:1489-1517`, pushed at `:1168-1169`). Header `Symbol,Sector,$Current,Daily%,ATR%,Status` (`:1495`); Sector `asset.sector || 'Unknown'` (`:1503`). The bench list is `flattenBenchServer`, which appends `bench.crypto` (`agentScoring.js:57-69`). The crypto bench name is excluded only from `BENCH TECHNICAL CONTEXT` (`:1543-1544`), not from the table.

**The label does not survive a swap.** The executor's incoming asset (`agentSwapExecution.js:416-424`) and the outgoing bench entry (`:449-456`) carry no `sector`, and nothing re-stamps it (no sector write in `agent-evaluate.js`'s swap path). Both renderers then print "Unknown". In the stored requests, **every one of the 305 requests with a `CLOSED TRADES` block has "Unknown" sector cells, and no other request does** (483 position rows and 483 bench rows). No crypto swap executed in the window, so a crypto row has never shown "Unknown" yet. INFERRED: after the first crypto → crypto swap, the incoming crypto in Support and the outgoing crypto on the bench would both read "Unknown", and the "Crypto" label — today the model's only crypto signal — would be gone. This also blinds rule 7 and the Diversifier's sector-shape reasoning on every swapped name (§4).

**The system prompt and the identity block.**

| Text | Where | Crypto / slot-by-asset-class / shorting? |
|---|---|---|
| Preamble: "actively managing a tiered stock portfolio" | `agentEvalPromptAssembly.js:345` | Calls the whole book "stock". |
| `SCORING RULES`: "Base points = (currentPrice - entryPrice) / entryPrice × …"; "Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x" | `:347-362` | Long-only formula; tiers by multiplier, not asset class. |
| `5. TIER IMPACT AWARENESS` | `:374-377` | "Prefer swapping in Support tier" — where the crypto sits. |
| `7. SECTOR AWARENESS`: "Rotate into a different sector for diversification." | `:288-298` (both flag variants), placed at `:385` | For the crypto slot this is the one move that is always refused. |
| `ANTI-THRASH RULES (MANDATORY)` | `:472-479` | Cooldown, one swap, no round-trips. No crypto. |
| Tool description: "SWAP replaces one active position with a bench stock" | `agentEvalToolSchema.js:7`, `:16` | "bench stock". |
| Charter (`━━━ ARCHETYPE IDENTITY ━━━`) | `api/_utils/evalIdentityBlocks.js:99-143`, rendered `:190-199` | No "crypto" in any of the six. The Trend Follower's says "Never: … fade or short strength" (`:103`) — the only position sense of "short" in the system prompt. The Diversifier's ranks "does this candidate fill an under-represented sector" second (`:117`). |
| `ABOUT YOU`, brief, initial rationale (message 1) | `agentEvalPromptAssembly.js:746-772` | "crypto" appears only inside the agent's own draft-time text. |

Counts over the 551 stored requests (appendix):

| Probe | Count |
|---|---:|
| "crypto" in the system prompt | 0 / 551 |
| "crypto" in the tool schema | 0 / 551 |
| "crypto" in message 1, all inside the agent's own strategic brief or initial portfolio rationale | 34 / 144 tiered (0 flat6) |
| "crypto" in the live context outside the `,Crypto,` sector cells | 0 / 551 |
| "short" in the system prompt, as a position | 433 / 551 — all the Trend Follower charter's "fade or short strength" (a prohibition) |
| "short" in the system prompt or tool, as the English word ("one short sentence", "one short coach-style chat message") | 551 / 551 |
| A direction column (long/short/side) in `ACTIVE POSITIONS` | 0 / 551 |

**`YOUR LAST 3 DECISIONS` — does a refusal come back? No.** A pair-validation block sets `decision = 'HOLD'` and puts the validator's strings in `validationErrors` (`agent-evaluate.js:3508-3512`). The evaluation entry then stores `decision: 'HOLD'` with `symbolOut` / `symbolIn` **null** (`:4115-4123`), the model's own `rationale` unchanged (`:4125`), and the reason in `validationErrors` / `downgraded` (`:4145-4146`). `formatRecentEvals` (`agentEvalPromptAssembly.js:1389-1402`; pushed at `:1278-1283`) reads only `evalId`, `timestamp`, `decision`, `symbolOut`, `symbolIn`, `tier`, `rationale` (first 80 characters) and `hypothesis` (first 60). The next check therefore sees `HOLD | "<the first 80 characters of the argument for selling BTC>..."`. The cron comment says this whitelist is fixed and pinned (`agent-evaluate.js:4156-4158`). Stored requests: **0 of 515** `YOUR LAST 3 DECISIONS` blocks mention the refusal or any "blocked" / "downgraded" word; "Cannot swap stock for crypto" appears in **0 of 551** requests anywhere. **The model cannot learn from a refusal within a battle**, which fits the experiment's seven-in-a-row on 7 Oct.

### Q5 — The bench

**Who assembles it.** Per check, `api/cron/agent-evaluate.js` builds the bench in memory from the battle document: `bench.stocks` plus `bench.crypto` (`:1059-1063`), then appends synthetic `watchlist.hotBench` stocks, each stamped `isCrypto: false` (`:1517-1543`, `:1530`). The prompt renders that merged `battle.portfolio.bench` (`agentEvalPromptAssembly.js:1168`). `bench.crypto` is set at the draft (`decide.js:1262`) and changes only by a crypto swap (`agentSwapExecution.js:461-464`, `:483-485`).

**Can a crypto reach it? Yes — exactly one, on every tiered battle.** Stored requests:

| Count | Value |
|---|---:|
| Requests with a `BENCH (available for swap)` table | 535 / 551 (16 read `BENCH: Empty`) |
| **…with a crypto row** | **144** = every tiered request; 0 flat6 |
| Crypto rows per bench table | always exactly 1 (ETH 113, BTC 20, SOL 11); Sector cell "Crypto" in all 144; status `available` in all 144 |
| Requests holding a crypto in `ACTIVE POSITIONS` | 144 (BTC 124, ETH 16, SOL 4; all in the Support tier) — the same 144 |
| By archetype (held = bench) | Trend Follower 112, Diversifier 24, Contrarian 8 |
| **The 26 pair-validation blocks with a crypto on the bench** | **26 / 26** |
| Proposals crypto → stock / crypto → crypto / stock → crypto | 26 / **0** / 0 |
| Crypto bench daily % up / down / zero | 33 / 111 / 0 |

**Plan-said ≠ code-did:** the prompt's fallback line ("if the bench never carries crypto … a BTC slot's only legal moves are hold, flip direction, or nothing") does not apply. The BTC slot's legal moves today are **hold, or swap for the one crypto on the bench** (subject to Q2's hurdle). "Flip direction" is not an agent move at all (Q3). In the window the model had the legal move on every check where it was refused, and never took it.

### Q6 — Where the sentence goes

**What the system prompt already says about slot kinds and tiers** (tiered template, `buildEvalSystemPrompt`, `agentEvalPromptAssembly.js:340-534`): the preamble's "tiered stock portfolio" (`:345`); `SCORING RULES` tier multipliers (`:350`); `5. TIER IMPACT AWARENESS` (`:374-377`); `RISK STATUS` locked positions (`:438-441`); `ANTI-THRASH` (`:472-479`). The live context's tables carry the `Tier` column (`:1466`) and the closed-trades `Tier` column (`:1741`). Nowhere does any of it say a slot has an asset class.

**Game-mode variants: two templates exist, and only one must carry the paragraph.**

- `buildEvalSystemPrompt` branches on `resolveModeConfig(gameMode).promptVariant` (`:340-344`): tiered → the template at `:345-533`; flat6 → `buildFlat6EvalSystemPrompt` (`:549-…`), "a deliberate full sibling" (`:536-548`).
- Flat6 has no crypto (`agentGameModes.js:62`, `:67`; `decide.js:1286-1287`), and the stored flat6 requests show none (0 / 407). **The crypto paragraph belongs in the tiered template only**; putting it in flat6 would describe a slot the tournament does not have.
- Inside the tiered template the other variance is `EQUIPPED_RULE_PRECEDENCE_ENABLED` (the `render*` helpers, e.g. `:288-298`) and the identity splice (`:341`, `:346`). A static paragraph outside those helpers lands identically in every tiered variant. One insertion covers all six archetypes.

**Insertion point (recommended):** after the last `SCORING RULES` line, "When you swap out an asset, its current points are LOCKED permanently…" (`:362`), and before `━━━ DECISION FRAMEWORK ━━━` (`:364`). Why there:
- it is a fact about portfolio shape, and that is where the tiers are described;
- the model reads it before `5. TIER IMPACT` and `7. SECTOR AWARENESS`, which it qualifies;
- it leaves the identity splice anchor `'\n\n━━━ SCORING RULES ━━━'` (`evalIdentityBlocks.js:216`) untouched, since it sits after that banner.

**Ruled out: a fourth bullet under `━━━ ANTI-THRASH RULES (MANDATORY) ━━━`** (`:472-479`). It would sit beside the cooldown rule, which is also validator-enforced, but the whole ANTI-THRASH block is pinned verbatim as a founder-ruled absolute (`api/_utils/agentEvalPromptAssembly.ask2.test.js:131-140`, checked at `:242-247`). A bullet inside it breaks that pin. The block also comes after rule 7.

**Also ruled out: before `SCORING RULES`.** The identity block must sit directly between the preamble and the `SCORING RULES` banner (`api/_utils/evalIdentityBlock.injection.test.js:88`; splice anchor `evalIdentityBlocks.js:216-218`).

### Q7 — Fence map and tests

**Fence map for the smallest fix (prompt-only, per Q3):**

| File | Fenced? | Touched? |
|---|---|---|
| `api/_utils/agentEvalPromptAssembly.js` | **Yes** (`docs/BUILD_RULES.md:21`) | Yes. One import and one interpolation in the tiered template (§3). §7-gated: founder sign-off on the diff. |
| A new render module (e.g. `api/_utils/evalCryptoSlotBlock.js`) | No | New. Under the flag-split rule it must be added to `PROMPT_CONTRIBUTING_MODULES` (`api/_utils/__fixtures__/promptHonestyRegistry.js:46-58`) **in the same commit** as the fenced splice (`docs/BUILD_RULES.md:30`). Otherwise the import tripwire fails CI (`api/_utils/agentEvalPromptAssembly.honesty.test.js:104-125`). |
| `api/_utils/agentEvalToolSchema.js` | Not on the §1 list (`docs/BUILD_RULES.md:14-24`), but "extending the model's output schema … is fenced-class review regardless of path" (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:35`) | **No.** R-2 needs no field because it is not being built (Q3). A field, or even an edit to the "bench stock" wording (`:7`, `:16`), would move three SHA pins in `agentEvalToolSchema.build1a.test.js:39-48` (the declarations tools are clones of the base literal) and the tool bytes embedded in the cron goldens. |
| `api/_utils/agentSwapExecution.js`, `agentScoring.js`, `api/agent/decide.js` | Yes | No. |
| `src/config/featureFlags.js` | No | Yes: the new flag, if flagged. |

**Tests and goldens that pin the eval system prompt** (search-agent map; each assertion line re-read):

| Pin | Kind | Tiered edit moves it? |
|---|---|---|
| `api/_utils/__p4_snapshots__/buildEvalSystemPrompt.analyst.snap.txt` — `p4Equivalence.battery.test.js:402-411` (plus verbatim `SCORING RULES` / `TIER IMPACT` substrings `:367-376`, which an insertion after `:362` keeps intact) | byte snapshot, live flags | **yes** |
| `…/buildEvalSystemPrompt.flat6.analyst.snap.txt` — `:420-436` (flat6 must not leak tier text, `:428-431`) | byte snapshot | no |
| `api/_utils/__dr13_snapshots__/buildEvalSystemPrompt.identityOn.*.snap.txt` — 6 tiered + 6 flat6, `evalIdentityBlock.injection.test.js:71-78` | byte snapshots, identity forced on (`:31-38`) | **the 6 tiered** |
| `api/_utils/__fixtures__/ask1PromptGoldens.json` `systemTiered` / `systemFlat6` — `agentEvalPromptAssembly.ask1.test.js:74-77` | whole-string `toBe`; mocks its own flags (`:27-36`) | **yes**, unless the suite pins the new flag false |
| `api/_utils/__fixtures__/ask2PromptGoldens.json` (6 tiered + 6 flat6), read by `agentEvalPromptAssembly.ask2.test.js` and `evalIdentityBlocks.ask2.test.js` | whole-string `toBe` | **yes**, unless pinned false |
| `api/_utils/__fixtures__/callRecordsOffGolden.json` — 8 tiered requests embedded; `agent-evaluate.callRecords.offGolden.test.js:486` ("prompt bytes moved"), SHA pin `:147` | cron golden, real flags except those mocked at `:103-107` | **yes**, unless pinned false |
| `api/_utils/__fixtures__/callRecordsRollbackGolden.json` — 1 tiered request; SHA `agent-evaluate.callRecords.rollback.test.js:91` | cron golden | **yes**, unless pinned false |
| `api/_utils/__fixtures__/meetingCopyBaseline.json` — request SHA-256s (`agent-evaluate.meetingCopy.baseline.test.js:158`, `:252`, `:268`), tiered harness (`tickStampsHarness.js:171`) | hashes; cannot be hand-edited | **yes**, unless pinned false |

The cron goldens' own rule: "Regenerate it ONLY from such a tree [the pre-change tree] (never to make this suite green…)" (`agent-evaluate.callRecords.offGolden.test.js:18-21`). The one time such a pin moved was a founder-ruled value-only reconciliation (`:142-146`). These goldens did not exist when the last unflagged prompt change shipped.

**Structural checks the paragraph must respect** (all keep passing if it is placed and worded as in §3):
- Identity placement: `injection.test.js:88`.
- Tiered/unknown-mode identity: `p4Equivalence.battery.test.js:413-418`. The paragraph must render for every non-flat6 mode, not only an explicit `'baggerbomb_agent'`.
- Ask 2 absolutes verbatim: `ask2.test.js:131-156`, `:242-247`.
- Exactly seven precedence qualifiers: `ask2.test.js:205-212`. The paragraph must not use that qualifier wording.
- `FORBIDDEN_SIGNALS`: `promptHonestyRegistry.js:23-31`. It also sweeps the new module's source; avoid the phrase "range position".
- `/Do NOT sell/` is banned in both variants: `ask1.test.js:150-153`.
- The cron's call line is pinned: `agent-evaluate.tickStamps.pins.test.js:171`, cron `:2823`. Unchanged if the builder's signature stays.

**The forbidden-terms test.** There is none for "crypto" or "short" on the eval prompt. The C-20 list is signal names only (`promptHonestyRegistry.js:23-31`). The only "crypto" negative in the repo is on a different builder (`api/_utils/tournamentAgentBoards.test.js:219`, `/…crypto from/i`). **Nothing would catch crypto prose leaking into the flat6 prompt.** The build should add that negative.

**Token budget.** The test budgets are chars/4 estimates on a synthetic maximal fixture (`api/_utils/composition.m7e2eBudget.test.js:59-62`, `:192-197`). The 25 Sep measurement puts that fixture's estimate at 10,250 (`:45`) with declarations on, under the 12,000 budget, so a ~150-token paragraph does not turn the test red. The same measurement's *real* count, 11,851, leaves 149 tokens (`docs/audits/20260925_EVAL_REQUEST_TOKEN_MEASUREMENT.md:11`, `:57-63`), and the paragraph would use most or all of that. That figure is a fixture margin, not a production ceiling: the capture's recorded input tokens for the 536 woken checks run 10,020–17,540 (median 14,254), and 505 of them are already above 12,000 (`records.json` `envelope.inputTokens`). Worth one line in the build report; not a blocker.

**`src/config/flagPinGuard.test.js`.** A new `*_ENABLED` flag in `src/config/featureFlags.js` (a registered source module, `:45-49`) that any test pins must carry `Pinned by:` naming every pinning file in its docstring (`:399-414`). A dark flag gets a `DARK_BY_DESIGN` entry with a note, removed in the flip commit (`:385-397`). The dark-prompt-flag precedent is a one-flag pin file, `src/config/equippedRulePrecedenceFlags.test.js`, with `// Pinned by:` at `featureFlags.js:2103`, above the flag at `:2104`.

**The precedent: flag or no flag.**

| Change | Commit, date | Flag |
|---|---|---|
| C-20 prose honesty (S2–S5 wording, both templates) | `0b9a676b`, 25 Jul 2026 | **None.** "⚠ LIVE PROMPT CHANGE, NOT FLAG-GATED" in its message, under §7 sign-off. The last unflagged prompt-text change. |
| **Ask 1** profit-taking (DECISION FRAMEWORK made honest) | `6a779188`, 19 Aug 2026 (dark) | `PROFIT_TARGET_EXECUTOR_ENABLED`, now `true` (`featureFlags.js:1984`). Flipped in `6d650ed0`, 26 Aug: 17 files — the flag, the guard, one pin, and 14 snapshots (2 P4 + 12 DR-13). |
| Ask 2 precedence qualifiers | `152217ea`, 2 Sep 2026 (dark) | `EQUIPPED_RULE_PRECEDENCE_ENABLED`, still `false` (`featureFlags.js:2104`). The **last** prompt-text change to the assembler. |

**Recommendation: flag.**
- Since C-20, every prompt-text change to this assembler has shipped dark and flipped on its own commit.
- An unflagged change now also moves three SHA-pinned cron goldens whose header forbids the only way to move them, and it changes a live prompt with no off switch.
- A flag makes the merge byte-identical (no existing golden moves).
- The flip becomes a small, reviewable commit. If the six non-snapshot suites pin the new flag false (the "flip-proofing" the Ask 1 suite already does for Ask 2, `ask1.test.js:31-35`), the flip moves exactly the 7 tiered snapshots (1 P4 + 6 DR-13), the flag, the pin and the guard entry.
- The cost is about 13 files in the build, past the BUILD_RULES §2 review threshold (≥ 10 files), so the build carries a multi-lens adversarial review. An unflagged inline edit is fewer files, but it moves 3 cron goldens plus 7 snapshots plus 3 JSON goldens at once and needs a founder ruling on the cron goldens.

### Q8 — The player's side

**Does the Voice Layer know the crypto-slot rules? No.** `api/_utils/voiceLayerPrompt.js` (4,045 lines):

| Word | Count | What they are |
|---|---:|---|
| "crypto" | 3 lines (`:3436-3438`), 7 case-insensitive substrings counting the identifier `benchCrypto` | All in `buildDeployedPortfolioBlock`: one display line, `Bench (crypto): ${symbol} (${sector})` (`:3438`). No rule anywhere. |
| "short" | 42 substrings | **4 mean a short position, and all four are the player's tournament flip lever**: `:109` "a user lever you don't pull yourself (short / flip / claim)"; `:2820-2821` "FLIP a position long↔short: available now"; `:2829` "do NOT tell them to flip, claim, or short". That lever is `false` in every non-tournament battle (`api/_utils/agentCapabilitiesManifest.js:94-98`; set only at `:109-111`). The other 38 are "short" as brevity, a trend horizon or a battle length. |

Nothing in the Voice Layer prompt says crypto swaps only for crypto or that the crypto slot can go short.

**When a swap is refused for pair validation, what does the player see? A generic "held by a guardrail", never the reason.**

| Surface | What it shows | Reader |
|---|---|---|
| Why? panel (and the tape check card, peek line, bubble, bench, which share the state) | Label **"Argued for a swap · held by a guardrail"**, then the model's own swap rationale word for word, then the footer "The agent's own words · the system held it". | `src/screens/battleView/selectWhyState.js:217-253` (the `downgraded === true` branch, `WHY_KIND.DOWNGRADED` at `:246-252`; rationale `:160`); label `src/data/decisionRecord.js:88`; footer `src/screens/battleView/battleViewCopy.js:242-243`; rendered `src/screens/battleView/WhyPanel.jsx:389-391`, `:467-471` |
| The only player-side read of `validationErrors` | It checks just whether `validationErrors[0]` starts with "Swap execution failed" (the thrown-swap state). "Cannot swap stock for crypto or vice versa" is never displayed. | `decisionRecord.js:99`, `:132-135`; used at `selectWhyState.js:237` |
| Status feed | If the model wrote a `status_feed_update`, a plain **hold** beat carrying the model's own text, written before the validator ran. That text can announce the swap the Why? panel says was held. | `api/cron/agent-evaluate.js:4065-4070` |
| Film Room check detail | **"SWAP → HOLD"**, no reason. | `src/screens/filmRoomV2/FilmRoomCheckDetail.jsx:56`; `src/screens/filmRoomV2/filmRoomCopy.js:100` |
| Chat (Voice Layer, grounded) | The same record label, "Argued for a swap · held by a guardrail", with the rationale. | `api/_utils/voiceLayerGrounding.js:180-184` |

So the refusal reads as **not quite a plain hold**: the player is told a guardrail held a swap. But "guardrail" is the wrong word here. The pair rule is the fenced validator (`agentSwapExecution.js:74-75`), not the guardrail layer (`agentGuardrails.js`), and the one label is shared by every downgrade site (`agent-evaluate.js:3447`, `:3466`, `:3509`, `:3587`, `:3593`). The player is never told *which* rule, and never that it was the crypto slot. (Search-agent sweep of every `downgraded` / `validationErrors` reader, each cited line re-read in this session.)

---

## §3 The smallest fix

**Scope: prompt-only, tiered template only, behind a flag.** No change to the validator, executor, scorer, tool schema, draft path or flat6 template.

### Insertion point (exact)

`api/_utils/agentEvalPromptAssembly.js`, inside `buildEvalSystemPrompt`'s tiered template:

```
:362  When you swap out an asset, its current points are LOCKED permanently. The incoming asset starts scoring fresh from its price at swap time.
:363  <blank line>   ← replace with ${renderCryptoSlotBlock()}
:364  ━━━ DECISION FRAMEWORK ━━━
```

This is the identity block's own pattern (`:346`; `evalIdentityBlocks.js:148-151`):
- the render returns `''` while the flag is off, so line 363 stays a blank line and every byte is unchanged;
- when on, it returns `\n━━━ YOUR CRYPTO SLOT ━━━\n\n<paragraph>\n`.

The render module reads the flag at call time (`evalIdentityBlocks.js:172-180`). It builds the symbol list from `CRYPTO_ASSETS` (`api/_utils/agentCryptoAssets.js:4-12`), so the list is read, not copied. The flat6 template (`:549-…`) is not touched.

### Draft paragraph (Fable finalizes the wording)

```
━━━ YOUR CRYPTO SLOT ━━━

Your portfolio holds six stocks and one crypto. The crypto sits in the
third Support slot. The crypto names in this game are BTC, ETH, SOL, XRP,
DOGE, ADA and BNB. Go by the symbol: the Sector column can read Unknown
after a swap.

- The crypto slot holds crypto only. It swaps only for the crypto on your
  bench, and a stock swaps only for a stock. The platform refuses any swap
  that pairs a crypto with a stock, and the check ends as a HOLD.
- So your crypto slot has two moves: hold it, or swap it for the bench
  crypto. Every other swap check still applies: cooldown, conviction, and
  the hurdle floor.
- Rule 7's sector rotation applies to your stock slots only.
- The game allows the crypto slot to be long or short; stock positions are
  long only. You cannot open or flip a short. Your crypto position is long,
  and a crypto you swap in comes in long.
```

How each sentence is backed:

| Sentence | Backed by |
|---|---|
| six stocks and one crypto; third Support slot | `agentGameModes.js:43-46`; `decide.js:1258`; `agentBattleService.js:158` |
| the seven names | `agentCryptoAssets.js:5-11` (rendered from it, not typed) |
| Sector can read Unknown | Q4, finding F1. **Drop this clause if F1 is fixed first.** |
| crypto only / stock only / refused → HOLD | `agentSwapExecution.js:69-77`; `agent-evaluate.js:3508-3512` |
| "the crypto on your bench" | exactly one per tiered battle (`decide.js:1143`, `:1262`); replaced by the outgoing crypto on a crypto swap (`agentSwapExecution.js:461-464`) |
| cooldown, conviction, hurdle floor | `agentSwapExecution.js:61-67`, `:79-82`; `agent-evaluate.js:3536-3590` |
| long or short; stocks long only (R-2) | The founder's ruling. In code: true of the scorer (`agentScoring.js:227-240`) and the player's game (`AssetPickerModal.jsx:73-81`). No agent path sets a direction (Q3). |
| cannot open or flip; position is long; swap-in is long | Q3: no field in the draft or trade tool; the executor copies only a stored direction, and none exists |

**Wording constraints:** keep `Do NOT sell` out (`ask1.test.js:150-153`); keep "range position" out (`promptHonestyRegistry.js:28`); do not use the Ask 2 precedence qualifier (`ask2.test.js:205-212`).

**The R-2 / R-3 tension, for Fable.** R-3 asks for both rules in the prompt. Q3 found the agent cannot act on R-2. The draft states R-2 as a fact about the game and then says plainly the agent cannot use it. That meets "must not promise a capability Q3 found absent". It still names a capability the model lacks, which invites it to reason about one (e.g. "I'd short BTC here"); and the Trend Follower's charter already says "Never: … fade or short strength" (`evalIdentityBlocks.js:103`).

The alternative is to say only "Every position you hold, crypto included, is long; there is no short in this game for you today" until the short task lands, then add R-2's second half with the capability. **Fable's call.**

### Flag recommendation

**Flag** (Q7), e.g. `CRYPTO_SLOT_PROMPT_ENABLED` (name is Fable's), shipped `false` and flipped in its own commit after a replay check (§4).

Precedent:
- Ask 1 shipped dark behind `PROFIT_TARGET_EXECUTOR_ENABLED` (`6a779188`) and flipped in `6d650ed0`.
- Ask 2 is still dark behind `EQUIPPED_RULE_PRECEDENCE_ENABLED` (`152217ea`).
- The last unflagged prompt change was C-20 (`0b9a676b`, 25 Jul), which predates the cron goldens.

### Files and tests that change

**Build commit (flag dark): no existing golden moves.**

1. `api/_utils/agentEvalPromptAssembly.js` (fenced): one import, one interpolation at `:363`.
2. New `api/_utils/evalCryptoSlotBlock.js` (non-fenced render module) and its test:
   - flag-off renders `''`;
   - flag-on renders the paragraph, with the symbol list equal to `VALID_CRYPTO_SYMBOLS`.
3. `api/_utils/__fixtures__/promptHonestyRegistry.js`: add the module to `PROMPT_CONTRIBUTING_MODULES` (same commit; `BUILD_RULES.md:30`). The `FORBIDDEN_SIGNALS` source sweep then covers it automatically.
4. `src/config/featureFlags.js`: the flag (`false`), its flip map, and `// Pinned by:`.
5. New one-flag pin file, after `src/config/equippedRulePrecedenceFlags.test.js`.
6. `src/config/flagPinGuard.test.js`: a `DARK_BY_DESIGN` entry with a note.
7. Flag-on assertions (in the new test or the honesty suite):
   - the block appears exactly once in the tiered prompt for all six archetypes, between `SCORING RULES` and `DECISION FRAMEWORK`;
   - it is also present for undefined/unknown `gameMode` (`p4Equivalence.battery.test.js:413-418`);
   - **flat6 contains no "crypto" (new negative, Q7)**;
   - identity placement and the Ask 2 absolutes and qualifier count still hold flag-on.
8. Flip-proofing: pin the new flag `false` in the `featureFlags` mocks of `agentEvalPromptAssembly.ask1.test.js`, `agentEvalPromptAssembly.ask2.test.js`, `evalIdentityBlocks.ask2.test.js`, `agent-evaluate.callRecords.offGolden.test.js` (`:103-107`), `agent-evaluate.callRecords.rollback.test.js` and `agent-evaluate.meetingCopy.baseline.test.js`. Their goldens then stay the pre-change text of record, and none needs regenerating.

About 13 files, past the BUILD_RULES §2 review threshold: multi-lens adversarial review, `vite build`, mutation check on the new rows.

**Flip commit:**
- the flag `true`;
- the pin and the `DARK_BY_DESIGN` entry removed;
- **7 snapshots** regenerated: `__p4_snapshots__/buildEvalSystemPrompt.analyst.snap.txt` and the six tiered `__dr13_snapshots__/buildEvalSystemPrompt.identityOn.{analyst,contrarian,degen,diversifier,guardian,momentum_chaser}.snap.txt`.

Flat6 snapshots, `ask1`/`ask2` goldens and the three cron goldens do not move.

**Not changed by this fix:**
- the tool schema and its SHA pins;
- the validator, executor and scorer;
- `formatRecentEvals` and its pinned whitelist (surfacing the refusal reason to the next check is its own task, §4);
- the Voice Layer and player copy (Q8: also its own task).

---

## §4 Gaps, and findings for separate tasking

### What code alone could not settle

| Gap | Why it matters | What a follow-up needs |
|---|---|---|
| Whether the model takes the legal move once told | The fix's whole point. 0 of 551 checks proposed crypto → crypto. | A replay, not a Firestore read. Re-send the 26 refused requests and the other 118 tiered requests with the paragraph spliced in, then measure crypto → stock proposals (target ≈ 0) and crypto → crypto proposals. 144 calls on the batch route, about $1.50 at the experiment's prices (INFERRED from its §7 per-call cost). This is the build's natural acceptance probe. Model calls were out of scope here. |
| How often a crypto → crypto swap would clear the hurdle | Q2: the stored bench rows show the bench crypto up on the day 33 of 144 times. The held crypto's *daily* move is not in the prompt (the positions table shows gain from entry), so the ATR-margin step cannot be computed from the capture. | A price read (daily changes for BTC / ETH / SOL over the window), or a live battle. |
| Do crypto symbols have `stockRankings` / `stockTechnicalScores` rows? | Decides two INFERRED rows in Q2: the distressed veto never fires for crypto, and the hurdle uses the frozen 5% ATR. | One Firestore read of each collection for the seven symbols. |
| The "Unknown" label on a swapped crypto | Q4 shows it for every swapped stock (305 requests); no crypto swap ran in the window. | A unit test (`executeSwapServer` → `buildPortfolioCSV`) or one live tiered battle with a crypto swap. |
| Whether tiered battles still start | 13 of the 38 battles in the window were tiered (144 of 551 requests). The fix only reaches tiered battles. | A Firestore count of new `baggerbomb_agent` battles per week. |

### The short-direction task (R-2, per R-4)

Separate from this build. What it would need, from Q3:
- **A way to say it.** Either a field on the trade decision (e.g. `direction` on a SWAP whose incoming name is crypto) or a third decision (e.g. `FLIP` on the held crypto). This changes the tool schema, which serves both game modes and all three declarations variants (`agentEvalToolSchema.js:496-504`), and the validator that reads it live (`agentEvalToolResultValidation.js:49-51`).
- **A way to do it.** The fenced executor takes no direction (`agentSwapExecution.js:222`). It would need a direction argument, or a flip that locks the current points and reopens the same symbol the other way. The tournament user flip is the in-repo pattern (`api/tournament/flip.js:152-186`). The fenced validator would need to accept it, and it refuses a self-swap today (`agentSwapExecution.js:55-56`). This is §7-gated fence contact in `agentSwapExecution.js` and `agent-evaluate.js`.
- **A way to see it.** A direction cell in `ACTIVE POSITIONS` (`agentEvalPromptAssembly.js:1466`, fenced).
- **Scoring is ready**, with one caveat (finding F2 below).
- Note that the Trend Follower's charter says "Never: … fade or short strength" (`evalIdentityBlocks.js:103`). That is not a conflict (shorting weakness is not forbidden), but the short build should expect it to shape that archetype's use.

### Findings outside this task (BUILD_RULES §3: reported, not fixed)

- **F1 — Every swapped asset loses its sector.** The executor writes the incoming asset (`agentSwapExecution.js:416-424`) and the outgoing bench entry (`:449-456`) with no `sector`, and both prompt tables print `'Unknown'` (`agentEvalPromptAssembly.js:1474`, `:1503`). Stored requests: 483 of 3,450 position rows and 483 of 9,094 bench rows read "Unknown", exactly the 305 requests that have closed trades. This blinds rule 7 (`:288-298`) and the Diversifier's sector-shape charter (`evalIdentityBlocks.js:117`) on every swapped name. The fix point is the fenced executor, or a re-stamp at render (the assembler is fenced too).
- **F2 — For a short, the scorer's intraday extremes are negated but not swapped.** `agentScoring.js:234-239` sets `highChange = −high` and `lowChange = −low`, then `:273-279` uses `highChange` for the maximum and `lowChange` for the minimum. For a short, −high is the *worst* point and −low the *best*, so the two extremes land on the wrong sides and can never move a short's badges past its current multiplier. The canonical scorer (`src/utils/baggerBombUtils.js:545-551`, `:594-595`) and the player's V4 hook (`src/hooks/useBaggerBombBattleV4.js:744-751`) read the same way. INFERRED effect, from reading only; a unit test would settle it. It touches the player's crypto shorts today. It does not touch agent battles: the agent evaluator passes `{}` for extremes (`agent-evaluate.js:1200-1202`), and no agent short exists. It should be settled before the short build.
- **F3 — "Held by a guardrail" names the wrong layer** for pair-validation, LOCK, distressed, hurdle and swap-cap downgrades (Q8). The player is never told which rule held a swap.
- **F4 — The status feed's hold beat can carry text announcing a swap that did not happen** (`agent-evaluate.js:4065-4070`; Q8).
- **F5 — Two copies of the crypto list** (`api/_utils/agentCryptoAssets.js:4-12`, `src/constants/cryptoPool.js:6-14`), kept apart for an import rule that BUILD_RULES §4 retired. They agree today.
- **F6 — The model never learns why a swap was refused** (Q4). A downgraded check is fed back to the next one as `HOLD` with its own swap rationale (`agent-evaluate.js:4121-4125`; `agentEvalPromptAssembly.js:1389-1402`). This holds for every downgrade cause (LOCK, distressed, pair, hurdle, swap cap), not only crypto. Changing what `formatRecentEvals` shows touches its pinned whitelist (`agent-evaluate.js:4156-4158`) and the fenced assembler. Its own task; the crypto paragraph removes the commonest cause without it.

---

## Appendix — counts over the stored requests

**Source:** `C:\Users\fashr\ft-experiment-exhibits\archetype-ablation-run\sources.jsonl` (SHA-256 `6fb95a74bcbdd8ae59580b48ec8896722938d07ddc1be4a58c1b463202144437`; 623 lines; 551 with a `request` string) joined to `records.json` (2,823 records) on `k` for archetype and gate cause. Read-only; scripts in the session scratchpad print counts only.

**Parsing rules:**
- Each `request` is parsed as JSON. `system` is the system prompt; `messages[0]` the identity block; `messages[2]` the live context.
- **Game mode:** "League Tournament game" in the system prompt → flat6 (`agentEvalPromptAssembly.js:550`), "BaggerBomb game" → tiered (`:345`).
- **`ACTIVE POSITIONS`:** the header line after `ACTIVE POSITIONS:\n`; rows run to the first blank line; columns are located by header name (`Symbol`, `Sector`, `Tier`, `$Current`, `Gain%`).
- **`BENCH`:** the rows after `BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status`, to the first blank line. Column 0 is the symbol, 1 the sector, 3 the daily %, 5 the status.
- **Crypto:** the symbol is one of the seven in `agentCryptoAssets.js:5-11`.
- **`YOUR LAST 3 DECISIONS`:** the text after that header to the end of the message, probed for "Cannot swap stock for crypto" and for blocked / downgrad / validation.
- **Word probes:** "crypto" is case-insensitive. "short" is a whole word, classified by the word after it (sentence / coach / strength).
- **Gate cause:** `records.json` `gate.cause` = `pair_validation:asset_class_mix`; the proposal is read from `gate.orig.{action,out,in}`.

| Count | Value |
|---|---:|
| Stored request bodies | 551 (tiered 144, flat6 407) |
| Tiered requests holding a crypto / with a crypto bench row / both | 144 / 144 / 144 |
| Crypto bench rows: `$0.00` / daily up / down / zero / `available` | 0 / 33 / 111 / 0 / 144 |
| Pair-validation blocks / with a bench crypto / proposed crypto → stock | 26 / 26 / 26 |
| Proposals crypto → crypto anywhere | 0 |
| "crypto" in system / tool / live context outside sector cells | 0 / 0 / 0 |
| "crypto" in message 1 (agent's own brief or rationale) | 34 (Trend Follower 30, Diversifier 4) |
| `YOUR LAST 3 DECISIONS` blocks / mentioning a refusal | 515 / 0 |
| Requests with "Unknown" sector cells / with closed trades / both | 305 / 305 / 305 |
