// api/_utils/sharedResearch/kbMethod.checks.test.js
//
// KB-1 — THE METHOD BLOCK AND THE THREE CHECKS (Amendment A §A4.6; the KB-1
// build prompt, Part 5, Part 7 rows 6–8).
//   row 6  a baseline turn is unchanged: both system prompts equal main's byte
//          for byte (the committed fixture, captured from main before the
//          change), and none of the three checks runs on a baseline turn
//   row 7  the KB block: its header, its rules and the method's text verbatim;
//          the size pins
//   row 8  each check's refusal rows and pass rows
//
// The KB method is the REAL v0.1 package, read through the real loader with a
// test-only authorization list inside the loader mock's factory (the shipped
// list is empty), then selected by method.js — so its text, hash, title and
// acceptance date are the accepted bytes', and the markers' key matches them.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const kb = vi.hoisted(() => ({ real: null }));
vi.mock('../kb/loader.js', async (importOriginal) => {
  const real = await importOriginal();
  const entry = {
    id: 'KB-IDEA-EVALUATION-001', version: '0.1',
    sha256: 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e',
    acceptanceSha256: 'ec709781b80d2deeb325702faccb7a90abaa0c244c96103f0e956f81d26a08ee',
    consumers: ['shared_research.observation'], audience: 'all',
    authorizedAt: '2026-11-13T17:00:00Z', authorizedBy: 'test', evidenceRef: 'docs/approvals/KB1_TEST_ONLY.md',
  };
  kb.real = real.authorizedMethodFor({ consumer: 'shared_research.observation', inAudience: () => true }, { authorizations: [entry] });
  return { ...real, authorizedMethodFor: () => kb.real, loadAuthorizedMethod: () => kb.real };
});

