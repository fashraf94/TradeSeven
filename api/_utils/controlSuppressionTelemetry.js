// api/_utils/controlSuppressionTelemetry.js
//
// Release 2 (Fenced Customization Bundle V1.1) — suppression telemetry
// BUILDERS (spec §3.4 item 6 / changelog #9). PURE: this module builds the
// event + the durable battle-doc record; it writes nothing. The Phase-2
// caller (the non-fenced eval cron, next to its renderer call) does:
//
//   const epochKey = computeEpochKey(modes);
//   if (shouldLogControlEpoch(battle.controlEpochLog, epochKey)) {
//     const event = buildControlEpochEvent({ ... });
//     console.log('[ControlEpoch]', JSON.stringify(event));       // structured event
//     await battleRef.update({                                     // durable record —
//       controlEpochLog: FieldValue.arrayUnion(                    // awaited, never a
//         buildControlEpochLogEntry(event),                        // silent catch(()=>{})
//       ),
//     });
//   }
//
// ONE event per battle + MODE-EPOCH — not per tick (spec changelog #9). An
// epoch is a period of constant mode-flag values for the battle: epochKey is
// derived from the modes tuple ONLY (deploySha rides as event metadata, so a
// redeploy with unchanged flags does NOT re-log). Round-trips DO re-log:
// shouldLogControlEpoch compares against the LAST log entry, so
// enforce → observe → enforce yields three entries — and the middle entry's
// suppressedDirectiveIds is exactly what deriveKilledDirectiveIds (in
// controlPromptRenderer.js) reads to keep the directive dead in epoch three
// (directives never resurrect; leans resume).
//
// LOG-ENTRY SHAPE CONTRACT (consumed by controlPromptRenderer.deriveKilledDirectiveIds):
//   { epochKey, modes, suppressedDirectiveIds: string[], suppressedLeanIds: string[], at }

/**
 * Deterministic mode-epoch key from the modes tuple.
 * @param {{archetypeIntegrityMode?: string, standingLeansEnabled?: boolean, tempoDialEnabled?: boolean}} modes
 */
export function computeEpochKey(modes = {}) {
  const integrity = typeof modes.archetypeIntegrityMode === 'string' ? modes.archetypeIntegrityMode : 'off';
  const leans = modes.standingLeansEnabled === true ? 'on' : 'off';
  const dial = modes.tempoDialEnabled === true ? 'on' : 'off';
  return `integrity=${integrity}|leans=${leans}|dial=${dial}`;
}

/**
 * True when the battle has not yet logged THIS epoch as its latest —
 * sequence-aware so mode round-trips re-log (see header) while repeat ticks
 * inside one epoch stay silent.
 *
 * @param {Array<{epochKey: string}>} controlEpochLog battle.controlEpochLog (ordered, append-only)
 * @param {string} epochKey
 */
export function shouldLogControlEpoch(controlEpochLog, epochKey) {
  const log = Array.isArray(controlEpochLog) ? controlEpochLog : [];
  if (log.length === 0) return true;
  return log[log.length - 1]?.epochKey !== epochKey;
}

/**
 * Build the structured per-epoch event (spec item 6 field set:
 * battleId, controlIds@versions, desired, effective, modes, deploySha,
 * knobConfigVersion, dialBandVersion, reason per control).
 *
 * `resolution` is the renderer's resolveControls() output — the SAME object
 * the prompt was built from, so telemetry can never disagree with what
 * actually rendered (display-agreement by construction).
 *
 * @param {Object} p
 * @param {string} p.battleId
 * @param {string} p.epochKey
 * @param {Object} p.modes                      the modes tuple the epoch key was derived from
 * @param {Object} p.resolution                 resolveControls() output
 * @param {{text: string, directiveThreadId: string, adjustmentId?: string, canonicalTextVersion?: number}|null} [p.directive]
 *   The persisted ACTIVE directive (pre-resolution), so suppressed controls still appear with desired='render'.
 * @param {Array<{adjustmentId: string, version?: number}>} [p.standingLeans]  persisted leans (pre-resolution)
 * @param {Object|null} [p.dialProvenance]      the tempo clamp's provenance object (PR-b), or null
 * @param {string|null} [p.deploySha]
 * @param {number|null} [p.knobConfigVersion]
 * @param {number|null} [p.dialBandVersion]
 * @param {string} [p.at]                       ISO timestamp (injectable for tests)
 */
export function buildControlEpochEvent({
  battleId,
  epochKey,
  modes = {},
  resolution,
  directive = null,
  standingLeans = [],
  dialProvenance = null,
  deploySha = null,
  knobConfigVersion = null,
  dialBandVersion = null,
  at = new Date().toISOString(),
}) {
  const descriptors = resolution?.suppressionDescriptors ?? [];
  const suppressedByKey = new Map(
    descriptors.map((d) => [`${d.target}:${d.id}`, d.reason]),
  );

  const controls = [];
  if (directive && directive.directiveThreadId) {
    const reason = suppressedByKey.get(`directive:${directive.directiveThreadId}`) ?? null;
    controls.push({
      target: 'directive',
      id: directive.directiveThreadId,
      // Additive Release-2 fields on the directive record; legacy records → null.
      adjustmentId: directive.adjustmentId ?? null,
      version: directive.canonicalTextVersion ?? null,
      desired: 'render',
      effective: reason ? 'suppressed' : 'rendered',
      ...(reason ? { reason } : {}),
    });
  }
  for (const lean of Array.isArray(standingLeans) ? standingLeans : []) {
    if (!lean || !lean.adjustmentId) continue;
    const reason = suppressedByKey.get(`lean:${lean.adjustmentId}`) ?? null;
    controls.push({
      target: 'lean',
      id: lean.adjustmentId,
      version: typeof lean.version === 'number' ? lean.version : null,
      desired: 'render',
      effective: reason ? 'suppressed' : 'rendered',
      ...(reason ? { reason } : {}),
    });
  }

  return {
    type: 'control_mode_epoch',
    battleId,
    epochKey,
    modes: {
      archetypeIntegrityMode: modes.archetypeIntegrityMode ?? 'off',
      standingLeansEnabled: modes.standingLeansEnabled === true,
      tempoDialEnabled: modes.tempoDialEnabled === true,
    },
    controls,
    // PR-b desired-vs-effective for the dial rides the SAME event (the tempo
    // clamp's provenance object, verbatim), or null pre-PR-b / dial-less.
    tempo: dialProvenance,
    deploySha,
    knobConfigVersion,
    dialBandVersion,
    at,
  };
}

/**
 * The compact durable battle-doc record for one epoch event. Shape contract
 * consumed by controlPromptRenderer.deriveKilledDirectiveIds (see header).
 */
export function buildControlEpochLogEntry(event) {
  const controls = Array.isArray(event?.controls) ? event.controls : [];
  return {
    epochKey: event.epochKey,
    modes: event.modes,
    suppressedDirectiveIds: controls
      .filter((c) => c.target === 'directive' && c.effective === 'suppressed')
      .map((c) => c.id),
    suppressedLeanIds: controls
      .filter((c) => c.target === 'lean' && c.effective === 'suppressed')
      .map((c) => c.id),
    at: event.at,
  };
}
