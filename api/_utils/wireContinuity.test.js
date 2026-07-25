// api/_utils/wireContinuity.test.js
// Continuity block hygiene (M3/P7 §9): digests + eventTypes + dates ONLY —
// no headline substring reaches any generation prompt.

import { describe, it, expect, beforeEach } from 'vitest';
import { createFirestoreFake } from './__fixtures__/wireFirestoreFake.js';
import { buildContinuityContext } from './wireContinuity.js';

const MARKET_DATE = '2026-07-24';
const HEADLINE = 'NVDA SHOCKS WALL STREET WITH MONSTER BEAT';

let db;
beforeEach(async () => {
  db = createFirestoreFake();
  await db.collection('fantasyTimesWire').doc('2026-07-23').set({
    date: '2026-07-23',
    entries: [
      {
        storyId: 's1', reporter: 'doug', headline: HEADLINE,
        publishedAt: '2026-07-23T20:00:00Z', validatorVersion: '1.5.0', quarantined: false,
        agentFacts: {
          eventType: 'earnings_recap', tickers: ['NVDA'],
          digest: 'NVDA earnings: EPS +8.2% vs consensus.', chainId: 's1',
        },
      },
      {
        storyId: 's2', reporter: 'doug', headline: 'QUARANTINED HEADLINE',
        publishedAt: '2026-07-23T21:00:00Z', validatorVersion: '1.5.0', quarantined: true,
        agentFacts: { eventType: 'earnings_recap', tickers: [], digest: 'ZZZ earnings.', chainId: 's2' },
      },
      {
        storyId: 's3', reporter: 'kai', headline: 'KAI HEADLINE',
        publishedAt: '2026-07-23T14:00:00Z', validatorVersion: '1.5.0', quarantined: false,
        agentFacts: { eventType: 'index_move', tickers: [], digest: 'Index move: -1.4% vs prior close.', chainId: 's3' },
      },
    ],
  });
});

describe('buildContinuityContext', () => {
  it('renders the reporter\'s digests + eventTypes + dates', async () => {
    const block = await buildContinuityContext(db, { reporter: 'doug', marketDate: MARKET_DATE });
    expect(block).toContain('2026-07-23 [earnings_recap] NVDA earnings: EPS +8.2% vs consensus.');
    expect(block).toContain('YOUR RECENT COVERAGE');
    expect(block).toContain('follow-up');
  });

  it('NO headline substring reaches the block (M3/P7) and quarantined entries are excluded', async () => {
    const block = await buildContinuityContext(db, { reporter: 'doug', marketDate: MARKET_DATE });
    expect(block).not.toContain(HEADLINE);
    expect(block).not.toContain('MONSTER');
    expect(block).not.toContain('QUARANTINED HEADLINE');
    expect(block).not.toContain('ZZZ earnings.'); // quarantined digest excluded too
  });

  it('scopes to the requesting reporter only', async () => {
    const block = await buildContinuityContext(db, { reporter: 'doug', marketDate: MARKET_DATE });
    expect(block).not.toContain('Index move');
  });

  it('returns null when the reporter has no wire history', async () => {
    expect(await buildContinuityContext(db, { reporter: 'kim', marketDate: MARKET_DATE })).toBeNull();
  });

  it('degrades to null (not a throw) when the walker horizon guard fires', async () => {
    expect(await buildContinuityContext(db, { reporter: 'doug', marketDate: '2028-03-01' })).toBeNull();
  });
});
