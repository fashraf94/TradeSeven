// api/_utils/wireKeyLevel.n5.test.js
// Phase 2 N5 — the keyLevel LABEL (Spec V1.2 N5, D-P2-14 re-target).
// Matrix row P2-18 (kept as a REGRESSION LOCK per F-M10: validation runs
// in-request on all seams, so the stated trigger cannot fire — this suite
// pins that it stays true): defer the Wire transaction → the chart still
// renders the level, because the label is stamped from VALIDATED
// in-request facts at the story write, never at settlement.
//
// Locked properties:
//   • label-only (no geometry): a string + the typed level, price_chart only;
//   • validated facts, never raw: a salvage-dropped keyLevel labels nothing;
//   • fallback = current behavior BY IDENTITY when absent;
//   • flag-off: publishStoryWithWire returns before validation — the story
//     doc is byte-identical with keyLevel facts present in the request.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFirestoreFake } from './__fixtures__/wireFirestoreFake.js';
import { applyKeyLevelLabel } from './fantasyTimesVisuals.js';

const flagState = { metricsEnabled: false, writesEnabled: true, continuityEnabled: false, newslineEnabled: false, editorialEnabled: false };
vi.mock('./wireFlags.js', () => ({
  getWireFlags: () => ({ ...flagState }),
}));

const { publishStoryWithWire } = await import('./wireWriteThrough.js');

const NOW = new Date('2026-07-30T18:00:00Z');
const MARKET_DATE = '2026-07-30';

const KEY_LEVEL = { price: 148.5, type: 'prior_high' };

const moverFacts = (over = {}) => ({
  eventType: 'market_mover', tickers: ['NVDA'], direction: 'up',
  magnitude: { value: 3.1, unit: 'pct', basis: 'price_vs_prior_close' },
  keyLevel: KEY_LEVEL,
  ...over,
});

const moverStoryDoc = () => ({
  reporter: 'alex', type: 'market_mover', headline: 'NVDA breaks out',
  body: 'body', tickers: ['NVDA'], primaryTicker: 'NVDA',
  sentiment: 'bullish', recommended_action: 'WATCHLIST',
  visualType: 'price_chart',
  visualConfig: {
    ticker: 'NVDA', sentiment: 'bullish', previousClose: 145.9,
    currentPrice: 150.5, percentChange: 3.1, timeframe: 'intraday',
  },
  publishedAt: NOW, status: 'published',
});

const publish = (db, { facts = moverFacts(), storyDoc = moverStoryDoc(), ...over } = {}) =>
  publishStoryWithWire(db, {
    storyDoc, rawAgentFacts: facts, stopReason: 'tool_use',
    reporter: 'alex', seam: 'alex_mover', primaryTicker: 'NVDA',
    triggerRef: 'NVDA:2026-07-30', marketDate: MARKET_DATE, now: NOW,
    generationConfig: { generationVersion: 8, continuityEnabled: false },
    ...over,
  });

let db;
beforeEach(() => {
  db = createFirestoreFake();
  flagState.writesEnabled = true;
});

const storyOf = async (storyRef) => (await storyRef.get()).data();

// ── The pure rule ──────────────────────────────────────────────────────────
describe('applyKeyLevelLabel — the rendering rule', () => {
  const config = { ticker: 'NVDA', percentChange: 3.1 };

  it('price_chart + validated keyLevel → badge string + typed level', () => {
    const out = applyKeyLevelLabel('price_chart', config, KEY_LEVEL);
    expect(out.keyLevelLabel).toBe('Key level: 148.50 — prior high');
    expect(out.keyLevel).toEqual({ price: 148.5, type: 'prior_high' });
    expect(out.ticker).toBe('NVDA'); // existing config carried
  });

  it.each([
    ['prior_low', 'prior low'], ['resistance', 'resistance'], ['support', 'support'],
    ['sma50', '50-day SMA'], ['sma200', '200-day SMA'], ['open', 'session open'],
    ['prior_close', 'prior close'], ['vwap', 'VWAP'],
  ])('labels the %s vocabulary as "%s"', (type, label) => {
    const out = applyKeyLevelLabel('price_chart', config, { price: 10, type });
    expect(out.keyLevelLabel).toBe(`Key level: 10.00 — ${label}`);
  });

  it('no keyLevel / bad shape / non-price_chart → the SAME config object (identity no-op)', () => {
    expect(applyKeyLevelLabel('price_chart', config, null)).toBe(config);
    expect(applyKeyLevelLabel('price_chart', config, { price: NaN, type: 'vwap' })).toBe(config);
    expect(applyKeyLevelLabel('market_bar', config, KEY_LEVEL)).toBe(config);
    expect(applyKeyLevelLabel('eps_gauge', config, KEY_LEVEL)).toBe(config);
  });

  it('never mutates the input config', () => {
    const frozen = Object.freeze({ ticker: 'NVDA' });
    const out = applyKeyLevelLabel('price_chart', frozen, KEY_LEVEL);
    expect(out).not.toBe(frozen);
    expect(frozen.keyLevelLabel).toBeUndefined();
  });
});

