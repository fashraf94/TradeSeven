// api/forge/shared-research.universeCallSites.test.js
//
// Research universe Build 3b, build prompt sections 5.2 and 9: EVERY CALL SITE IS GIVEN THE SESSION'S UNIVERSE. "No
// helper keeps a silent default on a research session; a test fails if a call site is missed." Each helper of section 2
// point 2 takes a universe that defaults to the game's, so a call that leaves it out still runs — on the wrong list, and
// silently. This file reads the route and the helpers' own modules with a real parser (@babel/parser) and checks every
// call of every universe-taking function: its arguments name the session's universe (`universe`, `universeOf(...)`), or
// — at the few places that deliberately ask the GAME's list — `gameUniverse` by name. The route's names go through the
// session's name source (namesFor, with the session), never readNames directly; companiesFor and storedRowsFor take the
// session.
//
// Mutation-proved in the file itself: for every call site found, a copy with that one site's universe removed is
// flagged, at that site.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

/** The universe-taking functions of section 2 point 2, and the ones this build added. */
const TAKES_UNIVERSE = new Set([
  'resolveSymbol', 'nameAsTickerOf', 'companiesOf', 'namesInScopeOf', 'openingFindingsOf', 'dropTopicOf', 'strayTickersOf', 'maskStrayTickers',
  'retrievalLabelOf', 'validateFrame', 'validateStepTurn', 'validateBuildTurn', 'lineFailOf', 'namesAListedCompany', 'isSameCompany',
  'buildStepSystemPrompt', 'buildBuildSystemPrompt', 'renderStepUser', 'renderBuildUser', 'renderFrameUser', 'targetBlockOf',
  // the route's own wrappers
  'candidateSymbolsOf', 'cardCtxIn', 'targetOf',
]);
/** Calls that carry the session itself (the ROUTE's wrappers that derive the universe and the name source from it; store.js's own companiesFor is a callback the route hands it). */
const TAKES_SESSION = { companiesFor: 3, namesFor: 3, storedRowsFor: 2 };

/** Every call of a named function in `src`: { name, line, args (source text), argCount }. */
function callsIn(src) {
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  const out = [];
  const stack = [ast.program];
  while (stack.length) {
    const n = stack.pop();
    if (!n || typeof n !== 'object') continue;
    if (Array.isArray(n)) { for (const x of n) stack.push(x); continue; }
    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier') {
      const args = n.arguments.map((a) => src.slice(a.start, a.end));
      out.push({ name: n.callee.name, line: n.loc.start.line, args: args.join(', '), argList: args, argCount: n.arguments.length, start: n.start, end: n.end });
    }
    for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'start' && k !== 'end') stack.push(n[k]);
  }
  return out.sort((a, b) => a.start - b.start);
}

const ROUTE = 'api/forge/shared-research.js';
const NAMES_THE_SESSION_UNIVERSE = /\buniverse\b|\buniverseOf\(/;
/** The places that ask the GAME's list on purpose (each named in its module's comments): `gameUniverse` by name. */
const NAMES_THE_GAME = /\bgameUniverse\b/;
/** validateBuildTurn hands its whole context (which carries `universe`) to B1's validator. */
const CARRIES_CONTEXT = (file, c) => file.endsWith('thesisSchema.js') && c.name === 'validateStepTurn' && /\bctx\)?$/.test(c.args);

/** The calls in one module that do not name a universe (or the session, for the session-taking wrappers). */
function missesIn(file, src) {
  const misses = [];
  for (const c of callsIn(src)) {
    if (TAKES_UNIVERSE.has(c.name)) {
      if (NAMES_THE_SESSION_UNIVERSE.test(c.args) || NAMES_THE_GAME.test(c.args) || CARRIES_CONTEXT(file, c)) continue;
      misses.push(`${file}:${c.line} ${c.name}(${c.args.slice(0, 60)})`);
    } else if (file === ROUTE && Object.hasOwn(TAKES_SESSION, c.name) && c.argCount < TAKES_SESSION[c.name]) {
      misses.push(`${file}:${c.line} ${c.name} without the session`);
    }
  }
  return misses;
}

