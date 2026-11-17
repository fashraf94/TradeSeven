// api/_utils/sharedResearch/thesis.test.js
//
// Shared Research B3 — THE THESIS CARD, pure (Amendment B §B3, §B4; §B10; K-3).
// Table-driven: the card's shape and limits, each transition, the dependencies
// (§B3, with §B10 S-B4's narrowing), stale, ready and its blockers, the
// sentence for one to four names with and without a segment, each goal's offer
// rule, the free choices, the `rev` rule and the opId idempotency, a step's
// proposals (which never set a part), the carried evidence and the saved card.

import { describe, it, expect } from 'vitest';
import {
  emptyCard, openingCardOf, builderQuestionOf, cardContextOf, partStatesOf, readinessOf, sentenceOf, joinNames,
  timeFrameLabelOf, offeredGoalsOf, isGoalOffered, freeChoicesOf, applyCardOp, cardOpOf, applyProposals, carriedIdsOf,
  priceConditionsOf, savedCardOf, thesisViewOf, shapeOf, verifiedOf, OPS_KEPT, THESIS_CARD_FIELD, namesWithoutReasonOf,
} from './thesis.js';
import { THESIS_PARTS, THESIS_LIMITS } from '../../../src/constants/sharedResearch.js';

const F = (findingId, kind, symbol, status, extra = {}) => ({
  findingId, kind, symbol, status, fact: `${findingId} fact`, source: { recordKind: 'retrieval', recordId: `https://x.example/${findingId}`, label: 'x.example · t', url: `https://x.example/${findingId}` },
  at: '2026-11-10T00:00:00.000Z', asOf: null, statusReason: null, supersedes: null, ...extra,
});
const BASE = [
  F('rN', 'relationship', 'NVDA', 'verified'), F('rA', 'relationship', 'AMD', 'verified'),
  F('eN', 'earnings_fact', 'NVDA', 'verified'), F('eA', 'earnings_fact', 'AMD', 'verified'),
  F('iN', 'inference', 'NVDA', 'unverified'), F('c1', 'coverage', null, 'verified'), F('o1', 'observation', null, 'unverified'),
];
const recordOf = (findings = BASE, state = 'open') => ({ researchWorkId: 'sr_s1', state, findings });
const SUPPORTED = [{ symbol: 'NVDA', relationshipFindingId: 'rN' }, { symbol: 'AMD', relationshipFindingId: 'rA' }];
const session = (over = {}) => ({ status: 'open', stepsUsed: 2, stepBudget: 10, entry: { kind: 'observation' }, exchanges: [], ...over });
const ctxOf = ({ findings = BASE, supported = SUPPORTED, s = session(), state = 'open' } = {}) => cardContextOf({ record: recordOf(findings, state), supported, session: s });
const CTX = ctxOf();

/** A card with the given parts set, the rest unset. */
function cardWith(over = {}) {
  const c = emptyCard();
  c.theme = { state: 'set', value: 'AI', by: 'player_wrote', suggestion: null };
  if (over.segment !== false) c.segment = { state: 'set', value: 'GPUs and accelerators', by: 'player_chose', findingIds: ['c1'], skipped: false, map: [{ label: 'GPUs and accelerators', line: 'The chips', findingIds: ['c1'] }, { label: 'Networking', line: 'The links', findingIds: [] }] };
  if (over.names) c.names = { state: 'set', value: over.names, by: 'player_chose', blocked: null };
  if (over.why) {
    c.why = { state: 'set', by: 'partner_suggested_confirmed', shared: 'they sell accelerators to data centers', reasons: over.names.map((s) => ({ symbol: s, text: `${s} sells chips`, findingIds: [s === 'NVDA' ? 'eN' : 'eA'] })), against: { text: 'A few buyers dominate', findingIds: ['c1'] }, proposal: null };
  }
  if (over.wrongIf) c.wrongIf = { ...c.wrongIf, state: 'set', by: 'player_wrote', text: 'big buyers cut spending for two quarters', findingIds: [] };
  if (over.timeFrame) c.timeFrame = { state: 'set', by: 'player_chose', value: over.timeFrame, suggestion: null };
  return c;
}
const READY = () => cardWith({ names: ['NVDA'], why: true, wrongIf: true, timeFrame: 'positional' });
const proposalFor = (names, over = {}) => ({
  shared: 'they sell accelerators to data centers', forNames: names,
  reasons: names.map((s) => ({ symbol: s, text: `${s} sells chips`, findingIds: [s === 'NVDA' ? 'eN' : 'eA'] })),
  against: { text: 'A few buyers dominate', findingIds: ['c1'] }, ...over,
});

