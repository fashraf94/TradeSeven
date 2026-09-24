// api/_utils/tickCapture/captureComposition.calls.test.js
//
// Cockpit Build 0 — CAPTURE COMPOSITION (spec docs/design/COCKPIT_SPEC_V1_3.md
// §2, §3.9; contract docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §9). The emitted
// schema is resolved ONCE from the enabled contribution set and read by BOTH
// composers; the `calls[]` references pass the C-3 default-deny allowlist; the
// context carries `calls` + `call()` on the live and the NOOP interfaces.

import { describe, it, expect } from 'vitest';
import {
  resolveCaptureSchema, TICK_CAPTURE_SCHEMA_VERSION, TICK_CAPTURE_SCHEMA_VERSION_CALLS, PILOT_CAPTURE_REGISTRATION, CALL_KINDS,
} from './captureConfig.js';
import { ENUM_LISTS, CALL_KINDS as SERIALIZER_CALL_KINDS, sanitizePermanentDocument, findFreeText, PERMANENT_FIELD_KINDS, PERMANENT_CONTAINER_KINDS } from './captureSerializer.js';
import { createTickCaptureContext, NOOP_TICK_CAPTURE } from './captureContext.js';
import { buildCaptureDocuments, finalizeTickCapture } from './captureWriter.js';
import { CALL_KINDS as VALIDATOR_SOURCE } from './captureConfig.js';

const NOW_MS = Date.UTC(2026, 8, 9, 15, 0, 0);
const EMPTY_BODY = {
  dispatched: false,
  request: { body: null, bytes: null, sha256: null, truncated: false },
  response: { body: null, bytes: null, sha256: null, truncated: false, status: null, returnedModel: null },
  copyError: null,
};
const REFS = [
  { callId: 'battle-1:eval_004:call:0', n: 0, kind: 'called_shot' },
  { callId: 'battle-1:eval_004:call:1', n: 1, kind: 'pick' },
];

function liveCtx({ schema = undefined, refs = [], actions = 0 } = {}) {
  const ctx = createTickCaptureContext({ battleId: 'battle-1', tickSeq: 4, agentId: 'agent-1', enabled: true });
  ctx.universe({ heldSymbols: ['NVDA', 'KO'], benchSymbols: ['AMD'] });
  if (schema !== undefined) ctx.schema(schema);
  for (let i = 0; i < actions; i++) ctx.action({ kind: 'swap', source: 'haiku', symbolOut: 'KO', symbolIn: 'AMD', committed: true });
  for (const r of refs) ctx.call(r);
  ctx.exit('completed');
  ctx.stage('finalized');
  return ctx;
}
const compose = (ctx) => buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });

describe('resolveCaptureSchema — the four composition rows (contract §9)', () => {
  it('calls off · pilot off → version 1, the pre-build shape', () => {
    expect(resolveCaptureSchema({ callsEnabled: false, pilotEnabled: false })).toEqual({ version: 1, includeCalls: false, includePilot: false, available: true, reason: null });
    expect(TICK_CAPTURE_SCHEMA_VERSION).toBe(1);
  });
  it('calls on · pilot off → version 2 (calls)', () => {
    expect(resolveCaptureSchema({ callsEnabled: true, pilotEnabled: false })).toEqual({ version: 2, includeCalls: true, includePilot: false, available: true, reason: null });
    expect(TICK_CAPTURE_SCHEMA_VERSION_CALLS).toBe(2);
  });
  it('pilot rows (3 and 4) are UNAVAILABLE at this baseline — no registration, no version', () => {
    expect(PILOT_CAPTURE_REGISTRATION).toBeNull();
    for (const callsEnabled of [false, true]) {
      expect(resolveCaptureSchema({ callsEnabled, pilotEnabled: true })).toMatchObject({ version: null, available: false, reason: 'pilot_unregistered' });
    }
  });
  it('the resolved schema is frozen (one value for the whole tick)', () => {
    expect(Object.isFrozen(resolveCaptureSchema({ callsEnabled: true }))).toBe(true);
  });
});

