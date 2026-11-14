// api/_utils/sharedResearch/method.test.js
//
// KB-1 — THE METHOD'S SELECTION AND RE-CHECK (Amendment A §A4.1, §A4.2; the
// KB-1 build prompt, Part 1, Part 7 rows 1–3 at the unit level, row 10).
//
// The KB loader is reached through a mock of ../kb/loader.js whose factory
// keeps the real module and answers, per row, the REAL v0.1 method — obtained
// from the real loader with a test-only authorization list (the shipped list is
// empty) — or a refusal. The audience module is the real one, wrapped in a spy;
// its allowlist predicate is mocked so `u-listed` is on the list and nobody
// else is.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

const kb = vi.hoisted(() => ({ offer: null, load: null, offerCalls: [], loadCalls: [], real: null, refusals: null, audience: null }));
const REAL_ENTRY = vi.hoisted(() => ({
  id: 'KB-IDEA-EVALUATION-001', version: '0.1',
  sha256: 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e',
  acceptanceSha256: 'ec709781b80d2deeb325702faccb7a90abaa0c244c96103f0e956f81d26a08ee',
  consumers: ['shared_research.observation'], audience: 'allowlist',
  authorizedAt: '2026-11-13T17:00:00Z', authorizedBy: 'test', evidenceRef: 'docs/approvals/KB1_TEST_ONLY.md',
}));
vi.mock('../kb/loader.js', async (importOriginal) => {
  const real = await importOriginal();
  kb.real = real.loadAuthorizedMethod({ id: REAL_ENTRY.id, version: REAL_ENTRY.version, consumer: REAL_ENTRY.consumers[0], inAudience: () => true }, { authorizations: [REAL_ENTRY] });
  kb.refusals = real.KB_REFUSALS;
  return {
    ...real,
    authorizedMethodFor(...args) { kb.offerCalls.push(args); return kb.offer ? kb.offer(...args) : real.authorizedMethodFor(...args); },
    loadAuthorizedMethod(...args) { kb.loadCalls.push(args); return kb.load ? kb.load(...args) : real.loadAuthorizedMethod(...args); },
  };
});
vi.mock('../kb/audience.js', async (importOriginal) => {
  const real = await importOriginal();
  kb.audience = vi.fn((uid) => real.inAudienceFor(uid));
  return { inAudienceFor: kb.audience };
});
vi.mock('../callRecords/mode.js', () => ({ isCockpitOwnerAllowlisted: (uid) => uid === 'u-listed' }));

const {
  METHOD, METHOD_SOURCE, BASELINE, OBSERVATION_CONSUMER, selectMethod, effectiveMethodFor, methodStampOf, citedSourceOf,
  methodMarkersFor, methodRefOf, methodKeyOf, kbSourceRefOf,
} = await import('./method.js');
// The two KB modules are only ever mocked here, never imported (the KB boundary row): their values come from the factories.
const KB_REFUSALS = kb.refusals;
const inAudienceFor = kb.audience;

const NOW = '2026-11-13T15:00:00.000Z';
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
/** The loader, answering by the audience it is handed (as the real one does for an allowlist entry). */
const byAudience = (req) => (req.inAudience('allowlist') === true ? kb.real : { ok: false, reason: 'audience' });
const KB_KEYS = ['acceptedAt', 'id', 'sha256', 'source', 'sourceRef', 'text', 'title', 'version'];

beforeEach(() => {
  Object.assign(kb, { offer: null, load: null, offerCalls: [], loadCalls: [] });
  inAudienceFor.mockClear();
});

describe('the real v0.1 method this file runs on', () => {
  it('is the accepted package, read through the real loader with a test-only list', () => {
    expect(kb.real.ok).toBe(true);
    expect(kb.real.method).toMatchObject({ id: 'KB-IDEA-EVALUATION-001', version: '0.1', title: 'Evaluating an Idea', sha256: REAL_ENTRY.sha256, consumer: OBSERVATION_CONSUMER, audience: 'allowlist' });
    expect(sha(kb.real.method.text)).toBe(REAL_ENTRY.sha256);
  });
});

