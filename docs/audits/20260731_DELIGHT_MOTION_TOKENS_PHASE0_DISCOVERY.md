# Delight Layer — Task 3 (Motion Token Foundation) — Phase 0 Read-Only Discovery

**Date:** July 31, 2026
**Arc:** Delight Layer, Task 3 of ~5 (Motion Token Foundation). Precedes Task 4 (signature gesture), which consumes this vocabulary.
**Spec under discovery:** DELIGHT LAYER ARC — Task 3: Motion Token Foundation, V1
**Branch:** `claude/delight-motion-tokens-fcqw97`
**HEAD:** `20de9ed9ff2683072fb978b9cb0c01508c20515b` (identical to `origin/main` after fetch)
**Tree:** clean (`git status --porcelain` empty)
**Fence status:** NON-FENCED. No file under BUILD_RULES §1 was read or written. Zero `api/` contact. Client-only.
**Status:** **HARD STOP.** No code written. The founder locks the vocabulary VALUES (§4) and the pilot surface (D3) from the inventory below before Phase 1.

---

## 0. Preamble — protocol compliance

| BUILD_RULES rule | Compliance |
|---|---|
| §3 `git fetch origin` is the FIRST step | Done before any comparison. Fetched at session start (many new remote branches). `origin/main` == local HEAD == `20de9ed9`. |
| §2 open by reporting branch / HEAD / clean-tree | Above. Branch matches the designated branch `claude/delight-motion-tokens-fcqw97`. |
| §3 read-only discovery then hard STOP | Nothing in the working tree was modified. This report is the only artifact. |
| §3 every claim carries `file:line` + VERIFIED/ASSUMED | Applied throughout. See §0.1. |
| §3 bugs found are reported, not fixed | 11 pre-existing defects filed in §6 for separate tasking. None fixed. |
| §3 reports are files, outside the repo tree too | A byte-identical copy is written to the session temp dir and offered for download alongside this commit. |
| §8 founder is non-technical: lead with a verdict table | §1 below. |
| §10 color-token arc | Not touched. Motion tokens are numeric physics, not colours — the `--ft-*` substrate and its hazards (H2 `var()` in Motion, etc.) do not apply. |

### 0.1 Method and what VERIFIED means here

Discovery ran as an **11-agent fan-out**: 8 parallel read-only census agents (one per spec §3 item), plus 3 adversarial verifiers instructed to *refute* and independently re-derive the load-bearing numbers of the three crux items (transition census, implicit defaults, CSS-side motion) with different tooling.

**Verifier verdicts: 2 CONFIRMED, 1 PARTIAL, 0 REFUTED.** The PARTIAL (CSS-side) carried two peripheral corrections, both folded in below. Every headline number in §2–§4 was additionally **re-run first-hand by the session lead** and is marked VERIFIED.

Provenance markers:
- **VERIFIED** — read this session. Every load-bearing count in §2/§4 was re-derived first-hand by the lead (grep commands re-run); inventory-only items (§2.1, §2.6, §2.7) were read by the census agent and, where noted, spot-checked by the lead.
- **ASSUMED** — inferred, not directly observed; each says what would confirm it.

**One environment caveat, disclosed because it bounds the guard-feasibility finding:** `node_modules` is present in this checkout but the full suite was not run; all guard-feasibility claims (§2.8) are static — the recommended guard is *modeled on* the shipped `tokens.guard.test.js`, whose CI wiring was read, not executed.

---

## 1. Executive verdict

**The spec is sound.** Its central insight — that adopting a motion token anywhere is a *feel change*, not a parity migration (§2 of the spec) — is correct and now measured. Discovery does not overturn the spec; it fills in the two things the spec deferred to this STOP: the **five token VALUES** and the **pilot surface**. There are four calibrations the founder should note before Phase 1, and one premise that is quantitatively wrong.

The deeper finding mirrors Task 1's "scope inversion," but for motion: the app already has **seven** disjoint motion-constant modules and a **de-facto standard that no module declares** — the single most-used spring (`stiffness:300, damping:25`, 28 sites) emerged *inline*, not from any preset. The codified presets (popIn `500/25`, PressableScale `400/17`, TUG `170/20`) are minority or one-off. So the vocabulary must describe what the app *does*, not what its abandoned preset files *say*.