describe('the card at open (§B4.1)', () => {
  it('an empty card: six parts unset, rev 0, no pick, no ops', () => {
    const c = emptyCard();
    expect(Object.keys(c)).toEqual(['schemaVersion', 'rev', ...THESIS_PARTS, 'pick', 'ops']);
    for (const p of THESIS_PARTS) expect(c[p].state).toBe('unset');
    expect([c.rev, c.pick, c.ops]).toEqual([0, null, []]);
  });
  it.each([
    ['own words ≤ 80 → the theme, the player wrote it', 'observation', 'I want to play AI', { state: 'set', value: 'I want to play AI', by: 'player_wrote' }],
    ['own words of exactly 80', 'observation', 'x'.repeat(80), { state: 'set', by: 'player_wrote' }],
    ['own words of 81 → unset, for the first step to suggest (SQ-2)', 'observation', 'x'.repeat(81), { state: 'unset', value: null }],
    ['a story opens empty', 'item', 'ignored', { state: 'unset', value: null }],
    ['a drop opens empty', 'signaldrop', null, { state: 'unset' }],
  ])('%s', (_, entryKind, observation, theme) => {
    expect(openingCardOf({ entryKind, observation }).theme).toMatchObject(theme);
  });
  it('the record question: "Build a thesis on: …", cut to the record\'s limit', () => {
    expect(builderQuestionOf('I want to play AI')).toBe('Build a thesis on: I want to play AI');
    expect(builderQuestionOf('y'.repeat(600))).toHaveLength(500);
  });
});

describe('shape (§B2; §B10 S-B2)', () => {
  it.each([[{ shape: 'builder' }, 'builder'], [{}, 'ledger'], [{ shape: 'ledger' }, 'ledger'], [{ shape: 'BUILDER' }, 'ledger'], [null, 'ledger']])('%j → %s', (s, want) => {
    expect(shapeOf(s)).toBe(want);
  });
});

describe('derived states: unset · suggested · set · stale (§B3)', () => {
  it('a set part whose findings are all current is set; one with a superseded finding is stale', () => {
    const c = cardWith({ names: ['NVDA'], why: true });
    expect(partStatesOf(c, CTX)).toMatchObject({ theme: 'set', segment: 'set', names: 'set', why: 'set', wrongIf: 'unset', timeFrame: 'unset' });
    const corrected = [...BASE, F('c2', 'coverage', null, 'verified', { supersedes: 'c1' })];
    expect(partStatesOf(c, ctxOf({ findings: corrected }))).toMatchObject({ segment: 'stale', why: 'stale' });
  });
  it('names go stale when a name is no longer supported (companiesOf)', () => {
    const c = cardWith({ names: ['NVDA', 'AMD'] });
    expect(partStatesOf(c, ctxOf({ supported: [SUPPORTED[0]] })).names).toBe('stale');
  });
  it('a why whose reason rests on an inference is stale (rule 1); so is one missing a name', () => {
    const c = cardWith({ names: ['NVDA'], why: true });
    c.why.reasons[0].findingIds = ['iN'];
    expect(partStatesOf(c, CTX).why).toBe('stale');
    const two = cardWith({ names: ['NVDA', 'AMD'], why: true });
    two.why.reasons = two.why.reasons.filter((r) => r.symbol === 'NVDA');
    expect(partStatesOf(two, CTX).why).toBe('stale');
  });
  it('suggested: a theme suggestion, a why proposal, a time-frame suggestion, and a part the player asked the partner to pick', () => {
    const c = emptyCard();
    c.theme.suggestion = 'Data-center power';
    c.why.proposal = proposalFor(['NVDA']);
    c.timeFrame.suggestion = { value: 'longterm', reason: 'r' };
    c.pick = { part: 'segment', value: 'Networking', reason: 'r', findingIds: [], reasons: [], asked: true };
    expect(partStatesOf(c, CTX)).toMatchObject({ theme: 'suggested', why: 'suggested', timeFrame: 'suggested', segment: 'suggested' });
    c.pick.asked = false; // Atlas's pick on a free choice marks the choice; the part stays unset (routine 6)
    expect(partStatesOf(c, CTX).segment).toBe('unset');
  });
});

