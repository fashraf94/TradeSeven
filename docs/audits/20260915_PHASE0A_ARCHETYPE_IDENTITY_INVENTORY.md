# Phase 0A — Archetype Identity Inventory at HEAD

**Type:** read-only discovery. No code, config, flag or data change. No PR.
**Session date:** 2026-09-15.
**Report of record:** `docs/audits/20260915_PHASE0A_ARCHETYPE_IDENTITY_INVENTORY.md`

---

## 1. Session record (BUILD_RULES §3)

| Item | Value |
|---|---|
| `git fetch origin` | **Run first**, before any remote comparison (§3). New remote branches + one new tag appeared; no error. |
| Branch (at invocation) | `claude/affectionate-albattani-dk5628` — **not** the branch this prompt names |
| Branch (work + commit) | `claude/phase0a-archetype-identity`, cut fresh from HEAD (= `origin/main`) |
| HEAD SHA | `a007a2b5dfe0ac1471c4edacebfcfeddc3ec05e8` |
| `origin/main` SHA | `a007a2b5dfe0ac1471c4edacebfcfeddc3ec05e8` — **identical** |
| `git status --porcelain` | empty (clean tree) |
| History inspection | `git fetch --unshallow` run (repo was shallow); required for the "last commit touching X" column in Q1. Permitted and recorded per §3. |
| Fenced files | `decide.js`, `agentEvalPromptAssembly.js`, `agentScoring.js`, `agentSwapExecution.js`, `agentArchetypeConfig.js`, `agentRiskManager.js` — **read only, none modified**. |
| Subagents | Two read-only Explore agents (compatibility matrix; voice layer + zones). Their citations were spot-checked against HEAD before inclusion; corrections are marked inline. |
| Firestore / external APIs | **Not queried.** Data questions are written as queries for the founder in §4. |

### Branch discrepancy — flagged, not resolved by me

The harness that started this session assigned `claude/affectionate-albattani-dk5628`; this prompt names `claude/phase0a-archetype-identity`. I treated the prompt as the founder instruction of record and cut the named branch from HEAD. **The report is on `claude/phase0a-archetype-identity`.** Nothing was pushed to the harness-assigned branch.

### Context document — ABSENT at HEAD

`docs/FILM_ROOM_REVIEW_LOOP_DESIGN_NOTE_V1_2_20260915.md` **does not exist** in the repository at `a007a2b5` (verified: `git ls-files | grep -iE "film|review_loop"` returns only the Command Center Film Room redesign quick-references V2/V3, two `.docx` specs, and `src/` components). `origin/main` is the same SHA, so it is not a "not-yet-merged" case. §5 and §6.6 were therefore unavailable; the inventory was built from code and repository documents alone, which is what Rule 5 requires anyway. **No finding in this report depends on that document.**

---

## 2. Plain-terms summary for the founder

**Which documents are current.** All six archetypes have both a June 24 definition document and a July 23–24 constitution. Nothing authored is newer than July 24. So the documents you have on hand *are* the newest authored identity documents in the repository. What has moved since is not documents — it is code.

**The big picture: the identity that reaches the trading brain is much thinner than the documents suggest, and in one place it contradicts them.**

Three separate things carry "identity" today, and they do not agree with each other:

1. **The mechanical dials** (how often it rotates, how high the entry bar sits, how many swaps per window). These are real, live, and differentiated per archetype — every trading tick reads them. The Capital Preserver's headline behaviour, *it will not be force-rotated out of a stalled position*, is genuinely switched on and genuinely unique to it.

2. **The identity paragraph** written into the swap-decision prompt. This went live some time ago and is now in every evaluation tick, for both game modes. The six paragraphs are locked byte-for-byte to the constitutions, so document and code cannot drift apart.

3. **Everything else in the documents** — the four zones, the coaching language, the hand-off model — reaches only the *conversation* layer and the directive gate. **None of it reaches a trading decision.**

**The contradiction you should know about.** The Capital Preserver constitution says its stop is deliberately *wide and patient* — "firing on genuine breakdown rather than on a bad day, because a tight stop would fight the archetype's identity." The code says the opposite twice over:

- The archetype table marks Capital Preserver as "defensive," and "defensive" is the **tightest** of the three risk settings in the codebase — tightest stop, quickest cut, its own text reads *"Tight stops — protect the current score aggressively."*
- And it never gets that setting anyway. **Every battle of every archetype is created on the middle "balanced" setting**, hardcoded. The archetype's own preference is read by exactly one module, and that module only draws a picture for the UI.

So a Capital Preserver agent today runs on the same stop, the same cut-speed and the same trail as a Speculator. The documents' whole "third distinct stop calibration" story, and the "most sensitive at 1 tick" figure, describe a setting the agent never receives. Its patience is real in one place only — the no-forced-rotation switch — and that one *is* genuinely live.

**A second, smaller mismatch.** The Capital Preserver's identity paragraph — the one that reaches the trading brain — says *"low-beta required."* The word "beta" does not exist anywhere in the trading decision pipeline. There is no beta number in the data the agent sees, so it cannot act on that instruction; it can only sound like it does. Meanwhile the thing that *is* enforced for Capital Preserver — spreading across sectors, which is its single heaviest sorting weight — is not mentioned in that paragraph at all.

**What has changed since the June/July documents.** The identity paragraph went live (it was dark when it was written). A second version of the stock-ranking engine was built and sits switched off. A registry now composes every archetype's identity into one object, and has minted three catalogue versions, of which the live one is the second. A conversation-layer "four zones plus menu" block was built and is live. None of this changed the mechanical dials, which have not moved since July 8.

**One document error worth correcting.** The Capital Preserver constitution's own header says "2 swaps/60min"; its body says "2/120min". The code says 120. The header is wrong.

---
## 3. Findings

Every line number is at HEAD `a007a2b5`. **VERIFIED** = read in this session. Where this prompt quotes a document claim, the verdict is stated explicitly.

---

### Q1 — Where identity lives

Identity is not in one place. It is in **nine** artifact classes. The table below is per class; the per-archetype content differences are in Q3 and Q6.

#### Q1.a — Authored identity documents (all six archetypes, same shape)

| Artifact | Path | Last commit touching it | Status |
|---|---|---|---|
| Definition — Trend Follower | `ARCHETYPE_DEF_TREND_FOLLOWER_TEMPLATE_2026-06-24.md` | `c6bc963d` · 2026-06-25 · "Add files via upload" | **No runtime reader, no parity test.** Cited as content authority in code comments only (`archetypeAdjustments.js:6`, `archetypeRuleCompatibility.js:27,87`, `api/scripts/archetype-integrity-eval/corpus.js:4`); absent from the `docs/README.md` registry. Note this one is titled **TEMPLATE** (`:2`). |
| Definition — Contrarian | `ARCHETYPE_DEF_CONTRARIAN_2026-06-24.md` | `c6bc963d` · 2026-06-25 | No runtime reader, no parity test |
| Definition — Diversifier | `ARCHETYPE_DEF_DIVERSIFIER_2026-06-24.md` | `c6bc963d` · 2026-06-25 | No runtime reader, no parity test |
| Definition — Speculator | `ARCHETYPE_DEF_SPECULATOR_2026-06-24.md` | `c6bc963d` · 2026-06-25 | No runtime reader, no parity test |
| Definition — Fundamental Investor | `ARCHETYPE_DEF_FUNDAMENTAL_INVESTOR_2026-06-24.md` | `c6bc963d` · 2026-06-25 | No runtime reader, no parity test |
| Definition — Capital Preserver | `ARCHETYPE_DEF_CAPITAL_PRESERVER_2026-06-24.md` | `c6bc963d` · 2026-06-25 | No runtime reader, no parity test |
| Constitution — Trend Follower | `CONSTITUTION_TREND_FOLLOWER_V1.md` | `31e6cb77` · 2026-07-23 | **Read by CI.** Doc-parity-locked to code |
| Constitution — Contrarian | `CONSTITUTION_CONTRARIAN_V1.md` | `31e6cb77` · 2026-07-23 | Read by CI |
| Constitution — Diversifier | `docs/CONSTITUTION_DIVERSIFIER_V1.md` | `e6d448a0` · 2026-07-24 | Read by CI |
| Constitution — Speculator | `CONSTITUTION_SPECULATOR_V1.md` | `31e6cb77` · 2026-07-23 | Read by CI |
| Constitution — Fundamental Investor | `CONSTITUTION_FUNDAMENTAL_INVESTOR_V1.md` | `31e6cb77` · 2026-07-23 | Read by CI |
| Constitution — Capital Preserver | `CONSTITUTION_CAPITAL_PRESERVER_V1.md` | `31e6cb77` · 2026-07-23 | Read by CI |
| Identity contract (shared, not per-archetype) | `ARCHETYPE_IDENTITY_CONTRACT_V1.md` | `4865d629` · 2026-06-01 | Source of the onboarding copy transcribed into `src/data/archetypeIdentity.js` |

**Evidence.** The six definitions and five of six constitutions sit at repo root; Diversifier's constitution is the one in `docs/`. The path map that binds the constitutions to code is `api/_utils/evalIdentityBlocks.js:86-93` (`EVAL_IDENTITY_CONSTITUTION_PATHS`), and `docs/README.md:81-88` records the same six paths plus the binding rule. **VERIFIED.**

**"Read by CI" means what it says, and it is strong.** `evalIdentityBlocks.js:12-18` states the mechanical lock: the co-located test parses each constitution's golden-render blockquote out of the markdown and asserts byte-equality with the frozen constant. Doc and code cannot drift — editing either without the other fails CI. **This makes the constitutions the only archetype documents in the repository that code cannot silently contradict.** The definitions have no such lock. **VERIFIED.**

**No kernel documents and no partner-contract documents exist.** `git grep -il "kernel"` / `"partner"` over tracked files returns only unrelated script fixtures (`scripts/test-inputs/msft-open-partnership.txt` and its result JSONs). The word "kernel" appears only inside code comments and the constitutions themselves, describing the identity-block content — never as a separate document. **VERIFIED.**

#### Q1.b — Identity / registry code (versions, hashes, lock state)

| Artifact | Path | Last commit | Status |
|---|---|---|---|
| Registry (the one composed read surface) | `api/_utils/archetypeRegistry.js` | `b0738895` · 2026-08-07 · "Composition PR 4 — batch 3: candidate defaults object, v3 catalog mint, version-parameterized resolver" | **Live**, but only for seeding + mandate paths — see below |
| Version constants | `api/_utils/archetypeVersionConstants.js` | `421c0b8f` · 2026-08-07 · "PR 3.5 — trait-ladder repair … + identity v2" | Live (16 importers) |
| Immutable snapshot v1 | `docs/registry-snapshots/archetype-registry-identity-v1.json` | `997a1e8d` · 2026-07-23 | Rollback read surface |
| Immutable snapshot v2 | `docs/registry-snapshots/archetype-registry-identity-v2.json` | `421c0b8f` · 2026-08-07 | **The live identity version** |
| Immutable snapshot v3 | `docs/registry-snapshots/archetype-registry-identity-v3.json` | `b0738895` · 2026-08-07 | **Candidate catalogue — held dark** |
| Seeding | `api/_utils/archetypeSeeding.js` | `9bd68477` · 2026-08-07 | Live (born-with traits at clone/seed) |
| Derivation | `api/_utils/archetypeDerivation.js` | `e379943f` · 2026-06-01 | Live (onboarding archetype derivation) |
| Effective-archetype resolver | `api/_utils/directiveIdentity.js` | `ec610b26` · 2026-06-25 | Live |

