// src/components/CommandCenter/hub/selectors/attemptVocabulary.test.js
//
// Command Center hub, slice S2a — the one vocabulary (spec V1.2 §5.2,
// correction C3): the constants, the service-result translation row for row
// (every typed outcome and every shape src/services/agentDeploy.js returns
// today, ruling R-S2A-2), and the record → display translation.

import { describe, expect, it } from 'vitest';
import { DUE_DEPLOY_LINE } from '../../../../constants/hypothesisRecords';
import { LEGACY_RESULTS, REAL_ID, TYPED_RESULTS } from '../../__fixtures__/attemptFixtures';
import {
  ATTEMPT_ACTIONS, ATTEMPT_DISPLAY, ATTEMPT_PHASES, CEREMONY_PHASES, ERROR_TONES, HOLD_PHASES, RECONCILIATION,
  RESOLUTION_KINDS, SERVICE_OUTCOMES, displayForAttempt, realId, translateServiceResult,
} from './attemptVocabulary';

describe('the typed constants (spec §5.2)', () => {
  it('the stored phases, the service outcomes, the reconciliation statuses and the hold phases are the spec\'s, exactly', () => {
    expect(Object.values(ATTEMPT_PHASES)).toEqual(['idle', 'submitting', 'created', 'existing', 'refused', 'uncertain', 'orphaned']);
    expect(Object.values(SERVICE_OUTCOMES)).toEqual(['created', 'existing_battle', 'refused', 'uncertain', 'handoff_failed', 'orphaned']);
    expect(Object.values(RECONCILIATION)).toEqual(['not_checked', 'pending', 'clear', 'found', 'error']);
    expect(Object.values(HOLD_PHASES)).toEqual(['idle', 'charging', 'locked']);
  });

  it('the ceremony phases are the shipped machine\'s four, R1\'s existing terminal and closed; the tones are the shipped two', () => {
    expect(Object.values(CEREMONY_PHASES)).toEqual(['theater', 'verifying', 'reveal', 'existing', 'error', 'closed']);
    expect(Object.values(ERROR_TONES)).toEqual(['confirmed', 'lost_contact']);
  });

  it('confirmed, finishing, verifying and failed are display words only, never stored phases', () => {
    for (const word of ['confirmed', 'finishing', 'verifying', 'failed']) {
      expect(Object.values(ATTEMPT_DISPLAY)).toContain(word);
      expect(Object.values(ATTEMPT_PHASES)).not.toContain(word);
    }
    // existing and uncertain are both, as §5.2 uses them.
    expect(Object.values(ATTEMPT_PHASES)).toEqual(expect.arrayContaining(['existing', 'uncertain']));
    expect(Object.values(ATTEMPT_DISPLAY)).toEqual(expect.arrayContaining(['existing', 'uncertain']));
  });

  it('every constant table is frozen', () => {
    for (const table of [ATTEMPT_PHASES, SERVICE_OUTCOMES, RECONCILIATION, HOLD_PHASES, CEREMONY_PHASES, ERROR_TONES, RESOLUTION_KINDS, ATTEMPT_DISPLAY, ATTEMPT_ACTIONS]) {
      expect(Object.isFrozen(table)).toBe(true);
    }
  });
});

describe('realId — a real server id is a nonempty string with no surrounding space', () => {
  it.each([[REAL_ID, REAL_ID], ['', null], [' ', null], [' bt ', null], [null, null], [undefined, null], [42, null], [{}, null]])('%j → %j', (id, want) => {
    expect(realId(id)).toBe(want);
  });
});

const translationOf = (result) => translateServiceResult(result);