describe('ready and its blockers (V2-1; §B3)', () => {
  it('ready = names, why, wrong if and time frame set; theme and segment are not needed', () => {
    expect(readinessOf(READY(), CTX)).toEqual({ ready: true, blockers: [] });
    const noSeg = READY();
    noSeg.segment = emptyCard().segment;
    noSeg.theme = emptyCard().theme;
    expect(readinessOf(noSeg, CTX).ready).toBe(true);
  });
  it.each([
    ['names cleared (and the why with them)', (c) => { Object.assign(c, applyCardOp(c, { op: 'clear', part: 'names' }, CTX).card); }, [{ part: 'names', state: 'unset' }, { part: 'why', state: 'unset' }]],
    ['a why left behind by names that are gone is stale', (c) => { c.names = emptyCard().names; }, [{ part: 'names', state: 'unset' }, { part: 'why', state: 'stale' }]],
    ['wrong if unset', (c) => { c.wrongIf = emptyCard().wrongIf; }, [{ part: 'wrongIf', state: 'unset' }]],
    ['time frame suggested only', (c) => { c.timeFrame = { ...emptyCard().timeFrame, suggestion: { value: 'swing', reason: 'r' } }; }, [{ part: 'timeFrame', state: 'suggested' }]],
    ['why stale', (c) => { c.why.reasons[0].findingIds = ['iN']; }, [{ part: 'why', state: 'stale' }]],
  ])('%s blocks ready', (_, mutate, blockers) => {
    const c = READY();
    mutate(c);
    expect(readinessOf(c, CTX)).toEqual({ ready: false, blockers });
  });
  it('a stale part never counts: the why\'s point against superseded → not ready', () => {
    const corrected = [...BASE, F('c2', 'coverage', null, 'verified', { supersedes: 'c1' })];
    const c = READY();
    c.segment = { ...c.segment, findingIds: [] };
    expect(readinessOf(c, ctxOf({ findings: corrected })).blockers).toEqual([{ part: 'why', state: 'stale' }]);
  });
});

describe('the sentence (§B3)', () => {
  it.each([
    [['NVDA'], 'NVDA'], [['NVDA', 'AMD'], 'NVDA and AMD'], [['NVDA', 'AMD', 'AVGO'], 'NVDA, AMD and AVGO'], [['NVDA', 'AMD', 'AVGO', 'MU'], 'NVDA, AMD, AVGO and MU'],
  ])('names %j join as "%s"', (names, joined) => {
    expect(joinNames(names)).toBe(joined);
    const c = READY();
    c.names.value = names;
    expect(sentenceOf(c)).toBe(`My theme is AI, through GPUs and accelerators, built on ${joined}, because they sell accelerators to data centers. It's wrong if big buyers cut spending for two quarters. Time frame: Positional · about 30 sessions.`);
  });
  it('a skipped segment is left out; with no theme the sentence opens at the names', () => {
    const c = READY();
    c.segment = { ...c.segment, skipped: true, value: null };
    expect(sentenceOf(c)).toMatch(/^My theme is AI, built on NVDA, because/);
    c.theme = emptyCard().theme;
    expect(sentenceOf(c)).toMatch(/^Built on NVDA, because/);
  });
  it('null until names, why, wrong if and time frame are set; never drops the wrong-if', () => {
    const c = READY();
    c.wrongIf = emptyCard().wrongIf;
    expect(sentenceOf(c)).toBeNull();
    expect(sentenceOf(READY())).toContain("It's wrong if big buyers cut spending for two quarters.");
  });
  it('trailing punctuation of a part does not double; the label is the shared horizon row with a capital', () => {
    const c = READY();
    c.wrongIf.text = 'big buyers cut spending.';
    c.why.shared = 'they sell chips;';
    expect(sentenceOf(c)).toContain('because they sell chips. It\'s wrong if big buyers cut spending. Time frame');
    expect(['swing', 'positional', 'longterm'].map(timeFrameLabelOf)).toEqual(['Swing · about 10 sessions', 'Positional · about 30 sessions', 'Longterm · about 60 sessions']);
  });
  it('fits the idea statement (≤ 1,000) at every part\'s limit', () => {
    const c = READY();
    c.theme.value = 't'.repeat(THESIS_LIMITS.theme);
    c.segment.value = 's'.repeat(THESIS_LIMITS.segmentLabel);
    c.names.value = ['GOOGL', 'BRK-B', 'AVGO', 'NVDA'];
    c.why.shared = 'w'.repeat(THESIS_LIMITS.shared);
    c.wrongIf.text = 'x'.repeat(THESIS_LIMITS.wrongIf);
    expect(sentenceOf(c).length).toBeLessThanOrEqual(1000);
  });
});

