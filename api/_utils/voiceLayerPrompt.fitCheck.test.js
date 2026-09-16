// api/_utils/voiceLayerPrompt.fitCheck.test.js
//
// THE DIRECTIVE FIT CHECK — the PROMPT halves.
//
// A-1: each menu line carries its policy annotations, so the model can see the
//      dial it is choosing on instead of seven bare strings (Phase 0 Q3).
//
// THE FLAG-OFF INVARIANT IS THE POINT OF THIS FILE, and it is proved at two
// resolutions. The two SLICE goldens (the archetype block, the phase rules)
// read as prose and say which bytes moved; the 147 WHOLE-PROMPT HASHES at the
// bottom cover every mode x grounded x archetype x phase the build can reach,
// so a mutation ANYWHERE in the assembly reds — the slices alone cover only
// ~41% of one battle prompt, which is narrower than this header used to claim
// (§2 review finding B2).
//
// Every golden in __fixtures__/voiceLayerPrompt.fitCheck.preBuild.golden.json
// was captured from the TRUE PRE-BUILD module — the slices by rendering this
// file at the commit before commit A, the hashes from
// `git show origin/main:api/_utils/voiceLayerPrompt.js` under the same
// market-state mock. None was regenerated from the post-change code. A golden
// regenerated from the code it guards proves nothing.
//
// Both slices are deterministic: neither the archetype block nor the phase-rule
// block depends on market state or the clock, so no time mock is needed here.
//
// The import of ./voiceLayerPrompt.js (and, transitively,
// src/data/archetypeAdjustments.js) is the BUILD_RULES §4 dependency-surface
// guard and must never be mocked.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// Both flags live on the same module and both are read at CALL time inside the
// functions that gate on them, so a live getter over a hoisted mutable flips
// them per row. The importOriginal spread keeps every other real flag.
const { archetypeFlag, fitCheck } = vi.hoisted(() => ({
  archetypeFlag: { mode: 'enforce' },
  fitCheck: { on: false },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_INTEGRITY_MODE() { return archetypeFlag.mode; },
  get DIRECTIVE_FIT_CHECK_ENABLED() { return fitCheck.on; },
}));

// The whole-prompt rows below hash the ENTIRE assembled prompt, which reaches
// buildBattleState and therefore the clock. Pin the market state so the hash is
// a function of the code alone — the same mock the pre-build capture ran under.
const { mockMarketState } = vi.hoisted(() => ({
  mockMarketState: { isOpen: true, state: 'OPEN', nextOpenTime: new Date('2099-12-31T14:30:00Z'), isEarlyClose: false },
}));
vi.mock('./marketSchedule.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getMarketState: () => ({ ...mockMarketState }),
}));

import { buildVoiceLayerPrompt, buildFirstMessagePrompt } from './voiceLayerPrompt.js';

// The exact anchor the flag-ON transform replaces, and its replacement —
// spelled out HERE, independently of the module under test, so the surgical-
// replacement row below compares against a value the renderer cannot supply.
const SHIPPED_ACK_ANCHOR_TEXT = '"Got it; that\'s my lean now.").';
const FIT_CHECK_ACK_TEXT =
  '"Got it — filing: {the exact canonical text of the id you selected}."). '
  + 'Say the canonical text word for word; the card beneath you states what was filed. '
  + 'Do not describe the lean in other words.';

const PRE_BUILD = JSON.parse(
  readFileSync(new URL('./__fixtures__/voiceLayerPrompt.fitCheck.preBuild.golden.json', import.meta.url), 'utf8'),
);

const BATTLE = {
  gameMode: 'standard',
  portfolio: { star: [], core: [], support: [] },
  scoreState: { currentScore: 0, opponentScore: 0 },
  dailyReviews: [],
};
const ELICIT = { dimension: 'risk_appetite', instruction: 'probe risk appetite' };

const promptFor = (archetype, gamesPlayed = 1) => buildVoiceLayerPrompt({
  agent: { name: 'Gemma', archetype, stats: { gamesPlayed, wins: 0, losses: 0 } },
  battle: BATTLE,
  elicitationTarget: ELICIT,
  conversationHistory: [],
  anchorContext: null,
  marketSnapshot: null,
  mode: 'battle',
});

