// api/_utils/hypothesisRecords/__fixtures__/contentHashCases.js
//
// The Research Record Extension (7 Nov 2026) — the idea versions whose content
// hashes the golden row pins (contentHash.golden.test.js). Every case is built
// by P1a's own buildVersionDoc / buildSaveVersion, the way the fixtures and the
// save path build them, so the same file run against main's model.js (an LF
// `git archive` of d503dd07, this file copied in at its own path) is what
// captured the golden hashes. Uses ONLY exports that exist on main.

import { buildVersionDoc, buildSaveVersion } from '../model.js';
import { version as deployVersion } from '../../__fixtures__/deployScenarios.js';

const NOW = '2026-10-07T14:00:00.000Z';
const doc = (content, over = {}) => buildVersionDoc({
  version: 1, watchlistId: 'wl-1', userId: 'u-1', opId: 'op-1', opFingerprint: 'f'.repeat(64), createdAt: NOW,
  content: {
    statement: 'AI capex keeps compounding', horizonEnum: 'swing', horizonSource: 'parse', activation: [], invalidation: [],
    evidenceRefs: [], publishedAt: null, origin: 'signaldrop', ...content,
  },
  status: 'researched', stateSource: 'research', stateReason: 'dialogue_completed', ...over,
});
const conditions = {
  activation: [{ symbol: 'NVDA', side: 'above', level: 145.5, basis: 'daily_close' }],
  invalidation: [{ symbol: 'nvda', side: 'below', level: 120, basis: 'daily_close' }, { symbol: 'AMD', side: 'below', level: 99.25, basis: 'daily_close' }],
};
const pasteSession = {
  source: 'paste', anatomy: { thesis: '  Rates fall, small caps rip  ' }, parseResult: { parse: { timeHorizon: 'positional' } },
};

/** name → a version document (only its contentHash is pinned). */
export const CONTENT_HASH_CASES = {
  'deploy fixture v1 (manual, swing, no refs)': () => deployVersion(1),
  'deploy fixture v2': () => deployVersion(2),
  'deploy fixture v3, screener / longterm': () => deployVersion(3, {}, { origin: 'screener', horizonEnum: 'longterm' }),
  'save v1, paste session, cites its dialogue record': () => buildSaveVersion({ session: pasteSession, watchlistId: 'wl-1', userId: 'u-1', sessionId: 's-1', nowIso: NOW, researchWorkId: 'ws_s-1' }),
  'save v1, theme session, no research record': () => buildSaveVersion({ session: { source: 'theme', anatomy: { thesis: 'Grid buildout' } }, watchlistId: 'wl-1', userId: 'u-1', sessionId: 's-2', nowIso: NOW }),
  'player version, conditions and three research refs, published': () => doc({
    ...conditions, horizonSource: 'player', origin: 'manual', publishedAt: '2026-10-01',
    evidenceRefs: [{ kind: 'researchWork', id: 'rs_r-1' }, { kind: 'researchWork', id: 'as_a-1' }, { kind: 'researchWork', id: 'wl_wl-1' }],
  }),
  'the same refs written id-first (key order never moves the hash)': () => doc({
    ...conditions, horizonSource: 'player', origin: 'manual', publishedAt: '2026-10-01',
    evidenceRefs: [{ id: 'rs_r-1', kind: 'researchWork' }, { id: 'as_a-1', kind: 'researchWork' }, { id: 'wl_wl-1', kind: 'researchWork' }],
  }),
  'unicode statement, unspecified / default, theme': () => doc({ statement: 'Ünïcode — “quotes” · 日本', horizonEnum: 'unspecified', horizonSource: 'default', origin: 'theme' }),
  'intraday horizon': () => doc({ horizonEnum: 'intraday' }),
};
