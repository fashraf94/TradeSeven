// src/leagueHide.app.source.test.js
//
// League hide (direction note BB-1; founder rulings Q1–Q6, Nov 15, 2026) — what App.jsx and the rest of the tree say about
// the flag, pinned as source text (comments stripped, whitespace collapsed; App.jsx is imported by few suites, and its
// behaviour is driven in src/App.leagueHide.jsdom.test.jsx). Three kinds of row:
//
//   SCOPE      exactly which files read LEAGUE_HIDE_ENABLED — the client doors and the entry endpoints, and NO job, cron,
//              rule, orchestrator or scoring file (ruling Q1: "read by the client doors and the entry endpoints only. Jobs
//              untouched"). A new reader of the flag must be named here, in the commit that adds it;
//   FLAG-OFF   each door's flag-off arm is today's text (a literal ternary or a bare early return that folds away), so with
//              the flag at its shipped value nothing changes;
//   DOORS      the "back" button after a training battle still sets the 'league' screen id (so it lands on the page), the old
//              League route is still behind TOURNAMENT_TAB_ENABLED and after the page's route, and the stale comment that
//              called the nav items the screen's only setters is gone.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`\\])\/\/[^\n]*$/gm, '$1');
const squash = (s) => s.replace(/\s+/g, ' ');
const code = (rel) => squash(strip(read(rel)));

function walk(dir, out = []) {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    const stat = statSync(path.join(ROOT, rel));
    if (stat.isDirectory()) walk(rel, out);
    else if (/\.(js|jsx|mjs|cjs)$/.test(name) && !/\.test\.|\.spec\./.test(name) && !/__(fixtures|mocks)__/.test(rel)) out.push(rel);
  }
  return out;
}

/** Every non-test source file under the tree that names the flag, comments stripped. */
const readersOf = (dirs) => dirs.flatMap((d) => walk(d)).filter((rel) => /\bLEAGUE_HIDE_ENABLED\b/.test(strip(read(rel)))).sort();

