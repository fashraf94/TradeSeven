// @vitest-environment jsdom
// src/components/League/backing/stakeOneRequest.jsdom.test.jsx
//
// Backing safety fix 1, item E — ONE CONFIRM IS ONE REQUEST UNTIL IT RESOLVES
// (Astra's BKG-004; Amendment D R6, the founder's Oct 18, 2026 ruling).
//
// THE DEFECT (Astra's U1): a stake that committed but whose reply was lost
// read "No connection. Try again.", and the next press minted a NEW request
// id — a second debit. These rows drive the rendered control against the
// REAL stake primitive (api/_utils/backingStake.js) over the shared versioned
// harness, so "exactly one debit" is the wallet the ledger wrote, not a mock's
// call count. The reply of the FIRST request is dropped AFTER its commit — the
// lost acknowledgement — and "Check again" must resend the identical request,
// which the server answers as a replay.
//
// THE ROWS (the build prompt's §3 E):
//   1. the U1 shape: reply lost, Check again sends the same id, one debit —
//      the wallet reads 900, not 800 (MUTATION: a fresh id on Check again →
//      this row fails); in both layouts;
//   2. a remount between the two presses;
//   3. a reload in the same tab (the in-memory copy gone, sessionStorage kept);
//   4. a typed refusal clears the attempt;
//   5. throwing storage still works, in memory.
//
// The backing service seam is stood in for (its Firebase client is env-gated);
// the control's own `services` prop carries the real primitive.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../../services/backingService', () => ({
  placeStake: vi.fn(), attestEligibility: vi.fn(), newRequestId: () => 'unused',
  BackingApiError: class BackingApiError extends Error {},
}));

const { default: StakeControl } = await import('./StakeControl');
const { STAKE, REFUSALS } = await import('./backingCopy');
const { STAKE_ATTEMPT_STORAGE_PREFIX, forgetStakeAttemptMemory, readStakeAttempt, stakeAttemptKey, stakeOutcomeAmbiguous } = await import('./stakeAttempts');
const { makeVersionedDb } = await import('../../../../api/_utils/__fixtures__/versionedFirestore.js');
const { placeStake: realPlaceStake } = await import('../../../../api/_utils/backingStake.js');
const { ALLOWANCE_BP } = await import('../../../constants/backing');
const { TERMS_VERSION } = await import('../../../constants/eligibility');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-09-22T14:00:00.000Z');
const UID = 'viewer-1';
const GID = 'g1';
const card = (odUserId = 'od-a') => ({
  groupId: GID, odUserId, viewerUid: UID,
  seat: { index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false },
  team: { displayName: 'Mira', label: 'Kestrel', secondary: 'Mira', isCpu: false, pitch: null, derived: null, agent: { name: 'Kestrel', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: 'x', traitCount: 4, ruleCount: 7 } },
  known: null, lastWeek: null,
});
const pod = { groupId: GID, pool: { status: 'open', closesAt: '2026-09-28T03:59:59.000Z' }, myStakes: [] };

/** A world with one open lobby pod and an eligible viewer — the real stake path runs on it. */
function world() {
  const seats = ['od-a', 'od-b', 'cpu-1'];
  const w = makeVersionedDb({
    [`tournamentGroups/${GID}`]: { status: 'forming', isLiveDraft: false, baseLayerWeek: '2026-W40', createdAt: NOW.toISOString(), groupMembers: seats, players: seats.map((odUserId) => ({ odUserId, picks: [], ...(odUserId.startsWith('cpu') ? { isCpu: true } : {}) })) },
    [`eligibility/${UID}`]: { termsVersion: TERMS_VERSION, adultAttestedAt: NOW.toISOString(), acceptedAt: NOW.toISOString() },
    [`agentBattles/done-${UID}`]: { ownerId: UID, status: 'completed', completedAt: '2026-09-10T20:00:00.000Z' },
  });
  return w;
}
const lost = () => Object.assign(new Error('lost acknowledgement'), { code: 'network', status: 0 });

