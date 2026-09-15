// @vitest-environment jsdom
//
// src/rankLadder.singleSource.jsdom.test.jsx
//
// ONE LADDER — the contract, and the surfaces that read it.
//
// Three places used to carry the four rank thresholds: determineRank (which
// ASSIGNS the rank on battle settlement), ProfileScreen's stat block, and
// the app-level XP modal. The modal's copy had drifted to a different
// six-rung list entirely, which is why it named ranks the game cannot award
// and counted down past zero above 10,000 XP
// (docs/audits/20260915_BUILD_CRASH_CLASS_A1_A4.md §8 F1 / F4).
//
// There is now one source — RANK_LADDER in services/battleTimer.js — and
// this file guards it from two sides:
//
//   1. THE CONTRACT. determineRank and getRankProgress against the record's
//      §8 F1 table, plus the properties the ruling depends on (a positive
//      XP-to-next by construction, nulls rather than placeholders at the
//      top rung).
//   2. THE CONSUMERS. ProfileScreen mounted, asserting the rank it paints is
//      the one determineRank returns — so re-inlining a private copy, which
//      is exactly how F4 happened, reddens here.
//
// The XP modal's own rows live in App.xpModal.jsdom.test.jsx, because they
// need the whole app mounted.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  RANK_LADDER,
  determineRank,
  getRankProgress,
} from './services/battleTimer';

vi.mock('./components/ClashBot/BugReportAdmin', () => ({ ADMIN_USERS: [] }));

import ProfileScreen from './screens/ProfileScreen';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** The record's §8 F1 table: (xp, the rank the game assigns, what is next). */
const TABLE = [
  { xp: 0, rank: 'Beginner', next: 'Veteran', xpToNext: 500 },
  { xp: 500, rank: 'Veteran', next: 'Expert', xpToNext: 1500 },
  { xp: 1999, rank: 'Veteran', next: 'Expert', xpToNext: 1 },
  { xp: 2000, rank: 'Expert', next: 'Master', xpToNext: 3000 },
  { xp: 5000, rank: 'Master', next: null, xpToNext: null },
  { xp: 12000, rank: 'Master', next: null, xpToNext: null },
];

describe('the rank ladder is one source', () => {
  it('has exactly the four rungs the game awards, ascending', () => {
    expect(RANK_LADDER.map((r) => r.rank)).toEqual([
      'Beginner',
      'Veteran',
      'Expert',
      'Master',
    ]);
    expect(RANK_LADDER.map((r) => r.minXp)).toEqual([0, 500, 2000, 5000]);
    // Ascending is what determineRank's top-down scan and getRankProgress's
    // "next rung" both assume; a rung inserted out of order breaks both.
    for (let i = 1; i < RANK_LADDER.length; i++) {
      expect(RANK_LADDER[i].minXp).toBeGreaterThan(RANK_LADDER[i - 1].minXp);
    }
  });

  for (const row of TABLE) {
    it(`determineRank(${row.xp}) is ${row.rank}`, () => {
      expect(determineRank(row.xp)).toBe(row.rank);
    });
  }

  for (const row of TABLE) {
    it(`getRankProgress(${row.xp}): ${row.next ? `${row.xpToNext} to ${row.next}` : 'max rank'}`, () => {
      const p = getRankProgress(row.xp);
      expect(p.rank).toBe(row.rank);
      expect(p.nextRank).toBe(row.next);
      expect(p.xpToNextRank).toBe(row.xpToNext);
      expect(p.isMaxRank).toBe(row.next === null);
    });
  }

  it('never reports a negative XP-to-next — the F1 defect, at the source', () => {
    // Every integer boundary and a spread between them. The old modal
    // arithmetic (a flat 10,000 minus xp) went negative past 10,000; this
    // one cannot, because determineRank only returns rung i below rung
    // i+1's threshold.
    const probes = [0, 1, 499, 500, 501, 1999, 2000, 2001, 4999, 5000, 5001, 12000, 999999];
    for (const xp of probes) {
      const { xpToNextRank, isMaxRank } = getRankProgress(xp);
      if (isMaxRank) {
        expect(xpToNextRank, `max rank carries no figure at ${xp}`).toBeNull();
      } else {
        expect(xpToNextRank, `positive at ${xp}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives the top rung no next rung to render', () => {
    const p = getRankProgress(5000);
    expect(p.isMaxRank).toBe(true);
    // null, not 'Max Rank' — a placeholder string is what the old ladder
    // rendered into the next-rung slot, which is how it looked like a rank.
    expect(p.nextRank).toBeNull();
    expect(p.xpToNextRank).toBeNull();
  });
});

describe('ProfileScreen reads that one source', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  for (const row of TABLE) {
    it(`paints ${row.rank} for ${row.xp} XP`, async () => {
      await act(async () => {
        root.render(
          <ProfileScreen
            user={{ uid: 'u1', username: 'tester', xp: row.xp, wins: 3, losses: 1 }}
            isDesktop
            onBack={() => {}}
            setScreen={() => {}}
          />
        );
      });
      // Exact text of some element, not a substring of the page: 'Master'
      // must not be satisfied by 'Max rank' or by a longer label.
      const texts = Array.from(container.querySelectorAll('div, span, p, h1, h2, h3'))
        .map((n) => n.textContent.trim());
      expect(texts, `ProfileScreen shows ${row.rank}`).toContain(row.rank);
      // And it must not show a rank the game cannot award.
      for (const ghost of ['Rookie', 'Apprentice', 'Trader', 'Legend']) {
        expect(texts, `no ghost rung ${ghost}`).not.toContain(ghost);
      }
    }, 30000);
  }
});
