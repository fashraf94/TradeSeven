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
// What survives the round trip is stated in the build report: the Film Room
// remounts, so its depth and open form start fresh, and so does its day — the
// screen's default day — except when another battle's recurrence opened it
// (B2.1 B2): App still holds that day and moment, so the screen opens on them
// again.

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

  it('Amendment K RK-4: the Forge door itself touches no open — by the time Set\'s link is tapped the Film Room has used it and App has cleared it (the screen\'s own row: FilmRoomCards.jsdom, RK-4)', () => {
    expect(block('const onOpenForge = (request) => {', '};')).not.toContain('setFilmRoomOpenAt');
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

// Film Room B2.1 B2 (Build B Amendment H RH-2; Amendment J RJ-10) — a card's
// recurrence in another battle opens that battle's Film Room day at its moment
// through P1c's one door (OPEN_BATTLE_REVIEW_EVENT, whose listener P1c's own
// guard pins: src/components/Dashboard/deployShells.p1c.guard.test.js), with
// the event's optional `detail.at`:
//   · the listener keeps P1c's statements and adds one: the day and moment,
//     for the battle it opens, or null when the event names none;
//   · App hands them to the Film Room's route, which checks them (v2 alone);
//   · they apply once (Amendment K RK-4): v2 says it has used them and App
//     clears them, so a later remount — the return from the Forge — opens the
//     default view; and they are cleared once the Film Room is left, so no
//     later way in reuses them;
//   · back keeps its destination: the listener never touches filmRoomFromRef,
//     which is recorded only while another screen shows — opening another
//     battle from the Film Room leaves it where the player first came from,
//     and back returns there (with that screen's own battle), not to the
//     previous battle.
describe('B2.1 B2 — another battle\'s recurrence opens through P1c\'s door, and back keeps its destination (RJ-10)', () => {
  const listener = () => block('const onOpenBattleReview = (event) => {', '};');

  it('the listener keeps P1c\'s statements, then sets the day and moment for the battle it opens — null when the event names none', () => {
    expect(listener()).toMatch(/setCurrentBattle\(battle\);\s*setShowForge\(false\);\s*setScreen\('filmRoom'\);\s*setFilmRoomOpenAt\(event\.detail\.at \? \{ \.\.\.event\.detail\.at, battleId: battle\.id \} : null\);\s*$/);
    expect(CODE.match(/setFilmRoomOpenAt\(/g)).toHaveLength(3);   // the listener, the clear once used (RK-4) and the clear below — nothing else sets it
  });

  it('the route gets them — the one element — with the clear the Film Room calls once it has used them (Amendment K RK-4)', () => {
    expect(block('<FilmRoomRoute', '/>')).toContain('openAt={filmRoomOpenAt}');
    expect(block('<FilmRoomRoute', '/>')).toMatch(/onOpenAtUsed=\{\(\) => setFilmRoomOpenAt\(null\)\}/);
  });

  it('they are cleared once the Film Room is left', () => {
    expect(CODE).toMatch(/useEffect\(\(\) => \{\s*if \(screen !== 'filmRoom'\) setFilmRoomOpenAt\(null\);\s*\}, \[screen\]\);/);
  });

  it('back keeps its destination: the listener never records where the Film Room was opened from, and back returns to the recorded screen with its own battle', () => {
    expect(listener()).not.toContain('filmRoomFromRef');
    expect(CODE.match(/filmRoomFromRef\.current = /g)).toHaveLength(1);
    expect(CODE).toMatch(/if \(screen !== 'filmRoom'\) filmRoomFromRef\.current = \{ screen, battle: currentBattle \};/);
    const route = block("if (screen === 'filmRoom' && currentBattle) {", '/>');
    expect(route).toMatch(/const filmRoomFrom = filmRoomFromRef\.current;\s*const filmRoomBack = filmRoomBackOf\(filmRoomFrom\.screen\);/);
    expect(route).toMatch(/onReturn=\{\(\) => \{\s*if \(filmRoomBack\.screen === 'battle' && filmRoomFrom\.battle\) setCurrentBattle\(filmRoomFrom\.battle\);\s*setScreen\(filmRoomBack\.screen\);\s*\}\}/);
  });
});
