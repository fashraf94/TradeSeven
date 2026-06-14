// src/utils/tournamentActionMachine.js
//
// P7 (B) — the optimistic-vs-authoritative state machine for a tournament
// mutation (a flip or a claim). Pure + node-clean so the lifecycle is
// unit-tested without a DOM.
//
// Contract (client-honest / server-authoritative):
//   idle --submit--> pending (optional optimistic value shown)
//   pending --confirm(result)--> confirmed   (success ONLY after the server's 200)
//   pending --reject(error)--> error         (optimistic CLEARED = rolled back)
//   * --reset--> idle
//
// `confirmed` is reachable ONLY via an explicit `confirm` event — there is no
// edge that reaches success from `submit` alone, so the UI can never claim
// success the server didn't grant. On `reject` the optimistic value is dropped
// (rollback); the authoritative subscription (subscribeGroup/subscribeClaims)
// is what ultimately reconciles the displayed state.

export const ACTION_STATUS = Object.freeze({
  IDLE: 'idle',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ERROR: 'error',
});

export function initialActionState() {
  return { status: ACTION_STATUS.IDLE, optimistic: null, result: null, error: null };
}

export function actionReducer(state, event) {
  switch (event?.type) {
    case 'submit':
      return { status: ACTION_STATUS.PENDING, optimistic: event.optimistic ?? null, result: null, error: null };
    case 'confirm':
      // Only valid out of PENDING — a stray confirm cannot fabricate success.
      if (state.status !== ACTION_STATUS.PENDING) return state;
      return { status: ACTION_STATUS.CONFIRMED, optimistic: state.optimistic, result: event.result ?? null, error: null };
    case 'reject':
      // Rollback: the optimistic value is discarded; the error is surfaced.
      return { status: ACTION_STATUS.ERROR, optimistic: null, result: null, error: event.error ?? null };
    case 'reset':
      return initialActionState();
    default:
      return state;
  }
}

/** True while a submit is in flight (button should be disabled). */
export function isActionPending(state) {
  return state?.status === ACTION_STATUS.PENDING;
}
