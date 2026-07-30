// api/_utils/fantasyTimesConsensus.n4.test.js
// Phase 2 N4 — Neta hygiene cleanup. Matrix row P2-19: the grep-test
// asserting ABSENCE (a re-introduced reader or a resurrected stale comment
// fails here, not in review).
//
// What N4 removed (gate: Step 0 deployed via #688, founder-confirmed):
//   • the orphaned `economicCalendar` reader in fantasyTimesConsensus.js —
//     its collection has no producer anywhere in the repo, so the read
//     could only ever contribute [] (and, pre-Step-0, destroy events);
//   • the stale firestore.rules comment claiming the collection is
//     "populated by Claude-powered cron".
//
// What N4 deliberately KEPT (assessed + recorded): api/health.js's
// economicCalendar read. It is a Firestore CONNECTIVITY probe (limit(1),
// latency + availability), not a content consumer — it stays correct
// against an empty or stale collection, and retargeting the health
// endpoint's probe is an observability change outside N4's named scope
// (register: retarget to a live server-written collection in an
// observability pass). The census below PINS that disposition: exactly
// one reader remains, and it is health.js.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const ALLOWED_READERS = ['api/health.js']; // the connectivity probe — sole survivor

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '__fixtures__') continue;
      walk(p, out);
    } else if (p.endsWith('.js') && !p.endsWith('.test.js')) out.push(p);
  }
  return out;
}

describe('P2-19 — the orphaned reader is gone and stays gone', () => {
  it('fantasyTimesConsensus.js contains no economicCalendar reference at all', () => {
    const src = readFileSync(resolve(REPO_ROOT, 'api/_utils/fantasyTimesConsensus.js'), 'utf-8');
    expect(src.includes('economicCalendar')).toBe(false);
  });

  it('repo census: api/health.js is the ONLY remaining economicCalendar reader in api/', () => {
    const readers = walk(resolve(REPO_ROOT, 'api'))
      .map((p) => relative(REPO_ROOT, p))
      .filter((rel) => readFileSync(resolve(REPO_ROOT, rel), 'utf-8').includes('economicCalendar'));
    expect(readers.sort()).toEqual(ALLOWED_READERS);
  });

  it('the stale rules comment is gone; the accurate legacy note stands in its place', () => {
    const rules = readFileSync(resolve(REPO_ROOT, 'firestore.rules'), 'utf-8');
    expect(rules.includes('populated by Claude-powered cron')).toBe(false);
    expect(rules).toMatch(/LEGACY: the populating cron is retired/);
    // The rules BLOCK itself survives — the collection still exists and the
    // health probe reads it; only the claim about a producer was stale.
    expect(rules).toMatch(/match \/economicCalendar\/\{doc\}/);
  });
});