describe('the serializer — CALL_KINDS and the calls allowlist (C-3 default deny)', () => {
  it('CALL_KINDS is ONE list: exported by the serializer and registered in ENUM_LISTS', () => {
    expect(SERIALIZER_CALL_KINDS).toBe(CALL_KINDS);
    expect(ENUM_LISTS.CALL_KINDS).toBe(CALL_KINDS);
    expect(VALIDATOR_SOURCE).toEqual(['called_shot', 'confirmation', 'pick']);
  });
  it('declares exactly the container and the three leaves', () => {
    expect(PERMANENT_CONTAINER_KINDS.calls).toBe('array');
    expect(PERMANENT_CONTAINER_KINDS['calls.*']).toBe('object');
    expect(Object.entries(PERMANENT_FIELD_KINDS).filter(([k]) => k.startsWith('calls.'))).toEqual([
      ['calls.*.callId', 'id'], ['calls.*.n', 'number'], ['calls.*.kind', 'enum:CALL_KINDS'],
    ]);
  });
  it('admits the references; rejects an undeclared field (say, `said`) whole, and an unknown kind', () => {
    const { doc, rejected } = sanitizePermanentDocument({ calls: [
      { callId: 'battle-1:eval_004:call:0', n: 0, kind: 'called_shot' },
      { callId: 'battle-1:eval_004:call:1', n: 1, kind: 'prediction', said: 'AMD to the moon' },
    ] });
    expect(doc.calls[0]).toEqual({ callId: 'battle-1:eval_004:call:0', n: 0, kind: 'called_shot' });
    // The unknown kind is nulled; the undeclared `said` is dropped whole — it never reaches the permanent record.
    expect(doc.calls[1]).toEqual({ callId: 'battle-1:eval_004:call:1', n: 1, kind: null });
    expect(rejected.map((r) => r.path).sort()).toEqual(['calls.1.kind', 'calls.1.said']);
  });
});

describe('the context — calls + call() on live and NOOP; the schema set once', () => {
  it('NOOP carries call and schema as inert no-ops', () => {
    expect(typeof NOOP_TICK_CAPTURE.call).toBe('function');
    expect(typeof NOOP_TICK_CAPTURE.schema).toBe('function');
    expect(NOOP_TICK_CAPTURE.call(REFS[0])).toBeUndefined();
    expect(Object.isFrozen(NOOP_TICK_CAPTURE)).toBe(true);
  });
  it('live: each confirmed reference keeps the CALL\'s own zero-based ordinal, independent of action ordinals', () => {
    const ctx = liveCtx({ refs: REFS, actions: 2 });
    expect(ctx.state.calls).toEqual(REFS);
    expect(ctx.state.actions.map((a) => a.n)).toEqual([1, 2]);
  });
  it('the schema is set once; a second value is ignored', () => {
    const ctx = liveCtx({ schema: resolveCaptureSchema({ callsEnabled: true }) });
    ctx.schema(resolveCaptureSchema({ callsEnabled: false }));
    expect(ctx.state.captureSchema.version).toBe(2);
  });
});

describe('the composers read ONE resolved schema', () => {
  it('no schema set / calls off → version 1 on BOTH documents and no `calls` key at all (the pre-build shape)', () => {
    for (const ctx of [liveCtx(), liveCtx({ schema: resolveCaptureSchema({ callsEnabled: false }) })]) {
      const { permanent, body } = compose(ctx);
      expect(permanent.schemaVersion).toBe(1);
      expect(body.schemaVersion).toBe(1);
      expect(permanent).not.toHaveProperty('calls');
    }
  });
  it('calls off: a stray reference is never emitted (the calls path is removed, not merely empty)', () => {
    const { permanent } = compose(liveCtx({ schema: resolveCaptureSchema({ callsEnabled: false }), refs: REFS }));
    expect(permanent).not.toHaveProperty('calls');
  });
  it('calls on → version 2 on BOTH documents; `calls[]` carries the confirmed references and passes the free-text sweep', () => {
    const { permanent, body, rejected, freeTextPaths } = compose(liveCtx({ schema: resolveCaptureSchema({ callsEnabled: true }), refs: REFS }));
    expect(permanent.schemaVersion).toBe(2);
    expect(body.schemaVersion).toBe(2);
    expect(permanent.calls).toEqual(REFS);
    expect(rejected).toEqual([]);
    expect(freeTextPaths).toEqual([]);
    expect(findFreeText(permanent, { universe: new Set(['NVDA', 'KO', 'AMD']) })).toEqual([]);
  });
  it('calls on with no confirmed reference → an empty container (version 2 still names its shape)', () => {
    const { permanent } = compose(liveCtx({ schema: resolveCaptureSchema({ callsEnabled: true }) }));
    expect(permanent.calls).toEqual([]);
  });
  it('an unavailable contribution set is never emitted: the composer refuses, the finalizer reports serialize_failed, nothing commits', async () => {
    const ctx = liveCtx({ schema: resolveCaptureSchema({ callsEnabled: true, pilotEnabled: true }) });
    expect(() => compose(ctx)).toThrow(/capture_schema_unavailable:pilot_unregistered/);
    const committed = [];
    const db = {
      collection: () => ({ doc: () => ({ collection: () => ({ doc: (id) => ({ path: id }) }) }) }),
      batch: () => ({ set() {}, async commit() { committed.push(1); } }),
    };
    const res = await finalizeTickCapture(db, ctx, { nowMs: NOW_MS });
    expect(res.disposition).toBe('serialize_failed');
    expect(res.error).toMatch(/capture_schema_unavailable/);
    expect(committed).toEqual([]);
  });
});
