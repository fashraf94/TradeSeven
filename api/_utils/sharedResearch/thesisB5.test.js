// api/_utils/sharedResearch/thesisB5.test.js
//
// Shared Research B5 — BEFORE THE SWITCH (Amendment B §B13, Nov 17), the pure rows:
//   T-1  own words never become the theme; the first map suggests one; confirm and write-your-own set it, free
//   T-2  the theme gates nothing: the offers table across theme unset / suggested / set; the sentence with and without
//        a theme or a segment; no builder card reaches the bare `direction` shape any more
//   T-3  two short sentences: rulebook §6 and the prompt; the model's reply cut at 320 at a sentence's end; the
//        server's own lines take the whole to 600; the schema's description text unchanged
//   T-5  the newer time-frame answer wins
// T-4 (no save while a step runs) is at the route: api/forge/shared-research.builder.route.test.js.

import { describe, it, expect } from 'vitest';
import {
  emptyCard, openingCardOf, cardContextOf, partStatesOf, offeredGoalsOf, freeChoicesOf, applyCardOp, cardOpOf, applyProposals,
  sentenceOf, readinessOf, saveIssueOf, savedCardOf, blockedNow, thesisViewOf,
} from './thesis.js';
import {
  validateBuildTurn, turnShapeOf, cutAtSentence, MODEL_REPLY_MAX, BUILD_SCHEMAS, DEAD_END_LINE, unsourcedLineOf, keptReplyOf, MAP_THEME_WORDS_MAX,
} from './thesisSchema.js';
import { THESIS_BUILDER_RULES, WRITTEN_OPENING_RULES, BUILDER_OPENING_RULES, buildBuildSystemPrompt, buildStepSystemPrompt, renderBuildUser } from './stepPrompt.js';
import { companiesOf } from './companies.js';
import { THESIS_LIMITS } from '../../../src/constants/sharedResearch.js';

const id = (n) => `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = '2026-11-17T15:00:05.000Z';
const READ = '2026-11-17T15:00:01.000Z';
const src = (n) => ({ recordKind: 'retrieval', recordId: `https://n.example/${n}`, label: 'n.example · t', url: `https://n.example/${n}` });
const F = (n, kind, symbol, status, fact) => ({ findingId: id(n), kind, symbol, status, fact, source: src(n), at: '2026-11-01T00:00:00.000Z', asOf: null, statusReason: status === 'verified' ? null : 'inference', supersedes: null });
const OBS = 'I want to play AI';
const OBSERVATION = {
  findingId: id(9), kind: 'observation', symbol: null, fact: OBS, source: { recordKind: 'exchange', recordId: 'x-1', label: 'Your words' },
  at: '2026-11-17T14:50:00.000Z', asOf: null, status: 'unverified', statusReason: 'player_words', supersedes: null,
};
const RECORD = {
  researchWorkId: 'sr_s1', state: 'open', question: `Build a thesis on: ${OBS}`,
  findings: [
    OBSERVATION,
    F(1, 'relationship', 'NVDA', 'verified', 'Supplier · Nvidia sells accelerators to data centers.'),
    F(2, 'earnings_fact', 'NVDA', 'verified', 'Nvidia said data-center revenue was most of its sales.'),
    F(4, 'coverage', null, 'verified', 'Several large buyers design their own chips.'),
    F(5, 'relationship', 'AMD', 'verified', 'Competitor · AMD sells competing accelerators.'),
  ],
};
const NAMES = { NVDA: 'NVIDIA Corporation', AMD: 'Advanced Micro Devices, Inc.' };
const SESSION = (over = {}) => ({ status: 'open', stepsUsed: 1, stepBudget: 10, entry: { kind: 'observation' }, exchanges: [], ...over });
const ctxOf = (record = RECORD, session = SESSION()) => cardContextOf({ record, supported: companiesOf(record).supported, session });
const MAP = [{ label: 'GPUs and accelerators', line: 'The chips that train and run models', findingIds: [] }, { label: 'Data-center power', line: 'Electricity and cooling', findingIds: [] }];

function validate(output, { goal, part = null, card, record = RECORD, shape }) {
  let n = 100;
  return validateBuildTurn(output, {
    record, items: [], readAt: READ, partnerExchangeId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', partnerAt: NOW, nowIso: NOW,
    mintFindingId: () => id(++n), names: NAMES, partnerName: 'Atlas', card, goal, part, ...(shape ? { shape } : {}),
  });
}
const base = (over = {}) => ({ reply: 'Here is the map.', findings: [], companies: [], themeSuggestion: '', segments: [], pick: null, ...over });
/** Land a validated turn's proposals the way recordStep does. */
const land = (card, v, record = RECORD) => {
  const after = { ...record, findings: [...record.findings, ...v.findings] };
  return applyProposals(card, v.proposals, cardContextOf({ record: after, supported: companiesOf(after).supported }));
};
const firstMap = () => validate(base({
  reply: 'The idea splits into chips and the power behind them. I would stand on the chips.',
  themeSuggestion: 'AI chips and data centers',
  segments: MAP.map((m) => ({ label: m.label, line: m.line, refs: [] })),
  pick: { value: 'GPUs and accelerators', reason: 'Sales tie to it most directly.' },
}), { goal: 'map_segments', card: openingCardOf({ entryKind: 'observation', observation: OBS }) });

