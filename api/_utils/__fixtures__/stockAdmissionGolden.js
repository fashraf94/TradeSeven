// Test-only comparison for BaggerBomb stock thresholds v2, Ruling 6 (the
// tournamentSettlementGolden.js precedent). The immutable deploy goldens stay
// unchanged: they were captured from main with the admission selector false.
// With it shipped true, a tiered full-day creation reads the server control
// document once, before any other creation read; with no document (these
// fixtures' world) it then creates exactly the legacy battle. Remove ONLY that
// asserted read — exactly `count` of them, exactly that path — and keep every
// other read, query, write, response, model request, transaction and final
// document byte-exact.
export const STOCK_ADMISSION_CONTROL_READ = 'stockThresholdControl/admission';

/** Scenarios whose deploy reaches a tiered full-day creation (one control read). */
export const STOCK_ADMISSION_CONTROL_READS = Object.freeze({
  self_select_ready_over_activated: 1,
  self_select_due_no_ready: 1,
  self_select_no_equip: 1,
  self_select_uncommitted_list: 1,
  self_select_existing_active_battle: 0,
  tournament_prescribed_with_ready_idea: 0,
});

export function stockAdmissionControlReadStripped(capture, count) {
  const reads = capture.store.reads.filter(p => p === STOCK_ADMISSION_CONTROL_READ).length;
  const sequenced = capture.store.sequence.filter(e => e.read === STOCK_ADMISSION_CONTROL_READ).length;
  if (reads !== count || sequenced !== count) throw Error(`Unexpected stock admission control read count: ${reads}/${sequenced}, expected ${count}`);
  if (capture.store.writes.some(w => w.path === STOCK_ADMISSION_CONTROL_READ || w.path?.startsWith('stockThresholdInputs/'))) throw Error('A legacy deploy wrote stock admission state');
  return { ...capture, store: { ...capture.store,
    reads: capture.store.reads.filter(p => p !== STOCK_ADMISSION_CONTROL_READ),
    sequence: capture.store.sequence.filter(e => e.read !== STOCK_ADMISSION_CONTROL_READ),
  } };
}
