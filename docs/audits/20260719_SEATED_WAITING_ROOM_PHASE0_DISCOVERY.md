# Phase 0 Discovery — Seated Waiting Room ("While you wait")

**Date:** 2026-07-19 · **Repo:** `fashraf94/TradeSeven` · **Task branch:** `claude/seated-waiting-room-mloilc`
**Phase:** 0 — Re-ground (READ-ONLY). No writes to project state. **STOP** at end for founder review.

## Preamble (discovery protocol, BUILD_RULES §3)
- **`git fetch origin` recorded:** run as first step; `origin/main` = `7b28d15e0bd4db89cf5ff638a775315b3f0bcda9`.
- **Branch / HEAD / tree:** on `claude/seated-waiting-room-mloilc`, HEAD = `7b28d15e…` (identical to `origin/main`), **clean tree**. Cut fresh from current main — guard satisfied.
- **Read-only:** no project-state mutation. Anchors below are **VERIFIED** = personally read at that line this session (a parallel 5-thread discovery pass corroborated every one).
- **Fence status:** none of the 8 calibration-fence files (`api/agent/decide.js`, `api/_utils/agent*.js`, …) are touched, read-for-edit, or in this task's blast radius. The module is **client-only** (React), reuse-only. **No fence contact.**

---

## Executive verdict

| # | Phase-0 question | Verdict | Anchor |
|---|---|---|---|
| 1 | Desktop seated-center render site (`.ld-center`, `activeGroup`-true branch) | **FOUND** — 3-way ternary; seated arm = pending panel OR funnel | `LeagueLobbyDesktop.jsx:230-252` |
| 2 | Mobile seated-center render site (`BracketFunnelSection`) | **FOUND** — 2 mount sites (flag-off + flag-on) | `LeagueLobbyRedesign.jsx:176-200`, `:245`, `:494` |
| 3 | `activeGroup` in scope at both sites | **YES, no prop pass** | desktop `:135`; mobile via LeagueHome `:77` → passed `:245/:494` |
| 4 | `activeTrainingPod` in scope at both sites | **Desktop: YES** (local, `:124`). **Mobile: NEEDS a prop pass** into `BracketFunnelSection` | see §3 |
| 5 | Training-pod START action | **REUSABLE** — `quickPlayTraining()` (client) → server `quickPlay({isTraining:true})` | `tournamentLobbyActions.js:60` |
| 6 | Return-to-training-pod handler | **REUSABLE, already threaded** — `onOpenTrainingPod` | `App.jsx:2262` → `LeagueScreen:102/109` |
| 7 | Spectate open | **REUSABLE, already in scope** — `openSpectate` both viewports | desktop `:148`; mobile `LeagueHome.jsx:97` |
| 8 | BaggerBomb command-dashboard route | **EXISTS but NOT plumbed to League** — needs 1 new nav prop | route `App.jsx:11899` (`setScreen('baggerBombLobby')`); gap at `App.jsx:9683` |
| 9 | Mirror guard permits training on a held slot seat + P4b test | **CONFIRMED** | guard `tournamentLobbyService.js:303/390`; test `…test.js:496` |
| 10 | Tests pinning the seated funnel copy | **NONE** — all smokes render the no-game path only; replacement breaks zero assertions | see §7 |
| 11 | Shared token map / house CTA pattern | **FOUND** — `leagueTokens.js`; no shared Button (inline `all:unset`+tokens) | `leagueTokens.js:17-50` |
| 12 | Test baseline "49 files / 8 tests" | **It's the known FAILURE baseline**, not a passing count | `LAUNCH_READINESS_WATCH_LEDGER.md:194-200` |

**Bottom line:** the module is buildable from existing pieces on both viewports. Three items need a small **client-only prop plumb** (they are the only non-in-scope signals), and two copy/scope decisions need founder disambiguation (§9). No new game machinery, endpoints, subscriptions, or fence contact.

---

## 1. The seated-center render sites (both viewports)