// ── T-1 ───────────────────────────────────────────────────────────────────────

describe('§B13 T-1 — own words never become the theme', () => {
  it.each([['AI'], [OBS], ['x'.repeat(80)], ['x'.repeat(81)], ['y'.repeat(500)]])('an own-words open of %#-th length leaves the theme unset, the card empty', (words) => {
    expect(openingCardOf({ entryKind: 'observation', observation: words })).toEqual(emptyCard());
  });
  it('stories and drops open empty, as before', () => {
    for (const entryKind of ['item', 'signaldrop']) expect(openingCardOf({ entryKind, observation: null })).toEqual(emptyCard());
  });
  it('the first map lands a theme suggestion in the agent\'s words; nothing is set (V2-4)', () => {
    const v = firstMap();
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(v.proposals.themeSuggestion).toBe('AI chips and data centers');
    const card = land(openingCardOf({ entryKind: 'observation', observation: OBS }), v);
    expect(card.theme).toEqual({ state: 'unset', value: null, by: null, suggestion: 'AI chips and data centers' });
    expect(partStatesOf(card, ctxOf()).theme).toBe('suggested');
    expect(readinessOf(card, ctxOf()).blockers.map((b) => b.part)).not.toContain('theme'); // ready never needed it
  });
  it('confirm sets the suggestion (the agent suggested, the player confirmed); write-your-own sets the player\'s words; both free', () => {
    const card = land(openingCardOf({ entryKind: 'observation', observation: OBS }), firstMap());
    const free = freeChoicesOf(card, ctxOf());
    expect(free).toContainEqual({ op: 'confirm', part: 'theme', value: 'AI chips and data centers' });
    expect(free).toContainEqual({ op: 'set', part: 'theme', input: 'text', max: THESIS_LIMITS.theme });
    const confirmed = cardOpOf(card, { opId: 'o1', op: 'confirm', part: 'theme' }, ctxOf());
    expect(confirmed).toMatchObject({ ok: true, applied: true, label: 'Theme: AI chips and data centers' });
    expect(confirmed.card.theme).toEqual({ state: 'set', value: 'AI chips and data centers', by: 'partner_suggested_confirmed', suggestion: null });
    expect(confirmed.card.rev).toBe(card.rev + 1);
    const own = cardOpOf(card, { opId: 'o2', op: 'set', part: 'theme', value: { text: 'AI chips' } }, ctxOf());
    expect(own.card.theme).toEqual({ state: 'set', value: 'AI chips', by: 'player_wrote', suggestion: null });
  });
  it('the theme\'s free choices stay on offer until it is set — whatever else the player sets first', () => {
    let card = land(openingCardOf({ entryKind: 'observation', observation: OBS }), firstMap());
    card = applyCardOp(card, { op: 'set', part: 'segment', value: 'GPUs and accelerators' }, ctxOf()).card;
    card = applyCardOp(card, { op: 'set', part: 'names', value: ['NVDA'] }, ctxOf()).card;
    const themeOps = (c) => freeChoicesOf(c, ctxOf()).filter((x) => x.part === 'theme').map((x) => x.op);
    expect(themeOps(card)).toEqual(['confirm', 'set']);
    card = applyCardOp(card, { op: 'confirm', part: 'theme' }, ctxOf()).card;
    expect(themeOps(card)).toEqual([]);
  });
  it('the prompt: with no theme the map asks for a short noun phrase of two to six words, never a sentence; a set theme reads as before', () => {
    const user = (card) => renderBuildUser({ question: RECORD.question, entryKind: 'observation', goal: 'map_segments', card, supported: [], stepsLeft: 9, findings: [], items: [], retrieval: 'none' });
    const open = user(openingCardOf({ entryKind: 'observation', observation: OBS }));
    expect(open).toContain('The card has no theme yet: suggest one in your own words, a short noun phrase of two to six words, never a sentence (themeSuggestion).');
    expect(open).toContain('  Theme: not set');
    const themed = emptyCard();
    themed.theme = { state: 'set', value: 'AI', by: 'player_wrote', suggestion: null };
    expect(user(themed)).toContain('This step: map the theme into two to five segments (segments), then mark the one you would stand on (pick) with a one-line reason.\n');
    expect(buildBuildSystemPrompt({ partnerName: 'Atlas' })).toContain('- themeSuggestion: only when the card has no theme, a theme in your own words: a short noun phrase of two to six words, never a sentence, at most 80 characters');
  });
});

// ── T-2 ───────────────────────────────────────────────────────────────────────

