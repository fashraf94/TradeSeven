// api/_utils/huddle/scriptRules.e3.test.js
//
// Huddle S1.1 — AMENDMENT E §E3's SEVEN SCRIPT RULES, the forbidden-terms test the rulebook cites
// (docs/design/SHADOW_VOICE_RULES_V1.md §2.8–§2.11, §3). Every rule is proven both ways: the sentences that broke it — the
// S1 build's Run A and Run B (docs/audits/20261107_BUILD_HUDDLE_S1.md §4) and the founder's Nov 9 smoke (read-only, from
// the Nov 9 record) — each fail on THEIR rule, replayed offline before any model call; the same thoughts said the right
// way pass; and market words that only look like a violation ("SPY closed down") are not refused.

import { describe, it, expect } from 'vitest';
import { FORBIDDEN_SCRIPT_PATTERNS, validateScript, scriptClean, regenerationNoteOf, SYSTEM_PROMPT, buildUserPrompt } from './scriptPrompt.js';
import { packItem, headlineItem, tapeItem } from '../evidence/packItem.js';
import { publicationNameOf, PUBLICATION_NAMES } from '../evidence/publicationNames.js';
import { spokenDateOf, spokenWhenOf } from './spoken.js';
import { exposureLeadersOf } from './gather.js';
import { narratePlan } from './planTemplates.js';

const P = FORBIDDEN_SCRIPT_PATTERNS;
const hits = (text) => Object.entries(P).filter(([, re]) => re.test(text)).map(([name]) => name);

// ── evidence for the validator rows ──
const HOLD_CVX = packItem({ kind: 'holding', fact: 'CVX is held in your BaggerBomb game (support).', recordKind: 'agentBattle', recordId: 'b#CVX', label: 'your game', at: '2026-11-02', asOf: '2026-11-02' });
const HOLD_LLY = packItem({ kind: 'holding', fact: 'LLY is held in your BaggerBomb game (star).', recordKind: 'agentBattle', recordId: 'b#LLY', label: 'your game', at: '2026-11-02', asOf: '2026-11-02' });
const NEWS_CVX = headlineItem({ newsId: 'n1', source: 'FantasyTimes', title: 'Chevron beats', publishedAt: '2026-10-30T21:00:00.000Z', sourceKind: 'fantasytimes_story' });
const TAPE_SPY = tapeItem({ symbol: 'SPY', close: 682.1, changePct: 0.66, asOf: '2026-11-06', asOfSaid: 'Friday, November 6' });
const TAPE_QQQ = tapeItem({ symbol: 'QQQ', close: 612.4, changePct: -1.8, asOf: '2026-11-06', asOfSaid: 'Friday, November 6' });
const STATUS = packItem({ kind: 'source_status', fact: 'Couldn\'t reach EODHD news this morning.', recordKind: 'source', recordId: 'eodhd', label: 'EODHD news', at: '2026-11-09', status: 'unavailable', reason: 'error' });
const EV = [HOLD_CVX, HOLD_LLY, NEWS_CVX, TAPE_SPY, TAPE_QQQ, STATUS];
const CTX = { universe: new Set(['CVX', 'LLY', 'CCI', 'RKLB']), evidence: EV, exposureLeaders: ['CCI', 'LLY'] };
const s = (text, evidenceIds = []) => ({ text, evidenceIds });
const answer = (over = {}) => ({
  names: [], yesterday: null,
  tape: { sentences: [s('SPY closed up on Friday, November 6, and QQQ closed down.', [TAPE_SPY.id, TAPE_QQQ.id])] },
  namesBeat: { sentences: [s('LLY is your largest holding, and nothing new turned up on it in the sources we checked.', [HOLD_LLY.id]), s('FantasyTimes reported that Chevron beat, and CVX sits in your support slot.', [NEWS_CVX.id, HOLD_CVX.id])] },
  armor: { sentences: [s('Your Diversifier would keep the bets spread rather than lean on one headline.')] },
  mentionedTickers: ['SPY', 'QQQ', 'LLY', 'CVX'],
  planProposal: { stances: [], lines: [] },
  ...over,
});