describe('the goals on offer (§B4.2 — each goal\'s offer rule)', () => {
  const goals = (c, ctx = CTX) => offeredGoalsOf(c, ctx).map((g) => (g.part ? `${g.goal}:${g.part}` : g.goal));
  it('own words, theme set: map the segments (and direction)', () => {
    const c = openingCardOf({ entryKind: 'observation', observation: 'AI' });
    expect(goals(c)).toEqual(['map_segments', 'strengthen:theme', 'direction']);
  });
  it('own words over 80 (SQ-2): the theme unset with no suggestion still offers the map; once suggested, the player confirms first', () => {
    const c = openingCardOf({ entryKind: 'observation', observation: 'x'.repeat(81) });
    expect(goals(c)).toEqual(['map_segments', 'direction']);
    c.theme.suggestion = 'AI';
    expect(goals(c)).toEqual(['direction']);
  });
  it('a story or a drop verifies first: until then only verify_source and direction', () => {
    for (const kind of ['item', 'signaldrop']) {
      const ctx = ctxOf({ s: session({ entry: { kind } }) });
      expect(goals(cardWith({ names: ['NVDA'] }), ctx)).toEqual(['verify_source', 'direction']);
      const done = ctxOf({ s: session({ entry: { kind }, exchanges: [{ who: 'partner', kind: 'step', goal: 'verify_source' }] }) });
      expect(goals(emptyCard(), done)).toEqual(['direction']);
      expect(done.verified).toBe(true);
      expect(verifiedOf({ exchanges: [{ who: 'partner', kind: 'step', goal: 'map_segments' }] })).toBe(false);
    }
  });
  it('find_names: theme set and segment set or skipped; not while blocked', () => {
    const c = cardWith({});
    expect(goals(c)).toContain('find_names');
    c.segment = { ...c.segment, skipped: true, value: null };
    expect(goals(c)).toContain('find_names');
    c.names.blocked = 'no_listed_company';
    expect(goals(c)).not.toContain('find_names');
  });
  it('build_why: names set and why not set; strengthen: every set part; pick: a part with choices on the card', () => {
    const c = cardWith({ names: ['NVDA'] });
    expect(goals(c)).toEqual(['build_why', 'strengthen:theme', 'strengthen:segment', 'strengthen:names', 'direction']);
    const r = READY();
    expect(goals(r)).toEqual(['strengthen:theme', 'strengthen:segment', 'strengthen:names', 'strengthen:why', 'strengthen:wrongIf', 'strengthen:timeFrame', 'direction']);
    const m = openingCardOf({ entryKind: 'observation', observation: 'AI' });
    m.segment.map = [{ label: 'A', line: 'a', findingIds: [] }, { label: 'B', line: 'b', findingIds: [] }];
    expect(goals(m)).toContain('pick:segment');
  });
  it('out of steps (DR-4) or not open: no research goal at all', () => {
    expect(offeredGoalsOf(READY(), ctxOf({ s: session({ stepsUsed: 10 }) }))).toEqual([]);
    expect(offeredGoalsOf(READY(), ctxOf({ state: 'completed' }))).toEqual([]);
    expect(isGoalOffered(READY(), CTX, { goal: 'direction' })).toBe(true);
    expect(isGoalOffered(READY(), CTX, { goal: 'map_segments' })).toBe(false);
  });
});

describe('the free choices (§B4.3)', () => {
  it('out of steps, the free choices stay (DR-4): wrong if and time frame can still be set', () => {
    const c = cardWith({ names: ['NVDA'], why: true });
    const free = freeChoicesOf(c, ctxOf({ s: session({ stepsUsed: 10 }) }));
    expect(free.filter((f) => f.part === 'timeFrame' && f.op === 'set').map((f) => f.value)).toEqual(['swing', 'positional', 'longterm']);
    expect(free).toContainEqual({ op: 'set', part: 'wrongIf', input: 'text', max: 200 });
  });
  it('SQ-3: a proposal missing a sourced reason for one name offers dropping that name, not confirming', () => {
    const c = cardWith({ names: ['NVDA', 'AMD'] });
    c.why.proposal = proposalFor(['NVDA', 'AMD']);
    c.why.proposal.reasons[1].findingIds = ['iN']; // AMD's reason rests on an inference
    const free = freeChoicesOf(c, CTX);
    expect(free).toContainEqual({ op: 'set', part: 'names', value: ['NVDA'], reason: 'drop_unsourced' });
    expect(free.some((f) => f.op === 'confirm' && f.part === 'why')).toBe(false);
  });
  it('Change: every set part but the theme, with what it clears', () => {
    const clears = freeChoicesOf(READY(), CTX).filter((f) => f.op === 'clear');
    expect(clears.map((f) => [f.part, f.clears])).toEqual([['segment', ['names', 'why']], ['names', ['why']], ['why', []], ['wrongIf', []], ['timeFrame', []]]);
  });
  it('none once the investigation is not open', () => {
    expect(freeChoicesOf(READY(), ctxOf({ state: 'completed' }))).toEqual([]);
  });
});

