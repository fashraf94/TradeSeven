# Phase 0 — archetype anatomy (read-only discovery)

**Date:** Tuesday 17 Nov 2026 · **Branch:** `claude/phase0-archetype-anatomy`, cut from `origin/main` at `57f50409` (#1078) · **Mode:** read-only. No source, test, flag, rule or config change; no deploy; no production write; no model call. The only file written in the repository is this report.

**Answers:** the discovery prompt *Archetype anatomy* of 17 Nov 2026 (Fable, the architecture review chat), Parts A–F. The founder's question: do the archetypes know strategies and plans, or do they read indicators and judge from there? This report records what is there. It designs nothing.

## Preamble

- **Session opening (BUILD_RULES §2, §3).** `git fetch origin` ran first. Branch `claude/phase0-archetype-anatomy`, HEAD `57f50409a57d5b931ab4679e570b09f811591bdf`, equal to `origin/main`; tree clean. The worktree had been opened on `claude/phase0-archetype-anatomy-63b3db` at the same commit; the named branch was cut from `origin/main` before any read.
- **How the code was read.** Five readers each took part of the tree at HEAD (A2/A3/A4; A5/A6/A7; B; D/E; F) and returned each finding as a file, a line and the exact text of that line. The coordinator read the identity, scoring, config, menu and tick-capture modules and the eval system prompt in full, and re-checked every weight-bearing citation in this report with a quote checker (`checkcites.mjs`, kept outside the repository; result in the Method appendix).
- **Markers.** A `path:line` citation is **VERIFIED**: the line was read at HEAD this session and holds what is said. **MEASURED** marks a production read made this session (the Method appendix lists each script). **INFERRED** marks a conclusion drawn from code without running it. **Not verified** is said where it applies.
- **Production.** Project `tradeseven`, read on the morning of 17 Nov 2026 (ET) with `count()`, `select().get()`, `where().get()` and `doc().get()` only. Twelve scripts, each passed a write-verb grep before it ran. Credentials were parsed in place by `node --env-file` from the main checkout's `.env.local`, never printed or copied. No index was created.
- **No model call and no spend.** Token counts are estimates (Part C says how). Nothing was replayed.
- **Account ids.** None appears here or in any script output. Owners are labelled *founder* and *FT_QA* (resolved in-process from an archived dump of an earlier approved read) and *other-N* ordinals. No player-written text is quoted. The model's own stated reasons are quoted, one sentence at most.
- **Not run.** No test, lint or build: the change is one Markdown file under `docs/`, and the stylesheet scan excludes `docs/` (`src/index.css:9` — `@source not "../docs";`). The Vercel preview build is the check.

---

## An archetype today, in plain terms

1. An archetype is made of four things that reach a live trade: **a paragraph of identity text** the model reads at every check (about 170–220 tokens); **a starter set of three "traits"** that equip 5–8 Forge rules, printed as rule text (another 220–410 tokens) — together 3–5% of each request; **three speed-and-caution numbers** that code applies without telling the model (how soon a quiet stock is forced out, how much better a replacement must be, how many swaps per hour); and **a ranking recipe used once, when the portfolio is built**.
2. Everything else in the archetype tables either feeds that first portfolio build, is shown on a screen, or is read by nothing. Five per-archetype settings have no live reader at all, including the "favoured strategies" lists and the per-archetype conviction bars.
3. **Strategies live in the text, not in code.** One shared menu of five named strategies (S1 Volatility Squeeze Breakout, S2 Breakout Confirmation, S3 RS Momentum Pullback, S4 Mean Reversion, S5 News-Catalyst Momentum) is printed identically into every archetype's prompt; code sorts each stock into one of four "regimes" and the prompt says which strategy fits which regime. On top of that, some archetypes' starter rules name setups of their own — the Speculator's are squeeze and narrow-range breakouts, the Contrarian's oversold and lower-band entries, the Trend Follower's trend, 52-week-high breakout and pullback hold. Those are sentences the model is asked to follow, nothing more.
4. **No code detects any of those five strategies on a stock.** Code supplies the ingredients (squeeze percentile, a narrow-range flag, relative strength, volume ratio, RSI) and the model decides whether the setup is there. A few fixed alarms (a held stock entering a squeeze or a narrow-range day, a large gap from VWAP, a news story) wake the agent up, the same for all six.
5. **The model never sees a price chart.** It sees one row of computed readings per stock: today's move, ATR, RSI, band position, scores and so on. It judges from those numbers.
6. **Three of the six are mechanically identical at trade time.** Fundamental Investor, Contrarian and Diversifier carry exactly the same speed-and-caution numbers; once a battle is running, what separates them is text — the identity paragraph and the starter rules. Speculator is the loosest, Trend Follower next, Capital Preserver the tightest.
7. **The archetype's own code trades more often than the model does.** Of the 151 swaps made since 15 Sep, 84 (56%) came from the archetype's "forced rotation" rule (a stock that sat still too long is swapped out by code), 55 from the model and 12 from the risk manager (MEASURED).
8. **The swap-in menu mid-battle is the same for all six.** The archetype-aware version is built but switched off; the live list is sorted by one shared fit score.
9. **The model already names a "strategy" on its notable decisions,** in a free-text field. Production holds 161 different spellings in 334 decisions, led by "Momentum Rotation". One screen displays it; nothing grades or acts on it, and the 84 code-made swaps carry none.
10. **There is no plan with follow-through.** A swap records a thesis, a strategy label and a one-line "hypothesis", but no exit condition and no time limit. After the battle the model grades its own hypotheses (MEASURED: 205 grades, 105 "incorrect"); no code ever checks a decision against the strategy it named.
11. **What the model says drives it is mostly the scoring cliff,** not a setup. In a hand-read sample of 60 recent reasons, 36 lead with distance to a penalty or bonus line, 10 with a named pattern (all ten name "NR7", the one pattern code does flag), 10 with indicator readings, 2 with the archetype itself and 1 with a Coach directive.
12. **The Forge already holds strategy-shaped rules** that players equip (19 of 22 human agents carry some). Every equipped rule reaches the model only as a sentence it is told to follow, including the ones headed "must obey"; code never checks a rule. The stop and target values code does enforce arrive by a separate settings path, not by equipping the rule.

---

## 1. Verdicts

| Part | Question | Answer in one sentence |
|---|---|---|
| **A** | What is an archetype made of? | Identity text and three starter traits printed as 5–8 rules (live, text), three tick-time knobs enforced by code but never told to the model (live), a deploy-time ranking recipe, temperature and shortlist constraint (deploy only), and seven settings that are dead or display-only; at trade time Fundamental Investor, Contrarian and Diversifier differ only in text. |
| **B** | What strategy layer exists? | 143 rule templates and 18 offered collections; every equipped rule reaches the trader as prompt text only (0 enforced by code, 0 parameters read by code, 117 rendered as text, 26 season rules not offered); about thirty rules name a setup, and code computes some of their ingredients whether or not the rule is equipped; 19 of 22 human agents carry rules; attribution is per battle and per captured check, not per decision. |
| **C** | What does a real decision look like? | 11 requests read (no Capital Preserver swap exists: 0 of its 22 answered checks proposed one); 3.2–5.1% of each request is archetype-specific (the identity text plus the starter trait rules), 51–61% is shared rules and the tool schema, 17–29% is per-stock facts; between two archetypes in the same session only the identity paragraph and the opening line differ in the system prompt; stated reasons lead with the penalty/bonus line 36 times in 60. |
| **D** | What is the model given to recognise a pattern? | One row of computed readings per stock and no price history; held and bench stocks get different readings, so the prompt's own strategies ask for readings the model lacks on one side; NR7, squeeze percentile and support levels are the only detector outputs that reach it; the setup evaluator and the intraday facts do not; the volume tier is neutralised to about NORMAL during the session; both intraday flags are off. |
| **E** | Plans and follow-through? | A swap records a motive (four values), a free-text strategy (161 spellings in production) and a one-line hypothesis that the model grades itself after the battle (205 graded, 105 "incorrect"); a swap has no exit condition and no time limit (only called shots do); the Film Room tape groups by archetype, exit mechanism and tier, never by strategy; the July evidence layer exists only in its design document. |
| **F** | What crosses into a battle? | No knowledge-base method reaches the trading call (`KB_APP_USE` is empty); sixteen routes were checked, ten render text into the trading prompt, and the player's own words reach it directly only through rules they write in the Forge (7 such rules are equipped) and indirectly through the deploy brief, which reads their watchlist's name and thesis. |

---

## 2. Part A — what an archetype is made of

**In plain terms.** Much of what makes an archetype different happens before the battle starts, when its portfolio is picked. Once trading starts, the model gets one paragraph that describes the archetype's personality plus the five to eight rules its three starter traits equip, and code quietly applies three numbers that set how fast the agent rotates and how picky it is. Several settings that look important in the tables (favoured strategies, conviction bars, trade frequency) are not read by anything.

**Path note.** The prompt places the trading call in `decide.js`. At HEAD `api/agent/decide.js` is the **deploy** call (portfolio build); the 15-minute trading call is `api/cron/agent-evaluate.js:3342` — `response = await anthropic.messages.create({`, with the system prompt built at `api/cron/agent-evaluate.js:3279` — `const systemPrompt = buildEvalSystemPrompt(agentName, archetype, battle.gameMode, ctx.archetype, { measuredStockReward: correctedStockGame });`. Every path the prompt named resolves at HEAD; `SETUP_MENU_LABELS_ENABLED` lives in `src/config/setupMenuLabelsFlags.js:31`, not `featureFlags.js`.

### A1. Identity text

The block renders on every trading check: `src/config/featureFlags.js:1680` — `export const EVAL_IDENTITY_BLOCK_ENABLED = true;`, spliced at `api/_utils/agentEvalPromptAssembly.js:359` — `const identityBlock = renderEvalIdentityBlock(archetypeKey);`. Each render is followed by one shared clause, `api/_utils/evalIdentityBlocks.js:58` — `'Platform limits and enforced values override this identity. Your equipped rules refine how you apply these principles but never reverse them.';` (141 characters, about 32 tokens), chosen at `api/_utils/evalIdentityBlocks.js:79` because `src/config/featureFlags.js:2164` — `export const EQUIPPED_RULE_PRECEDENCE_ENABLED = false;`.

Length, estimated with the repository's own recorded equivalence (`api/_utils/evalIdentityBlocks.js:24` — `1050 chars ≈ 240 tokens`; 1,050 characters ≈ 240 tokens):

| Archetype (code id) | Render | Characters | ≈ Tokens |
|---|---|---|---|
| Trend Follower (`momentum_chaser`) | `api/_utils/evalIdentityBlocks.js:103` | 922 | 211 |
| Contrarian (`contrarian`) | `api/_utils/evalIdentityBlocks.js:110` | 957 | 219 |
| Diversifier (`diversifier`) | `api/_utils/evalIdentityBlocks.js:117` | 852 | 195 |
| Speculator (`degen`) | `api/_utils/evalIdentityBlocks.js:124` | 742 | 170 |
| Fundamental Investor (`analyst`) | `api/_utils/evalIdentityBlocks.js:131` | 919 | 210 |
| Capital Preserver (`guardian`) | `api/_utils/evalIdentityBlocks.js:138` | 832 | 190 |

Measured in production, the identity section (banner, render and clause) takes 294–365 of 15,015–18,995 input tokens per request (Part C1).

**Every sentence that tells the model to do or not do something**, quoted from the render lines above:

- **Trend Follower.** "Edge: strength persists; join confirmed strength, never predict turns." · "Fundamentals never rescue weak trend evidence." · "Holding: every position rests on two legs — sector context and the stock's own chart; both hold → hold; both break → exit; one breaks → hold and surface it, never act on silence." · "Time: evidence lives at the tape's tempo — days, not quarters; stalls rotate briskly." · "Error preference: late and confirmed beats early and wrong." · "Never: buy weakness or bottom-fish; fade or short strength; hold a broken chart because it's "cheap"; abandon trend-following on command — refuse in character, propose an in-style alternative."
- **Contrarian.** "Edge: crowds overshoot; buy the abandoned-but-not-broken before the crowd forgives." · "Dislocation is judged at the name, never the sector: a washed-out name in a strong sector is a valid setup." · "Entry requires both a recovery reason and a technical turn." · "Error preference: early with a stop beats right without one." · "Never: chase a name that's already run; buy cheap without a recovery reason; override the stop in either direction; abandon contrarian discipline on command — refuse in character, propose an in-style alternative."
- **Diversifier.** "4) quality and volatility — non-gating: no quality floor, no volatility ceiling." · "Shape outranks selection: the best name in a crowded sector loses to an adequate name in an empty one." · "Exits are shape-driven, not thesis-driven." · "Never: concentrate for upside; push a sector past the cap; substitute a quality floor for spread; abandon breadth on command — refuse in character, propose an in-style alternative."
- **Speculator.** "Edge: movement is the opportunity — be in the names that swing hardest while they swing." · "4) fundamentals — EXCLUDED at weight zero: quality is not weak evidence, it is not evidence." · "Nothing outranks volatility." · "Error preference: wrong fast and cheap beats right slowly; the one unaffordable error is dying on one trade." · "Never: buy boring or stable names; treat company quality as a reason; widen the stop to stay in a loser; fake safety — protection isn't the job, say so and point to the user's own levers; abandon the volatility hunt on command — refuse in character, propose an in-style alternative."
- **Fundamental Investor.** "1) business quality — the admission test, two-tier: below 40 is refused outright; the book's core is names above 70; the 40–70 band is reachable but never chosen on chart heat" · "Quality tests first, technicals time; the order isn't negotiable." · "Weak technicals do NOT invalidate the quality thesis — they bear on timing and opportunity cost." · "On a clock, quality going nowhere loses to quality setting up." · "Never: buy below 40; let a hot chart talk you into a 40–70 mediocre business; trade on the tape's excitement; drop the standard to find action; abandon quality-first discipline on command — refuse in character, propose an in-style alternative."
- **Capital Preserver.** "Edge: not losing compounds, and patience is how — hard to enter, hard to shake out." · "2) volatility profile — low-beta required, high-ATR actively avoided" · "Safety outranks opportunity, always." · "NOISE IS NOT EVIDENCE: a bad week is not deterioration — only a fundamental crack or a genuine risk-level breach counts as damage." · "Never: chase the juice; trade fast; get shaken out by noise; treat lagging as a reason to change; abandon protect-first on command — refuse in character, propose an in-style alternative."

Two more archetype-specific lines reach the trading prompt: `api/_utils/agentEvalPromptAssembly.js:363` — `Your archetype is ${archetype}.` and `api/_utils/agentEvalPromptAssembly.js:753` — `Archetype: ${archetype}`. Both print the code id with its first letter capitalised ("Momentum chaser", "Degen", "Guardian"), not the display name (`api/cron/agent-evaluate.js:3140` — `const archetype = (ctx.archetype || 'unknown').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());`), while the identity block names "Trend Follower", "Speculator", "Capital Preserver". The model is given two names for itself.

Several of these sentences ask the model to weigh evidence it is never given at trade time: beta, earnings dates, stop levels, the quality score. Part D1 lists each.

### A2. Scoring weights

`api/_utils/archetypeScoring.js:15` — `export const ARCHETYPE_WEIGHTS = {`. Six dimensions; the V2 vectors are off (`src/config/featureFlags.js:2102` — `export const ARCHETYPE_VECTORS_V2_ENABLED = false;`, read at `api/_utils/archetypeScoringV2.js:57`), so every call runs these V1 weights.

| Dimension | Trend F. | Contrarian | Diversifier | Speculator | Fund. Inv. | Cap. Pres. |
|---|---|---|---|---|---|---|
| fundamentalScore | 0.05 | 0.15 | 0.25 | 0.00 | 0.40 | 0.30 |
| technicalScore | 0.40 | 0.10 | 0.20 | 0.15 | 0.30 | 0.20 |
| baggerBombFit | 0.30 | 0.15 | 0.20 | 0.25 | 0.15 | 0.10 |
| atrPercentile | 0.25 | 0.20 | 0.05 | 0.60 | 0.05 | 0.05 |
| inverseComposite | 0.00 | 0.40 | 0.00 | 0.00 | 0.00 | 0.00 |
| sectorDiversity | 0.00 | 0.00 | 0.30 | 0.00 | 0.10 | 0.35 |

(`api/_utils/archetypeScoring.js:16–63`.) An unknown archetype falls back to the Fundamental Investor's weights (`api/_utils/archetypeScoring.js:110` — `const weights = ARCHETYPE_WEIGHTS[archetype] || ARCHETYPE_WEIGHTS.analyst;`).

Where the ranks are consumed:

| Moment | Site | What the model sees |
|---|---|---|
| **Deploy** (portfolio build) | `api/agent/decide.js:371` — `const rankedStocks = computeArchetypeRankings(stockUniverse, archetype);` | **The score itself**, one decimal per stock: `api/_utils/agentPromptAssembly.js:249` — `const arch = s.archetypeScore != null ? s.archetypeScore.toFixed(1) : '-';`, with the instruction `Use it as your primary sorting signal.` (`api/_utils/agentPromptAssembly.js:39`). The deploy hot bench is Sonnet's shortlist (`api/agent/decide.js:667` — `let hotBench = strategy.shortlist`). |
| **Mid-battle swap-in menu** | `api/_utils/archetypeCandidateMenu.js:24`, dark (A5) | Nothing — the live menu is sorted by `baggerBombFit` for everyone. |
| **The trading prompt** | none | **No score, rank or archetype order.** The bench row is `api/_utils/agentEvalPromptAssembly.js:1513` — `const header = 'BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status';`; the only rank shown is technical (`api/_utils/agentEvalPromptAssembly.js:1741`). |
| Other (not the trading path) | persisted `arch_scores` (`api/cron/compute-index-intelligence.js:1477`), scouting board (`api/agent/scouting-board.js:114`), League boards and draft (`api/_utils/tournamentAgentBoards.js:468`, `api/_utils/tournamentAgentDraft.js:262`, `api/_utils/tournamentBoardAutoCommit.js:162`), training draft (`api/_utils/trainingLifecycle.js:326`) | — |

The V2 math still runs every night as a stored side copy (`api/cron/compute-index-intelligence.js:568`, `:581` — `stock.arch_scores_v2 = bySymbol[stock.symbol] || {};`); its only reader is an observation snapshot (`api/_utils/rankingSnapshots.js:112`). It reaches no ranking and no prompt.

**Temperatures** (`api/_utils/archetypeScoring.js:69`) reach the **deploy** calls only (`api/agent/decide.js:372`, `:445` Sonnet, `:570` Haiku). The trading call sends 0.4 for every archetype: `api/cron/agent-evaluate.js:3345` — `temperature: 0.4,` (MEASURED: all 11 captured requests in Part C carry 0.4). **Shortlist constraints** (`api/_utils/archetypeScoring.js:81`) go to the deploy Sonnet call only (`api/_utils/agentPromptAssembly.js:39`, called at `api/agent/decide.js:430`).

### A3. Mechanical numbers — `ARCHETYPE_CONFIGS`

Resolved each check at `api/cron/agent-evaluate.js:2038` — `const baseArchetypeConfig = getArchetypeConfig(ctx.archetype);`, then scaled by the player's tempo dial (`src/config/featureFlags.js:754` — `export const TEMPO_DIAL_ENABLED = true;`; clamp at `api/cron/agent-evaluate.js:2050`; measured ×0.7, aggressive ×1.3 at `api/_utils/tempoDialBands.js:34`, `:36`). Values below are at standard tempo.

| Field | Live reader | Class |
|---|---|---|
| `hftConfig.forcedRotation` | `api/_utils/agentRiskManager.js:184` — `const fr = archetypeConfig?.hftConfig?.forcedRotation;` | **Enforced by code**, never told to the model |
| `hftConfig.hurdleFloor` | `api/_utils/agentRiskManager.js:362`; model swaps at `api/cron/agent-evaluate.js:3996` — `const hurdle = clearsHurdleFloor({` | **Enforced by code**, never told |
| `hftConfig.swapWindow` | `api/cron/agent-evaluate.js:2180` — `const swCfg = archetypeConfig.hftConfig?.swapWindow;`; model swaps at `:4018` | **Enforced by code**, never told |
| `sectorConcentrationCap` | only the Diversifier's value, only in League, only recording: `api/_utils/agentGuardrails.js:111` — `if (battle?.gameMode !== TOURNAMENT_GAME_MODE) return null;`, `:113`, and `src/config/featureFlags.js:970` — `export const SECTOR_CAP_MODE = 'observe';` | Records a "would block"; blocks nothing. The other five values have no trading-path reader (Practice Field reads them, `api/_utils/mandateVintage.js:96`) |
| `convictionMods` | pass-through only (`api/_utils/archetypeRegistry.js:149`); the live bar is 70 for all (`api/_utils/agentSwapExecution.js:84` — `if (decision.conviction < 70) {`) | **Dead** |
| `regimePreferences` (favoured / avoided strategies, `canEnterDistressed`) | pass-through only (`api/_utils/archetypeRegistry.js:150`) | **Dead** |
| `tradeFrequency` | none | **Dead** |
| `defaultPreset` | a display fingerprint (`api/_utils/behaviorFingerprint.js:157`); every battle starts `balanced` (`api/_utils/agentBattleService.js:287` — `strategyPreset: 'balanced',`) and the tick reads the battle's preset (`api/cron/agent-evaluate.js:1287`) | **Display only** (MEASURED: all 19 recent non-League battles `balanced`) |
| `defaultConfig` | fallback profiles only (`api/agent/create-profile.js:111`); becomes the "Risk Tolerance" line (`api/_utils/agentEvalPromptAssembly.js:754`) | Stated in text, conditional |
| `avatarColors` | `api/_utils/archetypeRegistry.js:160` | Display only |
| `label` | logs and chat (`api/cron/agent-evaluate.js:2063`) | Not in the trading prompt |
| `KNOB_CONFIG_VERSION` (= 2) | tempo-dial pairing gate (`api/_utils/tempoDialClamp.js:90`); stamped on the battle (`api/_utils/resolvedAgentManifest.js:187`) | Provenance |

The header's "regime router" (`api/_utils/agentArchetypeConfig.js:3` — `// Each archetype has real mechanical effects on the regime router,`) is half true: the regime **classifier** runs on every check (`api/cron/agent-evaluate.js:1934` — `if (techScore) stockRegimes[symbol] = classifyStockRegime(techScore);`), but the strategy **router** is imported and never called (`getPresetAdjustedStrategies`, `api/cron/agent-evaluate.js:105`), and it would read the preset's list, not the archetype's (`api/_utils/agentRegimeClassifier.js:125` — `const regimeConfig = presetConfig.regime || {};`).

### A4. Voice and adjustment zones — `src/data/archetypeAdjustments.js`

It holds, per archetype, four prose "zones" (immutable core, tunable execution, protected bias, user lever), a cautious-register list and an allowlist of adjustments, each with a fixed canonical sentence (`src/data/archetypeAdjustments.js:71` — `export const ARCHETYPE_ADJUSTMENTS = {`). The zones prose goes to the chat voice layer only (`api/_utils/voiceLayerPrompt.js:22`). The canonical sentences do reach the trading call, as the text of a Coach directive or a standing lean the player picked from that archetype's allowlist (written at `api/agent/file-directive.js:235` and `api/_utils/leanRevalidation.js:274`; rendered at `api/_utils/agentEvalPromptAssembly.js:1246`–`1247`). So the archetype decides **which** adjustments a player may give it; the adjustment reaches the model as text.

### A5. Candidate menus

`src/config/featureFlags.js:2114` — `export const ARCHETYPE_REFRESH_MENU_ENABLED = false;` makes the builder return null (`api/_utils/archetypeCandidateMenu.js:17`). The caller (`api/cron/agent-evaluate.js:1731`) then runs the legacy policy: `api/cron/agent-evaluate.js:1751` — `.sort((a, b) => (b.baggerBombFit || 0) - (a.baggerBombFit || 0));`, top 15 (`:1758`), monitoring next 18 (`:1781`). No archetype input. `src/config/setupMenuLabelsFlags.js:31` — `export const SETUP_MENU_LABELS_ENABLED = false;` gates labels written to the check record only (`src/config/setupMenuLabelsFlags.js:20` — `The agent never sees a label.`), for Trend Follower battles only.

**Answer: yes, with flags as on `main` the mid-battle swap-in list is the same ordering for all six.** Two archetype traces survive: the **bench** chosen at deploy (archetype-ranked) is never rebuilt (`api/cron/agent-evaluate.js:1750` excludes bench symbols from the refresh), and the deploy-time hot bench lasts until the first check that reads fresh rankings (`api/cron/agent-evaluate.js:294`, `:1812`) — INFERRED to be the first check of the battle in most cases.

### A6. Guards

| Guard | Trend F. | Contrarian | Diversifier | Speculator | Fund. Inv. | Cap. Pres. | Enforcement site |
|---|---|---|---|---|---|---|---|
| Forced rotation: quiet-move threshold / quiet checks / winner exemption | 0.15% / 5 / 0.15% | 0.3% / 6 / 0 | 0.3% / 6 / 0 | 0.1% / 3 / 0.2% | 0.3% / 6 / 0 | **off** | `api/_utils/agentRiskManager.js:185`–`189`; config `api/_utils/agentArchetypeConfig.js:49`, `:80`, `:109`, `:136`, `:165`, `:199` |
| Hurdle floor (ATR multiple a replacement must clear): model swap / stagnation | 0.35 / 0.5 | 0.4 / 0.5 | 0.4 / 0.5 | 0.2 / 0.3 | 0.4 / 0.5 | 0.5 / 0.5 | `api/_utils/agentRiskManager.js:362`–`384`; replacement must be up on the day (`:366`); emergencies bypass (`:342`) |
| Swap window (cap per window) | 6 / 60 min | 4 / 60 | 4 / 60 | 12 / 60 | 4 / 60 | 2 / 120 | `api/cron/agent-evaluate.js:2183` (rotations), `:4018` (model swaps) |
| Sector cap | 3 | 3 | 2 | 4 | 3 | 2 | Diversifier in League only, observe mode (A3) |
| Conviction bar | 70 | 70 | 70 | 70 | 70 | 70 | `api/_utils/agentSwapExecution.js:84`; the per-archetype 1.15 / 0.85 / 1.2 values are dead |
| Directive / lean allowlist | per archetype | per archetype | per archetype | per archetype | per archetype | per archetype | chat time, `api/_utils/directiveGate.js:148` (`ARCHETYPE_INTEGRITY_MODE = 'enforce'`, `src/config/featureFlags.js:801`) |
| Rule-compatibility block | per archetype | per archetype | per archetype | per archetype | per archetype | per archetype | rule-authoring time only (`src/services/ruleCompatEvaluate.js:101`; `src/config/featureFlags.js:997` — `export const RULE_COMPAT_MODE = 'enforce';`) |

None of the three tick knobs is stated to the model (a grep for `hftConfig|capPerWindow|hurdleFloor|forcedRotation` in the eval prompt assembly, identity and control renderer returns nothing). The only guard the prompt does state is the conviction bar, and it states the shared 70 (`api/_utils/agentEvalPromptAssembly.js:393`), not the dead per-archetype values. Contrarian's dead `canEnterDistressed: true` (`api/_utils/agentArchetypeConfig.js:133`) is contradicted by the shared `STRICT EXCLUSION` line (`api/_utils/agentEvalPromptAssembly.js:431`); the shared line is what the model reads.

A reader noted that the hurdle and swap-cap calls appear in `agent-evaluate.js` only on the stagnation and model-swap paths; whether the proposal, gameplan and deterministic paths are gated elsewhere is **not verified**.

### A7. Anything else that branches on the archetype

- **Born-with ("starter") traits** (rules with provenance `archetype_default`, `src/data/traitEquip.js:73`): three traits per archetype (`src/data/traitLibrary.js:519`–`526`), seeded at the agent's birth (`api/_utils/archetypeSeeding.js:164`) and resolved into the equipped rules at deploy (`api/agent/decide.js:271` — `resolveForDeploy(projected, ruleDocs, agent.equippedTraits, {`). They reach the model as rule text only (Part B2). MEASURED (`b4_traits.mjs`, each battle's rule ids joined to the agent's rule documents): **all 40 non-League battles since 15 Sep carry them, 5–8 rules each.** What each archetype carries in production:

| Archetype | Starter rules carried (template — headline) | Strategy-shaped? |
|---|---|---|
| Trend Follower | tech-moving-average-trend — Follow the trend; tv-01 — RSI Momentum Zone; tv-11 — 52-Week High Breakout Preference; tv-02 — MACD Histogram Acceleration; t-11 — Follow institutional accumulation; tv-08 — Low Volume Pullback Hold; mb-08 — Let winners run; th-01 — Hold near the bonus line | **Yes** — trend, 52-week-high breakout, pullback hold |
| Speculator | t-12 — Catch the volatility squeeze; tv-05 — Squeeze Direction Filter; t-15 — Catch the narrowest range breakout; tv-11; tv-02; t-11; mb-03 — Replace dead money; ts-04 — Star goes to the hottest stock | **Yes** — squeeze, narrow-range breakout, 52-week-high breakout |
| Contrarian | tech-rsi-oversold — Buy oversold stocks; tv-06 — Bollinger Lower Band Entry; fund-value-pe — Hunt for undervalued stocks; mb-09 — Pull the emergency brake; mb-04 — Demand proof before swapping; mb-07 — Stop the churn; ts-07 — Demote before the penalty hits; ts-01 — Keep wild stocks out of Star | **Yes** — oversold / lower-band reversion, value |
| Fundamental Investor | tv-10 — Earnings + Technical Confluence; tv-12 — Multi-Factor Tier Assignment; tv-03 — MACD Zero-Line Bounce; mb-01 — Give your pick time to work; mb-08; mb-09; mb-04; mb-07 | Partly — earnings-plus-technical confluence, MACD zero-line bounce |
| Diversifier | tv-14 — Sector Leader Selection; a-08 — Ride the sentiment tailwinds; alloc-even-spread — Keep it balanced; a-09 — Build a versatile bench; r-07 — Avoid hidden correlation traps; i-05 — Active Fund Overlap Guard (3 of 8 battles) | No — allocation and risk |
| Capital Preserver | risk-sector-diversification — Spread your bets; alloc-sector-cap — Cap your sector exposure; alloc-even-spread; mb-09; mb-04; mb-07; ts-07; ts-01 | No — risk and allocation, printed under "must obey" and not enforced |

The carried sets are what each agent was seeded with; some differ from today's library (for example Bargain Hunter now lists tv-07 where live Contrarian agents carry fund-value-pe).
- **Huddle plans** carry per-archetype dissent rows (`api/_utils/huddle/dissentTable.js:21`) and file into the directive slot (`api/_utils/huddle/applyPlan.js:104`).
- **Trend Follower only:** setup labels (dark, record-only) and the activation-evidence observer (`api/_utils/activationEvidence/scope.js:30`), record-only.
- **Records only:** swap receipts name the archetype when the archetype's rotation made the swap (`api/_utils/agentRiskManager.js:575` — `archetype: source === 'archetype' ? (archetype || null) : null,`).
- **The swap executor** has no archetype branch (`api/_utils/agentSwapExecution.js`, zero matches).

### Part A output — the matrix

| Ingredient | Trend F. | Contrarian | Diversifier | Speculator | Fund. Inv. | Cap. Pres. | Reaches a live trade as |
|---|---|---|---|---|---|---|---|
| Identity paragraph | trend | dislocation | breadth | volatility | quality | safety | **stated in text** (every check) |
| Name in prompt | "Momentum chaser" | "Contrarian" | "Diversifier" | "Degen" | "Analyst" | "Guardian" | stated in text |
| Forced rotation | 5 checks | 6 | 6 | 3 | 6 | off | **enforced by code** (makes swaps itself) |
| Hurdle floor | 0.35 ATR | 0.4 | 0.4 | 0.2 | 0.4 | 0.5 | **enforced by code** |
| Swap cap | 6/h | 4/h | 4/h | 12/h | 4/h | 2/2h | **enforced by code** |
| Ranking weights | technical-led | inverse-composite-led | sector-rarity-led | ATR-led | fundamental-led | sector + fundamental | deploy only (score shown to the deploy model) |
| Temperature | 0.3 | 0.6/0.7 | 0.4/0.5 | 0.8/0.9 | 0.2 | 0.2/0.3 | deploy only; trading call 0.4 for all |
| Shortlist constraint | top sectors | bottom sectors | ≥7 sectors | ATR > 0.80 | fund. > 70 | fund. > 60, low ATR | deploy only, stated in text |
| Starter traits (5–8 rules) | trend, 52w breakout, pullback | oversold, lower band, value | sector leader, allocation | squeeze, NR7 breakout | confluence, MACD bounce | risk, allocation | **stated in text** (every check; A7) |
| Adjustment allowlist | own list | own list | own list | own list | own list | own list | enforced at chat/equip; canonical sentence stated in text |
| Sector cap | 3 | 3 | 2 | 4 | 3 | 2 | Diversifier in League only, observe: **display/record only** |
| Conviction mods | — | rs −0.5 | — | 0.85 | 1.15 | 1.2 | **dead** |
| Favoured / avoided strategies | squeeze, 52w high | VWAP reversion | RS momentum | squeeze, 52w, news | — | RS / avoid squeeze | **dead** |
| Trade frequency | high | moderate | moderate | highest | moderate | low | **dead** |
| Default preset | aggressive | balanced | balanced | aggressive | balanced | defensive | **display only** |
| Mid-battle menu order | shared | shared | shared | shared | shared | shared | archetype version dark |

**What makes each one mechanically different today, in one sentence:**

- **Trend Follower:** a quiet stock is forced out after 5 checks under 0.15%, a replacement must clear 0.35 ATR, up to 6 swaps an hour; its first portfolio is ranked mostly on technical score.
- **Contrarian:** its first portfolio is ranked 40% on the *inverse* of the composite score; at trade time its knobs are identical to the Fundamental Investor's and the Diversifier's.
- **Diversifier:** its first portfolio is ranked 30% on sector rarity; at trade time its knobs are identical to two others, and the sector cap that would set it apart only records, only in League.
- **Speculator:** the loosest knobs (out after 3 quiet checks, 0.2 ATR hurdle, 12 swaps an hour) and a first portfolio ranked 60% on volatility and 0% on fundamentals.
- **Fundamental Investor:** its first portfolio is ranked 40% on fundamentals; at trade time nothing in code enforces its "below 40 is refused" line, and its knobs match Contrarian's and Diversifier's.
- **Capital Preserver:** never force-rotated, the highest hurdle (0.5 ATR) and at most 2 swaps per two hours; MEASURED, it proposed 0 swaps in 22 answered checks and made no trade in a non-League battle since 15 Sep.

---

## 3. Part B — the strategy layer that already exists

**In plain terms.** The Forge is a library of 143 rules, grouped into 18 offered collections, that players attach to an agent. Every rule a player equips reaches the trader as one more sentence in its instructions — split into "must obey" and "should follow" headings — and nothing in code checks whether the model obeyed. About thirty rules describe a trading setup (a squeeze, a narrow-range day, a VWAP reclaim, a 52-week-high breakout). For some of these, code calculates the ingredients for every stock anyway; for none of them does code confirm the setup or act on it.

### B1. Inventory

**Rules.** `src/data/forgeKnowledgeBase.js`, export `FORGE_RULE_TEMPLATES`: 143 templates, unique ids, grouped by the field `category` (counted by `node` import at HEAD):

| Category | Rules | Category | Rules |
|---|---|---|---|
| technical | 25 | tier_strategy | 10 |
| mid_battle | 16 | institutional | 10 |
| fundamental | 14 | entry_criteria (season) | 8 |
| risk | 12 | threshold | 8 |
| allocation | 11 | exit_stops (season) | 7 |
| game_state | 11 | season_state (season) | 6 |
| | | rebalancing (season) | 5 |

No template carries a binding, enforcement or kind field.

**Collections.** `src/data/forgeCollections.js:1190` — `export const OFFERED_COLLECTIONS = FORGE_COLLECTIONS.filter((c) => !c.retired);`: 21 defined, 18 offered, 3 retired (day-trader, vwap-warrior, value-investor). Offered, with their rules:

| Collection | Rules |
|---|---|
| swing-trader | tech-rsi-oversold, tech-moving-average-trend, tv-01, t-11, mb-01, mb-08, mb-09, th-01, ts-04 |
| momentum-rider | tech-bollinger-squeeze, tech-macd-bullish, t-11, t-12, mb-08, mb-11, th-04, ts-04, mb-04 |
| defensive-fortress | tech-rsi-overbought, mb-09, mb-07, th-05, th-07, ts-07, risk-sector-diversification, a-09, ts-09 |
| trend-surfer | tech-moving-average-trend, tv-01, mb-09, t-11, tech-macd-bullish, ts-02, tv-03, mb-01, mb-08 |
| squeeze-hunter | t-12, tv-05, mb-09, t-15, a-05, ts-02, th-01 |
| oversold-sniper | tech-rsi-oversold, tv-06, mb-09, t-13, t-12, tv-08, ts-07 |
| volume-detective | t-14, tv-13, mb-09, tv-08, tv-02, a-06, mb-04 |
| rs-leader | t-11, tv-11, mb-09, tv-14, tv-10, a-08, ts-04 |
| triple-threat | tv-12, tech-moving-average-trend, t-14, tv-01, tv-02, mb-04, mb-01, mb-09 |
| baggerbomb-native | th-01, a-05, mb-09, tv-15, ts-01, th-10, ts-07, gs-08, gs-03 |
| defensive-playbook | risk-sector-diversification, r-06, r-09, alloc-even-spread |
| momentum-hunter | tech-moving-average-trend, tech-bollinger-squeeze, tech-volume-surge, tech-macd-bullish |
| contrarian-edge | tech-rsi-oversold, tech-rsi-overbought, risk-avoid-declining-trend |
| conviction-plays | alloc-tier-preference, alloc-sector-cap, tech-relative-strength, alloc-sector-minimum |
| battle-tactics | mb-01, mb-04, mb-07, mb-09, mb-10, mb-15 |
| game-clock-plays | gs-01, gs-02, gs-03, gs-10 |
| threshold-hunters | th-01, th-04, th-07, th-09, th-10 |
| tier-master | ts-01, ts-04, ts-05, ts-07, ts-09 |

**Caps.** Bundles: at most 5 equipped, 10/15/20 rules per bundle by level (`src/constants/agentProgression.js:54` — `rookie:  { maxBundles: 5, maxRulesPerBundle: 10 },`), enforced at `api/agent/equip-bundle.js:164` — `if (currentEquipped.length >= limits.maxBundles) {`. Leans: 2 (`api/_utils/leanRevalidation.js:31` — `export const STANDING_LEANS_CAP = 2;`), enforced at `api/agent/equip-lean.js:206`.

**DNA traits still exist.** 17 traits in `src/data/traitLibrary.js`, each naming 2–3 rule templates; every archetype is born with three (`src/data/traitLibrary.js:518` — `export const ARCHETYPE_DEFAULT_TRAITS = {`; seeded rule ids `api/_utils/archetypeSeeding.js:164`). The trait slot is hidden in the UI (`src/config/featureFlags.js:118` — `export const TRAIT_SLOT_ENABLED = false;`), but seeded traits still compile: equipping one writes rule documents keyed by `traitId`, which are projected into the agent's equipped rules (`api/_utils/projectActiveRules.js:97`) and from there into the prompt as text. They compile to **nothing but rule text**. MEASURED: every non-League battle since 15 Sep carries 5–8 of them (A7 lists them by archetype); 138 of the 425 rules equipped on human agents are trait rules.

### B2. How a rule reaches a decision

The live path: rule documents are projected onto the agent at deploy (`api/agent/decide.js:271`), frozen onto the battle (`api/_utils/agentBattleService.js:196` — `activeRules: agentData.activeRules || [],`) and printed at every check: `api/_utils/agentEvalPromptAssembly.js:804` (hard rules, under `== CONSTRAINTS (must obey) ==`) and `api/_utils/agentEvalPromptAssembly.js:810` (soft rules, under `== STRATEGY PREFERENCES (should follow) ==`). "Hard" is decided by category alone (`api/_utils/ruleHardness.js:23` — `export const HARD_CATEGORIES = new Set(['risk', 'allocation']);`, with a per-bundle override live under `FORGE_HARDSOFT_AUTHORING_ENABLED`) and changes only the heading. A rule's parameters only fill its sentence (`api/_utils/agentEvalPromptAssembly.js:863`). The rule compiler that would bind rules to code is dark: `src/config/featureFlags.js:1459` — `export const COMPILER_ENABLED = false;`.

What code does enforce reads elsewhere: the guardrail engine takes `deployedGuardrails` (`api/cron/agent-evaluate.js:3790` — `const result = applyGuardrails({`), which come from the Season Review dimension values, not from equipped rules (`src/utils/dimensionMapper.js:1330`); four dimensions are *tagged* to season rules (stop-loss `sx-01`, trailing stop `sx-02`, profit target `sx-04`, sector weight `se-07`; `api/forge/compile-dimensions.js:58`, `:59`, `:81`, `:96`). Risk-manager exits read the preset (`api/_utils/agentRiskManager.js:120`).

| Route | Rules | By category |
|---|---|---|
| (a) Hard constraint code enforces | **0** | — |
| (b) Parameter code consumes | **0** | — (the four season-tagged dimensions reach code by the separate Season Review path, not by equipping) |
| (c) Text in the trading prompt | **117** | technical 25, mid_battle 16, fundamental 14, risk 12, allocation 11, game_state 11, tier_strategy 10, institutional 10, threshold 8 |
| (d) Not wired | **26** | entry_criteria 8, exit_stops 7, season_state 6, rebalancing 5 — the season rules; launch modes admit only `both` and `clash` rules (`api/_utils/gameModePolicy.js:60`), and their evaluators run only from an unscheduled handler (`api/cron/season-daily-evaluate.js:9`). If one is equipped it still prints as text (MEASURED: 16 battles carry `dim-sx-*` and `dim-se-*` rules). |

Institutional rules (10) additionally switch on a data block (`api/_utils/agentEvalPromptAssembly.js:1256`); that is data shown, not a rule enforced. The full route table is in §8.

### B3. Rules that name a strategy or pattern

| Pattern | Rules (id — headline) | Does code detect it on a stock? | Reaches the model as |
|---|---|---|---|
| Narrow-range day (NR7) | t-15 — Catch the narrowest range breakout | **Yes**, for every stock, equipped or not: `api/_utils/technicalCalculations.js:431` — `const isNR7 = ranges.slice(1).every(r => todayRange <= r);`; wakes the agent for held stocks (`api/_utils/agentTriggerGate.js:173`) | `NR7: YES [CONTRACTION]` on **held** stocks only (`api/_utils/agentEvalPromptAssembly.js:1866`) |
| Volatility squeeze | tech-bollinger-squeeze — Look for volatility breakouts; t-12 — Catch the volatility squeeze; tv-05 — Squeeze Direction Filter | The ingredient (band-width percentile) is computed; the squeeze alarm is fixed at ≤ 20th percentile (`api/_utils/agentTriggerGate.js:165`). The breakout itself is not detected. | `BB Width: …th pctl [SQUEEZE]` on held stocks (`api/_utils/agentEvalPromptAssembly.js:1863`) |
| Mean reversion / lower band | tv-06 — Bollinger Lower Band Entry; tech-rsi-oversold — Buy oversold stocks; tech-rsi-overbought — Avoid overbought stocks; tv-01 — RSI Momentum Zone | Ingredients only (%B, RSI) | `BB %B=…`, `RSI=…` on **bench** stocks only (`api/_utils/agentEvalPromptAssembly.js:1659`, `:1629`) |
| VWAP | t-09 — Buy the dip to fair value; t-10 — Avoid overextended stocks; tv-04 — VWAP Reclaim Entry; tv-09 — Smart Money Liquidity Sweep | VWAP deviation is computed for held stocks; a ±1.5% alarm (`api/_utils/agentTriggerGate.js:148`); a preset-driven "VWAP failure" exit (`api/_utils/agentRiskManager.js:144`). No reclaim or sweep detector. | `VWAP: $… (±…%)` on held stocks (`api/_utils/agentEvalPromptAssembly.js:1858`) |
| Divergence | t-13 — Spot hidden momentum shifts | Yes (`api/_utils/analyticalPrimitives.js:216`) | `divergence=` on bench stocks (`api/_utils/agentEvalPromptAssembly.js:1642`) |
| MACD momentum | tech-macd-bullish — Ride momentum shifts; tv-02 — MACD Histogram Acceleration; tv-03 — MACD Zero-Line Bounce | Daily cross computed; acceleration only inside a score | `MACD above/below signal` on bench (`api/_utils/agentEvalPromptAssembly.js:1633`) |
| Moving-average trend / alignment | tech-moving-average-trend — Follow the trend; tech-avoid-declining — Don't catch falling knives; risk-avoid-declining-trend — Don't fight the trend; se-03 — Trend Alignment Filter | No alignment detector; the SMA flags feed the regime classifier (`api/_utils/agentRegimeClassifier.js:32`–`33`) | `sma200_position=` on bench; a regime word on held |
| 52-week high | tv-11 — 52-Week High Breakout Preference | Distance computed (`api/_utils/indexIntelligence.js:542`) and folded into a score; never printed | not shown |
| Volume confirmation | tech-volume-surge — Follow the smart money; t-14 — Demand volume proof on breakouts; tv-13 — Volume Spike Institutional Signal; tv-08 — Low Volume Pullback Hold | Volume tier computed, neutralised during the session (D3) | `RVOL=` on bench (`api/_utils/agentEvalPromptAssembly.js:1676`) |
| Intraday range position | tv-07 — Intraday Range Position | No detector | not shown |

**Answer: for every one of them the model is told about the pattern; code detects none of them as a setup.** NR7 is the closest: a code-computed flag the model reads directly.

### B4. Use (production, MEASURED — `b4_census.mjs`, `b4_agents.mjs`, `b4_rules.mjs`)

- **Agents.** 104 agents: 82 CPU agents (none carries a rule) and 22 human agents (founder 9, FT_QA 2, five other accounts 11). **19 of 22 human agents carry at least one equipped rule.**
- **Rules per agent.** 8 (three agents: born-with traits only); 13–15 (nine founder agents: 7 library rules plus 6–8 trait rules); 32–40 (seven agents of one other account: 31 library rules and 1 player-written rule each, plus 8 trait rules on six of them). Of 425 equipped rules: 280 library, 138 born-with trait, 7 player-written. Rules are equipped directly: `equippedBundleIds` is empty on every agent and every battle.
- **Ten most-equipped templates** (distinct human agents): mb-11 *Lean in for the final push* 16; tech-rsi-oversold *Buy oversold stocks* 15; mb-08 *Let winners run* 14; mb-07 *Stop the churn* 12; mb-09 *Pull the emergency brake* 12; t-11 *Follow institutional accumulation* 11; tech-moving-average-trend *Follow the trend* 11; then mb-05 *Follow the smart money*, mb-12 *Use it or lose it*, mb-10 *Stay quiet at lunch* and mb-15 *Exit when the thesis breaks*, 9 each. 69 distinct templates are equipped.
- **Collections applied: not recorded.** No collection id is stored when a player applies one (a bundle is merely named after it); 0 of 208 bundles carry a collection's exact title.
- **Battles in the last 30 days (created on or after 18 Oct) whose prompt carried at least one rule: 31 of 56** — all 16 non-League battles and 15 of 40 League battles (most League seats are CPU agents). The count reads `agentContext.activeRules`, which is what the prompt prints (`api/_utils/agentEvalPromptAssembly.js:782`).

### B5. Attribution

1. **Is the archetype and its config version on every decision record? No.** Neither the per-check entry (`evaluations[]`; MEASURED key census of 225 entries) nor the captured check (`ticks/{tickId}`, composed at `api/_utils/tickCapture/captureWriter.js:248`–`262`, which records `agentId` and `gameMode` only) carries it. It is recorded **once per battle**: `agentContext.archetype` (`api/_utils/agentBattleService.js:193`) and `resolvedAgentManifest.valuesAtLock.archetype` with `versionStamps.knobConfigVersionAtLock` (`api/_utils/resolvedAgentManifest.js:187` — `knobConfigVersionAtLock: KNOB_CONFIG_VERSION,`), identity and prompt-spec versions beside it — present on 184 of 184 battles since 15 Sep (knob version 2 on all). Executed swaps carry `swapProvenance.knobConfigVersion` (151 of 151) and an archetype only when the archetype's rotation made the swap (`api/_utils/agentRiskManager.js:575`).
2. **Is the equipped rule set at decision time recorded? Yes** — per captured check, `controls.activeRuleIds`, `controls.activeRuleTextHashes`, `controls.standingLeanIds` and `controls.equippedConfigHash` (`api/_utils/tickCapture/captureWriter.js:326`–`331`); per battle, `agentContext.activeRules` and `resolvedAgentManifest.frozenLayers.activeRules` with `equippedConfigHash` (184 of 184). The ids are rule-document ids; the template is the rule document's `sourceRef`.
3. **Is a market-regime stamp recorded at the battle level? Yes, from its flag's date on** — `regimeAtStart` (written once, `api/cron/agent-evaluate.js:1917` — `t.update(battleRef, { regimeAtStart });`; `src/config/featureFlags.js:1237` — `export const REGIME_STAMP_ENABLED = true;`). MEASURED: on 77 of 184 battles since 15 Sep (36 of 40 non-League): "bull" 53, "correction" 24.

---

## 4. Part C — one real decision per archetype

**In plain terms.** We pulled the actual messages sent to the model for each archetype's most recent swap and hold. About 3–5% of each message is about the archetype: its identity paragraph and its starter rules. More than half is shared rules and the answer form, about a quarter is the facts about each stock. When two different archetypes trade on the same day, their system instructions are identical except the identity paragraph. When the model explains itself, it mostly talks about how close a stock is to the scoring penalty line.

**Source.** `agentBattles/{battleId}/ticks/{tickId}` (permanent) and `…/tickBodies/{tickId}` (the full request and response, kept 120 days), written in one batch (`api/_utils/tickCapture/captureWriter.js:657`–`658`; subcollection names `api/_utils/tickCapture/captureConfig.js:118`–`119`). "Proposed" means the model's own answer, `decision.original` (`api/_utils/tickCapture/captureWriter.js:300`), not what code finally did. MEASURED (`c0_census.mjs`, `c2_requests.mjs`): 184 agent battles created since 15 Sep (144 League); 4,259 captured checks; 1,093 with a model answer.

| Archetype | Answered checks | Proposed swap | Proposed hold |
|---|---|---|---|
| Trend Follower | 503 | 60 | 443 |
| Contrarian | 228 | 25 | 203 |
| Diversifier | 78 | 17 | 61 |
| Speculator | 135 | 11 | 124 |
| Fundamental Investor | 127 | 8 | 119 |
| Capital Preserver | 22 | **0** | 22 |

**No Capital Preserver swap exists**, so 11 requests were read, not 12. All 11 are the founder's; the Fundamental Investor hold is from a League battle (the only one of the 11). Every request: model `claude-haiku-4-5-20251001`, temperature 0.4, forced tool `submit_trade_decision`.

### C1. What the request is made of

**Method.** Each request was split at its section headings (the system prompt's `━━━` banners; the identity message's and live message's headed blocks; the assistant acknowledgement; the tool schema). The API's own measured input-token count for that request (`callEnvelope.inputTokens`, `api/_utils/tickCapture/captureWriter.js:345`) was divided across sections in proportion to characters. This is an **estimate**: JSON tokenises denser than prose, so the tool schema's share is understated and prose shares slightly overstated. Category mapping: *shared* = system preamble, scoring, crypto slot, decision framework, intraday signals, regime-aware strategy, anti-thrash, survival, anticipation, monologue format, acknowledgement, tool schema; *identity* = the identity banner section and the "ABOUT YOU" block; *rules* = the system "FORGE RULES" guidance, "YOUR FORGE RULES", standing leans; *market* = macro benchmarks, regime context, strategy preset, news; *per-stock* = active positions, bench, bench technical context, fundamentals, closed trades, intraday snapshot, crypto line, risk status, institutional; *memory* = strategic brief, initial rationale, strategic wisdom, last three decisions; *directives* = active directive, Vision state; *battle state* (added) = the live-state header and trigger lines.

| Archetype · proposed → final | Date (ET) | Input tokens | Shared | Identity | Rules | Market | Per-stock | Memory | Directives | Battle | Identity share |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Trend F. · SWAP → SWAP | 2 Nov | 17,784 | 9,621 | 392 | 1,258 | 154 | 4,829 | 1,217 | 0 | 314 | 2.2% |
| Trend F. · HOLD → HOLD | 2 Nov | 17,994 | 9,661 | 394 | 1,263 | 154 | 4,988 | 1,222 | 0 | 312 | 2.2% |
| Contrarian · SWAP → SWAP | 16 Nov | 17,834 | 9,570 | 400 | 1,154 | 149 | 5,081 | 1,350 | 0 | 130 | 2.2% |
| Contrarian · HOLD → HOLD | 17 Nov | 17,197 | 9,469 | 395 | 1,142 | 148 | 4,422 | 1,400 | 0 | 222 | 2.3% |
| Diversifier · SWAP → HOLD | 9 Nov | 18,995 | 9,740 | 372 | 1,354 | 155 | 5,446 | 1,245 | 101 | 582 | 2.0% |
| Diversifier · HOLD → HOLD | 9 Nov | 15,015 | 9,200 | 352 | 1,279 | 142 | 2,531 | 1,176 | 193 | 143 | 2.3% |
| Speculator · SWAP → HOLD | 12 Nov | 17,647 | 9,554 | 328 | 1,218 | 350 | 4,846 | 1,230 | 0 | 120 | 1.9% |
| Speculator · HOLD → HOLD | 12 Nov | 17,086 | 9,520 | 327 | 1,213 | 149 | 4,522 | 1,226 | 0 | 130 | 1.9% |
| Fund. Inv. · SWAP → SWAP | 22 Oct | 17,293 | 9,433 | 381 | 1,225 | 393 | 4,251 | 1,227 | 0 | 384 | 2.2% |
| Fund. Inv. · HOLD → HOLD (League) | 22 Oct | 15,167 | 8,914 | 385 | 1,237 | 143 | 3,679 | 722 | 0 | 88 | 2.5% |
| Cap. Pres. · HOLD → HOLD | 13 Nov | 17,800 | 9,524 | 357 | 1,118 | 408 | 4,611 | 1,523 | 0 | 258 | 2.0% |

The identity column (identity section plus the "ABOUT YOU" block) is 1.9–2.5%. Every request also carried the archetype's starter trait rules (6–8 of its 13–15 equipped rules), which sit inside the Rules column. Their printed lines were matched one by one to the agent's trait rule documents (`b4_traits.mjs`, all matched):

| Request | Starter-rule tokens | Identity + starter share |
|---|---|---|
| Trend F. · SWAP / HOLD | 408 / 410 | 4.5% / 4.5% |
| Contrarian · SWAP / HOLD | 309 / 305 | 4.0% / 4.1% |
| Diversifier · SWAP / HOLD | 234 / 221 | 3.2% / 3.8% |
| Speculator · SWAP / HOLD | 374 / 372 | 4.0% / 4.1% |
| Fund. Inv. · SWAP / HOLD | 391 / 395 | 4.5% / 5.1% |
| Cap. Pres. · HOLD | 268 | 3.5% |

**The archetype-specific share is 3.2–5.1%.** The tool schema alone is about 4,235–4,483 tokens (24–29%) by this allocation. Two of the five proposed swaps were blocked by code and became holds.

### C2. What differs between archetypes

Across the 11 requests, the system prompt's sections were hashed: **only the opening line and the identity section vary by archetype**; scoring rules, decision framework, regime-aware strategy, survival mode and monologue format differ only for the League request. No two of the 11 share a session, so the closest same-day pairs were found among all answered checks (MEASURED, `c2b_sameday.mjs`; 13 trading days had answered checks from two archetypes):

- **29 Sep, Contrarian (other-1) vs Trend Follower (founder), 30 seconds apart, both holds.** System prompt: opening line, identity section and the monologue section differ (the monologue section is the same length — it names the agent); scoring, framework, intraday signals, regime strategy, Forge guidance, anti-thrash, survival and anticipation are byte-identical. The tool schema and strategy-preset block are identical. Everything in the identity message differs (each agent's own brief, rationale, consolidated wisdom and rules), and the live state differs (different stocks).
- **19 Oct, Fundamental Investor (founder) vs Speculator (other-1), 40 seconds apart, both holds.** Scoring rules, decision framework, survival mode and the tool schema also differ here — but the founder's battle runs the measured stock-threshold scoring and the called-shot fields (its check record is schema version 2 with a stock model; the other is version 1 without). Those differences follow the **account's feature cohort**, not the archetype.

### C3. What the model says it is doing

**A small hand-read sample, labelled as one.** The ten most recent stated reasons (`rationale`) per archetype, swaps first, then holds to make ten: 10 swaps each for four archetypes; Fundamental Investor 8 swaps + 2 holds; Capital Preserver 10 holds. Each was sorted by hand into one class by the reason that leads the argument. The sample is clustered: consecutive checks of the same battle often repeat a blocked swap (for example, five of Contrarian's ten are the same stock on one afternoon; all ten Capital Preserver reasons come from one battle on 13 Nov).

| Class | Trend F. | Contr. | Divers. | Spec. | Fund. Inv. | Cap. Pres. | Total |
|---|---|---|---|---|---|---|---|
| Cites score or threshold position | 7 | 10 | 4 | 9 | 6 | 0 | **36** |
| Names a pattern or setup | 1 | 0 | 0 | 1 | 3 | 5 | **10** |
| Cites indicator values | 0 | 0 | 6 | 0 | 1 | 3 | **10** |
| Cites its archetype identity | 0 | 0 | 0 | 0 | 0 | 2 | **2** |
| Cites a player directive | 1 | 0 | 0 | 0 | 0 | 0 | **1** |
| Other (cites an equipped rule) | 1 | 0 | 0 | 0 | 0 | 0 | **1** |

Counted as mentions rather than lead reasons (a reason can mention several): 51 of 60 mention the Bust line or a bonus threshold; 39 cite an "S" number (a Forge preference or a shared strategy — the label alone does not say which; Surprise 7); 19 mention NR7 or a squeeze, including all ten Capital Preserver holds. The 60 reasons come from 14 distinct archetype-days.

One example per class, the model's own words, trimmed:

- **Threshold position:** "MOS is now at -0.69x its frozen measured 4.91% ATR, just 0.31x away from the -1.0x Bust penalty (-10 pts at Core tier, 1.5x multiplier = -15 locked pts)." (Contrarian, 16 Nov)
- **Pattern or setup:** "ADBE has now failed the NR7 breakout setup three consecutive evaluations in a row." (Fundamental Investor, 21 Oct)
- **Indicator values:** "Meanwhile, LLY is up 3.27% today (+0.58x ATR from open), showing genuine relative strength in Healthcare." (Diversifier, 7 Oct)
- **Archetype identity:** "Three NR7 contractions (ICE, PEP, PSA) are volatility setups primed for breakout, not reasons to exit — they're exactly the kind of quiet consolidation my Guardian archetype exploits by holding through the breakout." (Capital Preserver, 13 Nov)
- **Player directive:** a Trend Follower swap on 30 Oct names the Coach's active directive as the deciding reason. Its sentence quotes the directive, which is player-written, so it is not reproduced.
- **Equipped rule:** "The healthcare sector is broadly choppy today (LLY, GILD, MDT all flat-to-negative), so holding a weak name in that sector violates S7 sector rotation discipline." (Trend Follower, 30 Oct)

Every "pattern" reason names **NR7**, the one pattern code flags and puts in front of the model (Part D). The Capital Preserver's holds lean on NR7 squeezes while its own (dead) config lists `volatility_squeeze` as an avoided strategy (`api/_utils/agentArchetypeConfig.js:192`), and its identity never mentions breakouts; the shared prompt line `Do NOT swap out NR7 stocks unless they're bleeding.` (`api/_utils/agentEvalPromptAssembly.js:323`) is a likelier source.

---

## 5. Part D — what the model is given to recognise a pattern

**In plain terms.** The model never sees a chart or a run of past prices. Each stock is one line of numbers that code has already worked out. Stocks the agent holds and stocks on its bench get *different* numbers, so some of the prompt's own strategy instructions point at numbers the model doesn't have for that stock. Of all the pattern-finding code in the product, only the narrow-range flag, the squeeze percentile and nearby support/resistance levels reach the trader. The newer setup evaluator and the intraday facts are stored and shown to no trader. The volume reading on the bench is pinned to "normal" during market hours.

### D1. Facts per stock

| Held stock | Bench stock |
|---|---|
| Portfolio row: tier, symbol, sector, entry day, entry price, current price, gain %, ATR multiple, badges, ATR %, points if sold now, next bonus, nearest support/resistance (`api/_utils/agentEvalPromptAssembly.js:1475`–`1477`) | Bench row: symbol, sector, price, day change %, ATR %, status (`api/_utils/agentEvalPromptAssembly.js:1513`) |
| Intraday snapshot: VWAP and deviation, band-width percentile with `[SQUEEZE]`, `NR7: YES`, today's range (`api/_utils/agentEvalPromptAssembly.js:1858`–`1869`) | Technical block: short/intermediate/long trend words, distance from the 200-day average, RSI, MACD vs signal, divergence, %B, ATR regime, volume tier and RVOL, relative-strength percentile, sector RS, support, a "recent action" candle label, technical score and rank (`api/_utils/agentEvalPromptAssembly.js:1612`–`1741`) |
| Regime word (`api/_utils/agentEvalPromptAssembly.js:1790`), risk status (`:1813`) | — |
| Fundamentals: P/E vs sector, revenue growth, EPS revisions, beat rate, surprise percentile (`api/_utils/fundamentalsRender.js:100`–`109`; `FUNDAMENTAL_MIRROR_ENABLED = true`) | same fundamentals |

**No price history reaches the model**: no bars, candles or series are rendered (the 5-minute bars fetched for held stocks, `api/cron/agent-evaluate.js:1654`, become one VWAP number). Everything is a computed reading.

The shared strategy text asks for readings the model lacks on one side: `NR7-flagged stocks get priority consideration for Squeeze Breakout strategy (S1).` (`api/_utils/agentEvalPromptAssembly.js:442`) — bench stocks never carry NR7; S5's exit `Exit when RSI-14 > 80 and turns down` (`api/_utils/agentEvalPromptAssembly.js:438`) — held stocks carry no RSI; `Avoid swapping INTO choppy stocks.` (`api/_utils/agentEvalPromptAssembly.js:430`) — bench stocks carry no regime word. A reader inferred that hot-bench names merged in mid-battle may print with no technical block at all (`api/cron/agent-evaluate.js:1650` fetches technicals for held and stored-bench names only); **not verified**.

**Evidence the identity paragraphs name, against what the model receives:**

| Identity asks for | Archetype | Given to the model? |
|---|---|---|
| beta ("low-beta required") | Capital Preserver | **No** — no beta anywhere in the trading prompt |
| near-term catalyst | Fundamental Investor | Partly — news headlines, EPS revisions and beat rate; **no earnings date** |
| the stop ("override the stop", "widen the stop") | Contrarian, Speculator | **No stop level**; only a risk action when one fires, and `The risk manager handles emergency exits automatically` (`api/_utils/agentEvalPromptAssembly.js:447`) |
| chart extension / band fit | Trend Follower, Speculator | Bench only (%B, 200-day distance); held stocks get band *width*, not position |
| sector / market strength | Trend Follower, Contrarian | Bench only (sector RS); held stocks get only the SPY/QQQ line |
| volume confirmation | Trend Follower | Bench only, and neutralised intraday (D3) |
| business quality score ("below 40 is refused") | Fundamental Investor, Capital Preserver | **No** — the 0–100 fundamental score is shown at deploy only (`api/_utils/agentPromptAssembly.js:245`); at trade time only raw metrics |
| realized volatility (ATR) | Speculator, Capital Preserver | Yes, both sides |
| depth of dislocation / own momentum | Contrarian | Partly — gain %, RSI and relative strength on the bench; no distance from a high |

### D2. Pattern detectors in the code

| Detector | Computed by | Reaches the trading model? | Reaches the player? | Flag on `main` |
|---|---|---|---|---|
| NR7 and daily range | `compute-index-intelligence` cron (stored `api/cron/compute-index-intelligence.js:1417` — `nr7Flag: tech.nr7Flag ?? false,`) | **Yes, held stocks only** (`api/_utils/agentEvalPromptAssembly.js:1866`; alarm `api/_utils/agentTriggerGate.js:173`) | screener label (render path not verified) | none |
| Squeeze (band-width percentile) | same cron (`api/cron/compute-index-intelligence.js:1292`) | **Yes, held only** | not verified | none |
| Swing highs/lows → nearest support/resistance | `api/_utils/analyticalPrimitives.js:44`, `:139`; stored `api/cron/compute-index-intelligence.js:1430` | **Yes**, bench line and held "Levels" cell | no reader found in `src/` | held cell under `PROFIT_TARGET_EXECUTOR_ENABLED = true` |
| RSI divergence, candle "recent action" | `api/_utils/analyticalPrimitives.js:216`, `:297` | **Bench only** | not found | none |
| Pivot levels | `api/_utils/technicalCalculations.js:451`; stored `api/cron/compute-index-intelligence.js:1429` | **No** | not verified | none |
| Trend Follower setup evaluator (`tfSetupV1`: breakout, pullback-and-resume) | `api/_utils/setupEvidence/acquire.js:33`, run by the `setup-evidence-sweep` cron into `setupEvidence` | **No** | **No** (`src/config/researchModalFlags.js:209` — `export const CHART_READ_MODE = 'off';`) | `src/config/setupEvidenceSweepFlags.js:32` — `export const SETUP_EVIDENCE_SWEEP_ENABLED = true;`; labels `SETUP_MENU_LABELS_ENABLED = false` |
| Intraday facts | `api/_utils/intraday/facts.js:90`, from the minute poll into `intradaySnapshots` | **No** (`src/config/featureFlags.js:2686` — `The sent prompt is identical on and off`) | the "Why?" panel, behind `INTRADAY_DIAGNOSTIC_ENABLED` (off) | collect on, diagnostic off |
| Learning L1 classifiers | `api/_utils/learning/detectorClassifiers.js:90` (one runs at swap time) | No | not found | `LEARNING_L1_CAPTURE_ENABLED = true` |
| Squeeze / VWAP / news alarms | `api/_utils/agentTriggerGate.js:148`, `:165`, `:196` | As the "TRIGGER (why you were woken up)" line (`api/_utils/agentEvalPromptAssembly.js:1191`) | — | none; the same for all six archetypes |

### D3. Known input problems

- **The volume line reading "NORMAL" during the session: not fixed on `main`.** The intraday refresh builds today's bar with its volume *set to* the trailing average (`api/cron/compute-index-intelligence.js:249` — `* Volume is deliberately NEUTRALIZED to the trailing average: a partial-day`; `:283` — `volume: avgVol,`), the ratio divides that by a 20-day average (`api/_utils/technicalCalculations.js:349`), and 0.75–1.25 prints NORMAL (`api/_utils/technicalCalculations.js:355` — `else if (ratio >= 0.75) tier = 'NORMAL';`). So the bench volume tier reads about NORMAL from the first intraday run to the close (INFERRED). The same synthetic bar takes its high and low from the live quote, so NR7, range and band width are computed on a partial day. The repair is still an open design item (`docs/design/20261028_GROWTH_LOOP_MAP_V1_2.md:60`). The regime classifier reads a different volume field (`api/_utils/agentRegimeClassifier.js:36`).
- **`INTRADAY_DIAGNOSTIC_ENABLED`**: `src/config/featureFlags.js:2690` — `export const INTRADAY_DIAGNOSTIC_ENABLED = false;` (would write a per-check view and feed the player's "Why?" panel).
- **`INTRADAY_AGENT_USE_ENABLED`**: `src/config/featureFlags.js:2701` — `export const INTRADAY_AGENT_USE_ENABLED = false;`, with no live consumer: the one call that could take it does not pass it (`api/cron/agent-evaluate.js:3660`).

---

## 6. Part E — plans and follow-through

**In plain terms.** When the model swaps, it already writes down a reason, a one-sentence prediction and — on its notable decisions — a "strategy" in its own words. Nobody checks those words against a fixed list, so the same idea is spelled 161 ways, and the swaps code makes on its own carry no strategy at all. A swap never says when it would be wrong or how long it has; only the newer "called shot" records carry a condition and a time limit. The Film Room can sort outcomes by archetype but not by strategy. The July plan for testing whether a pattern really works was written down but never built.

### E1. What a decision records as intent

The trading tool (`api/_utils/agentEvalToolSchema.js`):

- **Hold:** `decision`, `rationale`, `conviction`, `hypothesis`, `riskAssessment` (`api/_utils/agentEvalToolSchema.js:10` — `required: ['decision', 'rationale', 'conviction', 'hypothesis', 'riskAssessment'],`).
- **Swap:** adds `symbolOut`, `symbolIn` and a motive, `api/_utils/agentEvalToolSchema.js:29` — `enum: ['defensive_cut', 'profit_take', 'momentum_rotation', 'upgrade'],` — a reason class, not a strategy.
- **Strategy:** free text, `api/_utils/agentEvalToolSchema.js:90` — `'Which strategy drove this decision. Example: "Volatility Squeeze"`, required inside `trade_reasoning` (`:108`), but `trade_reasoning` itself is optional and the prompt says to set it to null on routine holds (`api/_utils/agentEvalPromptAssembly.js:465`). A separate `cited_rules` list offers standard names (`api/_utils/agentEvalToolSchema.js:119` — `Use these standard names when applicable: "volatility_squeeze", "52w_high_breakout", "rs_momentum", "vwap_mean_reversion", "news_catalyst"`). That makes **three strategy vocabularies that do not line up**: these names, the prompt's S1–S5, and the free-text examples ("Volatility Squeeze, Momentum Breakout, RS Rotation, Risk Management", `api/_utils/agentEvalPromptAssembly.js:459`–`460`).
- **Hypothesis:** a falsifiable one-liner (`api/_utils/agentEvalToolSchema.js:46`). After the battle the reflection asks the model to grade each one (`api/_utils/agentReflectionUtils.js:41`), stored in the agent's memory (`api/agent/reflect.js:498`). MEASURED (`e_grades.mjs`): 205 grades on 33 human memory entries — 40 correct, 60 inconclusive, 105 incorrect; every entry since 18 Oct has grades. This is the model marking its own work, once, after the battle.
- **Called shot** (`declarations`, only for battles on the calls allowlist or release cohort): `condition` with a price level and `above`/`below` (`api/_utils/agentEvalToolSchema.js:278`), and a horizon (`api/_utils/agentEvalToolSchema.js:284` — `enum: ['next_check', 'this_session', 'this_battle', 'explicit'],`).

**Does any field name a strategy or setup, an exit condition or a time limit?** A strategy: yes, free text, optional. A setup: no field. An exit condition and a time limit: only on a called shot, never on a swap.

MEASURED (`b4_census.mjs`, `b5_trades.mjs`): `trade_reasoning.strategy` is present on 334 of 1,282 stored decisions since 15 Sep, in **161 distinct spellings**, led by "Momentum Rotation" (45), "Risk Management / Defensive Cut" (16), "Risk Management + Momentum Rotation" (9) and "Volatility Squeeze Breakout" (8); none of the top 30 is one of the five snake_case names the schema offers for `cited_rules`. It is on 54 of the 55 swaps the model made, and on none of the 96 swaps made by the archetype's rotation (84) or the risk manager (12). The only reader is a display (`src/components/Agent/GameTapeView.jsx:208`; mount not verified); nothing grades or acts on it. The `archetype` swap source is set only on the stagnation path (`api/cron/agent-evaluate.js:2329` — `const swapSource = riskResult.reason === 'stagnation' ? 'archetype' : 'risk_manager';`).

### E2. Where a strategy name could ride

| Record | Writer | Already holds | Where a field would go |
|---|---|---|---|
| The decision entry (`agentBattles/{id}.evaluations[]`, last 150) | `api/cron/agent-evaluate.js:4578` | the free-text strategy: `api/cron/agent-evaluate.js:4598` — `trade_reasoning: haikuResult?.trade_reasoning || null,` | already there; trades get it through the fenced executor's existing spread (`api/_utils/agentSwapExecution.js:413` — `...evaluationMetadata,`) |
| The captured check (`ticks/{tickId}` permanent, `tickBodies/{tickId}` 120 days) | `api/_utils/tickCapture/captureWriter.js:657`–`658` | body: the whole model answer (`api/_utils/tickCapture/captureWriter.js:228`); permanent record: enums and ids only, every path declared (`api/_utils/tickCapture/captureSerializer.js:27`) | one declared enum path beside `api/_utils/tickCapture/captureSerializer.js:121` — `'decision.original': 'enum:DECISIONS',` |
| The call record (`agentBattles/{id}/calls`) | `api/_utils/callRecords/publish.js:187` | condition, horizon, said | the call shape (`api/_utils/callRecords/candidate.js:346`) plus the tool's declaration item |
| The activation pointer (`agentBattles/{id}/activations`) | `api/_utils/activationEvidence/writer.js:37` | the archetype (`api/_utils/activationEvidence/pointer.js:101`); links to the decision only by id | its return object |

**The smallest change, in three lines:**
1. Turn `trade_reasoning.strategy` into a closed list (the five S-strategies, plus risk-management and none) in `agentEvalToolSchema.js`, and make `trade_reasoning` required on swaps.
2. Copy the chosen value onto the captured check's permanent record as one declared enum path; code-made swaps take their label from the `source` every swap already records (`archetype`, `risk_manager`; MEASURED on 151 of 151).
3. Carry the value into the Film Room tape's swap row so outcomes can be grouped by it (E3).

### E3. What can be graded today

The tape is one document per battle per day (`api/_utils/filmTape/tapeSources.js:19`). Its header records the archetype (`api/_utils/filmTape/tapeAssemble.js:1441` — `archetype: str(battle.agentContext?.archetype),`) and game mode; each swap row records an exit mechanism (`api/_utils/filmTape/tapeAssemble.js:545`), tier and source; every model swap falls into one bucket (`src/constants/filmTape.js:93` — `haiku_decision: 'agent_decision',`); the only situation tag is "stalled" (`api/_utils/filmTape/tapeTags.js:105`). **No strategy, setup, motive or reasoning reaches the tape.** Grouping across battles exists only in census scripts. **If E2 existed**, a strategy could be grouped once it is copied into the row composer (`api/_utils/filmTape/tapeAssemble.js:536`–`560`); the free-text value already sits on `trades[]`, which the tape reads, but 161 spellings would not group.

### E4. The evidence layer

The July design is `docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md` (dated 11 July 2026, `docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md:2`).

| Piece | Where it lives | Runs? | Reads | Has produced |
|---|---|---|---|---|
| Support (≥ 8 independent opportunities) | the design document only (`docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md:155`) | No | — | nothing |
| Effect (effect size, regime breakdown) | the design document only (`docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md:106`); the code that exists is deliberately outcome-blind (`api/_utils/learning/measureCorpus.js:10` — `OUTCOME-BLIND, ABSOLUTELY`) and runs only from a script | No (script only) | the captured corpus | counts, no effects |
| Null harness | the design document only (`docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md:160`); no code | No | — | nothing |
| Pairing test | not found for the evidence layer (the only "pairing test" is the guardrail executor's, `api/_utils/agentGuardrails.js:610`) | No | — | nothing |
| Detectors compiling to leans | the design document only (`docs/AGENT_LEARNING_SYSTEM_ARCHITECTURE_V1_3.md:86`); no compiler and no `agentLessons` writer (`src/config/featureFlags.js:1195` — `This flag gates capture ONLY.`) | No | — | nothing; the leans in the prompt are the player's own picks |
| What does run | one L1 classifier label captured at swap time into `learningReceipts` | Yes (`LEARNING_L1_CAPTURE_ENABLED = true`) | the swap | receipts, not read by the trader |

---

## 7. Part F — the research side, briefly

**In plain terms.** The new research tools do not feed the trading agent yet. The knowledge-base method is switched off for every use, and even when on, it is wired only to Shared Research. During a battle, what reaches the trader is news headlines, fundamentals, the Coach's directive (always a fixed sentence from an approved list, never the player's own words), the agent's lessons from past battles, and the Forge rules the player wrote.

### F1. Methods

One package is committed (`api/_utils/kb/packages/index.js:17` — `id: 'KB-IDEA-EVALUATION-001',`). The authorisation list is empty (`api/_utils/kb/authorizations.js:40` — `export const KB_APP_USE = Object.freeze([]);`), so the loader refuses every request (`api/_utils/kb/loader.js:330`). Its one consumer is Shared Research's own-words entry (`api/_utils/sharedResearch/method.js:61` — `export const OBSERVATION_CONSUMER = 'shared_research.observation';`), which falls back to the baseline method on refusal (`api/_utils/sharedResearch/method.js:153`). Shared Research itself is on for the allowlist (`src/config/sharedResearchFlags.js:50` — `export const SHARED_RESEARCH_MODE = 'allowlist';`). **No method reaches the trading call**: none of the KB, Shared Research, research-record or hypothesis modules is imported by the trading path.

### F2. What crosses into a battle today

"Deploy" routes are frozen onto the battle when it starts and printed at every check; "live" routes are read fresh at each check.

| Route | What crosses | Gate (value on `main`) | Rendered in the trading prompt | Recorded |
|---|---|---|---|---|
| Coach directive from chat (live) | a canonical sentence from the archetype's allowlist; never the player's words (`api/_utils/directiveGate.js:12`) | `ARCHETYPE_INTEGRITY_MODE = 'enforce'` (`src/config/featureFlags.js:801`) | `api/_utils/agentEvalPromptAssembly.js:1246` | `battle.directive` (`api/agent/chat.js:1174`) |
| Directive chip | same | `VOICE_GROUNDING_MODE = 'shadow'` (`src/config/featureFlags.js:2331`) → the route answers 404 to everyone (`api/agent/file-directive.js:176`) | same slot | `battle.directive` |
| Called-shot answers (live) | code-written action text | `CALL_RECORDS_MODE = 'on'` (`src/config/featureFlags.js:2965`), per owner by allowlist (`api/_utils/callRecords/mode.js:94`) | directive slot | call events (`api/agent/call-response.js:435`) |
| Huddle plan (live) | a template-written plan, no model text (`api/_utils/huddle/planTemplates.js:6`) | `DRB_HUDDLE_ENABLED = true` (`src/config/huddleFlags.js:47`) and a cohort (`api/_utils/huddle/gate.js:45`) | directive slot, filed at `api/cron/agent-evaluate.js:1228` | `plan.applications` (`api/_utils/huddle/applyPlan.js:107`) |
| Standing leans (deploy) | canonical adjustment sentences | `STANDING_LEANS_ENABLED = true` (`src/config/featureFlags.js:734`) | `api/_utils/agentEvalPromptAssembly.js:1247` | battle `agentContext.standingLeans` |
| FantasyTimes news (live) | headline, reporter, sentiment, tickers; no body | none | `api/_utils/agentEvalPromptAssembly.js:1270`, `:1279`; also wakes the agent (`api/_utils/agentTriggerGate.js:196`) and adds names to the bench (`api/cron/agent-evaluate.js:2980`) | `cronState.seenStoryIds` |
| EXA (through news) | search results shape a mover story; only its headline crosses | `EXA_RETRIEVAL_ENABLED = true` (`src/config/featureFlags.js:1657`) | as news | `fantasyTimesStories` |
| Wire newsline | nothing (chat only) | `WIRE_NEWSLINE_ENABLED = false` (`src/config/featureFlags.js:1620`) | — | — |
| Fundamentals (live) | mirrored metrics, numbers only | `FUNDAMENTAL_MIRROR_ENABLED = true` (`src/config/featureFlags.js:1726`) | `api/_utils/agentEvalPromptAssembly.js:1182` | stock rankings |
| Lessons → consolidated wisdom (deploy) | model-written insight distilled from past battles and chat review lessons | none found | `api/_utils/agentEvalPromptAssembly.js:775` | `consolidatedInsight` (`api/_utils/agentConsolidationApply.js:293`) |
| Learning L1 | nothing (capture only, `src/config/featureFlags.js:1195`) | `LEARNING_L1_CAPTURE_ENABLED = true` | — | learning collections |
| Deploy strategy brief (deploy) | the deploy model's brief, whose inputs include the watchlist's player-written name and thesis (`api/_utils/agentPromptAssembly.js:134`) | none | `api/_utils/agentEvalPromptAssembly.js:759` | `strategyBrief` (`api/agent/decide.js:717`) |
| Forge rules (deploy) | rule text, **which the owner can write** (`firestore.rules:356`) | none | `api/_utils/agentEvalPromptAssembly.js:806`, `:880` | `agentContext.activeRules` |
| Shared Research adoption (deploy) | tickers only; thesis and name written empty (`api/_utils/sharedResearch/store.js:675`) | `SHARED_RESEARCH_MODE = 'allowlist'` | bench menu only (`api/cron/agent-evaluate.js:1724`) | the watchlist |
| Idea statement (`equippedHypothesis`) | frozen on the battle, **never rendered** | `HYPOTHESIS_RECORDS_ENABLED = true` (`src/config/featureFlags.js:3314`) | — | `agentContext.equippedHypothesis` |
| Battle Research | nothing directly; only through a chat draft the player sends | `BATTLE_RESEARCH_MODE = 'allowlist'` (`src/config/researchModalFlags.js:169`) | — | — |

Each check's request body, kept 120 days, is the authority on what was sent.

---

## 8. The route table (from B2)

Every rule template, by route. Classification is traced in code, not read from a field (no template has one). Route (c) prints at `api/_utils/agentEvalPromptAssembly.js:804` when the category is hard (risk, allocation) and at `api/_utils/agentEvalPromptAssembly.js:810` otherwise.

| Rule ids | Category | Rules | Route | Site |
|---|---|---|---|---|
| tech-*, t-09…t-16, tv-01…07, tv-11, tv-13 | technical | 25 | (c) text, "should follow" | `:810` |
| fund-*, f-07…f-13, tv-10 | fundamental | 14 | (c) text, "should follow" | `:810` |
| risk-*, r-06…r-12 | risk | 12 | (c) text, "must obey" — not enforced | `:804` |
| alloc-*, a-05…a-10, tv-14 | allocation | 11 | (c) text, "must obey" — not enforced | `:804` |
| mb-01, mb-03…mb-15, tv-08, tv-09 | mid_battle | 16 | (c) text | `:810` |
| gs-01…gs-10, gs-12 | game_state | 11 | (c) text | `:810` |
| th-01, th-04, th-05, th-07…th-10, tv-15 | threshold | 8 | (c) text | `:810` |
| ts-01…ts-09, tv-12 | tier_strategy | 10 | (c) text | `:810` |
| i-01…i-10 | institutional | 10 | (c) text, plus a 13F data block | `:810`; data `api/_utils/agentEvalPromptAssembly.js:1256` |
| se-01…se-08 | entry_criteria | 8 | (d) not wired (season) | — |
| sx-01…sx-07 | exit_stops | 7 | (d) not wired (season); sx-01/02/04 values reach code only via Season Review dimensions | `api/forge/compile-dimensions.js:58` |
| sr-01…sr-05 | rebalancing | 5 | (d) not wired (season) | — |
| ss-01…ss-06 | season_state | 6 | (d) not wired (season) | — |
| **Total** | | **143** | **(a) 0 · (b) 0 · (c) 117 · (d) 26** | |

Route (d) means "not offered in the launch modes and no live evaluator"; a season rule that does get equipped still prints as text like route (c) — MEASURED, 16 battles since 15 Sep carry the `dim-se-*`, `dim-sx-*`, `dim-sr-*` and `dim-ss-*` rule documents.

## 9. Fence contact for E2

Fenced files are those listed in `docs/BUILD_RULES.md` §1. E2's three lines, file by file:

| File | Fenced? | Touched by E2? |
|---|---|---|
| `api/_utils/agentEvalToolSchema.js` | Not on the §1 list, but its own header asks for fenced-class review (`api/_utils/agentEvalToolSchema.js:214` — `Reviewed as fenced-class`) | **Yes** — line 1 (the closed list, `trade_reasoning` required on swaps) |
| `api/_utils/agentEvalPromptAssembly.js` | **Fenced** | **Only if** the prompt's TRADE REASONING example list (`api/_utils/agentEvalPromptAssembly.js:459`–`460`) and the S1–S5 text are aligned with the closed list; the tool definition alone carries an enum to the model. Leaving the prose unaligned leaves a fourth vocabulary in the prompt. |
| `api/_utils/tickCapture/captureSerializer.js`, `api/_utils/tickCapture/captureWriter.js` | Not fenced | **Yes** — line 2 (one declared path) |
| `api/cron/agent-evaluate.js` | Not fenced | Possibly — only if the captured-check value is set here rather than in the capture module; the decision entry already carries `trade_reasoning` (`api/cron/agent-evaluate.js:4598`) |
| `api/_utils/agentSwapExecution.js` | **Fenced** | No — trades already receive `trade_reasoning` through the existing spread (`api/_utils/agentSwapExecution.js:413`) |
| `api/_utils/agentRiskManager.js` | **Fenced** | No — the swap source is already recorded (`api/_utils/agentRiskManager.js:572`, `buildSwapReceiptSource`, which the cron marks NO-EDIT at `api/cron/agent-evaluate.js:135`) |
| `api/_utils/filmTape/tapeAssemble.js` | Not fenced | **Yes** — line 3 |
| `api/agent/decide.js`, `api/_utils/agentPromptAssembly.js`, `api/_utils/agentArchetypeConfig.js`, `api/_utils/archetypeScoring.js`, `api/_utils/agentGuardrails.js`, `api/_utils/agentBattleService.js` | **Fenced** | No |

## 10. Surprises

Things that contradict what the prompt assumed, or that a reader would not expect. Items marked **(bug candidate)** are reported for separate tasking, not fixed (BUILD_RULES §3).

1. **The trading call is not in `decide.js`.** `decide.js` builds the portfolio at deploy; the 15-minute trading call is `api/cron/agent-evaluate.js`. The guards the prompt looked for in `decide.js` are enforced in the cron and the risk manager.
2. **The archetypes' "favoured strategies" are dead config.** The strategy text the trader sees is the shared S1–S5, identical for all six (`api/_utils/agentEvalPromptAssembly.js:421`–`441`), plus rule text — each archetype's starter rules and the player's own. The starter rules are the closest thing an archetype has to its own strategies, and they are invisible in the archetype tables. The Capital Preserver's dead "avoid squeeze" entry sits beside a shared instruction not to swap out NR7 stocks, and all ten sampled Capital Preserver holds lean on squeezes.
3. **Three archetypes are identical in code at trade time.** Their difference once a battle runs is text only (identity paragraph, starter rules): Fundamental Investor, Contrarian and Diversifier share every tick-time number (`api/_utils/agentArchetypeConfig.js:80`–`90`, `:109`–`119`, `:136`–`146`).
4. **Code makes most of the swaps.** 84 of 151 executed swaps since 15 Sep came from the archetype's forced rotation, 55 from the model (MEASURED). The archetype's strongest mechanical voice is a rule the model is never told about.
5. **Per-archetype temperatures do not reach the trading call** (0.4 for all, `api/cron/agent-evaluate.js:3345`); they act only at deploy.
6. **The Capital Preserver never proposes a swap.** 0 of 22 answered checks since 15 Sep; no executed swap in a non-League battle (MEASURED).
7. **"S1" means two different things in one prompt.** The system prompt's strategies are S1–S5; the player's Forge preferences are also numbered S1, S2, … (`api/_utils/agentEvalPromptAssembly.js:810`). A stated reason that cites "S1" or "S6" cannot be resolved from the text alone. With the schema's snake_case names and the free-text examples, there are three or four strategy vocabularies.
8. **The prompt's strategies ask for readings the model lacks** on one side (NR7 and regime on the bench, RSI on held stocks) — D1.
9. **The identity clause contradicts the same prompt.** The live clause says equipped rules "never reverse" the identity (`api/_utils/evalIdentityBlocks.js:58`); the precedence block in the same system prompt says `The user's soft preferences outrank framework defaults and your archetype stance.` (`api/_utils/agentEvalPromptAssembly.js:146`). The clause's own comment cites a drop at `decide.js:262`, which has drifted to `api/agent/decide.js:271`; and today no born-with rule can lose on tier (the reconciler acts on four templates and only the Capital Preserver's Steady Anchor carries one, and it only consolidates).
10. **The model is given two names for itself** ("Degen" in the opening line, "Speculator" in the identity block) — A1.
11. **The volume problem is not "partial day versus full-day average".** The partial-day volume is replaced by the trailing average, so the tier reads about NORMAL by construction (D3).
12. **"Must obey" rules are not enforced.** Risk and allocation rules print under `== CONSTRAINTS (must obey) ==` and nothing checks them; the compiler that would is off (`src/config/featureFlags.js:1459`).
13. **The model already labels a strategy** — 161 spellings in 334 decisions; one screen displays it (`src/components/Agent/GameTapeView.jsx:208`, mount not verified) and nothing grades or acts on it.
14. **Hypotheses are graded, by the model, after the battle** — 105 of 205 "incorrect" (MEASURED). The grade is not linked to the strategy named or the setup present.
15. **(bug candidate)** The profit-target special render keys on the template id `sx-04` (`api/_utils/agentEvalPromptAssembly.js:197`), but projected rules carry the rule-document id (`api/_utils/projectActiveRules.js:43` — `ruleId: r.id,`); MEASURED, the 16 battles that carry the target rule carry it as `dim-sx-04`. INFERRED: the special render never fires for them; whether any other document id equals `sx-04` was not checked.
16. **(bug candidate, not verified)** The hurdle floor and swap cap are called on the stagnation and model-swap paths of `agent-evaluate.js`; the proposal, gameplan-meeting and deterministic paths were not seen to call them in that file. Another module may gate them.
17. Contrarian's dead `canEnterDistressed: true` is contradicted by the shared `STRICT EXCLUSION` of distressed stocks.
18. Two stale comments: `api/_utils/controlPromptRenderer.js:222` calls standing leans dark (they are on); the fundamentals mirror header calls it dark (it is on).
19. `equippedBundleIds` is empty on every agent and every battle, although 208 bundles exist: rules are equipped one by one.

## 11. Founder questions

1. **Who owns a strategy?** (a) One shared menu (today's S1–S5, cleaned up), with each archetype allowed a subset; (b) strategies written per archetype — today's starter traits are the nearest existing carrier; (c) strategies as Forge rules or collections the player equips; (d) a shared menu plus the player's equipped preference on top.
2. **Should code detect the setup, or the model?** (a) Code detectors per strategy (as the Trend Follower setup evaluator already does for breakout and pullback-and-resume), shown to the model as a fact; (b) the model keeps judging from readings, but must name one strategy from a closed list; (c) both — code detects, the model chooses and names.
3. **Should every swap carry a named strategy from a closed list** (E2's three lines), so the Film Room can grade outcomes by strategy? (a) Yes, closed list including "risk management" and the code-made rotation; (b) closed list plus free text; (c) keep free text.
4. **Should a swap carry its own exit condition and time limit**, as called shots already do? (a) Yes, required on every swap; (b) only on strategy swaps; (c) no.
5. **The forced rotation makes most swaps without the model.** (a) Keep it as the archetype's main mechanical difference and label its swaps; (b) route it through the model as a suggestion; (c) retune it per archetype after strategies exist.
6. **Three archetypes are identical at trade time.** (a) Give Fundamental Investor, Contrarian and Diversifier distinct trade-time gates (e.g. code-enforced quality floor below 40; the sector cap outside League); (b) let strategies be the difference; (c) leave as is.
7. **Dead archetype settings** (favoured/avoided strategies, conviction mods, trade frequency, default preset). (a) Wire them; (b) delete them; (c) leave them as documentation.
8. **Inputs the prompt asks for but does not supply** (bench NR7 and regime, held RSI, beta, earnings dates, stop levels, the quality score). (a) Supply them; (b) remove the instructions that need them; (c) supply some, by archetype.
9. **Should equipped "must obey" rules become code checks** (the dark compiler) before strategies are added? (a) Yes, first; (b) after; (c) no — keep rules as text.
10. **The clause contradiction.** (a) Flip `EQUIPPED_RULE_PRECEDENCE_ENABLED` so the identity says equipped rules decide *whether* a trade happens; (b) keep "never reverse" and drop the precedence sentence; (c) leave both.
11. **The S1 label collision.** (a) Rename the shared strategies (e.g. by name only); (b) renumber the player's preferences; (c) leave it.

---

## Method appendix

**Production reads** (project `tradeseven`, 17 Nov 2026, morning ET). Scripts kept outside the repository in `Documents/FantasyTrades/Archetype/Anatomy/`, with the out-of-tree copy of this report. Each passed a grep for write verbs (`set`, `add`, `update`, `delete`, `create`, `commit`, `batch`, transactions) before it ran; every match was a local `Map`/`Set` call or a hash `update`, none a Firestore write.

| Script | Reads | Produces |
|---|---|---|
| `c0_census.mjs` | `agentBattles` created ≥ 15 Sep (field-limited), `ticks` and `tickBodies` counts per battle | battles by owner/archetype/month; checks by archetype |
| `c1_probe.mjs` | one recent `tickBodies` request | the request's envelope keys and section headings (no content) |
| `c2_requests.mjs` | answered `ticks` (`model.outcome == 'ok'`), 11 `tickBodies`, 60 `originalToolResult.rationale` | C1 table; system-section hashes; the C3 reasons, written to a local file for hand-sorting (ids scrubbed) |
| `c2b_sameday.mjs` | same, by ET day | the two same-session diffs and their cohort facts |
| `b5_probe.mjs` | 19 recent non-League battles (key names only) | where archetype, versions, rules and regime live |
| `b4_census.mjs` | `agents` (key names), battles since 15 Sep | B5 coverage; rules on battles; `trade_reasoning.strategy` values |
| `b4_agents.mjs`, `b4_rules.mjs` | `agents`, `agents/{id}/rules`, `agents/{id}/bundles` | B4 (template ids via `sourceRef`; bundle names compared only against code-authored collection titles, never printed) |
| `b4_traits.mjs` | battles since 15 Sep joined to `agents/{id}/rules`; the 11 Part C requests | starter rules per battle and per request (supersedes `b4_bornwith.mjs`, whose id-prefix count missed trait rules stored under ordinary document ids) |
| `b5_trades.mjs` | `trades[]` on battles since 15 Sep | swaps by source |
| `e_grades.mjs` | `agents.memory[]` | hypothesis self-grades |

**Token estimate.** Section characters × the request's measured `inputTokens` ÷ the request's total characters (system, three messages, tool JSON). Overall ratio across the 11 requests: 3.1 characters per token. Identity lengths in A1 use the repository's own 1,050-character ≈ 240-token equivalence instead, because the request-wide ratio is pulled down by the tool JSON.

**Citations.** Every `path:line` — `quote` pair in this report was checked against HEAD with `checkcites.mjs` (reads only): 80 quoted pairs hold, 0 fail. The 252 citations without a quote were printed with the text of their line (`uncovered.mjs`) and each was read against its claim. A privacy scan found no account id, no document id and no player-written bundle name in the report.

**Readers.** Five general-purpose readers at HEAD, read-only, each returning `file:line` plus exact line text; their reports were checked by the coordinator against the code for the claims carried here (A3's dead fields, A5's legacy sort, B2's zero enforcement, D1's held/bench split, D3's neutralised volume, E1's schema, the `sx-04` id mismatch).
