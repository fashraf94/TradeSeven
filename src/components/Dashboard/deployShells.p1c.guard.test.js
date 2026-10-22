// src/components/Dashboard/deployShells.p1c.guard.test.js
//
// Pilot P1c — founder ruling E1: both Command dashboards ask the idea check
// BEFORE any deploy call, show the due-idea screen when it answers, deploy
// only through the screen's choice, never ask again on a ceremony retry, and
// App opens the list's Idea panel when the ceremony's notice asks.
//
// A source guard, as R1's deployShells.r1.guard.test.js is (no suite renders
// either shell's deploy path); the behaviour behind each piece is tested in
// dueIdeaCheck.test.js, DueIdeaInterstitial.jsdom.test.jsx and
// ceremonyIdeaNotice.jsdom.test.jsx.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, rel), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\s+\/\/ .*$/gm, '');

const SHELLS = ['CommandDashboard.jsx', 'CommandDashboardDesktop.jsx'];

function handleDeploy(src) {
  const start = src.indexOf('const handleDeploy = async () => {');
  expect(start, 'handleDeploy must exist').toBeGreaterThan(-1);
  return src.slice(start, src.indexOf('const handleCeremonyRetry', start));
}
function handleCeremonyRetry(src) {
  const start = src.indexOf('const handleCeremonyRetry = () => {');
  expect(start, 'handleCeremonyRetry must exist').toBeGreaterThan(-1);
  return src.slice(start, src.indexOf('};', start));
}

describe.each(SHELLS)('%s — the due-idea screen comes BEFORE any deploy call', (shell) => {
  const src = stripComments(read(shell));

  it('imports the check and the screen', () => {
    expect(src).toContain("import DueIdeaInterstitial from './deployCeremony/DueIdeaInterstitial';");
    expect(src).toContain("import { checkDueIdea } from '../../services/dueIdeaCheck';");
  });

  it('handleDeploy asks the check first and, when an idea is due, WAITS for the screen\'s choice — the ceremony and deployAgent come after', () => {
    const body = handleDeploy(src);
    const check = body.indexOf('const due = await checkDueIdea(agent);');
    const wait = body.indexOf('if (due) await new Promise((proceed) => setDueIdea({ due, proceed }));');
    const ceremony = body.indexOf("if (ceremonyOn) { setCeremonyOpen(true); setDeployResult({ status: 'pending' }); }");
    const deploy = body.indexOf('await deployAgent(agent.id, onCreateAgentBattle, reportDeployTarget);');
    expect([check, wait, ceremony, deploy].every((i) => i > -1)).toBe(true);
    expect(check).toBeLessThan(wait);
    expect(wait).toBeLessThan(ceremony);
    expect(ceremony).toBeLessThan(deploy);
    // The disabled check stays first; a second press during the check or the screen starts nothing.
    expect(body.indexOf('if (deployDisabled) return { success: false };')).toBeLessThan(check);
    expect(body).toMatch(/if \(ideaGateRef\.current\) return \{ success: false \};\s*ideaGateRef\.current = true;/);
    expect(body).toMatch(/\} finally \{\s*ideaGateRef\.current = false;\s*setDueIdea\(null\);\s*\}/);
  });

  it('a ceremony retry re-runs the same deploy without asking again (the choice was made)', () => {
    expect(handleCeremonyRetry(src)).toMatch(/skipIdeaCheckRef\.current = true;\s*handleDeploy\(\);/);
    expect(handleDeploy(src)).toMatch(/if \(skipIdeaCheckRef\.current\) \{\s*skipIdeaCheckRef\.current = false;\s*\} else \{/);
  });

  it('mounts the screen with the due idea and the waiting deploy as its one way forward', () => {
    expect(src).toContain('{dueIdea && <DueIdeaInterstitial due={dueIdea.due} accent={accent} onProceed={dueIdea.proceed} />}');
    expect(src.match(/<DueIdeaInterstitial\b/g)).toHaveLength(1);
  });
});

describe('the two shells stay identical', () => {
  it('handleDeploy and handleCeremonyRetry are the same code in both, comments aside', () => {
    const norm = (fn, s) => fn(stripComments(s)).replace(/\s+/g, ' ');
    expect(norm(handleDeploy, read('CommandDashboard.jsx'))).toBe(norm(handleDeploy, read('CommandDashboardDesktop.jsx')));
    expect(norm(handleCeremonyRetry, read('CommandDashboard.jsx'))).toBe(norm(handleCeremonyRetry, read('CommandDashboardDesktop.jsx')));
  });
});

describe('App opens the list\'s Idea panel when the ceremony asks (OPEN_IDEA_EVENT)', () => {
  const APP = read('../../App.jsx');
  it('one listener, on the shared event name, setting the editor screen for the named list', () => {
    expect(APP).toContain("import { OPEN_IDEA_EVENT, OPEN_BATTLE_REVIEW_EVENT } from './components/Forge/Watchlist/ideaNavigation';");
    expect(stripComments(APP).match(/OPEN_IDEA_EVENT/g)).toHaveLength(3); // the import, add, remove — nothing else
    const start = APP.indexOf('const onOpenIdea = (event) => {');
    expect(start).toBeGreaterThan(-1);
    const body = APP.slice(start, APP.indexOf('}, []);', start));
    expect(body).toMatch(/if \(typeof watchlistId !== 'string' \|\| watchlistId\.length === 0\) return;\s*setSelectedWatchlistId\(watchlistId\);\s*setWatchlistEditorReturnScreen\('home'\);\s*setShowForge\(false\);\s*setScreen\('watchlistEditor'\);/);
    expect(body).toContain('window.addEventListener(OPEN_IDEA_EVENT, onOpenIdea);');
    expect(body).toContain('window.removeEventListener(OPEN_IDEA_EVENT, onOpenIdea);');
  });
  it('and (ruling E2) one listener opening a carrying battle\'s Film Room from the battle document the card read', () => {
    expect(APP).toContain("import { OPEN_IDEA_EVENT, OPEN_BATTLE_REVIEW_EVENT } from './components/Forge/Watchlist/ideaNavigation';");
    expect(stripComments(APP).match(/OPEN_BATTLE_REVIEW_EVENT/g)).toHaveLength(3); // the import, add, remove — nothing else
    const start = APP.indexOf('const onOpenBattleReview = (event) => {');
    expect(start).toBeGreaterThan(-1);
    const body = APP.slice(start, APP.indexOf('}, []);', start));
    expect(body).toMatch(/if \(!battle \|\| typeof battle\.id !== 'string' \|\| battle\.id\.length === 0\) return;\s*setCurrentBattle\(battle\);\s*setShowForge\(false\);\s*setScreen\('filmRoom'\);/);
    expect(body).toContain('window.addEventListener(OPEN_BATTLE_REVIEW_EVENT, onOpenBattleReview);');
    expect(body).toContain('window.removeEventListener(OPEN_BATTLE_REVIEW_EVENT, onOpenBattleReview);');
  });
});
