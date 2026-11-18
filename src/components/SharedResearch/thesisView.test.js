// Shared Research B4 — THE THESIS BUILDER'S DISPLAY RULES, pure (build prompt K-4, K-7,
// K-9, K-10). Every row reads the server's own answers (__fixtures__/thesisAnswers.json,
// composed by B3's functions in thesisAnswers.test.js): no thesis is typed here.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import A from './__fixtures__/thesisAnswers.json';
import {
  frontPartOf, footOf, panelOf, valueChoicesOf, confirmMarkOf, slotOf, sentenceRunsOf, conversationOf, partFindingIdsOf,
  isBuilderSession, joinNames, horizonLabelOf, hasSuggestedPart, partOfGoal, directionOffered, revisedWhyChoiceOf, PARTLESS_GOALS, THESIS_PARTS,
  proposalReasonHolds,
} from './thesisView';
import { THESIS_PARTS as SHARED_THESIS_PARTS, STATUS_LABELS, findingLabelOf } from '../../constants/sharedResearch';

const T = (k) => A[k].body.thesis;
const offered = (thesis) => [...thesis.choices.research, ...thesis.choices.free];
/** Every entry a function returns is one the server offered, unchanged (by identity of value). */
const isOffered = (thesis, entry) => offered(thesis).some((c) => JSON.stringify(c) === JSON.stringify(entry));

describe('K-4: the part in front (the table)', () => {
  it.each([
    ['walkOpen', 'segment'],
    ['walkMap', 'segment'],
    ['walkSegment', 'names'],
    ['walkNames', 'names'],
    ['walkOneStock', 'why'],
    ['walkWhy', 'why'],
    ['walkConfirmWhy', 'wrongIf'],
    ['walkWrongIf', 'timeFrame'],
    ['walkTimeFrame', null],
    ['getStaleSegment', 'segment'],
    ['getDeadEnd', 'names'],
    ['getOutOfSteps', 'wrongIf'],
    ['storyOpen', 'theme'],
    ['storyVerified', 'theme'],
    ['getIncompleteWhy', 'why'],
    ['getGroupReady', null],
  ])('%s → %s', (key, part) => {
    expect(frontPartOf(T(key))).toBe(part);
  });
  it('a stale part comes first, in blockers order, ahead of an unset part before it', () => {
    // the stale segment's card: theme set, segment stale, the rest set — the stale one is in front
    const t = T('getStaleSegment');
    expect(t.parts.segment.state).toBe('stale');
    expect(t.blockers[0]).toEqual({ part: 'segment', state: 'stale' });
    // and with a stale part LATER in the order than an unset one, the stale one still leads
    const later = { ...t, parts: { ...t.parts, theme: { ...t.parts.theme, state: 'unset' } }, blockers: [{ part: 'names', state: 'stale' }] };
    expect(frontPartOf(later)).toBe('names');
  });
  it('nothing in front without a card', () => {
    expect(frontPartOf(null)).toBe(null);
    expect(frontPartOf({})).toBe(null);
  });
});

