// api/_utils/intradayConfig.test.js
//
// THE CUTOFF FIELDS ARE NOT FREE-FORM — `timestamp` is identity, never a time.
//
// `VOLUME_CUTOFF_FIELD` and `HL_CUTOFF_FIELD` name an OBSERVATION key:
// `resolveCutoff(obs, field)` returns `obs[field]` (accumulator.js), and that
// number is then read as the instant `volume` / session high-low-open are
// cumulative TO — it sets `estimateCutoff`, `volumeCutoffAsOf` and the elapsed
// minutes `computeVolumePace` divides by. So only two values are permitted:
//
//   null         — cutoff unconfirmed, which is where build 1 stands
//   'priceAsOf'  — the field the Live v2 adapter maps from the vendor's
//                  `lastTradeTime` (observation.js), and the v1 crypto adapter
//                  from that row's `timestamp`
//
// 'snapshotTs' IS EXCLUDED BY EVIDENCE. It carries the Live v2 quote's
// `timestamp`, and on all 21 quotes of the founder's Live v2 responses
// (2026-09-20 — 2 symbols, then 20 with meta.count 20 and links.next null)
// that field is exactly floor(lastTradeTime / 60_000) × 60 + 14_400: the
// last-trade minute plus the Eastern offset, matching the example on EODHD's
// Live v2 documentation page. `lastTradeTime`, `bidTime`, `askTime` and
// `ethTime` agree with one another, so `timestamp` carries no independent
// information — it is an identity (a re-quote gets a new `observationId`
// while its `strikeKey` holds, §5.5) and is four hours off if read as UTC.
//
// The literal 'lastTradeTime' is trapped too: it is the VENDOR's name, not an
// Observation key, so `resolveCutoff` would return null and the whole chain
// would read "cutoff unconfirmed" while the config looked configured.
//
// Setting VOLUME_CUTOFF_FIELD is the separate calcVersion 2 PR, not this one.

import { describe, it, expect } from 'vitest';
import { VOLUME_CUTOFF_FIELD, HL_CUTOFF_FIELD, CALC_VERSION } from './intradayConfig.js';
import { OBSERVATION_FIELDS } from './intraday/observation.js';

const PERMITTED = Object.freeze([null, 'priceAsOf']);
const CUTOFFS = Object.freeze([
  ['VOLUME_CUTOFF_FIELD', VOLUME_CUTOFF_FIELD],
  ['HL_CUTOFF_FIELD', HL_CUTOFF_FIELD],
]);

describe('intradayConfig — the cutoff fields are null | priceAsOf only', () => {
  it.each(CUTOFFS)('%s is one of the two permitted values', (_name, value) => {
    expect(PERMITTED).toContain(value);
  });

  it.each(CUTOFFS)('%s is never snapshotTs — the vendor `timestamp` is identity, not an instant', (_name, value) => {
    expect(value).not.toBe('snapshotTs');
  });

  it.each(CUTOFFS)('%s is never the vendor name `lastTradeTime` — it would silently resolve to null', (_name, value) => {
    expect(value).not.toBe('lastTradeTime');
  });

  it('ANTI-VACUOUS: both excluded names are real candidates, so the permitted set is a real restriction', () => {
    // 'snapshotTs' is an Observation key — assigning it would work, silently
    // and wrongly. That is exactly why it needs excluding by name.
    expect(OBSERVATION_FIELDS).toContain('snapshotTs');
    // 'priceAsOf' is the permitted one, and is likewise a real key.
    expect(OBSERVATION_FIELDS).toContain('priceAsOf');
    // 'lastTradeTime' is NOT — the trap above is not hypothetical.
    expect(OBSERVATION_FIELDS).not.toContain('lastTradeTime');
  });

  it('build 1 (calcVersion 1) ships both null — confirming a cutoff bumps calcVersion', () => {
    expect(CALC_VERSION).toBe(1);
    expect(VOLUME_CUTOFF_FIELD).toBeNull();
    expect(HL_CUTOFF_FIELD).toBeNull();
  });
});
