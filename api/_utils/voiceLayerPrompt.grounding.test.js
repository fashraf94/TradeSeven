// api/_utils/voiceLayerPrompt.grounding.test.js
//
// Voice-layer grounding — THE GROUNDED PROMPT, assembled (spec §3, §4, §7,
// §10). The off state is the goldens' business
// (voiceLayerPrompt.grounding.goldens.test.js); this file is the ON state:
//
//   · the identity frame (§3.1) replaces the shipped one, and the shipped
//     "You bring the research" sentence is gone;
//   · YOUR RECORD renders from the battle's own evaluations, byte-verbatim,
//     with the rule beside it and the directive line under it (§3.2);
//   · CURRENT CONTEXT heads the cache blocks, the DATA_CONFIDENCE_RULE carries
//     the vintage sentence, and the fundamentals line renders per name (§3.3,
//     §3.5) — under the flag only;
//   · the narrator's own earlier messages render only when they carry the
//     marker (§3.4);
//   · THE 30-STRING GUARD (§4; rulings §3): every guarded phrase is ABSENT
//     from every grounded surface — and PRESENT in the off surface it names,
//     so a row that cannot fail is not among them;
//   · the grounded prose itself stays clear of the seven FORBIDDEN_SIGNALS
//     (item 9 note 2) — the source sweep in agentEvalPromptAssembly.honesty
//     .test.js covers the module; the rendered text is checked here too;
//   · the template opener stops after the archetype sentence (§7);
//   · the opener prompt carries the plan at deploy behind its gates (D-76).
//
// Dependency-surface guard (BUILD_RULES §4): the REAL imports below are the
// runtime guard that voiceLayerPrompt.js, voiceLayerGrounding.js and the
// src/ modules they pull (deskCopy.js, decisionRecord.js, agentGameModes.js)
// stay Node-clean. Never mock them.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const { mockMarketState, archetypeFlag } = vi.hoisted(() => ({
  mockMarketState: { isOpen: true, state: 'OPEN', nextOpenTime: new Date('2026-09-09T13:30:00Z'), isEarlyClose: false },
  archetypeFlag: { mode: 'enforce' },
}));

vi.mock('./marketSchedule.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getMarketState: () => ({ ...mockMarketState }) };
});
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_INTEGRITY_MODE() { return archetypeFlag.mode; },
}));

import {
  buildVoiceLayerPrompt,
  buildFirstMessagePrompt,
  buildTradeNarrationPrompt,
  buildAnticipationPrompt,
  buildPortfolioBriefsBlock,
  buildBenchBriefsBlock,
  getAgentPhase,
} from './voiceLayerPrompt.js';
import { buildTemplateOpener } from './openerTemplateFloor.js';
import {
  GROUNDING_VERSION,
  GROUNDING_VOCABULARY_GUARD,
  findGuardedVocabulary,
  RECORD_HEADING,
  RATIONALE_RULE,
  CURRENT_CONTEXT_HEADING,
  CONTEXT_VINTAGE_SENTENCE,
  CURRENT_DIRECTIVE_HEADING,
  EARLIER_MESSAGES_HEADING,
  GROUNDED_ELICITATION_INSTRUCTIONS,
  GROUNDED_OUTPUT_FORMAT,
} from './voiceLayerGrounding.js';
import { ELICITATION_INSTRUCTIONS } from '../agent/chat.js';
import { FORBIDDEN_SIGNALS } from './__fixtures__/promptHonestyRegistry.js';
import {
  FROZEN_NOW,
  makeAgent,
  makeBattle,
  makeTournamentBattle,
  makeMarketSnapshot,
  makeCandidate,
  makeClosedTrade,
  ELICITATION_TARGET,
  CAPABILITIES_MANIFEST,
  ANCHOR_CONTEXT,
  SUPPORTED_TERMS,
} from './__fixtures__/voiceGroundingFixtures.js';

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(FROZEN_NOW)); });
afterAll(() => { vi.useRealTimers(); });

const PHASES = [['discovery', 4], ['refinement', 18], ['mastery', 40]];

