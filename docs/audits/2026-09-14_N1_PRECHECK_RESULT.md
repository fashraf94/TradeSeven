# N1 Stranded Pre-Check — Result

**Type:** evidence record. Output of `scripts/n1-stranded-precheck.js` (read-only), run by the founder locally against production Firestore.
**Run date:** 2026-09-14
**Script:** `scripts/n1-stranded-precheck.js`, merged in PR #842 (the N1 mitigation).
**Companion documents:** `docs/audits/2026-09-12_N1_MON0845_AGENT_LAYER_DISCOVERY.md` (the discovery that found the defect), `docs/audits/20260912_N1_MITIGATION_MON0845_BUILD_REVIEW.md` (the mitigation's review record).

---

## Verdict

**No player was harmed. No rank correction is owed. Nothing needed retiring.**

Across the nine Mon 08:45 ET occurrences since the live-draft flag went live (2026-07-20 through 2026-09-14), exactly **one** pod ever formed — 2026-08-17, one human seat plus three CPUs — and it played a **healthy** full week: agent battles present on all five days, agent boards written, the agent-draft stream present, and non-zero agent points on every banked day. It scored **0 of 5** on the stranded signature.

No pod existed for 2026-09-14, so no claimants were locked out of that week's other competitive pods by the one-competitive-game-per-week rule, and the `--apply` retire script was not needed.

The defect the discovery confirmed is real; it never had a victim. The 2026-08-17 pod escaped it for the reason the discovery predicted: the Monday duty marker had not been set that morning, so a later tick picked the pod up.

## Operational note

Mon 08:45 was barely used — one pod in nine weeks — so leaving the slot disabled until the durable fix lands and runs clean on a real Monday costs almost nothing.

## Raw output

```
==============================================================
N1 STRANDED PRE-CHECK (READ-ONLY) — Mon 08:45 slot pods
==============================================================
slot          : mon-0845
occurrences   : 9 (2026-07-20 .. 2026-09-14)
writes        : IMPOSSIBLE — the Firestore handle throws on any mutator.

DATE        GROUP ID                       EXISTS STATUS       DEV  SEATS  SIGNATURE(1-5)  VERDICT
----------- ------------------------------ ------ ------------ ---- ------ --------------- --------
2026-07-20  lds_mon-0845_2026-07-20        no     -            -    -      -               -
2026-07-27  lds_mon-0845_2026-07-27        no     -            -    -      -               -
2026-08-03  lds_mon-0845_2026-08-03        no     -            -    -      -               -
2026-08-10  lds_mon-0845_2026-08-10        no     -            -    -      -               -
2026-08-17  lds_mon-0845_2026-08-17        YES    complete     no   4      . . . . .       healthy
2026-08-24  lds_mon-0845_2026-08-24        no     -            -    -      -               -
2026-08-31  lds_mon-0845_2026-08-31        no     -            -    -      -               -
2026-09-07  lds_mon-0845_2026-09-07        no     -            -    -      -               -
2026-09-14  lds_mon-0845_2026-09-14        no     -            -    -      -               -

  SIGNATURE key ("#" = the stranded condition holds, "." = it does not):
    1 no agent battles   2 no agent boards   3 no agent-draft stream
    4 all banked agentPoints 0 with NO agentScoresCarried stamp (the silent part)
    5 Monday duty marker completed BEFORE the pod resolved its draft
  The signature is only EVALUATED for a pod that reached its battle week.
  Parts 1-3 are absences, and a pod that never fired has them all — so a
  not-yet-played pod reads "n/a", never "stranded". It is not evidence of harm.

==============================================================
2026-08-17  tournamentGroups/lds_mon-0845_2026-08-17
==============================================================
  status            : complete
  isDev             : false
  isLiveDraft       : true   slotId: mon-0845
  scheduledDraftAt  : 2026-08-17T12:45:00.000Z
  createdAt         : 2026-08-17T01:06:23.327Z
  updatedAt         : 2026-08-21T21:20:00.194Z  (nightly banking bumps this — not the flip time)
  draft resolvedAt  : 2026-08-17T13:01:42.437Z  (streams/userDraft — the real completion instant)

  CLAIMANTS (4 seat(s)):
    7ML6i7WyfuaAtJjl16Smh2kETPw1   name=cam  [human]
    cpu-45                         name=(none)  [CPU]
    cpu-46                         name=(none)  [CPU]
    cpu-47                         name=(none)  [CPU]

  FIVE-PART STRANDED SIGNATURE:
    1. agent battles (tournament gameMode) : 20 of 20 total  -> no
    2. agentBoards docs                     : 4                     -> no
    3. streams/agentDraft present            : true                 -> no
    4. banked days                         : 5; all agentPoints zero=false; agentScoresCarried days=[none]  -> no
         day1.agentPoints = [99, 145, 79, -101]
         day2.agentPoints = [-140, 184, -357, -68]
         day3.agentPoints = [-91, 224, -380, 117]
         day4.agentPoints = [-78, 312, -376, 36]
         day5.agentPoints = [35, 522, -389, 98]
    5. duty marker 2026-08-17:monday_pipeline
         completedAt = (no marker recorded)
         set before the pod resolved? ?  -> no

  VERDICT: HEALTHY — reached battle and its agent layer is present (0/5)

  (All other occurrences: DOES NOT EXIST — nobody claimed this occurrence. No exposure.)

==============================================================
PLAIN-LANGUAGE SUMMARY
==============================================================
1 Mon 08:45 pod(s) exist across the checked Mondays.
0 of them show the stranded signature (3 or more of the five parts).

READ-ONLY pre-check complete. No document was modified.
```

*Per-occurrence "DOES NOT EXIST" blocks for the eight unclaimed Mondays are elided above; the table row and the summary carry the same fact.*
