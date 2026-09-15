// src/constants/backing.js
//
// Backing Beta PR 1 — the backing layer's canonical constants and copy (spec
// V1.3 §2 economy, §3 pool mechanics, §4 window, §5 surfaces/fine print, §10
// telemetry; rulings D-a, D-f, D-h, D-n, D-p, D-t, D-x).
//
// ZERO-IMPORT MODULE, BY RULE — the leagueTournament.js / eligibility.js
// precedent. Both `api/` consumers (api/_utils/backingWeek.js,
// api/_utils/backingWallet.js, and the PR 2–5 endpoints) and the PR 4 client
// surfaces read this module, so its transitive import surface must stay
// Node-clean under the revised June 2026 import rule (BUILD_RULES §4). Zero
// imports makes that structural: this file can never pull in the client
// Firebase SDK or firebase-admin. The co-located test's real import of this
// module is the dependency-surface guard and locks the zero-import property —
// never mock it.
//
// DELIBERATELY NOT IN src/constants/leagueTournament.js (spec V1.3 §12): that
// module's tuning shape is test-locked, and backing is a separate economy that
// must never be mistaken for tournament tuning.
//
// COLLECTION NAMES LIVE WITH THEIR WRITERS, not here — the PR 0 precedent
// (ELIGIBILITY_COLLECTION sits in api/_utils/eligibility.js). This module is
// the economy and the copy, nothing else.
//
// NOTHING HERE IS LEGAL COPY and nothing here makes a legal claim. §11 gate 1
// is counsel's jurisdictional review of the economy these numbers describe;
// the lexicon guard (§9) is a brand rule and establishes nothing about legal
// status. Unlike PR 0's placeholder attestation strings, the two copy blocks
// below are the SPEC'S OWN VERBATIM WORDING (§5 fine print, §4/§3 disclosures)
// and carry no COUNSEL marker: counsel may still revise them at gate 1, but
// they are not shipped as drafts awaiting a fill-in.

// ==================== ECONOMY (§2 — D-a, D-f, D-h) ====================

/**
 * The weekly allowance: 1,000 BP per eligible account per BACKING WEEK,
 * granted lazily on the first wallet touch in that week (§2 — no enumeration,
 * no fan-out write). Unspent allowance expires at the week's close and nothing
 * carries; the expiry is recorded as a ledger entry on the next grant so each
 * week's ledger sums to zero (§7).
 *
 * BP is a weekly allowance for the game, NOT a bankroll and NOT a balance:
 * payouts are SCORE, not spendable allowance (§2), which is why
 * api/_utils/backingWallet.js never returns a payout to `allowanceRemaining`.
 */
export const ALLOWANCE_BP = 1000;

/** Per-backer cap on ONE team: 500 BP (§2). Multi-team is allowed, including
 *  two teams in one pod — a hedge is a scouting decision (D-f). */
export const PER_TEAM_CAP_BP = 500;

/** The minimum a single stake may be: 50 BP (§2). */
export const MIN_STAKE_BP = 50;

// ==================== VALIDITY (§3 — D-n) ====================

/**
 * A pool is VALID at close iff it has ≥3 unique eligible backers AND ≥2
 * distinct teams backed, evaluated AFTER departed-seat stakes are voided (§3
 * close order, step 3). Otherwise the pool is `insufficient` and every stake is
 * voided, score-neutral.
 *
 * THIS IS A QUALITY FLOOR, NOT AN ABUSE CONTROL (§3, §8 — stated plainly in
 * both). It prevents accidental thin pools; it does nothing about coordinated
 * accounts, and the spec does not claim otherwise.
 */
export const VALIDITY_MIN_BACKERS = 3;
export const VALIDITY_MIN_TEAMS = 2;

// ==================== WINDOW (§4 — D-c amended, D-x) ====================

/**
 * The 24-hour rule: a pod gets NO POOL unless at least this much time remains
 * between when its pool would open and when it would close (§4). Applied by
 * api/_utils/backingWeek.js `poolEligible`, which measures from
 * `max(now, opensAt)` — so a pod formed Saturday night, and a pod read on
 * Saturday night, are refused by the same arithmetic.
 */
