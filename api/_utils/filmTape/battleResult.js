// api/_utils/filmTape/battleResult.js
//
// BA-4: a completed battle's result, "with the same comparison completion uses"
// — IMPORTED from the evaluator, never re-stated here (BUILD_RULES §4: no local
// copy of scoring or outcome arithmetic). resolveCompletionDisposition is pure
// and exported (api/cron/agent-evaluate.js:5985); it reads the same
// scoreState.currentScore / opponentScore completion compared.

import { resolveCompletionDisposition } from '../../cron/agent-evaluate.js';

/** 'win' | 'loss' | 'draw' for a tiered battle; null where completion names none (tournament). */
export function resolveBattleResult(battle) {
  const result = resolveCompletionDisposition(battle)?.result;
  return result === 'win' || result === 'loss' || result === 'draw' ? result : null;
}