describe('E3: the offline replay — every sentence that broke a rule fails on THAT rule', () => {
  it.each([
    // (a) R-22: a skipped source called down / unavailable / not checked
    ['source_outage', 'Run B', 'On LLY, your star holding, we found nothing new in the sources we checked. EODHD news and newsfilter were both unavailable this morning.'],
    ['source_outage', 'Run B', "As a Diversifier, you spread the bets so no single one can sink you, and with news sources down I'd keep the book balanced across your names and not lean on one headline."],
    ['source_outage', 'Run B', 'The market context was not checked this morning, so I have no picture of the prior session to give you.'],
    ['source_outage', 'Run B', "The earnings calendar was not checked either, so I can't say how many reports are listed today."],
    ['source_outage', 'Run A', 'EODHD news and newsfilter were also not checked, so we found nothing on your names in the sources we checked.'],
    ['source_outage', 'Nov 9', 'Newsfilter was not checked this morning.'],
    // (b) R-23: the archetype in the first or second person
    ['archetype_person', 'Run A', 'As a Diversifier, I read a morning with no data as a reason to keep the bets spread and not lean on any one name.'],
    ['archetype_person', 'Run B', "As a Diversifier, you spread the bets so no single one can sink you, and with news sources down I'd keep the book balanced."],
    ['archetype_person', 'Nov 9', 'As a Contrarian, you look for what others are giving up on, and in a correction with a busy tape, nothing in the sources we checked shows a name being dumped.'],
    ['archetype_person', 'planted', 'As a Fundamental Investor, I would wait for the print.'],
    // review HD-10: the article forms R-23 forbids too, and the contracted outage forms
    ['archetype_person', 'review HD-10', 'Today, as a Contrarian, you look for what the crowd is dumping.'],
    ['archetype_person', 'review HD-10', 'As the Contrarian, I would wait for the crowd to tire.'],
    ['archetype_person', 'review HD-10', 'As your Diversifier, I keep the bets spread.'],
    ['source_outage', 'review HD-10', "Newsfilter wasn't checked this morning."],
    ['source_outage', 'review HD-10', 'EODHD news was not available this morning.'],
    ['source_outage', 'review HD-4', 'A news feed outage left us with nothing on your names.'],
    ['calendar_count', 'review HD-3', '256 reports are on the calendar today.'],
    // (d) ISO dates
    ['iso_date', 'Nov 9', 'Monday morning. The prior session, 2026-11-06, closed with the regime still labeled a correction.'],
    ['iso_date', 'Nov 9', 'The prior close was 88.60 on 2026-11-06.'],
    // (f) calendar mechanics
    ['calendar_count', 'Nov 9', 'Eight of 256 earnings reports are listed today, and RKLB is among them after the close.'],
    ['calendar_count', 'Run B', "The earnings calendar was not checked either, so I can't say how many reports are listed today."],
    ['calendar_count', 'planted', 'There are 45 earnings reports on the calendar today.'],
    ['calendar_count', 'planted', '8 of 45 reports listed.'],
  ])('%s — %s: "%s"', (rule, _from, text) => {
    expect(hits(text)).toContain(rule);
  });

  it('(e) the host Shadow said on Nov 9 never reaches the model: the pack item names the publication', () => {
    const h = headlineItem({ newsId: 'n9', source: 'finance.yahoo.com', title: 'Crown Castle to Present', publishedAt: '2026-11-06T13:00:00.000Z', sourceKind: 'coverage' });
    expect(h.fact).toBe('Yahoo Finance reported: Crown Castle to Present');
    expect(h.source.label).toBe('Yahoo Finance via EODHD');
    expect(`${h.fact} ${h.source.label}`).not.toMatch(/yahoo\.com/);
  });

  it('(c) Run B led its names beat with CVX (support, 10 %) ahead of the star names: exposure_order, a regeneration', () => {
    const v = validateScript(answer({ namesBeat: { sentences: [s('FantasyTimes reported on October 30 that Chevron beat, and CVX closed at 235.52.', [NEWS_CVX.id]), s('On LLY, your star holding, we found nothing new.', [HOLD_LLY.id])] } }), CTX);
    expect(v.beatFailures.names).toEqual(['exposure_order']);
    expect(scriptClean(v)).toBe(false);
    expect(regenerationNoteOf(v)).toBe('names: exposure_order (start with the largest holding marked in NAMES)');
  });

  it('(g) Run A: "SPY up 0.66 percent and QQQ up 1.8 percent" cited only a source status — tape_uncited', () => {
    const v = validateScript(answer({ tape: { sentences: [s("Friday's session closed with SPY up 0.66 percent and QQQ up 1.8 percent.", [STATUS.id])] } }), CTX);
    expect(v.beatFailures.tape).toEqual(['tape_uncited']);
  });
});

