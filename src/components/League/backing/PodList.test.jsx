// src/components/League/backing/PodList.test.jsx
//
// Backing Beta PR 4 — SURFACE A, the pod list, against the open-state
// contract (Amendment B §B2/§B6) and the reveal at close.
//
// THE SEAL ROW THIS FILE EXISTS FOR (BUILD_RULES §2 mutation check #1): a pod
// whose pool object has been GIVEN a pot, exact counts, per-team totals and a
// pays × while still `open` — the shape a mutated or leaky reply would carry —
// is rendered, and none of those figures may reach the DOM. An implementation
// that rendered `pool.potTotal` while open reds this row.
//
// react-dom/server: no effects, no listeners — the list is pure over its props.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { POOL_STRIP } from '../../../constants/backing';
import PodList from './PodList';

const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';
const WED_FIRE = '2026-09-23T23:00:00.000Z';

const teams = (over = {}) => ([
  { odUserId: 'od-a', isCpu: false, isOwnSeat: false, backable: true, ...(over['od-a'] || {}) },
  { odUserId: 'od-b', isCpu: false, isOwnSeat: false, backable: true, ...(over['od-b'] || {}) },
  { odUserId: 'cpu-1', isCpu: true, isOwnSeat: false, backable: true, ...(over['cpu-1'] || {}) },
  { odUserId: 'cpu-2', isCpu: true, isOwnSeat: false, backable: true, ...(over['cpu-2'] || {}) },
]);

const openPod = (groupId, over = {}) => ({
  groupId, formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40',
  seatNames: { 'od-a': 'Mira', 'od-b': 'Draco' }, humanTeams: 2,
  teams: teams(),
  pool: { status: 'open', backerProgress: { count: 2, floor: 3, met: false }, teamSpread: { met: false }, closesAt: SUNDAY_CLOSE, closeReason: 'clock' },
  myStakes: [],
  ...over,
});

const render = (pods) => renderToString(<PodList pods={pods} onOpenSeat={() => {}} />);

describe('the open state — exactly the §B2 contract', () => {
  it('renders the pod name, the seats with honest marks, the close from the pool, the chairs, the spread and the SEALED lockups', () => {
    const html = render([openPod('g1')]);
    expect(html).toContain('data-backing="pod"');
    expect(html).toContain('Mira');
    expect(html).toContain('Draco');
    expect(html).toContain('CPU — Trend Follower');
    expect(html).toContain('CPU — Contrarian');
    expect(html).toContain('2 humans · 2 CPUs');
    expect(html).toContain('Closes Sun 11:59 PM ET');
    expect(html).toContain('data-backing="chairs"');
    expect(html).toContain('data-count="2"');
    expect(html).toContain('2 of 3 backers');
    expect(html).toContain('back another to spread it');
    expect(html).toContain('SEALED');
    expect(html).toContain('data-backing="sealed"');
    expect(html).toContain('Pot');
    expect(html).toContain('Pays ×');
  });

  it('a qualified pool freezes: "Pool qualified", no chairs count, still sealed', () => {
    const html = render([openPod('g1', { pool: { status: 'open', backerProgress: { count: 3, floor: 3, met: true }, teamSpread: { met: true }, closesAt: SUNDAY_CLOSE } })]);
    expect(html).toContain('Pool qualified');
    expect(html).toContain('data-frozen="true"');
    expect(html).toContain('SEALED');
    expect(html).not.toContain('data-count="');
  });

  it('the viewer’s own stakes render through the §B6 line — the one number an open pool may show', () => {
    const html = render([openPod('g1', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 250, status: 'live' }, { stakeId: 's2', teamOdUserId: 'od-b', amount: 100, status: 'voided' }] })]);
    expect(html).toContain(POOL_STRIP.yourBacking.replace('{amount}', '250'));
    expect(html).toContain('data-backing="your-backing"');
  });

  it('a slot pod names its slot and reads its own fire-time close, never Sunday', () => {
    const html = render([openPod('lds_wed', { formationPath: 'slot', slotId: 'wed-1900', pool: { status: 'open', backerProgress: { count: 0, floor: 3, met: false }, teamSpread: { met: false }, closesAt: WED_FIRE, closeReason: 'fire' } })]);
    expect(html).toContain('Live-draft slot');
    expect(html).toContain('Closes Wed 7:00 PM ET');
    expect(html).not.toContain('Sun 11:59');
    expect(html).toContain('No backers yet');
  });

  it('SEAL — MUTATION CHECK #1: a pool object carrying a pot, exact counts, per-team totals and a pays × while OPEN leaks none of them', () => {
    const leaky = openPod('g-leak', {
      pool: { status: 'open', backerProgress: { count: 2, floor: 3, met: false }, teamSpread: { met: true }, closesAt: SUNDAY_CLOSE, potTotal: 1200, uniqueBackers: 5, teamsBacked: 3, paysX: 2.4 },
      teams: teams({ 'od-a': { stakeTotal: 700, backerCount: 3, paysX: 1.71 }, 'od-b': { stakeTotal: 500, backerCount: 2, paysX: 2.4 } }),
    });
    const html = render([leaky]);
    expect(html).toContain('SEALED');
    // The visible text carries none of the bare figures (the markup's style
    // attributes carry `font-weight:700`, so the numbers are checked on the
    // text the reader sees) …
    const text = html.replace(/<[^>]*>/g, ' ');
    for (const figure of ['1,200', '1200', '700', '500', '1.71', '2.40', '5 backers']) {
      expect(text, `leaked "${figure}" while open`).not.toContain(figure);
    }
    // … and the whole markup carries none of the revealed view's formatted strings.
    for (const figure of ['1,200 BP', '700 BP', '500 BP', '×1.71', '×2.40', 'pays ×', 'Pot 1', 'data-backing="revealed"']) {
      expect(html, `leaked "${figure}" while open`).not.toContain(figure);
    }
    // The chairs never show above the floor, whatever the reply claims.
    expect(html).not.toContain('data-count="5"');
    expect(html).toContain('data-count="2"');
  });
});

