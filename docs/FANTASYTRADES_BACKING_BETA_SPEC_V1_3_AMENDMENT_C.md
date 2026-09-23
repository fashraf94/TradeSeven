# FantasyTrades — Backing Beta Spec V1.3: Amendment C

**Date:** September 23, 2026
**Status:** Amends `FANTASYTRADES_BACKING_BETA_SPEC_V1_3.md` (build-governing) after Amendments A and B. Four founder rulings of September 23, from the PR 5 review record (`docs/audits/20260923_BACKING_PR5_MULTILENS_REVIEW.md`).

---

## C1. D-af — A team is named by its primary agent

Wherever a backing surface names a team in a single label — the winner line, pod rows, Your Backing, the stake confirmation, the strip — the label is **the team's primary agent's name** (e.g. "Shadow"). The player's display name may appear as secondary text where the layout has room (the team card keeps its human-and-agent unit as designed).

- **Never a raw account id, anywhere, in any state.** If the agent name cannot be resolved, fall back to the player's display name; if neither resolves, a neutral "Unnamed team". A guard test enforces it.
- **Source:** resolved server-side. Before the draft, the owner's current primary agent (the same owner lookup board production uses, clones excluded). After settlement, the `agentId` settlement recorded on each team. CPU seats already carry agent names.
- This supersedes the PR 5 review's HON-17 plan to stamp player names at lobby formation — no tournament code changes.

## C2. D-ag — One stake per team per backer

A backer holds **at most one stake per team per pool.** Backing the same team again **tops up** that stake rather than creating a new one. The per-team cap (500 BP) applies to the total. Hedging across different teams in one pool is still allowed.

- Consequence: a pool holds at most (eligible backers × teams) stakes — a few dozen at beta scale — so the settlement ceiling (120) and the refund stuck state (96–120 stakes, PR 5 review MONEY-4) become unreachable by construction. The ceilings stay in code as belts.
- Every top-up is its own allowance debit with its own ledger entry and its own `requestId`; the ledger invariants (Σ entries = cached balance; net-BP per §2) are unchanged.
- Confirm copy for a top-up says so: "Adds to your 250 BP on Shadow."

## C3. §8 wording — what an admin exclusion reaches

An admin `excluded` flag on a stake removes it from **trainer stats, the viewer's own stats, and the admin Sybil analysis.** It does **not** change a closed pool's revealed counts or shares on the results card — those are the close's frozen figures and are never rewritten. Settlement math is unaffected, as before.

## C4. The Diversifier's backing-safe approach line

Approved: *"Keeps the portfolio spread across many sectors so no single one can sink you."* Used only by the team-card projection; the canonical Diversifier copy elsewhere is unchanged.

## Rulings ledger — additions

| # | Question | Ruling |
|---|---|---|
| D-af | Team label | The primary agent's name; player name secondary; never a raw id; server-resolved |
| D-ag | Stakes per team | One per backer per team per pool; repeat backing tops up; cap applies to the total |
| D-ah | Exclusion scope | Trainer stats, own stats, admin analysis — never the results card's frozen counts |
| D-ai | Diversifier line | "Keeps the portfolio spread across many sectors so no single one can sink you." |
