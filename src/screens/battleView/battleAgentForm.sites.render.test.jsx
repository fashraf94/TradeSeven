// src/screens/battleView/battleAgentForm.sites.render.test.jsx
//
// Agent form build S1 (Scope B) — the three sites, with AGENT_FORM_BATTLE_ENABLED driven per row. The form's slot is
// a recording stand-in (the form itself: BattleAgentForm.jsdom.test.jsx; its moods: agentMood.test.js). Flag on:
// the arena header draws the player's form (88 px desktop, 60 phone — the S1 size follow-up; 88 by the founder's
// ruling, under the engine's 90 px small-form boundary) and a new opponent cell
// on the CPU side with "CPU" still there; the pane's header draws its form at 50 px over today's 36 px box; the
// floating mark at 55 / 50. Each box overhangs the room the layout gives it, 2 px clear of what it reaches toward, and
// the header grows within its allowance (the real heights are measured in headless Edge, the S1 report §11). Flag
// off: today's robot head at every site, and no slot. And the parity: the scores a mood is given are the same pair
// each site feeds its robot head (BUILD_RULES §9).

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
const { duelScores, BATTLE_FORM_PX } = await import('./battleAgentFormSlot');
const { PANE_HEADER_FIXED_PX } = await import('./CharacterPane.jsx');

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

  it('the arena header: the player\'s form and the opponent\'s, 88 px on the desktop and 60 on the phone, overhanging the row; "CPU" stays', () => {
    for (const [isDesktop, px, player, opponent] of [
      [true, 88, '-12px -8px -6px -8px', '-12px -8px -6px -8px'],
      [false, 60, '-8px -6px -4px -14px', '-8px -14px -4px -6px'],
    ]) {
      seen.slots = [];
      const html = header({ isDesktop });
      expect(seen.slots.map((s) => [s.side || 'player', s.size])).toEqual([['player', px], ['opponent', px]]);
      // Each box carries its overhang, the outer side toward the screen's edge: the player's left, the CPU's right.
      expect(html).toContain(`data-arena-form="player" style="width:${px}px;height:${px}px;margin:${player};flex-shrink:0"`);
      expect(html).toContain(`data-arena-form="opponent" style="width:${px}px;height:${px}px;margin:${opponent};flex-shrink:0"`);
      expect(html).toContain('>CPU</span>');
      expect(html).not.toContain('data-arena-face');
      expect(seen.faces).toHaveLength(0);
    }
  });

  it('the arena boxes keep today\'s footprint width, stay 2 px clear of the header\'s edges, the name and the bar, and grow the header within its allowance', () => {
    // [shell, today's footprint width (the scores' place), the footprint height that left the header's height as
    // main's (S1's 40 px phone footprint; the 56 px face on the desktop), the growth allowed]
    for (const [isDesktop, width, base, allowed] of [[false, 40, 40, 12], [true, 72, 56, 16]]) {
      const html = header({ isDesktop });
      const [, padTop, padSide] = html.match(/data-arena-header="1" style="[^"]*padding:(\d+)px (\d+)px \d+px/).map(Number);
      const rowGap = Number(html.match(/z-index:1;display:flex;flex-direction:column;gap:(\d+)px/)[1]);
      const cellGap = Number(html.match(/gap:(\d+)px;min-width:0"><div data-arena-form="player"/)[1]);
      const { box, outer, inner, top, bottom } = BATTLE_FORM_PX.arena[isDesktop ? 'desktop' : 'phone'];
      expect(box - outer - inner).toBe(width);
      expect(outer).toBeLessThanOrEqual(padSide - 2);
      expect(inner).toBeLessThanOrEqual(cellGap - 2);
      expect(top).toBeLessThanOrEqual(padTop - 2);
      expect(bottom).toBeLessThanOrEqual(rowGap - 2);
      // The row grows by at most the footprint's height over the one that left it as it was (an upper bound;
      // headless Edge measures the real growth: 5 px on the phone, 14 on the desktop at the founder's 88 px).
      expect(box - top - bottom - base).toBeLessThanOrEqual(allowed);
    }
  });

  it('the opponent cell keeps the book\'s description target on the CPU side, and the form sits on its outer edge', () => {
    const html = header({ isDesktop: true, onOpenBook: () => {}, bookName: 'Why? book' });
    const cpu = html.slice(html.indexOf('id="why-book-cpu"'));
    expect(cpu.indexOf('>CPU</span>')).toBeLessThan(cpu.indexOf('data-arena-form="opponent"'));
  });

  it('the pane header: the form at 50 px over today\'s 36 px box, 7 px a side, so the header\'s fixed cost and its F2 thresholds stand', () => {
    for (const isDesktop of [true, false]) {
      seen.slots = [];
      const html = pane({ isDesktop });
      expect(seen.slots.map((s) => s.size)).toEqual([50]);
      expect(html).toContain('data-pane-form="1" style="width:36px;height:36px;flex-shrink:0"><div style="margin:-7px">');
      // The overhang stays 2 px clear of the gap before the name and of the header's padding, side and top/bottom;
      // the 36 px box is the one PANE_HEADER_FIXED_PX counts.
      const [gap, padY, padX] = html.match(/data-pane-header="1" style="[^"]*gap:(\d+)px;padding:(\d+)px (\d+)px/).slice(1).map(Number);
      const over = (BATTLE_FORM_PX.pane.box - 36) / 2;
      expect(over).toBe(7);
      expect(over).toBeLessThanOrEqual(Math.min(gap, padY, padX) - 2);
    }
    expect(PANE_HEADER_FIXED_PX).toBe(28 + 36 + 20 + 243);
    expect(seen.faces).toHaveLength(0);
  });

  it('the floating mark: the form at 55 px on the desktop and 50 on the phone', () => {
    const desk = mark({ isDesktop: true });
    mark({ isDesktop: false });
    expect(seen.slots.map((s) => s.size)).toEqual([55, 50]);
    // The tap target stays at least 48 and holds the form whole: nothing caps its size.
    expect(desk).toContain('min-width:48px;min-height:48px');
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
