// src/components/League/battleArena/FuseHero.hostBranch.test.jsx
//
// Phase 1 — proves the host branch is WIRED and EXCLUSIVE with the fuse flag ON.
//
// Why this exists: every other suite in this directory runs with the real flag
// (false), so they only ever exercise the ClimbArena arm. A branch that is only
// ever run one way is a branch that first executes in production on flip day —
// a typo'd flag import or a throwing stub would surface there, not here. This
// file forces the ON arm in BOTH hosts.
//
// The mock spreads the REAL module and overrides one flag: the hosts' children
// (ClimbArena, StarCell, AgentPresence…) read other flags from the same module,
// and a bare factory would blank them and prove nothing.
//
// Harness mirrors ArenaDesktop.smoke.test.jsx: react-dom/server, no DOM, no
// effects. Flag-OFF behavior is covered by the existing 23 arena suites.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  LEAGUE_FUSE_HERO_ENABLED: true,
}));

const { ArenaDesktop } = await import('./ArenaDesktop');
const { ArenaMobile } = await import('./ArenaMobile');

const HOSTS = [['desktop', ArenaDesktop], ['mobile', ArenaMobile]];

describe('FuseHero host branch (flag ON) — wired, exclusive, non-destructive', () => {
  for (const [label, Host] of HOSTS) {
    it(`${label}: mounts FuseHero in place of ClimbArena`, () => {
      const html = renderToString(<Host state="live" mode="ranked" onBack={() => {}} />);
      // the fuse arm rendered…
      expect(html).toContain('data-testid="fuse-hero"');
      // …and the climb arm did NOT (bv2-aurora1 is emitted only by ClimbArena)
      expect(html).not.toContain('bv2-aurora1');
    });

    it(`${label}: swaps ONLY the top half — the docks still compose`, () => {
      const html = renderToString(<Host state="live" mode="ranked" onBack={() => {}} />);
      expect(html).toContain('Your three');
      expect(html.length).toBeGreaterThan(2000);
    });
  }
});
