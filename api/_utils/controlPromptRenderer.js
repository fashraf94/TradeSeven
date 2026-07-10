// api/_utils/controlPromptRenderer.js
//
// Release 2 (Fenced Customization Bundle V1.1) — the SHARED CONTROL RENDERER
// (spec §3.4 / changelog #10; fence-ADJACENT, fence-lite review of this
// contract gates Phase 2). Single source of truth for BOTH halves of the
// read-side guard:
//
//   1. RESOLUTION — which persisted customization controls (chat directive,
//      standing leans) actually reach a prompt under the current mode flags.
//   2. RENDERING — the exact prompt block text for whatever resolved.
//
// Both fenced assemblies (agentEvalPromptAssembly.js, agentPromptAssembly.js)
// and the non-fenced voice-layer directive reader (voiceLayerPrompt.js —
// PR-c scope addition, founder ruling 2026-07-10) consume the SAME
// resolveControls() result, so a control can never render in one surface
// while a sibling surface decides it is suppressed (the docs/BUILD_RULES.md
// §9 display-agreement rule, applied to prompts: one resolution, by
// construction).
//
// PURE + ZERO-IMPORT (the src/data/archetypeAdjustments.js pattern): callers
// project plain data in — this module never reads feature flags, Firestore,
// or fenced modules. The Phase-2 callers pass:
//   - modes:      { archetypeIntegrityMode, standingLeansEnabled } read from
//                 src/config/featureFlags.js AT THE CALL SITE.
//   - directive:  battle.directive already gated through isDirectiveActive()
//                 AT THE CALL SITE (expiry stays owned by directiveUtils.js;
//                 importing it here would create a require cycle through the
//                 fenced eval assembly).
//   - standingLeans: battle.agentContext.standingLeans (the post-revalidation
//                 snapshot; [{ adjustmentId, version, text }]).
//   - leanOverrides: battle.leanOverrides ([{ directiveInstanceId,
//                 directiveVersion, leanId, leanVersion, confirmedAt }]).
//   - killedDirectiveIds: deriveKilledDirectiveIds(battle.controlEpochLog).
//
// SUPPRESSION SEMANTICS (spec changelog #9 — epoch rules):
//   - A directive renders ONLY under ARCHETYPE_INTEGRITY_MODE === 'enforce'.
//     Anything else → suppressed ('mode_not_enforce'), data kept.
//   - NO RESURRECTION: a directive suppressed by a mode flip is dead for the
//     battle even if the mode returns to 'enforce' ('epoch_killed') — the
//     durable mark is the battle's controlEpochLog (written by the Phase-2
//     telemetry caller; see controlSuppressionTelemetry.js).
//   - Leans RESUME: they are durable desired state. They suppress only while
//     STANDING_LEANS_ENABLED is false ('leans_disabled') or while an ACTIVE
//     rendering directive overrides them ('overridden_by_directive').
//   - Overrides expire with their directive STRUCTURALLY: an override binds
//     to directiveInstanceId === directive.directiveThreadId, so a killed,
//     suppressed, expired, or superseded directive can never keep a lean
//     suppressed (spec changelog #6).

// Release 2 PR-d (WS3, HELD behind the changelog-#12 gate) — THE canonical
// watchlist-framing sentence set (spec §5.1, adopted VERBATIM from review;
// founder ruling D4 2026-07-10: ONE constant, strategy-side only — both
// agentPromptAssembly blocks + the tournamentAgentBoards copy consume THIS
// export; no eval-side block exists (deferred with the refusal engine), and
// no copy anywhere implies refusal). Replaces the per-site "eligibility
// nudge" phrasing whose over-weighting WS3 measured: the watchlist changes
// ATTENTION, never eligibility or deterministic controls.
export const WATCHLIST_FRAMING_TEXT =
  'USER WATCHLIST. Give these names priority attention, but do not infer a trade requirement. '
  + 'Evaluate them under the same archetype criteria and guardrails as every other candidate. '
  + 'When a watched name ranks poorly or lacks sufficient data, state this in your reasoning. '
  + 'The watchlist changes attention, not eligibility or deterministic controls.';

export const SUPPRESSION_REASONS = Object.freeze({
  MODE_NOT_ENFORCE: 'mode_not_enforce',
  EPOCH_KILLED: 'epoch_killed',
  LEANS_DISABLED: 'leans_disabled',
  OVERRIDDEN_BY_DIRECTIVE: 'overridden_by_directive',
  // The active directive was minted from the SAME adjustment id as the
  // equipped lean — the directive already carries the identical canonical
  // sentence, so the lean suppresses for the battle (rendering both would
  // double the emphasis of one instruction). No override confirmation is
  // involved: there is no contradiction to confirm, just deduplication.
  DUPLICATE_OF_DIRECTIVE: 'duplicate_of_directive',
  MALFORMED: 'malformed',
});

