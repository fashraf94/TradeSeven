# P9 — Stage 0: Launch-Readiness Audit · Go/No-Go Assessment

**Phase:** P9 (LAUNCH — rules deploy · five-days-clean reconciliation · security pass · the flag flip). **Stage 0 = read-only launch checklist, walked as verification → HARD STOP.**
**Branch:** `claude/festive-volta-5d44az` · **HEAD:** `0b6f79935c3829b9dd2ec992ea7584bd07d33730` (`0b6f799`, "Merge pull request #503") · **tree:** clean.
**Date:** 2026-06-13.
**Repo state:** shallow clone (`git rev-parse --is-shallow-repository` = true). No history deepening needed; none performed (BUILD_RULES §3 preamble).
**Test state:** dependencies installed this session; the seven critical tournament suites run **138/138 GREEN** at HEAD (`tournamentAgentLedger`, `tournamentOrchestrator`, `p4Flips`, `tournamentBattleView`, `place-claim`, `flip`, `reconcile-ledger`).
**Posture:** zero writes to project state during Stage 0. Every claim carries `file:line` + VERIFIED (read at HEAD this session) / ASSUMED.

---

## 0. Executive verdict — the go/no-go (read this first)

| Block | Gate | Verdict | What it needs |
|---|---|---|---|
| **1** | The five Firestore rules blocks (the one true prerequisite) | **🟡 GREEN-PENDING-DEPLOY** | All five blocks present + correct in `firestore.rules` at HEAD. They are **inert until a manual Console/CLI deploy** — a **founder action I cannot perform or verify**. This is the single blocking gate. |
| **2** | Five-days-clean reconciliation | **🟢 GREEN (engine ready) / 🟡 driver to add** | The reconcile engine + endpoint exist and are correct; the endpoint declares itself the P9 verification surface. It is **not yet runnable as a dev-screen green/red report** — that is the one authorized build (scope item 2). |
| **3** | Consolidated security pass | **🟢 GREEN — all holds** | Every item verified server-authoritative at HEAD. One doc-vs-code nuance on the claim cap (code is *stronger* than the ledger text). No launch blocker. |
| **4** | Flag-flip blast radius | **🟢 GREEN** | Gates unchanged since the P8 map; no env override (code constant); first-real-user path honestly stated (founder-formed groups at V1; the tab is live but self-serve join is out of scope). |
| **5** | Watch-ledger triage at launch | **🟢 GREEN** | Every W/O item's trigger is scale-based and **not fired** at V1 founder-formed scale; each is safe to launch *without*. X1 (training-game short) is a separate non-gating ticket, confirmed live at HEAD. |

**The one sentence for the founder:** every line of the launch checklist is verified and green *except the one thing only you can do* — deploy the five tournament rules blocks in the Firebase Console — and until that deploy is confirmed, the flag must **not** flip (every client read would 403). Nothing in the repo needs to change to launch except, last, the one-line flag flip; the only new code P9 may add is a dev-screen reconciliation report so the "five-days-clean" check is a button, not a manual curl.

**No flip is proposed in this session** because its blocking prerequisite (Block 1, the Console deploy) cannot be confirmed from here.

---

## Block 1 — The rules-deploy gate (BLOCKING — the one true prerequisite)

### The five blocks (all VERIFIED at HEAD, `firestore.rules`)

| Block | Line | Read scope | Write scope | Notes |
|---|---|---|---|---|
| `tournamentGroups/{groupId}` | `:302` | `request.auth != null` (any authed user — spectator-by-design) | `create, update, delete: if false` | Group doc; all mutation Admin-SDK. |
| `tournamentGroups/{groupId}/{document=**}` | `:312` | `request.auth != null` | `write: if false` | Recursive: covers `boards`, `streams`, `claims`, `ledger`, `agentBoards`. |
| `tournamentBrackets/{bracketId}` | `:322` | `request.auth != null` | `write: if false` | Whole-bracket doc. |
| `tournamentLeaderboards/{monthId}` | `:334` | `request.auth != null` | `write: if false` | Month-keyed board (incl. `dev-` namespace). |
| `tournamentRanks/{rankId}` | `:339` | `request.auth != null` | `write: if false` | Career rank; deliberately NOT on `users/{uid}` (that doc is owner-writable). |