describe('K-4: the foot holds only what the server offered, ordered', () => {
  it.each(Object.keys(A).filter((k) => A[k]?.body?.thesis && A[k].body.thesis.choices))('%s: every foot and panel entry is an offered one', (key) => {
    const t = T(key);
    const foot = footOf(t);
    for (const e of [...foot.values, ...foot.research, foot.skip, foot.change, foot.text].filter(Boolean)) expect(isOffered(t, e), JSON.stringify(e)).toBe(true);
    for (const part of ['theme', 'segment', 'names', 'why', 'wrongIf', 'timeFrame']) {
      const p = panelOf(t, part);
      for (const e of [p.change, ...p.research, ...p.values, p.text, p.skip, p.revised, p.priceLines].filter(Boolean)) expect(isOffered(t, e), `${part}: ${JSON.stringify(e)}`).toBe(true);
    }
  });
  it('the open card: Map the segments (no part), the segment\'s skip last, the direction left to the composer', () => {
    const f = footOf(T('walkOpen'));
    expect(f.research).toEqual([{ goal: 'map_segments' }]);
    expect(f.skip).toEqual({ op: 'set', part: 'segment', value: 'skip' });
    expect(f.values).toEqual([]);
    expect(f.text).toBe(null);
  });
  it('the map: the four segments, the agent\'s pick standing in for its own `set` (never twice), You pick, Map again', () => {
    const t = T('walkMap');
    const f = footOf(t);
    expect(f.values.map((c) => `${c.op}:${c.value}`)).toEqual(['confirm:Accelerator chips', 'set:Chip networking', 'set:Data-center power', 'set:Cloud spenders']);
    expect(confirmMarkOf(f.values[0], t)).toBe('pick');
    expect(f.research).toEqual([{ goal: 'pick', part: 'segment' }, { goal: 'map_segments' }]);
  });
  it('the names: the multi-pick and the agent\'s names pick', () => {
    const f = footOf(T('walkNames'));
    expect(f.values).toEqual([
      { op: 'confirm', part: 'names', value: ['NVDA', 'AMD'] },
      { op: 'set', part: 'names', options: ['NVDA', 'AMD', 'AVGO'], min: 1, max: 4 },
    ]);
  });
  it('the why: Confirm these reasons, and Find the reasons again; the time frame waits in its part', () => {
    const f = footOf(T('walkWhy'));
    expect(f.values).toEqual([{ op: 'confirm', part: 'why' }]);
    expect(f.research).toEqual([{ goal: 'build_why' }]);
  });
  it('the wrong if: the options with the pick in its place, You pick, and the text box (the composer\'s free mode)', () => {
    const t = T('walkConfirmWhy');
    const f = footOf(t);
    expect(f.values.map((c) => c.op)).toEqual(['confirm', 'set', 'set']);
    expect(f.values[0].value).toBe(t.parts.wrongIf.options[0].text);
    expect(f.research).toEqual([{ goal: 'pick', part: 'wrongIf' }]);
    expect(f.text).toEqual({ op: 'set', part: 'wrongIf', input: 'text', max: 200 });
  });
  it('the time frame: the suggestion stands in for its own horizon', () => {
    const t = T('walkWrongIf');
    const f = footOf(t);
    expect(f.values.map((c) => `${c.op}:${c.value}`)).toEqual(['set:swing', 'confirm:positional', 'set:longterm']);
    expect(confirmMarkOf(f.values[1], t)).toBe('suggestion');
  });
  it('ready: no part in front; the foot lists every research choice but direction (Keep researching)', () => {
    const f = footOf(T('walkTimeFrame'));
    expect(f.part).toBe(null);
    expect(f.research.map((g) => `${g.goal}:${g.part}`)).toEqual(['strengthen:theme', 'strengthen:segment', 'strengthen:names', 'strengthen:why', 'strengthen:wrongIf', 'strengthen:timeFrame']);
  });
  it('a stale part in front brings its Change and its strengthen (K-7: it names what to do)', () => {
    const f = footOf(T('getStaleSegment'));
    expect(f.change).toEqual({ op: 'clear', part: 'segment', clears: ['names', 'why'] });
    expect(f.research).toEqual([{ goal: 'strengthen', part: 'segment' }]);
  });
  it('the incomplete why: no confirm; the drop (a names choice) belongs to the why', () => {
    const t = T('getIncompleteWhy');
    expect(valueChoicesOf(t, 'why')).toEqual([{ op: 'set', part: 'names', value: ['NVDA'], reason: 'drop_unsourced', clears: [] }]);
    expect(valueChoicesOf(t, 'names')).toEqual([]);
  });
  it('the story: verify first; then the theme suggestion as its own confirm', () => {
    expect(footOf(T('storyOpen')).research).toEqual([{ goal: 'verify_source' }]);
    expect(footOf(T('storyOpen')).text).toEqual({ op: 'set', part: 'theme', input: 'text', max: 80 });
    const v = footOf(T('storyVerified'));
    expect(v.values).toEqual([{ op: 'confirm', part: 'theme', value: 'Cloud AI data-center spending' }]);
  });
  it('4A-5: a pick marks only the confirm whose value is the pick\'s; another confirm keeps its own mark', () => {
    const t = T('walkWrongIf'); // the time frame in front; its confirm is the suggestion's (positional)
    const confirm = t.choices.free.find((c) => c.op === 'confirm' && c.part === 'timeFrame');
    expect(confirmMarkOf(confirm, t)).toBe('suggestion');
    const asked = { ...t, pick: { part: 'timeFrame', value: 'swing', reason: 'r', findingIds: [], asked: true, basis: 'reasoning', reasons: [] } };
    expect(confirmMarkOf(confirm, asked)).toBe('suggestion');
    const same = { ...asked, pick: { ...asked.pick, value: 'positional' } };
    expect(confirmMarkOf(confirm, same)).toBe('asked');
  });
  it('the asked pick: its confirm stands first, the other segments beside it', () => {
    const t = T('pickAsked');
    const f = footOf(t);
    expect(f.values[0]).toMatchObject({ op: 'confirm', part: 'segment' });
    expect(confirmMarkOf(f.values[0], t)).toBe('asked');
    expect(f.values.filter((c) => c.op === 'set').length).toBe(t.parts.segment.map.length - 1);
  });
  it('the dead end: nothing in the foot to pick; Try another segment is the segment\'s Change', () => {
    const t = T('getDeadEnd');
    const f = footOf(t);
    expect(f.values).toEqual([]);
    expect(f.research).toEqual([]);
    expect(panelOf(t, 'segment').change).toEqual({ op: 'clear', part: 'segment', clears: ['names', 'why'] });
  });
  it('out of steps: no research at all; the free choices stay; the composer has no direction', () => {
    const t = T('getOutOfSteps');
    expect(footOf(t).research).toEqual([]);
    expect(directionOffered(t)).toBe(false);
    expect(footOf(t).values.length).toBeGreaterThan(0);
  });
  it('the revised why is the why panel\'s, only when the server offers it (§B12 W-13)', () => {
    expect(revisedWhyChoiceOf(T('revisedWhy'))).toEqual({ op: 'confirm', part: 'why', revised: true });
    expect(panelOf(T('revisedWhy'), 'why').revised).toEqual({ op: 'confirm', part: 'why', revised: true });
    expect(revisedWhyChoiceOf(T('walkTimeFrame'))).toBe(null);
    expect(panelOf(T('walkTimeFrame'), 'why').revised).toBe(null);
  });
  it('the partless goals are the four K-4 names', () => {
    expect([...PARTLESS_GOALS]).toEqual(['verify_source', 'map_segments', 'find_names', 'build_why']);
  });
});

