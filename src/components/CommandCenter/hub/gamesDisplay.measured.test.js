// @vitest-environment node
//
// src/components/CommandCenter/hub/gamesDisplay.measured.test.js
//
// Command Center hub, slice S3 (ruling R-S3-7; v2 Ruling 16; review T4-2) — on
// the MEASURED scoring route the hub shows only validly committed scores: a
// finite stored pair beside unavailable evidence is no verdict and no pair on
// a completed row, and a dash — never the stale number — on a live row; a
// result-unavailable completion shows no pair. Real writer frames
// (correctedStockBattle + correctedScorePatch), as
// src/screens/stockThresholdReaders.test.jsx builds them: test-only imports
// from api/, in Node; nothing under src/ imports api/.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STOCK_TEST_NOW, correctedStockBattle, stockWriterDb } from '../../../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../../../api/_utils/stockThresholdAdmission.js';
import { STOCK_RESULT_UNAVAILABLE } from '../../../utils/stockThresholdModel';
import { completedGameRows, liveGameRows } from './gamesDisplay';

const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => {
  if (oldKey === undefined) delete process.env.EODHD_API_KEY;
  else process.env.EODHD_API_KEY = oldKey;
});

const NOW = Date.parse(STOCK_TEST_NOW);
const OPEN = { state: 'OPEN', isOpen: true };

/** A measured-route battle whose scores the writer has validly committed. */
async function committedBattle(agentQuote, cpuQuote) {
  const { battle } = await correctedStockBattle({ fill: 100, cpuSymbol: 'MSFT' });
  const prices = { AAPL: { current: agentQuote, timestamp: NOW / 1000 }, MSFT: { current: cpuQuote, timestamp: NOW / 1000 } };
  const [agent, cpu] = ['agent', 'cpu'].map((side) => scoreCorrectedPosition(
    battle,
    { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' },
    side,
    prices,
    STOCK_TEST_NOW,
  ));
  const h = stockWriterDb({ battle });
  await h.db.doc('battle').update(correctedScorePatch(battle, [agent], [cpu], STOCK_TEST_NOW));
  Object.assign(battle, h.store.get('battle'));
  return battle;
}
const asLive = (b) => ({ ...b, expiresAt: '2099-01-01T00:00:00Z', activatedAt: STOCK_TEST_NOW, ownerId: 'owner' });
const asDone = (b, over = {}) => ({ ...b, status: 'completed', completedAt: '2026-10-14T20:05:00.000Z', statusFeed: [{ action: 'battle_complete' }], ...over });
/** A finite stored pair beside unavailable evidence. */
const stale = (b) => ({ ...b, scoreState: { ...b.scoreState, currentScore: 30, opponentScore: 12, stockScoreEvidence: { status: 'unavailable', reason: 'roster_changed_awaiting_score' } } });
const liveDetail = (b) => liveGameRows([asLive(b)], { nowMs: NOW, marketState: OPEN })[0].detail;

describe('the measured route: only the scores a reader may show (v2 Ruling 16)', () => {
  it('validly committed scores show as stored — the verdict, the pair and the live score', async () => {
    const b = await committedBattle(105, 101);
    const [row] = completedGameRows([asDone(b)], {});
    expect(row.outcome).toEqual({ text: 'Won +195.0', tone: 'pos' });
    expect(liveDetail(b)).toMatch(/^Score \+195\.0 /);
  });

  it('a finite stored pair beside unavailable evidence is no verdict and no pair on a completed row', async () => {
    const [row] = completedGameRows([asDone(stale(await committedBattle(105, 101)))], {});
    expect(row.outcome).toEqual({ text: 'No result', tone: 'neutral' });
    expect(row.detail).toMatch(/no score was recorded$/);
    expect(row.detail).not.toMatch(/30|12/);
  });

  it('…and a dash, never the stale number, on a live row', async () => {
    const detail = liveDetail(stale(await committedBattle(105, 101)));
    expect(detail).toMatch(/^Score — /);
    expect(detail).not.toMatch(/30/);
  });

  it('a result-unavailable completion is No result with no pair, even beside validly committed scores', async () => {
    const [row] = completedGameRows([asDone(await committedBattle(105, 101), { completionContext: STOCK_RESULT_UNAVAILABLE })], {});
    expect(row.outcome).toEqual({ text: 'No result', tone: 'neutral' });
    expect(row.detail).not.toMatch(/195|vs/);
  });
});