describe('BASELINE (Part 1)', () => {
  it('is baseline@v0 with METHOD.text, its sha256 pinned at this build', () => {
    expect(BASELINE).toEqual({ id: 'baseline', version: 'v0', sha256: sha(METHOD.text), source: 'baseline', text: METHOD.text, sourceRef: METHOD_SOURCE });
    // The pinned baseline the KB chat's comparison uses (report §5). A change to METHOD.text moves it.
    expect(BASELINE.sha256).toBe('72fb845a2d12be5d98195f1d9f451d3e8b7a323f269a94cc82a088cdcaeb95d1');
    expect(Object.isFrozen(BASELINE)).toBe(true);
    expect(METHOD_SOURCE).toEqual({ recordKind: 'kb', recordId: 'baseline@v0', label: 'Baseline method v0' });
    expect(OBSERVATION_CONSUMER).toBe('shared_research.observation');
  });
});

describe('selectMethod (row 1)', () => {
  it('own words → the KB method when the loader answers ok, stamped kb, no fallbackReason', () => {
    kb.offer = () => kb.real;
    const { method, stamp } = selectMethod({ entryKind: 'observation', uid: 'u-listed', nowIso: NOW });
    expect(Object.keys(method).sort()).toEqual(KB_KEYS);
    expect(method).toMatchObject({ id: 'KB-IDEA-EVALUATION-001', version: '0.1', sha256: REAL_ENTRY.sha256, source: 'kb', text: kb.real.method.text, title: 'Evaluating an Idea' });
    expect(method.sourceRef).toEqual({ recordKind: 'kb', recordId: 'KB-IDEA-EVALUATION-001@0.1', label: 'Method · Evaluating an Idea v0.1' });
    expect(stamp).toEqual({ id: 'KB-IDEA-EVALUATION-001', version: '0.1', sha256: REAL_ENTRY.sha256, source: 'kb', consumer: OBSERVATION_CONSUMER, selectedAt: NOW });
    // One call, one argument, the consumer and an audience function.
    expect(kb.offerCalls).toHaveLength(1);
    expect(kb.offerCalls[0]).toHaveLength(1);
    expect(kb.offerCalls[0][0].consumer).toBe(OBSERVATION_CONSUMER);
    expect(typeof kb.offerCalls[0][0].inAudience).toBe('function');
  });

  it.each(KB_REFUSALS.map((r) => [r]))('own words, the loader refusing %s → the baseline, that reason as fallbackReason', (reason) => {
    kb.offer = () => ({ ok: false, reason });
    const { method, stamp } = selectMethod({ entryKind: 'observation', uid: 'u-listed', nowIso: NOW });
    expect(method).toBe(BASELINE);
    expect(stamp).toEqual({ id: 'baseline', version: 'v0', sha256: BASELINE.sha256, source: 'baseline', consumer: OBSERVATION_CONSUMER, selectedAt: NOW, fallbackReason: reason });
  });

  it('own words, an answer it cannot use (unknown reason, ok without text, a throw) → the baseline, corrupt; never throws', () => {
    for (const offer of [() => ({ ok: false, reason: 'whatever' }), () => ({ ok: true, method: { ...kb.real.method, text: '' } }), () => ({ ok: true }), () => null, () => { throw new Error('boom'); }]) {
      kb.offer = offer;
      const { method, stamp } = selectMethod({ entryKind: 'observation', uid: 'u-listed', nowIso: NOW });
      expect(method).toBe(BASELINE);
      expect(stamp.fallbackReason).toBe('corrupt');
    }
  });

  it.each([['item'], ['signaldrop'], [undefined], ['observation ']])('entry %s → the baseline by rule: no fallbackReason, no consumer, the loader never asked — even when it would answer ok', (entryKind) => {
    kb.offer = () => kb.real;
    const { method, stamp } = selectMethod({ entryKind, uid: 'u-listed', nowIso: NOW });
    expect(method).toBe(BASELINE);
    expect(stamp).toEqual({ id: 'baseline', version: 'v0', sha256: BASELINE.sha256, source: 'baseline', consumer: null, selectedAt: NOW });
    expect('fallbackReason' in stamp).toBe(false);
    expect(kb.offerCalls).toEqual([]);
  });

  it('the real loader and the shipped (empty) list → own words is the baseline, not_authorized', () => {
    const { method, stamp } = selectMethod({ entryKind: 'observation', uid: 'u-listed', nowIso: NOW });
    expect(method).toBe(BASELINE);
    expect(stamp.fallbackReason).toBe('not_authorized');
  });

  it('the audience: the uid given is the uid the audience function is made for, and the answer follows it (row 2)', () => {
    kb.offer = byAudience;
    expect(selectMethod({ entryKind: 'observation', uid: 'u-listed', nowIso: NOW }).stamp.source).toBe('kb');
    expect(selectMethod({ entryKind: 'observation', uid: 'u-off', nowIso: NOW }).stamp).toMatchObject({ source: 'baseline', fallbackReason: 'audience' });
    expect(inAudienceFor.mock.calls).toEqual([['u-listed'], ['u-off']]);
  });
});