**Versions and lock state at HEAD.** `ARCHETYPE_IDENTITY_VERSION = 2` (`archetypeVersionConstants.js:58`), `KNOB_CONFIG_VERSION = 2` (`agentArchetypeConfig.js:30`), `CALIBRATION_BUNDLE_VERSION = 1` (`:22`), `GUARDRAIL_SET_VERSION = 2` (`:42`), `RULE_LIBRARY_VERSION = 1` (`:27`), `GAME_MODE_POLICY_VERSION = 1` (`:47`), `COMPILER_VERSION = 1` (`:62`), `FREEZE_POLICY_VERSION = 1` (`:69`). Each constant is monotonic and paired with a content-hash CI lock (`:10-13`). **VERIFIED.**

**A version/artifact gap worth naming.** Three snapshots exist (identityVersion 1, 2, 3 — read from each file's own `identityVersion` and `identityHash` header) but the code constant `ARCHETYPE_IDENTITY_VERSION` is **2**. This is not drift. `archetypeRegistry.js:115-122` is version-parameterized: v3 is reachable as `CANDIDATE_IDENTITY_VERSION` (`:117`, defined `:85` as `ARCHETYPE_IDENTITY_VERSION + 1`), and `:118-120` serves strictly-prior versions from the immutable snapshots. The constant is the **fallback**, not the live selector — `selectIdentityVersion(descriptor)` returns `descriptor?.activeIdentityVersion ?? ARCHETYPE_IDENTITY_VERSION` (`compositionActivationService.js:284-286`), so the runtime version comes from the Firestore activation record.

**Which means the live identity version is a runtime fact I cannot verify under Rule 3.** The in-repo activation run record states the v2→v3 flip completed (`docs/audits/composition-activation-20260819/README.md:6`; `ACTIVATION_RUNBOOK.as-run.md:514`). If that holds, v3 **is** production-read — three call sites pass a resolved version into the registry: `archetypeSeeding.js:55`, reached via `trainingClone.js:251` and `api/agent/change-archetype.js:239`. What they read from it is narrow: `resolveSeedSource` (`archetypeSeeding.js:51-59`) consumes only `def.defaultTraitIds` / `def.defaultTraits` and fails closed on an unresolvable version (`:56`). **So v3 can govern born-with trait seeding, and nothing else** — its compat cells are composed (`archetypeRegistry.js:296-305`) and discarded. See §4 query Q-A. **VERIFIED as to code; the descriptor value is unverified.**

**The registry does not feed the trading brain.** Its production importers are the seeding path (`archetypeSeeding.js:43,55`), the mandate surfaces (`mandateVintage.js:32-36,65`; `mandateCreationService.js:19`; `mandateEscape.js:20`; `mandateGenerationConfig.js:17`; `api/mandate/create.js:26`; `api/mandate/escape.js:21`), the composition machinery (`compileOnSettingsChange.js:58`, `compositionEnforcement.js:34`, `declaredRuleConflicts.js:40`) and the client identity helper (`src/services/compositionIdentityClient.js:34`). **No battle-eval or deploy prompt path imports it.** **VERIFIED.**

#### Q1.c — Eval identity block text

| Artifact | Path | Last commit | Status |
|---|---|---|---|
| Six frozen renders + renderer | `api/_utils/evalIdentityBlocks.js` | `152217ea` · 2026-09-02 · "Ask 2 (rescoped) — precedence made honest, MUSTs qualified (dark)" | **LIVE — read on every eval tick** |
| The fenced splice | `api/_utils/agentEvalPromptAssembly.js:341` | `152217ea` · 2026-09-02 | **LIVE** |
| 12 flag-on prompt snapshots | `api/_utils/__dr13_snapshots__/` (6 archetypes × tiered + flat6) | — | ON-state texts of record |

The renders are at `evalIdentityBlocks.js:101-141`, one frozen object per code-id carrying `render`, `promptSpecVersion` (`'dr13-1.0.0'`, `:40`) and `kernelIdentityVersion` (`'1.0.0-pre-registry'`, `:45`). Full text per archetype is in Q4. **VERIFIED.**

#### Q1.d — Archetype config (fit-sort weights, constraint text, HFT knobs)

| Artifact | Path | Last commit | Status |
|---|---|---|---|
| HFT knobs + regime prefs + caps (§1 fenced) | `api/_utils/agentArchetypeConfig.js` | `ce740c0c` · **2026-07-08** · "Release 1: land B4-tuned knob values + KNOB_CONFIG_VERSION" | **LIVE** — `hftConfig` read every tick |
| Fit-sort weights / temperatures / constraint text (§1 fenced) | `api/_utils/archetypeScoring.js` | `2ad873c1` · 2026-09-02 · "Archetype Rank V2 Job 1 Phase B: V2 scorer (dark), fenced 3-line entry" | **LIVE (V1 table)** |
| V2 weights / filters / constraint text | `api/_utils/archetypeScoringV2.js` | `9c36757b` · 2026-09-02 | **DARK** — `ARCHETYPE_VECTORS_V2_ENABLED = false` |
| Preset risk levers (stop / cut-speed / trail) | `api/_utils/agentPresetConfig.js` | `adaa151b` · 2026-06-12 | **LIVE**, but archetype-blind at battle creation — see Q3 |

**The knob table has not moved since 2026-07-08.** Nothing in the archetype rebuild has touched the mechanical dials. **VERIFIED.**

#### Q1.e — The directive gate's adjustment menu

| Artifact | Path | Last commit | Status |
|---|---|---|---|
| Menu + zones + conflict groups | `src/data/archetypeAdjustments.js` | `9ba769cb` · 2026-07-10 · "Release 2: conflict groups ADJUDICATED" | **LIVE** |
| The gate | `api/_utils/directiveGate.js` | `0d727251` · 2026-09-08 · "G5: chips minted by id and the receipt on both clients" | **LIVE** under `ARCHETYPE_INTEGRITY_MODE='enforce'` |
| Legacy side-door closer | `api/_utils/legacyDirectiveSanitize.js:37` | — | **LIVE** — returns no legacy directives whenever the mode is not `'off'` |
| Directive filing endpoint | `api/agent/file-directive.js:69` | — | LIVE (a recorded §2.3 ratchet importer) |
| Workshop UI menu | `src/components/Forge/workshop/character/CharacterArea.jsx:21,35` | — | LIVE (`RELEASE3_CHARACTER_TAB_ENABLED = true`, `featureFlags.js:103`) |

`src/data/archetypeAdjustments.js` is a **single module carrying two different things**: the four-zone identity prose (`zones`, per archetype) and the adjustment allowlist (`adjustments`). Its own header says so (`:4-6`): "Single source of truth for BOTH the voice layer (four-zone identity injection) and the deterministic directive gate (the per-archetype allowlist). Authored fresh from the six finalized `ARCHETYPE_DEF_*_2026-06-24.md` docs (content authority)." **VERIFIED.** This is the one place where the June definition documents made it into code.

#### Q1.f — Compatibility-matrix cells

Covered in full in Q8.

#### Q1.g — Voice-layer identity / zone content

| Artifact | Path | Last commit | Status |
|---|---|---|---|
| Voice-layer prompt assembly (renders zones + menu) | `api/_utils/voiceLayerPrompt.js:2601-2615` | `b9cb95dc` · 2026-09-09 | **LIVE** under `ARCHETYPE_INTEGRITY_MODE !== 'off'` |
| Voice-layer grounding | `api/_utils/voiceLayerGrounding.js` | — | `VOICE_GROUNDING_MODE = 'shadow'` (`featureFlags.js:2137`) |
| Onboarding / dashboard copy | `src/data/archetypeIdentity.js` | `e379943f` · 2026-06-01 | LIVE (display) |
| Display names | `src/data/archetypeDisplay.js` | `e379943f` · 2026-06-01 | LIVE (display) |
| Character/exploration copy | `src/data/archetypeCharacter.js` | `bf4c6682` · 2026-07-23 | LIVE (display) |

---

### Q2 — Newest versions

**Finding.** For every one of the six archetypes, the newest authored identity document is its **constitution**. Five are dated **2026-07-23**; the Diversifier's is **2026-07-24**.

| Archetype | Newest identity document | Date | Has constitution? | Has kernel doc? |
|---|---|---|---|---|
| `momentum_chaser` | `CONSTITUTION_TREND_FOLLOWER_V1.md` | 2026-07-23 | Yes | No separate kernel doc exists for any archetype |
| `contrarian` | `CONSTITUTION_CONTRARIAN_V1.md` | 2026-07-23 | Yes | — |
| `diversifier` | `docs/CONSTITUTION_DIVERSIFIER_V1.md` | **2026-07-24** | Yes | — |
| `degen` | `CONSTITUTION_SPECULATOR_V1.md` | 2026-07-23 | Yes | — |
| `analyst` | `CONSTITUTION_FUNDAMENTAL_INVESTOR_V1.md` | 2026-07-23 | Yes | — |
| `guardian` | `CONSTITUTION_CAPITAL_PRESERVER_V1.md` | 2026-07-23 | Yes | — |

**Is anything newer than 2026-07-23?** Yes, three things — and only one is a document:

1. **`docs/CONSTITUTION_DIVERSIFIER_V1.md`, 2026-07-24** (`e6d448a0`). It was uploaded to the repo root with the other five on 2026-07-23 (`31e6cb77`), then deleted from root (`3b9cb4a5`) and re-added under `docs/` on 2026-07-24. `docs/README.md:83` records the move; `evalIdentityBlocks.js:83-84,89` records the path exception. Content-wise it is the same generation as the other five. **VERIFIED.**
2. **Registry snapshot v2, 2026-08-07** (`421c0b8f`) — a code-derived identity artifact, not an authored document. It is the live `ARCHETYPE_IDENTITY_VERSION`.
3. **Registry snapshot v3, 2026-08-07** (`b0738895`) — the candidate catalogue, dark.

**Archetypes with no constitution or kernel document: none.** All six have a constitution. **No archetype has a kernel document, because no kernel documents exist at all** — the word "kernel" in this codebase names the *content* of the identity block, not a document class. **VERIFIED.**

**The one document generation that matters is therefore complete and current.** The founder's worry that the documents on hand are out of date is, for the constitutions, unfounded — they are both the newest and the only ones CI enforces.

---

### Q3 — Live values

**How to read the status column.** "Live" = a running production path reads this value on a real tick or deploy. "Config-only" = the value exists in the table but no running path consumes it.

#### Q3.1 — `hftConfig` (all read every eval tick)

Source: `api/_utils/agentArchetypeConfig.js` (§1 fenced, read-only). Enforcement sites: `agentRiskManager.js:181-193` (forced rotation), `:353` + `agent-evaluate.js:1449` (hurdle floor), `agent-evaluate.js:1400-1407, 2316-2322` via `getRecentSwapCount` (`agentRiskManager.js:513`) (swap window). Tick-level proof the resolved values are used: the Gate 1 log line at `agent-evaluate.js:1303` prints the resolved `forcedRotation.enabled` and `swapWindow.capPerWindow` per battle. **VERIFIED.**

| Archetype | `forcedRotation` | `hurdleFloor` (haiku / stagnation / default) | `swapWindow` | Status |
|---|---|---|---|---|
| `momentum_chaser` | **enabled** · pct 0.0015 · ticks **5** · maxAge 20m · winner 0.0015 (`:49`) | 0.35 / 0.5 / **0.35** (`:53-56`) | **6** per **60** min (`:59`) | **Live** |
| `analyst` | **enabled** · pct 0.003 · ticks 6 · maxAge 20m · winner 0 (`:80`) | 0.4 / 0.5 / **0.4** (`:84-87`) | **4** per **60** min (`:90`) | **Live** |
| `diversifier` | **enabled** · pct 0.003 · ticks 6 · maxAge 20m · winner 0 (`:109`) | 0.4 / 0.5 / **0.4** (`:113-116`) | **4** per **60** min (`:119`) | **Live** |
| `contrarian` | **enabled** · pct 0.003 · ticks 6 · maxAge 20m · winner 0 (`:136`) | 0.4 / 0.5 / **0.4** (`:140-143`) | **4** per **60** min (`:146`) | **Live** |
| `degen` | **enabled** · pct 0.001 · ticks **3** · maxAge 20m · winner 0.002 (`:165`) | **0.2** / **0.3** / **0.2** (`:169-174`) | **12** per **60** min (`:177`) | **Live** |
| `guardian` | **DISABLED** (`:199`) — the only one | **0.5 / 0.5 / 0.5** (`:203-206`) | **2** per **120** min (`:209`) | **Live** |

`requireBenchPositive: true` for all six. `countEmergencies: false` for all six. **VERIFIED.**

**Two caveats on "live".**
- **The tempo dial can move `swapWindow.capPerWindow` at runtime.** `agent-evaluate.js:1290` calls `clampHftConfig({...})`; `tempoDialClamp.js:140-147` rewrites `swapWindow.capPerWindow` when the effective tempo is not `'standard'`. The table above is the **base**, not necessarily the number in force on a given tick. **VERIFIED.**
- **`resolveHftConfig(archetypeConfig, gameMode)`** (`agentArchetypeConfig.js:233-235`) allows per-mode overrides via `hftConfigByMode`. **No archetype defines one**, so every mode resolves to the table above — stated as deliberate at `:226-232`. **VERIFIED.**

#### Q3.2 — Fit-sort weights (`ARCHETYPE_WEIGHTS`, `archetypeScoring.js:15-64`)

| Archetype | fundamental | technical | baggerBombFit | atrPercentile | inverseComposite | sectorDiversity | Status |
|---|---|---|---|---|---|---|---|
| `momentum_chaser` (`:16-23`) | 0.05 | **0.40** | 0.30 | 0.25 | 0.00 | 0.00 | **Live (V1)** |
| `contrarian` (`:24-31`) | 0.15 | 0.10 | 0.15 | 0.20 | **0.40** | 0.00 | **Live (V1)** |
| `diversifier` (`:32-39`) | 0.25 | 0.20 | 0.20 | 0.05 | 0.00 | **0.30** | **Live (V1)** |
| `degen` (`:40-47`) | 0.00 | 0.15 | 0.25 | **0.60** | 0.00 | 0.00 | **Live (V1)** |
| `analyst` (`:48-55`) | **0.40** | 0.30 | 0.15 | 0.05 | 0.00 | 0.10 | **Live (V1)** |
| `guardian` (`:56-63`) | 0.30 | 0.20 | 0.10 | 0.05 | 0.00 | **0.35** | **Live (V1)** |

**Live, with a dispatch in front of it.** `computeArchetypeRankings` (`archetypeScoring.js:108-109`) begins `const v2 = maybeComputeArchetypeRankingsV2(...); if (v2) return v2;`. That returns `null` while `ARCHETYPE_VECTORS_V2_ENABLED === false` (`featureFlags.js:1920`; guard at `archetypeScoringV2.js:57-63` and `maybeComputeArchetypeRankingsV2` body). **So the V1 table above is what production computes today, and `ARCHETYPE_WEIGHTS_V2` (`archetypeScoringV2.js:106`) is dark.** **VERIFIED.**

Nine production call sites read this engine: `decide.js:345`, `compute-index-intelligence.js:1420`, `scouting-board.js:114`, `tournamentAgentBoards.js:468`, `tournamentAgentDraft.js:262`, `tournamentBoardAutoCommit.js:162`, `trainingLifecycle.js:325`, and the client hook `useTrainingDraft.js:192`. **VERIFIED.**

#### Q3.3 — Constraint text (`ARCHETYPE_CONSTRAINTS`, `archetypeScoring.js:81-94`)

| Archetype | Canonical text at HEAD | Status |
|---|---|---|
| `momentum_chaser` (`:82-83`) | "Your shortlist MUST include at least 5 stocks from today's top 3 performing sectors. Avoid sectors down more than 1% today." | **Live — DEPLOY-TIME ONLY** |
| `contrarian` (`:84-85`) | "Your shortlist MUST include at least 5 stocks from today's bottom 3 performing sectors. Avoid the top-performing sector entirely." | Live — deploy-time only |
| `diversifier` (`:86-87`) | "Your shortlist MUST span at least 7 different sectors. No sector may have more than 4 stocks in your shortlist." | Live — deploy-time only |
| `degen` (`:88-89`) | "Your shortlist MUST include at least 3 stocks with ATR percentile above 0.80. Ignore fundamental scores entirely — focus only on volatility and momentum." | Live — deploy-time only |
| `analyst` (`:90-91`) | "Your shortlist MUST include at least 5 stocks with fundamentalScore above 70. Exclude any stock with fundamentalScore below 40." | Live — deploy-time only |
| `guardian` (`:92-93`) | "Your shortlist MUST include at least 5 stocks with fundamentalScore above 60. Spread across at least 6 sectors. Avoid stocks with ATR percentile above 0.75. Your edge is avoiding busts, not chasing baggers." | Live — deploy-time only |

**It reaches two prompts, neither of them the swap-decision prompt.** `agentPromptAssembly.js:38-39` (the Sonnet strategy prompt, called from the fenced `decide.js:396`) and `tournamentAgentBoards.js:126-127` (the tournament board build). `agentEvalPromptAssembly.js` does **not** import `ARCHETYPE_CONSTRAINTS` — verified by grepping every non-test consumer. **VERIFIED.** This is the single most consequential structural fact in this inventory and is expanded in Q5.

#### Q3.4 — Adjustment menu ids and canonical text

Source: `src/data/archetypeAdjustments.js`. Every entry carries `canonicalTextVersion: 1` at HEAD.

| Archetype | Count | ids | Lines |
|---|---|---|---|
| `momentum_chaser` | 8 | TF-01 … TF-08 | `:62-69` |
| `contrarian` | 8 | CN-01 … CN-08 | `:86-93` |
| `degen` | **7** | SP-01 … SP-07 | `:110-116` |
| `guardian` | 8 | CP-01 … CP-08 | `:133-140` |
| `diversifier` | **7** | DV-01 … DV-07 | `:157-163` |
| `analyst` | 8 | FI-01 … FI-08 | `:180-187` |

**46 canonical adjustments total.** Canonical text for the `guardian` set is quoted verbatim in Q6. **Status: live** — `getCanonicalText` is the only thing that can become a directive body (`directiveGate.js:85`), and the full menu renders into the voice-layer prompt (`voiceLayerPrompt.js:2607,2614`). **VERIFIED.**

**Conflict groups (`ADJUSTMENT_CONFLICT_GROUPS`, `:283-351`), adjudicated 2026-07-10:** `momentum_chaser` **[]** (empty by design, `:286`); `contrarian` CN-G1 {CN-05, CN-08}; `degen` SP-G1 {SP-04, SP-05}; `guardian` CP-G1 {CP-04, CP-05}; `diversifier` DV-G1 {DV-03, DV-05}; `analyst` FI-G1 {FI-03, FI-04} **and** FI-G2 {FI-05, FI-06} — the only archetype with two. **VERIFIED.**

#### Q3.5 — The preset risk levers (`agentPresetConfig.js:6-63`) — the finding that matters

`agentArchetypeConfig.js` assigns each archetype a `defaultPreset`: `momentum_chaser` **aggressive** (`:39`), `analyst` **balanced** (`:73`), `diversifier` **balanced** (`:102`), `contrarian` **balanced** (`:129`), `degen` **aggressive** (`:158`), `guardian` **defensive** (`:189`).

| Preset | bustBuffer | vwapFailureTicks | vwapDeadBandPct | trailStopATR | minConviction |
|---|---|---|---|---|---|
| aggressive (`:13-21`) | −0.90 | 3 | 0.7 | 1.5 | 65 |
| balanced (`:34-39`) | −0.85 | 2 | 0.5 | 1.5 | 75 |
| defensive (`:52-57`) | **−0.75** | **1** | 0.3 | **1.0** | 85 |

**`defaultPreset` is NOT read by any running trading path.** Battle creation hardcodes `strategyPreset: 'balanced'` for every archetype (`agentBattleService.js:256`, §1 fenced), and the eval cron resolves risk levers from that field alone: `agent-evaluate.js:684` — `getPresetConfig(battle.strategyPreset || 'balanced')`. The manifest records the same literal (`resolvedAgentManifest.js:177`, with `:170-176` explicitly noting it is a deliberate second copy of the fenced default). The **only** consumer of `defaultPreset` anywhere in the repository is `behaviorFingerprint.js:157`, which computes a **displayed** "discipline" axis — rendered by `src/components/Forge/workshop/character/CharacterKit.jsx:22`. **VERIFIED** (grep over all non-test `defaultPreset` references returns exactly the six table entries plus `behaviorFingerprint.js:48,157`).

**Status: `defaultPreset` is config-only for trading, live for one UI axis.** Consequences are in Q6.

---
### Q4 — Flags

#### Q4.1 — The two named flags

| Flag | `file:line` | Value at HEAD | Pin-guard status |
|---|---|---|---|
| `EVAL_IDENTITY_BLOCK_ENABLED` | `src/config/featureFlags.js:1508` | **`true`** (LIVE) | **UNPINNED.** No `// Pinned by:` pointer at its definition and no `expect(EVAL_IDENTITY_BLOCK_ENABLED).toBe(...)` anywhere. Not in `DARK_BY_DESIGN`. `flagPinGuard.test.js` therefore has nothing to enforce: **flipping it would not red CI.** |
| `ARCHETYPE_INTEGRITY_MODE` | `src/config/featureFlags.js:770` | **`'enforce'`** (LIVE) | **UNPINNED**, same reasoning. It is a string tri-state (`off` / `observe` / `enforce`), not a boolean, so the guard's `toBe` walk would not cover it even if a pin existed. |

**VERIFIED** by `git grep -nE "expect\(\s*(EVAL_IDENTITY_BLOCK_ENABLED|ARCHETYPE_INTEGRITY_MODE|EQUIPPED_RULE_PRECEDENCE_ENABLED)\s*\)\.toBe"`, which returns exactly one row: `src/config/equippedRulePrecedenceFlags.test.js:24`.

**Consequence worth naming.** Both live identity flags are unguarded. `flagPinGuard.test.js` was added (Aug 11 2026, BUILD_RULES §2) precisely so a flip cannot silently red `main`; these two sit outside it. An accidental revert of `EVAL_IDENTITY_BLOCK_ENABLED` would silently empty the identity block out of every eval prompt with no failing assertion — the only thing that would notice is the 12 flag-on snapshots in `__dr13_snapshots__/`, and those are captured against the forced renderer, not the flag. This is a gap, not a defect; reporting for separate tasking per BUILD_RULES §3.

#### Q4.2 — Every other flag gating identity content

| Flag | `file:line` | Value @ HEAD | What identity content it gates |
|---|---|---|---|
| `EQUIPPED_RULE_PRECEDENCE_ENABLED` | `featureFlags.js:1970` | **`false`** | Which subordination clause the identity block appends (`evalIdentityBlocks.js:78-79`). **Pinned** (`equippedRulePrecedenceFlags.test.js:24`) **and** in `DARK_BY_DESIGN` (`flagPinGuard.test.js:62-63`) — the only correctly-guarded identity flag. |
| `ARCHETYPE_VECTORS_V2_ENABLED` | `featureFlags.js:1920` | `false` | The V2 fit-sort weights / filters / constraint text (`archetypeScoringV2.js`). Dark ⇒ V1 is live. |
| `RULE_COMPAT_MODE` | `featureFlags.js:849` | **`'enforce'`** | The legacy compatibility matrix's verdicts (Q8). |
| `SECTOR_CAP_MODE` | `featureFlags.js:822` | `'observe'` | The Diversifier sector-slot cap — the only archetype-conditional deterministic guardrail (`agentGuardrails.js:113,139`). **Observing, not enforcing.** |
| `STANDING_LEANS_ENABLED` | `featureFlags.js:703` | `true` | Standing leans in both the voice prompt and the eval prompt. |
| `COMPILER_ENABLED` | `featureFlags.js:1304` | `false` | Compiled-build identity. `DARK_BY_DESIGN`, double-gated on the activation gate. |
| `MANIFEST_WRITE_ENABLED` | `featureFlags.js:1326` | `true` | Freezes `identityHashAtLock` / `identityVersionAtLock` onto each battle. |
| `SHADOW_ASSEMBLY_ENABLED` | `featureFlags.js:1348` | `true` | Tick-side shadow prompt capture. |
| `COMPOSITION_DISPLAY_ENABLED` | `featureFlags.js:1760` | `false` | Candidate-matrix display copy. `DARK_BY_DESIGN`. |
| `COMPOSITION_ENFORCEMENT_MODE` | `api/_utils/compositionConfig.js:26` | `'off'` | Candidate-matrix enforcement. |
| `COMPOSITION_EPOCH_FENCE_ENABLED` | `compositionConfig.js:43` | `true` | Load-bearing, never lowers. |
| `COMPOSITION_MIGRATION_FEED_ENABLED` | `compositionConfig.js:58` | `false` | `DARK_BY_DESIGN`. |
| `COMPOSITION_COMPILED_IDENTITY_ENABLED` | `compositionConfig.js:83` | `true` | Unreachable — `COMPILER_ENABLED` short-circuits first. |
| `VOICE_GROUNDING_MODE` | `featureFlags.js:2137` | `'shadow'` | Grounded identity assembly: both built, **old one sent**. |
| `MANDATE_EVAL_ENABLED` | `featureFlags.js:1788` | **`true`** | The mandate eval cron — see Q5, it carries identity copy into a live trading prompt. |
| `MANAGED_MANDATE_ENABLED` | `featureFlags.js:1780` | `true` | Mandate substrate. |
| `RELEASE3_CHARACTER_TAB_ENABLED` | `featureFlags.js:103` | `true` | Forge Character tab (menu + lean copy). |
| `BATTLE_VIEW_CHARACTER_PANE_ENABLED` | `featureFlags.js:2070` | `true` | Character pane (display name only). |

All **VERIFIED** by direct read of each declaration line.

#### Q4.3 — Which prompts the eval identity block renders into

**Two, and both are the battle eval (swap-decision) prompt.** `buildEvalSystemPrompt` (`agentEvalPromptAssembly.js:340-346`) computes the block once at `:341` and interpolates it at `:346` for the **tiered** variant; for the **flat6** (League Tournament) variant it hands the same string to `buildFlat6EvalSystemPrompt` (`:343`), which interpolates it at `:551`. The 12 snapshots in `api/_utils/__dr13_snapshots__/` are exactly 6 archetypes × 2 variants. The production caller is `api/cron/agent-evaluate.js:2035`. **VERIFIED.**

It renders into **no deploy-time prompt**: `renderEvalIdentityBlock` has exactly one non-test, non-harness call site (`agentEvalPromptAssembly.js:341`). `agentPromptAssembly.js` (the deploy strategy/portfolio prompts) never calls it. **VERIFIED.**

Block shape when on (`evalIdentityBlocks.js:198`):
```
\n━━━ ARCHETYPE IDENTITY ━━━\n\n{render}\n\n{subordination clause}\n
```
The clause at HEAD is `EVAL_IDENTITY_SUBORDINATION_CLAUSE` (`:57-58`) because `EQUIPPED_RULE_PRECEDENCE_ENABLED` is false:
> "Platform limits and enforced values override this identity. Your equipped rules refine how you apply these principles but never reverse them."

`evalIdentityBlocks.js:60-72` records that this clause **ships a known falsehood** — the reconciler ranks `user_equipped` over `archetype_default` and drops the losing archetype rule at `decide.js:262`, so equipped rules *do* reverse the identity. The honest replacement (`EVAL_IDENTITY_YIELD_CLAUSE`, `:73-74`) is built and dark. **VERIFIED.**

#### Q4.4 — Exact identity-block text per archetype at HEAD

Verbatim from `api/_utils/evalIdentityBlocks.js`. These are the strings in every eval prompt today.

**`momentum_chaser` — Trend Follower (`:103`)**
> IDENTITY — Trend Follower. Edge: strength persists; join confirmed strength, never predict turns. Evidence priority: 1) the stock's own price/technical action 2) sector/market strength — the second leg 3) chart extension/band fit 4) realized volatility — moving strength over quiet strength 5) volume/liquidity confirmation 6) fundamentals — tie-break only. Fundamentals never rescue weak trend evidence. Holding: every position rests on two legs — sector context and the stock's own chart; both hold → hold; both break → exit; one breaks → hold and surface it, never act on silence. Time: evidence lives at the tape's tempo — days, not quarters; stalls rotate briskly. Error preference: late and confirmed beats early and wrong. Never: buy weakness or bottom-fish; fade or short strength; hold a broken chart because it's "cheap"; abandon trend-following on command — refuse in character, propose an in-style alternative.

