// api/_utils/agentEvalPromptAssembly.ask2.test.js
// Exit-Behavior Rebalance Tier 2, Ask 2 (rescoped) — the absolutist MUSTs
// qualified, behind EQUIPPED_RULE_PRECEDENCE_ENABLED.
//
// Two contracts, one flag:
//
//   FLAG OFF (merge state): every touched builder is BYTE-IDENTICAL to the
//   pre-Ask-2 output — proven against goldens captured from the untouched
//   tree at branch base de4113fd under the LIVE flags of that tree
//   (ask2PromptGoldens.json: both system-prompt variants × the six archetype
//   keys, plus the forge-rules trailer on the shared Ask 1 fixture).
//
//   FLAG ON: the framework defaults the founder ruled qualifiable carry the
//   "absent an equipped user rule" qualifier (one wording, both variants);
//   the platform floors ruled absolute (LOCKED, ANTI-THRASH, SURVIVAL,
//   distressed) are untouched; two more stay absolute on the same principle
//   (qualifying them would promise what the engine refuses): the THRESHOLD
//   PROXIMITY bonus bullet, whose band IS the risk manager's deterministic
//   LOCK band (agentRiskManager.js LOCK_PROXIMITY), and §8 CONVICTION, whose
//   70 is the fenced swap validator's floor (agentSwapExecution.js:77 —
//   /code-review CR-2). The `selective` and mid-battle `>80%` lines ARE
//   qualified: 80 is prompt-only, so a user rule lowers the bar to the
//   engine's 70, never below it.
//
// RED-FIRST: this suite was written before the edit and watched fail against
// the untouched prose. Flag walked via the live-getter mock (importOriginal
// spread — the safe pattern; the assembly reads the flag at CALL TIME, never
// module scope: the Ask 3 compileBuild lesson).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { flagState } = vi.hoisted(() => ({ flagState: { precedence: false } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get EQUIPPED_RULE_PRECEDENCE_ENABLED() { return flagState.precedence; },
}));

// NOTE (BUILD_RULES §4 dependency-surface guard): this UNMOCKED import of the
// fenced assembly is the runtime guard for its api → src imports — it
// explodes in the Node test env if a browser dep ever enters that graph.
// Never mock it.
import { buildEvalSystemPrompt, buildAgentIdentityBlock } from './agentEvalPromptAssembly.js';
import { makeBattle, TIERED_GAME_MODE, FLAT6_GAME_MODE } from './__fixtures__/ask1PromptFixtures.js';
import { FORBIDDEN_SIGNALS } from './__fixtures__/promptHonestyRegistry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDENS = JSON.parse(readFileSync(join(HERE, '__fixtures__/ask2PromptGoldens.json'), 'utf8'));
const KEYS = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];
const displayLabel = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

afterEach(() => { flagState.precedence = false; });

const tiered = (key) => buildEvalSystemPrompt('TestAgent', displayLabel(key), TIERED_GAME_MODE, key);
const flat6 = (key) => buildEvalSystemPrompt('TestAgent', displayLabel(key), FLAT6_GAME_MODE, key);
const bothVariants = (key) => [tiered(key), flat6(key)];

/** The Ask 1 fixture battle plus one equipped institutional rule, so the
 *  C_INST data-lag block (the 13th MUST) renders. */
function institutionalBattle() {
  const battle = makeBattle(FLAT6_GAME_MODE);
  battle.agentContext.activeRules = [
    ...battle.agentContext.activeRules,
    { ruleId: 'inst-01', text: 'Prefer stocks with net institutional accumulation.', category: 'institutional', hardness: 'soft' },
  ];
  return battle;
}

// ==================== The ruled flag-on prose (one wording, both variants) ====================

const QUALIFIER = /absent an equipped user rule/gi;

const ON_DEFAULT_TO_HOLD = `1. DEFAULT TO HOLD. Absent an equipped user rule that calls for the trade,
   you need a compelling, data-backed reason to trade. Most evaluations
   should result in HOLD. Trading is expensive — the incoming asset resets
   to 0 points and needs time to earn bonuses.`;

