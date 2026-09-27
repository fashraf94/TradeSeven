# Film Room → Command Center: Phase 0 Handback

**Date:** 2026-09-15
**From:** the Film Room parallel chat
**To:** the Command Center / Battle View design chat (arc authority)
**Per:** handover brief §6 — "Send back to this chat: the Phase 0 report when it lands, and the spec before it is built."
**Status:** handback with requests. Nothing here is built or merged. The Film Room spec has not been written; it waits on this chat's replies in §8.

## Attached

| Artifact | Location |
|---|---|
| Phase 0A — Archetype Identity Inventory | `docs/audits/20260915_PHASE0A_ARCHETYPE_IDENTITY_INVENTORY.md` on `claude/phase0a-archetype-identity` @ `4f1efeb3` |
| Phase 0B — Film Room Mechanics Discovery | `docs/audits/20260915_PHASE0B_FILM_ROOM_DISCOVERY.md` on `claude/epic-bell-stwcxu` @ `d75c35bd` |
| Film Room design note V1.3 | `docs/FILM_ROOM_REVIEW_LOOP_DESIGN_NOTE_V1_3_20260915.md` (committed by the founder alongside this note) |

Both discoveries ran read-only at HEAD `a007a2b5` (= `origin/main`). Neither could read the design note, because V1.2 had not been committed; both state that no finding depends on it. The two sessions resolved the prompt's branch name differently — 0A used the named branch, 0B its session-assigned branch — so both SHAs are listed for later cherry-picks.

Every claim below cites a report section; the reports carry the full `file:line` evidence.

---

## 0. In plain terms (for the founder)

- **The score bug is explained, and the Command Center's number was right.** The fix is one stored score per day plus a stored win/loss that every screen reads.
- **The "what if we'd held" replay is buildable.** The scoring math is reusable and the price fetcher works for any stock; the prices just aren't saved today.
- **Three things an honest review needs aren't recorded at all:** whether each safety mechanism was active, what was on the bench when the agent chose, and the stop levels that forced an exit. We're asking this chat to start recording them, because every day without them is lost for good.
- **The Sep 14 directive was recorded.** The Film Room just doesn't show it. The 0B report blamed a different mechanism; §2 corrects it.
- **The discoveries found live gameplay bugs.** The most serious: deployed stop-losses and trailing stops are only checked on ticks when the agent is woken up.

---

## 1. Founder rulings from the Film Room chat that touch this arc

| Ruling | Content | Effect on this arc |
|---|---|---|
| R11 | The headline is the score that decides the outcome: the cumulative score at each day's close, with the day's change beside it. | Needs one stored source (§3, request C-5). |
| R14 | Capture going forward what an honest review needs. | Requests C-1 to C-5, in fenced or arc-owned code. |
| R15 | Called shots in v1 show each plan beside what the price did, with no verdict, until the plan's condition is stored in checkable form. **Provisional.** | Request C-6. |
| R16 | Character in v1 judges the pick, not the hold. **Provisional.** | No build request; findings in §6. |
| R2 | Agent-written proposed rules are retired at the writer, not only hidden. | Request C-8, with the Forge Record stream. |
| R12, R13 | Three review depths; the tape is built for every battle at day grain. | Hosting question inside C-5. |

The founder settles direction after hands-on use and expects R15 and R16 to move once v1 is in his hands, so the Film Room build keeps them as separable layers and prioritizes an early usable version. Earlier rulings (R1–R10) are in design note V1.3 §2.

---

## 2. Corrections to the record

1. **The Sep 14 directive was recorded; the Film Room doesn't render it.** 0B §2 and §3-B1 attribute "no record of the directive" to the unmounted gameplan approval card. That conflates two mechanisms. Per the handover brief §4, the directive is on the battle document (`directive`, with canonical text, adjustment id and thread id), was stamped `heard` at `eval_008`, and was followed by seven holds. 0A Q5 (channel C) confirms directives reach the eval prompt (`directiveGate.js:85` → `agentEvalPromptAssembly.js:1228-1242`). No Film Room component reads `battle.directive` (0B §3-F1 render inventory). **Defect 3 is a rendering gap owned by the Film Room.** The gameplan card finding stands as a separate bug (G-2).