### Desktop — `src/components/League/LeagueLobbyDesktop.jsx`
`.ld-center` column (CSS `:67`) is a single 3-way ternary at `:230-252`:
```
230  <div className="lg-scroll ld-center">
231    {!activeGroup ? (
232      <SlotCenter … />                      ← NO-GAME (do NOT touch)
233    ) : st.bracketPending ? (
234      <DeskBracketPending />                ← seated, pre-season (LIVE state today)
235    ) : (
236      <> … <DeskFunnel …/> … </>            ← seated, post-lock (funnel)
251    )}
252  </div>
```
- Seated (`activeGroup` truthy) arm = the two sub-panels at `:234` and `:236-250`. **This is the "bland dead space."**
- `DeskBracketPending` = `LeagueDeskParts.jsx:396`; `DeskFunnel` = `LeagueDeskParts.jsx:335`.
- One-line footnote candidates (VERIFIED): `:238` eyebrow `"The bracket · 16 → 8 → 4 → champion"`; `:248` `"Click any pod to open its live four-player standing"`; honest precedent `LeagueDeskParts.jsx:402` `"The bracket opens when the season locks"`.
- **Note:** the seated arm renders only when NOT on the Training tab (`onTraining` false, `:211`). The module lands on the Ranked-surface center.

### Mobile — `src/components/League/LeagueLobbyRedesign.jsx`
`BracketFunnelSection` defined `:176`; same branch shape:
```
177  if (!activeGroup) { return <SlotCenter … /> }     ← NO-GAME (do NOT touch)
184  if (st.bracketPending) return <BracketPendingSection />   ← seated, pre-season (LIVE today)
185  return ( … <Funnel …/> … )                        ← seated, post-lock (funnel)
```
- Rendered at **two** sites: flag-off `Lobby` (`:245`) and flag-on `LobbyTabbed` Ranked tab (`:494`). `BracketPendingSection` = `:156`.
- One-line footnote candidates (VERIFIED): `:196` `"Tap any pod to open its live four-player standing"`; `:188` eyebrow `"The bracket · 16 → 8 → 4 → 1"`.

