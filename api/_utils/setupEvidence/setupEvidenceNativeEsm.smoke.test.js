// api/_utils/setupEvidence/setupEvidenceNativeEsm.smoke.test.js
//
// ID-1 Build 1 — the library's entry module loads under real node. Nothing the
// default suite runs imports index.js or store.js: only the emulator suite does, and
// CI does not run it. A vitest import cannot stand in, because vite-node resolves a
// missing named export to `undefined` instead of throwing, so a broken link would
// pass every row here and kill the first caller's route at deploy. This spawns a REAL
// `node` child process (the mandateNativeEsm.smoke.test.js pattern), loads the whole
// graph, pins the entry's export names, and runs the one path that needs no store.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ENTRY = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), 'index.js')).href;
const CHILD = `
import(process.argv[1]).then(async (m) => {
  const excluded = await m.getOrAcquireSnapshot({ symbol: 'BTC' });
  console.log(JSON.stringify({ exports: Object.keys(m).sort(), excluded }));
}, (e) => { console.error(e.message); process.exit(1); });
`;

describe('native-ESM smoke — the library loads under real node', () => {
  it('index.js and its whole graph load (no missing named export), with the entry\'s exports as pinned', () => {
    const out = execFileSync(process.execPath, ['-e', CHILD, ENTRY], { encoding: 'utf8', timeout: 30_000 });
    expect(JSON.parse(out.trim().split('\n').pop())).toEqual({
      exports: ['SetupEvidenceProgrammingError', 'getOrAcquireSnapshot', 'lastCompletedSessionAt', 'parseSnapshotId', 'readSnapshot', 'ruleKeyOf', 'snapshotIdOf'],
      excluded: { status: 'excluded', reason: 'unsupported_symbol_class' },
    });
  }, 35_000);
});