/**
 * The control's `services`: the REAL primitive, answered as the route answers
 * — and, for the first `dropReplies` calls, the reply LOST after the commit.
 * Every request the control sends is recorded.
 */
function servicesFor(w, { dropReplies = 1, ids = null } = {}) {
  const sent = [];
  let minted = 0;
  return {
    sent,
    newRequestId: () => (ids ? ids() : `try-${minted += 1}`),
    placeStake: async (req) => {
      sent.push(req);
      const out = await realPlaceStake(w.db, { uid: UID, decodedToken: { uid: UID, firebase: { sign_in_provider: 'password' } }, ...req, now: NOW });
      if (out.refusal) throw Object.assign(new Error(out.refusal.error), { code: out.refusal.error, status: out.refusal.status });
      if (sent.length <= dropReplies) throw lost();
      return { replay: out.replay, topUp: out.topUp, added: out.added, stake: out.stake, teamLabel: { label: 'Kestrel', secondary: null }, allowanceRemaining: out.wallet ? out.wallet.allowanceRemaining : null };
    },
  };
}

let roots = [];
async function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const all = { uid: UID, card: card(), pod, wallet: { known: true, left: 1000, total: 1000 }, eligibility: { status: 'attested', refresh: vi.fn() }, onBacked: vi.fn(), onClose: vi.fn(), ...props };
  await act(async () => { root.render(<StakeControl {...all} />); });
  const entry = { root, container, unmount: async () => { await act(async () => root.unmount()); container.remove(); roots = roots.filter((r) => r !== entry); } };
  roots.push(entry);
  return entry;
}
const q = (c, sel) => c.querySelector(sel);
async function press(c, sel) {
  const el = q(c, sel);
  expect(el, `${sel} is not on screen`).not.toBeNull();
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  for (let i = 0; i < 20; i += 1) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
const walletLeft = (w) => w.store.get(`backingWallets/${UID}`)?.allowanceRemaining;
const KEY = stakeAttemptKey(UID, GID, 'od-a');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  forgetStakeAttemptMemory();
  try { globalThis.sessionStorage?.clear(); } catch { /* none */ }
});
afterEach(async () => {
  for (const r of [...roots]) await r.unmount();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the ambiguity rule (R6)', () => {
  it('network, server_error, any 5xx and a code-less error are ambiguous; a typed refusal is not', () => {
    expect(stakeOutcomeAmbiguous({ code: 'network', status: 0 })).toBe(true);
    expect(stakeOutcomeAmbiguous({ code: 'server_error', status: 504 })).toBe(true);
    expect(stakeOutcomeAmbiguous({ code: 'whatever', status: 503 })).toBe(true);
    expect(stakeOutcomeAmbiguous(new Error('no code'))).toBe(true);
    for (const [code, status] of [['pool_closed', 409], ['per_team_cap', 409], ['pool_full', 409], ['own_pod', 403], ['eligibility_required', 403], ['insufficient_allowance', 409], ['invalid_amount', 400]]) {
      expect(stakeOutcomeAmbiguous({ code, status }), code).toBe(false);
    }
  });

  it('a refusal from the DOOR in front of the stake — sign-in, the rate limit, a dark route — does NOT end the attempt', () => {
    // These never reached the replay probe: the first request may have
    // committed, so clearing the attempt would let a later Confirm debit twice.
    expect(stakeOutcomeAmbiguous({ code: 'Authentication required', status: 401 })).toBe(true);
    expect(stakeOutcomeAmbiguous({ code: 'Rate limit exceeded', status: 429 })).toBe(true);
    expect(stakeOutcomeAmbiguous({ code: 'Not found', status: 404 })).toBe(true);
    expect(stakeOutcomeAmbiguous({ code: 'Method not allowed. Use POST.', status: 405 })).toBe(true);
  });

  it('a rate-limited "Check again" keeps the attempt — the next one still replays the first request: one debit', async () => {
    const w = world();
    const real = servicesFor(w);
    let calls = 0;
    const services = {
      ...real,
      placeStake: async (req) => {
        calls += 1;
        if (calls === 2) { real.sent.push(req); throw Object.assign(new Error('Rate limit exceeded'), { code: 'Rate limit exceeded', status: 429 }); }
        return real.placeStake(req);
      },
    };
    const { container } = await mount({ services });
    await press(container, '[data-backing="confirm"]');            // commits; reply lost
    await press(container, '[data-backing="check-again"]');        // 429 at the door
    expect(q(container, '[data-backing="stake-unresolved"]')).not.toBeNull();
    expect(readStakeAttempt(KEY)).not.toBeNull();
    await press(container, '[data-backing="check-again"]');        // replayed
    expect(real.sent.map((r) => r.requestId)).toEqual(['try-1', 'try-1', 'try-1']);
    expect(q(container, '[data-backing="backed"]')).not.toBeNull();
    expect(walletLeft(w)).toBe(900);
  });
});

