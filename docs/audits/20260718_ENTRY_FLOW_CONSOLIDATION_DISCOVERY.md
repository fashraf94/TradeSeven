# Discovery — Entry-Flow Consolidation (READ-ONLY)

**Task date:** July 18, 2026 · **Repo:** `fashraf94/TradeSeven`
**Branch:** `claude/entry-flow-consolidation-br3grb` · **Status:** READ-ONLY — no project state changed.

---

## 0. Preamble — guards, method, provenance

- **`git fetch origin` ran FIRST** (BUILD_RULES §3). Post-fetch **`HEAD == origin/main == 51bc50ad971f87d5393a3dcbd4cc572765ca2b21`**; working tree clean (`git status --porcelain` empty). On the designated branch, byte-identical to `origin/main` (0 ahead / 0 behind). Guard satisfied.
- **Citations** carry `path:line` + **VERIFIED** (read this session) / **ASSUMED**. Inherited anchors were re-verified — the whole slot build merged since the last discovery, so several drifted (see §7). Every load-bearing claim below is VERIFIED.
- **Method:** the primary anchors were read directly this session, then corroborated by an 8-finder + 4-adversarial-verifier workflow (12 agents, 0 errors). **All four load-bearing claims returned CONFIRMED under independent adversarial re-derivation.** Donor branch inspected read-only via `git show`/`git diff`/`git log` (permitted; no checkout, no writes).
- **Judged by code, not flag value** (task rule). For context only: deployed config has `LEAGUE_REDESIGN_ENABLED=true` (`featureFlags.js:166`), `LEAGUE_NEXT_ARC_ENABLED=true` (`:189`), `LEAGUE_LIVE_DRAFT=true` (`:286`), `LEAGUE_LOBBY_ENABLED=true` (`:147`) — so the redesigned lobby **is** today's live landing and the founder's four complaints describe the live experience.
- **No out-of-task bugs fixed.** Two design-integrity observations noted for separate tasking in §7.

---

## 1. Executive verdict (founder summary)

