# Archetype proposal — Fable's independent review

**Date:** 21 Oct 2026 · **Author:** Fable · **For:** Flash, before commissioning any archetype build · **Status:** review only; nothing built, nothing run against paid models or live data.
**Reviewed:** the Oct 20 brief ("Prepared October 20, 2026. For Claude's independent review before new archetype implementation"), Scout's Cockpit Partnership Baseline (Oct 20), `COCKPIT_BUILD2B_SPEC_V1_0.md`, Amendment D rev 4.
**Verified against:** `main` at `0fc78b02` (the #984 merge, 19 Oct 23:13 CT) — the same commit the brief's last inspection used, so every claim below is checked at the code the brief cites. Markers: **VERIFIED** = read in this session at that commit, with `file:line`; **REPORTED** = taken from a committed report on `main`; **BRIEF** = the brief's own claim, not independently checked.
**Destination:** `docs/audits/20261021_FABLE_REVIEW_ARCHETYPE_PROPOSAL.md`, committed by the first build's docs commit (no docs-only PR).

---

## 0. Verdict

**Proceed with specified changes.** The diagnosis is mostly right and the first build candidate (a pure daily setup evaluator) is the right *module*, but the proposal puts it in the wrong *seat*. Three facts on `main` change the plan:

1. **BaggerBomb battles are one trading day.** `AGENT_BATTLE_DURATION_MODE = 'fullday'` (`api/_utils/agentBattleService.js:37`, `:119-123`, VERIFIED). No daily bar completes inside a battle. A completed-daily-bar verdict can inform **which names to deploy** and **the next morning's review**; it can never answer a 3 PM "is the condition met?" question, and it must not be asked to.
2. **The archetype is not in the brain's thinking today, and selection was identical across archetypes by construction.** The Oct 13 ablation (REPORTED, `docs/audits/20261013_EXPERIMENT_ARCHETYPE_ABLATION_AND_GATE_CENSUS.md` §1) found that swapping the Trend Follower's charter for the Contrarian's changed no more decisions than resending the same prompt. The Oct 18 refresh review (REPORTED, `docs/audits/BAGGERBOMB_ARCHETYPE_REFRESH_REVIEW_20261018.md` §1, F1) found every archetype's mid-battle swap-in menu was the same shared-fit list. The fix for the second is merged dark (`ARCHETYPE_REFRESH_MENU_ENABLED = false`, `src/config/featureFlags.js:2066`, VERIFIED) and nobody has read the six real menus yet. So the first differentiation lever is already built and waiting on a read, not on new plumbing.
3. **During the session the brain is told every stock's volume is "NORMAL".** The hourly intraday rankings recompute splices a synthetic today-bar whose volume is set to the 30-day average (`api/cron/compute-index-intelligence.js:249-283`, VERIFIED); `calculateVolumeProfile` then divides that average by the 20-day average (`api/_utils/technicalCalculations.js:339-349`), and the bench block renders it as `Volume: NORMAL tier | RVOL=1.0x` (`api/_utils/agentEvalPromptAssembly.js` `renderBenchVolumeLine`, VERIFIED). NR7, daily range and Bollinger width are likewise computed on the partial session bar from the same splice. This is the concrete answer to "does the agent identify technical conditions from adequate data": for volume, it cannot, and it is not told so.

**What changes in the sequence:** the evaluator ships first as proposed, but wired to deploy-time selection and to review, with a capture-corpus replay as its acceptance test instead of a 30-case fixture bar; the in-battle evidence problem is handed to the Intraday arc's already-built-and-dark facts rather than to a new intraday rule; the screener comparison and any cockpit exposure wait for Build 2b and the menu dry run.

---

## 1. In plain terms

- **What the founder is seeing is real, and it has two causes already proven on `main`.** Until PR #982 is switched on, every archetype picks mid-battle swap-ins from the same list. And the archetype paragraph the brain reads doesn't measurably change what it decides. Different voices, same hands.
- **The daily "setup" check is worth building, and it already has blessed numbers.** But it is a *morning* tool: it says which stocks are in a real Trend Follower setup at the open and, the next morning, whether yesterday broke the thesis. It cannot judge a 15-minute bar at 3 PM, and a one-day battle is all afternoon.
- **The in-battle questions Scout raised (NOW's 15-minute close, elevated volume) need intraday facts the platform already collects every minute and shows to nobody** (`INTRADAY_DIAGNOSTIC_ENABLED = false`, `INTRADAY_AGENT_USE_ENABLED = false`, `featureFlags.js:2642`, `:2653`, VERIFIED). Turning the diagnostic on is a one-line flip in its own arc; sending the facts to the agent has its own gate (a paired-eval scorecard). Neither needs a new rule.
- **The agent's plans are richer than its record.** A call can only hold a price line and a deadline (`condition: { side, level }`, `api/_utils/callRecords/candidate.js:236`, VERIFIED). "Closes the next 15-minute bar above $149.26 with elevated volume" has nowhere typed to live, so it stays prose and is never graded. That is a contract decision for later, not a data repair.

---

## 2. Strongest parts of the diagnosis

| Claim in the brief | Standing | Evidence |
|---|---|---|
| "A persuasive explanation, a correct call, and a verified calculation are different observations." | **Keep.** This is the right frame and the capture corpus can measure it: 528 stored requests re-serialize byte-identically and replay on the production model (REPORTED, ablation §0.6). | — |
| "Verify whether a precise evaluator already exists." | **Verified: none.** No `tf-setup`, `setupVersion`, `evaluateSetup` or pattern logic anywhere in `api/`, `src/`, `scripts/`. `calculateNR7` exists as a flag only (`technicalCalculations.js:422-439`). Every primitive the definition needs exists: SMA, ATR(14), 20-day volume profile, swing highs/lows (`calculateAllIndicators`, `:494-528`; `findSwingHighsLows` in `analyticalPrimitives.js`). | VERIFIED |
| The adjusted/raw basis concern at `marketDataCache.js:313-338`. | **Confirmed, and already understood in the code.** `close` is adjusted-preferred with raw fallback; `high`, `low`, `rawClose` are raw (`:318-338`). The codebase's own rule: return questions use adjusted, price-level questions use raw (`compute-index-intelligence.js:163-173`, `resolveSmaBasis`). tf-setup-v1's tests are price-level questions (`C ≥ swingHigh`, `low touched SMA_fast`, `C ≤ SMA_fast + 2·ATR`), so the evaluator's adapter should build its series on one basis — raw — and say so. The definition reserves exactly this mapping to P3's Phase 0 (`TREND_FOLLOWER_SETUP_DEFINITION_V1.md:19`), so no version bump. | VERIFIED |
| The synthetic session bar at `compute-index-intelligence.js:258-288` is not a completed session. | **Confirmed, and worse than stated** — see §0 point 3. The rankings document does carry `mode: 'intraday' | 'premarket'` (`:1530`), so a consumer *can* tell; today no prompt renderer does. | VERIFIED |
| `screenStocks.js` is a deterministic engine with `rejectedFilters`. | **Confirmed.** Allowlisted fields incl. `arch_scores.*`, honest rejection (`api/_utils/screenStocks.js:19-74`). Importers: the screener chat, the Search adapter, the voice layer's research mode, **and the P2 research record** (`api/_utils/researchRecords/model.js`), which is an agent-side integration the brief missed. Not imported by the battle brain (`agent-evaluate.js`, `decide.js`, `agentEvalPromptAssembly.js`, `callRecords/`). | VERIFIED |
| Treat agent-proposed indicators as versioned hypotheses, not adopted rules. | **Keep.** Matches the Learning Charter's maturity gates and the Oct 10 ruling that only a proven play reaches the agent. | — |
| Keep game points and market returns separate. | **Keep.** The Oct 14 scorer already found points and price move give the same verdict on every scored moment (REPORTED, `20261014_EXPERIMENT_CHANGED_MOMENTS_SCORE.md` §1), so they are not two pieces of evidence either. | REPORTED |

---

## 3. Weakest assumptions, with corrections

**W1 — "The bottleneck is condition definition and data."** Partly. The measured bottleneck for *recognizable* archetypes is structural (shared menu; non-load-bearing charter). The evaluator is the right first *mechanism* precisely because it makes the Trend Follower's identity a gate, not a paragraph — the brief should say that, because it changes what the evaluator must plug into (selection and review, not explanation first).

**W2 — "A daily baseline as the first product investment."** Right module, wrong seat. With one-day battles and a 15-minute check cadence (`vercel.json:157-158`), the daily verdict has two honest uses: admission at deploy (which names are in a valid setup this morning) and review (did yesterday's close invalidate it). Its value in-battle is as a *frozen fact* ("entered on a valid breakout, as of Oct 20 close"), never a live condition. Correction: slice 1 includes the deploy-time reader; nothing in slice 1 runs intraday.

**W3 — "Reuse the intraday data if it makes a smaller first slice possible."** It does, but not by a new intraday rule. The collector already computes, per actionable name, every minute: `vwap`, `sessionHL`, `volume`, `volumePace` (session volume vs 20-day average, linear pace), `sma20_5m`, `macd5m`, `rsi5m`, each with a typed status/reason (`api/_utils/intraday/facts.js:19-22`, `accumulator.js:264-279`, VERIFIED). "Elevated volume" is measurable *today* as `volumePace`; a per-15-minute-bar volume is not (buckets carry `close`, not volume — `buckets.js:10-15`). Correction: the in-battle slice is the Intraday arc's own diagnostic flip (Why? panel), then agent use behind its scorecard. No new rule version; no silent reinterpretation of tf-setup-v1.

**W4 — "The screener comparison is step three."** Build 2b already stores up to four replacement options on an exit call with `agent`/`bench` labels (D-3) and explicitly forbids a comparison claim (D-3, "no display says the agent offered a choice"). A comparison with evidence columns is a different object. Correction: defer until 2b ships and the refresh dry run has been read; then decide whether the comparison is a bench-sheet column (2b's 6A) or a research-modal evidence pack (the modal redesign's R-15).

**W5 — "30 cases, 27 passing, 4 per family."** A fixture bar proves determinism; it cannot prove differentiation or usefulness. Correction: fixture coverage is *every* pattern × reason × unknown path (deterministic, so 100% or the build is wrong), and the acceptance *evidence* is a capture-corpus replay (§7). Drop the 27/30 framing.

**W6 — Timelines.** 3–5 days for the pure evaluator + adapter + replay is credible given the primitives. "5–10 days for a tested baseline" omits that splicing the verdict into the brain (pilot P4) edits fenced files (`agentEvalPromptAssembly.js`, the tool schema) under BUILD_RULES §7, with its own Phase 0 and Astra round — budget 5–8 days *after* 2b merges. "4–6 weeks for a growth cycle" is a floor that assumes the Practice Field build exists; it does not. Give ranges, not dates (§9).

**W7 — Ignored user direction as a bucket.** Not the bottleneck. The coaching ruling (Oct 2) makes directives heard, not enforced; the gate census found 26 of 34 deterministic overrulings came from the unstated crypto-slot rule, since fixed (REPORTED, ablation §1). The real direction problem is *absence*: 7 of 156 calls answered (BRIEF/Amendment D). Build 2b addresses that; this arc should not.

---

## 4. The bottleneck, separated (Decision 1)

| Bucket | Finding | Standing | Who fixes it |
|---|---|---|---|
| **Unavailable data** | Per-15-minute-bar volume is not stored; NR7's reference range carries no bar date and, after 10 AM ET, is a partial bar. | VERIFIED (`buckets.js:10-15`; `calculateNR7`, `compute-index-intelligence.js:996-997`, `:1107-1108`) | Intraday arc (bucket volume is a contract change); evaluator adapter (dates every fact) |
| **Calculation errors** | None found. One **uninformative input presented as a measurement**: intraday `RVOL≈1.0 / NORMAL` on every name (§0.3). | VERIFIED | Producer-side `basis` marker now (non-fenced); omission in the fenced P4 pass |
| **Data omitted from prompts** | Held positions get price, gain, ATR%, lock/bonus and levels — no RSI/MACD/SMA/RS/volume (`agentEvalPromptAssembly.js:1468-1505`); bench names get the full block (`:1553-1604`). The seven intraday facts reach nobody. No completed-bar setup facts exist. | VERIFIED | Intraday diagnostic flip (player), then agent use (its scorecard); evaluator (setup facts) |
| **Loose condition definitions** | The record holds `{side, level}` + horizon + default only. Everything else in a plan is `said`. Declaration rate 36.8% for the live text (round 3); the agent offered **no fork in any of 1,318 calls** across three wording rounds, nudged or not. | VERIFIED (`candidate.js:236-240`); REPORTED (`docs/audits/20261002_DECLARATIONS_WORDING_ROUND3.md`) | Contract amendment, later — not this arc |
| **Missing UI explanation** | Intraday diagnostic block for Why? built and dark. Hot bench shown to the model in composite order, to the player in archetype order (refresh review F2). Scout F-01 (chat "Held" vs Why? "No decision recorded") needs a builder read. | VERIFIED (flag); REPORTED | Intraday flip; a separate small 2a fix; F-01 its own ticket |
| **Ignored user direction** | Not a bottleneck (W7). | REPORTED | — |

**Honest ranking for "recognizable partner":** (1) shared selection → read the dry run, then flip the menu; (2) the charter is not a gate → the evaluator makes it one for the Trend Follower; (3) in-battle evidence → intraday flip; (4) condition typing → later.

---

## 5. The material decisions

| # | Decision | Ruling | Reason |
|---|---|---|---|
| 1 | Do we understand the bottleneck? | **Revise** | Add the structural causes (§4). The brief's taxonomy is right; its weighting is off. |
| 2 | What defines the archetype at launch? | **Keep the charter text; make the evaluator the gate.** | The Trend Follower constitution already states established-strength entry, the two-leg holding rule and brisk stall rotation (`api/_utils/evalIdentityBlocks.js:103`, VERIFIED). No clause needs amendment for V1. What's missing is enforcement: tf-setup-v1 supplies it for selection (valid/invalid/unknown at deploy) and for the chart leg of holding (invalidation reasons). "Secondary fundamentals" = tie-break only, already in text and in V1 weights (`archetypeScoring.js:17-22`, weight 0.05). The Oct 14 finding that swaps lost to holds 29–19 (REPORTED) is the first test of "brisk rotation": the evaluator's `invalid(extended)` / `invalid(no_setup)` is the candidate explanation, measured in §7. |
| 3 | Daily vs intraday coexistence | **Revise — adopt the policy in §6.** | One-day battles make the split clean: daily = qualification and review; intraday = monitoring; the record's price line = the only graded condition in V1. |
| 4 | Invalidation × two-leg × mode × protection | **Keep existing policy; add the table in §6.3.** | Everything needed already exists as record kinds and intents: hold-default Confirmation ("calls X below L, plans to hold") is the "surface it" state; `wait(invalidated_setup)` is the intent; protection's typed outcomes stand. `unknown` never strands a slot because the evaluator never executes (definition §4–§5). |
| 5 | Fixed / user-directed / earned | **Keep — table in §6.4.** | Matches the Oct 10 rulings (archetype-scoped plays; only proven plays reach the agent). |
| 6 | Tool priority | **Revise.** Evaluator → intraday flip → (after 2b + dry run) comparison → correlation deferred. | Each names its cockpit decision in §6.5. Correlation names none today. |
| 7 | Growth loop vs Practice Field V3 / Charter | **Keep, with one addition.** | The evaluator gives the Practice Field its first objective play shape: a Trend Follower entry is a play only when tf-setup-v1 says `valid`; a refinement (LLY two-close, XBI break character) mints a `tf-setup-v2` candidate proven as a play (fidelity + no-harm, Oct 14 rulings) before the Forge route installs it. Maturity vocabulary, claim territories and the installation route untouched. A rejected play is a result. |
| 8 | Demonstrating differentiation | **Revise — three offline measurements, no new tooling (§7).** | The dry-run tool (PR #983) and the replay harness (ablation branch) exist. |
| 9 | Minimum first implementation | **§8.** | — |
| 10 | Stopping rules | **§7.** | — |
| — | 60-session paper portfolio | **Defer, keep separate.** | A research endpoint; nothing in this phase depends on it. |
| — | LLY two-close, XBI break character | **Defer to Practice Field as `tf-setup-v2` candidates.** | Not data repairs; the definition says any rule change mints a new version. |
| — | Typed conditions beyond a price line (bar close, volume) | **Defer; revisit after 2b has run a week.** | Contract amendment with a prompt change; measure first how often the agent's `said` carries such clauses. |

---

## 6. The policies the brief asked for

### 6.1 Daily and intraday coexistence (first release)

| Question | Policy |
|---|---|
| Setup qualification | Completed daily bars only, `tf-setup-v1`, evaluated once pre-market from the EOD series; `asOf` = the last completed session date; never re-evaluated intraday. |
| Live monitoring | Intraday facts (collector) for held and bench names, with their typed status; `unknown` when absent. Never a setup verdict. |
| Condition timing | The call record's price line + deadline is the only graded condition. Clauses in `said` are shown as the agent's words (existing `saidOk` rule) and never graded. |
| Game actions | Unchanged: executor + deterministic guardrail pass decide. The evaluator's verdict is evidence; the brain's stance is intent (`enter` / `wait(reason)` / `reject(reason)`), per pilot spec §6. |
| The schedule trap | The adapter reads the EOD series directly and drops any row dated the current ET session before the close; it never reads the rankings document (which is `mode: 'intraday'` after 10 AM ET). Every fact carries `{source, asOf}`. |

### 6.2 What the adapter must do about basis
Build one series on the **raw** basis (`rawClose`, raw `high`/`low`, `volume`) for all five facts, because every test in the definition is a price-level comparison. Record `basis: 'raw'` in `factsUsed`. Do not touch `mapDailyRows` (shared by the rankings cron and the research path). This is the mapping the definition delegates to P3's Phase 0; `tf-setup-v1` stands.

### 6.3 The holding state table (chart leg × sector leg × protection)

| Chart leg (evaluator) | Sector leg (existing regime/sector context) | State | Permitted action | Record |
|---|---|---|---|---|
| valid / not invalidated | holds | both hold | hold | none needed |
| invalidated(reason) | holds | one broke → **surface** | hold-default Confirmation on the stock; intent `wait(invalidated_setup)`; player may "Exit instead" | existing exit+hold call |
| invalidated(reason) | broken | both broke → exit | exit-default Confirmation (or the agent's own swap) | existing exit+act call |
| unknown | any | unknown → **surface as unknown** | hold; never exit on unknown | hold-default call with `said` naming the missing fact |
| any | any | protection fires | guardrail pass, typed `fired_replaced` / `fired_slot_empty` / `mode_blocked` | unchanged |

Nothing here needs a new record kind. "Sector leg" in V1 = the sector's strength/regime label already in the prompt's `REGIME CONTEXT` (`agentEvalPromptAssembly.js:1148-1152`, VERIFIED); a typed sector-leg evaluator is deferred.

### 6.4 Fixed / user-directed / earned

| Fixed (baseline) | User-directed (no qualification) | Earned (Practice Field) |
|---|---|---|
| tf-setup-v1 numbers; protection; `unknown` abstention; evidence integrity (`{source, asOf}` on every fact); archetype admission (registry/menu). | What to investigate (picks, Who comes in, equipped ideas P1); hold/exit answers (coaching); standing leans. | Any threshold or pattern change (`tf-setup-v2` candidates); any change to what the agent prefers that claims an edge. A user agreeing is not evidence. |

### 6.5 Tool priority, each tied to a cockpit decision

| Priority | Tool | Cockpit decision it improves | Reuse |
|---|---|---|---|
| 1 | Setup evaluator (daily) at deploy and review | "Is this name a real Trend Follower entry?" at deploy; "did yesterday break it?" at the morning review | `calculateSMA/ATR/VolumeProfile`, `findSwingHighsLows`, `mapDailyRows` |
| 2 | Intraday facts to the player (diagnostic flip), then to the agent (scorecard) | "Is NOW's condition met right now?" | Intraday Build 1, built and dark |
| 3 | Incumbent vs eligible comparison | "Who comes in?" with evidence | `screenStocks` allowlist + `canComeIn` (2b D-7); after 2b |
| 4 | Thesis timing/state | "Is ACN still inside its plan?" | the evaluator's invalidation + the horizon table (definition §6) |
| — | Correlation context | none named today | defer |

---

## 7. Demonstration and stopping rules

**Three measurements, all offline, all with tools on `main` or on pushed branches:**

- **M1 — real menus (selection).** Run the Stage A dry run (`scripts/experiments/archetype-menu-dry-run/run.mjs`, PR #983, REPORTED) on Flash's machine with Firebase credentials; read the six menus; keep the watcher for ≥5 market days. Answers whether the dark menu fix differentiates selection on real data before any flip.
- **M2 — the evaluator against history (honesty of entries).** The slice-1 replay script evaluates, for every Trend Follower woken check in the capture window with a proposed or executed swap-in, the incoming name at the prior session's close. Output: the verdict distribution and, joined to the Oct 14 scorer where a trade was scored, how `invalid(extended)` / `invalid(no_setup)` entries fared against holding.
- **M3 — decision sensitivity (later, after P4).** The ablation harness resends captured requests byte-identically; add the verdict lines as an arm. Judged on decision change and the changed-moments scorer.

**Stopping rules for slice 1:**
- **Advance** when fixtures are 100% deterministic across every pattern, reason and unknown path; M2 shows a non-trivial verdict spread on real data (not mostly `unknown`); and the replay report is committed.
- **Reject the adapter (not the definition)** if `unknown` exceeds a quarter of evaluable names for a data reason (missing history, basis failures) — fix the input path first.
- **Inconclusive** if fewer than 20 Trend Follower swap-ins in the window are scorable; report it and advance on fixtures alone, with the differentiation claim withheld.

Behavior correctness (fixtures), partnership usefulness (M1 + a founder read of ten verdict receipts), and market performance (not claimed) stay separate.

---

## 8. The first implementation — "Measured Trend Evidence, slice 1"

**Player benefit (once read by a surface):** every Trend Follower entry carries a dated, inspectable verdict — valid breakout / valid pullback / invalid (extended, no setup, wrong regime) / unknown (which fact is missing) — the first mechanical fact that says what a Trend Follower *is* rather than how it talks.

**Scope (all new files, fence-free, no prompt or schema change, no cron, no write):**

| File | Purpose |
|---|---|
| `api/_utils/setupEvaluator/tfSetupV1.js` | Pure. `evaluateTfSetup({ bars, thresholds, anchorSwingLow? }) → { setupVersion, verdict: valid \| invalid \| unknown, reason, pattern, regime, factsUsed, missing, asOf }`. Regime, patterns A/B, extension guard, invalidation, abstention exactly per the definition §2–§5. |
| `api/_utils/setupEvaluator/thresholds.js` | The S1–S10 object, frozen; `setupVersion = 'tf-setup-v1'` with the object's hash; a test pins both to the definition's §8 table. |
| `api/_utils/setupEvaluator/dailyBarsAdapter.js` | Builds the evidence set from `mapDailyRows` output: raw basis (§6.2), drops the current session's row before its close, requires ≥ 55 completed rows (SMA50 + the 5-bar rising window) else `unknown(insufficient_history)`, stamps `{source: 'eodhd_eod', asOf}`. |
| `api/_utils/setupEvaluator/*.test.js` + `__fixtures__/` | Synthetic bars per pattern/reason/unknown; the three founder charts (COP, XBI, LLY) as **historical development cases** with expected verdicts written before the run, labeled as such, never reconstructed. |
| `scripts/experiments/tf-setup-corpus-replay.mjs` | Read-only, env-only credentials, no uid committed. M2 above. |
| `docs/audits/<date>_TF_SETUP_EVALUATOR_SLICE1.md` | Preview URL not applicable; verdict distribution; the ten receipts for the founder read; anchors at HEAD. |

**Dependencies:** none on 2b. Reads `marketDataCache.js` exports only. Firebase credentials for the replay (local run, as the Stage A tool).

**Fenced contact:** none. If any step would edit `agentEvalPromptAssembly.js`, `decide.js`, the tool schema or `createAgentBattle`'s shape, STOP and report.

**Completion rule:** tests green with exit code asserted; the replay report committed with M2's table; the founder has read ten receipts and either blessed the adapter's basis choice or amended it.

**Separate tasks (not this build):**
- **Slice 2 — the deploy reader.** The archetype menu helper (`api/_utils/archetypeCandidateMenu.js`, non-fenced, dark) reads a pre-market `setupVerdicts/{sessionDate}` document for the Trend Follower; V1 **labels only** (verdict carried on the menu row), filtering only after M2 justifies it. Gated by the same dark flag as #982; measured by M1 before any flip.
- **Pilot P4** — the brain splice (fenced): verdict lines in the prompt, `structuredClaim` intent. After 2b merges and M1/M2 are read.
- **Intraday diagnostic flip** — one line in its own arc, per its gates; then agent use behind the scorecard.
- **The neutralized-volume marker** — producer-side `volumeProfile.basis: 'neutralized'` in intraday mode (non-fenced); the fenced renderer omits the line in the P4 pass.
- **Scout F-01** (Why? vs chat) and the model-order/player-order mismatch (refresh F2) — 2a tickets.
- **Research modal Technical tab** — consumes the verdict as its archetype evidence pack (direction V2, R-15); its own arc.

---

## 9. Timeline, revised

| Step | Range | Not included |
|---|---|---|
| Slice 1 (evaluator, adapter, fixtures, replay, report) | 3–5 focused days | the founder's replay run (local, credentials) |
| Slice 2 (verdict doc + menu label, dark) | 2–3 days + ≥5 market days of M1 observation | the flip PR |
| P4 brain splice | 5–8 days, after 2b merges | Astra round; §7 gated process |
| First growth cycle | not estimable until the Practice Field build exists; 4–6 weeks is a floor | — |

No real-money readiness date follows from any of these.

---

## 10. Founder decisions (recommended option first)

1. **Sequence.** *Slice 1 now; slice 2 as its own task; P4 after 2b ships and M1/M2 are read.* — recommend **yes**.
2. **Bar basis for the evaluator.** *Raw OHLC for all five facts, recorded as `basis: 'raw'`, no version bump.* — recommend **raw**.
3. **Unknown and invalid at deploy.** *Label only in V1; the menu never filters on the verdict until M2 shows invalid entries underperform.* — recommend **label only**.
4. **Intraday diagnostic flip.** *Run it as its own one-line task under the Intraday arc's gates (player sees the seven facts in Why?; the agent's prompt unchanged).* — recommend **yes**.
5. **The neutralized-volume line.** *Producer marker now, renderer omission in P4.* — recommend **yes**; not a standalone fenced task.
6. **Typed conditions beyond a price line.** *Defer; measure after a week of 2b.* — recommend **defer**.
7. **LLY two-close and XBI break character.** *`tf-setup-v2` candidates through the Practice Field.* — recommend **defer**.
8. **Acceptance framing.** *Replace 27-of-30 with fixture determinism + M1/M2.* — recommend **replace**.

No further broad research phase is requested. The one open question with an exit condition is M1 (read the six real menus; ≥5 market days), and its tool already exists.

---

## Appendix — anchors read at `0fc78b02`

`api/_utils/agentBattleService.js:37, :119-123` · `api/cron/compute-index-intelligence.js:1-9, :163-191, :249-289, :960-1004, :1524-1550` · `api/_utils/marketDataCache.js:257, :282-343` · `api/_utils/technicalCalculations.js:336-365, :422-439, :494-528` · `api/_utils/agentEvalPromptAssembly.js:1121-1215, :1468-1505, :1553-1604, :1844-1881` · `api/_utils/screenStocks.js:1-74` · `api/_utils/researchRecords/model.js:1-53` · `api/_utils/callRecords/candidate.js:236-240` · `api/_utils/evalIdentityBlocks.js:99-142` · `api/_utils/archetypeScoring.js:11-62, :110-132` · `api/_utils/intraday/facts.js:19-22`, `accumulator.js:264-279`, `buckets.js:1-60` · `src/config/featureFlags.js:770, :1642, :2066, :2283, :2432, :2624-2679, :2729, :2839, :2910, :3130, :3162, :3206` · `vercel.json:148-163` · `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` · `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md §5–§11` · reports: `docs/audits/20261013_EXPERIMENT_ARCHETYPE_ABLATION_AND_GATE_CENSUS.md`, `BAGGERBOMB_ARCHETYPE_REFRESH_REVIEW_20261018.md`, `20261019_ARCHETYPE_MENU_STAGE_A_TOOL.md`, `20261019_ARCHETYPE_REFRESH_SECTION11_VERIFICATION.md`, `20261014_EXPERIMENT_CHANGED_MOMENTS_SCORE.md`.
