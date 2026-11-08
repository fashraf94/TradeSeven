// api/_utils/hypothesisRecords/sharedResearchVersion.test.js
//
// The Research Record Extension follow-up (V2 §4) — buildSharedResearchVersion,
// the first version an adopted Shared Research investigation creates:
//   · its exact output for a fixed input (the fixture), key order included,
//     with its contentHash and opFingerprint pinned;
//   · every refusal;
//   · born `researched` (stateSource research, reason shared_research_completed);
//     "use it in my next game" is the existing researched → ready, and no
//     draft → ready exists.
// Every existing version's hash is pinned separately (contentHash.golden.test.js).

import { describe, it, expect } from 'vitest';
import { STATE_REASONS, legalTransition, contentHashOf, opFingerprintOf, SHARED_RESEARCH_LIST_MARKER } from './model.js';
import { findingAppendPatch, buildFinding } from '../researchRecords/model.js';
import {
  adoptedVersion, adoptionInput, adoptionList, adoptionRecord, fid, OWNER, SESSION_ID, RECORD_ID, CONFIRM_EXCHANGE_ID, NOW,
} from './__fixtures__/sharedResearchAdoption.js';

const code = (fn) => { try { fn(); } catch (e) { return e.code ?? `untyped: ${e.message}`; } return 'no refusal'; };

describe('buildSharedResearchVersion — the exact first version for a fixed input', () => {
  it('every field, in order', () => {
    const v = adoptedVersion();
    expect(Object.keys(v)).toEqual([
      'version', 'watchlistId', 'userId', 'opId', 'opFingerprint', 'createdAt',
      'statement', 'horizonEnum', 'horizonSource', 'activation', 'invalidation', 'evidenceRefs', 'publishedAt', 'origin',
      'contentHash', 'status', 'stateChangedAt', 'stateSource', 'stateReason', 'missingEvidence', 'successorVersion',
      'firstDeployedAt', 'lastDeployedAt', 'lastDeployedBattleId', 'reviewDueAt',
    ]);
    expect(v).toEqual({
      version: 1, watchlistId: 'wl-adopt-1', userId: OWNER, opId: 'adopt_srs-adopt-1',
      opFingerprint: '37b62a42b7114f7c1b5fc5757baffcc7d8585c8175934c894d45ba6835060c66',
      createdAt: NOW,
      statement: 'Networking carries the next leg of AI capex.', horizonEnum: 'positional', horizonSource: 'player',
      activation: [{ symbol: 'AVGO', side: 'above', level: 180, basis: 'daily_close' }], invalidation: [],
      evidenceRefs: [
        { kind: 'researchWork', id: RECORD_ID },
        { kind: 'evidenceItem', recordKind: 'researchWork', recordId: RECORD_ID, itemId: fid(1) },
        { kind: 'evidenceItem', recordKind: 'researchWork', recordId: RECORD_ID, itemId: fid(3) },
        { kind: 'exchange', hostCollection: 'sharedResearchSessions', hostId: SESSION_ID, exchangeId: CONFIRM_EXCHANGE_ID },
      ],
      publishedAt: null, origin: 'shared_research',
      contentHash: '83c8fd49173cb20f5b21cef636cb8b7d5b2b73a6e7b9307980735de731b8a339',
      status: 'researched', stateChangedAt: NOW, stateSource: 'research', stateReason: 'shared_research_completed',
      missingEvidence: null, successorVersion: null, firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null,
    });
    expect(contentHashOf(v)).toBe(v.contentHash);
    expect(STATE_REASONS.sharedResearchCompleted).toBe('shared_research_completed');
  });
  it('the fingerprint covers everything the player previewed — each part moves it', () => {
    const base = adoptedVersion().opFingerprint;
    expect(base).toBe(opFingerprintOf({ kind: 'adopt', payload: {
      sessionId: SESSION_ID, statement: 'Networking carries the next leg of AI capex.', horizonEnum: 'positional',
      activation: [{ symbol: 'AVGO', side: 'above', level: 180, basis: 'daily_close' }], invalidation: [], keptFindingIds: [fid(1), fid(3)], confirmExchangeId: CONFIRM_EXCHANGE_ID,
    } }));
    const moved = [
      { statement: 'Another statement.' }, { horizonEnum: 'swing' }, { activation: [] },
      { invalidation: [{ symbol: 'AVGO', side: 'below', level: 150, basis: 'daily_close' }] },
      { keptFindingIds: [fid(1)] }, { keptFindingIds: [fid(3), fid(1)] }, { confirmExchangeId: '0e9d8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b' },
    ];
    for (const over of moved) expect(adoptedVersion(over).opFingerprint, JSON.stringify(over)).not.toBe(base);
    expect(adoptedVersion({ nowIso: '2026-11-08T16:00:00.000Z' }).opFingerprint).toBe(base); // the write time is not part of the request
  });
});