describe('effectiveMethodFor (row 3)', () => {
  const baselineStamp = () => selectMethod({ entryKind: 'item', nowIso: NOW }).stamp;
  const stampedKb = { id: REAL_ENTRY.id, version: REAL_ENTRY.version, sha256: REAL_ENTRY.sha256, source: 'kb', consumer: OBSERVATION_CONSUMER, selectedAt: NOW };

  it('a kb stamp → re-loaded for this player: ok → that method, its fields whitelisted', () => {
    kb.load = () => kb.real;
    const { method, refusal } = effectiveMethodFor({ stamp: stampedKb, uid: 'u-listed' });
    expect(refusal).toBeNull();
    expect(Object.keys(method).sort()).toEqual(KB_KEYS);
    expect(methodRefOf(method)).toEqual({ id: REAL_ENTRY.id, version: '0.1', sha256: REAL_ENTRY.sha256, source: 'kb' });
    expect(kb.loadCalls).toHaveLength(1);
    expect(kb.loadCalls[0]).toHaveLength(1);
    expect(kb.loadCalls[0][0]).toMatchObject({ id: REAL_ENTRY.id, version: '0.1', consumer: OBSERVATION_CONSUMER });
  });

  it.each(KB_REFUSALS.map((r) => [r]))('a kb stamp, the loader refusing %s → this turn on the baseline, the refusal returned', (reason) => {
    kb.load = () => ({ ok: false, reason });
    expect(effectiveMethodFor({ stamp: stampedKb, uid: 'u-listed' })).toEqual({ method: BASELINE, refusal: reason });
  });

  it('a kb stamp, a player out of the audience → the baseline, audience; the uid reaches the audience function', () => {
    kb.load = byAudience;
    expect(effectiveMethodFor({ stamp: stampedKb, uid: 'u-off' })).toEqual({ method: BASELINE, refusal: 'audience' });
    expect(inAudienceFor).toHaveBeenLastCalledWith('u-off');
  });

  it('a baseline stamp, no stamp, a stamp with no source → the baseline, no refusal, and the loader is never asked — even when it would answer ok (never upgraded)', () => {
    kb.load = () => kb.real;
    kb.offer = () => kb.real;
    for (const stamp of [baselineStamp(), { id: 'baseline', version: 'v0' }, { id: REAL_ENTRY.id, version: '0.1' }, null, undefined, { ...stampedKb, source: 'KB' }]) {
      expect(effectiveMethodFor({ stamp, uid: 'u-listed' })).toEqual({ method: BASELINE, refusal: null });
    }
    expect(kb.loadCalls).toEqual([]);
    expect(kb.offerCalls).toEqual([]);
  });

  it('never throws: a throwing loader, a broken answer → the baseline, corrupt', () => {
    kb.load = () => { throw new Error('boom'); };
    expect(effectiveMethodFor({ stamp: stampedKb, uid: 'u-listed' })).toEqual({ method: BASELINE, refusal: 'corrupt' });
    kb.load = () => ({ ok: true, method: { ...kb.real.method, sha256: 'not-a-hash' } });
    expect(effectiveMethodFor({ stamp: stampedKb, uid: 'u-listed' })).toEqual({ method: BASELINE, refusal: 'corrupt' });
    expect(() => effectiveMethodFor()).not.toThrow();
  });
});

describe('provenance (row 10): a loader answer carrying more than its eight fields leaves none of the rest behind', () => {
  it('the method, the stamp and the exchange ref hold only their own fields — no source, review, acceptance or exporter block, no local path', () => {
    const planted = {
      ok: true,
      method: {
        ...kb.real.method,
        source: { path: 'C:\\Users\\someone\\kb\\SOURCE.md' }, review: { path: 'C:/Users/someone/kb/REVIEW.md' },
        acceptance: { evidence: '/home/someone/kb/ACCEPTANCE.json' }, exporter: { host: 'DESKTOP-1', cwd: 'C:\\kb' },
      },
    };
    kb.offer = () => planted;
    kb.load = () => planted;
    const selected = selectMethod({ entryKind: 'observation', uid: 'u-listed', nowIso: NOW });
    const effective = effectiveMethodFor({ stamp: selected.stamp, uid: 'u-listed' });
    const all = JSON.stringify([selected, effective, methodRefOf(effective.method)]);
    for (const key of ['"review"', '"acceptance"', '"exporter"', 'C:\\\\', 'C:/', '/home/']) expect(all).not.toContain(key);
    expect(selected.method.source).toBe('kb');
    expect(effective.method.source).toBe('kb');
  });
});