function battlePrompt({ games = 4, grounded = true, battle = makeBattle(), marketSnapshot = makeMarketSnapshot(), archetype = 'enforce', extra = {} } = {}) {
  const prev = archetypeFlag.mode;
  archetypeFlag.mode = archetype;
  try {
    return buildVoiceLayerPrompt({
      agent: makeAgent({ stats: { gamesPlayed: games, wins: 1, losses: 1 } }),
      battle,
      // chat.js hands the prompt the GROUNDED instruction under the flag (site
      // 27); the shipped one is what the off surface renders. The guard rows
      // below caught a fixture that passed the shipped line under the flag.
      elicitationTarget: grounded
        ? { dimension: ELICITATION_TARGET.dimension, instruction: GROUNDED_ELICITATION_INSTRUCTIONS[ELICITATION_TARGET.dimension] }
        : ELICITATION_TARGET,
      conversationHistory: [],
      anchorContext: ANCHOR_CONTEXT,
      marketSnapshot,
      mode: 'battle',
      dailyReviews: [],
      dailyGrades: {},
      capabilitiesManifest: CAPABILITIES_MANIFEST,
      grounded,
      ...extra,
    });
  } finally {
    archetypeFlag.mode = prev;
  }
}

function firstMessagePrompt({ games = 4, grounded = true, battle = makeBattle({ chatExchanges: [], evaluations: [], trades: [], directive: null, createdAt: '2026-09-08T13:31:00.000Z', agentContext: { archetype: 'momentum_chaser', strategyBrief: 'Semis lead; the book rides the leaders.', innerMonologue: { strategy: 'Lean into strength.' } } }), marketSnapshot = null } = {}) {
  return buildFirstMessagePrompt({
    agent: makeAgent({ stats: { gamesPlayed: games, wins: 1, losses: 1 } }),
    battle,
    anchorContext: ANCHOR_CONTEXT,
    marketSnapshot,
    currentPhase: getAgentPhase(games),
    supportedTerms: SUPPORTED_TERMS,
    executionMode: 'autopilot',
    grounded,
  });
}

/** Every grounded surface the guard must hold over. */
function groundedSurfaces() {
  const out = {};
  for (const [phase, games] of PHASES) {
    for (const archetype of ['off', 'enforce']) {
      out[`battle.${phase}.${archetype}.cache`] = battlePrompt({ games, archetype });
      out[`battle.${phase}.${archetype}.noCache`] = battlePrompt({ games, archetype, marketSnapshot: null });
    }
    out[`battle.${phase}.tournament`] = battlePrompt({ games, battle: makeTournamentBattle() });
    out[`firstMessage.${phase}`] = firstMessagePrompt({ games });
    out[`firstMessage.${phase}.cache`] = firstMessagePrompt({ games, marketSnapshot: makeMarketSnapshot() });
  }
  out['templateOpener'] = buildTemplateOpener({ agent: makeAgent(), battle: makeBattle(), grounded: true });
  out['elicitation'] = Object.values({ ...ELICITATION_INSTRUCTIONS, ...GROUNDED_ELICITATION_INSTRUCTIONS }).join('\n');
  return out;
}

/** The OFF surface each guard entry names — where its phrase must be found. */
function offSurface(name) {
  switch (name) {
    case 'battle':
      return PHASES.map(([, games]) => battlePrompt({ games, grounded: false })).join('\n');
    case 'firstMessage':
      return firstMessagePrompt({ grounded: false });
    case 'anticipation':
      return buildAnticipationPrompt({ agent: makeAgent(), battle: makeBattle(), anchorContext: ANCHOR_CONTEXT, marketSnapshot: null, currentPhase: 'discovery', anticipationCandidate: makeCandidate(), directive: null, supportedTerms: SUPPORTED_TERMS });
    case 'tradeNarration':
      return buildTradeNarrationPrompt({ agent: makeAgent(), battle: makeBattle(), anchorContext: ANCHOR_CONTEXT, marketSnapshot: null, currentPhase: 'discovery', swap: makeClosedTrade(), rationale: makeClosedTrade().rationale, provenance: 'autopilot', directive: null, supportedTerms: SUPPORTED_TERMS });
    case 'templateOpener':
      return buildTemplateOpener({ agent: makeAgent(), battle: makeBattle() });
    case 'elicitation':
      return Object.values(ELICITATION_INSTRUCTIONS).join('\n');
    default:
      throw new Error(`unknown surface ${name}`);
  }
}

