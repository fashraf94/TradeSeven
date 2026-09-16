# FantasyTrades — Backing Beta Spec V1.3: Amendment B

**Date:** September 16, 2026
**Status:** Amends `FANTASYTRADES_BACKING_BETA_SPEC_V1_3.md`, which remains build-governing, and supplements Amendment A. One ruling amended (D-q), two new (D-ac, D-ad), three corrections of record.
**Sources:** Sol's third pass (Sept 16, scoped to the sealed-pool open state); the PR 2 multi-lens review record (`docs/audits/20260916_BACKING_PR2_MULTILENS_REVIEW.md`, finding 13 and its disclosures); the founder's rulings of September 16.

---

## B1. The problem, stated

§3 publishes, on `backingPools/{groupId}` — authed-read, therefore streamable in real time by any signed-in user — the pot total, the unique backer count, and the count of distinct teams backed. Per-team totals and pays × are sealed until close.

At beta-sized pods those aggregates are not aggregates. With three to five backers, one pot delta is usually one person's stake, and when that delta lands together with a backer increment or a team-spread change, an observer reconstructs the book. The observer best placed to do it is one who has already staked, because they can subtract their own contribution. In a two-human-team pod the attribution is often unambiguous.

Every input is spec-sanctioned; the leak is the combination. Sealing was the design's answer to live-odds following and sniping (D-c, D-q), so this weakens the mechanic rather than merely a display.

## B2. D-q amended — the open-state contract

**While a pool is open, the public pool document exposes only threshold-capped validity progress and, to the viewer, their own stakes.** Specifically:

| Field | While open | At close |
|---|---|---|
| Pot total | **not public** | revealed |
| Unique backers | **capped at the floor**: `2 of 3 needed` → `Threshold met`. Never 4, 5, 6 | exact count revealed |
| Team spread | `Needs another team` → `Threshold met` | per-team backer counts revealed |
| Per-team stake totals, BP shares, pays × | sealed (unchanged) | revealed |
| The viewer's own stakes | visible (unchanged) | visible |

Once both thresholds are met, the public qualification signals **freeze** until close. Above-threshold activity produces no public change of any kind.

Rejected, with Sol's reasoning adopted: **banding the pot** (a band change tied to a counter change still exposes a meaningful range at these sizes, and adds complexity to preserve a number the open state does not need); **delayed updates** (changes when the information leaks, not whether it can be reconstructed); **a single validity boolean** (a spectator learns nothing about whether their participation would help, which is the thin-pool risk the counters exist to solve).

The governing principle: **expose what another spectator needs in order to rescue the pool; hide everything useful for reconstructing it.**

## B3. D-ac — the residual leak, accepted explicitly

Two signals remain by design, and the founder accepts them:
1. **Team spread flipping unmet → met** tells an observer that someone backed a team other than the ones already represented — not which, and not the amount.
2. **The backer counter ticking below the floor**, at most twice.

Both are the minimum that carries the rescue signal. Neither exposes an amount. Nothing above the floor is published at all.

## B4. D-ad — thin-pool risk outranks the minimum leak

If the two are ever in tension again, participation pressure wins over further sealing, but only up to the threshold. Below the floor the spectator is told what the pool needs; at and above it, nothing.

## B5. Data model — the field moves, this is not a display change

The pot total is on the authed-read pool document today, so concealing it in the interface would conceal nothing. **`potTotal` moves to `backingPools/{groupId}/private/totals`**, alongside the per-team totals already there, and `uniqueBackers` is replaced on the public document by two derived, capped fields:

- `backerProgress: { count: min(uniqueBackers, VALIDITY_MIN_BACKERS), floor: VALIDITY_MIN_BACKERS, met: boolean }`
- `teamSpread: { met: boolean }`

`teamsBacked` as a raw count leaves the public document. Everything sealed is revealed at close by the existing close transaction (§3 step 4), which gains the pot and the exact counts to the fields it already publishes. `private/totals` remains unreadable by clients; the server reads it for the close and for settlement.

**Sequencing:** this lands as a **follow-up PR after PR 2 merges and before PR 3**, because settlement reads the pot at close and must know where it lives. PR 2 is merged as-is; its review record stands against the state it reviewed.

## B6. Copy — the pool strip (PR 4)

Open, below the floor:

> **Pool needs support** · Backers 2 of 3 · Team spread: needs another team · Your backing: 250 BP

Open, qualified:

> **Pool qualified** · Backers: threshold met · Team spread: threshold met · Your backing: 250 BP

No pot figure appears in either state. At close the strip switches to the revealed view already specified in §5. The existing Confirm disclosures (§4) are unchanged and still accurate: the payout is unknown until close and moves as others back.

## B7. Corrections of record from the PR 2 review

1. **§6, carry-in E1.** The stake fingerprint and the admin exclusion flag are **not** on the owner-read `backingStakes/{stakeId}`; rules cannot hide a field. They live at `backingStakes/{stakeId}/private/meta`, no client read, IP and UA hashed with a server-side salt. PR 5's Sybil watch reads them via that subcollection or a collection-group query.
2. **E2, the net-BP primitive.** `recordStakeLoss` does not touch `careerNet` (the stake's own debit already did; a second debit double-counts), and PR 3 calls it for the stake side of **every settled stake**, not only losing ones. `closePool` already pairs it with each refund so a voided stake nets to zero in both the career and season records — the single existing caller; PR 3 remains its settlement caller.
3. **§10.** `stake_confirmed` is written server-side by the stake endpoint. PR 2 writes no `backingEvents` document, so **PR 5 re-enters `backing-stake.js`** to add it.

## B8. Founder notes carried, not rulings

- **`hashAtStake` on the owner-read stake document** lets a backer test loadout-hash equality across seats and pods — slightly more than the "loadout changed" marker §4 describes. By design under §6; revisit if it is ever used for anything but the marker.
- **The backing rules block is not executed by CI.** `test/rules/*.rules.mjs` runs only under `npm run test:rules` with the emulator; the PR workflow runs `npm run test:run`. Pre-existing scope, noted because the backing blocks are new and are the only thing standing between a client and the sealed documents.

## Rulings ledger — additions and amendments

| # | Question | Ruling |
|---|---|---|
| D-q | Social proof / open-state | **Amended:** while open, only threshold-capped validity progress and the viewer's own stakes are public — no pot, backer count capped at the floor, team spread as a boolean, signals frozen once qualified. Exact pot, final counts, per-team totals, BP shares and pays × revealed at close |
| D-ac | Residual leak | Accepted: team spread flipping to met, and at most two sub-floor backer ticks. No amounts, nothing above the floor |
| D-ad | Tension rule | Thin-pool risk outranks further sealing below the floor; at and above it, nothing is published |

*Amendment B prepared September 16, 2026. V1.3 §15 D-a–D-z and Amendment A's D-aa/D-ab stand unchanged except for D-q.*
