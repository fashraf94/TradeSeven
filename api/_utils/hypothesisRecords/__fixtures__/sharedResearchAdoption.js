// api/_utils/hypothesisRecords/__fixtures__/sharedResearchAdoption.js
//
// The Research Record Extension follow-up (V2 §4) — one fixed adoption: a
// Shared Research list, its investigation record (built through the research
// model's own writers: a question, three findings, the second corrected by the
// third), and the builder's input. sharedResearchVersion.test.js pins the
// builder's exact output and hash on it.

import { buildSharedResearchVersion } from '../model.js';
import {
  buildRecord, buildFinding, findingAppendPatch, manualFunnel, emptyTelemetry, HOST_COLLECTIONS,
} from '../../researchRecords/model.js';

export const OWNER = 'u-adopt-1';
export const SESSION_ID = 'srs-adopt-1';
export const RECORD_ID = `sr_${SESSION_ID}`;
export const WATCHLIST_ID = 'wl-adopt-1';
export const NOW = '2026-11-07T16:00:00.000Z';
export const CONFIRM_EXCHANGE_ID = '6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c';
export const fid = (n) => `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** The list the Shared Research route saves: its marker names the session. */
export const adoptionList = (over = {}) => ({
  watchlistId: WATCHLIST_ID, userId: OWNER, agentId: null, sourceSessionId: null, sourceDropId: null,
  sourceSharedResearchSessionId: SESSION_ID, tickers: [{ symbol: 'AVGO' }], name: 'Networking', status: 'draft', ...over,
});

/** The investigation: a question; findings 1 and 3 current, 2 corrected by 3. */
export function adoptionRecord({ question = 'Is networking the next leg?' } = {}) {
  let r = buildRecord({
    researchWorkId: RECORD_ID, userId: OWNER, origin: 'shared_research', host: { collection: HOST_COLLECTIONS.shared_research, id: SESSION_ID },
    createdAt: '2026-11-07T15:00:00.000Z', question, funnel: manualFunnel(), telemetry: emptyTelemetry(),
  });
  const add = (n, over) => {
    const f = buildFinding({
      kind: 'earnings_fact', symbol: 'AVGO', fact: `Fact ${n}`, source: { recordKind: 'stockBriefs', recordId: 'AVGO', label: 'AVGO brief' },
      at: '2026-11-06T21:00:00.000Z', status: 'verified', ...over,
    }, { findingId: fid(n), nowIso: '2026-11-07T15:30:00.000Z' });
    r = { ...r, ...findingAppendPatch(r, f, { nowIso: '2026-11-07T15:30:00.000Z' }) };
  };
  add(1, {});
  add(2, { fact: 'AI networking revenue doubled.' });
  add(3, { fact: 'AI networking revenue rose 1.9x (corrected).', supersedes: fid(2) });
  return r;
}

/** The builder's fixed input. */
export const adoptionInput = (over = {}) => ({
  list: adoptionList(), watchlistId: WATCHLIST_ID, record: adoptionRecord(), userId: OWNER, sessionId: SESSION_ID,
  statement: 'Networking carries the next leg of AI capex.', horizonEnum: 'positional',
  activation: [{ symbol: 'AVGO', side: 'above', level: 180, basis: 'daily_close' }], invalidation: [],
  keptFindingIds: [fid(1), fid(3)], confirmExchangeId: CONFIRM_EXCHANGE_ID, nowIso: NOW, ...over,
});

export const adoptedVersion = (over = {}) => buildSharedResearchVersion(adoptionInput(over));
