// src/components/CommandCenter/hub/huddleView.test.js
//
// Huddle S1 — the hub's pure view of the Huddle and the next action's new rule (Huddle spec Amendment C V1.2 §C4, §C6, §C8,
// §C15; Command Center spec V1.2 Amendment D §D1, §D2, §D5, §D7, §D8). With no Huddle candidate the next action is the S4
// rules, unchanged: no existing nextAction.test.js or CommandCenterHub.s4 row moves (build report, hub-contract section).

import { describe, it, expect } from 'vitest';
import { deriveNextAction, laterKeyOf, NEXT_ACTION_KINDS } from './nextAction';
import { HUB_COPY as COPY } from './hubCopy';
import {
  HUDDLE_KIND, huddleLaterKeyOf, huddleChipOf, huddleCandidateOf, battleStatusText, huddleStatusOf, needsReconfirmOf,
  huddlePartnershipOf, huddlePartnershipSummaryOf, huddleActivityOf, durationText, huddleMemberOf,
} from './huddleView';
import { deriveActivity, ACTIVITY_KINDS } from './activityRows';

const ET = '2026-11-09';
const OPEN = Date.parse('2026-11-09T14:30:00Z');
const CLOSE = Date.parse('2026-11-09T21:00:00Z');
const record = (over = {}, plan = {}) => ({
  etDate: ET, status: 'ready', session: { etDate: ET, closeMs: CLOSE, openMs: OPEN }, audio: { durationMs: 70_400, hasAudio: true },
  plan: { status: 'proposed', revision: 'r1', current: { stances: [{ kind: 'HOLD', ticker: 'AAA' }], lines: [] }, confirmations: [], battles: [], eventLabels: {}, ...plan },
  ...over,
});
const read = (huddle, over = {}) => ({ key: 'u:1', status: 'ready', huddle, asOf: '2026-11-09T13:00:00Z', ...over });

describe('E7: membership from the two readers (huddleMemberOf) — positive evidence only', () => {
  const plans = (n) => ({ status: 'ready', plans: Array.from({ length: n }, (_, i) => ({ etDate: `2026-11-0${i + 1}`, planStatus: 'confirmed' })) });
  it('inside: today answered with a record (history not needed, or still out)', () => {
    expect(huddleMemberOf(read(record()), { status: 'loading', plans: null })).toBe(true);
    expect(huddleMemberOf(read(record(), { stale: true }), plans(0))).toBe(true);
  });
  it('inside: today answered with no record, and the history holds a plan', () => {
    expect(huddleMemberOf(read(null), plans(1))).toBe(true);
  });
  it('outside: the 404 (settled `outside`), even with a history', () => {
    expect(huddleMemberOf({ key: 'u:1', status: 'outside', huddle: null }, plans(2))).toBe(false);
  });
  it('outside: today answered with no record and no history, or the history still out or failed', () => {
    expect(huddleMemberOf(read(null), plans(0))).toBe(false);
    expect(huddleMemberOf(read(null), { status: 'loading', plans: null })).toBe(false);
    expect(huddleMemberOf(read(null), { status: 'error', plans: null })).toBe(false);
  });
  it('outside: today still loading, idle or failed — whatever the history holds', () => {
    for (const status of ['loading', 'idle', 'error']) expect(huddleMemberOf({ key: 'u:1', status, huddle: null }, plans(3)), status).toBe(false);
    expect(huddleMemberOf(null, plans(3))).toBe(false);
  });
});

