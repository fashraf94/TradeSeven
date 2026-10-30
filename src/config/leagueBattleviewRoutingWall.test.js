// src/config/leagueBattleviewRoutingWall.test.js
//
// THE WALL — a tripwire (contract Amendment E rev 4, framework condition 2;
// docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_E.md, "What stays as it is").
//
// LEAGUE_BATTLEVIEW_ROUTING_ENABLED is the ONLY thing that keeps League battles out of
// the cockpit: with it on, BattleViewScreen sends a flat-6 League battle to the League
// Arena before the agentDeployed → AgentBattleScreen branch. In a League battle the
// agent's exit-call `slot` is a guess (the League prompt shows no tiers; the declaration
// requires one), so the cockpit's slot-tier answer check (D-4) and the any-tier checks of
// E-1 / E-2 disagree on 60 of the 127 League exit calls counted. The cockpit arc owns the
// fix (the League slot label follow-up). Until it lands, this flag must stay on.
//
// House pattern (flagPinGuard.test.js): the bare `expect(FLAG).toBe(true)` below is what
// the guard scans — it keeps the flag's "Pinned by:" pointer honest and fails a flip that
// forgets the pin. The line above it carries the explanation (the guard's regex does not
// see a pin with a message argument, so the loud one and the scanned one are two lines).
// A deliberate turn-off moves BOTH lines and this file's header, in a commit that cites
// the landed slot-label follow-up — never a quiet one-line flip.
//
// Referenced by the flag's "Pinned by:" docstring in featureFlags.js.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEAGUE_BATTLEVIEW_ROUTING_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const WALL_MESSAGE = [
  'LEAGUE_BATTLEVIEW_ROUTING_ENABLED is OFF — and it is the ONLY wall keeping League battles out of the cockpit (contract Amendment E,',
  'docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_E.md, "What stays as it is"). In a League battle the agent\'s exit-call slot is a guess,',
  'so the cockpit would offer answers the endpoint refuses. Do NOT turn this flag off until the cockpit arc\'s League SLOT LABEL',
  'follow-up has landed. If that has landed: update this file (both pin lines and the header) and the flag\'s docstring in the same commit,',
  'and say so in the commit message. If not: revert the flag.',
].join(' ');

describe('League battleview routing — the wall that keeps League out of the cockpit (Amendment E)', () => {
  it('the routing flag is ON (a turn-off before the League slot label follow-up fails here, loudly)', () => {
    expect(LEAGUE_BATTLEVIEW_ROUTING_ENABLED, WALL_MESSAGE).toBe(true);
    expect(LEAGUE_BATTLEVIEW_ROUTING_ENABLED).toBe(true);
  });

  it('the flag\'s docstring still names Amendment E, the wall, and the slot label follow-up — the warning cannot be edited away quietly', () => {
    const lines = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8').split('\n');
    const at = lines.findIndex((l) => /^export const LEAGUE_BATTLEVIEW_ROUTING_ENABLED\s*=/.test(l));
    expect(at, 'the flag declaration was not found in featureFlags.js').toBeGreaterThan(0);
    let start = 0;
    for (let i = at - 1; i >= 0; i--) { if (/^export const /.test(lines[i])) { start = i + 1; break; } }
    const docstring = lines.slice(start, at).join('\n');
    for (const needle of ['Amendment E', 'ONE WALL', 'SLOT LABEL', 'DO NOT TURN THIS FLAG OFF', 'leagueBattleviewRoutingWall.test.js']) {
      expect(docstring, `the flag's docstring lost "${needle}" — it is what tells the next reader why the flag must stay on (Amendment E)`).toContain(needle);
    }
    expect(docstring).not.toMatch(/Default OFF/);
  });
});
