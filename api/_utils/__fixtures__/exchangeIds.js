// api/_utils/__fixtures__/exchangeIds.js
//
// The Research Record Extension (7 Nov 2026; docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md
// §4): every exchange NEWLY written to a host session's `exchanges[]` carries
// `exchangeId: randomUUID()`. The goldens captured on main before it hash every
// store write, so their traces are compared with those ids taken out — each one
// CHECKED first (a v4 UUID, one per exchange a write adds, none twice), so the
// rest of the trace must still equal main's capture byte for byte and the id
// itself is still pinned.
//
// Self-contained on purpose (no import of the code under test): the golden files
// that use it keep running unchanged on a main checkout for a recapture.

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The exchange objects an `exchanges` value holds: a plain array, or the double's arrayUnion sentinel. */
function exchangeListOf(v) {
  if (Array.isArray(v)) return v;
  if (isPlainObject(v) && v.__op === 'arrayUnion' && Array.isArray(v.items)) return v.items;
  return null;
}

/**
 * A deep copy of `value` with every `exchangeId` inside an `exchanges` list
 * removed. Throws when one is not a v4 UUID. Returns the copy, the ids taken out
 * (in walk order) and how many exchange objects carried none.
 *
 * @returns {{ value: any, ids: string[], withoutId: number }}
 */
export function stripExchangeIds(value) {
  const ids = [];
  let withoutId = 0;
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (!isPlainObject(v)) return v;
    const out = {};
    for (const [k, child] of Object.entries(v)) {
      const list = k === 'exchanges' ? exchangeListOf(child) : null;
      if (!list) { out[k] = walk(child); continue; }
      const stripped = list.map((ex) => {
        if (!isPlainObject(ex)) return walk(ex);
        if (!Object.hasOwn(ex, 'exchangeId')) { withoutId += 1; return walk(ex); }
        const { exchangeId, ...rest } = ex;
        if (typeof exchangeId !== 'string' || !UUID_V4_RE.test(exchangeId)) throw new Error(`exchangeId is not a v4 UUID: ${JSON.stringify(exchangeId)}`);
        ids.push(exchangeId);
        return walk(rest);
      });
      out[k] = Array.isArray(child) ? stripped : { ...walk(child), items: stripped };
    }
    return out;
  };
  return { value: walk(value), ids, withoutId };
}

/**
 * The store writes with their minted exchange ids taken out, after checking
 * that EVERY exchange a write adds carries one and that the exchanges one
 * write adds carry distinct ids. (The same id may recur in a LATER write: a
 * retried transaction re-sends the same exchange object.)
 */
export function writesWithoutMintedIds(writes) {
  const ids = [];
  const out = (Array.isArray(writes) ? writes : []).map((w) => {
    const { value, ids: own, withoutId } = stripExchangeIds(w);
    if (withoutId !== 0) throw new Error(`${withoutId} newly written exchange(s) carry no exchangeId`);
    if (new Set(own).size !== own.length) throw new Error('two exchanges of one write share an exchangeId');
    ids.push(...own);
    return value;
  });
  return { writes: out, ids };
}
