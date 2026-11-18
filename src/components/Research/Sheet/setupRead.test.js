// src/components/Research/Sheet/setupRead.test.js
//
// The chart's evidence — the client read (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md §4.6):
// the three answers passed on unchanged, every failure a rejection with its status and
// error, a body outside the contract never resolved, and one caller in src: the Chart view's read
// (src/components/Research/ChartRead/useChartRead.js — docs/specs/CHART_READ_SPEC_V1.md).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { SETUP_READ_FIELDS, SETUP_READ_PREVIOUS_FIELDS } from './setupReadContract.js';

const net = vi.hoisted(() => ({ calls: [], respond: null }));
vi.mock('../../../utils/fetchWithAuth.js', () => ({
  fetchWithAuth: async (url, options) => { net.calls.push({ url, options }); return net.respond(url); },
}));

const { fetchSetupRead, setupReadBodyOk, SETUP_READ_PATH } = await import('./setupRead.js');

const reply = (status, body) => () => ({ ok: status >= 200 && status < 300, status, json: async () => (body instanceof Error ? Promise.reject(body) : structuredClone(body)) });
const read = () => Object.fromEntries(SETUP_READ_FIELDS.map((k) => [k, k === 'behind' ? false : null]));
const body = (answer, over = {}) => ({ answer, symbol: 'BRK-B', servedAt: 1_763_330_400_000, sessionsTried: ['2026-11-16'], read: answer === 'absent' ? null : read(), previous: null, ...over });
// RD-2: `previous` — the earlier session's record as a small summary.
const previous = () => ({ session: '2026-11-13', verdict: 'invalid', reason: 'no_setup', pattern: null, regime: 'uptrend', patternsSatisfied: [], checks: [{ id: 'regime_stack', result: true }, { id: 'extension', result: 'unknown' }] });

beforeEach(() => { net.calls = []; net.respond = null; });

describe('fetchSetupRead', () => {
  it.each(['measured', 'refused', 'absent'])('%s: the body is resolved exactly as sent', async (answer) => {
    net.respond = reply(200, body(answer));
    await expect(fetchSetupRead('BRK-B')).resolves.toEqual(body(answer));
  });
  it.each(['measured', 'refused'])('%s with a previous record (RD-4): resolved exactly as sent', async (answer) => {
    net.respond = reply(200, body(answer, { previous: previous() }));
    await expect(fetchSetupRead('BRK-B')).resolves.toEqual(body(answer, { previous: previous() }));
    expect(Object.keys(previous())).toEqual([...SETUP_READ_PREVIOUS_FIELDS]);
  });
  it('asks the one route, the symbol encoded, through the authenticated fetch', async () => {
    net.respond = reply(200, body('absent'));
    await fetchSetupRead('brk.b&session=2026-01-02');
    expect(net.calls).toEqual([{ url: `${SETUP_READ_PATH}?symbol=brk.b%26session%3D2026-01-02`, options: undefined }]);
    expect(SETUP_READ_PATH).toBe('/api/research/setup-read');
  });
  it.each([
    [404, { error: 'chart_read_unavailable' }, 'chart_read_unavailable'],
    [400, { error: 'unsupported_symbol_class' }, 'unsupported_symbol_class'],
    [429, { error: 'rate_limited' }, 'rate_limited'],
    [500, { error: 'Could not read the record.' }, 'Could not read the record.'],
    [503, new Error('not json'), 'request_failed'],
  ])('a %s rejects with its status and error', async (status, payload, error) => {
    net.respond = reply(status, payload);
    await expect(fetchSetupRead('AAPL')).rejects.toEqual({ status, error });
  });
  it('a network failure rejects as status 0', async () => {
    net.respond = () => { throw new TypeError('Failed to fetch'); };
    await expect(fetchSetupRead('AAPL')).rejects.toEqual({ status: 0, error: 'network' });
  });
  it.each([
    ['an unknown answer', body('maybe')],
    ['absent with a read', { ...body('absent'), read: read() }],
    ['measured with no read', { ...body('measured'), read: null }],
    ['an extra body key', { ...body('measured'), extra: 1 }],
    ['a missing body key', (() => { const { sessionsTried: _s, ...b } = body('measured'); return b; })()],
    ['a read with an extra field', { ...body('measured'), read: { ...read(), writer: {} } }],
    ['a read missing a field', { ...body('refused'), read: (() => { const { checks: _c, ...r } = read(); return r; })() }],
    // RD-4: the body's new key, held to its closed list.
    ['no previous key at all', (() => { const { previous: _p, ...b } = body('measured'); return b; })()],
    ['absent with a previous record', body('absent', { previous: previous() })],
    ['a previous with an extra field (a fact)', body('measured', { previous: { ...previous(), facts: { C: 1 } } })],
    ['a previous missing a field', body('measured', { previous: (() => { const { regime: _r, ...p } = previous(); return p; })() })],
    ['a previous check with a side', body('measured', { previous: { ...previous(), checks: [{ id: 'extension', result: true, rhs: 141.1 }] } })],
    ['a previous whose checks are not a list', body('measured', { previous: { ...previous(), checks: {} } })],
    ['a previous that is not an object', body('measured', { previous: 'invalid' })],
    ['not an object', ['measured']],
    ['no body', new Error('not json')],
  ])('a 200 with %s is never resolved', async (_label, payload) => {
    net.respond = reply(200, payload);
    await expect(fetchSetupRead('AAPL')).rejects.toEqual({ status: 200, error: 'malformed_body' });
  });
  it('setupReadBodyOk agrees with the contract', () => {
    expect(setupReadBodyOk(body('measured'))).toBe(true);
    expect(setupReadBodyOk(null)).toBe(false);
  });
});

describe('one caller (the Chart view\'s read build: spec docs/specs/CHART_READ_SPEC_V1.md)', () => {
  it('nothing under src imports the client read but the Chart view\'s read hook — and the tests that pin it', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = resolve(here, '../../..');
    const hits = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (/\.(js|jsx|ts|tsx)$/.test(e.name) && /Sheet\/setupRead(\.js)?['"]|\.\/setupRead(\.js)?['"]/.test(readFileSync(p, 'utf8'))) hits.push(relative(src, p).split('\\').join('/'));
      }
    };
    walk(src);
    expect(hits.sort()).toEqual([
      'components/Research/ChartRead/useChartRead.js', // the one caller: the Chart view's read, behind CHART_READ_MODE
      'components/Research/ChartRead/useChartRead.jsdom.test.jsx', // its rows mock the client read
      'components/Research/Sheet/setupRead.test.js',
    ]);
  });
});
