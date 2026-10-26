// src/components/CommandCenter/hub/researchView.agreement.test.js
//
// Command Center hub, slice S6 (founder ruling Q-S6-2; BUILD_RULES §9 — one rule, never two copies that can drift). The Deploy
// card's "Deploying with" line (hub/researchView.js deployingWithOf) uses the deploy station's own predicate
// (src/constants/hypothesisRecords.js dueDeployPending) in place of its first reading of R-S6-5 ("no deployed version is
// review_due"). That predicate is pinned against the deploy's real resolver in api/_utils/hypothesisRecords/dueIdea.agreement.test.js
// for the "due" answer; this file pins the line itself against the same resolver, on the same shared fixtures — every list of one,
// two and three stored versions (each status, deployed and not, in every order: 1,463 lists):
//
//   whenever the hub SHOWS a line, the resolver CARRIES that very version.
//
// The hub may show less than the server carries (it never guesses beyond the common case: it needs the NEWEST version to be the
// carriable one); it may never show a line the server would not carry. Stated limit, as in dueIdea.agreement.test.js: the resolver
// also judges, at deploy, an `activated` version whose own review row says it is already due — a fact the list GET does not show —
// and those lists are left out (no armed rows). The resolver and the model are imported for real; the test reads, calls and imports
// nothing under api/ that it changes.

process.env.TZ = 'UTC';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDeployDb } from '../../../../api/_utils/__fixtures__/deployHarness.js';
import { CARRIABLE_STATUSES, dueDeployPending } from '../../../constants/hypothesisRecords';
import { RESEARCH_READ, deployingWithOf } from './researchView';
import { WATCHLIST_STATE } from './selectors/loadout';

const state = vi.hoisted(() => ({ flag: true }));
vi.mock('../../../config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flag; } };
});

const { resolveDeployCarriage } = await import('../../../../api/_utils/hypothesisRecords/carriage.js');
const { buildVersionDoc } = await import('../../../../api/_utils/hypothesisRecords/model.js');

const OWNER = 'agree-owner-1';
const WL = 'wl-agree-1';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const NOW = Date.parse('2026-10-13T15:00:00.000Z');
const LIT = Object.freeze({ dark: false, descriptor: null });
const DEPLOYED = {
  firstDeployedAt: '2026-10-05T15:00:00.000Z', lastDeployedAt: '2026-10-05T15:00:00.000Z', lastDeployedBattleId: 'b-old',
  reviewDueAt: '2026-12-31T21:00:00.000Z',
};
/** Every stored state a version of an idea can hold, deployed or not (the same eleven as dueIdea.agreement.test.js). */
const KINDS = Object.freeze({
  draft: {}, researched: {}, waiting_for_evidence: {}, ready: {}, rejected: {}, cancelled: {},
  'retired (never deployed)': {},
  activated: DEPLOYED, review_due: DEPLOYED, 'retired (deployed)': DEPLOYED, invalidated: DEPLOYED,
});
const statusOf = (kind) => kind.replace(/ \(.*\)$/, '');

function version(n, kind) {
  return {
    ...buildVersionDoc({
      version: n, watchlistId: WL, userId: OWNER, opId: `op-${n}`, opFingerprint: 'f'.repeat(64), createdAt: '2026-10-01T14:00:00.000Z',
      content: { statement: `idea v${n}`, horizonEnum: 'swing', horizonSource: 'player', activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'manual' },
      status: 'ready', stateSource: 'player', stateReason: 'player_ready',
    }),
    status: statusOf(kind),
    ...KINDS[kind],
  };
}

/** Every list of one, two and three versions, in every order (the stored version numbers are 1…n, newest last). */
function lists() {
  const names = Object.keys(KINDS);
  const out = [];
  const grow = (prefix) => {
    if (prefix.length > 0) out.push(prefix);
    if (prefix.length === 3) return;
    for (const k of names) grow([...prefix, k]);
  };
  grow([]);
  return out;
}

let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  state.flag = true;
  savedEnv = process.env[ENV];
  process.env[ENV] = OWNER;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('"Deploying with" and the deploy\'s resolver agree (BUILD_RULES §9; Q-S6-2)', () => {
  it('on every list of one, two and three stored versions: a line shown is a version the resolver carries', async () => {
    const all = lists();
    expect(all).toHaveLength(11 + 11 ** 2 + 11 ** 3);
    const disagreements = [];
    let shown = 0;
    let carriedHidden = 0;
    let reaffirmed = 0;
    for (const kinds of all) {
      const versions = kinds.map((k, i) => version(i + 1, k));
      const docs = { [`watchlists/${WL}`]: { watchlistId: WL, userId: OWNER, name: 'AI capex', status: 'committed', tickers: [{ symbol: 'NVDA' }] } };
      for (const v of versions) docs[`watchlists/${WL}/hypothesisVersions/v${v.version}`] = v;
      const res = await resolveDeployCarriage(makeDeployDb(docs), {
        ownerUid: OWNER, watchlistId: WL, watchlist: docs[`watchlists/${WL}`], snapshot: { watchlistId: WL, name: 'AI capex', tickers: ['NVDA'] }, pin: LIT,
      });
      // The hub's side: the GET's versions (newest first), the list card ready with one name, the list document with one kept name.
      const read = {
        status: RESEARCH_READ.READY, listId: WL, key: `u:1:${WL}`, asOf: NOW, refreshing: false, retryNotBefore: null,
        data: { currentVersion: versions.length, versionCount: versions.length, versions: [...versions].reverse(), research: [], deployedLists: {} },
      };
      const line = deployingWithOf({
        read, watchlist: { id: WL, name: 'AI capex', state: WATCHLIST_STATE.READY, count: 1, symbols: ['NVDA'] }, listDoc: { tickers: [{ symbol: 'NVDA' }] }, nowMs: NOW,
      });
      const carried = res.outcome === 'carry' ? res.version : null;
      if (line !== null) {
        shown += 1;
        if (carried !== line.version) disagreements.push(`${kinds.join(' → ')}: hub shows v${line.version} / resolver ${res.outcome} ${carried ?? res.reason}`);
      } else if (carried !== null) {
        carriedHidden += 1;
      }
      // the reaffirmed shape the ruling is about: an older deployed version due under a newer ready or activated one
      if (line !== null && kinds.slice(0, -1).some((k) => statusOf(k) === 'review_due')) reaffirmed += 1;
    }
    expect(disagreements).toEqual([]);
    expect(shown, 'non-vacuous: many lists show a line').toBeGreaterThan(100);
    expect(reaffirmed, 'the ruled case is in the set: a due version under a newer one that rides').toBeGreaterThan(0);
    // The hub never shows MORE than the server carries; that it shows less is the stated, accepted caution.
    expect(carriedHidden).toBeGreaterThanOrEqual(0);
  }, 120_000);

  it('the predicate and the newest-version condition: dueDeployPending names a version only when the NEWEST version cannot ride, so the two conditions never disagree (why the predicate is a drift guard, not a second filter)', () => {
    const all = lists();
    let named = 0;
    const offenders = [];
    for (const kinds of all) {
      const versions = kinds.map((k, i) => version(i + 1, k));
      if (dueDeployPending(versions) === null) continue;
      named += 1;
      if (CARRIABLE_STATUSES.includes(versions[versions.length - 1].status)) offenders.push(kinds.join(' → '));
    }
    expect(offenders).toEqual([]);
    expect(named, 'non-vacuous').toBeGreaterThan(100);
  });
});