describe('today\'s results (src/services/agentDeploy.js), ruling R-S2A-2: untyped fails closed, but the 409 review-due refusal', () => {
  it.each(Object.entries(LEGACY_RESULTS))('%s', (_name, want) => {
    const t = translationOf(want.result);
    expect(t.phase).toBe(want.phase);
    expect(t.displayState).toBe(want.displayState);
    expect(t.detail.kind).toBe(want.kind);
    expect(t.detail.postIssued).toBe(want.postIssued);
    // Evidence attached, unchanged; never a creation or an existing battle, never an id.
    expect(t.detail.evidence).toBe(want.result);
    expect(t.phase).not.toBe('created');
    expect(t.phase).not.toBe('existing');
    expect(t.detail.battleId).toBeNull();
    if (want.line !== undefined) expect(t.detail.line).toBe(want.line);
  });

  it('the review-due refusal keeps its line verbatim, the P1b words, with the confirmed-refusal tone', () => {
    const t = translationOf(LEGACY_RESULTS['JSON 409 hypothesis_review_due (agentDeploy.js:172-177) — the one typed refusal today'].result);
    expect(t.detail.line).toBe(DUE_DEPLOY_LINE);
    expect(t.detail.line).toBe('This idea is due for review — reaffirm it first (one tap, same content if you want), and the fresh version deploys.');
    expect(t.ceremony).toEqual({ phase: 'error', errorTone: 'confirmed' });
  });

  it('an untyped result reads as lost contact, never as a confirmed refusal', () => {
    for (const { result, phase } of Object.values(LEGACY_RESULTS)) {
      if (phase !== 'uncertain') continue;
      expect(translationOf(result).ceremony).toEqual({ phase: 'error', errorTone: 'lost_contact' });
    }
  });

  it.each([null, undefined, 'ok', 42, true, []])('a non-object result (%j) is untyped, with no evidence to attach', (result) => {
    const t = translationOf(result);
    expect(t.phase).toBe('uncertain');
    expect(t.detail.kind).toBe('untyped');
  });

  it('every shape in the fixture is one agentDeploy.js returns today: each return names the fields the fixture uses', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.resolve(here, '../../../../services/agentDeploy.js'), 'utf8');
    for (const fragment of [
      "return { success: false, postIssued: false, error: 'no-agent' };",
      "return { success: false, postIssued: false, error: 'auth-required' };",
      "error: 'deploy_network'",
      'error: `deploy_http_${status}`',
      'error: data.error, details: refusalLine ?? data.details, errorPhase: data.errorPhase,',
      "error: 'deploy_handoff',",
      'battleId: data.agentBattleId || null,',
      'return { success: true, agentBattleId: data.agentBattleId || null };',
      'data.error === DEPLOY_REFUSAL_CODE',
    ]) expect(src, fragment).toContain(fragment);
    // No typed outcome exists in the service yet: R1 adds it.
    expect(src).not.toMatch(/\boutcome\s*:/);
  });
});

describe('the typed outcomes (spec §5.2, row for row)', () => {
  it.each(Object.entries(TYPED_RESULTS))('%s', (_name, want) => {
    const t = translationOf(want.result);
    expect(t.phase).toBe(want.phase);
    expect(t.displayState).toBe(want.displayState);
    expect(t.ceremony.phase).toBe(want.ceremony);
    if (want.tone !== undefined) expect(t.ceremony.errorTone).toBe(want.tone);
    expect(t.detail.kind).toBe(want.kind);
    if (want.battleId !== undefined) expect(t.detail.battleId).toBe(want.battleId);
    if (want.line !== undefined) expect(t.detail.line).toBe(want.line);
    if (want.postIssued !== undefined) expect(t.detail.postIssued).toBe(want.postIssued);
    expect(t.detail.evidence).toBe(want.result);
  });

  it('every outcome of the vocabulary has a valid-form row', () => {
    const valid = Object.values(TYPED_RESULTS).filter((w) => (w.kind === 'uncertain' ? w.result.outcome === 'uncertain' : w.kind !== 'untyped'));
    const covered = new Set(valid.map((w) => w.result.outcome));
    expect([...covered].sort()).toEqual([...Object.values(SERVICE_OUTCOMES)].sort());
  });

  it('handoff_failed keeps the creation fact AND the legacy failure: provider created, the real id, success:false untouched', () => {
    const r = TYPED_RESULTS['handoff_failed after a real created id: provider created, real id kept, legacy failure kept'].result;
    const t = translationOf(r);
    expect(t.phase).toBe('created');
    expect(t.detail.battleId).toBe(REAL_ID);
    expect(t.detail.evidence.success).toBe(false);
    expect(t.detail.evidence.error).toBe('deploy_handoff');
  });

  it('existing_battle translates exactly once to existing and never claims a creation', () => {
    const t = translationOf(TYPED_RESULTS['existing_battle with a valid existingBattleId'].result);
    expect(t.phase).toBe('existing');
    expect(t.ceremony.phase).not.toBe('reveal');
    expect(translationOf({ ...TYPED_RESULTS['existing_battle with a valid existingBattleId'].result }).phase).toBe('existing');
  });

  it('the translation is frozen and leaves the result untouched', () => {
    const result = { outcome: 'created', success: true, agentBattleId: REAL_ID };
    const before = JSON.stringify(result);
    const t = translationOf(result);
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.detail)).toBe(true);
    expect(Object.isFrozen(t.ceremony)).toBe(true);
    expect(JSON.stringify(result)).toBe(before);
  });
});

