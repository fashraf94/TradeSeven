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
//   · it lists every non-test code file (fixtures and mocks included) that
//     names the sibling — `equippedHypothesis`, or the carriage's accessor
//     `carriedSiblingOf` — and a new one fails until it is reviewed and listed;
//   · it fails when any of them READS `evidenceRefs` or `origin` from the
//     sibling, or exposes the WHOLE sibling (stringified, spread, iterated,
//     re-hashed) — other than the allowed reads below — so a future reader
//     comes back for review.
// The allowed reads, each value-blind or the fenced copy:
//   · agentBattleService.js (FENCED) copies both fields verbatim;
//   · carriage.js re-hashes the frozen sibling (`contentHashOf(sibling) ===
//     sibling.contentHash`, review V2B-2): an integrity check that reads every
//     content field, whatever their values, and refuses a sibling that does
//     not match its own hash.
//
// How a read is found (review V2B-1 widened it): comments are stripped; a
// SUBJECT is `equippedHypothesis` (as a name or `['equippedHypothesis']`), a
// `carriedSiblingOf(...)` result, or any local bound to a subject — by `=`
// (any declarator, `let h; h = …`, alias of an alias, to a fixpoint) or by a
// destructuring rename (`{ equippedHypothesis: sib }`). A read is a member
// access (`.evidenceRefs`, `?.origin`, `['origin']`) on a subject, a
// destructuring of either key from a subject (shorthand, renamed, defaulted,
// or nested under `equippedHypothesis: { … }`), or a whole-object exposure of a
// subject (`JSON.stringify(…)`, `Object.entries/keys/values/assign(…)`, a
// spread `...s`, `for (… in|of s)`, `contentHashOf(s)` / `contentOf(s)`).
// Documented limits (not seen): a sibling handed to a helper that reads it
// under a parameter name in ANOTHER module, a computed key held in a variable,
// and a read in a file that names neither `equippedHypothesis` nor
// `carriedSiblingOf`.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ROOTS = ['api', 'src', 'scripts'];
const FIELDS = ['evidenceRefs', 'origin'];
const IDENT = '[A-Za-z_$][\\w$]*';
const esc = (s) => s.replace(/[$]/g, '\\$');

/** Every file naming the sibling at this build (7 Nov 2026, merged main d09603b2), with why it names it. */
const NAMERS = {
  'api/_utils/activationEvidence/constants.js': 'lists the sibling\'s three provenance paths (watchlistId, hypothesisVersion, contentHash)',
  'api/_utils/activationEvidence/pointer.js': 'ideaOf: watchlistId, hypothesisVersion, contentHash only',
  'api/_utils/agentBattleService.js': 'FENCED: the battle writer copies the sibling verbatim (allowed: evidenceRefs, origin)',
  'api/_utils/callRecords/candidate.js': 'resolveProvenance: watchlistId, hypothesisVersion, contentHash only',
  'api/_utils/compositionGenerationFence.js': 'carriedSiblingOf(battleDoc) as a presence test before the creation transaction',
  'api/_utils/hypothesisRecords/carriage.js': 'resolves and freezes the sibling; re-hashes it at creation (allowed: whole, value-blind)',
  'api/_utils/hypothesisRecords/review.js': 'carryingBattleOf: watchlistId, hypothesisVersion, contentHash only',
  'api/_utils/tournamentBattleView.js': 'deletes the sibling from the league view',
  'api/agent/decide.js': 'FENCED: puts the carriage\'s resolved sibling into the agent context (P1b), whole',
  'api/tournament/battle-view.js': 'a comment: the league view route (tournamentBattleView deletes the sibling for it)',
  'src/components/Research/Sheet/__fixtures__/sheetBattles.js': 'Research Modal Build C test fixture: writes a sibling with the eleven keys (no read)',
  'src/components/Research/Sheet/packs.js': 'Research Modal Build C (BC-9): ideaOf — statement, activation, invalidation, watchlistId, hypothesisVersion only (never evidenceRefs or origin)',
  'src/config/featureFlags.js': 'flag documentation only',
};
/** The only allowed reads. */
const ALLOWED_READS = {
  'api/_utils/agentBattleService.js': ['evidenceRefs', 'origin'],
  'api/_utils/hypothesisRecords/carriage.js': ['whole'],
};

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (/\.(js|jsx|mjs|cjs)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(relative(REPO, p).replace(/\\/g, '/'));
  }
  return out;
}

/** The source with its comments blanked (block comments, and `//` comments that start a line or follow whitespace or punctuation). */
export function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, '$1');
}

const NAMES_SIBLING_RE = /\bequippedHypothesis\b|\bcarriedSiblingOf\b/;

