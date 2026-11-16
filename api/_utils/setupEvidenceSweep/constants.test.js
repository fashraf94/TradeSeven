// api/_utils/setupEvidenceSweep/constants.test.js
//
// The chart's evidence, PR B — the sweep's numbers, pinned (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md
// SW-1 – SW-5): the store's restated constants equal the store's own, the one vercel.json entry is the
// schedule constant, its three times sit where SW-3 says in both winter and summer, and one run's
// admission window plus its reserve fits inside the handler's maxDuration.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as C from './constants.js';
import { ACQUIRE_TIMEOUT_MS, SNAPSHOT_SCHEMA_VERSION } from '../setupEvidence/acquire.js';
import { CONFIRM_AFTER_MS } from '../setupEvidence/store.js';
import { lastCompletedSessionAt } from '../setupEvidence/sessionAt.js';
import { STATE_REASONS } from '../setupMenuLabels/constants.js';
import { getSessionForDate } from '../marketSchedule.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const VERCEL = JSON.parse(readFileSync(resolve(REPO, 'vercel.json'), 'utf8'));
const CRON_SRC = readFileSync(resolve(REPO, 'api/cron/setup-evidence-sweep.js'), 'utf8');
const MIN = 60_000;

describe('the store\'s numbers, restated and pinned', () => {
  it('the provider timeout, the confirmation interval and the record schema equal the store\'s own', () => {
    expect(C.STORE_ACQUIRE_TIMEOUT_MS).toBe(ACQUIRE_TIMEOUT_MS);
    expect(C.STORE_CONFIRM_AFTER_MS).toBe(CONFIRM_AFTER_MS);
    expect(C.STORE_SNAPSHOT_SCHEMA_VERSION).toBe(SNAPSHOT_SCHEMA_VERSION);
  });
  it('the retryable reasons are the store-facing list Slice 2 keeps (the observer\'s MISSING_DETAILS shape)', () => {
    expect(C.RETRYABLE_REASONS).toEqual(STATE_REASONS);
  });
  it('the module is pure: no imports', () => {
    expect(readFileSync(resolve(HERE, 'constants.js'), 'utf8')).not.toMatch(/^import /m);
  });
});

describe('SW-1 / SW-3 — one cron entry, three runs a session', () => {
  it('exactly one vercel.json entry for the sweep, at the schedule constant', () => {
    const entries = VERCEL.crons.filter((c) => c.path === C.SWEEP_PATH);
    expect(entries).toEqual([{ path: '/api/cron/setup-evidence-sweep', schedule: '30 12,22,23 * * 1-5' }]);
    expect(entries[0].schedule).toBe(C.SWEEP_SCHEDULE);
  });
  it('the handler\'s maxDuration is the constant, and one run\'s admission window and reserve fit inside it with a minute to spare', () => {
    expect(CRON_SRC).toMatch(/export const config = \{ maxDuration: 300 \};/);
    expect(C.SWEEP_MAX_DURATION_S).toBe(300);
    expect(C.SWEEP_ADMISSION_WINDOW_MS + C.SWEEP_ADMISSION_RESERVE_MS).toBeLessThanOrEqual(C.SWEEP_MAX_DURATION_S * 1000 - 45_000);
  });
  it.each([
    ['winter (EST)', '2026-12-07', '2026-12-08'],
    ['summer (EDT)', '2026-06-08', '2026-06-09'],
  ])('%s: 22:30 and 23:30 UTC are after the close of that day\'s session, an hour apart; 12:30 UTC the next weekday is before its open', (_label, day, next) => {
    const s = getSessionForDate(day);
    const n = getSessionForDate(next);
    for (const hhmm of ['22:30', '23:30']) {
      const at = Date.parse(`${day}T${hhmm}:00.000Z`);
      expect(at).toBeGreaterThan(s.closeMs);
      expect(lastCompletedSessionAt(at)).toMatchObject({ ok: true, session: day, relation: 'after_close' });
    }
    expect(Date.parse(`${day}T23:30:00Z`) - Date.parse(`${day}T22:30:00Z`)).toBeGreaterThanOrEqual(C.STORE_CONFIRM_AFTER_MS + 25 * MIN);
    const morning = Date.parse(`${next}T12:30:00.000Z`);
    expect(morning).toBeLessThan(n.openMs);
    expect(lastCompletedSessionAt(morning)).toMatchObject({ ok: true, session: day, relation: 'before_close' });
  });
  it('the first post-close run is at least 90 minutes after the close in both seasons', () => {
    for (const day of ['2026-12-07', '2026-06-08']) {
      expect(Date.parse(`${day}T22:30:00.000Z`) - getSessionForDate(day).closeMs).toBeGreaterThanOrEqual(90 * MIN);
    }
  });
});

describe('SW-2 / SW-4 — one run', () => {
  it('four at once; a hard stop at 400; the unpublished brake at eight; the reserve covers one acquisition', () => {
    expect(C.SWEEP_CONCURRENCY).toBe(4);
    expect(C.SWEEP_DAILY_PROVIDER_CAP).toBe(400);
    expect(C.UNPUBLISHED_STREAK_STOP).toBe(8);
    expect(C.PROVIDER_FAILURE_STREAK_STOP).toBe(8);
    expect(C.TRANSPORT_FAILURE_REASONS).toEqual(['fetch_failed', 'non_array_payload', 'malformed_payload']);
    for (const r of C.TRANSPORT_FAILURE_REASONS) expect(C.RETRYABLE_REASONS).toContain(r);
    expect(C.SWEEP_ADMISSION_RESERVE_MS).toBe(12_000);
    expect(C.DEFERRED_REASONS).toEqual(['deadline', 'cap', 'unpublished', 'provider_failing', 'state_unreadable', 'programming_error', 'calendar_missing', 'non_session']);
    expect(C.SWEEP_ADMISSION_RESERVE_MS).toBeGreaterThan(C.STORE_ACQUIRE_TIMEOUT_MS);
    expect(C.SWEEP_HOST).toBe('setup-evidence-sweep');
  });
  it('the state: its collection, its schema, and closed field lists with no per-symbol map', () => {
    expect([C.STATE_COLLECTION, C.STATE_SCHEMA_VERSION]).toEqual(['setupEvidenceSweepState', 1]);
    expect(C.STATE_FIELDS).toEqual(['schemaVersion', 'session', 'providerRequests', 'runs', 'firstRunAt', 'lastRunAt', 'completedAt', 'runMs', 'latest', 'updatedAt']);
    expect(C.LATEST_FIELDS).toEqual(['startedAt', 'names', 'final', 'acquired', 'retryable', 'pending', 'excluded', 'deferred', 'failures', 'programmingErrors']);
    expect(Object.isFrozen(C.STATE_FIELDS) && Object.isFrozen(C.LATEST_FIELDS) && Object.isFrozen(C.RETRYABLE_REASONS) && Object.isFrozen(C.DEFERRED_REASONS)).toBe(true);
  });
  it('the health line prefix carries no colon (a bracketed name with one inside mints a stylesheet rule)', () => {
    expect(C.HEALTH_LINE_PREFIX).toBe('[setupEvidenceSweep]');
    expect(C.HEALTH_LINE_PREFIX).not.toContain(':');
  });
});
