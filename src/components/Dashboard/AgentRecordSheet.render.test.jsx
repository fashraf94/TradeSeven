// src/components/Dashboard/AgentRecordSheet.render.test.jsx
//
// Archetype Mastery P3 — the RecordSheet's cumulative per-archetype cards
// (spec §10) + the DARK PHOTOGRAPH: with MASTERY_SURFACE_ENABLED false the
// sheet's html is BYTE-IDENTICAL to a render with no masteryProfile at all
// (the section is absent, not merely empty). renderToString, flag
// getter-mocked; progression module un-mocked.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const { flagState } = vi.hoisted(() => ({ flagState: { surface: true } }));

vi.mock('../../../api/_utils/masteryConfig.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get MASTERY_SURFACE_ENABLED() { return flagState.surface; },
  };
});
// The sheet's import chain reaches src/firebase/config (ArchetypePicker →
// agentService) which throws without VITE_FIREBASE_* env — no Firestore
// call happens in an SSR render, so inert stubs suffice.
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));
// EquipSheet portals into document.body (no DOM under renderToString) —
// passthrough keeps the sheet BODY (the surface under test) real.
vi.mock('./EquipSheet', () => ({
  default: ({ children }) => <div data-testid="equip-sheet">{children}</div>,
}));

const { default: AgentRecordSheet } = await import('./AgentRecordSheet.jsx');

const AGENT = {
  id: 'agent-1', ownerId: 'u1', name: 'Aurora', archetype: 'guardian',
  stats: { gamesPlayed: 6, wins: 3, losses: 3 },
  consolidatedInsight: '', evolutionTimeline: [], createdAt: '2026-07-01T00:00:00.000Z',
};
const LEVEL_CONFIG = { label: 'Starter', color: '#5eead4', minGames: 5, maxGames: 14 };
const NEXT_LEVEL = { level: 'partner', label: 'Partner', gamesNeeded: 9 };

const PROFILE = {
  archetypes: {
    guardian: { xp: 250, battlesCounted: 5, lastAwardAt: '2026-07-21T00:00:00.000Z' },
    degen: { xp: 950, battlesCounted: 12, lastAwardAt: '2026-07-20T00:00:00.000Z' },
    analyst: { xp: 0, battlesCounted: 0 }, // empty stream — no card
  },
};

const render = (masteryProfile) => stripComments(renderToString(
  <AgentRecordSheet
    open
    onClose={() => {}}
    agent={AGENT}
    loading={false}
    accent="#5eead4"
    levelConfig={LEVEL_CONFIG}
    nextLevelInfo={NEXT_LEVEL}
    masteryProfile={masteryProfile}
    dock="center"
  />,
));

// renderToString separates adjacent text nodes with <!-- --> comments.
const stripComments = (h) => h.replace(/<!-- -->/g, '');

beforeEach(() => { flagState.surface = true; });

describe('DARK photograph', () => {
  it('SURFACE off: byte-identical to a profile-less render — the section does not exist', () => {
    flagState.surface = false;
    const withProfile = render(PROFILE);
    const without = render(null);
    expect(withProfile).toBe(without);
    expect(withProfile).not.toContain('Archetype mastery');
  });
});

describe('lit rows (spec §10 cumulative cards)', () => {
  it('renders one card per non-empty stream with level, band, battles counted, XP-to-next', () => {
    const html = render(PROFILE);
    expect(html).toContain('Archetype mastery');
    // guardian: 250 XP → L2 Novice, 250 to L3, 5 battles.
    expect(html).toContain('L2 · Novice');
    expect(html).toContain('250 XP to L3');
    expect(html).toContain('5 battles counted');
    // degen: 950 XP → L4 Adept.
    expect(html).toContain('L4 · Adept');
    // analyst: empty stream → no third card (Fundamental Investor absent).
    expect(html).not.toContain('Fundamental Investor');
  });

  it('lit with NO profile: the honest empty state, never fake cards', () => {
    const html = render(null);
    expect(html).toContain('Archetype mastery');
    expect(html).toContain('No training records yet');
    expect(html).not.toContain('battles counted');
  });
});

// Reflection outage fix (P-OUT-1, display line D): the sheet's timeline shows
// "No lesson was recorded for this game." under a game whose memory entry
// holds the legacy failure line; a real lesson renders as written, and the
// "Strategic insight" paragraph is untouched.
describe('timeline — legacy failure entries (P-OUT-1 display line D)', () => {
  const renderAgent = (agent) => stripComments(renderToString(
    <AgentRecordSheet
      open
      onClose={() => {}}
      agent={agent}
      loading={false}
      accent="#5eead4"
      levelConfig={LEVEL_CONFIG}
      nextLevelInfo={NEXT_LEVEL}
      masteryProfile={null}
      dock="center"
    />,
  ));
  const AGENT_WITH_MEMORY = {
    ...AGENT,
    consolidatedInsight: 'Most of my reflections failed, so I trade on instinct.',
    memory: [
      { gameId: 'g1', gameMode: 'baggerbomb_tournament', result: 'loss', score: -42, lesson: 'Reflection generation failed.', adjustment: 'N/A', date: '2026-10-08T00:00:00.000Z' },
      { gameId: 'g2', gameMode: 'baggerbomb', result: 'win', score: 12, lesson: 'Trim winners into strength.', adjustment: 'Hold less cash.', date: '2026-10-09T00:00:00.000Z' },
    ],
  };

  it('a legacy failure entry renders the honest line, never the failure line', () => {
    const html = renderAgent(AGENT_WITH_MEMORY);
    expect(html).toContain('No lesson was recorded for this game.');
    expect(html).not.toContain('Reflection generation failed.');
  });

  it('a real lesson renders unchanged, and the Strategic insight paragraph is shown as stored', () => {
    const html = renderAgent(AGENT_WITH_MEMORY);
    expect(html).toContain('Trim winners into strength.');
    expect(html).toContain('Strategic insight');
    expect(html).toContain('Most of my reflections failed, so I trade on instinct.');
  });
});
