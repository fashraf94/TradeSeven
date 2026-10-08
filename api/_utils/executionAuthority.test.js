// api/_utils/executionAuthority.test.js
//
// The pin for LAUNCH_EXECUTION_MODE (integrity build F1) and the source pins
// that both launch guards in the cron read it — never the battle's
// owner-writable `executionMode`. Moving the value is the authority arc's
// founder-gated change: update this pin in the same commit (BUILD_RULES §2).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAUNCH_EXECUTION_MODE } from './executionAuthority.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON = readFileSync(resolve(HERE, '../cron/agent-evaluate.js'), 'utf8');
const SELF = readFileSync(resolve(HERE, 'executionAuthority.js'), 'utf8');
/** The cron's code with comments removed. */
const CODE = CRON.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('LAUNCH_EXECUTION_MODE — the one server-owned execution mode', () => {
  it('pins the launch decision (2026-05-19): auto-pilot only', () => {
    expect(LAUNCH_EXECUTION_MODE).toBe('autopilot');
  });

  it('carries its Pinned-by pointer', () => {
    expect(SELF).toMatch(/Pinned by: api\/_utils\/executionAuthority\.test\.js/);
  });

  it('the model path forces it — never a mode read off the battle', () => {
    expect(CODE).toMatch(/const mode = LAUNCH_EXECUTION_MODE;/);
    expect(CODE).not.toMatch(/let mode = battle\.executionMode/);
  });

  it('the proposal handler\'s guard reads it — never the battle\'s executionMode', () => {
    const start = CODE.indexOf('async function handlePendingProposal(');
    const fn = CODE.slice(start, CODE.indexOf('export async function runSuppressionDeterministicPass', start));
    expect(start).toBeGreaterThan(0);
    expect(fn.length).toBeGreaterThan(1000);
    expect(fn).toMatch(/if \(LAUNCH_EXECUTION_MODE === 'autopilot'\) \{/);
    // The handler reads executionMode only as a capped label on the dormant metadata.
    for (const m of fn.matchAll(/battle\.executionMode/g)) {
      expect(fn.slice(m.index - 'clientToken('.length, m.index)).toBe('clientToken(');
    }
  });

  it('nothing else in the cron branches on the battle\'s executionMode', () => {
    const reads = CODE.split('\n').filter((line) => line.includes('battle.executionMode'));
    expect(reads.length).toBeGreaterThan(5);
    for (const r of reads) {
      // Allowed: the migration default, the capped entryMode label, the launch-guard log line.
      expect(r, r).toMatch(/battle\.executionMode === undefined|clientToken\(battle\.executionMode\)|\(battle\.executionMode \|\| 'autopilot'\) !== mode|mode='\$\{battle\.executionMode\}'/);
    }
  });
});