export const POOL_MIN_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Live-draft slot ids that get NO POOL, whatever else is true of the pod (D-x,
 * §4, §14). The Mon 08:45 slot fires AFTER the Sunday 23:59 close — there is no
 * honest window for it — and the addendum's N1 note found a pod on that slot
 * can play with an empty agent layer, which would make the result of record
 * incomplete (Amendment A §A1). Excluded from V1 on both grounds.
 *
 * DELIBERATELY INDEPENDENT of src/config/liveDraftSlots.js `enabled`. That flag
 * is the founder's claim door and moves with the N1 fix; this list is the
 * backing layer's own scope decision (D-x, §14) and must not silently re-admit
 * the slot the day the claim door reopens. Re-admitting it is a spec change.
 */
export const POOL_EXCLUDED_SLOT_IDS = Object.freeze(['mon-0845']);

// ==================== TELEMETRY (§10 — D-p) ====================

/**
 * The FIXED allowlist POST /api/backing/event accepts (§10; the endpoint lands
 * in PR 5). Anything not on this list is refused — the sink is a research
 * instrument with a closed vocabulary, not a general event pipe.
 *
 * `stake_confirmed` is DELIBERATELY ABSENT: it is written server-side by the
 * stake endpoint (§10), so a client that could post it would be asserting a
 * stake the server had not written — exactly what §9 forbids.
 *
 * Every event here is capture-only and awaited in-request (BUILD_RULES §5 —
 * fire-and-forget is forbidden for catalog events).
 */
export const BACKING_EVENT_ALLOWLIST = Object.freeze([
  'window_viewed',
  'team_card_opened',
  'stake_control_opened',
  'your_backing_viewed',
  'results_viewed',
]);

// ==================== COPY (§5, §4, §3 — D-t, D-q, D-n) ====================

/**
 * THE fine print — ONE SOURCE STRING (§5). Verbatim from spec V1.3 §5. Every
 * surface that shows it reads THIS constant; a second copy is the §9
 * display-agreement failure mode applied to copy.
 */
export const FINE_PRINT = 'Backing Points are a weekly allowance for the game. They can\'t be bought, transferred, or redeemed, and have no cash value.';

/**
 * The THREE lines the Confirm step carries, one source each (§4). Verbatim
 * from the spec: `loadouts` from §4 ("Loadouts may change nightly during the
 * battle week" — the pre-confirm disclosure line), `payout` from §3 (the
 * sealed commitment stated above Confirm), `validity` from §3 (every stake is
 * conditional and the backer is told so at confirmation).
 *
 * All three are DISCLOSURE, not contract (§4 says so of the loadout line
 * explicitly). The PR 4 StakeControl renders all three above Confirm; it must
 * render them from here, never re-typed.
 */
export const DISCLOSURES = Object.freeze({
  loadouts: 'Loadouts can change nightly during the week.',
  payout: 'Your payout isn\'t known until the pool closes, and it will change as other people back teams.',
  validity: 'Your stake becomes final only if this pool meets its participation minimum at close. Otherwise it is void.',
});

/**
 * The lexicon (§5, §9): the words backing copy uses. A brand rule guarded by a
 * build test — it establishes NOTHING about legal status (§9, D-t), and this
 * module makes no legal claim.
 */
export const LEXICON = Object.freeze(['back', 'backing', 'backer', 'pool', 'pot', 'pays ×']);

/**
 * The terms backing copy must NEVER use — the negative half of the lexicon,
 * consumed by the PR 4 copy guard over src/components/League/backing/
 * backingCopy.js (§12 PR 4, the deskHonesty sibling-suite shape).
 *
 * These are not synonyms for what this product does. The spec's own framing
 * (§0, §2, §14): a weekly allowance that cannot be bought, transferred or
 * redeemed; a parimutuel pot with no rake and no counterparty; `pays ×` is a
 * post-close ratio, never a quoted price. "62% of BP in this pool backed them"
 * is a fact about BP and is labeled exactly — never "the crowd had them at
 * 62%" (§3, §9).
 *
 * Lowercase and matched case-insensitively by the guard; multi-word entries
 * are phrases, so "cash out" is forbidden while "cash value" (which the fine
 * print above needs) is not.
 */
export const FORBIDDEN_TERMS = Object.freeze([
  'bet',
  'wager',
  'odds',
  'cash out',
  'win money',
  'gamble',
]);
