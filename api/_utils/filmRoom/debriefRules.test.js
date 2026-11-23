// api/_utils/filmRoom/debriefRules.test.js
//
// Film Room D2 item 6 — the DEFAULT-SUITE tripwire for the `debriefs` rules block (the rulesIndex.test.js precedent):
// the emulator suite (test/rules/filmRoomDebriefs.rules.mjs, `npm run test:rules`) proves the block's behavior; this
// row pins its source text in every ordinary run, so it cannot drift without the default suite going red. Deploying
// it is a founder action after merge (D2 spec §6).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// The emulator suites' shared parser (no emulator is touched on import).
import { ruleBlocks } from '../../../test/rules/callRecordsRulesSuite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(HERE, '../../..', 'firestore.rules'), 'utf8');

describe('firestore.rules — the agent\'s words (source tripwire; behavior proven in test/rules)', () => {
  it('debriefs/{etDate}: ONE block — owner read by the record\'s OWN ownerId, no client write', () => {
    expect(ruleBlocks(RULES, /\/debriefs\/\{etDate\}/)).toEqual([[
      'allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;',
      'allow write: if false;',
    ]]);
  });
  it('it sits INSIDE agentBattles/{battleId}, beside the tape — and the word names no other rule line', () => {
    const [battleBlock] = ruleBlocks(RULES, /\/agentBattles\/\{battleId\}/);
    expect(battleBlock.join('\n')).toContain('match /debriefs/{etDate} {');
    const lines = RULES.split(/\r?\n/).filter((l) => /\bdebriefs\b/.test(l) && !l.trim().startsWith('//'));
    expect(lines).toHaveLength(1);
  });
});
