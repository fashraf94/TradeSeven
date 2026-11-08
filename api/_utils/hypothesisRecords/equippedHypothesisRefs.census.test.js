// api/_utils/hypothesisRecords/equippedHypothesisRefs.census.test.js
//
// The Research Record Extension follow-up (V2 §2, Q10 — founder ruling: not
// fence contact). A battle's frozen `equippedHypothesis` sibling carries
// `evidenceRefs` and `origin` as pass-through fields: the carriage's
// `siblingOf` builds them and the fenced battle writer copies them verbatim
// (api/_utils/agentBattleService.js). New values inside them (the extension's
// evidenceItem / exchange refs, origin `shared_research`) do not change the
// battle document's shape BECAUSE nothing that trades or scores reads them.
// This census keeps that true:
//   · it lists every non-test code file that names `equippedHypothesis` —
//     a new one fails until it is reviewed and listed here;
//   · it fails when any of them READS `evidenceRefs` or `origin` from the
//     sibling — other than the fenced copy (the only allowed reads) — so a
//     future reader comes back for review.
// `siblingOf` itself reads the version, not the sibling, and needs no entry.
//
// What counts as a read: a member access (`.evidenceRefs`, `?.origin`,
// `['evidenceRefs']`) on an expression ending in `equippedHypothesis`; a
// destructuring of either key from it; the same on a local alias bound to it
// (`const h = battle.equippedHypothesis; h.origin`). Documented limits (not
// seen): a computed key held in a variable, a sibling handed to a helper that
// reads it under another name, and reads in a file that does not name
// `equippedHypothesis` at all.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ROOTS = ['api', 'src', 'scripts'];
const FIELD = '(evidenceRefs|origin)';

/** Every file naming the sibling at this build (7 Nov 2026, merged main d09603b2), with why it names it. */
const NAMERS = {
  'api/_utils/activationEvidence/constants.js': 'lists the sibling\'s three provenance paths (watchlistId, hypothesisVersion, contentHash)',
  'api/_utils/activationEvidence/pointer.js': 'ideaOf: watchlistId, hypothesisVersion, contentHash only',
  'api/_utils/agentBattleService.js': 'FENCED: the battle writer copies the sibling verbatim (the allowed reads)',
  'api/_utils/callRecords/candidate.js': 'resolveProvenance: watchlistId, hypothesisVersion, contentHash only',
  'api/_utils/compositionGenerationFence.js': 'a doc comment: activates the carried version in the creation transaction',
  'api/_utils/hypothesisRecords/carriage.js': 'resolves and freezes the sibling (siblingOf reads the version)',
  'api/_utils/hypothesisRecords/review.js': 'carryingBattleOf: watchlistId, hypothesisVersion, contentHash only',
  'api/_utils/tournamentBattleView.js': 'deletes the sibling from the league view',
  'api/agent/decide.js': 'FENCED: puts the carriage\'s resolved sibling into the agent context (P1b), whole',
  'api/tournament/battle-view.js': 'a comment: the league view route (tournamentBattleView deletes the sibling for it)',
  'src/config/featureFlags.js': 'flag documentation only',
};
/** The only allowed reads: the fenced battle writer's verbatim copy. */
const ALLOWED_READS = { 'api/_utils/agentBattleService.js': ['evidenceRefs', 'origin'] };

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '__fixtures__', '__mocks__'].includes(e.name)) walk(p, out); } else if (/\.(js|jsx|mjs|cjs)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(relative(REPO, p).replace(/\\/g, '/'));
  }
  return out;
}