// The archetype-integrity block runs from its heading to the THIRD PATH block
// that always follows it under the same single guard (voiceLayerPrompt.js).
const archetypeBlockOf = (prompt) => {
  const start = prompt.indexOf('YOUR ARCHETYPE — THE FOUR ZONES');
  expect(start, 'archetype block missing from the prompt').toBeGreaterThan(-1);
  const end = prompt.indexOf('\n\nTHIRD PATH —', start);
  expect(end, 'THIRD PATH block missing after the menu').toBeGreaterThan(-1);
  return prompt.slice(start, end);
};

const ARCHETYPES = ['degen', 'momentum_chaser', 'contrarian', 'guardian', 'diversifier', 'analyst'];

afterEach(() => { archetypeFlag.mode = 'enforce'; fitCheck.on = false; });

// ==================== A-1 — the menu golden ====================

describe('A-1 — menu render: flag-OFF is the pre-build bytes', () => {
  it.each(ARCHETYPES)('%s: the archetype block is byte-identical to the pre-build capture', (archetype) => {
    fitCheck.on = false;
    expect(archetypeBlockOf(promptFor(archetype))).toBe(PRE_BUILD.archetypeBlock[archetype]);
  });

  it('flag-OFF carries no annotation vocabulary at all', () => {
    fitCheck.on = false;
    for (const archetype of ARCHETYPES) {
      const block = archetypeBlockOf(promptFor(archetype));
      expect(block).not.toContain('[cautious register]');
      expect(block).not.toContain('[concentration:');
      expect(block).not.toContain('[opposite of');
      expect(block).not.toContain('More cautious, in character:');
    }
  });
});