describe('the next action (C6): a game in session → Huddle ready → a game waiting for the open → a review → the first deployment', () => {
  const huddle = huddleCandidateOf(read(record()), OPEN - 3_600_000);
  // Amendment E §E6 re-pinned this row: a game is in session by its own `inSession` (the market open), never by `preOpen` alone
  const inSession = { id: 'g1', preOpen: false, inSession: true, mode: 'BaggerBomb', opponent: 'CPU', clock: 'ends 4:00 PM' };
  const preOpen = { id: 'g2', preOpen: true, mode: 'Ranked', opponent: 'Pod', clock: 'waiting for the open' };
  const base = { battles: [], rowsById: new Map(), firstDeployment: true, liveResolved: true };

  it('without a Huddle candidate the S4 rules are exactly as before (the pre-open game first, else the first deployment)', () => {
    expect(deriveNextAction({ ...base, liveRows: [preOpen] }).candidate.key).toBe(NEXT_ACTION_KINDS.OPEN_GAME);
    expect(deriveNextAction({ ...base, liveRows: [] }).candidate.key).toBe(NEXT_ACTION_KINDS.DEPLOY);
    expect(deriveNextAction({ ...base, liveRows: [preOpen], huddle: null })).toEqual(deriveNextAction({ ...base, liveRows: [preOpen] }));
  });

  it('Huddle ready sits ABOVE a game deployed and waiting for the open, and above the first deployment', () => {
    expect(deriveNextAction({ ...base, liveRows: [preOpen], huddle }).candidate).toMatchObject({ key: HUDDLE_KIND, title: COPY.huddle.readyTitle, cta: COPY.huddle.open, laterKey: `huddle:${ET}` });
    expect(deriveNextAction({ ...base, liveRows: [], huddle }).candidate.key).toBe(HUDDLE_KIND);
  });

  it('a game IN SESSION sits above Huddle ready', () => {
    expect(deriveNextAction({ ...base, liveRows: [preOpen, inSession], huddle }).candidate).toMatchObject({ key: NEXT_ACTION_KINDS.OPEN_GAME, id: 'g1' });
  });

  it('Later on the Huddle (its own key, huddle:{etDate}) falls through to the S4 rules; Later on the game in session shows the Huddle', () => {
    expect(deriveNextAction({ ...base, liveRows: [preOpen], huddle, dismissed: new Set([huddleLaterKeyOf(ET)]) }).candidate).toMatchObject({ key: NEXT_ACTION_KINDS.OPEN_GAME, id: 'g2' });
    expect(deriveNextAction({ ...base, liveRows: [inSession], huddle, dismissed: new Set([laterKeyOf(NEXT_ACTION_KINDS.OPEN_GAME, 'g1')]) }).candidate.key).toBe(HUDDLE_KIND);
  });

  it('until the live poll answers, the card waits instead of showing the Huddle (a game in session may yet exist)', () => {
    expect(deriveNextAction({ ...base, liveRows: [], liveResolved: false, huddle })).toEqual({ status: 'loading', candidate: null });
  });

  it('after confirm or skip, after the close, or with no ready record, there is no candidate and the card falls through', () => {
    expect(huddleCandidateOf(read(record({}, { status: 'confirmed' })), OPEN)).toBeNull();
    expect(huddleCandidateOf(read(record({}, { status: 'skipped' })), OPEN)).toBeNull();
    expect(huddleCandidateOf(read(record()), CLOSE)).toBeNull();
    expect(huddleCandidateOf(read(record({ status: 'generating' })), OPEN)).toBeNull();
    expect(huddleCandidateOf({ status: 'idle', huddle: null }, OPEN)).toBeNull();
    // review L3-8: an empty proposed plan has nothing to confirm or skip, so it is no candidate
    expect(huddleCandidateOf(read(record({}, { current: { stances: [], lines: [] } })), OPEN)).toBeNull();
    expect(huddleCandidateOf(read(record({}, { current: { stances: [], lines: [{ kind: 'NO_SWAPS_TODAY' }] } })), OPEN)).not.toBeNull();
  });
});

describe('the chip (C4): a state label and a door', () => {
  it('ready with a duration rendered from data; preparing; unavailable; heard once the plan is answered; none without a record', () => {
    expect(durationText(70_400)).toBe('1:10');
    expect(huddleChipOf(read(record()))).toEqual({ state: 'ready', label: 'Huddle · 1:10' });
    expect(huddleChipOf(read(record({ audio: null })))).toEqual({ state: 'ready', label: 'Huddle' });
    expect(huddleChipOf(read(record({ status: 'generating' })))).toEqual({ state: 'preparing', label: COPY.huddle.chipPreparing });
    expect(huddleChipOf(read(record({ status: 'failed' })))).toEqual({ state: 'failed', label: COPY.huddle.chipUnavailable });
    // review L3-7: the plan's status, never "heard"
    expect(huddleChipOf(read(record({}, { status: 'confirmed' }))).label).toBe(COPY.huddle.chipPlan.confirmed);
    expect(huddleChipOf(read(record({}, { status: 'skipped' }))).label).toBe(COPY.huddle.chipPlan.skipped);
    expect(huddleChipOf(read(record({}, { status: 'expired' }))).label).toBe(COPY.huddle.chipPlan.expired);
    expect(Object.values(COPY.huddle.chipPlan).some((l) => /heard/i.test(l))).toBe(false);
    expect(huddleChipOf({ status: 'idle', huddle: null })).toBeNull();
  });
});