| Question | Verdict |
|---|---|
| **Is this a big net-new build, or mostly re-mounting + relabeling?** | **Mostly re-mounting + relabeling + two small plumbs.** Every seated-user status surface is already built; the slot picker is built; the live Quick Play is built. The only genuinely new code is one client-side signal plumb (MyGameBar) and one small server guard (the mirror). No net-new *screens*. |
| **The biggest unknown — can MyGameBar be made conditional?** | **Yes. The signal EXISTS but NEEDS a small plumb.** `subscribeMyGroup` already returns the user's active game *including a claimed slot seat* (the selector was widened by the slot build). But that signal never reaches the lobby where the bar renders — the bar is gated only on a prop that is always present. Plumb has an exact precedent (the training-pod subscription already in the same files). |
| **The status surface — is a new page needed?** | **No.** Every state (claimed → FORMING → DRAFTING → AWAITING_OPEN → BATTLE) already renders inside `LeagueParticipantView`. The remaining work is *routing into it*, not building it. |
| **The donor branch (`league-pages-design-vl8fug`)?** | **Fully superseded — DELETE.** All three derivations + the standalone screen were re-implemented (and improved) by the slot build. One derivation (`deriveSeed`, a humans-only "N of M") has no equivalent on main but is orphaned — a weak salvage note, not a reason to keep the branch. |
| **The mirror guard (finding #3's reciprocal)?** | **Confirmed missing; the code already flags the fix.** The regular-entry write path is unguarded; the slot-side comment literally says *"mirror this guard on the regular-entry write site in the Entry-Flow Consolidation."* Home = `formGroupFromLobby`. The predicate is reusable but must be **exported** and given a **battle-week-normalized** week key (a naive reuse silently misses Wed/Sat/Sun slot seats). |
| **Is the "Pick your mode" modal safe to retire?** | **Yes — it's a fixtures stub.** Its Quick Play / Ranked Play branches call **no server endpoint** — they only show a "Seat reserved" confirmation and offer to spectate. Retiring it breaks no live entry. |
| **Is relabeling Quick Play a behavior change?** | **No — pure naming fix.** Quick Play forms an `isTraining:false` (omitted) base-layer group by construction; the "TRAINING" wording is copy on the stub modal, not on the wired path. |

**One-line headline:** *The consolidation is a re-mount-and-relabel job over already-built parts — the slot picker, the whole seated-user journey, and the live Quick Play all exist; the only new code is a small MyGameBar signal plumb and a small reciprocal server guard the codebase already left a note to add.*

---

## 2. Track A — the five entry surfaces (map)

### Surface 1 — The League center empty-state ("The bracket opens when the season locks")

Two viewport-specific components, **selected in `LeagueScreen.jsx`, not `LeagueHome.jsx`** (task framing was slightly off — `LeagueHome` is only the mobile wrapper).

- **Desktop:** `DeskBracketPending` — defined `src/components/League/LeagueDeskParts.jsx:420-432` (copy at **`:426`**). Rendered as the **center column** of the 3-col grid via the ternary `{st.bracketPending ? <DeskBracketPending/> : <…funnel…>}` at `LeagueLobbyDesktop.jsx:232-250` (center container `:231`). VERIFIED.
- **Mobile:** `BracketPendingSection` — defined `src/components/League/LeagueLobbyRedesign.jsx:177-190` (copy at **`:184`**). Rendered via `BracketFunnelSection`'s gate `if (st.bracketPending) return <BracketPendingSection/>` at `:193-194`; sits in the scroll column at call sites `:257` (`Lobby`) and `:508` (`LobbyTabbed`). VERIFIED.
- **What drives it:** the single boolean **`st.bracketPending`** = `!bracket` in the adapter (`leagueAdapter.js:386`, returned `:432`). It is a **global season-state** signal (no bracket doc), **not** a per-user "no game" signal — a distinction the consolidation must bridge (see §5, shape note). VERIFIED.
- **Slot-able?** The panels themselves are **fixed hardcoded blocks** (no `children` prop). But both **host containers already have a clean conditional seam** — the same `bracketPending ?` ternary — so swapping the slot picker into the center and demoting the bracket line to a footnote is a branch swap, not a rebuild. VERIFIED.
- **What a change touches:** `LeagueLobbyDesktop.jsx:232-250` (swap branch, import `LiveDraftPicker`, thread `uid`+tokens); `LeagueLobbyRedesign.jsx:193-210 / :257 / :508`; demote copy in `LeagueDeskParts.jsx:420-432` + `LeagueLobbyRedesign.jsx:177-190`. **Real gotcha:** `LiveDraftPicker` consumes live-app `useTheme()` tokens (`t.teal`, `t.bgCard`, …) but the redesign lobby uses `LTOKENS`/`LX`; neither lobby imports `useTheme`. So either thread `useTheme` tokens down (available at `LeagueScreen.jsx:58`) or restyle the picker to `LTOKENS`. VERIFIED.

### Surface 2 — `MyGameBar` ("Open my game") — *the biggest unknown; full detail in §3*

- **Defined twice** (different prop names): mobile `LeagueLobbyRedesign.jsx:152` `MyGameBar({ onOpenMyGame })` (label `:163`); desktop `LeagueLobbyDesktop.jsx:95` `MyGameBar({ onOpen })` (label `:99`). VERIFIED.
- **Four render sites, every one gated ONLY on `onOpenMyGame &&` (prop presence), never on game state:** `LeagueLobbyRedesign.jsx:252` (`Lobby`), `:497` (`LobbyTabbed`, above the tab bar → both tabs); `LeagueLobbyDesktop.jsx:197` (Training grid), `:220` (Ranked left rail). VERIFIED.
- **Why it always shows:** `LeagueScreen` passes `onOpenMyGame={() => setView('mygame')}` — a static, always-truthy arrow — on both the desktop (`LeagueScreen.jsx:101`) and mobile (`:109`) branches. So the guard is always satisfied. This is exactly the founder's "shows even with no game." VERIFIED.

### Surface 3 — The "Enter tournament" → "Pick your mode" modal

- **Identity correction:** this is **NOT** `Dashboard/QuickPlayModal.jsx` (a different, unrelated Dashboard modal). It is a League-redesign surface with two viewport variants sharing `ActionOption`:
  - **Mobile:** `ActionLayer` — `src/components/League/LeagueAction.jsx:43` (eyebrow "Enter tournament" `:58`, heading "Pick your mode" `:63`).
  - **Desktop:** `LDActionModal` — `src/components/League/LeagueDeskParts.jsx:447` (heading "Pick your mode" `:457`), reuses `ActionOption` from `LeagueAction.jsx` (`:28`). VERIFIED.
- **Triggers ("Enter tournament"):** mobile `EnterButton` (`LeagueLobbyRedesign.jsx:24`, rendered `:253` and Ranked-tab `:505`); desktop `DeskEnter` (`LeagueDeskParts.jsx:55`, rendered `LeagueLobbyDesktop.jsx:188`); plus a third: `LeagueSpectate.jsx:237-238`'s "Enter tournament" CTA routes to the same `onEnter`. VERIFIED.
- **What each branch does today — NOTHING functional.** Mobile: `onPick('quick'|'ranked')` (`LeagueAction.jsx:70,76`) → `pickMode` (`LeagueHome.jsx:92`) → `setJoined` → `JoinConfirm` (a "Seat reserved" screen, `LeagueAction.jsx:93`) → `onWatch` → `watchWhileWaiting` (opens Spectate, `LeagueHome.jsx:97`). Desktop is identical via `LDJoinModal`. **Neither branch ever calls `quickPlay()` or any formation endpoint.** VERIFIED.
- **What retiring it breaks:** nothing live — it is a fixtures-first design stub. Its only "dependents" are the three `enter`/`onEnter` triggers above and the `JoinConfirm`/`LDJoinModal` confirmations. The **"Quick Play → Solo · Training" mislabel lives here** (`LeagueAction.jsx:67`, `LeagueDeskParts.jsx:459`) plus `JoinConfirm`'s "Your training group is ready" (`LeagueAction.jsx:109`). VERIFIED.

### Surface 4 — Quick Play (end-to-end + labels)

- **The only end-to-end-wired ranked Quick Play caller** is the **functional P10b lobby**, not the redesign: `src/components/Tournament/LeagueLobby.jsx:159` `onClick={() => run(() => quickPlay({ displayName: dn }))}`. Its on-screen labels are **"Quick Play"** (heading `:157`) / **"Play now"** (button `:160`) — *not* "TRAINING". VERIFIED.
- **Full path:** button `LeagueLobby.jsx:159` → client `tournamentLobbyActions.js:47` `quickPlay()` → `POST /api/tournament/lobby-quickplay` (`lobby-quickplay.js:16`) → server `tournamentLobbyService.js:348` `quickPlay()` → `formGroupFromLobby` (`:270`) → `createTournamentGroupDoc` (`:307-319`). VERIFIED.
- **Behavior — non-training, by construction:** server `quickPlay` defaults `isTraining=false` (`:348`), threaded into `formGroupFromLobby` (`:350`, default false `:270`) → `createTournamentGroupDoc({ isTraining, baseLayerWeek: isoWeekString(now), … })` (`:311-312`). The omission idiom `...(isTraining === true ? { isTraining: true } : {})` (`leagueTournament.js:1264`) means a `false` value writes **no `isTraining` field at all** → non-training base-layer group. The only `isTraining:true` path is the *training* sibling `lobby-quickplay-training.js:92` → `formTrainingDraft` → `trainingLifecycle.js:361`. **⇒ Relabeling Quick Play is a PURE NAMING FIX (verified CONFIRMED).** VERIFIED.
- **Label sites that say "SOLO · TRAINING":** all on the **stub modal**, not the wired path — `LeagueAction.jsx:67` + `LeagueDeskParts.jsx:459` (kicker "Solo · Training", title "Quick Play"). **Do not sweep** the genuinely-training strings (`LeagueLobbyRedesign.jsx:439`, `LeagueDeskParts.jsx:641`) — those label the real Training tab (`quickPlayTraining`, `isTraining:true`) and are correctly "training." VERIFIED.
- **Where Quick Play sits today:** in `LeagueParticipantView`'s no-group state, the functional `LeagueLobby` (with the real Quick Play button) renders **below** the slot picker already (`LeagueParticipantView.jsx:158-161`) — so "demote below the slots" is already the order in that host; the consolidation must reproduce that ordering wherever the picker moves. VERIFIED.

### Surface 5 — The slot picker's current mount

- **Exactly one mount:** `LiveDraftPicker` imported `LeagueParticipantView.jsx:25`, rendered once at **`:159`** inside the no-group branch, gated `uid && loaded && !group && (LEAGUE_LOBBY_ENABLED || LEAGUE_LIVE_DRAFT)` (`:152`) with the picker itself wrapped in `{LEAGUE_LIVE_DRAFT && …}` (`:158`). **Not mounted anywhere in the redesigned lobby.** VERIFIED.
- **Maps the founder's complaint literally:** because `LEAGUE_REDESIGN_ENABLED=true`, the participant view is never the landing — it's reached only by tapping "Open my game" (`LeagueScreen.jsx:76-94`). So "the slot picker is reachable only via Open my game" is exactly the code. Viewport-agnostic (one mount, no desktop/mobile branch). VERIFIED.
- **Prop/data surface (self-contained):** `LiveDraftPicker({ tokens, currentUserId, displayName, onEntered })` (`LiveDraftPicker.jsx:21`); it fetches its own slots via `fetchSlotSchedule` and mutates via `claimSlot`/`releaseSlot` (`liveDraftActions.js:28,33,40`). **No external slot-state subscription** — it moves at near-zero cost. VERIFIED.
- **What moving it to the center requires:** a mount in the lobby center (Surface 1 seam) with `currentUserId`(=`uid`, already in scope) + `displayName` + a token source (the `useTheme` mismatch from Surface 1). No adapter/hook changes. VERIFIED.

---

## 3. The conditional-`MyGameBar` verdict (the biggest single unknown)

**Verdict: the signal EXISTS and is COMPLETE, but NEEDS a small plumb — it does not currently reach the bar. (Adversarially CONFIRMED.)**

Two independently-verified halves:

**(a) The source signal is complete — including claimed slot seats.** The slot build widened the selector: `selectMyGroup` (`leagueTournament.js:540-548`) now admits `isTraining !== true && (FORMING | DRAFTING | AWAITING_OPEN | BATTLE)` — the docstring (`:519-534`) says DRAFTING/AWAITING_OPEN "were added for the Competitive Live Draft (slot lobbies)… the ranked client must observe them." A claimed slot pod (`buildInitialSlotGroupDoc`, `liveDraftFormation.js:289-309`) is written `status: FORMING`, `groupMembers:[uid]`, **no `isTraining` field** → passes the filter at every in-flight stage. So `subscribeMyGroup(uid)` returns a **non-null group for a slot seat** at claim, draft, awaiting, and battle. This corrects the prior-discovery anchor ("FORMING|BATTLE only"). VERIFIED.

**(b) That signal never reaches the render site.** The redesign lobby uses `useLeagueState` → `buildLeagueState`, whose returned `state` object is exactly `{ …honestHero, field, rounds, path, yourGroup, baseGames, followLive, bracketPending }` (`leagueAdapter.js:423-433`) — **no `myGroup` / `myGame` / `hasActiveGroup` field** (every key enumerated). `myGroup` *is* passed into the adapter (`useRealLeagueState.js:127-128`) but is used only for bracket seat scores; the only group-ish field, `yourGroup` (`:393`), is a bracket-funnel node id, null for a base-layer/slot-only player. So the bar has no game-state handle. VERIFIED.

**The plumb (exact, and precedented):**
1. Surface a boolean from `myGroup` at the render context — cleanest is a **dedicated `subscribeMyGroup(uid, setActiveGroup)` in the lobby**, mirroring the **existing** `subscribeMyTrainingPod(uid, setActiveTrainingPod)` already in the very same files (`LeagueLobbyDesktop.jsx:127`, `LeagueHome.jsx:72`). Alternatively, add `myGame: myGroup ? {id,status} : null` to `buildLeagueState`'s return (`leagueAdapter.js:423-433`) and thread it through `useLeagueState`.
2. Gate all four sites: `{onOpenMyGame && activeGroup && <MyGameBar/>}` at `LeagueLobbyRedesign.jsx:252,497` and `LeagueLobbyDesktop.jsx:197,220`.
3. **Same signal drives Surface 1**: show `LiveDraftPicker` in the center when `!activeGroup`, else the bracket/glimpse — one plumb serves both the bar and the center.
4. **Fixtures decision:** under fixtures (`useLeagueState.js:46-48`) there is no `myGroup`; decide whether the bar is simply hidden in demo mode (fine) or a fixture is synthesized.

> **The unknown resolves favorably:** this is *not* a data-availability gap. The data is already flowing to the client via `subscribeMyGroup`; only the last-mile wiring to the lobby is missing, and the wiring pattern already exists next door for training pods.

---

## 4. Track B — the status surface: built vs. needed

**Every seated-user state already renders inside `LeagueParticipantView` (single self-routing host on `group.status` + `group.isLiveDraft`, subscription at `:73-79`):**

| State | Surface | Where | VERIFIED |
|---|---|---|---|
| claimed (pre-snapshot) | `LiveDraftPicker` (own seat + Leave) | `LeagueParticipantView.jsx:159` | ✓ |
| FORMING (awaiting fire) | `LiveDraftGlimpse` (seats + countdown to `scheduledDraftAt` + leave) | `:235`; component `LiveDraftGlimpse.jsx` (own `useCountdown` `:12-25`) | ✓ |
| DRAFTING (live room) | `DraftBoardRoom mode="competitive"` | `:224` | ✓ |
| AWAITING_OPEN (holding) | `LiveDraftAwaiting` (anchor day + picks) | `:249`; component `LiveDraftAwaiting.jsx` (own anchor fmt `:12-17`) | ✓ |
| BATTLE / COMPLETE | Battle View V2 arena (`:199-213`) → else Flat6/claims/feed (`:255-291`) | `:199`, `:273-289` | ✓ |

**The gap is ROUTING, not a page.** A distinct status page is **not** needed. The seated user simply needs to be *reached* inside `LeagueParticipantView`, which then self-routes. Today that reach is the "Open my game" full-screen push (`LeagueScreen.jsx:76-94`); the consolidation makes that push conditional on the real game signal (§3) and gives it a clear entry from the lobby. VERIFIED.

**Donor branch `origin/claude/league-pages-design-vl8fug` (@ `4e2c4fca`) — FULLY SUPERSEDED → DELETE. (Adversarially CONFIRMED.)**
- Inventory: 2 merge-dark commits, 17 files (+1665/−2) — a standalone `MyTournamentScreen` + `src/components/Tournament/myTournament/` (page machine + panels) + 3 pure derivations, gated by a net-new `MY_TOURNAMENT_ENABLED` flag. **Every symbol has zero references on main** (grep clean) — the whole surface is orphaned.
- `draftLockTime` → **superseded.** Its premise "no stored draftLockAt exists" is now false: main persists `scheduledDraftAt` + `battleStartWeek{mondayEtDate,anchorEtDate,anchorIso}` via `buildInitialSlotGroupDoc` (`liveDraftFormation.js:297`), derived DST/holiday-safe by `deriveBattleStartWeek` (`:191`); countdown rendering is done by `LiveDraftGlimpse.useCountdown` and `PodCountdownHero`. Donor version is a cosmetic client-guess (`DRAFT_LOCK_UTC_HOUR=13`, DST punted) — strictly worse.
- `myTournamentModel` (`deriveMyTournamentState`/`rankInPod`/`seatPips`) → **superseded** by `LeagueParticipantView` status routing over the richer `GROUP_STATUS`, the persisted `subscribeRank(rankDocId(uid))`, and `leagueAdapter.groupToPod`/`buildSeat` + `LiveDraftGlimpse` seat accounting.
- `myTournamentSeed` (`deriveSeed`, humans-only "N of M") → **no main equivalent, but orphaned** (only consumer is the retired `MyTournamentScreen.jsx:192`, which itself imports `LeagueParticipantView` — a pre-slot iteration). **Salvage-only**, not a cherry-pick blocker.
- **Call: delete the branch.** If a humans-only "N of M · field seed" is ever wanted as a lobby ornament, lift `deriveSeed` (+ its 48-line test) at that time — nothing else.

---

## 5. Track C — the mirror guard (finding #3's reciprocal)

**Confirmed missing; the code already left the fix note. (Adversarially CONFIRMED.)**

- **Slot-side guard (exists):** `claimSlotSeat` computes `battleWeek = deriveBaseLayerWeek(battleStartWeek)` (`liveDraftFormation.js:343`) and calls `findActiveGroupInBattleWeek(db, uid, battleWeek, groupId)` (`:344`), throwing `already_in_competitive` on any hit (`:345`). The predicate (`:272-281`) is a member-scoped `array-contains` filtered by `isTraining !== true && ACTIVE_GROUP_STATUSES.has(status) && baseLayerWeek === key` (`ACTIVE = {FORMING,DRAFTING,AWAITING_OPEN,BATTLE}` `:257-259`). The in-code ledger note at **`:341-342`**: *"mirror this guard on the regular-entry write site in the Entry-Flow Consolidation."*
- **Reverse door is UNGUARDED:** the regular write site is **`formGroupFromLobby`** (`tournamentLobbyService.js:270-336`, group written `:319`). It runs no cross-group query, no slot-seat check — grep for `already_in_competitive|findActiveGroup|array-contains` in the lobby service returns zero. All four regular-entry endpoints funnel through it: `quickPlay` (`:350`), `lobby-form.js:38`, `lobby-matchmake.js:24`, `lobby-join.js:49`. **⇒ A user holding a slot seat can freely form a second competitive group for the same battle week.** VERIFIED.
- **Where the mirror guard lives:** in **`formGroupFromLobby`**, after `claimLobbyForFormation` and before `groupRef.set` (`:319`) — the single chokepoint covering all four endpoints. Loop over `humanIds` (`:280`), pass `exceptGroupId = groupId` (== lobbyId).
- **Predicate reusability — reusable, with two blockers:**
  1. **Not exported.** `findActiveGroupInBattleWeek` is a bare `async function` at `liveDraftFormation.js:272` (not in the export list). It must be `export`ed to import into the lobby service. No slot-specific variant is needed — the predicate **structurally sees a slot seat** (FORMING + no `isTraining` + member match).
  2. **Week-key mismatch (the load-bearing catch).** The slot pod stamps `baseLayerWeek = deriveBaseLayerWeek(battleStartWeek)` = the **battle** week (`liveDraftFormation.js:294`), while the regular group stamps `baseLayerWeek = isoWeekString(now)` = the **formation** week (`tournamentLobbyService.js:311`). Since the predicate does a raw string equality on `baseLayerWeek`, a naive reuse keyed on `isoWeekString(now)` would **miss** a slot seat whose battle is next Monday (Wed/Sat/Sun claims) — the exact class of bug the slot #1 fix addressed. The mirror guard must key on a **battle-week-normalized** value: apply `deriveBaseLayerWeek` (`:220`) to the regular group's own battle Monday before calling the predicate. VERIFIED.

---

## 6. Shape estimate

**Mostly re-mount + relabel + two small plumbs. No net-new screens.**

| Work item | Kind | Rough size |
|---|---|---|
| Mount `LiveDraftPicker` in the lobby center; demote bracket line to footnote | re-mount + copy | small (+ token reconcile) |
| Make `MyGameBar` conditional on the real game signal | client plumb (training-pod precedent) | small |
| Retire/rewire the "Pick your mode" stub modal; surface the live Quick Play (relabel "Auto-draft fallback", below the slots) | rewire + relabel | small–medium |
| Relabel Quick Play copy (stub-modal strings only; don't touch genuine training strings) | copy | trivial |
| Mirror guard: export predicate + insert battle-week-normalized check in `formGroupFromLobby` | **net-new server code** (small) | small, needs a test + the week-key care |

The single true build task is the **mirror guard** (a few lines, one guard, one test); everything else is composition of parts that already ship. The one design decision to make explicit: the "no game → picker in center" gating uses the **per-user** game signal (§3), whereas today's center gates on the **global** `st.bracketPending` — the consolidation introduces the per-user signal and both the center and the bar consume it.

---

## 7. Corrections to inherited anchors + observations (BUILD_RULES §3)

**Drift corrected this run (re-verified):**
1. `selectMyGroup` is **no longer FORMING|BATTLE-only** — the slot build widened it to `FORMING|DRAFTING|AWAITING_OPEN|BATTLE` (`leagueTournament.js:540-548`). The prior anchor is stale.
2. The seated-user status surfaces are **already built and mounted** in `LeagueParticipantView` (`:220-253`) — not "still needed."
3. The "Pick your mode" modal is **not** `Dashboard/QuickPlayModal.jsx`; it is `ActionLayer`/`LDActionModal` (`LeagueAction.jsx:43`, `LeagueDeskParts.jsx:447`), and it is a **fixtures stub** that calls no endpoint.
4. The center panel is selected in **`LeagueScreen.jsx`** (front-door split), not `LeagueHome.jsx`.

**Two design-integrity observations — noted for separate tasking, NOT fixed here:**
- (a) **Stale prose comment:** the doc-comment inside `subscribeMyGroup` (`tournamentGroupService.js:169`) still reads "(FORMING/BATTLE, most-recent-wins…)", describing the old two-state predicate; runtime behavior is governed by the widened `selectMyGroup` body. Comment-only drift.
- (b) **Quick Play cohort-week quirk:** `formGroupFromLobby` stamps `baseLayerWeek = isoWeekString(now)` (`tournamentLobbyService.js:311`) — the **formation** week, not the battle week ("playable from the next Monday"). For a mid-week Quick Play this files the group a week early relative to a slot pod's battle-week keying — the same class the slot #1 fix corrected on the slot side only. It is the reason the mirror guard (§5) must normalize the week key; the underlying quirk is out of scope to fix in this task.

---

## 8. STOP

This is a read-only discovery. **No project state was changed** (clean tree, no writes, no commits, no branch/remote mutation; donor branch inspected via `git show`/`git diff` only). The five-surface map, the conditional-`MyGameBar` verdict, the status-surface gap + donor-delete call, the mirror-guard site + predicate verdict, and the shape estimate are delivered above, each `file:line`-cited and — for the four load-bearing claims — adversarially CONFIRMED. This feeds the consolidation spec.