/**
 * Derive the no-resurrection set from the battle's controlEpochLog (the
 * durable per-battle record the telemetry caller appends one entry to per
 * mode-epoch). Any directiveThreadId ever logged as suppressed stays dead
 * for the battle. Leans are deliberately NOT derived here — they resume.
 *
 * @param {Array<{suppressedDirectiveIds?: string[]}>} controlEpochLog
 * @returns {string[]} unique killed directiveThreadIds
 */
export function deriveKilledDirectiveIds(controlEpochLog) {
  const killed = new Set();
  for (const entry of Array.isArray(controlEpochLog) ? controlEpochLog : []) {
    for (const id of Array.isArray(entry?.suppressedDirectiveIds) ? entry.suppressedDirectiveIds : []) {
      if (typeof id === 'string' && id) killed.add(id);
    }
  }
  return [...killed];
}

/**
 * THE single resolution function (spec changelog #10). Pure.
 *
 * @param {Object} p
 * @param {{archetypeIntegrityMode?: string, standingLeansEnabled?: boolean}} [p.modes]
 * @param {{text: string, directiveThreadId: string, adjustmentId?: string|null}|null} [p.directive]
 *   The ACTIVE battle.directive (caller pre-gates isDirectiveActive) or null.
 * @param {Array<{adjustmentId: string, version: number, text: string}>} [p.standingLeans]
 * @param {Array<{directiveInstanceId: string, leanId: string}>} [p.leanOverrides]
 * @param {Array<Object>} [p.controlEpochLog]
 *   battle.controlEpochLog verbatim — the no-resurrection kill set derives
 *   INTERNALLY from it, so a caller cannot hold the epoch invariant wrong by
 *   forgetting the derivation. (killedDirectiveIds remains as an explicit
 *   override for tests/advanced callers and wins when provided.)
 * @param {string[]} [p.killedDirectiveIds]
 * @returns {{
 *   directive: {effective: Object|null},
 *   leans: {effective: Array<Object>},
 *   suppressionDescriptors: Array<{target: 'directive'|'lean', id: string, version?: number|null, reason: string}>,
 * }}
 */
