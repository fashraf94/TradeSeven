# Cockpit Build 2a — The Cockpit Screen · Spec V1.0

**Date:** 2026-10-03 · **Design:** Fable · **Builder:** Claude Code, local session · **Status:** founder rulings approved Oct 3; ships **dark**.
**Branch:** `claude/cockpit-build2a-screen`, cut from `origin/main`.
**Inputs (all on `main`):** the Build 2 discovery `docs/audits/20261002_PHASE0_BUILD2_COCKPIT.md` (cited **D-A1…D-A11**, **D-B1…D-B10**) · contract `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` with Amendments A and B, and **Amendment C** (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_C.md`, committed by this build) · Build 1a spec `docs/COCKPIT_BUILD1A_SPEC_V1_2.md` · round 3 `docs/audits/20261002_DECLARATIONS_WORDING_ROUND3.md` · V4 direction `docs/design/COCKPIT_DESIGN_DIRECTION_V4.md` and mockup `docs/design/COCKPIT_V4_MOCKUP.html` · `docs/BUILD_RULES.md`.
**Supersedes:** for the cockpit screen, spec V1.3 §5 (and the V1.2 / V1.1 §5 text it defers to) wherever they differ from this document. V4 remains the reference for structure and feel; this spec wins on behavior, copy and scope.

The discovery's file:line anchors are at `c10f03b0`. Re-verify each anchor you rely on at HEAD; where HEAD differs, follow HEAD and record it in the report.

---

## 0. What 2a is, in plain terms

The cockpit screen, on desktop and phone, showing the calls the agent already declares, with the answers that already exist on the server. It ships dark. A separate flip PR turns it on **for the founder's own battles only**.

What the player gets once it's on:
- **Desktop:** a Cockpit tab, first in the right pane, beside Chat · Bench · Tape.
- **Phone:** a pinned header with a **Board · Cockpit** switch; the cockpit is a full screen beside the board.
- **Tiles** for called shots, confirmations and upside calls, each with at most two buttons: one agrees with the agent's plan (free), one overrides it (costs a message).
- **Monitoring:** the names the agent is keeping an eye on, from its latest check.
- **Receipts** that report only what the records prove: filed, heard, acted, no matching trade, expired.

Nothing in 2a creates a new kind of instruction for the agent. The only model-visible changes are the 1A-C text port (§3, S-8) and the upside line in the chat calls block (§3, S-3).

---

## 1. Rulings carried into this build

| ID | Ruling | From |
|---|---|---|
| R2A-1 | Build 2 splits: **2a** the screen on existing backend; **2b** the Crossroads, rebuilt as a replacement pick. One amendment (C) covers both. | Oct 3 |
| R2A-2 | Desktop opens on **Cockpit**. The Chat tab shows an unread count so agent messages are never hidden. | D-Q1; Sep 23 |
| R2A-3 | Phone: header, THIS TURN and the **Board · Cockpit** switch are pinned; **Board** is the default; the Cockpit segment carries a needs-you count. Only when the cockpit is on. | D-Q2; Sep 23, CR-14 |
| R2A-4 | Motion uses the existing `motionToken('smooth')`; `instant` under reduced motion. No new motion token. | D-Q3; CR-13 |
| R2A-5 | State colours: **teal** your answer (filed, heard, agreed) · **emerald** acted · **amber** dropped · **muted** expired / ended / no matching trade · neutral live. Gold is reserved (not used in 2a). | D-Q4; CR-12 |
| R2A-6 | Banned words are renamed on screen ("Monitoring", never "watching"). The honesty test is **not** changed. | D-Q5 |
| R2A-7 | The screen asks the **server** whether a battle is cockpit-on. The allowlist moves **server-side** (an environment variable), so no tester's account id ships in the app. | D-Q6 |
| R2A-8 | One plain line per refusal reason (§8.3). | D-Q7 |
| R2A-9 | Controls with no backend are **hidden**, not disabled: "Ask me first", "Go now / Keep holding off", "Agree for next time", Dials pill, Dials sheet, Guarding group, Research pill, research-objective tiles, two-way "Pick" tiles, "Flag for next deploy", "Open in chat at this line". | D-Q8 |
| R2A-10 | Never "Held off". After a Hold off, the tile shows the provable chain (§7.4). No "Asking you" state. | D-Q9 |
| R2A-11 | Every override button shows its cost: "· 1 message". | D-Q10 |
| R2A-12 | No Crossroads Tier 1 or Tier 3. The Crossroads returns in 2b as a replacement pick on exits that name no replacement. | D-Q11, Q14, Q17 |
| R2A-13 | "Entries" on held stocks are **upside calls**: read-only, no buttons. | D-Q12; Amendment C-2 |
| R2A-14 | Monitoring reads the agent's top-level watch list when the declarations block has none. | D-Q13; Amendment C-1 |
| R2A-15 | A counterpart shows only when it is a usable stock name. | D-Q15; Amendment C-3 |
| R2A-16 | Restated calls fold into one tile per thread. | D-Q16; Amendment C-6 |
| R2A-17 | **Port 1A-C** into the live `on` text. Keep round 3 re-runnable by freezing the pre-port 1A text as its own arm. | D-Q18; Oct 2 |
| R2A-18 | The build proceeds now. The founder's battles may run the cockpit ahead of the general-release gates (grounding `'on'`, fit check, held-position parity, Build 1b), which govern **other** testers. | D-Q19; Oct 1 |
| R2A-19 | The live rollback trigger needs a minimum sample and a significance test before it can fire (§10.4). | Oct 3 |

---

## 2. Scope

**In:** Amendment C-1 to C-6 (server); the cockpit-status endpoint; the server-side allowlist; the 1A-C port; client readers; the desktop Cockpit tab; the phone Board · Cockpit screen; tiles, sheet, receipts, Monitoring, Earlier; refusal copy; state tokens; the rollback check; tests; review; smoke branch; report.

**Out (do not build):**
- Anything in Amendment C-7 / C-8 (Build 2b): assembled picks, the replacement instruction, the research sheet's answer path.
- Build 1b: "Ask me first", re-ask, "Asking you", "Keep holding off".
- Exit dials, Guarding data, "Flag for next deploy" (spec V1.3 :18).
- Board-row call marks (V4's Directive · Acted marks on board rows).
- Chat bubble anchors and "Open in chat at this line" (D-A8 GAP). The check-card link in §7.5 is in scope.
- Any change to the flip state of `CALL_RECORDS_MODE`, `COCKPIT_UI_ENABLED`, grounding or the fit check. Those flips are separate PRs.
- Ask 2's flip (the exit-behavior arc). Not touched here.
- Held-position parity.

**Fence (BUILD_RULES §1):** no planned change touches a fenced file. If any change would, **STOP** and report before making it. `api/cron/agent-evaluate.js` is expected to change in one place (S-1); confirm it is not on the fence list at HEAD.

---

## 3. Server changes

**S-1 · Watching source (C-1).** At the calls hook (`agent-evaluate.js:2862`), hand the validator what it needs to apply C-1: the `declarations` object and the top-level `watching` value of the same accepted tool input. In the validator (`api/_utils/callRecords/validate.js`, `captureDeclarations` :364-374) apply C-1 exactly: the top-level list is read only when the block has no non-empty `watching`, validated by the same rules, and a watching-only result writes the declarations record (no call). Write `watchingSource`. Top-level `fork` / `playerAsk` remain ignored.

**S-2 · Mint fields (C-2 to C-5).** In call composition (`candidate.js`, `composeCall` :141-174, and the declarations writer :221-229):
- `heldAtMint` from the held set at the model seam. Confirm the frozen observation (`observe.js:102-104`) carries the held set; if it does not, pass it from the same seam. Do not infer held-ness from prompt text.
- C-3 counterpart usability: classify against the seam's held set and universe; keep the counterpart only if usable, else `null` + `counterpartRaw` (trimmed to 40). If the seam does not know cooldown locks, record that in the report and treat lock status as unknown (do not guess).
- `saidOk` per call, from the existing lint.
- `mintedMode` on calls and declarations records, from the resolved mode passed through the calls context.

**S-3 · Upside line.** Add `renderUpsideLine(call, opts)` to the shared copy module (`api/_utils/callRecords/copy.js`) beside `renderCallLine`. Every renderer of calls uses it when `heldAtMint` is true — including the **chat calls block** (`callsBlock.js`), which is model-visible (S-8 review applies). `renderCallLine` must never emit an action clause for an upside call.

**S-4 · Answer legality.** Extract the answer-legality table from `api/agent/call-response.js:111-129` into a Node-clean shared module (e.g. `api/_utils/callRecords/answers.js`) that the endpoint and the client both import — one canonical home, no copy. Add: any answer on a `heldAtMint` call → `400 illegal_answer`. Endpoint behavior is otherwise unchanged.

**S-5 · Server-side allowlist (R2A-7).** Move `COCKPIT_ALLOWLIST_UIDS` out of `src/config/featureFlags.js` (:2852) into a server-only reader (e.g. `api/_utils/callRecords/allowlist.js`) that parses the environment variable `COCKPIT_ALLOWLIST_UIDS` (comma-separated, trimmed, empty → `[]`) **at call time**, never at module scope. `resolveCallRecordsMode(battle)` (`mode.js:72-77`) reads it there; behavior is otherwise unchanged. Remove the client export and replace its pins (`cockpitFlags.test.js:38-39, :58`) with pins on the reader: empty by default, parsed per call, unreachable from `src/`. After this change no `src/` module may import the allowlist.

**S-6 · Cockpit status endpoint.** `GET /api/agent/cockpit-status?battleId=…` → `requireAuth` → IP limiter and per-user limiter (precedent: `call-response.js`) → read the battle → `403` if the caller is not the owner → `200 { on: boolean }` where `on = resolveCallRecordsMode(battle) === 'on'`. `Cache-Control: no-store`. Precedent: `GET /api/backing/lit` and `useBackingLit` ("the client never decides").

**S-7 · Shared copy for the client.** The client imports `renderCallLine`, `renderUpsideLine`, `deadlineText` and `checkLabel` from `copy.js`. Add a `clock: '12h'` option to `checkLabel` so the client renders "the 1:30 PM check"; the server's default (24-hour) output is unchanged byte for byte, because it appears in model-visible text. Confirm `copy.js` and its imports bundle cleanly in Vite (D-A4 marks this ASSUMED); if they do not, STOP and report rather than copying the functions.

**S-8 · Port 1A-C (R2A-17).** Apply the exact diff in D-A9 to `api/_utils/agentEvalToolSchema.js`; it must serialize the `on` tool to SHA-256 `7388755a59d31522417f0a7501ec4d7c6601dd1f8138a70da8659c467ee293a6` (13,623 chars), with D, shadow and off unchanged. Then:
- re-pin `agentEvalToolSchema.build1a.test.js` (the five tests / seven assertions D-A9 lists) and update every stale "two edits" comment, test title and the spec line D-A9 lists;
- freeze the **pre-port** 1A text as its own arm in `scripts/declarationsWordingArms.mjs` (bytes `81499cbc…`) so `scripts/declarations-wording-experiment.mjs` round 3 still runs: `assertRound3Arms` and `reuseGate3` must pass against the frozen arm;
- move the pin in `scripts/build2-discovery-counts.mjs` that the experiment-script edit breaks, and show it still reproduces its committed output byte for byte.
This is model-visible text: **fenced-class coordinated review applies** (§12, lens L2).

**S-9 · Rollback check (R2A-19).** Extend the existing read script that carries `--calls-enabled-window` with `--rollback-check`: over the allowlisted battles' model calls in the last five trading sessions, report `invalid_tool_result` count / total, and **TRIP** only when all three hold: total ≥ 150; rate > 3%; one-sided Fisher p < 0.05 against the round-3 off baseline (3 of 386). Read-only; prints the verdict and the counts. No automatic action.

---

## 4. Client data

All readers live **outside** `src/screens/battleView/` (e.g. `src/hooks/`), gate inside the effect, unsubscribe on teardown, and return `null` when off (precedents: `useIntradayView.js:26-41`, `useMasteryProfile.js:29-56`, the live list `subscribeClaims`, `tournamentGroupService.js:104-116`). They map record field names to screen names at the boundary, so no Battle View file contains a banned word (`watching` → `monitoring`).

| Reader | Query | Notes |
|---|---|---|
| `useCockpitStatus(battleId)` | `GET /api/agent/cockpit-status` | Runs only when `isCockpitUiOn()` and the battle is active. Re-runs on battle status change and after any `404 cockpit_unavailable`. Errors read as off. Unknown reads as off (no layout change until `on` arrives). |
| `useCalls(battleId, enabled)` | `calls`, `orderBy('mintedAt','desc')`, `limit(60)`, `onSnapshot` | Keep only `mintedMode === 'on'`. |
| `useMonitoring(battleId, enabled)` | `declarations`, `orderBy('evalSeq','desc')`, `limit(1)`, `onSnapshot` | Returns `{ symbols, evalId, promptBuiltAt }` from the newest `mintedMode === 'on'` record; `null` if none. |
| `useCallEvents(battleId, enabled)` | `callEvents`, `orderBy('at','desc')`, `limit(150)`, `onSnapshot` | Grouped by `callIds` client-side. No composite index. |
| `useCallObservation(battleId, callId)` | `callObservations/{callId}`, one-shot `getDoc` | Only when a sheet opens on a resolved call. |

Every query orders by one field: no new composite index. The rules in the tree already give the owner read (D-A4); production publication is deployment step 3 (§13). The battle document (already subscribed) supplies `directive`, `chatBudgetUsed`, `ownerId`, `status` and the latest evaluation's `promptBuiltAt`.

**Cockpit-on for a battle** = `isCockpitUiOn()` && `useCockpitStatus` returned `on: true`. Nothing else turns it on. The client never recomputes the mode from bundled constants.

---

## 5. Desktop: the Cockpit tab

- **Sections are computed** from shell × cockpit-on (spec V1.1 §5; D-A1, D-A2): desktop + on → `Cockpit · Chat · Bench · Tape`; otherwise `Chat · Bench · Tape`, unchanged. Use a computed list rather than the module constant (precedents: `SearchDiscover.jsx:24`, `BackingDesk.jsx:67-72` with the repair in `BackingScreen.jsx:143-148`).
- **Default section** is Cockpit when on (the four defaults D-A1 lists). The four "open Chat" doors still open Chat. A remembered section missing from the current list is **repaired** to the list's first entry.
- **Unread:** the chain stays keyed to Chat (`chatOpen` at `AgentBattleScreen.jsx:614-616`). When the pane shows any section other than Chat and unread > 0, the Chat tab label reads **"Chat · {n}"** (copy precedent "Bookmarks · n"). The mark's badge and bubble behave as today.
- **Width budget:** recompute `PANE_HEADER_FIXED_PX` (`CharacterPane.jsx:92-93`) with the Cockpit label, correct the hand-entered comment, and record the new archetype threshold in the report.
- **Panels** stay hidden, not unmounted, as today (`CharacterPane.jsx:234`).
- **Cockpit panel top row:** "Prices as of the {t} check · next ~{t}" (prices = the latest evaluation's `promptBuiltAt`; next = the existing `nextDecisionAt` from `deriveTurnLine.js:138-141`) and "{n} messages left" from `chatBudgetUsed` against the battle's limit. No pills (R2A-9).
- **Off path:** with the cockpit off, the desktop pane is byte-identical in behavior to HEAD; the existing tab-list pins (`AgentBattleScreen.pane.jsdom.test.jsx:450-476`, `useCharacterPane.test.jsx`) keep passing unchanged on that path.

---

## 6. Phone: Board · Cockpit

Only when cockpit-on. With it off, the phone layout is unchanged.

- **Pinned region:** the root takes the viewport-high layout desktop already uses (`AgentBattleScreen.jsx:2098`, `useViewportHeight`); the back bar, `ArenaHeader`, THIS TURN and the **Board · Cockpit** switch sit above a track; each screen scrolls internally.
- **Track:** a two-screen horizontal container using native scroll-snap (`scrollSnapType: 'x mandatory'`, precedent `ArchetypePicker.jsx:259-287`). Swiping moves the switch; tapping the switch scrolls the track (`behavior: 'smooth'`, or `'auto'` under reduced motion). **Board** is the default screen.
- **Switch:** a segmented control with a sliding thumb (Framer `layoutId`, `motionToken('smooth')`, `instant` under reduced motion). Labels "Board" and "Cockpit · {n}", where n = tiles in **Needs you** (after folding); no count when 0. `role="tablist"` with roving tabindex, arrow keys, as `SegmentedControl` does.
- **Chat** stays behind the floating mark; the overlay's sections stay `Chat · Bench · Tape`. Keep the mark's bottom clearance on both screens (`AVATAR_CLEARANCE_PX`).
- THIS TURN is unchanged in content; it moves into the pinned region.

---

## 7. Tiles

### 7.1 Groups, in order

1. **⚡ Needs you** — open calls with legal answers (not `heldAtMint`) and no answer on their thread.
2. **⏱ Waiting on the check** — open calls that need nothing from you: answered threads, and upside calls.
3. **👁 Monitoring** — one row: "From the {t} check" and up to six symbol chips; a tap opens the existing research modal through `handleSymbolClick` (`AgentBattleScreen.jsx:1118-1124`). Hidden when there is no record.
4. **Earlier** — resolved calls, newest first; ten shown, "Show all" expands.

No Guarding group. Empty state (no calls, no Monitoring): "No calls yet. Your agent declares calls at its checks — next one ~{t}."

### 7.2 Folding (Amendment C-6)

Group open calls into threads by C-6's key. The tile shows the newest call's wording, with "Restated at the {t} check" when the thread has more than one call. If a call in the thread carries a live directive answer, the tile shows that answer ("You said hold off · {t}, on the {t} wording") and offers no buttons. Otherwise the buttons answer the **newest** call.

### 7.3 Anatomy and answers

Tile: state dot · eyebrow "{KIND} · from the {t} check" · state tag · the plain line (`renderCallLine` / `renderUpsideLine`, 12-hour clock) · at most two buttons. Tapping the tile body opens its sheet (§7.5).

| Call | Kind label | Left button (agrees · free) | Right button (overrides · 1 message) |
|---|---|---|---|
| called shot, entry, default act, not held | Called shot | **Go if it triggers** (`go`) | **Hold off · 1 message** (`hold`) |
| confirmation (exit, default act) | Confirmation | **Confirm** (`go`) | **Hold off · 1 message** (`hold`) |
| called shot, default hold (entry or exit), not held | Called shot | **Hold** (`hold`) | **Go instead · 1 message** (`go_now`) |
| `heldAtMint` | Upside call | — | — |
| pick | not shown in 2a | — | — |

- Buttons come from the shared legality module (S-4). A call with no legal answers shows none.
- **One call at a time:** when `battle.directive` is a call-family directive whose call has no `playerResponse.heardEvalId`, every override button is disabled with the line "Waiting · your last answer hasn't been heard yet." Agreeing stays available.
- On tap: both buttons disable, the pressed one reads "Sending…", `POST /api/agent/call-response` with `{ battleId, callId, answer, expectedDirectiveThreadId }` (the belief from the subscribed `battle.directive.directiveThreadId`). **No optimistic state**: the tile changes when the listener delivers the record. Errors show one line under the tile (§8.3), `role="status"`, `aria-live="polite"`.

### 7.4 State tags (record facts only)

| Record fact | Tag | Colour |
|---|---|---|
| open, no answer | Live | neutral |
| answered with an agreement | You agreed · {t} | teal (outline) |
| directive filed, not heard | Filed · not yet heard | teal |
| directive heard | Heard at the {t} check | teal |
| hit, `outcome.actedEvalId` set | Acted at the {t} check | emerald |
| hit, not acted | Hit at the {t} check | neutral |
| no-matching-trade receipt | No matching trade at the {t} check | muted |
| answer replaced by a later one | Replaced by a later answer | muted |
| `expired_unresolved` | Expired · {deadline} | muted |
| `ended_with_battle` | Battle ended | muted |
| `invalidated` | Dropped · price line out of range | amber |

Enumerate every state and event kind at HEAD (`flip.js`, `sweep.js`, `heard.js`, `events.js`, `directiveWriter.js`) and map each one in a single table in `battleViewCopy.js`. A fact with no row renders **no tag** — never a guessed one — and a test asserts the table covers every kind the writers can emit. Words that never appear: Held off, Holding, Declined, Honored, Superseded, Asking you.

### 7.5 The sheet

Opens from a tile: a modal bottom sheet on the phone, a modal panel within the pane on desktop. Focus trapped and restored, Escape closes, scroll locked. No general-purpose sheet exists in `battleView/` (D-A11); build one minimal sheet for the cockpit, not on `ChatSheet`.

Contents, top to bottom:
- Title: the plain line.
- The agent's sentence, only when `saidOk === true`, under the label "agent's own wording (unverified)".
- Facts: the level, the deadline, the price at the citing check ("as of the {t} check").
- The default: "If you say nothing · {the agent's default action}".
- **Receipts** from `callEvents`, oldest first: Filed → Heard → Acted / No matching trade / Expired, each with its time; a resolved call adds its observed price from `callObservations` ("Hit at $609.80 · the 1:45 PM check").
- "Restated at…" entries for a folded thread, each with its own time and wording.
- **"From the {t} check →"** opens the pane on Chat and scrolls to that check's card (`data-tape-entry-id="tape-check-{evalId}"`). Extend the scroll state (`openCheck`, `AgentBattleScreen.jsx:1201-1206`) to accept an `evalId` target; if that card is not in the chat, show "That check is no longer in the chat" and do not scroll elsewhere.
- The same buttons as the tile.

---

## 8. Copy

All Battle View copy lives in `battleViewCopy.js` (the honesty test requires it, D-A3).

### 8.1 Labels
Group headers: "⚡ Needs you" · "⏱ Waiting on the check" · "👁 Monitoring" · "Earlier". Kind labels: "Called shot" · "Confirmation" · "Upside call". Desktop tab: "Cockpit". Phone switch: "Board" · "Cockpit · {n}".

### 8.2 Chat
A directive card whose exchange has `source: 'cockpit'` carries a small "From the cockpit" label. Keep `source` in the projection (`deriveChatMessages.js` drops it today, D-A8). Read `COCKPIT_BUILD1A_SPEC_V1_2.md:39` (the client gate assigned to Build 2); if it requires something different, follow it and record the difference in the report.

### 8.3 Refusals (R2A-8)

| Response | Line under the tile |
|---|---|
| 409 `already_answered` | You've already answered this call. |
| 409 `expired` | This call's deadline has passed — nothing was filed. |
| 409 `parent_not_active` | This battle isn't active — nothing was filed. |
| 409 `belief_mismatch` | Your agent's instructions changed a moment ago — nothing was filed. Check the tile and try again. *(adopt `currentDirectiveThreadId`)* |
| 409 `directive_pending` | Waiting · your last answer hasn't been heard yet. One call at a time. |
| 409 `budget` | No messages left — nothing was filed. |
| 429 (either limiter's body) | Too many taps — try again in a minute. |
| 404 `cockpit_unavailable` | The cockpit is off for this battle — nothing was filed. *(re-run the status check)* |
| 400 (any) | That answer isn't available for this call — nothing was filed. |
| 403 | Only the battle's owner can answer its calls. |
| 401 | Sign in again to answer. |
| 500 or no response | Couldn't confirm your answer. Check the tile before trying again. |

Read the response body on failure (the chip's status-only mapper, `decisionRecord.js:786-791`, is **not** reused). The last row never says "nothing was filed": the server may have committed.

---

## 9. Styling and motion

- Battle View files use `--ft-*` tokens only (the `HOLO_COLORS` / holo theme in the component skill does not apply here).
- Add four state aliases, following BUILD_RULES §10 and the cssTokens pins (D-A3): `--ft-call-yours` → the shipped player teal (confirm its token at `ArenaHeader.jsx:13-17`) · `--ft-call-acted` → `--ft-success` · `--ft-call-dropped` → `--ft-warning` · `--ft-call-muted` → the muted text base (`tokens.css:109`). Update `tokens.css`, `tokenBaseline.json`, the SEMANTIC table, the alias count and the total (39 → 43) in one commit.
- Every new top-level file in `src/screens/battleView/` joins **both** guard lists and baselines in the same commit, with a hand-written motion authority (D-A3). Do not place cockpit files in a subdirectory to avoid the guards.
- Answer chips follow the shipped transparent teal-outline chip (`WhyPanel.jsx:589-606`), not the mockup's tinted fills.

---

## 10. Flags, activation and rollout

**10.1 New flag.** `COCKPIT_UI_ENABLED = false` in `featureFlags.js`, read through an accessor `isCockpitUiOn()` at render; `DARK_BY_DESIGN`, pinned in `flagPinGuard.test.js`; its own pin test. Every cockpit code path — readers, layout change, tab — is unreachable while it is false.

**10.2 Unchanged in this build.** `CALL_RECORDS_MODE` stays `'off'`. The allowlist environment variable is unset. Grounding, the fit check and Ask 2 are untouched.

**10.3 The flip (a separate PR, after merge).** One commit: `CALL_RECORDS_MODE = 'on'`, `COCKPIT_UI_ENABLED = true`, their pin updates and the `DARK_BY_DESIGN` removal. Before it deploys, the founder sets `COCKPIT_ALLOWLIST_UIDS` to his own uid in the Vercel **production** environment. With the variable holding one uid, every other battle resolves `off`: no records, no cockpit.

**10.4 Rollback.** Remove the uid from the environment variable (immediate; records freeze in place). Run `--rollback-check` (S-9) after each of the first five sessions; a TRIP means remove the uid and report.

---

## 11. Tests (each with its exit code asserted; read the `Test Files` line; never pipe through `tail`)

- **Server:** C-1 (top-level read only when the block's list is empty; same validation; watching-only record; `watchingSource`; fork / playerAsk ignored); C-2 (`heldAtMint` from the seam's held set; every answer → `400 illegal_answer`); C-3 (each class from D-B5's table: TBD / entry / N/A / "X or Y" / own symbol / held-on-exit → `null` + `counterpartRaw`; usable kept); C-4 (`saidOk` per call matches the lint); C-5 (`mintedMode` on both documents); the allowlist reader (env parsed at call time; no module-scope read; unreachable from `src/`); the status endpoint (401 / 403 / on / off / no-store); `renderUpsideLine` and the chat calls block; `checkLabel` 24-hour output byte-identical; the 1A-C pins (S-8) and round 3's re-run gates; `--rollback-check` on synthetic counts at, below and above each threshold.
- **Client:** computed sections per shell × on; default Cockpit; remembered-section repair; "Chat · {n}" while another section shows; the phone track, switch, count and reduced motion; every row of the §7.3 matrix (buttons from the shared module); one-call-at-a-time disabling; every row of §8.3 (from a mocked response body); every row of §7.4, with the coverage test; folding (key, 1% tolerance, live-answer rule, newest-call answering); Monitoring from both sources; the check-card link and its missing-card line; the "From the cockpit" label.
- **Off path:** with `COCKPIT_UI_ENABLED` false, both shells render as at HEAD; the pane-off and controller goldens are unchanged; no reader runs and no request is sent.
- **Guards:** honesty test, token and motion guards, cssTokens, flagPinGuard — all passing with the additions above, none loosened.
- `vite build` exit 0.

---

## 12. Review, smoke, report

**Review (BUILD_RULES §2, mandatory at this size).** Lenses on isolated snapshot trees, read-only on git; every finding to a refuting verifier; mutation battery last, with survivor proof.
- L1 server and Amendment C fidelity
- **L2 model-visible text** — the 1A-C port and the chat calls block's upside line (fenced-class coordinated review)
- L3 client data and activation honesty (nothing claims cockpit-on without the server; no allowlist in the bundle — check the built bundle and its source map)
- L4 desktop UI
- L5 phone UI, accessibility, reduced motion
- L6 copy and honesty (banned words, every tag and line traceable to a record fact)
- L7 mutation battery

**Smoke branch.** `claude/cockpit-build2a-smoke` = the build HEAD + one commit that sets `COCKPIT_UI_ENABLED = true` and adds a fixture mode (`?cockpitFixtures=1`) that bypasses the status check and feeds in-memory records covering every row of §7.3, §7.4 and §8.3 on both shells. Never merged. Its preview URL goes at the top of the report.

**Report.** `docs/audits/<YYYYMMDD>_BUILD2A_COCKPIT_SCREEN.md`: preview URL first; what changed, in plain terms; every anchor that differed from the discovery; each STOP condition met or not; test totals; the review record; the deployment checklist (§13). Out-of-repo copy per BUILD_RULES §3. Then commit, push, open the PR, and **STOP**: no merge, no flag flip, no CI watching.

---

## 13. Deployment checklist (after the build)

1. Amendment C blessed (framework chat). **Gates the merge.**
2. Astra branch review of the PR.
3. Firestore rules for `calls`, `declarations`, `callEvents`, `callObservations` confirmed published in production (Build 1a's step 3).
4. Merge after 6 PM ET (the cron changes), CI green.
5. Founder sets `COCKPIT_ALLOWLIST_UIDS` = his uid in Vercel production.
6. Flip PR (§10.3), merged after 6 PM ET.
7. Founder smoke on his own battle the next trading day; `--rollback-check` after each of the first five sessions.
8. Ask 2's flip waits until the cockpit's first trading week is read, so any change in the agent's calls has one cause.
