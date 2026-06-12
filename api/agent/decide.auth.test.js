// api/agent/decide.auth.test.js
//
// P4 contract #3 — deploy-auth matrix (Spec §0.3, founder-approved Fence-Edit
// Map §5A). Pure-function coverage for the caller classifier + the
// internal-only field gate, plus static source guards (the house
// agent-evaluate.test.js pattern) locking the handler wiring: rate-limit
// exemption for internal callers, token-before-read for clients, the
// ownership assertion on BOTH caller classes, and the tournament dispatch
// sitting behind auth.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { isInternalDeployCaller, TOURNAMENT_ONLY_FIELDS } from './decide.js';

const SOURCE = readFileSync(new URL('./decide.js', import.meta.url), 'utf8');

describe('isInternalDeployCaller — the CRON_SECRET classifier', () => {
  it('matches exactly Bearer <secret>', () => {
    expect(isInternalDeployCaller({ authorization: 'Bearer s3cret' }, 's3cret')).toBe(true);
  });

  it('rejects wrong, malformed, and absent credentials', () => {
    expect(isInternalDeployCaller({ authorization: 'Bearer wrong' }, 's3cret')).toBe(false);
    expect(isInternalDeployCaller({ authorization: 's3cret' }, 's3cret')).toBe(false);
    expect(isInternalDeployCaller({}, 's3cret')).toBe(false);
    expect(isInternalDeployCaller(undefined, 's3cret')).toBe(false);
  });

  it('an unset CRON_SECRET can never classify anyone as internal (no "Bearer undefined" hole)', () => {
    expect(isInternalDeployCaller({ authorization: 'Bearer undefined' }, undefined)).toBe(false);
    expect(isInternalDeployCaller({ authorization: 'Bearer ' }, '')).toBe(false);
  });
});

describe('TOURNAMENT_ONLY_FIELDS — the internal-only intake', () => {
  it('covers the full P3b payload plus the rider-#6 fields', () => {
    expect([...TOURNAMENT_ONLY_FIELDS].sort()).toEqual([
      'doubleDownSymbols',
      'gameMode',
      'groupId',
      'isCpu',
      'ownerOdUserId',
      'prescribedPortfolio',
      'userPicks',
      'userPicksStance',
    ]);
    expect(Object.isFrozen(TOURNAMENT_ONLY_FIELDS)).toBe(true);
  });
});

describe('handler wiring — static source guards', () => {
  it('internal callers are rate-limit exempt; client callers keep the 3/min limit', () => {
    expect(SOURCE).toMatch(/applySecurityMiddleware\(req, res, \{ rateLimit: \{ limit: 3, windowMs: 60000 \}, skipRateLimit: isInternalCaller \}\)/);
  });

  it('client callers are token-verified BEFORE the agent read, and tournament fields are refused before that', () => {
    const fieldGate = SOURCE.indexOf('TOURNAMENT_ONLY_FIELDS.filter((f) => req.body[f] !== undefined)');
    const tokenCheck = SOURCE.indexOf('clientUser = await requireAuth(req, res);');
    const agentRead = SOURCE.indexOf('const agentDoc = await agentRef.get();');
    expect(fieldGate).toBeGreaterThan(-1);
    expect(tokenCheck).toBeGreaterThan(fieldGate);
    expect(agentRead).toBeGreaterThan(tokenCheck);
  });

  it('the ownership assertion exists on BOTH caller classes', () => {
    expect(SOURCE).toContain("if (agent.ownerId !== ownerOdUserId) {");
    expect(SOURCE).toContain("} else if (agent.ownerId !== clientUser.uid) {");
    expect(SOURCE).toContain("'ownerOdUserId required for internal deploys'");
  });

  it('the prescribed tournament dispatch sits AFTER the ownership assertion and BEFORE the Sonnet call', () => {
    const ownership = SOURCE.indexOf('agent.ownerId does not match ownerOdUserId');
    const dispatch = SOURCE.indexOf('if (req.body.gameMode === FLAT6_GAME_MODE) {');
    const sonnet = SOURCE.indexOf('// 6. SONNET CALL');
    expect(ownership).toBeGreaterThan(-1);
    expect(dispatch).toBeGreaterThan(ownership);
    expect(sonnet).toBeGreaterThan(dispatch);
  });

  it('the legacy client deploy attaches the Firebase token (companion d)', () => {
    const client = readFileSync(new URL('../../src/services/agentDeploy.js', import.meta.url), 'utf8');
    expect(client).toContain("Authorization: `Bearer ${token}`");
    expect(client).toContain("import { getIdToken } from '../firebase/authService';");
  });
});