describe('item E — one Confirm is one request until it resolves (R6)', () => {
  for (const layout of ['mobile', 'desktop']) {
    it(`ROW 1 (U1), ${layout}: the reply is LOST, "Check again" sends the SAME id, the server replays — exactly one debit, the wallet reads 900`, async () => {
      const w = world();
      const services = servicesFor(w);
      const { container } = await mount({ services, layout });
      await press(container, '[data-backing="confirm"]');
      // The first request COMMITTED; its reply never arrived.
      expect(walletLeft(w)).toBe(ALLOWANCE_BP - 100);
      expect(q(container, '[data-backing="stake-unresolved"]').textContent).toContain(STAKE.unresolved(100, 'Kestrel'));
      expect(container.textContent).not.toContain(REFUSALS.network);
      // The amount is locked: no preset, no custom amount, no Confirm.
      expect(q(container, '[data-preset]')).toBeNull();
      expect(q(container, '[data-backing="custom-amount"]')).toBeNull();
      expect(q(container, '[data-backing="confirm"]')).toBeNull();
      await press(container, '[data-backing="check-again"]');
      expect(services.sent.map((r) => r.requestId)).toEqual(['try-1', 'try-1']);
      expect(services.sent.map((r) => r.amount)).toEqual([100, 100]);
      expect(q(container, '[data-backing="backed"]')).not.toBeNull();
      expect(container.textContent).toContain(STAKE.replayed);
      // ONE debit: 900, not 800.
      expect(walletLeft(w)).toBe(900);
      expect(readStakeAttempt(KEY)).toBeNull();
    });
  }

  it('ROW 2: a REMOUNT between the two presses — re-entering the team\'s form shows the same state, and Check again sends the same request', async () => {
    const w = world();
    const services = servicesFor(w);
    const first = await mount({ services });
    await press(first.container, '[data-backing="confirm"]');
    await first.unmount();
    // A different team's form is its own attempt — normal.
    const other = await mount({ services, card: card('od-b') });
    expect(q(other.container, '[data-backing="confirm"]')).not.toBeNull();
    expect(q(other.container, '[data-backing="stake-unresolved"]')).toBeNull();
    await other.unmount();
    const again = await mount({ services, layout: 'desktop' });
    expect(q(again.container, '[data-backing="stake-unresolved"]')).not.toBeNull();
    await press(again.container, '[data-backing="check-again"]');
    expect(services.sent.map((r) => r.requestId)).toEqual(['try-1', 'try-1']);
    expect(walletLeft(w)).toBe(900);
  });

  it('ROW 3: a RELOAD in the same tab — the in-memory copy is gone, this tab\'s storage brings the attempt back', async () => {
    const w = world();
    const services = servicesFor(w);
    const first = await mount({ services });
    await press(first.container, '[data-backing="confirm"]');
    await first.unmount();
    expect(globalThis.sessionStorage.getItem(STAKE_ATTEMPT_STORAGE_PREFIX + KEY)).not.toBeNull();
    forgetStakeAttemptMemory(); // what a reload does to the module
    const again = await mount({ services });
    expect(q(again.container, '[data-backing="stake-unresolved"]')).not.toBeNull();
    await press(again.container, '[data-backing="check-again"]');
    expect(services.sent.map((r) => r.requestId)).toEqual(['try-1', 'try-1']);
    expect(walletLeft(w)).toBe(900);
    expect(globalThis.sessionStorage.getItem(STAKE_ATTEMPT_STORAGE_PREFIX + KEY)).toBeNull();
  });

  it('ROW 4: a TYPED refusal ends the attempt — the sentence shows, the form returns, the next Confirm is a new request', async () => {
    const sent = [];
    let calls = 0;
    const services = {
      newRequestId: () => `try-${sent.length + 1}`,
      placeStake: async (req) => {
        sent.push(req);
        calls += 1;
        if (calls === 1) throw lost();
        if (calls === 2) throw Object.assign(new Error('pool_closed'), { code: 'pool_closed', status: 409 });
        return { stake: { amount: req.amount }, allowanceRemaining: 900 };
      },
    };
    const { container } = await mount({ services });
    await press(container, '[data-backing="confirm"]');
    await press(container, '[data-backing="check-again"]');
    expect(sent.map((r) => r.requestId)).toEqual(['try-1', 'try-1']);
    expect(q(container, '[data-backing="stake-error"]').textContent).toBe(REFUSALS.pool_closed);
    expect(q(container, '[data-backing="stake-unresolved"]')).toBeNull();
    expect(readStakeAttempt(KEY)).toBeNull();
    expect(globalThis.sessionStorage.getItem(STAKE_ATTEMPT_STORAGE_PREFIX + KEY)).toBeNull();
    // The resolved attempt is gone: a new Confirm is a NEW request.
    await press(container, '[data-backing="confirm"]');
    expect(sent.map((r) => r.requestId)).toEqual(['try-1', 'try-1', 'try-3']);
  });

  it('ROW 5: THROWING storage — the attempt still lives in memory across a remount, and nothing throws', async () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('storage blocked'); });
    const w = world();
    const services = servicesFor(w);
    const first = await mount({ services });
    await press(first.container, '[data-backing="confirm"]');
    expect(q(first.container, '[data-backing="stake-unresolved"]')).not.toBeNull();
    await first.unmount();
    const again = await mount({ services });
    expect(q(again.container, '[data-backing="stake-unresolved"]')).not.toBeNull();
    await press(again.container, '[data-backing="check-again"]');
    expect(services.sent.map((r) => r.requestId)).toEqual(['try-1', 'try-1']);
    expect(walletLeft(w)).toBe(900);
  });

  it('a success on the FIRST press leaves no attempt behind', async () => {
    const w = world();
    const services = servicesFor(w, { dropReplies: 0 });
    const { container } = await mount({ services });
    await press(container, '[data-backing="confirm"]');
    expect(q(container, '[data-backing="backed"]')).not.toBeNull();
    expect(readStakeAttempt(KEY)).toBeNull();
    expect(walletLeft(w)).toBe(900);
  });
});

