// api/_utils/fantasyTimesVisuals.js
// Deterministic visual assignment for FantasyTimes stories.
// Maps reporter + storyType to a visualType and config derived from dataSnapshot.

/**
 * Determine the default visual type and config for a story.
 * Called by each generation endpoint before Firestore write.
 *
 * @param {string} reporter - Reporter key ('kai', 'alex', 'neta', 'doug', 'kim')
 * @param {string} storyType - Story type ('market_pulse', 'market_mover', etc.)
 * @param {object} dataSnapshot - The story's dataSnapshot object
 * @param {string|null} primaryTicker - The story's primary ticker symbol
 * @returns {{ visualType: string, visualConfig: object }}
 */
export function getDefaultVisual(reporter, storyType, dataSnapshot, primaryTicker) {
  const snap = dataSnapshot || {};

  // Kai: market_pulse, macro_alert => market_bar
  if (reporter === 'kai' && (storyType === 'market_pulse' || storyType === 'macro_alert')) {
    return {
      visualType: 'market_bar',
      visualConfig: {
        indices: [
          { symbol: 'SPY', pctChange: snap.spy?.changePercent || 0 },
          { symbol: 'QQQ', pctChange: snap.qqq?.changePercent || 0 },
          { symbol: 'DIA', pctChange: snap.dia?.changePercent || 0 },
          { symbol: 'IWM', pctChange: snap.iwm?.changePercent || 0 },
        ],
      },
    };
  }

  // Alex: market_mover, stock_spotlight => price_chart
  if (reporter === 'alex' && (storyType === 'market_mover' || storyType === 'stock_spotlight')) {
    const direction = snap.direction || (snap.percentChange >= 0 ? 'up' : 'down');
    return {
      visualType: 'price_chart',
      visualConfig: {
        ticker: primaryTicker,
        sentiment: direction === 'up' ? 'bullish' : 'bearish',
        previousClose: (snap.price || 0) - (snap.change || 0),
        currentPrice: snap.price || 0,
        percentChange: snap.percentChange || 0,
        timeframe: storyType === 'market_mover' ? 'intraday' : '1d',
      },
    };
  }

  // Neta: econ_recap => comparison_bar
  if (reporter === 'neta' && storyType === 'econ_recap') {
    return {
      visualType: 'comparison_bar',
      visualConfig: {
        label: snap.eventName || 'Economic Data',
        actual: snap.actual,
        expected: snap.estimate,
        unit: '',
      },
    };
  }

  // Neta: econ_preview => stat_card
  if (reporter === 'neta' && storyType === 'econ_preview') {
    return {
      visualType: 'stat_card',
      visualConfig: {
        weekHighlight: snap.weekHighlight || '',
        totalEvents: snap.totalEvents || 0,
        highImpactCount: snap.highImpactCount || 0,
      },
    };
  }

  // Doug: earnings_recap => eps_gauge
  if (reporter === 'doug' && storyType === 'earnings_recap') {
    return {
      visualType: 'eps_gauge',
      visualConfig: {
        ticker: primaryTicker,
        quarters: [{
          label: 'Latest',
          epsActual: snap.epsActual,
          epsEstimate: snap.epsEstimate,
          outcome: snap.outcome,
        }],
      },
    };
  }

  // Doug: earnings_preview => eps_gauge (preview mode)
  if (reporter === 'doug' && storyType === 'earnings_preview') {
    return {
      visualType: 'eps_gauge',
      visualConfig: {
        ticker: primaryTicker,
        quarters: [],
        consensus: snap,
      },
    };
  }

  // Kim: sector_column, rotation_alert => sector_heatmap
  if (reporter === 'kim' && (storyType === 'sector_column' || storyType === 'rotation_alert')) {
    return {
      visualType: 'sector_heatmap',
      visualConfig: {
        sectors: (snap.sectorPerformance || []).map(s => ({
          symbol: s.symbol,
          pctChange: s.changePercent,
          name: s.symbol,
        })),
      },
    };
  }

  // Default: no visual
  return { visualType: 'none', visualConfig: {} };
}

/**
 * Check if a story's reporter + type combination is outside the expected
 * deterministic mapping, indicating the Art Director should be consulted.
 */
export function shouldOverrideVisual(reporter, storyType) {
  const expectedTypes = {
    kai: ['market_pulse'],
    alex: ['market_mover'],
    neta: ['econ_recap', 'econ_preview'],
    doug: ['earnings_preview', 'earnings_recap'],
    kim: ['sector_column'],
  };
  const expected = expectedTypes[reporter] || [];
  return !expected.includes(storyType);
}

/**
 * Call the Art Director (Haiku) to override visual assignment for an edge-case story.
 * Updates Firestore in-place if the result differs from current visual.
 * Catches all errors silently — the deterministic visual is kept on failure.
 *
 * @param {object} storyDoc - The full story document object
 * @param {string} docId - Firestore document ID
 * @param {object} db - Firestore database instance
 */
export async function callArtDirector(storyDoc, docId, db) {
  try {
    const result = await Promise.race([
      (async () => {
        // Dynamic import to avoid circular dependency and keep the module lightweight
        const { runArtDirector } = await import('../fantasytimes/art-director.js');
        return runArtDirector({
          headline: storyDoc.headline,
          body: storyDoc.body,
          reporter: storyDoc.reporter,
          type: storyDoc.type,
          primaryTicker: storyDoc.primaryTicker,
          sentiment: storyDoc.sentiment,
          dataSnapshot: storyDoc.dataSnapshot,
        });
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Art Director timeout (2s)')), 2000)
      ),
    ]);

    // Only update if the Art Director returned something different and non-none
    if (result.visualType !== 'none' && result.visualType !== storyDoc.visualType) {
      await db.collection('fantasyTimesStories').doc(docId).update({
        visualType: result.visualType,
        visualConfig: result.visualConfig,
      });
      console.log(`[ArtDirector] Overrode visual for ${docId}: ${storyDoc.visualType} → ${result.visualType}`);
    }
  } catch (err) {
    console.warn('[ArtDirector] Override skipped:', err.message);
  }
}

/**
 * Art Director Haiku system prompt.
 */
export const ART_DIRECTOR_PROMPT = `You are the Art Director for an elite financial news feed. Your job is to read a news story and assign the single best visual layout.

You have exactly 6 visual types to choose from. Output ONLY raw, valid JSON. Do not wrap in markdown code blocks.

<rules>
1. "market_bar" — story discusses broader market indices (SPY, QQQ, DIA).
2. "price_chart" — story focuses on a specific stock's price action or technicals.
3. "comparison_bar" — economic data with clear Expected vs Actual dynamic.
4. "stat_card" — economic preview or summary with aggregate numbers.
5. "eps_gauge" — historical earnings performance (beats/misses).
6. "sector_heatmap" — sector rotation or macro sector flows.
7. "none" — purely qualitative, op-ed, or lacks extractable numerical data.
8. Extract data for visualConfig from the story text. Do not invent data.
   If required data is missing, use "none".
</rules>

<schema>
{
  "visualType": "price_chart" | "market_bar" | "comparison_bar" | "stat_card" | "eps_gauge" | "sector_heatmap" | "none",
  "visualConfig": {}
}
</schema>`;