2. **The handover's third score candidate double counts.** On Sep 14 day 1, the +30 badge figure is `dailyScores.day1.badgePoints`, a bonus-only sum over held positions (`agent-daily-scores.js:84`, `:130`). Those bonus points are already inside `activeScore`, because a held position's `totalPoints = basePoints + bonusPoints` (`agentScoring.js:296`; `agent-evaluate.js:875`). `bankedBadgePoints` carries only earlier days' badges, which is zero on day 1. So `currentScore = 331 − 206 + 0 = 125` is the outcome-deciding number, and 155 counts the day's badges twice. 0B Query 1 confirms against the document.

3. **Claims made earlier in the Film Room chat that 0A corrected:**
   - The eval identity block is live, not dark (`EVAL_IDENTITY_BLOCK_ENABLED = true`, `featureFlags.js:1508`).
   - No archetype-specific stop calibration exists: every battle runs the `balanced` preset (`agentBattleService.js:256`; `agent-evaluate.js:684`).
   - The industry layer is implemented (0B §3-F3).

---

## 3. The three handover defects, answered

### Defect 1 — the score (0B §3-A1)

- **Film Room total:** Σ day-N trades' `lockedPoints` + `dailyScores["dayN"].badgePoints` (`src/utils/computeDayScore.js:20-36`), rendered by `ScoreSummaryCard.jsx`. It omits every held position.
- **Outcome-deciding score:** `currentScore = activeScore + bankedScore + bankedBadgePoints` (`agent-evaluate.js:875-883`). The Command Center (`ReviewStation.jsx:21`) and the day-summary prompt (`agent-batch-review.js:267`) both read it.
- **Outcome:** `resolveCompletionDisposition` (`agent-evaluate.js:4309-4333`) compares `currentScore` to the opponent's, counting badge points. **The result is never persisted** — the completion payload (`:4498-4538`) has no `result` field.
- **No per-day total is stored anywhere.** `dailyScores` holds badge points only, written solely by `agent-daily-scores` for `status == 'active'` battles (`agent-daily-scores.js:182-187`; `agentBattleService.js:43-47`). A stocks-only battle expires at 16:00 ET, is completed by the evaluate cron, and is skipped when `agent-daily-scores` runs at 20:45 ET, so **its final day never gets an entry**.
- **Ruling R11** makes the headline the outcome-deciding score. **Request C-5** gives every surface one source.

### Defect 2 — what happened after a swap (0B §3-B4, §3-F1)

- **Trade rows show only the sold stock's numbers.** Every scored quantity is keyed on `symbolOut` (`agentSwapExecution.js:255-273`). The bought stock's basis goes to the portfolio slot (`:281-289`), and no trade-to-slot join exists in `src/`.
- **Sold stocks stay on the bench and are quoted every check** (`agent-evaluate.js:689-721`) but **never persisted** (`:702-705`). The last stored price for a sold stock is its exit price.
- **Scoring samples threshold touches once per check with empty extremes on every agent path** (`agent-evaluate.js:815-821`, `:863-869`; `agentSwapExecution.js:248`; `agent-daily-scores.js:122-128`). A replay must sample at check times, not from OHLC, or it disagrees with banked points (BUILD_RULES §9).
- **The scorer is pure** and already runs server-side (`agentScoring.js:224`; `baggerbomb-v4-daily-scores.js:24`). The intraday fetcher is generic over symbol (`marketDataCache.js:792`), uncached, one GET per symbol.
- **Two counterfactual representations are dead ends:** `dailyReviews[].counterfactuals` (vetoed buys only) has no live reader, and `counterfactualPoints` is read with no writer (0B §3-B5). The Film Room's replay will replace both; we recommend binding every surface to that one source.
- **Request C-4.**

### Defect 3 — the directive

A rendering gap (§2 item 1). Requests:
- confirm the meaning of the `battle.directive` fields and the tick-stamp `heard`/`saw` fields;
- report the status of the directive-gate discovery (what was asked versus what was filed) before the directive card is specced.

Per 0A §5, any Forge Record entry quoting a directive must pin both `adjustmentId` and `canonicalTextVersion` (`directiveGate.js:92-93`).

---

## 4. Capture and change requests

