// scripts/ws1-observe-walk.test.js
// WS1 observe-walk — decision-layer unit tests. Importing the module runs the
// Node-clean getRuleCompatInfo import (the classification source of truth) and the
// exported pure builders; main() is guarded behind the CLI entrypoint, so no
// admin/GCS/network is touched. That passing load is the BUILD_RULES §4 guard.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildConflictEvent, buildPlan, resolveHardness, resolveWebApiKey, resolveGcsCreds, parseEnvFile, readResponse, buildGcsConfirmation } from './ws1-observe-walk.js';

const ts = '2026-07-04T00:00:00.000Z';

describe('resolveHardness (mirrors hardSoftHelper: risk|allocation = hard)', () => {
  it('maps categories + honors overrides', () => {
    expect(resolveHardness('risk')).toBe('hard');
    expect(resolveHardness('allocation')).toBe('hard');
    expect(resolveHardness('technical')).toBe('soft');
    expect(resolveHardness('technical', 'hard')).toBe('hard'); // override wins
  });
});

describe('buildConflictEvent (mirrors ruleCompatGuard.js:106-119)', () => {
  it('mean-reversion rule on Trend Follower + equip → compat_conflict_equip, blocked:false', () => {
    const e = buildConflictEvent({ templateId: 'tech-rsi-oversold', archetype: 'momentum_chaser', path: 'equip_bundle', resolvedHardness: 'soft', ruleDocId: 'x', ts });
    expect(e).toMatchObject({ type: 'compat_conflict_equip', ruleId: 'tech-rsi-oversold', state: 'core_conflict', zone1Ref: 'TF-Z1-BUY-STRENGTH', blocked: false, path: 'equip_bundle' });
  });

  it('promote-to-hard in observe → compat_promote_blocked, blocked:false (observe never blocks)', () => {
    const e = buildConflictEvent({ templateId: 'tech-rsi-oversold', archetype: 'momentum_chaser', path: 'set_rule_hardness', resolvedHardness: 'hard', ruleDocId: 'x', ts, mode: 'observe' });
    expect(e).toMatchObject({ type: 'compat_promote_blocked', blocked: false });
  });

  it('promote-to-hard in ENFORCE → blocked:true (guard would block)', () => {
    const e = buildConflictEvent({ templateId: 'tech-rsi-oversold', archetype: 'momentum_chaser', path: 'set_rule_hardness', resolvedHardness: 'hard', ruleDocId: 'x', ts, mode: 'enforce' });
    expect(e.blocked).toBe(true);
  });

  it('momentum-aligned rule on Trend Follower → SILENCE (null)', () => {
    expect(buildConflictEvent({ templateId: 'tech-moving-average-trend', archetype: 'momentum_chaser', path: 'equip_bundle', resolvedHardness: 'soft', ts })).toBeNull();
  });

  it('ts-01 on Capital Preserver → SILENCE (native — classifier not over-firing)', () => {
    expect(buildConflictEvent({ templateId: 'ts-01', archetype: 'guardian', path: 'set_rule_hardness', resolvedHardness: 'hard', ts })).toBeNull();
  });
});

describe('buildPlan', () => {
  const plan = buildPlan(ts);
  it('equip fires for the two buy-weakness rules and stays silent for the momentum-aligned one', () => {
    expect(plan.equip_bundle.post.events).toHaveLength(2);
    expect(plan.equip_bundle.post.events.map((e) => e.ruleId).sort()).toEqual(['tech-rsi-oversold', 'tv-06']);
    expect(plan.equip_bundle.post.events.every((e) => e.type === 'compat_conflict_equip' && e.blocked === false)).toBe(true);
  });
  it('promote emits one compat_promote_blocked (blocked:false)', () => {
    expect(plan.set_rule_hardness.post.events).toHaveLength(1);
    expect(plan.set_rule_hardness.post.events[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: false });
  });
  it('change-archetype does two flips ending back at momentum_chaser', () => {
    expect(plan.change_archetype.flips).toEqual([['momentum_chaser', 'analyst'], ['analyst', 'momentum_chaser']]);
  });
  it('native control is silence (no event)', () => {
    expect(plan.native_control.event).toBeNull();
  });
});

describe('auth-bridge helpers (fixes from the failed live run)', () => {
  it('resolveWebApiKey honors candidate precedence', () => {
    expect(resolveWebApiKey({ VITE_FIREBASE_API_KEY: 'k1', FIREBASE_API_KEY: 'k2' })).toEqual({ key: 'k1', name: 'VITE_FIREBASE_API_KEY' });
    expect(resolveWebApiKey({ FIREBASE_WEB_API_KEY: 'k3' }).key).toBe('k3');
  });

  it('readResponse parses JSON and passes a non-JSON body through without throwing', async () => {
    const fakeRes = (status, body) => ({ status, ok: status >= 200 && status < 300, text: async () => body });
    const ok = await readResponse(fakeRes(200, '{"idToken":"abc"}'));
    expect(ok).toMatchObject({ status: 200, ok: true, json: { idToken: 'abc' } });
    // the exact failure the live run hit: a 401 with a non-JSON body must NOT crash
    const bad = await readResponse(fakeRes(401, 'Missing or invalid Authorization header'));
    expect(bad.status).toBe(401);
    expect(bad.ok).toBe(false);
    expect(bad.json).toBeNull();
    expect(bad.text).toMatch(/Missing or invalid/);
    // and it tolerates a fake without a headers/redirected shape (fields default, no throw)
    expect(bad.location).toBeNull();
    expect(bad.redirected).toBe(false);
  });

  it('readResponse captures the Location + redirected of a 3xx (the auth-strip signal the preflight keys on)', async () => {
    const redirectRes = {
      status: 308,
      ok: false,
      redirected: false,
      headers: { get: (h) => (h.toLowerCase() === 'location' ? 'https://prod.example.com/api/agent/log-rule-compat-event' : null) },
      text: async () => 'redirecting',
    };
    const r = await readResponse(redirectRes);
    expect(r.status).toBe(308);
    expect(r.location).toBe('https://prod.example.com/api/agent/log-rule-compat-event');
    expect(new URL(r.location).origin).toBe('https://prod.example.com');
  });
});