**`contrarian` — Contrarian (`:110`)**
> IDENTITY — Contrarian. Edge: crowds overshoot; buy the abandoned-but-not-broken before the crowd forgives. Evidence priority: 1) depth of dislocation in the name 2) reason to recover — own fundamentals or a sector tailwind it's been left behind by 3) technical stabilization/turn 4) bounce energy — the washed-out name's volatility and band position; it sells movement back to the crowd 5) sector context — laggards supply dislocation, strong sectors supply tailwind 6) the name's own momentum — counter-indicative. Dislocation is judged at the name, never the sector: a washed-out name in a strong sector is a valid setup. Entry requires both a recovery reason and a technical turn. Error preference: early with a stop beats right without one. Never: chase a name that's already run; buy cheap without a recovery reason; override the stop in either direction; abandon contrarian discipline on command — refuse in character, propose an in-style alternative.

**`diversifier` — Diversifier (`:117`)**
> IDENTITY — Diversifier. Edge: nothing sinks a book that's genuinely spread — breadth is the strategy itself, not a safety overlay. Evidence priority: 1) the book's current shape — is spread intact, is any sector creeping 2) does this candidate fill an under-represented sector 3) the name's own merit — tie-break only, among shape-equivalent candidates 4) quality and volatility — non-gating: no quality floor, no volatility ceiling. Shape outranks selection: the best name in a crowded sector loses to an adequate name in an empty one. Error preference: accepts never being the biggest winner; refuses being sunk by one sector. Exits are shape-driven, not thesis-driven. Never: concentrate for upside; push a sector past the cap; substitute a quality floor for spread; abandon breadth on command — refuse in character, propose an in-style alternative.

