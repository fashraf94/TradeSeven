// api/_utils/backingSmoke.test.js
//
// Backing activation — the founder smoke override, as a matrix. The whole
// promise of api/_utils/backingSmoke.js in falsifiable rows:
//   · the override lights ONLY on a Vercel preview, with BACKING_SMOKE_ENABLED
//     exactly 'true', for a uid in BACKING_SMOKE_UIDS;
//   · in production it is ignored entirely — both env vars set and the uid
//     allowlisted still read DARK;
//   · a non-allowlisted uid, a missing or wrong variable, an unset deployment
//     read DARK;
//   · the code flags are read at CALL time (the getter mock below moves them
//     per row) and a lit flag lights everyone, override or not.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of the module
// below is the runtime guard for its api/ -> src/ import of featureFlags.js.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const flags = vi.hoisted(() => ({ backing: false, eligibility: false }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flags.backing; },
  get ELIGIBILITY_ATTESTATION_ENABLED() { return flags.eligibility; },
}));

const {
  SMOKE_ENV, PREVIEW_DEPLOYMENT, backingLitFor, eligibilityLitFor, isPreviewDeployment, smokeAllowlist, smokeOverrideFor,
} = await import('./backingSmoke.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const FOUNDER = 'founder-uid-1';
const LIT_ENV = Object.freeze({ VERCEL_ENV: 'preview', BACKING_SMOKE_ENABLED: 'true', BACKING_SMOKE_UIDS: FOUNDER });

describe('the override — every condition, each alone', () => {
  it('lights an allowlisted uid on a preview with the switch on', () => {
    expect(smokeOverrideFor(FOUNDER, LIT_ENV)).toBe(true);
    expect(backingLitFor(FOUNDER, LIT_ENV)).toBe(true);
    expect(eligibilityLitFor(FOUNDER, LIT_ENV)).toBe(true);
  });

  it('the code flag lights only as the boolean `true` — a truthy non-boolean (a string) reads DARK on the server as on the client (LIGHT-R-2)', () => {
    const dark = { ...LIT_ENV, BACKING_SMOKE_ENABLED: 'false' };
    for (const value of ['true', 'false', 1, {}, [true]]) {
      flags.backing = value;
      flags.eligibility = value;
      expect(backingLitFor('someone-else', dark), String(value)).toBe(false);
      expect(eligibilityLitFor('someone-else', dark), String(value)).toBe(false);
    }
    flags.backing = true;
    flags.eligibility = true;
    expect(backingLitFor('someone-else', dark)).toBe(true);
    expect(eligibilityLitFor('someone-else', dark)).toBe(true);
    flags.backing = false;
    flags.eligibility = false;
  });

  it('PRODUCTION ignores the override entirely — both env vars set, the uid allowlisted, still DARK', () => {
    const production = { ...LIT_ENV, VERCEL_ENV: 'production' };
    expect(smokeOverrideFor(FOUNDER, production)).toBe(false);
    expect(backingLitFor(FOUNDER, production)).toBe(false);
    expect(eligibilityLitFor(FOUNDER, production)).toBe(false);
  });

  it('only a PREVIEW deployment counts — development, unset, empty and a look-alike read DARK', () => {
    for (const deployment of ['development', undefined, '', 'Preview', ' preview', 'previews']) {
      const env = { ...LIT_ENV, VERCEL_ENV: deployment };
      if (deployment === undefined) delete env.VERCEL_ENV;
      expect(isPreviewDeployment(env), String(deployment)).toBe(false);
      expect(backingLitFor(FOUNDER, env), String(deployment)).toBe(false);
    }
    expect(isPreviewDeployment({ VERCEL_ENV: PREVIEW_DEPLOYMENT })).toBe(true);
  });

  it('a NON-ALLOWLISTED uid reads DARK on a lit preview — and so does no uid at all', () => {
    for (const uid of ['someone-else', 'founder-uid-10', 'FOUNDER-UID-1', '', null, undefined, 42]) {
      expect(smokeOverrideFor(uid, LIT_ENV), String(uid)).toBe(false);
      expect(backingLitFor(uid, LIT_ENV), String(uid)).toBe(false);
      expect(eligibilityLitFor(uid, LIT_ENV), String(uid)).toBe(false);
    }
  });

  it('a MISSING or wrong switch reads DARK — only the literal string "true" turns it on', () => {
    for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes', ' true']) {
      const env = { ...LIT_ENV, BACKING_SMOKE_ENABLED: value };
      if (value === undefined) delete env.BACKING_SMOKE_ENABLED;
      expect(backingLitFor(FOUNDER, env), String(value)).toBe(false);
    }
  });

  it('a MISSING allowlist reads DARK, and the allowlist is parsed as a comma-separated, trimmed list', () => {
    const missing = { ...LIT_ENV };
    delete missing.BACKING_SMOKE_UIDS;
    expect(backingLitFor(FOUNDER, missing)).toBe(false);
    expect(backingLitFor(FOUNDER, { ...LIT_ENV, BACKING_SMOKE_UIDS: '' })).toBe(false);
    expect(smokeAllowlist({ BACKING_SMOKE_UIDS: ' a , b,,c ' })).toEqual(['a', 'b', 'c']);
    expect(smokeAllowlist({ BACKING_SMOKE_UIDS: 'a,a' })).toEqual(['a']);
    expect(smokeAllowlist({})).toEqual([]);
    expect(backingLitFor('b', { ...LIT_ENV, BACKING_SMOKE_UIDS: 'a, b ,c' })).toBe(true);
    expect(backingLitFor('d', { ...LIT_ENV, BACKING_SMOKE_UIDS: 'a, b ,c' })).toBe(false);
  });

  it('reads process.env by default — and process.env in this suite is DARK', () => {
    expect(process.env[SMOKE_ENV.DEPLOYMENT]).not.toBe('preview');
    expect(backingLitFor(FOUNDER)).toBe(false);
    expect(eligibilityLitFor(FOUNDER)).toBe(false);
  });
});

