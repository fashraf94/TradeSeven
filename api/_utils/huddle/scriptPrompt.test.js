// api/_utils/huddle/scriptPrompt.test.js
//
// Huddle S1 — the script's checks (spec V1.1 §5.3, §7; A §A7; C §C5, §C10, §C12) and the
// FORBIDDEN-TERMS TEST the voice rules cite (docs/design/SHADOW_VOICE_RULES_V1.md §3):
// the system prompt states every rule, every planted violation is caught, the code-written
// plan beat never trips a pattern, and C12's volume rule holds.

import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPT, SCRIPT_SCHEMA, FORBIDDEN_SCRIPT_PATTERNS, validateScript, scriptClean, regenerationNoteOf, proposalOf, buildUserPrompt,
  callScriptModel, HUDDLE_SCRIPT_MODEL, INDEX_NAMES,
} from './scriptPrompt.js';
import { narratePlan } from './planTemplates.js';
import { packItem } from '../evidence/packItem.js';

const EV = [
  packItem({ kind: 'close', fact: 'AAA closed at 50.00 on 2026-11-06 (the prior session\'s close).', recordKind: 'symbolDayEvidence.price', recordId: '2026-11-09_AAA', label: 'EODHD daily bars', at: '2026-11-06', asOf: '2026-11-06' }),
  packItem({ kind: 'headline', fact: 'finance.yahoo.com reported: AAA raises guidance', recordKind: 'symbolDayEvidence.news', recordId: 'n1', label: 'finance.yahoo.com via EODHD', at: '2026-11-08T22:00:00.000Z' }),
  packItem({ kind: 'opener', fact: 'Your agent\'s opener said: "AAA is a momentum name."', recordKind: 'agentBattle.opener', recordId: 'b1#0', label: "your agent's opener", at: '2026-11-08T13:00:00Z', status: 'unverified' }),
];
const [CLOSE, HEADLINE, OPENER] = EV.map((e) => e.id);
const CTX = { universe: new Set(['AAA', 'BBB']), evidence: EV };
const sentence = (text, evidenceIds = []) => ({ text, evidenceIds });
const ok = (over = {}) => ({
  names: [{ ticker: 'AAA', read: 'Strength into the print.', evidenceIds: [HEADLINE] }],
  yesterday: null,
  tape: { sentences: [sentence('The tape closed firm yesterday, with SPY up and the ISM data due today.')] },
  namesBeat: { sentences: [sentence('Yahoo Finance reported that AAA raised guidance last night.', [HEADLINE]), sentence('AAA closed at 50.00 on Friday.', [CLOSE])] },
  armor: { sentences: [sentence('Your Contrarian would wait for the crowd to tire before leaning in.')] },
  mentionedTickers: ['AAA', 'SPY'],
  planProposal: { stances: [{ kind: 'WATCH', ticker: 'AAA', level: null }], lines: [{ kind: 'NO_SWAPS_TODAY', eventId: null, ticker: null, level: null }] },
  ...over,
});
const withNames = (...sentences) => ok({ namesBeat: { sentences } });

describe('the system prompt states every voice rule (SHADOW_VOICE_RULES_V1.md)', () => {
  it.each([
    ['next check, never a clock', /at its next check/],
    ['no confirmation talk', /confirming, editing or skipping/],
    ['no "will", "guaranteed", "has seen"', /"will" do something, or anything is "guaranteed", or the agent "has seen"/],
    ['no pre-market number', /pre-market price or number/],
    ['no learning claims', /learn, improve, grow, remember or get smarter/],
    ['no volume (C12)', /trading volume or relative volume at all/],
    ['quiet means not found', /nothing found in the sources we checked/],
    ['headline as attribution (C10)', /reported …", never state its claim as true/],
    ['"unverified" said aloud (C5)', /say the word "unverified"/],
    ['evidence ids on every names sentence (A7)', /Every sentence of namesBeat must cite at least one id/],
    ['the universe only (AR-12)', /Name only tickers from UNIVERSE/],
    ['the plan beat is code\'s', /Do not write the plan as prose: code speaks it/],
  ])('%s', (_rule, re) => {
    expect(SYSTEM_PROMPT).toMatch(re);
  });

  it('the model is the current Sonnet and the answer is a closed JSON schema (structured outputs, not a forced tool)', () => {
    expect(HUDDLE_SCRIPT_MODEL).toBe('claude-sonnet-5-5');
    const closed = (node) => {
      if (!node || typeof node !== 'object') return true;
      if (node.type === 'object' && node.additionalProperties !== false) return false;
      return Object.values(node).every((v) => (Array.isArray(v) ? v.every(closed) : closed(v)));
    };
    expect(closed(SCRIPT_SCHEMA)).toBe(true);
    expect(JSON.stringify(SCRIPT_SCHEMA)).not.toMatch(/plan(?:Beat|Text|Narration)/);
  });

  it('the call sends structured outputs at low effort, no tool_choice and no thinking override, and logs stop_reason and usage', async () => {
    let sent = null;
    const logs = [];
    const out = await callScriptModel({ user: 'u', create: async (body, opts) => { sent = { body, opts }; return { stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 20 }, content: [{ type: 'text', text: JSON.stringify(ok()) }] }; }, log: { log: (...a) => logs.push(a), warn: () => {} } });
    expect(out.ok).toBe(true);
    expect(sent.body).toMatchObject({ model: 'claude-sonnet-5-5', output_config: { effort: 'low', format: { type: 'json_schema' } } });
    expect(sent.body).not.toHaveProperty('tool_choice');
    expect(sent.body).not.toHaveProperty('thinking');
    expect(JSON.parse(logs[0][1])).toMatchObject({ stopReason: 'end_turn', usage: { input: 10, output: 20 } });
    const refused = await callScriptModel({ user: 'u', create: async () => ({ stop_reason: 'refusal', stop_details: { category: 'general_harms' }, usage: {}, content: [] }), log: { log() {}, warn() {} } });
    expect(refused).toMatchObject({ ok: false, reason: 'model_refusal', category: 'general_harms' });
  });
});