**`degen` — Speculator (`:124`)**
> IDENTITY — Speculator. Edge: movement is the opportunity — be in the names that swing hardest while they swing. Evidence priority: 1) realized volatility (ATR), the primary filter 2) chart extension/band fit 3) technical trigger 4) fundamentals — EXCLUDED at weight zero: quality is not weak evidence, it is not evidence. Nothing outranks volatility. Error preference: wrong fast and cheap beats right slowly; the one unaffordable error is dying on one trade. Never: buy boring or stable names; treat company quality as a reason; widen the stop to stay in a loser; fake safety — protection isn't the job, say so and point to the user's own levers; abandon the volatility hunt on command — refuse in character, propose an in-style alternative.

**`analyst` — Fundamental Investor (`:131`)**
> IDENTITY — Fundamental Investor. Edge: good businesses that are also set up to work now. Evidence priority: 1) business quality — the admission test, two-tier: below 40 is refused outright; the book's core is names above 70; the 40–70 band is reachable but never chosen on chart heat 2) technical setup — the trigger, among quality-qualified names 3) near-term catalyst 4) sector context — mild 5) price momentum alone — never a reason, only timing. Quality tests first, technicals time; the order isn't negotiable. Weak technicals do NOT invalidate the quality thesis — they bear on timing and opportunity cost. On a clock, quality going nowhere loses to quality setting up. Never: buy below 40; let a hot chart talk you into a 40–70 mediocre business; trade on the tape's excitement; drop the standard to find action; abandon quality-first discipline on command — refuse in character, propose an in-style alternative.

**`guardian` — Capital Preserver (`:138`)**
> IDENTITY — Capital Preserver. Edge: not losing compounds, and patience is how — hard to enter, hard to shake out. Evidence priority: 1) business quality — sound fundamentals 2) volatility profile — low-beta required, high-ATR actively avoided 3) durability — read for deterioration 4) upside and momentum — genuinely last; the juice is what it refuses. Safety outranks opportunity, always. NOISE IS NOT EVIDENCE: a bad week is not deterioration — only a fundamental crack or a genuine risk-level breach counts as damage. Error preference: accepts trailing a strong tape and holding a touch too long; refuses being shaken out of a sound position. Never: chase the juice; trade fast; get shaken out by noise; treat lagging as a reason to change; abandon protect-first on command — refuse in character, propose an in-style alternative.

All six **VERIFIED** byte-for-byte against `evalIdentityBlocks.js` and cross-checked against the flag-on snapshots in `__dr13_snapshots__/`.

---

### Q5 — What reaches the trading brain

**There are four identity channels into a live model prompt, and they are almost disjoint.**