describe('the review\'s client rows — HON-4, HON-6, HON-8', () => {
  function deferredServices() {
    const sent = [];
    let release;
    const services = {
      sent,
      newRequestId: () => `try-${sent.length + 1}`,
      placeStake: (req) => { sent.push(req); return new Promise((resolve, reject) => { release = { resolve, reject }; }); },
    };
    return { services, settle: () => release };
  }

  it('HON-4: a form re-entered WHILE the first request is still out shows it as being confirmed, holds its button, and learns the answer — success', async () => {
    const { services, settle } = deferredServices();
    const first = await mount({ services });
    await act(async () => { q(first.container, '[data-backing="confirm"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await first.unmount(); // the request is still out
    const again = await mount({ services });
    const notice = q(again.container, '[data-backing="stake-unresolved"]');
    expect(notice.getAttribute('data-in-flight')).toBe('true');
    expect(notice.textContent).toContain(STAKE.inFlight(100, 'Kestrel'));
    expect(notice.textContent).not.toContain(STAKE.unresolved(100, 'Kestrel'));
    expect(q(again.container, '[data-backing="check-again"]').disabled).toBe(true);
    // Pressing the held button sends nothing.
    await press(again.container, '[data-backing="check-again"]');
    expect(services.sent).toHaveLength(1);
    // The first request lands: a success ends the attempt, and the form says so.
    await act(async () => { settle().resolve({ stake: { amount: 100, status: 'live' }, allowanceRemaining: 900 }); });
    for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise((r) => setImmediate(r)); });
    expect(q(again.container, '[data-backing="stake-unresolved"]')).toBeNull();
    expect(q(again.container, '[data-backing="confirm"]')).not.toBeNull();
    expect(readStakeAttempt(KEY)).toBeNull();
  });

  it('HON-4: …and when the first request\'s answer is ambiguous, the re-entered form turns to "couldn\'t confirm" and Check again sends the SAME request', async () => {
    const { services, settle } = deferredServices();
    const first = await mount({ services });
    await act(async () => { q(first.container, '[data-backing="confirm"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await first.unmount();
    const again = await mount({ services });
    await act(async () => { settle().reject(lost()); });
    for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise((r) => setImmediate(r)); });
    const notice = q(again.container, '[data-backing="stake-unresolved"]');
    expect(notice.getAttribute('data-in-flight')).toBeNull();
    expect(notice.textContent).toContain(STAKE.unresolved(100, 'Kestrel'));
    expect(q(again.container, '[data-backing="check-again"]').disabled).toBe(false);
    await act(async () => { q(again.container, '[data-backing="check-again"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(services.sent.map((r) => r.requestId)).toEqual(['try-1', 'try-1']);
  });

  it('HON-6: a replay answered for a stake that is no longer live is not "sealed until the pool closes"', async () => {
    const services = {
      newRequestId: () => 'try-1',
      placeStake: async () => ({ replay: true, stake: { amount: 100, status: 'voided' }, allowanceRemaining: null }),
    };
    const { container } = await mount({ services });
    await press(container, '[data-backing="confirm"]');
    expect(container.textContent).toContain(STAKE.backedSubClosed);
    expect(container.textContent).not.toContain(STAKE.backedSub);
  });

  it('HON-8: the attempt follows the VIEWER — a control that stays mounted across an account change re-reads under the new key', async () => {
    const w = world();
    const services = servicesFor(w);
    const first = await mount({ services });
    await press(first.container, '[data-backing="confirm"]');
    expect(q(first.container, '[data-backing="stake-unresolved"]')).not.toBeNull();
    const { root } = first;
    await act(async () => { root.render(<StakeControl uid="someone-else" card={card()} pod={pod} wallet={{ known: true, left: 1000, total: 1000 }} eligibility={{ status: 'attested', refresh: vi.fn() }} services={services} />); });
    expect(q(first.container, '[data-backing="stake-unresolved"]')).toBeNull();
    expect(q(first.container, '[data-backing="confirm"]')).not.toBeNull();
    // …and back: the first viewer's attempt is still theirs.
    await act(async () => { root.render(<StakeControl uid={UID} card={card()} pod={pod} wallet={{ known: true, left: 1000, total: 1000 }} eligibility={{ status: 'attested', refresh: vi.fn() }} services={services} />); });
    expect(q(first.container, '[data-backing="stake-unresolved"]')).not.toBeNull();
  });
});
