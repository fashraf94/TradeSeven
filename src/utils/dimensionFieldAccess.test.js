// Unit tests for the canonical dimension-field access layer and the
// consumers that were migrated to it in Phase 4.5. Covers:
//   - reader / writer primitives (read canonical, legacy fallback,
//     relocated-field reads, unknown path warnings)
//   - M2 regression: new-schema-only dv flows through
//     dimensionsToDirectives and dimensionsToGuardrails with correct
//     user values (not stale defaults)
//   - backward compat: legacy-only dv still produces correct output via
//     the registry's legacy-fallback paths
//   - registry completeness: every field in DIMENSION_DEFAULTS is
//     represented in FIELD_REGISTRY (either as canonical or legacy)

import { describe, it, expect, vi } from 'vitest';
// Real flag value — behavior-branches the profitTarget enforcement-label pin
// below (Ask 3; the label tracks the executor flag).
import { PROFIT_TARGET_EXECUTOR_ENABLED } from '../config/featureFlags.js';

vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  collection: () => ({}),
  writeBatch: () => ({ set: () => {}, commit: async () => {} }),
  serverTimestamp: () => null,
}));

const {
  FIELD_REGISTRY,
  readDimensionField,
  writeDimensionField,
  getFieldMetadata,
} = await import('./dimensionFieldAccess.js');

const {
  DIMENSION_DEFAULTS,
  cloneDefaults,
  dimensionsToDirectives,
  dimensionsToGuardrails,
  dimensionsToRuleSnapshots,
} = await import('./dimensionMapper.js');

// ─────────────────────────────────────────────────────────────
// Reader / writer primitives
// ─────────────────────────────────────────────────────────────

describe('readDimensionField', () => {
  it('returns canonical value when present', () => {
    const dv = { riskPosture: { stopLossPct: 5 } };
    expect(readDimensionField(dv, 'stopLossPct')).toBe(5);
  });

  it('falls back to legacy when canonical is absent', () => {
    const dv = { riskPosture: { stopLoss: 7 } };
    expect(readDimensionField(dv, 'stopLossPct')).toBe(7);
  });

  it('prefers canonical when both present (canonical wins)', () => {
    const dv = { riskPosture: { stopLossPct: 5, stopLoss: 99 } };
    expect(readDimensionField(dv, 'stopLossPct')).toBe(5);
  });

  it('returns undefined when neither path yields a value', () => {
    expect(readDimensionField({ riskPosture: {} }, 'stopLossPct')).toBeUndefined();
    expect(readDimensionField({}, 'stopLossPct')).toBeUndefined();
    expect(readDimensionField(null, 'stopLossPct')).toBeUndefined();
  });

  it('handles relocated fields (addToWinnersEnabled ← momentumSensitivity.addToWinners)', () => {
    const dv = { momentumSensitivity: { addToWinners: true } };
    expect(readDimensionField(dv, 'addToWinnersEnabled')).toBe(true);
  });

  it('handles renamed-dimension fields (earningsAvoidanceDays ← macroAwareness.earningsAvoidance)', () => {
    const dv = { macroAwareness: { earningsAvoidance: 3 } };
    expect(readDimensionField(dv, 'earningsAvoidanceDays')).toBe(3);
  });

  it('warns on unknown path and returns undefined', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readDimensionField({}, 'notARealField')).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('notARealField'));
    warnSpy.mockRestore();
  });
});

