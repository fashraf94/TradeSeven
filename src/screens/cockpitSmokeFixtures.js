// src/screens/cockpitSmokeFixtures.js
//
// SMOKE BRANCH ONLY — claude/cockpit-build2a-smoke, never merged (Cockpit
// Build 2a spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md §12 "Smoke branch").
//
// `?cockpitFixtures=1` on the Battle View bypasses the status check and feeds
// the cockpit IN-MEMORY records — no Firestore read, no POST — covering every
// row of §7.3 (the answer matrix), §7.4 (every state tag) and §8.3 (every
// refusal line) on both shells. Variants: `=pending` puts an UNHEARD call
// directive in the slot (overrides disabled, the spec's line); `=heard` the
// same directive heard (still disabled until it expires — HEAD's endpoint
// rule — with the "stays active" line).
//
// Every record has the stored shape candidate.js mints (Amendment C fields
// included, mintedMode 'on'). Times are quarter-hour slots TODAY, ending at
// the current slot, so deadlines are live whenever the page is opened; the
// calls name the battle's own newest checks (evalId) so the check-card link
// lands, and one names a check that is not in the chat (the missing-card line).
//
// §8.3 — a tap on ANY button of a Needs-you tile returns that tile's row:
//   AAPL 409 already_answered · AMD 409 expired · AMZN 409 parent_not_active ·
//   AVGO 409 belief_mismatch · CRM 409 directive_pending · CRWD 409 budget ·
//   GOOGL 429 · INTC 404 cockpit_unavailable · META 400 · MSFT 403 · MU 401 ·
//   NFLX 500 · NVDA no response · ORCL 200 (accepted — the tile does not
//   change: no optimistic state; a real listener would deliver the record)

export const SMOKE_PARAM = 'cockpitFixtures';
const VARIANTS = new Set(['1', 'pending', 'heard']);

/** The smoke variant from the URL, or null (fixture mode off). Never throws. */
export function cockpitSmokeVariant() {
  try {
    const v = new URLSearchParams(window.location.search).get(SMOKE_PARAM);
    return VARIANTS.has(v) ? v : null;
  } catch {
    return null;
  }
}

const SLOT_MS = 15 * 60 * 1000;
const HOUR = 3_600_000;

const REFUSALS = Object.freeze({
  AAPL: [409, { error: 'refused', reason: 'already_answered' }],
  AMD: [409, { error: 'refused', reason: 'expired' }],
  AMZN: [409, { error: 'refused', reason: 'parent_not_active' }],
  AVGO: [409, { error: 'refused', reason: 'belief_mismatch', currentDirectiveThreadId: null }],
  CRM: [409, { error: 'refused', reason: 'directive_pending', pendingDirectiveThreadId: 'smoke-pending', pendingCallId: 'smoke-unknown' }],
  CRWD: [409, { error: 'refused', reason: 'budget' }],
  GOOGL: [429, { error: 'rate_limited' }],
  INTC: [404, { error: 'cockpit_unavailable' }],
  META: [400, { error: 'illegal_answer', reason: 'smoke' }],
  MSFT: [403, { error: 'forbidden' }],
  MU: [401, { error: 'unauthorized' }],
  NFLX: [500, { error: 'Could not record the answer. Try again in a moment.' }],
  NVDA: [null, null],
  ORCL: [200, { callId: 'smoke' }],
});

/**
 * @param {{ battleId: string, evaluations: object[]|null, nowMs: number, variant: string }} p
 */
