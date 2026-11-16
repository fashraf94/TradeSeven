// src/config/leagueHideFlag.test.js
//
// League hide (direction note BB-1; founder rulings Q1–Q6, Nov 15, 2026) — the flag's pin (BUILD_RULES §2). LEAGUE_HIDE_ENABLED
// ships TRUE since its flip PR (docs/audits/20261115_BUILD_LEAGUE_HIDE_BAGGERBOMB_PAGE.md §7), which moved this pin, dropped the
// flag's DARK_BY_DESIGN entry and held the League-card rows of CommandCenterHub.loadouts.jsdom.test.jsx at the flag-off state,
// all in the same commit; src/config/flagPinGuard.test.js
// walks this assertion against the live value, so a flip that forgets it fails there with the file and line.
//
// The flag-ON rows live in their own files, which put the flag on through a module mock and never assert the constant:
//   api/tournament/leagueHide.endpoints.test.js          (the seven entry endpoints, and what keeps answering)
//   src/components/Navigation/leagueHide.nav.jsdom.test.jsx
//   src/components/CommandCenter/BaggerBombPage.jsdom.test.jsx
//   src/leagueHide.app.source.test.js                    (App.jsx's doors, pinned as source text)

import { describe, it, expect } from 'vitest';
import { LEAGUE_HIDE_ENABLED } from './featureFlags';

describe('LEAGUE_HIDE_ENABLED — the league is hidden (the flip)', () => {
  it('is true', () => {
    expect(LEAGUE_HIDE_ENABLED).toBe(true);
  });
});