describe('buildSharedResearchVersion — every refusal', () => {
  it('the list: not the owner\'s, not shared_research by origin, or its marker names another session', () => {
    expect(code(() => adoptedVersion({ list: adoptionList({ userId: 'someone-else' }) }))).toBe('list_not_from_session');
    expect(code(() => adoptedVersion({ list: adoptionList({ [SHARED_RESEARCH_LIST_MARKER]: undefined }) }))).toBe('list_not_from_session');
    expect(code(() => adoptedVersion({ list: adoptionList({ [SHARED_RESEARCH_LIST_MARKER]: 'srs-other' }) }))).toBe('list_not_from_session');
    expect(code(() => adoptedVersion({ list: null }))).toBe('list_not_from_session');
  });
  it('the record: not this owner\'s shared_research record for this session', () => {
    const r = adoptionRecord();
    expect(code(() => adoptedVersion({ record: { ...r, userId: 'someone-else' } }))).toBe('record_not_from_session');
    expect(code(() => adoptedVersion({ record: { ...r, researchWorkId: 'sr_other' } }))).toBe('record_not_from_session');
    expect(code(() => adoptedVersion({ record: { ...r, origin: 'analysis' } }))).toBe('record_not_from_session');
    expect(code(() => adoptedVersion({ record: { ...r, state: 'weird' } }))).toBe('record_not_from_session');
    expect(code(() => adoptedVersion({ record: null }))).toBe('record_not_from_session');
    expect(code(() => adoptedVersion({ sessionId: 'a/b', list: adoptionList({ [SHARED_RESEARCH_LIST_MARKER]: 'a/b' }) }))).toBe('record_not_from_session');
  });
  it('the record has no question', () => {
    const { question, ...noQuestion } = adoptionRecord();
    expect(question).toBeTruthy();
    expect(code(() => adoptedVersion({ record: noQuestion }))).toBe('question_missing');
  });
  it('the kept findings: empty, repeated, unknown, superseded or malformed', () => {
    for (const keptFindingIds of [[], [fid(1), fid(1)], [fid(9)], [fid(2)], ['f_1'], undefined, 'f']) {
      expect(code(() => adoptedVersion({ keptFindingIds })), JSON.stringify(keptFindingIds) ?? 'undefined').toBe('invalid_kept_findings');
    }
  });
  it('the content: a statement over the cap is refused, never cut; a horizon outside the enum; a malformed condition', () => {
    expect(code(() => adoptedVersion({ statement: 's'.repeat(1001) }))).toBe('invalid_statement');
    expect(code(() => adoptedVersion({ horizonEnum: 'forever' }))).toBe('invalid_horizon');
    expect(code(() => adoptedVersion({ activation: [{ symbol: 'AVGO', side: 'sideways', level: 1, basis: 'daily_close' }] }))).toBe('invalid_condition');
    expect(adoptedVersion({ statement: 's'.repeat(1000) }).statement).toHaveLength(1000);
  });
  it('the refs: a malformed confirming exchange id; more than 30 refs (28 kept findings at most)', () => {
    expect(code(() => adoptedVersion({ confirmExchangeId: 'ex-1' }))).toBe('invalid_evidence_refs');
    let r = adoptionRecord();
    for (let n = 4; n <= 32; n++) {
      const f = buildFinding({ kind: 'observation', symbol: null, fact: `F${n}`, source: { recordKind: 'call', recordId: `c-${n}`, label: 'c' }, at: NOW, status: 'verified' }, { findingId: fid(n), nowIso: NOW });
      r = { ...r, ...findingAppendPatch(r, f, { nowIso: NOW }) };
    }
    const current = [fid(1), ...Array.from({ length: 29 }, (_, i) => fid(i + 4))];
    expect(adoptedVersion({ record: r, keptFindingIds: current.slice(0, 28) }).evidenceRefs).toHaveLength(30);
    expect(code(() => adoptedVersion({ record: r, keptFindingIds: current.slice(0, 29) }))).toBe('too_many_evidence_refs');
  });
});

describe('the lifecycle: born researched; "use it in my next game" is the existing ready action', () => {
  it('researched → ready is legal (player_ready); no draft → ready exists', () => {
    expect(adoptedVersion().status).toBe('researched');
    expect(legalTransition('researched', 'ready')).toEqual({ to: 'ready', reason: 'player_ready' });
    expect(legalTransition('draft', 'ready')).toBeNull();
  });
  it('the input is never mutated', () => {
    const input = adoptionInput();
    const before = structuredClone(input);
    adoptedVersion(input);
    expect(input).toEqual(before);
  });
});