describe('§3.1 — the identity frame', () => {
  it('replaces the shipped identity with the spec\'s frame', () => {
    const text = battlePrompt();
    expect(text.startsWith('You are Vega, a Trend Follower. Your trades are decided by your trading process at each scheduled 15-minute check and recorded.')).toBe(true);
    expect(text).toContain('Between checks no trading decision is made.');
    expect(text).toContain('You may not say what you will do to a position.');
    expect(text).toContain('Historical decision records are evidence of what was decided then; do not infer a current plan or a future action from them.');
    expect(text).toContain('Your earlier messages are conversation, not decision evidence.');
    expect(text).not.toContain('You bring the research and market reads');
    expect(text).toContain('You are in the discovery phase of your partnership.');
  });
});

describe('§3.2 — YOUR RECORD in the assembled prompt', () => {
  it('renders the record from the battle\'s evaluations, byte-verbatim, with the rule and the directive', () => {
    const text = battlePrompt();
    const battle = makeBattle();
    expect(text).toContain(RECORD_HEADING);
    expect(text).toContain(battle.evaluations[4].rationale); // the bytes, markers included
    expect(text).toContain(RATIONALE_RULE);
    expect(text).toContain(CURRENT_DIRECTIVE_HEADING);
    expect(text).toContain('"Require stronger confirmation before entering" — filed 11:20 AM');
    // The record sits between the anchor and the cache blocks.
    expect(text.indexOf(RECORD_HEADING)).toBeLessThan(text.indexOf(CURRENT_CONTEXT_HEADING));
    expect(text.indexOf(RECORD_HEADING)).toBeGreaterThan(text.indexOf(ANCHOR_CONTEXT));
  });

  it('the directive line resolves through the ONE reader: suppressed under archetype off, absent when none', () => {
    // resolveControls renders a persisted directive only under 'enforce'
    // (Release 2 PR-c); under 'off' the slot is suppressed on every prompt
    // surface, and the record says so rather than quoting it.
    expect(battlePrompt({ archetype: 'off' })).toContain('CURRENT DIRECTIVE: none filed.');
    expect(battlePrompt({ archetype: 'enforce', battle: makeBattle({ directive: null }) })).toContain('CURRENT DIRECTIVE: none filed.');
    expect(battlePrompt({ archetype: 'enforce' })).not.toContain('CURRENT DIRECTIVE: none filed.');
  });

  it('a battle with no evaluations still renders the block (a truthful absence)', () => {
    expect(battlePrompt({ battle: makeBattle({ evaluations: [] }) })).toContain('No check has been recorded yet.');
  });
});

describe('§3.3 / §3.5 — CURRENT CONTEXT', () => {
  it('heads the cache blocks, and the DATA_CONFIDENCE_RULE carries the vintage sentence', () => {
    const text = battlePrompt();
    expect(text).toContain(CURRENT_CONTEXT_HEADING);
    expect(text.indexOf(CURRENT_CONTEXT_HEADING)).toBeLessThan(text.indexOf('YOUR PORTFOLIO'));
    expect(text).toContain(`Never invent numbers — if a field is missing, skip it entirely.\n${CONTEXT_VINTAGE_SENTENCE}`);
  });

  it('renders the fundamentals line per name, null-honest — and only under the flag', () => {
    const snap = makeMarketSnapshot();
    const on = buildPortfolioBriefsBlock(snap, { grounded: true });
    expect(on).toContain('Fundamentals (as of Sep 5): EPS revisions +47.2% · revenue growth +12% · P/E 18.2 vs sector 22.1 · market cap large');
    // PANW carries no fundamentals key → no line for it.
    const panw = on.split('\n\n').find((e) => e.startsWith('PANW'));
    expect(panw).not.toContain('Fundamentals');
    expect(buildPortfolioBriefsBlock(snap)).not.toContain('Fundamentals');
    expect(buildPortfolioBriefsBlock(snap, { grounded: false })).not.toContain('Fundamentals');
    const bench = buildBenchBriefsBlock(snap, { grounded: true });
    expect(bench).toContain('Fundamentals (as of Sep 5): revenue growth +22.3% · P/E 58 vs sector 28.5');
    // The MOS entry's vintage is a week older — its own date, not the newest.
    expect(on).toContain('Fundamentals (as of Aug 29): P/E 11.4 · beat rate 75%');
    expect(buildBenchBriefsBlock(snap)).not.toContain('Fundamentals');
  });

  it('no heading and no vintage sentence when there is no cache', () => {
    const text = battlePrompt({ marketSnapshot: null });
    expect(text).not.toContain(CURRENT_CONTEXT_HEADING);
    expect(text).not.toContain(CONTEXT_VINTAGE_SENTENCE);
  });
});

