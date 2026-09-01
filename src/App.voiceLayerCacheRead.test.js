// src/App.voiceLayerCacheRead.test.js
//
// F-2 (PASS1_MERGE_RULING_AND_PREFLIP_LIST.md §2): the Command Center Sync
// voiceLayerCache read is accounted like every other read in the poll.
//
// WHY IT IS PRE-FLIP RATHER THAN LEDGER. The read only happens when
// COMMAND_CENTER_SYNC_ENABLED is on, so today it costs nothing and reports
// nothing. The moment the flag flips it becomes one read per live battle per
// 120s cycle, forever — and read accounting that starts wrong is not noticed
// until someone is reconciling a bill against a number that was never right.
//
// A SEPARATE FILE ON PURPOSE. src/App.agentBattlesPoll.test.js is a defect
// guard (R-T2-S11, D-6) that must keep passing untouched; the ruling says so
// explicitly. Adding rows to it would mean editing the thing being relied on.
// This file sits beside it and guards only the new line.
//
// Source-text, for the same reason its sibling is: the read lives in an inline
// closure inside a useEffect inside the ~12k-line root component, no test in
// the repo mounts App.jsx, and reaching it at runtime would mean standing up
// the whole app with firebase mocked.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(path.join(HERE, 'App.jsx'), 'utf8');

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** The flag-gated Command Center Sync block inside the agentBattles poll. */
function cacheReadBlock() {
  const start = APP.indexOf('if (COMMAND_CENTER_SYNC_ENABLED && liveBattles.length > 0)');
  expect(start, 'the flag-gated voiceLayerCache read must exist in App.jsx').toBeGreaterThan(-1);
  const end = APP.indexOf('setVoiceLayerCaches(', start);
  expect(end, 'the block must end at its state setter').toBeGreaterThan(start);
  return stripComments(APP.slice(start, end));
}

describe('F-2 — the voiceLayerCache read is accounted', () => {
  const block = cacheReadBlock();

  it('calls trackRead for the cache read', () => {
    expect(block).toMatch(/trackRead\(/);
  });

  it('counts 1 — a getDoc has no .size to report', () => {
    // The sibling read uses trackRead('agentBattlePoll', snapshot.size) because
    // getDocs returns a QuerySnapshot. A single-document getDoc does not, so a
    // literal 1 is the honest count rather than a property that is undefined.
    expect(block).toMatch(/trackRead\(\s*'voiceLayerCachePoll'\s*,\s*1\s*\)/);
  });

  it('is accounted per battle, INSIDE the per-battle map, not once per cycle', () => {
    // The read happens once per live battle. Accounting it outside the map
    // would under-report whenever a user has two live battles — which is the
    // concurrency case the Desk already reasons about.
    const mapStart = block.indexOf('liveBattles.map(');
    expect(mapStart).toBeGreaterThan(-1);
    expect(block.indexOf('trackRead(')).toBeGreaterThan(mapStart);
  });

  it('stays INSIDE the flag gate — dark, the read and its accounting both cost nothing', () => {
    // The whole block is the gate's body, so a trackRead found here is
    // necessarily gated. This asserts the gate still wraps it.
    expect(block).toMatch(/^if \(COMMAND_CENTER_SYNC_ENABLED/);
  });

  it('uses the same accounting helper as the poll it rides on', () => {
    // Not a second mechanism: one helper, so the numbers are comparable.
    expect(APP).toMatch(/trackRead\(\s*'agentBattlePoll'\s*,\s*snapshot\.size\s*\)/);
  });
});
