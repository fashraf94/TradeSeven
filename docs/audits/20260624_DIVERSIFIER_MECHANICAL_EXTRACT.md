# Diversifier — "Does It Actually Diversify?" Extract
### FantasyTrades · pre-authoring mechanical check · 2026-06-24

**Repo:** `/home/user/TradeSeven` · **HEAD:** `f8c2316` · **Mode:** read-only. No edits, no build. `file:line` + VERIFIED (read this session) / ASSUMED.

---

## Verdict — **between A and C: "soft-live, hard-absent"**

> The `diversifier` **is** mechanically distinct from a generic agent today — but **only through soft LLM-steering** (a spread-weighted fit-sort + the strongest sector-spread *instruction* of any archetype). Its **defining hard mechanic — an enforced concentration cap — does not exist at the archetype layer.** The one real hard sector cap in the engine is **generic and user-equipped** (a Forge rule), not archetype-wired; the archetype's own `sectorConcentrationCap` is dead. So a Diversifier today *leans hard toward spreading*, but **nothing guarantees it stays spread** — diversification rests on the LLM honoring a prompt line.

**Not Reality B** (it is *not* generic — its spread steering is real and stronger than most peers). **Not pure Reality A** (there is no enforced spread). **Not fully hollow C** either — the soft wires are live. **Author it as "leans hard toward spreading," not "cannot over-concentrate."** If you want the guarantee, it's a small build — and the machinery to do it already exists (§4).

---

## 1. Layer-by-layer

| Layer | Mechanism | Live? | Soft/Hard | Archetype-gated? | Citation |
|---|---|---|---|---|---|
| **Config** `sectorConcentrationCap: 2` | the archetype's own concentration cap | **DEAD** | — | (would be) | `agentArchetypeConfig.js:109`; 0 reads (prior extract) — **not connected to the live sector cap in §3** |
| **Config** `tradeFrequency: 'moderate'` | trade-cadence label | **DEAD** | — | — | `agentArchetypeConfig.js:110`; 0 reads |
| **Config** `ARCHETYPE_WEIGHTS.diversifier.sectorDiversity: 0.30` | fit-sort rewards stocks in under-represented sectors | **LIVE** | **Soft** | ✅ yes | `archetypeScoring.js:37`; consumed `computeArchetypeRankings` → `decide.js:243` |
| **Config** `ARCHETYPE_CONSTRAINTS.diversifier` "span ≥7 sectors, no sector >4 stocks" | shortlist rule injected into the Sonnet draft prompt | **LIVE** | **Soft** | ✅ yes | `archetypeScoring.js:85-86`; injected `agentPromptAssembly.js:13-14` |
| **Config** temperature 0.5/0.4, `hftConfig` | creativity + rotation physics | LIVE | — | (hftConfig not spread-related) | `archetypeScoring.js:71`; `agentArchetypeConfig.js:95-107` |
| **Portfolio construction** `validatePortfolio` | structural validation only — slot counts, valid symbols, dupes, crypto | LIVE | — | ❌ **no sector check at all** | `decide.js:833-874` (VERIFIED — no sector logic) |
| **Portfolio construction** fallback `buildFallbackPortfolio` | "Core: pick different sectors from Star" | LIVE | Hard (but trivial) | ❌ **generic — all agents**, fallback-only | `decide.js:884-890` |
| **Risk / eval** `checkSectorCap` / `maxSectorWeight` | **HARD** — blocks a SWAP that would push a sector over the cap | **LIVE** | **Hard** | ❌ **generic + user-equipped (Forge rule), NOT archetype** | enforce `agentGuardrails.js:431-463`; gate `:159-178`; wired `agent-evaluate.js:1607` |
| **Eval prompt** "Rotate into a different sector for diversification" | swap-reasoning hint | LIVE | Soft | ❌ generic (static system-prompt prose) | `agentEvalPromptAssembly.js:101,323` (ASSUMED generic — static line) |

---

## 2. Is `diversifier` distinct from a generic agent? — **Yes, but softly, and it overlaps Guardian**