/** A card with the theme, the segment and the names in the given states. */
function cardOf({ theme, segment, names }) {
  const c = emptyCard();
  if (theme === 'suggested') c.theme.suggestion = 'AI chips and data centers';
  if (theme === 'set') c.theme = { state: 'set', value: 'AI chips', by: 'player_wrote', suggestion: null };
  c.segment.map = structuredClone(MAP);
  if (segment === 'set') Object.assign(c.segment, { state: 'set', value: 'GPUs and accelerators', by: 'player_chose' });
  if (segment === 'skipped') Object.assign(c.segment, { state: 'set', value: null, by: 'player_chose', skipped: true });
  if (names === 'set') c.names = { state: 'set', value: ['NVDA'], by: 'player_chose', blocked: null };
  return c;
}
const THEMES = ['unset', 'suggested', 'set'];
const SEGMENTS = ['unset', 'set', 'skipped'];
const NAMESS = ['unset', 'set'];
const TABLE = THEMES.flatMap((theme) => SEGMENTS.flatMap((segment) => NAMESS.map((names) => ({ theme, segment, names }))));

describe('§B13 T-2 — the theme gates nothing', () => {
  it.each(TABLE)('theme $theme · segment $segment · names $names: map while segment and names unset; find_names while segment set and names unset', (s) => {
    const goals = offeredGoalsOf(cardOf(s), ctxOf()).map((g) => g.goal);
    expect(goals.includes('map_segments')).toBe(s.segment === 'unset' && s.names === 'unset');
    expect(goals.includes('find_names')).toBe(s.segment !== 'unset' && s.names === 'unset');
    expect(goals.includes('build_why')).toBe(s.names === 'set');
  });
  it('the offers are the same whatever the theme\'s state (theme aside: its own strengthen)', () => {
    for (const segment of SEGMENTS) {
      for (const names of NAMESS) {
        const sets = THEMES.map((theme) => offeredGoalsOf(cardOf({ theme, segment, names }), ctxOf()).filter((g) => !(g.goal === 'strengthen' && g.part === 'theme')));
        expect(sets[1]).toEqual(sets[0]);
        expect(sets[2]).toEqual(sets[0]);
      }
    }
  });
  it('find_names with the segment set and the theme unset is on offer and asked in its own shape', () => {
    const c = cardOf({ theme: 'unset', segment: 'set', names: 'unset' });
    const offered = offeredGoalsOf(c, ctxOf());
    expect(offered).toContainEqual({ goal: 'find_names' });
    expect(turnShapeOf({ goal: 'direction' }, offered, { deadEnd: blockedNow(c, ctxOf()) })).toEqual({ goal: 'find_names', part: null });
    const u = renderBuildUser({ question: RECORD.question, entryKind: 'observation', goal: 'find_names', card: cardOf({ theme: 'unset', segment: 'skipped', names: 'unset' }), supported: [], stepsLeft: 8, findings: [], items: [], retrieval: 'none' });
    expect(u).toContain('with a sourced connection to the idea behind the question above (relationship findings and companies)');
    expect(u).not.toContain('connection to the theme');
  });
  it('no builder card reaches the bare `direction` shape any more: a direction step is always asked as a research goal', () => {
    const entries = [SESSION(), SESSION({ entry: { kind: 'item' }, exchanges: [{ who: 'partner', kind: 'step', goal: 'verify_source' }] }), SESSION({ entry: { kind: 'item' } })];
    const supports = [RECORD, { ...RECORD, findings: [OBSERVATION] }];
    let seen = 0;
    for (const s of TABLE) {
      for (const blocked of [null, 'no_listed_company']) {
        for (const why of ['unset', 'set']) {
          for (const session of entries) {
            for (const record of supports) {
              const c = cardOf(s);
              if (s.names === 'unset') c.names.blocked = blocked;
              if (why === 'set' && s.names === 'set') c.why = { state: 'set', by: 'player_chose', shared: 'x', reasons: [{ symbol: 'NVDA', text: 'r', findingIds: [id(2)] }], against: null, proposal: null };
              const ctx = ctxOf(record, session);
              const shape = turnShapeOf({ goal: 'direction' }, offeredGoalsOf(c, ctx), { deadEnd: blockedNow(c, ctx) });
              expect(shape.goal, JSON.stringify({ s, blocked, why, entry: session.entry.kind })).not.toBe('direction');
              seen += 1;
            }
          }
        }
      }
    }
    expect(seen).toBe(TABLE.length * 2 * 2 * 3 * 2);
    expect(BUILD_SCHEMAS.direction).toBeDefined(); // the schema stays compiled, unchanged
  });

  const ready = ({ theme, segment, names = ['NVDA'] }) => {
    const c = cardOf({ theme, segment, names: 'set' });
    c.names.value = names;
    c.why = { state: 'set', by: 'partner_suggested_confirmed', shared: 'they sell the accelerators data centers buy', reasons: names.map((s) => ({ symbol: s, text: `${s} sells chips`, findingIds: [s === 'NVDA' ? id(2) : id(5)] })), against: null, proposal: null };
    c.wrongIf = { ...c.wrongIf, state: 'set', by: 'player_wrote', text: 'big buyers cut spending for two quarters', findingIds: [] };
    c.timeFrame = { state: 'set', by: 'player_chose', value: 'positional', suggestion: null };
    return c;
  };
  it.each([
    ['set', 'set', 'My theme is AI chips, through GPUs and accelerators, built on NVDA, because'],
    ['set', 'skipped', 'My theme is AI chips, built on NVDA, because'],
    ['unset', 'set', 'Built on NVDA, through GPUs and accelerators, because'],
    ['unset', 'skipped', 'Built on NVDA, because'],
    ['suggested', 'set', 'Built on NVDA, through GPUs and accelerators, because'],
    ['suggested', 'skipped', 'Built on NVDA, because'],
  ])('the sentence — theme %s, segment %s: "%s …"', (theme, segment, head) => {
    const s = sentenceOf(ready({ theme, segment }));
    expect(s.startsWith(`${head} they sell the accelerators data centers buy. It's wrong if big buyers cut spending for two quarters. Time frame: Positional · about 30 sessions.`)).toBe(true);
    expect(s).not.toMatch(/^Through/);
    expect(s).not.toContain('AI chips and data centers'); // a suggestion never enters the sentence
  });
  it('a group with no theme: "Built on NVDA and AMD, through …"', () => {
    expect(sentenceOf(ready({ theme: 'unset', segment: 'set', names: ['NVDA', 'AMD'] }))).toMatch(/^Built on NVDA and AMD, through GPUs and accelerators, because /);
  });
  it('a ready card with no theme saves: no save issue, and the saved card keeps its shape with an empty theme', () => {
    const c = ready({ theme: 'unset', segment: 'set' });
    expect(readinessOf(c, ctxOf()).ready).toBe(true);
    expect(saveIssueOf(c, ctxOf())).toBeNull();
    const withTheme = savedCardOf(ready({ theme: 'set', segment: 'set' }), { watchlistId: 'w', sessionId: 's', researchWorkId: 'r', statement: 'x', carried: [], savedAt: NOW });
    const without = savedCardOf(c, { watchlistId: 'w', sessionId: 's', researchWorkId: 'r', statement: 'x', carried: [], savedAt: NOW });
    expect(without.theme).toEqual({ value: null, by: null });
    expect(Object.keys(without)).toEqual(Object.keys(withTheme));
    expect(Object.keys(without.theme)).toEqual(Object.keys(withTheme.theme));
    expect(Object.keys(thesisViewOf(c, ctxOf()))).toEqual(Object.keys(thesisViewOf(ready({ theme: 'set', segment: 'set' }), ctxOf())));
  });
});

