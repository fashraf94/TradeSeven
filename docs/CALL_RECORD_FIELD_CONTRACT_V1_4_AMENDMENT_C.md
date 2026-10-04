# Call Record Field Contract V1.4 — Amendment C (revision 2)

**Date:** 2026-10-03 · **Revision 2:** 2026-10-04 · **Author:** Fable · **Status:** draft for blessing (framework chat). Blessing gates the Build 2a **merge**.
**Builds on:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` + Amendment A (`docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md`) + Amendment B rev 2 (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_B.md`).
**Evidence:** the Build 2 discovery, `docs/audits/20261002_PHASE0_BUILD2_COCKPIT.md` (cited D-A1…D-A11, D-B1…D-B10); round 3, `docs/audits/20261002_DECLARATIONS_WORDING_ROUND3.md`; the Build 2a report, `docs/audits/20261003_BUILD2A_COCKPIT_SCREEN.md` (cited 2A-§n and its finding ids).
**Scope:** C-1 to C-6 have writers and readers in Build 2a. C-7 and C-8 are **reserved for Build 2b**: defined and blessed now, with no writer or reader until 2b.

**What revision 2 changes** (all from the Build 2a review, 2A-§11; no field is added or removed):
- C-1: the validation clause now describes HEAD's actual rules for `declarations.watching` (2A L1-4).
- C-3: the cooldown-locked set's source is named; "usable" is the enumerated list only; the clause lists its knock-on effects on model-visible directive text and on the acted match (2A L1-3, L1-5, L2-2).
- C-6: the thread key adds `defaultAction` (2A framework-chat item).
- C-8: names the single-slot question Build 2b must resolve.
- Standing conditions: one override at a time is recorded as the rule for 2a.

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
- It accepts **no answers**: `POST /api/agent/call-response` returns `400 illegal_answer` for every answer on it.
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
- **Model-visible directive text:** the `call_go` / `call_hold` text the agent reads omits an unusable counterpart ("…exit for TBD." becomes "…exit.").
- **The acted match:** the flip's acted match no longer requires a counterpart that was stored as null. An exit whose counterpart was "X or Y" is acted by a committed trade that exits its symbol, whichever name comes in.
- **Answer eligibility:** an entry whose named counterpart was not held loses it, and its legal answers follow the Build 1a legality table for an entry without a counterpart.

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
- While any call in a thread carries a **live directive answer**, displays offer no new answer on that thread and show that answer, naming the wording it was given on.
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
- **Open for 2b:** Build 1a gives the agent one directive slot, and a heard call directive holds it until its deadline. Build 2b's spec must say how a replacement pick coexists with an override already in the slot before `call_replace` has a writer.

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
- **One override at a time** (Build 1a's single directive slot): a heard call directive keeps the slot until its deadline; displays follow the endpoint's predicate and say so.
- Tiles and chat lines render from record fields; a `said` is shown only when it passes the lint.
- Records are frozen in place on rollback; nothing is deleted or rewritten.
- Model-visible text changes go through fenced-class coordinated review (contract V1.4 §2).
