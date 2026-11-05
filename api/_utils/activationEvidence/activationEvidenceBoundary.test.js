// api/_utils/activationEvidence/activationEvidenceBoundary.test.js
//
// ID-1 Build 2 — THE I/O BOUNDARY (build prompt V3 §2; contract V1.7 §11, the
// module-purity finding). Seven modules are PURE (no I/O, no clock reads beyond
// an injected instant); five do I/O. Each pure module's imports are pinned
// exactly, so an I/O dependency cannot slip into one, and the census can import
// them (scripts/census-activation-evidence.test.js pins its side).

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(HERE, f), 'utf8');
const code = (f) => src(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const importsOf = (f) => [...code(f).matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map((m) => m[1]);

const PURE = {
  'constants.js': [],
  'scope.js': ['../../../src/constants/agentGameModes.js', '../../../src/constants/leagueTournament.js', './constants.js'],
  'lifetimes.js': ['./constants.js'],
  'discover.js': ['../setupEvidence/sessionAt.js', '../setupEvidence/key.js', '../setupEvaluator/thresholds.js', './lifetimes.js', './schedule.js'],
  'schedule.js': ['./constants.js', '../marketSchedule.js'],
  'tick.js': ['./constants.js', './lifetimes.js'],
  'pointer.js': ['../../../src/constants/leagueTournament.js', '../hypothesisRecords/review.js', './constants.js', './lifetimes.js'],
};
const IO = ['attribution.js', 'gate.js', 'state.js', 'tenant.js', 'writer.js'];

describe('the module list', () => {
  it('is exactly the seven pure modules and the five I/O modules', () => {
    const modules = readdirSync(HERE).filter((f) => f.endsWith('.js') && !f.includes('.test.')).sort();
    expect(modules).toEqual([...Object.keys(PURE), ...IO].sort());
  });
});

describe('the pure modules', () => {
  for (const [file, imports] of Object.entries(PURE)) {
    it(`${file}: its imports are exactly the pinned ones, and it does no I/O and reads no clock`, () => {
      expect(importsOf(file)).toEqual(imports);
      const c = code(file);
      for (const re of [/\bDate\.now\(/, /new Date\(\)/, /\.runTransaction\(/, /\.collection\(/, /\.getAll\(/, /\.get\(\)/, /process\.env/, /\bfetch\(/, /console\./]) expect([file, re.test(c)]).toEqual([file, false]);
      for (const io of IO) expect(importsOf(file)).not.toContain(`./${io}`);
    });
  }
});

describe('the I/O modules', () => {
  it('the gate reads the environment only: no Firestore, no clock', () => {
    const c = code('gate.js');
    expect(c).not.toMatch(/\.collection\(|\.runTransaction\(|Date\.now\(|new Date\(/);
  });
  it('the tenant reads the clock only through its injected `now` (whose default, the production clock, is the one `new Date()`)', () => {
    const c = code('tenant.js');
    expect(c).not.toMatch(/\bDate\.now\(/);
    expect(c.match(/new Date\(\)/g)).toHaveLength(1);
    expect(c).toContain('now = () => new Date(), fetchPayload');
  });
  it('the writer never sets, updates or merges a pointer, and never reads the claims collection', () => {
    const c = code('writer.js');
    expect(c).not.toMatch(/\.set\(|\.update\(|merge/);
    expect(c).not.toMatch(/setupEvidenceClaims/);
    expect(c.match(/tx\.create\(/g)).toHaveLength(3);
  });
});
