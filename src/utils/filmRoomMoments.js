// src/utils/filmRoomMoments.js
//
// Film Room Build B (spec docs/specs/FILM_ROOM_BUILD_B_CARD_SPEC_V1_20261010.md
// §2 "the list"; shared contract §4; Amendment G RG-6) — THE MOMENTS: one pure,
// zero-import helper the server (api/film-room/card.js, counter.js) and the
// screen (src/screens/filmRoomV2) both import, so a card can only ever name a
// moment the screen listed, and the screen only ever lists what the endpoint
// would accept.
//
// It turns a day's STORED `tags.items` (api/_utils/filmTape/tapeTags.js) into
// moments: consecutive tagged checks of one symbol — tagged checks whose
// tickSeqs follow one another — form one moment,
//   { situationId, symbol, fromTickSeq, toTickSeq, from, to, checks }
// where `from` / `to` are the first and last tagged check's instants and
// `checks` is how many tagged checks the moment holds. An item with no tickSeq
// cannot be next to another, so it is a moment of its own.
//
// ORDER (ruling 15; RG-6): by `checks`, longest first; ties go to the earlier
// moment (by `from`, then by symbol so the order is total).
//
// IT READS NOTHING BUT THE STORED ITEMS. It never orders by outcome, and it
// returns no price, score or result — nothing known only afterwards. A moment's
// number of checks is a derived number (RG-3).

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);
const seqOf = (v) => (Number.isInteger(v) ? v : null);
const msOf = (v) => { if (typeof v !== 'string') return null; const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; };

/** The keys a moment carries — exactly these, in this order (the one-door rows assert it). */
export const MOMENT_KEYS = Object.freeze(['situationId', 'symbol', 'fromTickSeq', 'toTickSeq', 'from', 'to', 'checks']);

/**
 * The moments of a day's stored tag items (see the header).
 *
 * @param {object[]} items  `tags.items` as stored: `{ situationId, symbol, tickSeq, at, … }`
 * @returns {{ situationId: string, symbol: string, fromTickSeq: number|null, toTickSeq: number|null, from: string|null, to: string|null, checks: number }[]}
 */
export function momentsOf(items) {
  const rows = (Array.isArray(items) ? items : []).filter((i) => isObj(i) && str(i.situationId) && str(i.symbol));
  // per (situation, symbol), in check order: by tickSeq where known, else by instant, stable otherwise
  const groups = new Map();
  rows.forEach((it, k) => {
    const key = `${it.situationId}\u0000${it.symbol}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ it, k });
  });
  const moments = [];
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const sa = seqOf(a.it.tickSeq); const sb = seqOf(b.it.tickSeq);
      if (sa !== null && sb !== null && sa !== sb) return sa - sb;
      const ma = msOf(a.it.at); const mb = msOf(b.it.at);
      if (ma !== null && mb !== null && ma !== mb) return ma - mb;
      return a.k - b.k;
    });
    let open = null;
    for (const { it } of list) {
      const seq = seqOf(it.tickSeq);
      const at = str(it.at);
      if (open && seq !== null && open.toTickSeq !== null && seq === open.toTickSeq + 1) {
        open.toTickSeq = seq;
        open.to = at;
        open.checks += 1;
      } else {
        open = { situationId: it.situationId, symbol: it.symbol, fromTickSeq: seq, toTickSeq: seq, from: at, to: at, checks: 1 };
        moments.push(open);
      }
    }
  }
  moments.sort((a, b) => {
    if (a.checks !== b.checks) return b.checks - a.checks;
    const ma = msOf(a.from); const mb = msOf(b.from);
    if (ma !== null && mb !== null && ma !== mb) return ma - mb;
    if (ma === null && mb !== null) return 1;
    if (ma !== null && mb === null) return -1;
    return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
  });
  return moments;
}

/** Is `m` one of the day's moments — the same situation, symbol and from–to tickSeqs, exactly? */
export function sameMoment(a, b) {
  return isObj(a) && isObj(b) && a.situationId === b.situationId && a.symbol === b.symbol
    && seqOf(a.fromTickSeq) === seqOf(b.fromTickSeq) && seqOf(a.toTickSeq) === seqOf(b.toTickSeq);
}

/** The anchor a moment is addressable by on the screen: `moment-<symbol>-<fromTickSeq>-<toTickSeq>`. */
export const momentAnchor = (m) => `moment-${m.symbol}-${m.fromTickSeq ?? 'x'}-${m.toTickSeq ?? 'x'}`;