| ID | Request | Why the review needs it | Evidence | Suggested home | One-way door? |
|---|---|---|---|---|---|
| **C-1** | **Armed state per held symbol per check.** For each mechanism: armed or disarmed and why (intraday session usable and candle count; 5-minute SMA present; VWAP streak before and after; tick-age flag); whether the trigger gate opened; whether guardrails were evaluated, with threshold and actual. | A protection record that never credits a disarmed or unevaluated guard. | 0B §3-C1: cron state is eight last-write-wins keys (`agentCronState.js:35-48`); stamps record only the priority-chain winner, and only when a prompt is built (`tickStamps.js:87-89`, `:150-155`; `agent-evaluate.js:2805`). | Extend tick-stamp evidence, plus coverage for checks that build no prompt. | **Yes** |
| **C-2** | **Bench composition, cooldowns and hot-bench additions at swap time.** | Judging the pick against the real alternatives. | 0B §3-B2: the live bench is overwritten inside the swap transaction (`agentSwapExecution.js:323-360`); hot-bench additions are in memory only (`agent-evaluate.js:1120-1127`). | The L1 learning receipt, avoiding a wider fenced trade record. | **Yes** |
| **C-3** | **Risk boundary numbers per exit:** bust buffer and the risk manager's own entry-based ATR multiple; trail level and 5-minute SMA; VWAP streak and dead band; guardrail threshold and actual. | "Which line broke, at what level" without parsing prose. | 0B §3-B2: numbers exist only as prose in `rationale` (`agent-evaluate.js:1554`); the sibling `evaluations[]` join is null on 3 of 6 swap paths (`:1642`, `:3818`, `:3982`); the receipt schema marks them not stored (`learningSchemas.js:158-160`). | The L1 learning receipt. | **Yes** |
| **C-4** | **Post-sale prices for recently sold stocks at each check** while they sit on the bench. | An exact replay that agrees with tick-sampled scoring. Without it, the Film Room rebuilds prices from 5-minute candles at check times and labels the replay "rebuilt." | 0B §3-B4. | A small per-battle price map, or the receipt. | No — candles can rebuild it, less exactly |
| **C-5** | **One score source:** a per-day snapshot of `currentScore` and its terms at each trading day's close; the outcome (`result`) persisted at completion; `dailyScores` written for battles that completed that day. | R11 — every surface reads one number. | 0B §3-A1. | A flag-gated, budget-floored rider on `agent-daily-scores` (20:45 ET), which declares no `maxDuration` and must be measured first (0B Probe 6). Alternative: the completion payload (`agent-evaluate.js:4498-4538`), which is fence-adjacent. | **Yes**, for day-close values |
| **C-6** | **A structured condition on anticipation entries** (operator, level or reference, expiry), captured at write time, and kept by the grounded path. | R15's eventual verdict layer. Without it, no code can test a plan. | 0B §3-D3: `threshold` is a free-text sentence (`agentEvalToolSchema.js:178-181`); the grounded path drops it (`voiceLayerAnticipation.js:104-128`). | The eval tool schema plus both anticipation writers. | No |
| **C-8** | **Retire or quarantine the agent-authored rule writers:** `proposedRules` (a required field of the review tool schema) and `forgeSuggestions[]` (written by the auto-debrief with a synthetic turn). | R2 — the tape doesn't ship beside a live agent-authored rule writer. | 0B §3-B5: `agent-batch-review.js:86`, `:320`, `:336`, `:382-387`, `:439-457`; the "only when the user asks" guard is prompt prose only (`voiceLayerPrompt.js:437`). | With the Forge Record stream, under amended D-i. | No |

**Noted, not requested for v1:**
- **C-7 — review-mode grounding.** `chat.js:476` grounds only `mode === 'battle'`, so the Film Room chat is never grounded at any flag value (0B §3-F1). Film Room v1 ships without agent narration. Any later narration needs a review-mode grounding path.
- **Held-position data parity.** Held positions receive no trend, relative strength, RSI, MACD or volume in the eval prompt (`agentEvalPromptAssembly.js:1458-1487`), while the identity blocks' holding rules reference exactly those. This is why R16 excludes holds; it is a platform finding for the spine thread.

**Field meanings to confirm before the spec** (handover §6 — "confirmed rather than inferred"):
- `scoreState` terms: `activeScore`, `bankedScore`, `bankedBadgePoints`, `dailyScores`.
- Trade fields: `exitReason`, `source`, `swapDay`, `tradingDay`, `lockedPoints`, `snapshot`.
- Tick-stamp evidence and anticipation fields (`tickStamps.js:87-89`, `:275-289`).
- The L1 receipt fields the tape would read (`learningSchemas.js:96-200`).
- `battle.directive` fields.

---

## 5. Bugs found (for this arc's triage)

### Priority A — gameplay