describe('K-7: the card draws the server\'s states; it composes no sentence', () => {
  it('a suggested part shows its suggestion, marked suggested — never as set (DR-3)', () => {
    const t = T('walkWhy');
    expect(slotOf(t, 'why')).toEqual({ part: 'why', state: 'suggested', text: t.parts.why.proposal.shared, skipped: false });
    expect(slotOf(t, 'timeFrame')).toMatchObject({ state: 'suggested', text: 'Positional · about 30 sessions' });
    expect(hasSuggestedPart(t)).toBe(true);
    expect(hasSuggestedPart(T('walkTimeFrame'))).toBe(false);
  });
  it('an unset part has no text; a stale one keeps its value with its state', () => {
    expect(slotOf(T('walkOpen'), 'segment')).toEqual({ part: 'segment', state: 'unset', text: null, skipped: false });
    expect(slotOf(T('getStaleSegment'), 'segment')).toMatchObject({ state: 'stale', text: 'Accelerator chips' });
  });
  it.each(['walkTimeFrame', 'getGroupReady', 'getSaveIssue', 'walkPriceLine'])('%s: the sentence runs join back to the server\'s sentence exactly, each set part found', (key) => {
    const t = T(key);
    const runs = sentenceRunsOf(t.sentence, t);
    expect(runs.map((r) => r.text).join('')).toBe(t.sentence);
    expect(runs.filter((r) => r.part).map((r) => r.part)).toEqual(['theme', 'segment', 'names', 'why', 'wrongIf', 'timeFrame']);
  });
  it('a stale part stays findable in the server\'s sentence, with its state, so it can be marked where it stands', () => {
    const t = T('getStaleSegment');
    const runs = sentenceRunsOf(t.sentence, t);
    expect(runs.map((r) => r.text).join('')).toBe(t.sentence);
    expect(runs.find((r) => r.part === 'segment')).toEqual({ text: 'Accelerator chips', part: 'segment', state: 'stale' });
  });
  it('a part whose text the sentence does not hold is left untappable; nothing is added', () => {
    const t = T('walkTimeFrame');
    const odd = { ...t, parts: { ...t.parts, theme: { ...t.parts.theme, value: 'not in the sentence' } } };
    const runs = sentenceRunsOf(t.sentence, odd);
    expect(runs.map((r) => r.text).join('')).toBe(t.sentence);
    expect(runs.some((r) => r.part === 'theme')).toBe(false);
  });
  it('a part\'s sources: its own ids; the names\' from companies.supported; the why\'s reasons and point against', () => {
    const t = T('walkTimeFrame');
    const companies = A.walkGetReady.body.companies;
    expect(partFindingIdsOf(t, 'segment', companies)).toEqual(t.parts.segment.findingIds);
    expect(partFindingIdsOf(t, 'names', companies)).toEqual(companies.supported.find((c) => c.symbol === 'NVDA').evidence);
    expect(partFindingIdsOf(t, 'why', companies)).toEqual([...new Set([...t.parts.why.reasons.flatMap((r) => r.findingIds), ...t.parts.why.against.findingIds])]);
    expect(partFindingIdsOf(t, 'theme', companies)).toEqual([]);
  });
  it('names said as a list; a horizon as the card says it', () => {
    expect(joinNames(['NVDA'])).toBe('NVDA');
    expect(joinNames(['NVDA', 'AMD'])).toBe('NVDA and AMD');
    expect(joinNames(['NVDA', 'AMD', 'AVGO'])).toBe('NVDA, AMD and AVGO');
    expect(horizonLabelOf('positional')).toBe(T('walkTimeFrame').parts.timeFrame.label);
    expect(horizonLabelOf('intraday')).toBe(null);
  });
});

