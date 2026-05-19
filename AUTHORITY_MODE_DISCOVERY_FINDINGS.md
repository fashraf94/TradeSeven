# Authority Mode Discovery Findings

**Date:** 2026-05-19
**Branch:** Investigated the working tree at HEAD of `claude/investigate-authority-mode-nEk9Q` (the investigation branch). NOTE: this HEAD is **11 commits ahead of `origin/main`** — it includes merged Phase 5A/5B watchlist work not yet on `origin/main` (`origin/main` = `348e37c`). The task brief said "Branch: main"; I investigated the most recent code rather than an older `main` snapshot, and call out the divergence here for transparency. None of the authority-mode code below was touched by those 11 commits, so the findings hold for `main` as well.
**Commit SHA:** `2c513b69718df01b348c30f7c200877ff1d1faf1`
**Investigator:** Claude Code

## Executive summary

Authority mode **already exists and is substantially built** — the prompt's premise that "whether the underlying mode distinction already exists is unknown" resolves to a firm **yes**. There is a three-value `executionMode` field (`autopilot` | `copilot` | `manual`) on the `agentBattles` collection, and the server-side evaluation cron genuinely branches on it to route trades to immediate execution vs. a pending-proposal flow with TTL, expiry, and an approve/veto/lapse lifecycle. A full veto pipeline and 10/15-minute decision-window timers exist end-to-end. **The gap is not the engine — it is the wiring.** The live UI was archived: the mode toggle and the interactive approve/veto surfaces (`ExecutionModeToggle`, `ProposalCard`, `ProposalBanner`) are either rendered only in an archived file or imported-but-never-rendered. Net effect today: every battle is created in `copilot` mode, the mode can never be changed by a user, and pending proposals auto-execute on expiry with no UI to act on them.

## Q1: Does authority mode exist as a distinction?

**Yes — three modes, fully named, and the distinction materially changes agent behavior.**

The modes are `autopilot`, `copilot`, `manual`. Definition (`src/components/Agent/ExecutionModeToggle.jsx:6-10`):

```js
const MODES = [
  { key: 'autopilot', label: 'Autopilot', icon: Zap, desc: 'Agent trades freely. You\'ll see the results in the feed.' },
  { key: 'copilot', label: 'Co-Pilot', icon: Users, desc: 'Agent proposes trades for your approval. You have 10 minutes to respond.' },
  { key: 'manual', label: 'Manual', icon: Hand, desc: 'Agent suggests trades but waits for your explicit approval.' },
];
```

The feature is internally labelled **"Sprint 3"** (`api/_utils/agentBattleService.js:149` — `// Execution mode controls (Sprint 3)`).

The distinction is **not cosmetic** — it drives a real server-side branch in the evaluation cron `api/cron/agent-evaluate.js`. When the agent's LLM ("Haiku") decides to SWAP and validation passes (`agent-evaluate.js:962-1091`):

- **`autopilot`** (`:972-1019`) — executes the swap immediately via `executeSwapServer(...)` ("original behavior"). Silent execution.
- **`copilot` / `manual`** (`:1020-1089`) — does **not** execute. Instead writes a `pendingProposal` object and sets `decision = 'PROPOSAL'`. TTL is mode-dependent: `const ttlMinutes = mode === 'copilot' ? 10 : 15;` (`:1022`).

On proposal expiry (`handlePendingProposal`, `agent-evaluate.js:1385-1432`):

- **`copilot`** expiry → **auto-executes** the swap (`resolution: 'auto_executed'`, `resolvedBy: 'system'`).
- **`manual`** expiry → **lapses without executing** (`resolution: 'lapsed'`).

`handlePendingProposal` is genuinely invoked in the cron main loop (`agent-evaluate.js:703`), and the cron itself is live (scheduled in `vercel.json:134` — `*/15` during market hours, weekdays). `executeSwapServer` is a real implemented function (`api/_utils/agentSwapExecution.js:102`).

