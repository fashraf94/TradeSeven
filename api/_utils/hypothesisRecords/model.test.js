// api/_utils/hypothesisRecords/model.test.js
//
// Pilot P1a — the version record, pure (pilot spec V1.4 §2.1, §2.2, §2.5).
// Acceptance rows 3 (content immutability: the hash covers content only),
// 4 (the transition table, every legal pair and every illegal one) and 6
// (horizon capture at save) at the model layer; the routes and the save path
// prove the same through the transactions (watchlists.hypothesisRecords.test.js).
//
// Dependency-surface guard (BUILD_RULES §4): model.js imports the src/ module
// src/constants/hypothesisRecords.js; this test's un-mocked import of model.js
// is the runtime guard that the edge stays Node-clean. Never mocked.

import { describe, it, expect } from 'vitest';
import {
  HYPOTHESIS_STATUSES, TERMINAL_STATUSES, PRE_DEPLOY_STATUSES, HORIZON_ENUMS, CONTENT_FIELDS, LIFECYCLE_FIELDS, IDENTITY_FIELDS,
  PLAYER_TRANSITIONS, legalTransition, legalActionsFor, buildContent, buildVersionDoc, contentHashOf, contentOf,
  buildSaveVersion, sessionHorizonOf, originOf, currentVersionOf, normalizeStatement, normalizeConditions,
  normalizeMissingEvidence, opFingerprintOf, STATEMENT_MAX_LEN,
} from './model.js';
import { canonicalContentHash } from '../canonicalHash.js';

const NOW = '2026-10-07T14:00:00.000Z';
const content = (over = {}) => ({
  statement: 'AI capex keeps compounding', horizonEnum: 'swing', horizonSource: 'parse', activation: [], invalidation: [],
  evidenceRefs: [], publishedAt: null, origin: 'signaldrop', ...over,
});
const doc = (over = {}) => buildVersionDoc({
  version: 1, watchlistId: 'wl-1', userId: 'u-1', opId: 'op-1', opFingerprint: 'f'.repeat(64), createdAt: NOW,
  content: content(), status: 'researched', stateSource: 'research', stateReason: 'dialogue_completed', ...over,
});

