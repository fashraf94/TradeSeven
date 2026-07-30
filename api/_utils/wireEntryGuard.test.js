// api/_utils/wireEntryGuard.test.js
// Phase 2 N1.4 — the R4-M2 ordered state machine (classifier half).
// Matrix rows: P2-5 (unknown version fails closed — classifier direction),
// P2-30 permutation (vN entry at a vN+1 consumer → stamped-vN or
// version-skip, NEVER malformed), plus the registry self-consistency
// invariant that keeps a bumped constant from shipping unregistered.
//
// A6 faults exercised by experiment during the build:
//   • invert the version guard (unknown → stamped) → the version_skip rows
//     here and the P2-29 consumer rows go red;
//   • classify unrecognized versions MALFORMED → the P2-30 permutation
//     rows go red;
//   • drop 'wire-1.6' from the registry → the self-consistency invariant
//     goes red (and every stamped-classification row with it).

import { describe, it, expect } from 'vitest';
import {
  classifyWireEntry,
  isRenderableState,
  isRenderableWireEntry,
  WIRE_ENTRY_STATES,
} from './wireEntryGuard.js';
import {
  WIRE_SCHEMA_VERSION,
  WIRE_DIGEST_RENDERER_VERSION,
  RECOGNIZED_WIRE_SCHEMA_VERSIONS,
  RECOGNIZED_WIRE_DIGEST_RENDERER_VERSIONS,
} from './wireContracts.js';

const { LEGACY, STAMPED, VERSION_SKIP, MALFORMED } = WIRE_ENTRY_STATES;

/** A fully stamped current-shape entry (what today's transaction persists). */
const stamped = (over = {}, factsOver = {}) => ({
  storyId: 's1', reporter: 'doug', headline: 'H',
  publishedAt: '2026-07-24T20:00:00Z', validatorVersion: '1.6.0', quarantined: false,
  generationConfig: { generationVersion: 7, continuityEnabled: false },
  agentFacts: {
    eventType: 'earnings_recap', tickers: ['NVDA'],
    digest: 'NVDA earnings: EPS +8.2% vs consensus.',
    schemaVersion: WIRE_SCHEMA_VERSION,
    digestRendererVersion: WIRE_DIGEST_RENDERER_VERSION,
    validatorVersion: '1.6.0', chainId: 's1',
    ...factsOver,
  },
  ...over,
});

/** A pre-stamp legacy entry (Amendment J): NO epoch fields anywhere. */
const legacy = () => ({
  storyId: 'L1', reporter: 'doug', headline: 'H',
  publishedAt: '2026-07-20T20:00:00Z', validatorVersion: '1.5.0', quarantined: false,
  agentFacts: {
    eventType: 'earnings_recap', tickers: ['NVDA'],
    digest: 'Legacy digest.', chainId: 'L1',
  },
});

describe('R4-M2 clause 1 — legacy', () => {
  it('all epoch fields absent → LEGACY (renderable)', () => {
    const cls = classifyWireEntry(legacy());
    expect(cls).toEqual({ state: LEGACY, schemaVersion: null, reason: null });
    expect(isRenderableWireEntry(legacy())).toBe(true);
  });

  it('explicit nulls are Amendment-J "missing" too (legacy sentinel convention)', () => {
    const e = stamped({}, { schemaVersion: null, digestRendererVersion: null });
    expect(classifyWireEntry(e).state).toBe(LEGACY);
  });
});

describe('R4-M2 clause 2 — recognized version, completeness vs THAT set', () => {
  it('the current transaction shape → STAMPED, carrying its version', () => {
    const cls = classifyWireEntry(stamped());
    expect(cls).toEqual({ state: STAMPED, schemaVersion: WIRE_SCHEMA_VERSION, reason: null });
  });

  it.each(['eventType', 'digest', 'digestRendererVersion', 'validatorVersion'])(
    'recognized version missing required fact %s → MALFORMED',
    (key) => {
      const cls = classifyWireEntry(stamped({}, { [key]: undefined }));
      expect(cls.state).toBe(MALFORMED);
      expect(cls.reason).toBe(`missing_required:${key}`);
    }
  );

  it('an empty-string digest is not a renderable digest → MALFORMED', () => {
    const cls = classifyWireEntry(stamped({}, { digest: '' }));
    expect(cls).toMatchObject({ state: MALFORMED, reason: 'invalid_digest' });
  });
});