describe('A-1 — menu render: flag-ON annotates every line from the data module', () => {
  // The Speculator menu, with the annotation each line must carry. Written out
  // FROM THE CHARTER TABLE, not copied from the renderer — a row derived from
  // the code under test cannot fail when that code is wrong.
  //
  // SP-01 carries NO tag although the charter's prose names "tighten the
  // still-wide stop" first among its cautious moves: its policy is
  // timeHorizonDirection 'shorter', and the cautious-register derivation is
  // risk-lower + concentration-neutral + horizon-neutral. See the build
  // report's Deviations section — SP-02 / SP-06 / SP-07 carry byte-identical
  // policy, so no function of `policy` can list the charter's trio.
  const SPECULATOR_LINES = [
    ['SP-01', '  SP-01: Tighten the downside stop'],
    ['SP-02', '  SP-02: Hunt slightly-less-extreme volatility (still high-ATR, not top decile) — [cautious register]'],
    ['SP-03', '  SP-03: Trade less frequently — fewer, more-committed swings'],
    ['SP-04', '  SP-04: Concentrate into fewer high-conviction movers — [concentration: tighter] [opposite of SP-05]'],
    ['SP-05', '  SP-05: Spread across more names (diversify the chaos) — [concentration: wider] [opposite of SP-04]'],
    ['SP-06', '  SP-06: Reduce position size on new entries — [cautious register]'],
    ['SP-07', '  SP-07: Require a stronger momentum/technical trigger before piling in — [cautious register]'],
  ];

  it.each(SPECULATOR_LINES)('%s renders its exact annotated line, whole', (_id, line) => {
    fitCheck.on = true;
    // Anchored both ends: a line that merely STARTS with the expected text (an
    // unexpected extra tag appended) fails here.
    expect(archetypeBlockOf(promptFor('degen'))).toContain(`\n${line}\n`);
  });

  it('SP-04 and SP-05 name each other as the two ends of one dial', () => {
    fitCheck.on = true;
    const block = archetypeBlockOf(promptFor('degen'));
    expect(block).toContain('SP-04: Concentrate into fewer high-conviction movers — [concentration: tighter] [opposite of SP-05]');
    expect(block).toContain('SP-05: Spread across more names (diversify the chaos) — [concentration: wider] [opposite of SP-04]');
  });

  it('the cautious-register line lists exactly the derived ids', () => {
    fitCheck.on = true;
    expect(archetypeBlockOf(promptFor('degen'))).toContain('More cautious, in character: SP-02, SP-06, SP-07.');
  });

  it('forbiddenOpposite text appears NOWHERE in the prompt (a menu must not teach the reversal)', () => {
    fitCheck.on = true;
    // Every forbiddenOpposite string on the Speculator menu, verbatim from the
    // charter table. A menu line that leaked one would fail here.
    const forbidden = [
      'removing the survival floor',
      'buying stable, low-volatility names',
      'becoming a slow quality holder',
      'diversifying into safety',
      'spreading into stable, low-volatility names',
      'abandoning volatility selection',
      'picking for quality / stability',
    ];
    const prompt = promptFor('degen');
    for (const phrase of forbidden) expect(prompt).not.toContain(phrase);
  });

  // The second archetype the build asks for. Contrarian's conflict group is
  // CN-05 / CN-08 (profit-taking eagerness) and neither end carries a
  // concentration tag — so this row proves the three annotation kinds are
  // independent, not a Speculator-shaped coincidence.
  it('repeats for Contrarian: its own group, its own cautious register, no concentration tag', () => {
    fitCheck.on = true;
    const block = archetypeBlockOf(promptFor('contrarian'));
    expect(block).toContain('\n  CN-05: Take profit more eagerly into resistance — [opposite of CN-08]\n');
    expect(block).toContain('\n  CN-08: Hold longer for the reversal before trimming (more patient profit-taking) — [opposite of CN-05]\n');
    expect(block).toContain('More cautious, in character: CN-01, CN-02, CN-06, CN-07.');
    expect(block).not.toContain('[concentration:'); // no CN line moves concentration
  });

  it('every archetype annotates at least one line, and no line is annotated twice', () => {
    fitCheck.on = true;
    for (const archetype of ARCHETYPES) {
      const block = archetypeBlockOf(promptFor(archetype));
      const menuLines = block.split('\n').filter((l) => /^ {2}[A-Z]{2}-\d\d: /.test(l));
      expect(menuLines.length, `${archetype} menu lines`).toBeGreaterThan(0);
      expect(menuLines.some((l) => l.includes(' — [')), `${archetype} has an annotated line`).toBe(true);
      for (const line of menuLines) {
        // The suffix is appended once; a double append would show two ' — ['
        // openers on one line. (The em-dash inside a canonical sentence carries
        // no bracket, so it does not match.)
        expect(line.split(' — [').length - 1, `double annotation on: ${line}`).toBeLessThanOrEqual(1);
      }
    }
  });

  // ── DOCUMENTED LIMIT — the cautious register disagrees with the charter prose
  // rendered eight lines above it, in FOUR of six archetypes (§2 review finding
  // A4, build report §6 D-1). This row PINS a known conflict, not a behaviour
  // anyone wants: delete it when the conflict is resolved, do not "fix" it.
  //
  // BUILD_RULES §9 (display-agreement) is the rule at stake: a label and the
  // fact it names must come from ONE source. Here `zones.protectedBias` (the
  // charter's own sentence, rendered verbatim as PROTECTED BIAS) and the
  // derived `More cautious, in character:` line are two sources for one fact,
  // in one block, and they demonstrably disagree.
  //
  // The derivation cannot be fixed in this module: SP-02/SP-06/SP-07 carry
  // byte-identical `policy`, so no function of `policy` can produce the
  // charter's trio. The clean fix is a `cautiousRegister` field on
  // src/data/archetypeAdjustments.js — ONE source — which needs founder
  // sanction, that file being read-only in this build.
  it('LIMIT: the derived cautious register disagrees with the charter prose in 4 of 6 archetypes', () => {
    fitCheck.on = true;
    // What the charter's own "More cautious = ..." sentence names, read off the
    // prose by hand — NOT derived from the code under test.
    const CHARTER_SAYS = {
      degen: ['SP-01', 'SP-02', 'SP-06'],          // tighten the stop / less-extreme vol / size down
      contrarian: ['CN-03', 'CN-01', 'CN-02'],     // tighten the stop / deeper washout / clearer turn
      analyst: ['FI-01', 'FI-02', 'FI-03'],        // quality bar / cleaner setup / hold longer
      diversifier: ['DV-01', 'DV-02', 'DV-03'],    // tighten the cap / widen the spread / rebalance sooner
    };
    const renderedIds = (archetype) => {
      const line = archetypeBlockOf(promptFor(archetype))
        .split('\n').find((l) => l.startsWith('More cautious, in character: '));
      expect(line, `${archetype} renders no cautious-register line`).toBeTruthy();
      return line.replace('More cautious, in character: ', '').replace(/\.$/, '').split(', ');
    };

    // degen / contrarian / analyst: each DROPS the move its own prose names FIRST.
    expect(renderedIds('degen')).not.toContain('SP-01');
    expect(renderedIds('contrarian')).not.toContain('CN-03');
    expect(renderedIds('analyst')).not.toContain('FI-03');

    // diversifier is the sharpest: the two sets are entirely DISJOINT.
    const dv = renderedIds('diversifier');
    expect(dv).toEqual(['DV-06']);
    for (const id of CHARTER_SAYS.diversifier) expect(dv).not.toContain(id);

    // And the charter's sentence really is in the same block, so a reader of
    // the prompt sees both claims at once.
    const block = archetypeBlockOf(promptFor('diversifier'));
    expect(block).toContain('More cautious = tighten the cap / widen the spread / rebalance sooner');
    expect(block).toContain('More cautious, in character: DV-06.');

    // guardian and momentum_chaser do NOT disagree — so this is four of six,
    // not a blanket failure, and the row says which.
    expect(renderedIds('guardian')).toEqual(['CP-01', 'CP-02', 'CP-08']);
    expect(renderedIds('momentum_chaser')).toContain('TF-02');
  });

  it('MUTATION CHECK — the flag-ON block is NOT the flag-OFF block, for every archetype', () => {
    // A toContain row that also passes flag-off is not a guard (the Sep 13
    // lesson). Every archetype's rendered block must actually move.
    for (const archetype of ARCHETYPES) {
      fitCheck.on = false;
      const off = archetypeBlockOf(promptFor(archetype));
      fitCheck.on = true;
      const on = archetypeBlockOf(promptFor(archetype));
      expect(on, `${archetype} block did not move under the flag`).not.toBe(off);
    }
  });
});

