// src/components/FilmRoom/TrainingReportCard.render.test.jsx
//
// Archetype Mastery P3 — Training Report render rows (spec §10) + the DARK
// PHOTOGRAPH: with MASTERY_SURFACE_ENABLED false the card renders NOTHING
// (empty string — byte-identical Film Room column), and with it true every
// §10 element renders honestly. renderToString (no jsdom in this repo);
// effects don't run, so the profile arrives via the prop exactly as the
// screen threads it. The flag is getter-mocked (the behavior-test
// precedent); the progression module runs UN-mocked (§4 — never mock the
// kernel).

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

const { default: TrainingReportCard } = await import('./TrainingReportCard.jsx');

const TOKENS = { bgCard: '#15171E', textFaint: '#64748b', textDefault: '#e2e8f0', accent: '#5eead4' };

const AWARD = (over = {}) => ({
  archetype: 'guardian',
  components: { participation: 25, performance: 12, placement: 0, completion: 20 },
  multipliers: { mode: 1, rateBand: 1 },
  xpFinal: 57,
  levelBefore: 1,
  levelAfter: 1,
  formulaVersion: 1,
  epochId: 1,
  settledAt: '2026-07-21T20:00:00.000Z',
  ...over,
});

const BATTLE = (award) => ({ id: 'b1', ownerId: 'u1', masteryAward: award });
const PROFILE = (xp) => ({ archetypes: { guardian: { xp } } });

// renderToString separates adjacent text nodes with <!-- --> comments —
// strip them so assertions read like the user-visible text.
const render = (battle, profile = null) =>
  renderToString(<TrainingReportCard battle={battle} masteryProfile={profile} tokens={TOKENS} />)
    .replace(/<!-- -->/g, '');

beforeEach(() => { flagState.surface = true; });

describe('DARK photograph (spec §7: dark rows)', () => {
  it('SURFACE off: renders EMPTY even for a receipt-bearing battle — the Film Room column is byte-identical to pre-P3', () => {
    flagState.surface = false;
    expect(render(BATTLE(AWARD()), PROFILE(250))).toBe('');
  });

  it('SURFACE on, no receipt: renders empty (unreceipted battles gain nothing)', () => {
    expect(render({ id: 'b1', ownerId: 'u1' })).toBe('');
  });
});

describe('§10 rows (lit)', () => {
  it('paying award: breakdown rows, multipliers, total, Lessons honest empty state', () => {
    const html = render(BATTLE(AWARD()), PROFILE(57));
    expect(html).toContain('Training Report');
    expect(html).toContain('Participation');
    expect(html).toContain('+25');
    expect(html).toContain('+57 XP');
    expect(html).toContain('×1 mode');
    expect(html).toContain('Lessons');
    expect(html).toContain('roadmap milestone, reserved but not shipped');
  });

  it('level progress rides the LIVE profile stream (level + band + XP-to-next)', () => {
    const html = render(BATTLE(AWARD()), PROFILE(250)); // L2, 250 to L3
    expect(html).toContain('Level 2');
    expect(html).toContain('Novice');
    expect(html).toContain('250 XP to level 3');
  });

  it('missing profile: honest empty progress line, never a fake bar', () => {
    const html = render(BATTLE(AWARD()), null);
    expect(html).toContain('training profile syncs');
    expect(html).not.toContain('XP to level');
  });

  it('promotion ceremony on a real level move', () => {
    const html = render(BATTLE(AWARD({ levelBefore: 1, levelAfter: 2, xpFinal: 210 })), PROFILE(210));
    expect(html).toContain('Level up');
    expect(html).toContain('Level 2');
  });

  it('band ceremony when the promotion crosses a band boundary (L3→L4 = Adept)', () => {
    const html = render(BATTLE(AWARD({ levelBefore: 3, levelAfter: 4, xpFinal: 120 })), PROFILE(950));
    expect(html).toContain('Adept band reached');
  });

  it('levelProvisional SUPPRESSES the ceremony permanently (§9 seam receipts)', () => {
    const html = render(BATTLE(AWARD({ levelBefore: 1, levelAfter: 2, levelProvisional: true, xpFinal: 210 })), PROFILE(210));
    expect(html).not.toContain('Level up');
    expect(html).not.toContain('band reached');
    expect(html).toContain('Training Report'); // the rest of the card still renders
  });

  it('daily_ceiling zero receipt: breakdown + ceiling copy + +0 XP', () => {
    const html = render(BATTLE(AWARD({ xpFinal: 0, reasonCode: 'daily_ceiling', multipliers: { mode: 1, rateBand: 0 } })), PROFILE(57));
    expect(html).toContain('Daily training ceiling reached');
    expect(html).toContain('+0 XP');
    expect(html).toContain('Participation'); // the work happened; the rate zeroed it
  });

  it('quarantined zero receipt: PUBLIC reason copy only — no component rows, no internals', () => {
    const html = render(BATTLE({
      archetype: 'guardian', components: { participation: 0, performance: 0, placement: 0, completion: 0 },
      xpFinal: 0, reasonCode: 'quarantined', levelBefore: 1, levelAfter: 1,
    }), PROFILE(57));
    expect(html).toContain('could not be scored');
    expect(html).not.toContain('Participation');
    expect(html).not.toContain('diagnostic');
  });

  it('next-unlock teaser names shipped/cosmetic only — never a reserved item', () => {
    // Profile at L4 → next teasable is L5's Adept crest; Trial slot 1 is
    // reserved and must not appear.
    const html = render(BATTLE(AWARD()), PROFILE(950));
    expect(html).toContain('Next unlock');
    expect(html).toContain('Adept crest');
    expect(html).not.toContain('Trial slot');
  });
});
