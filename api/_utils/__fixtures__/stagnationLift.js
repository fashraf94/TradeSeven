// api/_utils/__fixtures__/stagnationLift.js
//
// Film Room B1.1 (Amendment C, RC-2) — THE ONE INTENDED CHANGE to a frozen
// capture fixture: the permanent tick record's new `risk.stagnation`, what the
// stagnation rule read for each held symbol. A frozen golden lifts it — and only
// it — from the live capture writes, then compares every remaining byte with
// the fixture captured before B1.1. The lifted records come back so the suite
// can assert where they appear: on every tick record whose risk verdicts the
// tick computed, over exactly those symbols, and nowhere else.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isTickWrite = (w) => isObj(w) && typeof w.path === 'string' && w.path.includes('/ticks/') && isObj(w.data);

/**
 * @param {Array<Array<{ path: string, data: object }>>} capture  the capture writes (db.__captureWrites)
 * @returns {{ rest: Array, lifted: Array<{ path: string, stagnation: object }> }}
 */
export function liftStagnationRecord(capture) {
  const lifted = [];
  const rest = (Array.isArray(capture) ? capture : []).map((batch) => (Array.isArray(batch) ? batch.map((w) => {
    if (!isTickWrite(w) || !isObj(w.data.risk) || !Object.hasOwn(w.data.risk, 'stagnation')) return w;
    const { stagnation, ...risk } = w.data.risk;
    lifted.push({ path: w.path, stagnation });
    return { ...w, data: { ...w.data, risk } };
  }) : batch));
  return { rest, lifted };
}

/** The symbols each frozen tick record holds verdicts for, by path — where the lifted records must be. */
export function verdictSymbolsByPath(capture) {
  const out = {};
  for (const batch of Array.isArray(capture) ? capture : []) {
    for (const w of Array.isArray(batch) ? batch : []) {
      if (!isTickWrite(w) || !isObj(w.data.risk?.verdicts)) continue;
      const symbols = Object.keys(w.data.risk.verdicts).sort();
      if (symbols.length) out[w.path] = symbols;
    }
  }
  return out;
}
