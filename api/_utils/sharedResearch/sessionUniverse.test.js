// api/_utils/sharedResearch/sessionUniverse.test.js
//
// Research universe Build 3b, build prompt sections 5.1, 5.2 and 5.5 to 5.8: THE SESSION'S UNIVERSE AND IDENTITY.
//   - the switch, read at call time; 'founder' admits the founder list only; anything else is 'off';
//   - the stamp, and universeOf: a session with no stamp is a game-list session, handed gameUniverse itself;
//   - the name lookup (section 5.6): exactly one match gives the symbol; none or more than one, no symbol;
//   - the capitals rule (section 5.7): a table of 30 word-like directory symbols, each through the real step validator —
//     ordinary prose that uses the word names no company; the word in capitals, or the symbol with the company's real
//     name, does;
//   - eligibility (section 5.8): 'research' for a research-only company, never 'eligible';
//   - every row also runs the same answer on the game list, which behaves exactly as before.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real, unmocked imports are the runtime guard for these modules' graphs.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  universeModeNow, researchListFor, universeStampFor, isResearchSession, universeOf, RESEARCH_SESSION_UNIVERSE, RESEARCH_STAMP,
  lookupName, lookupKeyOf, eligibilityOf, researchOnlyOf,
} from './sessionUniverse.js';
import { gameUniverse, companiesOf, isSameCompany, nameAsTickerOf, resolveSymbol } from './companies.js';
import { validateStepTurn } from './stepSchema.js';
import { validateBuildTurn } from './thesisSchema.js';
import { emptyCard } from './thesis.js';
import { dataCenterRecord } from './__fixtures__/records.js';
import { researchNameOf } from '../researchUniverse.js';
import { RESEARCH_DIRECTORY } from '../researchDirectory.js';

const flags = vi.hoisted(() => ({ mode: 'off', throws: false }));
vi.mock('../../../src/config/sharedResearchFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    get SHARED_RESEARCH_UNIVERSE_MODE() { if (flags.throws) throw new Error('unreadable'); return flags.mode; },
  };
});

afterEach(() => { flags.mode = 'off'; flags.throws = false; delete process.env.MANDATE_FOUNDER_UIDS; });

const R = RESEARCH_SESSION_UNIVERSE;

describe('the switch (section 5.1): read at call time; any other value is off', () => {
  it.each([['off', 'off'], ['founder', 'founder'], ['on', 'on'], ['ON', 'off'], ['allowlist', 'off'], [undefined, 'off'], [true, 'off']])('%j reads %s', (v, out) => {
    flags.mode = v;
    expect(universeModeNow()).toBe(out);
  });
  it('a read that throws is off', () => {
    flags.throws = true;
    expect(universeModeNow()).toBe('off');
    expect(researchListFor('u1')).toBe(false);
  });
  it("'off': nobody; 'on': every uid; 'founder': only a uid on the founder list, read now", () => {
    process.env.MANDATE_FOUNDER_UIDS = 'f1, f2';
    flags.mode = 'off';
    expect([researchListFor('f1'), researchListFor('u1')]).toEqual([false, false]);
    flags.mode = 'on';
    expect([researchListFor('f1'), researchListFor('u1')]).toEqual([true, true]);
    flags.mode = 'founder';
    expect([researchListFor('f1'), researchListFor('f2'), researchListFor('u1')]).toEqual([true, true, false]);
    process.env.MANDATE_FOUNDER_UIDS = 'u1';
    expect([researchListFor('f1'), researchListFor('u1')]).toEqual([false, true]);
    delete process.env.MANDATE_FOUNDER_UIDS;
    expect(researchListFor('u1')).toBe(false);
  });
  it('no uid is never admitted', () => {
    flags.mode = 'on';
    for (const uid of [undefined, null, '', 7]) expect(researchListFor(uid)).toBe(false);
  });
});