const ON_RELATIVE_STRENGTH = `3. RELATIVE STRENGTH: Compare asset performance to the MACRO BENCHMARKS.
   A stock that is down 1% on a day the market is down 3% is showing
   strength — it is outperforming. Absent an equipped user rule that calls
   for the exit, do not panic-sell outperformers.
   A stock that is flat on a day the market is up 2% is showing weakness.`;

const ON_CLOCK = `4. CLOCK MANAGEMENT: New assets start at 0 points and need TIME to reach
   threshold bonuses. Calculate whether enough trading time remains for
   a new asset to realistically earn points.
   - Early battle (>60% time remaining): Swaps have full runway. Offense OK.
   - Mid battle (30-60% remaining): Absent an equipped user rule that calls
     for the swap, only swap on strong conviction (>80%).
   - Late battle (<30% remaining): Absent an equipped user rule that calls
     for the swap, swaps are DEFENSIVE ONLY — cut a position approaching
     Bust/Crash to protect banked points. Do NOT chase momentum late on
     your own initiative.`;

const ON_SECTOR = `7. SECTOR AWARENESS: Absent an equipped user rule that calls for it, do not
   swap a bleeding stock for a bench stock in the same sector — if the
   sector is weak, the replacement will bleed too. Rotate into a different
   sector for diversification.`;

const ON_NR7 = `- NR7 (Narrowest Range 7 Days): When flagged, the stock's daily range is the
  tightest in 7 days. This is a volatility contraction pattern — often precedes
  a sharp directional move. Absent an equipped user rule that calls for the
  exit, do NOT swap out NR7 stocks unless they're bleeding.`;

const ON_SELECTIVE = '- selective: Moderate caution. Absent an equipped user rule that calls for the swap, only swap on >80% conviction. Prefer relative strength.';

const ON_INSTITUTIONAL = `C_INST: INSTITUTIONAL DATA LAG — Institutional accumulation/distribution data from 13F
filings is lagged up to 135 days. Absent an equipped user rule that says otherwise,
never hold a position based solely on strong institutional accumulation if VWAP (held
positions) or RSI-14 shows a breakdown; live technicals override stale institutional
signals by default. Use institutional data for draft-time universe filtering, not
intraday swap decisions.`;

const QUALIFIED_SYSTEM_SECTIONS = [
  ['DEFAULT TO HOLD', ON_DEFAULT_TO_HOLD],
  ['RELATIVE STRENGTH', ON_RELATIVE_STRENGTH],
  ['CLOCK MANAGEMENT (mid >80% + late DEFENSIVE ONLY)', ON_CLOCK],
  ['SECTOR AWARENESS', ON_SECTOR],
  ['NR7', ON_NR7],
  ['MARKET POSTURE selective', ON_SELECTIVE],
];

// The pre-edit sentences the qualifier replaces — must be GONE flag-on.
const OFF_SENTENCES = [
  'DEFAULT TO HOLD. You need a compelling',
  'it is outperforming. Do not panic-sell outperformers.',
  'Mid battle (30-60% remaining): Only swap on strong conviction (>80%).',
  'Late battle (<30% remaining): Swaps are DEFENSIVE ONLY',
  '7. SECTOR AWARENESS: Do not swap a bleeding stock',
  'a sharp directional move. Do NOT swap out NR7 stocks',
  '- selective: Moderate caution. Only swap on >80% conviction.',
];