So all three modes are represented, and the distinction actively routes execution.

## Q2: Where does it live in the data model?

**Single field, single location: `executionMode` on the `agentBattles/{battleId}` document.**

- **Path:** `agentBattles/{battleId}.executionMode`
- **Type:** string
- **Allowed values:** `'autopilot' | 'copilot' | 'manual'`
- **Default:** `'copilot'` — hardcoded at battle creation (`api/_utils/agentBattleService.js:150`):

```js
// Execution mode controls (Sprint 3)
executionMode: 'copilot',       // 'autopilot' | 'copilot' | 'manual'
strategyPreset: 'balanced',     // 'aggressive' | 'balanced' | 'defensive' (Sprint 4)
pendingProposal: null,          // Set when Haiku proposes a swap in copilot/manual mode
proposalHistory: [],            // Resolved proposals (approved/vetoed/lapsed/auto_executed)
battleLedger: [],               // All user-agent interactions for Film Room review
```

**It is NOT on the `agents` collection** — `createAgent` (`src/services/agentService.js:92-134`) writes no mode field. **It is NOT on `users`.** Mode is strictly per-battle.

**It is NOT settable at deploy time.** `createAgentBattle` is called once, from `api/agent/decide.js:540`, with options `{ duration, sectorMap, opponent, equippedWatchlist }` — no `executionMode`. Every battle is therefore born `copilot`.

Related fields on the same battle document:
- `pendingProposal` — `null` or the active proposal object (created by the cron).
- `proposalHistory` — array of resolved proposals, capped at 50 (`agent-evaluate.js:1341`).
- `battleLedger` — array of user↔agent interactions, including `mode_change` entries.

Client-side default fallback is also `'copilot'` (`src/hooks/useAgentBattle.js:50` — `battle?.executionMode || 'copilot'`).

**Migration:** the cron backfills legacy battles missing these fields (`agent-evaluate.js:184-186`): `executionMode → 'copilot'`, `pendingProposal → null`, `proposalHistory → []`.

**Firestore rules** (`firestore.rules:200-211`) document and permit the model — the owner may update exactly these keys:

```
.hasOnly(['executionMode', 'pendingProposal', 'battleLedger', 'updatedAt',
          'strategyPreset', 'gameplanMeeting', 'gameplanMeetingHistory',
          'dailyGrades', 'feedBookmarks', 'reviewDecisions']);
```

So the data layer **fully permits** a client to change `executionMode` and resolve `pendingProposal`. Create/delete are denied to clients (the cron owns battle creation via the Admin SDK).

## Q3: What UX exposes it?

**The interactive UX is fully built as components but is NOT wired into the live app.** This is the central finding for Q3.

### Built and functional, but archived or unrendered

- **`src/components/Agent/ExecutionModeToggle.jsx`** — a complete, polished mode switcher (two variants: "pills" and "cards"; all three modes with icons, labels, descriptions, ACTIVE badge). On change it calls `updateExecutionMode(battleId, newMode)` and logs a `mode_change` entry to `battleLedger`. It operates on `battleId`, i.e. it is designed for **mid-battle** mode changes.
  - **Rendered only in `src/components/Agent/AgentStrategyTab.ARCHIVED.jsx:151`** — a file whose name marks it archived, and which **nothing imports** (confirmed: the only references to `AgentStrategyTab` are its own definition/export).
  - In the live screen `src/screens/AgentBattleScreen.jsx` it is **imported (line 16) but never rendered** — a dead import.
- **`updateExecutionMode`** (`src/services/agentService.js:396-402`) — the only function that writes `executionMode`. Its **only caller** is `ExecutionModeToggle.jsx:199`. Since the toggle is only in the archived tab, **in the live app there is no code path by which a user can change the mode.**
- **`src/components/Agent/ProposalBanner.jsx`** — a complete, polished co-pilot proposal surface: floating bottom banner, TTL progress bar, approve + veto buttons, canned veto reasons, a minimized draggable timer pill. Calls `resolveProposal(...)`.
  - **Imported into `AgentBattleScreen.jsx` (line 22) but never rendered** — a dead import.
