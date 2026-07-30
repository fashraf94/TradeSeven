# Delight Layer — Task 2 (Battle-Weather Starfield Background) — Phase 0 Read-Only Discovery

**Date:** July 30, 2026
**Arc:** Delight Layer, Task 2 (Battle-Weather Starfield Background)
**Spec under discovery:** DELIGHT LAYER ARC — Task 2: Battle-Weather Starfield Background, V1 (design basis MARKET_WEATHER_STATE_MAP_V2.md)
**Branch:** `claude/delight-starfield-background-js9xtw`
**HEAD:** `96abcb5dfae6f33813c40268025effc959291712` (identical to `origin/main` after fetch)
**Tree:** clean (`git status --porcelain` empty)
**Fence status:** **NON-FENCED.** No file under BUILD_RULES §1 was written. The fenced `api/agent/decide.js` and `api/_utils/agentBattleService.js` were **READ only** (permitted per §1) to establish the battle-doc shape; zero edits, zero `api/` writes. Client-only.
**Status:** **HARD STOP.** No code written. Eight items (S1–S8) need a founder ruling before Phase 1, because they change what gets built.

---

## 0. Preamble — protocol compliance

| BUILD_RULES rule | Compliance |
|---|---|
| §3 `git fetch origin` is the FIRST step | Done before any comparison. Fetched `57b36dde..96abcb5d` on `main` plus ~25 new remote branches/tags. `origin/main` == local HEAD == branch tip == `96abcb5d`. |
| §2 open by reporting branch / HEAD / clean-tree | Above. On the designated branch `claude/delight-starfield-background-js9xtw`. |
| §3 read-only discovery then hard STOP | Nothing in the working tree was modified. This report (+ its out-of-tree copy) is the only artifact. |
| §3 every claim carries `file:line` + VERIFIED/ASSUMED | Applied throughout; provenance rules in §0.1. |
| §3 reports are files, outside the repo tree too | A byte-identical copy is written to the session scratchpad and offered for download alongside this commit. |
| §8 founder is non-technical: lead with a verdict table | §1 below. |
| §3 bugs outside scope → report, don't fix | 9 pre-existing defects filed in §7; **none fixed**. |

### 0.1 Method and what VERIFIED means here

Discovery ran as a **12-agent workflow**: 6 parallel read-only census agents (one per discovery dimension), each followed by an independent **adversarial verifier** instructed to *refute* the census and re-derive every load-bearing claim with different search formulations. The session lead additionally read the highest-stakes anchors first-hand.

Verifier verdicts: **2 CONFIRMED, 4 PARTIAL, 0 REFUTED.** The four PARTIALs carried corrections (z-index figures, one taxonomy over-flattening, a handful of ±1–3 line drifts); **every correction is folded in below — no uncorrected census claim appears.** One census agent (mount-fanout) emitted a placeholder; its verifier re-derived the whole dimension independently and CONFIRMED it, and the lead had already read the file end-to-end.

Provenance markers:
- **VERIFIED** — read this session. The crux claims (§4) and every headline in §2/§3 were read **first-hand by the lead**; the remainder were read by at least two independent agents (census + adversarial verifier).
- **ASSUMED** — inferred, not directly observed; each says what would confirm it.

One environment caveat (bounds §6): **`node_modules` is not installed in this checkout**, so the repo's test suite was not executed. All test-infra findings are read from config/source, not from a run.

---

## 1. Executive verdict

**The spec is directionally sound and buildable, with one architectural gap it does not name and a per-format split it must rule on.** The starfield engine, hygiene tiers, tint hook, and flag pattern all have clean, shipping precedents in this codebase — the D6 lifecycle contract is *already implemented verbatim* in `BaggerBombBackground.jsx`. But three of the spec's stated anchors are stale, and the single hardest question — "how does the starfield learn the user's live-game state?" — has an answer the spec did not anticipate: **the only live-game signal is a 120-second poll gated to the dashboard screen, and `DesktopBackground` receives none of it.**

