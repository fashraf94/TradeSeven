// @vitest-environment jsdom
// src/components/League/backing/StakeControl.jsdom.test.jsx
//
// Backing Beta PR 4 — SURFACE C, the stake control, and the attestation step
// in front of it (build item F; spec V1.3 §4/§5/§8/§9; Amendment A §A2/§A3).
//
// THE ROWS THIS FILE EXISTS FOR:
//   · the three disclosure lines render VERBATIM from src/constants/backing.js,
//     in order, directly above Confirm, never collapsed;
//   · each Confirm generates a FRESH requestId;
//   · "Backed" appears ONLY after the server's success reply — never while the
//     request is in flight, never after a refusal;
//   · every refusal reason maps to a plain sentence from the copy module;
//   · attestation first: no valid attestation → the step (the PR 0 placeholder
//     copy, marked for counsel while the terms are a draft) before the control;
//     `account_required` → the plain sign-in sentence; an `eligibility_required`
//     refusal re-presents the step;
//   · the per-team cap and the remaining allowance come from the wallet state
//     and the viewer's own stakes, and bound the presets and the custom amount.
//   · D-ag (Amendment C §C2): with a live stake on the team the Confirm step
//     says it ADDS to that stake ("Adds to your {n} BP on {label}."), and a
//     top-up reply shows the stake's new total with what this Confirm added.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DISCLOSURES, MIN_STAKE_BP, PER_TEAM_CAP_BP } from '../../../constants/backing';
import { ATTESTATION_COPY, TERMS_VERSION } from '../../../constants/eligibility';

const svc = vi.hoisted(() => ({ placeStake: vi.fn(), attestEligibility: vi.fn(), ids: 0 }));
vi.mock('../../../services/backingService', () => ({
  placeStake: (...a) => svc.placeStake(...a),
  attestEligibility: (...a) => svc.attestEligibility(...a),
  newRequestId: () => `req-${svc.ids += 1}`,
  BackingApiError: class BackingApiError extends Error { constructor(code) { super(code); this.code = code; } },
}));

const { default: StakeControl, validateAmount } = await import('./StakeControl');
const { stakedOnTeam } = await import('./backingStakes');
const { REFUSALS, STAKE } = await import('./backingCopy');

class Refusal extends Error { constructor(code) { super(code); this.code = code; } }

const card = () => ({
  groupId: 'g1', odUserId: 'od-a', viewerUid: 'viewer-1',
  seat: { index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false },
  // D-af (Amendment C §C1): the team-card projection carries the seat's label (its primary agent) and the player as secondary.
  team: { displayName: 'Mira', label: 'Kestrel', secondary: 'Mira', isCpu: false, pitch: null, derived: null, agent: { name: 'Kestrel', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: 'x', traitCount: 4, ruleCount: 7 } },
  known: null, lastWeek: null,
});
const pod = (myStakes = []) => ({ groupId: 'g1', pool: { status: 'open', closesAt: '2026-09-28T03:59:59.000Z' }, myStakes });
const attested = () => ({ status: 'attested', refresh: vi.fn() });

let roots = [];
async function mount(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const all = { card: card(), pod: pod(), wallet: { known: true, left: 1000, total: 1000 }, eligibility: attested(), onBacked: vi.fn(), onClose: vi.fn(), ...props };
  await act(async () => { root.render(<StakeControl {...all} />); });
  roots.push({ root, container });
  return { container, props: all };
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); };
const settle = async () => { for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); }); };
const q = (c, sel) => c.querySelector(sel);
const confirmButton = (c) => q(c, '[data-backing="confirm"]');

beforeEach(() => { svc.placeStake.mockReset(); svc.attestEligibility.mockReset(); svc.ids = 0; });
afterEach(async () => {
  for (const { root, container } of roots) { await act(async () => root.unmount()); container.remove(); }
  roots = [];
});