describe('K-9: the conversation is the exchanges, in order', () => {
  it('the walk: the words, each research tap from its partner exchange, the replies, the card lines', () => {
    const rows = conversationOf(A.walkGetReady.body.session).map((r) => (r.kind === 'tap' ? `tap:${r.goal}` : r.kind));
    expect(rows).toEqual(['words', 'tap:map_segments', 'said', 'card', 'tap:find_names', 'said', 'card', 'tap:build_why', 'said', 'card', 'card', 'card']);
  });
  it('a direction step: the player\'s own line once, and no second tap line for it', () => {
    const rows = conversationOf(A.walkDirection.body.session).map((r) => r.kind);
    expect(rows).toEqual(['words', 'direction', 'said']);
  });
  it('the replies are the server\'s text, as stored', () => {
    const s = A.walkGetReady.body.session;
    const said = conversationOf(s).filter((r) => r.kind === 'said').map((r) => r.text);
    expect(said).toEqual(s.exchanges.filter((e) => e.who === 'partner').map((e) => e.text));
  });
});

describe('restated, pinned equal (review 4D-1: no new import from the hub chunk)', () => {
  it('the six parts are the shared vocabulary\'s, in order', () => {
    expect([...THESIS_PARTS]).toEqual([...SHARED_THESIS_PARTS]);
  });
  it('"Source-backed" is the shared label for a verified finding', () => {
    expect(findingLabelOf({ status: 'verified' })).toBe(STATUS_LABELS.verified);
  });
});

