// src/components/Dashboard/deployShells.r1.guard.test.js
//
// Command Center repair R1 (ruling R-R1-2) — both Command dashboards route a
// deploy result through the one mapping (deployResult.js, tested directly in
// deployResult.test.js), open the agent's already-running battle as the owned
// server document, and nothing else.
//
// A source guard: no test renders either shell's deploy path (the shells pull
// the agent, mastery, brief, group and sync subscriptions), so these rows pin
// the wiring; the behaviour behind it is tested in deployResult.test.js,
// existingBattle.test.js and ceremonyExisting.test.jsx.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(path.join(HERE, name), 'utf8');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const SHELLS = ['CommandDashboard.jsx', 'CommandDashboardDesktop.jsx'];

function handleDeploy(src) {
  const start = src.indexOf('const handleDeploy = async () => {');
  expect(start, 'handleDeploy must exist').toBeGreaterThan(-1);
  const end = src.indexOf('const handleCeremonyRetry', start);
  expect(end, 'handleCeremonyRetry must follow it').toBeGreaterThan(start);
  return src.slice(start, end);
}

function ceremonyBlock(src) {
  const start = src.indexOf('<DeployCeremony');
  expect(start, 'the shell must mount DeployCeremony').toBeGreaterThan(-1);
  return src.slice(start, src.indexOf('/>', start));
}

describe.each(SHELLS)('%s — R1 deploy wiring', (shell) => {
  const src = stripComments(read(shell));

  it('reports the deploy target into a ref as well as state, and deploys with that reporter', () => {
    expect(src).toContain('const reportDeployTarget = (id) => { deployTargetRef.current = id; setDeployTargetId(id); };');
    expect(handleDeploy(src)).toContain('await deployAgent(agent.id, onCreateAgentBattle, reportDeployTarget);');
  });

  it('ceremony on: an orphaned deploy closes the ceremony (founder ruling Q2); every other result goes through deployResultFor; no inline mapping is left behind', () => {
    const body = handleDeploy(src);
    expect(body).toMatch(/if \(ceremonyOn\) \{\s*if \(isOrphanedResult\(result\)\) setCeremonyOpen\(false\);\s*else setDeployResult\(deployResultFor\(result\)\);\s*\}/);
    expect(body).not.toContain("status: 'success'");
    expect(body).not.toContain("status: 'error'");
  });

  it('ceremony off: only the existing battle does anything, and it opens the owned document', () => {
    const body = handleDeploy(src);
    expect(body).toMatch(new RegExp([
      String.raw`\} else if \(isExistingBattleResult\(result\)\) \{`,
      String.raw`await openExistingBattleDirectly\(\{`,
      String.raw`existingBattleId: result\.existingBattleId,`,
      String.raw`targetAgentId: deployTargetRef\.current,`,
      String.raw`liveBattles,`,
      String.raw`onOpen: onOpenAgentBattle,`,
      String.raw`\}\);`,
      String.raw`\}`,
      String.raw`return result;`,
    ].join(String.raw`\s*`)));
  });

  it('the existing path toasts nothing, creates nothing and enters nothing', () => {
    const body = handleDeploy(src);
    const existing = body.slice(body.indexOf('isExistingBattleResult(result)'), body.indexOf('return result;'));
    for (const forbidden of ['showToast', 'onCreateAgentBattle', 'onEnterBattle', 'setCurrentBattle', 'setScreen']) {
      expect(existing, forbidden).not.toContain(forbidden);
    }
  });

  it('the ceremony gets the live list and an open handler wired to onOpenAgentBattle; Enter is unchanged', () => {
    const block = ceremonyBlock(src);
    expect(block).toContain('liveBattles={liveBattles}');
    expect(block).toContain('onOpenBattle={(battle) => { onOpenAgentBattle?.(battle); setCeremonyOpen(false); }}');
    expect(block).toContain('onEnterBattle={(recoveredBattle) => { onEnterBattle?.(recoveredBattle); setCeremonyOpen(false); }}');
  });

  it('imports the mapping and the opener from their R1 modules', () => {
    expect(src).toContain("import { deployResultFor, isExistingBattleResult, isOrphanedResult } from './deployResult';");
    expect(src).toContain("import { openExistingBattleDirectly } from './deployCeremony/existingBattle';");
  });
});

describe('the two shells deploy identically', () => {
  it('handleDeploy is the same code in both, comments aside', () => {
    const norm = (s) => handleDeploy(stripComments(s)).replace(/\s+/g, ' ');
    expect(norm(read('CommandDashboard.jsx'))).toBe(norm(read('CommandDashboardDesktop.jsx')));
  });
});