describe('the transitions and dependencies (§B3, §B4.3; §B10 S-B4)', () => {
  it('changing the segment clears the names, the why and the price lines; the map stays', () => {
    const c = READY();
    c.wrongIf.priceLines = [{ symbol: 'NVDA', level: 100 }];
    const out = applyCardOp(c, { op: 'set', part: 'segment', value: 'Networking' }, CTX);
    expect(out.ok).toBe(true);
    expect(out.card.segment).toMatchObject({ state: 'set', value: 'Networking', by: 'player_chose' });
    expect(out.card.names).toMatchObject({ state: 'unset', value: [] });
    expect(out.card.why).toMatchObject({ state: 'unset', reasons: [], proposal: null });
    expect(out.card.wrongIf).toMatchObject({ state: 'set', priceLines: [] }); // the wrong-if stands on its own
    expect(out.card.timeFrame.state).toBe('set');
    expect(out.card.segment.map).toHaveLength(2);
  });
  it('setting the same segment again clears nothing', () => {
    const out = applyCardOp(READY(), { op: 'set', part: 'segment', value: 'GPUs and accelerators' }, CTX);
    expect(out.card.names.state).toBe('set');
  });
  it('changing the names clears the why and the price lines; wrong if and time frame stand', () => {
    const c = READY();
    c.wrongIf.priceLines = [{ symbol: 'NVDA', level: 100 }];
    const out = applyCardOp(c, { op: 'set', part: 'names', value: ['AMD'] }, CTX);
    expect(out.card.why).toMatchObject({ state: 'unset', proposal: null });
    expect(out.card.wrongIf).toMatchObject({ state: 'set', priceLines: [] });
    expect(out.card.timeFrame.state).toBe('set');
  });
  it('S-B4: dropping names keeps the why proposal for the names that remain — confirmable at once', () => {
    const c = cardWith({ names: ['NVDA', 'AMD'] });
    c.why.proposal = proposalFor(['NVDA', 'AMD']);
    c.why.proposal.reasons[1].findingIds = ['iN'];
    const out = applyCardOp(c, { op: 'set', part: 'names', value: ['NVDA'] }, CTX);
    expect(out.card.why.proposal.reasons.map((r) => r.symbol)).toEqual(['NVDA']);
    expect(out.card.why.proposal.forNames).toEqual(['NVDA']);
    const confirmed = applyCardOp(out.card, { op: 'confirm', part: 'why' }, CTX);
    expect(confirmed.card.why).toMatchObject({ state: 'set', by: 'partner_suggested_confirmed' });
    // dropping the other name is a narrowing too; a names change that is not a narrowing clears the proposal
    expect(applyCardOp(c, { op: 'set', part: 'names', value: ['AMD'] }, CTX).card.why.proposal.forNames).toEqual(['AMD']);
    const other = applyCardOp(cardWith({ names: ['NVDA'] }), { op: 'set', part: 'names', value: ['AMD'] }, CTX);
    expect(other.card.why.proposal).toBeNull();
  });
  it('the theme: set only while unset, never cleared, never changed (§B3)', () => {
    expect(applyCardOp(READY(), { op: 'set', part: 'theme', value: 'Other' }, CTX)).toEqual({ ok: false, reason: 'theme_fixed' });
    expect(applyCardOp(READY(), { op: 'clear', part: 'theme' }, CTX)).toEqual({ ok: false, reason: 'theme_fixed' });
    const c = emptyCard();
    expect(applyCardOp(c, { op: 'set', part: 'theme', value: { text: ' AI {x} ' } }, CTX).card.theme).toMatchObject({ state: 'set', value: 'AI x', by: 'player_wrote' });
    c.theme.suggestion = 'Power demand';
    expect(applyCardOp(c, { op: 'confirm', part: 'theme' }, CTX).card.theme).toMatchObject({ value: 'Power demand', by: 'partner_suggested_confirmed', suggestion: null });
    expect(applyCardOp(c, { op: 'set', part: 'theme', value: 'x'.repeat(81) }, CTX)).toEqual({ ok: false, reason: 'invalid_value' });
  });
  it.each([
    ['a segment not on the map', { op: 'set', part: 'segment', value: 'Robots' }, 'invalid_value'],
    ['a name not supported', { op: 'set', part: 'names', value: ['TSLA'] }, 'invalid_value'],
    ['five names', { op: 'set', part: 'names', value: ['NVDA', 'AMD', 'A', 'B', 'C'] }, 'invalid_value'],
    ['a repeated name', { op: 'set', part: 'names', value: ['NVDA', 'NVDA'] }, 'invalid_value'],
    ['a horizon outside the three', { op: 'set', part: 'timeFrame', value: 'intraday' }, 'invalid_value'],
    ['confirm with nothing suggested', { op: 'confirm', part: 'segment' }, 'no_suggestion'],
    ['clear an unset part', { op: 'clear', part: 'timeFrame' }, 'not_set'],
    ['an unknown op', { op: 'edit', part: 'why' }, 'unknown_op'],
    ['an unknown part', { op: 'set', part: 'score', value: 1 }, 'unknown_op'],
  ])('refused: %s', (_, req, reason) => {
    const c = cardWith({});
    expect(applyCardOp(c, req, CTX)).toEqual({ ok: false, reason });
  });
  it('why: confirm needs a sourced reason per name; set keeps the reasons the player kept, one per name at least', () => {
    const c = cardWith({ names: ['NVDA'] });
    c.why.proposal = proposalFor(['NVDA'], { reasons: [{ symbol: 'NVDA', text: 'a', findingIds: ['eN'] }, { symbol: 'NVDA', text: 'b', findingIds: ['rN'] }] });
    expect(applyCardOp(c, { op: 'set', part: 'why', value: { keep: [1] } }, CTX).card.why).toMatchObject({ state: 'set', by: 'player_chose', reasons: [{ text: 'b' }], proposal: null });
    expect(applyCardOp(c, { op: 'set', part: 'why', value: { keep: [] } }, CTX)).toEqual({ ok: false, reason: 'invalid_value' });
    c.why.proposal.reasons = [{ symbol: 'NVDA', text: 'a', findingIds: ['iN'] }];
    expect(applyCardOp(c, { op: 'confirm', part: 'why' }, CTX)).toEqual({ ok: false, reason: 'why_incomplete' });
  });
  it('why: a point against whose finding is gone confirms as none ("No point against found yet")', () => {
    const c = cardWith({ names: ['NVDA'] });
    c.why.proposal = proposalFor(['NVDA'], { against: { text: 'x', findingIds: ['gone'] } });
    expect(applyCardOp(c, { op: 'confirm', part: 'why' }, CTX).card.why.against).toBeNull();
  });
  it('wrong if: an option, the player\'s own words (verbatim), price lines for set names only', () => {
    const c = cardWith({ names: ['NVDA'] });
    c.wrongIf.options = [{ text: 'big buyers cut spending', findingIds: ['c1'] }];
    expect(applyCardOp(c, { op: 'set', part: 'wrongIf', value: { option: 0 } }, CTX).card.wrongIf).toMatchObject({ state: 'set', by: 'player_chose', text: 'big buyers cut spending', findingIds: ['c1'] });
    const mine = applyCardOp(c, { op: 'set', part: 'wrongIf', value: { text: 'NVDA is a strong buy and will hit $500', priceLines: [{ symbol: 'nvda', level: 120.5 }] } }, CTX);
    expect(mine.card.wrongIf).toMatchObject({ by: 'player_wrote', text: 'NVDA is a strong buy and will hit $500', priceLines: [{ symbol: 'NVDA', level: 120.5 }] });
    expect(applyCardOp(c, { op: 'set', part: 'wrongIf', value: { text: 'x', priceLines: [{ symbol: 'AMD', level: 5 }] } }, CTX).reason).toBe('invalid_value');
    expect(applyCardOp(c, { op: 'set', part: 'wrongIf', value: { text: 'x', priceLines: [{ symbol: 'NVDA', level: -1 }] } }, CTX).reason).toBe('invalid_value');
    expect(applyCardOp(c, { op: 'set', part: 'wrongIf', value: { priceLines: [] } }, CTX).reason).toBe('invalid_value'); // lines alone only on a set wrong-if
    const set = mine.card;
    expect(applyCardOp(set, { op: 'set', part: 'wrongIf', value: { priceLines: [] } }, CTX).card.wrongIf).toMatchObject({ text: set.wrongIf.text, priceLines: [] });
  });
  it('a confirm from a pick whose finding is no longer current is refused', () => {
    const c = cardWith({ segment: false });
    c.segment.map = [{ label: 'A', line: 'a', findingIds: [] }, { label: 'B', line: 'b', findingIds: [] }];
    c.pick = { part: 'segment', value: 'A', reason: 'r', findingIds: ['gone'], reasons: [], asked: false };
    expect(applyCardOp(c, { op: 'confirm', part: 'segment' }, CTX)).toEqual({ ok: false, reason: 'suggestion_stale' });
    c.pick.findingIds = ['c1'];
    expect(applyCardOp(c, { op: 'confirm', part: 'segment' }, CTX).card.segment).toMatchObject({ state: 'set', value: 'A', by: 'partner_suggested_confirmed' });
  });
  it('labels for the card exchange (R-21)', () => {
    const c = cardWith({ names: ['NVDA'] });
    expect(applyCardOp(c, { op: 'set', part: 'timeFrame', value: 'swing' }, CTX).label).toBe('Time frame: Swing · about 10 sessions');
    expect(applyCardOp(c, { op: 'set', part: 'names', value: ['NVDA', 'AMD'] }, CTX).label).toBe('Names: NVDA and AMD');
    expect(applyCardOp(c, { op: 'set', part: 'segment', value: 'skip' }, CTX).label).toBe('Segment: skipped');
    expect(applyCardOp(c, { op: 'clear', part: 'names' }, CTX).label).toBe('Changed names');
  });
});

