// api/_utils/practiceField/errors.js
//
// Practice Field T1a-1 — the typed error every accounting invariant throws. Thrown INSIDE a transaction callback it
// aborts the transaction with nothing written (the Admin SDK and the harness both commit only when the callback
// returns). Zero imports.

export class PracticeFieldError extends Error {
  /**
   * @param {string} code    a stable machine code (`recon_failed`, `no_eligible_mark`, `fill_mark_not_snapshot`, …)
   * @param {object} [detail] plain data naming what failed
   */
  constructor(code, detail = {}) {
    super(`practice_field:${code}${detail && Object.keys(detail).length ? ` ${safeJson(detail)}` : ''}`);
    this.name = 'PracticeFieldError';
    this.code = code;
    this.detail = detail;
    this.practiceField = true;
  }
}

function safeJson(v) {
  try { return JSON.stringify(v); } catch { return ''; }
}

/** Is `err` a PracticeFieldError (optionally of one code)? */
export function isPracticeFieldError(err, code = null) {
  return !!err && err.practiceField === true && (code === null || err.code === code);
}
