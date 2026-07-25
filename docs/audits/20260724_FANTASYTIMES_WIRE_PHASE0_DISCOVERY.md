# FantasyTimes Wire — Phase 0 Discovery Report

**Arc:** FANTASYTIMES WIRE — AGENT-FIRST NEWS ARC, Spec V1.2 (provisional lock, Jul 24 2026)
**Scope:** Spec §8, questions Q1–Q15. **READ-ONLY. HARD STOP after this report.**
**Date:** July 24, 2026
**Branch:** `claude/fantasytimes-wire-news-spec-m5side`
**HEAD:** `dd28eedf9ede11dcf65424fbcd65c5ed38aa668c`
**Tree:** clean (`git status --porcelain` empty at session open)
**Remote:** `git fetch origin` run as the first action of the session (BUILD_RULES §3). `origin/main` and HEAD are identical (`git rev-list --left-right --count origin/main...HEAD` → `0 0`). The clone is shallow; history was read via `git show`/`git log` where cited and was not deepened.

**Deliverable status:** no code file was read-modified in any way. No fenced file was edited. This document is the only artifact.

---

## 0. How to read this

The founder is the audience. §1 is the verdict table — read that first and stop if you only want the decision. §2 holds the three findings that change the shape of the arc. §3 answers all fifteen questions. §4 is the amendment register that feeds the spec's §12 amendment pass. §5 lists bugs found that are **not** this arc's business and need separate tasking.

**Citation convention.** Every factual claim carries `path/file.js:line`.

- **VERIFIED** — the code at that line was read during this session.
- **VERIFIED†** — additionally re-read personally by the session lead, not only by an audit agent. The founder-critical anchors carry this mark.
- **ASSUMED** — inference. Marked explicitly and never presented as fact.

**Method.** Eleven read-only discovery agents (one per generation seam, plus six system-level sweeps), then seven adversarial verifiers whose instructions were to *refute* the load-bearing claims, defaulting to REFUTED under uncertainty. **All seven returned PARTIAL** — every crux was right in substance and wrong in at least one load-bearing detail. Where the verifier corrected the discovery pass, this report states the corrected number and says so. Nothing in §1–§4 rests on an unverified crux.

---

## 1. Executive verdict table

| # | Question | Verdict | One-line finding |
|---|----------|---------|------------------|
| **Q1** | Tool Use schemas | **CLEAR** | 9 unfrozen module-level schemas, one consumer each. Byte-identical flag-off (M8) is achievable by making 2 lines conditional per endpoint. Clone, never mutate. |
| **Q2** | Story doc shape | **AMEND** | `dataSnapshot` exists — but in 8 mutually incompatible per-reporter shapes with zero shared keys, and `null` for Vera. M5's derivation review needs 9 readers, not 1. |
| **Q3** | Catalyst override | **STOP** | Spec §1's premise is false. Headlines + sentiment already reach two models at three live sites, plus a standing system-prompt rule telling the agent to trade on story sentiment. |
| **Q4** | voiceLayerCache | **AMEND** | Stores no prose and no voice lines. Writes are full-document `set()` with no merge — a `newsLine` written by any other producer is erased on the next tick. |
| **Q5** | "Neta phantom-reader" | **AMEND** | Not Neta. The real phantom is `economicCalendar` — zero producers since Mar 1 2026, and its orphaned reader **wipes** live data rather than merely reading nothing. |
| **Q6** | Cron + volume | **AMEND** | 37/40 confirmed exactly. Volume is market-contingent, not code-derivable; the code-derivable floor is 3 stories/weekday and the cron-driven ceiling is 136. |
| **Q7** | Universe map | **STOP** | Six competing ticker universes. No canonical one. `TGT` is in the newsroom's list and in neither validation map. One list spells Berkshire with a dot, five with a hyphen. |
| **Q8** | `cleanup.js` | **AMEND** | Deleting a doc never deletes its subcollections, and the repo has zero recursive-delete tooling (the SDK has it; the repo has never used it). |
| **Q9** | Firestore rules | **CLEAR** | Deny-all catch-all at `firestore.rules:886-888`; no wildcard reaches a new collection. But the spec's cited "free agency" precedent does not exist and points the wrong way. |
| **Q10** | Doug batch seam | **AMEND** | `custom_id` is the arc's single best pre-call identity — unique *within* a batch only, not across batches. Plus a live observability bug (§5.1). |
| **Q11** | Trading calendar | **STOP** | Holiday awareness exists but is **2026-only and duplicated across nine files**. No backward N-session walker exists. The only multi-day calendar builder ignores holidays entirely. |
| **Q12** | Pre-call identity | **AMEND** | No endpoint has one today; every story ID is minted *after* the model call. But a deterministic key is synthesizable per seam with no upstream refactor. Table in §3.12. |
| **Q13** | Runtime | **CLEAR** | `maxDuration` 30–60s, no `waitUntil` in the newsroom, **zero transactions anywhere in `api/fantasytimes/`**. The arc introduces the newsroom's first transaction. |
| **Q14** | Reconciliation host | **STOP** | `cleanup.js` is **not daily** — it runs Mon+Thu only. Worst-case replay latency is **96 hours**, not the ~16h the spec implies. A different host is required. |
| **Q15** | Injection-class registry | **STOP** | The `injectionClass` enum the spec says "exists as documented" **does not exist at all**. A different, live precedence registry does exist and is the real attachment point. |

**Verdict key:** CLEAR = build as specified. AMEND = spec text must change before final lock. STOP = a load-bearing spec assumption is false; founder ruling required.

**Five STOPs, six AMENDs, four CLEARs.** None of the STOPs kills the arc. Four of them (Q7, Q11, Q14, Q15) are scope corrections — work the spec assumed was already done and is not. The fifth (Q3) is a premise reversal that changes what Phases 3 and 4 are *for*.

---

## 2. The findings that change the arc

### 2.1 STOP-A — News already reaches the agents, with prose and with a directive (Q3)

Spec §1 opens: *"The only agent-facing consumption is the catalyst override in `api/cron/agent-evaluate.js`, which injects an off-watchlist ticker's ranking data when a story fires — the ticker, never the why."*

That sentence is false, and the arc's principles P1 and P7 are written as if it were true.

**What actually ships today.** Three live render sites put FantasyTimes prose in front of a model, and a fourth mechanism instructs the agent to act on it:

| | Site | What it carries | Model | Status |
|---|---|---|---|---|
| A | `agentTriggerGate.js:170-173` → `agentEvalPromptAssembly.js:914-917` | `[reporter, time-ago, sentiment] "headline" \| Tickers: …` rendered under **"TRIGGER (why you were woken up)"** | Haiku eval | LIVE **VERIFIED†** |
| B | `agentNewsContext.js:265` → `agentEvalPromptAssembly.js:988` | `N. [Reporter] "headline" — SENTIMENT, TICKER`, plus per-reporter game-state weighting prose | Haiku eval | LIVE **VERIFIED†** |
| C | `agentNewsContext.js:296-301` → `agentEvalPromptAssembly.js:997` | bare headline + sentiment fallback when the agent has no Forge rules | Haiku eval | LIVE **VERIFIED†** |
| D | `decide.js:359-374` → `agentPromptAssembly.js:239-251, 40-41` | reporter/beat/headline/time-ago in the **system prompt** | Sonnet strategy | LIVE **VERIFIED** |
| E | `agentEvalPromptAssembly.js:154-159` and `:376-380` | standing rule **S5 "News-Catalyst Momentum"** — enter on *"a FantasyTimes story with positive sentiment"*, exit on *"a negative FantasyTimes story"* | Haiku eval | LIVE, unconditional **VERIFIED** |

