// src/services/tournamentActions.js
//
// P7 (B) — the tournament MUTATION callers: place-claim + flip. The FIRST
// surface where a player's button writes to the engine, so the discipline is
// strict (founder, binding):
//   • client-honest / server-authoritative — the server is the SOLE authority;
//   • never claim success before the server confirms (these reject on !res.ok —
//     a caller can only reach the success path after a 200);
//   • surface the server's error shape, never swallow it (mapTournamentActionError
//     maps known codes to friendly copy and FALLS BACK to the server's own
//     message — it never hides a rule the server enforces).
//
// Deliberately SEPARATE from the reads-only tournamentGroupService.js (whose
// header forbids write calls). POSTs with the Bearer ID token via fetchWithAuth.

import { fetchWithAuth } from '../utils/fetchWithAuth';

/**
 * POST a tournament action. Resolves to the parsed success body on 2xx; THROWS
 * a structured Error ({ status, code, message }) on any non-2xx — so no caller
 * ever sees "success" the server didn't grant.
 */
async function postTournamentAction(path, body) {
  const res = await fetchWithAuth(`/api/tournament/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty/non-JSON body */ }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data?.error || `http_${res.status}`;
    throw err;
  }
  return data;
}

/**
 * Place an overnight waiver claim. Server validates window → membership →
 * drop-on-roster → pool → day-5 → cap(3) → duplicate; returns the pending
 * claim doc. Resolution (won/lost) arrives later via subscribeClaims.
 */
export function placeClaim({ groupId, dropSymbol, addSymbol, rank } = {}) {
  const payload = { groupId, dropSymbol, addSymbol };
  if (Number.isInteger(rank) && rank >= 1) payload.rank = rank;
  return postTournamentAction('place-claim', payload);
}

/**
 * Flip a held pick's live leg (long↔short — the server toggles; no direction
 * sent). Response carries marketState ('open' → executes now at flipPrice,
 * banked bankedLegScore; 'closed' → executes at next open), the per-pick
 * flipCountToday, and doubledDown.
 */
export function flipPick({ groupId, symbol } = {}) {
  return postTournamentAction('flip', { groupId, symbol });
}

/**
 * League Training Slice 2 — make the human's live pick in the interactive snake
 * draft. `autopick: true` is the per-pick-clock timeout (the server picks the
 * top archetype-fit available name). The server holds the turn guard, sequences
 * the CPU run-up, and on the 12th pick performs the transition-only completion
 * handoff. Response: { status, currentPickIndex, complete }. The training routes
 * are dark-gated, so carry through a ?nextArc=1 preview param when present (the
 * gate is open in prod where the flag is on; this keeps a flag-off preview
 * smoke working).
 */
export function makeTrainingPick({ groupId, symbol, autopick } = {}) {
  const payload = { groupId };
  if (autopick === true) payload.autopick = true;
  if (symbol) payload.symbol = symbol;
  return postTournamentAction(`training-pick${nextArcSuffix()}`, payload);
}

/** ?nextArc=1 passthrough for the dark-gated training routes (the preview idiom). */
function nextArcSuffix() {
  try {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('nextArc') === '1') {
      return '?nextArc=1';
    }
  } catch { /* non-browser / no location — prod flag carries the gate */ }
  return '';
}

// Known server error codes → friendly copy. ABSENT codes fall back to the
// server's own message (never hide a rule the server enforces). The copy
// mirrors the server's stated rules; it never invents one.
const ERROR_COPY = Object.freeze({
  window_closed: 'The claim window is closed — it opens at the 4:00 PM ET close and shuts at 9:24 AM ET.',
  // Phase-4 exposure guard: a canonical round is close-only. Server rejects an
  // in-hours claim so the leg can't take retroactive exposure at the next open.
  claims_closed_during_market_hours: 'Claims open after the 4:00 PM ET close — the market is open right now.',
  claim_cap_reached: 'You already have 3 pending claims. Wait for tonight’s processing or drop one.',
  not_in_pool: 'That name isn’t in your group’s claimable pool.',
  drop_not_on_roster: 'You can only drop one of your own three picks.',
  battle_last_day: 'No new claims on the battle’s last day.',
  duplicate_claim: 'You already have a pending claim for that exact swap.',
  flip_cap_reached: 'This pick has used all 5 of its flips for today.',
  price_unavailable: 'No live price right now — try again in a moment.',
  leg_already_closed: 'That leg is already closing — banking will settle it.',
  pick_not_found: 'That symbol isn’t one of your picks.',
  not_member: 'You’re not a member of this group.',
  not_battle: 'This group isn’t in battle yet.',
  invalid_symbols: 'Pick a valid name to drop and one to claim.',
  invalid_symbol: 'That symbol is invalid.',
  invalid_group_id: 'Something’s off with this group — refresh and retry.',
  group_not_found: 'This group could not be found — refresh and retry.',
  // League Training Slice 2 — interactive-draft pick errors.
  draft_not_found: 'No draft is in progress for this pod — refresh and retry.',
  draft_not_active: 'This draft has already finished.',
  not_your_turn: 'Hold on — it’s not your pick yet.',
  invalid_pick: 'That name isn’t available on the board — pick another.',
  no_pick_available: 'No name is available to autopick right now.',
  pool_exhausted: 'The draft pool is empty.',
  training_disabled: 'Training mode isn’t available right now.',
});

/** Map a thrown action error to user copy; falls back to the server message. */
export function mapTournamentActionError(err) {
  if (!err) return 'Something went wrong — try again.';
  return ERROR_COPY[err.code] || err.message || 'Something went wrong — try again.';
}
