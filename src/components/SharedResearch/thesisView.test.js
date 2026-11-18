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
  proposalReasonHolds, themeLineOf,
} from './thesisView';
import { THESIS_PARTS as SHARED_THESIS_PARTS, STATUS_LABELS, findingLabelOf } from '../../constants/sharedResearch';

const T = (k) => A[k].body.thesis;
const offered = (thesis) => [...thesis.choices.research, ...thesis.choices.free];
/** Every entry a function returns is one the server offered, unchanged (by identity of value). */
const isOffered = (thesis, entry) => offered(thesis).some((c) => JSON.stringify(c) === JSON.stringify(entry));

describe('K-4: the part in front (the table)', () => {
  it.each([
    ['walkOpen', 'theme'], // §B13 T-1 (moved from segment): the open leaves the theme unset with no suggestion — it stays in front
    ['walkMap', 'segment'], // §B13 T-6: the map's suggested theme does not hold the front
    ['walkThemeConfirm', 'segment'],
    ['walkThemeOwn', 'segment'],
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
    ['storyVerified', 'segment'], // §B13 T-6 (moved from theme): the check's suggested theme does not hold the front
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
  // §B13 T-1 (moved from "the segment's skip last" and no text box): the theme is in front at the open, so the foot holds
  // its own text box (the composer) and Map the segments; the segment's skip waits until the segment is in front
  it('the open card: Map the segments (no part), the theme\'s own text box in the composer, no skip yet', () => {
    const f = footOf(T('walkOpen'));
    expect(f.part).toBe('theme');
    expect(f.research).toEqual([{ goal: 'map_segments' }]);
    expect(f.skip).toBe(null);
    expect(f.values).toEqual([]);
    expect(f.text).toEqual({ op: 'set', part: 'theme', input: 'text', max: 80 });
  });
  // §B13 T-7 (moved from B3's map labels): the walk's map is now the B5 recorded answer
  it('the map: the four segments, the agent\'s pick standing in for its own `set` (never twice), You pick, Map again', () => {
    const t = T('walkMap');
    const f = footOf(t);
    expect(f.values.map((c) => `${c.op}:${c.value}`)).toEqual(['confirm:Accelerator chips', 'set:Networking', 'set:Power and grid', 'set:Cloud spenders']);
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
    // §B13 T-1 (moved): the walk leaves the theme suggested, so there is no strengthen:theme
    expect(f.research.map((g) => `${g.goal}:${g.part}`)).toEqual(['strengthen:segment', 'strengthen:names', 'strengthen:why', 'strengthen:wrongIf', 'strengthen:timeFrame']);
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
  // §B13 T-6 (moved from "the theme suggestion as its own confirm" in the foot): the suggestion sits in the theme's line
  it('the story: verify first; then the theme suggestion in the theme\'s line, the segment in front with Map the segments', () => {
    expect(footOf(T('storyOpen')).research).toEqual([{ goal: 'verify_source' }]);
    expect(footOf(T('storyOpen')).text).toEqual({ op: 'set', part: 'theme', input: 'text', max: 80 });
    const t = T('storyVerified');
    const v = footOf(t);
    expect(v.part).toBe('segment');
    expect(v.research).toEqual([{ goal: 'map_segments' }]); // §B13 T-2: the map does not wait for the theme
    expect(themeLineOf(t)).toEqual({ confirm: { op: 'confirm', part: 'theme', value: 'Cloud AI data-center spending' }, text: { op: 'set', part: 'theme', input: 'text', max: 80 } });
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
    // §B13 T-1 (moved from false): the walk's ready card still holds the map's theme suggestion; confirmed, none is left
    expect(hasSuggestedPart(T('walkTimeFrame'))).toBe(true);
    expect(hasSuggestedPart(T('getReadyThemed'))).toBe(false);
  });
  it('an unset part has no text; a stale one keeps its value with its state', () => {
    expect(slotOf(T('walkOpen'), 'segment')).toEqual({ part: 'segment', state: 'unset', text: null, skipped: false });
    expect(slotOf(T('getStaleSegment'), 'segment')).toMatchObject({ state: 'stale', text: 'Accelerator chips' });
  });
  // §B13 T-2 (moved from one order, theme first): the server's sentence has four shapes — with no theme it opens at the
  // names, then the segment — so each set part is found where it STANDS, in the sentence's own order
  it.each([
    ['walkTimeFrame', ['names', 'segment', 'why', 'wrongIf', 'timeFrame']],
    ['getGroupReady', ['names', 'segment', 'why', 'wrongIf', 'timeFrame']],
    ['getSaveIssue', ['names', 'segment', 'why', 'wrongIf', 'timeFrame']],
    ['walkPriceLine', ['names', 'segment', 'why', 'wrongIf', 'timeFrame']],
    ['getReadyThemed', ['theme', 'segment', 'names', 'why', 'wrongIf', 'timeFrame']],
    ['getReadySkipped', ['names', 'why', 'wrongIf', 'timeFrame']],
    ['getReadyThemedSkipped', ['theme', 'names', 'why', 'wrongIf', 'timeFrame']],
  ])('%s: the sentence runs join back to the server\'s sentence exactly, each set part found where it stands', (key, order) => {
    const t = T(key);
    const runs = sentenceRunsOf(t.sentence, t);
    expect(runs.map((r) => r.text).join('')).toBe(t.sentence);
    expect(runs.filter((r) => r.part).map((r) => r.part)).toEqual(order);
    const setParts = THESIS_PARTS.filter((p) => t.parts[p].state === 'set' && !(p === 'segment' && t.parts.segment.skipped));
    expect([...order].sort()).toEqual([...setParts].sort());
    for (const r of runs.filter((x) => x.part)) expect(t.sentence.indexOf(r.text)).toBeGreaterThanOrEqual(0);
  });
  // review B3: the parts are found in the order the sentence holds them, so a segment named like a name, or a word of the
  // frame, never takes another part's span (the server's sentence, its parts and their texts changed together)
  it('review B3: no theme, a segment named like one of the names — each found where it stands', () => {
    const t = T('walkTimeFrame');
    const sentence = t.sentence.replace('Built on NVDA, through Accelerator chips', 'Built on AMD and NVDA, through AMD');
    const odd = { ...t, sentence, parts: { ...t.parts, segment: { ...t.parts.segment, value: 'AMD' }, names: { ...t.parts.names, value: ['AMD', 'NVDA'] } } };
    const runs = sentenceRunsOf(sentence, odd);
    expect(runs.map((r) => r.text).join('')).toBe(sentence);
    expect(runs.slice(0, 4)).toEqual([
      { text: 'Built on ', part: null }, { text: 'AMD and NVDA', part: 'names', state: 'set' },
      { text: ', through ', part: null }, { text: 'AMD', part: 'segment', state: 'set' },
    ]);
  });
  it('review B3: a theme set, a segment whose label is a word of the frame ("theme") — found after "through", not in "My theme is"', () => {
    const t = T('getReadyThemed');
    const sentence = t.sentence.replace('through Accelerator chips', 'through theme');
    const odd = { ...t, sentence, parts: { ...t.parts, segment: { ...t.parts.segment, value: 'theme' } } };
    const runs = sentenceRunsOf(sentence, odd);
    expect(runs.map((r) => r.text).join('')).toBe(sentence);
    const seg = runs.findIndex((r) => r.part === 'segment');
    expect(runs.slice(0, seg).map((r) => r.text).join('')).toMatch(/, through $/);
    expect(runs[0]).toEqual({ text: 'My theme is ', part: null });
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

describe('§B13 T-6: a suggested theme does not hold the front', () => {
  it.each([
    ['walkOpen', 'unset', 'theme', false], // no suggestion: the theme stays in front, as before
    ['walkMap', 'suggested', 'segment', true],
    ['walkSegment', 'suggested', 'names', true],
    ['walkWhy', 'suggested', 'why', true],
    ['walkThemeConfirm', 'set', 'segment', false],
    ['walkThemeOwn', 'set', 'segment', false],
    ['storyOpen', 'unset', 'theme', false],
    ['storyVerified', 'suggested', 'segment', true],
  ])('%s: the theme %s → %s in front; the theme\'s line %s', (key, state, front, line) => {
    const t = T(key);
    expect(t.parts.theme.state).toBe(state);
    expect(frontPartOf(t)).toBe(front);
    expect(themeLineOf(t) !== null).toBe(line);
  });
  it('the line carries the server\'s confirm and its text box, exactly as offered', () => {
    const t = T('walkMap');
    const line = themeLineOf(t);
    expect(line.confirm).toEqual({ op: 'confirm', part: 'theme', value: t.parts.theme.suggestion });
    expect(line.text).toEqual({ op: 'set', part: 'theme', input: 'text', max: 80 });
    expect(isOffered(t, line.confirm) && isOffered(t, line.text)).toBe(true);
  });
  it('after the first map, the segment\'s choices are the foot\'s at once; the theme\'s are not among them', () => {
    const f = footOf(T('walkMap'));
    expect(f.part).toBe('segment');
    expect(f.values.every((c) => c.part === 'segment')).toBe(true);
    expect(f.text).toBe(null);
    expect(f.skip).toEqual({ op: 'set', part: 'segment', value: 'skip' });
  });
  it('a suggested theme in front of nothing else: every other part set, nothing in front (ready holds no theme)', () => {
    expect(T('walkTimeFrame').parts.theme.state).toBe('suggested');
    expect(frontPartOf(T('walkTimeFrame'))).toBe(null);
  });
  it('the theme\'s panel, opened from "Write your own": its confirm and its text box', () => {
    const p = panelOf(T('walkMap'), 'theme');
    expect(p.values).toEqual([{ op: 'confirm', part: 'theme', value: T('walkMap').parts.theme.suggestion }]);
    expect(p.text).toEqual({ op: 'set', part: 'theme', input: 'text', max: 80 });
    expect(p.change).toBe(null);
  });
});