describe('validateScript (A §A7, AR-12, C §C5)', () => {
  it('a clean answer passes', () => {
    const v = validateScript(ok(), CTX);
    expect(scriptClean(v)).toBe(true);
    expect(v.names).toEqual([{ ticker: 'AAA', read: 'Strength into the print.', evidenceIds: [HEADLINE] }]);
  });

  it('a names sentence with no evidence id, or an unknown one, fails its beat', () => {
    expect(validateScript(withNames(sentence('AAA looks strong.', [])), CTX).beatFailures.names).toContain('missing_evidence');
    expect(validateScript(withNames(sentence('AAA looks strong.', ['beefbeefbeef'])), CTX).beatFailures.names).toContain('unknown_evidence:beefbeefbeef');
  });

  it('an unverified item is cited only by a sentence that says "unverified"', () => {
    expect(validateScript(withNames(sentence('Your agent picked AAA for momentum.', [OPENER])), CTX).beatFailures.names).toContain(`unverified_unsaid:${OPENER}`);
    expect(validateScript(withNames(sentence('Unverified: your agent said it picked AAA for momentum.', [OPENER])), CTX).beatFailures.names).toEqual([]);
  });

  it('review L2-3: a name\'s read passes the beat checks or the name is dropped (with its reasons), never published', () => {
    const named = (read, evidenceIds = [HEADLINE]) => validateScript(ok({ names: [{ ticker: 'AAA', read, evidenceIds }] }), CTX);
    expect(named('Strength into the print.').names.map((n) => n.ticker)).toEqual(['AAA']);
    for (const [read, reason, ids] of [
      ['Your agent will buy AAA at the open.', 'forbidden:will_do'],
      ['TSLA is moving with AAA.', 'said:TSLA'],
      ['Strength into the print.', 'missing_evidence', []],
    ]) {
      const v = named(read, ids);
      expect(v.names, read).toEqual([]);
      expect(v.nameFailures.AAA, read).toContain(reason);
    }
  });

  it('a ticker outside the universe — declared or merely said — is a ticker failure', () => {
    expect(validateScript(ok({ mentionedTickers: ['AAA', 'TSLA'] }), CTX).tickerFailures).toEqual(['mentioned:TSLA']);
    expect(validateScript(withNames(sentence('NVDA is moving AAA higher.', [HEADLINE])), CTX).tickerFailures).toEqual(['said:NVDA']);
    // acronyms and the index names are not tickers to refuse
    expect(validateScript(withNames(sentence('CPI and the FOMC sit beside AAA and QQQ today.', [HEADLINE])), CTX).tickerFailures).toEqual([]);
    expect(INDEX_NAMES).toContain('SPY');
  });

  it('an acronym listed in mentionedTickers is not a ticker failure either (RF-14); an unknown capitalised word still is, and so is UTC', () => {
    expect(validateScript(ok({ mentionedTickers: ['AAA', 'ISM', 'CPI'] }), CTX).tickerFailures).toEqual([]);
    expect(validateScript(ok({ mentionedTickers: ['AAA', 'ISM', 'TSLA'] }), CTX).tickerFailures).toEqual(['mentioned:TSLA']);
    expect(validateScript(withNames(sentence('As of 20:01 UTC, AAA closed higher.', [HEADLINE])), CTX).tickerFailures).toEqual(['said:UTC']);
  });

  it.each([
    ['clock_930', 'Your agent will move at 9:30 sharp.'],
    ['agent_clock', 'Your agent acts at 10:15 AM on AAA.'],
    ['guarantee', 'AAA is guaranteed to bounce.'],
    ['will_do', 'Your agent will buy AAA.'],
    ['has_seen', 'The agent has seen this setup.'],
    ['premarket_number', 'AAA is up 3% pre-market.'],
    ['confirmation', 'Confirm the plan and you are set.'],
    ['nothing_happened', 'Nothing happened overnight on AAA.'],
    ['rvol', 'AAA prints an RVOL of 2.'],
    ['volume_number', 'AAA traded volume of 3 million shares.'],
    ['volume_number', 'AAA ran on 2x volume.'],
    ['learning_claim', 'Your agent has learned to trust AAA.'],
    ['learning_claim', "I'm getting smarter about AAA."],
  ])('forbidden (%s): "%s"', (name, text) => {
    const v = validateScript(withNames(sentence(text, [HEADLINE])), CTX);
    expect(v.beatFailures.names).toContain(`forbidden:${name}`);
  });

  it('market words that only look like the forbidden ones are not refused', () => {
    for (const text of ['GDP growth printed above trend, and AAA held.', 'Breadth is improving under AAA.', 'The volume picture is unknown this morning, and AAA closed at 50.00.']) {
      expect(validateScript(withNames(sentence(text, [HEADLINE])), CTX).beatFailures.names, text).toEqual([]);
    }
  });

  it('a beat over its length cap fails as too long; the regeneration note names beats and failures, never evidence text', () => {
    const v = validateScript(withNames(sentence(`AAA ${'is strong '.repeat(120)}.`, [HEADLINE])), CTX);
    expect(v.beatFailures.names).toContain('too_long');
    expect(regenerationNoteOf(v)).toBe('names: too_long');
  });

  it('the plan proposal loses its nulls (the template\'s closed schema owns the keys)', () => {
    expect(proposalOf(ok())).toEqual({ stances: [{ kind: 'WATCH', ticker: 'AAA' }], lines: [{ kind: 'NO_SWAPS_TODAY' }] });
  });
});