const record = (phase, over = {}) => ({ attemptId: 'a1', capturedUid: 'u', authEpoch: 1, attemptEpoch: 1, phase, result: null, ceremonyPhase: null, reconciliationStatus: 'not_checked', resolution: null, ...over });

describe('displayForAttempt — the record\'s display words and its one action', () => {
  it.each([
    ['submitting', {}, 'submitting', null],
    ['submitting', { ceremonyPhase: 'verifying' }, 'verifying', null],
    ['submitting', { ceremonyPhase: 'theater' }, 'submitting', null],
    ['created', { ceremonyPhase: 'theater', result: { kind: 'created', battleId: 'b' } }, 'finishing', null],
    ['created', { ceremonyPhase: 'verifying', result: { kind: 'handoff', battleId: 'b' } }, 'verifying', null],
    ['created', { ceremonyPhase: 'reveal', result: { kind: 'created', battleId: 'b' } }, 'confirmed', 'enterBattle'],
    ['created', { ceremonyPhase: 'closed', result: { kind: 'created', battleId: 'b' } }, 'confirmed', 'enterBattle'],
    ['created', { ceremonyPhase: 'error', result: { kind: 'handoff', battleId: 'b' } }, 'confirmed', 'enterBattle'],
    ['created', { ceremonyPhase: 'theater', resolution: { kind: 'recovered', battleId: 'b' } }, 'confirmed', 'enterBattle'],
    ['existing', { result: { kind: 'existing', battleId: 'b' } }, 'existing', 'openGame'],
    ['refused', { result: { kind: 'refused', line: 'x' } }, 'failed', 'retry'],
    ['refused', { result: { kind: 'review_due', line: 'x' } }, 'failed', 'openForgeReview'],
    ['uncertain', {}, 'uncertain', 'checkDeployment'],
    ['uncertain', { reconciliationStatus: 'pending' }, 'uncertain', null],
    ['uncertain', { reconciliationStatus: 'error' }, 'uncertain', 'checkDeployment'],
    ['uncertain', { reconciliationStatus: 'clear' }, 'uncertain', 'retry'],
  ])('%s %j → %s, action %s', (phase, over, displayState, action) => {
    const shown = displayForAttempt(record(phase, over));
    expect(shown.displayState).toBe(displayState);
    expect(shown.action).toBe(action);
  });

  it('a recovered confirmation is marked recovered and names the found battle; an explicit one is not', () => {
    expect(displayForAttempt(record('created', { resolution: { kind: 'recovered', battleId: 'found' }, result: { kind: 'uncertain', battleId: null } })))
      .toMatchObject({ recovered: true, battleId: 'found' });
    expect(displayForAttempt(record('created', { ceremonyPhase: 'reveal', result: { kind: 'created', battleId: 'b' } })))
      .toMatchObject({ recovered: false, battleId: 'b' });
  });

  it('shows nothing for no record, idle, orphaned, or a phase outside the vocabulary', () => {
    for (const r of [null, undefined, record('idle'), record('orphaned'), record('confirmed'), record('failed'), record('finishing'), record('verifying')]) {
      expect(displayForAttempt(r)).toBeNull();
    }
  });

  it('the refusal\'s line travels unchanged, and an empty one is none', () => {
    expect(displayForAttempt(record('refused', { result: { kind: 'review_due', line: DUE_DEPLOY_LINE } })).line).toBe(DUE_DEPLOY_LINE);
    expect(displayForAttempt(record('refused', { result: { kind: 'refused', line: '  ' } })).line).toBeNull();
  });
});