| # | Verdict | Detail |
|---|---|---|
| **V1** | **Crux RESOLVED — end time IS knowable for the games that reach the dashboard** | Every `agentBattles` doc (casual vs-CPU, autopilot, tournament flat6) carries an ISO `expiresAt` = market close (`'fullday'` mode). The client already renders a countdown off it. **ENDGAME tier is buildable for these.** |
| **V2** | **Crux SPLIT — two formats fall back to BATTLE LIVE only** | The League **flat6 5-day** battle-week end is **NOT** client-knowable (server-only). **Snake Draft** end **IS** knowable (`battleEndTime` on the draft doc) — but Snake Draft lives in a different collection the dashboard signal does not carry. |
| **V3** | **Spec premise INCOMPLETE — the starfield has no live-game signal at its mount points** | `DesktopBackground` is passed only `isDesktop` at all 8 mount sites. The live set (`activeAgentBattles`) is an `App.jsx` poll gated to `screen==='dashboard' && isPageVisible`. D7 ("no new listeners") + this fact = the central Phase-1/2 decision. **Blocker for founder ruling, not for building.** |
| **V4** | **The entire D6 hygiene contract already ships** | `BaggerBombBackground.jsx`: canvas-2D + rAF, DPR capped at 2, reduced-motion→one static frame, `visibilitychange` pause, full unmount cleanup, **speed already a per-particle parameter**. It is the reuse precedent. |
| **V5** | **Spec anchors have drifted — 3 corrections** | Mobile early-return is `:11` not `:4`; container is `:55-65` not `:49-56`; `CommandDashboard` root paint is `:231` not `:227`; reduced-motion CSS is `index.css:550` not `:568-578`; the component is `src/components/DesktopBackground.jsx` not `…/Dashboard/…`. |
| **V6** | **Mount fan-out is 4× wider than the spec assumes** | `DesktopBackground` mounts at **8 sites across 7 files** (incl. signed-out Home, Profile, Builder, Join), not just `App.jsx:8567/:8608`. The starfield renders wherever it renders — a scope decision. |
| **V7** | **D5 override should be a URL param, not localStorage** | The repo has **zero** localStorage feature-gating precedent; the house pattern is `?param=1` via an SSR-safe `isXxxOn()`. `localStorage.ftWarpState` would be a house-first. |
| **V8** | **Flag-flip (R-LINES removal) breaks a guard test** | Deleting the price-line SVGs drops 3 pinned hexes → `tokens.guard.test.js` fails unless `tokenGuardBaseline.json` **and** its hard-coded R-BL21 assertions (21→18) are updated in the same commit. A flag-flip-PR checklist item. |
| **V9** | **No perf baseline exists** | Zero `performance.mark`/Profiler/web-vitals in the repo. "The starfield didn't regress the dashboard" has no in-repo assertion surface — the gate is Vercel-preview observation (matches the build rule). |
| **V10** | **D2 state machine (A2) is testable today; A3/A4 need scaffolding** | The pure `warpStateMachine` is a node-env unit test with no DOM. But a canvas rAF component can't be draw-tested under jsdom (nothing mocks `getContext`; no `setupFiles`). A3/A4 (loop scheduled?) need a jsdom-per-file env + rAF spy — a repo-first. |
| **V11** | **9 pre-existing defects found, none fixed** | Filed for separate tasking per §3. Two touch the exact liveness path the starfield would consume. |

**Recommendation:** rule on S1–S8 (§5), then start Phase 1. The arc is well-scoped; the engine, hygiene, tint, and flag pieces are low-risk because proven precedents exist. The one genuinely new thing is *wiring live-game state into a background layer that currently knows nothing about it* — and that wiring is a founder decision (S1) before any code.

---

## 2. Discovery findings — spec §3 items 1, 3, 4, 5, 6

### 2.1 `DesktopBackground.jsx` anatomy (§3 item 1)

`src/components/DesktopBackground.jsx` — **note the path: it is NOT under `…/Dashboard/`** as the spec's D1 implies. 216 lines. It is **SVG + a CSS `@keyframes` `<style>` block — there is no `<canvas>`, no `requestAnimationFrame`, no `getContext`** (grep zero matches). All VERIFIED first-hand.

| Fact | Reality at HEAD | Citation | Spec belief |
|---|---|---|---|
| Mobile early-return | `if (!isDesktop) return null;` | `DesktopBackground.jsx:10-11` | `:4` (stale) |
| Container positioning | `position:fixed / top,left,right,bottom:0 / zIndex:0 / pointerEvents:none / overflow:hidden` | `:55-65` | `:49-56` (stale) |
| Props | exactly `{ isDesktop }` — a single boolean; **no battle/liveness prop** | `:10` | — |
| Price lines (R-LINES target) | two `<svg>` blocks, 5 `<path>` total | `:83-152` (left `:84-120`, right `:123-152`) | — |
| Other decoration | gradient-mesh (`:68-81`), bull/bear silhouettes (`:154-191`), 15 CSS-animated floating particles (`:14-24`, `:194-210`) | — | — |
| Task-1 migration state | already consumes `cssVar('cyan'/'purple')` and `rgba(var(--ft-*-rgb), α)`; 3 SVG strokes stay hex under R-H8 | `:20`, `:75-76`, `:98/:138/:146` | — |
| Memoization | not `React.memo`; particle array is `React.useMemo` (`:14`) | `:14`, `:216` | — |

**Consumers / mount sites — 8 across 7 files** (spec assumed 2). All VERIFIED (`isDesktop={isDesktop}` at each):

