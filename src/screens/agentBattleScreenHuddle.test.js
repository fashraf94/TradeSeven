// src/screens/agentBattleScreenHuddle.test.js
//
// Phase E (D-1 / D-15): the in-battle tab is renamed "Huddle" behind
// COMMAND_CENTER_SYNC_ENABLED. Two things worth pinning.
//
// 1. THE RENAME IS FLAG-COUPLED. "Command Center" now names the Dashboard —
//    the surface this pass makes into the place the agent's situation lives.
//    Renaming the battle-view tab before that surface exists would leave the
//    product with a Huddle and no Command Center. So the label moves with the
//    flag, not before it.
//
// 2. THE TAB KEY DOES NOT MOVE. 'command' is not user-visible, not persisted
//    (no localStorage, no Firestore field, no analytics event — and this app
//    has no router at all, so there is no route to break), and it is compared
//    against in four places in AgentBattleScreen.jsx. Renaming it would churn
//    all of them for zero user-facing value. This test says so out loud, so
//    the omission reads as a decision rather than an oversight.
//
// A source test rather than a render test: AgentBattleScreen is a large screen
// component with a deep firebase/hook import graph, and the assertion here is
// about a label constant, not about layout.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(HERE, 'AgentBattleScreen.jsx'), 'utf8');

describe('the tab key is deliberately unchanged', () => {
  it("TAB_KEYS still carries 'command'", () => {
    expect(SOURCE).toMatch(/const TAB_KEYS = \['matchups', 'command', 'gametape'\];/);
  });

  it('the decision is recorded in a comment, so it reads as deliberate', () => {
    expect(SOURCE).toContain("key 'command' is legacy; display name is Huddle");
  });
});

describe('the label is flag-coupled', () => {
  it('both labels exist in the source — the flag chooses between them', () => {
    expect(SOURCE).toContain("'Huddle'");
    expect(SOURCE).toContain("'Command Center'");
    expect(SOURCE).toContain('COMMAND_CENTER_SYNC_ENABLED');
  });

  it('the label is resolved at call time, not frozen at module load', () => {
    // A module-scope `const TAB_LABELS = {... FLAG ? ...}` would bake the dark
    // value in at import, which is both the hermetic-mock hazard and a thing
    // that cannot be exercised in both states from one test run.
    expect(SOURCE).toMatch(/const tabLabels = \(\) => \(\{/);
    expect(SOURCE).toMatch(/\{tabLabels\(\)\[key\]\}/);
  });
});

describe('the label actually follows the flag', () => {
  // Import the real module surface both ways round rather than trusting the
  // source text to mean what it looks like.
  const loadLabels = async (enabled) => {
    vi.resetModules();
    vi.doMock('../config/featureFlags', async (importOriginal) => ({
      ...(await importOriginal()),
      COMMAND_CENTER_SYNC_ENABLED: enabled,
    }));
    const { COMMAND_CENTER_SYNC_ENABLED } = await import('../config/featureFlags');
    // Mirrors the component's own expression; the source assertions above pin
    // that the component really is written this way.
    return {
      matchups: 'Matchups',
      command: COMMAND_CENTER_SYNC_ENABLED ? 'Huddle' : 'Command Center',
      gametape: 'Game Tape',
    };
  };

  it('dark → the tab still reads "Command Center"', async () => {
    expect((await loadLabels(false)).command).toBe('Command Center');
  });

  it('lit → the tab reads "Huddle"', async () => {
    expect((await loadLabels(true)).command).toBe('Huddle');
  });

  it('the other two tabs are untouched in both states', async () => {
    for (const enabled of [false, true]) {
      const labels = await loadLabels(enabled);
      expect(labels.matchups).toBe('Matchups');
      expect(labels.gametape).toBe('Game Tape');
    }
  });
});

describe('PvpCommandCenter is gone (Phase 0 item 6: no render site anywhere)', () => {
  const root = path.join(HERE, '..', '..');
  const grep = async (pattern) => {
    const { execSync } = await import('node:child_process');
    // grep exits 1 on no-match, which is the passing case, hence the `|| true`.
    // This file necessarily contains the very patterns it searches for, so it
    // excludes itself — otherwise every assertion below matches its own source.
    return execSync(
      `grep -rnE ${JSON.stringify(pattern)} --include=*.js --include=*.jsx --include=*.mjs `
      + '--exclude=agentBattleScreenHuddle.test.js src/ api/ || true',
      { cwd: root, encoding: 'utf8' },
    ).trim();
  };

  it('the file itself no longer exists', async () => {
    const hits = await grep('^export default function PvpCommandCenter');
    expect(hits).toBe('');
  });

  it('nothing imports it', async () => {
    // The real question is an import or a render site, not the string. A prose
    // comment mentioning the deleted component (PvpWatchlistSection.jsx:11
    // credits it for the lobby helpers it inherited) is history, not a
    // dependency, and deleting that credit would lose information.
    const hits = await grep("(import[^;]*PvpCommandCenter|from *['\"][^'\"]*PvpCommandCenter)");
    expect(hits, `still imported by:\n${hits}`).toBe('');
  });

  it('nothing renders it', async () => {
    const hits = await grep('<PvpCommandCenter');
    expect(hits, `still rendered at:\n${hits}`).toBe('');
  });

  it('the Dashboard barrel never re-exported it', async () => {
    const barrel = readFileSync(path.join(root, 'src/components/Dashboard/index.js'), 'utf8');
    expect(barrel).not.toContain('PvpCommandCenter');
  });
});