describe('the viewer’s own pod reads as yours, not disabled', () => {
  it('tags the pod "Yours", tags the seat "You", and every seat is still a tappable button', () => {
    const html = render([openPod('g-mine', { teams: teams({ 'od-a': { isOwnSeat: true, backable: false }, 'od-b': { backable: false }, 'cpu-1': { backable: false }, 'cpu-2': { backable: false } }) })]);
    expect(html).toContain('>Yours<');
    expect(html).toContain('>You<');
    expect((html.match(/role="button"/g) || []).length).toBe(4);
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('opacity:0.5');
  });
});

describe('the revealed view at close', () => {
  it('a closed pool shows the pot, the exact backers, and the per-team totals, counts and pays ×', () => {
    const html = render([openPod('g-closed', {
      pool: { status: 'closed', potTotal: 1200, uniqueBackers: 5, validity: { backers: 5, minBackers: 3, teams: 2, minTeams: 2 }, closesAt: SUNDAY_CLOSE, closeReason: 'clock' },
      teams: teams({ 'od-a': { stakeTotal: 700, backerCount: 3, paysX: 1.71 }, 'od-b': { stakeTotal: 500, backerCount: 2 }, 'cpu-1': { stakeTotal: 0, backerCount: 0 }, 'cpu-2': { stakeTotal: 0, backerCount: 0 } }),
    })]);
    expect(html).toContain('Closed · revealed');
    expect(html).toContain('Pot 1,200 BP');
    expect(html).toContain('5 backers');
    expect(html).toContain('700 BP · 3 backers');
    expect(html).toContain('500 BP · 2 backers');
    expect(html).toContain('pays ×1.71');
    expect(html).not.toContain('SEALED');
  });

  it('an insufficient pool says so plainly and a refunded one too', () => {
    expect(render([openPod('g-thin', { pool: { status: 'insufficient', potTotal: 200, uniqueBackers: 2 } })])).toContain('Did not qualify · stakes void');
    expect(render([openPod('g-gone', { pool: { status: 'refunded', potTotal: 0, uniqueBackers: 0 } })])).toContain('Refunded · stakes void');
  });

  it('a pod with no pool says so; an empty list says so', () => {
    expect(render([openPod('g-none', { pool: null })])).toContain('No pool for this pod.');
    expect(render([])).toContain('No pods to back yet.');
  });
});
