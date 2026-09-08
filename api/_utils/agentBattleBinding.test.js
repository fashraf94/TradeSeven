// api/_utils/agentBattleBinding.test.js
//
// The shared agent-belongs-to-this-battle predicate. The three routes that call
// it (chat.js, ensure-opener.js, file-directive.js) each carry a mismatch row
// and a match row. chat.js and file-directive.js 400 on a missing `agentId`
// before the call; ensure-opener.js guards only `battleId` and reaches the call
// with an absent id, which the predicate itself refuses. Either way, no route
// row supplies a battle doc whose OWN `agentId` is nullish — the only input on
// which the real predicate and a bare `battle?.agentId === agentId` diverge —
// so the predicate's type and emptiness guard is unreachable from all of them,
// and that mutation survives every route row in the repo. This file is that
// guard's row.
//
// Dependency-surface guard (BUILD_RULES §4): this file's import of the module
// under test is the runtime guard that it stays zero-import and Node-clean.
// Never mock it.

import { describe, it, expect } from 'vitest';
import { agentBelongsToBattle, AGENT_BATTLE_MISMATCH } from './agentBattleBinding.js';

describe('agentBelongsToBattle', () => {
  it('matches the battle\'s own agent', () => {
    expect(agentBelongsToBattle({ agentId: 'agent-1' }, 'agent-1')).toBe(true);
  });

  it('rejects any other agent — the whole point', () => {
    expect(agentBelongsToBattle({ agentId: 'agent-1' }, 'agent-2')).toBe(false);
  });

  it('is exact: no trimming, no case folding, no prefix match', () => {
    expect(agentBelongsToBattle({ agentId: 'agent-1' }, ' agent-1')).toBe(false);
    expect(agentBelongsToBattle({ agentId: 'agent-1' }, 'AGENT-1')).toBe(false);
    expect(agentBelongsToBattle({ agentId: 'agent-1' }, 'agent-10')).toBe(false);
  });

  it('a battle with no agentId binds NOTHING — not even a caller who also names none', () => {
    // The one case a bare `battle?.agentId === agentId` gets wrong: it answers
    // true for undefined === undefined, which would turn a battle doc missing
    // its agentId into a route that accepts any caller who omits the field.
    expect(agentBelongsToBattle({}, undefined)).toBe(false);
    expect(agentBelongsToBattle({ agentId: undefined }, undefined)).toBe(false);
    expect(agentBelongsToBattle({ agentId: null }, null)).toBe(false);
  });

  it('an id that cannot be a document id is never a match', () => {
    expect(agentBelongsToBattle({ agentId: '' }, '')).toBe(false);
    expect(agentBelongsToBattle({ agentId: 42 }, 42)).toBe(false);
    expect(agentBelongsToBattle({ agentId: 'agent-1' }, ['agent-1'])).toBe(false);
    expect(agentBelongsToBattle({ agentId: 'agent-1' }, { toString: () => 'agent-1' })).toBe(false);
  });

  it('an absent battle is never a match', () => {
    expect(agentBelongsToBattle(undefined, 'agent-1')).toBe(false);
    expect(agentBelongsToBattle(null, 'agent-1')).toBe(false);
  });

  it('the error code is the one file-directive.js shipped, so all three routes say the same word', () => {
    expect(AGENT_BATTLE_MISMATCH).toBe('agent_battle_mismatch');
  });
});
