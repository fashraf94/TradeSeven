// api/_utils/leanOverrides.test.js
//
// Release 2 PR-a foundations — battle.leanOverrides[] machinery (spec Phase 1
// item 5 / changelog #6). This file's REAL import of leanOverrides.js (whose
// graph pulls src/data/archetypeAdjustments.js) is the BUILD_RULES §4
// dependency-surface guard — never mock it.

import { describe, it, expect } from 'vitest';
import { computeOpposedLeans, buildLeanOverrideRecords, activeOverridesFor } from './leanOverrides.js';
import { resolveControls } from './controlPromptRenderer.js';

const DIRECTIVE = Object.freeze({
  directiveThreadId: 'thread-1',
  adjustmentId: 'CP-05', // guardian: tighten the stop — opposes CP-04 (CP-G1)
  canonicalTextVersion: 1,
});

describe('computeOpposedLeans — directed directive→lean edges via conflict groups', () => {
  it('finds the equipped lean(s) the directive opposes', () => {
    const equipped = [
      { adjustmentId: 'CP-04', version: 1, text: 'Widen the stop slightly (more patience on good positions)' },
      { adjustmentId: 'CP-01', version: 1, text: 'Raise the quality bar (demand cleaner fundamentals)' },
    ];
    const opposed = computeOpposedLeans('guardian', 'CP-05', equipped);
    expect(opposed.map((l) => l.adjustmentId)).toEqual(['CP-04']);
  });

  it('returns [] when nothing opposes (no shared group / no groups / unknown archetype)', () => {
    expect(computeOpposedLeans('guardian', 'CP-01', [{ adjustmentId: 'CP-04', version: 1 }])).toEqual([]);
    expect(computeOpposedLeans('momentum_chaser', 'TF-01', [{ adjustmentId: 'TF-02', version: 1 }])).toEqual([]);
    expect(computeOpposedLeans('unknown_arch', 'CP-05', [{ adjustmentId: 'CP-04', version: 1 }])).toEqual([]);
  });
});

describe('buildLeanOverrideRecords — one confirmation covers every opposed lean', () => {
  it('builds one record per opposed lean, all bound to the directive instance + both versions', () => {
    const records = buildLeanOverrideRecords({
      directive: DIRECTIVE,
      opposedLeans: [
        { adjustmentId: 'CP-04', version: 1 },
        { adjustmentId: 'CP-06', version: 1 }, // synthetic second opposition (overlapping-groups case)
      ],
      confirmedAt: '2026-07-10T00:00:00.000Z',
    });
    expect(records).toEqual([
      {
        directiveInstanceId: 'thread-1',
        directiveAdjustmentId: 'CP-05',
        directiveVersion: 1,
        leanId: 'CP-04',
        leanVersion: 1,
        confirmedAt: '2026-07-10T00:00:00.000Z',
      },
      {
        directiveInstanceId: 'thread-1',
        directiveAdjustmentId: 'CP-05',
        directiveVersion: 1,
        leanId: 'CP-06',
        leanVersion: 1,
        confirmedAt: '2026-07-10T00:00:00.000Z',
      },
    ]);
  });

  it('returns [] for a directive without instance id / adjustment id (nothing to bind to)', () => {
    expect(buildLeanOverrideRecords({ directive: { adjustmentId: 'CP-05' }, opposedLeans: [{ adjustmentId: 'CP-04' }], confirmedAt: 't' })).toEqual([]);
    expect(buildLeanOverrideRecords({ directive: { directiveThreadId: 't1' }, opposedLeans: [{ adjustmentId: 'CP-04' }], confirmedAt: 't' })).toEqual([]);
  });
});

describe('structural expiry — overrides live and die with their directive instance', () => {
  const records = buildLeanOverrideRecords({
    directive: DIRECTIVE,
    opposedLeans: [{ adjustmentId: 'CP-04', version: 1 }],
    confirmedAt: 't0',
  });

  it('activeOverridesFor matches only the binding instance', () => {
    expect(activeOverridesFor('thread-1', records)).toHaveLength(1);
    expect(activeOverridesFor('thread-2', records)).toEqual([]); // superseded
    expect(activeOverridesFor(null, records)).toEqual([]);       // no directive
  });

  it('end-to-end with the shared renderer: the overridden lean suppresses beside its directive and RESUMES under a successor', () => {
    const leans = [{ adjustmentId: 'CP-04', version: 1, text: 'Widen the stop slightly (more patience on good positions)' }];
    const modes = { archetypeIntegrityMode: 'enforce', standingLeansEnabled: true };
    const directive = { text: 'Tighten the stop slightly (exit a touch sooner on damage)', directiveThreadId: 'thread-1' };

    const withDirective = resolveControls({ modes, directive, standingLeans: leans, leanOverrides: records });
    expect(withDirective.directive.effective).toBe(directive);
    expect(withDirective.leans.effective).toEqual([]); // suppressed beside its overriding directive

    const successor = { text: 'Raise the quality bar (demand cleaner fundamentals)', directiveThreadId: 'thread-2' };
    const afterSupersede = resolveControls({ modes, directive: successor, standingLeans: leans, leanOverrides: records });
    expect(afterSupersede.leans.effective).toEqual(leans); // stale override inert — the lean resumed
  });
});
