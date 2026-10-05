# Call Record Field Contract V1.4 — Amendment C (revision 3)

**Date:** 2026-10-03 · **Revision 2:** 2026-10-04 · **Revision 3:** 2026-10-05 · **Author:** Fable · **Status:** draft for blessing (framework chat). Blessing gates the Build 2a **merge**.
**Builds on:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` + Amendment A (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md`) + Amendment B rev 2 (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_B.md`).
**Evidence:** the Build 2 discovery, `docs/audits/20261002_PHASE0_BUILD2_COCKPIT.md` (cited D-A1…D-A11, D-B1…D-B10); round 3, `docs/audits/20261002_DECLARATIONS_WORDING_ROUND3.md`; the Build 2a report, `docs/audits/20261003_BUILD2A_COCKPIT_SCREEN.md` (cited 2A-§n and its finding ids).
**Scope:** C-1 to C-6 have writers and readers in Build 2a. C-7 and C-8 are **reserved for Build 2b**: defined and blessed now, with no writer or reader until 2b.

**What revision 2 changes** (all from the Build 2a review, 2A-§11; no field is added or removed):
- C-1: the validation clause now describes HEAD's actual rules for `declarations.watching` (2A L1-4).
- C-3: the cooldown-locked set's source is named; "usable" is the enumerated list only; the clause lists its knock-on effects on model-visible directive text and on the acted match (2A L1-3, L1-5, L2-2).
- C-6: the thread key adds `defaultAction` (2A framework-chat item).
- C-8: names the single-slot question Build 2b must resolve.
- Standing conditions: one override at a time is recorded as the rule for 2a.

**What revision 3 changes** (founder rulings of 2026-10-05 on the Build 2a polish review, 2A-§13.9; no field is added or removed). Each rewritten passage states what the code does and cites the tests that pin it:
- C-2: names the exact refusals an upside call returns: `400 illegal_answer` (reason `upside_call`) for the six Build 1a answers, and `400 deferred` for `ask` and `keep` (2A P2-5).
- C-3: the knock-on bullets are corrected. Only the `call_go` text names a counterpart. The whole-trade match checks the other leg only against a stored counterpart. Legality has no counterpart dimension; the `counterpart_not_held` check covers `call_go` and `call_hold` on an entry (2A P2-3).
- C-6: defines a **live** directive answer: its directive is still the battle's current directive, by the same live-slot test the tile uses for "Filed · not yet heard". Once it leaves the slot, the thread offers answers on its newest call again (2A P1-1).
- C-8 and Standing conditions: "a heard call directive keeps the slot until its deadline" is replaced by what the code does. A live call directive refuses another call's directive answer while it stays live; chat and chip filings replace it at any time; the heard pass and the sweep retire it; a kill ends its liveness (2A P2-4).

---

## Why this amendment exists

The Build 2 discovery measured what the agent actually writes under the 1A-C text. Four things in the records would make the cockpit say something false or show nothing:

1. The agent writes its watch list at the top level of its answer, not inside `declarations`. The tile's field is filled on 2 of 386 calls; the top-level list on 225 (D-B4).
2. 58 of 106 "entry" calls name a stock the agent already holds (D-B7). Rendered as an entry, a tile would say "then I bring it in" about a stock that is already in.
3. 23% of counterparts are not stock names ("TBD", "entry", "N/A", "SNOW or INTC") (D-B5).
4. The said lint's verdict reaches a reader only per check, not per call (D-A3, D-A4).

It also stamps the mode a record was minted under, so a screen can tell live-cockpit records from shadow-era ones (D-A6), and it fixes the rule for calls the agent restates at consecutive checks (D-B6).

---

## C-1 · Watching source

**Today:** the cron hands the calls validator `toolUse.input?.declarations` only (`api/cron/agent-evaluate.js:2862`).

**Rule:** when the `declarations` object carries no non-empty `watching` array, the validator reads the tool input's **top-level** `watching`, if it is an array, and validates it with **exactly the rules that apply to `declarations.watching` at HEAD**. (At HEAD those rules apply no universe check and no de-duplication. This amendment does not add either; adding them would change shadow and on records and needs its own clause.)

- A model call with no usable `declarations` object but a valid top-level `watching` list becomes a **watching-only declaration**: it writes the declarations record and mints no call.
- Only `watching` is read from the top level. Top-level `fork` and `playerAsk` stay ignored.
- Capture happens only on a valid trade result, as today (`agent-evaluate.js:2851-2866`).

**New field:** `declarations/{evalId}.watchingSource: 'declarations' | 'top_level' | null` (null when the record carries no watching list).

---

## C-2 · Upside calls

**Rule:** every newly minted called shot or confirmation carries `heldAtMint: boolean` — true when the call's `direction` is `'entry'` and its symbol is held at the check's model seam.

A call with `heldAtMint: true` is an **upside call**:
- It is displayed with the upside line: symbol, side, level and deadline, with **no action clause** (e.g. "AMD above $625 by today's close").
- It accepts **no answers**. `POST /api/agent/call-response` returns `400 illegal_answer` with reason `upside_call` for each of the six Build 1a answers on it (`go`, `hold`, `go_now`, `pick`, `agree`, `disagree`), whatever its `defaultAction`, and writes nothing. That check follows the ones every request meets: the wire, the rate limit, the battle, its owner and mode, and the call's existence. The two answers deferred to Build 1b, `ask` and `keep`, never reach the call: they return `400 deferred` before anything is read, as on every call. Pinned by `call-response.test.js`: "every 1a answer on a heldAtMint call → 400 illegal_answer (reason upside_call), nothing written — whatever its default" and "ask and keep → 400 deferred, nothing read, nothing written (Amendment B §2)".
- It is graded like any call (hit, expired, ended with battle, invalidated).
- Every renderer of calls — the cockpit tile and the chat calls block — uses the upside line for it.

Records without the field (minted before this amendment) are read as `heldAtMint: false`.

---

## C-3 · Counterpart usability

**Rule:** at mint, `counterpart` is kept only when it is **usable**. Usable means exactly the following, and nothing else:
- **On an exit:** a symbol in the check's universe that is not held at the seam, is not the call's own symbol, and is not cooldown-locked. The locked set is frozen at the same model seam, from the battle's bench as of the check's `promptBuiltAt`.
- **On an entry:** a symbol held at the seam (the position the entry would replace), other than the call's own symbol.

Watchlist-only names and stock↔crypto pairs are **not** excluded by this clause, even though the swap would refuse them; they stay usable as written.

Otherwise `counterpart` is stored as `null`, and the agent's original string, trimmed to 40 code points, is kept in the new field **`counterpartRaw`** (null when the counterpart was usable or absent). Renderers read only `counterpart`. `counterpartRaw` exists for audits and the Film Room, never for player-facing copy.

**Knock-on effects (reviewed in Build 2a, 2A L1-5 / L2-2; pinned by `amendmentC.test.js`):**
- **Model-visible directive text:** only the `call_go` text names a counterpart, and only a stored one: "…go ahead and exit for JPM." or "…bring it in for KO.". With `counterpart` null it ends "…go ahead and exit." or "…bring it in.", so an unusable counterpart is no longer named ("…exit for TBD." becomes "…exit."). The `call_hold` text, "Hold off on the {symbol} {entry|exit} until {deadline}.", never names a counterpart, and C-3 changes nothing in it. Pinned by `amendmentC.test.js` ("consumer 1 — …", "rev 3 — the rest of each consumer: …") and `callActions.test.js` ("hold: …", "go_now: …").
- **The acted match:** the whole-trade match (`flip.js` `matchesWholeTrade`, which decides `acted` for the flip and for the heard pass) checks the trade's other leg only against a non-null `counterpart`. With `counterpart` null, a committed trade in the call's slot acts an exit when it takes the call's symbol out, whatever comes in, and an entry when it brings the call's symbol in, whatever goes out. So an exit whose counterpart was "X or Y" is acted by any committed trade in its slot that exits its symbol. Pinned by `amendmentC.test.js` ("consumer 2 — …", "rev 3 — the rest of each consumer: …") and `flip.test.js` ("entry: incoming symbol + resolved slot + declared counterpart").
- **Answer eligibility:** the legality table (`answers.js`) has no counterpart dimension, so C-3 changes no call's legal answers. It changes the filing check (`callActions.js` `isCallActionEligible`): a `call_go` or `call_hold` on an entry is refused `400 ineligible_action`, reason `counterpart_not_held`, when its stored counterpart is not held in the call's slot at filing. A counterpart stored null skips that check, so an entry whose named counterpart was not held at mint is never refused for it. Pinned by `amendmentC.test.js` ("consumer 3 — …", "rev 3 — the rest of each consumer: …") and `callActions.test.js` ("call_hold / call_go on an ENTRY: …").

---

## C-4 · Per-call said verdict

**Rule:** every newly minted call carries **`saidOk: true | false | null`** — the said lint's verdict on that call's own `said` (`null` when it has no `said`). The lint is the existing one (`api/_utils/callRecords/copy.js`), unchanged.

A display shows a call's `said` only when `saidOk === true`, labelled as the agent's own, unverified wording, and never on an upside call. The declared event's per-check `saidOk` is unchanged.

---

## C-5 · Mint mode

**Rule:** every new call and declarations record carries **`mintedMode: 'shadow' | 'on'`** — the battle's resolved mode at the check that minted it.

- Cockpit readers show only records with `mintedMode === 'on'`. Records without the field predate this amendment and are not shown.
- No backfill. Records stay frozen in place on rollback, as before.

---

## C-6 · Restated calls (a display rule; records unchanged)

**Rule:** two **open** calls in one battle on one ET trading day belong to one **thread** when their `symbol`, `direction`, `slot`, `condition.side` and **`defaultAction`** match and their levels are within **1%** of each other (measured against the newer call's level).

- A display shows **one tile per thread**, carrying the newest call's wording.
- Each call keeps its own record, answer, receipts and grading. Nothing is merged in Firestore.
- While any call in a thread carries a **live directive answer**, displays offer no new answer on that thread and show that answer, naming the wording it was given on. A directive answer is **live** while its directive is still the battle's current directive: the slot holds a live call directive whose thread is the answer's own. This is the same live-slot test the tile uses for "Filed · not yet heard" (`cockpitModel.js` `liveCallSlotOf`, the endpoint's pending predicate without its same-call exemption). Once the directive leaves the slot or stops being live there (replaced, retired, killed, suppressed or past its lifetime), the thread offers answers on its newest call again, under the rules every tile follows, and still shows the earlier answer, naming its wording. Pinned by `cockpitModel.test.js`: "THE LIVE-ANSWER RULE: …" and "C-6 rev 3 — once the answer LEAVES the slot …".
- Resolved calls never join a thread.

Basis: about 1 kept called shot in 11 repeats the previous check's (D-B6). `defaultAction` is in the key so that a Confirmation the player agreed to never folds with a later "I'll hold" call.

---

## C-7 · Assembled picks (reserved for Build 2b)

Pick calls gain **`origin: 'declared' | 'assembled'`**, and each entry in `options[]` gains **`source: 'agent' | 'bench'`**:
- `'agent'` — the agent named the symbol at that check (as a counterpart or an entry candidate).
- `'bench'` — the platform chose the symbol from the bench by a stated, deterministic rule that Build 2b's spec fixes.

Displays name the source of every option. An assembled pick never claims the agent offered a choice. **No writer or reader in 2a.**

---

## C-8 · Replacement instruction (reserved for Build 2b)

A new call-directive action, **`call_replace`**, in a new registry version **`callActions.v2`**: "if you exit OUT before the deadline, bring in IN."

- **Slot:** `{ expiry: 'until_ms', expiresAtMs, symbol: OUT, pickSymbol: IN, kind, callId }`, where `expiresAtMs` is the originating exit call's horizon.
- **Receipts:** heard, as today; **acted** when an executed swap has outgoing OUT and incoming IN; **no matching trade** otherwise.
- Its canonical text is model-visible and goes through fenced-class coordinated review in Build 2b.
- **Open for 2b:** Build 1a gives the agent one directive slot. A live call directive in it refuses another call's directive answer (`409 directive_pending`) for as long as it stays live, and a chat or chip filing can replace it at any time (Standing conditions, "One override at a time", which cites the pinning tests). Build 2b's spec must say how a replacement pick coexists with an override already in the slot before `call_replace` has a writer.

**No writer or reader in 2a.**

---

## Field summary

| Document | Field | Type | Clause | Live in |
|---|---|---|---|---|
| `declarations/{evalId}` | `watchingSource` | `'declarations' \| 'top_level' \| null` | C-1 | 2a |
| `declarations/{evalId}` | `mintedMode` | `'shadow' \| 'on'` | C-5 | 2a |
| `calls/{callId}` | `heldAtMint` | `boolean` | C-2 | 2a |
| `calls/{callId}` | `counterpartRaw` | `string (≤ 40 code points) \| null` | C-3 | 2a |
| `calls/{callId}` | `saidOk` | `boolean \| null` | C-4 | 2a |
| `calls/{callId}` | `mintedMode` | `'shadow' \| 'on'` | C-5 | 2a |
| `calls/{callId}` (pick) | `origin` | `'declared' \| 'assembled'` | C-7 | 2b |
| `calls/{callId}` (pick) | `options[].source` | `'agent' \| 'bench'` | C-7 | 2b |
| battle directive slot | action `call_replace` | `callActions.v2` | C-8 | 2b |

Changed meaning, no new field: `calls/{callId}.counterpart` (C-3, usable names only).

---

## Standing conditions (restated)

- There is no "held" fact. No display says "Held off" or claims the agent held because of an answer (Build 1a, `heard.js`).
- There is no "Asking you" state until the ask route ships (Build 1b).
- **One override at a time** (Build 1a's single directive slot). While the slot holds a **live** call directive, the answer endpoint refuses a directive answer on any other call with `409 directive_pending`; acknowledgments never meet that check (`directiveUtils.js` `isCallDirectivePendingAt`). Live means: call-family; at or before its lifetime end (the horizon's expiry, plus 15 minutes for `next_check`); its thread not killed by a control epoch; and not suppressed (integrity mode not `'enforce'`). Displays follow the same predicate (`cockpitModel.js` `liveCallSlotOf`) and say so. Pinned by `directiveUtils.build1a.test.js` ("pending: a live call-family slot of a DIFFERENT call …", "not pending: …"), `callActions.test.js` ("the lifetime: the horizon expiry, plus 15 minutes for next_check only …"), `call-response.test.js` ("ANOTHER call-family directive pending in the slot → 409 directive_pending …", "an ACKNOWLEDGMENT on another call is accepted while a call directive is pending …", "the pending guard carries the renderer's suppression state …") and `cockpitModel.test.js` ("PARITY: on every row of the table, the tile blocks exactly when isCallDirectivePendingAt would refuse"). Hearing consumes nothing, but the directive does not always keep the slot until its lifetime ends:
  - **Replaced:** a chat filing (latest-wins) or a chip filing (with a matching belief) replaces it at any time, stamping `supersedes` and, at 'on', writing a `superseded` event (Amendment B §3). Pinned by `chat.test.js` ("Build 1a: a chat filing over a CALL-FAMILY slot is latest-wins with NO belief …", "Build 1a: the same replacement at calls ON …") and `file-directive.test.js` ("with the right belief at calls off: replaced-prior …", "at calls ON for an allowlisted owner …").
  - **Retired by the heard pass** (compare-and-clear): when the check's committed trade acts on a `call_go` or `call_pick` directive, or trades a pick's slot for something other than the selection. A `call_hold` stays even when the agent makes the trade, and hearing alone retires nothing. Pinned by `heard.test.js` ("heard is first-confirmed; …", "a go directive acted on is retired; …", "ACTED: … a hold directive is not retired", "a PICK whose slot was traded for the OTHER option …").
  - **Retired by the sweep** once its lifetime has ended. Pinned by `sweep.test.js` ("a call-family slot past its lifetime is retired by compare-and-clear; …").
  - **Killed:** a kill ends its liveness without clearing it, and another call's directive answer can then replace it. Pinned by `call-response.test.js` ("a pending call-family slot whose thread the control epoch KILLED no longer blocks …").
- Tiles and chat lines render from record fields; a `said` is shown only when it passes the lint.
- Records are frozen in place on rollback; nothing is deleted or rewritten.
- Model-visible text changes go through fenced-class coordinated review (contract V1.4 §2).