| # | Verdict | Detail |
|---|---|---|
| **V1** | **Spec premise MISCALIBRATED — it is ~⅓, not "most"** | Spec §2 says "most Framer Motion usage specifies no transition." Measured: **~34%** of animation-bearing `<motion.*>` elements have no `transition=` (228 of 672); the other **66% DO** specify one. The no-transition population is large and load-bearing — but it is a third, not the majority. The spec's *conclusion* (a naive migration silently changes that third) stands; only the word "most" is wrong. |
| **V2** | **De-facto SPRING standard = `300/25` (28 hits) — declared by NO module** | The single most-used spring signature is `type:'spring', stiffness:300, damping:25`, and the whole stiffness-300 family is **66/130 = 51%** of springs. The five codified presets are minority. The vocabulary's spring values must come from the census, not the preset files. |
| **V3** | **De-facto TWEEN = bare `duration:0.2` (93), then `0.3` (54); ease is `easeOut` (47 > easeInOut 38)** | Tweens are a long tail of **30 distinct durations** with `0.2` the plurality (micro-interactions) and `0.3-easeOut` the canonical entrance. There is real drift, not one clean tween standard. |
| **V4** | **D1 answered — a NEW sibling `src/theme/motion.js` is correct; there is nothing to re-point** | Seven motion-constant modules exist, all **import-disjoint** with **zero numerically-identical springs**; none is a superset, no `src/theme/motion.js` exists, and `theme/tokens.js`/`cssTokens.js` hold **zero** motion tokens. Re-pointing one cannot subsume the rest. Sibling is the clean home (spec D1's default path). |
| **V5** | **`src/components/ui/motion.jsx` is DEAD (0 importers)** | The wrapper library the spec's grounding treats as a live preset system has **zero** consumers anywhere in `src/` (test or non-test). Its presets (`popIn` 500/25, `PressableScale` 400/17) are a **model**, not a live standard — do not "consolidate into it." |
| **V6** | **A 5th, non-Framer motion system exists — scope it OUT** | `faceEngineCore.js` is a hand-rolled rAF engine with its own JS easing functions (`lin/out/in/io/back/snap`), not Framer transitions. A Framer token layer cannot express it and must not try. |
| **V7** | **Reduced motion is honored everywhere inspected — the defect is accessor SPRAWL, not coverage** | FIVE divergent mechanisms, no shared accessor: framer `useReducedMotion` (15 sites, mount-latched/stale), `MotionConfig` (2), a custom live-subscribed hook (1), four module-level `matchMedia` fns (~14 call sites), and the pure `resolveLoopPlan({reducedMotion})` (Task 2 pattern). This is exactly what D2's single injected-argument accessor unifies. |
| **V8** | **`gesture` token has a real target and a scope question** | Only **6** components do true drag; only **3** read release velocity, and only **2** via Framer's `info.velocity` (`useDrawerSnap` spring `300/30`). The other two hand-roll velocity — a Framer-spring token won't reach them unless Task 4 migrates them. The magic number `velocity < -500 px/s` recurs 3× independently. |
| **V9** | **Guard is FEASIBLE-WITH-CAVEATS** | An opener-regex `transition\s*=\s*\{\{` guard modeled on `tokens.guard.test.js` catches all 427 inline literals with near-zero false positives and runs in existing CI unchanged. Caveat: it is **count-based, not site-based** — 71 sites (identifier refs, conditional exprs, and 51 `transition:` keys inside variants) are structurally invisible; the variants channel is the one real leak. |
| **V10** | **CSS keyframe duplication quantified (D4 — report only)** | `index.css` (76 keyframes) is the single live global source; `animations.js` KEYFRAMES is **72/73 byte-identical duplication** and ~98.6% dead. Not fixed this task per D4. |
| **V11** | **11 pre-existing defects found, none fixed** | Per §3, filed in §6 for separate tasking. Two ship broken/dead code today (a broken barrel re-export, a fully-dead wrapper library). |

**Recommendation:** lock the five VALUES from the §4 table and pick a pilot from §3-D3, then proceed to Phase 1 (inert define). The spec needs no re-version — a one-line §2 calibration ("~⅓, not most") and the D1 confirmation (new sibling) are the only edits.

---

## 2. Discovery findings — spec §3 items 1–8

### 2.1 Motion library surface (§3 item 1)

framer-motion **`^12.23.24`** ships (`package.json`); React 19. The app leans almost entirely on the **declarative JSX-prop** surface and barely touches the imperative/hook surface. **VERIFIED** (agent census; per-API distinct-file counts).

| API | Distinct files | Notes |
|---|---:|---|
| `from 'framer-motion'` (importers) | 249 | All non-test; **0** test files import it. `motion/react` path = **0** (100% on legacy import). |
| `<motion.*>` component | 242 | 546 `motion.div`, 129 `motion.button`, 45 `motion.span`, rest p/path/h/section/li/g/blockquote |
| `animate={` | 201 | workhorse |
| `transition={` | 191 | workhorse |
| `initial={` | 181 | |
| `exit={` | 106 | |
| `AnimatePresence` | 102 | |
| `whileTap={` | 76 | tap ≈ 2× hover |
| `whileHover={` | 35 | |
| `useReducedMotion` | 18 | see §2.6 |
| bare `layout` prop | ~17 | |
| `variants={` | 15 | |
| drag family (union) | ~9 | `drag=` 3, `onDrag` 5, `dragConstraints` 4, `dragElastic` 3, `dragMomentum` 1, `whileDrag` 1 |
| `layoutId` | 6 | |
| `useTransform` / `useMotionValue` / `useSpring` / `useAnimationControls` / `useScroll` | 4 / 3 / 2 / 2 / 1 | rare |
| `whileInView` · `useInView` · `useAnimate` · `useMotionTemplate` · `useVelocity` | **0 each** | not used anywhere |

Citations: `src/components/shared/CenteredModal.jsx:5,15–19`; `src/components/ui/motion.jsx:221–222`; `src/components/Forge/Watchlist/TickerChip.jsx:83`. **Implication for the token module:** it must be a plain-object vocabulary consumable by the `transition` prop (which is the shape 191 files already use); no hook API is needed for the tokens themselves (D2's accessor is a pure function, not a hook).

### 2.2 Transition census (§3 item 2) — the crux

**Verifier verdict: CONFIRMED. Every de-facto-standard claim independently reproduced; lead re-ran the crux greps first-hand.**

Across `src/` non-test code: **427** inline `transition={{…}}` literals + **18** `transition={identifier}` refs (≈445 explicit specs). **130** springs carry explicit stiffness; **51** more transitions live as a `transition:` key inside a variants/animation object.

**SPRING value-sets** (130 explicit; distinct signatures ≈ 37–38):

| stiffness / damping (mass) | count | representative sites |
|---|---:|---|
| **300 / 25** ⭐ **de-facto standard** | **28** | `challengeDefinitions.js:40` (multiline) · `AssetPickerModal.jsx:444` (reversed order) · `ParamToggle.jsx:7` |
| 400 / 25 (snappier secondary) | 13 | `shockwaveUtils.js:19` · `DashboardBattleCard.jsx:382` |
| 300 / 28 | 8 | `CenteredModal.jsx:38` · `SeasonEntryModal.jsx:53` |
| 300 / 24 | 8 | `GameModeCards.jsx:155` (+2 ARCHIVED) |
| 300 / 24 / mass 0.8 | 7 | `DashboardLoop.jsx:28` · `DashboardDesktop.jsx:28` |
| 300 / 20 | 6 | `animationPresets.js:68` (springBouncy) · `MagnitudePillars.jsx:110` |
| 300 / 30 | 6 | `useDrawerSnap.js:4` · `SwapMarketModal.jsx:402` |
| 500 / 25 | 6 | `motion.jsx:35` (popIn) · `BreakoutFeed.jsx:106` |
| 400 / 30 | 5 | `HolographicBorder.jsx:24` |
| 200/20 · 100/20 | 4 each | `BattleEndScreen.jsx:277` · `BattleHeader.jsx:173` |
| 400/15 · 320/32 | 3 each | `PitStopLockInBar.jsx:38` (LOCK_IN_SPRING) · `SectorCard.jsx:66` |
| **170 / 20 / 1.2** (TUG_SPRING) | 1 | `animationTokens.js:25` |
| **400 / 17** (PressableScale) | 1 | `motion.jsx:223` |
| ~17 further one-offs | 1 each | 500/35, 350/30, 320/22, 300/18, 260/24, 250/20, 120/10 … |

**Family rollup: stiffness 300 = 66 (51%)** · 400 = 25 · 200 = 9 · 500 = 8 · 100 = 6 · 320 = 5. **Lead-verified:** `stiffness:300,damping:25` = 20 (canonical order) + 7 (reversed `damping:25,stiffness:300`) + 1 (multiline `challengeDefinitions.js`) = **28**. *(A naive same-line "stiffness-then-damping" grep undercounts this to 20 — the reversed-order and multiline forms are the trap the verifier documented and the lead confirmed.)*

**TWEEN value-sets** (327 duration occurrences; 30 distinct durations):

| duration / ease | count | representative sites |
|---|---:|---|
| **0.2 / (no ease)** ⭐ plurality | **78** (93 all-ease) | `App.jsx:10288` · `CenteredModal.jsx:19` · `motion.jsx:26` |
| 0.3 / (no ease) | 38 (54 all-ease) | `motion.jsx:12` (fadeIn) · `DataStrike.jsx:35` |
| 0.4 / (no ease) | 28 (33 all-ease) | `challengeDefinitions.js:42` · `EventFeed.jsx:149` |
| **0.3 / easeOut** (canonical entrance) | 10 | `motion.jsx:146` (FadeIn) · `EventFeed.jsx:512` |
| 0.2 / easeOut | 11 | `motion.jsx:26` (scaleIn) |
| 0.25 · 0.15 | 20 · 10 | `DailyBriefingCard.jsx:238` · `animationTokens.js:61` (PCT_SLIDE) |
| **0.4 / easeOut** (large entrance) | 5 | `motion.jsx:19` (fadeUp) |
| 0.6 / easeInOut (HOLO_SWEEP) · 0.35 / easeOut (DATA_STRIKE) | 4 · 1 | `animationTokens.js:32` · `:7` |
| ~20 more (ambient loops 1.5–30s, one-offs) | 1–10 each | 1.5, 2, 30 (marquee), 0.18, 0.8, … |

**Lead-verified durations: 0.2=93, 0.3=54, 0.4=33, 0.25=20, 0.15=10; easeOut=47, easeInOut=38** — all exact. **Named-ease preference: `easeOut` dominates.** Cubic-beziers are one-off drift (`[0.4,0,0.2,1]`×4, `[0.22,1.2,0.36,1]`×3).

**OTHER shapes:** `staggerChildren:0.05` (7 of 9) · 60 delay-only transitions · 52 `repeat:Infinity` (ambient loops) · 32 keyframe-array `animate` blocks · `whileTap` scale is itself **un-standardized** (0.97×25 / 0.95×25 / 0.98×18 — a three-way tie).

**De-facto standards, stated plainly:**
- **Spring:** `{ type:'spring', stiffness:300, damping:25 }` — a decisive plurality (28 vs next 13), reinforced by the 51%-of-all-springs 300-family.
- **Tween:** no single full-spec standard. Plurality is bare `{ duration:0.2 }` (micro), with `{ duration:0.3, ease:'easeOut' }` the canonical entrance and `easeOut` the house ease.

### 2.3 Implicit defaults (§3 item 3) — the "silently changed" population

**Verifier verdict: CONFIRMED to the digit (independent brace-depth parser reproduced 228 / 33.9%).**

| Population | Count | Method |
|---|---:|---|
| Total `<motion.*>` elements | 737–738 | brace-depth parse of each opening tag |
| Animation-bearing (has `animate`/`whileHover`/`whileTap`/`exit`/`layout`) | 672–673 | |
| …with explicit sibling `transition=` | 444–445 | ~66% |
| **…with NO transition → inherit framer default** | **228 (~34%)** | the silent population |
| — gesture-only (`whileTap`/`whileHover`) | ~102 | inherit default gesture spring |
| — `animate`/`exit`/`layout`-based | ~110 | inherit default tween/spring |
| — may carry transition via in-tag `variants=` | ~16 | excluded from the silent floor |

**Proportion: ~30–35% (roughly one-third).** Refinements the verifier added: **24 of the 228 are dead `.ARCHIVED.jsx` code** (never ships) → the live, migration-relevant silent population is **~204 / 636 = 32.1%**; only **2** are imperative `useAnimation` false-positives (`DataStrike.jsx:57`, `MechSVG.jsx:264`) whose transition lives in a `.start()` call the JSX audit cannot see.

**This is the number spec §2 rests on** — and it corrects the spec's wording: a naive migration that only rewrites explicit `transition=` props leaves this third untouched on framer's library defaults. But it is a *third*, not "most" (V1). Cited silent examples: `App.jsx:2038`, `BattleEndScreen.jsx:410`, `FreeAgentBar.jsx:79`, `BaggerBombScoreboard.jsx:70`. **VERIFIED.**

### 2.4 CSS-side motion (§3 item 4) — D4, report only

**Verifier verdict: PARTIAL (headline sound; two peripheral slips corrected).**

| File | # keyframes | Live? | Purpose |
|---|---:|---|---|
| `src/index.css` | 76 | **LIVE** (`main.jsx:5`) | Canonical global keyframe library |
| `src/constants/animations.js` (KEYFRAMES) | 73 | **~98.6% DEAD** | JS duplicate; **72 byte-identical** to index.css |
| `src/theme/tokens.css` | 0 | LIVE (`main.jsx:6`) | `--ft-*` colour tokens; no motion |
| `src/styles/holographic.css` | 0 | LIVE (`main.jsx:7`) | surface styling; no keyframes |
| `src/App.css` | 1 (`logo-spin`) | **DEAD** (no importer) | CRA scaffold leftover |
| `src/components/League/league.css` | 10 (`clb*/lg*/ot*`) | LIVE (**6** importers) | namespaced; **zero** overlap with index.css |
| `src/components/League/battleArena/battleArena.css` | 23 (`bv2*`) | LIVE (3 importers) | namespaced; **zero** overlap |

**Task 1's "~74 vs ~76" ambiguity is settled: true definitional overlap = 72** (identical by name AND body; spot-checked `spin`, `pulse-glow`). Only `bagger-glow-pulse` is unique to `animations.js` (genuinely needed, injected via `<style>` in `AssetPerformanceRow.jsx:73`); only `ambientBreathe`, `clash-pulse`, `flowGradient`, `thresholdBreath` are unique to index.css. `getAllKeyframes()` is **called nowhere** (`animations.js:799`); `HOLO_ANIMATIONS` re-injects 8 keyframes that already exist globally (redundant). **Net unique to preserve across both = 77.** Per **D4 this is reported, not fixed.** Corrected slips (folded): `league.css` importers **6 not 5** (+`LeagueClimbChart.jsx`); the reduced-motion guard is `index.css:550` (one census agent wrote `:549`). **VERIFIED.**

### 2.5 Existing motion constants (§3 item 5) — gates D1

**Seven** modules export motion constants — the 4 the spec grounding named, plus **3 previously-uncataloged** (lead spot-verified all three):

| Module | Key motion exports | Importers | Disjoint? |
|---|---|---:|---|
| `src/constants/animationTokens.js` | `TUG_SPRING` 170/20/1.2, `DATA_STRIKE` 0.35/easeOut, `HOLO_SWEEP` 0.6/easeInOut, `PCT_SLIDE` 0.15 | 7 | disjoint |
| `src/constants/animations.js` | `KEYFRAMES` (CSS), `ANIMATION_PRESETS`, `HOLO_ANIMATIONS` | 1 | disjoint (CSS domain) |
| `src/components/ui/motion.jsx` | `fadeIn`/`fadeUp`/`scaleIn`/`popIn` 500/25; `PressableScale` 400/17 | **0 — DEAD** | disjoint |
| `src/components/earningsGame/animationPresets.js` | `springSmooth` 200/25, `springBouncy` 300/20, `buttonTap` 0.97 | 14 (all in-dir) | disjoint |
| `src/utils/shockwaveUtils.js` **(new)** | `SHOCKWAVE_CONFIG` (flinch 400/25, recoil 300/15, cubic `[0.1,0.9,0.2,1]`), `prefersReducedMotion()` | 7 | disjoint |
| `src/components/Dashboard/WeeklyChallenges/challengeDefinitions.js` **(new)** | `FLIP_VARIANTS` (classic 300/25, snake 250/20, wildcard 200/15) | 5 | disjoint |
| `src/components/AgentPresence/faceEngineCore.js` **(new)** | `EASE` (JS funcs lin/out/in/io/back/snap), `REDUCED_MOTION` | 2 (+1 test) | disjoint — **non-Framer** |

**Spring intersection matrix — ZERO numerically-identical configs across any two modules.** Stiffness anchors 200/300/400 recur with *different* damping (300 appears as /20, /25, /15, /30 in four modules). Easing overlap is only at Framer-primitive level (`'easeOut'`/`'easeInOut'` strings). `theme/tokens.js` and `theme/cssTokens.js` hold **zero** motion tokens (grep matched only comment lines). No `src/theme/motion.js` exists.

**D1 is therefore answered:** no module is a superset, so re-pointing one cannot subsume the others; `ui/motion.jsx` (the most "preset-like") is dead code; a **new additive sibling `src/theme/motion.js`** is the structurally clean home — exactly the Task-1 R-S2 pattern (`cssTokens.js` is a sibling to `tokens.js` for the same reason). **VERIFIED** (lead re-ran the 0-importer and theme-token greps).

### 2.6 Reduced-motion handling (§3 item 6) — grounds D2

**Every surface inspected honors reduced motion today. The defect is accessor SPRAWL, not coverage** — FIVE mechanisms with no shared accessor. **VERIFIED** (agent census; ~25 sites cited).

| Style | Mechanism | Subscription model | Representative sites |
|---|---|---|---|
| A | framer `useReducedMotion` | **mount-latched** `useState`; `null` on first paint; **stale after mid-session toggle** | 15 sites: `DataStrike.jsx:23`, `DeployCeremony.jsx:35`, `ArchetypePicker.jsx:220`, `RankCard.jsx:18`, `MechSVG.jsx:25`, `TacticalPod.jsx:47`, … |
| A′ | framer `MotionConfig reducedMotion="user"` | framework-level, all nested framer anims | `SignalDropEntry.jsx:381`, `WatchlistChat.jsx:707` |
| B(hook) | custom `usePrefersReducedMotion` (`matchMedia` + `addEventListener('change')`) | **live-subscribed** | `StarfieldBackground.jsx:135` (docblock at `:124–134` explains the contrast with A) |
| B(fn) | module `prefersReducedMotion()` / `clbReduce()` | fresh `matchMedia` read per call | `arenaEngineCore.js:141` (8 consumers), `shockwaveUtils.js:38`, `leagueClimbFixtures.js:74` |
| C | module-load const `REDUCED_MOTION` | latched at import | `faceEngineCore.js:17` (reactivity added separately via `ctl.setReduced`) |
| Pure | `resolveLoopPlan({reducedMotion})` (Task 2 pattern) | injected argument | `warpStateMachine.js:487`, threaded from B(hook) in `StarfieldBackground.jsx:422` |

CSS side: one global guard `@media (prefers-reduced-motion: reduce)` at **`index.css:550`** (universal selector, near-zeroes all durations) + 7 local CSS-in-JS blocks + the inverse `no-preference` pattern for the Vite logo (`App.css:30`).

**Grounds D2 cleanly:** the census's own conclusion is that a single accessor should **take `reducedMotion` as an injected argument** (the `resolveLoopPlan` pattern) and stay pure — it must **not** read `matchMedia` internally, because call sites legitimately disagree on the subscription model (latched vs live vs per-render). So `motionToken(name, { reducedMotion })` returning `instant` is the right shape; the caller owns the reduced-motion *source*.

### 2.7 Gesture surfaces (§3 item 7) — Task 4 forward-look, inventory only

Two tiers. **Tier 1 (broad, shallow):** 127 `whileTap` micro-presses across 76 files (11 in dead `.ARCHIVED` files) — decorative, not signature gestures. **Tier 2 (narrow, deep — the real Task-4 candidates):** exactly **6** components do true drag; **3** read release velocity for a decision. **VERIFIED** (agent census; lead read the two mature sites).

| Component | Gesture API | Velocity? | Purpose | file:line |
|---|---|---|---|---|
| `useDrawerSnap` (hook) | framer `onDragEnd(info.velocity.y)`, `useMotionValue`, spring **300/30** | **YES** — `< -500` → full | pull-up drawer snap | `Research/useDrawerSnap.js:52,55,58` |
| `AnalysisDrawer` (consumes hook) | `drag="y"`, `useDragControls`, `dragElastic 0.1` | via hook | drawer + handle drag | `Research/AnalysisDrawer.jsx:74–81` |
| `ProposalBanner` (2 sites) | `drag="y"`, `dragElastic 0.3/0.2`, `onDragEnd(info.offset)` | offset only | pill flick / banner dismiss | `Agent/ProposalBanner.jsx:120–134,325–328` |
| `TickerChip` | `drag="x"`, `dragSnapToOrigin`, `dragElastic 0.12`, `whileDrag` | offset only | swipe-to-remove | `Forge/Watchlist/TickerChip.jsx:76–85` |
| `CommandConsole` | **hand-rolled** `onTouch*`/`onMouseDown`, velocity from `Date.now()` | **YES** — `±500` | console expand/collapse | `draft/CommandConsole.jsx:126–135` |
| `DraftRoomScreen` (roster drawer) | hand-rolled `onTouchStart` + document listener, `deltaY > 80` | no | swipe-down close | `screens/DraftRoomScreen.jsx:1458` |

**Forward-look flags for Task 4 (not decisions now):** the `gesture` token's real job is drag-release with velocity preservation; a Framer-spring token reaches only the 2 `info.velocity` sites — the 2 hand-rolled sites need migration first. The magic `velocity < -500 px/s` recurs 3× independently, and `dragElastic` is hardcoded at 4 values (0.1/0.12/0.2/0.3). The drawer spring `300/30` differs from every existing preset — `gesture` would be a distinct spring identity unless aliased. Gesture surfaces have **zero** test coverage.

### 2.8 Guard feasibility (§3 item 8) — gates A5 / Phase 3

**Verdict: FEASIBLE-WITH-CAVEATS.** A guard modeled exactly on `src/theme/tokens.guard.test.js` (scan tree → diff committed baseline JSON → remedy in `expect()`'s 2nd arg → env-gated regen; runs in existing CI at `.github/workflows/tests.yml:55` with **zero** workflow change) works. **Lead-verified counts:** `transition={{` = **427** across **186** files; `transition={ident}` = **18**; `transition:{` variant keys = **51**.

| Detection target | Detectable by opener regex `transition\s*=\s*\{\{`? | FP / FN risk |
|---|---|---|
| Inline literal (single-line 410, multi-line 17, 1 nested) | **YES** — opener match, shape-agnostic | none |
| CSS `transition:'…'` property strings (494) | excluded by the `={{` anchor | none |
| Framer `transition:{…}` variant keys (51) | **not matched** | **FN — the one real leak channel** |
| `transition={identifier}` refs (12) | not matched | FN — but this is the *desired* tokenized end-state (benign) |
| `transition={cond ? {…} : {…}}` (8) | not matched | FN — branch literals slip through |
| Motion-definition modules (`motion.jsx` has 10 openers) | would match | FP — **MUST be excluded** from the guarded list |

**Recommended scope:** opener-only regex over a **curated, expanding `GUARDED_FILES` ratchet list** (Phase-3-migrated files only — do NOT baseline all 186 at once), **excluding** the motion-definition modules. Invisible-to-guard total = 71 sites (4.5% of the prop surface). **A5 must be worded as count-based, not site-based** (same limitation `tokens.guard.test.js` already documents): it proves "no new inline `transition={{` literal in guarded files," not "motion is tokenized." If A5 must catch the 51 variants-embedded configs, a literal guard is insufficient and an AST/lint rule is a separate task.

---

## 3. What the founder locks at this STOP

### D1 — Module (CONFIRMED: new sibling)

Build **`src/theme/motion.js`**, sibling to `cssTokens.js`. Not a re-point — §2.5 proves there is nothing to re-point into (7 disjoint modules, none a superset, the preset-like one dead). Pure, no React, no side effects, plain objects consumable by the `transition` prop.

### §4 — Vocabulary VALUES (proposed from the census; founder locks)

The five names are locked by the spec; the values below are the census-grounded proposal. **All are tunable post-lock without spec re-version (D5).**

| Token | Intent (spec §4) | Proposed value | Census basis | Open question for the founder |
|---|---|---|---|---|
| `snappy` | taps, toggles, small state — fast, minimal overshoot | `{ type:'spring', stiffness:400, damping:25 }` | 400/25 = the snappier secondary (13); highest stiffness with clean settle | Spring **or** tween? Micro-interactions also use bare `{duration:0.2}` (78). If "snappy" means the *tap-scale* feel, a tween 0.15–0.2 may fit better. |
| `smooth` | layout & content — calm, no bounce | `{ duration:0.3, ease:'easeOut' }` | the canonical entrance (0.3 = 54; easeOut is the house ease) | A tween gives literally zero bounce (cleaner than any spring). Confirm you want a tween here, not a high-damping spring. |
| `bouncy` | celebratory / emphasis — visible overshoot | `{ type:'spring', stiffness:300, damping:20 }` | `springBouncy` (300/20, 6 sites) — visible overshoot | Alternative: `popIn` 500/25 (faster, punchier) if "celebratory" should read bigger. |
| `gesture` | drag-release; preserve velocity on interrupt (Task 4) | `{ type:'spring', stiffness:300, damping:30 }` | the one mature drag site `useDrawerSnap` (300/30) | Alias to `bouncy` (300/20 ≈ 300/30) or keep distinct? Task 4 will exercise it; a distinct calm-settle spring is safest. |
| `instant` | reduced-motion / no-animation | `{ duration:0 }` | framer's zero-duration; the D2 return value | none |

**Two vocabulary observations to weigh at the STOP (per spec §4's "raise it here" clause):**
1. **The single most-used raw value (`300/25`, 28 sites) is deliberately NOT a token** in the proposal above — it sits *between* `snappy` (400/25) and `bouncy` (300/20). Adopting the vocabulary means those 28 sites each pick `snappy` or `bouncy` by intent — which is precisely the per-surface feel decision D3 gates. This is honest, but confirm you're comfortable that the app's plurality spring maps to two tokens, not one. (If you'd rather the plurality anchor a token, set `snappy` = `300/25` and re-home `400/25`.)
2. **The five names conflate two physical axes** — springs (`snappy`/`bouncy`/`gesture`) and tweens (`smooth`) — which the data supports, but `instant` is a tween-shape used as a spring-or-tween swap. That's fine for Framer (both are valid `transition` objects); flagged only so the accessor's `instant` return is understood as duration-0, not a spring.

### D2 — Reduced-motion accessor

`motionToken(name, { reducedMotion })` → returns `instant` when `reducedMotion` is true, the named token otherwise. **Must stay pure** (no internal `matchMedia`) — §2.6 shows call sites disagree on the reduced-motion source, so the caller injects it (the `resolveLoopPlan` pattern, `warpStateMachine.js:487`).

### D3 — Pilot surface (founder picks ONE)

Phase 2 adopts the vocabulary on ONE small, low-stakes surface as an explicit **feel change** (founder sign-off on preview). Census-grounded candidates, low-stakes first:

| Candidate | Why it fits | Tokens exercised | file:line |
|---|---|---|---|
| **`ParamToggle`** (Forge) | self-contained toggle; already uses a local `SPRING=300/25` const — a one-component swap with an obvious before/after feel | `snappy` | `Forge/ParamControls/ParamToggle.jsx:7` |
| **`CenteredModal`** (shared) | one modal entrance; uses `duration:0.2` + spring `300/28` today; visible but reversible | `smooth` + `snappy` | `shared/CenteredModal.jsx:19,38` |
| `RankCard` bar-fill | already reduced-motion-aware (`useReducedMotion`), so it also exercises the `instant` swap | `smooth` + `instant` | `Tournament/RankCard.jsx:18,59` |

**Recommendation:** `ParamToggle` — smallest blast radius, single spring, and its existing local `300/25` const makes the "point it at a token" diff a two-line change with an unambiguous feel comparison. Not the `gesture` token (that is Task 4's job) and not a dead surface (avoid `ui/motion.jsx` and the `DashboardLoop`/`DashboardDesktop` dead files Task 1 flagged).

### D4 / D8

D4 (CSS keyframe consolidation) — **not this task**; §2.4 quantifies it (72-overlap, its own future task). D8/A5 (guard) — **feasible-with-caveats** per §2.8; word A5 as count-based.

---

## 4. Pre-existing defects (report only — §3)

None fixed. Filed for separate tasking. Ordered by ship-impact.

1. **Broken barrel re-export** — `src/constants/index.js:12`: `export { animations, springConfigs } from './animations';` — `animations.js` exports *neither* name (real exports: `KEYFRAMES`, `ANIMATION_PRESETS`, `getAllKeyframes`, …). Both resolve to `undefined`. **Ships broken.** (lead-verified)
2. **Fully dead wrapper library** — `src/components/ui/motion.jsx`: entire module (4 presets + 9 wrapper components incl. `PressableScale`/`Pulse`/`Glow`) has **0 importers** anywhere. (lead-verified)
3. **~98.6% dead keyframe duplication** — `src/constants/animations.js`: 72/73 KEYFRAMES are byte-identical to `index.css`; `getAllKeyframes` (`:799`) called nowhere; `getKeyframes` (`:806`) and `createGlowKeyframes` (`:815`) dead.
4. **Redundant runtime injection** — `HOLO_ANIMATIONS` (`animations.js:839`) injects 8 keyframes via `<style>` in 4 screens; all 8 already exist globally in `index.css`.
5. **Dead CRA scaffold** — `src/App.css` (`logo-spin` keyframe) has no importer.
6. **Reduced-motion staleness (15 surfaces)** — framer `useReducedMotion` is mount-latched; a mid-session Reduce-Motion toggle keeps animations running until remount on all 15 sites (`StarfieldBackground.jsx:127–133` documents this). Only the subscribed hook / per-call fns / `faceEngine ctl.setReduced` react live.
7. **Latched module const** — `faceEngineCore.js:17` `REDUCED_MOTION` evaluated once at import; only saved from permanent staleness by a separately-threaded (also-latched) framer hook.
8. **`AgentOrb` reduced-motion gap noted in-code** — `AgentPresence.jsx:18–19` states `AgentOrb` respects reduced motion via neither the CSS guard nor a hook; the presence layer threads it specifically to paper over that.
9. **Duplicated unshared spring consts** — `SPRING = 300/25` re-declared independently in `ParamToggle.jsx:7`, `RadarChart.jsx:48`, `RuleConfigDrawer.jsx:12`; `slideTransition = 300/28` in two files; `LOCK_IN_SPRING = 400/15`.
10. **Hand-rolled velocity bug** — `CommandConsole.jsx:126–128`: release velocity computed as `dy/dt` where `dt = Date.now() - lastTime` updated on every move, so at release `dt` can be ~0 or reflect only the final frame — the `±500` flick thresholds are unreliable vs Framer's smoothed `info.velocity`.
11. **Touch-listener leak edge** — `DraftRoomScreen.jsx:1462`: roster-drawer document `touchmove` listener cleaned up on `touchend` (`once:true`) but not on `touchcancel`.

*(ARCHIVED files — `Agent/*.ARCHIVED.jsx` etc. — carry live spring/whileTap configs counted in the raw census; they inflate drift but never ship. Flagged, not a defect.)*

---

## 5. Fence & protocol closeout

- **Fence (BUILD_RULES §1):** NON-FENCED. No `api/` file read or written; no fenced function called. Client-only, as the spec states.
- **Import rule (§4):** N/A — no new imports introduced (read-only).
- **Discovery protocol (§3):** `git fetch origin` first ✓; branch/HEAD/clean-tree reported ✓; every claim carries `file:line` + VERIFIED/ASSUMED ✓; bugs reported not fixed ✓; report written as a file, with a byte-identical copy outside the repo tree ✓.
- **Review path:** Single-review per spec (defining a vocabulary is reversible; adoption is gated per D3).

**Next STOP:** founder locks the §4 VALUES table, the D3 pilot, and rules on the two vocabulary observations (§3), then Phase 1 builds `src/theme/motion.js` inert.

---

*End of Phase 0 discovery. 11-agent census (8 census + 3 adversarial verifiers: 2 CONFIRMED / 1 PARTIAL / 0 REFUTED); all corrections folded; every headline count lead-verified first-hand at HEAD `20de9ed9`. No code written.*
