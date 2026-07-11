// Test #4 — Auction-bar tag: at most one closing-auction bar per session (no duplicates), each
// after the last regular bar; every full-day auctioned session's auction sits exactly at 16:00 ET
// (etMin 960) in BOTH DST regimes. (A2; robust to the half-day / vendor-gap exceptions found in S2.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROBE, loadSessions } from './_helpers.js';

for (const sym of PROBE) {
  test(`auction tag: ${sym} — ≤1/session, at 16:00 ET on full days, both DST regimes`, () => {
    const sessions = loadSessions(sym);

    for (const s of sessions) assert.ok(s.auctionBarCount <= 1, `${sym} ${s.etDate}: ${s.auctionBarCount} auction bars`);

    for (const s of sessions.filter((x) => x.hasAuction)) {
      assert.ok(s.auctionAfterLastRegular, `${sym} ${s.etDate}: auction precedes last regular bar`);
      assert.ok(s.auctionClose != null, `${sym} ${s.etDate}: auction close null`);
    }

    const fullAuc = sessions.filter((s) => s.isFullDay && s.hasAuction);
    for (const s of fullAuc) assert.equal(s.auctionEtMinutes, 960, `${sym} ${s.etDate}: auction at etMin ${s.auctionEtMinutes} (expected 960)`);

    const edt = fullAuc.filter((s) => s.tzAbbrev === 'EDT').length;
    const est = fullAuc.filter((s) => s.tzAbbrev === 'EST').length;
    assert.ok(edt > 0 && est > 0, `${sym}: need auctions in both regimes (EDT ${edt}, EST ${est})`);
  });
}
