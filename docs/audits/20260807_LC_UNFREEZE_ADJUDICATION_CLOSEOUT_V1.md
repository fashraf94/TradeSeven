# L-C Unfreeze — Founder Adjudication & Closeout V1

**Date:** 2026-08-07
**Reads with:** `20260807_LC_UNFREEZE_GATE_REPORT.md` + the credentialed pass output (`scripts/lc-fork-adjudication.js`, v2 + review hardening `3f8a4b5e`). Authoritative for the L-C decision.
**Status:** Adjudicated. Unfreeze approved. The flip is a separate one-line PR.

---

## Preconditions — final status

| # | Precondition | Verdict |
|---|---|---|
| 1 | Scoring fix landed | **RESOLVED — no defect identified; §7 reduces to "confirm no model change needed."** See adjudication below. |
| 2 | No poisoned cohort in BATTLE | **MET** — `status=='battle'` enumeration returned empty. The voided cohort is structurally excluded. |
| 3 | Day-5-carried at flip | **VACUOUS** — no BATTLE group exists, so none can be day-5-carried. |
| 4 | Flip inert on zero-BATTLE board | **VERIFIED** — write no-op, test-locked (`tournamentAdvancement.test.js:281`, `tournamentAdvancementFreeze.test.js:152`). One honest nuance: not byte-identical — flag-off issues one extra read (the active-bracket query). |

GUARD 1 read **CLEAN** across all 32 docs (`bankedBadgePoints.total = 0`, no reset signature) → the base/bonus split is valid.

---

## The adjudication — recorded honestly

### The verdict
**No scoring-model defect is identified. The §7 pass reduces to "confirm no model change needed."**

### Why this is NOT a clean "FORK-1 confirmed" (the distinction matters)
The pre-registered rule defined FORK-1 as *gross badge activity and penalty mass concentrated in the **beyond**-envelope dates*. **That is not what the data shows.** Badge activity is concentrated **in-envelope**:

| Seat | Beyond share of GROSS | Beyond share of PENALTY |
|---|---|---|
| cpu-40 | 5% | 0% |
| cpu-41 | 39% | 8% |
| Uy7u2… (human) | 50% (gross 15 vs 15 — trivial magnitudes) | n/a |
| 7ML6i… (human) | 33% (gross 30 vs 15 — trivial magnitudes) | n/a |

So the conclusion matches FORK-1's *disposition* but is reached by a **different mechanism than FORK-1's stated reason**. Recorded explicitly so no future reader concludes the broken-window badge story was validated. **It was not — the badge hypothesis the discriminator was built around is simply wrong.**

### Why in-envelope badge activity is nevertheless not FORK-2
FORK-2 required *the badge model over-crediting within a legitimate 5-day week*. The in-envelope badges are **arithmetically correct under the ruled model**:
- cpu-40, 2026-07-30: `MU:95(bagger/doubleBagger/tenBagger)` and `FMC:95` — exactly the all-tiers-crossed stacking ruled correct under **D3** (+15 / +30 / +50 when a symbol crosses into TenBagger).
- Penalties fire on genuine busts (`-10` / `-30` / `-65` matching bust / bust+crash / bust+crash+meltdown).
Badges are *present* in-envelope; nothing shows the model paying more than its own definition specifies.

### The decisive finding — badges were never the driver
The `[B.2]` mass column settles it:
- **Both human seats: `mass = locked`** — Σlocked of **−1319** and **−1080** (swap churn) against total badge activity of **15** and **45** points. Badges are noise for the humans.
- **cpu-40: `mass = base`** (Σbase +869) — ordinary price movement.
- **cpu-41: `mass = bonus`** (Σbonus 150 vs Σbase −147) — see the balance finding below.

The anomaly's driver on this cohort was **swap-penalty accumulation across an 8-day window** (humans, now bounded by L-B Guard 1) plus **ordinary price movement** (CPUs) — not badge inflation.

### Standing caveat
**n = 1.** Zero COMPLETE non-training groups exist; this is a single poisoned cohort — a case study, not a distribution. The next clean 5-day cohort running under the L-B clamps is materially better evidence than further archaeology on this one.

---

## Open item — verify before treating the badge model as fully clean
**cpu-41, 2026-08-06:** `JPM:30(bagger/doubleBagger/tenBagger/bust/crash/meltdown)` — **all six tiers on one symbol in one day**, meaning both the +2.0 and −2.0 multiplier extremes were recorded. The arithmetic nets correctly (95 − 65 = 30) and a genuine intraday whipsaw can produce it, but confirm `maxMultiplier` / `minMultiplier` are both being recorded live rather than one being stale or mis-seeded. Read-only check; not a flip blocker (this row is on a voided cohort, on a beyond-envelope date).

---

## Sharpened pre-launch finding — CPU inaction is competitively strong
Previously filed as a balance concern; the decomposition makes it stronger:
- **cpu-40:** 0 trades, Σlocked = 0, **won the week** on pure `activeScore` (+1079).
- **cpu-41:** 0 trades, Σlocked = 0, and its standing mass is **bonus** (150) exceeding its base (−147) — it accumulated badge points passively.

A seat that never trades, never pays swap penalties, and still accrues badges is not merely safe — it is **competitive**. Against human seats carrying −1319 / −1080 of swap churn, inaction looks like a dominant strategy. Record: `docs/audits/20260807_PRELAUNCH_FINDING_CPU_INACTION.md`. **Pre-launch priority, not deferred backlog.**

---

## The flip
**Approved.** `TOURNAMENT_ADVANCEMENT_FROZEN = false` as its own **one-line PR**, standard flag discipline.

**Immediately before merging the flip:** re-run `scripts/lc-fork-adjudication.js` Part A and confirm it still returns empty. Part A is the only time-sensitive precondition — a new cohort could form between now and the flip.

**Post-flip verification (the real test) — the next cohort's Friday close:**
1. The finalizer seals at **day 5** (no day 6+ — L-B Guard 1 confirms from the other side).
2. `RoundBoundaryView` interstitial lights with advance/eliminated.
3. THE FIELD populates for the current week.
4. The composite of record equals the **day-5** value (L-B Guard 2).

## Also merge (docs-only, no code, any time)
`league-scoring-anomaly-v6b19j` → main, plain merge (no squash), as its own small PR. The freeze rationale, this report, and the L-B B-F3 gate note all cite those files by name; every citation dangles until it lands. A diagnosis parked on an unmerged branch is precisely how a freeze outlived everyone's memory of what it was waiting for.

## Queue after the flip
Phase 1.5 (Command Center multi-battle → unblocks the concurrency flag) → score history → unified price cache → tournament structure + bracket composer → Phase 3 ranked must-trade (§7-gated). Pre-launch: CPU inaction; JPM six-tier verification.
