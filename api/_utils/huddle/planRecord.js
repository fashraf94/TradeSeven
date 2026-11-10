// api/_utils/huddle/planRecord.js
//
// Huddle S1 — the plan as the worker publishes it (spec V1.1 §3.2; C §C2, §C15). The
// model's `planProposal` is validated once (planTemplates.validatePlan) under the
// archetype equipped at generation; the result is both `proposed` (never mutated) and the
// first `current`. The validation CONTEXT is frozen on the record (`plan.context`): the
// session universe, the morning closes the ±25 % band is measured against, and the
// session's eligible events with their fixed labels — so confirm re-validates an edit
// against exactly what the plan was built from, server-side, without re-gathering.
// Amendment E §E2 adds the session window, the events outside it, and the names that
// report after today's close or before the next open (NO_ADDS_TO_BEFORE_REPORT's).

import { validatePlan, revisionOf, TEMPLATE_VERSION } from './planTemplates.js';

/**
 * @param {{ proposal: object, universe: Iterable<string>, closes: Map<string, number|null>,
 *           events: { eligible: Map<string, object>, untimedIds: Set<string> }, archetype: string|null }} p
 * @returns {{ plan: object, drops: object[] }}
 */
export function buildPlanAtGeneration({ proposal, universe, closes, events, archetype, window = null }) {
  const universeSet = new Set(universe);
  const v = validatePlan(proposal, { universe: universeSet, closes, events, archetype, window });
  const closesObj = {};
  for (const [sym, close] of closes instanceof Map ? closes : []) {
    if (typeof close === 'number' && Number.isFinite(close)) closesObj[sym] = close;
  }
  const plan = {
    templateVersion: TEMPLATE_VERSION,
    status: 'proposed',
    proposed: v.current,
    current: v.current,
    revision: revisionOf(v.current),
    editCount: 0,
    dissent: v.dissent,
    archetypeAtGeneration: archetype ?? null,
    archetypeSupported: v.archetypeSupported,
    context: {
      universe: [...universeSet].sort(),
      closes: closesObj,
      eligibleEvents: [...(events?.eligible?.values?.() || [])].map((e) => ({ eventId: e.eventId, label: e.label, source: e.source, etDate: e.etDate })),
      untimedEventIds: [...(events?.untimedIds || [])].sort(),
      window: window ? { open: window.open, close: window.close } : null,
      outsideSessionEventIds: [...(events?.outsideSessionIds || [])].sort(),
      reportTickers: [...(events?.reportTickers?.keys?.() || events?.reportTickers || [])].sort(),
      untimedReportTickers: [...(events?.untimedReportTickers || [])].sort(),
    },
    confirmations: [],
    confirmed: null,
    applications: [],
  };
  return { plan, drops: v.drops.map((d) => ({ ...d, stage: 'plan' })) };
}