describe('writeDimensionField', () => {
  it('writes to canonical location only', () => {
    const dv = { riskPosture: { stopLoss: 10 } };
    const next = writeDimensionField(dv, 'stopLossPct', 5);
    expect(next.riskPosture.stopLossPct).toBe(5);
    expect(next.riskPosture.stopLoss).toBe(10);  // legacy untouched
  });

  it('creates missing dimension when writing', () => {
    const next = writeDimensionField({}, 'stopLossPct', 5);
    expect(next.riskPosture.stopLossPct).toBe(5);
  });

  it('is immutable — original object untouched', () => {
    const dv = { riskPosture: { stopLoss: 10 } };
    writeDimensionField(dv, 'stopLossPct', 5);
    expect(dv.riskPosture.stopLossPct).toBeUndefined();
    expect(dv.riskPosture.stopLoss).toBe(10);
  });

  it('relocated-field writes land at the new canonical dimension', () => {
    // addToWinnersEnabled canonical is positionSizing, legacy is momentumSensitivity
    const next = writeDimensionField({}, 'addToWinnersEnabled', true);
    expect(next.positionSizing.addToWinnersEnabled).toBe(true);
    expect(next.momentumSensitivity).toBeUndefined();
  });

  it('warns on unknown path, returns input unchanged', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dv = { riskPosture: {} };
    const next = writeDimensionField(dv, 'notReal', 1);
    expect(next).toBe(dv);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('getFieldMetadata', () => {
  it('returns the registry entry for a known path', () => {
    const meta = getFieldMetadata('stopLossPct');
    expect(meta.canonical).toEqual({ dimension: 'riskPosture', field: 'stopLossPct' });
    expect(meta.legacy).toEqual([{ dimension: 'riskPosture', field: 'stopLoss' }]);
  });

  it('returns undefined for unknown paths', () => {
    expect(getFieldMetadata('notReal')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// M2 regression: new-schema-only dv through deploy readers
// ─────────────────────────────────────────────────────────────

describe('M2 regression — deploy readers honor new-canonical writes', () => {
  // Construct a dv with ONLY canonical keys (no legacy fallback present).
  // Pre-Phase-4.5, dimensionsToGuardrails read legacy keys exclusively and
  // returned stale defaults for any Phase 4 bundle. These tests lock the fix.
  const newOnlyDv = {
    riskPosture: { stopLossPct: 5, trailingStopPct: 7 },
    entryAggression: {
      rsiCeiling: 60,
      volumeConfirmEnabled: true,
      fundamentalFloor: 50,
      momentumThresholdPct: 3,
    },
    exitDiscipline: {
      profitTargetPct: 12,
      timeExitDays: 4,
      technicalExitEnabled: true,
    },
    sectorStrategy: {
      maxSectorWeightPct: 25,
      sectorDriftTolerancePct: 8,
      rebalanceOnDrift: true,
    },
    eventRisk: { earningsAvoidanceDays: 4 },
    positionSizing: {
      maxPositionWeightPct: 18,
      cashDeploymentTriggerPct: 12,
      addToWinnersEnabled: true,
      cutUnderperformersEnabled: true,
    },
  };

  it('dimensionsToGuardrails returns user values, not defaults', () => {
    const guardrails = dimensionsToGuardrails(newOnlyDv);
    const stopLoss = guardrails.find((g) => g.type === 'stopLoss');
    expect(stopLoss.value).toBe(5);  // NOT default 8
    const trailingStop = guardrails.find((g) => g.type === 'trailingStop');
    expect(trailingStop.value).toBe(7);  // NOT default 10
    const maxSector = guardrails.find((g) => g.type === 'maxSectorWeight');
    expect(maxSector.value).toBe(25);  // NOT default 30
    const maxPos = guardrails.find((g) => g.type === 'maxPosition');
    expect(maxPos.value).toBe(18);  // NOT default 15
    const profit = guardrails.find((g) => g.type === 'profitTarget');
    expect(profit.value).toBe(12);  // NOT default 15
  });

  it('honesty (Tier 1): maxPosition is labeled soft, matching the engine no-op — never promises hard enforcement', () => {
    const guardrails = dimensionsToGuardrails(newOnlyDv);
    const maxPos = guardrails.find((g) => g.type === 'maxPosition');
    // maxPosition is not a SUPPORTED_GUARDRAIL_SHAPE; the engine skips it
    // (skipped_incompatible). Labeling it 'hard' was the lie this relabel fixes.
    expect(maxPos.enforcement).toBe('soft');
    // The genuinely-enforced shapes stay hard.
    expect(guardrails.find((g) => g.type === 'stopLoss').enforcement).toBe('hard');
    expect(guardrails.find((g) => g.type === 'trailingStop').enforcement).toBe('hard');
    expect(guardrails.find((g) => g.type === 'maxSectorWeight').enforcement).toBe('hard');
    // Ask 3 (§9, behavior-branched so the flip PR reconciles nothing here):
    // profitTarget's label tracks its executor flag — soft while the executor
    // is dark, hard the moment it flips with Ask 1 (F11's one-flag rule).
    expect(guardrails.find((g) => g.type === 'profitTarget').enforcement)
      .toBe(PROFIT_TARGET_EXECUTOR_ENABLED ? 'hard' : 'soft');
  });

  it('dimensionsToDirectives emits user-driven text, not defaults', () => {
    const dirs = dimensionsToDirectives(newOnlyDv);
    const stopLoss = dirs.find((d) => d.id === 'dir-stop-loss');
    expect(stopLoss.text).toContain('5%');
    const trailing = dirs.find((d) => d.id === 'dir-trailing-stop');
    expect(trailing.text).toContain('7%');
    const profit = dirs.find((d) => d.id === 'dir-profit-target');
    expect(profit.text).toContain('12%');
    const earnings = dirs.find((d) => d.id === 'dir-earnings-avoid');
    expect(earnings.text).toContain('4 trading days');
    const addWinners = dirs.find((d) => d.id === 'dir-add-to-winners');
    expect(addWinners).toBeTruthy();  // relocated field resolved
  });
});

// ─────────────────────────────────────────────────────────────
// Backward compat — legacy-only dv still works
// ─────────────────────────────────────────────────────────────

describe('Backward compat — legacy-only dv flows through deploy readers', () => {
  const legacyOnlyDv = {
    riskPosture: { stopLoss: 6, trailingStop: 8 },
    entryAggression: {
      rsiUpper: 62,
      volumeConfirm: true,
      fundamentalFloor: 45,
    },
    exitDiscipline: {
      profitTarget: 18,
      timeExit: 6,
      technicalExit: false,
    },
    sectorStrategy: {
      maxSectorWeight: 28,
      sectorDriftTolerance: 10,
      rebalanceOnDrift: true,
    },
    momentumSensitivity: {
      momentumThreshold: 4,
      addToWinners: true,
      cutUnderperformers: false,
    },
    macroAwareness: {
      earningsAvoidance: 5,
      fomcDefensive: false,
      benchmarkGapResponse: 'off',
    },
    positionSizing: {
      maxPosition: 22,
      cashDeploymentTrigger: 14,
    },
  };

  it('dimensionsToGuardrails reads legacy fallback paths', () => {
    const guardrails = dimensionsToGuardrails(legacyOnlyDv);
    expect(guardrails.find((g) => g.type === 'stopLoss').value).toBe(6);
    expect(guardrails.find((g) => g.type === 'trailingStop').value).toBe(8);
    expect(guardrails.find((g) => g.type === 'maxSectorWeight').value).toBe(28);
    expect(guardrails.find((g) => g.type === 'maxPosition').value).toBe(22);
    expect(guardrails.find((g) => g.type === 'profitTarget').value).toBe(18);
  });

  it('dimensionsToDirectives surfaces legacy-only values correctly', () => {
    const dirs = dimensionsToDirectives(legacyOnlyDv);
    expect(dirs.find((d) => d.id === 'dir-stop-loss').text).toContain('6%');
    expect(dirs.find((d) => d.id === 'dir-earnings-avoid').text).toContain('5 trading days');
    expect(dirs.find((d) => d.id === 'dir-add-to-winners')).toBeTruthy();  // relocated
  });

  it('dimensionsToRuleSnapshots emits correctly from legacy-only dv', () => {
    const snaps = dimensionsToRuleSnapshots(legacyOnlyDv);
    const sx01 = snaps.find((s) => s.sourceRef === 'sx-01');
    expect(sx01.paramValues.pct).toBe(6);
    const sr04 = snaps.find((s) => s.sourceRef === 'sr-04');
    expect(sr04).toBeTruthy();  // relocated fallback resolved
  });
});

// ─────────────────────────────────────────────────────────────
// Registry completeness
// ─────────────────────────────────────────────────────────────

describe('FIELD_REGISTRY completeness', () => {
  it('every DIMENSION_DEFAULTS field appears somewhere in the registry', () => {
    // Build a set of (dimension, field) pairs that are covered — either as
    // canonical or as a legacy fallback.
    const covered = new Set();
    for (const entry of Object.values(FIELD_REGISTRY)) {
      covered.add(`${entry.canonical.dimension}.${entry.canonical.field}`);
      for (const loc of entry.legacy) {
        covered.add(`${loc.dimension}.${loc.field}`);
      }
    }

    // Exceptions: fields that exist in DIMENSION_DEFAULTS for Phase 2 Haiku
    // output compatibility but aren't routed through the registry. Document
    // them here so the test flags any NEW accidental gap.
    const knownDuplicates = new Set([
      // Phase 2 Haiku emits momentumSensitivity.momentumThresholdPct as a
      // duplicate of entryAggression.momentumThresholdPct (vestigial per
      // spec §4.5). Registry only recognizes the legacy-name variant.
      'momentumSensitivity.momentumThresholdPct',
    ]);

    const missing = [];
    for (const [dim, dimDefaults] of Object.entries(DIMENSION_DEFAULTS)) {
      for (const field of Object.keys(dimDefaults)) {
        const path = `${dim}.${field}`;
        if (!covered.has(path) && !knownDuplicates.has(path)) {
          missing.push(path);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('every registry entry has a resolvable canonical location', () => {
    for (const [pathName, entry] of Object.entries(FIELD_REGISTRY)) {
      expect(entry.canonical.dimension).toBeTruthy();
      expect(entry.canonical.field).toBe(pathName.split('.').pop() || pathName);
      // Canonical field names in the registry match the path key (our
      // convention — registry key = canonical field name).
      expect(entry.canonical.field).toBe(pathName);
    }
  });

  it('cloneDefaults() writes all registry-canonical fields to their expected locations', () => {
    const dv = cloneDefaults();
    for (const [, entry] of Object.entries(FIELD_REGISTRY)) {
      const { dimension, field } = entry.canonical;
      expect(dv[dimension]).toBeDefined();
      expect(dv[dimension]).toHaveProperty(field);
    }
  });
});
