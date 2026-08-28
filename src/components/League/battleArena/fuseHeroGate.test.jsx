// @vitest-environment jsdom
//
// C3 — the preview override. The gate is the flag OR ?fuseHero=1, evaluated at
// module load; vi.resetModules gives each row a fresh evaluation. The pinned
// flag literal itself stays in featureFlags.js (leagueBattleviewFlags.test.js);
// this suite proves the override path the flip PR is scheduled to delete.

import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  window.history.replaceState(null, '', '/');
});

describe('fuseHeroGate — FUSE_HERO_ON (flag ‖ ?fuseHero=1)', () => {
  it('dark by default: flag false, no param → OFF', async () => {
    const { FUSE_HERO_ON } = await import('./fuseHeroGate');
    const { LEAGUE_FUSE_HERO_ENABLED } = await import('../../../config/featureFlags');
    expect(LEAGUE_FUSE_HERO_ENABLED).toBe(false);
    expect(FUSE_HERO_ON).toBe(false);
  });

  it('?fuseHero=1 force-enables the preview without touching the pinned flag', async () => {
    window.history.replaceState(null, '', '/?fuseHero=1');
    const { FUSE_HERO_ON } = await import('./fuseHeroGate');
    const { LEAGUE_FUSE_HERO_ENABLED } = await import('../../../config/featureFlags');
    expect(FUSE_HERO_ON).toBe(true);
    expect(LEAGUE_FUSE_HERO_ENABLED).toBe(false); // the pin is untouched
  });

  it('any other value of the param stays OFF (exact-match gate)', async () => {
    window.history.replaceState(null, '', '/?fuseHero=true');
    const { FUSE_HERO_ON } = await import('./fuseHeroGate');
    expect(FUSE_HERO_ON).toBe(false);
  });
});
