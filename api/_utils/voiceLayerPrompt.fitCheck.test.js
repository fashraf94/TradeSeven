// api/_utils/voiceLayerPrompt.fitCheck.test.js
//
// THE DIRECTIVE FIT CHECK — the PROMPT halves.
//
// A-1: each menu line carries its policy annotations, so the model can see the
//      dial it is choosing on instead of seven bare strings (Phase 0 Q3).
//
// THE FLAG-OFF INVARIANT IS THE POINT OF THIS FILE. The goldens in
// __fixtures__/voiceLayerPrompt.fitCheck.preBuild.golden.json were captured by
// rendering this module at the commit BEFORE commit A landed — they are not
// regenerated from the post-change code. A golden regenerated from the code it
// guards proves nothing.
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

import { buildVoiceLayerPrompt } from './voiceLayerPrompt.js';

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