describe('A-1 — the archetype apparatus stays flag-gated end to end', () => {
  it('ARCHETYPE_INTEGRITY_MODE off → no block at all, whatever the fit-check flag says', () => {
    archetypeFlag.mode = 'off';
    fitCheck.on = true;
    const prompt = promptFor('degen');
    expect(prompt).not.toContain('YOUR ARCHETYPE — THE FOUR ZONES');
    expect(prompt).not.toContain('[cautious register]');
  });

  it('unknown archetype + both flags on → no block (ADOPT #4 voice/gate consistency holds)', () => {
    fitCheck.on = true;
    const prompt = promptFor('strategist');
    expect(prompt).not.toContain('YOUR ARCHETYPE — THE FOUR ZONES');
    expect(prompt).not.toContain('More cautious, in character:');
  });
});

// ==================== B-1 — the prompt golden ====================

// The phase rules are the LAST block (BOTTOM — highest attention).
const phaseRulesOf = (prompt) => {
  const start = prompt.lastIndexOf('YOUR CURRENT PHASE: ');
  expect(start, 'phase rules missing from the prompt').toBeGreaterThan(-1);
  return prompt.slice(start);
};

const PHASES = [['discovery', 1], ['refinement', 12], ['mastery', 40]];

// The sentence the shipped confirmation rule offers as the model's
// acknowledgement — the one the Sep 14 reply reproduced almost verbatim.
const SHIPPED_ACK = 'Got it; that\'s my lean now.';

describe('B-1 — the confirmation rule: flag-OFF is the pre-build bytes', () => {
  it.each(PHASES)('%s: the phase-rule block is byte-identical to the pre-build capture', (phase, gamesPlayed) => {
    fitCheck.on = false;
    expect(phaseRulesOf(promptFor('degen', gamesPlayed))).toBe(PRE_BUILD.phaseRules[phase]);
  });
});

