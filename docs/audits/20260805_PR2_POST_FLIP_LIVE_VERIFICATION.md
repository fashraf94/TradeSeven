# PR-2 post-flip verification — LIVE half (four house battles, one per remaining archetype)

**Companion:** `docs/audits/20260805_AGENT_ACTIVE_BATTLE_TRACE.md` (the static/read-only half — the trace and the runbook this report executes).

**Session preamble (BUILD_RULES §2/§3):** `git fetch origin` run first and recorded. Branch `claude/house-battles-pr2-verify`, cut fresh from `main` at `1eb33ec3` (`main` advanced `85eeca6f` → `1eb33ec3` mid-session via PR #704; `git merge-base --is-ancestor 85eeca6f HEAD` = true, so the DR-13 flip is included). Never committed to `main`. All citations VERIFIED = read this session.

**Fence statement (BUILD_RULES §1):** no fenced file was edited. Fenced exports were *called* read-only: `createAgentBattle` (via the production endpoint), `computeArchetypeRankings` / `ARCHETYPE_*` (`archetypeScoring.js`), `assessRequiredBaselines`, `buildEvalSystemPrompt` (`agentEvalPromptAssembly.js`), `getArchetypeConfig` / `getArchetypeLabel`. No feature flags were changed.

---

## Executive verdict

| Step | Result |
|---|---|
| 1. Production preconditions (rankings + pricing baseline) | ✅ **PASS** |
| Deploy gate — production carries the DR-13 flip | ✅ **CONFIRMED**, two independent ways |
| 2. Four POSTs to production `/api/agent/decide` | ✅ **4/4 HTTP 200, `battleCreated:true`** |
| 2. G2 check (returned `agentBattleId` ≡ new active battles) | ✅ **PASS** — exact set match |
| 3. Identity block live in the eval prompt, all four archetypes | ✅ **PASS** — byte-exact against expected renders |
| 3. Output tokens vs the 2048 ceiling | ✅ **PASS** — max 60.2%, zero truncation |
| Archetype coverage across both halves | ✅ **All six** |

**Bottom line:** the DR-13 eval identity block is live in production and renders correctly for all six archetypes. No truncation, no degraded ticks, no fence contact.

---

## Deploy gate — production carries the flip

Two independent confirmations.

**1. Direct SHA.** The shadow stream stamps the commit per tick (`api/_utils/shadowAssemblyCapture.js:99` — VERIFIED). Production `shadowDiffs` contain `85eeca6fdfe199eaa4433f3114a4ac8728fcf271` (the flip merge) and, after the two mid-session redeploys, `1eb33ec3…` — which has the flip as an ancestor.

**2. Behavioral, on the incumbent battles.** `sizes.liveSystem` was flat from Jul 27 to `2026-08-05T17:01Z`, then stepped at the `17:16Z` tick — the first eval tick after the 12:00:22 CDT production deploy (5s after the merge commit):

| Battle | Archetype | Pre-flip | Post-flip | Delta | `renderEvalIdentityBlock` |
|---|---|---|---|---|---|
| `AqO0d60f…` | degen | 14389 | 15304 | **+915** | degen = **915** |
| `jSjy4dg…` | analyst | 14391 | 15483 | **+1092** | analyst = **1092** |

Deltas match the rendered blocks exactly. *(Founder ruling, this session: this evidence is ACCEPTED as the formal PR-2 post-flip verification for the two incumbent archetypes. The four-battle readout below extends coverage to the remaining four.)*

---

## Step 1 — Preconditions against PRODUCTION (`tradeseven`)

| Precondition | Source of truth | Result |
|---|---|---|
| `indexIntelligence/stockRankings` populated | `api/agent/decide.js:297-298` (VERIFIED) | **PASS** — exists, `stocks = 236` |
| Pricing baseline gate | `decide.js:821` → `assessRequiredBaselines` (VERIFIED) | **PASS** — `complete=true`, 34/34 usable, 0 unusable |

Method: replicated the real gate path (`fetchValidatedStartingPrices`, `decide.js:1011-1049`, then `assessRequiredBaselines`) over the top-12 candidate pool for each of the four target archetypes — 34 distinct symbols, every one a finite, strictly-positive, **non-fallback** Guard-1-clean baseline.

**Scope note (stated deliberately):** the real gate assesses the exact 6 + 6 symbols chosen per deploy, unknowable before the AI runs. This probe asserts the stronger property — the whole ranked pool those picks are drawn from priced clean — so a later `pricing_unavailable` would signal a change after this timestamp, not a standing condition. In the event, all four deploys passed the real gate.

---

## Step 2 — `ensureCpuAgents` + the four POSTs

`ensureCpuAgents(db, [1,2,3,6], nowIso)` → `created=[] existing=[1,2,3,6]`. All four system agent docs already existed (`tournamentCpu.js:101-116` — get-or-create, never rewrites an existing doc), so this was a pure read. Archetypes are fixed by the frozen round-robin `CPU_ARCHETYPE_ORDER[(n-1)%6]` (`src/constants/leagueTournament.js:367-378` — VERIFIED).

Four POSTs to production `/api/agent/decide`, `Authorization: Bearer $CRON_SECRET`, body `{agentId, ownerOdUserId}` (the internal-caller contract, `decide.js:161-168`):

| n | agent | archetype | HTTP | latency | `battleCreated` | `agentBattleId` |
|---|---|---|---|---|---|---|
| 1 | `cpu-agent-1` | momentum_chaser | 200 | 36.3s | **true** | `ELMt4L3uWmk7qjpfBRmf` |
| 2 | `cpu-agent-2` | contrarian | 200 | 35.8s | **true** | `xy5WL3oceniagc6nIJE1` |
| 3 | `cpu-agent-3` | diversifier | 200 | 38.9s | **true** | `wYYNLOJFzbwLh5ZJn2Ce` |
| 6 | `cpu-agent-6` | guardian | 200 | 40.1s | **true** | `X4d6RwGW6jekGdYaf0Ak` |

**G2 check (the `tournamentOrchestrator.js:377` lesson — a 200 is not proof).** All four returned `battleCreated:true` with an id. Active battles went 5 → 9; the four new `status:'active'` docs are exactly the four returned ids (set equality VERIFIED), each with the expected archetype and `agentId`:

```
ELMt4L3uWmk7qjpfBRmf | momentum_chaser | cpu-agent-1 | baggerbomb_agent
xy5WL3oceniagc6nIJE1 | contrarian      | cpu-agent-2 | baggerbomb_agent
wYYNLOJFzbwLh5ZJn2Ce | diversifier     | cpu-agent-3 | baggerbomb_agent
X4d6RwGW6jekGdYaf0Ak | guardian        | cpu-agent-6 | baggerbomb_agent
```

**Verification-method deviation (approved):** the runbook said to confirm the four by querying `status=='active'` and matching archetypes. A **guardian battle was already active** at the time (`UCdzqneGt9XRnfAd2SLj`), so archetype-matching would have collided. Verification was done by exact `agentBattleId` set-match instead. The per-agent one-active-battle guard (`decide.js:690-694`) was never a risk — it is keyed on agent, and `cpu-agent-1/2/3/6` are distinct from the incumbents.

Portfolios produced (archetype-plausible on their face):

| Archetype | star | core | support |
|---|---|---|---|
| momentum_chaser | PLTR, SNOW | FCX, ETN | PANW, SHOP, SOL |
| contrarian | CRWV, NOW | CCI, SBAC | ZS, CHTR, SOL |
| diversifier | FCX, AMZN | MSFT, ETN | NEM, DG, BTC |
| guardian | AMZN, MSFT | BMY, EMR | BAC, JPM, BTC |

---

## Step 3 — Post-tick readout (agent-evaluate tick `2026-08-05T19:15Z`)

All four were picked up on the first tick after creation and evaluated exactly once (`totalHaikuCalls = 1` each), so each battle's cumulative `cronState.totalTokens.output` **is** that tick's `output_tokens` — no cross-tick delta needed.

### Identity-block evidence

The shadow-stream `sizes.liveSystem` for each new battle matches a local recomputation of `buildEvalSystemPrompt(agentName, archetype, gameMode, archetype)` **exactly**, and every prompt contains `EVAL_IDENTITY_SUBORDINATION_CLAUSE`:

| Archetype | shadow `sizes.liveSystem` | local recompute | clause present | expected render delta | implied pre-flip base | `render` / cap |
|---|---|---|---|---|---|---|
| momentum_chaser | 15608 | 15608 ✅ | yes | 1095 | 14513 | 922 / 1050 |
| contrarian | 15630 | 15630 ✅ | yes | 1130 | 14500 | 957 / 1050 |
| diversifier | 15528 | 15528 ✅ | yes | 1025 | 14503 | 852 / 1050 |
| guardian | 15517 | 15517 ✅ | yes | 1005 | 14512 | 832 / 1050 |

All four carry `commitSha = 1eb33ec3…` — the deployed build, flip included.

**On the pre-flip comparison.** These four are `baggerbomb_agent`; the incumbents whose pre/post step was measured are `baggerbomb_tournament`, and the system prompt differs by game mode. A direct subtraction against the 14389/14391 incumbent band would therefore have been apples-to-oranges. The sound check is the internal one: subtracting each archetype's expected render from its observed size yields implied pre-flip bases of **14513 / 14500 / 14503 / 14512** — a 13-character band, consistent with one common base varying only by agent-name length. That, plus the exact local-recompute match, establishes the block is rendering at full expected size for every archetype.

**Cap compliance:** `EVAL_IDENTITY_RENDER_CHAR_CAP = 1050` governs the `render` field (`evalIdentityBlocks.js:49` — VERIFIED); all four are 832–957, under cap. The larger delta figures add the 141-char subordination clause plus wrapper, and are not cap-governed.

### Decision, conviction, and rationale (opening sentence VERBATIM)

**momentum_chaser** — `HOLD`, conviction **85**
> "I'm holding all positions on Day 1 opening."

**contrarian** — `HOLD`, conviction **45**
> "I'm fresh into this battle with a contrarian portfolio built on solid thesis: beat-down sectors (Tech, Real Estate, Communication Services) with high ARCH scores and fundamental safety nets."

**diversifier** — `HOLD`, conviction **75**
> "I'm opening this battle with a fresh portfolio built on solid ARCH scores and sector diversification."

**guardian** — `HOLD`, conviction **65**
> "I'm opening fresh on Day 1 with a balanced, defensively-tilted portfolio: AMZN and MSFT in Star (both showing directional expansion with strong fundamentals), BMY and EMR in Core (healthcare and industrials diversification), and BAC, JPM, BTC in Support (low-volatility anchors)."

All four HOLD is the expected Day-1-opening posture, not a degraded default: `haikuError` is `null` on every tick and no `failureClass` was recorded, so these are deliberate HOLDs, not the fallback HOLD that a transport failure produces (`agent-evaluate.js:2564-2567`, `:2594` — VERIFIED).

### Output tokens vs the 2048 ceiling

`EVAL_MAX_OUTPUT_TOKENS = 2048` (`api/_utils/agentEvalTransport.js:34` — VERIFIED).

| Archetype | output_tokens | % of 2048 | truncated | failureClass |
|---|---|---|---|---|
| momentum_chaser | 1131 | 55.2% | **false** | — |
| contrarian | 1201 | 58.6% | **false** | — |
| diversifier | 1158 | 56.5% | **false** | — |
| guardian | 1233 | 60.2% | **false** | — |

Zero truncation; ~40% headroom at the worst case.

**Finding worth flagging:** every one of these four post-flip evals (1131–1233 tokens) **exceeds the previous 1024 ceiling**. Had the identity block gone live while the ceiling was still 1024, all four would plausibly have truncated mid-JSON — the `truncated_response` failure class at `agent-evaluate.js:1969-1977`. The max-tokens raise to 2048 was load-bearing for this flip, not incidental. Worth keeping in view if identity content grows.

---

## Deviations from the runbook as written

1. **Host — POSTs went to `https://www.fantasytrades.io`, not the apex.** The apex `https://fantasytrades.io` returns **307 → `https://www.fantasytrades.io`**, and per the fetch spec the `Authorization` header is **stripped across that origin change**. Requests to the apex therefore arrived unauthenticated (`401 Missing or invalid Authorization header`), which also produced misleading `403 internal_only_fields` on bodies carrying `ownerOdUserId`. Posting directly to the redirect target resolved it. **This is a live trap for any future internal caller** — `deployBaseUrl()` (`tournamentOrchestrator.js:207-211`) would produce the apex form from `VERCEL_PROJECT_PRODUCTION_URL` if that var were ever set to the apex domain. Recommend it be pinned to the `www` host. *(Reported, not fixed — BUILD_RULES §3.)*
2. **`ensureCpuAgents` arity.** The runbook line omitted the third argument; the real signature is `ensureCpuAgents(db, ns, nowIso)` (`tournamentCpu.js:101`). A fresh ISO timestamp was passed, per founder confirmation. Passing `undefined` would have written `createdAt: undefined` and been rejected by Firestore.
3. **G2 verification by id rather than archetype** — see Step 2.
4. **`CRON_SECRET` was not retrievable.** It is Sensitive/write-only on Vercel; `vercel env pull` returns it empty even with `--environment=production` (confirmed by direct test). Root cause of the initial failures was an un-redeployed env change; the founder rotated the secret to a proper 64-hex value and redeployed. The credential was held only in a session-scratch file outside the repo tree, never printed, logged, or committed, and was deleted after use.
5. **Production redeployed twice mid-session** (PR #704 at 13:24 CDT; the secret rotation at 13:50 CDT). The four battles were created against, and evaluated by, the final deployment (`1eb33ec3`). The incumbent-battle step evidence at 17:16Z was gathered on the earlier `85eeca6f` deployment. Both carry the flip.

## Out-of-scope observation (reported, not fixed — BUILD_RULES §3)

Battle `UCdzqneGt9XRnfAd2SLj` (guardian, `expiresAt = 2026-08-06T00:00:00.000Z`) was `status:'active'` when read at ~18:11Z. By ~18:45Z the document **no longer existed** in `agentBattles` (`.exists === false`) — removed roughly six hours before its expiry, rather than transitioning to a completed status. This may be routine archival not traced in this session, but a disappearing battle doc warrants separate tasking.

## Artifacts

Byte-exact run artifacts were written outside the repo tree (BUILD_RULES §3), in the session scratchpad: `STEP1_PRECONDITIONS_RESULT.md`, `step2-results.json`, `step3-results.json`, and the probe scripts `precheck.mjs` / `flipcheck.mjs` / `step2.mjs` / `step3.mjs`.