// ── T-3 ───────────────────────────────────────────────────────────────────────

const NEW_LINE = '- A reply is at most two short sentences, about 280 characters: first what this step found, then what it proposes for the card. Do not repeat what the card or the choices already show. Speak to the player as a partner; never "your observation", "the retrieved items" or "the record".';

describe('§B13 T-3 — two short sentences', () => {
  it('rulebook §6 changes in one place: the reply line (prompt.builder.test.js pins §6 byte for byte)', () => {
    expect(THESIS_BUILDER_RULES.split('\n').filter((l) => l.startsWith('- A reply'))).toEqual([NEW_LINE]);
    expect(THESIS_BUILDER_RULES).not.toContain('two or three sentences');
  });
  it('the builder prompt\'s output contract says the same; the schema\'s description text is unchanged (no recompile)', () => {
    const p = buildBuildSystemPrompt({ partnerName: 'Atlas' });
    expect(p).toContain('- reply: at most two short sentences, about 280 characters: first what this step found, then what it proposes for the card. Do not repeat what the card or the choices already show. Speak to the player as a partner; never "your observation", "the retrieved items" or "the record". Write no sentence about yourself or your own process.');
    expect(p).not.toContain('at most 600 characters');
    for (const schema of Object.values(BUILD_SCHEMAS)) expect(schema.properties.reply.description).toBe('Two or three plain sentences: what this step found and what it proposes for the card. At most 600 characters.');
  });
  it('the model\'s reply is cut at a sentence\'s end at 320 characters', () => {
    expect(MODEL_REPLY_MAX).toBe(320);
    const a = `Nvidia sells most of the accelerators data centers buy, and its data-center segment is most of its revenue now. ${'The point against is that several of the largest buyers design their own chips. '.repeat(3)}I would build on Nvidia alone for now.`;
    expect(a.length).toBeGreaterThan(320);
    const v = validate(base({ reply: a, segments: MAP.map((m) => ({ label: m.label, line: m.line, refs: [] })), pick: null }), { goal: 'map_segments', card: openingCardOf({ entryKind: 'observation', observation: OBS }) });
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(v.reply.length).toBeLessThanOrEqual(320);
    // §B14 Q-3 (moved from the leading sentences that fit): the first and the last sentence
    expect(v.reply).toBe('Nvidia sells most of the accelerators data centers buy, and its data-center segment is most of its revenue now. I would build on Nvidia alone for now.');
    expect(v.reply).toMatch(/[.!?]$/);
    // a reply already inside 320 stands whole
    const short = 'The idea splits into chips and power. I would stand on the chips.';
    expect(validate(base({ reply: short, segments: MAP.map((m) => ({ label: m.label, line: m.line, refs: [] })) }), { goal: 'map_segments', card: openingCardOf({ entryKind: 'observation', observation: OBS }) }).reply).toBe(short);
  });
  // review A2 (moved from the validator keeping the word-boundary cut): the model's run-on reply is now replaced (below);
  // cutAtSentence's own fallback, which the unsourced-line path still uses, cuts at the last space, never inside a word
  it('cutAtSentence: a first sentence longer than the limit is cut at its last space (never inside a word)', () => {
    const one = `${'Nvidia sells accelerators to the cloud companies building data centers '.repeat(6)}today.`;
    const cut = cutAtSentence(one, 320);
    expect(cut.length).toBeLessThanOrEqual(320);
    expect(one.startsWith(cut)).toBe(true);
    expect(one[cut.length]).toBe(' ');
  });
  it('the server\'s own lines may take the whole to 600: a cut reply plus the unsourced line', () => {
    const card = cardOf({ theme: 'unset', segment: 'set', names: 'set' });
    card.names.value = ['NVDA', 'AMD'];
    const long = `${'Nvidia has a sourced reason on the record, resting on its data-center sales. '.repeat(3)}AMD has a connection but no reason a source backs.`;
    const v = validate({
      reply: long, findings: [],
      why: { shared: 'both sell accelerators to data centers', reasons: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', text: 'Data centers are most of its sales.', refs: [id(2)] }], against: { text: '', refs: [] } },
      wrongIfOptions: [], timeFramePick: null, pick: null,
    }, { goal: 'build_why', card });
    expect(v.ok, JSON.stringify(v)).toBe(true);
    const line = unsourcedLineOf(['AMD'], NAMES);
    expect(v.reply.endsWith(line)).toBe(true);
    expect(v.reply.length).toBeGreaterThan(320);
    expect(v.reply.length).toBeLessThanOrEqual(THESIS_LIMITS.reply);
    expect(v.reply.slice(0, -line.length - 1).length).toBeLessThanOrEqual(320);
  });
  it('the dead end\'s line rides on the plain reply, inside 600', () => {
    const v = validate(base({ reply: 'NVDA is the one to build on.', companies: [] }), { goal: 'find_names', card: cardOf({ theme: 'unset', segment: 'set', names: 'unset' }), record: { ...RECORD, findings: [OBSERVATION] } });
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(v.reply.endsWith(DEAD_END_LINE)).toBe(true);
    expect(v.reply.length).toBeLessThanOrEqual(THESIS_LIMITS.reply);
  });
});

// ── T-5 ───────────────────────────────────────────────────────────────────────

/** A card the time frame is pickable on (the why set), with the time frame unset. */
function whyCard() {
  const c = cardOf({ theme: 'set', segment: 'set', names: 'set' });
  c.why = { state: 'set', by: 'player_chose', shared: 'it sells accelerators', reasons: [{ symbol: 'NVDA', text: 'Data centers are most of its sales.', findingIds: [id(2)] }], against: null, proposal: null };
  return c;
}
const PROPOSALS = (over) => ({ goal: 'pick', part: 'timeFrame', themeSuggestion: null, map: null, why: null, wrongIfOptions: null, timeFrame: null, pick: null, ...over });
const askedPick = (value) => ({ part: 'timeFrame', value, reason: 'It fits the why.', findingIds: [], reasons: [], asked: true });
const confirmOf = (c) => freeChoicesOf(c, ctxOf()).filter((x) => x.op === 'confirm' && x.part === 'timeFrame');

describe('§B13 T-5 — the newer time-frame answer wins', () => {
  it('an asked pick after a suggestion: the pick lands, the older suggestion goes, and the confirm carries the pick', () => {
    let c = whyCard();
    c = applyProposals(c, PROPOSALS({ goal: 'build_why', part: null, timeFrame: { value: 'positional', reason: 'Spending plans run for quarters.' } }), ctxOf());
    expect(confirmOf(c)).toEqual([{ op: 'confirm', part: 'timeFrame', value: 'positional' }]);
    c = applyProposals(c, PROPOSALS({ pick: askedPick('longterm') }), ctxOf());
    // §B14 Q-1 (moved from null): the older suggestion goes because the pick lands as the suggestion itself
    expect(c.timeFrame.suggestion).toEqual({ value: 'longterm', reason: 'It fits the why.' });
    expect(c.pick).toMatchObject({ part: 'timeFrame', value: 'longterm', asked: true });
    expect(partStatesOf(c, ctxOf()).timeFrame).toBe('suggested');
    expect(confirmOf(c)).toEqual([{ op: 'confirm', part: 'timeFrame', value: 'longterm' }]);
    expect(applyCardOp(c, { op: 'confirm', part: 'timeFrame' }, ctxOf()).card.timeFrame).toEqual({ state: 'set', by: 'partner_suggested_confirmed', value: 'longterm', suggestion: null });
  });
  it('a suggestion after an asked pick: the next step replaces the pick, and the confirm carries the suggestion', () => {
    let c = whyCard();
    c = applyProposals(c, PROPOSALS({ pick: askedPick('swing') }), ctxOf());
    expect(confirmOf(c)).toEqual([{ op: 'confirm', part: 'timeFrame', value: 'swing' }]);
    c = applyProposals(c, PROPOSALS({ goal: 'strengthen', part: 'why', timeFrame: { value: 'positional', reason: 'Spending plans run for quarters.' } }), ctxOf());
    expect(c.pick).toBeNull();
    expect(c.timeFrame.suggestion).toEqual({ value: 'positional', reason: 'Spending plans run for quarters.' });
    expect(confirmOf(c)).toEqual([{ op: 'confirm', part: 'timeFrame', value: 'positional' }]);
    expect(applyCardOp(c, { op: 'confirm', part: 'timeFrame' }, ctxOf()).card.timeFrame.value).toBe('positional');
  });
  it('a card that holds both (written before T-5): the pick is the latest step\'s, so the confirm carries it', () => {
    const c = whyCard();
    c.timeFrame.suggestion = { value: 'positional', reason: 'Spending plans run for quarters.' };
    c.pick = askedPick('swing');
    expect(confirmOf(c)).toEqual([{ op: 'confirm', part: 'timeFrame', value: 'swing' }]);
    expect(applyCardOp(c, { op: 'confirm', part: 'timeFrame' }, ctxOf()).card.timeFrame.value).toBe('swing');
  });
  it('a pick that does not land (not a time frame) leaves the suggestion standing', () => {
    let c = whyCard();
    c = applyProposals(c, PROPOSALS({ goal: 'build_why', part: null, timeFrame: { value: 'positional', reason: 'Spending plans run for quarters.' } }), ctxOf());
    c = applyProposals(c, PROPOSALS({ pick: askedPick('intraday') }), ctxOf());
    expect(c.pick).toBeNull();
    expect(c.timeFrame.suggestion).toMatchObject({ value: 'positional' });
    expect(confirmOf(c)).toEqual([{ op: 'confirm', part: 'timeFrame', value: 'positional' }]);
  });
});

// ── the review's fixes (report §7) ──────────────────────────────────────────────

const mapOut = (over = {}) => base({
  reply: 'The idea splits into chips and the power behind them. I would stand on the chips.',
  segments: MAP.map((m) => ({ label: m.label, line: m.line, refs: [] })), pick: { value: 'GPUs and accelerators', reason: 'Sales tie to it most directly.' }, ...over,
});
const openCard = () => openingCardOf({ entryKind: 'observation', observation: OBS });

describe('review A1 (T-1): the player\'s own words never come back as the agent\'s suggestion', () => {
  it.each([[OBS], ['  i want to PLAY ai. '], ['I want to play AI!']])('a suggestion of %j — the player\'s words — is dropped; nothing lands on the theme', (t) => {
    const v = validate(mapOut({ themeSuggestion: t }), { goal: 'map_segments', card: openCard() });
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(v.notes).toContain('dropped:themeSuggestion:player_words');
    expect(v.proposals.themeSuggestion).toBeNull();
    expect(land(openCard(), v).theme).toEqual(emptyCard().theme);
    expect(v.proposals.map).not.toBeNull(); // the map still lands
  });
  it('a suggestion in the agent\'s own words still lands', () => {
    const v = validate(mapOut({ themeSuggestion: 'AI chips and data centers' }), { goal: 'map_segments', card: openCard() });
    expect(v.notes.filter((n) => n.startsWith('dropped:themeSuggestion'))).toEqual([]);
    expect(v.proposals.themeSuggestion).toBe('AI chips and data centers');
  });
});

describe('review A5 (T-1): a suggestion waiting for the player is never replaced', () => {
  const suggestedCard = () => { const c = openCard(); c.theme.suggestion = 'Cloud AI data-center spending'; return c; };
  it('a later map\'s suggestion is dropped (theme_suggested); the waiting one stands', () => {
    const v = validate(mapOut({ themeSuggestion: 'AI chips and data centers' }), { goal: 'map_segments', card: suggestedCard() });
    expect(v.notes).toContain('dropped:themeSuggestion:theme_suggested');
    expect(land(suggestedCard(), v).theme.suggestion).toBe('Cloud AI data-center spending');
  });
  it('applyProposals itself never replaces a waiting suggestion', () => {
    const c = applyProposals(suggestedCard(), { goal: 'map_segments', part: null, themeSuggestion: 'Something else', map: null, why: null, wrongIfOptions: null, timeFrame: null, pick: null }, ctxOf());
    expect(c.theme.suggestion).toBe('Cloud AI data-center spending');
  });
  it('a story after its check: the map is asked for no theme, and the check\'s suggestion survives the map', () => {
    const story = SESSION({ entry: { kind: 'item' }, exchanges: [{ who: 'partner', kind: 'step', goal: 'verify_source' }] });
    const card = suggestedCard();
    expect(offeredGoalsOf(card, ctxOf(RECORD, story)).map((g) => g.goal)).toContain('map_segments');
    const u = renderBuildUser({ question: RECORD.question, entryKind: 'item', goal: 'map_segments', card, supported: [], stepsLeft: 8, findings: [], items: [], retrieval: 'none' });
    expect(u).toContain('  Theme: not set; you suggested "Cloud AI data-center spending"');
    expect(u).not.toContain('The card has no theme yet');
    expect(u).toContain('This step: map the idea behind the question above into two to five segments (segments), then mark the one you would stand on (pick) with a one-line reason.\n');
  });
});

describe('review A2 (T-3): a reply that cannot be cut at a sentence\'s end within 320 is replaced by the plain line', () => {
  const runOn = `Nvidia designs the accelerator chips that most of the new AI data centers are buying ${'and the cloud companies building them keep raising what they spend on those chips '.repeat(3)}though none of the sources says how large this business is.`;
  it('the first sentence alone runs past 320: no mid-sentence text survives', () => {
    expect(runOn.length).toBeGreaterThan(320);
    const v = validate(mapOut({ reply: runOn, themeSuggestion: 'AI chips and data centers' }), { goal: 'map_segments', card: openCard() });
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(v.notes).toContain('reply_replaced:too_long');
    expect(v.reply).toBe('This step added 0 findings. The card shows what it proposes.');
    expect(runOn.startsWith(v.reply)).toBe(false);
  });
  // §B14 Q-3 (moved from the leading sentences that fit): the first and the last sentence are kept
  it('a long reply whose sentences fit is kept at sentence ends (its first and its last), not replaced', () => {
    const fits = `${'The idea splits into chips, power and the networks between them. '.repeat(5)}I would stand on the chips.`;
    const v = validate(mapOut({ reply: fits, themeSuggestion: 'AI chips and data centers' }), { goal: 'map_segments', card: openCard() });
    expect(v.notes).not.toContain('reply_replaced:too_long');
    expect(v.reply).toBe('The idea splits into chips, power and the networks between them. I would stand on the chips.');
  });
});

// ── §B14 (Nov 18): the B5 report's rulings ──────────────────────────────────────

describe('§B14 Q-1 (b): an asked time-frame pick lands as the suggestion too — the newest answer survives a later step', () => {
  it('a pick after the why\'s suggestion, then a step with no time-frame answer: the pick\'s value is still on the card and confirmable', () => {
    let c = whyCard();
    c = applyProposals(c, PROPOSALS({ goal: 'build_why', part: null, timeFrame: { value: 'positional', reason: 'Spending plans run for quarters.' } }), ctxOf());
    c = applyProposals(c, PROPOSALS({ pick: askedPick('longterm') }), ctxOf());
    expect(c.timeFrame.suggestion).toEqual({ value: 'longterm', reason: 'It fits the why.' });
    c = applyProposals(c, PROPOSALS({ goal: 'strengthen', part: 'why' }), ctxOf()); // a later step: no pick, no time-frame answer
    expect(c.pick).toBeNull();
    expect(c.timeFrame.suggestion).toEqual({ value: 'longterm', reason: 'It fits the why.' });
    expect(partStatesOf(c, ctxOf()).timeFrame).toBe('suggested');
    expect(confirmOf(c)).toEqual([{ op: 'confirm', part: 'timeFrame', value: 'longterm' }]);
    expect(applyCardOp(c, { op: 'confirm', part: 'timeFrame' }, ctxOf()).card.timeFrame).toEqual({ state: 'set', by: 'partner_suggested_confirmed', value: 'longterm', suggestion: null });
  });
  it('a newer suggestion still replaces it', () => {
    let c = applyProposals(whyCard(), PROPOSALS({ pick: askedPick('swing') }), ctxOf());
    c = applyProposals(c, PROPOSALS({ goal: 'strengthen', part: 'why', timeFrame: { value: 'positional', reason: 'Spending plans run for quarters.' } }), ctxOf());
    expect(c.timeFrame.suggestion).toEqual({ value: 'positional', reason: 'Spending plans run for quarters.' });
    expect(confirmOf(c)).toEqual([{ op: 'confirm', part: 'timeFrame', value: 'positional' }]);
  });
});

describe('§B14 Q-2 (b)+(c): §4 (1) leaves the builder prompt only; §6 says how a reply names the player\'s words, in plain words', () => {
  const builder = buildBuildSystemPrompt({ partnerName: 'Atlas' });
  it('the builder prompt carries neither §4 (1) nor (7); the ledger\'s step prompt still carries §4 (1) whole', () => {
    expect(builder).not.toContain(WRITTEN_OPENING_RULES[0]);
    expect(builder).not.toContain(WRITTEN_OPENING_RULES[6]);
    expect(BUILDER_OPENING_RULES).toHaveLength(WRITTEN_OPENING_RULES.length - 2);
    expect(buildStepSystemPrompt({ partnerName: 'Atlas' })).toContain(`1. ${WRITTEN_OPENING_RULES[0]}`);
  });
  it('§6 holds the two lines, and its first paragraph says which of §4\'s lines it replaces', () => {
    const lines = THESIS_BUILDER_RULES.split('\n');
    expect(lines).toContain("- The player's words are theirs: call them 'what you wrote', and never restate them as true.");
    expect(lines).toContain("- Use plain words a player would use; no trading jargon such as 'exit'.");
    expect(lines[0]).toContain("These lines take the place of §4's lines 1 and 7 there");
    expect(builder).toContain(`The thesis builder:\n${THESIS_BUILDER_RULES}`);
  });
});

describe('§B14 Q-3 (b): a reply that does not fit keeps its first and its last sentence, else its first, else the plain line', () => {
  const S = (n, len) => `${String.fromCharCode(64 + n)}${'x'.repeat(len - 2)}.`;
  it.each([
    ['fits whole', [S(1, 100), S(2, 100), S(3, 100)], 'whole'],
    ['three sentences: the first and the last', [S(1, 150), S(2, 150), S(3, 150)], 'first+last'],
    ['two that do not fit together: the first', [S(1, 200), S(2, 200)], 'first'],
    ['first and last too long together: the first', [S(1, 200), S(2, 50), S(3, 200)], 'first'],
    ['the first alone does not fit: none (the plain line)', [S(1, 330), S(2, 50)], 'runOn'],
  ])('%s', (_, parts, want) => {
    const text = parts.join(' ');
    const k = keptReplyOf(text, 320);
    if (want === 'whole') expect(k).toEqual({ text, runOn: false });
    if (want === 'first+last') expect(k).toEqual({ text: `${parts[0]} ${parts.at(-1)}`, runOn: false });
    if (want === 'first') expect(k).toEqual({ text: parts[0], runOn: false });
    if (want === 'runOn') expect(k).toEqual({ text: '', runOn: true });
    expect(k.text.length).toBeLessThanOrEqual(320);
  });
  it('through the validator: the middle sentence goes, the proposal stays (the run-on case is review A2\'s rows above)', () => {
    const r = 'The idea splits into four parts, from the chips themselves to the power that runs them, and the grid behind the power. Two of the parts have no listed company tied to them yet in any of the sources, and the networking part has only one weak source behind it so far, which is a trade article from earlier this month. I would stand on the accelerator chips.';
    expect(r.length).toBeGreaterThan(320);
    const v = validate(mapOut({ reply: r, themeSuggestion: 'AI chips and data centers' }), { goal: 'map_segments', card: openCard() });
    expect(v.reply).toBe('The idea splits into four parts, from the chips themselves to the power that runs them, and the grid behind the power. I would stand on the accelerator chips.');
  });
});

describe('§B14 Q-5: the map\'s theme suggestion is dropped past six words or at sentence punctuation; verify_source\'s is unchanged', () => {
  const story = SESSION({ entry: { kind: 'item' } });
  it.each([
    ['seven words', 'AI chips and data centers for cloud', 'too_many_words'],
    ['ends with a period', 'AI data-center buildout.', 'sentence'],
    ['ends with a question mark', 'Who builds AI data centers?', 'sentence'],
    ['ends with an exclamation mark', 'AI chips!', 'sentence'],
  ])('map: %s → dropped (%s)', (_, t, rule) => {
    const v = validate(mapOut({ themeSuggestion: t }), { goal: 'map_segments', card: openCard() });
    expect(v.notes).toContain(`dropped:themeSuggestion:${rule}`);
    expect(v.proposals.themeSuggestion).toBeNull();
    expect(v.proposals.map).not.toBeNull();
  });
  it(`map: exactly ${MAP_THEME_WORDS_MAX} words, no closing punctuation → lands`, () => {
    const v = validate(mapOut({ themeSuggestion: 'AI chips for the cloud buildout' }), { goal: 'map_segments', card: openCard() });
    expect(v.proposals.themeSuggestion).toBe('AI chips for the cloud buildout');
  });
  it('verify_source: a long or punctuated suggestion still lands, as before', () => {
    for (const t of ['Cloud companies keep raising their AI data-center spending', 'Cloud AI spending.']) {
      const v = validate({ reply: 'The story matches its source.', findings: [], companies: [], themeSuggestion: t }, { goal: 'verify_source', card: emptyCard(), record: { ...RECORD, findings: [] } });
      expect(v.ok, JSON.stringify(v)).toBe(true);
      expect(v.proposals.themeSuggestion, t).toBe(t);
    }
    expect(offeredGoalsOf(emptyCard(), ctxOf(RECORD, story)).map((g) => g.goal)).toContain('verify_source');
  });
});
