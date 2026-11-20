# Beta switch census — every switch that decides what a player sees (read-only)

Claude Code (Opus 5.5), 20 Nov 2026, for Flash. Prompt: "Discovery prompt — the beta switch census (read-only)" (the beta launch chat, 20 Nov 2026). The beta opens **Friday Dec 4, 2026**.

## 0. Preamble

| | |
|---|---|
| Fetch | `git fetch origin` run first (BUILD_RULES §3). |
| Base | `origin/main` = `41c04cd2` (Merge PR #1097). The worktree HEAD was `41c04cd2` before this report's commit; clean tree. |
| Branch | the worktree was cut as `claude/beta-switch-census-8b2c82`; the report is pushed to the prompt's name, `claude/beta-switch-census` (no such remote branch existed before). No PR. |
| Read-only | No code change, no flag change, no Firestore read or write, no model call, no EODHD call, no Vercel call. The only file added is this report. |
| Not readable from here | Vercel environment values and production Firestore documents. Every one this report names is marked **founder to confirm**. |
| Uids | No uid, email, voice id or secret value is printed. A list is "set / not set" and how many entries the code expects. |
| Markers | **V** = VERIFIED (the line was read in this session at `41c04cd2`). **A** = ASSUMED (inferred, a doc's claim not re-checked, or a production state this session cannot see). Lines drift; re-verify before relying. |

## 1. In plain terms

**What a brand-new player sees today.** They sign in and build their agent: a welcome, a stock pick, three temperament questions, a name and a colour, then the reveal. They land on the Command Center hub — the armored agent, the armory, a loadout per game, the hub's own brief and the Scouting Board — with "Play your first BaggerBomb game against a CPU" as the next step. They play BaggerBomb through their casual clone, see the agent form in the battle, and get **Bomb mode** when they open a stock in a battle. After the game they get the **Film Room** screen, without cards. The **Forge** shows all four tabs. **The League is visible**: its tab, lobby and live draft are all open, because the hide is built but not switched on.

**What they do not get** (the founder and FT_QA only): the **cockpit**, Film Room **cards**, the two-view **research shell** and its Ask, **Battle Research**, the **chart read**, **Work an idea**, and idea records. The **Huddle** has its own named list. **Nobody** has the idea book, and it has no screen.

**What changes if every Dec 4 target is met.** The League disappears, and its tab becomes the BaggerBomb page. Every player gets Film Room cards. The cockpit opens to a growing share of BaggerBomb agent battles, though never to League battles. Work an idea opens to everyone. The idea book runs for the founder alone, server-side only. The Forge shrinks to the sections that change a battle. Everything else stays as it is.

**Which targets are one line and which are not**

- **One line:** Film Room cards (`'allowlist'` → `'on'`).
- **One merge:** the League hide (PR #1076, which must catch up 307 commits first).
- **A Console write:** the cockpit stages. The founder ruled that two prerequisites must come first, and neither is on `main`: Amendment H and the status re-ask.
- **Needs code:**
  - **Work an idea.** Its gate still requires the shared list even at `'on'`.
  - **The Forge trim.** There is no switch per section.
  - **The idea book beyond the founder.** No player screen exists.
- **Already met:** the hub, armory, loadouts, agent form, Film Room screen, tape writer and Bomb mode.

**One trap to know about.** A single list (`COCKPIT_ALLOWLIST_UIDS`) gates eight live features today, and three more are wired to it but not switched on (§4.2). Adding a name opens all eight for that player at once, so the list is not a staging tool. Opening the cockpit in stages does not open its neighbours.

## 2. The flip sheet

Today = `main` at `41c04cd2`. "The list" = `COCKPIT_ALLOWLIST_UIDS` (§4). Every code flip is the literal **and its pin row in the same commit** (BUILD_RULES §2), merged by the founder.

| Feature | Switch | Today on `main` | Dec 4 target | Change needed | Shares a list with |
|---|---|---|---|---|---|
| Command Center hub | `COMMAND_CENTER_HUB_ENABLED` `featureFlags.js:3581` | `true` — every signed-in player with an agent | everyone | **no change** | — |
| Armory | `AGENT_FORM_ARMORY_ENABLED` `agentFormFlags.js:101` | `true` — everyone on the hub | everyone | **no change** | — |
| Per-game loadouts | `PER_GAME_LOADOUT_ENABLED` `perGameLoadoutFlags.js:39` | `true` — everyone | everyone | **no change** | — |
| Agent form | `AGENT_FORM_HUB/BATTLE/LEAGUE_ENABLED` `agentFormFlags.js:50/66/82` (`AGENT_FORM_LAB_ENABLED :32` = `false`, a dev lab) | `true` — everyone | everyone | **no change** | — |
| Film Room screen | `FILM_ROOM_V2_MODE` `featureFlags.js:3177` | `'on'` — every taped battle | everyone | **no change** | (the list only at `'allowlist'`) |
| Tape writer | `FILM_TAPE_WRITE_ENABLED` `featureFlags.js:3137` | `true` — every battle | everyone | **no change** | — |
| Film Room cards | `FILM_ROOM_CARDS_MODE` `featureFlags.js:3632` | `'allowlist'` — the list only | everyone | `'allowlist'` → `'on'` + pin (`filmRoomCardsFlags.test.js`). Rules and index already deployed (founder confirmed 2026-10-22). Suggested first: the FT_QA tester pass the activation record names. | **the list** |
| Cockpit (today's version) | `CALL_RECORDS_MODE` `featureFlags.js:2965` + the list (Vercel) + **`cockpitConfig/release`** (Firestore, PR #1039) | `'on'` — the list's owners (every mode, League too) + the release cohort **if** the document exists (founder to confirm) | everyone, opened in stages | Console only: write `cockpitConfig/release` `{shareBp: 0, disabled: false, salt}`, then raise `shareBp` 500 → 2,500 → 10,000. **Before any share above 0** (founder's 2026-11-11 rulings): Amendment H blessed and the `useCockpitStatus` re-ask (F-3) built — **neither is on `main`**. Cap: 5 real concurrent battles. Kill: `disabled: true` (≤ 60 s). BaggerBomb agent battles only; **League stays list-only**. No rules deploy. | **the list** — but the cohort does **not** widen cards, the shell, Battle Research or the chart read |
| Work an idea, with the thesis builder | `SHARED_RESEARCH_MODE` `sharedResearchFlags.js:50`; `SHARED_RESEARCH_BUILDER_MODE :77` | `'allowlist'` — the list only; builder `'on'` for them | everyone — proposed, founder to confirm | **Not a flip.** (1) A code change: idea-record admission (`hypothesisRecords/gate.js:53-55`) has no "everyone" setting (spec §11.3) — and changing it opens idea records to everyone too. (2) Then `'allowlist'` → `'on'` + pin. Step 2 alone shows every player a door the server refuses. | **the list**, twice (its own gate and idea records) |
| Huddle | `DRB_HUDDLE_ENABLED` `huddleFlags.js:47` + `HUDDLE_PLAYER_UIDS` (Vercel) | `true` — the named cohort (founder to confirm the value) | stays on its named list | **no change** | its own list (not the cockpit list — ruling R-21) |
| Idea book | `PRACTICE_FIELD_MODE` `practiceFieldFlags.js:33` | `'off'` — nobody; **no idea-book screen exists** | the founder's account first; a first group or everyone decided Dec 1 | Founder first: `'off'` → `'allowlist'` + pin, with the founder on `MANDATE_FOUNDER_UIDS` and the list (Vercel); deploy the T1a-2b-1 rules and the `decisions.rationale` index exemption first (founder to confirm). `'allowlist'` admits the whole list (FT_QA too), though only the founder door creates a book. A group or everyone: **a build** (a player-facing create path and screen), then `'on'`. | **the list** (at `'allowlist'`) |
| Bomb mode in the research modal | `RESEARCH_MODAL_BOMB_MODE` `researchModalFlags.js:61` | `'on'` — everyone, every in-battle mount (since 2026-11-11) | everyone — proposed, founder to confirm | **no change** | (the list only at `'allowlist'`) |
| Research shell / sheet (+ its Ask) | `RESEARCH_MODAL_SHEET_MODE` `researchModalFlags.js:122` | `'allowlist'` — the list, in their own agent battles | as today | **no change** | **the list** |
| Battle Research | `BATTLE_RESEARCH_MODE` `researchModalFlags.js:169` | `'allowlist'` — the list, where the shell and the cockpit are on | as today | **no change** | **the list** |
| Chart read | `CHART_READ_MODE` `researchModalFlags.js:217` | `'allowlist'` — the list, where the shell is on | as today | **no change** | **the list** |
| League | `LEAGUE_HIDE_ENABLED` `featureFlags.js:152` | **`false` — the League is shown to everyone** | stays hidden | **Merge PR #1076** (`claude/league-hide-flip` @ `7180ad23`: flag `true`, pin, `DARK_BY_DESIGN` entry). It is 307 commits behind `main`: merge `main` into it and re-run its checks first. Merge only with League groups in flight = 0, after 6 PM ET, after the preview smoke. | — |
| Forge | **no per-section switch** (tabs `ForgeWorkshop.jsx:109-112`) | all four tabs shown | only the sections that reach battles | **A small build**, not a flip: Lists, Rules and Character's Tempo and Standing leans reach battles; the Overview, Character's display panes and Explore, the Lists' Idea panel and notes/Analysis/Discover do not (§5). | — |
| Onboarding | none (`App.jsx:10325`) | the agent-creation flow for any player without an agent; V4 is not in build | as today | **no change** | — |
| Market data | `EODHD_QUICK_WINS_ENABLED` | **does not exist on `main`** (two unmerged branches, 1,802 commits behind) | not in the rulings | nothing to flip | — |
| Old Daily Regime Brief card | none of its own; legacy dashboards only | hidden — the hub replaces those dashboards | not in the rulings | **no change** (it returns only if the hub is turned off) | — |

## 3. Part A — every switch

### 3.0 How fast each kind of switch moves

| Kind | How it changes | How fast it takes effect | Undo |
|---|---|---|---|
| **Code literal** (`*_ENABLED`, `*_MODE`) | a one-line founder PR that moves the literal **and its pin in the same commit** (BUILD_RULES §2; `src/config/flagPinGuard.test.js` fails otherwise; a `DARK_BY_DESIGN` entry, where there is one, is dropped in the same commit) | on the production deploy after merge (A: merge to `main` deploys production, as the earlier reports state) | the same line back, PR + deploy |
| **Vercel environment variable** | edit in Vercel **and redeploy production** | only on the next deployment (V `api/_utils/callRecords/allowlist.js:17-21`; V `api/_utils/huddle/gate.js` header, "takes effect only once the project is redeployed") | edit back + redeploy |
| **Firestore control document** | hand edit in the Console (Admin) | `cockpitConfig/release`: request paths within 60 s (V `release.js:65` `RELEASE_VIEW_TTL_MS = 60_000`), the evaluator on its next run | no deploy |
| **Client verdict cache** | — | the cockpit-status `allowlisted` answer is cached per owner per page life (V `src/utils/filmRoomGate.js` header); an open tab keeps it until reload. The server re-checks every request and is final. | — |

### 3.1 The switches, area by area

Each entry: **where** · **today** · **values** · **who sees it today** · **list read (and who else reads it)** · **smallest change to open it to everyone, and what must come first** · **switch-off**.

#### Command Center hub, armory, per-game loadouts, agent form

**Hub — `COMMAND_CENTER_HUB_ENABLED`** (V `src/config/featureFlags.js:3581` `= true`; true/false). `isCommandCenterHubOn()` returns the flag and nothing else (V `:3584-3586`); "No URL, environment or localStorage override exists" (V `:3555`). App picks the dashboard shell with it (V `src/App.jsx:8979-8980`; `src/components/CommandCenter/pickDashboardShell.js:66` `shell: hubOn === true ? DASHBOARD_SHELLS.HUB : legacyShell`). **Who: every signed-in player with an agent** (a player without one gets onboarding first — V `App.jsx:10325`). No list. Open: **already**. Off: the literal to false with its pin (`commandCenterHubFlags.test.js`) and its `DARK_BY_DESIGN` entry re-added, PR + deploy; the hub falls back to the legacy shells if its chunk fails to load (A — helper report, `CommandCenterHubGate`).

**Agent form** — `src/config/agentFormFlags.js` (all V):
- `AGENT_FORM_HUB_ENABLED = true` (`:50`) — the armored agent in the hub's Shadow box. **Everyone on the hub.**
- `AGENT_FORM_BATTLE_ENABLED = true` (`:66`) — the agent form on the 1v1 agent Battle View (with the character pane flags, all `true`). **Everyone.**
- `AGENT_FORM_LEAGUE_ENABLED = true` (`:82`) — the form on League seats. **Everyone who reaches League** (today, everyone; after the hide, nobody reaches it).
- `AGENT_FORM_ARMORY_ENABLED = true` (`:101`) — **the armory**: "Change archetype" opens the Armory (A — helper report, `CommandCenterHub.jsx:458`, `:557`, `:753`). **Everyone on the hub.**
- `AGENT_FORM_LAB_ENABLED = false` (`:32`) — a full-screen dev lab, reachable only by `?agentFormLab=1` and only while true (V `App.jsx:10313`). **Nobody**; stays dark (smoke branches only).

**Per-game loadouts — `PER_GAME_LOADOUT_ENABLED`** (V `src/config/perGameLoadoutFlags.js:39` `= true`). **Everyone.** Client reads are ANDed with the armory flag; server reads in the equip, change-archetype and clone paths (A — helper report). Depends on `CASUAL_CLONE_CONCURRENCY_ENABLED = true` (V `featureFlags.js:260`).

**Order of the kill switches** (A — helper report, `agentFormFlags.js:96` and `CommandCenterHub.killSwitch.jsdom.test.jsx:16-21`): the armory may be on only while the hub hero is on, and per-game loadouts only while the armory is on. Rolling back goes `PER_GAME_LOADOUT_ENABLED` first, then the armory, then the hub hero, each a literal + pin, PR + deploy. The two "killSwitch" test files toggle these code constants by `vi.mock` only — **there is no Firestore or environment kill switch for the hub or the agent form** (A — helper's grep of non-test code).

**Related, dark:** `COMMAND_CENTER_SYNC_ENABLED = false` (V `featureFlags.js:2074`) — with the hub on, its only visible effect is the battle-view tab label ("Command Center" today; "Huddle" when true — A, `agentBattleTabs.js:32`). `COMMAND_DASHBOARD_ENABLED` / `COMMAND_DASHBOARD_DESKTOP_ENABLED = true` (V `:23`, `:35`) only choose the fallback shell while the hub is on.

**Dec 4:** all of these already meet "everyone" — **no change**.

#### Film Room

**Tape writer — `FILM_TAPE_WRITE_ENABLED`** (V `src/config/featureFlags.js:3137` `= true`). Values true/false. Writes each battle-day's tape (`agentBattles/{id}/tape/{etDate}` and its `series/{symbol}`) from the close and candle crons; the close pass queries every active and just-completed battle with no owner or list filter (V `api/_utils/filmTape/closePass.js:275-276`). **Who: every battle.** List: none. Player-visible because the v2 screen needs a tape: an untaped battle opens the legacy screen and is refused a card (V `featureFlags.js` FILM_ROOM_CARDS_MODE doc, "An untaped battle (RB-5) opens the legacy screen in every mode"). Open to everyone: **already**. Off: literal to false + pin + `DARK_BY_DESIGN` entry, PR + deploy; new days go untaped, tapes already written stay (A — helper read of the flag's doc).

**Screen — `FILM_ROOM_V2_MODE`** (V `featureFlags.js:3177` `= 'on'`; values `'off' | 'allowlist' | 'on'`, V `:3180`). Resolved per battle owner on the client (V `filmRoomGate.js:145-166`). **Who: everyone** (every taped battle). The list is read only at `'allowlist'`. Open: **already**. Off: one step back (`'allowlist'` = list only, `'off'` = nobody), PR + deploy.

**Cards — `FILM_ROOM_CARDS_MODE`** (V `featureFlags.js:3632` `= 'allowlist'`; values V `:3635`). Client `filmRoomGate.js:178-211`, server `api/_utils/filmRoom/cardsGate.js:48-53` (both V). **Who: the list only** (`COCKPIT_ALLOWLIST_UIDS`; shared with §4.2). Everyone else gets the v2 screen with its card slots empty. **Smallest change: `'allowlist'` → `'on'` + the pin row in `src/config/filmRoomCardsFlags.test.js`.** Prerequisites: the `plays` rules and the `tape (ownerId, etDate)` collection-group index — already deployed, founder confirmed 2026-10-22 (A — V that `docs/audits/20261029_ACTIVATION_FILM_ROOM_CARDS_ALLOWLIST.md:38` records it). No env var, no other flag. The activation record's own next step is "the tester pass on FT_QA, and then `'on'`" (V `:15`). Off: one line back to `'allowlist'`, PR + deploy.

#### Cockpit (today's version)

Four switches compose (all V):
- `CALL_RECORDS_MODE = 'on'` (`featureFlags.js:2965`; values `'off' | 'shadow' | 'on'`, `:2968`).
- `COCKPIT_UI_ENABLED = true` (`:3036`), read through `isCockpitUiOn()` = `isCharacterPaneOn() && COCKPIT_UI_ENABLED` (`:3039-3041`); `isCharacterPaneOn()` = `BATTLE_VIEW_CONTROLLER_ENABLED && BATTLE_VIEW_CHARACTER_PANE_ENABLED` (`:2273-2275`, both `true`).
- `COCKPIT_2B_ENABLED = true` (`:3084`), `isCockpit2bOn()` (`:3087`).
- **Per battle:** `resolveCallRecordsMode(battle)` is `'on'` when the owner is on `COCKPIT_ALLOWLIST_UIDS` **or** the battle is in the release cohort (`api/_utils/callRecords/mode.js:89-99`). The screen shows the cockpit when `isCockpitUiOn()` and `GET /api/agent/cockpit-status` answers `on` (`src/screens/AgentBattleScreen.jsx:1282-1289`).

**The release switch (PR #1039 — V `git log`: `34f8ca29 Merge pull request #1039 … cockpit-release-readiness`)** is the Firestore document **`cockpitConfig/release`** `{ shareBp: 0–10000, disabled: boolean, salt: string }` (V `api/_utils/callRecords/release.js:59-60`, parsed `:103-118`). The cohort admits only BaggerBomb agent-mode battles (`gameMode === 'baggerbomb_agent'`), not CPU seats, whose owner's stable bucket `sha256(ownerId + salt)` mod 10,000 is under `shareBp` (V `release.js` header `:25-33`, `:126`, `:140`). **Absent, malformed, disabled, unread or a failed read = an empty cohort** (V header). The build never creates it; whether it exists in production is **founder to confirm** (this session read no Firestore). It is unreadable and unwritable from clients under the root default-deny, so **no rules deploy** (A — V that the header `:17-20` says so).

**The kill switch** is the same document: `disabled: true` empties the cohort within 60 s on request paths and on the evaluator's next run; deleting it returns to the list alone (A — `docs/audits/20261110_COCKPIT_RELEASE_READINESS.md:409`; V `release.js:65`). The list half is an env var (redeploy). `CALL_RECORDS_MODE` back to `'off'` turns everything off for everyone, PR + deploy.

**Who sees it today:** the list's owners, in every game mode, League included; plus the cohort if the document exists, is well-formed, not disabled and `shareBp > 0` (founder to confirm). **Smallest change to open it in stages:** in the Console, write `cockpitConfig/release` `{ shareBp: 0, disabled: false, salt: "stage-1" }` (harmless — admits nobody), then raise `shareBp` 500 → 2,500 → 10,000, one stage per clean session (A — the report's §10.2 plan, `:409`). **What must come first**, as the founder ruled 2026-11-11 (A — report `:386-390`): (1) **Amendment H blessed** (the reworded `'on'` tool text for a general population) and (2) **the `useCockpitStatus` re-ask on `on: false` (F-3)**, riding with the first-time intro build. Neither is on `main`: no cockpit Amendment H document exists under `docs/` (A — grep), and the hook re-asks only on a battle-status change or `recheck()` after a 404 (V `src/hooks/useCockpitStatus.js:13-14`, `:102`). Also ruled: at most **5 real concurrent battles**, casual-clone battles counting (A — report `:370`, `:384`). **League is outside the cohort** by ruling (A — report `:368`); a League cockpit for everyone is a separate arc.

**Staging the cockpit does not stage its neighbours** (§4.3): a cohort player gets `on` but `allowlisted: false` (V `api/agent/cockpit-status.js:113-114`), so no cards, shell, Battle Research or chart read.

#### Work an idea (Shared Research)

**`SHARED_RESEARCH_MODE`** (V `src/config/sharedResearchFlags.js:50` `= 'allowlist'`; values `:18`). **`SHARED_RESEARCH_BUILDER_MODE`** (V `:77` `= 'on'`; values `'off' | 'on'`, `:53`) — the thesis builder, stamped on a session when it is opened (V `api/_utils/sharedResearch/gate.js` `sharedResearchBuilderMode`). Hub door: "Work an idea" (V `src/components/CommandCenter/hub/hubCopy.js:313`).

**Who sees it today: the list only.** The hub admits at `'allowlist'` only on a definite `allowlisted` verdict (V `src/hooks/useHubResearchAdmission.js:59-64`); the server admits only a uid that is on the list **and** passes idea-record admission (V `gate.js:93-99`, `:98` `return admitted && hypothesisRecordsOnFor(uid) === true`).

**Smallest change to open it to everyone — not one line.**
1. **A code change first:** idea-record admission (`api/_utils/hypothesisRecords/gate.js:53-55`, V) is the flag AND the list, with no "everyone" arm. The flag's own runway says `'on'` comes "after one clean allowlist week and the framework's idea-record admission change (spec §11.3)" (V `sharedResearchFlags.js:39-41`). That change also opens idea records (the Forge watchlist's Idea panel, the review pass, carriage — §4.2 B9) to everyone, so it is a decision of its own.
2. Then `SHARED_RESEARCH_MODE` `'allowlist'` → `'on'` + the first row of `sharedResearchFlags.test.js`.
- Rules and indexes for B1–B3 were deployed 2026-11-15 from `0b720acc` (A — the flag doc `:38-39` says so). B4/B5 rules: see §6 F-3.
- **Hazard if step 2 ships without step 1:** the hub shows the door to every signed-in player (V `useHubResearchAdmission.js:59` `if (mode === 'on') return { admitted: uid !== null }`) while the server answers `404 disabled` to everyone off the list (V `gate.js:93-99`). The door would open onto a refusal (exact screen not traced — A).

Off: one step back + pin, PR + deploy. The builder: `'on'` → `'off'` + pin; existing sessions keep the shape they were stamped with (A — gate.js doc, K-2).

#### Huddle

**`DRB_HUDDLE_ENABLED`** (V `src/config/huddleFlags.js:47` `= true`; true/false) **AND** the Huddle's own cohort **`HUDDLE_PLAYER_UIDS`** (V `api/_utils/huddle/gate.js:25`, parsed `:32-36`). Unset or blank = **no one** (V `:33-35`). `isHuddleLive` = flag and a non-empty cohort (V `:39-41`); `huddleAdmits` = flag and the uid in the cohort (V `:44-46`). **Separate from the cockpit list by ruling R-21** (V gate.js header `:7-8`). Every `/api/huddle/*` route, the worker, the brief's enqueue and the check-start sweep ask here (A — helper report, `routeKit.js:34,46`, `huddle-worker.js:27-28`, `compute-daily-regime-brief.js:64`, `sweep.js:46`).

The client holds no list: the hub's `GET /api/huddle/status` answers 404 to an outsider and the hub then renders its flag-off self (A — helper report: `src/hooks/useHuddleToday.js:48`, `hub/huddleView.js:30-33`, `CommandCenterHub.jsx:863`).

**Who sees it today: the named cohort only** (value **founder to confirm in Vercel**; S1 was specified for at most 50 players — A). Voice: **`HUDDLE_SHADOW_VOICE_ID`** (V `api/_utils/huddle/speech.js:27` `VOICE_ENV = 'HUDDLE_SHADOW_VOICE_ID'`) with `ELEVENLABS_API_KEY`, and audio storage on `GCS_CREDENTIALS`: any of them missing degrades the day to **text-only**, it does not hide the Huddle (A — helper report, `speech.js:73-74`, `audioStore.js:23-24`, `job.js:142-158`). All three **founder to confirm in Vercel**.

Open to everyone: there is **no "everyone" setting** — it is ruled at the public flip, which waits for S2–S4 (concept R-10; A — helper report citing `docs/specs/20261110_HUDDLE_S1_BUILD_SPEC_V1_1_AMENDMENT_E.md:72`). Target is "stays on its named list": **no change.** Off: the cohort edited + redeploy (per player), or the flag to false + pin + `DARK_BY_DESIGN` entry, PR + deploy (whole feature). Change after the close: a plan filed that day stays in its game until the battle completes (V `huddleFlags.js` doc, review HC-1).

#### Idea book (Practice Field)

**`PRACTICE_FIELD_MODE`** (V `src/config/practiceFieldFlags.js:33` `= 'off'`; values `:36`). Server-only: no `src/` module imports it (V `:7-8`). Resolved by `practiceFieldAdmits` (V `api/_utils/practiceField/mode.js:42-48`): `'on'` every uid, `'allowlist'` the **cockpit list** (`readCockpitAllowlist`, V `:46`), `'off'` nobody.

**Who sees it today: nobody**, and **there is no idea-book screen in the app.** The only player-facing piece is the Film Room card's Offer route, shown only when the owner's book is open (A — helper report: `src/screens/filmRoomV2/FilmRoomCardRegions.jsx:249-250`, `api/_utils/filmRoom/cardCounter.js:210`); the Shared Research "thesis saved" screen says plainly that the idea book does not read saved theses yet, and the idea-book ending and watching screen "are not built" (V `src/components/SharedResearch/screens/ThesisSaved.jsx:7-9`).

**The founder's door:** `POST /api/practice-field/founder` (create book, admit fixture, pause/resume, wind down, resolve hold — A, helper report) admits a uid only when the mode is **not `'off'`** and the uid is on **`MANDATE_FOUNDER_UIDS`** (V `api/_utils/practiceField/founderControls.js:65-74`; V `api/practice-field/founder.js:34`). No client code calls it (V — no `practice-field` reference under `src/`). Book creation also needs `practiceFieldAdmits` (A — helper report, `ideaBook.js:198`).

**"The founder's account first" — the smallest change:** `'off'` → `'allowlist'` + the pin row in `practiceFieldFlags.test.js`, with the founder on both `MANDATE_FOUNDER_UIDS` and `COCKPIT_ALLOWLIST_UIDS` (**founder to confirm in Vercel**). No mode admits the founder alone: `'allowlist'` admits the whole cockpit list (FT_QA too). In practice FT_QA gets nothing it can use — a book is created only through the founder door, for the caller (A — helper report, `founderControls.js:228`, `:247`) — but every list member passes the gate. **Before it:** the T1a-2b-1 rules (the idea-book owner-read blocks) and the `decisions.rationale` index exemption must be deployed; the T1a-2b-1 report requires both (A — `docs/audits/20261115_BUILD_T1A2B1_ACCESS_RECORDS_FOUNDER_CONTROLS.md:489-490`, "never `--force`"). They are on `main` and newer than the last deploy this repo records (§6 F-3): **founder to confirm they were deployed.** T1a-2b-4 (PR #1098) is not merged (V `git log`).

**A first group or everyone (Dec 1 decision):** `'on'` alone opens the gate but gives a player no way in — a player-facing create path and an idea-book screen are a **build**, not a flip. Off: the literal back one step + pin, PR + deploy; going to `'off'` freezes open books, nothing is deleted (V `practiceFieldFlags.js:28-29`).

#### Research modal

All four live in `src/config/researchModalFlags.js` (V):

| Switch | Today | Who sees it | Open to everyone | Needs first |
|---|---|---|---|---|
| **Bomb mode** `RESEARCH_MODAL_BOMB_MODE` (`:61`) | `'on'` since 2026-11-11 (doc `:40-44`) | **everyone**, every in-battle mount (V `bombModeGate.js:42-46`) | already | — |
| **Shell / sheet** `RESEARCH_MODAL_SHEET_MODE` (`:122`) | `'allowlist'` | list owners, in their agent Battle View only; everyone else keeps today's modal (V `sheetMode.js:51-56`). The in-battle **Ask** follows it (V `api/_utils/researchAsk.js:109-116`) | `'on'` + pin (`researchModalSheetFlag.test.js`) — opens it on every mount, browse included | doc: "after one clean live session on the allowlist" (`:104-106`) |
| **Battle Research** `BATTLE_RESEARCH_MODE` (`:169`) | `'allowlist'` | list owners, on an active non-League agent battle whose cockpit 2b is on and whose shell is on (V `battleResearchMode.js:45-47`; `AgentBattleScreen.jsx:2611`, `:2630`) | `'on'` + pin (`battleResearchFlag.test.js`) | the shell `'on'` and the player's battle cockpit-on (list or cohort) |
| **Chart read** `CHART_READ_MODE` (`:217`) | `'allowlist'` | list players; the route admits by uid (V `api/research/setup-read.js:78`), the Chart view asks only where the shell is on (V `AssetResearchModal.jsx:587`) | `'on'` + pin (`chartReadFlag.test.js`) | the shell `'on'` |
| `RESEARCH_MODAL_OPENING_VIEW` (`:244`) | `'chart'` | a constant, not a gate: where the shell opens when the chart read is not `'off'` | — | — |

Off for each: one step back + pin, PR + deploy (doc "ROLLBACK" paragraphs, V). Dec 4 target: Bomb mode "everyone" is **already met**; the rest "as today".

#### League

**`LEAGUE_HIDE_ENABLED`** (V `src/config/featureFlags.js:152` `= false`; true/false; a `DARK_BY_DESIGN` key in `flagPinGuard.test.js`, V). **Today the League is shown to everyone.** PR #1075 (the dark flag and the BaggerBomb page) merged (V `88668811`); **the flip, PR #1076 (`claude/league-hide-flip` @ `7180ad23`), is not on `main`** (V `git merge-base --is-ancestor` → not an ancestor; 5 commits ahead, 307 behind; it sets `:152` to `true`).

Readers (all V): `src/App.jsx:59` (the BaggerBomb page), `:2246`, `:2291`, `:2306` (the three League web-address doors), `:4027` (the poll), `:10213` (the 'league' route renders the page), `:12714`; `src/components/Navigation/BottomNav.jsx:12`; `DesktopSidebar.jsx:16`; `src/components/CommandCenter/LoadoutCards.jsx:179` (the League loadout card); `PerGameLoadoutScope.jsx:27`; server `api/_utils/leagueHidden.js:26-30` (`404 league_hidden` on slot-claim and the six lobby routes), `liveDraftEndpoint.js:83`, `lobbyEndpoint.js:89`. No env var, no list, no Firestore document.

**Smallest change to hide it:** merge #1076 — it also moves the pin, drops the `DARK_BY_DESIGN` entry and holds 13 League-card rows of the hub's loadout test at flag-off (A — memory of the build; re-check on the PR). It must first take `main` (307 commits) and re-run its checks on the merged tree. The build report's pre-merge conditions: **League groups in flight = 0**, after 6 PM ET, after the preview smoke (V `docs/audits/20261115_BUILD_LEAGUE_HIDE_BAGGERBOMB_PAGE.md:150-160`). Code only: no env var, no rules deploy (A). Unhide: the literal back + pin, PR + deploy. The other League flags (`LEAGUE_LOBBY_ENABLED` and the rest, all `true`) stay as they are and are reached only through the doors the hide closes (A).

#### Onboarding

**No switch.** A signed-in player with no agent gets `OnboardingExperience` (V `src/App.jsx:10321-10326`: `if (onboardingGateReady && !hasAgent)`); `hasAgent` comes from `useAgent` (A — helper, `App.jsx:2332`). The flow is the agent-creation flow — welcome, a stock pick, three temperament questions, name, colour, the derivation, the reveal — and it lands on the hub (A — helper report, `AgentCreationFlow.jsx`). On the hub a new player's first next action is "Play your first BaggerBomb game against a CPU" (A — `hubCopy.js:412`). The spotlight tour is mounted but nothing sets it open (V — `useState(false)` at `App.jsx:2562`, no `setShowSpotlightTour(true)` in `src/`).

**V4 onboarding is not in build.** No V4 onboarding file is tracked (V — `git ls-files` has no `ONBOARDING_V4` path; `docs/specs/` has no onboarding spec), no code reads `playerContext` (A — helper grep), and it is cited only by name in other specs (A — helper: `docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md:14`, `:521`; the hub's Amendment E plans it as "onboarding O3"). **Dec 4: as today — no change.**

#### Market data

**`EODHD_QUICK_WINS_ENABLED` does not exist on `main`** (V — no match in `src/`, `api/` or `docs/` at `41c04cd2`). It lives only on two unmerged branches: `origin/perf/eodhd-quick-wins` (`15940088`, 2026-10-07) and `origin/flip/eodhd-quick-wins` (`dcb474e4`; its flip commit `e7e25e45` sets it `true`), each about 10 commits ahead of and **1,802 behind** `main` (V `git rev-list --left-right --count`). Nothing to flip on Dec 4. Two other EODHD switches are on `main`, both dark and both agent-side (not player-visible — A, from their docstrings): `EODHD_FETCH_GUARD_ENABLED = false` (V `featureFlags.js:2897`) and `EVAL_MARKET_DATA_CUTS_ENABLED = false` (V `:2912`).

#### The old Daily Regime Brief card on the hub

**No flag of its own.** The old card reads `useDailyRegimeBrief()` in the legacy dashboards only: mobile `src/components/Dashboard/CommandDashboard.jsx:148` and desktop `src/components/Dashboard/desktop/ReadColumn.jsx:32` (both V). Those render only when the hub is off (V `pickDashboardShell.js:66`) or the hub's chunk fails to load (A). **So with `COMMAND_CENTER_HUB_ENABLED = true` no player sees the old card today.** The hub shows its own brief section with no flag (A — helper: `CommandCenterHub.jsx:692`, desktop order `composition.js:118`), and the Huddle (the spoken brief) is the named-cohort feature above. To remove the old card for good is a code deletion, not a flip; the hub flag is its only switch (turning the hub off would bring it back).

#### Forge

See Part C (§5).

### 3.2 Environment variables that gate a feature — all **founder to confirm in Vercel**

| Variable | Read at (V) | Unset means | Gates | Player-visible? |
|---|---|---|---|---|
| `COCKPIT_ALLOWLIST_UIDS` | `api/_utils/callRecords/allowlist.js:28`, `:47-53` | nobody | everything in §4.2 | yes |
| `HUDDLE_PLAYER_UIDS` | `api/_utils/huddle/gate.js:25`, `:32-36` | nobody | the Huddle | yes |
| `HUDDLE_SHADOW_VOICE_ID` | `api/_utils/huddle/speech.js:27` | text-only Huddle (A) | the Huddle's voice | yes (audio) |
| `ELEVENLABS_API_KEY` | `speech.js:72`; `api/academy/generate-audio.js:154` | text-only Huddle; no academy audio (A) | voice synthesis | yes (audio) |
| `GCS_CREDENTIALS` | `api/_utils/huddle/audioStore.js:23`; `shadowLogger.js:25` | Huddle audio not stored → text-only (A) | audio storage, shadow log | yes (audio) |
| `MANDATE_FOUNDER_UIDS` | `api/_utils/practiceField/founderControls.js:66`; `api/mandate/create.js:30` | nobody | the founder's idea-book door; Mandate create (with `MANDATE_FOUNDER_CREATE_ENABLED = true`, `featureFlags.js:2006`) | no (founder tooling) |
| `BACKING_SMOKE_ENABLED`, `BACKING_SMOKE_UIDS` | `api/_utils/backingSmoke.js:51-52` | off | backing + eligibility on **preview deployments only** (A — helper: `:75-78` returns false outside preview) | no (production inert) |
| `VOICE_GROUNDING_CANARY_UIDS` | `src/config/featureFlags.js:2385` | nobody | read only at `VOICE_GROUNDING_MODE = 'canary'`; today `'shadow'` (V `:2331`) → **inert** | no |

### 3.3 Firestore control documents

| Document | Read at (V) | Today | Effect | Undo |
|---|---|---|---|---|
| `cockpitConfig/release` | `api/_utils/callRecords/release.js:59-60` | **founder to confirm** whether it exists | the cockpit's release cohort (§3.1 Cockpit) | `disabled: true`, ≤ 60 s on request paths |
| `stockThresholdControl/admission` | `api/_utils/stockThresholdPolicyRegistry.js:13`, `:25-33`; behind `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED = true` (`featureFlags.js:3523`) | **founder to confirm**; the Bomb mode doc says it was read `enabled`, audience `all` on 2026-11-11 (A — `researchModalFlags.js:40-42`) | measured thresholds on tiered full-day battle creation, for every owner (`{ mode: 'all' }`) or its own `ownerIds` list — **not** the cockpit list | disable the document, no deploy (V `featureFlags.js:3521`) |
| `masteryConfig/epochRegistry` | `api/_utils/masteryConfig.js:128-129` | dark: `MASTERY_XP_ENABLED = false` (`:41`), `MASTERY_SURFACE_ENABLED = false` (`:124`) | mastery XP and its surfaces | — |

### 3.4 Every other flag on `main`

Values are V (read at the line). "Player-facing" is taken from each flag's docstring and was **not traced** (A). None of these reads the cockpit list.

| Flag | `src/config/featureFlags.js` line | Value | What it is (its docstring's first line) | Kind (A) |
|---|---|---|---|---|
| `WATCH_LIST_RAIL_ENABLED` | 13 | `false` | Watch List rail on the Discover tab. | player-facing |
| `FORGE_HARDSOFT_AUTHORING_ENABLED` | 53 | `true` | Forge — authored per-rule Hard/Soft override (Phase 3). | Forge (see §5) |
| `FORGE_DESKTOP_ENABLED` | 65 | `true` | Forge — Desktop layout for the Forge workshop shell (ForgeWorkshop). | Forge (see §5) |
| `TRAITS_EXPLORATION_ENABLED` | 84 | `true` | Forge — Traits → Archetype Exploration surface (the '03 Traits' redesign). | Forge (see §5) |
| `RELEASE3_CHARACTER_TAB_ENABLED` | 103 | `true` | Release 3 — the Forge's '03 Traits' tab BECOMES '03 Character' (Character/Equip | Forge (see §5) |
| `TRAIT_SLOT_ENABLED` | 118 | `false` | Equip bench — the Traits loadout slot (mobile EquipStation + desktop | Forge (see §5) |
| `TOURNAMENT_TAB_ENABLED` | 130 | `true` | League — the provisional tournament tab occupying the retired Agent Hub's | player-facing |
| `LEAGUE_LOBBY_ENABLED` | 171 | `true` | League — the self-serve lobby (P10): registration · join/create · FIFO | League (unreachable once hidden) |
| `LEAGUE_REDESIGN_ENABLED` | 190 | `true` | League — the redesigned spectate-and-enter front end (the bracket-funnel | League (unreachable once hidden) |
| `LEAGUE_NEXT_ARC_ENABLED` | 213 | `true` | League — Next Arc (the second League slice). The "Altitude Climb" five-day | League (unreachable once hidden) |
| `LEAGUE_BATTLE_VIEW_V2_ENABLED` | 233 | `true` | League — Battle View V2 (the redesigned live battle hero + nine-star command | League (unreachable once hidden) |
| `LEAGUE_BATTLEVIEW_ROUTING_ENABLED` | 288 | `true` | League Battleview Routing (Spec V1.2, Phase A) — the Command Center live-game | League (unreachable once hidden) |
| `LEAGUE_LIVE_ORB_ENABLED` | 313 | `true` | League Battleview LIVE ORB (Phase B, Option X) — the whole live all-seats orb as | League (unreachable once hidden) |
| `LEAGUE_FUSE_HERO_ENABLED` | 356 | `true` | League — the FUSE HERO (Branch A): the battleview's top half becomes a fuse | League (unreachable once hidden) |
| `LEAGUE_TRAINING_CLIMB_PREVIEW_ENABLED` | 383 | `true` | League — Training-tab CLIMB PREVIEW (the second-arc re-entry surface). | League (unreachable once hidden) |
| `LEAGUE_CANONICAL_OPEN_CAPTURE` | 406 | `true` | League — user-layer CANONICAL-OPEN baseline capture. | League (unreachable once hidden) |
| `LEAGUE_SCORE_HISTORY_ENABLED` | 439 | `true` | League — SCORE HISTORY / recap (Level 1 per-day composite timeline + swap | League (unreachable once hidden) |
| `LEAGUE_LIVE_DRAFT` | 474 | `true` | League — Competitive Live Draft (slot lobbies). The interactive live draft | League (unreachable once hidden) |
| `TRAINING_BOARD_REDESIGN_ENABLED` | 495 | `true` | League Training — the redesigned Training Draft Board (the agent-fit spine). | League (unreachable once hidden) |
| `TRAINING_POD_DRAFT_V2_ENABLED` | 518 | `true` | League Training — Training Pod Draft V2 (the Draft Lobby & Awaiting-Open | League (unreachable once hidden) |
| `TRAINING_POD_DESKTOP_ENABLED` | 564 | `true` | League Training — Training Pod Draft V2, DESKTOP layout for the rebuilt | League (unreachable once hidden) |
| `AWAITING_OPEN_REDESIGN_ENABLED` | 601 | `true` | League Training — "Awaiting the Open" REDESIGN of the practice pod's | League (unreachable once hidden) |
| `PREOPEN_PHASE_ROUTING_ENABLED` | 659 | `false` | League — PRE-OPEN PHASE ROUTING (the awaiting surface during a battle day's | League (unreachable once hidden) |
| `CONFLICT_RECONCILER_DETECT_ENABLED` | 693 | `true` | Rule Conflict Reconciler — equip-time DETECTION (shadow-safe half). | player-facing |
| `CONFLICT_RECONCILER_INJECT_ENABLED` | 712 | `true` | Rule Conflict Reconciler — runtime INJECTION into the cognition prompts. | agent / server |
| `STANDING_LEANS_ENABLED` | 734 | `true` | Release 2 (Fenced Customization Bundle V1.1) — STANDING LEANS activation. | Forge (see §5) |
| `TEMPO_DIAL_ENABLED` | 754 | `true` | Release 2 (Fenced Customization Bundle V1.1) — TEMPO DIAL activation. | Forge (see §5) |
| `ARCHETYPE_INTEGRITY_MODE` | 801 | `'enforce'` | Archetype Integrity / "Third Path" — tri-state rollout mode. | agent / server |
| `DIRECTIVE_FIT_CHECK_ENABLED` | 918 | `false` | THE DIRECTIVE FIT CHECK — the voice files only what it says, and says only | agent / server |
| `SECTOR_CAP_MODE` | 970 | `'observe'` | Release 2 PR-e — the sector-SLOT rule: tri-state rollout mode. | agent / server |
| `RULE_COMPAT_MODE` | 997 | `'enforce'` | WS1 — Rule-library archetype scoping: tri-state rollout mode. | agent / server |
| `LEAGUE_TRAINING_POD_ENABLED` | 1006 | `true` | League — Desktop Training Pod tab + Active Training Game card (the desktop | League (unreachable once hidden) |
| `LEAGUE_AGENT_CHAT_ENABLED` | 1026 | `true` | League — Battle Arena "Ask your agent" two-way chat (see the League Agent | League (unreachable once hidden) |
| `SCOUTING_BOARD_ENABLED` | 1048 | `true` | Command Center — Scouting Board (the READ-section "See what it's eyeing" | player-facing |
| `CORRELATION_LAB_ENABLED` | 1068 | `true` | Correlation Lab — the Correlation Intelligence research surface | player-facing |
| `CORRELATION_RELATIONSHIP_QUALITY_ENABLED` | 1084 | `true` | Correlation Intelligence V3 Phase 1, Sub-build 1 — the "relationship-quality" | player-facing |
| `CORRELATION_SYNTHESIS_ENABLED` | 1109 | `true` | Correlation Intelligence V3 Phase 1, Sub-build 2 — the "synthesis + summary | player-facing |
| `CORRELATION_EXTENDED_DRIVERS_ENABLED` | 1137 | `true` | Correlation Intelligence V3 Phase 1, Sub-build 3 — the EXTENDED DRIVER TIER | player-facing |
| `CORRELATION_NARRATION_ENABLED` | 1164 | `true` | Correlation Intelligence V3 Phase 2 — THE NARRATED LAB: the deep-dive | player-facing |
| `LEARNING_L1_CAPTURE_ENABLED` | 1198 | `true` | Agent Learning System — L1 Foundation (Phase A) raw capture. | agent / server |
| `LEARNING_L1_CAPTURE_EXPANSION_ENABLED` | 1218 | `true` | Corpus Capture Patch W2 — L1 capture EXPANSION to the three swap classes | agent / server |
| `REGIME_STAMP_ENABLED` | 1237 | `true` | Corpus Capture Patch W3 — write-once 'regimeAtStart' stamp on agentBattles | agent / server |
| `OPENER_LAZY_FALLBACK_ENABLED` | 1265 | `true` | BaggerBomb opener — lazy regeneration + template floor. | player-facing |
| `TOURNAMENT_ADVANCEMENT_FROZEN` | 1291 | `false` | League Tournament — advancement freeze, UNFROZEN 2026-08-07 (was an emergency | League (unreachable once hidden) |
| `WEEKLY_LADDER_PLACEMENT_ENABLED` | 1350 | `false` | Weekly Ladder — placement points on the MONTHLY board (20260831_WEEKLY_LADDER_ | League (unreachable once hidden) |
| `AGENT_PRESENCE_ENABLED` | 1369 | `true` | Agent Presence — the reactive agent FACE (expression rig + mood baseline + event | player-facing |
| `MATCHUPS_BACKDROP_ENABLED` | 1394 | `true` | Matchups Backdrop — ports the PvP view's animated particle/constellation | player-facing |
| `POD_EXPIRY_SWEEP_ENABLED` | 1427 | `false` | Training-Pod P0 R3 — the rolling stale-pod expiry backstop. Server-only; gates | League (unreachable once hidden) |
| `COMPILER_ENABLED` | 1459 | `false` | Archetype Architecture Phase 2 (P2.4a) — the equip-time build compiler | agent / server |
| `MANIFEST_WRITE_ENABLED` | 1481 | `true` | Archetype Architecture Phase 2 (P2.5, §7-signed fence contact) — the | agent / server |
| `SHADOW_ASSEMBLY_ENABLED` | 1520 | `false` | Archetype Architecture Phase 2 (P2.6) — tick-side shadow assembly + | agent / server |
| `DEPLOY_CEREMONY_ENABLED` | 1541 | `true` | Deploy Ceremony Phase 2 (client) — the three-act deploy experience: | player-facing |
| `WIRE_METRICS_ENABLED` | 1572 | `true` | Wire timing instrumentation ONLY — per-seam duration samples into the | agent / server |
| `WIRE_WRITES_ENABLED` | 1593 | `true` | The Wire writes machinery: cloned extended tool schema + agentFacts prompt | agent / server |
| `CONTINUITY_MEMORY_ENABLED` | 1602 | `false` | Continuity prompt block ONLY (reporter's recent Wire digests + eventTypes | agent / server |
| `WIRE_NEWSLINE_ENABLED` | 1620 | `false` | Phase 2 N1 — Gemma's voiceLayerCache newsLine (Spec V1.2 N1, V1.5 R4-M2). | agent / server |
| `EDITORIAL_REVIEW_ENABLED` | 1639 | `false` | Phase 2 N3 — the weekly Wire editorial review (Spec V1.2 N3, D-P2-12). | agent / server |
| `EXA_RETRIEVAL_ENABLED` | 1657 | `true` | Alex Catalyst Confirmation mini-arc (spec V1.1) — F2 EXA supplementary | agent / server |
| `EVAL_IDENTITY_BLOCK_ENABLED` | 1680 | `true` | Archetype Architecture Phase 3 — the DR-13 eval-time archetype identity | agent / server |
| `SWAP_MOTIVE_DISPLAY_ENABLED` | 1691 | `false` | Swap Motive Observability (Tier 1) — the Film Room per-swap reason display. | player-facing |
| `FUNDAMENTAL_MIRROR_ENABLED` | 1726 | `true` | Fundamental Wire arc (Jul 25 2026 founder rulings D1–D7) — the peerRankings→ | agent / server |
| `STARFIELD_BACKGROUND_ENABLED` | 1756 | `true` | Delight Layer Task 2 — the BATTLE-WEATHER STARFIELD on the DESKTOP dashboard | player-facing |
| `STARFIELD_MOBILE_ENABLED` | 1803 | `true` | Delight Layer Task 2, Amendment A — the starfield on the MOBILE dashboard. | player-facing |
| `DEPLOY_SKY_COUPLING_ENABLED` | 1894 | `true` | Delight Layer Task 4 — the SIGNATURE DEPLOY (hold-to-deploy sky coupling). | player-facing |
| `COMPOSITION_DISPLAY_ENABLED` | 1932 | `false` | D2 display: candidate greyed-with-reason on the compat copy surfaces | player-facing |
| `MANAGED_MANDATE_ENABLED` | 1956 | `true` | MASTER gate for The Mandate. TRUE (lit) since PR #759, merged 14 Aug 2026 | agent / server |
| `MANDATE_EVAL_ENABLED` | 1967 | `true` | The scheduled evaluation loop (§3.1). TRUE (lit) since PR #759, merged | agent / server |
| `MANDATE_CLOSE_ENABLED` | 1977 | `true` | The authoritative daily close pass (§3.6). TRUE (lit) since PR #759, merged | agent / server |
| `MANDATE_ROLLOVER_ENABLED` | 1985 | `false` | The rolling per-user rollover sweep (§5.3). When FALSE (DEFAULT), no book | agent / server |
| `MANDATE_DORMANCY_DOWNSHIFT_ENABLED` | 1993 | `false` | Dormancy downshift (§6.5 / D-21). When FALSE (DEFAULT), no downshift derives. | agent / server |
| `MANDATE_TRANSPORT_MODE` | 2015 | `'direct'` | Transport mode for mandate model calls (§3.3). 'direct' (DEFAULT, safest) or | agent / server |
| `PROFIT_TARGET_EXECUTOR_ENABLED` | 2032 | `true` | Exit-Behavior Rebalance Tier 2, Ask 3 — the profitTarget deterministic | agent / server |
| `METRIC_HISTORY_SNAPSHOT_ENABLED` | 2047 | `true` | Metric History Snapshot Substrate (EXA_RETRIEVAL_INTEGRATION_SPEC_V1_4 §6.0 — | agent / server |
| `ARCHETYPE_VECTORS_V2_ENABLED` | 2102 | `false` | Archetype Rank Interface V2 (docs/specs/ARCHETYPE_RANK_INTERFACE_V2_BUILD_SPEC_V1_3.md). | player-facing |
| `ARCHETYPE_REFRESH_MENU_ENABLED` | 2114 | `false` | BaggerBomb archetype hot-bench membership. DARK — default FALSE. | agent / server |
| `EQUIPPED_RULE_PRECEDENCE_ENABLED` | 2164 | `false` | Exit-Behavior Rebalance Tier 2, Ask 2 (rescoped) — equipped-rule precedence | agent / server |
| `TICK_STAMPS_ENABLED` | 2432 | `true` | Phase B — THE TICK STAMPS (docs/design/PHASE_B_TICK_STAMPS_SPEC_V1.md §1; | player-facing |
| `SHOW_IT_ENABLED` | 2480 | `false` | PHASE C — SHOW IT (spec V1 §6 / V1.1 ruling 4, ledger D-116 → D-122). | player-facing |
| `ELIGIBILITY_ATTESTATION_ENABLED` | 2548 | `false` | BACKING BETA — PR 0: ELIGIBILITY ATTESTATION (spec V1.3 §5 / §6 / §8 / §12 | player-facing |
| `BACKING_BETA_ENABLED` | 2611 | `false` | BACKING BETA — PR 1–5: THE BACKING LAYER (spec V1.3 §0, §2, §4, §12; the | player-facing |
| `ANTICIPATION_THRESHOLD_LINT_MODE` | 2648 | `'off'` | THE THRESHOLD LINT — no promise on a signal the tick did not hold | agent / server |
| `INTRADAY_COLLECT_ENABLED` | 2672 | `true` | INTRADAY DATA — BUILD 1 (contract docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md | agent / server |
| `INTRADAY_DIAGNOSTIC_ENABLED` | 2690 | `false` | INTRADAY_DIAGNOSTIC_ENABLED — the evaluator reads intradaySnapshots/latest | agent / server |
| `INTRADAY_AGENT_USE_ENABLED` | 2701 | `false` | INTRADAY_AGENT_USE_ENABLED — STAGE 2 (deferred): the agent's decision may | agent / server |
| `INTRADAY_PRICE_SOURCE` | 2713 | `'legacy'` | INTRADAY_PRICE_SOURCE — STAGE 3 (deferred): 'legacy' (today's | agent / server |
| `INTRADAY_RISK_ACTIVATION_ENABLED` | 2727 | `false` | INTRADAY_RISK_ACTIVATION_ENABLED — STAGE 4 (deferred): the risk layer may | agent / server |
| `TICK_CAPTURE_ENABLED` | 2777 | `true` | TICK CAPTURE — the per-check observation record (spec | agent / server |
| `EVAL_DEFERRED_BEAT_ENABLED` | 2838 | `false` | EVAL-CRON INSTRUMENTATION — the deferred beat (build report | agent / server |
| `RESPONSE_FORK_ATTRIBUTION_ENABLED` | 3003 | `false` | RESPONSE_FORK_ATTRIBUTION_ENABLED — the dormant response-fork hook (Build 1a | agent / server |
| `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED` | 3230 | `false` | SHADOW VERSUS CPU — QUOTE INTEGRITY (contract | agent / server |
| `DIALOGUE_SERVER_PARSE_ENABLED` | 3376 | `true` | DIALOGUE_SERVER_PARSE_ENABLED — Pilot P1c, THE PARSE BINDING (pilot spec | agent / server |
| `PILOT_JOURNEY_MODE` | 3408 | `'off'` | PILOT_JOURNEY_MODE — the pilot's journey flag (spec §10.1), a STRING | player-facing |
| `SWAP_IDENTITY_MODE` | 3452 | `'enforce'` | SWAP_IDENTITY_MODE — Pilot P6, the swap identity check (G01; pilot spec | agent / server |
| `CRYPTO_SLOT_PROMPT_ENABLED` | 3512 | `true` | CRYPTO_SLOT_PROMPT_ENABLED — the Crypto Slot paragraph (Fable build prompt, | agent / server |


Flags outside `featureFlags.js` (V the line and value; kind A):

| Flag | Where | Value | Kind |
|---|---|---|---|
| `SETUP_EVIDENCE_SWEEP_ENABLED` | `src/config/setupEvidenceSweepFlags.js:32` | `true` | agent / server (the chart-evidence sweep cron) |
| `ACTIVATION_EVIDENCE_ENABLED` | `src/config/activationEvidenceFlags.js:36` | `true` | server — reads **the list** (§4.2 B11) |
| `SETUP_MENU_LABELS_ENABLED` | `src/config/setupMenuLabelsFlags.js:31` | `false` | server — reads **the list** (§4.2 B12) |
| `COMPOSITION_ENFORCEMENT_MODE` | `api/_utils/compositionConfig.js:26` | `'off'` | agent / server |
| `COMPOSITION_EPOCH_FENCE_ENABLED` | `compositionConfig.js:43` | `true` | agent / server |
| `COMPOSITION_MIGRATION_FEED_ENABLED` | `compositionConfig.js:58` | `false` | agent / server |
| `COMPOSITION_COMPILED_IDENTITY_ENABLED` | `compositionConfig.js:83` | `true` | agent / server |
| `MASTERY_XP_ENABLED` / `MASTERY_ENFORCEMENT_ENABLED` / `MASTERY_CUTOVER_GUARD_ENABLED` / `MASTERY_SURFACE_ENABLED` | `api/_utils/masteryConfig.js:41`, `:108`, `:115`, `:124` | all `false` | mastery (dark; `MASTERY_SURFACE_ENABLED` is its player surface) |
| `HELD_TIER_ENABLED` | `api/_utils/intradayConfig.js:13` | `true` | agent / server |
| `TOURNAMENT_DEPLOY_ENABLED` | `api/_utils/tournamentOrchestrator.js:120` | `true` | League (server) |
| `LAUNCH_EXECUTION_MODE` | `api/_utils/executionAuthority.js:25` | `'autopilot'` | agent / server |
| `AGENT_BATTLE_DURATION_MODE` | `api/_utils/agentBattleService.js:41` (fenced file — read only) | `'fullday'` | battle length |
| `TEST_MODE` | `src/services/battleTimer.js:13` | `true` ("1-day battles for user testing") | client timer; see §6 F-6 |
| `DRAFT_MODE` | `src/data/archetypeRuleCompatibility.js:63` | `false` | data module |

### 3.5 Web-address doors

Some flags have a query-parameter override that any visitor can type (V the line; effect A):

| Parameter | Read at (V) | What it does (A unless noted) | Closed by the League hide? |
|---|---|---|---|
| `?preOpenPhase=1` | `src/config/featureFlags.js:666-673` | turns on `PREOPEN_PHASE_ROUTING_ENABLED` (a `false` flag) for that visitor — V, the accessor returns true on the parameter | not by its own line (League surface) |
| `?tournamentDev=1` | `src/App.jsx:2247` | opens the `tournamentDev` screen | yes (V `:2246` returns first) |
| `?preview=baggerbomb` | `src/App.jsx:2257` | opens a BaggerBomb redesign preview against an inline mock battle — "Throwaway: no flag" (V comment `:2252-2256`) | no |
| `?correlationDev=1` | `src/App.jsx:2267` | the Correlation Lab dev surface | no |
| `?labGroup=…` | `src/App.jsx:2280` | not traced | not traced |
| `?trainingDraft=…`, `?trainingBattle=…` | `src/App.jsx:2292`, `:2307` | League training doors | yes (V `:2291`, `:2306`) |
| `?agentFormLab=1` | `src/App.jsx:10313` | only while `AGENT_FORM_LAB_ENABLED` is `true` (it is `false`) — V | n/a |
| `?forgeDesktop`, `?traitsExploration` | `ForgeWorkshop.jsx:56`, `TraitsArea.jsx:101` | force a Forge layout / the (unreachable) Traits area | no |
| `?leagueRouting`, `?leagueLiveOrb`, `?leagueScoreHistory`, `?trainingPodDesktop`, `?awaitingOpenRedesign`, `?agentPresence`, `?matchupsBackdrop`, `?deployCeremony`, `?starfield`, `?starfieldMobile`, `?deploySkyCoupling` | `featureFlags.js:290`, `:315`, `:448`, `:575`, `:612`, `:1380`, `:1405`, `:1554`, `:1767`, `:1813`, `:1913` | each ORs onto a flag that is already `true` — no effect today | — |

## 4. Part B — the shared founder + FT_QA list

### 4.1 The list

**`COCKPIT_ALLOWLIST_UIDS`**, a Vercel environment variable, comma-separated (V `api/_utils/callRecords/allowlist.js:28`, parsed at `:36-39`, read at call time at `:47-53`). Unset, empty or whitespace means **nobody**. There is **no wildcard**: no value means "everyone" (`parseCockpitAllowlist` splits, trims and drops empties, nothing else — V `:38`). It is server-only; no file under `src/` imports it (V header `:23-25`). The flag docstrings name its members as "the founder and FT_QA" (V `src/config/researchModalFlags.js:38-39`, `featureFlags.js` FILM_ROOM_CARDS_MODE doc). Its value is **founder to confirm in Vercel** (set / not set; the docs imply 2 entries — A).

A change takes effect **only after a production redeploy**: Vercel gives a deployment the environment it was built with (V `allowlist.js:17-21`). The cockpit readiness report measured commit-to-live at 8.3–13.7 min, median 9.1 (A — `docs/audits/20261110_COCKPIT_RELEASE_READINESS.md` G12, not re-measured).

The client never holds the list. It asks `GET /api/agent/cockpit-status`, which answers `allowlisted` = the list alone for the caller's own battle (V `api/agent/cockpit-status.js:114`), and caches one verdict per owner per page life (V `src/utils/filmRoomGate.js:33`, `:102`, `:116`). Every client-side "allowlist" mode below reads that one cached verdict.

### 4.2 Every feature the list gates

Two kinds of reader: **mode readers** (the feature has its own `'on'`, so it can be opened alone) and **direct readers** (the feature has no "everyone" setting; it can be widened only by widening the list, or by a code change).

| # | Feature | Gate (`file:line`) | Flag today | Reads the list via | Open on its own today? |
|---|---|---|---|---|---|
| B1 | **Cockpit** (call records: calls block, answer route, cockpit tiles) | `api/_utils/callRecords/mode.js:89-99` (V) | `CALL_RECORDS_MODE = 'on'` (`featureFlags.js:2965`, V) | `isCockpitOwnerAllowlisted` `mode.js:73-80` (V) | **Yes, by its own release switch** — the `cockpitConfig/release` document (§3.3), which adds a share of BaggerBomb agent-mode owners without touching the list. League battles stay list-only (V `release.js` cohort test, header `:25-33`). |
| B2 | **Film Room cards** | client `filmRoomGate.js:189-210`; server `api/_utils/filmRoom/cardsGate.js:48-53` (V) | `FILM_ROOM_CARDS_MODE = 'allowlist'` (`featureFlags.js:3632`, V) | the cached verdict; server `isCockpitOwnerAllowlisted` (V) | **Yes** — one line to `'on'` + its pin. |
| B3 | **Film Room v2 screen** | `filmRoomGate.js:145-166` (V) | `FILM_ROOM_V2_MODE = 'on'` (`:3177`, V) | only at `'allowlist'` | Already open — the list does not matter at `'on'`. |
| B4 | **Bomb mode** (research modal, in battle) | `src/components/Research/BombMode/bombModeGate.js:42-46` (V) | `RESEARCH_MODAL_BOMB_MODE = 'on'` (`researchModalFlags.js:61`, V) | only at `'allowlist'` | Already open. |
| B5 | **Research shell / sheet** (two-view modal, Analysis lens) and its **Ask** | client `src/components/Research/Sheet/sheetMode.js:51-56` `sheetModeOn` (V); server Ask `api/_utils/researchAsk.js:109-116` (V) | `RESEARCH_MODAL_SHEET_MODE = 'allowlist'` (`researchModalFlags.js:122`, V) | cached verdict; server `isCockpitOwnerAllowlisted` (V) | **Yes** — one line to `'on'` (opens it on every mount, browse included). |
| B6 | **Battle Research** | `battleResearchMode.js:45-47` (V); route `api/agent/battle-research-quotes.js:141` (V) | `BATTLE_RESEARCH_MODE = 'allowlist'` (`researchModalFlags.js:169`, V) | cached verdict; server `isCockpitOwnerAllowlisted` (V) | **Not alone.** It also needs the shell on and the cockpit on for that battle (`battleResearchAvailable`, V `battleResearchMode.js:45-47`; `AgentBattleScreen.jsx:2611`, `:2630`, V). So it needs B5 `'on'` and the player in B1's cohort. |
| B7 | **Chart read** (the Chart view's setup read) | route `api/research/setup-read.js:78` (V) | `CHART_READ_MODE = 'allowlist'` (`researchModalFlags.js:217`, V) | server `isCockpitOwnerAllowlisted(uid)` (V) | **Not alone.** The Chart view asks only where the shell is on (`AssetResearchModal.jsx:587`, V), so it needs B5 `'on'` as well. |
| B8 | **Shared Research — "Work an idea"** (hub door + sheet + thesis builder) | `api/_utils/sharedResearch/gate.js:93-101` (V) | `SHARED_RESEARCH_MODE = 'allowlist'` (`sharedResearchFlags.js:50`, V); builder `'on'` (`:77`, V) | `isCockpitOwnerAllowlisted` **and** B9 (V `gate.js:97-98`) | **No.** Even at `'on'` the gate requires `hypothesisRecordsOnFor(uid)`, which is the list (B9). The flag's own doc says `'on'` waits for "the framework's idea-record admission change (spec §11.3)" (V `sharedResearchFlags.js:36-41`). Today it can be widened only by widening the list. |
| B9 | **Idea records** (the Forge watchlist's Idea panel, idea versions, the review pass, idea carriage into a battle, the screener's record) | `api/_utils/hypothesisRecords/gate.js:53-55` (V) | `HYPOTHESIS_RECORDS_ENABLED = true` (`featureFlags.js:3314`, V) | `readCockpitAllowlist` directly (V `gate.js:28-35`) | **No "everyone" setting.** A boolean flag AND the list. Readers: `api/forge/watchlists.js:208,341,455`, `watchlist-dialogue.js:853`, `watchlist-dialogue-abandon.js:95`, `watchlist-analysis.js:328`, `api/screener/chat.js:164`, `hypothesisRecords/carriage.js:271`, `http.js:32-38`, `reviewPass.js:392,447` (all V by grep). Opening needs a code change (an `'on'` arm). |
| B10 | **Idea book** (Practice Field) at `'allowlist'` | `api/_utils/practiceField/mode.js:42-48` (V) | `PRACTICE_FIELD_MODE = 'off'` (`practiceFieldFlags.js:33`, V) | `readCockpitAllowlist` (V `mode.js:46`) | Has its own `'on'`; but see §3.1 row "Idea book" — there is no player screen. |
| B11 | **Activation evidence** (data capture: one activation pointer per holding lifetime of list owners' Trend Follower battles; nothing shown) | `api/_utils/activationEvidence/gate.js:25-38` (V) | `ACTIVATION_EVIDENCE_ENABLED = true` (`activationEvidenceFlags.js:36`, V) | `readCockpitAllowlist` directly (V) | No "everyone" setting. **Widens with the list** — every name added starts these writes. |
| B12 | **Setup menu labels** (data on each tick's record; the agent never sees a label) | `api/_utils/setupMenuLabels/gate.js:23-37` (V) | `SETUP_MENU_LABELS_ENABLED = false` (`setupMenuLabelsFlags.js:31`, V) | `readCockpitAllowlist` directly (V) | Dark today; would widen with the list once flipped. |
| B13 | **Knowledge-base method audience** (`'allowlist'` audience) | `api/_utils/kb/audience.js:31-37` (V) | — | `isCockpitOwnerAllowlisted` (V) | Moot today: no method is authorized for app use (`KB_APP_USE = []`, V `api/_utils/kb/authorizations.js:40`). |

### 4.3 What this means for the flips

- **Widening the list is not a staging tool.** Adding a player turns on B2, B5, B6, B7, B8, B9, B11 (and B10, B12 once their flags move) for that player in one redeploy. The data-capture readers (B9 review pass, B11, B12) cost reads and writes per added owner.
- **Opening the cockpit in stages does not stage its neighbours.** The release cohort (B1) answers `on`, but `allowlisted` stays the list alone (V `cockpit-status.js:113-114`), so a cohort player gets the cockpit and **not** cards, the shell, Battle Research or the chart read. Battle Research (B6) additionally needs the shell.
- **"Everyone" can never be expressed through the list.** Each feature opens through its own mode, or (B8, B9, B11, B12) through a code change.

## 5. Part C — the Forge

### 5.1 The two battles are one battle type

- **Every BaggerBomb deploy now runs on the casual clone.** With per-game loadouts on, a deploy with no clone is refused (V `src/services/agentDeploy.js:253`).
- **The clone's battle is a tiered battle.** `decide.js` creates it with no game mode (V `api/agent/decide.js:964`), and `createAgentBattle` falls back to `TIERED_GAME_MODE` (V `api/_utils/agentBattleService.js:93` `const gameMode = options.gameMode || TIERED_GAME_MODE;`). So "the casual BaggerBomb clone" and "the tiered battle" are the same `baggerbomb_agent` battle and **share every read site below**.
- **What differs is which agent document holds the settings.**
  - The Forge edits the **ranked** agent, never a clone (V `src/services/agentService.js:29`).
  - The ranked agent's settings reach the clone only when the clone is refreshed at the next deploy, and **only while the clone has no live battle** (V `api/_utils/casualClone.js:250`).
  - The refresh copies the rules and bundles (V `casualClone.js:255` → `api/_utils/trainingClone.js:175`), and the list, the leans and the dials (V `trainingClone.js:75`, `:88`, `:90`).
  - The BaggerBomb loadout slot then sets the clone's archetype and list (V `api/_utils/perGameLoadout.js:97`).

### 5.2 Each section a player can open today

The Forge is `ForgeWorkshop`, with four tabs (V `src/components/Forge/workshop/ForgeWorkshop.jsx:109-112`). Tab 03 is "Character" because `RELEASE3_CHARACTER_TAB_ENABLED = true` (V `featureFlags.js:103`; branch V `ForgeWorkshop.jsx:154`). No tab has a switch of its own.

| Section (as the player sees it) | Shown by | Saves to | Read in the battle (both battles: same reads) | Casual clone | Verdict |
|---|---|---|---|---|---|
| **00 Forge** (overview) | always | nothing — it only navigates (A — helper, `ForgeOverview.jsx:127`) | — | — | **does not** (no settings) |
| **01 Lists** — create, edit and commit a list (name, thesis, tickers) | always | `watchlists/{id}` (A — helper, `api/forge/watchlists/[id].js:85`, `commit.js:119`) | the equipped, **committed** list: V `decide.js:384`, V `api/_utils/watchlistEquip.js:54` (`status !== 'committed'` → none); the list and thesis enter the deploy prompt (A — helper, `agentPromptAssembly.js:136-141`); the bench refresh reads the battle's list (V `agent-evaluate.js:1724`) | the slot's list (V `perGameLoadout.js:97`) | **reaches battles** — once committed and equipped. Equipping happens on the hub or the BaggerBomb loadout, not in the Forge (V `WatchlistListPanel.jsx:118`). |
| 01 Lists → **Idea panel** | `HYPOTHESIS_RECORDS_ENABLED` + **the list** (§4.2 B9) | idea versions on the list | frozen onto the battle document (A — helper, `agentBattleService.js:217`), but **no trading prompt reads it**: 0 hits for `equippedHypothesis` in `agent-evaluate.js`, `agentEvalPromptAssembly.js` and `agentPromptAssembly.js` (V grep) | — | **does not** reach the agent (and only list players see it) |
| 01 Lists → notes, the Analysis chat, Discover | always | the list's notes, `analysisSessions`, `discoverInteractions` (A — helper) | no read found in `decide.js`, `agent-evaluate.js`, either prompt assembler, `agentBattleService.js` or `agentGuardrails.js` (A — helper greps) | — | **does not** |
| **02 Rules** — bundles, the starter kit, "Make ready" | always | `agents/{id}/rules`, `agents/{id}/bundles` (A — helper, `forgeService.js:184`, `:335`) | V `decide.js:260` (`projectActiveRules`); the deploy prompt "FORGE RULES" (V `agentPromptAssembly.js:131`); every check (V `agentEvalPromptAssembly.js:782`) | copied (V `trainingClone.js:175`) | **reaches battles**. Every rule in any non-archived bundle reaches the next deploy, drafts included (A — helper, `projectActiveRules.js:77`). |
| 02 Rules → **Hard / Soft** toggle | `FORGE_HARDSOFT_AUTHORING_ENABLED = true` (V `featureFlags.js:53`) | `bundles/{id}.ruleHardness` | sorts a rule into "must obey" or "should follow" (V `agentEvalPromptAssembly.js:787` `activeRules.filter(isHardRule)`) | copied with the bundles | **reaches battles** |
| **03 Character** → "How it decides", "Born with" | `RELEASE3_CHARACTER_TAB_ENABLED = true` | nothing (display, "READ-ONLY") (A — helper, `CharacterArea.jsx:270`, `:275`) | — | — | **does not** (no settings) |
| 03 Character → **Tempo** | `TEMPO_DIAL_ENABLED = true` (V `featureFlags.js:754`) | `agents/{id}.dials.tempo` | snapshotted at creation (V `agentBattleService.js:239`); clamps the check's rotation (V `agent-evaluate.js:2052` `desiredTempo: desiredTempoOf(battle)`) | copied (V `trainingClone.js:90`) | **reaches battles** (in code; the model is not told — A) |
| 03 Character → **Standing leans** | `STANDING_LEANS_ENABLED = true` (V `featureFlags.js:734`) | `agents/{id}.standingLeans` | in every check's live context (V `agentEvalPromptAssembly.js:1241`) | copied (V `trainingClone.js:88`), but **dropped** when the BaggerBomb slot's archetype has no such lean (V `api/_utils/leanRevalidation.js:150-151`) | **reaches battles** — on the clone, only when the slot's archetype matches |
| 03 Character → **Explore** (roster browser) | same | nothing (A — helper, `CharacterArea.jsx:75`) | — | — | **does not** (no settings) |

Flags that create no section (A — helper):
- `TRAITS_EXPLORATION_ENABLED` (`:84`, `true`) is moot: its Traits area is unreachable behind the Character branch.
- `TRAIT_SLOT_ENABLED` (`:118`, `false`) is read on the hub's equip bench, not in the Forge.
- `FORGE_DESKTOP_ENABLED` (`:65`, `true`) is layout only.
- `agentGuardrails.js` reads none of these settings.

### 5.3 What the founder's ruling needs

**Reach battles:**
- **01 Lists** (the list, committed and equipped).
- **02 Rules**, including Hard/Soft.
- **03 Character**, but only Tempo and Standing leans.

**Do not reach:**
- the **00 overview**;
- Character's **"How it decides"**, **"Born with"** and **Explore**;
- the Lists' **Idea panel**, **notes**, **Analysis chat** and **Discover**.

**There is no switch per section.** Showing only the sections that reach battles is a **small code change** to the tab list (`ForgeWorkshop.jsx:109-112`) and the Character and Lists panes, not a flip. `RELEASE3_CHARACTER_TAB_ENABLED = false` would not hide tab 03; it would bring back the old Traits tab (V `:112` label ternary).

**Two questions for the founder:**
1. Does "only the sections that reach battles" also hide display-only panes (the overview, "How it decides", "Born with", Explore), or only sections that save something a battle never reads (notes, the Analysis chat, Discover, the Idea panel)?
2. Should the Forge say that an edit reaches the casual clone only at the next deploy, after any live game ends (`casualClone.js:250`)?

## 6. Found outside the task

Reported for separate tasking; nothing was fixed (BUILD_RULES §3).

- **F-1 — Some web-address doors work in production (§3.5).**
  - `?preOpenPhase=1` turns a dark League flag on for whoever types it (V `featureFlags.js:666-673`).
  - `?preview=baggerbomb` opens a mock-battle preview screen with no flag (V `App.jsx:2252-2257`).
  - `?correlationDev=1` opens a dev surface (V `App.jsx:2267`).
  - The League hide closes three of these doors. The others stay open. Whether any of them matters for a public beta is not traced (A).
- **F-2 — The "Work an idea" door would fail at `'on'`.** Flipping `SHARED_RESEARCH_MODE` to `'on'` without the idea-record admission change would show the hub door to every player (V `useHubResearchAdmission.js:59`), while the server refuses everyone off the list (V `sharedResearch/gate.js:93-99`). Only the flag's runway prose prevents this. No test pins the pairing (A — not searched for).
- **F-3 — Rules and an index on `main` are newer than the last deploy this repo records.**
  - The last recorded production rules and index deploy is 2026-11-15, from `0b720acc` (A — `sharedResearchFlags.js:38-39`).
  - Since then, `main` adds:
    - 76 lines to `firestore.rules`: the idea-book owner reads, `setupEvidenceSweepState`, and the battles update rule from the security pack;
    - the `decisions.rationale` exemption in `firestore.indexes.json`.
  - V: `git diff --stat 0b720acc origin/main -- firestore.rules firestore.indexes.json` gives 80+/1−, from commits of #1077, #1078 and the chart-evidence sweep.
  - **Founder to confirm** whether these were deployed. The idea book's first step needs them.
- **F-4 — Secrets missing from `.env.example`.** It lists `HUDDLE_PLAYER_UIDS` and `HUDDLE_SHADOW_VOICE_ID`, but not `COCKPIT_ALLOWLIST_UIDS`, `MANDATE_FOUNDER_UIDS`, `ELEVENLABS_API_KEY` or `GCS_CREDENTIALS` (V — names counted only, no values read). A fresh environment would not know the gate variables exist.
- **F-5 — Edits to a running game wait for the next deploy.** A Forge edit made during a live BaggerBomb game reaches the casual clone only at the next deploy after that game ends (V `casualClone.js:250`). A standing lean is also dropped when the BaggerBomb slot's archetype has no such lean (V `leanRevalidation.js:150-151`). Whether the player is told either thing is not traced (A).
- **F-6 — A constant named for testing.** `TEST_MODE = true` in `src/services/battleTimer.js:13` is commented "1-day battles for user testing", but `DAY_DURATION` is 24 h either way (V `:18`). It looks like naming debt, not a live switch (A — `:397` not read).
- **F-7 — Unreachable onboarding pieces.** The spotlight tour is mounted, but nothing in `src/` opens it (V `App.jsx:2562`; no `setShowSpotlightTour(true)`).
- **F-8 — The quick-wins branches are stale.** `origin/perf/eodhd-quick-wins` and `origin/flip/eodhd-quick-wins` are 1,802 commits behind `main` (V). If the work is still wanted, it is a rebuild, not a merge.
- **F-9 — The idea panel does not reach the agent.** Its record is frozen onto each battle (A), but no trading prompt reads it (V grep, §5.2). The flag's own doc says "Nothing the agent sees or trades reads any of it" (V `featureFlags.js:3273`). If the founder expects an "idea" to steer the agent in the beta, it does not today.

## 7. Method and limits

**How the work was done**

- **Searches.** Flag constants (`_ENABLED`, `_MODE`) were grepped across `src/` and `api/` in all flag modules and elsewhere. Allowlists were found through `ALLOWLIST`, `_UIDS`, `COHORT` and `killSwitch`. Every `process.env` and `import.meta.env` read in non-test code was listed. Firestore control documents were found through the `*Config` collections and the code that reads them.
- **The shared list.** Traced from its one reader (`allowlist.js`) through every importer of `readCockpitAllowlist` and `isCockpitOwnerAllowlisted`, and through the client's cached verdict.
- **Delegated reading.** Three read-only search helpers each read one area: the Forge against the battle reads; the hub, the agent form, onboarding and the old brief card; the Huddle, the idea book and the tape writer. Each helper's load-bearing anchors were re-read in this session before use. Those are marked V. Claims taken from a helper without a re-read are marked A.
- **Git.** `git log`, `git merge-base --is-ancestor`, `git rev-list --left-right --count` and `git diff --stat` were used for PR state and branch distance.

**Not done**

- No test, build or lint run. Nothing was changed.
- No production read: no Vercel environment, no Firestore document, no deploy history.
- No screen was rendered. "Player-facing" in §3.4 comes from each flag's own docstring.

**Out-of-tree copy (BUILD_RULES §3).** A byte-exact copy of this report is kept outside the repo, in the session's scratch directory.