const { buildStepSystemPrompt, buildFrameSystemPrompt, methodBlockOf, KB_METHOD_RULES } = await import('./stepPrompt.js');
const { validateStepTurn, kbTurnFailOf } = await import('./stepSchema.js');
const { tokensOf } = await import('./promptBudget.js');
const { METHOD, METHOD_SOURCE, BASELINE, selectMethod } = await import('./method.js');
const { baseRecord, withFindings, fid } = await import('./__fixtures__/records.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN = JSON.parse(readFileSync(resolve(HERE, '__fixtures__/baselinePrompts.main.json'), 'utf8'));
const KB_METHOD = selectMethod({ entryKind: 'observation', uid: 'u-1', nowIso: '2026-11-13T15:00:00.000Z' }).method;
const NAME40 = MAIN.partnerNames.name40;

const PARTNER = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const READ = '2026-11-13T15:00:00.000Z';
const NOW = '2026-11-13T15:00:05.000Z';
const NVDA_ITEM = { index: 0, url: 'https://news.example.com/nvda-noon', title: 'Chip shares slide at midday', host: 'news.example.com', publishedDate: '2026-10-30T00:00:00.000Z', highlights: ['Shares fell 3% by noon.'] };
const OTHER_ITEM = { index: 1, url: 'https://news.example.com/data-centers', title: 'Data-center builders wait on power gear', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: [] };
const NAMES = { NVDA: 'NVIDIA Corporation', ETN: 'Eaton Corporation plc' };
let n = 0;
const mint = () => `f_20000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const record = (entries = []) => withFindings(baseRecord({ question: 'Is the chip slide a sector move or one company?' }), entries, READ);
const ctx = (method, over = {}) => ({ record: record(), items: [NVDA_ITEM, OTHER_ITEM], readAt: READ, partnerExchangeId: PARTNER, partnerAt: NOW, nowIso: NOW, mintFindingId: mint, names: NAMES, partnerName: 'Rook', method, ...over });
const inference = (fact, tempId = 'i1') => ({ tempId, kind: 'inference', fact, symbolCandidate: null, companyName: null, support: { kind: 'inference', from: [], index: null, reason: null }, at: null, supersedes: null });
const retrieved = (fact, index = 1, over = {}) => ({ tempId: 'r1', kind: 'coverage', fact, symbolCandidate: null, companyName: null, support: { kind: 'retrieval', index, from: [], reason: null }, at: null, supersedes: null, ...over });
const turn = (over = {}) => ({
  reply: 'Data-center builders are waiting on power equipment.', findings: [retrieved('Data-center builders are waiting on power equipment.')], summary: null,
  lines: { support: null, complication: null, missing: null }, nextAction: { label: 'Find which listed company supplies the equipment', purpose: 'The company link is the weakest.' }, companies: [], ...over,
});
const run = (method, over = {}, ctxOver = {}) => validateStepTurn(turn(over), ctx(method, ctxOver));
const rule = (out) => (out.ok ? 'passes' : out.rule);

describe('the KB method these rows run on', () => {
  it('is the real v0.1 package, selected through method.js', () => {
    expect(kb.real.ok).toBe(true);
    expect(KB_METHOD).toMatchObject({ id: 'KB-IDEA-EVALUATION-001', version: '0.1', source: 'kb', title: 'Evaluating an Idea', sha256: 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e', acceptedAt: '2026-11-12T18:49:26.981100-06:00' });
  });
});

describe('row 6 — a baseline turn is unchanged', () => {
  it.each(['Rook', 'none', 'name40'])('both system prompts, partner %s, equal main\'s byte for byte — with no method given and with the baseline', (who) => {
    const partnerName = MAIN.partnerNames[who];
    for (const method of [undefined, null, BASELINE]) {
      expect(buildStepSystemPrompt({ partnerName, method })).toBe(MAIN.step[who]);
      expect(buildFrameSystemPrompt({ partnerName, method })).toBe(MAIN.frame[who]);
    }
    expect(MAIN.capturedFrom).toMatch(/^main c85f7b41/);
  });

  it.each([
    ['a citation "(M1)"', { reply: 'The decline matches the broader sector (M1).' }, 'method_example_as_fact'],
    ['the worked example as an inference', { findings: [inference('NVDA fell on October 30 at noon.')] }, 'method_example_as_fact'],
    ['a service name', { reply: 'This could go to the Practice Field later.' }, 'service_promise'],
    ['a promise', { reply: 'We will track this idea.' }, 'service_promise'],
  ])('a baseline turn with %s passes as today (the KB checks do not run)', (_label, over, kbRule) => {
    expect(rule(run(BASELINE, over))).toBe('passes');
    expect(rule(run(undefined, over))).toBe('passes');
    expect(rule(run(KB_METHOD, over))).toBe(kbRule); // …and the same turn on the KB method fails, by that check
  });

  it('method_as_source does not run on a baseline turn either (an injected kb-sourced finding)', () => {
    const injected = { findingId: fid('kbsrc'), kind: 'inference', fact: 'The method says so.', source: { ...METHOD_SOURCE } };
    expect(kbTurnFailOf({ method: BASELINE, findings: [injected] })).toBeNull();
    expect(kbTurnFailOf({ method: null, findings: [injected] })).toBeNull();
    expect(kbTurnFailOf({ method: KB_METHOD, findings: [injected] })).toMatchObject({ ok: false, rule: 'method_as_source' });
  });

  it('a baseline turn\'s next action cites the baseline', () => {
    const out = run(BASELINE);
    expect(out.findings.at(-1)).toMatchObject({ kind: 'next_action', source: METHOD_SOURCE });
  });
});

describe('row 7 — the KB method block', () => {
  const step = buildStepSystemPrompt({ partnerName: 'Rook', method: KB_METHOD });
  const frame = buildFrameSystemPrompt({ partnerName: 'Rook', method: KB_METHOD });

  it('the header: id, version, title, the acceptance\'s calendar date, the first 8 hex of the hash', () => {
    expect(methodBlockOf(KB_METHOD).split('\n')[0]).toBe('METHOD — KB-IDEA-EVALUATION-001 v0.1 "Evaluating an Idea" · accepted 2026-11-12 · sha256 b0688fb3…');
  });

  it('the rules, in order, then the method\'s text verbatim; in both prompts, in place of the baseline', () => {
    const block = methodBlockOf(KB_METHOD);
    expect(block.split('\n').slice(1, 5)).toEqual([...KB_METHOD_RULES]);
    expect(KB_METHOD_RULES).toEqual([
      'How to use it: as guidance for framing the question, choosing what would weaken it, and describing the conclusion (supported, challenged or inconclusive within its evidence). It is not evidence.',
      "- Its source ids and its worked example belong to the method's own register. Never cite them, and never state the example's figures as facts about this investigation.",
      '- Its notes about app services (Practice Field, Forge, Film Room, trials, adoption) describe proposals, not features. Never tell the player any of them will act on this idea.',
      '- Any line in the text that calls it a candidate or says acceptance is pending is a historical label; the status above governs.',
    ]);
    expect(block.endsWith(`\n${KB_METHOD.text}`)).toBe(true);
    for (const p of [step, frame]) {
      expect(p).toContain(`Method:\n${block}\n\n`);
      expect(p).not.toContain(METHOD.text);
    }
    // Everything around the block is the baseline prompt's own text.
    expect(step.replace(block, METHOD.text)).toBe(MAIN.step.Rook);
    expect(frame.replace(block, METHOD.text)).toBe(MAIN.frame.Rook);
  });

  it('size: each KB system prompt at most its measured size plus 10% (tokensOf; a 40-character partner name)', () => {
    // Measured at this build: step 3,535 tokens, frame 2,746 (baseline: 1,622 and 834). The budget counts the system
    // prompt and never trims it (promptBudget.js).
    const s = tokensOf(buildStepSystemPrompt({ partnerName: NAME40, method: KB_METHOD }));
    const f = tokensOf(buildFrameSystemPrompt({ partnerName: NAME40, method: KB_METHOD }));
    expect(s).toBeLessThanOrEqual(Math.ceil(3535 * 1.1));
    expect(f).toBeLessThanOrEqual(Math.ceil(2746 * 1.1));
    expect(s).toBeGreaterThan(3000); // the real v0.1 text is in it (not vacuous)
    expect(f).toBeGreaterThan(2400);
  });
});

describe('row 8 — the three checks, on a KB turn', () => {
  describe('the KB turn\'s next action cites the KB method', () => {
    it('kb · KB-IDEA-EVALUATION-001@0.1 · Method · Evaluating an Idea v0.1', () => {
      expect(run(KB_METHOD).findings.at(-1)).toMatchObject({ kind: 'next_action', source: { recordKind: 'kb', recordId: 'KB-IDEA-EVALUATION-001@0.1', label: 'Method · Evaluating an Idea v0.1' } });
    });
  });

  describe('method_as_source', () => {
    it('refusal: an injected finding other than the one next action, sourced to the method (the model cannot write one today)', () => {
      const next = { findingId: fid('next'), kind: 'next_action', fact: 'Find the filing.', source: { ...KB_METHOD.sourceRef } };
      const fact = { findingId: fid('fact'), kind: 'inference', fact: 'Comparisons need a frozen baseline.', source: { ...KB_METHOD.sourceRef } };
      expect(kbTurnFailOf({ method: KB_METHOD, findings: [fact, next], nextActionId: next.findingId })).toMatchObject({ ok: false, rule: 'method_as_source', detail: fact.findingId });
      // a second next action is not "the one"
      const second = { ...next, findingId: fid('next2') };
      expect(kbTurnFailOf({ method: KB_METHOD, findings: [next, second], nextActionId: next.findingId })).toMatchObject({ rule: 'method_as_source', detail: second.findingId });
    });
    it('pass: the step\'s own next action', () => {
      const next = { findingId: fid('next'), kind: 'next_action', fact: 'Find the filing.', source: { ...KB_METHOD.sourceRef } };
      expect(kbTurnFailOf({ method: KB_METHOD, findings: [next], nextActionId: next.findingId })).toBeNull();
    });
  });

  describe('method_example_as_fact — the register\'s citations', () => {
    it.each([
      ['reply', { reply: 'The decline matches the sector (M1).' }],
      ['reply', { reply: 'Two sources agree [C1, I4].' }],
      ['reply', { reply: 'Ranking cohorts shift (I1/I2).' }],
      ['reply', { reply: 'Comparable windows matter (M1 and V1).' }],
      ['summary', { summary: { text: 'Per E1, repeated searching inflates results.', basedOn: ['r1'] } }],
      ['fact', { findings: [inference('See V1 for the volume gate.')] }],
      ['fact', { findings: [inference('Under T3 the window is frozen.')] }],
      ['reply', { reply: 'This comes from A0 and the register.' }],
      ['next action', { nextAction: { label: 'Check the comparison (C1)', purpose: 'Weakest link.' } }],
    ])('refusal in the %s: %j', (_where, over) => {
      const out = run(KB_METHOD, over);
      expect(out).toMatchObject({ ok: false, rule: 'method_example_as_fact' });
      expect(out.detail).toMatch(/:citation$/);
    });
    it.each([
      ["Apple's M1 chip set the pace for laptop margins."],
      ['The company issued Series C1 preferred shares.'],
      ['An engineer on an E1 visa joined the team.'],
      ['Freight on the I5 corridor slowed.'],
      ['The M10 plant and the C12 line are separate (not register ids).'],
    ])('pass: %s', (text) => {
      expect(rule(run(KB_METHOD, { reply: text, findings: [inference(text)] }))).toBe('passes');
    });
  });

  describe('method_example_as_fact — the worked example (NVDA, October 30)', () => {
    it.each([
      ['an inference\'s fact', { findings: [inference('NVDA fell on October 30 at noon.')] }],
      ['the reply', { reply: 'NVDA dropped on Oct. 30 while above its average.' }],
      ['the summary', { summary: { text: 'On Oct 30 NVDA declined.', basedOn: ['r1'] } }],
      ['an unresolved finding', { findings: [{ ...inference('NVDA participation on October 30th is unknown.'), support: { kind: 'unresolved', from: [], index: null, reason: 'not_checked' } }] }],
    ])('refusal in %s', (_where, over) => {
      const out = run(KB_METHOD, over);
      expect(out).toMatchObject({ ok: false, rule: 'method_example_as_fact' });
      expect(out.detail).toMatch(/:example$/);
    });
    it('pass: a retrieval-backed finding whose fact names both', () => {
      expect(rule(run(KB_METHOD, { findings: [retrieved('NVDA shares fell 3% by noon on October 30.', 0)] }))).toBe('passes');
    });
    it('pass: an investigation into NVDA whose retrieved item is dated October 30 — its finding, then the reply and summary naming both', () => {
      const out = run(KB_METHOD, {
        findings: [retrieved('Nvidia shares fell 3% by noon.', 0, { symbolCandidate: 'NVDA', companyName: 'NVIDIA' })],
        reply: 'NVDA fell on October 30, per the retrieved report.', summary: { text: 'NVDA shares fell by noon on October 30.', basedOn: ['r1'] },
      });
      expect(rule(out)).toBe('passes');
      expect(out.findings[0]).toMatchObject({ symbol: 'NVDA', status: 'verified', at: '2026-10-30T00:00:00.000Z' });
    });
    it('pass: the record already holds a current retrieval-backed finding naming both (an earlier step)', () => {
      const prior = ['nv1', { kind: 'coverage', symbol: 'NVDA', fact: 'NVDA shares fell by noon on October 30.', source: { recordKind: 'retrieval', recordId: NVDA_ITEM.url, label: 'news.example.com · Chip shares slide', url: NVDA_ITEM.url }, at: '2026-10-30T00:00:00.000Z', asOf: '2026-10-30T00:00:00.000Z', status: 'verified', statusReason: null }];
      expect(rule(run(KB_METHOD, { findings: [inference('NVDA fell on October 30 with the sector.')] }, { record: record([prior]) }))).toBe('passes');
    });
    it('the name alone, or the date alone, passes — in one sentence; two sentences of one text each naming one pass too (review TST-4)', () => {
      expect(rule(run(KB_METHOD, { reply: 'NVDA is in the record.', findings: [inference('Nothing happened on October 30 here.')] }))).toBe('passes');
      expect(rule(run(KB_METHOD, { reply: 'NVDA is in the record. Nothing happened on October 30 here.' }))).toBe('passes');
    });
    it('the exemption needs BOTH: a retrieved NVDA finding on another date exempts nothing; a retrieved October 30 finding about another company exempts nothing (review TST-3, TST-4)', () => {
      const claim = inference('NVDA fell on October 30 at noon.', 'i9');
      expect(run(KB_METHOD, { findings: [retrieved('NVDA shares rose after the data-center update.', 1, { symbolCandidate: 'NVDA' }), claim] })).toMatchObject({ ok: false, rule: 'method_example_as_fact' });
      expect(run(KB_METHOD, { findings: [retrieved('Chip shares slid by noon.', 0), claim] })).toMatchObject({ ok: false, rule: 'method_example_as_fact' });
    });
    it('an undated item\'s read day is no date: an NVDA finding from an undated item read on October 30 exempts nothing (review TST-4)', () => {
      const read = '2026-10-30T15:00:00.000Z';
      const at = { readAt: read, partnerAt: '2026-10-30T15:00:05.000Z', nowIso: '2026-10-30T15:00:05.000Z', items: [{ ...NVDA_ITEM, publishedDate: null }, OTHER_ITEM] };
      const out = run(KB_METHOD, { findings: [retrieved('NVDA shares fell by noon.', 0, { symbolCandidate: 'NVDA' }), inference('NVDA fell on October 30 at noon.', 'i9')] }, at);
      expect(out).toMatchObject({ ok: false, rule: 'method_example_as_fact' });
    });
  });

  describe('service_promise', () => {
    it.each([
      ['the reply', { reply: 'This could go to the Practice Field later.' }],
      ['the summary', { summary: { text: 'A Film Room review would show it.', basedOn: ['r1'] } }],
      ['a fact', { findings: [inference('It belongs in the idea book.')] }],
      ['a we-promise', { reply: 'We will track this idea for you.' }],
      ['an I-promise', { reply: "I'm going to test it next week." }],
      ['the partner by name', { reply: 'Rook will monitor it.' }],
      ['the agent', { reply: 'The agent will trial the setup.' }],
      ['the idea', { reply: 'Your idea will be adopted once it holds.' }],
      ['this idea, going to', { reply: 'This idea is going to be tested.' }],
      ['a contraction', { reply: "We'll keep tracking the names." }],
      ['the next action', { nextAction: { label: 'Run a Practice Field trial', purpose: 'Test it forward.' } }],
      ['the summary, a promise (review TST-5)', { summary: { text: 'We will track this idea.', basedOn: ['r1'] } }],
      ['a fact, a promise (review TST-5)', { findings: [inference('The agent will adopt the setup next.')] }],
      ['the next action, a promise', { nextAction: { label: 'Check the supplier', purpose: 'We will monitor it after.' } }],
    ])('refusal in %s', (_where, over) => {
      expect(run(KB_METHOD, over)).toMatchObject({ ok: false, rule: 'service_promise' });
    });
    it.each([
      ['the company will test a new product in the spring'],
      ['The regulator is going to monitor prices.'],
      ['Phase I will be tested in 2027.'],
      ['The idea that power is scarce is common.'],
    ])('pass: %s', (text) => {
      expect(rule(run(KB_METHOD, { reply: `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.]$/.test(text) ? '' : '.'}` }))).toBe('passes');
    });
  });

  describe('the review\'s refusals that slipped through, and its pass rows (review CHK-1 to CHK-6, CHK-9, CHK-11, CHK-12)', () => {
    it.each(['Will', 'Test', 'Track', 'Monitor', 'Going', 'Be'])('a partner named %s does not switch the promise check off (CHK-1)', (partnerName) => {
      for (const reply of ['We will track this idea.', 'I will test it.', 'Your idea will be adopted.', "We're going to track this idea."]) {
        expect(rule(run(KB_METHOD, { reply }, { partnerName })), `${partnerName}: ${reply}`).toBe('service_promise');
      }
      expect(rule(run(KB_METHOD, { reply: `${partnerName} will monitor it.` }, { partnerName }))).toBe('service_promise');
      expect(rule(run(KB_METHOD, { reply: 'The company will test a new product in the spring.' }, { partnerName }))).toBe('passes');
    });
    it('the partner\'s name is read like the text: curly, NFD, fullwidth, zero-width (CHK-2)', () => {
      for (const [partnerName, reply] of [['O’Neil', 'O’Neil will track it.'], ['José'.normalize('NFD'), 'José will track it.'], ['Ｒｏｏｋ', 'Rook will track it.'], ['R​ook', 'Rook will track it.']]) {
        expect(rule(run(KB_METHOD, { reply }, { partnerName })), reply).toBe('service_promise');
      }
    });
    it.each([
      ['NVDA fell in U.S. trading on October 30.'], ['NVDA fell by 12 p.m. on October 30.'], ['NVDA vs. AMD on Oct 30: both fell.'],
      ['NVDA Inc. fell on October 30.'], ['NVDA, approx. 3% lower, closed on October 30.'],
    ])('an abbreviation does not end the sentence: %s (CHK-3)', (text) => {
      expect(run(KB_METHOD, { findings: [inference(text)] })).toMatchObject({ ok: false, rule: 'method_example_as_fact', detail: expect.stringMatching(/:example$/) });
    });
    it('a new sentence still starts a new sentence', () => {
      expect(rule(run(KB_METHOD, { findings: [inference('The ticker is NVDA. October 30 was a Friday.')] }))).toBe('passes');
    });
    it.each([['(M1, V1, and T2)'], ['(T1–T6)'], ['(T1-T3)'], ['(M1 or V1)']])('a bracketed group with %s (CHK-4)', (group) => {
      expect(run(KB_METHOD, { reply: `The windows matter ${group}.` })).toMatchObject({ ok: false, rule: 'method_example_as_fact' });
    });
    it.each([
      ['We will be closely monitoring it.'], ['We will continue monitoring it.'], ['We will start to track this idea.'], ['We will keep on tracking it.'],
      ['We will, of course, monitor it.'], ['We will both track it.'], ['We will closely and continuously monitor it.'],
    ])('the promise with words between: %s (CHK-5)', (reply) => {
      expect(rule(run(KB_METHOD, { reply }))).toBe('service_promise');
    });
    it('a partner named in lower case is still the partner; a partner\'s name inside another word is not (CHK-1)', () => {
      expect(rule(run(KB_METHOD, { reply: 'rook will track it.' }, { partnerName: 'Rook' }))).toBe('service_promise');
      expect(rule(run(KB_METHOD, { reply: 'Brook Capital will track the index.' }, { partnerName: 'Rook' }))).toBe('passes');
    });
    it.each([
      ['Phase-I will be tested.'], ['Fund I will track the index.'], ['Basel I will be adopted.'], ['We will not test it.'], ["We're tracking this idea."],
      ['NVDA fell 30% from its October high.'], ['The window was an October 30-day one.'],
    ])('passes — a numeral "I", a negation, the present tense, no date (CHK-6, CHK-11): %s', (reply) => {
      expect(rule(run(KB_METHOD, { reply }))).toBe('passes');
    });
    // The letter as built, both ways (founder questions in the report): B1's partner words (spec §17 FQ-9) and the three
    // service names in any case fail; "your investment idea" and joined or hyphenated service names are not the letter's.
    it.each([["Moderna's research partner will trial the vaccine."], ['Our partner will test the chip.'], ['The stadium has a practice field.'], ["The coach's film room is new."]])(
      'letter-literal collateral, fails: %s (CHK-6, CHK-9)', (reply) => {
        expect(rule(run(KB_METHOD, { reply }))).toBe('service_promise');
      },
    );
    it.each([['Your investment idea will be adopted.'], ['A PracticeField trial.'], ['It goes in the idea-book.'], ['The Forge will adopt it.']])(
      'letter-limited, passes: %s (CHK-5, CHK-9)', (reply) => {
        expect(rule(run(KB_METHOD, { reply }))).toBe('passes');
      },
    );
    it('the range "to" is a separator too: "(T1 to T6)" (CHK-4)', () => {
      expect(run(KB_METHOD, { reply: 'The tests matter (T1 to T6).' })).toMatchObject({ ok: false, rule: 'method_example_as_fact' });
    });
    it('the exemption takes the company\'s own name on an October 30 item with no symbol (CHK-12)', () => {
      const out = run(KB_METHOD, { findings: [retrieved('Nvidia shares fell by noon.', 0, { companyName: 'NVIDIA' })], reply: 'NVDA fell on October 30 at noon.' });
      expect(rule(out)).toBe('passes');
      expect(out.findings[0]).toMatchObject({ symbol: null, at: '2026-10-30T00:00:00.000Z' });
    });
  });

  it('a clean KB turn passes all three', () => {
    expect(rule(run(KB_METHOD))).toBe('passes');
  });

  it('a check fails the whole step: nothing comes back to append', () => {
    const out = run(KB_METHOD, { reply: 'We will track this idea.' });
    expect(out.ok).toBe(false);
    expect(out.findings).toBeUndefined();
  });
});