/** The fields a source text reads from `equippedHypothesis` (directly, by destructuring, or through a local alias). */
export function siblingFieldReads(text) {
  const reads = new Set();
  const add = (re) => { for (const m of text.matchAll(re)) reads.add(m[m.length - 1]); };
  const memberOf = (subject) => [
    new RegExp(`\\b${subject}\\s*(?:\\?\\.|\\.)\\s*${FIELD}\\b`, 'g'),
    new RegExp(`\\b${subject}\\s*(?:\\?\\.)?\\[\\s*['"\`]${FIELD}['"\`]\\s*\\]`, 'g'),
  ];
  for (const re of memberOf('equippedHypothesis')) add(re);
  // Destructuring from it: `{ origin, ... } = <expr>equippedHypothesis` (not followed by a member access).
  for (const m of text.matchAll(/\{([^{}]*)\}\s*=\s*[^;\n]*\bequippedHypothesis\b(?!\s*(?:\?\.|\.|\[))/g)) {
    for (const f of m[1].matchAll(new RegExp(`(?:^|[\\s,])${FIELD}\\b`, 'g'))) reads.add(f[1]);
  }
  // A local alias bound to it: `const h = <expr>equippedHypothesis;` then `h.origin`.
  for (const m of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*\bequippedHypothesis\b(?!\s*(?:\?\.|\.|\[))/g)) {
    for (const re of memberOf(m[1].replace(/\$/g, '\\$'))) add(re);
    for (const d of text.matchAll(new RegExp(`\\{([^{}]*)\\}\\s*=\\s*${m[1].replace(/\$/g, '\\$')}\\b(?!\\s*(?:\\?\\.|\\.|\\[))`, 'g'))) {
      for (const f of d[1].matchAll(new RegExp(`(?:^|[\\s,])${FIELD}\\b`, 'g'))) reads.add(f[1]);
    }
  }
  return [...reads].sort();
}

const FILES = ROOTS.flatMap((r) => walk(resolve(REPO, r)));
const namers = FILES.filter((f) => /\bequippedHypothesis\b/.test(readFileSync(resolve(REPO, f), 'utf8'))).sort();

describe('who names the frozen sibling, and who reads its pass-through fields (ruling Q10)', () => {
  it('the scan is alive', () => {
    expect(FILES.length).toBeGreaterThan(500);
    expect(namers).toContain('api/_utils/agentBattleService.js');
  });
  it('every file naming equippedHypothesis is listed (a new one comes back for review)', () => {
    expect(namers).toEqual(Object.keys(NAMERS).sort());
  });
  it.each(namers.map((f) => [f]))('%s reads neither evidenceRefs nor origin from the sibling (bar the fenced copy)', (f) => {
    expect(siblingFieldReads(readFileSync(resolve(REPO, f), 'utf8'))).toEqual(ALLOWED_READS[f] ?? []);
  });
});

describe('the census bites — each read form, planted', () => {
  const PLANTS = {
    'a member access': ['const r = battle.equippedHypothesis.evidenceRefs;', ['evidenceRefs']],
    'an optional member access': ['if (battle?.equippedHypothesis?.origin === "x") {}', ['origin']],
    'a bracket access': ["const o = ctx.equippedHypothesis['origin'];", ['origin']],
    'a destructuring': ['const { statement, evidenceRefs } = battle.equippedHypothesis;', ['evidenceRefs']],
    'an alias then a member': ['const h = agentContext.equippedHypothesis;\nlog(h.origin);', ['origin']],
    'an alias then a destructuring': ['let sib = battle.equippedHypothesis;\nconst { origin: o } = sib;', ['origin']],
  };
  it.each(Object.entries(PLANTS))('%s', (_, [text, want]) => {
    expect(siblingFieldReads(text)).toEqual(want);
  });
  it('controls: other fields, other objects and plain mentions are not reads', () => {
    for (const text of [
      'const v = battle.equippedHypothesis.contentHash;',
      'const { watchlistId, hypothesisVersion } = battle.equippedHypothesis;',
      'const o = version.origin; const r = version.evidenceRefs;',
      'delete view.equippedHypothesis;',
      '// equippedHypothesis.origin is never read here',
    ]) {
      const got = siblingFieldReads(text);
      if (text.startsWith('//')) expect(got).toEqual(['origin']); // a comment is text: listed files keep such lines out
      else expect(got, text).toEqual([]);
    }
  });
});