describe('§3.4 — the narrator\'s own earlier messages', () => {
  it('render only when they carry the marker; the legacy opener and anticipation are excluded', () => {
    const legacy = battlePrompt();
    expect(legacy).not.toContain(EARLIER_MESSAGES_HEADING);
    const exchanges = makeBattle().chatExchanges.map((ex, i) => (i === 2 ? { ...ex, groundingVersion: GROUNDING_VERSION } : ex));
    const stamped = battlePrompt({ battle: makeBattle({ chatExchanges: exchanges }) });
    expect(stamped).toContain(EARLIER_MESSAGES_HEADING);
    expect(stamped).toContain('[anticipation · 10:16 AM] Eyeing AVGO on the bench.');
    expect(stamped).not.toContain("[first_message · 9:31 AM]");
    // It sits after the battle state (the receipts) and before the few-shot.
    expect(stamped.indexOf(EARLIER_MESSAGES_HEADING)).toBeGreaterThan(stamped.indexOf('CURRENT BATTLE:'));
    expect(stamped.indexOf(EARLIER_MESSAGES_HEADING)).toBeLessThan(stamped.indexOf('EXAMPLE OF A GOOD DISCOVERY EXCHANGE'));
  });
});

describe('§4 — the vocabulary guard: 30 sites, absent from every grounded surface, present in the off surface they name', () => {
  const surfaces = groundedSurfaces();

  it.each(GROUNDING_VOCABULARY_GUARD.map((e) => [e.site, e]))('site %s is REAL: its phrase is in the off surface it names', (_site, entry) => {
    const off = offSurface(entry.surface);
    for (const phrase of entry.phrases) {
      expect(off, `site ${entry.site}: "${phrase}" not found in the off ${entry.surface} surface — the guard string is not a guard`).toContain(phrase);
    }
  });

  it.each(Object.keys(surfaces))('%s carries none of the 30', (key) => {
    const hits = findGuardedVocabulary(surfaces[key]);
    expect(hits, `${key}: ${JSON.stringify(hits)}`).toEqual([]);
  });

  it('the grounded surfaces are the grounded ones (the frame is there), so the rows above are not vacuous', () => {
    for (const key of Object.keys(surfaces)) {
      if (key.startsWith('battle.')) expect(surfaces[key]).toContain('You may not say what you will do to a position.');
      if (key.startsWith('firstMessage.')) expect(surfaces[key]).toContain('you did not author them');
    }
    expect(surfaces.templateOpener).toContain("I'm running this as a Trend Follower");
  });

  it('the grounded prose never names an absent signal (the seven FORBIDDEN_SIGNALS), rendered', () => {
    for (const [key, text] of Object.entries(surfaces)) {
      for (const [label, re] of FORBIDDEN_SIGNALS) {
        expect(re.test(text), `${label} leaked into ${key}`).toBe(false);
      }
    }
  });

  it('the CONFIRMATION and CLOSING rules are the spec\'s sentences, in every phase', () => {
    for (const [, games] of PHASES) {
      const text = battlePrompt({ games });
      expect(text).toContain('Acknowledge in one sentence. The interface states what was filed. Do not describe what you will do with it.');
      expect(text).toContain('You may lay out the options the record and the rules support; you do not say which will be taken.');
    }
  });

  it('the grounded third path offers to FILE and never claims an adjustment is underway', () => {
    const text = battlePrompt({ archetype: 'enforce' });
    expect(text).toContain('OFFER TO FILE');
    expect(text).toContain('Nothing is underway on your say-so');
    expect(text).not.toContain('Describe a defensive adjustment as actually underway');
  });
});