describe('methodStampOf', () => {
  it('writes fallbackReason only when given, and never an undefined value', () => {
    const a = methodStampOf(BASELINE, { selectedAt: NOW });
    const b = methodStampOf(BASELINE, { consumer: OBSERVATION_CONSUMER, selectedAt: NOW, fallbackReason: 'scope' });
    expect('fallbackReason' in a).toBe(false);
    expect(b.fallbackReason).toBe('scope');
    for (const s of [a, b, methodStampOf(BASELINE)]) for (const v of Object.values(s)) expect(v).not.toBeUndefined();
  });
});

describe('citedSourceOf — the opening next action of an own-words investigation cites its frame exchange\'s method', () => {
  const ranKb = { id: REAL_ENTRY.id, version: '0.1', sha256: REAL_ENTRY.sha256, source: 'kb' };
  const stamp = { id: REAL_ENTRY.id, version: '0.1', sha256: REAL_ENTRY.sha256, source: 'kb', consumer: OBSERVATION_CONSUMER, selectedAt: NOW };
  it('a baseline frame, or a frame with no method → the baseline source', () => {
    kb.load = () => kb.real;
    for (const ran of [methodRefOf(BASELINE), null, undefined, { id: 'baseline', version: 'v0' }]) expect(citedSourceOf({ ran, stamp, uid: 'u-listed' })).toEqual(METHOD_SOURCE);
  });
  it('a KB frame → the KB method\'s source, titled', () => {
    kb.load = () => kb.real;
    expect(citedSourceOf({ ran: ranKb, stamp, uid: 'u-listed' })).toEqual({ recordKind: 'kb', recordId: 'KB-IDEA-EVALUATION-001@0.1', label: 'Method · Evaluating an Idea v0.1' });
  });
  it('a KB frame whose method no longer loads (revoked before the open), or loads other bytes → still the KB source, labelled by its id — never the baseline', () => {
    kb.load = () => ({ ok: false, reason: 'not_authorized' });
    const want = { recordKind: 'kb', recordId: 'KB-IDEA-EVALUATION-001@0.1', label: 'Method · KB-IDEA-EVALUATION-001 v0.1' };
    expect(citedSourceOf({ ran: ranKb, stamp, uid: 'u-listed' })).toEqual(want);
    kb.load = () => kb.real;
    expect(citedSourceOf({ ran: { ...ranKb, sha256: '0'.repeat(64) }, stamp, uid: 'u-listed' })).toEqual(want);
  });
});

describe('the markers (method_example_as_fact)', () => {
  it('v0.1\'s exact bytes carry the register ids and the worked example; other bytes, the baseline and no method carry none', () => {
    kb.offer = () => kb.real;
    const { method } = selectMethod({ entryKind: 'observation', uid: 'u-listed', nowIso: NOW });
    const m = methodMarkersFor(method);
    expect(m.sha256).toBe(REAL_ENTRY.sha256);
    expect(m.citations).toEqual(['A0', 'C1', 'E1', 'M1', 'V1', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'I1', 'I2', 'I3', 'I4', 'I5', 'I6']);
    expect(m.example).toEqual({ names: ['NVDA'], dates: ['October 30', 'Oct. 30', 'Oct 30'] });
    // every register id the markers name is in the method's own text (they are its ids, not guesses)
    for (const id of ['A0', 'C1', 'E1', 'M1', 'V1', 'I1', 'I2', 'I4', 'I5', 'I6']) expect(method.text).toMatch(new RegExp(`\\b${id}\\b`));
    expect(method.text).toContain("C1's October 30, 2026 noon observation");
    expect(method.text).toContain('NVDA');
    expect(methodMarkersFor({ ...method, sha256: '0'.repeat(64) })).toBeNull();
    expect(methodMarkersFor(BASELINE)).toBeNull();
    expect(methodMarkersFor(null)).toBeNull();
    expect(methodKeyOf(method)).toBe('KB-IDEA-EVALUATION-001@0.1');
  });
  it('a long title keeps the label inside the record\'s 120 characters', () => {
    expect(kbSourceRefOf({ id: 'X', version: '1', title: 'T'.repeat(200) }).label.length).toBeLessThanOrEqual(120);
  });
});