describe('buildGcsConfirmation never throws — the report always writes (crash fix)', () => {
  const args = { agentId: 'ws1walk1', runStart: ts, expectedRescans: 2 };

  it('absent creds → UNCONFIRMED-with-fallback, not an error', async () => {
    const c = await buildGcsConfirmation({ ...args, credsJson: null, credsSource: null });
    expect(c.source).toBe('UNCONFIRMED');
    expect(c.reason).toBe('GCS credentials absent');
    expect(c.writeSiteLoggingFallback).toMatch(/shadowLogger/);
  });

  it('a load error (missing GCS_CREDENTIALS_PATH file) → UNCONFIRMED with the reason, no throw', async () => {
    const c = await buildGcsConfirmation({ ...args, credsJson: null, credsSource: 'path:/nope/sa.json', credsError: 'GCS_CREDENTIALS_PATH points to a missing file: /nope/sa.json.' });
    expect(c.source).toBe('UNCONFIRMED');
    expect(c.reason).toBe('GCS creds not loadable');
    expect(c.warning).toMatch(/missing file/);
  });

  it('creds present but non-JSON (the exact line-425 crash) → UNCONFIRMED, raw head, no throw', async () => {
    // e.g. a multi-line service-account blob truncated to its first line by the env parser
    const c = await buildGcsConfirmation({ ...args, credsJson: '{"type": "service_account",', credsSource: 'inline:GCS_CREDENTIALS' });
    expect(c.source).toBe('UNCONFIRMED');
    expect(c.reason).toMatch(/not valid JSON/);
    expect(c.rawCredsHead).toMatch(/service_account/);
    expect(c.warning).toMatch(/GCS_CREDENTIALS_PATH/); // points Flash at the preferred fix
  });
});

describe('resolveGcsCreds — path preferred, inline fallback, missing path surfaced', () => {
  it('GCS_CREDENTIALS_PATH is preferred over an inline blob and reads the file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws1-gcs-'));
    const p = join(dir, 'sa.json');
    writeFileSync(p, '{"type":"service_account","project_id":"x"}');
    const r = resolveGcsCreds({ GCS_CREDENTIALS_PATH: p, GCS_CREDENTIALS: '{"ignored":true}' });
    expect(r.source).toBe(`path:${p}`);
    expect(JSON.parse(r.credsJson).project_id).toBe('x');
    expect(r.error).toBeUndefined();
  });

  it('a missing GCS_CREDENTIALS_PATH surfaces a load error (no throw, no silent inline fallthrough)', () => {
    const r = resolveGcsCreds({ GCS_CREDENTIALS_PATH: '/does/not/exist/sa.json' });
    expect(r.credsJson).toBeNull();
    expect(r.error).toMatch(/missing file/);
  });

  it('falls back to the inline blob when no path is set', () => {
    const r = resolveGcsCreds({ GCS_CREDENTIALS: '{"type":"service_account"}' });
    expect(r.source).toBe('inline:GCS_CREDENTIALS');
    expect(r.credsJson).toMatch(/service_account/);
  });

  it('returns null source when neither is set', () => {
    expect(resolveGcsCreds({})).toMatchObject({ credsJson: null, source: null });
  });
});

describe('parseEnvFile tolerates a multi-line SINGLE-quoted value (the real .env.local shape)', () => {
  it('accumulates a multi-line quoted blob intact instead of truncating at the first newline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws1-env-'));
    const p = join(dir, '.env.local');
    // A pretty-printed JSON blob wrapped in single quotes across several physical lines.
    writeFileSync(p, [
      'WS1_WALK_BASE_URL=https://example.com',
      "GCS_CREDENTIALS='{",
      '  "type": "service_account",',
      '  "project_id": "fantasytrades"',
      "}'",
      'FIREBASE_API_KEY=abc123',
    ].join('\n'));
    const env = parseEnvFile(p);
    expect(env.WS1_WALK_BASE_URL).toBe('https://example.com');
    expect(env.FIREBASE_API_KEY).toBe('abc123'); // parsing resumes after the closing quote
    const creds = JSON.parse(env.GCS_CREDENTIALS);
    expect(creds).toMatchObject({ type: 'service_account', project_id: 'fantasytrades' });
  });
});
