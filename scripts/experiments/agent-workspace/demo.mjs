import { SCENARIOS } from '../../../api/_utils/setupEvaluator/__fixtures__/syntheticBars.js';
import { INPUT_SCHEMA } from './experiment.mjs';

export function demoInput() {
  const names = ['breakout_at_swing_high', 'pullback_touch_bar2_exact', 'both_patterns', 'uptrend_no_setup', 'bars_54', 'c1_pullback_null_bar0_volume'];
  return {
    schemaVersion: INPUT_SCHEMA,
    title: 'Trend Follower: both setups versus breakouts only',
    cases: names.map(id => {
      const evidence = SCENARIOS[id].build();
      return {
        id, symbol: 'SYN', asOf: evidence.asOf, observedAt: `${evidence.asOf}T21:00:00.000Z`,
        recordedAt: '2026-10-28T00:00:00.000Z', evidenceKind: 'synthetic', source: 'repository syntheticBars fixture',
        rows: evidence.bars.map(({ date, open, high, low, close, volume }) => ({ date, open, high, low, rawClose: close, volume })),
      };
    }),
  };
}