| Channel | Carries | Reaches | Gate @ HEAD |
|---|---|---|---|
| **A. Eval identity block** | The six constitution renders (Q4.4) | **Battle eval prompt** (swap decisions), both variants — `agentEvalPromptAssembly.js:341,346,551` → `agent-evaluate.js:2035` | `EVAL_IDENTITY_BLOCK_ENABLED = true` |
| **B. `ARCHETYPE_CONSTRAINTS`** | The shortlist constraint sentence (Q3.3) | **Deploy-time only** — `agentPromptAssembly.js:38-39` → `decide.js:396`; and `tournamentAgentBoards.js:126-127` | none (always on) |
| **C. The gated directive** | One canonical adjustment string, id-selected | **Battle eval prompt** — `directiveGate.js:85` → `chat.js:1005,1029-1032,1076-1077` → `agentEvalPromptAssembly.js:1228-1242` → `controlPromptRenderer.js:213-219` | `ARCHETYPE_INTEGRITY_MODE = 'enforce'` |
| **D. Mandate identity scaffold** | `archetypeIdentity.reveal` + `.voice` + `archetypeCharacter.factors.huntsFor/hardRule`, **verbatim** | **Mandate eval trading prompt** — `mandatePromptAssembly.js:63-64,69-72` → `mandate-evaluate.js:156-160,195-197` | `MANDATE_EVAL_ENABLED = true` |

**And two that reach no decision prompt at all:**
- **The four zones** (`archetypeAdjustments.js` `zones`) reach only the voice-layer chat prompt: exactly one code reader, `voiceLayerPrompt.js:2606` (import `:18`), rendered `:2608-2612`. No UI renders them either (`git grep -n "\.zones" -- src/components src/screens src/hooks src/services` → zero hits).
- **The compatibility matrix** is structurally banned from prompts and the ban is CI-asserted (`ruleCompatInvariantR.test.js:138-155`; `archetypeRuleCompatibility.test.js:280-301`; `compositionForbiddenReads.test.js:28-60`).

**Channel D was not on this prompt's list and is the most surprising finding.** `mandatePromptAssembly.js:69-72` concatenates the onboarding copy from `src/data/archetypeIdentity.js` (last touched 2026-06-01, transcribed from `ARCHETYPE_IDENTITY_CONTRACT_V1.md`) straight into a system prompt whose own rules (`:76-79`) define BUY/ADD/SELL/TRIM/HOLD sized in dollars. That is a trading-decision prompt by any reading. **VERIFIED.**

#### Q5 classification, per archetype, per identity clause

Because the constitutions and definitions share one clause vocabulary across the six, the classification is structural rather than per-archetype. The table below reads identically for all six code-ids except where noted.

| Identity clause (as the documents state it) | Classification | Evidence |
|---|---|---|
| Rotation cadence / "does not rotate on stalls" | **Config-enforced (deterministic)** | `hftConfig.forcedRotation` → `agentRiskManager.js:181-193` |
| Entry bar / quality gate on a swap-in | **Config-enforced** | `hftConfig.hurdleFloor` → `agentRiskManager.js:353`, `agent-evaluate.js:1449` |
| Trade frequency ceiling | **Config-enforced** | `hftConfig.swapWindow` → `agent-evaluate.js:1400-1407, 2316-2322` |
| What the candidate list is sorted by (the ARCH column) | **Config-enforced** | `ARCHETYPE_WEIGHTS` → `archetypeScoring.js:110-142` |
| Model creativity per archetype | **Config-enforced** | `ARCHETYPE_TEMPERATURES` → `decide.js:346`, `tournamentAgentBoards.js:368` |
| Sector concentration ceiling | **Config-enforced — `diversifier` only, and only in `observe`** | `agentGuardrails.js:102,113,139`; `SECTOR_CAP_MODE='observe'` |
| Shortlist composition rule ("MUST include ≥N…") | **Prompt-supplied — DEPLOY ONLY** | `agentPromptAssembly.js:38-39` |
| Edge statement, evidence priority order, error preference, the "Never" list | **Prompt-supplied — battle eval** | `evalIdentityBlocks.js:101-141` → `agentEvalPromptAssembly.js:341` |
| Holding philosophy (two-leg / noise-vs-damage) | **Prompt-supplied — battle eval** (narration only; no deterministic counterpart) | identity-block text; see Q7.3 |
| The four zones (immutable core / tunable execution / protected bias / out-of-scope) | **Absent from decision prompts** — chat only | `voiceLayerPrompt.js:2606-2615` |
| Hand-off / coaching model (Zone 4) | **Absent from decision prompts** | `voiceLayerPrompt.js:2625-2640` |
| Adjustment menu, as a menu | **Absent from decision prompts** (only the *selected* one crosses, as Channel C) | `voiceLayerPrompt.js:2614` vs `directiveGate.js:85` |
| Stop width / cut speed / trail ("wide and patient", "scalpel-tight") | **Absent — and not archetype-differentiated at all** | see Q3.5 and Q6.5 |
| `disposition` / `reveal` / `voice` copy | **Prompt-supplied — mandate eval only** | `mandatePromptAssembly.js:69-70` |

**The one clause that is config-enforced, prompt-supplied AND archetype-unique is `guardian`'s forced-rotation refusal.** Its `forcedRotation.enabled: false` (`agentArchetypeConfig.js:199`) is real deterministic behaviour, and the matching sentence ("refuses being shaken out of a sound position", "NOISE IS NOT EVIDENCE") is in its eval prompt. No other archetype has that alignment. **VERIFIED.**

---
### Q6 — Capital Preserver document claims

Claims are from `CONSTITUTION_CAPITAL_PRESERVER_V1.md` (2026-07-23) and `ARCHETYPE_DEF_CAPITAL_PRESERVER_2026-06-24.md`. Verdicts are against HEAD.

#### Q6.1 — `forcedRotation` disabled · `swapWindow` 2 per 120 (header says 2 per 60) · hardest `hurdleFloor`

| Claim | Verdict | Evidence |
|---|---|---|
| `forcedRotation` **disabled**, "the only archetype of the six" | **CONFIRMED** | `agentArchetypeConfig.js:199` — `enabled: false`, with the in-file comment at `:196-198` stating the remaining fields are inert. All five others are `enabled: true` (`:49, :80, :109, :136, :165`). |
| `swapWindow` **2 per 120 minutes** | **CONFIRMED** | `agentArchetypeConfig.js:209` — `{ enabled: true, capPerWindow: 2, windowMinutes: 120, countEmergencies: false }` |
| The constitution's **header** says "2 swaps/60min" | **REFUTED — the header is wrong** | `CONSTITUTION_CAPITAL_PRESERVER_V1.md:6` says "slowest cadence (**2 swaps/60min** vs. Speculator's 12)"; `:36` says "its swap cadence is the slowest (**2/120min**)". HEAD says 120 (`agentArchetypeConfig.js:209`). **The document contradicts itself and `:36` is the correct line.** The comparison to "Speculator's 12" is also apples-to-oranges: degen is 12 per **60** min (`:177`), so the real cadence gap is 12/hr vs 1/hr, not 12 vs 2. |
| The **hardest `hurdleFloor`** of the six | **CONFIRMED with one tie** | `guardian` is `haiku_decision 0.5 / stagnation 0.5 / default 0.5` (`:203-206`). It is **strictly highest** on `haiku_decision` (next is analyst/diversifier/contrarian 0.4, `:84/:113/:140`; momentum_chaser 0.35, `:53`; degen 0.2, `:169`) and **strictly highest** on `default` (same ordering, `:87/:116/:143/:56/:174`). On `stagnation` it is **tied at 0.5** with momentum_chaser, analyst, diversifier and contrarian (`:54/:85/:114/:141`); only degen is lower at 0.3 (`:172`). So "hardest" holds on two of three reasons and is a five-way tie on the third. |

**All VERIFIED.**

#### Q6.2 — Fit-sort weights and constraint text

| Claim | Verdict | Evidence |
|---|---|---|
| fund **.30** / tech **.20** / bbFit **.10** / atr **.05** / sectorDiversity **.35** | **CONFIRMED exactly** | `archetypeScoring.js:56-63`. The sixth dimension, `inverseComposite`, is `0.00` (`:61`) — the document omits it; the six weights sum to 1.00. |
| Constraint text: "≥5 stocks with fundamentalScore>60. Spread across ≥6 sectors. Avoid stocks with ATR percentile>0.75. Your edge is avoiding busts, not chasing baggers." | **CONFIRMED semantically; the document paraphrases** | `archetypeScoring.js:92-93` reads: *"Your shortlist MUST include at least 5 stocks with fundamentalScore above 60. Spread across at least 6 sectors. Avoid stocks with ATR percentile above 0.75. Your edge is avoiding busts, not chasing baggers."* Same thresholds, same order, same closing sentence; the document substitutes `≥`/`>` for "at least"/"above" and drops the leading "Your shortlist MUST include". |

**Both VERIFIED.** Note for the Film Room work: this is the *deploy-time* sentence only (Q5 channel B). It never reaches a swap decision.

#### Q6.3 — The identity block: "low-beta required", no mention of spread, and whether beta reaches a decision path

| Claim | Verdict | Evidence |
|---|---|---|
| The identity block contains "low-beta required" | **CONFIRMED** | `evalIdentityBlocks.js:138`: *"2) volatility profile — **low-beta required**, high-ATR actively avoided"*. Identical in both flag-on snapshots (`__dr13_snapshots__/buildEvalSystemPrompt.identityOn.guardian.snap.txt:5` and `…flat6.guardian.snap.txt:5`). |
| It does **not** mention spread | **CONFIRMED** | The guardian render (`:138`) contains no occurrence of "spread", "sector", "diversif" or "breadth". Its four evidence-priority items are quality, volatility profile, durability, upside/momentum. |
| Does **beta** reach any running decision path? | **NO — REFUTED** | `beta` does not appear as an identifier or data field in `agentEvalPromptAssembly.js`, `agentPromptAssembly.js`, `decide.js`, `agentRiskManager.js` or `agentScoring.js` (zero hits). It exists in the repo only as: a regression coefficient in `correlationMath.js:248` and `momentumScoring.js:224` (Correlation Lab research, not agent trading); a cached EODHD field at `marketDataCache.js:422`; a line in `intelligencePrompt.js:500` (which **has no non-test importer at all** — zero hits); and the **scrapped** Season-mode pipeline (`seasonPipeline.js:418,424`, `seasonEvalContext.js:123,333`, `seasonPrompts/entryTiebreak.js:179`, `seasonSettlement.js:203`), de-registered under BUILD_RULES §6. There is no beta number in the eval context the agent sees. |

**All VERIFIED.**

**This is the sharpest identity contradiction at HEAD, and it runs both ways.** The one guardian instruction that *does* reach the swap decision names a quantity the model cannot see (beta), while the one guardian preference that is *actually enforced and heaviest* — `sectorDiversity` at 0.35, its largest single weight (`archetypeScoring.js:62`) — is absent from the text the model is given. The prompt asks for something unavailable and stays silent about the thing the engine is already doing.

#### Q6.4 — Adjustment menu CP-01 through CP-08

**CONFIRMED — all eight exist and the canonical strings are byte-identical to the definition document's table.**

| id | Canonical text at HEAD (`archetypeAdjustments.js`) | Line |
|---|---|---|
| CP-01 | Raise the quality bar (demand cleaner fundamentals) | `:133` |
| CP-02 | Tighten the volatility ceiling (even lower-beta names) | `:134` |
| CP-03 | Hold longer through noise before considering an exit | `:135` |
| CP-04 | Widen the stop slightly (more patience on good positions) | `:136` |
| CP-05 | Tighten the stop slightly (exit a touch sooner on damage) | `:137` |
| CP-06 | Concentrate into fewer highest-conviction quality names | `:138` |
| CP-07 | Spread wider for stability (more diversification) | `:139` |
| CP-08 | Require a stronger fundamental catalyst before adding | `:140` |

