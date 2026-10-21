# Call Record Field Contract V1.4 — Amendment D (revision 4)

**Date:** 2026-10-15 · **Revision 2:** 2026-10-15 · **Revision 3:** 2026-10-16 · **Revision 4:** 2026-10-16 · **Author:** Fable · **Status:** **blessed with conditions, all folded in.** The framework chat blessed D-1 to D-11 on 2026-10-15 (folded in revision 2) and D-12 on 2026-10-16 (folded in revision 4). No further round is needed.

**What revision 2 changes** (the framework chat's three conditions; no field is added or removed):
- D-3: an option is skipped when the minting check's own price snapshot holds no usable price for it.
- D-4: states that turning a `go` acknowledgment into the `replace` directive response is the one sanctioned rewrite of `playerResponse`.
- D-10: "Following your call" also requires that the restatement was minted at a check that heard the command's thread.

Blessed as written: D-1, D-2, D-5, D-6, D-7, D-8, D-9, D-11.

**What revision 3 changes** (founder report of 2026-10-16; no field is added or removed): adds **D-12, one card per stock plan**. It removes C-6's 1% level tolerance from the thread key, so lines the agent moved on the same stock fold into one card.

**What revision 4 changes** (the framework chat's two D-12 conditions, 2026-10-16; display rules only):
- D-10's 1% test decides whether a command **covers** a line, not whether the line joins the card;
- the card marks a moved line, keeps earlier levels on expand, and never calls the card "one call".

**Builds on:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` + Amendment A (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md`) + Amendment B rev 2 (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_B.md`) + Amendment C rev 3 (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_C.md`, blessed).
**Evidence:** the design pass `docs/design/COCKPIT_DESIGN_PASS_V1.md` (cited DP-n); the Build 2b discovery `docs/audits/20261014_PHASE0_BUILD2B_COCKPIT.md` (cited by part and section: A1…A5, B1…B10, C1…C7); the V5 mockup `docs/design/COCKPIT_V5_MOCKUP.html` with the founder's seven corrections of 2026-10-15 (cited V5-1…V5-7, listed in the Build 2b spec §1).
**Scope:** every clause has a writer or reader in Build 2b. The behavior changes at the answer endpoint (D-1, D-2, D-4) apply only while Build 2b's flag `COCKPIT_2B_ENABLED` is on; until that flip, Amendment C's standing conditions hold exactly as written. The record additions and honesty fixes (D-3, D-5 to D-10) apply from the merge.

---

## What this amendment does

Amendment C left two questions for Build 2b: how a replacement pick shares the agent's one directive slot with an override already in it (C-8), and how picks are assembled (C-7). The first live weeks answered both. The players answered 7 of 156 calls. The agent made 103 exit calls with no usable replacement. The one-at-a-time lock never fired (C4). One command outlived its stock for 11 prompts (C5).

So this amendment:
- gives the cockpit its own **7 commands** per battle and lets a new command **replace** the live one after the player confirms it (D-1, D-2);
- stores the **"who comes in?" options on the exit call** itself (D-3, replacing C-7's separate pick call), and gives C-8's replacement instruction its writer (D-4, D-5);
- **retires a command when its stock leaves the book** (D-6);
- applies **one "can this name come in?" test** everywhere a replacement name is shown, minted or filed (D-7). This is the framework chat's rule for 2b, applied to exits as well as entries;
- fixes three labels: **one expiry label** (D-8), **why a call was dropped** (D-9), and **Following your call** (D-10, amending C-6).

---

## D-1 · Commands: the cockpit's own budget

**Rule (flag on):** a battle allows **7 commands**. A command is an accepted directive answer at `POST /api/agent/call-response`. That covers `hold` on an act-default call, `go_now` with or without a chosen name, `replace`, and `pick`. Acknowledgments are never counted and never refused for budget.

- **The count is derived, not stored.** It is the number of entries in the battle document's `chatExchanges` with `source === 'cockpit'` and `hasDirective === true`. Each accepted directive answer appends exactly one such entry, and no other writer uses that source. The endpoint's transaction already reads that document and writes it on every directive answer, so two concurrent answers are serialized.
- **At the limit:** `409 refused`, reason `budget`, and nothing is written. A refused filing of any kind spends nothing.
- **Chat keeps its own 10.** The endpoint no longer charges `chatBudgetUsed`. Chat and the chip route charge it exactly as today.
- **League battles:** unchanged. The per-day budget branch stays as written. League battles route to the League arena and never reach the cockpit screen (`BattleViewScreen.jsx` routing; Build 2 discovery A7).
- The response's `remaining` is 7 minus the count after the filing. The client derives the same count from the same array, so the meter and the endpoint can never disagree.

**No new field.** This answers the discovery's fence question (B1, Q3). The fenced battle-document shape gains no key, and no counter collection is created.

---

## D-2 · One live command: replace, never refuse

**Rule (flag on):** the slot still holds one directive. A directive answer arriving while the slot holds a **live** directive files only when the request **confirms the replacement**.

- **Live** means either:
  - a call-family slot for which the endpoint's pending predicate holds (`isCallDirectivePendingAt`, with its kill and suppression inputs as today); or
  - an ordinary directive the next check would render: `isDirectiveActive(slot, parent)` holds, its thread is not killed (`deriveKilledDirectiveIds`), and the integrity mode is `'enforce'`.
- **The request:** the body gains `confirmReplace: boolean`, which is optional and defaults to `false`. The existing belief (`expectedDirectiveThreadId`) must still name the slot's thread. A stale belief is still `409 belief_mismatch`.
- **Without confirmation:** `409 refused`, reason **`replace_unconfirmed`**, with `{ currentDirectiveThreadId, currentText, currentCallId | null }` so the client can show what would be replaced. This refusal is **not persisted**. With the flag on, `directive_pending` is no longer produced. Refusals already stored stay as they are.
- **With confirmation:** the filing proceeds through the shared writer, which already records a replacement. A call-family prior gets the `supersedes: { directiveThreadId, at }` stamp on the new exchange and, at `'on'`, the `superseded` event, in the same transaction (Amendment B §3, `directiveWriter.js`). The replaced call's `playerResponse` is never rewritten.
- **A replacement costs one command** like any other command (D-1). Agreeing never meets this check.
- **Chat and the chip** keep replacing at any time, as today (Amendment C, Standing conditions). The composer gains a one-line notice while a cockpit command is live (Build 2b spec). That notice is a display change only.

This satisfies the framework chat's first rule for 2b: a replacement never silently evicts a heard override. It also makes the 7 commands spendable: under the 2a lock, a command filed at 10 AM held the slot until the close.

---

## D-3 · Replacement options on the exit call (supersedes C-7's placement)

**New field:** `calls/{callId}.replacementOptions`, of type `Array<{ symbol: string, source: 'agent' | 'bench', rank: integer | null }> | null`.

**When it is minted:** on every newly minted called shot or Confirmation whose `direction` is `'exit'`, whose `counterpart` is null after D-7, and whose state at mint is not `invalidated`. This applies at `'shadow'` and `'on'`, as C-2 to C-5 do. It is `null` on every other call: entries, picks, exits with a usable counterpart, and invalidated calls. It is `[]` when a call qualifies but no name passes.

**What can be an option:** a name that meets both of these at the model seam:
- it passes D-7's test as the incoming name for the call's symbol in the call's slot. The held set, the locked set and the bench lists are frozen at the check's `promptBuiltAt`, as C-3's are;
- **(rev 2)** the minting check's own price snapshot holds a usable price for it: the model seam's observation admits it (`observation.symbols`, `observe.js` `buildObservation`, which admits only a settlement-usable quote fetched at or before the instant).

Since #966, an unusable quote leaves the price absent. A name with no usable price is therefore skipped, agent and bench names alike. That covers delisted names (EA, AVB, EQR, WBD) that stay on benches until the stale-universe work lands. This rule applies to **options only**: D-7 and filing are unchanged, and the executor stays the final check.

**Order and fill, at most four:**
1. **`'agent'`** — names the agent itself listed at that check, in this order, without repeats:
   - its anticipation candidates (the evaluation entry's `candidates` stamp, in stamp order);
   - then its declarations `watching` list (in list order).
2. **`'bench'`** — the remaining passing names, by the platform's `technicalRank` at that check (the rankings the check's prompt rendered), ascending. Unranked names follow, in roster order.

Agent names come first and may fill all four.

- `rank` is the name's `technicalRank` at that check, or null when it has none.
- The field is immutable and enters the canonical form that publication compares.
- **Labels:** `'agent'` reads **"{Agent} is eyeing"**: the agent's own lists, never "suggests" or "offers". `'bench'` reads **"From your bench · by rank"**: the platform's rank, which is not a score the agent produced (B5). No display says the agent offered a choice.
- **The options do not limit the pick.** The player may name any name that passes D-7 at filing (D-4); the bench sheet offers them all.
- **Supersedes C-7:** no assembled pick call is ever minted. C-7's `origin` field is withdrawn. Its `options[].source` meaning now lives only in `replacementOptions[].source`. Pick calls the agent declares itself are unchanged.

Basis: at the founder's 88 readable minting checks, the agent's own lists held at least one available name for 58 exits (66%) and at least two for 39 (44%). The bench showed at least two at 87 (C3).

---

## D-4 · Naming who comes in: `replace`, and `go_now` with a chosen name (C-8's writer)

**Registry:** `callActions.v2`. The three v1 kinds keep their templates byte for byte. Every filing after the change carries `textVersion: 'callActions.v2'`.

**The legality table (`answers.js`, flag on) gains two rows:**

| Call | Answer | Row | Kind filed |
|---|---|---|---|
| exit, `defaultAction` act, `counterpart` null, not upside | **`replace`** + `pickSymbol` (required) | directive | **`call_replace`** |
| exit, `defaultAction` hold, `counterpart` null, not upside | **`go_now`** + `pickSymbol` (optional) | directive | `call_go` with a chosen name |

- `go_now` without `pickSymbol` is v1's `call_go`, unchanged.
- `pickSymbol` on any other pairing is `400 illegal_answer`.

**The one second answer:** `replace` is legal when the call has no `playerResponse`, **or** when its `playerResponse` is the `go` acknowledgment (the player confirmed the exit, then names who comes in). Every other pairing keeps `409 already_answered`.

**(rev 2) This is the one sanctioned rewrite of `playerResponse`.** On that second answer, `playerResponse` becomes the directive response and keeps the acknowledgment it follows in `after`. Both `answered` events stay. Nothing else ever rewrites a `playerResponse`. D-2's rule that a replaced call's `playerResponse` is never rewritten is untouched: that rule is about another call's answer, and this is the answering call's own second answer.

The directive response:
`{ answer: 'replace', kind: 'directive', directiveThreadId, callId, filedAt, heardEvalId: null, after: { answer: 'go', filedAt } }`.

The acknowledgment's `answered` event stays, and the `replace` gets its own. An identical repeat of either answer returns the stored response, as step 4 does today.

**Eligibility at filing (fresh parent; `400 ineligible_action` otherwise):**
- the call's symbol (OUT) is still held in the call's slot (`symbol_not_held`);
- the chosen name (IN) passes D-7 against OUT and the slot at the filing instant. The reasons are `pick_not_on_bench`, `pick_already_held`, `pick_locked`, `pick_wrong_class` and `pick_is_symbol`.

IN need not be one of `replacementOptions`.

**Canonical text (model-visible; fenced-class coordinated review, contract V1.4 §2):**
- `call_replace`: **`If you exit ${OUT} ${deadlineText}, bring in ${IN}.`** For example: "If you exit AMD by today's close, bring in DHR."
- `call_go` with a chosen name: **v1's `call_go` template, with IN in the counterpart clause**: `If ${OUT} ${side} ${fmtPrice(level)} ${deadlineText}, go ahead and exit for ${IN}.` These are the same words the agent already reads when it names its own replacement.

**Slot:** the family's existing layout (callActions.js), with:
- `kind`;
- `action: { direction: 'exit', symbol: OUT, slot, pickSymbol: IN }`;
- `answerId = answerIdOf(callId, answer, IN)`;
- `expiresAtMs` = the call's directive lifetime (`callDirectiveExpiresAtMs`).

This is C-8's slot shape. **The chosen name lives in the directive's record** (`action.pickSymbol`), never on `playerResponse`, as for a pick (Build 1a, `callsBlock.js` note).

**Answer words:** `replace` → "Bring in". The `answered` event reads "Answered: Bring in DHR — If you exit AMD by today's close, bring in DHR." The chat calls block, which is model-visible to the chat model, reads `answered: Bring in DHR`, and for `go_now` with a name, `answered: Go now, bring in DHR`. Both lines join the fenced-class review.

---

## D-5 · Receipts for a chosen name

For an exit call whose directive answer carries a chosen name (D-4):

- **Acted:** the whole-trade match binds the chosen name, the way a selected pick binds a pick call today (`flip.js` `selectedPickFor`, `heard.js` `selectedPickOf`). The call is acted only by a committed trade in its slot with `symbolOut` OUT and `symbolIn` IN. This governs both the flip's `outcome.actedEvalId` and the heard pass. So an agent exit of AMD for CEG under a live "bring in DHR" leaves the call un-acted. It may still be `hit` by its condition.
- **No matching trade:** at a check that heard the thread, any present, parsed executor result other than OUT→IN is a non-matching trade. That includes OUT leaving for another name, which reads "The agent exited AMD for CEG at the 1:45 PM check — not the selected DHR". The shot's silent "leg traded" case does not apply, because the request **is** the name.
- **Retirement (heard pass):** an acted directive is retired. A directive whose OUT was traded for another name is retired too, since OUT is gone (the pick precedent).

The v1 rules are unchanged for every other directive.

---

## D-6 · Retire on exit: a ninth event kind, `retired`

**Rule:** a live command is retired when the stock it is about leaves the book, by any route.

- **Where:** at every check at resolved `'on'`, after the last route that can move the book before the prompt is built (the risk loop, B3 route 2), and before the prompt's directive is resolved. Only when the in-memory slot is call-family: the cron re-reads the parent in one bounded transaction.
- **When:** the slot's stored action now fails the filing test (`isCallActionEligible`, with its selected or chosen name) for a **book** reason:
  - `symbol_not_held` (exit);
  - `counterpart_not_held` (entry with a counterpart);
  - `swap_out_not_held` (pick);
  - `pick_already_held`: a chosen or selected name that has come into the book another way.

  Other failures are not book reasons and retire nothing here.
- **What:** compare-and-clear on the fresh parent (`retireCallDirective`) and, in the same transaction, a `retired` event. The check's prompt is then built without the directive, because the in-memory battle drops it after the commit.
- **The event:**
  - id `${directiveThreadId}:retired`;
  - `callIds: [slot.callId]`;
  - evidence `{ evalId, promptBuiltAt, checkLabel }`;
  - extra `{ symbol, reason, trade: { symbolOut, symbolIn, at, source } | null }`, the trade row that moved the stock, from the battle's trade log, when one is found;
  - text "VLO left the book at the 1:17 PM check · command retired." or "DHR came into the book another way at the 1:17 PM check · command retired."
- **Routes after the prompt** (the agent's own trade, a guardrail exit in the suppression pass, a gameplan leg): the heard pass retires on acted (D-5 and v1). Otherwise the next check's step does.
- **Failure:** a timeout or error leaves the slot exactly as today, is logged, never throws, and never delays the prompt past its ceiling.

Basis: the VLO command rode 11 prompts after the risk loop sold VLO (C5). Routes and seams: B3.

---

## D-7 · One "can this name come in?" test (aligns C-3 with the filing check)

**The test.** A name IN can come in for OUT in slot S at instant t when all of these hold:
1. IN is on a list the swap accepts: the battle's bench stocks, its bench crypto, or its hot bench. A name on the equipped watchlist alone does not count.
2. IN is not held in any tier.
3. IN is not cooldown-locked at t: its bench row's `cooldownUntil` is not after t.
4. IN is not OUT.
5. IN is the same asset class as OUT (crypto for crypto, stock for stock), read as the swap reads it (`isCrypto`, or a `.CC` suffix for the outgoing row; hot-bench names are stocks).

This restates the executor's own validation (`agentSwapExecution.js`, fenced: read and cited, never edited) as one pure function in `api/_utils/callRecords/`. A parity test pins the two together. If the executor exports its validation, the test calls it, which BUILD_RULES §1 permits.

**Where it applies:**
- **at mint**, at the model seam: C-3's exit counterparts (this replaces C-3's exit rule) and D-3's options;
- **at filing**: the chosen name (D-4), and the agent's own exit counterpart on a `call_go`. A counterpart that no longer passes is `400 ineligible_action`, reason `counterpart_unavailable`;
- **in the bench sheet**, which decides what can be picked;
- **in D-6's retirement**, for a chosen name already held.

**Entries:** an entry's counterpart is kept at mint only when it is held **in the call's own slot tier** at the seam. This is the filing check's `counterpart_not_held` test, and it replaces C-3's "held at the seam". It is the framework chat's second 2b rule.

**Knock-on effects (to be pinned):**
- Exits that named a watchlist-only or cross-class counterpart, kept under C-3, now mint with `counterpart` null and `counterpartRaw` set. They get D-3's options. Their `call_go` text ends "…go ahead and exit." unless the player names a replacement.
- An entry whose counterpart sits in another tier mints `counterpart` null with `counterpartRaw` set. The window held one such case: AMGN entry in core, counterpart PFE held in support (C3). Its `call_go` text loses "for PFE", and its acted match's other leg is unconstrained, as C-3 describes for a null counterpart.
- Records already minted stay as written.

---

## D-8 · One expiry label

**Rule:** for an open call under a parent that is **no longer active**, the sweep compares the call's deadline with the battle's end before choosing the state. The deadline is `horizon.expiresAt`, or the H2 cutoff for `next_check`. The end is the parent's completion instant (`completedAt`) or, when that is absent, the battle's scheduled end.
- deadline at or before the end → `expired_unresolved`, with the reason the active-parent path would give (`past_deadline` / `unobserved`);
- deadline after the end → `ended_with_battle`, as today.

Under an active parent nothing changes. Records already written are not rewritten.

Basis: in week 1, the same close-of-day deadline read "Expired" or "Battle ended" depending only on when the sweep ran (44 `ended_with_battle`; sweep lag up to 31 minutes, C7).

---

## D-9 · Why a call was dropped

**New field:** `calls/{callId}.invalidatedReason: string | null`.
- For a call minted `invalidated`, it is the mint's reason: the value `invalidationReason` already returns and already writes into the declarations record's `minted[]` (B4).
- It is null otherwise.
- It is immutable and enters the canonical form.

A display maps each reason to one short line through a fixed table ("Dropped · price line out of range"). An unknown or absent reason reads "Dropped".

---

## D-10 · Following your call (amends C-6; a display rule, records unchanged)

**Rule:** while a command is **live** (C-6 rev 3's live test), a call is a **restatement under the command** when all of these hold:
- it is open and was minted after the command was filed;
- it matches the answered call on `symbol`, `direction`, `slot` and `condition.side`;
- its level is within **1%** of the answered call's level;
- its `defaultAction` is the default the command asked for: `call_go` → act, `call_hold` → hold, `call_replace` → act;
- for a command with a chosen name, its own `counterpart` is null or that name;
- **(rev 2) it was minted at a check that heard the command's thread.** The `declared` event of its minting check (`${evalId}:declared`) carries `promptDirectiveThreadId` equal to the command's `directiveThreadId`, which means the command was in that check's prompt (publish.js: prompt inclusion, from the check's committed, unsuppressed heard stamp). With no such event loaded, or a different thread, the label is not shown.

This ties the label to the record and not only to timing, under the standing rule against implying the agent acted because of an answer. The label states prompt inclusion and a matching plan, never causation.

A restatement:
- joins the answered call's thread **even when its `defaultAction` differs from the answered call's**. This is the one exception to C-6's key;
- reads **Following your call**;
- is offered no answer.

The answered call keeps its own tag and receipts. **"Following your call" is never shown on the call the player answered** (V5-5). When the command stops being live, these calls fold by C-6's ordinary key again.

Basis: the six ZS restatements of Oct 9 and three META restatements of Oct 12 each matched the command's default and level. Today each one was a separate Needs-you tile (C6, B4).

---

## D-11 · Amendment C housekeeping

Build 2b's first commit applies these to `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_C.md`, and nothing else in it:
- **Header:** "Status: draft for blessing (framework chat). Blessing gates the Build 2a **merge**." becomes "Status: **blessed** (framework chat, 2026-10-04/05). C-1 to C-6 live since Build 2a (#928, #930). C-7's placement is superseded by Amendment D-3; C-8 has its writer in Amendment D-4/D-5."
- **C-7 and C-8:** one line under each heading pointing to the D clause that supersedes or implements it.

---

## D-12 · One card per stock plan (amends C-6's level rule; display only, records unchanged)

**Why.** On 2026-10-16 the founder came back to the cockpit after 90 minutes and found two LLY Confirmation tiles:
- "below $1,199.76" (from the 12:00 PM check, restated at 1:15 PM);
- "below $1,240.00" (from the 1:00 PM check).

There were also two BLK tiles: "below $1,129.74" (12:45 PM) and "below $1,107.53" (1:00 PM, restated at 1:15 PM). That is four Needs-you tiles for two stocks, with nothing saying which line the agent holds now. The agent had **moved its line** on each stock. C-6 folds only restatements within 1%, so each move became a new tile.

**Rule (card membership):** two **open** calls in one battle on one ET trading day belong to one card when their **plan** matches, at **any level**. The plan is C-6's key minus the level: ET date, `symbol`, `direction`, `slot`, `condition.side` and `defaultAction`. In code, only the level comparison (`levelsWithin`) leaves the fold (`cockpitModel.js` `foldThreads`). D-10's cross-default exception for restatements under a command stands.

**Rule (coverage; revision 4, framework condition 1):** D-10's 1% test against the answered call's level stays, and it now decides **coverage**, not membership.

A call folds into a card that holds an answered call but sits **more than 1%** from the answered call's level. That call is a **new ask** on the card:
- it shows in Needs you with its own answer buttons;
- it is never tagged "Following your call";
- the standing command is never shown as covering it.

When the card shows the command, the command names the line it was given on: "Your command · on the $1,240.00 line". Only calls within 1% of the answered level (and meeting D-10's other tests) can read "Following your call".

**The card (revision 4, framework condition 2):**
- **The headline** is the **newest open call's** level and default, the agent's latest line on that stock, with "Latest line · the {t} check".
- **A moved line is marked:** when the card holds open calls at more than one level, it reads "Line moved $1,240.00 → $1,199.76". That is the previous distinct level, then the newest.
- **Earlier levels show on expand:** each with its level and its check, newest first ("below $1,240.00 · from the 1:00 PM check").
- **The card is one card for several records** and never says "one call". Counts of calls (the day line) count records; the Needs-you count counts cards.
- C-6's "Restated at the {t} check" stays for a same-level restatement.

**Answers** go to the newest call, as C-6 says, except that a new ask (above) is offered its own answers while a command stands on the card. The live-answer rule (C-6 rev 3) is otherwise unchanged. With the 2b flag on, answering a new ask while a command is live goes through D-2's replace confirmation. With it off, Amendment C's one-at-a-time rule applies.

**Records are unchanged.** Every call keeps its own record, receipts and grading. When an older line resolves (hit or expired), it leaves the card and appears in Earlier under its own tag. Resolved calls never join a card.

Different plans for the same stock still show as separate cards: an exit and an entry, opposite sides, or an act and a hold default. That keeps C-6's protection that an agreed Confirmation never folds with a later "I'll hold" call.

## Field summary

| Document | Field | Type | Clause | Written |
|---|---|---|---|---|
| `calls/{callId}` | `replacementOptions` | `Array<{ symbol, source: 'agent' \| 'bench', rank: integer \| null }> \| null` | D-3 | at mint, from merge |
| `calls/{callId}` | `invalidatedReason` | `string \| null` | D-9 | at mint, from merge |
| `calls/{callId}` | `playerResponse.after` | `{ answer: 'go', filedAt } \| absent` | D-4 | at `replace` after `go`, flag on |
| `callEvents/{id}` | kind `retired` | event | D-6 | from merge |
| battle directive slot | kinds `call_replace`; `call_go` with `action.pickSymbol` | `callActions.v2` | D-4 | flag on |
| answer endpoint body | `confirmReplace` | `boolean`, optional | D-2 | flag on |

**Withdrawn:** `calls.origin` and pick `options[].source` (C-7, never written).
**Changed meaning, no new field:** `calls.counterpart` (D-7: one test for exits and entries); `chatBudgetUsed` is no longer charged by the answer endpoint (D-1, flag on).

---

## Standing conditions (restated)

- There is no "held" fact. No display says "Held off" or claims the agent held because of an answer.
- There is no "Asking you" state until the ask route ships (Build 1b).
- **One live command (flag on).** The slot holds one directive.
  - A directive answer while a live one exists files only with the player's explicit confirmation, and the replacement is recorded by the `supersedes` stamp and the `superseded` event.
  - Chat and chip filings replace as before.
  - The heard pass, the sweep and D-6 retire a call directive.
  - A kill ends its liveness.
  - Until the flip, Amendment C's "One override at a time" holds as written.
- **Commands:** 7 per battle, derived from the cockpit's own filings. Chat's 10 belong to chat alone.
- **The agent's words only.** No display attributes words to the agent that are not its own recorded words:
  - a `said` only when `saidOk === true`;
  - a note on a bench name only from the agent's recorded rationale at a check (the Bench pane's sentences, D-103's rule for flags unchanged);
  - "eyeing" only for names on its own lists.
- Records are frozen in place on rollback. Nothing is deleted or rewritten.
- Model-visible text goes through fenced-class coordinated review (contract V1.4 §2). In 2b that means the two v2 texts (D-4) and the chat calls block's two answer lines.

---

## Blessing record

**Framework chat, 2026-10-15: blessed with conditions.** Blessing gates the 2b merge, not the build.
- **Blessed as written:** D-1, D-2, D-5, D-6, D-7, D-8, D-9, D-11.
  - D-1 was verified at `origin/main`: `chatExchanges` is append-only (`arrayUnion` in `directiveWriter.js`) and not owner-writable, so the derived count can be neither trimmed nor forged.
  - D-7 closes the framework chat's standing 2b note: C-3's mint counterpart rule is aligned with `counterpart_not_held`.
- **Folded in revision 2, no further round:**
  - D-3's usable-price rule;
  - D-4's sanctioned-rewrite wording;
  - D-10's heard-thread grounding.
- **Framework chat, 2026-10-16: D-12 blessed with two conditions**, both folded in revision 4 with no further round: the 1% test decides coverage, not card membership; and the moved-line marker, with earlier levels on expand and the card never called "one call".
- **Still required:** fenced-class coordinated review of the model-visible texts, in the build. These are the two `callActions.v2` templates and the chat calls block's two answer lines.