| # | Finding | Evidence | Note |
|---|---|---|---|
| **G-1** | Deployed stop-loss and trailing-stop guardrails are evaluated only on checks where the trigger gate opens. On a quiet check they are not evaluated. | 0B §3-C1: `applyGuardrails` at `agent-evaluate.js:2205` (after the trigger gate's early return, `:1934-1951`) and `:3624` (R11 pass, gated at `:3610`); acknowledged in code at `:3586-3593`. | Please confirm whether the R11 pass covers checks where the trigger gate stays closed. |
| **G-2** | The gameplan approval card is on no live screen, so meetings expire unapproved. Per 0B, a pending meeting blocks model evaluation for the rest of that day. | 0B §3-B1: `GameplanMeetingCard.jsx:16`; live mounts don't pass the prop (`PaneTape.jsx:223-232`, `GameTapeView.jsx:636-646`); block at `agent-evaluate.js:4148`. | `gameplan_rotation` is unproduced in practice. |
| **G-3** | Risk presets are archetype-blind: every battle runs `balanced`. `defaultPreset` is read only by the Character "discipline" axis. | 0A Q3.5, Q6.5: `agentBattleService.js:256`; `agent-evaluate.js:684`; `behaviorFingerprint.js:157` → `CharacterKit.jsx:22`. | A product decision for the archetype work, and a §9 display-agreement issue. The Capital Preserver constitution's "wide and patient" stop contradicts both the code and its declared `defensive` preset, which is the tightest. |
| **G-4** | The VWAP-failure streak is zeroed, not paused, on a stale check. The freshness gate checks the session's date, not the data's age. | 0B §3-C1: `agent-evaluate.js:1344-1346`; `agentVwapFloor.js:36-38`; `marketDataCache.js:1032-1040`. | A 09:35 bar passes the gate at 15:55. |
| **G-5** | Latent: co-pilot proposals auto-execute on expiry; today only the autopilot launch guard blocks it. | 0B §3-B1: `agent-evaluate.js:3384-3427`; guard `:3150-3163`. | A direct write of `executionMode: 'copilot'` re-arms it. |
| **G-6** | Latent: an off-universe equipped ticker can reach an unguarded dereference inside the swap transaction. | 0B §3-D2: `agent-evaluate.js:1093`; `agentSwapExecution.js:45`, `:167`. | Unreachability was assumed by reading, not executed. |
| **G-7** | The guardrail path's held-set omits the cross-agent held set that the risk path includes. | 0B §3-B3: `agentGuardrails.js:241`, `:506` vs `agent-evaluate.js:1436-1441`. | May be intentional. |

### Priority B — display agreement and prompt honesty

| # | Finding | Evidence | Note |
|---|---|---|---|
| **H-1** | A stocks-only battle's final day never gets a `dailyScores` entry. | 0B §3-A1 | Folds into C-5. |
| **H-2** | A final-day review is dated the day after the battle, and the day card shows "Day N" beside that date. | 0B §7: `agent-batch-review.js:176-178` vs `:318`; `DaySummaryCard.jsx:51` | |
| **H-3** | The live battle screen's in-flight total omits `bankedBadgePoints`. | `AgentBattleScreen.jsx:1034-1037` vs `agent-evaluate.js:883` | Drifts on multi-day battles. |
| **H-4** | The eval playbook asks for indicators the prompt never supplies (upper band, MACD histogram; RSI-based strategies for held positions). | `agentEvalPromptAssembly.js:415`, `:420-421` | Fenced assembler. |
| **H-5** | The tick stamp's ATR multiple is the scorer's (prior close), not the risk manager's (entry). | `tickStamps.js:193` vs `agentRiskManager.js:124-125` | Re-deriving bust or trail from stamps uses the wrong number. |
| **H-6** | `counterfactualPoints` is read with no writer. | `voiceLayerPrompt.js:1600`, `:2137-2139` | |
| **H-7** | The settings fingerprint splits by game mode: the tournament path passes a null watchlist. | 0B §3-F2: `decide.js:919` vs `:1464`; tests `resolvedAgentManifest.test.js:212-216`, `:239` | Needs a ruling on the field's meaning. The Film Room chat recommends "the configuration that governed this battle": the tournament `null` is then correct, and the game-mode test needs rewording. |

### Priority C — hygiene

| # | Finding | Evidence |
|---|---|---|
| **Y-1** | `EVAL_IDENTITY_BLOCK_ENABLED` and `ARCHETYPE_INTEGRITY_MODE` are live and outside `flagPinGuard`; an accidental revert would not red CI. | 0A Q4.1 |
| **Y-2** | `MANIFEST_WRITE_ENABLED`'s docstring still describes the pre-flip default. | 0B §3-F2 |
| **Y-3** | `pickEmergencyReplacement` is dead but still exported (removal is fenced-file contact). | 0B §3-B3 |
| **Y-4** | Stale in-code comments: `archetypeRuleCompatibility.js:16-24`; `archetypeRegistry.js:105`. | 0A §5 |
| **Y-5** | `gameplan_proposal` is listed as a live reason in `FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4.md:392`, `:513`, but has zero writers. | 0B §3-B1 |
| **Y-6** | `TrainingReportCard.jsx:22` imports from `api/`. | 0B §3-F1 |
| **Y-7** | Documentation line anchors are systematically stale (Signal Inventory V2, keystone documents, mastery and cockpit discoveries). Do not seed builds from them. | 0A §5; 0B §5 |

---

## 6. Identity findings for Ask 2 and the spine thread (from 0A)

1. **The identity block is live** in both eval prompt variants (`agentEvalPromptAssembly.js:341`, `:346`, `:551`), and the six renders are CI-locked byte-for-byte to the constitutions (`evalIdentityBlocks.js:12-18`). The constitutions are the current identity documents; the June definitions are not a reliable description of what any model is told.
2. **The guardian render says "low-beta required"** (`evalIdentityBlocks.js:138`), but beta reaches no decision path. Meanwhile `sectorDiversity` — at .35, its heaviest weight (`archetypeScoring.js:62`) — is unmentioned. The Capital Preserver constitution's own kernel lists spread second, so the kernel and its locked render disagree, and the parity test cannot catch that.
3. **The subordination clause in every block is documented as false** while `EQUIPPED_RULE_PRECEDENCE_ENABLED = false` (`evalIdentityBlocks.js:60-72`; the reconciler at `decide.js:262`). The honest clause is built and dark.
4. **Holding rules reference data held positions never receive** (§4 note). The deterministic two-leg exit is unbuilt (0A Q7.3).
5. **The DR-13 harness compared decisions and symbols only** and found zero drift. It cannot evidence in-character behavior (0A §5).
6. **Channel D:** `mandatePromptAssembly.js:69-72` puts `archetypeIdentity` copy verbatim into the mandate trading prompt, and the June definitions misquote those strings (0A §5).
7. **Zone prose is the least-protected identity content:** there is no doc-to-code parity test, and Zone 1 is duplicated in `ZONE1_REFS` with no test binding the two copies (0A §5).
8. **`noise_discounted` is ratified** (`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:34`) **and unbuilt** (0A Q8.5). The Capital Preserver's noise-versus-damage line has no machine-readable threshold.
9. **The Capital Preserver constitution's header cadence** ("2 swaps/60min", `:6`) contradicts its own body and the code (2 per 120 minutes).

---

## 7. Open data questions (the founder runs these)

| Item | Question | Why it matters |
|---|---|---|
| 0B Query 1 | Confirm the Sep 14 arithmetic from the battle document. | Closes Defect 1 and §2 item 2. |
| 0B Query 2 | How often the final-day `dailyScores` hole fires. | Sizes H-1. |
| 0B Probe 3 | When a session's 5-minute candles become retrievable after the close. | Decides when the replay can run; also answers Probe 5 (extended-hours bars). |
| 0B Probe 4 | Whether explicit windows retrieve specific past sessions. | Replaying earlier days of multi-day battles. |
| 0B Probe 6 | `agent-daily-scores` wall time, from Vercel logs. | Whether it can host the C-5 rider. |
| 0A Q-A | The active identity version in the activation record. | Confirms which catalog seeds born-with traits. |
| 0A Q-B | Battle counts by `strategyPreset`. | Sizes G-3. |
| 0A Q-C | The guardian exit-reason mix. | Whether shared risk lines visibly shake the Capital Preserver out. |

---

## 8. What the Film Room chat needs back

1. **Triage and owners** for the §5 gameplay bugs, G-1 to G-3 first.
2. **Yes or no, owner and sequencing** for C-1 to C-6 and C-8, including fence contact and any conflict with in-flight work (tick stamps, the eval cron, `directiveTransaction.js`, the Battle View).
3. **Confirmation of the field meanings** listed in §4.
4. **The directive-gate discovery's outcome** (what was asked versus what was filed), before the directive card is specced.
5. **Who builds C-5:** this arc, or the Film Room build under this arc's review.

After that: Film Room spec V1 → Sol blind review → back to this chat → build, dark behind flags.