describe('the code-written plan beat never trips a forbidden pattern', () => {
  it('for every stance and line kind', () => {
    const labels = new Map([['macro:ism_manufacturing:2026-11-09:1000', 'the 10:00 AM ET ISM manufacturing data']]);
    const plans = [
      { stances: [{ kind: 'FADE', ticker: 'AAA', level: 48 }, { kind: 'HOLD', ticker: 'BBB' }, { kind: 'WATCH', ticker: 'CCC' }], lines: [{ kind: 'NO_ADDS_BEFORE', eventId: 'macro:ism_manufacturing:2026-11-09:1000' }, { kind: 'CUT_IF_BELOW', ticker: 'BBB', level: 42 }] },
      { stances: [{ kind: 'CHASE', ticker: 'AAA', level: 52 }, { kind: 'TRIM', ticker: 'BBB' }], lines: [{ kind: 'NO_SWAPS_TODAY' }, { kind: 'NO_CHASE_ABOVE', ticker: 'AAA', level: 55 }] },
      { stances: [], lines: [] },
    ];
    for (const p of plans) {
      const said = narratePlan(p, { eventLabels: labels });
      for (const [name, re] of Object.entries(FORBIDDEN_SCRIPT_PATTERNS)) expect(re.test(said), `${name}: ${said}`).toBe(false);
    }
  });
});

describe('the user prompt carries no volume (C §C12)', () => {
  it('only the tape fields, closes, events and evidence — never a volume', () => {
    const user = buildUserPrompt({
      etDate: '2026-11-09', weekday: 'Monday', archetypeLabel: 'Contrarian', archetypeDisposition: 'Buys what everyone else is giving up on.',
      gathered: {
        universe: new Set(['AAA']), names: [{ ticker: 'AAA', source: 'activeBattle' }], closes: new Map([['AAA', 50]]),
        tape: { regime: 'risk-on', breadthTier: 'broad', volatilityRegime: 'normal', topSector: 'Tech', topSectorChange: 1.2, worstSector: 'Energy', worstSectorChange: -0.8, spyChangePercent: 0.4, qqqChangePercent: 0.6, asOf: '2026-11-06T21:00:00Z' },
        eventsListed: { earningsListed: 1, earningsTotal: 45 }, events: { eligible: new Map() }, priorPlan: null, evidence: EV,
      },
    });
    expect(user).not.toMatch(/volume|rvol/i);
    expect(user).toContain('1 of 45 earnings reports listed today.');
  });
});