describe('B-1 — the confirmation rule: flag-ON quotes the filing', () => {
  it.each(PHASES)('%s carries the quote instruction and drops the shipped acknowledgement', (_phase, gamesPlayed) => {
    fitCheck.on = true;
    const rules = phaseRulesOf(promptFor('degen', gamesPlayed));
    expect(rules).toContain('"Got it — filing: {the exact canonical text of the id you selected}.").');
    expect(rules).toContain('Say the canonical text word for word;');
    expect(rules).toContain('the card beneath you states what was filed.');
    expect(rules).toContain('Do not describe the lean in other words.');
    expect(rules).not.toContain(SHIPPED_ACK);
  });

  it.each(PHASES)('%s moves ONLY the acknowledgement — the rest of the rule is untouched', (_phase, gamesPlayed) => {
    fitCheck.on = true;
    const rules = phaseRulesOf(promptFor('degen', gamesPlayed));
    // The clauses the build brief puts OUT of scope must survive verbatim.
    expect(rules).toContain('If you\'re unsure whether they confirmed: they confirmed. Err toward committing the lean, not more questions.');
    expect(rules).toContain('EXCEPTION — honest pushback');
    expect(rules).toContain('they click a suggested action button');
    expect(rules).toContain('"Noted — carrying that into my next read."');
    expect(rules).toContain('Do NOT say "On it / Done / Locked in"');
    // And the replacement is surgical: exactly the anchor's length of text
    // changed, nothing else in the block.
    fitCheck.on = false;
    const off = phaseRulesOf(promptFor('degen', gamesPlayed));
    expect(off.replace(SHIPPED_ACK_ANCHOR_TEXT, FIT_CHECK_ACK_TEXT)).toBe(rules);
  });

  it('the shipped anchor still exists verbatim in all three rules — a silent no-op is the worst failure', () => {
    // The flag-ON render is a string replacement over the shipped rule. If the
    // anchor ever drifts, the replacement would quietly no-op and the gate
    // (commit C) would then null-write every filing. This row is what makes
    // that drift loud rather than silent.
    fitCheck.on = false;
    for (const [, gamesPlayed] of PHASES) {
      expect(phaseRulesOf(promptFor('degen', gamesPlayed))).toContain(SHIPPED_ACK_ANCHOR_TEXT);
    }
  });

  it('MUTATION CHECK — the flag-ON phase rules are NOT the flag-OFF phase rules', () => {
    for (const [, gamesPlayed] of PHASES) {
      fitCheck.on = false;
      const off = phaseRulesOf(promptFor('degen', gamesPlayed));
      fitCheck.on = true;
      const on = phaseRulesOf(promptFor('degen', gamesPlayed));
      expect(on).not.toBe(off);
    }
  });

  // ── DOCUMENTED LIMIT — the flip-order hazard, asserted so it cannot be
  // forgotten (build report §6 D-3). This row PINS a limitation, not a
  // behaviour we want: it must be deleted, not "fixed", by whichever walk
  // resolves the hazard.
  it('LIMIT: the GROUNDED prompt is deliberately NOT transformed — do not light this flag with VOICE_GROUNDING_MODE', () => {
    // The gate runs on every battle chat turn regardless of `grounded`, but
    // the acknowledgement transform lands only on the SHIPPED assembly. The
    // grounded confirmation rule says the opposite ("Acknowledge in one
    // sentence ... Do not describe what you will do with it."), so with both
    // flags lit the gate would demand a quote the sent prompt never asked for
    // and EVERY typed-path filing would become fit_mismatch.
    //
    // Safe today: VOICE_GROUNDING_MODE is 'shadow', so `grounded` is false for
    // every caller and the transformed prompt is what is sent.
    fitCheck.on = true;
    const groundedPrompt = buildVoiceLayerPrompt({
      agent: { name: 'Gemma', archetype: 'degen', stats: { gamesPlayed: 1, wins: 0, losses: 0 } },
      battle: BATTLE,
      elicitationTarget: ELICIT,
      conversationHistory: [],
      anchorContext: null,
      marketSnapshot: null,
      mode: 'battle',
      grounded: true,
    });
    expect(groundedPrompt).not.toContain('Say the canonical text word for word;');
    expect(groundedPrompt).not.toContain('Got it — filing: {the exact canonical text of the id you selected}.');
    // And the grounded rule that contradicts it is present, verbatim.
    expect(groundedPrompt).toContain('The interface states what was filed. Do not describe what you will do with it.');
  });

  it('the first-message prompt is deliberately NOT transformed (its path never reaches the gate)', () => {
    // buildFirstMessagePrompt pins hasDirective false and directive null, so
    // there is no confirmation to acknowledge and no filing to quote. Both
    // flag states keep today's text there — stated so a reader does not read
    // the omission as a miss.
    fitCheck.on = true;
    const first = buildFirstMessagePrompt({
      agent: { name: 'Gemma', archetype: 'degen', stats: { gamesPlayed: 1, wins: 0, losses: 0 } },
      battle: BATTLE,
      anchorContext: null,
      marketSnapshot: null,
    });
    expect(first).toContain(SHIPPED_ACK);
    expect(first).not.toContain('Say the canonical text word for word;');
  });
});

// ============ THE WHOLE-PROMPT FLAG-OFF GOLDEN (review finding B2) ============
//
// The two slice goldens above cover the archetype block and the phase rules —
// together about 41% of one battle prompt, and none of the other modes or the
// grounded variant. That is narrower than this file's own header claims, and a
// mutation anywhere else in the assembly (the proposal block, the user-levers
// block, TWO_LEG_SIGNAL_RULE, any review/workshop block) would have left them
// green.
//
// So: a sha256 of the ENTIRE assembled prompt for every
// (mode × grounded × archetype × phase) the build could possibly reach, plus
// buildFirstMessagePrompt — 147 hashes, all captured from the TRUE PRE-BUILD
// module (`git show origin/main:api/_utils/voiceLayerPrompt.js`, rendered under
// this same market-state mock and then deleted). Not regenerated from the code
// they guard.
//
// `strategist` is in the archetype list on purpose: it is unknown, so the
// integrity block is null and the whole apparatus must stay absent.