describe('the rev rule and the opId (§B4.3)', () => {
  it('an applied op moves rev by one and keeps its opId; the same opId again applies nothing', () => {
    const c = cardWith({});
    const a = cardOpOf(c, { opId: 'op-1', op: 'set', part: 'timeFrame', value: 'swing' }, CTX);
    expect([a.applied, a.card.rev, a.card.ops]).toEqual([true, 1, ['op-1']]);
    const again = cardOpOf(a.card, { opId: 'op-1', op: 'set', part: 'timeFrame', value: 'longterm' }, CTX);
    expect([again.applied, again.card]).toEqual([false, a.card]);
  });
  it(`keeps the last ${OPS_KEPT} opIds`, () => {
    let c = cardWith({});
    for (let i = 0; i < OPS_KEPT + 3; i++) c = cardOpOf(c, { opId: `op-${i}`, op: 'set', part: 'timeFrame', value: 'swing' }, CTX).card;
    expect(c.ops).toHaveLength(OPS_KEPT);
    expect(c.ops[0]).toBe('op-3');
    expect(c.rev).toBe(OPS_KEPT + 3);
  });
  it('a refused op changes nothing and keeps no opId', () => {
    expect(cardOpOf(cardWith({}), { opId: 'x', op: 'set', part: 'timeFrame', value: 'never' }, CTX)).toEqual({ ok: false, reason: 'invalid_value' });
  });
});