// The platform floors the founder ruled ABSOLUTE — byte-identical flag-on.
const ABSOLUTES = [
  ['LOCKED', '- LOCKED positions CANNOT be swapped out. Only hard stops override locks.'],
  ['ANTI-THRASH', `━━━ ANTI-THRASH RULES (MANDATORY) ━━━

- COOLDOWN: You CANNOT swap in a stock that is marked "locked until [time]"
  in the BENCH table. It is OFF LIMITS regardless of how attractive it looks.
- ONE SWAP MAXIMUM per evaluation. Never suggest multiple swaps.
- NO ROUND-TRIPS: If you swapped A→B recently, do not swap B→A just
  because A recovered. Trust your original thesis or wait for the
  cooldown to expire.`],
  ['distressed', `- distressed: High volatility + downtrend. STRICT EXCLUSION. Do NOT buy distressed
  stocks. If held, evaluate for swap-out immediately.`],
  ['SURVIVAL MODE machinery', 'You have explicit permission to OVERRIDE user directives if live data shows a position has breached -1.0x ATR (Bust) or is accelerating toward it with no sign of reversal. If you override a directive, you MUST set ignoredDirectiveIds'],
  ['CONVICTION THRESHOLD (the engine\'s 70 floor, agentSwapExecution.js:77 — stays absolute)', `8. CONVICTION THRESHOLD: If your conviction for a SWAP is below 70%, you
   MUST output decision "HOLD". Use your rationale to explain why you were
   tempted but lacked the conviction to pull the trigger. Marginal edges
   are not worth the cost of resetting a scoring baseline.`],
  ['THRESHOLD PROXIMITY bonus bullet (the deterministic LOCK band — stays absolute)', `6. THRESHOLD PROXIMITY:
   - If an active stock is within 0.2x ATR of a bonus (+15/+30/+50), HOLD.
     Let it earn the bonus.
   - If an active stock is within 0.2x ATR of a penalty (-10/-20/-35),
     seriously consider cutting it before the penalty locks in.`],
  ['MARKET POSTURE defensive (ruled out of scope)', '- defensive: Capital preservation. Swaps are defensive only (cut losers). Do not chase.'],
  ['FORGE RULES must-obey (ruled out of scope)', '- CONSTRAINTS (C1, C2, ...) are HARD rules — you must obey them unless Survival Mode activates.'],
  ['S5 exit rule (ruled out of scope)', 'RSI-14 > 80 and turns down'],
];

// ==================== FLAG OFF — the dark contract ====================

describe('Ask 2 — FLAG OFF: byte-identical to the pre-Ask-2 prompt (goldens @ de4113fd, live flags)', () => {
  it.each(KEYS)('%s: both system-prompt variants are byte-identical', (key) => {
    expect(tiered(key)).toBe(GOLDENS.systemTiered[key]);
    expect(flat6(key)).toBe(GOLDENS.systemFlat6[key]);
  });

  it('the forge-rules trailer (identity block) is byte-identical', () => {
    expect(buildAgentIdentityBlock(makeBattle(FLAT6_GAME_MODE))).toBe(GOLDENS.agentIdentityBlock);
  });

  it('the C_INST data-lag block renders its pre-edit text', () => {
    expect(buildAgentIdentityBlock(institutionalBattle())).toContain(
      'filings is lagged up to 135 days. NEVER hold a position based solely on strong\ninstitutional accumulation',
    );
  });

  it('call-time resolution: flipping on then off returns the golden bytes (no module-scope snapshot)', () => {
    flagState.precedence = true;
    expect(tiered('degen')).not.toBe(GOLDENS.systemTiered.degen);
    flagState.precedence = false;
    expect(tiered('degen')).toBe(GOLDENS.systemTiered.degen);
  });
});

// ==================== FLAG ON — the qualified framework (red-first) ====================