- **`src/components/Agent/ProposalCard.jsx`** — an interactive approve/veto card (with a permanently-disabled "Modify — Coming soon" button at `:246-260`).
  - **Rendered only in `AgentStrategyTab.ARCHIVED.jsx:175`.**

### What is actually live

- The live `AgentBattleScreen.jsx` has three tabs only: `matchups`, `command`, `gametape` (`AgentBattleScreen.jsx:54`). There is **no "strategy" tab** — the archived `AgentStrategyTab` (which hosted the mode toggle + interactive proposal card + strategy-preset toggle + gameplan-meeting card) has been removed from the tab set.
- The `command` tab renders `<AgentChat>` (`AgentBattleScreen.jsx:905-937`).
- `AgentChat.jsx` shows `UnansweredProposalCard` (`:343`) — explicitly **"Informational only — no approve/veto buttons (the window is closed)"** (`:341-342`). Its text: *"You didn't respond to this proposal: … The agent held its position."* It renders only for proposals with `resolution === 'lapsed'` (`filterUnansweredProposals`, `AgentChat.jsx:16-18`).
- `AgentBattleScreen.jsx` passes `pendingProposal` to `<AgentChat>` (`:934`), but `AgentChat`'s props destructure (`AgentChat.jsx:394-410`) **does not include `pendingProposal`** — the prop is dropped on the floor.
- `pendingProposal` is used in `AgentBattleScreen.jsx` only to light an amber "command dot" indicator on the tab bar (`:676-679`).
- **`src/components/Agent/DeploymentCard.jsx:103`** displays the mode as a small read-only uppercase text label (e.g. `COPILOT`) on the deployment card. This is the **only live visual indication of mode anywhere in the app.**

### User-facing terminology

`Autopilot` / `Co-Pilot` / `Manual` (from `ExecutionModeToggle.jsx`, currently only reachable via archived code). The descriptions there are the closest thing to product copy: Autopilot = "Agent trades freely"; Co-Pilot = "proposes trades for your approval, 10 minutes to respond"; Manual = "suggests trades but waits for your explicit approval."

### Summary for Q3

The full interactive UX (set mode, see a live proposal, approve/veto with reasons, watch a countdown) exists as production-quality components. None of it is mounted in the live app. The live app exposes mode as a **read-only label** and pending proposals as a **retrospective, non-interactive note**.

## Q4: Veto pipeline status

**A complete veto pipeline exists end-to-end on the server and in the service layer; the interactive client trigger is built but not mounted.**

- **Server lifecycle** — `handlePendingProposal` (`agent-evaluate.js:1296-1442`) handles every resolution:
  - `approved` (`:1302`) → executes the swap, moves proposal to `proposalHistory`.
  - `vetoed` (`:1348`) → does not execute; enriches the record with `vetoedAtPrice`, `vetoedAtTimestamp`, `scoreAtVeto` (counterfactual data) and moves to history.
  - expiry → `auto_executed` (copilot) or `lapsed` (manual), `resolvedBy: 'system'`, with `scoreAtResolution`.
- **Client service** — `resolveProposal(battleId, proposal, resolution, userReason)` (`src/services/agentService.js:404-417`) writes the resolved `pendingProposal` with `resolution` (`'approved'` | `'vetoed'`), `resolvedBy: 'coach'`, and an optional `userReason`.
- **Veto UI** — approve/veto buttons plus canned veto-reason lists exist in **both** `ProposalCard.jsx` (`VETO_REASONS` at `:20-25`) and `ProposalBanner.jsx` (`VETO_REASONS` at `:12-16`). Neither component is rendered in the live app (see Q3), so **a user cannot currently veto, approve, or cancel a trade.**
- **Resolution taxonomy:** `approved`, `vetoed`, `auto_executed`, `lapsed`. Pending vs. immediately-executed states are explicitly modelled: a SWAP becomes a `'PROPOSAL'` decision in copilot/manual mode (`agent-evaluate.js:1087`).
- **Adjacent pipeline:** `gameplanMeeting` has a parallel approve/reject/expire flow — `resolveGameplanMeeting` (`agentService.js:443-457`) and a cron handler that the code itself notes "Mirrors `handlePendingProposal` pattern" (`agent-evaluate.js:1448`). It is a second veto-shaped pipeline and likely shares the same wiring fate.

