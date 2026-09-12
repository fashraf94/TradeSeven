# Phase 0 — `SHADOW_ASSEMBLY_ENABLED`: what it observes, who reads it, what it costs

**Fence check (first line, per the brief):** `api/_utils/shadowAssemblyCapture.js` is **NOT** on the BUILD_RULES §1 fence (VERIFIED — the list is `docs/BUILD_RULES.md:14-24`; the module is absent). Neither is `src/config/featureFlags.js`, `api/cron/agent-evaluate.js`, or `api/_utils/agentEvalTransport.js`. The only file any fix shape below could touch that **is** fenced is `api/_utils/agentEvalPromptAssembly.js` (`BUILD_RULES.md:21`), and only if option (d) takes a pre-fetched-context seam — the recommended fix (a) touches no fenced file.

| | |
|---|---|
| Date | 2026-09-12 |
| Session | Claude Code (Fable), read-only discovery — no production code edited, no Firestore/GCS/network calls |
| Branch | `claude/phase0-shadow-assembly`, cut from `origin/main` at **`701859c6fd663ae9fd4ee617706033861d37bf50`** (merge of PR #837, 2026-09-12 13:28 -0500) |
| Tree at open | clean (`git status --short` empty) |
| Fetches recorded (BUILD_RULES §3) | `git fetch origin main` first; `git fetch origin claude/eval-transport-hygiene` (head **`8cea76cf`**, read with `git show`, never checked out); `git fetch --unshallow origin` — the container was a shallow clone whose boundary (2026-08-19, 301 commits) predated the flag's introduction, so history was deepened to 3,945 commits to answer Q1 |
| Anchors | `file:line` are at HEAD `701859c6` unless marked *(transport branch)*, in which case they are at `8cea76cf`. The D2 finding's own anchors (`agent-evaluate.js:2968`, `:2990`) are stale on that branch by its review-fix commit — at `8cea76cf` the capture is `:2982-3003` and the write `:3005` |
| Markers | **VERIFIED** = read at that line this session. **ASSUMED** = basis named inline |

---

## 0. Executive verdict

| Question | Verdict |
|---|---|
| **Q1 — what it is** | A per-battle, per-tick *structural* shadow: the three eval-prompt parts are rebuilt twice — once from the live `agentContext`, once from the battle's frozen `resolvedAgentManifest` overlaid onto it — diffed, and written as a durable `shadowDiffs/{tickId}` doc plus two aggregate arrays on the battle doc. No second model call. It was dark for one day (introduced `false` Jul 23, flipped `true` Jul 24 in PR #671) so the DR-10 stage-1 corpus would accumulate for the offline paired-eval harness. It was never in the pin guard's `DARK_BY_DESIGN` set. |
| **Q2 — is anyone reading it** | **One consumer, one run**: `scripts/paired-eval-harness.js`, last edited Jul 24 and run once for the DR-13 identity-block flip (Jul 31). One incidental forensic read on Aug 5 (deploy-SHA oracle). Zero runtime readers in `api/` or `src/`, no dashboard. The §6.3 gate aggregates and §6.4 settlement records have **never** had a reader. The question it was commissioned for — validating the *manifest-read migration* — has no build, no owner beyond a dormant spec row, and has been re-routed by the composition arc (the assemblers keep reading `agentContext`; a compiled-artifact slice was spliced in directly). **It is a dark write with a per-tick cost and no consumer.** |
| **Q3 — what it costs** | Per tick, per active battle that reaches the Haiku path: 2 extra `buildLiveContextBlock` calls + 1 awaited `.create()`. For an agent with an `institutional` rule that is **4–6 extra sequential Firestore round trips** (14–24 extra document reads) + 1 write, all serial and all before the battle's write. Not sampled, not mode-gated; runs on every manifest battle (all battles since Jul 24), **including `budget_skipped` ticks** — the tick that is already out of time. Healthy cost is sub-second (structural bound below); the tail is unbounded. |
| **Q4 — the hazard** | Confirmed at HEAD: the capture is awaited at `agent-evaluate.js:2871` with no deadline, `battleRef.update(finalUpdate)` follows at `:2893`. D2 named two unbounded awaits; there are **three** — the `.create()` at `shadowAssemblyCapture.js:250` is also unbounded and also before the write. A *throw* anywhere in the capture is caught before the write (`:374-377`) and costs nothing. A *hang* costs this battle's write, every later battle in the serial loop, and at 300 s the whole tick. `buildLiveContextBlock` has no pre-fetched-context parameter; the institutional fetch is module-private (`agentEvalPromptAssembly.js:891`, fenced). |
| **Q5 — the fix** | **(a) Flip it off.** One-line flip + the pin in `shadowAssemblyCapture.test.js:113` + three stale "dark" docstrings reconciled in the same commit (BUILD_RULES §2). No fenced file. The hazard, the reads, the write, and two write-only battle-doc arrays vanish. The historical corpus (530 docs at the Aug 20 census) stays queryable by the harness. |

---

## 1. Why this exists

The transport build (`origin/claude/eval-transport-hygiene` @ `8cea76cf`, PR open) bounds the decider's prompt build at `PROMPT_BUILD_CEILING_MS = 10_000` (`api/_utils/agentEvalTransport.js:33` *transport branch*, VERIFIED) with an inline `Promise.race` (`api/cron/agent-evaluate.js:2043-2052` *transport branch*, VERIFIED). Its adversarial review recorded, at `docs/audits/20260912_BUILD_EVAL_TRANSPORT_HYGIENE.md:412` (*transport branch*, VERIFIED) and again as open item 1 at `:520`:

> **D2 (major) — the ceiling bounds one of three builds per tick.** `SHADOW_ASSEMBLY_ENABLED = true` (`featureFlags.js:1348`, not dark), and `buildShadowDiffRecord` awaits `buildLiveContextBlock` **twice more** (`shadowAssemblyCapture.js:182`, `:186`) — both unbounded, both awaited at `agent-evaluate.js:2968` **before** `await battleRef.update(finalUpdate)` at `:2990`. … So a Firestore hang in the shadow rebuilds still costs the write, which is precisely the hazard my constant's comment claims to close.

Re-verified at HEAD `701859c6`: the two awaits are at `api/_utils/shadowAssemblyCapture.js:182` and `:186` (VERIFIED, unchanged); the capture is awaited at `api/cron/agent-evaluate.js:2870-2891` and the write is at `:2893` (VERIFIED). The ceiling's own comment on the transport branch says the same (`agentEvalTransport.js:25-30` *transport branch*, VERIFIED). This report answers what the flag observes and prescribes the fix.

---

## 2. Q1 — What it is

### 2.1 The flag

- **Definition:** `export const SHADOW_ASSEMBLY_ENABLED = true;` — `src/config/featureFlags.js:1348` (VERIFIED). Pin pointer at `:1347`: `// Pinned by: shadowAssemblyCapture.test.js`. The pin is `expect(SHADOW_ASSEMBLY_ENABLED).toBe(true)` at `api/_utils/shadowAssemblyCapture.test.js:113` (VERIFIED), inside a describe that says reverting "must edit this assertion in the same commit, exactly as the flip did" (`:107-114`).
- **Docstring is stale:** `featureFlags.js:1334` still opens "When FALSE (DEFAULT, merge-dark)…" and `:1337` calls TRUE "preview smoke only in Phase 2" (VERIFIED). The same stale-dark claim sits in the module header (`shadowAssemblyCapture.js:4-6`: "DARK behind SHADOW_ASSEMBLY_ENABLED=false", VERIFIED) and the cron header (`agent-evaluate.js:10-13`, VERIFIED). Already recorded as a low finding on 2026-08-06 (`docs/audits/20260806_COMPOSITION_BUILD_V09_PHASE0_DISCOVERY.md:141`, VERIFIED) and as a known defect on 2026-09-02 (`docs/audits/COMMAND_CENTER_ARC_FOUNDATION.md:58`: "behind a comment claiming it is dark; it builds two extra eval prompts per tick", VERIFIED). Neither was reconciled.
- **Was it ever dark:** yes, for one day on `main`.
  - Introduced `false`: `b71e5ebd` (2026-07-23, "P2.6: Shadow assembly + behavior-record envelope plumbing (non-fenced, dark)"), merged by `5b9fdd47` = PR #651 (VERIFIED via `git log -S 'SHADOW_ASSEMBLY_ENABLED = false'` and `--ancestry-path --merges`).
  - Flipped `true`: `b29ba852` (2026-07-24, "Flip SHADOW_ASSEMBLY_ENABLED false→true (Phase 2 shadow-assembly activation)"), merged by `5de5f359` = PR #671 (VERIFIED). The diff is the one value line plus the test pin (`featureFlags.js` 1 line, `shadowAssemblyCapture.test.js` +11/−5; VERIFIED `git show --stat`).
  - `DARK_BY_DESIGN`: **never listed.** The guard (`src/config/flagPinGuard.test.js:58-88`, VERIFIED) has no `SHADOW_ASSEMBLY_ENABLED` entry, and `git log -S SHADOW_ASSEMBLY_ENABLED -- src/config/flagPinGuard.test.js` returns nothing (VERIFIED). The guard was codified 2026-08-11 (`BUILD_RULES.md:53`), after the flip.
- **Stated purpose, quoted from the flip commit `b29ba852` (VERIFIED):**
  > Activates the P2.6 tick-side shadow assembly + behavior-record envelope plumbing so the shadowDiffs corpus starts accumulating — the DR-10 stage-1 input the paired-eval harness (scripts/paired-eval-harness.js) replays before any behavior-affecting flip, next up the DR-13 eval identity block.

  and from the spec it implements, `docs/ARCHETYPE_PHASE1_MASTER_SPEC_V1_1.md:151` (VERIFIED):
  > DR-10 now two-stage: assembly shadow (structural, Phase 2) + **offline paired-evaluation harness** — captured live contexts replayed off-cron through the API against candidate prompts … — required before any behavior-affecting flip (manifest-read migration, identity block, preset freeze) (R1 finding 28).

  Also named in `docs/PHASE2_BUILD_BRIEF_V1.md:48` (VERIFIED) and `docs/20260723_ARCHETYPE_P2_FINAL_PHASE_REPORT.md:46` (flip sequencing: manifest-write first, shadow-assembly second; VERIFIED).

### 2.2 `shadowAssemblyCapture.js` — what the two extra builds are

The module is 451 lines (VERIFIED, read in full). Six exports matter here:

| Export | Lines | What it does |
|---|---|---|
| `buildBehaviorRecordEnvelope` | `:84-108` | The A-1 envelope: `manifestId`/`manifestHash` (identity), version stamps, `commitSha`, `tickId = ${cronStartIso}_${battle.id}` (`:105`). **Returns `null` without a manifest** (`:85-86`) — pre-manifest battles are skipped entirely. |
| `manifestDerivedBattleView` | `:130-149` | The "shadow" battle: `...battle` with `agentContext` overlaid by the manifest's `valuesAtLock` (agentName, archetype, riskTolerance), `frozenLayers` (activeRules, equippedBundleIds, deployedGuardrails, equippedWatchlist, standingLeans, standingLeansInvalidated, dials) and `versionStamps.settingsRevAtLock`. Shallow; never mutates the live object. |
| `buildShadowDiffRecord` | `:155-235` | Builds **all three prompt parts per view** — `buildEvalSystemPrompt` ×2 (`:168-179`), `buildAgentIdentityBlock` ×2 (`:180-181`), **`buildLiveContextBlock` ×2, awaited (`:182-185`, `:186-189`)** — diffs them (`:191-194`), records rendered rule ids per side (`:199-203`). |
| `writeShadowDiff` | `:243-261` | Awaited `.create()` (`:250`) to `agentBattles/{battleId}/shadowDiffs/{tickId}`; duplicate → loud warn, error → loud error; never throws. |
| `runShadowTickCapture` | `:336-378` | The once-per-tick entry: envelope → validate → **`await buildShadowDiffRecord` (`:354`) → `await writeShadowDiff` (`:355`)** → stamps `finalUpdate.shadowGateAggregates` (`:363`) and, on a final HOLD, `finalUpdate.shadowTerminalGates` (`:367-371`). Whole body in one `try/catch` (`:337`, `:374-377`). |
| `writeBattleSettlementRecord` | `:391-450` | §6.4: at completion, create-only `battleSettlements/{battleId}` (`:439`) then `receiptCoverage: 'complete'` on the battle (`:445`). |

**What differs between the two builds and the decider's own build:**

- **Live view = the decider's build, recomputed.** The live side calls `buildLiveContextBlock(liveView, prices, macroPrices, assetScores, triggers, news, liveView.evaluations, momentumData, presetConfig)` with `liveView = battle` (`:157`, `:182-185`). The decider's own call is `buildLiveContextBlock(battle, prices, macroPrices, assetScores, triggers, news, battle.evaluations, momentumData, presetConfig)` (`agent-evaluate.js:2016-2019`, VERIFIED) — the same function, the same nine arguments, from the same tick's `market` object (`:2877`). It is a byte-for-byte recompute (and a re-fetch) of a string the cron already holds at `:2016`.
- **Shadow view = the same battle with the manifest's frozen layers substituted for `agentContext`.** The only intended difference is the *source* of the agent's configuration: the runtime authority (`battle.agentContext`, snapshotted at creation in `api/_utils/agentBattleService.js:181-211`, VERIFIED) versus the `resolvedAgentManifest` (built at the same creation from the same `agentData` — `resolvedAgentManifest.js:129-144`, `:167-180`; attached at `agentBattleService.js:236-244`; all VERIFIED). Nothing about market data, prices, evaluations, or the model differs. So the steady-state expectation is `identical: true` — which is exactly what the suite's lock 3 asserts (`shadowAssemblyCapture.test.js:12-14`, VERIFIED) and what the flip commit says was observed on the first production tick ("identical ticks hash-only", `b29ba852` message, VERIFIED).
- It is **not** a flag-state shadow, not a candidate-module shadow, not a registry shadow: no flag is toggled between the two builds, and both views carry the same `resolvedAgentManifest` (the `...battle` spread at `:133`), so the composition PR 3 advisory index (`agentEvalPromptAssembly.js:790-797`, VERIFIED) renders identically on both sides.

**What the record contains** (`:205-234`, VERIFIED): `envelope`, `identical`, `renderedRuleIds {live, shadow}`, six `hashes` and six `sizes` (system/identity/context × live/shadow); **on divergence only**, three hunk arrays and all six full prompt texts (`:225-233`, the founder-ruled payload discipline at `:20-22`).

### 2.3 Where the record goes

| Destination | `file:line` | Awaited? |
|---|---|---|
| `agentBattles/{battleId}/shadowDiffs/{tickId}` — one doc per battle per tick | `shadowAssemblyCapture.js:243-250`, called `:355` | **Yes**, before the battle write |
| `battle.shadowGateAggregates[]` (cap 64) and `battle.shadowTerminalGates[]` (cap 64) — fields on the battle doc, riding `finalUpdate` | `:363`, `:367-371`; caps `:77-78` | Ride `battleRef.update(finalUpdate)` at `agent-evaluate.js:2893` |
| `battleSettlements/{battleId}` + `battle.receiptCoverage` — at completion | `:436-445`; cron call `agent-evaluate.js:4588-4592`; `'pending'` stamp `:4432-4433` | Yes, post-commit |
| The GCS shadow-logger stream | **No.** The module header forbids it explicitly (`:14-18`: "NEVER the fire-and-forget shadowLogger (Signal Capture Rider §5)"). The cron's `logEvaluation(...).catch(() => {})` at `agent-evaluate.js:2777-2798` is a separate, pre-existing channel that carries the decision, not the prompts. | — |

---

## 3. Q2 — Is anyone reading it

### 3.1 Every reader

A repo-wide search for `shadowDiffs | shadowGateAggregates | shadowTerminalGates | battleSettlements | receiptCoverage | renderedRuleIds | SHADOW_ASSEMBLY_ENABLED | shadowAssemblyCapture | runShadowTickCapture | buildShadowDiffRecord | writeShadowDiff | paired-eval` over `api/`, `src/`, `scripts/`, `docs/`, `test/`, rules and indexes (VERIFIED, `node_modules`/`dist` excluded) finds:

| Reader | What it reads | Status |
|---|---|---|
| **`scripts/paired-eval-harness.js`** (411 lines) | `shadowDiffs` via `collectionGroup('shadowDiffs')` or per-battle (`:247-252` DR-13 mode, `:335-340` manifest mode); `renderedRuleIds` (`:383-384`). Both modes keep **only docs that carry texts** — i.e. divergent docs (`:254`, `:343`; identical docs are hash-only by design, README `:85-87`). | Offline script, "NO PRODUCTION WIRING" (`:12-16`). Last edited **2026-07-24** (`3553e3e9`, the `--dr13` mode); created 2026-07-23 (`e1d2f492`). VERIFIED via `git log`. |
| `docs/DR13_EVAL_IDENTITY_BLOCK_ARC_BRIEF.md:34` + flip commit `296e98c3` (2026-07-31) | The **only recorded run**: "validation delivered via the `--dr13` battery … 60 real-data swap-eligible fixtures × both variants … 840 paired decisions, zero decision drift." (VERIFIED) | The harness output was delivered to the founder as a file (`:39`); no `.jsonl` exists in the repo (VERIFIED `find`). |
| `docs/audits/20260805_PR2_POST_FLIP_LIVE_VERIFICATION.md:31-33` | Production `shadowDiffs` read once, by hand, as a deploy oracle: `envelope.effectiveRuntimeResolution.commitSha` and `sizes.liveSystem` step (VERIFIED) | One-off, 2026-08-05. |
| `docs/composition/ACTIVATION_RUNBOOK.md:481-482`, `:502` (as-run copy identical) | A census count: **530 `shadowDiffs` docs, 78 `battleSettlements`** on 2026-08-20, "historical; … not re-served on any future read path" (VERIFIED) | Count only. |
| `docs/audits/20260902_EXIT_BEHAVIOR_ASK2_PHASE0_ANCHOR_CONFIRM.md:27`, `:80`; `…ASK2_BUILD_REVIEW.md:72` | Read the harness **source** to characterise what the Jul 31 run compared (decision + symbols only) (VERIFIED) | Not runs. |
| `docs/audits/20260907_VOICE_GROUNDING_PHASE0_DISCOVERY.md:157` | Considered `shadowDiffs` as a source for "the whole eval prompt as the decider saw it" and rejected it — hashes only in steady state (VERIFIED) | Not adopted; no `api/agent/chat.js` read exists (grep). |
| `api/`, `src/` runtime | **Nothing.** No handler, endpoint, hook, or screen reads any of the five fields/collections (VERIFIED grep: the only `api/` hits are the module, its test, and the cron's two call sites; zero `src/` hits). | No dashboard. |
| `shadowGateAggregates`, `shadowTerminalGates`, `battleSettlements`, `receiptCoverage` | **Zero readers anywhere**, scripts included (VERIFIED — the harness reads `shadowDiffs` and `renderedRuleIds` only). | Write-only since Jul 24. |

Peripheral mentions that are not readers: `api/_utils/archetypeRegistry.test.js:203` (an import-surface path list), `api/_utils/fundamentalsRender.test.js:10` (cites the #671 pin pattern), `api/_utils/compositionDerivedWritesCensus.json:100-101` (writer census: "append-only non-authority capture") — all VERIFIED.

**On the one run (ASSUMED, arithmetic basis):** 60 inputs = 6 archetypes × the harness's `--n 10` default (`:86`, caps at `:248`/`:251`), whereas `--synthetic` yields 12 pairs (`:36-37`). That arithmetic says the Jul 31 run used the **real corpus**, which the DR-13 path filters to text-carrying (divergent) docs (`:254` — present at `3553e3e9` too, VERIFIED). If so, **at least 60 divergent shadow diffs existed within a week of the flip**, and no document analyses *why* they diverged — no report cites `systemHunks`, `identityHunks` or `contextHunks` (VERIFIED grep over `docs/`). The stage-1 observation itself was never written up.

### 3.2 The question it was commissioned to answer, and whether it is answered

DR-10 stage 1 exists to feed stage 2, and stage 2 is "required before any behavior-affecting flip (manifest-read migration, identity block, preset freeze)" (`ARCHETYPE_PHASE1_MASTER_SPEC_V1_1.md:151`; R1 finding 28 at `ARCHETYPE_PHASE1_REVIEW_R1_TRIAGE_MATRIX.md:37`; both VERIFIED). Item by item:

| Flip the corpus was to gate | Status | Evidence |
|---|---|---|
| **Identity block** (DR-13) | **Answered and shipped.** Harness run Jul 31 → `EVAL_IDENTITY_BLOCK_ENABLED = true` (`featureFlags.js:1508`, flip `296e98c3`, VERIFIED). | `DR13_…_BRIEF.md:34`; `20260805_PR2_POST_FLIP_LIVE_VERIFICATION.md` |
| **Manifest-read migration** (the shadow's *own* question: can the manifest replace `agentContext` as the runtime authority?) | **Not answered, not scheduled, and re-routed.** `featureFlags.js:1320-1323` (VERIFIED): "manifest-read migration is a later phase behind the DR-10 two-stage validation." The master spec's status row still reads "DR-10 stage-2 harness still needed for manifest migration" (`:256`, VERIFIED). No `MANIFEST_READ_*` flag exists (VERIFIED grep). The composition arc then ruled the other way: "Today the assemblers read `battle.agentContext`, **not** the CompiledBuild/manifest (the manifest has zero readers; `shadowAssemblyCapture.manifestDerivedBattleView` projects only `frozenLayers` …). Delivering advisory/narrowedParams therefore requires building a **new read edge**" (`COMPOSITION_BUILD_SPEC_V0_9_1_CLOSURE_SHEET.md:76`, `:122`, VERIFIED). That read edge landed as a dark fenced splice reading `resolvedAgentManifest.compositionCompat` directly (`agentEvalPromptAssembly.js:37-40`, `:790-797`, VERIFIED) — not via the shadow's projection, and not as a migration of `agentContext` reads. | |
| **Preset freeze** | No flag, no brief, no mention beyond the spec line (VERIFIED grep for `preset freeze` / `PRESET_FREEZE`). | |

So: the one consumer has consumed once, for a flip that is done; the question the observation was built for has no build behind it and the design that would have needed it went a different way; the two aggregate arrays and the settlement record were never read by anything. **This is a dark write with a per-tick cost and no consumer.** Six weeks of ticks (Jul 31 → today) have written to it unread.

### 3.3 The open item that depends on it

- **Item:** "manifest-read migration" — DR-10 stage 2 for the manifest. **Owner document:** `docs/ARCHETYPE_PHASE1_MASTER_SPEC_V1_1.md` (DR-10 at `:151`; status row `:256`). Dormant: no brief, no flag, no branch (VERIFIED).
- **A planned touch of the module that has not landed:** the closure sheet names `shadowAssemblyCapture.js:126` (the projection) as a place to decorate advisory data (`:76` clause (b)). At HEAD `manifestDerivedBattleView` (`:130-149`) carries no advisory projection (VERIFIED), and PR 3 went through the fenced assembler instead. Flipping the flag off does not block that arc; it reads the manifest field, not the shadow.
- The activation runbook's "enable candidate shadow assembly" stage found the flag "already `true` … NOT candidate-specific … no action exists" (`ACTIVATION_RUNBOOK.md:434-437`; `DEBT.md:62`; VERIFIED) — the composition event does not depend on the flag being on.

---

## 4. Q3 — What it costs

### 4.1 Per tick, per battle

| Work | Where | Count |
|---|---|---|
| `buildLiveContextBlock` (async) | `shadowAssemblyCapture.js:182`, `:186` | **2 extra** (the decider's is `agent-evaluate.js:2016`) |
| `buildEvalSystemPrompt`, `buildAgentIdentityBlock` (sync) | `:168-181` | 2 + 2 extra (CPU only) |
| `canonicalContentHash` | `:210-215` | 6 |
| `diffPromptTexts` (line-by-line, ≤200 hunks) | `:191-193` | 3 |
| Firestore `.create()` of the diff doc | `:250` via `:355` | **1 extra write, awaited** |
| Battle-doc payload growth | `:363`, `:367-371` | two arrays appended per tick (≤64 each) |

**Firestore round trips inside each `buildLiveContextBlock`** (VERIFIED): the function's **only** `await` is `fetchInstitutionalContext` at `agentEvalPromptAssembly.js:1250` (function spans `:1122-1286`; grep for `await` in that range returns only `:1250`). That fetch returns `null` with **zero reads** unless some rule has `category === 'institutional'` (`:892-893`). When it runs: batches of 10 symbols, each batch a parallel `Promise.all` of document gets, **batches sequential** (`:900-913`), then **one more sequential** `institutionalAggregates/latest` get (`:919`). Symbols = held + `portfolio.bench` (`:1247-1249`; `flattenBenchServer` = bench stocks + bench crypto, `agentScoring.js:57-65`; the `watchlist.hotBench` is **not** included).

| Mode | Symbols | Round trips per build | Doc reads per build |
|---|---|---|---|
| tiered — `portfolioSize 7` + `benchStocks 3` + bench crypto (`src/constants/agentGameModes.js:44-48`, VERIFIED) | 11 | ⌈11/10⌉ = 2 batches + 1 aggregate = **3** | 12 |
| flat6 — `portfolioSize 6` + `benchStocks 0` (`:60-67`, VERIFIED) | 6 | 1 + 1 = **2** | 7 |

So for an institutional agent the shadow pair adds **4 (flat6) to 6 (tiered) sequential Firestore round trips and 14–24 document reads**, plus the awaited `.create()` — **5–7 sequential Firestore operations before the battle's write**, on top of the decider's own 2–3. For a non-institutional agent: zero extra reads, still one awaited `.create()` and two full prompt renders. The shadow-side build's institutional read is gated on the *manifest's* frozen `activeRules` (`:138` → `:892`), which in steady state equal the live ones, so both sides fetch.

### 4.2 Gating — who gets it and when

- **Every active battle.** `findActiveAgentBattles` is an unbounded `status == 'active'` query (`agentBattleService.js:43-50`, VERIFIED); the handler sorts by `lastEvalStartedAt` (`agent-evaluate.js:332-334`) and processes **serially** (`:337`), checking the 290 s budget only at the top of each iteration (`:338-344`, `TIME_BUDGET_MS` at `:139`; `maxDuration: 300` at `:135`). VERIFIED.
- **Every tick that reaches the Haiku path.** The capture sits only in the full-evaluation branch (`:2870`). Four earlier branches return before it: proposal pending (`:1806-1815`), gameplan skip (`:1823-1832`), gameplan trigger (`:1862-1871`), and no trigger (`:1934-1951`) — VERIFIED. The trigger gate always passes on a battle's first tick and in its final hour (`agentTriggerGate.js:27-37`), otherwise on conditional triggers (`:180`).
- **Including ticks that never called the model.** A `budget_skipped` tick sets `haikuFailure` and **falls through** with no return (`:1983-1990`; the finalUpdate handles the class at `:2838`) — so the battle that was already too late to call Haiku still does two prompt builds and a Firestore write before its own write. A builder throw in the decider's build does the same (it lands in the catch as a Haiku failure and proceeds). VERIFIED.
- **Only manifest battles** (`shadowAssemblyCapture.js:85-86`, skip logged at `:345`) — which is every battle created since `MANIFEST_WRITE_ENABLED` flipped (Jul 24, `335e38de` as cited by `b29ba852`; ASSUMED from the commit messages, not re-verified). Not sampled (`samplingMeta: 'none'`, `:361`), not gated on `gameMode`, tournament, or anything else (VERIFIED — the call site's only guard is the flag, `:2870`).
- **Cadence:** the eval cron runs `*/15 13-21 UTC` weekdays (`vercel.json:157-158`, VERIFIED) — 36 ticks per market day; the module's own cap comment assumes "≤~36 ticks" (`:75-76`).

### 4.3 Wall time it adds before the write — a structural bound

There is no instrumentation: the module logs only on skip or failure (`:345`, `:350`, `:375`), never a duration; the transport branch's `buildMs` wraps only the decider's race (`agent-evaluate.js:2011`, `:2053` *transport branch*, VERIFIED).

Bound: `added_ms ≈ (R + 1) × L + CPU`, where R = 0 (non-institutional) or 4–6 (institutional) sequential read round trips, the `+ 1` is the `.create()`, L = one Firestore round trip from the Vercel function, and CPU (two prompt renders + six hashes + three diffs over ~15 KB strings) is small.

| Case | ASSUMED L (no in-repo measurement; typical Admin-SDK doc get from a Vercel function) | Added before the write |
|---|---|---|
| Healthy, non-institutional | 30–100 ms | ~0.05–0.15 s |
| Healthy, institutional, tiered | 30–100 ms | ~0.2–0.7 s |
| Slow Firestore | 300 ms | ~1.5–2.1 s |
| Hung read or write | — | **unbounded**, until Vercel kills the function at 300 s |

What would measure it: a `Date.now()` pair around `await runShadowTickCapture` (`agent-evaluate.js:2871`) written as `shadowMs` onto the evaluation entry next to the transport build's `buildMs`/`callMs` (and onto the `logEvaluation` payload). That is a ~4-line non-fenced change; it is **not** needed if the flag is flipped off.

---

## 5. Q4 — The hazard, precisely

### 5.1 The awaits and the write

VERIFIED at HEAD: `if (SHADOW_ASSEMBLY_ENABLED) { await runShadowTickCapture({...}) }` at `agent-evaluate.js:2870-2891`, then `await battleRef.update(finalUpdate)` at `:2893`. Inside the capture, three awaited Firestore-touching promises, none with a deadline:

1. `await buildLiveContextBlock(liveView, …)` — `shadowAssemblyCapture.js:182-185`
2. `await buildLiveContextBlock(shadowView, …)` — `:186-189`
3. `await ref.create(record)` — `:250`, via `await writeShadowDiff(...)` at `:355`

D2 named the first two; **the third is equally unbounded and equally before the write.** (The transport branch is the same shape at `:2982-3003` / `:3005`.)

### 5.2 What a hang there costs

- **This battle's write.** `finalUpdate` (`:2810-2863`) is never applied: the evaluation entry (`:2812`), the statusFeed for the tick (`:2813`), `evaluationCount`/`holdCount`/`totalHaikuCalls`/`lastEvalStartedAt`/token totals/`consecutiveHolds`/`consecutiveEvalFailures` (`:2814-2839`), the durable `cronErrors` entry (`:2845-2854`), `pendingProposal` (`:2861-2863`), and the shared cron state (`:2858`). The swaps this tick executed earlier are already committed by their own writes (`executeSwapServer` sites), so the book moves but the record of *why* is lost — the evaluation entry and the feed entries describing the swaps never land. Because `lastEvalStartedAt` is not refreshed, the battle also re-sorts to the front next tick (`:2823-2827`, `:332-334`).
- **The lock.** `cronState.evaluatingAt` was claimed in the acquire transaction (`:587-589`) and is released only by the write path (`finalizeCronState` sets `cronState.evaluatingAt = null` on the `finalUpdate` object — `api/_utils/agentCronState.js:37`, applied at `:2893`) or the catch (`:2897`). A hang releases neither; the next tick steals it once it is older than `EVALUATING_LOCK_TIMEOUT_MS = 120_000` (`:138`, `:562-567`). VERIFIED.
- **Every later battle in the serial loop.** `:337` awaits `processAgentBattle` per battle; a hang in battle *k* means battles *k+1…n* get no tick at all this run, and the budget check at `:338` never gets a chance to defer them cleanly (no `summary.skipped` log for them).
- **The whole tick at `maxDuration`.** At 300 s (`:135`) Vercel kills the invocation: the handler's summary/response never returns, the `finally` block's trade narrations for the hung battle (`:2899-2925`) never dispatch, and nothing distinguishes "hung in the shadow" from any other kill in the logs — the module logged nothing.

### 5.3 Failure versus hang

- A **throw** anywhere inside the capture is caught **before** the write: `runShadowTickCapture` wraps its body in `try { … } catch (err) { console.error(...); return { captured: false, reason: 'capture_error' } }` (`:337`, `:374-377`, VERIFIED). `writeShadowDiff` has its own catch (`:249-260`). Inside the builder, `fetchInstitutionalContext` swallows its own errors (`:925-927`, `:930-933`) and the builder's institutional block is itself try/caught (`:1253-1255`). So a *fast failure* costs nothing: the write proceeds without the aggregates. Only a *hang* — a promise that never settles — is uncaught, because nothing races it.

### 5.4 Can `buildLiveContextBlock` take the decider's already-fetched context?

- **No parameter exists.** The signature is `buildLiveContextBlock(battle, prices, macroPrices, assetScores, triggers, news, recentEvals, momentumData, presetConfig)` (`agentEvalPromptAssembly.js:1122`, VERIFIED) — nine positional arguments, none of them an institutional context. `fetchInstitutionalContext` is **module-private** (`async function`, not exported, `:891`) and is called from inside the builder (`:1250`). Adding a pre-fetched-context argument or exporting the fetch is an edit to `agentEvalPromptAssembly.js`, which is **§1-fenced** (`BUILD_RULES.md:21`).
- **But the live side needs no seam at all.** The shadow's live-side product is, by construction, the string the decider already built at `agent-evaluate.js:2016-2019` — same function, same arguments (§2.2). The cron could pass `liveContextBlock` (and `systemPrompt`, `identityBlock`) into the `tick` object and the module could skip its live-side rebuild entirely, non-fenced. Two caveats: (i) on `budget_skipped` / build-timeout ticks there is no decider string, so the capture would have to skip (or build); (ii) reusing the actual string is *more* faithful than today's rebuild, which happens after the tick's swaps and after the lock transaction refreshed `battle.controlEpochLog`/`regimeAtStart` (`:576`, `:583`) — today's "live" shadow text is not guaranteed to be the text the model saw.
- The **shadow side** must still build (its `agentContext` differs by construction), and de-duplicating *its* institutional read against the decider's would need the fenced seam.

---

## 6. Q5 — The fix shape

### Recommended: **(a) Flip it off.**

**Reason.** Q2 is decisive: the corpus has one offline consumer that ran once, for a flip that shipped six weeks ago; the question the shadow was built to answer (manifest-read migration) has no build, no brief and a superseding design; the aggregates and settlement records were never read by anything. Q3–Q4 then say the observation costs 5–7 unbounded sequential Firestore operations per institutional battle-tick, sits in the one place a hang can take the battle's write and the rest of the serial loop, and runs even on the tick that is already out of time. Bounding, moving or de-duplicating a write nobody reads is engineering spent on the wrong side of the ledger; turning it off removes the hazard, the reads, the write and the two growing arrays in one line.

**Shape, files, fence:**

| File | Change | Fenced? |
|---|---|---|
| `src/config/featureFlags.js:1348` | `true` → `false`; reconcile the docstring at `:1334-1345` (it currently calls FALSE the "DEFAULT, merge-dark" state — so after the flip it is *accurate* again, but say why it is off and what would turn it back on) | No |
| `api/_utils/shadowAssemblyCapture.test.js:107-114` | the ON pin becomes an OFF pin in the **same commit** (BUILD_RULES §2 flip reconciliation; `flagPinGuard.test.js` fails otherwise) | No |
| `src/config/flagPinGuard.test.js:58` | optional but recommended: add a `DARK_BY_DESIGN` note so an accidental re-flip is loud and self-explaining | No |
| `api/_utils/shadowAssemblyCapture.js:4-6`, `api/cron/agent-evaluate.js:10-13` | comment-only: they already claim "dark"; make the claim true and dated | No |

Nothing fenced. `api/_utils/agentBattleService.js` does not read the flag (VERIFIED grep — the `receiptCoverage` stamp is in the cron at `agent-evaluate.js:4432-4433`). The flip removes calls *to* the fenced builders; it changes nothing that reaches them, so the `EXA_RETRIEVAL_ENABLED`-style "flip is fence contact" rule (`BUILD_RULES.md:32`) does not apply and the §2 one-line-flip convenience does. The Signal Inventory does not list the shadow diff as a catalogued signal (VERIFIED grep of `docs/SIGNAL_INVENTORY_V2.md` — no "shadow" hit), so the Rider §5 capture obligation is not engaged by stopping it — the founder should confirm that reading.

**What turns off with it** (all write-only today): `shadowDiffs` docs, `shadowGateAggregates`/`shadowTerminalGates` growth, the completion-time `receiptCoverage: 'pending'` stamp and `battleSettlements` record (`agent-evaluate.js:4432-4433`, `:4588-4592`). The historical corpus (530 diffs / 78 settlements at Aug 20) stays; the harness's corpus mode still runs against it. If a future manifest-migration brief needs a *fresh* corpus, the flip PR is the same one line the other way — and that brief should also bound the capture, per (b).

**Order with the transport build:** independent. (a) can land before or after `claude/eval-transport-hygiene`; if after, the transport build's D2 note at `agentEvalTransport.js:25-30` should be updated in the flip PR to say the shadow is off.

### What each alternative would cost

- **(b) Bound the pair with `PROMPT_BUILD_CEILING_MS` through the race.** The "race helper" is not an export — on the transport branch it is an inline `Promise.race` + `setTimeout` in the cron (`agent-evaluate.js:2043-2052` *transport branch*); (b) would extract it into `agentEvalTransport.js` (non-fenced) and wrap `buildShadowDiffRecord` **and** the `.create()` (`:250`) — bounding only the two builds leaves the third unbounded await. Touches `shadowAssemblyCapture.js`, `agentEvalTransport.js`, their tests; depends on the transport build landing first (cherry-pick order); keeps every read and write on every tick for a record nobody reads; adds a new `reason: 'capture_timeout'` path to test. Non-fenced. Right shape *if* the observation is wanted; wasted if it is not.
- **(c) Move it after the write.** Two sub-shapes. (c1) after `:2893` but still awaited: protects the write, still costs the serial loop and the tick on a hang — half the hazard. (c2) fire-and-forget: contradicts the module's founder-ruled posture ("NEVER the fire-and-forget shadowLogger (Signal Capture Rider §5)", `:14-18`; `b71e5ebd` message), and a promise left un-awaited near the end of a Vercel invocation is not guaranteed to complete. Either way the §6.3 aggregates lose their ride on `finalUpdate` and need their own write op per tick (a new write) or get dropped — more moving parts than (a), for the same unread output. Non-fenced.
- **(d) Reuse the decider's context.** Live side: no seam — pass `liveContextBlock`/`systemPrompt`/`identityBlock` from `agent-evaluate.js:2014-2019` through the `tick` object and drop the live-side rebuild (`shadowAssemblyCapture.js:168-173`, `:180`, `:182-185`); halves the reads and improves fidelity (§5.4). Shadow side: still one build with its own institutional round trips; de-duplicating that read requires adding a pre-fetched-context parameter to `buildLiveContextBlock` or exporting `fetchInstitutionalContext` — a **fenced** edit to `agentEvalPromptAssembly.js` (`BUILD_RULES.md:21`, §7 sign-off). On its own (d) does **not** remove the hazard — the shadow build and the `.create()` stay unbounded — so it needs (b) as well. Files: `agent-evaluate.js`, `shadowAssemblyCapture.js` (+tests); plus `agentEvalPromptAssembly.js` if the seam is taken (fenced: **yes** in that case, **no** for the live-side-only half).

---

## 7. Found outside the five questions (BUILD_RULES §3 — reported, not fixed)

1. **Three unbounded awaits, not two.** The `.create()` at `shadowAssemblyCapture.js:250` (awaited at `:355`) is a third deadline-less Firestore operation before the battle write. Any bounding fix that races only the builds leaves it. (Refines D2.)
2. **The capture runs on `budget_skipped` ticks** (`agent-evaluate.js:1983-1990` falls through to `:2870`). The tick that has already judged itself too late to call the model still performs two prompt builds and a Firestore write before its own write.
3. **Three stale "dark" comments** — `featureFlags.js:1334-1345`, `shadowAssemblyCapture.js:4-6`, `agent-evaluate.js:10-13` — have described the flag as dark since Jul 24 while it ships `true`. Flagged twice before (`20260806_…:141`, `COMMAND_CENTER_ARC_FOUNDATION.md:58`) and still unreconciled; the (a) flip PR clears them by making them true.
4. **At least 60 divergent diffs, never analysed (ASSUMED, §3.1 arithmetic).** The steady state is designed to be `identical: true`; if the Jul 31 run really drew 60 text-carrying docs from the corpus, production diverged on ≥60 ticks in the first week and nobody looked at the hunks. Each divergent doc carries six full prompt texts (~14–15 KB each per the Aug 5 sizes, `20260805_…:37-38`), i.e. ~90 KB per doc. Worth one query before the corpus is declared closed — but a query, not a build.
5. **No collection-group index for `shadowDiffs` in the repo.** The harness's default mode uses `collectionGroup('shadowDiffs')` (`:251`, `:339`) and its README says to create the index in the console if asked (`:99-101`); `firestore.indexes.json` has no `COLLECTION_GROUP` entry for it (VERIFIED grep). Console-only state, if it exists, is not reproducible from the repo (ASSUMED that none was created; not checkable read-only).
6. **The shadow's "live" prompt is a rebuild, not the sent prompt** (§5.4 caveat ii). It is built at `:2870`, after the tick's swaps and after the lock transaction refreshed two battle fields (`:576`, `:583`). For a corpus whose stated purpose is "captured live contexts", that is a fidelity gap — moot under (a), fixed for free under (d).
7. **The transport audit's D2 anchors have drifted on its own branch** (`:2968`/`:2990` → `:2982-3003`/`:3005` at `8cea76cf`) — comment-only, BUILD_RULES §3 already says to re-verify.

---

## For the design chat

- **Q1.** `SHADOW_ASSEMBLY_ENABLED` (`featureFlags.js:1348`, `true` since PR #671 on Jul 24, dark for one day, never in `DARK_BY_DESIGN`) rebuilds the three eval-prompt parts twice per battle-tick — once from live `agentContext`, once with the frozen manifest overlaid — diffs them, and writes an awaited `shadowDiffs/{tickId}` doc plus two aggregate arrays on the battle doc, as the DR-10 stage-1 corpus for the offline paired-eval harness.
- **Q2.** The only consumer is `scripts/paired-eval-harness.js` (last edited Jul 24), run once for the DR-13 identity-block flip on Jul 31; the manifest-read migration it was built to validate has no build and was re-routed by the composition arc; `api/`/`src/` have zero readers; the gate aggregates and settlement records were never read — a dark write with a per-tick cost and no consumer.
- **Q3.** Every active manifest battle, every Haiku-path tick (including `budget_skipped` ones), unsampled: two extra `buildLiveContextBlock` calls plus one awaited `.create()` — for an institutional agent 4–6 extra sequential Firestore round trips (14–24 reads) before the battle write, sub-second when healthy, unbounded in the tail, unmeasured.
- **Q4.** Confirmed: three deadline-less awaits (`:182`, `:186`, `:250`) sit before `battleRef.update(finalUpdate)` at `agent-evaluate.js:2893`; a throw is caught before the write and costs nothing, a hang costs this battle's write, every later battle in the serial loop, and at 300 s the tick; `buildLiveContextBlock` takes no pre-fetched context and its fetch is private to a fenced file, though the live-side rebuild could reuse the decider's own string with no seam.
- **Q5.** Flip it off.

**Recommended fix:** (a) flip `SHADOW_ASSEMBLY_ENABLED` to `false` and reconcile its pin and docstrings in the same commit.
Files: `src/config/featureFlags.js`, `api/_utils/shadowAssemblyCapture.test.js`, optionally `src/config/flagPinGuard.test.js` (a `DARK_BY_DESIGN` note) and the two stale header comments.
Fenced: **no**.

**Outside the five questions:** a third unbounded await (the `.create()`); the capture runs on `budget_skipped` ticks; three stale "dark" comments since Jul 24; ≥60 divergent diffs by Jul 31 that nobody analysed (assumed from the DR-13 arithmetic); no repo-tracked collection-group index for the harness; the shadow's "live" text is a post-swap rebuild, not the sent prompt.

*Read-only session. No production code edited; this report is the only file created. STOP.*