describe('Ask 2 — FLAG ON: the ruled MUSTs carry the qualifier, one wording in both variants', () => {
  it.each(QUALIFIED_SYSTEM_SECTIONS)('%s renders the ruled flag-on prose exactly once in BOTH variants', (label, expected) => {
    flagState.precedence = true;
    for (const key of KEYS) {
      for (const text of bothVariants(key)) {
        expect(text).toContain(expected);
        expect(text.split(expected)).toHaveLength(2);
      }
    }
  });

  it('every pre-edit absolutist sentence is GONE from both variants', () => {
    flagState.precedence = true;
    for (const text of bothVariants('analyst')) {
      for (const sentence of OFF_SENTENCES) expect(text).not.toContain(sentence);
    }
  });

  it('exactly seven qualifiers per system prompt — no MUST silently gained or lost one', () => {
    flagState.precedence = true;
    for (const key of KEYS) {
      for (const text of bothVariants(key)) {
        expect(text.match(QUALIFIER)?.length ?? 0).toBe(7);
      }
    }
  });

  it('the qualifier yields to an EQUIPPED USER RULE only — never to model discretion', () => {
    flagState.precedence = true;
    for (const text of bothVariants('guardian')) {
      expect(text).not.toMatch(/when you feel|at your discretion|if you prefer/i);
      // The late-battle momentum line names the model's own initiative as the
      // thing still forbidden — the user's rule remains the only override.
      expect(text).toContain('Do NOT chase momentum late on\n     your own initiative.');
    }
  });

  it('the C_INST data-lag block yields to an equipped user rule; the 135-day lag fact survives', () => {
    flagState.precedence = true;
    const trailer = buildAgentIdentityBlock(institutionalBattle());
    expect(trailer).toContain(ON_INSTITUTIONAL);
    expect(trailer).not.toContain('NEVER hold a position based solely');
    expect(trailer).not.toContain('ALWAYS override');
    expect(trailer.match(QUALIFIER)?.length ?? 0).toBe(1);
  });

  it('the trailer without institutional rules carries no qualifier and keeps the SX-04 enforcement-true render', () => {
    flagState.precedence = true;
    const trailer = buildAgentIdentityBlock(makeBattle(FLAT6_GAME_MODE));
    expect(trailer.match(QUALIFIER)).toBeNull();
    expect(trailer).toContain("the user's target is 15%");
  });
});

describe('Ask 2 — FLAG ON: the platform floors stay absolute (founder decision 4 + the LOCK-band correction)', () => {
  it.each(ABSOLUTES)('%s is byte-identical flag-on in both variants', (label, verbatim) => {
    flagState.precedence = true;
    for (const key of KEYS) {
      for (const text of bothVariants(key)) expect(text).toContain(verbatim);
    }
  });

  it('the EV section is untouched (Ask 1 live prose; the revert branch is not this build\'s surface)', () => {
    flagState.precedence = true;
    for (const text of bothVariants('contrarian')) {
      expect(text).toContain('An exit needs a reason — a rule, a target, a thesis change');
      expect(text).not.toMatch(/Do NOT sell/);
    }
  });

  it('the Ask 1 precedence block still renders at both system-prompt sites and the trailer', () => {
    flagState.precedence = true;
    for (const text of bothVariants('degen')) expect(text).toContain('DECISION PRECEDENCE (highest to lowest):');
    expect(buildAgentIdentityBlock(makeBattle(FLAT6_GAME_MODE))).toContain('DECISION PRECEDENCE (highest to lowest):');
  });
});

// ==================== BOTH STATES — doctrine + honesty ====================

describe('Ask 2 — both flag states: R5 doctrine and C-20 honesty hold', () => {
  it('no prompt text references swapMotive', () => {
    for (const on of [false, true]) {
      flagState.precedence = on;
      for (const text of [...bothVariants('degen'), buildAgentIdentityBlock(institutionalBattle())]) {
        expect(text).not.toMatch(/swapMotive/);
      }
    }
  });

  it('flag ON: no forbidden signal name enters either variant (the C-20 sweep runs dark; this is the lit-state arm)', () => {
    flagState.precedence = true;
    for (const key of KEYS) {
      for (const text of bothVariants(key)) {
        for (const [label, re] of FORBIDDEN_SIGNALS) {
          expect(re.test(text), `${label} leaked into the flag-on ${key} prompt`).toBe(false);
        }
      }
    }
  });
});
