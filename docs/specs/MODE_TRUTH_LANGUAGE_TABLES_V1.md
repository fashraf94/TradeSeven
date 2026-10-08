# Mode-Truth Language Tables — V1 (Companion 2 to the Pilot Spec)

**Date:** 23 September 2026 · **Author:** Fable (per R3) · **Status:** **Blessed by founder, 24 Sep 2026** (all five tables, walked through with Fable, no edits) — the only source player-facing strings ship from. **V1.1 — 7 Oct 2026:** table F added (founder decision D5); A–E unchanged. **V1.2 — 7 Oct 2026:** table F gains the profit-target line (founder sign-off Q2 on PR #940); A–E and F's other rows unchanged. · **Destination:** `docs/specs/`.
**Scope:** BaggerBomb v1 — every player-facing sentence the agent, tiles, and Film Room use for protective outcomes, intent, hypothesis lifecycle, and evidence availability. **The typed fields govern; these lines render them.** A rendered line that claims beyond its typed fields is a loggable divergence. Placeholders in `[brackets]` are filled from the record, never invented.

## A. Protective-action outcomes (wire enum → player line)

| Wire value | Player line |
|---|---|
| `fired_replaced` | "Protection fired on [SYM] — it's out at [px], and [SYM2] took the slot." |
| `fired_slot_empty` | "Protection fired on [SYM] — it's out at [px]. Nothing qualified to take the slot at this check, so it's open." |
| `mode_blocked` | "Protection wanted to act on [SYM], but [named mode rule] blocks that move in this game. Nothing happened — that's the rule, not a judgment call." |

Rules: the price shown is the executed price from the record; `mode_blocked` always names the rule; no line ever says "partially" anything.

## B. Intent (candidate-scoped; §6's discriminated shape)

| Intent | Player line |
|---|---|
| `enter` | "Setup's valid on [SYM] ([pattern]) — making the case to enter." |
| `wait / insufficient_evidence` | "Waiting on [SYM]: I don't have [missing facts]. What changes it: [named evidence]." |
| `wait / invalidated_setup` | "Standing down on [SYM] — the setup broke: [typed condition]." |
| `wait / no_replacement` | "The exit case on [SYM] is live, but nothing on the bench qualified to replace it. Holding both the position and the question." |
| `wait / policy_block` | "[Named rule] stops this move in this game. Holding — and saying so, not pretending I chose to." |
| `reject / *` | Same shapes as `wait`, with "Passing on [SYM]:" as the opener and the same typed reason clause. |

Rules: every "waiting" names its missing evidence; every "can't" names its rule; an `unknown` setup verdict renders as insufficient_evidence with its missing-facts list — never as an opinion.

## C. Hypothesis lifecycle

| State / event | Player line |
|---|---|
| `review_due` (horizon elapsed) | "Your [SYM] idea reached its time-frame ([window]). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it." |
| `review_due` (battle ended, `unspecified`) | "The battle ended with your [SYM] idea still open-ended. It's flagged for review — reaffirm or retire when you're ready." |
| `invalidated` | "Your [SYM] idea hit its invalidation: [typed condition]. That's recorded on the idea itself — what happens next is your call." |
| reaffirmation | "Reaffirmed — that's a fresh version of the same idea with a new clock. The old one stays in the record exactly as it was." |
| deploy of a due version attempted | "This idea is due for review — reaffirm it first (one tap, same content if you want), and the fresh version deploys." |

## D. Evidence availability (tiles and Film Room; §8.3 states)

| State | Player line |
|---|---|
| `off` | "No decision snapshot exists for this check — recording was off." |
| `unresolved` | "The snapshot for this check couldn't be retrieved; whether it was saved is unknown." |
| `write_failed` | "The snapshot for this check failed to save. The call stands; the byte-level proof doesn't exist." |
| `body_expired` | "The exact snapshot for this check has aged out of storage. The call and its record stand; the byte-level proof is gone." |
| `legacy` | "This is from before versioned ideas — shown as it was recorded then." |

Rule: absence of proof is stated as absence, never rendered as confidence and never hidden.

## E. Forbidden vocabulary (BaggerBomb v1)

Never rendered, in any surface: **hedge, trim, partial, scale in/out, take some off, cash position, move to cash, sit in cash, wait for the market to [vague], probably/likely fine, guaranteed, can't lose** — and any claim of an action the mode cannot perform, any "chose to hold" when the hold was a block or a failure (the record's dimensions — intent, override, executed action, failure — each render as themselves), and any confidence statement without its cited facts.

## F. Execution refusals (V1.1, V1.2 — 7 Oct 2026)

**V1.1 — 7 Oct 2026:** table F added, wording set by founder decision D5 (Pilot P6, the swap identity check; pilot spec §7). Tables A–E are unchanged.

**V1.2 — 7 Oct 2026:** the profit-target row added (founder sign-off Q2 on PR #940 — an equipped profit target is the player's own standing order, not protection, so it no longer renders "Protection was set to sell…"). The other three rows are unchanged.

The executor's typed refusals: the trade reached the book after the belief it was built on stopped being true, so no trade was made. A refusal is the **failure** dimension — never a protective outcome (§A), never an intent (§B), never "chose to hold". **`[SYM]` is filled from `verification.expected.symbol`** — the stock the decision was about — **never from the slot's current occupant**; `[SYM2]` is the incoming stock the caller was placing.

| Wire value | Player line |
|---|---|
| `outgoing_identity_mismatch` (agent, proposal or meeting) | "The agent tried to swap [SYM] for [SYM2], but [SYM] had already left that slot. No trade was made." |
| `outgoing_identity_mismatch` (protective) | "Protection was set to sell [SYM], but [SYM] had already left that slot. No trade was made." |
| `outgoing_identity_mismatch` (profit target) | "Your profit target was set to sell [SYM], but [SYM] had already left that slot. No trade was made." |
| `battle_not_active` | "This trade arrived after the battle ended. No trade was made." |

Rules: the speaker follows the trade's own provenance (its receipt `source`, and for the profit target its `exitReason`), never the route that ran it. The **protective** line renders refusals of the deterministic protective exits — the risk manager's protective exits and the equipped stops (stop, trailing stop), on the model route and the suppression pass alike. The **profit target** line (V1.2) renders the refusal of an equipped profit target (`exitReason: guardrail_profitTarget`), on either route. The **agent** line renders every swap the agent itself decided — a model swap, an archetype (stagnation) exit, a proposal, a meeting leg. The server writes these lines (feed beats, history rows, the evaluation entry's refusal record) only at `SWAP_IDENTITY_MODE ≠ off`; a line whose placeholder the record cannot fill is not written. Client labels are unchanged by V1.1 and V1.2. None of §E's words appear.

*V1 — wording blessed by the founder 24 Sep 2026. Amendments version-bump; only the blessed version ships. V1.1 — 7 Oct 2026: table F (founder decision D5). V1.2 — 7 Oct 2026: table F's profit-target line (founder sign-off Q2 on PR #940).*
