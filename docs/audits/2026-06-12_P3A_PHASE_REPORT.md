# P3a — Monday Pipeline (Board Production · Agent Draft · Acquisition): Phase Report

**Branch:** `claude/blissful-dijkstra-5f105v` · **HEAD:** `5c8a524` (3 commits: `ab90949` build, `be04c34` code-review fixes, `5c8a524` contract-#6 amendment) · **Base:** `53d892e` (current main) · **Date:** 2026-06-12
**Rulings honored:** A as proposed (P3b scope; base-layer recomposition docketed), finding-#5 defer+loud-log (P5 owns the deadline auto-commit — required pre-launch), B1 (P3b scope; CPU marker = P4 contract #5), **C-i with sanitizer tripwire**, **D-split (this is P3a)**.

---

## 1. Executive verdict

| Item | Status |
|---|---|
| Board production (rider #2 + rider #6 board-time half) | **Built + tested.** One Sonnet call per agent, USER PICKS block in context, persisted awaited to `agentBoards/{agentId}`; deterministic archetype-ranking fallback — boards always exist before the draft. |
| Agent draft resolution (rider #3, agent side) | **Built + tested.** Ledger-aware snake; own-player picks draftable by own agent only (the drafted double-down); `passedOver` stream in one awaited transaction; `reserveBulk` lands all 24 as held/`draft`. |
| Acquisition lifecycle | **Built + tested.** Idempotent at every grain; the stream-written/acquisition-lost crash window self-heals on re-run. |
| Dev surface + smoke | **Built.** Two admin endpoints, dev-screen buttons + three live cards (boards / draft stream / ledger), smoke script steps 8–9 added. |
| Tests | **2,362 passing** (whole repo); 50 new across 4 batteries. |
| Fence | **No fenced file edited.** Fenced exports *called* read-only: `formatMarketCSV` (agentPromptAssembly.js). Fence-grep proof in PR. |
| Cron budget | **Zero entries added** (37 unchanged; the orchestrator slot is P3b's). |
| Production inertness | No production caller exists: both endpoints are admin-secret-gated; nothing schedules them. The deploy step is **not in this phase at all** (P3b builds it, P4-gated). |
| `/code-review` | **Run (mandatory at 11 files).** 39 raw candidates → 10 survivors → all fixed or documented in `be04c34` (§5). |

## 2. What was built (file:line)

**`api/_utils/tournamentPromptSanitizer.js`** — the C-i sanitizer port, byte-identical to the fenced original. The co-located test (`tournamentPromptSanitizer.test.js:52-66`) is the founder-required **tripwire**: it extracts the function source from BOTH fenced prompt files and fails on any divergence — byte-equality vs `agentPromptAssembly.js` (the P4 canonical home), normalized-equality vs the comment-annotated `agentEvalPromptAssembly.js` twin. A behavioral battery rides along (`:69-107`).

**`api/_utils/tournamentAgentBoards.js`** — board production.
- New tournament prompt (NOT the fenced tiered builders — their GAME RULES text is wrong for flat-6): system prompt `:139-160` (scoring kept **qualitative**; flat6 economics are P4's to set), user prompt `:168-218` with the USER PICKS block (`:184-192`, symbols + live-leg direction via P2's `getOwnUserPicks`) and the sanitized watchlist block (`:194-213`).
- Tool-forced single Sonnet call per agent (`claude-sonnet-4-20250514`, archetype temperature) `:344-358`; untrusted output normalized — dedupe/universe-validate/cap/pad — `:236-280`; any failure degrades to the deterministic archetype-ranking fallback `:309-321` (one construction site).
- Persistence (rider #2, awaited) `:497`: `{agentId, odUserId, archetype, board, rationale, userPicksStance, userPicksAtBoardTime, roundNumber, bracketGameId|baseLayerWeek, fallback, model, producedAt}`. The stance lines are **rider #6's board-time half**; deploy-time capture remains P4 contract #4.
- Idempotent per CURRENT agentId; agent churn deletes the stale board and re-produces (`:447-462`); summary carries a `synthetic` count the **P3b orchestrator must refuse on real groups** (`:417-421`).

**`api/_utils/tournamentAgentDraft.js`** — draft + acquisition.
- Pure resolver `:95-170`: snake fwd/rev over 6 rounds; availability = catalog − ledger-held − taken − **rival players' user picks** (own picks stay open — Spec §1.3); board exhaustion falls back to that agent's archetype ranking; events `{pickNumber, round, agentId, odUserId, symbol, boardRank, fallback, passedOver}` (shape-parity with the P1a user stream).
- Lifecycle `:209-308`: stream write in ONE awaited transaction with in-tx race re-check (rider #3) → `reserveBulk` all 24 (Spec §0.1 reserve-before-deploy). Existing stream → ensure-acquisition only (never re-resolves); corrupt stream surfaces `empty_stream_record` structurally; acquisition conflicts are logged CRITICAL and surfaced as 409 — never blind-retried (nightly reconciliation arbitrates from battle docs).
- **Canonical-record roles documented** (`:24-43`): stream = the resolution record (P3b's Monday prescribed six reads it); ledger = availability index; battle docs = ground truth. The rival-pick block is **draft-only by design** — intraday swaps carry no cross-market checks (V2.1 §2); documented so nobody "fixes" it.

**Endpoints (transport-only, admin/cron secret):** `api/tournament/produce-agent-boards.js` (maxDuration 180; `force` flag) and `api/tournament/resolve-agent-draft.js` (maxDuration 30) — the preview/smoke path on the bank-daily-scores precedent; the P3b orchestrator becomes the production caller.

**Client:** `src/services/tournamentGroupService.js:57-104` — three live subscriptions (agentBoards / agentDraft stream / ledger; reads legal under the deployed recursive rules block, firestore.rules:312-315). `src/screens/TournamentDevScreen.jsx` — Produce boards + Resolve agent draft buttons, three display cards, smoke steps 8–9 in the header script.

**Schema:** `src/constants/leagueTournament.js:31-46` — `AGENT_BOARDS_SUBCOLLECTION`/`STREAMS_SUBCOLLECTION`/`AGENT_DRAFT_STREAM_DOC_ID` (+ a sync warning: P1a files still use 'streams'/'boards' literals). Zero-import invariant intact (test-locked).

## 3. Founder smoke script (preview)

Steps 1–7 unchanged (P1). New: **8.** "Produce boards" → `4 produced (3 fallback)`; your real agent's board shows Sonnet rationale + stance lines; placeholders show FALLBACK·SYNTHETIC (no agent doc — loud server log). Re-click → `4 skipped`. **9.** "Resolve agent draft" → `resolved · 24 held`; the stream card lists 24 picks with snipes; the ledger card jumps to 24 held, source `draft`. Re-click → `already_resolved`. `reconcile-ledger` reports the 24 as `unverifiable_holder` and preserves them — **by design** until P4 stamps battles.

## 4. Known dev-only affordance (founder attention)

A group member with **no `agents` doc** (the seeder's placeholders) gets a synthetic identity (`dev-agent-{odUserId}`) and the deterministic fallback board, loudly logged and counted in `summary.synthetic`. This keeps the P3a smoke runnable today. It is **not** the CPU design (that's B1 at P3b: real system-owned agent docs) and **not** acceptable on production groups — the P3b orchestrator must treat `synthetic > 0` as a configuration error (contract comment at `tournamentAgentBoards.js:417`).

## 5. Code review (mandatory; 39 candidates → 10 survivors → resolved)

Fixed in `be04c34`: agent-churn board re-keying + stale-doc deletion; duplicate-board determinism (latest `producedAt`, loud); `empty_stream_record` guard; `synthetic` count in the summary; parallel agent lookups; memoized archetype rankings; unified fallback construction; test write-failure hook replacing a 7-level proxy. Documented instead of changed: canonical-record roles; draft-only rival-pick scope; the literals-vs-constants sync warning. Notable refutations: the `||` short-circuit "bug" (left-true never evaluates the right side), `.data()` undefined-when-exists (not a real Admin SDK state), dots in doc IDs (legal — only field paths are hazardous), ledger-level rival-pick enforcement (deliberately absent per V2.1 §2 dual markets).

## 6. P4 contract (running list — P4's shopping list)

1. **(P2)** Stamp `groupId` alongside `gameMode: 'baggerbomb_tournament'` in `createAgentBattle` for tournament deploys (the resolver's joint-stamp contract, `tournamentAgentLedger.js:196-217`).
2. **Prescribed-portfolio entry path** in `decide.js`: accept a provided six, skip Sonnet/Haiku, validate + create. Monday's six come from `streams/agentDraft.picksByAgent` — written by this phase.
3. **Deploy auth enforcement**: `CRON_SECRET` verification + rate-limit exemption for internal callers; user-token ownership for client calls. P3b's orchestrator sends these from day one; P4 makes `decide.js` check them.
4. **Rider #6 deploy-time half**: USER PICKS reaction capture at deploy (board-time half ships in this phase — `userPicksStance` on the board doc).
5. **(Ruling B1)** The prescribed path stamps the CPU/passive-evaluation marker so non-fenced eval code can skip triggered evaluation for CPU battles.
6. **(founder ruling, June 12, 2026 — amended same day)** Export `sanitizeRuleText` canonically from `agentPromptAssembly.js`, **replace the private twin in `agentEvalPromptAssembly.js` with that import (same fence entry)**, and collapse `tournamentPromptSanitizer.js` to a re-export — **zero copies remaining anywhere**. The byte-identical port + tripwire make the collapse provably safe; the tripwire test retires with it.
7. **(carry)** The `flat6` mode config itself — the gate P3b's deploy fan-out waits on.

## 7. Docket (founder-ruled deferrals)

- **Base-layer weekly recomposition**: deferred until registration exists (Ruling A sub-question; P3b completes base-layer groups only).
- **User-board deadline auto-commit** (prefill-derived) at the Monday pipeline: assigned to **P5, required before launch**; until then the dispatcher defers groups with missing user boards, loudly.

## 8. P3b hand-off (cuts fresh off main after this merges)

Consumes: `produceGroupBoards` / `resolveAgentDraftForGroup` as pipeline steps; `streams/agentDraft.picksByAgent` for Monday's prescribed six; `summary.synthetic` as a config-error signal. Owns: the cron entry + ET dispatcher, deploy fan-out (P4-gated, CRON_SECRET sent), advancement + champion + bracket doc, CPU padding per B1, dispatcher dev buttons.