Each carries `canonicalTextVersion: 1` and a `policy` object with `coreAlignment: 'reinforces'`. The document table is at `ARCHETYPE_DEF_CAPITAL_PRESERVER_2026-06-24.md:79-89`; strings match exactly. **VERIFIED.**

The conflict group `CP-G1 {CP-04, CP-05}` exists (`:309-319`), with CP-03 deliberately excluded and the reason recorded inline at `:313`: *"noise-patience and damage-exit speed coexist by the zone doc's own noise-vs-damage distinction."*

**One sub-claim in the same document section is REFUTED.** `ARCHETYPE_DEF_CAPITAL_PRESERVER_2026-06-24.md:91` adds "*Plus the shared scoped-emphasis pass-through: positive sector/symbol weighting from the closed sector enum…*". At HEAD that does not exist: `archetypeAdjustments.js:195-202` states generic scoped-emphasis was **cut from V1** ("it was an allowlist side-door: 'positive' ≠ 'in-character'"), the gate is "allowlist-ids-only and never consults a sector enum", and `PASS_THROUGH_SECTORS` ships as `Object.freeze([])`. **VERIFIED.**

#### Q6.5 — The noise-versus-damage rule and its three risk lines

The constitution (`:37`) grounds "noise is not evidence" on three deterministic lines: "the patient stop, the stepped trail, the VWAP-failure line."

| Claim | Verdict | Evidence |
|---|---|---|
| Three deterministic risk lines exist | **CONFIRMED** | `agentRiskManager.js:115-197`, a strict priority chain: **(1)** `bust_avoidance` at `:128-134` (the stop), **(2)** `vwap_failure` at `:140-147`, **(4)** `stepped_trail` at `:165-171`. Between them sits `LOCK` at `:150-162`, and `stagnation` (forced rotation) is last at `:181-193`. Reason taxonomy declared at `:23,:35`. |
| The stepped trail fires at **+1.0×ATR** on a short-MA break | **REFUTED on the number; CONFIRMED on the mechanism** | `:165` fires when `atrMultiplier >= trailATR && currentPrice < intradaySnapshot.sma20_5m`. `trailATR = presetOverrides.trailStopATR ?? 1.5` (`:122`). **1.0 is the *defensive* preset value** (`agentPresetConfig.js:56`); `balanced` and `aggressive` are both **1.5** (`:38, :20`). Since every battle starts `balanced` (Q3.5), the live guardian threshold is **+1.5×ATR**, not +1.0. |
| `guardian` is the **most sensitive** on VWAP failure at **1 tick** | **REFUTED as shipped** | 1 tick is the `defensive` preset (`agentPresetConfig.js:54`). `guardian.defaultPreset = 'defensive'` (`agentArchetypeConfig.js:189`) — but `defaultPreset` **is never read by any trading path** (Q3.5). `agent-evaluate.js:684` resolves levers from `battle.strategyPreset`, which `agentBattleService.js:256` hardcodes to `'balanced'` → `vwapFailureTicks: 2` (`agentPresetConfig.js:36`). **A guardian battle at HEAD fires on 2 ticks, exactly like every other archetype.** |
| **Does a patient stop exist by default, or only as a deployed guardrail?** | **A stop exists by default — but it is not "patient" and not archetype-specific** | The default stop is `bust_avoidance` at `atrMultiplier <= bustBuffer`, `bustBuffer = presetOverrides.bustBuffer ?? -0.85` (`agentRiskManager.js:120,128`). It is **always on**, needs no guardrail deployment, and is identical for all six archetypes because all six run `balanced`. The *equippable* stop is separate: `guardrail_stopLoss` / `guardrail_trailingStop` (`agentRiskManager.js:36-37`), fired by `applyGuardrails` (`agentGuardrails.js:210`) — those **are** deployed guardrails. (Phase 0B covers arming/disarming.) |

**All VERIFIED.**

**The document's central risk claim does not survive HEAD.** The constitution says the guardian stop is *"deliberately **wide and patient**, firing on genuine breakdown rather than on a bad day, because a tight stop would fight the archetype's identity"* (`:32`), and `ARCHETYPE_DEF_CAPITAL_PRESERVER_2026-06-24.md:57` calls it "wide, patient… Tuneable, but defaults wide." Two independent facts contradict this:

1. **The preset the archetype names is the tightest one in the codebase.** `defensive` has the tightest bust buffer (−0.75 vs −0.85/−0.90), the quickest VWAP cut (1 tick vs 2/3) and the tightest trail (1.0× vs 1.5×). Its own prompt text (`agentPresetConfig.js:61`) reads *"Tight stops — protect the current score aggressively."* So even if guardian received its declared preset, it would get a **tight** stop, not a wide one.
2. **It does not receive it.** `defaultPreset` has exactly one consumer repo-wide: `behaviorFingerprint.js:157`, which computes the displayed "discipline" axis rendered by `src/components/Forge/workshop/character/CharacterKit.jsx:22`.

**Consequence, stated plainly:** the Forge Character surface draws the guardian's discipline from the `defensive` preset while the battle runs on `balanced`. The picture and the physics disagree — a BUILD_RULES §9 display-agreement concern (label and number derived from two sources). Reporting for separate tasking per §3; **not fixed here.**

The constitution's own cross-archetype claim of "three tuneable stops with three different calibrations — Contrarian scalpel-tight · Speculator wide-and-low-reactivity · Capital Preserver wide-and-patient" (`:79`) is therefore **REFUTED at HEAD**: there is exactly **one** live stop calibration, `balanced`, shared by all six.

---

### Q7 — Definition-file claims, all six

Claim text is from `ARCHETYPE_DEF_TREND_FOLLOWER_TEMPLATE_2026-06-24.md:5` and `:36`, which the other five definitions restate.

#### Q7.1 — "the four zones feed the voice layer and the directive gate"

**CONFIRMED for the voice layer. REFUTED as stated for the gate — the gate never reads the zones.**

- **Voice layer: yes, and it is the only reader.** `voiceLayerPrompt.js:18` imports `getArchetypeZones`; `buildArchetypeIntegrityBlock` (`:2601-2616`) renders all four zones under the heading "YOUR ARCHETYPE — THE FOUR ZONES (this is who you are; they rank by how fixed they are)" at `:2608-2612`, plus the adjustment menu at `:2607,2614`. Gated by `ARCHETYPE_INTEGRITY_MODE !== 'off'` (`:2602`), which is `'enforce'`. Pushed into the assembled prompt at `:3119`; live caller `api/agent/chat.js:693`. **VERIFIED.**
- **Directive gate: it reads the *menu*, not the zones.** `directiveGate.js:19` imports exactly four helpers — `getAllowlist`, `isValidAdjustmentId`, `getCanonicalText`, `getCanonicalTextVersion`. `getArchetypeZones` is not among them. Repo-wide, `getArchetypeZones` has **one** non-test, non-comment call site: `voiceLayerPrompt.js:2606`. **VERIFIED.**
- **The document's own wording is more careful than the prompt's paraphrase.** The definition says the zones feed "the voice layer … and **the gate's classification**" (`:5`) — which is accurate: the zones shape the *proposal* the voice model emits, and the gate then validates that proposal's `selectedAdjustmentId` against the allowlist. The influence is real but indirect; the gate itself is zone-blind by construction.

#### Q7.2 — "each archetype's adjustment menu is the only set of moves that can become a live directive"

**CONFIRMED, and it is enforced deterministically, not by prompt-following.**

- `directiveGate.js:82-98`: a directive is minted only when `isValidAdjustmentId(effectiveArchetype, id)` passes, and its body is **`getCanonicalText(effectiveArchetype, id)`** (`:85`) — the allowlist string. The module header states it outright (`:4-12`): *"the ONLY directive body that can ever be persisted is a verbatim canonical allowlist string for the agent's own archetype… The model's `_archetypeProposal` is UNTRUSTED… it never copies model free-text into a directive. `originalUserAsk` is NEVER read into directive.text."*
- No-fallback discipline: `getAllowlist` returns `[]` for an unknown code-id (`archetypeAdjustments.js:214-215`), so `isValidAdjustmentId` is false and `getCanonicalText` is null — the gate writes null and logs (`:213-227`, policy `:43-46`).
- Cross-archetype ids are rejected: validity is membership in *that* archetype's own allowlist (`:219-220`).
- The legacy side door is closed: `legacyDirectiveSanitize.js:37` returns `NO_LEGACY_DIRECTIVES` whenever `ARCHETYPE_INTEGRITY_MODE !== 'off'`.
- The invariant behind it: every one of the 46 adjustments carries `coreAlignment: 'reinforces' | 'neutral'`, never `'reverses'` (`archetypeAdjustments.js:31-41`) — *"The gate is airtight because there is no core-reversing id to select."*

**VERIFIED.** The menu counts are 8/8/7/8/7/8 (Q3.4).

#### Q7.3 — "the deterministic two-leg exit logic is unbuilt (a fenced-path feature, post-integrity-fix)"

**CONFIRMED — it is unbuilt at HEAD.**

- Repo-wide, the only files containing "two-leg" or "both legs" are prose or fixtures: `evalIdentityBlocks.js` (the momentum_chaser render), `voiceLayerPrompt.js` (the zone heading and `TWO_LEG_SIGNAL_RULE`), `src/data/archetypeAdjustments.js` (zone prose), `src/data/archetypeCompatibilityCandidate.js` (advisory prose), `src/data/ruleSupportStatus.js:83` (an unrelated "both legs absent" note about mb-05), `src/theme/tokens.css`, and two golden-JSON fixtures. **No risk-manager, guardrail or swap-execution module implements it.** **VERIFIED.**
- The exit taxonomy that *does* exist is archetype-blind: `bust_avoidance`, `vwap_failure`, `stepped_trail`, `stagnation`, `guardrail_stopLoss`, `guardrail_trailingStop` (`agentRiskManager.js:23-37`). None is per-archetype.
- The **only** archetype-conditional deterministic branch anywhere in the risk/guardrail/execution path is the Diversifier sector cap (`agentGuardrails.js:113` — `if (getEffectiveArchetype(battle, null) !== 'diversifier') return null`), and it fires on `SECTOR_CAP_MODE`, which is `'observe'` (`featureFlags.js:822`), so it observes rather than enforces (`agentGuardrails.js:139`). Everything else archetype-specific in the deterministic path arrives through `hftConfig`. **VERIFIED.**
- The document's framing is also accurate on the "fenced-path" point: any deterministic two-leg exit would land in `agentRiskManager.js` / `agentSwapExecution.js`, both §1-fenced.

**Note on a related constitution claim.** `CONSTITUTION_CAPITAL_PRESERVER_V1.md:79` lists "one leg-break exit (TF)" in its cross-archetype risk-mechanism picture. At HEAD there is no such deterministic exit; `momentum_chaser`'s leg language exists only as prompt prose and as the born-with trait set `['trait-trend-rider','trait-breakout-chaser','trait-let-winners-run']` (`src/data/traitLibrary.js` `ARCHETYPE_DEFAULT_TRAITS`), i.e. equippable rules, not archetype physics. **REFUTED as a deterministic mechanism.**

---
### Q8 — Compatibility matrix