describe('§7 — the opener', () => {
  it('the template floor stops after the archetype sentence under the flag, and is the shipped string otherwise', () => {
    const on = buildTemplateOpener({ agent: makeAgent(), battle: makeBattle(), grounded: true });
    const off = buildTemplateOpener({ agent: makeAgent(), battle: makeBattle() });
    expect(on).toBe("Hey — we're live. I've built the book around CF up top, MOS and PANW in core and AVGO backing it up. I'm running this as a Trend Follower, so I'll be riding strength and cutting the laggards fast.");
    expect(off.startsWith(on)).toBe(true);
    expect(off).toContain("I'll flag anything that starts moving");
    expect(on).not.toContain('flag');
    expect(on.trim().endsWith('.')).toBe(true);
  });

  it('the grounded first-message prompt carries the plan at deploy, dated, and the §7 contract', () => {
    const text = firstMessagePrompt();
    expect(text).toContain('THE PLAN AT DEPLOY — The plan at deploy · Sep 8');
    expect(text).toContain('"Semis lead; the book rides the leaders."');
    expect(text).toContain('One sentence stating the reason recorded at deploy, from THE PLAN AT DEPLOY block');
    expect(text).toContain('you did not author them');
    expect(text).not.toContain('Show that you\'ve done your prep');
  });

  it('the plan at deploy is gated off a tournament battle and the fallbacks, and the shape says so', () => {
    const t = firstMessagePrompt({ battle: makeTournamentBattle({ chatExchanges: [], evaluations: [], trades: [], directive: null, createdAt: '2026-09-08T13:31:00.000Z', agentContext: { archetype: 'momentum_chaser', strategyBrief: 'Prescribed tournament deployment' } }) });
    expect(t).not.toContain('THE PLAN AT DEPLOY —');
    expect(t).not.toContain('Prescribed tournament deployment');
    expect(t).toContain('If no plan is recorded in this prompt, say the book is set');
  });

  it('with a cache at deploy, the grounded opener puts the briefs under CURRENT CONTEXT and carries the vintage sentence — the battle assembly\'s rule (review R-15); off keeps neither', () => {
    const on = firstMessagePrompt({ marketSnapshot: makeMarketSnapshot() });
    expect(on).toContain(CURRENT_CONTEXT_HEADING);
    expect(on.indexOf(CURRENT_CONTEXT_HEADING)).toBeLessThan(on.indexOf('Fundamentals (as of'));
    expect(on).toContain(CONTEXT_VINTAGE_SENTENCE);
    const off = firstMessagePrompt({ grounded: false, marketSnapshot: makeMarketSnapshot() });
    expect(off).not.toContain(CURRENT_CONTEXT_HEADING);
    expect(off).not.toContain(CONTEXT_VINTAGE_SENTENCE);
    expect(off).not.toContain('Fundamentals (as of');
    // No cache → no heading, even grounded.
    expect(firstMessagePrompt({ marketSnapshot: null })).not.toContain(CURRENT_CONTEXT_HEADING);
  });

  it('the off first-message prompt is the shipped one', () => {
    const text = firstMessagePrompt({ grounded: false });
    expect(text).toContain('Show that you\'ve done your prep');
    expect(text).not.toContain('THE PLAN AT DEPLOY');
  });
});

describe('the grounded elicitation lines (site 27)', () => {
  it('replace exactly the two discovered lines and leave the other thirteen untouched', () => {
    expect(Object.keys(GROUNDED_ELICITATION_INSTRUCTIONS).sort()).toEqual(['autonomy_preference', 'time_of_day_preference']);
    const merged = { ...ELICITATION_INSTRUCTIONS, ...GROUNDED_ELICITATION_INSTRUCTIONS };
    expect(Object.keys(merged)).toEqual(Object.keys(ELICITATION_INSTRUCTIONS));
    for (const k of Object.keys(ELICITATION_INSTRUCTIONS)) {
      if (k in GROUNDED_ELICITATION_INSTRUCTIONS) expect(merged[k]).not.toBe(ELICITATION_INSTRUCTIONS[k]);
      else expect(merged[k]).toBe(ELICITATION_INSTRUCTIONS[k]);
    }
  });
});

describe('§6.2 — the output format mints chips by id, battle mode only', () => {
  const CHIP_RULE = 'An option that FILES a directive must be a menu item by id';
  it('the grounded battle prompt carries the grounded output format; the off battle prompt and the review prompt do not', () => {
    for (const [, games] of PHASES) {
      const on = battlePrompt({ games });
      expect(on).toContain(GROUNDED_OUTPUT_FORMAT);
      expect(on).toContain(CHIP_RULE);
      const off = battlePrompt({ games, grounded: false });
      expect(off).not.toContain(CHIP_RULE);
      expect(off).toContain('"suggestedActions": null OR ["Action Button 1", "Action Button 2", "Action Button 3"]');
      expect(on).not.toContain('"Action Button 1"');
    }
    // Review mode is untouched by this arc even when handed grounded: true.
    const review = battlePrompt({ extra: { mode: 'review' }, battle: makeBattle({ status: 'completed' }) });
    expect(review).not.toContain(CHIP_RULE);
  });
});