export function buildCockpitSmoke({ battleId, evaluations, nowMs, variant }) {
  const slot = Math.floor(nowMs / SLOT_MS) * SLOT_MS;
  // Today's checks: c0 (45 min ago), c1 (30), c2 (15), c3 (the current slot).
  const at = (k) => slot - k * SLOT_MS + 20_000;
  const real = (Array.isArray(evaluations) ? evaluations : []).map((e) => e?.evalId).filter((id) => typeof id === 'string' && id);
  const evalIdOf = (k) => real[real.length - 1 - k] ?? `smoke-check-${k}`;
  const check = (k) => ({ evalId: evalIdOf(k), at: at(k) });
  const [c0, c1, c2, c3] = [check(3), check(2), check(1), check(0)];
  const live = { phrase: 'this_battle', expiresAt: nowMs + 6 * HOUR, basis: 'this_battle' };
  let n = 0;
  const call = (over = {}) => {
    n += 1;
    const c = over.check ?? c3;
    const { check: _c, ...rest } = over;
    return {
      callId: `${battleId}:smoke:call:${n}`, kind: 'called_shot', battleId, evalId: c.evalId, evalSeq: n,
      mintedAt: c.at + 40_000, mintedMode: 'on',
      symbol: 'AAPL', direction: 'entry', heldAtMint: false, slot: 'support', counterpart: null, counterpartRaw: null,
      condition: { side: 'above', level: 100 }, horizon: live,
      defaultAction: 'act', said: null, saidOk: null,
      evidence: { tickId: `smoke-${n}`, availability: 'unresolved', priceAsOf: new Date(c.at).toISOString() },
      hypothesisRef: null, origin: 'declared',
      state: 'open', stateChangedAt: c.at + 40_000, stateSource: 'mint',
      playerResponse: null, directiveThreadId: null, outcome: null, refused: null,
      ...rest,
    };
  };
  const answer = (c, { answer: a = 'hold', heard = null, kind = 'directive' } = {}) => ({
    answer: a, kind, callId: c.callId, filedAt: new Date(c.mintedAt + 90_000).toISOString(),
    ...(kind === 'directive' ? { directiveThreadId: `smoke-thread-${c.callId}`, heardEvalId: heard } : {}),
  });
  const ev = (c, kind, chk, extra = {}) => ({
    kind, at: (chk?.at ?? c.mintedAt) + 60_000, callIds: [c.callId], text: '',
    evidence: chk ? { evalId: chk.evalId, promptBuiltAt: new Date(chk.at).toISOString(), checkLabel: null } : {},
    ...extra,
  });

  // §7.3 — the matrix; each Needs-you tile is also one §8.3 row (by symbol).
  const calls = [
    call({ symbol: 'AAPL', counterpart: 'KO', condition: { side: 'above', level: 232.5 }, said: 'AAPL above $232.50 — I bring it in for KO.', saidOk: true }),
    call({ symbol: 'AMD', kind: 'confirmation', direction: 'exit', condition: { side: 'below', level: 151 } }),
    call({ symbol: 'AMZN', defaultAction: 'hold', condition: { side: 'above', level: 199 } }),
    call({ symbol: 'AVGO', defaultAction: 'hold', direction: 'exit', condition: { side: 'below', level: 162 } }),
    call({ symbol: 'CRM', counterpart: 'PG', condition: { side: 'above', level: 251 } }),
    call({ symbol: 'CRWD', condition: { side: 'above', level: 360 }, check: c2 }),
    call({ symbol: 'CRWD', condition: { side: 'above', level: 362 } }), // C-6: restated within 1 % — one tile
    call({ symbol: 'GOOGL', condition: { side: 'below', level: 158 }, direction: 'exit' }),
    call({ symbol: 'INTC', condition: { side: 'above', level: 24.5 } }),
    call({ symbol: 'META', condition: { side: 'above', level: 560 } }),
    call({ symbol: 'MSFT', condition: { side: 'above', level: 430 }, horizon: { phrase: 'by 4pm', expiresAt: nowMs + 2 * HOUR, basis: 'explicit' } }),
    call({ symbol: 'MU', condition: { side: 'below', level: 95 }, direction: 'exit', kind: 'confirmation' }),
    call({ symbol: 'NFLX', condition: { side: 'above', level: 700 } }),
    call({ symbol: 'NVDA', condition: { side: 'above', level: 125 }, check: { evalId: 'smoke-check-gone', at: c3.at } }), // not in the chat
    call({ symbol: 'ORCL', condition: { side: 'above', level: 140 } }),
    call({ symbol: 'TSLA', heldAtMint: true, condition: { side: 'above', level: 260 } }), // C-2 upside: Waiting, no buttons
    call({ kind: 'pick', symbol: null, direction: null, condition: null, defaultAction: null, swapOut: 'KO', options: [{ symbol: 'JPM', why: 'smoke' }, { symbol: 'BAC', why: 'smoke' }] }), // never a tile
  ];

  // §7.4 — every tag row, plus the review's additions.
  const ack = call({ symbol: 'PEP', check: c2 }); ack.playerResponse = answer(ack, { answer: 'go', kind: 'ack' });
  const ackOlder = call({ symbol: 'ADBE', check: c1 }); ackOlder.playerResponse = answer(ackOlder, { answer: 'go', kind: 'ack' });
  const ackNewer = call({ symbol: 'ADBE', check: c3, condition: { side: 'above', level: 100.5 } }); // agreement on the earlier wording
  const unheard = call({ symbol: 'QCOM', check: c2 }); unheard.playerResponse = answer(unheard);
  const heard = call({ symbol: 'SHOP', check: c1 }); heard.playerResponse = answer(heard, { heard: c2.evalId });
  const noMatch = call({ symbol: 'SNOW', check: c1, defaultAction: 'hold' }); noMatch.playerResponse = answer(noMatch, { answer: 'go_now', heard: c2.evalId });
  const replaced = call({ symbol: 'UBER', check: c1 }); replaced.playerResponse = answer(replaced);
  const actedOpen = call({ symbol: 'LLY', check: c1, outcome: { actedEvalId: c2.evalId } }); // acted while open (review L6-1)
  const pastDeadline = call({ symbol: 'NKE', check: c1, horizon: { phrase: 'next_check', expiresAt: c2.at - 20_000, basis: 'next_check' } }); // Live, no buttons
  const acted = call({ symbol: 'V', check: c0, state: 'hit', stateChangedAt: c1.at + 30_000, outcome: { actedEvalId: c1.evalId } });
  const hit = call({ symbol: 'WMT', check: c0, state: 'hit', stateChangedAt: c1.at + 30_000 });
  const expired = call({ symbol: 'XOM', check: c0, state: 'expired_unresolved', stateChangedAt: c2.at + 30_000, horizon: { phrase: 'next_check', expiresAt: c1.at, basis: 'next_check' } });
  const ended = call({ symbol: 'ZS', check: c0, state: 'ended_with_battle', stateChangedAt: c2.at + 30_000 });
  const dropped = call({ symbol: 'DIS', check: c0, state: 'invalidated' });
  calls.push(ack, ackOlder, ackNewer, unheard, heard, noMatch, replaced, actedOpen, pastDeadline, acted, hit, expired, ended, dropped);

  const events = [
    ev(heard, 'heard', c2),
    ev(noMatch, 'heard', c2), ev(noMatch, 'no_matching_trade', c2),
    ev(replaced, 'superseded', null, { at: c3.at + 10_000 }),
    ev(acted, 'heard', c1), ev(acted, 'acted', c1),
    ev(expired, 'expired', null, { at: c2.at + 30_000 }),
    ev(ended, 'ended_with_battle', null, { at: c2.at + 30_000 }),
    ...[ack, ackOlder, unheard, heard, noMatch, replaced].map((c) => ev(c, 'answered', null, { at: c.mintedAt + 90_000 })),
  ];

  const observations = {
    [acted.callId]: { px: 281.9, observedAtMs: c1.at + 20_000 },
    [hit.callId]: { px: 96.4, observedAtMs: c1.at + 20_000 },
    [expired.callId]: { px: 118.2, observedAtMs: c2.at + 20_000 },
  };

  // One call at a time: an unheard / heard call directive in the slot.
  let directive = null;
  if (variant === 'pending' || variant === 'heard') {
    const slotCall = variant === 'heard' ? heard : unheard;
    directive = {
      family: 'call', text: `Hold off on ${slotCall.symbol} for now`, expiry: 'until_ms', expiresAtMs: nowMs + 3 * HOUR,
      directiveThreadId: slotCall.playerResponse.directiveThreadId, createdAt: slotCall.playerResponse.filedAt,
      callId: slotCall.callId, kind: 'call_hold',
    };
  }

  const monitoring = { symbols: ['PLTR', 'ARM', 'SMCI', 'COIN', 'MSTR', 'HOOD', 'RIVN'], evalId: c3.evalId, mintedAt: c3.at + 40_000 };

  const symbolOf = new Map(calls.map((c) => [c.callId, c.symbol]));
  const post = async ({ callId }) => {
    await new Promise((r) => setTimeout(r, 700)); // long enough to see "Sending…"
    const row = REFUSALS[symbolOf.get(callId)] ?? [200, { callId }];
    return { status: row[0], body: row[1] };
  };

  return { calls, events, monitoring, observations, directive, post };
}
