// api/_utils/mandateNativeEsm.smoke.test.js
//
// Spec 1 Phase 3 — money reviewer finding 1 (CONFIRMED): mandateClosePass.js
// imported MANDATE_SCHEMA_VERSION from mandateSchema.js, which imports but
// never re-exports it. Under native Node ESM — the deploy runtime for
// api/cron functions — that is a module-load SyntaxError killing the entire
// route (eval + execution + close), while the vitest suite stayed green
// because vite-node's transform resolves a missing named export to
// `undefined` instead of throwing. `vite build` doesn't bundle api/, so the
// build was green too.
//
// This smoke test closes the class: it spawns a REAL `node` child process
// (no vitest transform) and imports the cron entrypoint, which pulls the
// whole mandate module graph. A missing/misspelled named export anywhere in
// that graph fails this test the way it would fail the deploy.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// Every mandate ROUTE entrypoint (each pulls a distinct slice of the module
// graph). A missing/misspelled named export anywhere in a route's graph fails
// the deploy; this is the only check that catches it (vite build doesn't bundle
// api/; vite-node resolves missing named exports to undefined).
const ROUTE_ENTRYPOINTS = [
  '../cron/mandate-evaluate.js',  // eval + close sweeps → close pass, execution, CA, metrics, schema, config
  '../cron/mandate-rollover.js',  // P4 rollover sweep → rollover core, vintage, quarter summary, calendar
  '../mandate/create.js',         // creation endpoint
  '../mandate/escape.js',         // P4 escape endpoint
  '../mandate/accelerate.js',     // P4 accelerated-clock harness endpoint
];

describe('native-ESM smoke — the mandate module graph loads under real node', () => {
  for (const rel of ROUTE_ENTRYPOINTS) {
    it(`${rel} loads under real node (no missing named export)`, () => {
      const entry = resolve(HERE, rel);
      // Child prints OK on success; a resolution/StaticSyntax error surfaces on
      // stderr and exits 1, failing execFileSync loudly with the message.
      const out = execFileSync(
        process.execPath,
        ['-e', 'import(process.argv[1]).then(() => { console.log("OK"); }, (e) => { console.error(e.message); process.exit(1); })', entry],
        { encoding: 'utf8', timeout: 30000 },
      );
      expect(out.trim()).toBe('OK');
    }, 35000);
  }
});