describe('small rules', () => {
  it('the session decides the view (K-2)', () => {
    expect(isBuilderSession(A.walkGetOpen.body.session)).toBe(true);
    expect(isBuilderSession({ sessionId: 'x' })).toBe(false);
    expect(isBuilderSession(null)).toBe(false);
  });
  it('the working slot follows the goal in flight', () => {
    expect(partOfGoal('map_segments')).toBe('segment');
    expect(partOfGoal('find_names')).toBe('names');
    expect(partOfGoal('build_why')).toBe('why');
    expect(partOfGoal('verify_source')).toBe('theme');
    expect(partOfGoal('strengthen', 'wrongIf')).toBe('wrongIf');
    expect(partOfGoal('direction')).toBe(null);
  });
});

describe('a why proposal\'s reason wears "Source-backed" only where the server\'s per-name answer covers it (review 4A-4; the refuter)', () => {
  const corrected = A.getProposalCorrected.body.thesis.parts.why.proposal; // NVDA incomplete
  const group = A.groupWhy.body.thesis.parts.why.proposal; // three names, one reason each, none incomplete
  // two reasons for one name: the server says the name holds a sourced reason, not which one
  const twice = { ...group, reasons: [...group.reasons, { ...group.reasons[0], text: 'A second reason for the same name.' }] };
  it.each([
    ['a name the server marks incomplete', corrected, corrected.reasons[0], false],
    ...group.reasons.map((r) => [`${r.symbol}: its only reason, the name not incomplete`, group, r, true]),
    ['a name with two reasons: the first', twice, twice.reasons[0], false],
    ['a name with two reasons: the second', twice, twice.reasons.at(-1), false],
    ['the other names beside it keep their tag', twice, twice.reasons[1], true],
    ['no proposal', null, group.reasons[0], false],
    ['no reason', group, null, false],
  ])('%s', (_label, proposal, reason, holds) => {
    expect(proposalReasonHolds(proposal, reason)).toBe(holds);
  });
  it('the fixtures are what the rows say', () => {
    expect(corrected.incomplete).toEqual(['NVDA']);
    expect(group.incomplete ?? []).toEqual([]);
    expect(new Set(group.reasons.map((r) => r.symbol)).size).toBe(group.reasons.length);
    expect(group.reasons.length).toBeGreaterThanOrEqual(2);
  });
});

describe('P-1 (the phone round): no builder file lets a word break inside itself', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const FILES = ['builderParts.jsx', 'screens/Builder.jsx', 'screens/ThesisReady.jsx', 'screens/ThesisSaved.jsx'];
  const src = (rel) => readFileSync(resolve(HERE, rel), 'utf8');
  it.each(FILES)('%s: never overflow-wrap "anywhere"; every shared text style followed by WRAP', (rel) => {
    const text = src(rel);
    expect(text).not.toMatch(/overflowWrap:\s*'anywhere'/);
    expect(text.match(/style=\{S\.(small|body|meta)\}/g) ?? []).toEqual([]);
    expect(text.match(/\.\.\.S\.(small|body|meta)(?!, \.\.\.WRAP)[,\s}]/g) ?? []).toEqual([]);
  });
  it('WRAP breaks a word only when it alone is wider than its line', () => {
    expect(src('builderParts.jsx')).toContain("export const WRAP = Object.freeze({ overflowWrap: 'break-word', minWidth: 0 });");
  });
});