describe('the control, attested', () => {
  it('renders the three disclosure lines VERBATIM, in order, directly above Confirm', async () => {
    const { container } = await mount();
    const html = container.innerHTML;
    const i1 = html.indexOf(DISCLOSURES.loadouts);
    const i2 = html.indexOf(DISCLOSURES.payout);
    const i3 = html.indexOf(DISCLOSURES.validity);
    const confirm = html.indexOf('data-backing="confirm"');
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
    expect(confirm).toBeGreaterThan(i3);
    // Never collapsed, never behind an icon: every line is visible text, no details/summary, no "info" toggle.
    expect(q(container, '[data-backing="disclosures"]')).not.toBeNull();
    expect(html).not.toContain('<details');
    expect(html).not.toContain('aria-expanded');
  });

  it('presets 100 / 250 / 500, the largest affordable selected by default; a tap changes the Confirm amount', async () => {
    const { container } = await mount();
    expect([...container.querySelectorAll('[data-preset]')].map((b) => b.getAttribute('data-preset'))).toEqual(['100', '250', '500']);
    expect(confirmButton(container).textContent).toBe('Confirm 500 BP');
    await click(q(container, '[data-preset="250"]'));
    expect(confirmButton(container).textContent).toBe('Confirm 250 BP');
  });

  it('shows the allowance and the per-team cap from the wallet state and the viewer’s own stakes', async () => {
    const { container } = await mount({ wallet: { known: true, left: 640, total: 1000 }, pod: pod([{ stakeId: 's1', teamOdUserId: 'od-a', amount: 150, status: 'live' }]) });
    expect(container.textContent).toContain('640');
    expect(container.textContent).toContain('of 1,000 BP');
    expect(container.textContent).toContain(`Per-team cap ${PER_TEAM_CAP_BP} BP · 150 already on Kestrel`);
  });

  it('Confirm sends a FRESH requestId and shows "Backed" ONLY after the server’s success reply', async () => {
    let resolve;
    svc.placeStake.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { container, props } = await mount();
    await click(q(container, '[data-preset="250"]'));
    await click(confirmButton(container));
    expect(svc.placeStake).toHaveBeenCalledTimes(1);
    expect(svc.placeStake.mock.calls[0][0]).toEqual({ groupId: 'g1', teamOdUserId: 'od-a', amount: 250, requestId: 'req-1' });
    // In flight: no "Backed", the button says it is confirming.
    expect(container.textContent).not.toContain('Backed');
    expect(confirmButton(container).textContent).toBe('Confirming…');
    await act(async () => { resolve({ replay: false, stake: { id: 'stk_1', amount: 250 }, pool: { status: 'open' }, allowanceRemaining: 750 }); });
    await settle();
    expect(q(container, '[data-backing="backed"]')).not.toBeNull();
    // A reply without its own label names the team by the card's label — never an id (D-af).
    expect(container.textContent).toContain('Backed · 250 BP on Kestrel');
    expect(container.textContent).toContain('Recorded by the server.');
    expect(props.onBacked).toHaveBeenCalledTimes(1);
  });

  it('D-af: "Backed" names the team by the stake REPLY\'s own label — the server confirmed this stake', async () => {
    svc.placeStake.mockResolvedValue({ replay: false, stake: { id: 'stk_1', amount: 250 }, teamLabel: { label: 'Shadow', secondary: 'Mira' }, pool: { status: 'open' }, allowanceRemaining: 750 });
    const { container } = await mount();
    await click(q(container, '[data-preset="250"]'));
    await click(confirmButton(container));
    await settle();
    expect(container.textContent).toContain('Backed · 250 BP on Shadow');
    expect(container.textContent).not.toContain('od-a');
  });

  it('a refusal shows the plain sentence, never "Backed" — and the retry carries a NEW requestId', async () => {
    svc.placeStake.mockRejectedValueOnce(new Refusal('pool_closed'));
    svc.placeStake.mockRejectedValueOnce(new Refusal('per_team_cap'));
    const { container } = await mount();
    await click(confirmButton(container));
    await settle();
    expect(container.textContent).toContain(REFUSALS.pool_closed);
    expect(container.textContent).not.toContain('Backed');
    expect(q(container, '[data-backing="backed"]')).toBeNull();
    await click(confirmButton(container));
    await settle();
    expect(svc.placeStake.mock.calls.map((c) => c[0].requestId)).toEqual(['req-1', 'req-2']);
    expect(container.textContent).toContain(REFUSALS.per_team_cap);
  });

  it('every refusal reason the endpoint can return has a plain sentence, and an unknown one falls back to the server sentence', () => {
    for (const code of ['invalid_group_id', 'invalid_team', 'invalid_amount', 'below_min_stake', 'above_team_cap', 'invalid_request_id', 'no_pod', 'no_pool', 'pool_not_open', 'pool_closed', 'battle_started', 'account_required', 'eligibility_required', 'own_pod', 'seat_not_present', 'no_completed_battle', 'request_id_conflict', 'per_team_cap', 'stake_already_spent', 'stake_not_live', 'insufficient_allowance', 'week_mismatch', 'server_error', 'network']) {
      expect(typeof REFUSALS[code], code).toBe('string');
      expect(REFUSALS[code].length, code).toBeGreaterThan(10);
      expect(REFUSALS[code]).not.toContain('_');
    }
  });

  it('a replayed reply says so beside Backed', async () => {
    svc.placeStake.mockResolvedValue({ replay: true, stake: { id: 'stk_1', amount: 500 } });
    const { container } = await mount();
    await click(confirmButton(container));
    await settle();
    expect(container.textContent).toContain('Backed · 500 BP');
    expect(container.textContent).toContain('Already recorded');
  });

  it('a custom amount below the minimum is refused client-side with the same sentence, and nothing is sent', async () => {
    const { container } = await mount();
    const input = q(container, '[data-backing="custom-amount"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '20');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(confirmButton(container).textContent).toBe('Confirm 20 BP');
    await click(confirmButton(container));
    expect(svc.placeStake).not.toHaveBeenCalled();
    expect(container.textContent).toContain(`The minimum stake is ${MIN_STAKE_BP} BP.`);
  });

  it('at the per-team cap the control says so and Confirm is disabled; presets above the allowance are disabled', async () => {
    const capped = await mount({ pod: pod([{ stakeId: 's1', teamOdUserId: 'od-a', amount: PER_TEAM_CAP_BP, status: 'live' }]) });
    expect(capped.container.textContent).toContain('You are at the per-team cap on Kestrel.');
    expect(confirmButton(capped.container).disabled).toBe(true);
    await click(confirmButton(capped.container));
    expect(svc.placeStake).not.toHaveBeenCalled();

    const poor = await mount({ wallet: { known: true, left: 120, total: 1000 } });
    expect(q(poor.container, '[data-preset="100"]').disabled).toBe(false);
    expect(q(poor.container, '[data-preset="250"]').disabled).toBe(true);
    expect(q(poor.container, '[data-preset="500"]').disabled).toBe(true);
    expect(confirmButton(poor.container).textContent).toBe('Confirm 100 BP');
  });
});

describe('D-ag — one stake per team per backer: a repeat backing TOPS UP (Amendment C §C2)', () => {
  it('with a live stake on this team, the Confirm step says it ADDS to that stake — the copy module\'s sentence, the seat\'s label', async () => {
    const { container } = await mount({ pod: pod([{ stakeId: 's1', teamOdUserId: 'od-a', amount: 150, status: 'live' }]) });
    const note = q(container, '[data-backing="top-up-note"]');
    expect(note).not.toBeNull();
    expect(note.textContent).toBe('Adds to your 150 BP on Kestrel.');
    expect(note.textContent).toBe(STAKE.addsTo(150, 'Kestrel'));
    // The cap is on the TOTAL: 150 already, so 350 is the most this Confirm can add.
    expect(q(container, '[data-preset="500"]').disabled).toBe(true);
    expect(confirmButton(container).textContent).toBe('Confirm 250 BP');
  });

  it('with no live stake on this team there is nothing to add to — no top-up sentence (a voided stake, or one on another team, is not this team\'s)', async () => {
    const fresh = await mount();
    expect(q(fresh.container, '[data-backing="top-up-note"]')).toBeNull();
    const elsewhere = await mount({ pod: pod([{ stakeId: 's1', teamOdUserId: 'od-b', amount: 150, status: 'live' }, { stakeId: 's2', teamOdUserId: 'od-a', amount: 100, status: 'voided' }]) });
    expect(q(elsewhere.container, '[data-backing="top-up-note"]')).toBeNull();
    expect(elsewhere.container.textContent).not.toContain('Adds to your');
  });

  it('a top-up reply: "Backed" shows the stake\'s NEW total, and says what this Confirm added', async () => {
    svc.placeStake.mockResolvedValue({ replay: false, topUp: true, added: 250, stake: { id: 'stk_1', amount: 400 }, teamLabel: { label: 'Kestrel', secondary: 'Mira' }, pool: { status: 'open' }, allowanceRemaining: 600 });
    const { container } = await mount({ pod: pod([{ stakeId: 'stk_1', teamOdUserId: 'od-a', amount: 150, status: 'live' }]) });
    await click(confirmButton(container));
    await settle();
    expect(svc.placeStake.mock.calls[0][0]).toEqual({ groupId: 'g1', teamOdUserId: 'od-a', amount: 250, requestId: 'req-1' });
    expect(container.textContent).toContain('Backed · 400 BP on Kestrel');
    expect(q(container, '[data-backing="topped-up"]').textContent).toBe(STAKE.toppedUp(250));
    expect(container.textContent).toContain('Added 250 BP to your stake.');
  });

  it('a first stake\'s reply says nothing about adding', async () => {
    svc.placeStake.mockResolvedValue({ replay: false, topUp: false, added: 250, stake: { id: 'stk_1', amount: 250 }, pool: { status: 'open' }, allowanceRemaining: 750 });
    const { container } = await mount();
    await click(q(container, '[data-preset="250"]'));
    await click(confirmButton(container));
    await settle();
    expect(container.textContent).toContain('Backed · 250 BP on Kestrel');
    expect(q(container, '[data-backing="topped-up"]')).toBeNull();
    expect(container.textContent).not.toContain('Added ');
  });

  it('a stake that can no longer be added to (settled or voided since the list was read) gets its plain sentence, never "Backed"', async () => {
    svc.placeStake.mockRejectedValue(new Refusal('stake_not_live'));
    const { container } = await mount({ pod: pod([{ stakeId: 'stk_1', teamOdUserId: 'od-a', amount: 150, status: 'live' }]) });
    await click(confirmButton(container));
    await settle();
    expect(container.textContent).toContain(REFUSALS.stake_not_live);
    expect(q(container, '[data-backing="backed"]')).toBeNull();
  });
});

describe('attestation first', () => {
  it('with no valid attestation the step renders BEFORE the control: the two placeholder statements, marked as draft terms', async () => {
    const { container } = await mount({ eligibility: { status: 'required', refresh: vi.fn() } });
    expect(q(container, '[data-backing="attestation"]')).not.toBeNull();
    expect(q(container, '[data-backing="stake-control"]')).toBeNull();
    expect(container.textContent).toContain(ATTESTATION_COPY.adult);
    expect(container.textContent).toContain(ATTESTATION_COPY.terms);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    // Marked for counsel while the terms version is a draft (the tripwire keeps the flag dark meanwhile).
    expect(/-draft$/.test(TERMS_VERSION)).toBe(true);
    expect(q(container, '[data-backing="terms-draft"]')).not.toBeNull();
    expect(container.textContent).toContain('Draft terms · pending counsel review');
  });

  it('Continue without both statements is refused locally; with both it records through the endpoint and hands back to the control', async () => {
    svc.attestEligibility.mockResolvedValue({ eligible: true, attestation: {} });
    const eligibility = { status: 'required', refresh: vi.fn() };
    const { container } = await mount({ eligibility });
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Continue');
    await click(button);
    expect(container.textContent).toContain('Confirm both statements to continue.');
    expect(svc.attestEligibility).not.toHaveBeenCalled();
    for (const box of container.querySelectorAll('input[type="checkbox"]')) await click(box);
    await click(button);
    await settle();
    expect(svc.attestEligibility).toHaveBeenCalledWith(TERMS_VERSION);
    expect(eligibility.refresh).toHaveBeenCalled();
  });

  it('an anonymous account gets the plain sign-in sentence (account_required)', async () => {
    svc.attestEligibility.mockRejectedValue(new Refusal('account_required'));
    const { container } = await mount({ eligibility: { status: 'required', refresh: vi.fn() } });
    for (const box of container.querySelectorAll('input[type="checkbox"]')) await click(box);
    await click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Continue'));
    await settle();
    expect(container.textContent).toContain(REFUSALS.account_required);
    expect(container.textContent).toContain('Sign in with an account');
  });

  it('an eligibility_required refusal from the stake endpoint re-presents the step', async () => {
    svc.placeStake.mockRejectedValue(new Refusal('eligibility_required'));
    const eligibility = attested();
    const { container } = await mount({ eligibility });
    expect(q(container, '[data-backing="stake-control"]')).not.toBeNull();
    await click(confirmButton(container));
    await settle();
    expect(q(container, '[data-backing="attestation"]')).not.toBeNull();
    expect(q(container, '[data-backing="stake-control"]')).toBeNull();
  });

  it('while the attestation status is still loading, nothing stakeable renders', async () => {
    const { container } = await mount({ eligibility: { status: 'loading', refresh: vi.fn() } });
    expect(q(container, '[data-backing="stake-checking"]')).not.toBeNull();
    expect(q(container, '[data-backing="stake-control"]')).toBeNull();
    expect(q(container, '[data-backing="attestation"]')).toBeNull();
  });
});

describe('the pure pieces', () => {
  it('stakedOnTeam sums the viewer’s LIVE stakes on that seat only', () => {
    expect(stakedOnTeam(pod([{ teamOdUserId: 'od-a', amount: 100, status: 'live' }, { teamOdUserId: 'od-a', amount: 50, status: 'voided' }, { teamOdUserId: 'od-b', amount: 500, status: 'live' }]), 'od-a')).toBe(100);
    expect(stakedOnTeam(null, 'od-a')).toBe(0);
  });

  it('validateAmount mirrors the endpoint’s bounds in the endpoint’s order', () => {
    expect(validateAmount(250.5, { capLeft: 500, allowanceLeft: 1000 })).toBe(REFUSALS.invalid_amount);
    expect(validateAmount(20, { capLeft: 500, allowanceLeft: 1000 })).toBe(REFUSALS.below_min_stake);
    expect(validateAmount(300, { capLeft: 250, allowanceLeft: 1000 })).toBe(REFUSALS.above_team_cap);
    expect(validateAmount(300, { capLeft: 500, allowanceLeft: 200 })).toBe(REFUSALS.insufficient_allowance);
    expect(validateAmount(300, { capLeft: 500, allowanceLeft: 1000 })).toBeNull();
  });
});

describe('the PR 4 review record — FAB-10, FAB-11, FAB-16 (docs/audits/20260922_BACKING_PR4_MULTILENS_REVIEW.md)', () => {
  it('FAB-10: until the wallet’s record has been read, nothing stakeable renders and no figure is shown — never a default 1,000', async () => {
    const { container } = await mount({ wallet: { known: false, left: null, total: 1000 } });
    expect(q(container, '[data-backing="wallet-checking"]')).not.toBeNull();
    expect(q(container, '[data-backing="stake-control"]')).toBeNull();
    expect(container.textContent).not.toContain('1,000');
    expect(container.textContent).toContain('Reading your points…');
  });

  it('FAB-11: a success reply that carries no stake is not "Backed" — the plain failure sentence, nothing recorded', async () => {
    svc.placeStake.mockResolvedValue({ ok: true });
    const { container, props } = await mount();
    await click(confirmButton(container));
    await settle();
    expect(q(container, '[data-backing="backed"]')).toBeNull();
    expect(container.textContent).not.toContain('Backed ·');
    expect(container.textContent).toContain(REFUSALS.server_error);
    expect(props.onBacked).not.toHaveBeenCalled();
  });

  it('FAB-16: below the smallest preset the minimum stake is pre-chosen — never "Confirm 0 BP"', async () => {
    const { container } = await mount({ wallet: { known: true, left: 80, total: 1000 } });
    expect(confirmButton(container).textContent).toBe('Confirm 50 BP');
    expect(container.textContent).not.toContain('Confirm 0 BP');
  });
});

describe('the PR 4 review record — refutation pass (R-A-8)', () => {
  it('a wallet that becomes known after the control mounted still pre-chooses the largest affordable preset', async () => {
    const { container, props } = await mount({ wallet: { known: false, left: null, total: 1000 } });
    expect(q(container, '[data-backing="wallet-checking"]')).not.toBeNull();
    const { root } = roots[roots.length - 1];
    await act(async () => { root.render(<StakeControl {...props} wallet={{ known: true, left: 1000, total: 1000 }} />); });
    expect(confirmButton(container).textContent).toBe('Confirm 500 BP');
    expect(q(container, '[data-preset="500"]').getAttribute('style')).toContain('rgb(');
  });
});