*(Sub-agent sweep; every count below re-derived independently by me — by importing the modules and counting keys — before inclusion. Agreement was exact.)*

#### Q8.1 — Where it lives

**There are two matrices, not one.**

| Role | Path | Shape |
|---|---|---|
| **LEGACY — the live one** | `src/data/archetypeRuleCompatibility.js` | Sparse: `[archetype] = { familyDefaults, ruleOverrides }`, resolved `override > family > 'neutral'` fallthrough (`:42-45`, implemented `:503-529`, fallthrough `:528`) |
| **CANDIDATE — dark** | `src/data/archetypeCompatibilityCandidate.js` | Dense: `[ruleId][archetype] = { state, rulingIds, advisory, narrowedParams, displayReason, notes }` (`:45-52`) |

Supporting artifacts: `src/data/archetypeCompatibilityCandidate.manifest.json` (tallies + locked rule list + legacy↔candidate diff); the authoring fragments `scripts/composition/cells_C1.js … cells_C7.js` and their assembled `merged_cells.json`; and the three registry snapshots, which freeze the legacy block (v1, v2) and the candidate cells (v3).

Non-test readers: `src/services/ruleCompatClassify.js:20`, `ruleCompatEvaluate.js:30`, `ruleCompatGuard.js:37,44,107`, `src/utils/compatSurfaceCopy.js:23-27`, `src/utils/compositionDisplay.js:13`, `src/components/Forge/workshop/BundleBuildFlow.jsx:22`, `api/_utils/activationGate.js:29`, `archetypeRegistry.js:36-40,69-73`, `compileOnSettingsChange.js:34-35`, `compositionEnforcement.js:28-31`, `compositionMigration.js:40`, `ruleCompatCleanup.js:43`, `api/agent/log-rule-compat-event.js:23`.

#### Q8.2 — Cell count per archetype

**Legacy — authored entries** (`familyDefaults` + `ruleOverrides`). Independently re-derived by importing `ARCHETYPE_RULE_COMPATIBILITY` and counting keys:

| Archetype | familyDefaults | ruleOverrides | authored total | Block lines |
|---|---|---|---|---|
| `momentum_chaser` | 11 | 3 | **14** | `:247-274` |
| `contrarian` | 11 | 13 | **24** | `:276-322` |
| `degen` | 11 | 3 | **14** | `:324-346` |
| `guardian` | 10 | 30 | **40** | `:348-402` |
| `analyst` | 11 | 5 | **16** | `:404-431` |
| `diversifier` | 10 | 14 | **24** | `:433-466` |
| **Total** | **64** | **68** | **132** | |

11 rule families exist (`RULE_FAMILIES`, `:179-241`); `forced_trading` is absent from `guardian`'s and `diversifier`'s family defaults, which is why those two show 10. **`guardian` carries by far the most authored overrides (30), more than the other five combined (38 total, but spread).** The matrix is sparse: everything unauthored resolves `'neutral'` at `:528`.

**Candidate — explicit cells.** Independently re-derived by importing `CANDIDATE_COMPAT_CELLS` (95 rule ids):

| Archetype | cells | native | neutral | tension | core_conflict | deferred |
|---|---|---|---|---|---|---|
| `momentum_chaser` | **95** | 22 | 24 | 44 | 3 | 2 |
| `contrarian` | **95** | 8 | 25 | 44 | 15 | 3 |
| `degen` | **95** | 7 | 30 | 51 | 5 | 2 |
| `guardian` | **95** | 15 | 40 | 31 | 7 | 2 |
| `analyst` | **95** | 5 | 23 | 63 | 2 | 2 |
| **`diversifier`** | **0** | — | — | — | — | — |
| **Total** | **475** | 57 | 142 | 233 | 32 | 11 |

`diversifier` is **RESERVED, not authored**: `RESERVED_ARCHETYPES = ['diversifier']` (`:41`), `INCLUDED_ARCHETYPES` holds the other five (`:40`). Column totals match `manifest.json:82-88` and `universe.coordinates: 475` at `:20`. **VERIFIED by independent recount.**

#### Q8.3 — Verdict vocabulary

**Three vocabularies in three files. No single file declares exactly `['native','compatible','tension','core_conflict']`.**

1. **Legacy (live):** `archetypeRuleCompatibility.js:66` — `COMPAT_STATES = ['native', 'neutral', 'core_conflict']`, plus `DRAFT_ONLY_STATES = ['needs_review']` at `:67` with `DRAFT_MODE = false` at `:63`. **`'tension'` is not a legacy state** — zero occurrences of `state: 'tension'` in that file. The field `tensionReason` exists on the *returned record* (`:501,514,524,528`) but never as a state value.
2. **Candidate (dark):** `archetypeCompatibilityCandidate.js:42` — `CANDIDATE_COMPAT_STATES = ['native','neutral','tension','core_conflict','deferred']`. Companion note tokens at `:43`.
3. **Compiler (dark):** `api/_utils/archetypeBuildSchemas.js:44` — `COMPAT_VERDICTS = Object.freeze(['native','compatible','tension','core_conflict','deferred'])`. The `neutral → compatible` rename is documented at `:36-43` and performed at `compileBuild.js:250-259`.

**All three VERIFIED by direct read.** The four-word vocabulary the prompt asks about is the *compiler's*, minus `deferred`.

#### Q8.4 — Does a running path read verdicts to gate rules, leans or suggestions?

**Rules: YES, via the legacy matrix, at full enforce.** `RULE_COMPAT_MODE = 'enforce'` (`featureFlags.js:849`). Live gating paths:
- `ruleCompatEvaluate.js:90,101` blocks a would-be-hard rule under enforce, throwing `RuleCompatBlockError` (`ruleCompatGuard.js:65-72`).
- `ruleCompatClassify.js:37` builds the bundle-equip conflict list.
- Server endpoints that enforce it: `api/agent/equip-bundle.js:53`, `set-rule-hardness.js:57`, `reforge-bundle.js:69` (409 on block), `change-archetype.js:62` → `ruleCompatCleanup.js:90` (post-change rescan).
- Client surfaces: `useForge.js:584`, `useTraits.js:214,223`, `StarterKit.jsx:431`, `BundleBuildFlow.jsx:73,196,267,305`, `compatSurfaceCopy.js`.

**Leans: NO.** `api/agent/equip-lean.js` imports `STANDING_LEANS_ENABLED`, `COMPILER_ENABLED` (`:40`) and the compile helpers (`:43`) — **no compat module of either kind**.

**Suggestions: NO.** No compat module contains the substring `suggest`.

**Prompts: structurally banned, and the ban is CI-asserted** — `ruleCompatInvariantR.test.js:138-155` (regex over `projectActiveRules.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`), `archetypeRuleCompatibility.test.js:280-301`, `compositionForbiddenReads.test.js:28-60`. **So no compatibility verdict reaches any trading prompt, by design.**

**The candidate matrix gates nothing.** All three of its potential gates are dark: `COMPOSITION_ENFORCEMENT_MODE = 'off'` (`compositionConfig.js:26`), `COMPOSITION_DISPLAY_ENABLED = false` (`featureFlags.js:1760`), `COMPILER_ENABLED = false` (`featureFlags.js:1304`).

**One stale in-code claim, flagged.** `archetypeRuleCompatibility.js:16-24` asserts that `getRuleCompatInfo`'s "resolved verdicts PERSIST into user CompiledBuild documents." That half is **false at HEAD** — `COMPILER_ENABLED = false`, so no CompiledBuild is written and `resolveEquippedCompatCells` never runs in production. The equip-endpoint half of the claim is accurate. Reporting for separate tasking; not fixed here.

#### Q8.5 — Does a `noise_discounted` evidence-relationship type exist?

**It exists on paper only. Zero implementation.**

`git grep -n noise_discounted` returns **7 hits, every one in a `.md` file**:

| File:line | What it says |
|---|---|
| `CONSTITUTION_CAPITAL_PRESERVER_V1.md:77` | proposes it as a "Possible FOURTH evidence-relationship type… **Needs an authoring-guide ruling before the CP cells are written.**" |
| `docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:34` | "**noise_discounted** *(RATIFIED HERE as type 4)*" |
| `docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:38` | R1-7: "Operational requirement… unusable without a stated threshold" |
| `docs/ARCHETYPE_PHASE3_REVIEW_R1_TRIAGE.md:15` | the R1-7 ACCEPT row |
| `docs/REVERSE_DIRECTION_MAP_AUDIT_2026-07-29 (1).md:770`, `docs/REVERSE_DIRECTION_MAP_AUDIT_2026-07-29.md:770`, `docs/audits/REVERSE_DIRECTION_MAP_AUDIT_2026-07-29.md:770` | three copies of the same audit line |

`git grep -n noise_discounted -- '*.js' '*.jsx' '*.mjs' '*.json' '*.ts' '*.tsx'` returns **0**. **VERIFIED — I re-ran both greps myself.**

**It is ratified and unbuilt.** The Capital Preserver constitution's noise-vs-damage rule (Q6.5) is exactly the behaviour this type was meant to encode, and there is no cell state, no schema entry and no code path for it. This is directly load-bearing for the Film Room redesign, which must judge a guardian play against "was that noise or damage?" — and no artifact at HEAD answers that question in a machine-readable way.

#### Q8.6 — Legacy vs candidate, and which is live

| Axis | Legacy | Candidate |
|---|---|---|
| Archetypes | **6** (`ARCHETYPE_KEYS`, `:71-78`) | **5** + diversifier reserved (`:40-41`) |
| Rule scope | any of the 143 `FORGE_RULE_TEMPLATES` ids, via `sourceRef` (`:51-54`) | exactly the 95 `isSupported`-offerable rules |
| Shape | sparse + fallthrough to `'neutral'` | dense; `deferred` is a state, never absence |
| Vocabulary | 3 states | 5 states (adds `tension`, `deferred`) |
| Cell payload | `{state, zone1Ref?, tensionReason?}` | `{state, rulingIds, advisory, narrowedParams, displayReason, notes}` |
| Size | 132 authored entries | 475 explicit cells |
| Provenance | hand-adjudicated, July 3 2026 close-out (`:26-40`) | generated from `cells_C1..C7` by `scripts/composition/generate_module.mjs` ("do not hand-edit cells", `:46`) |

Legacy→candidate transition histogram (`manifest.json:368-381`): `neutral→tension` **196**, `core_conflict→tension` 22, `native→tension` 15, `neutral→core_conflict` 11, `neutral→native` 15, `native→neutral` 1.

**Which is live: the LEGACY matrix, for every verdict that changes behaviour today.** The candidate matrix is authored, validated, manifest-locked, snapshotted into identity v3 and hash-bound — and read by **zero verdict-gating production path** at HEAD.

**A live-state caveat I could not settle from code, and it matters.** The cell *source* for the compiler is record-driven, never flag-driven: `compileOnSettingsChange.js:96-115` selects candidate when `descriptor.activeIdentityVersion === CANDIDATE_IDENTITY_VERSION` (`:107`), legacy when it equals `ARCHETYPE_IDENTITY_VERSION` (`:108`), and throws otherwise (`:112`). `CANDIDATE_IDENTITY_VERSION = ARCHETYPE_IDENTITY_VERSION + 1` (`archetypeRegistry.js:85`), i.e. **3**. The in-repo run record states the flip completed — `docs/audits/composition-activation-20260819/README.md:6` ("**Outcome: COMPLETE.** The activation record is at **generation 2**, identity **v3** is active") and `ACTIVATION_RUNBOOK.as-run.md:514` ("**THE FLIP IS DONE. IDENTITY v3 IS ACTIVE AT GENERATION 2.**"). Those are documents, not code, and the descriptor itself lives in Firestore, which Rule 3 forbids me to query. **See §4 for the query the founder can run.**