Two **diversifier-specific, live** wires make it spread more than a momentum/contrarian/degen/analyst agent:
- **Fit-sort weight** `sectorDiversity: 0.30` — the universe the Sonnet draft sorts by rewards under-represented sectors. (Peers: momentum/contrarian/degen `0.00`, analyst `0.10`.)
- **Shortlist constraint** "span ≥7 sectors, no sector >4 stocks" — the most explicit spread instruction of the six.

**Honest nuance — it overlaps `guardian`:** on the fit-sort, **guardian actually out-weights it** (`sectorDiversity: 0.35` vs `0.30`, `archetypeScoring.js:61`), and guardian's constraint also says "spread across ≥6 sectors" (`:91-92`). So the *spread* axis does **not** cleanly separate Diversifier from Capital Preserver — guardian is "spread **+** defensive (ATR ceiling, low churn)," diversifier is "spread, full stop." Author the Diversifier's distinctiveness as **pure breadth with no defensive/quality overlay** (it carries no ATR ceiling, no quality floor, a middling risk posture `defaultConfig.risk:45`), rather than as "the one that spreads."

---

## 3. The hard-cap gap (why "guarantees diversification" is false today)

- The archetype's `sectorConcentrationCap: 2` is **dead** — nothing reads it, and it is **not** the threshold the live sector cap uses.
- The live hard sector cap (`checkSectorCap`, blocks a swap over `maxSectorValue` slot-share) fires **only when the agent's deployed strategy carries a `maxSectorWeight` guardrail** (`agentGuardrails.js:159-178`), sourced from `agent.deployedStrategy.guardrails` (`agentBattleService.js:159-160`). That guardrail is a **Forge rule `se-07`** ("max sector weight %," default 30, range 15–50, `compile-dimensions.js:96`) — **a user equips it; the archetype never injects it.**
- Draft-time (`validatePortfolio`) enforces **no** sector spread.

**So:** a `diversifier` deployed without a user-equipped max-sector-weight rule has **no hard concentration limit at any layer** — only the soft Sonnet shortlist hint and the fit-sort. It can end up as concentrated as the LLM allows.

---

## 4. Raw material for a real hard Diversifier — **already exists; the build is small**

Everything a future archetype-gated concentration cap needs is present:
- **The enforcement function is built and wired:** `checkSectorCap` already computes post-swap sector slot-share and blocks (`agentGuardrails.js:431-463`), called every eval at `agent-evaluate.js:1607`. A real Diversifier would just need its archetype to **inject a default `maxSectorWeight` guardrail** (archetype-sourced, e.g. from the currently-dead `sectorConcentrationCap`) instead of waiting for a user rule.
- **Sector data on every stock:** `sectorId/sectorName/industryName` (written by `compute-index-intelligence.js`, exposed in `screenStocks.js` SCALAR_FIELDS); GICS taxonomy in `STOCK_UNIVERSE` (`rankingConfig.js`); `sectorDiversity` scoring already computed (`archetypeScoring.js:110-126`).
- **Correlation infra exists too** (a "Correlation exit" Forge rule, `voiceLayerPrompt.js:277`) if you ever want correlation-based spread, not just sector-count.
- **Cleanest build:** wire the dead `sectorConcentrationCap` → a default `maxSectorWeight` guardrail for `diversifier` (reusing `checkSectorCap`), and/or add a draft-time sector check in `validatePortfolio`/`buildFallbackPortfolio`. The hard machinery and data already exist — only the **archetype→guardrail wire** is missing.

---

## Authoring guidance (honest framing)

- ✅ True today: "I lean hard toward spreading — I sort for under-represented sectors and I'm told to span many sectors and cap any one." (soft, but real and stronger than most peers)
- ❌ False today: "I won't let any one sector dominate / I cap concentration." — there is **no enforced cap** unless the user equips a max-sector-weight rule.
- ⚠️ Distinctiveness: don't anchor identity on "the spreader" alone — `guardian` spreads as much. Anchor on **breadth without the defensive/quality overlay**.
- 🔧 If the founder wants the guarantee to be real, flag the small §4 build (wire the dead cap into the existing `checkSectorCap` guardrail) and author the hard-cap line **only after** it ships.

*End of extract. Read-only — no edits, no plan changes.*