describe('league hide — SCOPE: who reads the flag', () => {
  it('the client doors and the one flag module, and nothing else in src/', () => {
    expect(readersOf(['src'])).toEqual([
      'src/App.jsx',
      'src/components/CommandCenter/LoadoutCards.jsx',
      'src/components/CommandCenter/PerGameLoadoutScope.jsx',
      'src/components/Navigation/BottomNav.jsx',
      'src/components/Navigation/DesktopSidebar.jsx',
      'src/config/featureFlags.js',
    ]);
  });

  it('the entry endpoints reach it through ONE module (api/_utils/leagueHidden.js), and nothing else in api/ reads it', () => {
    expect(readersOf(['api'])).toEqual(['api/_utils/leagueHidden.js']);
    expect(readersOf(['api']).filter((rel) => /\/cron\//.test(rel))).toEqual([]);
  });

  it('that module is called by exactly the two transport wrappers, and the wrappers\' callers are the seven entry doors', () => {
    const callers = walk('api').filter((rel) => /refuseWhenLeagueHidden/.test(strip(read(rel)))).sort();
    expect(callers).toEqual(['api/_utils/leagueHidden.js', 'api/_utils/liveDraftEndpoint.js', 'api/_utils/lobbyEndpoint.js']);
    // The slot wrapper asks only for a route that names itself an entry door; slot-claim is the one that does.
    const slotRoutes = walk('api/tournament').filter((rel) => /leagueEntry/.test(strip(read(rel)))).sort();
    expect(slotRoutes).toEqual(['api/tournament/slot-claim.js']);
    expect(code('api/_utils/liveDraftEndpoint.js')).toContain('if (leagueEntry === true && refuseWhenLeagueHidden(res)) return;');
    expect(code('api/_utils/lobbyEndpoint.js')).toContain('if (refuseWhenLeagueHidden(res)) return;');
    // Every lobby-* route goes through the lobby wrapper (so all six refuse).
    const lobby = walk('api/tournament').filter((rel) => /\/lobby-[a-z-]+\.js$/.test(rel)).sort();
    expect(lobby).toHaveLength(6);
    for (const rel of lobby) expect(code(rel), rel).toContain('runLobbyEndpoint(');
  });

  it('no job, rule or scoring file names it: the orchestrator, the crons, the banking and advancement, the rules', () => {
    for (const rel of ['api/_utils/tournamentOrchestrator.js', 'api/_utils/tournamentBanking.js', 'api/_utils/tournamentAdvancement.js', 'api/_utils/liveDraftLifecycle.js', 'api/_utils/trainingLifecycle.js', 'api/cron/live-draft-fire.js', 'api/cron/tournament-orchestrator.js', 'api/cron/snake-draft-daily-scores.js', 'api/cron/agent-evaluate.js', 'firestore.rules', 'vercel.json']) {
      expect(read(rel), rel).not.toMatch(/LEAGUE_HIDE|leagueHidden|league_hidden/);
    }
  });
});

describe('league hide — FLAG-OFF: each door\'s off arm is today\'s text', () => {
  const app = code('src/App.jsx');

  it('App.jsx reads the flag in exactly seven places (the import, three address effects, the poll gate, the route, the banner): a new one — a filter on the live list, say — must be named here', () => {
    expect((app.match(/\bLEAGUE_HIDE_ENABLED\b/g) || []).length).toBe(7);
  });

  it('the three address-parameter effects start with the early return, before they read the address', () => {
    for (const param of ['tournamentDev', 'trainingDraft', 'trainingBattle']) {
      const at = app.indexOf(`get('${param}')`);
      expect(at, param).toBeGreaterThan(-1);
      const effectStart = app.lastIndexOf('useEffect(() => {', at);
      expect(app.slice(effectStart, at), param).toMatch(/^useEffect\(\(\) => \{ if \(LEAGUE_HIDE_ENABLED\) return; (const \w+ = |if \()new URLSearchParams/);
    }
  });

  it('the active poll\'s gate is a literal ternary whose else arm is today\'s line verbatim', () => {
    expect(app).toContain("if (LEAGUE_HIDE_ENABLED ? (screen !== 'dashboard' && screen !== 'league') || !isPageVisible : screen !== 'dashboard' || !isPageVisible) return;");
    // The effect's deps come right after the poll body, not from the unrelated effect elsewhere in App.jsx with the same deps.
    const gate = app.indexOf("if (LEAGUE_HIDE_ENABLED ? (screen !== 'dashboard'");
    expect(app.slice(gate, app.indexOf('}, [screen, isPageVisible]);', gate) + 40)).toContain('fetchAgentBattles();');
    expect(app.indexOf('}, [screen, isPageVisible]);', gate) - gate).toBeLessThan(12000);
  });

  it('the Season banner sits inside a literal ternary on the flag, its own condition untouched (the mount guard pins it)', () => {
    const open = app.indexOf('{LEAGUE_HIDE_ENABLED ? null : (<>');
    const banner = app.indexOf('<ActiveSeasonBanner');
    const close = app.indexOf('</>)}', banner);
    expect(open).toBeGreaterThan(-1);
    expect(banner).toBeGreaterThan(open);
    expect(close).toBeGreaterThan(banner);
    expect(app.slice(open, banner)).toContain("{user && isMobile && screen !== 'home' && !GAMEPLAY_SCREENS.includes(screen) && activeSeason && activeSeasonEntry && !hubOwnsScreen && (");
    expect((app.match(/<ActiveSeasonBanner\b/g) || []).length).toBe(1);
  });

  it('the nav items and the loadout card are literal ternaries on the flag (flag-off arms: League with the trophy; both cards)', () => {
    expect(code('src/components/Navigation/BottomNav.jsx')).toContain("...(LEAGUE_HIDE_ENABLED ? [{ id: 'league', label: 'BaggerBomb', icon: Bomb, screen: 'league', iconSize: 24 }] : TOURNAMENT_TAB_ENABLED ? [{ id: 'league', label: 'League', icon: Trophy, screen: 'league', iconSize: 24 }] : []),");
    expect(code('src/components/Navigation/DesktopSidebar.jsx')).toContain("...(LEAGUE_HIDE_ENABLED ? [{ id: 'league', label: 'BaggerBomb', Icon: Bomb, screen: 'league' }] : TOURNAMENT_TAB_ENABLED ? [{ id: 'league', label: 'League', Icon: Trophy, screen: 'league' }] : []),");
    expect(code('src/components/CommandCenter/LoadoutCards.jsx')).toContain('{(LEAGUE_HIDE_ENABLED ? [cards.baggerbomb] : [cards.baggerbomb, cards.league]).map((card) => (');
    expect(code('src/components/CommandCenter/PerGameLoadoutScope.jsx')).toContain('useLeagueLoadoutLock(LEAGUE_HIDE_ENABLED ? null : agent ? agent.ownerId ?? null : null);');
  });
});

describe('league hide — the page is a second root: its imports are listed (the mount guard walks from CommandCenterHub.jsx only)', () => {
  const importsOf = (rel) => [...code(rel).matchAll(/\b(?:import|export)\b[^;'"`]*?\bfrom\s*(['"])([^'"]+)\1|\bimport\s*(['"])([^'"]+)\3/g)].map((m) => m[2] ?? m[4]).sort();
  const PAGE = 'src/components/CommandCenter/BaggerBombPage.jsx';

  it('imports exactly these modules: the hub\'s own parts, the deploy provider, the page\'s copy and model — no service, no firebase, no new package', () => {
    expect(importsOf(PAGE)).toEqual([
      '../../constants/baggerBombPageCopy', '../../contexts/DeployAttemptContext', './HistorySheet', './HubParts', './PerGameLoadoutScope',
      './baggerBombPageModel', './hub/HubOverlays', './hub/composition', './hub/deployDisplay', './hub/hubCopy', './hub/hubStyle',
      './hub/useHubDeploy', './hub/useHubReaders', './hub/useHubSheets', './sections/DeploySection', './sections/GamesSection',
      'framer-motion', 'react',
    ].sort());
    expect(code(PAGE)).not.toMatch(/\bimport\s*\(|\brequire\s*\(/);
    expect(importsOf('src/components/CommandCenter/baggerBombPageModel.js')).toEqual(['../../utils/commandCenterLiveBattles', './hub/hubModel']);
    expect(importsOf('src/constants/baggerBombPageCopy.js')).toEqual([]);
  });

  it('the import scan sees what it must (a planted service import is listed)', () => {
    const planted = importsOf.toString();
    expect(planted).toContain('import');
    const found = [...squash("import x from '../../services/x'; import { y } from './y';").matchAll(/\b(?:import|export)\b[^;'"`]*?\bfrom\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
    expect(found).toEqual(['../../services/x', './y']);
  });
});

describe('league hide — DOORS: the route, the back target and the stale comment', () => {
  const raw = read('src/App.jsx');
  const app = code('src/App.jsx');

  it('the page route comes first and renders the lazy page with the hub object and the width fork; the old route is still behind TOURNAMENT_TAB_ENABLED, after it', () => {
    const page = app.indexOf("if (LEAGUE_HIDE_ENABLED && screen === 'league') {");
    const old = app.indexOf("if (TOURNAMENT_TAB_ENABLED && screen === 'league') {");
    expect(page).toBeGreaterThan(-1);
    expect(old).toBeGreaterThan(page);
    expect(app.slice(page, old)).toContain("<BaggerBombPage site={isMobile ? 'mobile' : 'desktop'} hub={hubProps} onOpenLoadout={() => openCommandCenterOnLoadout(setScreen)} />");
    expect(app.slice(page, old)).toContain('<Suspense fallback={<LoadingFallback />}>');
    expect(app).toContain("const BaggerBombPage = lazy(() => import('./components/CommandCenter/BaggerBombPage'));");
  });

  it('"back" after a training battle still sets the league screen id — the one other setter of it besides the nav — so it lands on the page', () => {
    expect(app.match(/setScreen\('league'\)/g)).toHaveLength(1);
    expect(app).toContain("<LeagueTrainingBattleView podId={trainingBattlePodId} user={user} onBack={() => setScreen('league')} />");
  });

  it('the comment that called the nav items the screen\'s only setters is gone, and says the "back" button is a third', () => {
    expect(raw).not.toMatch(/the nav items are its only setters\.\n/);
    expect(raw).toMatch(/'league' is NOT unreachable/);
  });
});