Each block's comment carries the standing caveat: *"Manual deploy via Firebase Console required after merge — Firestore rules don't auto-deploy from code … inert until deployed."* (`:299-301`, `:309-311`, `:319-321`, `:331-333`).

### Access-pattern match — every client read maps to a granting rule (VERIFIED)

| Surface read | Client call (`src/services/tournamentGroupService.js`) | Granting rule |
|---|---|---|
| My group / group doc | `subscribeMyGroup :145`, `subscribeGroup :37`, `getGroup :27` | `tournamentGroups` `:303` |
| Claims | `subscribeClaims :57` (`limit(20)`) | recursive `:313` |
| Agent boards | `subscribeAgentBoards :78` | recursive `:313` |
| Agent/user draft streams | `subscribeAgentDraftStream :93`, `subscribeUserDraftStream :109` | recursive `:313` |
| Own committed board | `subscribeOwnBoard :126` | recursive `:313` |
| Agent held-set ledger | `subscribeAgentLedger :168` | recursive `:313` |
| Bracket | `subscribeBracket :183` | `tournamentBrackets` `:323` |
| Leaderboard | `subscribeLeaderboard :198` | `tournamentLeaderboards` `:335` |
| Career rank | `subscribeRank :212` | `tournamentRanks` `:340` |

- **Spectator transparency reads** (boards/streams/bracket/leaderboard/rank) → authed-read blocks above. ✔
- **Owner-scoped battle reads** → handled **outside** these rules: the live participant reads their OWN battle via `useMyTournamentBattle` (the `agentBattles` rule `:201-202` is owner-private — `resource.data.ownerId == request.auth.uid`). ✔
- **The WHY projection endpoint is Admin-SDK and rule-exempt by design** (`api/tournament/battle-view.js:39-53` reads `agentBattles` via Admin SDK, which bypasses rules, then projects per-viewer). A spectator never reads another player's battle doc directly. ✔ (No tournament rule needed for it.)
- **Leaderboard / rank / bracket reads** → authed-read blocks above. ✔
- **Claim/flip mutation paths** → **server-side, authed POST endpoints** (`place-claim.js`, `flip.js`), never client-direct writes (every subcollection block is `write: false`). ✔

### The gate and the ordering (the critical statement)

The blocks are **inert until deployed**. **If `TOURNAMENT_TAB_ENABLED` flips before the rules are deployed, every client read in `LeagueScreen` 403s** (`subscribeMyGroup`, claims, boards, streams, ledger, bracket, leaderboard, rank all hit the default-deny `:632-633`). The screen would mount and immediately fail every subscription.