describe('the record shape — identity, content, lifecycle are disjoint and complete', () => {
  it('a built version carries exactly identity + content + contentHash + lifecycle, the deploy fields null', () => {
    const d = doc();
    expect(Object.keys(d).sort()).toEqual([...IDENTITY_FIELDS, ...CONTENT_FIELDS, 'contentHash', ...LIFECYCLE_FIELDS].sort());
    expect(new Set([...IDENTITY_FIELDS, ...CONTENT_FIELDS, ...LIFECYCLE_FIELDS]).size).toBe(IDENTITY_FIELDS.length + CONTENT_FIELDS.length + LIFECYCLE_FIELDS.length);
    expect(d).toMatchObject({ stateChangedAt: NOW, missingEvidence: null, successorVersion: null, firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null });
  });
  it('contentHash = canonicalContentHash over EXACTLY the eight content fields', () => {
    const d = doc();
    expect(d.contentHash).toBe(canonicalContentHash(Object.fromEntries(CONTENT_FIELDS.map((k) => [k, d[k]]))));
    expect(d.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('no lifecycle or identity field enters the hash: changing any of them leaves contentHash unchanged', () => {
    const d = doc();
    for (const k of [...LIFECYCLE_FIELDS, ...IDENTITY_FIELDS]) {
      expect(contentHashOf({ ...d, [k]: 'changed' })).toBe(d.contentHash);
    }
  });
  it('every content field moves the hash', () => {
    const base = contentHashOf(content());
    const changes = {
      statement: 'another idea', horizonEnum: 'longterm', horizonSource: 'player',
      activation: [{ symbol: 'NVDA', side: 'above', level: 150, basis: 'daily_close' }],
      invalidation: [{ symbol: 'NVDA', side: 'below', level: 120, basis: 'daily_close' }],
      evidenceRefs: ['rw-1'], publishedAt: '2026-10-01', origin: 'theme',
    };
    expect(Object.keys(changes).sort()).toEqual([...CONTENT_FIELDS].sort());
    for (const [k, v] of Object.entries(changes)) expect(contentHashOf(content({ [k]: v }))).not.toBe(base);
  });
  it('contentOf keeps exactly the content fields', () => {
    expect(Object.keys(contentOf(doc())).sort()).toEqual([...CONTENT_FIELDS].sort());
  });
});

describe('content validation — typed refusals, never coerced', () => {
  it('statement: trimmed; empty or over the cap is invalid_statement', () => {
    expect(normalizeStatement('  idea  ')).toBe('idea');
    for (const bad of ['', '   ', 7, null, 'x'.repeat(STATEMENT_MAX_LEN + 1)]) {
      expect(() => normalizeStatement(bad)).toThrow(expect.objectContaining({ code: 'invalid_statement' }));
    }
  });
  it('conditions: {symbol, side, level, basis: daily_close}; empty arrays allowed; anything else invalid_condition', () => {
    expect(normalizeConditions([])).toEqual([]);
    expect(normalizeConditions([{ symbol: ' nvda ', side: 'above', level: 150.5, basis: 'daily_close' }])).toEqual([{ symbol: 'NVDA', side: 'above', level: 150.5, basis: 'daily_close' }]);
    for (const bad of [
      [{ symbol: 'NVDA', side: 'up', level: 1, basis: 'daily_close' }],
      [{ symbol: 'NVDA', side: 'above', level: -1, basis: 'daily_close' }],
      [{ symbol: 'NVDA', side: 'above', level: Infinity, basis: 'daily_close' }],
      [{ symbol: 'NVDA', side: 'above', level: 1, basis: 'intraday' }],
      [{ symbol: 'NV/DA', side: 'above', level: 1, basis: 'daily_close' }],
      [{ symbol: 'NVDA', side: 'above', level: 1, basis: 'daily_close', note: 'x' }],
      ['NVDA above 150'], 'NVDA', null,
    ]) expect(() => normalizeConditions(bad)).toThrow(expect.objectContaining({ code: 'invalid_condition' }));
  });
  it('horizon, origin, evidence refs and publishedAt are checked against their enums and types', () => {
    expect(() => buildContent(content({ horizonEnum: 'weekly' }))).toThrow(expect.objectContaining({ code: 'invalid_horizon' }));
    expect(() => buildContent(content({ horizonSource: 'guess' }))).toThrow(expect.objectContaining({ code: 'invalid_horizon' }));
    expect(() => buildContent(content({ origin: 'twitter' }))).toThrow(expect.objectContaining({ code: 'invalid_origin' }));
    expect(() => buildContent(content({ evidenceRefs: [''] }))).toThrow(expect.objectContaining({ code: 'invalid_evidence_refs' }));
    expect(() => buildContent(content({ publishedAt: '' }))).toThrow(expect.objectContaining({ code: 'invalid_published_at' }));
    expect(buildContent(content({ publishedAt: null })).publishedAt).toBeNull();
  });
  it('missing evidence is required, trimmed and capped', () => {
    expect(normalizeMissingEvidence('  Q3 guidance  ')).toBe('Q3 guidance');
    for (const bad of ['', '  ', undefined, 4, 'x'.repeat(301)]) {
      expect(() => normalizeMissingEvidence(bad)).toThrow(expect.objectContaining({ code: 'missing_evidence_required' }));
    }
  });
});

describe('the player transition table (spec §2.5; acceptance row 4)', () => {
  // The build prompt's list, restated independently of PLAYER_TRANSITIONS.
  const EXPECTED = {
    ready: { researched: 'player_ready', waiting_for_evidence: 'evidence_supplied' },
    wait: { researched: 'awaiting_evidence' },
    reject: { draft: 'player_rejected', researched: 'player_rejected', waiting_for_evidence: 'player_rejected' },
    cancel: { draft: 'player_cancelled', researched: 'player_cancelled', ready: 'player_cancelled', waiting_for_evidence: 'player_cancelled' },
    retire: Object.fromEntries(HYPOTHESIS_STATUSES.filter((s) => !['retired', 'rejected', 'cancelled'].includes(s)).map((s) => [s, 'player_retired'])),
  };
  const TARGET = { ready: 'ready', wait: 'waiting_for_evidence', reject: 'rejected', cancel: 'cancelled', retire: 'retired' };

  it('the actions are exactly ready, wait, reject, cancel, retire (reaffirm creates a version instead)', () => {
    expect(Object.keys(PLAYER_TRANSITIONS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });
  for (const action of Object.keys(EXPECTED)) {
    for (const status of HYPOTHESIS_STATUSES) {
      const reason = EXPECTED[action][status];
      it(`${status} --${action}--> ${reason ? `${TARGET[action]} (${reason})` : 'REFUSED'}`, () => {
        expect(legalTransition(status, action)).toEqual(reason ? { to: TARGET[action], reason } : null);
      });
    }
  }
  it('no transition leaves a terminal status; unknown actions and statuses are refused', () => {
    for (const s of TERMINAL_STATUSES) for (const a of Object.keys(EXPECTED)) expect(legalTransition(s, a)).toBeNull();
    expect(legalTransition('researched', 'reaffirm')).toBeNull();
    expect(legalTransition('researched', 'toString')).toBeNull();
    expect(legalTransition('constructor', 'retire')).toBeNull();
    expect(legalTransition(undefined, 'retire')).toBeNull();
  });
  it('pre-deploy statuses are draft, researched, ready, waiting_for_evidence', () => {
    expect([...PRE_DEPLOY_STATUSES].sort()).toEqual(['draft', 'ready', 'researched', 'waiting_for_evidence']);
  });
  it('the Forge\'s legal actions: reaffirm only for a current review_due without a successor; a superseded version can only be closed', () => {
    expect(legalActionsFor('review_due')).toEqual(['retire', 'reaffirm']);
    expect(legalActionsFor('review_due', { hasSuccessor: true })).toEqual(['retire']);
    expect(legalActionsFor('researched')).toEqual(['ready', 'wait', 'reject', 'cancel', 'retire']);
    expect(legalActionsFor('researched', { isCurrent: false })).toEqual(['reject', 'cancel', 'retire']);
    expect(legalActionsFor('retired')).toEqual([]);
  });
});

describe('horizon capture and origin at save (spec §2.5, §2.8; acceptance row 6)', () => {
  const paste = (timeHorizon) => ({ parseResult: { parse: { timeHorizon } }, anatomy: { thesis: '  Rates fall, small caps rip  ' } });
  it('a paste session carries the parse\'s horizon with source parse — each enum value', () => {
    for (const h of HORIZON_ENUMS) expect(sessionHorizonOf(paste(h))).toEqual({ horizonEnum: h, horizonSource: 'parse' });
  });
  it('a theme session is the constant unspecified / theme_default, whatever its parse says', () => {
    expect(sessionHorizonOf({ source: 'theme', parseResult: { parse: { timeHorizon: 'swing' } } })).toEqual({ horizonEnum: 'unspecified', horizonSource: 'theme_default' });
  });
  it('a session with no usable parse is unspecified / default — never guessed', () => {
    for (const s of [{}, { parseResult: null }, paste('weekly'), null]) expect(sessionHorizonOf(s)).toEqual({ horizonEnum: 'unspecified', horizonSource: 'default' });
  });
  it('buildSaveVersion: v1, statement = trimmed thesis, researched / research / dialogue_completed, opId save_{sessionId}', () => {
    const v = buildSaveVersion({ session: paste('positional'), watchlistId: 'wl-1', userId: 'u-1', sessionId: 's-1', nowIso: NOW });
    expect(v).toMatchObject({
      version: 1, watchlistId: 'wl-1', userId: 'u-1', opId: 'save_s-1', createdAt: NOW,
      statement: 'Rates fall, small caps rip', horizonEnum: 'positional', horizonSource: 'parse', origin: 'signaldrop',
      activation: [], invalidation: [], evidenceRefs: [], publishedAt: null,
      status: 'researched', stateSource: 'research', stateReason: 'dialogue_completed',
    });
    expect(v.opFingerprint).toBe(opFingerprintOf({ kind: 'save', payload: { sessionId: 's-1' } }));
  });
  it('buildSaveVersion: a theme session → origin theme, unspecified / theme_default', () => {
    const v = buildSaveVersion({ session: { source: 'theme', themeId: 't-1', anatomy: { thesis: 'Grid buildout' } }, watchlistId: 'wl-1', userId: 'u-1', sessionId: 's-1', nowIso: NOW });
    expect(v).toMatchObject({ origin: 'theme', horizonEnum: 'unspecified', horizonSource: 'theme_default' });
  });
  it('buildSaveVersion: an empty or missing thesis → null (no version)', () => {
    for (const anatomy of [{ thesis: '' }, { thesis: '   ' }, { thesis: null }, {}, undefined]) {
      expect(buildSaveVersion({ session: { anatomy }, watchlistId: 'wl-1', userId: 'u-1', sessionId: 's-1', nowIso: NOW })).toBeNull();
    }
  });
  it('originOf: session-derived → signaldrop | theme (from the session); sourceScreenSpec → screener; else manual', () => {
    expect(originOf({ sourceSessionId: 's-1' }, {})).toBe('signaldrop');
    expect(originOf({ sourceSessionId: 's-1' }, { source: 'theme' })).toBe('theme');
    expect(originOf({ sourceSessionId: null, sourceScreenSpec: { filters: [] } })).toBe('screener');
    expect(originOf({ sourceSessionId: null, sourceScreenSpec: null })).toBe('manual');
    expect(originOf({ sourceSessionId: null })).toBe('manual');
  });
});

describe('the parent pointer', () => {
  it('absent / null → 0; a version number → itself; anything else throws (never silently reset to 0)', () => {
    expect(currentVersionOf({})).toBe(0);
    expect(currentVersionOf({ currentHypothesisVersion: null })).toBe(0);
    expect(currentVersionOf({ currentHypothesisVersion: 4 })).toBe(4);
    for (const bad of [0, -1, 1.5, '2', true]) expect(() => currentVersionOf({ currentHypothesisVersion: bad })).toThrow();
  });
});

describe('table E — the routes\' player-facing words use no forbidden vocabulary (review L4-8)', () => {
  // docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md §E. The panel shows a typed refusal's message verbatim,
  // so every string literal in the route modules is scanned, not only the exported copy.
  const FORBIDDEN = [
    /\bhedge/i, /\btrim/i, /\bpartial/i, /\bscale (in|out)\b/i, /take some off/i, /cash position/i, /move to cash/i,
    /sit in cash/i, /wait for the market to/i, /probably|likely fine/i, /guaranteed/i, /can'?t lose/i,
  ];
  it('ROUTE_COPY and every quoted literal in store.js, http.js and model.js', async () => {
    const { readFileSync } = await import('node:fs');
    const { ROUTE_COPY } = await import('./store.js');
    const literals = ['store.js', 'http.js', 'model.js']
      .map((f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'))
      // Quoted runs (an escaped quote splits a literal into fragments — each fragment is still scanned).
      .flatMap((src) => [...src.matchAll(/'([^'\n]*)'/g), ...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]));
    const all = [...Object.values(ROUTE_COPY), ...literals];
    expect(all.length).toBeGreaterThan(50);
    const hits = all.flatMap((s) => FORBIDDEN.filter((re) => re.test(s)).map((re) => `${re} in "${s}"`));
    expect(hits).toEqual([]);
  });
});