**Even taking the run record as true, the consequence for the matrix is nil.** The only production caller of a version-parameterized `getArchetypeDefinition` is `archetypeSeeding.js:55`, and `resolveSeedSource` (`:51-59`) reads only `def.defaultTraitIds` / `def.defaultTraits` — **never `def.compat`**. The candidate cells are composed at `archetypeRegistry.js:296-305` and discarded. **VERIFIED.**

**A correction to the registry's own comment.** `archetypeRegistry.js:105` says the version "comes from the ACTIVATION RECORD, never a config value; **no caller passes one until the record exists**." Per the run record the record now exists, and three call sites do pass one: `archetypeSeeding.js:55` (via `trainingClone.js:251` and `change-archetype.js:239`, both resolving through `selectIdentityVersion`, `compositionActivationService.js:284-286`). **The comment is stale.** Reporting for separate tasking.

---
## 4. Data queries for the founder

No production Firestore was queried (Rule 3). Three questions need runtime data; the exact read-only queries follow. All are reads; none writes.

**Q-A — Which identity version is actually active?** This decides whether born-with trait seeding is running on the v2 (live-export) or v3 (candidate) composition, and it is the one fact that makes the in-repo activation run record either current or historical.

```
// Firebase console → Firestore → single document read, or:
db.collection('composition').doc('activation').get()
// Report: activeIdentityVersion, generation, boundaryStateVersion,
//         activeEpochId, candidateStateId, overrideRevision
```
Expected per `docs/audits/composition-activation-20260819/README.md:6`: `activeIdentityVersion: 3`, generation 2.

**Q-B — Has any battle ever run on a non-`balanced` preset?** This sizes the Q3.5 / Q6.5 finding: if the answer is "almost none", then in practice all six archetypes have always shared one stop calibration.

```
// Count battles by strategyPreset. Read-only aggregate:
db.collection('agentBattles').where('strategyPreset', '==', 'defensive').count().get()
db.collection('agentBattles').where('strategyPreset', '==', 'aggressive').count().get()
db.collection('agentBattles').where('strategyPreset', '==', 'balanced').count().get()
// Optionally cross-tab the non-balanced ones by archetype:
db.collection('agentBattles').where('strategyPreset', '!=', 'balanced')
  .select('agentContext.archetype', 'strategyPreset', 'createdAt').limit(200).get()
```

**Q-C — Are guardian battles actually firing the shared risk lines?** This tells you whether the "wide and patient" gap is theoretical or is visibly shaking guardians out.

```
// Exit-reason mix for guardian battles. Trades carry exitReason
// (agentRiskManager.js:23-37 taxonomy: bust_avoidance | vwap_failure |
//  stepped_trail | stagnation | guardrail_stopLoss | guardrail_trailingStop).
db.collection('agentBattles')
  .where('agentContext.archetype', '==', 'guardian')
  .select('trades', 'strategyPreset', 'createdAt')
  .orderBy('createdAt', 'desc').limit(100).get()
// Then tally trades[].exitReason, and compare the same tally for 'degen'.
```

---

## 5. Cross-arc findings

**Command Center arc.** The Character surface renders a "discipline" axis computed from `archetypeConfig.defaultPreset` (`behaviorFingerprint.js:157` → `src/components/Forge/workshop/character/CharacterKit.jsx:22`), while every battle runs `balanced` (`agentBattleService.js:256`, `agent-evaluate.js:684`). **The displayed number and the executed physics come from two different sources** — the exact shape BUILD_RULES §9 was codified against. Anything the Command Center or Film Room says about how tightly an archetype cuts should be derived from the battle's own `strategyPreset`, not from `defaultPreset`. Separately, `IdentityPanel.jsx:40,91` renders only `disposition`, and `AgentIdentityCard.jsx:76` shows the archetype display name **only as a fallback** when no trait-combo label exists — so the Command Center surfaces carry very little archetype identity today.

**Forge Record stream.** The 46 canonical adjustments carry `canonicalTextVersion: 1` and version-pinned conflict-group membership (`archetypeAdjustments.js:240-247, 277-279`). Any Forge Record entry that quotes a directive must pin `adjustmentId` **and** `canonicalTextVersion` — the gate already writes both onto the directive record (`directiveGate.js:92-93`), so the stream should carry them through rather than re-deriving text. A version bump invalidates equipped leans and conflict rulings until re-confirmed (`:243-244`), so a Record entry holding only text will silently misattribute after a bump.

**Harness / spine thread.** `scripts/paired-eval-harness.js` reaches the identity block through `renderEvalIdentityBlockForced` (`:161`) and `spliceEvalIdentityBlock` (`:164`), and it branches on `flagAlreadyOn` — now that `EVAL_IDENTITY_BLOCK_ENABLED = true`, the harness's "on" arm is the production arm and only its "off" arm is synthetic. The injection test locks the splice byte-equal to the fenced assembly (`evalIdentityBlocks.js:201-212`). The spine is intact, but the harness's original DR-13 validation (840 paired decisions, zero decision drift) compared **decision + symbols only** — it does not evidence that the identity block changes behaviour, only that it does not change decisions at current gate settings (`featureFlags.js:1496-1499`; `docs/DR13_EVAL_IDENTITY_BLOCK_ARC_BRIEF.md:34`). Any Film Room claim that an archetype "acted in character" cannot lean on that harness result.

**Ask 2.** `EQUIPPED_RULE_PRECEDENCE_ENABLED = false` is the only correctly guarded identity flag (pinned at `equippedRulePrecedenceFlags.test.js:24`, listed in `DARK_BY_DESIGN` at `flagPinGuard.test.js:62-63`). Its flip swaps the subordination clause in **all six** identity blocks (`evalIdentityBlocks.js:78-79`) and requires the 14 mechanical snapshot regens named at `featureFlags.js:1960-1967`. **Relevant to the Film Room:** while it is dark, every eval prompt carries a clause the code itself documents as false (`evalIdentityBlocks.js:60-69` — the reconciler ranks `user_equipped` over `archetype_default` and drops the losing archetype rule at `decide.js:262`). A review loop that judges a play against "did it honour its identity?" is judging against a prompt that mis-states the precedence ladder.

**Two items for separate tasking (found outside this task's scope; not fixed, per BUILD_RULES §3).**
1. `EVAL_IDENTITY_BLOCK_ENABLED` and `ARCHETYPE_INTEGRITY_MODE` are both live and both **outside `flagPinGuard`** — no pin, no `DARK_BY_DESIGN` entry, no `// Pinned by:` pointer. An accidental revert of either would not red CI (Q4.1).
2. Two stale in-code claims: `archetypeRuleCompatibility.js:16-24` (CompiledBuild persistence — false while `COMPILER_ENABLED=false`) and `archetypeRegistry.js:105` ("no caller passes one until the record exists" — three callers now do).

**One flip obligation that is already recorded, and is NOT a defect.** `decide.js:345` calls `computeArchetypeRankings(stockUniverse, archetype)` with no `opts`, and the V2 contract throws `archetype_game_mode_required` on a missing `gameMode` (`archetypeScoringV2.js`, guard at the head of `computeArchetypeRankingsV2`). This is harmless while `ARCHETYPE_VECTORS_V2_ENABLED = false` and is already the documented one-line fenced diff for that flip: `docs/specs/ARCHETYPE_RANK_INTERFACE_V2_BUILD_SPEC_V1_3.md:196` (the V-5 caller census) and `docs/audits/ARCHETYPE_RANK_V2_PHASE0_DISCOVERY_20260901.md:191`. **Anchor drift to re-verify before relying:** both documents cite `decide.js:343`; at HEAD the call is at **`:345`**.

**Other citation drift found while working** (BUILD_RULES §3 — inherited anchors drift):
- `docs/SIGNAL_INVENTORY_V2.md:265` cites `EVAL_IDENTITY_BLOCK_ENABLED` at `featureFlags.js:1170` and `renderEvalIdentityBlock` at `evalIdentityBlocks.js:155-156`. At HEAD: **`featureFlags.js:1508`** and **`evalIdentityBlocks.js:172-180`**.
- `docs/audits/20260902_EXIT_BEHAVIOR_ASK2_PHASE0_ANCHOR_CONFIRM.md:89` cites `featureFlags.js:1503`. At HEAD: **`:1508`**.

**A doc-vs-code divergence that now matters more than it used to.** Every `ARCHETYPE_DEF_*` document's "Voice (seed)" section claims to quote `src/data/archetypeIdentity.js`, but none of the six strings matches HEAD. Guardian is representative — the document (`ARCHETYPE_DEF_CAPITAL_PRESERVER_2026-06-24.md:23`) gives *"My first job is to not lose. I hold quality — sound names, steady, nothing that'll blow up on me…"*, while `archetypeIdentity.js:58-59` reads *"Rule one is don't lose it. I'd rather protect what we've got than reach for a risky win."* This was cosmetic when the copy was display-only. It is not cosmetic now: that exact string is concatenated verbatim into the mandate trading prompt at `mandatePromptAssembly.js:70` (Q5 channel D). **The definition documents are not a reliable description of what any model is told.**

**A duplication worth knowing about.** Zone 1 is encoded **twice** in code, in two different shapes: `archetypeAdjustments.js` `zones.immutableCore` (the prose the voice prompt renders) and `archetypeRuleCompatibility.js:95-144` `ZONE1_REFS` (short ids + statements the compat warnings cite). The second file's own header warns about it (`:89-93`): *"update BOTH … drift here means warnings describe a different identity than the prompt enforces."* **There is no test binding the two.** Nor is there any doc↔code parity test for the zones at all — `src/data/archetypeAdjustments.test.js:30,54-60` asserts only that all four zone keys exist and are non-empty. Contrast the constitutions, which *are* byte-locked to code. **The zone prose is the least-protected identity content in the repository, and it is the content the conversation layer speaks from.**

---

## 6. NOT REACHED

**None.** Q1 through Q8 were all reached and answered. Two answers are bounded by Rule 3 rather than by context, and both are flagged in place with the query that would settle them:

- **Q8.6** — the live value of the `composition/activation` descriptor (identity v2 vs v3 at runtime) is Firestore state. The in-repo run record says v3; the code fallback constant is 2. Query **Q-A** in §4 settles it. The answer does not change any Q8 verdict, because the candidate compat cells are discarded by the only production consumer either way.
- **Q6.5 / Q3.5** — how often a battle has actually run on a non-`balanced` preset is Firestore state. Query **Q-B** in §4 settles it. The code finding stands regardless: `defaultPreset` is not read by any trading path.

One scope note: the prompt's context document (`docs/FILM_ROOM_REVIEW_LOOP_DESIGN_NOTE_V1_2_20260915.md`) does not exist at HEAD (§1). Its §5 and §6.6 were therefore not read. Per Rule 5 the document would have been context only, never a source of truth about code, so no finding is weakened by its absence — but if it exists outside the repository and contains claims about HEAD, those claims have **not** been checked here.
