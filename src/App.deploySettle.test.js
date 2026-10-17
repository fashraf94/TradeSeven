// src/App.deploySettle.test.js
//
// Acceptance row A5 (site half) — the post-deploy settle.
// Delight Layer arc, Task 4 (Phase 2). Ruling R-T4-S1.
//
// The sky's live-state input is the 120s `activeAgentBattles` poll, so without
// intervention a successful deploy reads: surge → decay to RESTING → (up to two
// minutes later) ease to BATTLE LIVE. The settle appends the just-created battle
// to that state optimistically, inside handleCreateAgentTrainingBattle.
//
// WHY A SOURCE GUARD, NOT A BEHAVIOURAL TEST. The same reason
// App.agentBattlesPoll.test.js gives: the handler is an inline closure inside
// PortfolioDuel (the ~12k-line root component in src/App.jsx), it is not
// exported, and no test in the repo mounts App.jsx. This pins the properties
// that matter and cannot regress silently; the PROJECTION half of A5 — that the
// injected shape really resolves to BATTLE LIVE — is asserted for real against
// the adapter and the state machine in warpBattleAdapter.test.js.

//
// Command Center repair R1 (ruling R-R1-5) moved the entry's builder and the
// append into src/components/Dashboard/deployHandoff.js, where they are pure
// and exported. The shape and idempotence rows below therefore assert the
// builder's real output, and pin only that the settle block routes through it;
// the gate, read-path and ordering rows stay on App's source.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOptimisticBattleEntry, appendOptimisticBattle } from './components/Dashboard/deployHandoff';

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

/** Just the optimistic-append block. */
function settleBlock() {
  const body = handlerBody();
  const start = body.indexOf('isDeploySkyCouplingOn()');
  expect(start, 'the settle must be gated by isDeploySkyCouplingOn()').toBeGreaterThan(-1);
  const end = body.indexOf('const currentBattleObj', start);
  expect(end, 'the settle must sit before the battle-object construction').toBeGreaterThan(start);
  return body.slice(start, end);
}

describe('A5 — the post-deploy settle is wired at the deploy handler', () => {
  it('appends the new battle to activeAgentBattles', () => {
    expect(settleBlock()).toContain('setActiveAgentBattles');
  });

  it('is GATED on the coupling flag, so flag-off deploys are byte-identical (A1)', () => {
    // activeAgentBattles also drives the "No battle live" card and the deploy
    // CTA's own live/disabled state. Ungated, this would change production
    // behaviour ahead of the flip.
    const body = handlerBody();
    const gate = body.indexOf('isDeploySkyCouplingOn()');
    const write = body.indexOf('setActiveAgentBattles');
    expect(gate).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(gate); // the write is inside the gate
    expect(APP).toContain('isDeploySkyCouplingOn'); // and the flag is imported
  });

  it('writes the exact shape the adapter needs to read BATTLE LIVE', () => {
    // warpBattleAdapter.isLiveBattle requires status === 'active'; toLiveGame
    // reads expiresAt and activatedAt||createdAt. A shape missing `status`
    // silently never counts as live, and the settle would do nothing at all.
    const block = settleBlock();
    expect(block).toContain('buildOptimisticBattleEntry(');
    expect(block).toMatch(/\bagentBattleId,/);
    expect(block).toContain('expiresAt');
    const entry = buildOptimisticBattleEntry({
      agentBattleId: 'battle-1', ownerUid: 'uid-1', agentId: 'agent-1',
      expiresAt: '2026-10-16T20:00:00.000Z', nowIso: '2026-10-16T14:00:00.000Z',
      portfolio: {}, bench: null, startingPrices: {},
    });
    expect(entry.status).toBe('active');
    expect(entry.expiresAt).toBe('2026-10-16T20:00:00.000Z');
    expect(entry.activatedAt).toBe('2026-10-16T14:00:00.000Z');
    expect(entry.id).toBe('battle-1');
  });

  it('only fires when the server actually returned a battle id', () => {
    expect(settleBlock()).toContain('agentBattleId');
    // The handler is reached only on deploy SUCCESS (services/agentDeploy.js
    // calls it past the success gate), which is what keeps a FAILED deploy from
    // ever landing the sky on BATTLE LIVE.
    // Comments stripped: the module header NAMES onCreateAgentBattle long
    // before the call site, which would make this ordering check vacuous.
    const deploy = stripComments(readFileSync(path.join(HERE, 'services/agentDeploy.js'), 'utf8'));
    const gate = deploy.indexOf('data.success !== true');
    const call = deploy.indexOf('await onCreateAgentBattle(');
    expect(gate).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(gate);
  });

  it('is idempotent — a repeated id is not appended twice', () => {
    // The poll replaces the array wholesale, but a retry inside one poll window
    // must not double-count the same battle.
    expect(settleBlock()).toContain('appendOptimisticBattle(prev,');
    const once = appendOptimisticBattle([], { id: 'battle-1' });
    expect(once).toHaveLength(1);
    expect(appendOptimisticBattle(once, { id: 'battle-1', again: true })).toBe(once);
  });

  it('opens NO new Firestore read path (A6)', () => {
    // The settle is a setState on state the app already holds. If this ever
    // becomes a getDoc/getDocs/onSnapshot, A6 is broken and the D6 "no new read
    // paths" constraint with it.
    const block = settleBlock();
    for (const forbidden of ['getDoc', 'getDocs', 'onSnapshot', 'collection(', 'query(']) {
      expect(block).not.toContain(forbidden);
    }
  });
});
