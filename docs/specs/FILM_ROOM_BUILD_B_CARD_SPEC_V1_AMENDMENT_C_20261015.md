# Build B spec V1.0 — Amendment C: founder rulings for B1.1 (2026-10-15)

- **RC-1 — `stalled` v2 reads the rule's own count.**
  - Per holding, per day: when every check that holds the symbol carries the count the live evaluator recorded (`checks[].stagnation`), the tag reads that count, its age verdict and the daily change the rule's winner test read (basis `recorded`). Nothing is recomputed.
  - Otherwise, that holding's day is recomputed exactly as v1 defines it (basis `recomputed`).
  - The recorded count carries over the night, as the live rule's does.
  - The registry's `stalled` definition becomes:

    > *Per holding, per check. The count is the platform's stagnation count. Where every check of the day that holds the symbol carries the count the live rule recorded (checks[].stagnation), the count, its age verdict and the daily change the rule's winner test read are those records, and the count carries over the night as the live rule's does. Otherwise the count is recomputed from the price the agent was shown at each check (checks[].evidence.px), with the platform's own arithmetic (updateStagnationCounter), the archetype's forced-rotation thresholds from the registry adapter, the battle's tempo dial, and the rule's tick-age guard. A check with no price for the holding pauses the recomputed count, as the age guard does, and the recomputed count starts at zero at the day's first check. A run is the stretch since the holding came into the book or since a timely move reset its count. The holding is stalled at a check when the count is at or above the effective threshold less S1 (and at least 1), the rule has not fired for it in the run, and it is below the rule's winner threshold. When the archetype's forced rotation is switched off, the count runs at S2's move threshold and the holding is stalled at S2's check count.*
  - `stalled.version` and `SITUATION_REGISTRY_VERSION` become 2.
  - A day re-tagged under v2 without records keeps its items. Only its version labels move, and that movement is accepted.
- **RC-2 — What the evaluator records.**
  - Per held symbol per tick, in the tick's `risk.stagnation`:
    - `ticks`, the count `evaluateRisk` received;
    - `withinAge`;
    - `dailyPct`, exactly as passed to `evaluateRisk`.
  - This is recording only. No decision, verdict, swap, score or cron state changes.
  - The tape copies it to `checks[].stagnation`, class R.
- **RC-3 — Late-filed meetings.**
  - The close pass for day D re-merges the battle's previous session P when the meeting history now holds a meeting created on P that P's tape lacks.
  - It uses the same writer and is merge-monotone. It decides from the battle document first and reads P's tape only when a candidate exists.
  - P's candle pass is not reopened, so a late meeting's legs get no bars (as RB-2).
  - A failed re-merge leaves P's tape as it was and never marks P failed.
  - Past days need nothing: the 2026-10-15 refresh ran after every earlier meeting was filed.
- **RC-4 — One safe error-class list (Astra N1).**
  - Every error class the tape or the census prints comes from one fixed list of real error classes.
  - Any other name prints as `Error`.
  - This covers the T1 note, the meetings note, the tagger's failure note and the census.
- **RC-5 — RB-6's census size line is not built.**
  - The 2026-10-15 refresh reported every written tape's size: 9,929 to 114,229 bytes. The largest is about 12% of the 950,000-byte budget.
  - Revisit only if a tape approaches the budget.