### Which sub-panel is LIVE today
`bracketPending = !bracket` (`leagueAdapter.js:386`). Pre-season / base-layer-only (the founder's actual state) has **no bracket doc → `bracketPending` true**, so a seated user currently sees `DeskBracketPending`/`BracketPendingSection` (the "opens when the season locks" panel). The `DeskFunnel`/`Funnel` is the *post-lock* state. The spec's "old bracket-funnel panel" is the whole seated arm; the spec's own State-nuance ("show the module whenever `activeGroup` exists") ⇒ the module replaces the **entire seated arm** (both sub-states), keeping the `!activeGroup → SlotCenter` no-game branch intact.

---

## 2. Live path confirmation (feature flags, all VERIFIED in `config/featureFlags.js`)
- `LEAGUE_NEXT_ARC_ENABLED = true` (`:189`) ⇒ mobile live path is **`LobbyTabbed`** (tabs), not flag-off `Lobby`. `TABS_ENABLED` also gates the mobile `subscribeMyTrainingPod` (`LeagueHome.jsx:67-70`).
- `LEAGUE_TRAINING_POD_ENABLED = true` (`:591`) ⇒ desktop `TRAINING_ON` true; `subscribeMyTrainingPod` active (`LeagueLobbyDesktop.jsx:125-128`).
- `LEAGUE_REDESIGN_ENABLED = true` (`:166`) ⇒ `LeagueScreen` renders the redesigned lobby (desktop `LeagueLobbyDesktop`, mobile `LeagueHome`).

---

## 3. Signal availability & prop-pass matrix

| Signal | Desktop (`LeagueLobbyDesktop`) | Mobile live (`LobbyTabbed` → `BracketFunnelSection`) |
|---|---|---|
| `activeGroup` | **In scope** — local state `:135`, `subscribeMyGroup` `:138` | **In scope** — passed as prop `:494` (source `LeagueHome:77-81`) |
| `activeTrainingPod` | **In scope** — local state `:124` (currently only read by `DeskTrainingPanel`) | **NOT in scope inside `BracketFunnelSection`** — `LobbyTabbed` HAS it (`:482`) but does not forward it to `BracketFunnelSection`. **Needs a prop pass** (`LobbyTabbed:494` → `BracketFunnelSection`). |
| `onOpenTrainingPod` | **In scope** — prop (`:107`) | **In scope in `LobbyTabbed`** (`:482`); needs forwarding into `BracketFunnelSection` |
| `hasAgent` / `agentLoadout` | **In scope** — props (`:107`) | **In scope in `LobbyTabbed`** (`:482`); needs forwarding if the module owns the start form |
| `activeGroup.status` (for optional headline swap) | On the object, **not currently read** at the site | Same — carried on the prop, not read |
| Spectate open | **In scope** — `openSpectate` `:148` | **In scope** — `onSpectate` prop = `LeagueHome.openSpectate:97` (passed `:494`) |
| BaggerBomb nav | **NOT in scope** (see §5.4) | **NOT in scope** (see §5.4) |

**`activeGroup.status`** exists because `subscribeMyGroup` yields `{id, ...group}` and `selectMyGroup` (`leagueTournament.js:540`) only admits `status ∈ FORMING/DRAFTING/AWAITING_OPEN/BATTLE`; `GROUP_STATUS.BATTLE === 'battle'` (`leagueTournament.js:93`). A one-line "While you wait" vs "Between sessions"/"Open my game" headline swap is a **cheap read at the site** — no new prop/subscription — matching the spec's allowed one-line swap.

---

## 4. What must stay untouched (no-game path)
`SlotCenter` (`liveDraft/SlotCenter.jsx`) is the `!activeGroup` center for both viewports. Its footnote `:32` `"The monthly bracket opens when the season locks"` is the `opens when the season locks` string the honest-display smokes assert 6×. **The module lives only in the seated arm; SlotCenter and the Training tab are not modified.**

---

## 5. Actions to reuse (client-only)

**5.1 Training-pod START.** Client action `quickPlayTraining()` (`tournamentLobbyActions.js:60`, POSTs `lobby-quickplay-training`). Server chain: endpoint → `formTrainingDraft` (`trainingLifecycle.js:361`) → `quickPlay(db, {isTraining:true})`. Existing lobby CTA handlers wrapping it: mobile `TrainingShell.runTrainingForm` (`LeagueLobbyRedesign.jsx:366`, `start` `:401`, button `:435`) and desktop `DeskTrainingPanel.runTrainingForm` (`LeagueDeskParts.jsx:509`, `start` `:532`). *(The spec's `quickPlay({isTraining:true})` is the **server** signature `tournamentLobbyService.js:386`; the client `quickPlay()` at `tournamentLobbyActions.js:47` takes no `isTraining` — use `quickPlayTraining`.)*
> Reuse decision for the builder: either call `quickPlayTraining` + `onOpenTrainingPod` directly from the module (needs `hasAgent`/error handling), or lift the existing `runTrainingForm` into a shared hook. Both are client-only.

**5.2 Return-to-training-pod.** `onOpenTrainingPod` defined `App.jsx:2262` (DRAFTING → `trainingDraftRoom`, else → `trainingBattle`); passed `App.jsx:9684` → `LeagueScreen:102/109` → both lobbies. Re-entry call sites today: mobile `TrainingReentryBar.onResume` (`LeagueLobbyRedesign.jsx:413`), desktop `ActiveTrainingGameCard.onResume` (`LeagueDeskParts.jsx:545`). **Already threaded** — the module fires `onOpenTrainingPod(activeTrainingPod)`. (R1: exactly one of {start, return} — gate on `activeTrainingPod`.)

**5.3 Spectate open ("Watch a live game").** `openSpectate(pod, focusId)` — desktop `LeagueLobbyDesktop.jsx:148` (renders `<Spectate>` overlay `:269`), mobile `LeagueHome.jsx:97` (renders `<Spectate>` `:114`, passed to lobbies as `onSpectate`). **Already in scope.** A generic "Watch a live game" needs a live-pod target (mobile already computes `aLivePod` `LeagueHome.jsx:48-51`; desktop can pick the first live pod from `st.rounds`) — client-only, reuses the existing overlay.

**5.4 BaggerBomb round.** Existing route target = `setScreen('baggerBombLobby')` (`App.jsx:11899`; screen at `App.jsx:8699` → `<BaggerBombLobby>`; dashboard reaches it via `setShowBaggerBombModal(true)`, `App.jsx:3400/8548`). **GAP:** `LeagueScreen` is rendered with only `onOpenTrainingPod/hasAgent/agentLoadout/isDesktop` (`App.jsx:9683-9688`) — **no `setScreen`, no bagger nav prop.** Reusing this route requires **one new nav prop** threaded `App → LeagueScreen → LeagueHome/LeagueLobbyDesktop → module` (mirroring the `onOpenTrainingPod` precedent exactly). Client-only navigation — not "game machinery," but it is the single signal not already at the render site. **Founder choice needed:** wire to the confirm modal (`setShowBaggerBombModal(true)`) or straight to `setScreen('baggerBombLobby')`.

---

## 6. Mirror guard + P4b (training permitted on a held slot seat) — CONFIRMED
- Guard `assertNoCompetitiveConflict` (`tournamentLobbyService.js:282`), invoked only under `if (!isTraining)` in `formGroupFromLobby` (`:303`) and `quickPlay` (`:390`). Doc `:279-280`: *"Callers gate on !isTraining (P4b: practice is never guarded — training neither blocks nor is blocked)."*
- P4b test `tournamentLobbyService.test.js:496` — "a slot seat never blocks starting a training pod": `quickPlay(db,{odUserId:'u1', now:NOW, isTraining:true})` (`:501`) forms `isTraining===true` (`:504`) even with a same-battle-week slot seat.
- **Implication:** the hero "Sharpen up in a Training Pod" while holding a slot seat is server-permitted; **no client guard change** is needed.

---

## 7. Test surface — what pins the funnel copy
All League lobby smokes use `renderToString` (SSR) → **effects never run → `activeGroup` stays null** (it is set only inside a `useEffect`→`subscribeMyGroup`). Therefore **every existing smoke renders the no-game (`!activeGroup`) branch; the seated arm is never rendered by any test.**
- `LeagueLobbyHonest.smoke.test.jsx` — 4 tests (desktop+mobile, base-layer-only + cold-start). All assert the no-game path: `"opens when the season locks"`, `"Pick a draft slot"`, real names, no fixture names. The only seated-copy references are **negative** and remain satisfied: `not.toContain('YOUR PATH TO THE TROPHY')` (`:71`), `not.toContain('16 → 8 → 4')` (`:92`).
- `LeagueLobbyDesktop.smoke.test.jsx` — no-game center (`:38-49`) + `DeskTrainingPanel`/`ActiveTrainingGameCard` rendered directly (`:57-79`). None assert the seated arm.
- `liveDraft.smoke.test.jsx` — SlotCenter/liveDraft only.

**Conclusion:** replacing the seated arm breaks **zero** existing assertions, provided (a) the no-game SlotCenter path is untouched and (b) the module does not emit the literal strings `"YOUR PATH TO THE TROPHY"` / `"16 → 8 → 4"` (it renders only for `activeGroup`, so even that is belt-and-suspenders). **New coverage for the seated module cannot go through the existing SSR lobby smokes** — it must render the seated component directly with an injected `activeGroup` (the way `liveDraft.smoke` renders center pieces by props).

### Test baseline ("49 files / 8 tests")
This is the **known pre-existing FAILURE baseline on clean main**, NOT a passing count (`LAUNCH_READINESS_WATCH_LEDGER.md:194-200`, item **E4**): `47 files/6 tests → 49/8` after `LEAGUE_CANONICAL_OPEN_CAPTURE` flipped true without updating two stale-flag files (`liveDraftFormation.test.js` + the `liveDraftLifecycle.e2e` capstone). "Suite green vs baseline" ⇒ **match 49/8, do not chase zero**. Canonical command: `npm run test:run` (vitest run); `vite.config.js` has no vitest block, so it globs all `*.test.{js,jsx}`. Precise current tally should be captured by an actual `test:run` at implementation start (stash-compare), not asserted from the ledger.

---

## 8. Tokens & house patterns (styling; no new inline palette)
`src/components/League/leagueTokens.js` exports exactly: `LTOKENS` (=== `CMD` obsidian palette, `:22`), `LX` (semantic roles — `energy`=teal accent, `neg`=`#F2766B`, `human`/`cpu`, `:26`), `PICKER_TOKENS` (`:43`), `MONO` + `alpha` (`:17`). Dark-only surface — **no `useTheme()`, no new palette.**
- **No shared Button/CTA component exists** (repo-wide grep negative). House CTA = native `<button style={{ all:'unset', … }} className="lg-tap">` styled from tokens: **filled** = `accent` bg + `LTOKENS.bg` text + `borderRadius 13` + `boxShadow 0 8px 24px alpha(accent,.32)`; **ghost/text** = transparent + 1px token border. Formalized as `primaryBtn()`/`ghostBtn()` in `LiveDraftPicker.jsx`.
- **Layouts to mirror:** `SlotCenter` shell (column flex, gap 14, maxWidth 560, centered); `DeskTrainingPanel`/`TrainingShell` cold-start hero (gradient card + filled CTA + secondary text button); `DeskBracketPending` (`LeagueDeskParts.jsx:396`) / `BracketPendingSection` (`LeagueLobbyRedesign.jsx:156`) centered-hero template; `MyGameBar` routable-bar for secondary rows.
- **Atoms to reuse:** `Eyebrow`, `Mono`, `Tag`, `Icon`, `LIcon` (via `LeagueParts`); prefer `ErrorBanner`/`LX.neg` over hardcoded hexes.
- **Quiet line under the hero (spec copy):** `"Practice runs never touch the leaderboard."` — a `Mono`/token footnote, consistent with the existing `TrainingCpuNote` ("practice runs don't feed the leaderboard or the bracket", `LeagueLobbyRedesign.jsx:313`).

---

## 9. Open questions for founder disambiguation (before writing copy)
1. **The one-line bracket footnote that must survive** — which exact copy? Candidates: (a) `"The bracket · 16 → 8 → 4 → champion"` (desktop `:238`) / `"…→ 1"` (mobile `:188`) — honest structural one-liner (recommended); (b) `"…opens its live four-player standing"` (desktop `:248`/mobile `:196`) — a functional caption, less apt once the funnel is gone; (c) the honest-precedent `"The bracket opens when the season locks"` (`DeskBracketPending`). **Recommendation:** keep the essence of (c)/(a) — a single honest line naming the forthcoming bracket — since today's live seated state IS the pending panel.
2. **Scope of replacement** — confirm the module supersedes **both** seated sub-states (`bracketPending` pending panel AND the post-lock funnel), per the spec's "show whenever `activeGroup` exists." (Recommended reading; the funnel is unreachable in production today anyway since `bracketPending` is true.)
3. **BaggerBomb entry** — confirm the new nav prop targets the confirm modal (`setShowBaggerBombModal(true)`) vs. a direct `setScreen('baggerBombLobby')` (§5.4).
4. **Optional headline swap** — is the one-line "While you wait" vs "Between sessions" (BATTLE) swap desired? It is a cheap in-scope `activeGroup.status` read; anything beyond one line is out of scope per the spec.

---

## 10. Reuse-only / fence / size confirmations
- **Reuse-only:** all actions above are existing (`quickPlayTraining`, `onOpenTrainingPod`, `openSpectate`, the BaggerBomb route). No new endpoint/subscription/game machinery. The only additions are a **client prop plumb** for `activeTrainingPod` (mobile) and a BaggerBomb nav prop (both viewports).
- **Fence:** untouched — no read-for-edit or behavioral contact with any calibration-fence file.
- **Size:** expected footprint is a new shared module component + edits to `LeagueLobbyDesktop.jsx`, `LeagueLobbyRedesign.jsx`, and a 3-hop nav prop (`App.jsx`, `LeagueScreen.jsx`) — well under the `/code-review` threshold (≥10 files OR ≥1500 lines). Re-confirm at build end.

**STOP — awaiting founder review before any writes.**

---

## 11. Founder disposition (approved 2026-07-19)
Recorded so this file is a self-contained record of the phase and its resolutions.

1. **Replace the whole seated arm, both sub-states.** ✅ The module supersedes both `bracketPending` (pending panel) and the post-lock funnel; the `!activeGroup → SlotCenter` no-game branch is untouched.
2. **Footnote copy:** "The monthly bracket opens when the season locks" — the SlotCenter precedent string (uppercase Mono footnote; §9 Q1 resolved to candidate (c)).
3. **Headline swap (added by founder):** use `activeGroup.status` — "While you wait" for FORMING/DRAFTING/AWAITING_OPEN, "Between sessions" for BATTLE (a live-battle player isn't waiting). One ternary, no new plumbing.
4. **BaggerBomb:** mirror the dashboard's own primary entry (`GameModeCarousels.jsx:107` → the BaggerBomb game route), don't invent a second path.
   - **Build-time constraint (found during implementation):** the dashboard's `setShowBaggerBombModal(true)` shows a `ConfirmationPopup` rendered ONLY inside the home/dashboard terminal return (`App.jsx:9756+`, popup at `:11893`). The League tab is an **early-return screen** (`App.jsx:9676-9692`), so that popup cannot render over it without lifting it to a global modal layer (App-structure surgery — out of the reuse-only, client-only scope). **Resolution:** the CTA is wired to `setScreen('baggerBombLobby')` — the exact screen the dashboard's own Confirm lands on (`App.jsx:11899`), reusing the dashboard's destination + machinery, skipping only the dashboard-local info interstitial. Revisit if the info popup is wanted over the League tab.
5. **Both plumbing items approved:** `activeTrainingPod` threaded into `BracketFunnelSection` (mobile); a new `onOpenBaggerBomb` nav prop threaded `App → LeagueScreen → LeagueHome/LeagueLobbyDesktop → WhileYouWait`.

Implementation landed in the follow-on commit (`WhileYouWait.jsx` + the five plumbing edits + `WhileYouWait.smoke.test.jsx`). Suite matches the known 49-files/8-tests baseline (stash-compared), plus one new passing test file.

---

## 12. Follow-up — the BaggerBomb secondary and the agent-deploy conflict (2026-07-19, post-implementation)

The seated module first shipped a "Play a BaggerBomb round" secondary. Its first wiring pointed at `setScreen('baggerBombLobby')` — the **PVP** lobby, a dead end with no users. The corrective pass re-pointed it at the **agent-vs-CPU deploy** (the "shadow is trading · vs CPU" flow): the shared sequence `deployAgent(agentId, handleCreateAgentTrainingBattle)` (`src/services/agentDeploy.js:14` → POST `/api/agent/decide` → the Battle View), gated on the agent's single battle-lock (`agent.activeBattleId`) so the CTA hid when the agent was busy.

Founder review then asked whether that deploy conflicts with the League pod's own Monday agent deploy. **Discovery says yes — the conflict is real:**
- Competitive slot pods deploy the **real** agent (seats keyed by `odUserId`, no clone — `api/_utils/liveDraftFormation.js:459,488`) and pass through **AWAITING_OPEN** post-draft until the Monday anchor (`api/_utils/liveDraftLifecycle.test.js:191,198,253,302`).
- The vs-CPU battle defaults to **1 day** (`api/agent/decide.js:691`, `api/_utils/agentBattleService.js:272`).
- The tournament deploy (`runPrescribedTournamentDeploy`, `api/agent/decide.js:1029`) queries for **any** active `agentBattle` (`:1091-1095`) and **early-returns `battleCreated:false`** if one exists (`:1103-1113`) — so a vs-CPU battle still active on Monday **blocks the pod's own agent deploy**. The agent is absent from its League pod (severity — Day-1 gap vs whole-week — is an open question, since the Tue–Fri redeploy targets *incumbents*: `tournamentOrchestrator.js:687`).

**Resolution (founder decision, 2026-07-19):** the BaggerBomb secondary was **removed** from the module — the training-pod hero and the Spectate secondary remain. The underlying deploy conflict is **ledgered as a pre-launch must-fix** (`docs/LAUNCH_READINESS_WATCH_LEDGER.md` **G2**, incl. the incumbent/whole-week severity question and the two fence-aware fix options) rather than papered over with a status gate on one surface. Anchors in this section verified at HEAD `79bdae5a`.