/** The fields a source text reads from the sibling, plus 'whole' when it exposes the sibling whole. */
export function siblingFieldReads(raw) {
  const text = stripComments(raw);
  const reads = new Set();
  const subjects = [
    '\\bequippedHypothesis\\b',
    `\\[\\s*['"\`]equippedHypothesis['"\`]\\s*\\]`,
    '\\bcarriedSiblingOf\\s*\\([^()]*\\)',
  ];
  const NOT_MEMBER = '(?!\\s*(?:\\?\\.|\\.|\\[))';
  // Aliases, to a fixpoint: `name = <expr holding a subject as a value>` (any declarator or plain assignment), and a destructuring rename.
  for (let grown = true; grown;) {
    grown = false;
    const subj = `(?:${subjects.join('|')})`;
    const found = new Set();
    for (const m of text.matchAll(new RegExp(`(${IDENT})\\s*=(?![=>])\\s*([^;,\\n]*)`, 'g'))) {
      if (new RegExp(`${subj}${NOT_MEMBER}`).test(m[2])) found.add(m[1]);
    }
    for (const m of text.matchAll(new RegExp(`(?:\\bequippedHypothesis|['"\`]equippedHypothesis['"\`])\\s*:\\s*(${IDENT})\\b${NOT_MEMBER}(?!\\s*\\()`, 'g'))) found.add(m[1]);
    for (const name of found) {
      if (FIELDS.includes(name)) continue;
      const tok = `\\b${esc(name)}\\b`;
      if (!subjects.includes(tok)) { subjects.push(tok); grown = true; }
    }
  }
  const subj = `(?:${subjects.join('|')})`;
  const field = `(${FIELDS.join('|')})`;
  const add = (re) => { for (const m of text.matchAll(re)) reads.add(m[1]); };
  // Member reads.
  add(new RegExp(`${subj}\\s*(?:\\?\\.|\\.)\\s*${field}\\b`, 'g'));
  add(new RegExp(`${subj}\\s*(?:\\?\\.)?\\[\\s*['"\`]${field}['"\`]\\s*\\]`, 'g'));
  // Destructuring from a subject: `{ …origin… } = <expr ending in a subject>`.
  for (const m of text.matchAll(new RegExp(`\\{([^{}]*)\\}\\s*=(?![=>])\\s*[^;\\n]*${subj}${NOT_MEMBER}`, 'g'))) {
    for (const f of m[1].matchAll(new RegExp(`(?:^|[\\s,{])${field}\\b`, 'g'))) reads.add(f[1]);
  }
  // A nested pattern (or literal) under the sibling's key: `equippedHypothesis: { …evidenceRefs… }`.
  for (const m of text.matchAll(/equippedHypothesis['"`]?\s*:\s*\{([^{}]*)\}/g)) {
    for (const f of m[1].matchAll(new RegExp(`(?:^|[\\s,{])${field}\\b`, 'g'))) reads.add(f[1]);
  }
  // Whole-object exposure.
  const whole = [
    `\\bJSON\\.stringify\\s*\\([^;\\n]*${subj}${NOT_MEMBER}`,
    `\\bObject\\.(?:entries|keys|values|assign|getOwnPropertyNames)\\s*\\([^;\\n]*${subj}${NOT_MEMBER}`,
    `\\.\\.\\.\\s*(?:[\\w$?.\\[\\]'"\`]*?)${subj}${NOT_MEMBER}`,
    `\\bfor\\s*\\([^;)]*\\b(?:in|of)\\s+[^;)]*${subj}${NOT_MEMBER}`,
    `\\bcontent(?:HashOf|Of)\\s*\\(\\s*[^;\\n)]*${subj}${NOT_MEMBER}`,
  ];
  if (whole.some((w) => new RegExp(w).test(text))) reads.add('whole');
  return [...reads].sort();
}

const FILES = ROOTS.flatMap((r) => walk(resolve(REPO, r)));
const namers = FILES.filter((f) => NAMES_SIBLING_RE.test(readFileSync(resolve(REPO, f), 'utf8'))).sort();

describe('who names the frozen sibling, and who reads its pass-through fields (ruling Q10)', () => {
  it('the scan is alive (fixtures and mocks included)', () => {
    expect(FILES.length).toBeGreaterThan(500);
    expect(FILES.some((f) => f.includes('/__fixtures__/'))).toBe(true);
    expect(namers).toContain('api/_utils/agentBattleService.js');
  });
  it('every file naming equippedHypothesis or carriedSiblingOf is listed (a new one comes back for review)', () => {
    expect(namers).toEqual(Object.keys(NAMERS).sort());
  });
  it.each(namers.map((f) => [f]))('%s reads neither evidenceRefs nor origin from the sibling, nor exposes it whole (bar the allowed reads)', (f) => {
    expect(siblingFieldReads(readFileSync(resolve(REPO, f), 'utf8'))).toEqual(ALLOWED_READS[f] ?? []);
  });
  it('the allowed reads are really there (the census is not vacuous on them)', () => {
    const svc = readFileSync(resolve(REPO, 'api/_utils/agentBattleService.js'), 'utf8');
    expect(svc).toMatch(/evidenceRefs: options\.equippedHypothesis\.evidenceRefs,/);
    expect(svc).toMatch(/origin: options\.equippedHypothesis\.origin,/);
    expect(readFileSync(resolve(REPO, 'api/_utils/hypothesisRecords/carriage.js'), 'utf8')).toMatch(/contentHashOf\(sibling\) === sibling\.contentHash/);
  });
});

describe('the census bites — each read form, planted (review V2B-1 included)', () => {
  const PLANTS = {
    'a member access': ['const r = battle.equippedHypothesis.evidenceRefs;', ['evidenceRefs']],
    'an optional member access': ['if (battle?.equippedHypothesis?.origin === "x") {}', ['origin']],
    'a bracket access': ["const o = ctx.equippedHypothesis['origin'];", ['origin']],
    'a bracket subject': ['const o = agentContext["equippedHypothesis"].origin;', ['origin']],
    'a destructuring': ['const { statement, evidenceRefs } = battle.equippedHypothesis;', ['evidenceRefs']],
    'a renamed, defaulted destructuring': ['const { origin: o = null } = battle?.agentContext?.equippedHypothesis ?? {};', ['origin']],
    'an alias then a member': ['const h = agentContext.equippedHypothesis;\nlog(h.origin);', ['origin']],
    'an alias then a destructuring': ['let sib = battle.equippedHypothesis;\nconst { origin: o } = sib;', ['origin']],
    'a rename-destructure alias': ["const { equippedHypothesis: sib } = battle?.agentContext ?? {};\nif (sib?.origin === 'shared_research') {}", ['origin']],
    'a second declarator': ['const _z = 0, sib2 = battle.agentContext.equippedHypothesis;\nif (sib2?.origin) {}', ['origin']],
    'a nested destructure': ['const { agentContext: { equippedHypothesis: { evidenceRefs: _refs = [] } = {} } = {} } = battle;', ['evidenceRefs']],
    'the carriage accessor into any local': ["const idea = carriedSiblingOf(battleDoc);\nif (idea?.origin === 'shared_research') throw new Error('x');", ['origin']],
    'an alias of an alias': ['const a = battle.equippedHypothesis;\nconst b = a;\nconst c = b?.evidenceRefs;', ['evidenceRefs']],
    'a later assignment': ['let h;\nh = battle.agentContext.equippedHypothesis;\nuse(h.origin);', ['origin']],
    'a comment between the name and the field': ['const o = battle.equippedHypothesis /* note */ .origin;', ['origin']],
    'a line comment between the name and the field': ['const o = battle.equippedHypothesis // note\n  .origin;', ['origin']],
    'JSON.stringify of the sibling': ['const t = JSON.stringify(battle?.agentContext?.equippedHypothesis);', ['whole']],
    'Object.entries of the sibling': ['for (const [k, v] of Object.entries(battle.equippedHypothesis)) use(k, v);', ['whole']],
    'a spread of the sibling': ['const copy = { ...battle.agentContext.equippedHypothesis };', ['whole']],
    'for…in over the sibling': ['for (const k in battle.equippedHypothesis) use(k);', ['whole']],
    're-hashing the sibling through an alias': ['const s = battle.agentContext.equippedHypothesis;\nconst ok = contentHashOf(s) === s.contentHash;', ['whole']],
  };
  it.each(Object.entries(PLANTS))('%s', (_, [text, want]) => {
    expect(siblingFieldReads(text)).toEqual(want);
  });
  it('controls: other fields, other objects, presence tests, deletes and comments are not reads', () => {
    for (const text of [
      'const v = battle.equippedHypothesis.contentHash;',
      'const { watchlistId, hypothesisVersion } = battle.equippedHypothesis;',
      'const o = version.origin; const r = version.evidenceRefs;',
      'delete view.equippedHypothesis;',
      '// equippedHypothesis.origin is never read here',
      '/* battle.equippedHypothesis.evidenceRefs */ const x = 1;',
      "if (carriedSiblingOf(battleDoc)) throw new Error('needs a transaction');",
      "const url = 'https://example.com/a'; const s = battle.equippedHypothesis.statement;",
    ]) expect(siblingFieldReads(text), text).toEqual([]);
  });
});
