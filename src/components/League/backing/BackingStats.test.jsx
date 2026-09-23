// src/components/League/backing/BackingStats.test.jsx
//
// Backing Beta PR 5 — the two private stats surfaces (spec V1.3 §5, §8, D-v,
// D-w). react-dom/server: both are pure over the endpoint replies. Private,
// no consequences, no comparison to other players: the rows assert the label,
// the figures and the absence of any ranking word.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import MyBackingStats from './MyBackingStats';
import TrainerStats from './TrainerStats';
import { STATS } from './backingCopy';
import { findForbiddenTerm } from '../../../constants/backingLexicon';

const text = (el) => renderToString(el).replace(/<[^>]+>/g, ' ');
const MINE = {
  label: 'beta stats', seasonKey: '2026-10', net: { career: -150, season: 40 },
  career: { poolsBacked: 3, poolsWon: 1, weeksPlayed: 2, pending: 1, net: -150 },
  season: { monthKey: '2026-10', poolsBacked: 1, poolsWon: 1, weeksPlayed: 1, pending: 1, net: 40 },
  seasons: {}, accuracy: { career: { pools: 2, youWon: 1, baselineWon: 2, both: 1, excluded: 1 }, season: { pools: 0, youWon: 0, baselineWon: 0, both: 0, excluded: 0 } },
};
const TRAINER = {
  label: 'beta stats', seasonKey: '2026-10',
  career: { uniqueBackers: 3, bpBacked: 600, backersNet: 100, pending: 100, poolsBackedOn: 3, stakes: 4, decidedStakes: 3 },
  season: { monthKey: '2026-10', uniqueBackers: 1, bpBacked: 100, backersNet: 0, pending: 100, poolsBackedOn: 1, stakes: 1, decidedStakes: 0 },
  seasons: {}, excludedStakes: 1,
};

describe('MyBackingStats — the viewer\'s own record', () => {
  it('shows net BP signed, season and career, the four counts, and the accuracy against the baseline with the excluded note', () => {
    const t = text(<MyBackingStats stats={MINE} />);
    expect(t).toContain('−150');
    expect(t).toContain('+40');
    expect(t).toContain(STATS.poolsBacked);
    expect(t).toContain(STATS.poolsWon);
    expect(t).toContain(STATS.weeksPlayed);
    expect(t).toContain('1 of 2 pools');
    expect(t).toContain('2 of 2 pools');
    expect(t).toContain(STATS.baselineNote);
    expect(t).toContain('1 pool had no prior week to compare against.');
    expect(t).toContain(STATS.sub);
    expect(renderToString(<MyBackingStats stats={MINE} />)).toContain('data-backing="my-stats"');
  });

  it('with no settled pool the accuracy says so; a null reply renders nothing', () => {
    expect(text(<MyBackingStats stats={{ ...MINE, accuracy: { career: { pools: 0 } } }} />)).toContain(STATS.noPools);
    expect(renderToString(<MyBackingStats stats={null} />)).toBe('');
  });
});

describe('TrainerStats — the viewer as a team, labeled beta stats', () => {
  it('shows backers on you, BP backed on you, the backers\' net on you and what is in play, season and career', () => {
    const t = text(<TrainerStats stats={TRAINER} />);
    expect(t).toContain(STATS.trainer.uniqueBackers);
    expect(t).toContain('600 BP');
    expect(t).toContain('+100 BP');
    expect(t).toContain(STATS.trainer.backersNet);
    expect(t).toContain('Beta stats');
    expect(renderToString(<TrainerStats stats={TRAINER} />)).toContain('data-backing="trainer-stats"');
  });

  it('a team nobody backed says so; a null reply renders nothing', () => {
    expect(text(<TrainerStats stats={{ ...TRAINER, career: { ...TRAINER.career, stakes: 0 } }} />)).toContain(STATS.trainer.empty);
    expect(renderToString(<TrainerStats stats={null} />)).toBe('');
  });
});

describe('neither surface ranks, compares or speaks a forbidden term', () => {
  it('no leaderboard, percentile or position word; no forbidden term', () => {
    for (const el of [<MyBackingStats stats={MINE} />, <TrainerStats stats={TRAINER} />]) {
      const t = text(el);
      expect(t).not.toMatch(/leaderboard|percentile|position|#\d/i);
      expect(findForbiddenTerm(t)).toBeNull();
    }
    for (const s of [STATS.sub, STATS.baselineNote, STATS.trainer.sub]) expect(findForbiddenTerm(s)).toBeNull();
  });
});