describe('the stamp and universeOf (section 5.2)', () => {
  it("the stamp is 'research' or null; a session with no stamp is a game-list session, handed gameUniverse itself", () => {
    flags.mode = 'on';
    expect(universeStampFor('u1')).toBe(RESEARCH_STAMP);
    flags.mode = 'off';
    expect(universeStampFor('u1')).toBeNull();
    expect(universeOf({})).toBe(gameUniverse);
    expect(universeOf(null)).toBe(gameUniverse);
    expect(universeOf({ universe: 'game' })).toBe(gameUniverse);
    expect(universeOf({ universe: 'research' })).toBe(R);
    expect(isResearchSession({ universe: 'research' })).toBe(true);
  });
  it('the research universe holds the 228 and the directory; the game universe has none of its hooks', () => {
    expect([R.has('NVDA'), R.has('GLW'), R.has('ZZZZ'), R.retired('MMC')]).toEqual([true, true, false, true]);
    for (const k of ['research', 'strictCase', 'lookupName', 'isEverydayNameOf', 'eligibilityOf']) expect(Object.hasOwn(gameUniverse, k), k).toBe(false);
    expect(Object.isFrozen(R)).toBe(true);
  });
});

describe('the name lookup (section 5.6)', () => {
  it('exactly one match gives the symbol: Corning, Arista Networks, Taiwan Semiconductor Manufacturing, Ambev (an ADR\'s tail dropped)', () => {
    expect(lookupName('Corning')).toBe('GLW');
    expect(lookupName('Arista Networks')).toBe('ANET');
    expect(lookupName('Taiwan Semiconductor Manufacturing')).toBe('TSM');
    expect(lookupName('Ambev')).toBe('ABEV');
  });
  it('a name matching two directory companies resolves to neither (share classes, two banks): never a guess', () => {
    for (const name of ['Zillow', 'Brown-Forman', 'Moog', 'Heico', 'First Bancorp', 'Liberty Global']) expect(lookupName(name), name).toBeNull();
  });
  it('a name matching none resolves to nothing; a game company is not in the directory (found only by an everyday name)', () => {
    for (const name of ['Acme Widgets', 'Nvidia', 'Apple', 'glass', '', null, 'Inc.']) expect(lookupName(name), String(name)).toBeNull();
    expect(lookupName('Google')).toBe('GOOGL');
  });
  it('a near name is not the name: "Apple" is never Apple Hospitality REIT; "Arista" alone is an everyday name, "Taiwan" is nothing', () => {
    expect(researchNameOf('APLE')).toMatch(/^Apple Hospitality/);
    expect(lookupName('Apple')).toBeNull();
    expect(lookupName('Taiwan')).toBeNull();
    expect(lookupName('Arista')).toBe('ANET');
  });
  it('the key: core name, share-type tails dropped, case and punctuation ignored', () => {
    expect(lookupKeyOf('Corning Incorporated')).toBe('corning');
    expect(lookupKeyOf('Arm Holdings plc American Depositary Shares')).toBe('arm');
    expect(lookupKeyOf('Accelevation Holdings Corp. Class A Ordinary Shares')).toBe('accelevation');
    expect(lookupKeyOf('J&J')).toBe('j&j');
    expect(lookupKeyOf('  ')).toBe('');
  });
});

// ── identity through the real step validator ──────────────────────────────────────────────────────────────────────

