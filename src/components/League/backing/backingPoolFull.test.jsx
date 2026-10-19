// src/components/League/backing/backingPoolFull.test.jsx
//
// Backing safety fix 1, item A — "FULL" ON THE POD LIST (Amendment D R2, the
// founder's Oct 18, 2026 ruling): a pool at its backer limit shows "Full" to a
// viewer with NO stake in it and offers them no way to start one; a viewer
// who holds a stake there sees their pod as today and can still back. The two
// surfaces read one predicate (`poolFullForViewer`, backingStakes.js), over the
// same projection fields the pod-list endpoint sends (`pool.full`, `myStakes`).
//
// react-dom/server: no effects, no listeners — both surfaces are pure over props.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import PodList from './PodList';
import { BackButton } from './TeamCard';
import { poolFullForViewer } from './backingStakes';
import { CARD, POD_LIST } from './backingCopy';

const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';
const teams = () => ([
  { odUserId: 'od-a', isCpu: false, label: 'Shadow', secondary: 'Mira', isOwnSeat: false, backable: true },
  { odUserId: 'od-b', isCpu: false, label: 'Kestrel', secondary: 'Draco', isOwnSeat: false, backable: true },
  { odUserId: 'cpu-1', isCpu: true, label: 'CPU — Trend Follower', secondary: null, isOwnSeat: false, backable: true },
]);
const pod = ({ full = true, myStakes = [], status = 'open' } = {}) => ({
  groupId: 'g-full', formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40', humanTeams: 2, teams: teams(),
  pool: { status, backerProgress: { count: 3, floor: 3, met: true }, teamSpread: { met: true }, full, closesAt: SUNDAY_CLOSE, closeReason: 'clock' },
  myStakes,
});
const MINE = [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Shadow', amount: 100, status: 'live' }];
const card = () => ({
  groupId: 'g-full', odUserId: 'od-b',
  seat: { index: 2, count: 3, isCpu: false, isViewer: false, viewerSeated: false },
  team: { displayName: 'Draco', label: 'Kestrel', secondary: 'Draco', isCpu: false, agent: { name: 'Kestrel' } },
});
const list = (p) => renderToString(<PodList pods={[p]} onOpenSeat={() => {}} />);
const cta = (p) => renderToString(<BackButton card={card()} pod={p} agentName="Kestrel" accent="#00e0b0" onBack={() => {}} />);

describe('the one predicate', () => {
  it('full for a viewer with no stake in an OPEN full pool — and for nobody else', () => {
    expect(poolFullForViewer(pod())).toBe(true);
    expect(poolFullForViewer(pod({ myStakes: MINE }))).toBe(false);
    expect(poolFullForViewer(pod({ full: false }))).toBe(false);
    const legacy = pod();
    delete legacy.pool.full; // a pool written before the key existed
    expect(poolFullForViewer(legacy)).toBe(false);
    expect(poolFullForViewer(pod({ status: 'closed' }))).toBe(false);
  });
});

describe('the pod list — "Full" to a non-backer, today\'s pod to a backer', () => {
  it('a NON-BACKER sees "Full" — a word, no count', () => {
    const html = list(pod());
    expect(html).toContain('data-backing="pool-full"');
    expect(html).toContain(`>${POD_LIST.full}<`);
    expect(html).not.toMatch(/\b20\b/);
  });

  it('a BACKER of the full pool sees no "Full" tag, and their own stake line as today', () => {
    const html = list(pod({ myStakes: MINE }));
    expect(html).not.toContain('data-backing="pool-full"');
    expect(html).toContain('data-backing="your-backing"');
  });

  it('a pool that is not full lists as before', () => {
    expect(list(pod({ full: false }))).not.toContain('data-backing="pool-full"');
  });
});

describe('the team card — no way to start a stake in a full pool', () => {
  it('a NON-BACKER gets a sentence, not a button', () => {
    const html = cta(pod());
    expect(html).toContain('data-backing="cta-full"');
    expect(html).toContain(CARD.cta.full);
    expect(html).not.toContain('data-backing="cta-back"');
  });

  it('a BACKER keeps today\'s call to back — another team while the pool is under its document limit', () => {
    const html = cta(pod({ myStakes: MINE }));
    expect(html).toContain('data-backing="cta-back"');
    expect(html).not.toContain('data-backing="cta-full"');
  });
});
