# Command Center Scouting Board — Phase 0 Discovery Findings (Read-Only)

**Date:** 2026-06-30
**Mode:** Phase 0 discovery · READ-ONLY · hard STOP for founder review before any build
**Method:** Every claim cited `file:line` on **current `main`**. The two build-gating decisions (Q1 Path-A callability, D3 reason-chip feasibility) and the Q5 no-write-leak claim were re-verified by an independent adversarial pass. No code was edited; this findings file is the only artifact created.

---

## 0. Baseline

| Item | Value |
|---|---|
| **New baseline** | `origin/main` @ **`f190a67d`** — pulled in via merge; all code citations below are against this tree. |
| **Working HEAD** | `aeb39454` = merge of `origin/main` (`f190a67d`) into `claude/command-center-audit-rknu2b` + the prior June-25 audit report. |
| **Ahead of audit SHA?** | **Yes** — `f190a67d` is **24 commits ahead** of the June-25 audit baseline `37ccf9e3` (which is a clean ancestor). |
| **Working tree** | clean. |

The 24-commit delta is the **`archetype-integrity` Phase 0–H series (PR #544)** plus `312cb0c9 Enable various feature flags for testing`. Critically for this board, **it did not touch the ranking surface** (see Q0).

---

## 1. ⚑ HEADLINE — Q1 verdict: **(A) Cleanly callable. V1 is fully non-fenced.**

The archetype ranked board can be produced **read-only, outside the deploy/commit path**, with no battle creation and no writes:

```
GET /api/agent/scouting-board?archetype=&watchlistId=
  → read  indexIntelligence/stockRankings   (ONE Firestore doc get — the universe)
  → call  computeArchetypeRankings(stocks, archetype)   (PURE, zero imports)
  → read  watchlists/{watchlistId}           (ONE Firestore doc get)
  → union equipped tickers onto the board    (watchlistEquip.js helpers — PURE)
  → return top-N
```

Every step is a **read or a pure function**. `computeArchetypeRankings` (`archetypeScoring.js:107-141`) and the watchlist helpers (`watchlistEquip.js`) have **zero import/require statements** — neither transitively pulls `createAgentBattle` / `agentBattleService` / any write path (Q5, verified). The same ranking is already invoked read-only elsewhere (`tournamentAgentBoards.js:462`, `trainingLifecycle.js:259`), so this is a proven pattern.

**Consequence:** Build Path A applies as written in the spec. No §7 fence extraction, no read-only duplicate fetch, no founder ruling on D4 required — the read-only universe fetch is a plain Firestore doc get, not welded into `decide.js`'s commit flow.

---

## 2. Q0 — What the archetype-integrity merge changed (keep/discard for the June-25 Section E)

**The board reads the deterministic ranking, and the ranking surface is byte-identical across the merge.**

- **Ranking surface UNCHANGED — confirmed.** `git diff --stat 37ccf9e3..f190a67d -- api/agent/decide.js api/_utils/agentArchetypeConfig.js api/_utils/archetypeScoring.js` returns **empty**. `computeArchetypeRankings` is still at `archetypeScoring.js:107`; the universe read + ranking call are still at `decide.js:233-244`. The June-25 ranking anchors hold at the same lines. **KEEP.**
- **Roster + weight profiles UNCHANGED.** The 6 stable code-ids (`momentum_chaser, analyst, diversifier, contrarian, degen, guardian`) and their `ARCHETYPE_WEIGHTS` (`archetypeScoring.js:14-63`) / `agentArchetypeConfig.js` are in the empty-diff set. **KEEP.**
- **Dead config STILL DEAD.** `convictionMods` / `regimePreferences` / `sectorConcentrationCap` / `tradeFrequency` in `agentArchetypeConfig.js` still have **zero production reads** (grep across api+src, excluding tests/the config file). The new `src/data/archetypeAdjustments.js` is a zero-import data module feeding **only the voice layer + directive gate** (`archetypeAdjustments.js:3` — *"single source of truth for BOTH the voice layer … and the deterministic directive gate"*), **not** trading/ranking. **KEEP.**
- **⚑ CORRECTION — voice is NO LONGER archetype-agnostic.** The merge added Phase-D four-zone injection via `buildArchetypeIntegrityBlock` (`voiceLayerPrompt.js:2513-2528`), which returns null **only** when `ARCHETYPE_INTEGRITY_MODE === 'off'` (`:2514`). The current default is **`'observe'`** (`featureFlags.js:271`), so the archetype persona/proposal/third-path/user-levers blocks **are injected into the live battle prompt today** (`voiceLayerPrompt.js:2962`). The June-25 Section-E finding "voice is archetype-agnostic" is now **stale** — voice *prompt* differentiation is behaviorally live in `observe`. (What stays dark: the directive *write* side — `chat.js:483` persists `gate.directive` only when `enforce`, else null.) **REVISE Section E.**
- **Diversifier swap-time cap — implemented but NOT behaviorally live.** `injectDiversifierSectorCap` (`agentGuardrails.js:64-86`) hard-returns the untouched base unless `ARCHETYPE_INTEGRITY_MODE === 'enforce'` (`:66`); default is `observe` → cap never fires (also tournament-only + diversifier-only). Called once from `agent-evaluate.js:1609`. **KEEP-WITH-CAVEAT** (code exists, dark until the `enforce` flip).
- **Archetype immutability mid-battle — holds.** `change-archetype.js` changed +7 lines but it is a **comment-only tripwire**; the load-bearing battle-lock still throws: `if (agent.activeBattleId) throw … battle_active` (`change-archetype.js:84`). **KEEP.**

**Flag-state corrections vs the June-25 audit** (all in `featureFlags.js`): `ARCHETYPE_INTEGRITY_MODE = 'observe'` (`:271`, new); `CONFLICT_RECONCILER_DETECT_ENABLED = true` (`:229`, was false); `CONFLICT_RECONCILER_INJECT_ENABLED = true` (`:247`, was false — the reconciler now injects at deploy, a fenced-path behavior change unrelated to this board); `LEAGUE_AGENT_CHAT_ENABLED = true` (`:300`, new). None affect the ranking the board reads.

**Bottom line for scoping:** the board build stands on the *unchanged* ranking surface; the archetype-integrity work is a parallel voice/directive/guardrail subsystem that does not touch it. The only Section-E finding to revise is "voice is agnostic."

---

## 3. Q1 (detail) — Universe assembly is callable read-only

- Universe = **one Firestore doc read**: `db.collection('indexIntelligence').doc('stockRankings').get()` → `.data().stocks` (`decide.js:233-239`). No battle, no write.
- Ranking call at `decide.js:242-244`: `computeArchetypeRankings(stockUniverse, archetype)`.
- `computeArchetypeRankings` (`archetypeScoring.js:107-141`) is pure, non-mutating (`:101` "Does NOT mutate the input array"), returns a sorted-desc copy. **No founder ruling needed on D4** (that decision was contingent on Q1=B; Q1=A).

---

## 4. Q2 — Return shape of `computeArchetypeRankings`

Each ranked item is `{ ...s, archetypeScore }` (`archetypeScoring.js:137`), i.e. the raw `stockRankings` item plus an appended `archetypeScore` (0–100, always present). The **real per-stock fields** the `stockRankings` cron writes (`compute-index-intelligence.js:993-1009`):

| Field | Written at | Status |
|---|---|---|
| `symbol` | `:993` | **real** (the ticker) |
| `sectorId` / `sectorName` | `:994-995` (derived `:946`) | **real** (nullable if unmapped) |
| `technicalScore` | `:1003` | **real** |
| `atrPercentile` | `:1009` (cross-sectional, `:920-924`) | **real** |
| `fundamentalScore` | `:1000` (`fundScore || null`, from `fund?.compositeScore` `:943`) | **nullable** |
| `compositeScore` | `:1006` (`:949-953`) | **nullable** (null unless both fund + tech ranks exist) |
| `baggerBombFit` | `:1008` (`?? null`) | **nullable** |
| `archetypeScore` | appended by ranking | **always present** |
| `sectorDiversity` | — | **not a field** — computed dynamically from sector distribution (`archetypeScoring.js:110-126`) |

The `?? 50` / `?? 0.5` reads in `computeArchetypeRankings` (`archetypeScoring.js:120-124`) are **null-fallbacks, not blanket constants** — so `archetypeScore` is always well-defined, but a *reason chip* on a nullable dimension is only honest when the underlying field is non-null.

---

## 5. D3 — Reason-chip feasibility (drives §4.2 and D3)

A chip is "formula-backed" **only** if its dimension is a real, non-null field on that stock. Mapping each archetype to its dominant weighted dimension:

| Archetype | Dominant dim (weight) | Backing field | V1 chip? |
|---|---|---|---|
| momentum_chaser | technicalScore (0.40) | **real** | **Ship** — "strong technicals" |
| degen | atrPercentile (0.60) | **real** | **Ship** — "high volatility" |
| contrarian | inverseComposite (0.40) | compositeScore **nullable** | **Conditional** — render only when `compositeScore != null` ("oversold") |
| analyst | fundamentalScore (0.40) | **nullable** | **Conditional** — render only when `fundamentalScore != null` ("strong fundamentals") |
| guardian | sectorDiversity (0.35) / fundamentalScore (0.30) | relational / nullable | **Weak** — sectorDiversity is portfolio-relational, not a per-name reason; consider a low-`atrPercentile` "steady / low-vol" chip (real field) instead |
| diversifier | sectorDiversity (0.30) | relational (not per-name) | **Defer per-name chip** — the diversity story is portfolio-level (show sector spread), not a per-name reason |

**Recommendation (D3):** ship **null-guarded, formula-backed chips** — degen and momentum_chaser render unconditionally; contrarian and analyst render only when their source field is non-null; guardian uses low-volatility (real `atrPercentile`) or none; diversifier shows sector spread rather than a per-name chip. **When the driving field is null, render no chip** (honesty principle §2 — no fabrication). If the founder prefers uniform behavior, defer all chips to a fast-follow and ship the board name+score+sector only.

---

## 6. Q3 — Watchlist fold: the board must union the watchlist SEPARATELY

The equipped watchlist is **not** folded into `computeArchetypeRankings` — the ranking runs over the raw universe only. The watchlist folds in **later, at draft/execution time**:

- `foldEquippedTickers` (`watchlistEquip.js:77-102`): at the Sonnet-shortlist stage, it **keeps equipped tickers and appends ("elevates") them even when off-universe** (`:88-94`), and augments `validSymbols` so `validatePortfolio` won't reject off-universe equipped names.
- `unionEquippedIntoHotBench` (`watchlistEquip.js:124-158`): unions equipped tickers into the intraday bench (soft cap 20, equipped always retained).
- Watchlist read at `decide.js:254-262` (`resolveEquippedWatchlist`, then `extractTickerSymbols`).

**Implication for the board (honesty principle):** to preview "what *this agent* would trade" faithfully against the eventual draft, the board must **union the equipped watchlist as a distinct, visibly-marked group** ("from your watchlist"), because deploy guarantees those tickers into the draft regardless of rank:
- Watchlist ticker **in-universe** → show with its real `archetypeScore` (it may rank below top-N; deploy still elevates it).
- Watchlist ticker **off-universe** → show it, but with **no `archetypeScore` and no reason chip** (it isn't in the ranked set — do not fabricate a score). This is exactly consistent with §2.

This resolves **D1: reflect the equipped watchlist** (recommended) — and specifies *how*: rank + separately-unioned watchlist group, not "hope it appears in top-N."

---

## 7. Q4 — Surface + funnel wiring (confirmed current lines; files unchanged by the merge)

- **Mobile** `src/components/Dashboard/CommandDashboard.jsx`: primary READ CTA label rendered at **`:299`** (`… isLive ? 'Battle in progress' : 'Deploy on this read'`); handler `handleDeploy` → `await deployAgent(agent.id, onCreateAgentBattle)` at **`:135`** (import `:31`). "Talk it over" no-op stub at **`:304-312`** (header note `:14`). → Replace the `:299` CTA with **"See what it's eyeing"** opening the board; keep `:135`'s `deployAgent` call as the **"Deploy this agent"** action *from* the board.
- **Desktop** `src/components/Dashboard/desktop/ReadColumn.jsx`: deploy button `onClick={onDeploy}` at **`:119`**, label at **`:129`**; props `onDeploy, deployDisabled, deploying, isLive` (`:29`); "Talk it over" stub `:134-142`. → Same swap; `onDeploy` is the injected deploy handler.
- **Archetype swap** `ArchetypePicker` → `api/agent/change-archetype.js`: **battle-locked** — `if (agent.activeBattleId) throw … battle_active` (**`:84`**; error def `:36`; the +7-line merge change was a comment-only tripwire).
- **Equip locked during a live battle** `src/components/Dashboard/EquipStation.jsx`: `benchLocked = Boolean(agent?.activeBattleId)` (**`:108`**), gating the pickers (`:233,:249,:264`).

**Consequence (spec §4.3):** archetype/watchlist can't change mid-battle, so **swap-to-preview is a between-battles interaction** — the board naturally lives in the "no active battle" state of the Command Center, consistent with its role.

---

## 8. Q5 — New read-only endpoint + import-graph safety

- **New serverless endpoint is the right shape** (not client-side compute): the ranking, the `stockRankings` universe, and the watchlist are all server-side Firestore/`api/` resources.
- **No write-path leakage (verified):** `archetypeScoring.js` and `watchlistEquip.js` each have **zero `import`/`require` statements**. The only `createAgentBattle`/`agentBattleService` tokens in `watchlistEquip.js` are in comments (`:12`, `:162`); `.add`/`.set` are JS `Set`/`Map` ops, not Firestore writes. An endpoint importing `computeArchetypeRankings` + the watchlist helpers pulls in **no** battle-creation or write path.
- **Auth posture to mirror:** `api/agent/chat.js` handler + `requireAuth` (chat.js changed in the merge for League chat, but the auth-gate pattern stands).
- **Watchlist read pattern to reuse:** `decide.js:254-262` (`db.collection('watchlists').doc(id).get()` → `resolveEquippedWatchlist`).
- **V2 envelope seam (spec §7):** ship the response as a `mode:'board'` envelope so V2 can later return `mode:'draft'` from the same endpoint with no client redesign.

---

## 9. Founder decision points (ruling at this Phase 0 review)

| # | Decision | Phase-0 finding → recommendation |
|---|---|---|
| **D1** | Board reflects equipped watchlist, or universe-only? | **Reflect watchlist** — and specifically as a *separately-unioned, marked group* (Q3), because deploy elevates equipped tickers regardless of rank. In-universe → show real `archetypeScore`; off-universe → show name, no score/chip. |
| **D2** | Board size | **Top ~10** (spec default; nothing in Phase 0 argues against it). |
| **D3** | Reason chips in V1? | **Yes, null-guarded + formula-backed.** degen/momentum ship; contrarian/analyst render only when their nullable field is present; guardian → low-vol or none; diversifier → sector-spread, not a per-name chip. Never fabricate; a null field ⇒ no chip. Alternatively defer all chips to fast-follow (founder's call on uniformity). |
| **D4** | If Q1=B: §7 extraction vs read-only duplicate? | **MOOT — Q1=A.** The universe is a plain Firestore doc read; no fence work, no duplicate fetch. |
| **D5** | Direct-deploy escape hatch retained? | **Yes** — cheap now (board is instant/free), and load-bearing for V2 where forcing the board forces an LLM call. The existing `deployAgent(agent.id, onCreateAgentBattle)` call (`CommandDashboard.jsx:135` / `ReadColumn.jsx` `onDeploy`) is the unchanged commit path to keep reachable. |

---

## 10. Open items / uncertainties (could not be fully closed read-only)

1. **Chip null-frequency in practice.** `fundamentalScore` / `compositeScore` / `baggerBombFit` are nullable at source (`compute-index-intelligence.js:1000,1006,1008`). How often they're null for the *top-N* of each archetype's board (which decides how often contrarian/analyst chips actually render) is data-dependent and not determinable from code alone — resolve by sampling a live `stockRankings` doc.
2. **`stockRankings` freshness/coverage for the board.** The doc is written by `compute-index-intelligence` (pre-market + hourly intraday). Whether the board should show a "as of {time}" stamp, and behavior before the first daily run, is a UX detail for the build (the DRB box already has an empty-state precedent).
3. **Two placeholder investigator outputs.** The Q2/D3 and Q5 *investigator* agents misfired (returned placeholder text); their findings here rest on the **adversarial verifiers' independent confirmations** plus the lead's own file reads (all cited). The Q4 investigator errored out entirely and was reconstructed by the lead directly from the cited surfaces. No conclusion rests on the failed agents' output.
4. **Voice-in-`observe` scope.** Q0 establishes the four-zone voice block injects in `observe`; the exact per-archetype prompt text and whether the founder wants the Scouting Board to *also* surface that voice differentiation (a V2 "regime-fold"/voice seam, spec §7) is out of scope here.

---

**END OF PHASE 0 — hard STOP for founder review. No build begun; no code edited.**
The single actionable headline: **Q1 = Path A (cleanly callable) → V1 is fully non-fenced.** Awaiting founder rulings on D1/D2/D3/D5 before any implementation.