const READ = '2026-11-27T15:00:00.000Z';
const NOW = '2026-11-27T15:00:05.000Z';
const PARTNER = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const ITEMS = [{ index: 0, url: 'https://n.example/glass', title: 'Glass for data centers', host: 'n.example', publishedDate: '2026-11-20T00:00:00.000Z' }];
let n = 0;
const ctxFor = (universe, names = {}) => ({
  record: dataCenterRecord('refresh'), items: ITEMS, readAt: READ, partnerExchangeId: PARTNER, partnerAt: NOW, nowIso: NOW,
  mintFindingId: () => `f_74000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, names, universe,
});
const turnOf = ({ fact, symbolCandidate = null, companyName = null, kind = 'relationship' }) => ({
  reply: 'One finding.',
  findings: [{ tempId: 't1', kind, fact, symbolCandidate, companyName, support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }],
  summary: null, lines: { support: 't1', complication: null, missing: null }, nextAction: { label: 'Check the share of sales', purpose: 'Significance is the weakest link.' },
  companies: companyName ? [{ companyName, symbolCandidate, role: 'Supplier', relationshipRef: 't1', openRef: null, claim: null }] : [],
});
/** The step's one finding's symbol, and the companies the record then supports (eligibility included). */
function run(universe, answer, names = {}) {
  const out = validateStepTurn(answer, ctxFor(universe, names));
  expect(out.ok, JSON.stringify(out)).toBe(true);
  const f = out.findings[0];
  const record = { ...dataCenterRecord('refresh'), findings: [...dataCenterRecord('refresh').findings, ...out.findings] };
  const supported = companiesOf(record, { universe, names }).supported.filter((c) => c.relationshipFindingId === f.findingId);
  return { symbol: f.symbol, supported, notes: out.notes };
}

describe('Corning in words, no symbol (sections 5.6 and 9)', () => {
  const answer = turnOf({ fact: 'Corning supplies the glass for the fiber inside AI data centers.', companyName: 'Corning' });
  it('a research session: a verified relationship carrying GLW, Corning supported and marked research', () => {
    const r = run(R, answer, { GLW: 'Corning Incorporated' });
    expect(r.symbol).toBe('GLW');
    expect(r.supported).toEqual([expect.objectContaining({ symbol: 'GLW', name: 'Corning Incorporated', eligibility: 'research' })]);
  });
  it('the game list: as before, no symbol (Corning stays a lead)', () => {
    expect(run(gameUniverse, answer).symbol).toBeNull();
  });
  it('the name is checked against the stored name: a research record\'s own name works as the directory\'s does', () => {
    expect(run(R, answer, { GLW: 'Corning Inc' }).symbol).toBe('GLW');
    expect(run(R, answer, {}).symbol).toBe('GLW'); // no name read: the directory's own name still identifies a research company
  });
});

describe('everyday names (section 5.5)', () => {
  it('"Google" resolves to GOOGL on a research session; a game stock stays eligible', () => {
    const r = run(R, turnOf({ fact: 'Google designs its own accelerator chips.', companyName: 'Google' }), { GOOGL: 'Alphabet Inc' });
    expect(r.symbol).toBe('GOOGL');
    expect(r.supported[0]).toMatchObject({ symbol: 'GOOGL', eligibility: 'eligible' });
  });
  it('"Google" with the symbol GOOGL is Alphabet on a research session; on the game list, as before, a mismatch', () => {
    const answer = turnOf({ fact: 'Google designs its own accelerator chips.', symbolCandidate: 'GOOGL', companyName: 'Google' });
    expect(run(R, answer, { GOOGL: 'Alphabet Inc' }).symbol).toBe('GOOGL');
    const g = run(gameUniverse, answer, { GOOGL: 'Alphabet Inc' });
    expect(g.symbol).toBeNull();
    expect(g.notes).toContain('identity_mismatch:GOOGL');
  });
  it('isSameCompany on the game list never reads an everyday name', () => {
    expect(isSameCompany('Google', { symbol: 'GOOGL', name: 'Alphabet Inc' })).toBe(false);
    expect(isSameCompany('Google', { symbol: 'GOOGL', name: 'Alphabet Inc' }, R)).toBe(true);
  });
});

describe('a wrong symbol offered for a research company is dropped by the name check (section 5.6)', () => {
  it('GLW offered for "Arista Networks": no symbol, identity_mismatch', () => {
    const r = run(R, turnOf({ fact: 'Arista sells the switches for AI clusters.', symbolCandidate: 'GLW', companyName: 'Arista Networks' }), { GLW: 'Corning Incorporated' });
    expect(r.symbol).toBeNull();
    expect(r.notes).toContain('identity_mismatch:GLW');
  });
  it('the right symbol with the company\'s name is kept: ANET for "Arista Networks"', () => {
    expect(run(R, turnOf({ fact: 'Arista sells the switches for AI clusters.', symbolCandidate: 'ANET', companyName: 'Arista Networks' }), { ANET: 'Arista Networks' }).symbol).toBe('ANET');
  });
});

describe('two companies with similar names (lens 2)', () => {
  it('"HP" is HP Inc\'s name and Helmerich & Payne\'s symbol: as a name, neither company; HPQ with "HP Inc" is HP Inc', () => {
    const names = { HP: researchNameOf('HP'), HPQ: researchNameOf('HPQ') };
    const asName = run(R, turnOf({ fact: 'HP sells the PCs offices buy.', companyName: 'HP' }), names);
    expect(asName.symbol).toBeNull();
    expect(asName.notes).toContain('identity_ambiguous:HP|HPQ');
    expect(run(R, turnOf({ fact: 'HP sells the PCs offices buy.', symbolCandidate: 'HP', companyName: 'HP' }), names).symbol).toBeNull();
    expect(run(R, turnOf({ fact: 'HP Inc sells the PCs offices buy.', symbolCandidate: 'HPQ', companyName: 'HP Inc' }), names).symbol).toBe('HPQ');
  });
  it('"Apple" in words is never Apple Hospitality REIT (APLE) on a research session', () => {
    expect(run(R, turnOf({ fact: 'Apple buys chips for its phones.', companyName: 'Apple' }), { APLE: researchNameOf('APLE') }).symbol).toBeNull();
  });
  it('APLE offered with "Apple" is dropped: Apple is not Apple Hospitality REIT', () => {
    expect(run(R, turnOf({ fact: 'Apple buys chips for its phones.', symbolCandidate: 'APLE', companyName: 'Apple' }), { APLE: researchNameOf('APLE') }).symbol).toBeNull();
  });
});

// Section 5.7: 30 directory symbols that are ordinary words. For each, the title-case word is no directory company's
// name (checked first), so prose that uses it names no company; the word in capitals, and the symbol with the company's
// real name, each name the company.
const WORDS = ['CASH', 'KEY', 'OPEN', 'ALL', 'AN', 'BILL', 'CAR', 'COLD', 'DOC', 'EAT', 'EYE', 'FAST', 'FIVE', 'FUN', 'GO', 'HAS', 'HOPE', 'IT',
  'KEYS', 'LIFE', 'MAIN', 'MAN', 'MOD', 'OUT', 'PAY', 'REAL', 'RUN', 'SKY', 'TEAM', 'TECH', 'TEN', 'WAY', 'YOU', 'CALM', 'FLY', 'STEP', 'SITE'];
/** Neutral fact text: names no company in capitals, so the step's ticker scan never decides a row. */
const NEUTRAL = 'The company sells to data-center builders.';
const title = (w) => w.charAt(0) + w.slice(1).toLowerCase();
describe('symbols that are also words (section 5.7)', () => {
  it('the table: at least 25 word-like directory symbols, none of them a game stock, none a directory company\'s name as a word', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(25);
    for (const w of WORDS) {
      expect(RESEARCH_DIRECTORY[w], w).toBeDefined();
      expect(gameUniverse.has(w), w).toBe(false);
      expect(lookupName(title(w)), w).toBeNull();
    }
  });
  it.each(WORDS)('%s: ordinary prose naming it in words names no company; in capitals, or as its symbol with its real name, it does', (w) => {
    const name = researchNameOf(w);
    const names = { [w]: name };
    const prose = turnOf({ fact: `${title(w)} matters more than price for these buyers.`, companyName: title(w), kind: 'product' });
    const r = run(R, prose, names);
    expect(r.symbol, `${w} prose`).toBeNull();
    expect(nameAsTickerOf(title(w), R)).toBeNull();
    // the same prose with no company named at all: no symbol either
    expect(run(R, turnOf({ fact: `${title(w)} matters more than price for these buyers.`, kind: 'product' }), names).symbol).toBeNull();
    // the word in capitals as the company named: the company
    expect(run(R, turnOf({ fact: NEUTRAL, companyName: w }), names).symbol, `${w} capitals`).toBe(w);
    // the symbol with the company's real name: the company
    expect(run(R, turnOf({ fact: NEUTRAL, symbolCandidate: w, companyName: name }), names).symbol, `${w} real name`).toBe(w);
  });
  it.each(['A', 'U'])('%s, a single letter: as a company name, in words or capitals, no company; as its symbol with its real name, the company', (w) => {
    const names = { [w]: researchNameOf(w) };
    expect(run(R, turnOf({ fact: NEUTRAL, companyName: w, kind: 'product' }), names).symbol).toBeNull();
    expect(nameAsTickerOf(w, R)).toBeNull();
    expect(run(R, turnOf({ fact: NEUTRAL, symbolCandidate: w, companyName: researchNameOf(w) }), names).symbol).toBe(w);
  });
  it('ON is the symbol of ON Semiconductor and the name of On Holding, and Post is the name of Post Holdings: a word that is a company name is that company, and both is neither', () => {
    expect(lookupName('On')).toBe('ONON');
    const on = run(R, turnOf({ fact: NEUTRAL, companyName: 'ON' }), { ON: researchNameOf('ON'), ONON: researchNameOf('ONON') });
    expect(on.symbol).toBeNull();
    expect(on.notes).toContain('identity_ambiguous:ON|ONON');
    expect(run(R, turnOf({ fact: NEUTRAL, symbolCandidate: 'ON', companyName: researchNameOf('ON') }), { ON: researchNameOf('ON') }).symbol).toBe('ON');
    expect(lookupName('Post')).toBe('POST');
  });
  it('the game list keeps its own behaviour: a game symbol that is a word ("Well", WELL) still reads as before there', () => {
    expect(gameUniverse.has('WELL')).toBe(true);
    expect(nameAsTickerOf('Well', gameUniverse)).toBe('WELL');
    expect(nameAsTickerOf('Well', R)).toBeNull();
    expect(nameAsTickerOf('WELL', R)).toBe('WELL');
    expect(isSameCompany('Well', { symbol: 'WELL', name: 'Welltower Inc' })).toBe(true); // the game list, as before
    expect(isSameCompany('Well', { symbol: 'WELL', name: 'Welltower Inc' }, R)).toBe(false);
  });
  it('a ticker-shaped word on neither list still fails the step (stray_ticker), on a research session too', () => {
    const out = validateStepTurn(turnOf({ fact: 'QZXW supplies the glass.', companyName: 'Corning' }), ctxFor(R, { GLW: 'Corning Incorporated' }));
    expect(out).toMatchObject({ ok: false, rule: 'stray_ticker' });
    const game = validateStepTurn(turnOf({ fact: 'GLW supplies the glass.' }), ctxFor(gameUniverse));
    expect(game).toMatchObject({ ok: false, rule: 'stray_ticker' });
    expect(validateStepTurn(turnOf({ fact: 'GLW supplies the glass.' }), ctxFor(R)).ok).toBe(true);
  });
  it('a single capital letter opening a sentence never reads as a company in a dead end\'s reply ("A" is Agilent in the directory)', () => {
    const card = emptyCard();
    const ctx = { ...ctxFor(R), card, goal: 'find_names', part: null };
    const reply = 'A supplier was mentioned, but none had a sourced connection.';
    const out = validateBuildTurn({ reply, findings: [], companies: [], themeSuggestion: '', segments: [], why: null, wrongIfOptions: [], timeFramePick: null, pick: null }, ctx);
    expect(out.ok).toBe(true);
    expect(out.notes).not.toContain('reply_replaced:dead_end');
    expect(resolveSymbol('A', R)).toBe('A');
  });
});

describe('eligibility stays the game\'s (section 5.8)', () => {
  it("'eligible' for one of the 228; 'research' for a research-only company; 'outside' otherwise — never eligible for research", () => {
    expect(eligibilityOf('NVDA')).toBe('eligible');
    expect(eligibilityOf('GLW')).toBe('research');
    expect(eligibilityOf('TSM')).toBe('research');
    expect(eligibilityOf('MMC')).toBe('outside');
    expect(eligibilityOf('KRE')).toBe('outside');
    expect(eligibilityOf('ZZZZ')).toBe('outside');
    expect(researchOnlyOf(['NVDA', 'GLW', 'KRE', 'TSM'])).toEqual(['GLW', 'TSM']);
  });
  it('companiesOf on the game list labels a symbol exactly as before (eligible / outside), never research', () => {
    const rec = { ...dataCenterRecord('refresh') };
    for (const c of companiesOf(rec).supported) expect(['eligible', 'outside']).toContain(c.eligibility);
  });
});