// ── P2-18: never dependent on Wire settlement ─────────────────────────────
describe('P2-18 — the label rides the story write, not the settlement', () => {
  it('DEFERRED Wire transaction → the story doc already carries the badge', async () => {
    const { storyRef } = await publish(db, { deferTransaction: true });
    const story = await storyOf(storyRef);
    expect(story.visualConfig.keyLevelLabel).toBe('Key level: 148.50 — prior high');
    expect(story.visualConfig.keyLevel).toEqual({ price: 148.5, type: 'prior_high' });
    expect(story.wirePending).toBe(true); // settlement genuinely never ran
    // Geometry stayed label-only: no positional fields appeared.
    expect(Object.keys(story.visualConfig).sort()).toEqual(
      ['currentPrice', 'keyLevel', 'keyLevelLabel', 'percentChange', 'previousClose', 'sentiment', 'ticker', 'timeframe'],
    );
  });

  it('inline path carries the identical badge (settlement adds nothing)', async () => {
    const { storyRef } = await publish(db);
    expect((await storyOf(storyRef)).visualConfig.keyLevelLabel).toBe('Key level: 148.50 — prior high');
  });
});

// ── Validated-facts discipline + fallbacks ─────────────────────────────────
describe('validated facts only; fallback = current behavior', () => {
  it('a salvage-DROPPED keyLevel (invalid shape) labels nothing — raw facts never reach the badge', async () => {
    const { storyRef, wire } = await publish(db, {
      facts: moverFacts({ keyLevel: { price: 'not-a-number', type: 'prior_high' } }),
      deferTransaction: true,
    });
    expect(wire.outcome).toBe('salvaged');
    const story = await storyOf(storyRef);
    expect(story.visualConfig.keyLevelLabel).toBeUndefined();
    expect(story.visualConfig.keyLevel).toBeUndefined();
  });

  it('a REJECT-class payload (unknown key) publishes with the visual untouched', async () => {
    const { storyRef, wire } = await publish(db, {
      facts: { ...moverFacts(), directive_field_nope: true },
      deferTransaction: true,
    });
    expect(wire.outcome).toBe('rejected');
    const story = await storyOf(storyRef);
    expect(story.visualConfig.keyLevelLabel).toBeUndefined();
  });

  it('no keyLevel in facts → visualConfig exactly as the seam built it', async () => {
    const { storyRef } = await publish(db, { facts: moverFacts({ keyLevel: null }), deferTransaction: true });
    const story = await storyOf(storyRef);
    expect(story.visualConfig).toEqual(moverStoryDoc().visualConfig);
  });

  it('FLAG-OFF: keyLevel facts present in the request → story doc byte-identical to the seam build (no validation, no badge)', async () => {
    flagState.writesEnabled = false;
    const { storyRef, wire } = await publish(db);
    expect(wire).toBeNull();
    const story = await storyOf(storyRef);
    // Field-wise identity through the store's own serialization (Dates
    // normalize to ISO at the persistence boundary on BOTH sides).
    expect(JSON.parse(JSON.stringify(story))).toEqual(JSON.parse(JSON.stringify(moverStoryDoc())));
  });
});
