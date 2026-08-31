// @vitest-environment jsdom
//
// The gate after the flip: FUSE_HERO_ON is the FLAG, and nothing else.
//
// These rows used to prove the `?fuseHero=1` preview override worked. The
// override was deleted in the flip commit, so they now prove it is GONE — that
// no query param can reach the gate in either direction. A retired override
// that still half-exists is the ?leagueLiveOrb=1 failure mode; this suite is
// what makes its absence testable rather than merely intended.
//
// Evaluated at module load, so vi.resetModules gives each row a fresh read.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// Under jsdom `import.meta.url` is not a file: URL, so source reads resolve from
// the repo root (vitest's cwd) instead of the module.
const DIR = 'src/components/League/battleArena/';
const read = (f) => readFileSync(DIR + f, 'utf8');

beforeEach(() => {
  vi.resetModules();
  window.history.replaceState(null, '', '/');
});

describe('fuseHeroGate — FUSE_HERO_ON is the flag', () => {
  it('live by default: the flag is true, so the gate is on', async () => {
    const { FUSE_HERO_ON } = await import('./fuseHeroGate');
    const { LEAGUE_FUSE_HERO_ENABLED } = await import('../../../config/featureFlags');
    expect(LEAGUE_FUSE_HERO_ENABLED).toBe(true);
    expect(FUSE_HERO_ON).toBe(true);
  });

  it('the gate tracks the flag EXACTLY — no param can force it either way', async () => {
    for (const qs of ['?fuseHero=1', '?fuseHero=0', '?fuseHero=false', '?heroRows=1']) {
      vi.resetModules();
      window.history.replaceState(null, '', `/${qs}`);
      const { FUSE_HERO_ON } = await import('./fuseHeroGate');
      const { LEAGUE_FUSE_HERO_ENABLED } = await import('../../../config/featureFlags');
      expect(FUSE_HERO_ON, qs).toBe(LEAGUE_FUSE_HERO_ENABLED);
    }
  });

  it('the override is DELETED, not disabled — no dangling read survives it', async () => {
    // The ?leagueLiveOrb=1 lesson, asserted rather than trusted: the retired
    // override left a URLSearchParams read wired to nothing, and it has sat in
    // featureFlags.js ever since because nobody could tell if it was load-bearing.
    const src = read('fuseHeroGate.js');
    const code = src.replace(/^\s*\/\/.*$/gm, '');   // prose may NAME the retired param
    expect(code).not.toMatch(/URLSearchParams|location\.search|fuseHero=|heroRows/);
  });

  it('the flag is reachable ONLY through this seam, so rollback is one literal', async () => {
    const hosts = ['ArenaDesktop.jsx', 'ArenaMobile.jsx', 'useArenaModel.js'];
    for (const h of hosts) {
      const src = read(h);
      expect(src, h).toMatch(/FUSE_HERO_ON/);
      expect(src, h).not.toMatch(/LEAGUE_FUSE_HERO_ENABLED/);
    }
  });
});
