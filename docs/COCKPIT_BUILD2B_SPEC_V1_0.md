# Cockpit Build 2b — Spotlight, Commands and "Who comes in?" · Spec V1.0

**Date:** 2026-10-15 (V1.0, folding Amendment D rev 2) · **Design:** Fable · **Builder:** Claude Code, local session · **Status:** founder rulings approved Oct 9 (design pass) and Oct 15 (V5 and its seven corrections); Amendment D blessed with conditions Oct 15 and folded; ships **dark** behind `COCKPIT_2B_ENABLED`.
**Branch:** `claude/cockpit-build2b`, cut from `origin/main` **after** PR #968 (the 40-second model timeout) and the 2b discovery PR (`claude/phase0-build2b-cockpit`) have both merged. If either is not on `main`, STOP and report.
**Inputs (on `main` after the merges, or committed by this build's first commit):**
- the design pass `docs/design/COCKPIT_DESIGN_PASS_V1.md` (cited **DP-n**);
- the 2b discovery `docs/audits/20261014_PHASE0_BUILD2B_COCKPIT.md` (cited by part: **A1…A5, B1…B10, C1…C7**);
- **Amendment D, revision 4** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_D.md` (committed by this build; cited **D-n**). The framework chat blessed it with conditions: D-1 to D-11 on 2026-10-15 and D-12 on 2026-10-16. Every condition is folded in;
- Amendment C rev 3 and the contract V1.4 with Amendments A and B;
- the Build 2a spec `docs/COCKPIT_BUILD2A_SPEC_V1_0.md` and report `docs/audits/20261003_BUILD2A_COCKPIT_SCREEN.md`;
- the V5 mockup `docs/design/COCKPIT_V5_MOCKUP.html` (committed by this build);
- `docs/BUILD_RULES.md`.

**Supersedes:** the Build 2a spec §5–§8 wherever they differ, **while the 2b flag is on**. With it off, 2a's screen stays as shipped, plus the fixes §2 marks "from merge". V5 is the reference for structure and feel. This spec wins on behavior, copy and scope, and §1's seven corrections override the mockup wherever they differ.

The discovery's `file:line` anchors are at `d5d8fa9b`. `agent-evaluate.js`, `AgentBattleScreen.jsx`, `featureFlags.js` and four fenced files have moved since (#958, #961, #967, #968; B10). Re-verify every anchor you rely on at HEAD. Where HEAD differs, follow HEAD and record it in the report.

---

## 0. What 2b is, in plain terms

The cockpit stops being a list and becomes one moment at a time. It also gains the two things live play showed were missing: commands the player can actually spend, and a way to say who comes in when the agent exits.

What the player gets once it's on:
- **The Now card.** One call, big, at the top. It gives the plan as a sentence, says what happens if you say nothing, and shows two buttons that name what they do.
- **"Who comes in?"** On an exit with no replacement named, a second step offers up to four names: the agent's own first, then the bench by rank, plus "Browse the bench →". Picking one tells the agent what to bring in.
- **7 commands per battle**, shown as bullets. Agreeing is free. Chat keeps its own 10.
- **One live command that you can replace.** A new command replaces the live one after one confirmation, instead of being refused until the close.
- **Honest receipts:**
  - a command retires when its stock leaves the book;
  - "Acted" is never overwritten;
  - one expiry label;
  - the reason a call was dropped;
  - "Following your call" on the agent's restatements.
- **Also live:** every other open call as a chip. A day line keeps score. Monitoring and Earlier stay. A dot on each board row marks an open call or your command.

The only new things the agent reads are the two command texts in D-4 and two answer lines in the chat calls block. All four go through fenced-class review (§12).

---

## 1. Rulings carried into this build

| ID | Ruling | From |
|---|---|---|
| R2B-1 | Spotlight shape: the Now card by a fixed priority, the Also-live strip, the day line, Monitoring, a collapsed Earlier, board-row dots. | DP-1 |
| R2B-2 | Buttons name their action. Every override carries one bullet; agreeing carries none. | DP-2 |
| R2B-3 | **7 commands per battle**, shown as a bullet meter. Overrides and picks spend one; agreeing is free; chat keeps its 10. The count is derived from the battle's own cockpit filings (D-1). | DP-3; Oct 5; discovery Q3 |
| R2B-4 | One live command; a new one **replaces** it after an explicit confirmation (D-2). The chat composer says so while a cockpit command is live. | DP-4 |
| R2B-5 | **"Who comes in?"** on exits with no usable replacement. "{Agent} is eyeing" = **either** of the agent's lists (anticipation candidates or watch list). Bench names come by the platform's rank, labelled **"From your bench · by rank"**. Options are stored on the exit call (D-3). | DP-5; discovery Q4 |
| R2B-6 | **The bench sheet (V5's 6A)**, not the screener (6B). The screener-scope question (Q6) is moot. | Oct 15 (default; founder may still choose 6B) |
| R2B-7a | **One card per stock plan** (D-12): calls on the same plan (stock, direction, slot, side, default) fold into one card at any level. The headline is the newest open line; a moved line reads "Line moved $A → $B", with earlier levels on expand. D-10's 1% test decides whether a command covers a line: a line more than 1% from the answered level is a new ask on the card, with its own buttons. From merge, so the shipped 2a screen gets it too. | Oct 16 (founder; framework chat conditions) |
| R2B-7 | DP-6's fixes: retire on exit (`retired`, a new event kind, D-6), Acted wins, one expiry label (D-8), Following your call (D-10), the server's clock for deadlines, "Filed · no check left today", the dropped reason (D-9). | DP-6; discovery Q5 |
| R2B-8 | Timeouts are handled by #968 (40 s). The round-4 replay no longer gates the 2b flip; it stays the place for the text revision and runs as its own task. | Oct 15 |
| R2B-9 | Picks the agent declares itself stay hidden, as in 2a. | R2A-9 |
| R2B-10 | Out: the screener sheet, Situations, the ask-the-agent score button, multi-command, dials. | DP-4, DP-8; Oct 7 |
| **V5-1** | **Upside calls are read-only.** No buttons, no "add", no "skip". Line: `renderUpsideLine` ("AMD above $625.00 by today's close"). Chip: "AMD ↑ 625 · upside". Never the Now card. | Oct 15 |
| **V5-2** | **A command reads as the player's instruction, conditional, in its canonical text**, the same words the agent reads (callActions.js). Never "Shadow exits AFRM at its next check, on your call". Button labels follow §6.2: a hold-default entry's override is "Bring it in", never "Add now" or "Go instead". | Oct 15 |
| **V5-3** | **One live command, no "Change" on a command's own card.** A call takes one answer, plus the one `replace` after a `go` (D-4). The only way to change a command is a new command on another call, through the replace confirmation. | Oct 15 |
| **V5-4** | **"Who comes in?" also after "Exit instead"** on a hold-default exit with no usable counterpart. The step opens *before* filing. A name, or "Let {Agent} choose", files one command (`go_now` with or without `pickSymbol`). | Oct 15 |
| **V5-5** | **"Following your call" only on the agent's later restatements** (D-10), never on the call you answered. | Oct 15 |
| **V5-6** | **A pick is allowed after "Confirm exit."** Confirming is free and leaves the step open. A pick then files `replace` (one command). | Oct 15 |
| **V5-7** | **Research opens the existing research modal**, unchanged (`AssetResearchModal` through `handleSymbolClick`). "{Agent}'s note" appears only from the agent's own recorded rationale. **No invented agent lines anywhere:** the mockup's chat bubbles, check bubbles and notes are fixtures. | Oct 15 |

---

## 2. Scope

**In:**
- Amendment D (server, records, endpoint);
- the bench read endpoint;
- `serverNowMs` on the status endpoint;
- the V5 screen on desktop and phone (Now card, Who comes in, Also live, day line, Monitoring, Earlier, the commands meter, the bench sheet, board-row dots, the Research pill);
- the replace confirmation;
- the chat composer line;
- the tag and label fixes;
- the 2b read script (S-13);
- tests, review, smoke branch, report.

**From merge (not behind the 2b flag):**
- the mint fields (D-3, D-9);
- the one swappable test (D-7, at mint and at filing);
- retire on exit (D-6);
- the one expiry label (D-8);
- Following your call (D-10);
- one card per stock plan (D-12);
- Acted wins;
- the replaced-by wording;
- the retired and dropped tags;
- "Filed · no check left today";
- the server's clock for deadlines.

These fix what the shipped 2a screen already shows, so they ship to it.

**Behind `COCKPIT_2B_ENABLED`:**
- the endpoint's D-1, D-2 and D-4 behavior;
- the bench endpoint;
- the V5 layout;
- the meter;
- the Who comes in step;
- the replace confirmation;
- the composer line;
- board dots;
- the Research pill.

**Out (do not build):** see R2B-10, plus:
- any change to `CALL_RECORDS_MODE`, `COCKPIT_UI_ENABLED`, the allowlist, grounding, the fit check or Ask 2;
- held-position parity;
- Build 1b (ask, re-ask, "Asking you");
- the Film Room's display of options and picks. The records carry them; the Film Room reads them in its own arc.

**Fence (BUILD_RULES §1).** No planned change edits a fenced file. The executor's validation (`agentSwapExecution.js`) is restated, not edited (D-7). The cron work lands in `api/cron/agent-evaluate.js` (not fenced): the retire step and the mint inputs. If any change would edit a fenced file or alter the `createAgentBattle` shape, **STOP** and report.

---

## 3. Server changes

**S-1 · First commit: the documents.** Commit these byte for byte:
- `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_D.md`;
- this spec as `docs/COCKPIT_BUILD2B_SPEC_V1_0.md`;
- the V5 mockup as `docs/design/COCKPIT_V5_MOCKUP.html` (attached; record its SHA-256).

Apply D-11's two edits to Amendment C, and nothing else in it. Record every SHA in the report.

**S-2 · The swappable test (D-7).** Add `api/_utils/callRecords/swappable.js`. It is pure, Node-clean and browser-clean (the `answers.js` precedent). It exports:
- `canComeIn({ battle, out, slot, inSymbol, atMs }) → { ok: true } | { ok: false, reason }`, with reasons `pick_not_on_bench`, `pick_already_held`, `pick_locked`, `pick_wrong_class`, `pick_is_symbol`;
- `swappableNames({ battle, out, slot, atMs })`, which returns the passing names in roster order.

The lists are bench stocks, bench crypto and hot bench, read as the executor reads them. Cite each line of `agentSwapExecution.js` the restatement mirrors. Add a parity test against the executor's checks; call its exported validator if one exists.

**S-3 · Mint (D-3, D-7, D-9).** In `candidate.js` `composeCall` and its callers:
- **C-3 → D-7.**
  - Exit counterparts: keep only names `canComeIn` passes at the model seam, with the held set, locked set and bench lists frozen at `promptBuiltAt` as C-3's are.
  - Entry counterparts: keep only names held in the call's own slot tier.
  - Otherwise `counterpart: null` and `counterpartRaw` per C-3.
- **`replacementOptions`** per D-3. The cron's model-path calls phase hands `buildMintCandidate` two new inputs:
  - the same check's linted anticipation candidates (the list the `candidates` stamp is composed from);
  - a `{ symbol: technicalRank }` map built from `momentumData.rankingsMap`. This only exposes data already loaded (`agent-evaluate.js`, the `momentumData.rankingsMap` assignment). Add no new I/O.
- **The usable-price rule (D-3, rev 2).** An option, agent or bench, is skipped unless the minting check's observation admits it (`callsCtx.observation.symbols[sym]` exists: a settlement-usable quote fetched at or before `promptBuiltAt`). This applies to options only. The counterpart rule (D-7) and filing do not read it.
- **`invalidatedReason`** per D-9.
- Both new fields are immutable: add them to the canonical form publication compares, not to `MUTABLE_CALL_FIELDS`.
- Mode `'off'` writes nothing, as before. The off-golden (`callRecordsOffGolden.json`) must stay byte-identical.

**S-4 · The answer table and registry (D-4).**
- `answers.js` gains the two v2 rows behind a flag argument, so the endpoint and the client share one table. `classifyAnswer(call, answer, { v2 })` and `tileAnswersFor(call, { v2 })`.
- Add `replacementStepFor(call, { v2 }) → 'on_card' | 'after_exit_instead' | null`:
  - `'on_card'` for an exit + act call with null counterpart that is open and has no response or a `go` ack;
  - `'after_exit_instead'` for an exit + hold call with null counterpart and no response.
- `callActions.js` becomes `callActions.v2`:
  - the v1 templates stay byte-identical (pinned);
  - add `call_replace` and the chosen-name `call_go`, with the D-4 texts;
  - add their eligibility through `canComeIn`;
  - add `counterpart_unavailable` for an agent counterpart that no longer passes (D-7, from merge);
  - the slot action carries `pickSymbol`;
  - `answerIdOf(callId, answer, IN)`.
- `copy.js`: `ANSWER_WORDS.replace = 'Bring in'`; `renderAnsweredEvent` for `replace` and for `go_now` with a name; `renderRetiredEvent`; `RETIRED_REASON_TEXT`.
- `callsBlock.js`: the D-4 answer lines. The chosen name comes from the directive record (`selectedPickOf`), never from `playerResponse`.

**S-5 · The endpoint (D-1, D-2, D-4), `api/agent/call-response.js`.** With `isCockpit2bOn()` false, the endpoint behaves as at HEAD for budget, pending and answers. Its one from-merge change is D-7's `counterpart_unavailable` check at filing (S-4). Any existing test that moves because of that check is named in the report with the fixture that caused it, and no other existing test moves. With the flag true:
- **Wire.**
  - `answer` may be `replace` (with a required `pickSymbol`).
  - `go_now` may carry `pickSymbol`.
  - `confirmReplace` is an optional boolean.
  - Anything else with `pickSymbol` → `400 invalid_request`.
  - After the parent read, `pickSymbol` is canonicalized through `canonicalUniverseSymbol`; a name outside the universe is `pick_not_on_bench`.
- **Order** (insert into the existing ordered table and keep its comments current):
  - step 5 lets `replace` pass when the call's `playerResponse` is the `go` ack;
  - the directive guards stay in order;
  - **the pending check becomes the D-2 confirmation check**: a live slot (call-family pending predicate, or an active, unkilled, unsuppressed ordinary directive) without `confirmReplace === true` → `409 refused, reason: 'replace_unconfirmed'`, with `{ currentDirectiveThreadId, currentText, currentCallId }`, not persisted;
  - **the budget becomes D-1**: count `parent.chatExchanges` entries with `source === 'cockpit'` and `hasDirective === true`; at 7 or more → `409 budget`; no `chatBudgetUsed` write; the league branch is unchanged.
- **Writes.**
  - `playerResponse` per D-4, including `after` on the second answer. Turning a `go` acknowledgment into the `replace` directive response is **the one sanctioned rewrite** of `playerResponse` (D-4 rev 2). Pin that no other path rewrites one.
  - The slot from the v2 plan.
  - The exchange, through the shared writer with `priorSlot` (the stamp and the `superseded` event as today).
  - The `answered` event.
  - `pendingHeard`.
  - `remaining = 7 − (count + 1)`.

**S-6 · Receipts for a chosen name (D-5).**
- `flip.js`: `selectedPickFor` returns the directive record's `pickSymbol` for an exit call whose `playerResponse` is a directive carrying one. `matchesWholeTrade`'s exit branch binds `symbolIn === selectedSymbol` when one is given.
- `heard.js`: `noMatch` and `retire` treat a chosen-name directive as the pick rules do (D-5).
- The existing "— not the selected X" wording of `renderNoMatchingTradeEvent` covers the text.
- Pin both branches with and without a chosen name; v1 behavior stays byte-identical.

**S-7 · Retire on exit (D-6).**
- `events.js`: `retired` joins `CALL_EVENT_KINDS`; `eventIdOf('retired', { directiveThreadId })` → `${directiveThreadId}:retired`.
- New `api/_utils/callRecords/retire.js` exports `retireLeftBook({ db, battleRef, battle, nowMs, evalId, promptBuiltAt, deadlineMs })`. It runs one bounded transaction (the heard pass's 800 ms ceiling and abort pattern) and never throws. It returns `{ retired: boolean, reason }` and, on a commit, sets the in-memory `battle.directive = null`.
- **Call it in `agent-evaluate.js`** at resolved `'on'`, only when the in-memory slot is call-family:
  - after the last pre-prompt route that can move the book (the risk loop's re-read; B3 route 2);
  - before the prompt's directive is resolved for the prompt build;
  - cite the exact lines at HEAD.
- If a control-epoch record **persisted earlier in the same tick** names the directive as active and anything that decides heard or acted reads that record, STOP and report. Do not restructure fenced code to avoid it.
- **Find the trade:** the newest row in the battle's trade log, after the directive's `filedAt`, whose `symbolOut` (or `symbolIn`, for `pick_already_held`) is the symbol. `null` when none is found.
- **Readers that switch on event kind** handle `retired`: `cockpitModel.js`, `callsBlock.js`, the Film Room tape writer if it enumerates kinds, and the read scripts. List each at HEAD. An unknown kind never crashes any of them (add a test per reader).

**S-8 · One expiry label (D-8).** In `sweep.js`, move the non-active-parent branch after a deadline-versus-end comparison:
- end = the parent's `completedAt`, else its scheduled end (cite the field);
- the next-check deadline is its H2 cutoff (`nextCheckCutoff`).

Pin all four rows (active / not active × deadline before / after the end).

**S-9 · Server clock.** `GET /api/agent/cockpit-status` adds `serverNowMs: Date.now()` to its 200 body. `Cache-Control: no-store` stays.

**S-10 · The bench read (6A), flag on.** `GET /api/agent/cockpit-bench?battleId=…&callId=…` (`callId` optional).
- **Gate** (in this order): `requireAuth`, then the limiters (the `cockpit-status` precedent), then the battle is read, then:
  - owner, else `403`;
  - `resolveCallRecordsMode === 'on'` and the flag, else `404 cockpit_unavailable`;
  - when `callId` is given, the call must be an exit in the battle, else `400`.
- **Body:** `{ asOf, out: { symbol, slot } | null, rows: [...] }`. Each row has:
  - `symbol`, `name`, `sector`, `rank` (`technicalRank`), `price`, `changePct`, `atrPct`;
  - `status: 'available' | 'locked' | 'not_swappable' | 'no_price'`, and `lockedUntil`.
- **Rows:**
  - With `callId`: every name on the swap's lists for that slot's class. Status comes from `canComeIn` against OUT at `Date.now()`. Held names are omitted.
  - Without `callId` (browse): every bench-list name, with status from the lock alone.
- Prices, change and rank come from the rankings document the cron reads (`indexIntelligence/stockRankings`). `asOf` is its own computed time. Cite each field name at HEAD; a missing field is `null`, which renders "—".
- **No price, no pick.** A **stock** row with no usable price in that read (absent, non-finite or ≤ 0) gets status `no_price`. This follows D-3's rev-2 reasoning: delisted names stay on benches until the stale-universe work lands, and the sheet must not offer a name the executor will refuse.
  - Crypto rows are exempt, because the rankings carry no crypto. Their price shows "—" when unknown.
  - Filing is unchanged: the endpoint's D-7 check and the executor remain the authority.
- No model call. No write. `Cache-Control: no-store`.

**S-11 · Flag.** `COCKPIT_2B_ENABLED = false` in `featureFlags.js`, with:
- the accessor `isCockpit2bOn()`, read at call time;
- the `DARK_BY_DESIGN` mark;
- its pin in `flagPinGuard.test.js`, plus its own pin test.

Server and client read the same accessor.

**S-12 · Model-visible text (fenced-class coordinated review, contract V1.4 §2).**
- the `call_replace` text;
- the chosen-name `call_go` text, which must equal v1's counterpart form byte for byte with IN substituted;
- the chat calls block's `answered: Bring in X` and `answered: Go now, bring in X` lines.

Freeze each with a pin, and record the review in L2 (§12).

**S-13 · The 2b read (read-only).** Add `scripts/cockpit-2b-read.mjs`, modelled on `scripts/cockpit-week1-read.mjs`, with the same env-only account handling (no uid in any committed file). Per battle-day it prints:
- commands filed, by kind and by route (card chip, sheet, Exit-instead);
- replace confirmations and `replace_unconfirmed` refusals, from the server log if available, else marked unknown;
- chosen names by source (`agent` option, `bench` option, sheet-only);
- acted and no-matching-trade receipts on chosen names;
- `retired` events;
- Following-your-call counts;
- calls minted with `replacementOptions` and their fill (agent count, bench count);
- `counterpart_unavailable` refusals.

---

## 4. Client data

Readers stay as 2a built them (`useCalls`, `useMonitoring`, `useCallEvents`, `useCallObservation`, `useCockpitStatus`). Additions:

| Item | Source | Notes |
|---|---|---|
| Commands used | the **raw** battle document's `chatExchanges` (not the cockpit-gated projection), counted exactly as S-5 counts | one pure helper beside `answers.js`, imported by both sides |
| Server clock offset | `useCockpitStatus` → `serverNowMs − Date.now()` at receipt | refreshed on every status fetch |
| Live slot | `liveCallSlotOf` (2a) for a call-family slot | decides when an override shows the replace confirmation before sending. For an ordinary (chat) directive, the client does not judge liveness: the endpoint's `409 replace_unconfirmed` opens the same prompt (§6.3) |
| Eyeing names | the newest evaluation's `candidates` stamp and the newest `mintedMode === 'on'` declarations `watching` | the agent's own lists, live (the sheet's marker); a card's chips use the call's stored options |
| Bench rows | `useCockpitBench(battleId, callId)`: one fetch of S-10 when the sheet opens; refetched on reopen | no listener |
| Agent's note | the Bench pane's sentence selector (`PaneBench.jsx` reads it), filtered to the row's symbol | verbatim; nothing else (V5-7) |

---

## 5. The screen (flag on)

Desktop: the pane's Cockpit tab, as 2a. Phone: the Cockpit screen under the Board · Cockpit switch, as 2a. The pinned header, THIS TURN, the switch and the needs-you count stay as shipped. Top to bottom:

### 5.1 Top row
- "Prices as of the {t} check · next ~{t}", as 2a.
- **The commands meter:** seven dots, filled = left, then "· {n} left". This replaces "{n} messages left".
- At zero: "No commands left".
- `aria-label`: "{n} of 7 commands left".

### 5.2 The Now card
**Choice.** The card shows the first match in this order:
1. an **unanswered** exit + act call with null counterpart (the Who comes in case);
2. any other unanswered act-default call (a Confirmation with a named replacement, or an entry the agent will make);
3. an unanswered hold-default called shot;
4. the live command's own call (its status).

Within a priority, the card takes the thread whose **oldest** call was minted earliest, then the lowest `callId`. A new call never pushes aside an older one at the same priority, which keeps the card stable: in the discovery's count the lead changed at 31% of consecutive checks (C1). Upside calls and restatements under your command never lead.

**Spotlight.** An expanded strip chip offers "Spotlight →". It makes that thread the card until the thread is answered or resolved. This is client state only, never persisted.

**When nothing qualifies:** "Nothing needs you · {Agent}'s next check ~{t}".

**Anatomy:**
- **Eyebrow:** "{Exit call | Hold call | Entry call} · from the {t} check", with the state tag on the right.
- **The plan** (one sentence), from record fields only:
  - exit + act: "{Agent} plans to exit {SYM} if it goes {below|above} {$L} {deadline}."
  - exit + hold: "{Agent} calls {SYM} {below|above} {$L} {deadline}, and plans to hold it."
  - entry + act: "{Agent} plans to bring in {SYM}[ for {CP}] if it goes {below|above} {$L} {deadline}."
  - entry + hold: "{Agent} calls {SYM} {below|above} {$L} {deadline}, and plans to wait."
- **The silence line:** "If you say nothing, it {exits | holds | brings it in | waits}."
- **The facts line:** "{deadline} · {SYM} {price} · as of the {t} check".
- **Moved line and earlier levels (D-12):** when the card holds open calls at more than one level, the headline carries "Latest line · the {t} check". Under it: "Line moved {$A} → {$B}", the previous distinct level, then the newest. Tapping the marker expands the earlier open levels, newest first: "{below|above} {$L} · from the {t} check". Nothing on the card says "one call".
- **Coverage (D-12, condition 1):** while a command stands on the card, a call more than 1% from the answered call's level is a **new ask**. It leads the card with its own buttons and the Needs-you count includes it. The command shows beneath it as "Your command · on the {$L} line", never as covering the new line. Only calls within 1% (and meeting D-10) read "Following your call".
- **The buttons** (§6.2).
- **The step** (§5.3), when `replacementStepFor` says so.
- Under C-4, the agent's `said` appears only in the details sheet (2a §7.5), never on the card.

**After an answer** the card becomes the command card:
- eyebrow "Your command · on the {t} wording";
- **the canonical text, verbatim, from the directive record** (V5-2);
- the receipts: Filed {t} → Heard at the {t} check | not yet heard | no check left today → Acted / No matching trade / Retired / Replaced.

There is no "Change" (V5-3).

An acknowledgment shows "You agreed · {t}". On an exit + act call with null counterpart, the card **stays the Now card** after "Confirm exit" (an automatic spotlight) and keeps the step, so the player can pick (V5-6). It stays until the player picks, taps **Done**, or the call resolves.

**Tapping the card body** opens 2a's details sheet (§7.5 there), unchanged except for the new tags.

### 5.3 Who comes in?
- **Title:** "Who comes in for {SYM}?", with "Browse the bench →" on the right.
- **Two groups**, from the call's stored `replacementOptions`:
  - **"{Agent} is eyeing"** (`source: 'agent'`);
  - **"From your bench · by rank"** (`source: 'bench'`).
  An empty group is not drawn. Each chip shows the symbol and one bullet.
- Chips that no longer pass `canComeIn` at the server-clock now are drawn disabled, with "locked" or "in your book".
- Calls minted before 2b have no options; they show only "Browse the bench →".
- **On the card (exit + act):** a chip files `replace`. It is available before or after "Confirm exit" (V5-6).
- **After "Exit instead" (exit + hold):** the step opens in place of the buttons. Its foot carries "Let {Agent} choose ·●", which files `go_now` with no name, and "Cancel". A chip files `go_now` with that name (V5-4).
- **After a filing:** "✓ {IN} comes in if {SYM} exits · filed". The chips disable.
- At zero commands, the chips disable and the step shows "No commands left".

### 5.4 Also live
- **Header:** "ALSO LIVE · {n}".
- **Chips:** every other open thread (C-6, D-10 and D-12 folding), as "{SYM} {↑|↓} {level} · {word}", with the newest call's level. When the card holds open calls at more than one level, the chip adds "· line moved".
  - word: "exit" / "hold" / "enter" / "wait" for an unanswered call by its default;
  - "your command" (teal dot) for the live command's call;
  - "following" for a restatement under your command;
  - "upside" for an upside call;
  - "you agreed" for an acknowledged call.
- **Overflow:** phone shows 4 chips and desktop 6, then "+{n} more" / "fewer".
- **Tapping a chip** expands it in place to the card anatomy: buttons only when the thread needs you, the step when it applies, and "Spotlight →". Tapping again collapses it. Upside chips expand to the upside line only.

### 5.5 The day line
"Today · {calls} calls · {hit} hit · {expired} expired · you answered {n}", counted over this battle's `mintedMode === 'on'` calls:
- calls = records;
- hit = state `hit`;
- expired = `expired_unresolved`;
- answered = calls with a `playerResponse`.

A zero part is still shown. It is not tappable. Situations is not drawn (R2B-10).

### 5.6 Monitoring and Earlier
As 2a: chips open the research modal; Earlier lists resolved calls. Earlier is **collapsed** by default with its count, and each row reads "{SYM} {↑|↓} {level} · {tag}".

### 5.7 The bench sheet (6A)
Opened from "Browse the bench →" (scoped to that call) or the Research pill (browse). It uses 2a's sheet (modal bottom sheet on the phone, modal panel within the pane on desktop; focus trapped and restored; Escape closes).
- **Title:** "Who comes in for {SYM}?" when scoped, else "The bench".
- **Sub:** "{n} names · {a} available · prices as of {t}".
- **Sorts:** Rank · Today's move · Sector. Rank is the default.
- **Rows:** rank · symbol, plus an "{Agent} is eyeing" marker when on the agent's latest lists · sector · day % · ATR % · then the action:
  - when scoped and available: **Pick ·●**;
  - "locked until {t}";
  - "can't come in" for `not_swappable`;
  - "no price" for `no_price`;
  - "available" in browse mode.
- **The agent's note:** a second line under the symbol, the agent's own sentence about that name from its last check that carries words (V5-7), truncated to two lines and expanded on tap. Rows with no such sentence show nothing.
- **Tapping the symbol** opens the **existing** research modal over the sheet (V5-7); closing it returns to the sheet. The modal gains nothing.
- **A pick** files exactly what the same chip on the card would file (`replace`, or `go_now` with the name). The replace confirmation applies (§6.3).
- **After filing:** a bar at the top reads "✓ Filed · {canonical text}" with **Done**, and every Pick disables.

### 5.8 Board-row dots
`TacticalRow` gains an optional `callMark: 'command' | 'open' | null`, passed **only** when the flag is on and the battle is cockpit-on; the flag-off goldens photograph the row.
- teal = the live command's book symbol (`action.symbol`, or `swapOut` for a pick);
- neutral = any other open call's symbol.

The mark is a 6 px dot beside the symbol in `AssetSide` (B8), with `aria-label` "your live command" or "an open call". There is no second listener: the calls and the slot are already in scope where the rows are built.

### 5.9 The Research pill and the composer line
- **Research pill:** on the THIS TURN row (where V4 drew it), "Research" opens the bench sheet in browse mode. The pill is absent with the flag off.
- **Composer line:** while the slot holds a live **cockpit** command, the chat composer shows one line above the input: "Sending a directive replaces your cockpit command on {SYM}." `AgentChat` receives the slot's `family` and `action.symbol` as a prop. Adjust the phone chat sheet's peek height (`useChatSheet.js`, `SHEET_PEEK_PX`) and pin it.

---

## 6. Answers

### 6.1 Sending
As 2a §7.3:
- both buttons disable;
- the pressed one reads "Sending…";
- **no optimistic state**;
- errors appear as one line under the card (§7.3).

The body carries the belief (`expectedDirectiveThreadId`) as today.

### 6.2 Buttons (from the shared table; agreeing first)

| Call | Agrees (free) | Overrides (·●) |
|---|---|---|
| exit + act | **Confirm exit** (`go`) | **Hold off** (`hold`) |
| entry + act | **Go if it triggers** (`go`) | **Hold off** (`hold`) |
| exit + hold | **Hold** (`hold`) | **Exit instead**: with no usable counterpart, opens the step (§5.3), then files `go_now`; with one, files `go_now` directly |
| entry + hold | **Hold** (`hold`) | **Bring it in** (`go_now`) |
| upside | — | — |
| restatement under your command | — | — |

The bullet is one 6 px filled dot inside the button after its label. Its `aria-label` adds "· 1 command". At zero commands, override buttons read "No commands left" and are disabled. Agreeing stays.

### 6.3 The replace confirmation (D-2)
When an override (or a pick) is tapped and the slot holds a live call-family directive (§4), the card shows, before anything is sent:

"This replaces your command on {SYM} — "{canonical text}". {Agent} stops hearing it at its next check." with **[Replace ·●]** and **[Keep current command]**.

For a live **chat** directive: "This replaces your chat instruction — "{text}". {Agent} stops hearing it at its next check."

Replace sends the answer with `confirmReplace: true`. A `409 replace_unconfirmed` (the client didn't know the slot was live) opens the same prompt from the response's `currentText`.

---

## 7. Copy and tags

All Battle View copy lives in `battleViewCopy.js` (the honesty test requires it).

### 7.1 New and changed tags (`COCKPIT_FACT_TAGS`, one table; the coverage test extends to `retired`)

| Record fact | Tag | Tone |
|---|---|---|
| `outcome.actedEvalId` set, **whatever the state** (Acted wins) | Acted at the {t} check | acted |
| `retired` event | Command retired · {SYM} left the book at the {t} check (or "· {IN} came in another way") | muted |
| `superseded`, replacing exchange `source: 'cockpit'` | Replaced by your later command · {t} | muted |
| `superseded`, any other source | Replaced by a chat instruction · {t} | muted |
| `invalidated` with `invalidatedReason` | Dropped · {reason line} (§7.2) | dropped |
| directive filed, no check left in the session | Filed · no check left today | yours |
| restatement under your command (D-10), **and** its minting check's `declared` event carries `promptDirectiveThreadId` equal to the command's thread (D-10 rev 2) | Following your call | yoursOutline |

"No check left" means the battle's next decision time (`nextDecisionAt`) is absent or after the session close containing the filing (`horizon.js` `sessionCloseAfter`). The replacing exchange is found in `chatExchanges` by the event's `supersededBy` thread.

### 7.2 Dropped reasons (D-9)
- `level_implausible` → "price line out of range"
- `level_non_finite` → "no usable price line"
- `no_observation` → "no price at that check"

Cite the reason set at HEAD. Any reason not in the table → bare "Dropped".

### 7.3 Refusals (2a §8.3, changed rows)

| Response | Line |
|---|---|
| 409 `budget` | No commands left — nothing was filed. |
| 409 `replace_unconfirmed` | (opens §6.3; no line) |
| 400 `ineligible_action`, reason `pick_*` | {IN} can't come in right now — nothing was filed. |
| 400 `ineligible_action`, reason `counterpart_unavailable` | {CP} can't come in right now — nothing was filed. |
| 400 `ineligible_action`, reason `symbol_not_held` | {SYM} has already left your book — nothing was filed. |

Every other row stays as 2a. `directive_pending` keeps its 2a line for the flag-off path.

### 7.4 Words that never appear
Held off, Holding, Declined, Honored, Superseded, Asking you, Ask me first, add (for any upside call), suggests, offers. No line is attributed to the agent unless it is the agent's own recorded words (V5-7).

---

## 8. The server's clock for deadlines (from merge)

A card or chip stops offering answers at its deadline on **server** time, `Date.now() + offset` (§4). Each open card schedules one timer at its deadline, and the 60-second coarse tick no longer decides this. The endpoint still decides; this only removes buttons it would refuse.

---

## 9. Styling and motion

As 2a §9:
- `--ft-*` tokens only;
- the state aliases 2a added;
- every new top-level `battleView/` file joins both guard lists and baselines in the same commit, with a hand-written motion authority;
- `motionToken('smooth')` for card changes, chip expansion and the sheet, and `instant` under reduced motion.

The Now card is the shipped tile scaled up. It takes the V5 card's teal-outlined container, using existing tokens only. The bullet is the teal token. No new color, motion token or font.

---

## 10. Flags, activation and rollout

- **10.1** `COCKPIT_2B_ENABLED = false` (S-11). With it false, the 2a screen renders as shipped, plus the from-merge fixes, and the endpoint behaves as at HEAD for D-1, D-2 and D-4.
- **10.2 The flip** is a separate PR, merged after 6 PM ET: `COCKPIT_2B_ENABLED = true`, its pin update and the `DARK_BY_DESIGN` removal. No environment change; the allowlist already holds the founder and FT_QA.
- **10.3 Rollback:** set the flag back to false (one line). Records stay in place. Commands filed under 2b stay valid directives until they expire, retire or are replaced.

---

## 11. Tests (each with its exit code asserted; read the `Test Files` line; never pipe through `tail`)

**Server:**
- **D-1:** the count from mixed exchanges (cockpit/chat/chip, with and without a directive); the 7th accepted and the 8th refused; acks never counted; `chatBudgetUsed` untouched with the flag on and charged with it off; the league branch unchanged; `remaining`.
- **D-2:** each live class (call-family pending; ordinary active; killed; suppressed; expired), with and without `confirmReplace`; `replace_unconfirmed` not persisted and carrying its body; the stamp and `superseded` event on a confirmed replacement; the belief still enforced; flag off → `directive_pending` as at HEAD.
- **D-3:** order and fill (agent from candidates then watch list, deduped; bench by rank; unranked last; cap 4; agent filling all four; `[]`; `null` on every non-qualifying call); **a name the observation does not admit is skipped, agent and bench alike, while the same name stays a legal counterpart and a legal pick at filing**; immutability in the canonical form.
- **D-4:**
  - legality, including `replace` after `go`, `replace` after `hold`, a second `replace`, and `pickSymbol` on other pairings;
  - each eligibility reason;
  - the two texts (frozen pins); the v1 templates byte-identical;
  - `playerResponse.after`; both `answered` events; the identical-repeat path for both answers;
  - the chosen name absent from `playerResponse`.
- **D-5:** acted only for OUT→IN; OUT→other is a loud no-match and retires; v1 unchanged; the flip's `actedEvalId` binding.
- **D-6:** each book reason; non-book failures retire nothing; compare-and-clear against a newer slot; event id idempotence; the trade lookup; a timeout leaves the slot and does not throw; the in-memory directive dropped before the prompt (an integration test through the cron's hook with the prompt builder stubbed at its seam).
- **D-7:** `canComeIn` per reason, with parity against the executor; the mint knock-ons (watchlist-only and cross-class exit counterparts → null; an entry counterpart in another tier → null; the AMGN/PFE shape); `counterpart_unavailable` at filing.
- **D-8:** the four rows.
- **D-9:** each reason and null.
- **S-9:** `serverNowMs`.
- **S-10:** the full gate, row statuses, browse mode, held names omitted, no write.
- **Off-golden** byte-identical.
- **Readers** of `retired`.

**Client:**
- the Now card's choice on every priority, tie-break and spotlight;
- each plan, silence and facts sentence from fixtures;
- §6.2 from the shared table;
- the step on the card, before and after confirm, and after "Exit instead" (with a name, with "Let {Agent} choose", and Cancel);
- disabled chips; the meter at 7/1/0;
- the replace confirmation for a cockpit command and for a chat directive, and from a 409;
- every §7.1 row and the coverage test;
- **D-12 folding:** two Confirmations on one stock at levels 3% apart fold into one card; the newest open level is the headline; "Line moved $A → $B" and the expanded earlier levels; the buttons answer the newest; a call more than 1% from an answered call's level is a new ask (its own buttons, counted in Needs you, never "Following your call", the command shown "on the {$L} line") while one within 1% is covered; an older line that resolves leaves the card for Earlier; an exit and an entry on one stock stay two cards, as do two different defaults; no string on the card says "one call"; on the flag-off 2a screen too;
- D-10 folding: cross-default; the tag never on the answered call; **no tag when the minting check's `declared` event is missing or names another thread** (rev 2); unfolded again when the command stops being live;
- Acted wins on each terminal state;
- the server-clock deadline timer;
- the strip's word and overflow per shell;
- the day line;
- the bench sheet: sort, statuses, the note only from the selector, pick, the filed bar, the research modal over the sheet;
- board dots on both shells, with no prop when the flag is off;
- the Research pill; the composer line and the peek height; reduced motion.

**Off paths:**
- flag off: the 2a screen and the flag-off goldens unchanged except for the from-merge rows, each named in the report;
- `COCKPIT_UI_ENABLED` false: nothing renders and no request is sent.

**Guards:** honesty, token, motion, cssTokens and flagPinGuard all pass with the additions, none loosened. `vite build` exits 0.

---

## 12. Review, smoke, report

**Review (BUILD_RULES §2, mandatory at this size).** Lenses run on isolated snapshot trees, read-only on git. Every finding goes to a refuting verifier. The mutation battery runs last, with survivor proof.
- **L1** server and Amendment D fidelity (each D clause against its code and tests)
- **L2 model-visible text:** the two v2 texts and the two chat-block lines (fenced-class coordinated review)
- **L3** records and receipts: D-5, D-6, D-8 against live-shaped fixtures from the discovery's C5 and C6 cases (VLO, ZS, META)
- **L4** desktop UI against V5 and §1's corrections
- **L5** phone UI, accessibility, reduced motion
- **L6** copy and honesty: banned words; every tag and line traceable to a record fact; no invented agent words
- **L7** mutation battery

**Smoke branch.** `claude/cockpit-build2b-smoke` is the build HEAD plus one commit that:
- sets `COCKPIT_2B_ENABLED = true`;
- extends 2a's fixture mode (`?cockpitFixtures=1`) to cover every Now-card priority, the step in all three states, the meter at 7/1/0, the replace confirmation (cockpit and chat), every §7.1 row, the bench sheet in both modes with a locked, an unswappable and a no-price row, board dots, and the composer line, on both shells.

It is never merged. **Never click "Create PR" on it.** Its preview URL goes at the top of the report.

**Report.** `docs/audits/<YYYYMMDD>_BUILD2B_COCKPIT.md`:
- the preview URL first;
- what changed, in plain terms;
- every anchor that differed from the discovery;
- each STOP condition, met or not;
- the from-merge changes the flag-off goldens show;
- test totals; the review record;
- the deployment checklist (§13).

Out-of-repo copy per BUILD_RULES §3. Then commit, push, open the PR, and **STOP**: no merge, no flag flip, no CI watching.

---

## 13. Deployment checklist (after the build)

1. **Amendment D:** blessed with conditions (D-1 to D-11 on 2026-10-15, D-12 on 2026-10-16), and revision 4 folds every condition in. The build commits revision 4. Before merging, confirm the committed file is revision 4. Nothing further on the contract side gates the merge.
2. Founder smoke on the smoke-branch preview (both shells; desktop with `?cockpitFixtures=1`).
3. Astra review of the PR.
4. Merge after 6 PM ET (cron and endpoint changes), with CI green. From-merge fixes go live for the allowlisted owners at this step.
5. Flip PR (§10.2), merged after 6 PM ET.
6. The next trading day: the founder plays one battle and answers at least one exit with a pick. FT_QA answers calls too. Then run `scripts/cockpit-2b-read.mjs` (S-13) and the existing `--rollback-check` after each of the first five sessions.
7. The round-4 replay (text revision, R2B-8) runs as its own task. It does not gate this flip.