describe('R4-M2 clause 3 — fail closed', () => {
  it('unknown-but-present schemaVersion → VERSION_SKIP at the version guard, before the field-set check', () => {
    // Field-set deliberately GUTTED: if the completeness check ran first,
    // this would read malformed. R4-M2 pins the order.
    const e = stamped({}, { schemaVersion: 'wire-9.9', digest: undefined, eventType: undefined });
    const cls = classifyWireEntry(e);
    expect(cls.state).toBe(VERSION_SKIP);
    expect(cls.reason).toBe('unrecognized_schema_version:wire-9.9');
  });

  it('unknown-but-present digestRendererVersion → VERSION_SKIP (never rendered on trust)', () => {
    const cls = classifyWireEntry(stamped({}, { digestRendererVersion: '9.9.9' }));
    expect(cls).toMatchObject({ state: VERSION_SKIP, reason: 'unrecognized_renderer_version:9.9.9' });
  });

  it('partial epoch stamp (renderer version without schema version) → MALFORMED', () => {
    const cls = classifyWireEntry(stamped({}, { schemaVersion: undefined }));
    expect(cls).toMatchObject({ state: MALFORMED, reason: 'partial_epoch_stamp' });
  });

  it('non-entries and factless entries → MALFORMED', () => {
    expect(classifyWireEntry(null).reason).toBe('not_an_entry');
    expect(classifyWireEntry('nope').reason).toBe('not_an_entry');
    expect(classifyWireEntry({ storyId: 'x' }).reason).toBe('missing_agent_facts');
    expect(classifyWireEntry({ storyId: 'x', agentFacts: null }).reason).toBe('missing_agent_facts');
  });
});

describe('P2-30 permutation — cross-version consumers, never malformed', () => {
  // The injection surface stands in for a consumer built at a different
  // version epoch; production call sites pass nothing.
  const V17_REGISTRY = Object.freeze({
    'wire-1.6': RECOGNIZED_WIRE_SCHEMA_VERSIONS['wire-1.6'],
    'wire-1.7': Object.freeze({ requiredFacts: Object.freeze(['eventType', 'digest']) }),
  });

  it('a complete vN (wire-1.6) entry at a vN+1 consumer that RETAINS vN → STAMPED-vN', () => {
    const cls = classifyWireEntry(stamped(), { schemaVersions: V17_REGISTRY });
    expect(cls).toEqual({ state: STAMPED, schemaVersion: 'wire-1.6', reason: null });
  });

  it('a vN+1 (wire-1.7) entry at THIS consumer (which does not know it) → VERSION_SKIP, never MALFORMED', () => {
    const e = stamped({}, { schemaVersion: 'wire-1.7' });
    const cls = classifyWireEntry(e);
    expect(cls.state).toBe(VERSION_SKIP);
    expect(cls.state).not.toBe(MALFORMED);
  });

  it('a complete vN entry at a consumer that DROPPED vN from its registry → VERSION_SKIP, never MALFORMED', () => {
    const droppedV16 = { 'wire-1.7': V17_REGISTRY['wire-1.7'] };
    const cls = classifyWireEntry(stamped(), { schemaVersions: droppedV16 });
    expect(cls.state).toBe(VERSION_SKIP);
    expect(cls.state).not.toBe(MALFORMED);
  });
});

describe('registry self-consistency (the unregistered-bump tripwire)', () => {
  it('the live WIRE_SCHEMA_VERSION is registered with a non-empty required set', () => {
    const spec = RECOGNIZED_WIRE_SCHEMA_VERSIONS[WIRE_SCHEMA_VERSION];
    expect(spec).toBeDefined();
    expect(spec.requiredFacts.length).toBeGreaterThan(0);
  });

  it('the live WIRE_DIGEST_RENDERER_VERSION is recognized', () => {
    expect(RECOGNIZED_WIRE_DIGEST_RENDERER_VERSIONS).toContain(WIRE_DIGEST_RENDERER_VERSION);
  });

  it('every registered required set demands the epoch + trust fields consumers rely on', () => {
    for (const spec of Object.values(RECOGNIZED_WIRE_SCHEMA_VERSIONS)) {
      expect(spec.requiredFacts).toContain('digest');
      expect(spec.requiredFacts).toContain('eventType');
    }
  });
});

describe('renderability helpers', () => {
  it('exactly LEGACY and STAMPED are renderable', () => {
    expect(isRenderableState(LEGACY)).toBe(true);
    expect(isRenderableState(STAMPED)).toBe(true);
    expect(isRenderableState(VERSION_SKIP)).toBe(false);
    expect(isRenderableState(MALFORMED)).toBe(false);
  });
});