import { createHash } from 'node:crypto';

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const WORKSHOP_CTX = { previousThesis: null, sessionTurnCount: 0, messagesRemaining: 24, messageBudget: 25, seedContext: null };
const HASH_GOLDEN = PRE_BUILD.preBuildWholePromptSha256;

const wholePromptCases = () => {
  const rows = [];
  for (const archetype of [...ARCHETYPES, 'strategist']) {
    for (const gamesPlayed of [1, 12, 40]) {
      const agent = { name: 'Gemma', archetype, stats: { gamesPlayed, wins: 0, losses: 0 } };
      for (const grounded of [false, true]) {
        for (const mode of ['battle', 'review', 'workshop']) {
          const args = {
            agent, battle: BATTLE, elicitationTarget: ELICIT, conversationHistory: [],
            anchorContext: null, marketSnapshot: null, mode, grounded,
          };
          if (mode === 'review') { args.dailyReviews = []; args.dailyGrades = []; args.elicitationTarget = null; }
          if (mode === 'workshop') { args.workshopContext = WORKSHOP_CTX; }
          rows.push([`${mode}|grounded=${grounded}|${archetype}|g${gamesPlayed}`, () => buildVoiceLayerPrompt(args)]);
        }
      }
      rows.push([`firstMessage|${archetype}|g${gamesPlayed}`, () => buildFirstMessagePrompt({
        agent, battle: BATTLE, anchorContext: null, marketSnapshot: null,
      })]);
    }
  }
  return rows;
};

describe('B2 — whole-prompt flag-OFF golden: 147 pre-build hashes', () => {
  it('the fixture covers every case this suite renders, and nothing is silently skipped', () => {
    const keys = wholePromptCases().map(([k]) => k).sort();
    expect(keys).toHaveLength(147);
    expect(Object.keys(HASH_GOLDEN).sort()).toEqual(keys);
  });

  it.each(wholePromptCases())('%s is byte-identical to the pre-build module', (key, render) => {
    fitCheck.on = false;
    expect(sha(render())).toBe(HASH_GOLDEN[key]);
  });

  it('MUTATION CHECK — the flag moves exactly the 39 prompts it should, and no others', () => {
    // This row was WRONG on first write (it expected 18) and the failure taught
    // the real shape, which is worth pinning precisely because it is the
    // flip-order hazard in one assertion:
    //
    //   - the ACKNOWLEDGEMENT transform rides PHASE_RULES, so it reaches every
    //     UNGROUNDED battle prompt — including `strategist`, where no menu
    //     renders at all (7 archetypes x 3 phases = 21);
    //   - the MENU annotations ride buildArchetypeIntegrityBlock, which is
    //     pushed on BOTH the grounded and ungrounded branches, so they reach
    //     the GROUNDED battle prompt too (6 known archetypes x 3 phases = 18).
    //
    // That second bullet is the hazard: under grounding the model would be
    // shown the annotated menu while its confirmation rule still says "Do not
    // describe what you will do with it" — the menu half arrives, the quote
    // half does not, and the gate demands the quote anyway. If anyone ever
    // makes the grounded prompt carry the acknowledgement too, THIS row is
    // what tells them the hazard is closed.
    fitCheck.on = true;
    const moved = [];
    for (const [key, render] of wholePromptCases()) {
      if (sha(render()) !== HASH_GOLDEN[key]) moved.push(key);
    }
    const ackReaches = wholePromptCases().map(([k]) => k)
      .filter((k) => k.startsWith('battle|grounded=false|'));
    const menuOnlyReaches = wholePromptCases().map(([k]) => k)
      .filter((k) => k.startsWith('battle|grounded=true|') && !k.includes('|strategist|'));
    expect(ackReaches).toHaveLength(21);
    expect(menuOnlyReaches).toHaveLength(18);
    expect(moved.sort()).toEqual([...ackReaches, ...menuOnlyReaches].sort());
    // Nothing outside battle mode moves, at either grounding: review, workshop
    // and the first-message prompt are out of the transform's scope by design.
    expect(moved.filter((k) => !k.startsWith('battle|'))).toEqual([]);
    // And an unknown archetype under grounding stays byte-identical: no menu,
    // no acknowledgement, nothing.
    expect(moved).not.toContain('battle|grounded=true|strategist|g1');
  });
});
