// src/screens/filmRoomV2/filmRoomBack.test.js
//
// "Back goes back" (the follow-up pass before 'on'): where the Film Room's back
// control returns, by the screen the Film Room was opened from — and App's
// wiring of it. No test mounts src/App.jsx (it is the whole app), so its part
// is pinned here by its source: the screen recorded on every OTHER screen, the
// route given the origin and a return to it, and the legacy screen's back
// left exactly as it was.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { filmRoomBackOf, FILM_ROOM_ORIGINS } from './filmRoomBack';
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';

describe('filmRoomBackOf — the surface the Film Room was opened from', () => {
  it('the in-battle banner (the battle view), Battle History, the dashboard\'s Review station: back to each, labelled by it', () => {
    expect(filmRoomBackOf('battle')).toEqual({ origin: 'battle', screen: 'battle' });
    expect(filmRoomBackOf('battleHistory')).toEqual({ origin: 'battleHistory', screen: 'battleHistory' });
    expect(filmRoomBackOf('dashboard')).toEqual({ origin: 'dashboard', screen: 'dashboard' });
    expect([...FILM_ROOM_ORIGINS]).toEqual(['battle', 'battleHistory', 'dashboard']);
  });

  it('an unknown origin returns to the dashboard and says "Dashboard"', () => {
    for (const from of [null, undefined, 'home', 'filmRoom', 'previousBattles', '', 'toString', 'constructor']) {
      expect(filmRoomBackOf(from), String(from)).toEqual({ origin: 'unknown', screen: 'dashboard' });
    }
  });

  it('every origin has its label, and each label names its destination', () => {
    expect(COPY.backTo).toEqual({ battle: 'Battle', battleHistory: 'Battle History', dashboard: 'Dashboard', unknown: 'Dashboard' });
    for (const o of [...FILM_ROOM_ORIGINS, 'unknown']) expect(typeof COPY.backTo[o], o).toBe('string');
  });
});

describe('App wires it (src/App.jsx, by its source)', () => {
  const app = readFileSync(path.join(process.cwd(), 'src', 'App.jsx'), 'utf8').replace(/\r\n/g, '\n');
  const route = app.slice(app.indexOf("if (screen === 'filmRoom' && currentBattle) {"), app.indexOf('</ErrorBoundary>', app.indexOf("if (screen === 'filmRoom' && currentBattle) {")));

  it('the screen the Film Room is opened from is recorded on every OTHER screen, with the battle it showed', () => {
    expect(app).toContain("const filmRoomFromRef = useRef({ screen: null, battle: null });");
    expect(app).toMatch(/useEffect\(\(\) => \{\n\s+if \(screen !== 'filmRoom'\) filmRoomFromRef\.current = \{ screen, battle: currentBattle \};\n\s+\}, \[screen, currentBattle\]\);/);
    // a hook, so before App's first early return (rules of hooks)
    expect(app.indexOf('const filmRoomFromRef = useRef(')).toBeLessThan(app.indexOf('if (showForge) {'));
  });

  it('the route gets the origin and a return to it; the legacy screen\'s back is App\'s own, unchanged', () => {
    expect(route).toContain('const filmRoomBack = filmRoomBackOf(filmRoomFrom.screen);');
    expect(route).toContain("onBack={() => setScreen('dashboard')}");
    expect(route).toContain('origin={filmRoomBack.origin}');
    expect(route).toMatch(/onReturn=\{\(\) => \{\n\s+if \(filmRoomBack\.screen === 'battle' && filmRoomFrom\.battle\) setCurrentBattle\(filmRoomFrom\.battle\);\n\s+setScreen\(filmRoomBack\.screen\);\n\s+\}\}/);
  });

  it('the three entries still open the route from the screens the mapping names', () => {
    // the in-battle banner (BattleViewScreen → AgentBattleScreen) and Battle History, by their App handlers
    const opens = [...app.matchAll(/onOpenFilmRoom=\{\(b\) => \{ setCurrentBattle\(b\); setScreen\('filmRoom'\); \}\}/g)].map((mt) => mt.index);
    expect(opens).toHaveLength(2);
    // each handler sits inside the branch of the screen it opens from — the nearest screen branch before it
    expect(app.slice(app.lastIndexOf("if (screen === '", opens[0]), opens[0])).toMatch(/^if \(screen === 'battle' && currentBattle\) \{/);
    expect(app.slice(app.lastIndexOf("if (screen === '", opens[1]), opens[1])).toMatch(/^if \(screen === 'battleHistory'\) \{/);
    // the Review station: the dashboard's own setScreen('filmRoom') (CommandDashboard / CommandDashboardDesktop)
    for (const f of ['CommandDashboard.jsx', 'CommandDashboardDesktop.jsx']) {
      const src = readFileSync(path.join(process.cwd(), 'src', 'components', 'Dashboard', f), 'utf8');
      expect(src, f).toContain("const openFilmRoom = (battle) => { setCurrentBattle?.(battle); setScreen?.('filmRoom'); };");
      expect(src, f).toMatch(/<ReviewStation [^>]*onReview=\{openFilmRoom\}/);
    }
  });
});
