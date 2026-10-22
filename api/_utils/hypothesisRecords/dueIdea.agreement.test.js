// api/_utils/hypothesisRecords/dueIdea.agreement.test.js
//
// Pilot P1c — founder ruling E1; BUILD_RULES §9 (one rule, never two copies
// that can drift). The deploy station asks the shared predicate
// (src/constants/hypothesisRecords.js dueDeployPending) whether to show its
// screen; the deploy's resolver (carriage.js resolveDeployCarriage) decides
// whether the battle carries nothing for that reason (`none` / `review_due`)
// — the answer the success screen's notice rides. On EVERY list of stored
// versions below (each status, deployed and not, in every order of one, two
// and three versions — 1,463 lists), the two say the same thing about the
// same version.
//
// Stated limit: the resolver ALSO judges, at deploy, an `activated` version
// whose own review row says it is already due (P1b review L2-1) — a fact the
// Forge's GET does not show. Those lists are left out here (no armed rows);
// the client then shows no screen, and the deploy's notice tells the player
// after. Corrupt records (a content hash that no longer matches) are left out
// too: the resolver carries nothing for them, silently.
//
// Dependency-surface guard (BUILD_RULES §4): carriage.js and the shared
// vocabulary are imported for real.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeDeployDb } from '../__fixtures__/deployHarness.js';

const state = vi.hoisted(() => ({ flag: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flag; } };
});

const { resolveDeployCarriage } = await import('./carriage.js');
const { buildVersionDoc } = await import('./model.js');
const { dueDeployPending } = await import('../../../src/constants/hypothesisRecords.js');

const OWNER = 'agree-owner-1';
const WL = 'wl-agree-1';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const LIT = Object.freeze({ dark: false, descriptor: null });
const DEPLOYED = {
  firstDeployedAt: '2026-10-05T15:00:00.000Z', lastDeployedAt: '2026-10-05T15:00:00.000Z', lastDeployedBattleId: 'b-old',
  reviewDueAt: '2026-12-31T21:00:00.000Z',
};
/** Every stored state a version of an idea can hold, deployed or not. */
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
  vi.setSystemTime(new Date('2026-10-13T15:00:00.000Z'));
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

describe('the deploy station\'s screen and the deploy\'s notice agree (BUILD_RULES §9)', () => {
  it('on every list of one, two and three stored versions: dueDeployPending names a version EXACTLY when the resolver answers none / review_due for it', async () => {
    const all = lists();
    expect(all).toHaveLength(11 + 11 ** 2 + 11 ** 3);
    const disagreements = [];
    let due = 0;
    for (const kinds of all) {
      const versions = kinds.map((k, i) => version(i + 1, k));
      const docs = { [`watchlists/${WL}`]: { watchlistId: WL, userId: OWNER, name: 'AI capex', status: 'committed', tickers: [{ symbol: 'NVDA' }] } };
      for (const v of versions) docs[`watchlists/${WL}/hypothesisVersions/v${v.version}`] = v;
      const res = await resolveDeployCarriage(makeDeployDb(docs), {
        ownerUid: OWNER, watchlistId: WL, watchlist: docs[`watchlists/${WL}`], snapshot: { watchlistId: WL, name: 'AI capex', tickers: ['NVDA'] }, pin: LIT,
      });
      const server = res.outcome === 'none' && res.reason === 'review_due' ? res.version : null;
      const client = dueDeployPending(versions)?.version ?? null;
      if (server !== client) disagreements.push(`${kinds.join(' → ')}: resolver ${server} / station ${client}`);
      if (server !== null) due += 1;
    }
    expect(disagreements).toEqual([]);
    expect(due).toBeGreaterThan(100); // non-vacuous: many lists are due
  }, 60_000);
});