**Correct order (non-negotiable):**
1. Deploy the five blocks in the Firebase Console (founder; `firebase deploy --only firestore:rules` exists as `npm run deploy:rules` but is the founder's credentialed action — **never automated by this session**).
2. Verify the deploy (a read that would have 403'd now succeeds on a dev surface — see Block 2 / the runbook).
3. *Only then* flip the flag.

**The flip cannot precede the deploy.** I cannot see the Firebase Console; I cannot confirm the deploy; therefore I will not make the flag-flip commit until the founder confirms the deploy.

---

## Block 2 — The five-days-clean reconciliation

### What "clean" means concretely (the assertion set)

A simulated tournament week is **clean** when, at each settled snapshot, all hold:

1. **Every banked day reconciles** — banking ran per `recordedDate` once (idempotent, `tournamentBanking.js` per-date skip) and produced `closeScores[uid]` for every player.
2. **Every held symbol has a *verified* holder** — `reconcileGroupLedger` (`tournamentAgentLedger.js:591`) rebuilds `held` from each agent's current battle portfolio (derived truth) and `divergences` is **empty**: specifically **zero `unverifiable_holder`** (`:674`), zero `wrong_holder` (`:662`), zero `not_in_portfolio` (`:676`), zero `duplicate_holding` (`:638`), zero `missing_in_ledger` (`:662`), zero `foreign_battle` (`:614`).
3. **Composite = agent + k×user at every snapshot** — one home, `computeComposite` (`leagueTournament.js:373`, `k = USER_LAYER_K`, founder-set 1.5); banking writes `compositePoints`, `getWeeklyComposite` reads it (P8 §1.2).
4. **Advancement locks the right top-two** — `lockTopTwo` → `advanceCohort` writes `advancers`/`finalScores` (composite); `applyLockedGameToRanks` is completeness-guarded (P8 §1.3).
5. **Side-effects land before completion** — `stampEntrySideEffects` writes `sideEffectsAt` only after BOTH halves clean; the sweep and champion gate key on its absence (no orphan window; P8 §1.3).
6. **The bracket finalizes from its own doc** — advancement is resumable from the bracket doc alone (natural guards; P8 §4).

### "Verified holders" now replaces "unverifiable_holder" (the P4 inflection)

`unverifiable_holder` (`tournamentAgentLedger.js:669-674`) preserves a held symbol whose holder has **no battles in the group** — it was the *correct* state pre-P4, when no real battles were stamped, so nothing could be diffed against a portfolio. **Post-P4** (`TOURNAMENT_DEPLOY_ENABLED = true`, the orchestrator deploying real battles), a held symbol should resolve to a **verified holder** (a holder whose current battle portfolio contains the symbol). So the launch assertion is: after a real simulated week, the reconcile report shows **0 `unverifiable_holder`** — every hold is portfolio-backed.

### The endpoint exists and is the declared P9 surface (VERIFIED)

`api/tournament/reconcile-ledger.js` — admin-secret-gated POST `{groupId}`, targets a group in `BATTLE`, calls `reconcileGroupLedger`, returns `{ groupId, battles, holders, heldCount, heldSymbols, divergences, staleCleared }`. Its header (`:6-9`) states verbatim: *"It is also the P9 verification surface ('ledger reconciliation clean for 5 days')."* Production reconciliation rides the nightly `snake-draft-daily-scores` tournament branch (zero new cron).

### Proposal — make it a runnable green/red report (the one authorized build)

The dev screen (`TournamentDevScreen.jsx`) drives seed / resolve / bank / run-duty / claims, but has **no reconcile button** and renders **no divergence verdict**. To satisfy "a green/red report the founder reads, not a manual eyeball," add (dev-only, additive, no fence/cron/flag, behind `?tournamentDev=1`):
- a **"Reconcile ledger"** button calling `/api/tournament/reconcile-ledger` for the attached group;
- a verdict renderer: **GREEN** when `divergences.length === 0` (and `heldCount` matches expected agent holdings, no `unverifiable_holder`); **RED** listing each divergence `{type, symbol, details}`.

Run over the existing dev data **plus a fresh simulated week** (seed → resolve → run Monday pipeline → bank Mon–Fri via the sim clock → reconcile each day). The output is the founder-readable green/red the launch criterion of record demands.

---

## Block 3 — The consolidated security pass (all VERIFIED; dispositions below)

### 3.1 Claim-window + cap enforcement — **HOLDS**
- **Window:** server-authoritative — `place-claim.js:67-72` → 403 `window_closed` (via `getTournamentClaimWindow`). ✔
- **Day-5 cutoff:** `place-claim.js:102-104` → 409 `battle_last_day`; derived from the banking record, **deliberately not bypassable** by `devBypassWindow` (`:100`). ✔
- **Pending cap:** `place-claim.js:129` inside a transaction. **Nuance (doc-vs-code):** the ledger/P8 describe the cap as *"advisory (parallel submissions can both land; resolution still honors it)."* The code at `:121-142` wraps **cap-check + duplicate-check + write in ONE `runTransaction`**, and the inline comment `:121-124` states this **closes** the parallel-landing race. So the code is **stronger** than the ledger text. Either way the cap is **server-authoritative and bounded**, and the **resolution** (claims processing, rank-ordered) is the final authority that honors the cap. **Honest and bounded → HOLDS.** *(Doc-accuracy nit: the ledger W3 / security-agenda item 2 wording should be updated to "transaction-enforced; resolution is the backstop" — a text fix, not a blocker.)*
- **Flip cap:** server-enforced inside the flip transaction — `flip.js:150` → 409 `flip_cap_reached` (atomic on the single group doc; not advisory). ✔
- **Client mirror is display-only:** `tournamentActions.js` rejects on `!res.ok` (`:30-35`) and only maps the server's error copy; it cannot gate or bypass. ✔

### 3.2 The WHY projection — **HOLDS** (concealment-by-default re-verified)
- Non-owner active reads concealed **server-side** via `api/tournament/battle-view.js` (Admin-SDK) + `projectTournamentBattle` (`api/_utils/tournamentBattleView.js:76`).
- **Allowlist, not denylist** — `PUBLIC_TOP_LEVEL` (`:36-40`), `PUBLIC_AGENT_CONTEXT` (`:45`), `PUBLIC_STATUSFEED` (`:48`), `PUBLIC_TRADE` (`:51`); `pick()` (`:53-58`) copies **only** listed keys. **Therefore any field added to the battle doc since P7-A is concealed BY DEFAULT** — this is true *by construction*, not assumed: a new WHY field cannot leak; the only failure mode is a new *public WHAT* field being over-concealed (a UX gap, never a leak). Owner-live and completed battles return unchanged (`:78-79`). ✔ (11/11 `tournamentBattleView` tests green.)

### 3.3 The client mutation callers — **HOLDS**
- Only client writers: `src/services/tournamentActions.js` → authed `place-claim` / `flip` (`:44-58`). `tournamentGroupService.js` is **reads-only by contract** (header `:4-6`; every export is `getDoc`/`onSnapshot`/`getDocs` — no write API imported). ✔
- **No client-direct write path to any tournament doc exists** — the rules deny client writes to every tournament collection/subcollection; mutation is Admin-SDK endpoints only. ✔
- **Deploy auth:** `decide.js` internal `CRON_SECRET` classification + **ownership assertion both caller classes** (`:129-139`: internal deploy requires `ownerOdUserId` matching `agent.ownerId`; client may only deploy own agent). `TOURNAMENT_ONLY_FIELDS` frozen and **refused pre-auth from browser callers** (`:46-55`). ✔ *(decide.js is fenced — READ only this session, not edited.)*

### 3.4 The dev/prod boundary at launch — **HOLDS**
- One eligibility home `fetchEligibleGroupsByStatus(... includeDev=false)` excludes `isDev` on production; production cron passes nothing (P8 §3). Test-locked: production EXCLUDES isDev, seeders stamp, advancement inherits, every dispatcher duty threads `includeDevGroups` (`p4Flips.test.js:56-82`). ✔
- `dev-` namespacing on `leaderboardDocId`/`rankDocId`; `sim:` duty markers isolate smoke runs (P8 §3). ✔
- **Flipping the tab cannot surface dev/smoke data on a production surface:** `subscribeMyGroup` finds a real user's group by `groupMembers array-contains uid`; dev/smoke groups are founder/seeder-owned and `isDev`-stamped, excluded from every production duty, and a real user is not in their `groupMembers`. ✔

**Block 3 → all holds. No launch blocker.** One doc-accuracy nit (3.1) recommended for the ledger text, not fix-before-flip.

---

## Block 4 — The flag-flip blast radius (P8 map re-confirmed at HEAD)

### What `TOURNAMENT_TAB_ENABLED` gates (unchanged since P8)
- `src/config/featureFlags.js:78` — `export const TOURNAMENT_TAB_ENABLED = false;` **a hardcoded code constant; no env override** (grep: only the constant + 3 consumers). The flip is a **code change shipped via normal merge/deploy**, not a runtime toggle. ✔
- `App.jsx:9563` — `if (TOURNAMENT_TAB_ENABLED && screen === 'league')` mounts `<LeagueScreen/>` (unreachable when false — nav items are its only setters). ✔
- `BottomNav.jsx:10-12` — bottom-nav "League" item (mobile nav **4 → 5**). ✔
- `DesktopSidebar.jsx:14-16` — sidebar "League" item (desktop **6 → 7**). ✔

### DEPLOY is already true — the flip is the client tab only (re-confirmed)
`TOURNAMENT_DEPLOY_ENABLED = true` (`tournamentOrchestrator.js:95`, test-locked `p4Flips.test.js:30-32`). The production orchestrator cron (`vercel.json:170`, `*/10 11,12,13,14,21,22,23 * * 1-5`) is **already live, inert** (zero non-dev groups → quiet skip; `isDev` exclusion holds). P9's flip **does not turn on the engine** — it makes the surfaces reachable, so real users can create real groups the already-running orchestrator then acts on. ✔

### The first-real-user path — stated honestly
A new user reaching the tab → `LeagueScreen` mounts → `subscribeMyGroup` returns `null` → the **empty-state poster** (`LeagueScreen.jsx:130-149`): *"No active tournament group yet. When your group forms, your draft board lives here."*

- **What a real user CAN do at flip-time:** reach the tab, see the empty state; once a founder forms a group with them in `groupMembers`, see FORMING (board-commit), then BATTLE (playback + claims/flips + feed). ✔
- **What a real user CANNOT do at flip-time:** **self-serve register or join a group.** There is no join UI in `LeagueScreen`; membership is set only by the founder-driven seeder/orchestrator writing `groupMembers`. **The self-serve registration/join flow is explicitly out of scope for V1.**
- **Operational meaning of "launched":** *the tab is live* (surfaces reachable, real groups play). *A user can play* **only once the founder forms their group.** This gap is by design for V1; name it in the runbook so "launched" is unambiguous.

---

## Block 5 — The watch-ledger triage at launch (every trigger re-checked)

All items in `docs/LAUNCH_READINESS_WATCH_LEDGER.md`; each trigger is **scale-based and NOT fired** at V1 founder-formed scale (tens of rows, 1–few groups/player). Each is genuinely safe to launch *without*, not merely deferred:

| Item | What | Trigger (not fired at V1) | Safe-to-launch-without? |
|---|---|---|---|
| **W1** | `subscribeMyGroup` no composite index (`tournamentGroupService.js:145-160`) — array-contains + client-side status filter, no `limit` | A player accrues *tens* of completed groups | ✔ Yes — early players are in 1–few groups. Fix = a **Console index deploy** (flag in PR; never improvise). |
| **W2** | Leaderboard one whole-doc month board (`tournamentLeaderboard.js`) | ~3–5k actives/month (1 MiB cap) | ✔ Yes — V1 is tens of rows. Land sharding *before* open registration. |
| **W3** | Claim/flip tx read budget | Group size / pending-cap config grows | ✔ Yes — bounded by group size (~14 reads/group), not registration scale. Verified bounded. |
| **W4** | streams/boards string literals | A future rename of one literal | ✔ Yes — **all values agree today; no live split** (verified). Future-rename hazard only. |
| **W5** | Client ET-today helpers not converged | A client-side ET-date drift bug | ✔ Yes — server `toIso` converged at P8; client copies intentionally left (cross-SDK boundary not clean). |
| **O1** | Holiday-week advancement waits for founder | A 4-trading-day week (day-5 never banks) | ✔ By design — note upcoming short weeks in the launch calendar. |
| **O2** | Banking → advancement deferral-coupled | — | ✔ Composes; first live Friday "banking pending" logs are normal. |

### X1 — the training-game short bug (separate, non-gating ticket) — status CONFIRMED at HEAD
`src/screens/BaggerBombTrainingBattleViewV4.jsx` carries the same short double-negation P8 found: pre-negate `priceChange` (`:396-398`) and `thresholdPriceChange` (`:406-408`), then forward `direction` to `calculateAssetScoreV3` (`:417`/`:479`), and **crypto shorts ARE user-selectable** (`:624 direction: 'short'`) — a **live scoring sign-flip** in the training game.
- **Reachability:** users can select crypto shorts in the V4 training view → **live** (not dormant, unlike the AgentBattleScreen sibling P8 fixed). VERIFIED present at HEAD.
- **Gates this launch?** **NO** — it touches **no tournament collection or surface** (it is the shipped training game's V4 view). It does not block the tournament flag flip.
- **Recommendation:** its **own urgent ticket** (founder already opening one) — fix = call the scorer without `direction` (let the canonical scorer own sign once), with a long-path-locked + short-sign test. *(Report-don't-fix per BUILD_RULES §3; out of P9 scope.)*

---

## 6. The ordered launch sequence (the product of this phase)

1. **Merge everything through P8** — done (HEAD `0b6f799`).
2. **Deploy the five tournament rules blocks in the Firebase Console** — **FOUNDER ACTION, the blocking gate.** (`tournamentGroups`, recursive subcollections, `tournamentBrackets`, `tournamentLeaderboards`, `tournamentRanks`.) Never automated by a session.
3. **Verify the deploy** — on a dev surface, a read that would have 403'd now succeeds (e.g., the dev screen's bracket/leaderboard cards render; or the reconcile/board reads resolve under the deployed rules).
4. **Run the five-days-clean reconciliation → GREEN** — seed a fresh simulated week + the existing dev data; reconcile each day; `divergences: []`, 0 `unverifiable_holder`. (Via the dev-screen report once built.)
5. **Walk the security pass → all holds** — confirmed green in Block 3 (re-confirm after any pre-flip change).
6. **Merge the flag-flip commit** → `TOURNAMENT_TAB_ENABLED = true` → the tab is live. **Its own commit/PR, LAST, body stating the confirmed launch sequence + that the rules deploy was confirmed.**
7. **Begin the first-week observation plan** — first real Monday pipeline, first real banking, first real advancement, each a quiet-success checklist (the runbook).

---

## 7. Founder decisions requested at this HARD STOP

1. **The blocking gate (Block 1):** Have the five tournament rules blocks been **deployed in the Firebase Console**? I cannot see the Console or verify it. **The flip cannot proceed until this is confirmed.**
2. **Scope of this session's build:** the audit is the deliverable; beyond it, the safe in-scope work is (a) the **reconciliation dev-screen report**, (b) the **launch runbook** in `docs/`, (c) the **P9 phase report**, and (d) — gated on #1 — the **flag-flip commit**. How far should I proceed now? (Recommended: build a–c now; hold the flip until you confirm the deploy.)
3. **The claim-cap doc nit (3.1):** update the ledger text to match the stronger transactional code (a one-line doc fix), or leave as-is? (Recommended: update for accuracy; not fix-before-flip.)

**No block is RED on the code. The only thing standing between here and launch is the founder Console deploy (Block 1) and, after it, the one-line flag flip — which I will not make until the deploy is confirmed.**

---

*Prepared at the P9 Stage 0 HARD STOP. Awaiting the founder's confirmation of the rules deploy (§7.1) and the go before the flag-flip commit. Default posture: confirm, don't change.*