The verifier's corrections to the discovery pass are incorporated above: the discovery agent claimed five *paths*; the true count is **three headline-bearing render sites plus one static rule**. `fetchRecentNews` is the shared data source, not a fourth path; B and C are mutually exclusive arms; D carries headlines but no sentiment.

**What the spec is right about:** story `body`, `subheadline` and `pullquote` are fetched into memory (`agentTriggerGate.js:226` spreads the whole doc) but are **never rendered anywhere**. The only prose that reaches any model is the ≤120-character headline. **VERIFIED**

**Why this matters, concretely:**

1. **P1 is not a new boundary — it is a rollback.** "`sentiment` never appears in any agent-facing field" describes a state the codebase left long ago. Sentiment reaches the model as a structured label at sites A, B and C today.
2. **P7 is likewise a rollback.** "Headlines exist in Wire entries for founder/editorial readability, full stop" — headlines reach two models today.
3. **P8(b) — "Wire content never acts as a trigger-gate action trigger" — describes a gate that already fires on news.** `news_catalyst` (`agentTriggerGate.js:171`) contributes to `shouldEvaluate` (`:180`). The good news, and it is genuinely good: the trigger gate is a **wake** gate, not an action gate. `shouldEvaluate` decides only whether a Haiku call is attempted; no trigger names a symbol or a decision. **VERIFIED**
4. **S5 is the real problem for the arc's thesis.** The spec's whole argument is that news should be *weighable context*, never a directive. S5 is a directive, in the system prompt, on every eval call, telling the agent to enter and exit on FantasyTimes sentiment. The spec's §2.1 rationale cites "the Regime Revamp's S5 dissolution" as having already drawn this line — **at HEAD, S5 is present in both game-mode variants of the eval system prompt.** Either the dissolution did not land, or it landed elsewhere and this is a different S5. Founder ruling needed on which.

**This is not a reason to stop the arc.** It is a reason to restate what the arc *does*: it does not introduce news into agent reasoning, it **replaces an unstructured, sentiment-carrying, prose-bearing news channel with a typed and validated one**. That is a stronger case than the one the spec currently makes. But §1, §2 (P1/P7), §2.1 and §6 all need rewriting to say it.

### 2.2 STOP-B — The Phase 3 attachment point does not exist, but a better one does (Q15)

Spec §8 Q15 asks CC to *"confirm the `injectionClass` enum and preference-class injection surface in prompt assembly (read-only — P8 constraint (a) depends on this seam existing as documented)."*

It does not exist. The only occurrence of the token `injectionClass` anywhere in executable code is a comment saying the opposite: `src/utils/traitEnforcement.js:5` — *"The live agent has no injectionClass."* **VERIFIED** (verifier searched raw bytes and unzipped `.docx` specs; zero hits).

What exists instead:

- **The prompt-visible mechanism is binary.** `ruleHardness.js:23` (`HARD_CATEGORIES = {risk, allocation}`) and `isHardRule` at `:39`, rendered as two prose tiers — `== CONSTRAINTS (must obey) ==` (C1..Cn) and `== STRATEGY PREFERENCES (should follow) ==` (S1..Sn) — at `agentEvalPromptAssembly.js:531-545`. Two tiers, not five. **VERIFIED**
- **`buildLiveContextBlock` has no tiering structure at all.** It pushes plain strings into a flat `parts` array and returns `parts.join('\n\n')` (`agentEvalPromptAssembly.js:854-856, 1009`). There is no class field, no priority, no descriptor on any injected block. There is nothing to register into. **VERIFIED**
- **But a live, numeric, enforcing precedence registry does exist** — and the discovery pass missed it. `src/utils/ruleConflictReconciler.js:46` defines `PROVENANCE_TIER = { user_equipped: 1, archetype_default: 2 }`, consumed by `tiebreak()` at `:287-310` as an ordered chain (tier → hard-over-soft → safer-direction → recency). It is **wired and on**: `featureFlags.js:427` `CONFLICT_RECONCILER_INJECT_ENABLED = true`; `decide.js:255` calls `resolveForDeploy({inject:true})`; `:262` assigns the result to `agent.activeRules`. **The losing side of a rule conflict never reaches the prompt.** That is a class→rank registry with real enforcement semantics. **VERIFIED** (the reconciler's own header comment "NOT wired here" is stale.)

**Consequence for Phase 3.** It must be re-scoped from *"attach to the existing registry"* to *"design the registry, or extend `PROVENANCE_TIER`."* The natural home for a new injection-class structure is `agentEvalPromptAssembly.js`, which is **fenced** — so this is a fence-permission question the spec does not currently ask, and a materially larger estimate than §6 assumes. Note also that changing the C#/S# partition will break the committed golden snapshots in `api/_utils/__p4_snapshots__/` and `hardSoftOverride.parity.test.js`. **VERIFIED**

**Good news for P8, stated precisely.** Exactly two mechanisms can force an *action*, and neither reads prompt context:

- the risk manager (`agent-evaluate.js:1313`, executing at `:1334-1335` under the comment *"Execute risk-triggered swaps (no Haiku needed)"*), and
- the guardrail layer (`applyGuardrails` at `:2025`, producing `forced_exit`).

Both are pure deterministic functions of prices, thresholds and portfolio state. **A Wire fact can never force a trade through any existing path — forcing requires a numeric threshold breach on price data.** That is a stronger safety story than the spec currently claims, and it should be claimed. **VERIFIED**

Two wording corrections P8(d) needs, though:

- The risk manager is **upstream** of the model, not downstream (`:1313`, before news is even fetched at `:1800`). This *strengthens* non-bypassability — it cannot see the prompt at all — but the spec's sentence as written is wrong.
- `applyGuardrails` is **skipped entirely** when `deployedGuardrails` is empty and no Diversifier observe cap applies (`agent-evaluate.js:2023`, `agentGuardrails.js:225-227`), so "guardrails always run" is false. What *does* run unconditionally post-model is a five-check deterministic stack at `agent-evaluate.js:2071-2135` (risk-LOCK enforcement, distressed-regime block, `validateTradeDecision`, Knob B hurdle floor, Knob C circuit breaker). Cite that instead. **VERIFIED**

### 2.3 STOP-C — Three infrastructure assumptions the arc rests on are absent (Q7, Q11, Q14)

The spec treats each of these as existing plumbing. None of them is.

**(a) There is no canonical ticker universe (Q7).** Six lists exist with divergent membership, counted programmatically by the verifier: `rankingConfig.js` `ALL_TICKERS` = 239 and `TICKER_TO_SECTOR` = 278 keys (239 stocks + 39 ETFs); `fantasyTimesTickers.js` `FANTASYTIMES_TICKERS` = **54** while its own header at line 3 says "50 US stocks"; `agentCryptoAssets.js` = 7 crypto; `seasonCalendar.js` `DEFAULT_SESSION_UNIVERSE` = 50; `src/services/draftAssets.js` = 75 stocks + 75 crypto, mirrored server-side at `api/_utils/draftStockList.js` **for the stocks only**. `seasonCalendar.js` is the sole list spelling Berkshire `BRK.B` with a dot; the other five use `BRK-B`. **`TGT` is in the newsroom's own universe and in neither `ALL_TICKERS` nor `TICKER_TO_SECTOR`.** **VERIFIED**

The validator's F1/F2 rules (off-universe classification, quarantine) cannot be written until the founder picks which universe is authoritative. The only exported membership helper is `validateTickers` (`tickerValidation.js:15-38`), reading `TICKER_TO_SECTOR`; **no FantasyTimes generator calls it today** — which is why `TGT` stories publish normally despite the gap.

*Mitigating detail, and a correction to the discovery pass:* `TGT`'s absence is a soft demotion (catalyst significance 1.0→0.3), not a hard failure, and `tickerValidation.js:12` normalises dots to hyphens, so the spelling split only bites where no normaliser sits in between.

**(b) The trading calendar cannot do what the arc needs (Q11).** Holiday awareness exists — `marketSchedule.js` `isMarketHoliday` / `getETDate` / `formatDateString` — but:

- The list is **`NYSE_HOLIDAYS_2026` only**, with a TODO at `marketSchedule.js:10` to add 2027 by December 2026, and it is **duplicated across nine files**. `isMarketHoliday` is a bare `Array.includes`, so **every 2027 holiday silently reads as a trading day.** **VERIFIED**
- The repo's only multi-day calendar builder, `seasonCalendar.js buildTradingCalendar`, is **weekend-only** — `isWeekend` tests `getUTCDay()` and the module never imports a holiday list, so a season "trading calendar" can contain Thanksgiving. **VERIFIED**
- **No backward N-session walker exists anywhere.** `getTradingDaysFromDate` walks forward; `getPreviousTradingDay` (`marketSchedule.js:107-119`) walks back exactly one step with a 10-iteration cap and a silent fallback. The spec's "last 5 trading sessions" (§4.6) must be built. **VERIFIED**

**(c) `cleanup.js` is not a daily cron (Q14).** `vercel.json:102-103` schedules it `0 7 * * 1,4` — **Monday and Thursday only**. **VERIFIED†** The file's own header (`cleanup.js:4`) says *"called by daily cron (2 AM ET / 07:00 UTC)"* and is stale on both counts: git shows it shipped daily (`0 7 * * *`, commit `097b76e0`) and was deliberately downgraded three days later by `b9f723e7` ("FT cleanup: daily → Mon+Thu") as an invocation-cost optimisation. 07:00 UTC is 2 AM ET only under EST; it is 3 AM ET for the eight months of EDT.

**Worst-case gap is 96 hours** (Thu 07:00 → Mon 07:00), not the 84h the discovery pass reported — 84h is the *mean* of the two gaps. The spec's §4.7 premise that a `cleanup.js`-hosted sweep replays a failure within ~16h is off by roughly 6×. **`cleanup.js` is disqualified as the reconciliation host on cadence alone.** See §3.14 for the host comparison and nomination.

---

## 3. Findings by question

### 3.1 Q1 — Tool Use schemas · **CLEAR**

Nine tool schemas, all in `api/_utils/fantasyTimesPrompts.js`, all plain unfrozen object literals (`grep -c 'Object.freeze'` → 0), each imported by exactly one endpoint: **VERIFIED†**

| Constant | Line | Endpoint | Reporter / story `type` |
|---|---|---|---|
| `PUBLISH_STORY_TOOL` | 207 | `generate-mover.js:225` | alex / `market_mover` |
| `PUBLISH_MACRO_TOOL` | 243 | `generate-macro.js:117` | alex / `macro_alert` |
| `PUBLISH_MARKET_PULSE_TOOL` | 274 | `generate-pulse.js:283` | kai / `market_pulse` |
| `PUBLISH_ECON_RECAP_TOOL` | 409 | `generate-econ.js:281` | neta / `econ_recap` |
| `PUBLISH_ECON_PREVIEW_TOOL` | 440 | `generate-econ.js:454` | neta / `econ_preview` |
| `PUBLISH_EARNINGS_PREVIEW_TOOL` | 473 | `submit-earnings-batch.js:221` | doug / `earnings_preview` |
| `PUBLISH_EARNINGS_RECAP_TOOL` | 504 | `generate-recap.js:252` | doug / `earnings_recap` |
| `PUBLISH_SECTOR_COLUMN_TOOL` | 541 | `generate-column.js:297` | kim / `sector_column` |
| `PUBLISH_DEEPDIVE_SUMMARY_TOOL` | 613 | `ingest-deepdive.js:179` | vera / `deepdive` |

**M8 (byte-identical flag-off) is achievable.** Per endpoint, exactly **two lines** must become conditional — the `system:` concatenation and the `tools:` array — because both are per-request expressions inside the request object literal. Nothing is precomputed at module scope; the system prompt is assembled per request; `tool_choice` is forced; there is no `cache_control` structure to disturb. Example (`generate-pulse.js:278-286`): **VERIFIED†**

```js
const response = await anthropic.messages.create({
  model: REPORTER_PROFILES.kai.model,   // 'claude-haiku-4-5-20251001'
  max_tokens: 800,
  temperature: 0.8,
  system: KAI_SYSTEM_PROMPT + (marketContextBlock || '') + (consensusBlock || ''),  // ← conditional here
  tools: [PUBLISH_MARKET_PULSE_TOOL],                                              // ← and here
  tool_choice: { type: 'tool', name: 'publish_market_pulse' },
  messages: [{ role: 'user', content: userMessage }],
});
```

**Three build constraints that follow:**

1. **Clone, never mutate.** The schema object is shared by reference into every request in a warm Vercel container. Mutating it under a flag would leak `agentFacts` into every later flag-off invocation in that container — silently breaking the M8 invariant with no test to catch it. Build `{...TOOL, input_schema: {...TOOL.input_schema, properties: {...}}}` when the flag is on.
2. **An optional property is already precedent.** `PUBLISH_MARKET_PULSE_TOOL.primaryTicker` is in `properties` but not in `required` (`:283-287, :313`). Nested object arrays are precedent too (`top_movers`, `:296-307`). No new patterns needed.
3. **Adding to the schema is necessary but not sufficient.** No endpoint spreads the model's tool input into the persisted doc — every field is individually whitelisted (e.g. `generate-mover.js:276-308`). An `agentFacts` key would be read into `storyData` and then silently dropped. The whitelist must be widened too. **VERIFIED**

**Drift hazard (minor).** `src/prompts/fantasyTimesPrompts.js` is a near-duplicate of the api copy, with the same constants at the same line numbers. Only an `.ARCHIVED.jsx` component imports it. Editing one silently diverges them. **VERIFIED**

### 3.2 Q2 — Story document shape · **AMEND**

Nine writers, all to `fantasyTimesStories`. Common fields: `reporter`, `reporterName`, `reporterBeat`, `type`, `headline`, `subheadline`, `body`, `tickers[]`, `primaryTicker`, `sector`, `themes[]`, `sentiment`, `urgency`, `recommended_action`, `pullquote`, `dataSnapshot`, `generatedBy`, `batchId`, `publishedAt`, `expiresAt`, `status`, `visualType`, `visualConfig`. **VERIFIED†** (`generate-mover.js:276-315`)

**`dataSnapshot` exists — this is the one M5 assumption that survives, but only barely.** It has **eight mutually incompatible per-reporter shapes with zero shared keys**, is literal `null` for every Vera deepdive (`ingest-deepdive.js:262`), carries no schema version, no market date and no provenance, and nothing validates it on write — raw upstream API values pass straight through. A derivation-review surface must implement nine separate readers, exactly as `fantasyTimesVisuals.js:15-118` already does for visuals. **VERIFIED**

**Status lifecycle is two-valued:** every writer hard-codes `status: 'published'`; `cleanup.js:46` flips it to `'expired'`. There is **no draft state** — anything written to a story doc is live immediately. **VERIFIED**

**Additive changes are safe.** The reader layer tolerates missing fields completely — proven by a live example: `StoryDetail.jsx:558` renders `<SectorRankCard topSectors={story.topSectors} />` but no writer sets a top-level `topSectors` (Kim nests it under `dataSnapshot`). The card silently receives `undefined` and degrades. **VERIFIED**

**But do not put `agentFacts` on the story doc.** `firestore.rules:548-551` grants `allow read: if true` — **public and unauthenticated** — and both HTTP readers spread the entire document (`feed.js:34-36`). Machine facts stamped there are published to the open internet. **VERIFIED†** The separate-collection design in §4.3 is correct and is load-bearing, not stylistic.

**Taxonomy collision — needs a spec ruling.** A `type` taxonomy already exists with nine values: `market_pulse`, `market_mover`, `macro_alert`, `econ_recap`, `econ_preview`, `earnings_preview`, `earnings_recap`, `sector_column`, `deepdive`. **VERIFIED†** Against the spec's §4.4 `eventType` table:

- **5 collide by name** — `market_mover`, `macro_alert`, `econ_preview`, `earnings_recap`, `earnings_preview`
- **8 spec eventTypes have no shipped producer** — `technical_break`, `volume_surge`, `volatility_event`, `index_move`, `gap_event`, `econ_print`, `sector_rotation`, `leadership_shift`
- **3 shipped types are absent from the spec** — `market_pulse` (Kai's *only* story type), `sector_column` (Kim's only), `deepdive` (Vera, a sixth reporter the spec never mentions)
- **`econ_print` vs `econ_recap`** are near-synonyms under different names

The spec never states the relationship between `type` and `eventType`. If `eventType` is meant to be finer-grained, say so and give the mapping. If they are the same concept, Kai's and Kim's entire allowlists have no producers and every one of their stories would REJECT — the §6.1 gate (<10% REJECT) could never pass.

### 3.3 Q3 — Catalyst override · **STOP** → see §2.1

Additional detail on the override itself: its own payload **is** ranking-only — `symbol`, `name`, `baseATR`, `isCrypto`, `sector` (`agent-evaluate.js:1820-1826`). The spec is right about that. What is wrong is "never the why", because the same tick's headline arrives via sites A/B/C. **VERIFIED**

Two further corrections: "when a story fires" is imprecise — the override fires on tickers **co-mentioned inside stories already fetched by `array-contains` on tickers the battle holds** (`agentTriggerGate.js:213`), so it never sees a story exclusively about an off-watchlist name. And the status-feed message says the ticker was *"added to watchlist"*, but the addition is an in-memory push onto `battle.portfolio.bench.stocks` with **no Firestore write** (`agent-evaluate.js:1828, 1840-1845`) — discarded if `shouldEvaluate` is false. **VERIFIED**

### 3.4 Q4 — voiceLayerCache · **AMEND**

`api/cron/voice-layer-cache.js` (719 lines), cron `*/15 13-20 * * 1-5` (`vercel.json:130-131`). Writes `voiceLayerCache/{battleId}`: `battleId`, `agentId`, `portfolioBriefs`, `benchBriefs`, `scoutAlerts`, `marketContext`, `dataFreshness`, `forgeSeeds`, `updatedAt`. **VERIFIED**

**It stores no prose and no voice lines, and calls no model.** Its only imports are firebase/marketSchedule/agentBattleService/agentScoring; its only outbound call is an EODHD price fetch at `:46`. All Gemma prose is generated at chat time from these fields. Prose-looking fields (`regimeDetail`, `breadthDetail`) trace to deterministic template literals in `indexIntelligence.js:31, 88`. **VERIFIED** Phase 2's "token/size budget of the cached voice lines" question is therefore malformed and should be restated.

**The write-side constraint is the finding.** `voice-layer-cache.js:682-697` is a `writeBatch.set(cacheRef, {...})` with **no `{merge:true}`** — a full-document overwrite. No `.update()` writer exists, and `firestore.rules:578-581` blocks client writes. So **a `newsLine` field written by any separate producer is erased on the next tick.** Phase 2 must populate it *inside this cron* (the parallel-fetch block at `:634-639` is where a Wire read slots in), or convert the write to a merge. **VERIFIED**

*Two qualifiers the verifier added:* the write is not unconditional — the handler early-returns on `market_closed` (`:578`) and `no_active_battles` (`:587`) — and the loop touches only currently-active battles, so a doc for an ended battle is never rewritten. And the hazard is forward-looking: no `newsLine` field exists in the repo today.

**Stale prior audit.** `docs/audits/VOICE_LAYER_TOOL_READINESS_AUDIT_PART1.md` has drifted materially — four of its claims are now false against the current file, and every `voice-layer-cache.js` line citation in PART1/PART2 is stale. Do not plan Phase 2 from it. **VERIFIED**

### 3.5 Q5 — The phantom reader · **AMEND**

**Not Neta.** Neta has two live producers on two live crons, and every reader-side filter on `reporter=='neta'` / `type=='econ_recap'` / `type=='econ_preview'` matches real writes. **VERIFIED**

**The real phantom is `economicCalendar`.** Zero producers repo-wide. Read by `seedConsensus` (`fantasyTimesConsensus.js:88-106`) and by `api/health.js:77-88`. Git archaeology found the provenance: `api/economic-calendar-refresh.js` wrote `economicCalendar/latest` exactly as the reader expects; it was added `bed99a27` (2026-02-12) and **deleted `a155e599` (2026-03-01)** without cleaning up either reader or the rules comment at `firestore.rules:11` ("populated by Claude-powered cron"). **VERIFIED**

**The verifier upgraded the severity, and this is the part that matters.** The discovery pass said the orphan means consensus "always seeds `economics: []`". That is wrong in a worse direction: `seedConsensus` writes `economics: []` inside a `set({...}, {merge:true})` (`:114-127`), and **a merge-set replaces an array field**. `seedConsensus` fires at 13:25/14:25 UTC; Neta's recap appends real events via `appendEconomics`/`arrayUnion` (`:159-181`, called from `generate-econ.js:342`) at :00/:30 of 13–21 UTC. **So the orphaned reader actively wipes the events appended by the 13:00 UTC recap tick.** That is a regression-shaped bug, not a null seed. Ticks from 13:30 repopulate, so the blast radius is one tick per day — but it is a real data-loss path. Filed for separate tasking in §5.2.

**Other reader-only strings** (dead branches, not defects): story types `stock_spotlight` and `rotation_alert` are read by `fantasyTimesVisuals.js:34, 103` and `fantasyTimesClient.js:127, 145` but never written. The pair `kai` + `macro_alert` is read at `fantasyTimesVisuals.js:19` but `macro_alert` is written with `reporter: 'alex'` (`generate-macro.js:172`). All degrade safely — `shouldOverrideVisual` returns true for off-map pairs and routes them to the Art Director fallback. **VERIFIED**

### 3.6 Q6 — Cron and volume inventory · **AMEND**

**37 cron entries. Confirmed exactly**, by programmatic count of `vercel.json`, and all 37 paths resolve to existing handlers. **VERIFIED†** Two caveats: the "40" ceiling is nowhere verified in code (BUILD_RULES §61 itself labels it "assumed Pro ceiling"), and the repo's own docs disagree — `docs/DETECTOR_APPENDIX_DISCOVERY_REPORT.md:191` claims 36/40, other audits claim 38/40. **Only `vercel.json` is trustworthy.** Sixteen of the 37 are FantasyTimes paths.

**Volume — the spec's ~15–30 entries/day is not derivable from code.** It is market-contingent: how many of 54 tickers cross the 3% threshold, how many Tier-1 econ releases print, how many tracked earnings report. What *is* derivable: **VERIFIED**

- **Deterministic floor: 3 published stories per non-holiday weekday** (the three Kai pulses, one per period), +1 Monday (Neta econ preview), +1 Monday (Kim preview), +1 Friday (Kim wrap). Every generator short-circuits on `isMarketHolidayToday()`, so holidays yield ~0.
- **Cron-driven ceiling: 136 stories/weekday** — 3 Kai + 18 Neta recaps + 1 Neta preview + 5 Doug recaps + 1 Kim + 54 Alex movers (`scan-movers` has no per-invocation cap; the bound is the 54-ticker universe) + 54 Doug previews via `poll-batch`.
- **Cron firings: 163–166 FantasyTimes firings per weekday** (Mon 166, Tue/Wed 163, Thu 164, Fri 165; Sat/Sun 1).

The §4.3 claim that "at ~15–30 entries/day the rebuild is trivial" holds comfortably at the floor and at any realistic day, and still holds at the 136 ceiling for an in-transaction array rebuild. The number should simply be restated as a range with its basis.

**No FantasyTimes cron follows the repo's documented DST pattern.** BUILD_RULES §62 prescribes dual-hour entry + `Intl`/`America/New_York` guard + per-day idempotency, and that pattern exists **only** in `process-draft-claims.js:97-112, 566-576`. The FantasyTimes crons use the dual-hour entry but substitute a Firestore dedup query for the ET guard, so the earlier UTC firing always wins and the effective ET publish time **shifts a full hour across DST** (pre-market pulse: 8:30 AM ET under EST, 9:30 AM ET under EDT). **VERIFIED**

### 3.7 Q7 — Universe map · **STOP** → see §2.3(a)

**Node-cleanliness (the part that is CLEAR):** `src/data/assets.js` is import-free pure data (`export const STOCKS/CRYPTO/...`, no imports at all), so `api/` may import it under BUILD_RULES §4. **VERIFIED†** `FANTASYTIMES_TICKERS` is a strict subset of its `STOCKS`; the 33 extras in `assets.js` are all crypto. So the newsroom list is a *copy* of a Node-clean source that could simply be imported.

**Documentation hazard.** At least six live files still assert the **retired** rule "api/ cannot import from src/" in comments (`rankingConfig.js:8`, `termUniverse.js:12-13`, `agentCryptoAssets.js:2`, `marketSchedule.js:5`, `draftStockList.js:4`, `process-draft-claims.js`), and those comments are the stated justification for the duplicate universes and duplicate holiday lists this audit found. BUILD_RULES §49-51 retired that rule in June 2026 and 35 distinct `src/` modules are imported by `api/` today. **A planner reading those comments would wrongly conclude a seventh copy is required.** **VERIFIED**

### 3.8 Q8 — `cleanup.js` · **AMEND**

`maxDuration: 30` (`:9`) — the one spec assertion this audit confirms verbatim. **VERIFIED†** Two steps, each `limit(500)`: mark `published`→`expired` where `expiresAt < now`; delete `expired` where `expiresAt < now-30d`. Standard cron auth. **VERIFIED**

**The subcollection problem is real.** Deleting a Firestore document never deletes its subcollections, and a repo-wide grep for `recursiveDelete|bulkWriter|BulkWriter|listDocuments|listCollections` returns **zero matches**. Every delete site is a flat `doc.ref.delete()` or `batch.delete(doc.ref)`. So a `receipts` subcollection under `fantasyTimesWire/{date}` would be orphaned permanently — invisible in listings, still billed, still returned by collection-group queries. **VERIFIED**

Two verifier corrections worth carrying: **the capability is not missing from the SDK** — `package-lock.json` resolves `firebase-admin` 13.7.0 → `@google-cloud/firestore` 7.11.6, which declares `recursiveDelete()` and `bulkWriter()`. It is missing from the *repo*, so the arc would be the first user. And the discovery pass's "the repo already commits this exact bug" is **wrong**: `cleanup-expired.js:279` deletes `battles` (no subcollections exist), and `:193` deletes `drafts` only for `status=='disbanded'`, which by construction never carries claims. The orphan risk is latent, not realised.

**Retention (corrected).** Story deletion is 30 days after `expiresAt`, and `expiresAt = publishedAt + expiryHours` per reporter (kai 24, alex 24, neta 48, doug 168, kim 336, vera 336 — `fantasyTimesPrompts.js:18,27,36,45,54,63`). Because the sweep runs only Mon/Thu, actual deletion lands up to 96h after the threshold: **31–35d (Kai/Alex), 32–36d (Neta), 37–41d (Doug), 44–48d (Kim/Vera).** **VERIFIED**

The discovery pass's worry — that a flat 30-day Wire sweep would strip facts from stories still live in the feed — is **refuted**: `feed.js:24-26` serves only `status=='published' AND expiresAt > now`, so Kim/Vera stories leave the feed at day 14. Wire always dies *after* the story leaves the feed and *before* the story doc is deleted. The real exposure is the opposite shape: `story/[id].js:31-52` returns any story **by ID with no status or expiry filter**, so an expired-but-undeleted story stays permalink-reachable for days 30→48 with its Wire facts already gone. Acceptable, but state it.

### 3.9 Q9 — Firestore rules · **CLEAR**

**Default posture is deny-all.** `firestore.rules:886-888`: `match /{document=**} { allow read, write: if false; }`. **VERIFIED†** Only one other recursive wildcard exists (`match /tournamentGroups/{groupId}/{document=**}` at `:447`) and it is scoped. **A new `fantasyTimesWire` collection, and a `receipts` subcollection beneath it, are denied to clients by default with no rule block needed.** **VERIFIED†**

The repo has an explicit precedent for shipping a server-only collection with no rule block — `firestore.rules:879-881`: *"masteryCorrections (spec §8) is deliberately ABSENT here: the collection ships in a later phase and the catch-all below already denies it."* **VERIFIED†** That is the precedent to cite.

**The spec's cited precedent is wrong and points the wrong way.** There is no `freeAgency`/`free_agency` collection in the rules at all. The only free-agency rule is `drafts/{draftId}/claims/{claimId}` (`:409-426`) — the **opposite** of server-only: clients may read it and create/update their own claims, and the parent `drafts/{draftId}` is client-create/update for any authenticated user. Citing it would import a client-writable posture into a collection that must be server-authoritative. **VERIFIED**

**In-namespace precedent for read-denial:** `fantasyTimesSuppressions/{date}` is `read: if false` (`:649-652`). **VERIFIED†** By contrast `fantasyTimesStories`, `fantasyTimesDeepdives`, `fantasyTimesConsensus/{date}` and `validatedCatalysts/{date}` are all `read: if true` — public and unauthenticated.

**Open gap:** the *deployed* ruleset cannot be verified from the repo. Rules do not auto-deploy (`package.json` has a manual step) and several blocks carry "Manual deploy via Firebase Console required" comments. The Wire's default-deny protection depends on the deployed ruleset also ending in the catch-all. This is the same limitation the July 15 rules audit recorded. **ASSUMED** — needs founder-side confirmation in the Firebase console before flag-flip.

### 3.10 Q10 — Doug batch seam · **AMEND**

**The seam splits the model call from the fact-bearing output across two invocations on different schedules.** `submit-earnings-batch.js:230` submits to the Anthropic Batch API and returns; the tool output only becomes readable in `poll-batch.js:108` up to 24 hours later, in a separate 10-second lambda with no memory of the submit. **The submit endpoint physically cannot write `agentFacts`; the poll endpoint has no submit-time context.** **VERIFIED**

**`custom_id` is the arc's single best pre-call identity.** Minted at `submit-earnings-batch.js:211` as `earnings_preview_${symbol}_${reportDate}` from EODHD calendar data — before the model call, deterministic across retries, and it survives into `poll-batch.js:111` as `result.custom_id`. **VERIFIED**

Three caveats: (a) it is unique only **within** a batch — once a preview expires (168h), the same symbol+date mints the same `custom_id` in a new batch and produces a second story, because the submit-side dedup is keyed on `primaryTicker` alone with no date component (`:146-160`); (b) `qualifyingEarnings` is never deduped by symbol, so a duplicated EODHD row would put two identical `custom_id`s in one batch — which Anthropic rejects wholesale, an all-or-nothing daily failure; (c) `batch.id` is useless as a key — it is minted *after* submission. **VERIFIED**

**Re-poll can duplicate stories.** `poll-batch.js:162` uses `.add()` inside an unbounded stream loop, and the only duplicate guard — the batch status flip at `:189` — is written *after* the entire stream is consumed. With `maxDuration: 10` (`:12`), a mid-stream timeout leaves `status=='processing'`, so the next 15-minute poll replays the full result set and re-adds every story. Any `agentFacts` write at `:162` inherits that duplication exactly. **VERIFIED**

**Also note:** `ingest-earnings.js` — one of the three files in this seam — makes **no Tool Use call at all**. It uses a bare `messages.create` with a prose "respond only with JSON" instruction and a hand-rolled fence-stripping parser (`ingestionPipeline.js:76-90, 398`). There is no schema to extend. **VERIFIED**

### 3.11 Q11 — Trading calendar · **STOP** → see §2.3(b)

The date helpers that *do* exist and are correct: `marketSchedule.js` (`getETDate`, `formatDateString`, `isMarketHoliday`, `isEarlyCloseDay`, `getNextMarketClose`), `tournamentTime.js:58-60` `formatEtDate(now)` and `masterySlot.js:42-47` `deriveSlotDate(createdAtIso)`. **The last two are the retry-immutable pattern the arc needs** — they take an injected instant rather than reading the wall clock. **VERIFIED**

**Unresolved and needing a spec decision:** does "last 5 trading sessions" mean the 5 sessions strictly *before* `marketDate`, or the 5 sessions *ending at* it? `getTradingDaysFromDate` is inclusive of its start; `getPreviousTradingDay` is strictly exclusive. The off-by-one matters for chain windows and the code cannot answer it.

### 3.12 Q12 — Pre-call identity · **AMEND**

**No endpoint has a usable pre-call identity today.** Every story ID is minted by `.add()` **after** the model call — verified at all nine writers. The pre-allocation pattern (`db.collection(x).doc()` with no args, which allocates client-side without a write) **is** idiomatic in this repo — `ingest-deepdive.js:222-223`, `forge/watchlists.js:165`, ~15 sites — but is used by no generator. **VERIFIED†**

Critically: **a pre-allocated ID solves cross-linking, not idempotency.** Firestore auto-IDs are random, so a retry mints a different one. The arc needs a *synthesized deterministic* key, not a pre-allocated ID.

**Per-seam idempotency key — all constructible from values that exist before the model call, with no upstream refactor:**

| Seam | Deterministic pre-call components | Proposed `triggerRef` | Confidence |
|---|---|---|---|
| Kai pulse | `period` (from cron URL, `generate-pulse.js:125`) + ET date | `kai:pulse:{period}` | **Strong** — `period` is hard-coded in three cron URLs |
| Alex mover | `upperSymbol` (`generate-mover.js:84`) | `alex:mover:{symbol}` | **Strong** on the scan path (dedup is same-day). Weaker on the dead HTTP path, whose 4h dedup + volatility override permits a second story per symbol per day |
| Alex macro | *none* | — | **None.** No dedup of any kind, no event id, and the detector strips its own `timestamp`/`triggerType` before POSTing. Seam is unreachable anyway (§2 / §5.3) |
| Neta econ | `event.event` — a **free-text name from a live Perplexity Sonar call** at temperature 0.2, JSON-scraped with a greedy regex (`generate-econ.js:120-129`) | `neta:econ:{slug(event)}` | **Weak.** "CPI" vs "CPI (YoY)" vs "Consumer Price Index" are all plausible on successive calls. Needs a canonicalisation function and will still miss |
| Doug recap | `earning.symbol` + `earning.reportDate` from a structured EODHD fetch | `doug:earnings_recap:{symbol}:{reportDate}` | **Strong** — structured API, not an LLM |
| Doug preview | `custom_id` (`submit-earnings-batch.js:211`) | the `custom_id` itself | **Strongest in the arc** — see §3.10 for its two caveats |
| Kim column | `columnType` (from cron URL) + ET date | `kim:sector_column:{columnType}` | **Strong**, and exactly the granularity the existing dedup already enforces |

**Two structural facts the key design must absorb:**

1. **The de-facto idempotency mechanism today is a non-transactional read-then-write dedup** — a Firestore query followed 100+ lines later by an unguarded `.add()`. There is **no `runTransaction` anywhere in `api/fantasytimes/`**. Two concurrent or retried invocations can both observe an empty dedup and both publish. **VERIFIED†**
2. **Every cron slot is scheduled to fire twice** — the DST double-fire hedge (e.g. `0 10,11 * * 1` for Kim's preview). The second fire is prevented from duplicating only by that same non-transactional guard. **The double-fire is the concrete, scheduled, guaranteed retry the arc must survive** — it is not a hypothetical. Good news: on the Kim path the dedup runs at `:175`, before the model call at `:288`, so the second fire short-circuits without spending tokens. **VERIFIED**

**And a fact that breaks the 1:1 story↔fact assumption:** a generation can produce a full paid tool result and publish **nothing**. The earnings-attribution interceptor runs *after* the model call and, on failure, writes a suppression record and returns HTTP 200 with `success:false` and no story doc (`generate-mover.js:249-267`, `generate-macro.js:140-162`, `generate-column.js:337-341`). A Wire emitter placed at the tool-result boundary would record facts for a suppressed story. **VERIFIED**

### 3.13 Q13 — Runtime characteristics · **CLEAR**

| Endpoint | `maxDuration` | Trigger | Notes |
|---|---|---|---|
| `generate-pulse` | 60 | cron ×3/day (dual-hour) | max_tokens 800 |
| `generate-mover` | 30 (**inert**) | in-process from `scan-movers` | The live path runs inside `scan-movers`' 60s budget, not its own |
| `scan-movers` | 60 | cron `*/15 13-20 * * 1-5` | Sequential per-mover loop, ~11 external round-trips each incl. an 8s Sonar call. A multi-mover day can exhaust 60s mid-loop with **no resume state** |
| `generate-macro` | 30 | *none* | Unreachable (§5.3) |
| `generate-econ` | 60 | cron ×18+1/day | Sonar + Haiku serialized |
| `generate-recap` | 60 | cron ×5/day | |
| `generate-column` | 60 | cron ×2/week | |
| `submit-earnings-batch` | — | cron `0 5 * * 1-5` | Batch submit, returns immediately |
| `poll-batch` | **10** | cron `*/15 * * * 1-5` | Header: *"Must complete in <10 seconds. No loops, no waiting."* |
| `cleanup` | 30 | cron Mon+Thu | |

**VERIFIED†** for every `maxDuration` above.

- **No `waitUntil` anywhere in `api/fantasytimes/`.** The dependency is present and used in `api/agent/` (`equip-bundle.js:298`, `set-tempo-dial.js:172`, `unequip-*.js`), so the pattern is available with precedent. **VERIFIED†**
- **No `runTransaction` anywhere in `api/fantasytimes/`.** The arc introduces the newsroom's first transaction; there is no observed retry behaviour to characterise, because there is nothing to observe. **VERIFIED†**
- **No `stop_reason` branching.** Every endpoint logs `response.stop_reason` and then guards only on `!toolBlock || !toolBlock.input`. With `max_tokens` pinned at 500–800 against prompts demanding 150–400-word bodies, **a truncated generation yields a partial tool input that is written to Firestore as a normal story.** For an arc whose thesis is typed validated facts, this is directly relevant: truncation is a live failure mode the validator will see. **VERIFIED**

**§9's performance criterion (p95 delta ≤ +1.5s, ≥20% headroom) is measurable but there is no baseline.** No p95 instrumentation exists in these handlers; only ad-hoc `[SCAN:TIMING]` console logs. A baseline must be captured before the flag flip or the criterion is unfalsifiable. **VERIFIED**

### 3.14 Q14 — Reconciliation host · **STOP** → premise corrected in §2.3(c)

All candidates share the identical `x-vercel-cron` / `CRON_SECRET` auth block, so hosting is a pure cadence/budget decision with zero auth work. **VERIFIED**

| Host | Schedule | Worst gap | `maxDuration` | Verdict |
|---|---|---|---|---|
| `cleanup.js` | `0 7 * * 1,4` | **96h** | 30 | **Disqualified** — cadence |
| `poll-batch.js` | `*/15 * * * 1-5` | 48h15m (Fri 23:45→Mon) | **10** | Covers all 24 UTC hours — the only one that does — but a 10s budget and an explicit in-file "no loops" design rule |
| `scan-movers.js` | `*/15 13-20 * * 1-5` | 64h15m | 60 | Window ends 20:59 UTC — can never reconcile the post-close pulse, the 21:00–00:00 Doug recaps, or the Friday Kim wrap |
| `agent-evaluate.js` | `*/15 13-21 * * 1-5` | 63h15m | 300 | Has the **exact sweep precedent** (`runRepairSweep`, §below) but its budget is already starved — `:110-115` documents a 60→300 raise and `:319-321` still defers agents when it runs out |
| **`process-pending-reflections.js`** | `*/15 13-23,0 * * *` | **12h15m** | 60 | **Nominated** |

**Nomination: `api/cron/process-pending-reflections.js`.** It is the only candidate that runs **every day including weekends**, giving a worst-case gap of 12h15m (00:45→13:00 UTC) against 48–96h for everything else. It already implements the exact deferral shape the sweep needs — `BATCH_LIMIT = 5`, `TIME_BUDGET_MS = 50_000`, flag cleared only on success, deliberately left set on failure so the next tick retries (`:24-28, 44-50, 88-94`). Its header documents precisely the arc's failure mode: a write fired but never landed because the lambda froze after the HTTP response returned. **VERIFIED**

**Two binding design corrections for §4.7:**

1. **Do not use `wireSync != 'synced'`.** A Firestore inequality cannot combine with the required "older than 15 minutes" timestamp range in one query, and there is **no `!=` filter precedent anywhere in this repo**. Use a **boolean pending flag** — `where('wirePending','==',true).orderBy('publishedAt')` — matching `process-pending-reflections.js:44-50` and `masterySettlement.js:678-681`, and declare the composite index in `firestore.indexes.json`. This is also what BUILD_RULES §57 mandates: the queue-flag pattern, `pendingReflection` precedent, fire-and-forget forbidden for catalog events. **VERIFIED**
2. **Write the sweep as an exported `runWireReplaySweep(db, {...})` in a `_utils` module and call it from the host cron inside an isolating try/catch**, so a Wire failure can never break the host's primary job. This is exactly how `runRepairSweep` (`masterySettlement.js:673-685`) is hosted inside `agent-evaluate.js:237-255`, with an in-file rationale citing BUILD_RULES §6 (no new cron entry). **Zero new cron slots; 37/40 preserved.** **VERIFIED**

### 3.15 Q15 — Injection-class registry · **STOP** → see §2.2

One further asset worth budgeting for: `agentGuardrails.bypassContract.test.js:18-21, 106-116` is a committed cross-module tripwire that binds guardrail `sourceNote` strings to the fenced `EMERGENCY_BYPASS_REASONS` set **by deriving them from real `applyGuardrails` calls rather than from literals**. That is the existing precedent for how the arc should lock any new typed vocabulary — the `agentFacts` enums will be expected to ship with an equivalent derived-not-literal contract test. **VERIFIED**

---

## 4. Amendment register (feeds spec §12)

Each row is a spec edit required before final lock. Severity: **BLOCKING** = founder ruling needed; **AMEND** = text correction; **MINOR** = precision.

| # | Spec § | Assumption | Reality | Severity |
|---|---|---|---|---|
| A1 | §1, P1, P7, §2.1, §6 | Catalyst override is the only agent-facing consumption; ticker never the why | 3 live headline render sites + standing rule S5 instructing trades on story sentiment (§2.1) | **BLOCKING** |
| A2 | §8 Q15, §6, P8(a) | `injectionClass` enum exists as documented | Does not exist. `PROVENANCE_TIER` (`ruleConflictReconciler.js:46`) is the real live registry; the natural new home is the **fenced** `agentEvalPromptAssembly.js` | **BLOCKING** |
| A3 | §4.4 | The eventType table is the taxonomy | A 9-value `type` taxonomy ships. 5 collide, 8 spec types have no producer, 3 shipped types absent (incl. Kai's and Kim's *only* types), Vera unmentioned | **BLOCKING** |
| A4 | §4.2 F1/F2 | A single universe exists for in/off classification | Six universes; `TGT` in the newsroom list and in neither validation map; one dot-spelling vs five hyphen | **BLOCKING** |
| A5 | §4.7, §8 Q14 | `cleanup.js` daily, ~16h replay | Mon+Thu only; **96h** worst case. Nominate `process-pending-reflections.js` | **BLOCKING** |
| A6 | §4.7 | `wireSync != 'synced'` query | Inequality + timestamp range is not a valid Firestore query and has no repo precedent. Use a boolean pending flag | **BLOCKING** |
| A7 | §4.5, §4.3 | An immutable ET `marketDate` bucket is available | No `marketDate` exists. Four private `getTodayET()` copies + a fifth ET helper, all wall-clock with no injectable `now`; ET and UTC dates mixed **inside the same request**; 5 sites hardcode `-05:00` (EST) | **BLOCKING** |
| A8 | §4.6 | "Last 5 trading sessions" leans on an existing utility | No backward N-session walker exists; the only multi-day builder is weekend-only; holidays are 2026-only across nine copies | **BLOCKING** |
| A9 | §4.5 | A pre-call `triggerRef` exists per endpoint | None does. All synthesizable (table §3.12), but Neta's is LLM-generated free text and needs canonicalisation | **AMEND** |
| A10 | §4.3 | Retention deletes `fantasyTimesWire/{date}` and its receipts together | Subcollections survive doc deletion; repo has zero recursive-delete tooling (SDK has it) | **AMEND** |
| A11 | §9 | Flag-false payload equality is the hard part | It is the easy part — 2 lines per endpoint. The hazard is **mutating** the shared module-level schema in a warm container | **AMEND** |
| A12 | §5 | voiceLayerCache stores voice lines with a token budget | Stores no prose, calls no model. Full-overwrite `set()` with no merge — `newsLine` must be written *inside* that cron | **AMEND** |
| A13 | §6.1, §4.3 | ~15–30 entries/day | Not code-derivable. Floor 3/weekday, cron ceiling 136, 163–166 firings/weekday | **AMEND** |
| A14 | §4.1, P2 | agentFacts would be the first typed machine output | Schemas already require typed facts the handlers **discard** (`eventName`, `symbol`, `outcome`, `epsActual`). `dataSnapshot` exists in 8 incompatible shapes, `null` for Vera | **AMEND** |
| A15 | §11 | Story doc is a complete record of every generation | Suppressed generations return HTTP 200 with no story doc. Facts written at the tool-result boundary would orphan | **AMEND** |
| A16 | §8 Q9 | "Free-agency precedent" for a server-only collection | No such collection; the free-agency rule is client-writable. Cite `masteryCorrections` (`firestore.rules:879-881`) instead | **MINOR** |
| A17 | P8(d) | Risk manager runs downstream, guardrails always run | Risk manager is **upstream** (strengthens the claim); `applyGuardrails` is skippable. Cite the 5-check unconditional post-model stack at `agent-evaluate.js:2071-2135` | **MINOR** |
| A18 | §4.4 | Reporter allowlist covers the newsroom | Vera (`deepdive`) is a sixth story-writing reporter, absent from the spec. `ingest-deepdive` is manual-only **by design** (`VERA_INGEST_SECRET`, `scripts/ingest-vera.js`) — not dead | **MINOR** |
| A19 | §4.8 | Two flags suffice | `generate-macro` is unreachable and `generate-mover`'s HTTP route is dead — the rollout plan should say which seams are actually exercised during dark-solo, or the corpus will be smaller than the gate expects | **MINOR** |

---

## 5. Found outside scope — for separate tasking

Per BUILD_RULES §44: reported, **not fixed**.

**5.1 `poll-batch.js` variable shadowing — observability defect, not a pipeline break.** `const results = []` (`:71`, outer try) is shadowed by `const results = await anthropic.messages.batches.results(batchId)` (`:95`, inner try `:78-197`). Line `:84` resolves to the line-95 binding in its temporal dead zone and throws `ReferenceError` on **every poll of a still-in-progress batch**; line `:196` throws `TypeError` (`JSONLDecoder` has no `push`). Introduced by `98cd2a3` (2026-04-16). **VERIFIED** by nesting-exact `node` repro.

**Impact is bounded and the discovery pass overstated it.** Both throws are swallowed by the per-batch `catch` at `:197`, which pushes onto the real line-71 array and continues. For an ended batch, every Firestore side effect — story writes at `:162`, batch status flip at `:189-193` — has already committed before `:196` throws. **The earnings-preview pipeline is functionally intact.** The damage is that the endpoint reports `{batchId, error: …}` for every batch regardless of outcome, so a genuine failure is indistinguishable from the cosmetic one. Monitoring blindness on a seam that has already gone dark silently for nine days once (per `98cd2a3`'s own commit message).

**5.2 `seedConsensus` wipes same-day economic events.** `fantasyTimesConsensus.js:114-127` writes `economics: []` inside `set({...}, {merge:true})`, and a merge-set **replaces** an array field. It fires at 13:25/14:25 UTC (`process-draft-claims.js:550-553`); Neta's recap appends real events at :00/:30 of 13–21 UTC. The 13:00 UTC tick's events are destroyed. Root cause is the orphaned `economicCalendar` read whose producer was deleted in `a155e599` (2026-03-01) without cleaning up the reader or the rules comment at `firestore.rules:11`. **VERIFIED**

**5.3 Two dead generation paths.** `generate-macro.js` has no cron, exports only `config` and the default handler (no in-process bypass), and its sole caller — `fantasyTimesDetector.js:216` — sends no auth header **and** has zero importers repo-wide, so it is tree-shaken from the client bundle. `generate-mover.js`'s HTTP route is dead for the same auth reason (its in-process path via `scan-movers.js:170` is alive). `macro_alert` therefore has one producer and a permanently-starved consumer (`fantasyTimesClient.js:121`). **VERIFIED** — note a naive cron restoration would *not* revive it: a bare GET hits the 405 at `:52`, and even a POST hits the 400 at `:61` requiring a `triggers` array.

**5.4 Dedup guard reads the wrong document.** `generate-column.js:175-186` applies `.limit(1)` with **no `orderBy`**; the inequality on `publishedAt` makes Firestore order ascending, so `docs[0]` is the **oldest** Kim column since `startOfDay`, not the newest. If two Kim columns of different types ever coexist in one ET day, the guard inspects the wrong one. **VERIFIED**

**5.5 `ingest-econ` dedup is effectively always false.** `ingest-econ.js:146-161` calls `getClaimsForTicker(null, {source:'fed_event', limit:1})`; that builds `where('linkedTickers','array-contains', null)` and applies the `source` filter *after* the per-query `.limit(1)`, with all errors swallowed. Every scheduled run re-ingests and overwrites via `batch.set` (no merge). **VERIFIED**

**5.6 Order-dependent persisted data from a dead statement.** `generate-column.js:211-213` assigns `topMovers`, a variable never read again — but its `.sort()` mutates `validEtfPrices` **in place**, which is why both the prompt (`:232`) and the persisted `dataSnapshot.sectorPerformance` (`:370`) are ordered by descending absolute change rather than declaration order. Deleting the apparently-dead statement would silently reorder persisted data. **VERIFIED**

**5.7 Out-of-enum persisted value.** The `recommended_action` schema enum is `['BAGGERBOMB','SNAKEDRAFT','WATCHLIST','RESEARCH']`, but `generate-recap.js:281` and `poll-batch.js` write the fallback `'EARNINGSGAME'`, and `StoryDetail.jsx:593` branches on it. The persisted domain is 5 values, not 4. **VERIFIED**

**5.8 Ticker casing is not uniform.** `generate-mover`/`generate-macro`/`ingest-deepdive` uppercase explicitly; `generate-pulse.js:337` takes `primaryTicker` straight from LLM output with no uppercasing; `generate-column.js:360` writes LLM-supplied **sector name strings** into the `tickers` array. The `array-contains` reader at `agentTriggerGate.js:213` is case-sensitive and its failure is silently swallowed. **VERIFIED** — this one bears directly on the arc's F1 normalisation and should probably be folded in rather than tasked separately.

---

## 6. What discovery could not answer

1. **Whether the deployed Firestore ruleset matches `firestore.rules`.** Rules deploy manually. The arc's default-deny protection depends on the deployed ruleset also ending in the catch-all. Founder-side console check required before flag-flip.
2. **Whether `economicCalendar/latest` still physically exists in production** with stale ~Feb-2026 data. If it does, `seedConsensus` seeds *stale* events rather than empty — a worse failure than §5.2 describes.
3. **The empirical hit rate of `fetchRecentNews` per tick.** Reachability was verified from source; frequency needs production data.
4. **p95 runtimes.** No instrumentation exists. §9's performance criterion needs a captured baseline first.
5. **Whether "last 5 trading sessions" is inclusive or exclusive of `marketDate`.** A spec decision, not a code fact.
6. **Whether the 2027 holiday list will be refreshed.** Only the TODO at `marketSchedule.js:10` was found — no script, cron, or checklist item regenerates the nine copies.
7. **The "40" cron ceiling** is unverified in code and the repo's docs disagree with each other.

---

## 7. Fence posture

**No fenced file was edited.** `agent-evaluate.js`, `agentEvalPromptAssembly.js`, `decide.js`, `agentGuardrails.js`, `agentBattleService.js`, `agentScoring.js` and `agentPromptAssembly.js` were **read only**, which BUILD_RULES §12 explicitly permits. No exported fenced function was called. No new importer of a legacy archetype table was introduced (§2.3 ratchet untouched). **VERIFIED†**

**Forward notice:** spec P4 says Phases 1–2 touch zero fenced files. That still holds. But finding A2 means Phase 3's injection-class work has no non-fenced home — `agentEvalPromptAssembly.js` is where the flat `parts` array lives. Phase 3 will need an explicit §7 fence-contact authorisation covering a **structural** change (parts entries becoming `{class, text}` objects), not just an additive one, and it will break the `__p4_snapshots__` golden files. That is a bigger ask than §6 currently sets up.

---

## 8. HARD STOP

Per spec §8 and §12, this is the end of Phase 0. Nothing was built. No further work proceeds until the founder reviews this report and rules on the five STOPs, after which the spec's §12 sequence resumes: **amendment pass → focused re-review of amendments only → final lock → build.**

The three rulings that gate everything else:

1. **A1 / STOP-A** — Given that headlines, sentiment and a trade-directive rule (S5) already reach the agents, is the arc's purpose restated as *replacing* an existing unstructured news channel? And does S5 survive, get rewritten, or get retired?
2. **A2 / STOP-B** — Phase 3 must build the injection-class registry rather than attach to one, inside a fenced file. Authorise the larger scope, or re-cut Phase 3.
3. **A4 / STOP-C** — Which of the six ticker universes is authoritative for in/off-universe classification?

The other two STOPs (A5 host, A8 calendar) are engineering corrections that need no ruling beyond accepting the added scope.

---

*20260724_FANTASYTIMES_WIRE_PHASE0_DISCOVERY.md — Phase 0, read-only — July 24, 2026 — @ `dd28eedf`*