| # | Mount site | Screen | Signed-in? | Renders content? |
|---|---|---|---|---|
| 1 | `src/App.jsx:8567` | Dashboard (**mobile** branch, `if (isMobile)` opens `:8560`) | Yes | **No** — `isDesktop` false here ⇒ early-return null |
| 2 | `src/App.jsx:8608` | Dashboard (**desktop** branch) | Yes | **Yes** (the only place it actually paints on the dashboard) |
| 3 | `src/screens/HomeScreen.jsx:157` | Home / **login** | No | Yes (desktop) |
| 4 | `src/screens/ProfileScreen.jsx:35` | Profile | Yes | Yes (desktop) |
| 5 | `src/screens/BuilderScreen.jsx:299` | Builder | Yes | Yes (desktop) |
| 6 | `src/screens/BattleViewScreen.jsx:206` | Battle view | Yes | Yes (desktop) |
| 7 | `src/screens/JoinScreen.jsx:27` | Join | mixed | Yes (desktop) |
| 8 | `src/screens/PreviousBattlesScreen.jsx:21` | Previous battles | Yes | Yes (desktop) |

The `:11` self-gate is the **sole** render control — placement is irrelevant, so mount #1 (mobile branch) is an inert no-op. VERIFIED.

> **The two prior Task-1 audits are stale here.** `20260729_DELIGHT_THEMING_FOUNDATION_PHASE0_DISCOVERY.md:253` cites the early-return at `:4` and the container at `:49-56`, and `20260729_DELIGHT_THEMING_PHASE2_PREAMBLE_HAZARD_SCAN.md:88` also cites `:4`. Both are wrong at HEAD (`:11` and `:55-65`). Do not reuse their line numbers.

### 2.3 Dashboard root opacity + z-stack (§3 item 3)

The z-order (bottom → top), all VERIFIED:

1. **Base fill** — the shared `containerStyle` div wrapping every `DesktopBackground` mount: `minHeight:100dvh; background: colors.background (#0d1117); overflowX:hidden`, **non-positioned** (`App.jsx:1465-1474`, value `App.jsx:1084`). Because it is non-positioned, its opaque paint sits **behind** the z0 fixed layer — it does **not** occlude the field and needs no change (it is the flag-OFF fallback fill).
2. **The field** — `DesktopBackground`, `position:fixed; zIndex:0; pointerEvents:none`, **no opaque background of its own** (only faint gradient + 0.08-opacity SVGs). `:55-65`.
3. **The occluder** — a per-screen **opaque `zIndex:1` root**. This is what hides the field today and is D4's real target.

**D4 targets (the two dashboards):**

