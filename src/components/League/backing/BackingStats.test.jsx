// src/components/League/backing/BackingStats.test.jsx
//
// Backing Beta PR 5 — the two private stats surfaces (spec V1.3 §5, §8, D-v,
// D-w). react-dom/server: both are pure over the endpoint replies. Private,
// no consequences, no comparison to other players: the rows assert the label,
// the figures and the absence of any ranking word.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import MyBackingStats from './MyBackingStats';
import TrainerStats from './TrainerStats';

// The stats' home imports the two live reads; the view under test is fed its replies directly.
vi.mock('../../../hooks/useMyBackingStats', () => ({ default: () => ({ data: null, loading: false, error: null, refresh: () => {} }) }));
vi.mock('../../../hooks/useTrainerStats', () => ({ default: () => ({ data: null, loading: false, error: null, refresh: () => {} }) }));
const { StatsEntryView } = await import('./BackingStatsEntry');
import { POD_LIST, STATS } from './backingCopy';
import { LTOKENS } from '../leagueTokens';
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

describe('TrainerStats — closed weeks only: the design\'s sealed "This week" row (SEAL-1 / SEAL-R-2, the desktop review record)', () => {
  const SEALED = { ...TRAINER, thisWeek: { sealed: true } };
  const FIRST_WEEK = {
    ...SEALED,
    career: { uniqueBackers: 0, bpBacked: 0, backersNet: 0, pending: 0, poolsBackedOn: 0, stakes: 0, decidedStakes: 0 },
    season: { monthKey: '2026-10', uniqueBackers: 0, bpBacked: 0, backersNet: 0, pending: 0, poolsBackedOn: 0, stakes: 0, decidedStakes: 0 },
  };
  const rowOf = (html) => /<div data-backing="trainer-sealed-week"[\s\S]*?<\/span><\/div>/.exec(html)?.[0] ?? null;

  it('with the reply\'s seal, the row renders ABOVE the closed weeks — "This week", a lock, SEALED — and carries no figure at all', () => {
    const html = renderToString(<TrainerStats stats={SEALED} />);
    const row = rowOf(html);
    expect(row, 'the sealed row renders').not.toBeNull();
    const words = row.replace(/<[^>]+>/g, ' ');
    expect(words).toContain(STATS.trainer.sealedWeek);
    expect(words).toContain(POD_LIST.sealed);
    expect(words).toContain(STATS.trainer.sealedUntil);
    expect(words, 'no number in the sealed row').not.toMatch(/\d/);
    // Above the closed weeks' columns, which still read.
    expect(html.indexOf('data-backing="trainer-sealed-week"')).toBeLessThan(html.indexOf('data-backing="stats-column"'));
    expect(text(<TrainerStats stats={SEALED} />)).toContain('600 BP');
  });

  it('no closed week yet and this week sealed: the design\'s first-week line — NEVER "Nobody has backed your team yet" over a book the trainer cannot see', () => {
    const t = text(<TrainerStats stats={FIRST_WEEK} />);
    expect(t).toContain(STATS.trainer.sealedFirst);
    expect(t).not.toContain(STATS.trainer.empty);
    expect(t).toContain(STATS.trainer.sealedWeek);
  });

  it('PLACE-A1 / WIRE-A1 — the line is TRUE for a returning team whose closed weeks nobody backed, or whose backers were voided at a below-floor close (the reply is the same as a first week\'s): never "No closed weeks yet", never "No backers"; PLACE-A2 — the sealed pool is named NEXT week\'s, as the pod list names it; PLACE-A4 — the line in the design\'s type, no box', () => {
    expect(STATS.trainer.sealedFirst).not.toMatch(/No closed weeks/i);
    expect(STATS.trainer.sealedFirst).not.toMatch(/No backers/i);
    expect(STATS.trainer.sealedFirst).toMatch(/^Nothing counted from a closed week yet\./);
    expect(STATS.trainer.sealedWeek).toMatch(/^Next week · /);
    expect(STATS.trainer.sealedWeek).not.toMatch(/This week/);
    const html = renderToString(<TrainerStats stats={FIRST_WEEK} />);
    const line = /<div data-backing="trainer-empty" style="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(line).toContain('font-size:12.5px');
    expect(line).toContain(`color:${LTOKENS.ink2}`);
    expect(line).not.toContain('border');
    // The plain empty line (no seal) keeps its box.
    const plain = /<div data-backing="trainer-empty" style="([^"]*)"/.exec(renderToString(<TrainerStats stats={{ ...FIRST_WEEK, thisWeek: undefined }} />))?.[1] ?? '';
    expect(plain).toContain('border');
  });

  it('no seal in the reply: no sealed row, and the plain empty line stands', () => {
    expect(renderToString(<TrainerStats stats={TRAINER} />)).not.toContain('trainer-sealed-week');
    const empty = { ...FIRST_WEEK, thisWeek: undefined };
    expect(text(<TrainerStats stats={empty} />)).toContain(STATS.trainer.empty);
    expect(text(<TrainerStats stats={empty} />)).not.toContain(STATS.trainer.sealedFirst);
    expect(renderToString(<TrainerStats stats={{ ...TRAINER, thisWeek: { sealed: false } }} />)).not.toContain('trainer-sealed-week');
  });

  it('the stats\' home on both viewports (EquipStation; IdentityPanel beside the pitch) is the one view — the "As a team" tab carries the row', () => {
    const read = (data) => ({ data, loading: false, error: null, refresh: () => {} });
    const html = renderToString(<StatsEntryView mine={read(MINE)} trainer={read(SEALED)} initialTab="trainer" />);
    expect(html).toContain('data-backing="trainer-sealed-week"');
    for (const s of [STATS.trainer.sealedWeek, STATS.trainer.sealedUntil, STATS.trainer.sealedFirst]) expect(findForbiddenTerm(s)).toBeNull();
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