describe('a step\'s proposals (§B4.2 — no step ever sets a part, V2-4)', () => {
  const P = (over = {}) => ({ goal: 'build_why', themeSuggestion: null, map: null, why: null, wrongIfOptions: null, timeFrame: null, pick: null, ...over });
  it('every proposal lands as a suggestion; no part moves to set; rev + 1', () => {
    const c = emptyCard();
    const out = applyProposals(c, P({
      themeSuggestion: 'AI', map: [{ label: 'A', line: 'a', findingIds: [] }, { label: 'B', line: 'b', findingIds: ['c1'] }],
      wrongIfOptions: [{ text: 'buyers cut', findingIds: [] }], timeFrame: { value: 'longterm', reason: 'slow build' },
      pick: { part: 'segment', value: 'B', reason: 'r', findingIds: ['c1'], reasons: [], asked: false },
    }), CTX);
    for (const p of THESIS_PARTS) expect(out[p].state).toBe('unset');
    expect(out.rev).toBe(1);
    expect(out.theme.suggestion).toBe('AI');
    expect(out.segment.map).toHaveLength(2);
    expect(out.pick).toMatchObject({ part: 'segment', value: 'B' });
    expect(out.timeFrame.suggestion).toEqual({ value: 'longterm', reason: 'slow build' });
  });
  it('a why proposal lands only for the names the step worked on (the player may have changed them meanwhile)', () => {
    const c = cardWith({ names: ['NVDA'] });
    expect(applyProposals(c, P({ why: proposalFor(['NVDA']) }), CTX).why.proposal).not.toBeNull();
    expect(applyProposals(c, P({ why: proposalFor(['AMD']) }), CTX).why.proposal).toBeNull();
  });
  it('a pick for a part the player set meanwhile is dropped; every step replaces the pick, with null when it has none', () => {
    const c = READY();
    c.pick = { part: 'wrongIf', value: 'x', reason: 'r', findingIds: [], reasons: [], asked: false };
    expect(applyProposals(c, P({ pick: { part: 'segment', value: 'Networking', reason: 'r', findingIds: [], reasons: [], asked: true } }), CTX).pick).toBeNull();
    expect(applyProposals(c, P(), CTX).pick).toBeNull();
  });
  it('find_names with no supported company blocks the names part; with one, unblocks it', () => {
    const c = cardWith({});
    expect(applyProposals(c, P({ goal: 'find_names' }), ctxOf({ supported: [] })).names.blocked).toBe('no_listed_company');
    expect(applyProposals(c, P({ goal: 'find_names' }), CTX).names.blocked).toBeNull();
    expect(applyProposals(c, P({ goal: 'map_segments' }), ctxOf({ supported: [] })).names.blocked).toBeNull();
  });
  it('a theme suggestion never replaces a set theme', () => {
    expect(applyProposals(READY(), P({ themeSuggestion: 'Other' }), CTX).theme).toMatchObject({ state: 'set', value: 'AI', suggestion: null });
  });
});

