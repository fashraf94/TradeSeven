// api/_utils/tempoDialBands.js
//
// Release 2 (Fenced Customization Bundle V1.1) — the tempo-dial BAND TABLE
// (spec changelog #13: version-bound, fail-closed, lands dark).
//
// PROVISIONAL VALUES — copied from the B4 acceptance report §D
// (docs/20260704_KNOB_CALIBRATION_B4_ACCEPTANCE_REPORT.md:61-77 @ 4a0f43e):
// bands [Measured | Standard | Aggressive] with multipliers 0.7 / 1.0 / 1.3,
// verified there across the full archetype × dial cross-product on TOTAL
// tempo. Per that report ("band multipliers are authored FROM this report"),
// these are the WS2 starting definition, NOT founder-locked finals — final
// promotion is gated on the post-Release-1 real-data cross-check. The table
// is machine-safe to land dark because nothing consumes it until
// TEMPO_DIAL_ENABLED turns on AND the version binding below matches.
//
// VERSION BINDING (fail closed): forKnobConfigVersion pins the knob-table
// generation these multipliers were calibrated against
// (KNOB_CONFIG_VERSION = 2 @ agentArchetypeConfig.js:30 — Release 1's
// B4-tuned values). KNOB_CONFIG_VERSION is monotonic (a Release-1 rollback
// deploys v3, never reuses v2), so ANY knob change — forward or rollback —
// breaks the binding and the clamp resolves effective='standard' with
// suppressionReason 'band_version_mismatch' until the bands are re-derived
// and re-pinned. This is what resolves master spec §9 Q5: the constants land
// dark and can never modulate a knob generation they weren't calibrated for.
//
// DIRECTION-AWARE SEMANTICS (B4 §D rider 3 — the unambiguous definition):
// higher band → more tempo, so capacity fields multiply and resistance
// fields divide. The apply map lives in tempoDialClamp.js; safety/structural
// fields are never touched at any band.

export const TEMPO_DIAL_BANDS = Object.freeze({
  forKnobConfigVersion: 2,
  multipliers: Object.freeze({
    measured: 0.7,
    standard: 1.0,
    aggressive: 1.3,
  }),
});

export const VALID_TEMPO_VALUES = Object.freeze(['measured', 'standard', 'aggressive']);