So: nothing veto-shaped is missing from the engine. What is missing is the on-screen surface that lets the user trigger a veto/approve while a proposal is live.

## Q5: Timer infrastructure status

**Decision-window timers exist on both the server and the client and are directly reusable for co-pilot.**

- **Server-side decision window** — each proposal carries `createdAt` and `expiresAt` (`agent-evaluate.js:1058-1059`); the `agent-evaluate` cron (`vercel.json:134`, `*/15` during market hours weekdays) checks expiry every run via `handlePendingProposal` (`:1376-1383` "not expired → skip Haiku"; `:1385+` "expired → handle by mode"). This **is** a server-side wait-then-time-out mechanism. Effective resolution is the 15-minute cron cadence, so a 10-minute copilot TTL is acted on at the next cron tick.
- **TTL values** — copilot 10 min, manual 15 min (`agent-evaluate.js:1022`).
- **Client-side countdown** — live per-second countdowns exist in `ProposalBanner.jsx` (`TTL_TOTAL_MS = 10 * 60 * 1000`, amber at 3 min, red at 1 min — `:18-20`; `setInterval` countdown `:195-204`) and `ProposalCard.jsx` (`secondsLeft` countdown `:43-52`). Both components are unrendered live.
- **Reusable timer components elsewhere** — `src/components/earningsGame/shared/CountdownTimer.jsx`, `src/components/draft/HoloTimer.jsx`, and free-agency window infrastructure (`WindowStatus.jsx`, `WindowClosedOverlay.jsx`). These confirm the codebase has generic countdown UI patterns to draw on.

So the 5–10-minute decision window the product stance describes already exists as `proposal.expiresAt` + cron expiry handling. It is reusable as-is; no new timer infrastructure is required for co-pilot.

## Other relevant findings

- **Code contradicts the product stance on co-pilot expiry semantics.** The prompt's product stance says co-pilot, on no decision, "re-evaluates and self-vetoes." The code does the **opposite**: copilot expiry → `auto_executed` (silence = consent). Manual expiry → `lapsed` (silence = rejection — this half *does* match the stance). Per the brief, the codebase is authoritative; flagging the mismatch, not resolving it.
- **TTL mismatch.** Product stance says "5–10 minutes." Code uses copilot 10 min / manual 15 min.
- **Terminology drift.** `AgentChat.jsx:11` comment refers to a *"strategist mode"* that "writes `resolution='lapsed'`" — behaviourally this is `manual` mode, but the name doesn't match the `manual` used by the cron and UI. `manual` itself is presented as "Manual" in the toggle. Inconsistent vocabulary across the codebase.
- **Partial-migration smell.** `AgentBattleScreen.jsx` imports both `ExecutionModeToggle` and `ProposalBanner` and renders neither. `ProposalBanner` is a *newer* component than the archived tab's `ProposalCard` (the archived tab uses `ProposalCard`, not `ProposalBanner`). This reads as: someone began porting authority-mode UX into the new screen, built a fresh banner component for it, and stopped before wiring it. The dropped `pendingProposal` prop into `AgentChat` is consistent with a half-finished migration.
- **Net live behaviour today.** Every battle = `copilot`, mode unchangeable, no live approve/veto surface ⇒ every agent swap becomes a 10-minute `pendingProposal` that nobody can act on, which then **auto-executes** at the next cron tick. Functionally the live app behaves like *autopilot with a ~10–15-minute delay*. And `UnansweredProposalCard` (which only renders for `lapsed`) effectively **never appears**, because `lapsed` only occurs in `manual` mode and no battle ever reaches `manual` mode.
- **Analysis infrastructure already rides on modes.** Resolved proposals capture counterfactual price/score data ("Sprint 2 conviction analysis" — `agent-evaluate.js:1363`, `:1434`). `api/_utils/voiceLayerPrompt.js` has `detectTradeProvenance` distinguishing `autopilot` vs. copilot-approved trades for narration (`:1431-1603`), and `entryMode` is stamped onto trade records (`agent-evaluate.js:988`, `:1078`). The Voice Layer already reasons about mode provenance.
- **`battleLedger`** records `mode_change` events (`ExecutionModeToggle.jsx:200-203`) explicitly "for Film Room review" — the audit surface for mode changes is designed but, like the toggle, only reachable via archived code.