describe('per-game status from receipts only (§6.4; A §A4; C §C7, §C15)', () => {
  const at = '2026-11-09T15:15:00.000Z';
  it.each([
    [{ disposition: 'written' }, COPY.huddle.battle.filed],
    [{ disposition: 'written', heardAt: at }, COPY.huddle.battle.heard('10:15 AM ET')],
    [{ disposition: 'written', heardAt: at, replacedAt: at, replacedSince: null }, COPY.huddle.battle.noLongerCurrent],
    [{ disposition: 'written', replacedAt: at, replacedSince: at }, COPY.huddle.battle.noLongerCurrentSince('10:15 AM ET')],
    [{ disposition: 'written', retiredAt: at }, COPY.huddle.battle.retired],
    [{ disposition: 'retry_live_call' }, COPY.huddle.battle.liveCall],
    [{ disposition: 'retry_inactive' }, COPY.huddle.battle.inactive],
    [{ disposition: 'stale_approach' }, COPY.huddle.battle.staleApproach],
    [{ disposition: 'stale_approach', expiredAt: at }, COPY.huddle.battle.expired],
    [{ disposition: 'skipped_newer_instruction' }, COPY.huddle.battle.newerInstruction],
    [{ disposition: 'archetype_unsupported' }, COPY.huddle.battle.unsupported],
  ])('%j', (receipt, words) => {
    expect(battleStatusText({ battleKind: 'ranked', ...receipt })).toBe(`${COPY.huddle.games.ranked}${COPY.sep}${words}`);
  });

  it('the sheet\'s status: a confirmed plan with no game yet waits for a game; CPU seats never shown', () => {
    expect(huddleStatusOf(record({}, { status: 'confirmed', battles: [] })).plan).toBe(COPY.huddle.planState.waitingForGame);
    expect(huddleStatusOf(record({}, { status: 'confirmed', battles: [{ battleId: 'c', disposition: 'skipped_cpu' }] })).battles).toEqual([]);
  });
});

describe('E1 — the Reconfirm door is the server\'s acceptance predicate (plan.reconfirm.missing), only while it would file', () => {
  const confirmedWith = (missing) => read(record({}, { status: 'confirmed', confirmations: [{ archetype: 'analyst', revision: 'r1' }], reconfirm: missing === undefined ? undefined : { inPlay: ['analyst', ...missing], missing } }));
  const before = OPEN - 3_600_000;
  it('an archetype in play with no confirmation opens the door; none missing keeps it shut', () => {
    expect(needsReconfirmOf(confirmedWith(['contrarian']), before)).toBe(true);
    expect(needsReconfirmOf(confirmedWith([]), before)).toBe(false);
  });
  it('no reconfirm state (a failed read, an older answer), a proposed plan, or a closed session: shut', () => {
    expect(needsReconfirmOf(confirmedWith(undefined), before)).toBe(false);
    expect(needsReconfirmOf(read(record({}, { reconfirm: { inPlay: ['degen'], missing: ['degen'] } })), before)).toBe(false);
    expect(needsReconfirmOf(confirmedWith(['contrarian']), CLOSE)).toBe(false);
    expect(needsReconfirmOf(confirmedWith(['contrarian']), undefined)).toBe(false);
  });
  it('a game line under an approach with no confirmation shows " · Reconfirm" only with the door', () => {
    const b = { battleId: 'b1', battleKind: 'casual', disposition: 'stale_approach' };
    expect(battleStatusText(b)).toBe(`${COPY.huddle.games.casual}${COPY.sep}${COPY.huddle.battle.staleApproach}`);
    expect(battleStatusText(b, { door: true })).toBe(`${COPY.huddle.games.casual}${COPY.sep}${COPY.huddle.battle.staleApproach}${COPY.sep}${COPY.huddle.reconfirm}`);
    expect(battleStatusText({ ...b, expiredAt: 'x' }, { door: true })).toBe(`${COPY.huddle.games.casual}${COPY.sep}${COPY.huddle.battle.expired}`);
  });
  it('Partnership\'s game line carries the same door as the sheet\'s (review HU-5)', () => {
    const today = read(record({}, { status: 'confirmed', battles: [{ battleId: 'b1', battleKind: 'casual', disposition: 'stale_approach' }] }));
    const history = { status: 'ready', plans: [] };
    const line = (door) => huddlePartnershipOf(today, history, door === undefined ? undefined : { door }).today.battles[0].text;
    expect(line(true)).toBe(`${COPY.huddle.games.casual}${COPY.sep}${COPY.huddle.battle.staleApproach}${COPY.sep}${COPY.huddle.reconfirm}`);
    expect(line(false)).toBe(`${COPY.huddle.games.casual}${COPY.sep}${COPY.huddle.battle.staleApproach}`);
    expect(line(undefined)).toBe(line(false));
    expect(line(true)).toBe(huddleStatusOf(today.huddle, { door: true }).battles[0].text);
  });
});