describe('E3: the same thoughts said the right way pass — and look-alikes are not refused', () => {
  it('a clean answer passes every check', () => {
    expect(scriptClean(validateScript(answer(), CTX))).toBe(true);
  });

  it.each([
    "Couldn't reach EODHD news this morning, so nothing new turned up on your names.",
    'Your Diversifier would keep the bets spread and not lean on one headline.',
    'The Contrarian looks for what others are giving up on.',
    'As a result, your Contrarian would wait for the crowd to tire.',
    'The prior session closed on Friday, November 6, with the regime still labeled a correction.',
    'RKLB reports after the close today.',
    'Two of your names report this week: RKLB after the close today, and CCI before Tuesday\'s open.',
    'SPY closed down 0.5 percent on Friday.',
    'Nothing turned up in the sources we checked, and QQQ closed down on Friday.',
    'Yahoo Finance reported on November 6 that Crown Castle will present at a conference.',
    'In Q3 reports, margins held.',
    // review HD-3: a price, a clock or a month and day before "report" is when, not a count (E3 f asks for when)
    'RKLB closed at 53.07 and reports after the close today.',
    'Watch the 8:30 jobs report on Friday.',
    'The 8:30 CPI report lands before the open.',
    'RKLB has a November 10 report after the close.',
    'On November 6 reports said Crown Castle would present.',
    // review HD-4: an outage in a headline about a name is market news, not a source
    'Yahoo Finance reported that WEC restored power after a storm outage.',
    'Seeking Alpha reported that the AWS outage hit CCI tenants.',
  ])('passes: "%s"', (text) => {
    expect(hits(text)).toEqual([]);
  });

  it('(c) ties at the top are accepted; with nothing held the order check is vacuous', () => {
    const lead = (first) => answer({ namesBeat: { sentences: [s(`${first} first: nothing new on it in the sources we checked.`, [HOLD_LLY.id])] } });
    expect(validateScript(lead('LLY'), CTX).beatFailures.names).toEqual([]);
    expect(validateScript(lead('CCI'), CTX).beatFailures.names).toEqual([]); // tied with LLY
    expect(validateScript(lead('CVX'), CTX).beatFailures.names).toEqual(['exposure_order']);
    expect(validateScript(lead('CVX'), { ...CTX, exposureLeaders: [] }).beatFailures.names).toEqual([]);
    // an index or an acronym said first is not "the first name"
    expect(validateScript(answer({ namesBeat: { sentences: [s('Before the CPI print and with SPY firm, LLY leads your book.', [HOLD_LLY.id])] } }), CTX).beatFailures.names).toEqual([]);
  });

  it('(g) a tape sentence with no index needs no tape item; one naming an index cites one', () => {
    expect(validateScript(answer({ tape: { sentences: [s('The regime is still labeled a correction, and RKLB reports after the close.')] } }), CTX).beatFailures.tape).toEqual([]);
    expect(validateScript(answer({ tape: { sentences: [s('QQQ fell on Friday.', [TAPE_QQQ.id])] } }), CTX).beatFailures.tape).toEqual([]);
  });

  it('(e) every publication the map names, said as EVIDENCE names it, is not a ticker — in a beat and on a card (review HD-1)', () => {
    for (const [host, name] of Object.entries(PUBLICATION_NAMES)) {
      const h = headlineItem({ newsId: `n-${host}`, source: host, title: 'Chevron raises its dividend', publishedAt: '2026-11-06T13:00:00.000Z', sourceKind: 'coverage' });
      const said = `${name} reported on Friday that Chevron raised its dividend, and CVX sits in your support slot.`;
      const v = validateScript(answer({
        namesBeat: { sentences: [s('LLY is your largest holding, and nothing new turned up on it.', [HOLD_LLY.id]), s(said, [h.id, HOLD_CVX.id])] },
        names: [{ ticker: 'CVX', read: `${name} reported a dividend raise; a report, not a verdict.`, evidenceIds: [h.id] }],
        mentionedTickers: ['SPY', 'QQQ', 'LLY', 'CVX'],
      }), { ...CTX, evidence: [...EV, h] });
      expect(v.tickerFailures, name).toEqual([]);
      expect(v.beatFailures.names, name).toEqual([]);
      expect(v.names.map((n) => n.ticker), name).toEqual(['CVX']);
      expect(scriptClean(v), name).toBe(true);
    }
    // only the whole name is taken out: a bare PR (a listed ticker outside this universe) is still refused
    const bare = validateScript(answer({ namesBeat: { sentences: [s('LLY is your largest holding, and PR rallied on Friday.', [HOLD_LLY.id])] } }), CTX);
    expect(bare.tickerFailures).toEqual(['said:PR']);
  });

  it('a name\'s read (the card) holds the same rules: an ISO date drops the name', () => {
    const v = validateScript(answer({ names: [{ ticker: 'LLY', read: 'The prior close was 1417.54 on 2026-10-30.', evidenceIds: [HOLD_LLY.id] }] }), CTX);
    expect(v.names).toEqual([]);
    expect(v.nameFailures.LLY).toContain('forbidden:iso_date');
  });
});