describe('the save\'s evidence and the saved card (§B4.5; §B10 S-B1, PF-1, PF-2)', () => {
  it('carried: each name\'s relationship fact, the reasons\' findings, the point against — current, each once', () => {
    const c = cardWith({ names: ['NVDA', 'AMD'], why: true });
    expect(carriedIdsOf(c, CTX)).toEqual(['rN', 'rA', 'eN', 'eA', 'c1']);
  });
  it('price lines become daily-close "below" conditions', () => {
    const c = READY();
    c.wrongIf.priceLines = [{ symbol: 'NVDA', level: 120 }];
    expect(priceConditionsOf(c)).toEqual([{ symbol: 'NVDA', side: 'below', level: 120, basis: 'daily_close' }]);
  });
  it('the saved card: its schemaVersion, the list, idea version 1, the session and record, who set each part, the wrong-if in words', () => {
    const c = READY();
    const saved = savedCardOf(c, { watchlistId: 'wl1', sessionId: 's1', researchWorkId: 'sr_s1', statement: 'S', carried: ['rN'], savedAt: '2026-11-16T15:00:00.000Z' });
    expect(saved).toMatchObject({
      schemaVersion: 1, watchlistId: 'wl1', hypothesisVersion: 1, sessionId: 's1', researchWorkId: 'sr_s1', statement: 'S', sentence: sentenceOf(c),
      names: { value: ['NVDA'], by: 'player_chose' }, why: { by: 'partner_suggested_confirmed' }, wrongIf: { text: 'big buyers cut spending for two quarters', by: 'player_wrote' },
      timeFrame: { value: 'positional', by: 'player_chose' }, findingIds: ['rN'],
    });
    expect(THESIS_CARD_FIELD).toBe('thesisCard');
  });
});

describe('the view (§B4.4; §B10 S-B3)', () => {
  it('carries the derived states, rev, ready, blockers, sentence, filled, dependents and the choices', () => {
    const v = thesisViewOf(READY(), CTX);
    expect(Object.keys(v)).toEqual(['schemaVersion', 'rev', 'parts', 'pick', 'filled', 'ready', 'blockers', 'sentence', 'dependents', 'choices']);
    expect([v.ready, v.filled, v.parts.timeFrame.label]).toEqual([true, 6, 'Positional · about 30 sessions']);
    expect(Object.keys(v.choices)).toEqual(['research', 'free']);
  });
  it('labels each pick reason by the server: Source-backed only when every finding is current and Source-backed', () => {
    const c = cardWith({ segment: false });
    c.segment.map = [{ label: 'A', line: 'a', findingIds: [] }, { label: 'B', line: 'b', findingIds: [] }];
    c.pick = { part: 'segment', value: 'A', reason: 'r', findingIds: ['c1'], asked: true, reasons: [{ text: 'one', findingIds: ['c1'] }, { text: 'two', findingIds: ['iN'] }, { text: 'three', findingIds: [] }] };
    const v = thesisViewOf(c, CTX);
    expect(v.pick.basis).toBe('source');
    expect(v.pick.reasons.map((r) => r.basis)).toEqual(['source', 'reasoning', 'reasoning']);
  });
  it('an incomplete proposal names its unsourced names (SQ-3)', () => {
    const c = cardWith({ names: ['NVDA', 'AMD'] });
    c.why.proposal = proposalFor(['NVDA', 'AMD']);
    c.why.proposal.reasons[1].findingIds = ['iN'];
    expect(thesisViewOf(c, CTX).parts.why.proposal.incomplete).toEqual(['AMD']);
    expect(namesWithoutReasonOf(CTX, c.why.proposal.reasons, ['NVDA', 'AMD'])).toEqual(['AMD']);
  });
});