describe('the Partnership panel (C8): loading, none, error, as-of', () => {
  it('each state', () => {
    expect(huddlePartnershipOf({ status: 'loading' }, { status: 'loading' })).toEqual({ status: 'loading' });
    expect(huddlePartnershipOf({ status: 'error' }, { status: 'error' })).toEqual({ status: 'error' });
    expect(huddlePartnershipOf({ status: 'ready', huddle: null }, { status: 'ready', plans: [] }).status).toBe('none');
    const kept = huddlePartnershipOf({ ...read(record()), stale: true }, { status: 'ready', plans: [{ etDate: '2026-11-06', planStatus: 'confirmed' }] });
    expect(kept.status).toBe('ready');
    expect(kept.today.items).toEqual(['Hold AAA']);
    expect(kept.history.map((h) => h.text)).toEqual(['Nov 6 · Confirmed']);
    expect(kept.asOf).toMatch(/couldn’t refresh$/);
  });

  it('review L3-3: an empty history never stands in for today: today loading is loading, today failed is an error with Retry', () => {
    const emptyHistory = { status: 'ready', plans: [] };
    expect(huddlePartnershipOf({ status: 'loading' }, emptyHistory)).toEqual({ status: 'loading' });
    expect(huddlePartnershipOf({ status: 'error' }, emptyHistory)).toEqual({ status: 'error' });
    expect(huddlePartnershipOf({ status: 'error' }, { status: 'ready', plans: [{ etDate: '2026-11-06', planStatus: 'confirmed' }] })).toEqual({ status: 'error' });
    expect(huddlePartnershipOf(read(record()), { status: 'loading' })).toEqual({ status: 'loading' });
    expect(huddlePartnershipOf(read(record()), { status: 'error' })).toEqual({ status: 'error' });
    expect(huddlePartnershipOf({ status: 'ready', huddle: null }, emptyHistory)).toEqual({ status: 'none', today: null, history: [], asOf: null });
  });

  it("its one-line summary beside Shadow (D5 replaces the reserved summary too): loading, error, none, today's plan line; null without a section", () => {
    expect(huddlePartnershipSummaryOf(null)).toBeNull();
    expect(huddlePartnershipSummaryOf({ status: 'loading' })).toBe(COPY.huddle.partnershipLoading);
    expect(huddlePartnershipSummaryOf({ status: 'error' })).toBe(COPY.huddle.partnershipError);
    expect(huddlePartnershipSummaryOf({ status: 'none' })).toBe(COPY.huddle.partnershipNone);
    const ready = huddlePartnershipOf(read(record({}, { status: 'proposed' })), { status: 'ready', plans: [] });
    expect(huddlePartnershipSummaryOf(ready)).toBe(COPY.huddle.planState.proposed);
    expect(huddlePartnershipSummaryOf({ status: 'ready', today: null, history: [{ etDate: '2026-11-06', text: 'Nov 6 · Confirmed' }] })).toBe(COPY.huddle.partnershipNone);
  });
});

describe('Recent activity (C8): plan rows with kind-specific ids and the standard cutoff', () => {
  it('confirmed and skipped plans become rows `huddle-plan:{uid}:{etDate}`; an older one than the window\'s cutoff is not listed', () => {
    const events = huddleActivityOf({ plans: [
      { etDate: ET, planStatus: 'confirmed', confirmedAt: '2026-11-09T13:00:00.000Z' },
      { etDate: '2026-11-06', planStatus: 'skipped', skippedAt: '2026-11-06T13:00:00.000Z' },
      { etDate: '2026-10-01', planStatus: 'confirmed', confirmedAt: '2026-10-01T13:00:00.000Z' },
      { etDate: '2026-11-05', planStatus: 'proposed' },
    ] }, 'u1');
    expect(events.map((e) => e.id)).toEqual(['huddle-plan:u1:2026-11-09', 'huddle-plan:u1:2026-11-06', 'huddle-plan:u1:2026-10-01']);
    const windowDoc = { id: 'b1', completedAt: '2026-11-02T21:00:00.000Z' };
    const section = deriveActivity({ battles: [windowDoc], live: [], rowsById: new Map(), huddle: events, nowMs: OPEN });
    const rows = section.rows.filter((r) => r.kind === ACTIVITY_KINDS.HUDDLE);
    expect(rows.map((r) => [r.id, r.text])).toEqual([['huddle-plan:u1:2026-11-09', COPY.activity.planConfirmed], ['huddle-plan:u1:2026-11-06', COPY.activity.planSkipped]]);
    // and none without the history
    expect(deriveActivity({ battles: [windowDoc], live: [], rowsById: new Map(), nowMs: OPEN }).rows.some((r) => r.kind === ACTIVITY_KINDS.HUDDLE)).toBe(false);
  });
});
