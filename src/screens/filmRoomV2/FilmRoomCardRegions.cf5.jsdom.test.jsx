// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomCardRegions.cf5.jsdom.test.jsx
//
// Film Room D1 item 7 — Build C Amendment F, CF-5: in My cards, "Your agent doesn't act on your ideas yet." appears
// ONCE under the "Adopted" heading, never on an adopted row. The receipt's chain keeps its own line (CC-8) and the
// "Your cards, latest first" digest its own (CD-17) — both pinned where they are tested (FilmRoomCards.jsdom.test.jsx);
// the digest's rows are checked here only to show this item leaves them as they were.

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { SinceLastTime } from './FilmRoomCardRegions';
import { mounter } from './__fixtures__/filmRoomHarness';

const SENTENCE = "Your agent doesn't act on your ideas yet.";
const m = mounter();
afterEach(() => { if (m.root) m.teardown(); m.root = null; });

const at = (hm) => `2026-09-23T${hm}:00.000Z`;
const card = (entryId, stage, over = {}) => ({
  entryId,
  stage,
  route: 'offer',
  situationId: 'stalled',
  archetypeCodeId: 'momentum_chaser',
  shelved: false,
  version: 3,
  source: { battleId: 'b1', etDate: '2026-09-23', symbol: entryId.toUpperCase(), fromTickSeq: 1, toTickSeq: 2 },
  createdAt: at('15:00'),
  stageHistory: [{ stage: 'nominated', at: at('15:00'), by: 'player', opId: `${entryId}-c` }, ...(stage === 'installed' ? [{ stage: 'installed', at: at('20:40'), by: 'server', writer: 'practice_field', opId: `${entryId}-s` }] : [])],
  ...over,
});
const mount = (cards) => {
  m.setup();
  m.render(<SinceLastTime day="2026-09-23" battleId="b1" counter={{ status: 'ready', data: { cards, attributionAgentId: 'agent-1' } }} onOpenMoment={() => {}} onShowCard={() => {}} />);
};

describe('CF-5 — the adopted sentence once under My cards\' "Adopted" heading', () => {
  it('two adopted cards: one sentence, under the heading, before the rows — none on either row', () => {
    mount([card('aaa', 'installed'), card('bbb', 'installed'), card('ccc', 'nominated')]);
    const group = m.q('[data-my-cards-group="adopted"]');
    expect([...group.children].map((c) => c.getAttribute('data-my-card') ?? c.textContent)).toEqual(['Adopted', SENTENCE, 'aaa', 'bbb']);
    expect(group.querySelectorAll('[data-adopted-group-note]')).toHaveLength(1);
    for (const row of group.querySelectorAll('[data-my-card]')) {
      expect(row.textContent).toContain('adopted as your instruction');
      expect(row.textContent).not.toContain(SENTENCE);
    }
    // the whole of My cards says it once
    expect(m.q('[data-my-cards]').textContent.split(SENTENCE)).toHaveLength(2);
  });

  it('one adopted card: still once; no adopted card: no sentence in My cards, and no Adopted heading', () => {
    mount([card('aaa', 'installed')]);
    expect(m.qa('[data-my-cards] [data-adopted-group-note]')).toHaveLength(1);
    m.teardown(); m.root = null;
    mount([card('ccc', 'nominated'), card('ddd', 'retired', { stageHistory: [{ stage: 'nominated', at: at('15:00'), by: 'player' }, { stage: 'retired', at: at('16:00'), by: 'player' }] })]);
    expect(m.q('[data-my-cards-group="adopted"]')).toBeNull();
    expect(m.q('[data-my-cards]').textContent).not.toContain(SENTENCE);
  });

  it('the digest above My cards keeps its own line per adopted card (CD-17) — this item moves nothing there', () => {
    mount([card('aaa', 'installed'), card('bbb', 'installed')]);
    const digest = m.qa('[data-latest-line]');
    expect(digest.map((d) => d.getAttribute('data-latest-kind'))).toEqual(['installed', 'installed']);
    for (const d of digest) expect(d.querySelectorAll('[data-adopted-note]')).toHaveLength(1);
  });
});