describe('the code flags are read at CALL time, and a lit flag lights everyone', () => {
  it('BACKING_BETA_ENABLED true lights every uid on every deployment; false leaves the override alone', () => {
    flags.backing = true;
    try {
      expect(backingLitFor('someone-else', { VERCEL_ENV: 'production' })).toBe(true);
      expect(backingLitFor(null)).toBe(true);
      expect(eligibilityLitFor('someone-else', { VERCEL_ENV: 'production' })).toBe(false);
    } finally {
      flags.backing = false;
    }
    expect(backingLitFor('someone-else', { VERCEL_ENV: 'production' })).toBe(false);
  });

  it('ELIGIBILITY_ATTESTATION_ENABLED true lights the attestation door alone', () => {
    flags.eligibility = true;
    try {
      expect(eligibilityLitFor('someone-else')).toBe(true);
      expect(backingLitFor('someone-else')).toBe(false);
    } finally {
      flags.eligibility = false;
    }
  });

  it('the module reads each flag at call time — no module-scope derivation of either', () => {
    const src = readFileSync(path.join(REPO, 'api/_utils/backingSmoke.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/^const [^\n]*_ENABLED/m);
    // Exactly one call-time read of each flag (the import line and the read).
    expect(src.match(/\bBACKING_BETA_ENABLED\b/g)).toHaveLength(2);
    expect(src.match(/\bELIGIBILITY_ATTESTATION_ENABLED\b/g)).toHaveLength(2);
    // …and the override never reaches into featureFlags.js: the flags module
    // mentions neither env var (the counsel-copy tripwire and the flag-pin
    // guard key on the constants, which this module never writes).
    const flagsSrc = readFileSync(path.join(REPO, 'src/config/featureFlags.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(flagsSrc).not.toContain('BACKING_SMOKE_ENABLED');
    expect(flagsSrc).not.toContain('BACKING_SMOKE_UIDS');
    expect(flagsSrc).not.toContain('VERCEL_ENV');
  });

  it('the flip tripwires key on the constants, not on this override', () => {
    // eligibilityFlags.test.js returns before its counsel-copy assertions
    // unless the CONSTANT is true — an env var cannot reach it.
    const tripwire = readFileSync(path.join(REPO, 'src/config/eligibilityFlags.test.js'), 'utf8');
    expect(tripwire).toContain('if (!ELIGIBILITY_ATTESTATION_ENABLED) return;');
    expect(tripwire).not.toContain('BACKING_SMOKE');
    // …and the flag-pin guard scans the source for `export const X = true|false`.
    const guard = readFileSync(path.join(REPO, 'src/config/flagPinGuard.test.js'), 'utf8');
    expect(guard).not.toContain('BACKING_SMOKE');
  });
});