export function resolveControls({
  modes = {},
  directive = null,
  standingLeans = [],
  leanOverrides = [],
  controlEpochLog = undefined,
  killedDirectiveIds = undefined,
} = {}) {
  const integrityMode = typeof modes.archetypeIntegrityMode === 'string' ? modes.archetypeIntegrityMode : 'off';
  const leansEnabled = modes.standingLeansEnabled === true;
  const killed = new Set(
    Array.isArray(killedDirectiveIds)
      ? killedDirectiveIds
      : deriveKilledDirectiveIds(controlEpochLog),
  );
  const suppressionDescriptors = [];

  // ---- Directive resolution (enforce-only + no-resurrection) ----
  let effectiveDirective = null;
  const directiveWellFormed =
    directive && typeof directive === 'object' &&
    typeof directive.text === 'string' && directive.text &&
    typeof directive.directiveThreadId === 'string' && directive.directiveThreadId;
  if (directive && !directiveWellFormed) {
    suppressionDescriptors.push({
      target: 'directive',
      id: directive?.directiveThreadId || 'unknown',
      reason: SUPPRESSION_REASONS.MALFORMED,
    });
  } else if (directiveWellFormed) {
    if (integrityMode !== 'enforce') {
      suppressionDescriptors.push({
        target: 'directive',
        id: directive.directiveThreadId,
        reason: SUPPRESSION_REASONS.MODE_NOT_ENFORCE,
      });
    } else if (killed.has(directive.directiveThreadId)) {
      suppressionDescriptors.push({
        target: 'directive',
        id: directive.directiveThreadId,
        reason: SUPPRESSION_REASONS.EPOCH_KILLED,
      });
    } else {
      effectiveDirective = directive;
    }
  }

  // ---- Lean resolution (flag-gated + override suppression; leans resume) ----
  const effectiveLeans = [];
  const overrides = Array.isArray(leanOverrides) ? leanOverrides : [];
  for (const lean of Array.isArray(standingLeans) ? standingLeans : []) {
    // ONE descriptor shape for every lean suppression (this is the Phase-2
    // telemetry contract surface — a reason-dependent shape would break
    // consumers that assume one shape per target).
    const suppressLean = (reason) => suppressionDescriptors.push({
      target: 'lean',
      id: lean?.adjustmentId || 'unknown',
      version: typeof lean?.version === 'number' ? lean.version : null,
      reason,
    });
    const wellFormed =
      lean && typeof lean === 'object' &&
      typeof lean.adjustmentId === 'string' && lean.adjustmentId &&
      typeof lean.text === 'string' && lean.text;
    if (!wellFormed) {
      suppressLean(SUPPRESSION_REASONS.MALFORMED);
      continue;
    }
    if (!leansEnabled) {
      suppressLean(SUPPRESSION_REASONS.LEANS_DISABLED);
      continue;
    }
    // Override suppression binds to the RENDERING directive instance only —
    // a suppressed/killed/superseded directive's overrides are inert, so the
    // lean resumes (spec changelog #6: overrides expire with their directive).
    const overridden = effectiveDirective && overrides.some(
      (o) => o && o.directiveInstanceId === effectiveDirective.directiveThreadId && o.leanId === lean.adjustmentId,
    );
    if (overridden) {
      suppressLean(SUPPRESSION_REASONS.OVERRIDDEN_BY_DIRECTIVE);
      continue;
    }
    // Same-id deduplication: a directive minted from the lean's OWN
    // adjustment id already renders the identical canonical sentence —
    // conflict groups self-exclude (no override edge exists), so without
    // this the one instruction would render twice at double emphasis.
    if (effectiveDirective && effectiveDirective.adjustmentId && effectiveDirective.adjustmentId === lean.adjustmentId) {
      suppressLean(SUPPRESSION_REASONS.DUPLICATE_OF_DIRECTIVE);
      continue;
    }
    effectiveLeans.push(lean);
  }

  return {
    directive: { effective: effectiveDirective },
    leans: { effective: effectiveLeans },
    suppressionDescriptors,
  };
}

/**
 * The eval-assembly directive block. BYTE-EXACT to the block the fenced
 * agentEvalPromptAssembly.js renders today (its lines 938-943 @ 4a0f43e) —
 * PR-c swaps the call site in, and the enforce-state output must not move by
 * a single byte (off-state invariant list, spec Build Rule 4).
 *
 * @param {{text: string, directiveThreadId: string}} directive
 * @returns {string|null}
 */
export function renderDirectiveBlock(directive) {
  if (!directive || !directive.text || !directive.directiveThreadId) return null;
  return `ACTIVE DIRECTIVE (from your Coach):
"${directive.text}"
threadId: ${directive.directiveThreadId}
If your next trade is influenced by this directive, include directiveThreadId: "${directive.directiveThreadId}" in your submit_trade_decision response.`;
}

/**
 * The standing-leans block (net-new — renders only once STANDING_LEANS_ENABLED
 * is on AND leans survive resolution; dark until the Release-4 staged walk).
 * Precedence-ladder framing: leans are rung-4 core-safe bounded modulation —
 * subordinate to platform safety (rung 1), archetype identity, and an active
 * directive.
 *
 * @param {Array<{text: string}>} leans resolved effective leans
 * @returns {string|null}
 */
export function renderLeansBlock(leans) {
  const list = (Array.isArray(leans) ? leans : []).filter((l) => l && typeof l.text === 'string' && l.text);
  if (list.length === 0) return null;
  return [
    'STANDING LEANS (user-equipped persistent adjustments):',
    ...list.map((l) => `- "${l.text}"`),
    'Apply these as standing leans within your archetype\'s core identity — they tune your execution at the margin and never override your archetype\'s rules, platform safety limits, or an active directive.',
  ].join('\n');
}

/**
 * Convenience composer: one resolution → the two named blocks + descriptors.
 * Blocks are plain strings with no leading/trailing blank lines (both fenced
 * assemblies join parts with '\n\n'); each assembly pushes only the blocks it
 * owns (eval: directive + leans; strategy: leans).
 */
export function renderControlBlocks(resolution) {
  const directiveBlock = resolution?.directive?.effective
    ? renderDirectiveBlock(resolution.directive.effective)
    : null;
  const leansBlock = renderLeansBlock(resolution?.leans?.effective);
  return {
    directiveBlock,
    leansBlock,
    suppressionDescriptors: resolution?.suppressionDescriptors ?? [],
  };
}

export default resolveControls;
