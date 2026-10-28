// src/App.filmRoomForge.source.test.js
//
// Film Room B2.1 B1 (Build B Amendment H RH-1; Amendment J RJ-8) — the card
// form's Set opens the Forge on its Character area, where the tempo dial is,
// through App's EXISTING door (the hub's S5 onOpenForge), and closing the
// Forge returns to the Film Room. App.jsx is rendered by one suite only, at
// desktop width (BUILD_RULES §2), so the wiring is pinned by its source, as the
// repo's other App source tests do:
//   · App hands its onOpenForge to the Film Room's route, unchanged;
//   · onOpenForge names the Forge's area and shows the Forge — it never moves
//     `screen`, so the Film Room stays the screen underneath;
//   · the Forge renders INSTEAD of every screen (its branch comes first), and
//     closing it only clears showForge — so the Film Room shows again;
//   · the Film Room's back destination is recorded only while another screen
//     shows, so a Forge visit leaves it as it was;
//   · the Forge's Character area (shown while RELEASE3_CHARACTER_TAB_ENABLED is
//     on — read through the workshop's gate, never pinned here) is the one
//     that holds the tempo dial.
// What does NOT survive the round trip is stated in the build report: the Film
// Room remounts, so its day, depth and open form start fresh.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORGE_AREAS, forgeAreaOf } from './components/CommandCenter/hubChrome';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, rel), 'utf8').replace(/\r\n/g, '\n');
const APP = read('App.jsx');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1');
const CODE = stripComments(APP);
const block = (from, to) => { const a = CODE.indexOf(from); expect(a, from).toBeGreaterThan(-1); const b = CODE.indexOf(to, a); expect(b, to).toBeGreaterThan(a); return CODE.slice(a, b); };

describe('B2.1 B1 — Set opens the Forge through App\'s own door, and closing it returns to the Film Room', () => {
  it('App hands its onOpenForge to the Film Room\'s route — the one element, unchanged', () => {
    const route = block('<FilmRoomRoute', '/>');
    expect(route).toContain('onOpenForge={onOpenForge}');
    expect(CODE.match(/<FilmRoomRoute\b/g)).toHaveLength(1);
  });

  it('onOpenForge names the area and shows the Forge — it never moves the screen', () => {
    const fn = block('const onOpenForge = (request) => {', '};');
    expect(fn).toMatch(/const area = forgeAreaOf\(request\);\s*if \(area\) setForgeInitialView\(area\);\s*setShowForge\(true\);/);
    expect(fn).not.toContain('setScreen(');
  });

  it('the Forge renders instead of every screen, and closing it only clears showForge', () => {
    const screens = block('const getScreenContent = () => {', "if (screen === 'filmRoom' && currentBattle) {");
    expect(screens).toContain('if (showForge) {');
    const forge = block('if (showForge) {', '/>');
    expect(forge).toContain('onClose={() => setShowForge(false)}');
    expect(forge).toContain('initialArea={forgeInitialView}');
  });

  it('the Film Room\'s back destination is recorded only while another screen shows — a Forge visit leaves it as it was', () => {
    expect(CODE).toMatch(/if \(screen !== 'filmRoom'\) filmRoomFromRef\.current = \{ screen, battle: currentBattle \};/);
  });

  it('the request Set sends names the Character area, which holds the tempo dial', () => {
    expect(forgeAreaOf({ area: FORGE_AREAS.CHARACTER })).toBe('traits');
    // The Character area shows while RELEASE3_CHARACTER_TAB_ENABLED is on (it is, live) — read through the workshop's
    // own gate, not pinned here: a flag's pins belong to its flip commit (src/config/flagPinGuard.test.js). With it
    // off, the `03` slot is Traits and the dial is not there.
    const workshop = read('components/Forge/workshop/ForgeWorkshop.jsx');
    expect(workshop).toMatch(/const characterOn =\s*RELEASE3_CHARACTER_TAB_ENABLED \|\|/);
    expect(workshop).toMatch(/\} else if \(characterOn\) \{\s*body = \(\s*<CharacterArea/);
    expect(read('components/Forge/workshop/character/CharacterArea.jsx')).toContain('<TempoControl ');
  });
});