| File:line | Paint | Opaque? | z / position | Occludes field? |
|---|---|---|---|---|
| `src/components/Dashboard/CommandDashboardDesktop.jsx:128` | `background: CMD.bg (#0d0e12)` | Yes | `zIndex:1`, `position:relative`, `height:100vh` | **YES** — primary target (only path where the field actually renders) |
| `src/components/Dashboard/CommandDashboard.jsx:231` | `background: CMD.bg (#0d0e12)` | Yes | `zIndex:1`, `position:relative`, `minHeight:100vh` | YES over z0 **if present** — but this is the **mobile** path, where the field is null (mount #1). Transparentizing it alone shows nothing unless the field is also enabled for mobile. |

`CMD.bg = '#0D0E12'` (`commandUI.jsx:17`) = `--ft-bg-dashboard`. **Spec's believed `:227` is wrong (off by 4); actual is `:231`.** VERIFIED. The desktop root is live only because `COMMAND_DASHBOARD_DESKTOP_ENABLED = true` (`featureFlags.js:33`); the `else` desktop branch (`App.jsx:8623-8651`) is unreachable dead code at HEAD.

**The other 6 screens** each follow the identical `containerStyle → <DesktopBackground/> → opaque z1 root` pattern, but their root paints **`#0d1117` / `colors.background`, not `CMD.bg`** (`HomeScreen.jsx:159-161`, `ProfileScreen.jsx:37`, `BuilderScreen.jsx:301`, `BattleViewScreen.jsx:208-210`, `JoinScreen.jsx:29`, `PreviousBattlesScreen.jsx:23-26`). So **D4 cannot be one global find/replace** — the token differs by surface. VERIFIED.

**Sidebar:** the persistent `DesktopSidebar` (`App.jsx:9851`) is `position:fixed`, opaque `tokens.bgCard (#15171E)`, `zIndex:40` (corrected from a census misread of 9999 — that is the hover *tooltip*). It covers only the 64/220px left rail, and it is **not** mounted on the Home screen (`App.jsx:9850` gate excludes `screen==='home'`). So the field will never show behind the rail on signed-in screens, but shows full-bleed on Home. VERIFIED.

### 2.4 Animation-loop conflict check + hygiene precedents (§3 item 4)

**Exactly four continuous, self-rescheduling rAF loops exist in `src/`** (all VERIFIED): three canvas — `BaggerBombBackground` (`:172`), Curtain `ParticleCanvas` (`CurtainScreen.jsx:116`), `MechParticles` (`:286`) — and one shared SVG — AgentPresence `FACE_REG` (`faceEngineCore.js:55`). Every other `requestAnimationFrame` in the tree is a one-shot layout read or a finite/`p<1`-bounded tween.

**Concurrency verdict:** none of the three *canvas* loops co-mounts with the Command dashboard (`BaggerBombBackground` → AgentBattleScreen Matchups / PvP view; `MechParticles` → ForgeScreen; Curtain → deprecated overlay — none in the 8-site set). **The only continuous loop that genuinely co-runs with a dashboard starfield is the AgentPresence `FACE_REG` SVG loop**, mounted by the dashboard via `EquipStation.jsx:222` / `IdentityPanel.jsx:81`, reactive-by-default (`AgentPresence.jsx:35`), with all three flags currently `true`. A starfield would therefore be a **second, independent rAF** beside it (never a second *canvas*). `DesktopBackground` itself adds no rAF (pure CSS). VERIFIED.

**The reuse precedent — `BaggerBombBackground.jsx`** implements the entire D6 contract:

| D6 requirement | Already in `BaggerBombBackground.jsx` |
|---|---|
| DPR cap at 2 | `MAX_DPR = 2`, `Math.min(devicePixelRatio, 2)` (`:16`, `:101`, `:183`) |
| reduced-motion → one static frame, no loop | opt-in `honorReducedMotion` + `useReducedMotion()` → `draw()` once, never schedules (`:72-75`, `:194-199`) |
| pause when tab hidden | `visibilitychange` → cancel rAF, restart on visible (`:213-220`) |
| unmount → cancel + remove listeners | cleanup returns cancel/clear/remove (`:222-227`) |
| slot | `position:fixed; inset:0; pointerEvents:none; zIndex:0/1` (`:233-250`) |
| **state-driven speed** | speed is already a per-particle parameter (`speed.min/max`, `:47`) |
| fresh values without restart | style opts held in refs (`:83-88`) |

Two caveats for reuse: its `honorReducedMotion` **defaults false** (always-animates for the PvP view) — a dashboard starfield must pass/​default it true; and its engine is a **particle *network* with connection lines and edge-wrap**, not the spec's *radial projection from a vanishing point with translucent frame-clear streaks*, and it seeds with `Math.random()` (non-deterministic). See S7.

**Reduced-motion / visibility house idioms** (reusable): `usePageVisibility()` hook (`usePageVisibility.js:4`, already consumed at `App.jsx:2196`); framer `useReducedMotion()`; raw `matchMedia('(prefers-reduced-motion: reduce)')` (`shockwaveUtils.js:40`, `arenaEngineCore.js:142`, `leagueClimbFixtures.js:74`). The global CSS guard at **`index.css:550`** (spec's `:568-578` is stale — that range is animation utility classes) zeroes CSS animation durations but **cannot stop a JS rAF loop** — which is exactly why the canvas precedents guard in JS. VERIFIED.

### 2.5 Flag infrastructure + dev override (§3 item 5)

House dev-preview pattern (VERIFIED): a `*_ENABLED` const **OR** a `?param=1` URL param, resolved through an SSR-safe `isXxxOn()` helper — `if (CONST) return true; if (typeof window === 'undefined') return false; try { return new URLSearchParams(window.location.search).get('param') === '1' } catch { return false }`. Five exist: `isTrainingPodDraftV2On` (`:345`), `isTrainingPodDesktopOn` (`:383`), `isAgentPresenceOn` (`:907`), `isMatchupsBackdropOn` (`:932`), `isDeployCeremonyOn` (`:1054`).

The closest precedents to Task 2 are the two animated-backdrop display surfaces: **`AGENT_PRESENCE_ENABLED`** (`:900`, read-only surface, byte-identical off) and **`MATCHUPS_BACKDROP_ENABLED`** (`:925`), whose docblock explicitly *"ports the PvP view's animated particle/constellation canvas (`BaggerBombBackground`)"* behind `isMatchupsBackdropOn`. `STARFIELD_BACKGROUND_ENABLED = false` should follow the merge-dark `*_ENABLED` convention (exemplars: `WATCH_LIST_RAIL_ENABLED:13`, `TRAIT_SLOT_ENABLED:116`) and be paired with an `isStarfieldOn()` helper.

**localStorage is used nowhere for feature gating or dev toggles** (VERIFIED). Its uses are caching, persistence, UI-mode memory, and one client ack. The **only** dev/debug localStorage key is `mc_api_debug` (`apiMonitor.js:22`), which toggles a debug *monitor*, not a product feature. So the spec's D5 `localStorage.ftWarpState`/`ftWarpClock` would be a **house-first** — see S4.

### 2.6 Perf baseline + test infra (§3 item 6)

**Perf baseline: none.** Grep for `performance.mark|performance.measure|reportWebVitals|web-vitals|Profiler|onRenderCallback` → zero matches. Every `performance.now()` is animation/hold-progress timing. The only analytics is `@vercel/analytics <Analytics/>` (`main.jsx:9,35`) — platform page analytics, not an in-repo render baseline. So "the starfield didn't regress the dashboard" has **no in-repo assertion surface** (V9 / S-perf).

**Test infra** (VERIFIED): runner is vitest `^4.0.17`; CI gate `.github/workflows/tests.yml` (on PRs into `main`, Node 20, `npm run test:run -- --maxWorkers=2`). `vitest.config.js` merges `vite.config.js` and adds only an `exclude` — **no `test.environment` (default = node), no `setupFiles`.** jsdom is opt-in per file via `// @vitest-environment jsdom` (the `canvas` package and `@testing-library` are **not** dependencies). **Nothing mocks `getContext` or `requestAnimationFrame` anywhere** — jsdom returns `null` from `getContext`, so a canvas rAF component cannot be draw-tested without new scaffolding. The house convention is a **render-free pure core + a `react-dom/server` smoke** (`arenaEngineCore.js:8` "Kept render-free so it is unit-testable WITHOUT a jsdom/React setup"). Implication for the A-matrix in §6.

---

## 3. THE CRUX — live-game state sources per format (§3 item 2)

This is the input to the entire State Map. **The single liveness signal the dashboard holds is `App.jsx` state `activeAgentBattles`** — a `getDocs` **poll** (not `onSnapshot`) of `agentBattles where ownerId==uid AND status=='active' limit 5`, re-run every **120 s**, **gated to `screen==='dashboard' && isPageVisible`**, mapping the full doc (`{id, ...d.data()}`, so `expiresAt` is present), filtering out training clones, and **resetting to `[]` on any fetch error** (`App.jsx:3873-3909`, VERIFIED first-hand). Both dashboards derive `isLive = Boolean(activeAgentBattles.filter(status==='active')[0])` (`CommandDashboard.jsx:135-137`, `CommandDashboardDesktop.jsx:85-87`); the **"No battle live / Deploy to send your agent in"** idle card is that `!isLive` empty state (`CommandDashboardDesktop.jsx:238`).

**All autopilot agent games are one document type — `agentBattles`** — created by the fenced `createAgentBattle` (`agentBattleService.js:63`) with `status:'active'`, `executionMode:'autopilot'` (the only shipped mode; `:237`), and an ISO `expiresAt`. Duration is hard-wired `AGENT_BATTLE_DURATION_MODE = 'fullday'` (`:31`), so `expiresAt` = the next market close (4pm ET / 1pm early-close / 8pm ET when crypto is held; `computeFullDayExpiry :359-373`). "House" is **not** a battle format (grep = only "house money"/"house edge" strategy terms); "managed agent" is **not** a distinct format (= autopilot). The status enum is binary `active → completed` — **there is no server "endgame" status; the ENDGAME tier is purely client-computed off `expiresAt`.**

**Per-format live-game matrix** (crux column double-verified; census VERIFIED + adversarial verifier CONFIRMED, lead re-read the three starred anchors):

| Format | Liveness signal | End time knowable client-side? | Duration (for R-WINDOW) | Update mechanism | ENDGAME possible? |
|---|---|---|---|---|---|
| **BaggerBomb tiered / casual (= vs-CPU)** | `activeAgentBattles` filter `status==='active'` (`CommandDashboard.jsx:135`; poll `App.jsx:3886`) | **YES** ★ — `expiresAt` on doc = fullday close (`agentBattleService.js:125`, `:359-373`); already rendered as a countdown (`ManageStation.jsx:33`) | `expiresAt − activatedAt`, both on doc (`agentBattleService.js:123-125`) | 120 s poll, **dashboard-only** (`App.jsx:3874,:3907`) | **YES** |
| **Managed / autopilot agent** | same `agentBattles` doc, same `status==='active'` | **YES** — inherits the doc `expiresAt` | same | same 120 s poll | **YES** |
| **Tournament flat6 (per-DAY)** | same poll (real `agentId`, `groupId` set) **+** `useMyTournamentBattle` onSnapshot (`useMyTournamentBattle.js:39`) | **YES (per-day only)** — the daily fullday doc's `expiresAt` = that day's close (`decide.js:1356-1365`) | daily `expiresAt − activatedAt` | poll or onSnapshot | **YES (per-day)** |
| **Tournament flat6 (5-DAY battle-week end)** | group doc `status==='battle'` via `subscribeMyGroup` (`tournamentGroupService.js:177`) | **NO** ★ — group doc carries no `battleStartDate`/end (`leagueTournament.js:1161`); week-close is server banking `dayN>=5` + Friday advancement (`:1140-1144`, `:242-247`) | 5 trading days (server-held) | onSnapshot (status only) | **NO → BATTLE LIVE only** |
| **Snake Draft** (separate `drafts` collection) | draft doc `status==='battle'`; `useDraft` onSnapshot (lobby/room-gated) | **YES** ★ — `battleEndTime` ISO stamped at completion (`draftService.js:514-530`); client 60 s countdown (`DraftBattleScreenV2.jsx:858-891`) | stocks ≈ 5 trading days / next Fri ~3pm CT; crypto 7 d (`battleTiming.js:90`, `freeAgencyService.js:487-520`) — the "120h" format | onSnapshot (lobby/room) + 30 s dashboard active-draft poll (`useDraft.js:294`) | **YES** — but **not in the dashboard `activeAgentBattles` signal** |
| **Training-pod agent battle** | **excluded** from the poll — `TRAINING_CLONE_ID_PREFIX` filter (`App.jsx:3896-3898`) | doc has `expiresAt`, but never reaches the signal | n/a | filtered out | **NO (never registers as live on the dashboard)** |

**Taxonomy correction (from the adversarial verifier).** A separate, still-routed BaggerBomb game system lives in the **`battles`** collection (`useBaggerBombBattle`/`V3`/`V4` → `doc(db,'battles',…)` onSnapshot), plus legacy human-PvP creator/opponent docs. Those carry client-side end-times too (`timing.tradingDays`, `getSessionTimeRemaining`) but **do not feed the starfield** — the dashboard reads them completed-only (`App.jsx:4627`) and their live views are screen-scoped. Net: the starfield's single liveness source stays the `agentBattles` poll, and every game that reaches it has a client-side `expiresAt`. This does not change the crux; it means "BaggerBomb" ≠ "the agentBattles casual deploy" without this caveat.

**Two consequences that become STOPs:**
1. **`DesktopBackground` receives no liveness at any of its 8 mounts** — only `isDesktop`. The set it needs (`activeAgentBattles`) lives in `App.jsx` and is passed to the *dashboard component*, never to the *background* (`App.jsx:8577`, `:8621`). Off-dashboard, the poll never runs (gate `:3874`), so the value is stale/`[]`. → **S1.**
2. **A 120 s poll can't cleanly drive the endgame ramp.** A battle deployed within ~15 min of close has an endgame window (`min(30min, 25%·duration) ≈ 3.75 min`) on the order of the poll interval, so poll-driven state could skip endgame entirely. The ramp needs a **client-side ticker off `expiresAt`** (exactly what `ManageStation.jsx:17-26` already does); the poll only supplies set-membership. [ASSUMED — analytical from the verified 120 s cadence + variable fullday duration.] → **S2.**

---

## 4. Feasibility of the D-decisions and the acceptance matrix

| Spec item | Verdict |
|---|---|
| **D1** engine (canvas 2D, ~220 particles, radial projection, DPR≤2) | **Buildable.** DPR≤2 + lifecycle already proven (`BaggerBombBackground`). Radial-projection *draw* is new; lifecycle scaffolding is not. |
| **D2** state machine (RESTING/BATTLE LIVE/ENDGAME, R-PREC soonest-ending, R-WINDOW min(30m,25%), eased transitions) | **Buildable as a pure function** from `[{endsAt, totalDuration}]`. Every input is client-derivable for `agentBattles` (see matrix). |
| **D3** tint via `readToken('warp-tint')` + `ft-accent-changed` listener | **Ready today.** `--ft-warp-tint → --ft-accent → --ft-cyan → #00d9ff` (`tokens.css:196,193,117`); `readToken` resolves the chain (`cssTokens.js:183`). No `var()` reaches canvas. |
| **D4** flag; transparent dashboard roots at flip | **Buildable**, but per-surface (§2.3): the two `CMD.bg` roots are the dashboard targets; the other 6 screens use `#0d1117`. Which surfaces? → S5. |
| **D5** dev override | **Change to URL param** (S4). |
| **D6** hygiene tiers | **Precedent-complete** (`BaggerBombBackground`). |
| **D7** consume existing state, **no new Firestore reads** | **Satisfiable** — the adapter maps the prop-threaded `activeAgentBattles` (already polled) → `liveGames`; the component imports no Firestore API (satisfies A6). The tension is *how the prop reaches the background* (S1), not a new read. |

**Acceptance matrix (spec §6) buildability:**

| Row | Verdict |
|---|---|
| **A1** flag-OFF inert (render-tree) | Buildable via `react-dom/server` smoke (the house idiom) — flag off ⇒ `StarfieldBackground` not in the tree, price lines render. |
| **A2** state machine (pure-function rows) | **Trivially buildable today** — node env, no DOM. This is the highest-value test and needs no scaffolding. |
| **A3** reduced-motion ⇒ no rAF scheduled | **Needs a repo-first**: jsdom-per-file env + an rAF spy + a `matchMedia` stub (none exist). Or assert the decision in the render-free core instead of the loop. |
| **A4** hidden ⇒ paused; unmount ⇒ cancelled + listeners removed | Same scaffolding gap as A3 (needs rAF/visibility stubs under jsdom). |
| **A5** tint from `readToken`, no `var(` reaches canvas | Buildable (pure/jsdom); mirrors `cssTokens.test.js`. |
| **A6** no new Firestore listeners/polls (import/callgraph guard) | Buildable as a source/import guard on the component + adapter (no `firebase/firestore` import). |
| **A7** founder feel gate | Manual, at flag-flip. |

---

## 5. STOPs — items requiring a founder ruling before Phase 1

### S1 — How does the starfield learn live-game state? **[the central decision]**
`DesktopBackground` is passed only `isDesktop`; the live set (`activeAgentBattles`) is an `App.jsx` poll gated to `screen==='dashboard'`. D7 forbids new listeners. **Recommendation:** thread the already-computed `activeAgentBattles` into the starfield as a **prop on the two dashboard mounts** (both are in scope at `App.jsx:8567/:8608`), map it in the Phase-2 adapter to `liveGames:[{endsAt: expiresAt, totalDuration: expiresAt−activatedAt}]`, and leave the 6 non-dashboard mounts at RESTING. This adds **zero** Firestore reads (satisfies D7/A6). Alternative (bigger): promote the poll to an app-wide hook so live state shows on every screen — decide only if that is wanted.

### S2 — Endgame ramp needs a local clock, not the poll
The 120 s poll supplies *which* games are live; the ENDGAME ramp must be a client-side ticker off the governing game's `expiresAt` (the `ManageStation.jsx:17-26` pattern), re-evaluated each frame. Confirm this split (poll = membership, local clock = ramp). No new read.

### S3 — Per-format endgame scope for v1
Endgame is buildable for `agentBattles` (casual, autopilot, tournament **per-day**). It is **not** buildable for the tournament **5-day** end (server-only → BATTLE LIVE per R-PREC/spec fallback), and **Snake Draft** endgame is buildable but its signal is a *different collection* not in `activeAgentBattles`. **Ruling needed:** does v1 (a) key only off `agentBattles` with fullday `expiresAt` (simplest, covers casual + autopilot + per-day tournament), deferring Snake Draft + the 5-day arc; or (b) also thread the `drafts` signal now? Recommend (a).

### S4 — D5 override: URL param, not localStorage
Zero localStorage feature-gating precedent; house pattern is `?param=1` via `isXxxOn()`. **Recommend** `?warpState=resting|live|endgame&warpClock=<seconds>` resolved through an SSR-safe `getWarpDevOverride()` co-located in `featureFlags.js`. Choose localStorage only if cross-reload persistence during a feel-tuning walk is a hard requirement — then model safe-degrade on `roundBoundaryAck.js:17` and unit-test with the `memStorage()` swap (`roundBoundaryAck.test.js`).

### S5 — Which surfaces show the field, and mobile?
`DesktopBackground` renders desktop-only and mounts on 8 sites incl. signed-out Home. **Ruling:** (a) does D4 transparentize only the two `CMD.bg` dashboard roots (recommend — scopes the visible change to the dashboard), or every screen's opaque root (tokens differ per surface)? (b) On the 6 non-dashboard screens the field would show RESTING — acceptable, or scope the starfield mount to the dashboard? (c) Mobile: the mobile dashboard mount is a no-op (`isDesktop` false); leave `CommandDashboard.jsx:231` untouched (starfield desktop-only per spec non-goals), or relax the gate? Recommend desktop-dashboard-only for v1.

### S6 — Flag-flip breaks `tokens.guard.test.js` (checklist item, not a Phase-0 blocker)
Removing the price-line SVGs (R-LINES) drops the 3 pinned R-H8 hexes (`#00d9ff`×2 `:98/:138`, `#8b5cf6`×1 `:146`). `tokens.guard.test.js:169` ("baseline not stale") **and** the hard-coded R-BL21 assertions (`:185-196`, expecting exactly those counts and 21 total exempt) then fail. The **flag-flip PR must** regenerate `tokenGuardBaseline.json` and update the R-BL21 count (21→18) in the same commit. Recording so the flip PR carries it.

### S7 — Reuse `BaggerBombBackground` scaffolding, or fresh component?
Its lifecycle (DPR cap, visibility pause, reduced-motion static frame, refs, cleanup) is exactly D6 and worth lifting **verbatim**. Its *engine* (particle network, edge-wrap, `Math.random()`) is not the spec's radial-projection field. **Recommend** a new `StarfieldBackground.jsx` (per D1) that lifts the proven lifecycle scaffolding and replaces the draw/seed with the radial projection + deterministic-or-seeded init. Founder/design confirm.

### S8 — Perf assurance + A3/A4 test scaffolding
There is no in-repo perf baseline (V9). **Recommend** the perf gate be Vercel-preview / Lighthouse observation (matches "Vercel preview is the smoke-test surface"), not a new marker. And A3/A4 (rAF scheduled/paused) need a jsdom-per-file env with rAF/`matchMedia`/`visibilitychange` stubs — a repo-first with no existing home. Ruling: accept that scaffolding in Phase 3, or assert the reduced-motion/visibility *decisions* in the render-free core (A2-style) and keep A3/A4 as smokes?

---

## 6. Recommended build shape (non-binding, for the founder's Phase-1 ruling)

- **Phase 1** — `src/components/StarfieldBackground.jsx` (canvas 2D, D1 engine), driven ONLY by the D5 URL-param override; `warpStateMachine.js` as a pure module (D2); `STARFIELD_BACKGROUND_ENABLED = false` + `isStarfieldOn()` in `featureFlags.js`; A1 inert test + A2 state-machine unit rows. Lifecycle lifted from `BaggerBombBackground`.
- **Phase 2** — adapter mapping the prop-threaded `activeAgentBattles` → `liveGames`; precedence/window/decay unit-tested; override still wins. No new Firestore import (A6).
- **Phase 3** — hygiene guards (A3/A4 per S8), tint test (A5), the D4 per-surface transparency behind the flag.
- **Flag-flip PR** (separate) — carries R-LINES removal **and** the S6 guard-baseline update **and** the A7 sign-off.

---

## 7. Pre-existing defects — filed for separate tasking, NOT fixed (§3)

1. `useAgentBattle.js:50` defaults `executionMode` to `'copilot'` though every doc is `'autopilot'` (copilot/manual retired) — a field-missing doc reads back as a deprecated mode. Cosmetic.
2. `App.jsx:3902` — the liveness poll sets `activeAgentBattles([])` on **any** fetch error, so a transient Firestore blip flips the dashboard (and any starfield keyed off it) to "no live battle" for up to 120 s. Touches the exact path the starfield consumes.
3. `battleTimer.js:13-19` ships `TEST_MODE=true` → `BATTLE_DURATION = 1` day, not the documented 5 (legacy PvP timer).
4. `DraftBattleScreenV2` has no live `onSnapshot` while showing the battle (`useDraft` subscription gated to lobby/room, `useDraft.js:60-62`) — end-time countdown works off the stored prop, but live score freshness on the battle screen is unverified.
5. `MechParticles.jsx` — no DPR cap (`:193`), no reduced-motion, no `visibilitychange`; the rAF free-runs while the tab is hidden (`:255,:286`). A real (minor) battery/CPU leak on ForgeScreen.
6. Curtain `ParticleCanvas` — no reduced-motion, no visibility handling (deprecated overlay).
7. `CeremonyTheater.jsx:94` — the climb-branch rAF reschedules unconditionally (bounded only by `scanCount` arrival), with no reduced-motion/visibility handling. Lives in the Dashboard tree; trivial single-number count-up, not a canvas.
8. `agentBattleService.js:32` — `CRYPTO_EXTENDED_CLOSE_HOUR = 20` appears unused (the 8pm value is derived from `getNextMarketClose`); and the 8pm extended close is suppressed on early-close days (`marketSchedule.js:270,285`). Neither affects the crux.
9. `.github/workflows/main.yml:13` — the header self-labels the file as `keep-warm.yml`; name/description disagree. Cosmetic.

---

## 8. Spec-anchor corrections carried (for the eventual spec V2 / Phase-1 kickoff)

| Spec / prior-audit anchor | Correct at HEAD `96abcb5d` |
|---|---|
| Component `src/components/Dashboard/DesktopBackground.jsx` (D1 implication) | `src/components/DesktopBackground.jsx` |
| Mobile early-return `:4` | `:11` |
| Container positioning `:49-56` | `:55-65` |
| Mount sites `App.jsx:8567/:8608` (2) | **8 sites across 7 files** (§2.1) |
| `CommandDashboard` root paint `:227` | `:231` |
| Reduced-motion block `index.css:568-578` | `index.css:550` |
| "canvas particle field … per the approved demos" (D1) — *the component being replaced* | the existing `DesktopBackground` is **SVG + CSS**, not canvas (the NEW starfield is canvas) |

---

*End of Phase 0 discovery. HARD STOP. No code written. Awaiting founder rulings on S1–S8 before Phase 1. A byte-identical copy of this report is written outside the repo tree and offered for download.*
