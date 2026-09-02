// api/_utils/__fixtures__/ask2PromptFixtures.js
// Exit-Behavior Rebalance Tier 2, Ask 2 (rescoped) — the ONE builder the
// golden-capture script and the ask2 prompt suite share for the institutional
// trailer (review B-F3: the flag-off C_INST text was pinned by a two-line
// substring only, so a one-byte drift in its flag-off branch went uncaught;
// the trailer is now golden-pinned byte-exact from the pre-edit tree).

import { makeBattle } from './ask1PromptFixtures.js';

/** The Ask 1 fixture battle plus one equipped institutional rule, so the
 *  C_INST data-lag block (the 13th MUST) renders. */
export function makeInstitutionalBattle(gameMode) {
  const battle = makeBattle(gameMode);
  battle.agentContext.activeRules = [
    ...battle.agentContext.activeRules,
    { ruleId: 'inst-01', text: 'Prefer stocks with net institutional accumulation.', category: 'institutional', hardness: 'soft' },
  ];
  return battle;
}