const MODULES = [
  ROUTE,
  'api/_utils/sharedResearch/stepSchema.js', 'api/_utils/sharedResearch/opening.js', 'api/_utils/sharedResearch/thesisSchema.js',
  'api/_utils/sharedResearch/thesisWords.js', 'api/_utils/sharedResearch/stepPrompt.js', 'api/_utils/sharedResearch/companies.js',
  // review L1-4: the card's free action (store.js applyCard) and Explore's read (explore.js) too
  'api/_utils/sharedResearch/store.js', 'api/_utils/sharedResearch/explore.js',
];

describe('every call of a universe-taking function names the session\'s universe (section 5.2)', () => {
  it.each(MODULES)('%s', (file) => {
    expect(missesIn(file, read(file))).toEqual([]);
  });
  it('the route calls each of section 2 point 2\'s helpers, and every one is checked (the scan is alive)', () => {
    const names = callsIn(read(ROUTE)).map((c) => c.name);
    for (const n of ['resolveSymbol', 'companiesOf', 'namesInScopeOf', 'openingFindingsOf', 'dropTopicOf', 'validateFrame', 'validateStepTurn', 'validateBuildTurn',
      'buildStepSystemPrompt', 'buildBuildSystemPrompt', 'renderStepUser', 'renderBuildUser', 'renderFrameUser', 'targetBlockOf', 'candidateSymbolsOf', 'cardCtxIn']) {
      expect(names, n).toContain(n);
    }
    // the counts at this build: a new site is checked as it lands, and a removed one is noticed here
    const count = (n) => names.filter((x) => x === n).length;
    expect({ openingFindingsOf: count('openingFindingsOf'), companiesOf: count('companiesOf'), resolveSymbol: count('resolveSymbol'), cardCtxIn: count('cardCtxIn'), candidateSymbolsOf: count('candidateSymbolsOf') })
      .toEqual({ openingFindingsOf: 3, companiesOf: 4, resolveSymbol: 2, cardCtxIn: 2, candidateSymbolsOf: 2 });
  });
  it("the route reads names only through the session's name source (namesFor), never readNames directly", () => {
    const calls = callsIn(read(ROUTE));
    expect(calls.filter((c) => c.name === 'readNames')).toEqual([]);
    expect(calls.filter((c) => c.name === 'namesFor').length).toBeGreaterThanOrEqual(6);
  });
  it('the deliberate game-list asks are exactly the named ones', () => {
    const gameAsks = MODULES.flatMap((file) => callsIn(read(file)).filter((c) => TAKES_UNIVERSE.has(c.name) && NAMES_THE_GAME.test(c.args) && !NAMES_THE_SESSION_UNIVERSE.test(c.args)).map((c) => `${file.split('/').pop()} ${c.name}`));
    expect(gameAsks.sort()).toEqual(['companies.js resolveSymbol', 'thesisSchema.js resolveSymbol']);
  });
});

describe('the check catches a missed call site (one mutant per site)', () => {
  for (const file of MODULES) {
    const src = read(file);
    const sites = callsIn(src).filter((c) => (TAKES_UNIVERSE.has(c.name) && NAMES_THE_SESSION_UNIVERSE.test(c.args)) || (file === ROUTE && Object.hasOwn(TAKES_SESSION, c.name) && c.argCount >= TAKES_SESSION[c.name]));
    it(`${file}: every one of its ${sites.length} sites, its universe removed, is flagged`, () => {
      expect(sites.length).toBeGreaterThan(0);
      for (const site of sites) {
        const body = src.slice(site.start, site.end);
        let mutated;
        if (TAKES_UNIVERSE.has(site.name)) mutated = body.replace(/universeOf\([^()]*\)/g, 'null').replace(/\buniverse\b(?!Of)/g, 'nothing');
        else mutated = `${site.name}(${site.argList.slice(0, TAKES_SESSION[site.name] - 1).join(', ')})`; // the session dropped
        const mutant = src.slice(0, site.start) + mutated + src.slice(site.end);
        const misses = missesIn(file, mutant);
        expect(misses.length, `${file}:${site.line} ${site.name} — mutant not flagged`).toBeGreaterThan(0);
        expect(misses.some((m) => m.startsWith(`${file}:${site.line} ${site.name}`)), `${file}:${site.line} ${site.name}`).toBe(true);
      }
    });
  }
});
