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
//   null         — cutoff unconfirmed, which is where build 1 stood
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
// EODHD ANSWERED on 2026-09-21 (contract §15 items 1 and 2): Live v2 `volume`
// is consolidated regular-session volume accumulated as the session runs, and
// `high`/`low` are regular-session only — so while the session is running both
// are cumulative to the LAST TRADE, which the Observation carries as
// `priceAsOf`. Both fields are now `'priceAsOf'`, and the pin below moved in
// the same commit (BUILD_RULES §2). The answers hold only up to the close:
// after 16:00 ET `volume`, `high` and `low` freeze while `lastTradeTime` keeps
// running on extended-hours prints, which is why §5.5 classifies an
// observation with `priceAsOf ≥ sessionCloseMs` as `post_close` and updates no
// session aggregate from it (accumulator.js). A cutoff field is only ever as
// good as the rule that stops it being read past the close.

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

  it('the vendor answered: both fields are `priceAsOf` — the last-trade clock, not the snapshot clock', () => {
    expect(VOLUME_CUTOFF_FIELD).toBe('priceAsOf');
    expect(HL_CUTOFF_FIELD).toBe('priceAsOf');
    // Confirming a cutoff bumps calcVersion (§15) — the bump is pinned in
    // its own commit, and this row only asserts a cutoff is now configured.
    expect(CALC_VERSION).toBeGreaterThanOrEqual(1);
  });
});
