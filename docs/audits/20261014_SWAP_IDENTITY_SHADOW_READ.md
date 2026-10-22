# Swap identity census (Pilot P6, G01)

Read at: 2026-10-14T21:58:28.482Z · battles read: 30 · trade rows counted: 14 · since 2026-10-08T04:57:56.000Z

## 1. Believed vs committed outgoing symbol (any mode)

| Caller | Trades | Belief joined | Belief unknown | Belief ambiguous | Believed ≠ committed |
|---|---|---|---|---|---|
| risk | 8 | 8 | 0 | 0 | 0 |
| model | 6 | 6 | 0 | 0 | 0 |
| proposal | 0 | 0 | 0 | 0 | 0 |
| suppression | 0 | 0 | 0 | 0 | 0 |
| meeting | 0 | 0 | 0 | 0 | 0 |
| unknown | 0 | 0 | 0 | 0 | 0 |

*Belief unknown*: the row's evaluation (or proposal) has aged out of the battle's retained entries, so its belief cannot be read — never counted as a match. *Belief ambiguous*: more than one retained entry shares the row's evaluation id and incoming symbol with different beliefs (battles older than the Sep 21 evaluation counter repeat ids) — never counted as a mismatch.

No retained row committed a different outgoing symbol than its caller believed.

## 2. `trades[].verification` (shadow / enforce)

| Caller | Rows with verification | match | mismatch | not_checked | enforce would refuse: battle_not_active | symbol_and_entry | symbol_only | invalid (not the executor's) |
|---|---|---|---|---|---|---|---|---|
| risk | 8 | 8 | 0 | 0 | 0 | 8 | 0 | 0 |
| model | 6 | 6 | 0 | 0 | 0 | 6 | 0 | 0 |
| proposal | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| suppression | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| meeting | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| unknown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

*match / mismatch / not_checked* count verifications on a battle whose `battleStatus` was exactly `active`. Any other status — a missing one included — is counted under *battle_not_active*, whatever its verdict: at enforce the executor refuses such a swap before it compares the identity, so a matching identity on an ended battle is not a clean match.

Modes seen on rows: shadow 14

Verdict disagrees with the symbol comparison (must be 0): **0**

## 3. Refusals recorded (enforce) and the honest-record markers

| Channel | Count by reason |
|---|---|
| evaluation `executionRefusal` | none |
| proposal history `executionRefusal` | none |
| meeting history `legRefusals` | none |
| feed beats `refusalReason` | none |
| proposal history `executionFailed` | 0 |
| proposal history `resolution: 'auto_execution_failed'` | 0 |

### 3b. Retry-safe records (integrity follow-up 2, Part D) and held meeting legs (Part A)

An executor call that threw is read back before anything is recorded: `executionLanded` marks a trade that landed but whose incoming position was already gone; `executionOutcome: 'unknown'` marks a read-back that failed (no line either way); a meeting leg `executionFailed` is a confirmed no-trade, and `executionOutcome: 'not_run'` a leg not attempted because the book could not be read after an earlier leg of unknown outcome. Watch these through the shadow period: each is an executor throw the enforce flip will meet.

| Marker | Count |
|---|---|
| `executionOutcome: 'unknown'` | evaluations 0, feed beats 0, proposal history 0, meeting legs 0 |
| `executionLanded` | evaluations 0, feed beats 0, proposal history 0, meeting legs 0 |
| proposal history `resolution: 'auto_execution_unknown'` | 0 |
| meeting legs `executionFailed` | 0 |
| meeting legs `executionOutcome: 'not_run'` | 0 |
| meeting legs held (`heldLegCount`) | 0 |

## 4. Retained windows

Every count above covers what the battle documents still hold: `trades[]` keeps the last 50 rows, `evaluations[]` the last 150 entries, `proposalHistory[]` the last 50 rows, and the feed the last 100 beats; `gameplanMeetingHistory[]` is not capped. A trade older than its battle's oldest retained evaluation reads *belief unknown*.

| Battle | Trade rows | Trades from | Trades to | Evaluations | Evaluations from |
|---|---|---|---|---|---|
| 3vzKWJ2JyZQljzg4xtfm | 1 | 2026-10-09T15:31:41.283Z | 2026-10-09T15:31:41.283Z | 18 | 2026-10-09T13:30:58.540Z |
| 5gneptzsySUe1rUEW5tv | 2 | 2026-10-08T17:01:26.690Z | 2026-10-08T18:31:15.266Z | 17 | 2026-10-08T13:31:15.649Z |
| BJVQKSbP1sVxEJfHJbuc | 1 | 2026-10-14T19:30:48.435Z | 2026-10-14T19:30:48.435Z | 7 | 2026-10-14T18:01:11.356Z |
| EH5dVSHpqlDWqeRVHeRO | 3 | 2026-10-09T16:16:44.418Z | 2026-10-09T18:46:09.948Z | 17 | 2026-10-09T13:31:29.388Z |
| GUWLzphmcGx2eXwLePrb | 1 | 2026-10-08T17:46:30.967Z | 2026-10-08T17:46:30.967Z | 17 | 2026-10-08T13:31:46.982Z |
| L7wztGASx9IHcUCyzO81 | 0 | null | null | 10 | 2026-10-13T17:30:57.589Z |
| NoWNYr2HQQ79Sodu7vFN | 0 | null | null | 6 | 2026-10-12T18:30:58.799Z |
| PMhbPZ3af5qrNW93WOsd | 3 | 2026-10-08T16:17:09.104Z | 2026-10-08T18:16:28.578Z | 17 | 2026-10-08T13:32:19.654Z |
| nBukrwRi75wAawApwPFF | 2 | 2026-10-09T15:45:59.032Z | 2026-10-09T18:02:24.216Z | 17 | 2026-10-09T13:32:10.812Z |
| rFoJHhnUJ7jqb2Ogrqs3 | 0 | null | null | 13 | 2026-10-12T16:31:02.003Z |
| uKKR6gEwVfaJR5oOTMxO | 1 | 2026-10-09T19:01:11.187Z | 2026-10-09T19:01:11.187Z | 16 | 2026-10-09T13:46:13.095Z |
