// Research Modal Build A — the record selector (spec §3.1–§3.4, §4.2, §6
// "Ladder" and "Scored" rows). Pure; the measured fixture is the REAL
// corrected-battle harness, scorer and committed patch.
import { describe, it, expect } from 'vitest';
import { selectBombRecord, agentBombContext, isActivationDayAt, checkDotsOf, recordMs } from './selectBombRecord.js';
import { legacyBattle } from './__fixtures__/bombBattles.js';
import { scoredChipText } from './bombView.js';
import { measuredLadder, rungPct } from './ladder.js';
import { STOCK_TEST_NOW, correctedStockBattle, stockWriterDb } from '../../../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../../../api/_utils/stockThresholdAdmission.js';

const WED_1PM = Date.parse('2026-10-14T17:00:00.000Z');
const TUE_11AM = Date.parse('2026-10-13T15:00:00.000Z');

async function committedMeasured(quote = 101) {
  const prior = process.env.EODHD_API_KEY; process.env.EODHD_API_KEY = 'isolated-key';
  try {
    const { battle } = await correctedStockBattle({ fill: 100.75 });
    const prices = { AAPL: { current: quote, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const scores = ['agent', 'cpu'].map((side) => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
    const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
    return { ...battle, evaluations: [{ timestamp: '2026-10-14T13:45:00.000Z', evidence: { AAPL: { px: 100.6 } } }, { timestamp: '2026-10-14T14:15:00.000Z', evidence: { AAPL: { px: 100.9 } } }] };
  } finally { if (prior === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = prior; }
}

describe('who is held', () => {
  it('a name the agent does not hold → null (the modal draws a preview)', () => {
    expect(selectBombRecord(legacyBattle(), 'CVX', WED_1PM)).toBeNull(); // the CPU's
    expect(selectBombRecord(legacyBattle(), 'NVDA', WED_1PM)).toBeNull(); // nobody's
  });
  it('malformed input → null, never a throw', () => {
    expect(selectBombRecord(null, 'EOG', WED_1PM)).toBeNull();
    expect(selectBombRecord(legacyBattle(), '', WED_1PM)).toBeNull();
    expect(selectBombRecord(legacyBattle(), 'EOG', Number.NaN)).toBeNull();
  });
  it('a finished battle holds nothing live → null (BA-1: a live agent battle)', () => {
    expect(selectBombRecord(legacyBattle({ status: 'completed' }), 'EOG', WED_1PM)).toBeNull();
    expect(selectBombRecord(legacyBattle({ status: 'active' }), 'EOG', WED_1PM)).not.toBeNull();
  });
  it('a short position has no upside ladder', () => {
    const b = legacyBattle(); b.portfolio.star[0].direction = 'short';
    expect(selectBombRecord(b, 'EOG', WED_1PM)).toMatchObject({ model: 'unsupported', reason: 'short_position' });
  });
});

describe('legacy: the rung-test baseline inputs (agent-evaluate.js :1241–1244, :1301–1302)', () => {
  it('reads swapPrice, the starting price, the threshold (baseATR || 2.5), today\'s multipliers', () => {
    const b = legacyBattle(); b.portfolio.star[0].swapPrice = 155.1;
    const r = selectBombRecord(b, 'EOG', WED_1PM);
    expect(r).toMatchObject({ model: 'legacy', tier: 'star', slot: 0, positionId: 'pos-eog', threshold: 3.6, baselineInputs: { swapPrice: 155.1, startingPrice: 154.76, isActivationDay: false }, history: { maxMultiplier: 1.12, minMultiplier: -0.31 } });
    const noAtr = legacyBattle(); delete noAtr.portfolio.star[0].baseATR;
    expect(selectBombRecord(noAtr, 'EOG', WED_1PM).threshold).toBe(2.5);
  });
  it('the activation day is the first trading day when the battle lists one, else the ET date of activatedAt', () => {
    expect(isActivationDayAt(legacyBattle(), TUE_11AM)).toBe(true);
    expect(isActivationDayAt(legacyBattle(), WED_1PM)).toBe(false);
    const noList = legacyBattle({ timing: {} });
    expect(isActivationDayAt(noList, TUE_11AM)).toBe(true);
    expect(isActivationDayAt(noList, WED_1PM)).toBe(false);
    // activatedAt 23:30 ET on Oct 13 is still Oct 13 in ET (UTC Oct 14)
    expect(isActivationDayAt(legacyBattle({ timing: {}, activatedAt: '2026-10-14T03:30:00.000Z' }), TUE_11AM)).toBe(true);
    // the server's last fallback: no list, no activatedAt → today
    expect(isActivationDayAt(legacyBattle({ timing: {}, activatedAt: undefined }), WED_1PM)).toBe(true);
  });
});

describe('the scored price (spec §3.2) and lastScoredAt', () => {
  it('legacy: cronState.lastTickPrice[SYM] at lastTickTimestamp[SYM]', () => {
    expect(selectBombRecord(legacyBattle(), 'EOG', WED_1PM).scored).toEqual({ price: 160.19, atMs: Date.parse('2026-10-14T17:00:31.000Z'), source: 'lastTickPrice' });
    expect(selectBombRecord(legacyBattle(), 'EOG', WED_1PM).lastScoredAtMs).toBe(Date.parse('2026-10-14T17:00:40.000Z'));
  });
  it('legacy: no tick yet → no scored price (never evidence.px)', () => {
    const b = legacyBattle({ cronState: {} });
    expect(selectBombRecord(b, 'EOG', WED_1PM).scored).toBeNull();
  });
  it('measured: stockRewardContexts.agent.{positionId}.currentPrice at quoteEvidence.providerAsOf', async () => {
    const b = await committedMeasured(101);
    const ctx = b.scoring.stockRewardContexts.agent['position-agent'];
    const r = selectBombRecord(b, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z'));
    // BD-9 (2026-11-10): the entry instant is the fill quote's provider time, not enteredAt (the harness puts them 15 minutes apart).
    const fillQuoteAsOf = Date.parse(b.portfolio.star[0].stockThresholdReceipt.fillQuote.quoteAsOf);
    expect(fillQuoteAsOf).not.toBe(Date.parse(b.portfolio.star[0].stockThresholdReceipt.enteredAt));
    expect(r).toMatchObject({ model: 'measured', positionId: 'position-agent', entry: { price: 100.75, atMs: fillQuoteAsOf } });
    // BD-8: the scored price also carries the moment the check READ it (quoteEvidence.observedAt), which names the check.
    expect(r.scored).toEqual({ price: 101, atMs: Date.parse(ctx.quoteEvidence.providerAsOf), checkAtMs: Date.parse(ctx.quoteEvidence.observedAt), source: 'stockRewardContexts' });
    expect(r.scored.price).toBe(ctx.currentPrice);
  });
  it('measured: the price the LATEST check read — not the position\'s high (two checks: 103, then 101)', async () => {
    const prior = process.env.EODHD_API_KEY; process.env.EODHD_API_KEY = 'isolated-key';
    try {
      const { battle } = await correctedStockBattle({ fill: 100.75 });
      for (const [quote, at] of [[103, STOCK_TEST_NOW], [101, '2026-10-14T14:17:00.000Z']]) {
        const prices = { AAPL: { current: quote, timestamp: Date.parse(at) / 1000 } };
        const scores = ['agent', 'cpu'].map((side) => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, at));
        const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], at)); Object.assign(battle, h.store.get('battle'));
      }
      const ctx = battle.scoring.stockRewardContexts.agent['position-agent'];
      expect(ctx.history.high).toBe(103); // the bagger ($102.765) stays banked
      const r = selectBombRecord(battle, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z'));
      expect(r.scored).toEqual({ price: 101, atMs: Date.parse('2026-10-14T14:17:00.000Z'), checkAtMs: Date.parse(ctx.quoteEvidence.observedAt), source: 'stockRewardContexts' });
      expect(r.measured.crossedTiers).toEqual(['bagger']);
    } finally { if (prior === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = prior; }
  });
  it('measured: an unavailable committed context → no scored price', async () => {
    const b = await committedMeasured(101);
    b.scoring.stockRewardContexts.agent['position-agent'] = { status: 'unavailable', reason: 'x' };
    expect(selectBombRecord(b, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z')).scored).toBeNull();
  });
  it('the battle end for the clock', () => {
    expect(selectBombRecord(legacyBattle(), 'EOG', WED_1PM).battleExpiresAtMs).toBe(Date.parse('2026-10-15T20:00:00.000Z'));
  });
});

describe('check dots (spec §3.4): evidence[SYM].px at each timestamp, since entry, where present', () => {
  it('legacy: since activatedAt (no swap), only entries carrying a px for the symbol', () => {
    const r = selectBombRecord(legacyBattle(), 'EOG', WED_1PM);
    expect(r.checkDots).toEqual([{ atMs: Date.parse('2026-10-14T16:45:00.000Z'), px: 159.8 }, { atMs: Date.parse('2026-10-14T17:00:00.000Z'), px: 160.19 }]);
  });
  it('legacy swapped-in: since swappedInAt', () => {
    const b = legacyBattle(); b.portfolio.star[0].swappedInAt = '2026-10-14T16:50:00.000Z';
    expect(selectBombRecord(b, 'EOG', WED_1PM).checkDots.map((d) => d.px)).toEqual([160.19]);
  });
  it('measured: since the fill quote\'s time (BD-9, 2026-11-10; was enteredAt) — a check between the two instants is drawn (review C7)', async () => {
    const b = await committedMeasured();
    expect(selectBombRecord(b, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z')).checkDots).toEqual([{ atMs: Date.parse('2026-10-14T14:15:00.000Z'), px: 100.9 }]);
    // quoteAsOf 13:47 < 13:55 < enteredAt 14:02: since quoteAsOf it is drawn; since enteredAt it would not be.
    const between = { ...b, evaluations: [...b.evaluations, { timestamp: '2026-10-14T13:55:00.000Z', evidence: { AAPL: { px: 100.7 } } }] };
    expect(selectBombRecord(between, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z')).checkDots.map((d) => d.px)).toEqual([100.7, 100.9]);
  });
  it('checkDotsOf ignores non-positive prices and unreadable times', () => {
    const b = { evaluations: [{ timestamp: 'x', evidence: { A: { px: 1 } } }, { timestamp: '2026-10-14T14:15:00.000Z', evidence: { A: { px: 0 } } }, { timestamp: '2026-10-14T14:30:00.000Z', evidence: { A: { px: 2 } } }] };
    expect(checkDotsOf(b, 'A', null)).toEqual([{ atMs: Date.parse('2026-10-14T14:30:00.000Z'), px: 2 }]);
  });
  it('recordMs reads ISO strings, epoch ms and Timestamp-likes', () => {
    expect(recordMs('2026-10-14T14:30:00.000Z')).toBe(Date.parse('2026-10-14T14:30:00.000Z'));
    expect(recordMs(5)).toBe(5);
    expect(recordMs({ toMillis: () => 7 })).toBe(7);
    expect(recordMs('nope')).toBeNull();
  });
});

describe('the measured model is chosen exactly as the screen chooses it', () => {
  it('a stamped battle\'s stock → measured; an unstamped one → legacy', async () => {
    const b = await committedMeasured();
    expect(selectBombRecord(b, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z')).model).toBe('measured');
    const u = structuredClone(b); delete u.scoring.stockThresholdModel;
    expect(selectBombRecord(u, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z')).model).toBe('legacy');
  });
});

describe('an unreadable model stamp: the scorer skips the battle, so no ladder and no promised check', () => {
  it('a stamp the reader refuses → model unsupported (unsupported_stock_model)', async () => {
    const b = await committedMeasured();
    b.scoring.stockThresholdModel = { modelId: 'x' };
    expect(selectBombRecord(b, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z'))).toMatchObject({ model: 'unsupported', reason: 'unsupported_stock_model' });
  });
  it('…and a crypto name on that battle too: the scorer skips the whole battle, so no check comes for it either (refuter A, A7)', async () => {
    const b = await committedMeasured();
    b.scoring.stockThresholdModel = { modelId: 'x' };
    b.portfolio.star[0].isCrypto = true;
    expect(selectBombRecord(b, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z'))).toMatchObject({ model: 'unsupported', reason: 'unsupported_stock_model' });
  });
});

describe('agentBombContext — which row is the agent\'s (review A4, C1)', () => {
  const shared = () => { const b = legacyBattle(); b.opponent.portfolio.star = [{ symbol: 'EOG', baseATR: 2.4, positionId: 'cpu-eog' }]; return b; };
  it('the gated held view by posKey: the player\'s slot → the record; the CPU\'s slot or another slot → a preview', () => {
    expect(agentBombContext(legacyBattle(), 'EOG', WED_1PM, { battleId: 'b', posKey: 'player:star:0' })).toMatchObject({ kind: 'agent', battleId: 'b', held: true, record: { positionId: 'pos-eog' } });
    expect(agentBombContext(shared(), 'EOG', WED_1PM, { posKey: 'cpu:star:0' })).toMatchObject({ held: false, record: null });
    expect(agentBombContext(legacyBattle(), 'EOG', WED_1PM, { posKey: 'player:core:0' })).toMatchObject({ held: false, record: null });
  });
  it('the shipped mount by positionId: the agent\'s → the record; another → a preview', () => {
    expect(agentBombContext(shared(), 'EOG', WED_1PM, { positionId: 'pos-eog' }).held).toBe(true);
    expect(agentBombContext(shared(), 'EOG', WED_1PM, { positionId: 'cpu-eog' }).held).toBe(false);
  });
  it('neither id and the CPU also holds the ticker → a preview (never the agent\'s ladder on the CPU\'s row); not shared → the record', () => {
    expect(agentBombContext(shared(), 'EOG', WED_1PM, {})).toMatchObject({ held: false, record: null });
    expect(agentBombContext(legacyBattle(), 'EOG', WED_1PM, {}).held).toBe(true);
  });
  it('a name the agent does not hold → a preview', () => {
    expect(agentBombContext(legacyBattle(), 'NVDA', WED_1PM, {})).toEqual({ kind: 'agent', battleId: null, held: false, record: null });
  });
});

describe('review fixes (2026-11-11), lens C — the selector on the real harness', () => {
  it('C1 (BD-8): the check is named from the moment the check READ the quote (observedAt), not the provider time — 16 minutes apart here', async () => {
    const prior = process.env.EODHD_API_KEY; process.env.EODHD_API_KEY = 'isolated-key';
    try {
      const { battle } = await correctedStockBattle({ fill: 100.75 });
      const at = '2026-10-14T14:47:20.000Z'; // the 10:45 check reads…
      const prices = { AAPL: { current: 101, timestamp: Date.parse('2026-10-14T14:31:00.000Z') / 1000 } }; // …a quote EODHD stamps 10:31
      const scores = ['agent', 'cpu'].map((side) => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, at));
      const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], at)); Object.assign(battle, h.store.get('battle'));
      const r = selectBombRecord(battle, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z'));
      expect(r.scored.atMs).toBe(Date.parse('2026-10-14T14:31:00.000Z'));
      expect(r.scored.checkAtMs).toBe(Date.parse(at));
      expect(r.scored.checkAtMs).not.toBe(r.scored.atMs);
      expect(scoredChipText({ live: 101.2, scored: r.scored, decimals: 2, always: true, nowMs: Date.parse('2026-10-14T14:50:00.000Z') })).toBe('live $101.20 · scored $101.00 at the 10:45 check');
    } finally { if (prior === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = prior; }
  });
  it('C6 (BD-6): Details carry the committed context\'s facts unchanged', async () => {
    const b = await committedMeasured(101);
    const ctx = b.scoring.stockRewardContexts.agent['position-agent'];
    const r = selectBombRecord(b, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z'));
    expect(r.details).toEqual({
      scoringPctDecimal: ctx.scoringPctDecimal,
      targets: ctx.targets.map((t) => ({ key: t.key, label: t.label, target: t.target })),
      currentPrice: ctx.currentPrice,
      providerAsOf: ctx.quoteEvidence.providerAsOf,
      positionId: ctx.positionId,
      receiptHash: ctx.receiptHash,
      inputRef: ctx.inputRef,
      modelId: ctx.modelId,
    });
    expect(r.details.currentPrice).toBe(101);
    expect(r.details.currentPrice).not.toBe(ctx.fill);
  });
  it('BP-3: the measured record carries the committed context\'s scoringPct — the % Details prints — so a rung\'s % is the rule\'s', async () => {
    const b = await committedMeasured(101);
    const ctx = b.scoring.stockRewardContexts.agent['position-agent'];
    const r = selectBombRecord(b, 'AAPL', Date.parse('2026-10-14T15:00:00.000Z'));
    expect(r.measured.scoringPct).toBe(ctx.scoringPct);
    expect(r.measured.scoringPct).toBe(Number(r.details.scoringPctDecimal));
    const l = measuredLadder({ measured: r.measured, entryAtMs: r.entry.atMs });
    expect(l.threshold).toBe(ctx.scoringPct);
    expect(rungPct(l, l.up[0], 2)).toBe(ctx.scoringPct);
  });
});
