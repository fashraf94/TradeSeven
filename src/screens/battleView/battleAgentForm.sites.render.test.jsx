// src/screens/battleView/battleAgentForm.sites.render.test.jsx
//
// Agent form build S1 (Scope B) — the three sites, with AGENT_FORM_BATTLE_ENABLED driven per row. The form's slot is
// a recording stand-in (the form itself: BattleAgentForm.jsdom.test.jsx; its moods: agentMood.test.js). Flag on:
// the arena header draws the player's form (72 px desktop, 48 phone) and a new opponent cell on the CPU side with
// "CPU" still there; the pane's header draws its form at 40 px inside today's 36 px box; the floating mark at its own
// size. Flag off: today's robot head at every site, and no slot. And the parity: the scores a mood is given are the
// same pair each site feeds its robot head (BUILD_RULES §9).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PANE_SECTION } from './useCharacterPane';

const flags = vi.hoisted(() => ({ battle: false }));
const seen = vi.hoisted(() => ({ slots: [], faces: [] }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isAgentPresenceOn: () => true }));
vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), get AGENT_FORM_BATTLE_ENABLED() { return flags.battle; } }));
vi.mock('./battleAgentFormSlot', async (importOriginal) => ({
  ...(await importOriginal()),
  BattleAgentFormSlot: (props) => { seen.slots.push(props); return <i data-test-slot={props.side || 'player'} />; },
}));
vi.mock('../../components/AgentPresence/AgentPresenceMount', () => ({
  default: (props) => { seen.faces.push(props); return <i data-test-face="1" />; },
}));

const ArenaHeader = (await import('./ArenaHeader.jsx')).default;
const CharacterPane = (await import('./CharacterPane.jsx')).default;
const CharacterAvatar = (await import('./CharacterAvatar.jsx')).default;
const { duelScores } = await import('./battleAgentFormSlot');

const BATTLE = { agentContext: { agentName: 'Aurora', archetype: 'degen' }, scoreState: { currentScore: 12, opponentScore: 3 } };
const strip = (h) => h.replace(/<!-- -->/g, '');
const header = (props = {}) => strip(renderToString(<ArenaHeader agentBattle={BATTLE} playerScore={12} opponentScore={3} dayLabel="Day 3 of 5" {...props} />));
const pane = (props = {}) => strip(renderToString(
  <CharacterPane agentBattle={BATTLE} open section={PANE_SECTION.CHAT} onSelectSection={() => {}} onClose={() => {}} chat={<div />} bench={<div />} tape={<div />} overflow={<span />} playerScore={12} opponentScore={3} {...props} />,
));
const mark = (props = {}) => strip(renderToString(<CharacterAvatar agentBattle={BATTLE} bubble={null} unread={0} onOpen={() => {}} playerScore={12} opponentScore={3} {...props} />));

beforeEach(() => { seen.slots = []; seen.faces = []; });

describe('flag on: the forms take the robot head\'s place', () => {
  beforeEach(() => { flags.battle = true; });

  it('the arena header: the player\'s form and the opponent\'s, 72 px on the desktop and 48 on the phone, overhanging the row; "CPU" stays', () => {
    for (const [isDesktop, px, margin] of [[true, 72, '-8px 0'], [false, 48, '-4px 0']]) {
      seen.slots = [];
      const html = header({ isDesktop });
      expect(seen.slots.map((s) => [s.side || 'player', s.size])).toEqual([['player', px], ['opponent', px]]);
      expect(html).toContain('data-arena-form="player"');
      expect(html).toContain('data-arena-form="opponent"');
      expect(html).toContain(`width:${px}px;height:${px}px;margin:${margin}`);
      expect(html).toContain('>CPU</span>');
      expect(html).not.toContain('data-arena-face');
      expect(seen.faces).toHaveLength(0);
    }
  });

  it('the opponent cell keeps the book\'s description target on the CPU side, and the form sits on its outer edge', () => {
    const html = header({ isDesktop: true, onOpenBook: () => {}, bookName: 'Why? book' });
    const cpu = html.slice(html.indexOf('id="why-book-cpu"'));
    expect(cpu.indexOf('>CPU</span>')).toBeLessThan(cpu.indexOf('data-arena-form="opponent"'));
  });

  it('the pane header: the form at 40 px, the smallest size it moves at (R12), inside today\'s 36 px box', () => {
    const html = pane({ isDesktop: true });
    expect(seen.slots.map((s) => s.size)).toEqual([40]);
    expect(html).toContain('data-pane-form="1"');
    expect(html).toContain('width:36px;height:36px');
    expect(html).toContain('margin:-2px');
    expect(seen.faces).toHaveLength(0);
  });

  it('the floating mark: the form at the mark\'s own size (44 desktop, 40 phone)', () => {
    mark({ isDesktop: true });
    mark({ isDesktop: false });
    expect(seen.slots.map((s) => s.size)).toEqual([44, 40]);
    expect(seen.faces).toHaveLength(0);
  });

  it('every slot is handed the battle and the screen\'s reduced motion', () => {
    header({ isDesktop: true, reducedMotion: true });
    for (const s of seen.slots) { expect(s.agentBattle).toBe(BATTLE); expect(s.reducedMotion).toBe(true); }
  });
});

describe('flag off: today\'s robot head at every site, and no form', () => {
  beforeEach(() => { flags.battle = false; });

  it('no slot, no opponent cell; the face is mounted static, as shipped', () => {
    const html = header({ isDesktop: true }) + pane({ isDesktop: true }) + mark({ isDesktop: true });
    expect(seen.slots).toHaveLength(0);
    expect(html).not.toContain('data-arena-form');
    expect(html).not.toContain('data-pane-form');
    expect(html).toContain('data-arena-face="1"');
    expect(seen.faces).toHaveLength(3);
    for (const f of seen.faces) expect(f.reactivityLevel).toBe('static');
  });
});

describe('the mood\'s scores are the pair each site feeds its robot head (BUILD_RULES §9)', () => {
  const COMPARISONS = [
    undefined,
    { available: true, pair: [7.25, 7.5], barWidth: 49, lead: 'cpu', switchKey: 'k1', fractionDigits: 2, label: 'Stored', prose: '' },
    { available: false, switchKey: 'k2', label: 'Unavailable', prose: 'No qualified pair' },
  ];
  const SCORES = [{ playerScore: 12, opponentScore: 3 }, { playerScore: undefined, opponentScore: undefined }, { playerScore: -4, opponentScore: 0 }];

  it('flag off, each site\'s face duel; flag on, each slot\'s scores: the same pair, or none on both', () => {
    for (const comparison of COMPARISONS) {
      for (const scores of SCORES) {
        const props = { comparison, ...scores, isDesktop: true };
        flags.battle = false; seen.faces = []; seen.slots = [];
        header(props); pane(props); mark(props);
        const fed = seen.faces.map((f) => ('playerScore' in f.duel ? { player: f.duel.playerScore, opponent: f.duel.opponentScore } : null));
        flags.battle = true;
        header(props); pane(props); mark(props);
        const given = seen.slots.filter((s) => (s.side || 'player') === 'player').map((s) => s.scores);
        expect(given, JSON.stringify(props)).toEqual(fed);
        expect(given[0]).toEqual(duelScores({ comparison, ...scores, agentBattle: BATTLE }));
      }
    }
  });
});
