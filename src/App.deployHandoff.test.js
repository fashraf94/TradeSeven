// src/App.deployHandoff.test.js
//
// Command Center repair R1 (ruling R-R1-5) — App's deploy handoff
// (handleCreateAgentTrainingBattle) fabricates nothing and knows its owner.
//
// A source guard, for the reason App.deploySettle.test.js gives: the handler is
// an inline closure inside the root component, not exported, and the one test
// that renders App (App.xpModal.jsdom.test.jsx) never deploys. Its pure half —
// the id rule, the owner check, the entry — is tested directly in
// components/Dashboard/deployHandoff.test.js; these rows pin that App routes
// through it, and in what order.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(path.join(HERE, 'App.jsx'), 'utf8');

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** The body of handleCreateAgentTrainingBattle, comments stripped. */
function handlerBody() {
  const start = APP.indexOf('const handleCreateAgentTrainingBattle = async (');
  expect(start, 'handleCreateAgentTrainingBattle must exist in App.jsx').toBeGreaterThan(-1);
  const end = APP.indexOf('const handleOpenAgentBattle', start);
  expect(end, 'handleOpenAgentBattle must follow it').toBeGreaterThan(start);
  return stripComments(APP.slice(start, end));
}

const GUARD = 'if (agentBattleId === null || !ownerIsCurrent()) return null;';

describe('R1 — App\'s handoff fabricates nothing and knows its owner (R-R1-5)', () => {
  it('the id is the real server id or nothing: no synthetic agent_ id anywhere in the handler', () => {
    const body = handlerBody();
    expect(body).toContain('const agentBattleId = handoffBattleId(agentMeta);');
    expect(body).not.toMatch(/agent_\$\{/);
    expect(body).not.toMatch(/Date\.now\(\)\s*}`/);
    expect(body).toMatch(/const currentBattleObj = \{\s*id: agentBattleId,/);
  });

  it('the owner is the deploy\'s captured uid, compared with the signed-in one', () => {
    const body = handlerBody();
    expect(body).toContain('const ownerUid = agentMeta?.ownerUid ?? null;');
    expect(body).toContain('const ownerIsCurrent = () => isHandoffOwnerCurrent(ownerUid, signedInUid());');
    expect(APP).toContain("import { signedInUid } from './services/deployIdentity';");
  });

  it('no id, or another account, returns before the append, the overwrite, the stash and the navigation', () => {
    const body = handlerBody();
    const guard = body.indexOf(GUARD);
    expect(guard, 'the guard must exist').toBeGreaterThan(-1);
    for (const effect of [
      'setActiveAgentBattles(', 'captureBattlePrices(', 'pendingCeremonyBattleRef.current = currentBattleObj',
      'enterAgentBattle(currentBattleObj)', 'showToast(', 'const currentBattleObj',
    ]) {
      const at = body.indexOf(effect);
      expect(at, `${effect} must exist`).toBeGreaterThan(-1);
      expect(at, `${effect} must follow the guard`).toBeGreaterThan(guard);
    }
    // ...and the guard is the first statement that uses the id at all.
    const DECL = 'const agentBattleId = handoffBattleId(agentMeta);';
    expect(body.indexOf('agentBattleId', body.indexOf(DECL) + DECL.length)).toBe(guard + 'if ('.length);
  });

  it('the settle hands the builder every field the pre-R1 inline entry had (review L5-2)', () => {
    const body = handlerBody();
    const settle = body.slice(body.indexOf('isDeploySkyCouplingOn()'), body.indexOf('const currentBattleObj'));
    for (const arg of [
      'agentBattleId,', 'ownerUid,', 'agentId: agentMeta?.agentId,', 'expiresAt: agentMeta?.expiresAt,',
      'nowIso: now.toISOString(),', 'portfolio: portfolioData,', 'bench: benchData,',
      'startingPrices: allStartingPrices,', 'opponentPortfolio: cpuPortfolio,', 'opponentBench: cpuBench,',
    ]) expect(settle, arg).toContain(arg);
  });

  it('the optimistic entry carries that owner', () => {
    const body = handlerBody();
    const settle = body.slice(body.indexOf('isDeploySkyCouplingOn()'), body.indexOf('const currentBattleObj'));
    expect(settle).toMatch(/buildOptimisticBattleEntry\(\{[^}]*\bownerUid,/);
  });

  it('the fresh-price overwrite re-checks the owner immediately before its write', () => {
    const body = handlerBody();
    const overwrite = body.slice(body.indexOf('captureBattlePrices('));
    const configImport = overwrite.indexOf("await import('./firebase/config')");
    const recheck = overwrite.indexOf('if (!ownerIsCurrent()) return;');
    const write = overwrite.indexOf('await updateDoc(');
    expect(configImport).toBeGreaterThan(-1);
    expect(recheck).toBeGreaterThan(configImport);
    expect(write).toBeGreaterThan(recheck);
    // Nothing awaited between the re-check and the write.
    expect(overwrite.slice(recheck, write)).not.toMatch(/await\s/);
  });

  it('the handler answers null when it does nothing, and the real id when it hands off', () => {
    const body = handlerBody();
    expect(body).toContain(GUARD);
    expect(body).toMatch(/return agentBattleId;\s*};\s*$/);
  });
});

/** The body of handleEnterCeremonyBattle, comments stripped. */
function enterBody() {
  const start = APP.indexOf('const handleEnterCeremonyBattle = (recoveredBattle = null) => {');
  expect(start, 'handleEnterCeremonyBattle must exist in App.jsx').toBeGreaterThan(-1);
  const end = APP.indexOf('const handleCreateAgentTrainingBattle', start);
  expect(end).toBeGreaterThan(start);
  return stripComments(APP.slice(start, end));
}

describe('R1 — Enter is the ceremony deploy\'s navigation: it checks the owner again (R-R1-5; review L2-1)', () => {
  it('the stash is recorded with the uid it was handed off for, in the same branch', () => {
    expect(handlerBody()).toMatch(/pendingCeremonyBattleRef\.current = currentBattleObj;\s*pendingCeremonyOwnerRef\.current = ownerUid;/);
  });

  it('Enter filters pickCeremonyEntry\'s inputs by the signed-in uid, then calls it unchanged', () => {
    const body = enterBody();
    const filter = body.indexOf('ownedCeremonyEntryInputs({ stash: b, stashOwnerUid, recoveredBattle, currentUid: signedInUid() })');
    const pick = body.indexOf('pickCeremonyEntry(owned.stash, owned.recoveredBattle)');
    expect(filter).toBeGreaterThan(-1);
    expect(pick).toBeGreaterThan(filter);
    expect(body).not.toMatch(/pickCeremonyEntry\(b, recoveredBattle\)/);
    // Both refs are consumed together, so a later Enter cannot reuse either.
    expect(body).toMatch(/pendingCeremonyBattleRef\.current = null;\s*pendingCeremonyOwnerRef\.current = null;/);
  });
});