## Open questions / ambiguities

- **Why was `AgentStrategyTab` archived and the mode toggle dropped from the live UI?** Cannot be determined from code alone. It could be a deliberate product decision (consistent with the "V2 removed co-pilot/manual in favour of autopilot-only" history the prompt describes), or an incomplete refactor. *Resolving question:* check the PR that renamed `AgentStrategyTab.jsx → AgentStrategyTab.ARCHIVED.jsx` and any accompanying design note. (Git history in this clone is shallow/squashed enough that all of `ExecutionModeToggle.jsx`, `ProposalBanner.jsx`, and the archived file trace to a single merge commit, `ff504ee` / PR #366 — I could not reconstruct the precise sequencing.)
- **`ProposalBanner` vs. `ProposalCard` — which is the intended co-pilot surface?** Two distinct interactive proposal UIs exist. `ProposalBanner` is newer and is the one imported (unrendered) into the live screen; `ProposalCard` is the one actually wired, but only in archived code. Intent is ambiguous.
- **Is copilot's "auto-execute on expiry" intended?** It directly contradicts the product stance's "self-veto." Cannot tell from code whether this is a deliberate choice or a leftover from when copilot was the de-facto behaviour.
- **"strategist mode"** in `AgentChat.jsx` — is this a planned rename of `manual`, or a stale term? Unresolved.

## What this means (my honest read)

For the **data model and server engine, this is scenario (a) — a small plumbing rework on top of existing structure.** The hard parts are already built and live: the `executionMode` field, the three-way branch in the evaluation cron, the full proposal lifecycle (create → pending → approved/vetoed/expired → history), the 10/15-minute TTL with cron-driven expiry, the veto resolution pipeline, the Firestore rules that permit client writes, and migration backfill. "Mode-aware routing" on the backend largely already *is* the backend.

For the **client, it is scenario (b) — a medium re-wiring job, not a from-scratch build.** The interactive components (`ExecutionModeToggle`, `ProposalBanner`/`ProposalCard`, countdown timers, veto-reason flows) all exist and are production-quality; they need to be mounted into the live `AgentBattleScreen`, and a mode needs to become selectable (at deploy time and/or mid-battle). The dropped `pendingProposal` prop into `AgentChat` needs reconnecting. This is finishing-and-un-archiving work, not green-field design.

The **one genuine product decision — not plumbing — is co-pilot's expiry semantics:** today the code auto-executes on silence; the product stance wants self-veto. That is a behaviour change, but a small and localized one (a single branch in `handlePendingProposal`, `agent-evaluate.js:1386-1426`).

So my honest read: "add mode-aware routing" is **mostly the re-activation of a feature that was already built and then archived**, sitting at the boundary of (a) and (b) — closer to (b) only because of the UI re-wiring. It is explicitly **not** (c). The real risk is not technical scope; it is that nobody recorded *why* the authority-mode UI was archived. Phase 1 should first establish whether that archiving reflected a deliberate product direction (autopilot-only) before un-archiving it — otherwise the rework may be re-litigating a decision rather than completing an unfinished one.
