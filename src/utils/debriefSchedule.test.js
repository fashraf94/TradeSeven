// src/utils/debriefSchedule.test.js
//
// Film Room D2 item 5 — WHEN THE WORDS ARE WRITTEN (D2 spec §7): the schedule string pinned equal to vercel.json's
// entry, the first run after a tape was written, and the front's not-yet window (that run plus 30 minutes).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEBRIEF_SCHEDULE, DEBRIEF_CRON_PATH, DEBRIEFS_SUBCOLLECTION, nextDebriefRunMs, debriefNotYet, debriefEtDateOfRun, DEBRIEF_NOT_YET_GRACE_MS } from './debriefSchedule.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERCEL = JSON.parse(readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const iso = (ms) => new Date(ms).toISOString();

describe('the schedule — one string, the same as vercel.json\'s entry', () => {
  it("vercel.json holds exactly one entry for the job, at '45 3 * * 2-6'", () => {
    const entries = VERCEL.crons.filter((c) => c.path === DEBRIEF_CRON_PATH);
    expect(entries).toEqual([{ path: '/api/cron/film-room-debrief', schedule: DEBRIEF_SCHEDULE }]);
    expect(DEBRIEF_SCHEDULE).toBe('45 3 * * 2-6');
  });
  it('it runs after the close pass has finished: the close pass starts at 02:15 UTC and runs at most 300 s', () => {
    const close = VERCEL.crons.find((c) => c.path === '/api/cron/film-tape-close');
    expect(close.schedule).toBe('15 2 * * 2-6');
    expect(3 * 60 + 45 - (2 * 60 + 15)).toBeGreaterThan(5);   // ninety minutes after its start
  });
  it("the record's collection is `debriefs`", () => {
    expect(DEBRIEFS_SUBCOLLECTION).toBe('debriefs');
  });
});

describe('nextDebriefRunMs — the first run strictly after the tape was written', () => {
  it('a tape written by Tuesday night\'s close pass (02:15 UTC Wed) → 03:45 UTC that Wednesday', () => {
    expect(iso(nextDebriefRunMs('2026-09-24T02:15:30.000Z'))).toBe('2026-09-24T03:45:00.000Z');
  });
  it('a tape written AT a run is not before it → the next night\'s run', () => {
    expect(iso(nextDebriefRunMs('2026-09-24T03:45:00.000Z'))).toBe('2026-09-25T03:45:00.000Z');
  });
  it('Friday\'s tape (written 02:15 UTC Saturday) → 03:45 UTC Saturday; written after it → Tuesday (no Sunday or Monday run)', () => {
    expect(iso(nextDebriefRunMs('2026-09-26T02:15:30.000Z'))).toBe('2026-09-26T03:45:00.000Z');
    expect(iso(nextDebriefRunMs('2026-09-26T04:00:00.000Z'))).toBe('2026-09-29T03:45:00.000Z');
  });
  it('an offset instant is read as the instant it is', () => {
    expect(iso(nextDebriefRunMs('2026-09-23T22:15:30-04:00'))).toBe('2026-09-24T03:45:00.000Z');
  });
  it('anything that is not a strict instant: null', () => {
    for (const v of [null, undefined, '', '2026-09-24', '2026-09-24 02:15:30', 'yesterday', 1758680130000]) expect(nextDebriefRunMs(v), String(v)).toBeNull();
  });
});

describe('debriefNotYet — before the next run plus 30 minutes, and only a run that processes this day', () => {
  const W = '2026-09-24T02:15:30.000Z';   // Sep 23's tape, by its own night's close pass
  const D = '2026-09-23';
  const run = Date.parse('2026-09-24T03:45:00.000Z');
  it('the grace is 30 minutes', () => { expect(DEBRIEF_NOT_YET_GRACE_MS).toBe(1_800_000); });
  it('before the run, and up to the last millisecond before run + 30 min: not yet', () => {
    expect(debriefNotYet(W, D, Date.parse('2026-09-23T23:00:00.000Z'))).toBe(true);
    expect(debriefNotYet(W, D, run)).toBe(true);
    expect(debriefNotYet(W, D, run + DEBRIEF_NOT_YET_GRACE_MS - 1)).toBe(true);
  });
  it('at run + 30 min and after: no longer', () => {
    expect(debriefNotYet(W, D, run + DEBRIEF_NOT_YET_GRACE_MS)).toBe(false);
    expect(debriefNotYet(W, D, run + 86_400_000)).toBe(false);
  });
  it('the review\'s R6: a tape first written after its own night\'s run (a backfill, a late re-run) — the next run processes another day, and there is no catch-up: never "by the next morning"', () => {
    expect(debriefNotYet('2026-09-24T04:00:00.000Z', D, Date.parse('2026-09-24T05:00:00.000Z'))).toBe(false);   // the next run is Sep 24's
    expect(debriefNotYet('2026-09-26T16:00:00.000Z', '2026-09-25', Date.parse('2026-09-27T12:00:00.000Z'))).toBe(false);
  });
  it('no written instant, no day, or no clock: never', () => {
    expect(debriefNotYet(null, D, run)).toBe(false);
    expect(debriefNotYet(W, null, run)).toBe(false);
    expect(debriefNotYet(W, D, NaN)).toBe(false);
  });
});

describe('the ET date a run processes', () => {
  it('03:45 UTC is the previous ET evening, in either DST state', () => {
    expect(debriefEtDateOfRun(Date.parse('2026-09-24T03:45:00.000Z'))).toBe('2026-09-23');   // 11:45 PM EDT
    expect(debriefEtDateOfRun(Date.parse('2026-12-02T03:45:00.000Z'))).toBe('2026-12-01');   // 10:45 PM EST
  });
});