describe('E3: the input is fixed first (the model is never handed what it must not say)', () => {
  it('the system prompt states each rule, each beat\'s cap as a number, and drops the old "how many reports" and "naming any source that was unavailable"', () => {
    for (const re of [
      /"your Contrarian" or "the Contrarian"/, /never "As a Contrarian, I …" and never "As a Contrarian, you …"/,
      /never as numbers such as 2026-11-06/, /name the publication exactly as EVIDENCE names it/,
      /Never say a source was down, unavailable, offline or not checked/, /Never a count of the day\\?'s reports/,
      /Start with the largest holding/, /citing a TAPE item in EVIDENCE for every index you name/,
      /"yesterday": at most 260 characters/, /"tape": at most 380 characters/, /"namesBeat": at most 950 characters/, /"armor": at most 320 characters/,
    ]) expect(SYSTEM_PROMPT, String(re)).toMatch(re);
    expect(SYSTEM_PROMPT).not.toMatch(/stating how many of the day's reports are listed|naming any source that was unavailable|If a source was unavailable, you may say so/);
  });

  it('the user prompt: a spoken date, the largest holding marked, no ISO date, no calendar count, no host', () => {
    const user = buildUserPrompt({
      etDate: '2026-11-09', weekday: 'Monday', archetypeLabel: 'Contrarian', archetypeDisposition: 'Buys what everyone else is giving up on.',
      gathered: {
        universe: new Set(['CCI', 'RKLB']), names: [{ ticker: 'CCI', source: 'activeBattle' }, { ticker: 'RKLB', source: 'activeBattle' }],
        closes: new Map([['CCI', 88.6]]), exposureLeaders: ['CCI'], tape: { regime: 'correction', asOf: '2026-11-09T11:30:00.000Z' },
        events: { eligible: new Map(), reportTickers: new Map([['RKLB', { label: "RKLB's report after the close" }]]) },
        priorPlan: { etDate: '2026-11-06', status: 'confirmed' },
        evidence: [packItem({ kind: 'close', fact: 'CCI closed at 88.60 on Friday, November 6 (the prior session\'s close).', recordKind: 'symbolDayEvidence.price', recordId: '2026-11-09_CCI', label: 'EODHD daily bars', at: '2026-11-06', asOf: '2026-11-06' })],
      },
    });
    expect(user).toContain('DATE: Monday, November 9');
    expect(user).toContain('CCI — activeBattle · largest holding, prior close 88.60');
    expect(user).toContain('PRIOR PLAN: Friday, November 6, confirmed');
    expect(user).toContain('| Friday, November 6 | CCI closed');
    expect(user).toContain('ARCHETYPE (say "your Contrarian" or "the Contrarian")');
    expect(user).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(user).not.toMatch(/reports listed|\bof \d+ earnings/);
    expect(user).not.toMatch(/yahoo\.com|unavailable/);
  });

  it('spoken dates: an ET date is its weekday and month and day; an instant is its ET day and clock', () => {
    expect(spokenDateOf('2026-11-06')).toBe('Friday, November 6');
    expect(spokenDateOf('2026-11-6')).toBeNull();
    expect(spokenWhenOf('2026-11-08T22:00:00.000Z')).toBe('Sunday, November 8, 5:00 PM ET');
    expect(spokenWhenOf('2026-07-01T13:30:00.000Z')).toBe('Wednesday, July 1, 9:30 AM ET');
    expect(spokenWhenOf('soon')).toBeNull();
  });

  it('publication names: the capture\'s hosts and the press wires by name; an unknown host without www; a name unchanged', () => {
    expect(publicationNameOf('finance.yahoo.com')).toBe('Yahoo Finance');
    expect(publicationNameOf('www.seekingalpha.com')).toBe('Seeking Alpha');
    expect(publicationNameOf('GlobeNewswire.com')).toBe('GlobeNewswire');
    expect(publicationNameOf('www.example-news.net')).toBe('example-news.net');
    expect(publicationNameOf('FantasyTimes')).toBe('FantasyTimes');
    expect(publicationNameOf('')).toBeNull();
    expect(Object.keys(PUBLICATION_NAMES)).toEqual(expect.arrayContaining(['finance.yahoo.com', 'seekingalpha.com', 'globenewswire.com', 'businesswire.com', 'prnewswire.com']));
  });

  it('(g) one tape item per index: verified, dated, its figures carried; its fact passes every pattern', () => {
    expect(TAPE_SPY).toMatchObject({ kind: 'tape', status: 'verified', asOf: '2026-11-06', source: { recordKind: 'marketContext', recordId: 'SPY', label: 'market context' }, figures: { symbol: 'SPY', close: 682.1, changePct: 0.66, asOf: '2026-11-06' } });
    expect(TAPE_SPY.fact).toBe('SPY closed at 682.10 on Friday, November 6, up 0.66 percent.');
    expect(TAPE_QQQ.fact).toBe('QQQ closed at 612.40 on Friday, November 6, down 1.80 percent.');
    for (const e of EV) expect(hits(e.fact), e.fact).toEqual([]);
  });

  it('(c) the largest holding exposure, summed across games; ties kept; nothing held is none', () => {
    const battles = [
      { holdings: [{ symbol: 'LLY', allocation: 20 }, { symbol: 'CCI', allocation: 20 }, { symbol: 'CVX', allocation: 10 }] },
      { holdings: [{ symbol: 'CVX', allocation: 10 }] },
    ];
    expect(exposureLeadersOf(battles)).toEqual(['CCI', 'CVX', 'LLY']);
    expect(exposureLeadersOf([{ holdings: [{ symbol: 'LLY', allocation: 20 }, { symbol: 'CVX', allocation: 10 }] }])).toEqual(['LLY']);
    expect(exposureLeadersOf([])).toEqual([]);
    expect(exposureLeadersOf([{ holdings: [{ symbol: 'LLY', allocation: 0 }] }])).toEqual([]);
  });

  it('the code-written plan beat never trips the new patterns, the new line included', () => {
    const said = narratePlan({ stances: [{ kind: 'HOLD', ticker: 'CCI' }], lines: [{ kind: 'NO_ADDS_TO_BEFORE_REPORT', ticker: 'RKLB' }, { kind: 'NO_SWAPS_TODAY' }] }, { eventLabels: new Map() });
    expect(hits(said)).toEqual([]);
  });
});
