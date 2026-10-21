// api/_utils/callRecords/swappable.js
//
// Cockpit Build 2b — ONE "can this name come in?" test (contract Amendment D,
// D-7; spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-2). Every place a replacement
// name is shown, minted or filed asks this module: the mint's exit
// counterparts and its replacement options (candidate.js), the answer
// endpoint's chosen name and the agent's own counterpart at filing
// (callActions.js), the bench sheet (api/agent/cockpit-bench.js) and the
// retire step's "came into the book another way" (retire.js).
//
// A RESTATEMENT, NEVER AN EDIT. The swap's own validation is the fenced
// executor's (BUILD_RULES §1: read and cited, never edited). Its exported
// `validateTradeDecision` (api/_utils/agentSwapExecution.js:34-97) checks, for
// a SWAP, the five facts below; swappable.test.js runs both on one table so
// the two cannot drift apart silently:
//
//   pick_is_symbol      IN is OUT                     agentSwapExecution.js:57-58
//   pick_already_held   IN occupies a book slot       agentSwapExecution.js:59-61 (findAssetInPortfolio :520-533)
//   pick_not_on_bench   IN on no list the swap takes  agentSwapExecution.js:49-54 (findAssetInBench :538-547;
//                       — the persisted bench stocks, the bench crypto, the
//                       watchlist's hot bench; the equipped watchlist alone
//                       does not count)
//   pick_locked         the bench row's cooldownUntil agentSwapExecution.js:64-70 (the hot bench has none)
//                       is after the instant
//   pick_wrong_class    stock for crypto or back      agentSwapExecution.js:72-80 (hot-bench names are stocks)
//
// The order above is the order of the checks, and it matters: a name that
// came INTO the book another way is no longer on the bench either, so
// `pick_already_held` is decided first — retire.js treats it as a book
// reason (D-6) and `pick_not_on_bench` as none.
//
// TWO READINGS, STATED FOR REVIEW:
//   · the instant. The executor reads its own wall clock (`new Date()`, :67);
//     this module takes `atMs`, so the mint asks at the check's
//     `promptBuiltAt` (the seam C-3 froze its sets at), the endpoint and the
//     sheet at `Date.now()`;
//   · the outgoing row's class. D-7 reads it "as the swap reads it": the
//     executor's transaction marks the outgoing row crypto by `isCrypto ===
//     true` OR a `.CC` suffix (agentSwapExecution.js:362); the validator
//     compares the raw `isCrypto` fields (:76-77). The two agree whenever the
//     rows carry the boolean (the parity table does); a row with no `isCrypto`
//     field reads as a stock here. With no outgoing row in the book the
//     validator skips the class check (:73) — so does this module.
//
// Pure, Node-clean and browser-clean (the answers.js precedent): no import.

export const SWAPPABLE_REASONS = Object.freeze(['pick_is_symbol', 'pick_already_held', 'pick_not_on_bench', 'pick_locked', 'pick_wrong_class']);

const TIERS = Object.freeze(['star', 'core', 'support']);
const CRYPTO_SUFFIX = /\.CC$/i;
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** The book's row for a symbol, first in tier order (findAssetInPortfolio's walk). */
function bookRowOf(battle, symbol) {
  const portfolio = battle?.portfolio;
  for (const tier of TIERS) {
    const rows = Array.isArray(portfolio?.[tier]) ? portfolio[tier] : [];
    const row = rows.find((r) => r?.symbol === symbol);
    if (row) return row;
  }
  return null;
}

/** The persisted bench's row for a symbol: the stocks first, then the crypto slot (findAssetInBench). */
function benchRowOf(battle, symbol) {
  const bench = battle?.portfolio?.bench;
  const stock = (Array.isArray(bench?.stocks) ? bench.stocks : []).find((s) => s?.symbol === symbol);
  if (stock) return stock;
  return bench?.crypto?.symbol === symbol ? bench.crypto : null;
}

const onHotBench = (battle, symbol) => (Array.isArray(battle?.watchlist?.hotBench) ? battle.watchlist.hotBench : []).includes(symbol);

/** Is a bench row cooldown-locked at `atMs`? An unreadable instant or cooldown locks nothing (the executor's `new Date(...) > new Date()`). */
export function benchRowLockedAt(row, atMs) {
  if (!row?.cooldownUntil || !finite(atMs)) return false;
  const until = Date.parse(row.cooldownUntil);
  return Number.isFinite(until) && until > atMs;
}

/**
 * Can IN come in for OUT in slot `slot` at `atMs` (D-7)?
 *
 * @param {{ battle: object, out: string, slot?: string, inSymbol: string, atMs: number }} p
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canComeIn({ battle, out, slot = null, inSymbol, atMs }) {
  if (!nonEmpty(inSymbol)) return { ok: false, reason: 'pick_not_on_bench' };
  if (inSymbol === out) return { ok: false, reason: 'pick_is_symbol' };
  if (bookRowOf(battle, inSymbol)) return { ok: false, reason: 'pick_already_held' };
  const benchRow = benchRowOf(battle, inSymbol);
  const hot = !benchRow && onHotBench(battle, inSymbol);
  if (!benchRow && !hot) return { ok: false, reason: 'pick_not_on_bench' };
  if (benchRow && benchRowLockedAt(benchRow, atMs)) return { ok: false, reason: 'pick_locked' };
  // The outgoing row: the call's slot first (a symbol is held once), else wherever the book holds it.
  const slotRows = TIERS.includes(slot) && Array.isArray(battle?.portfolio?.[slot]) ? battle.portfolio[slot] : [];
  const outRow = slotRows.find((r) => r?.symbol === out) ?? bookRowOf(battle, out);
  if (outRow) {
    const outCrypto = outRow.isCrypto === true || CRYPTO_SUFFIX.test(out || '');
    const inCrypto = benchRow ? benchRow.isCrypto === true : false;
    if (outCrypto !== inCrypto) return { ok: false, reason: 'pick_wrong_class' };
  }
  return { ok: true };
}

/**
 * Every name on the swap's lists, in ROSTER ORDER — the persisted bench
 * stocks, then the bench crypto, then the hot bench — deduped. The lists the
 * executor reads (findAssetInBench, the hot-bench match), not the universe.
 */
export function swapListNames(battle) {
  const bench = battle?.portfolio?.bench;
  const out = [];
  const seen = new Set();
  const push = (s) => { if (nonEmpty(s) && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const row of Array.isArray(bench?.stocks) ? bench.stocks : []) push(row?.symbol);
  push(bench?.crypto?.symbol);
  for (const s of Array.isArray(battle?.watchlist?.hotBench) ? battle.watchlist.hotBench : []) push(s);
  return out;
}

/** The names that pass `canComeIn` for OUT in `slot` at `atMs`, in roster order. */
export function swappableNames({ battle, out, slot = null, atMs }) {
  return swapListNames(battle).filter((inSymbol) => canComeIn({ battle, out, slot, inSymbol, atMs }).ok);
}

/**
 * The battle's book and swap lists as a frozen projection — what the mint
 * reads at the model seam instead of a live battle that a later swap in the
 * same check may have refreshed (C-3: frozen at promptBuiltAt). Only the
 * fields this module reads are kept.
 */
export function freezeSwapBook(battle) {
  const rowOf = (r) => Object.freeze({
    symbol: nonEmpty(r?.symbol) ? r.symbol : null,
    ...(typeof r?.isCrypto === 'boolean' ? { isCrypto: r.isCrypto } : {}),
    ...(r?.cooldownUntil ? { cooldownUntil: r.cooldownUntil } : {}),
  });
  const portfolio = battle?.portfolio;
  const tiers = {};
  for (const tier of TIERS) tiers[tier] = Object.freeze((Array.isArray(portfolio?.[tier]) ? portfolio[tier] : []).filter(Boolean).map(rowOf));
  const bench = portfolio?.bench;
  return Object.freeze({
    portfolio: Object.freeze({
      ...tiers,
      bench: Object.freeze({
        stocks: Object.freeze((Array.isArray(bench?.stocks) ? bench.stocks : []).filter(Boolean).map(rowOf)),
        crypto: bench?.crypto && typeof bench.crypto === 'object' ? rowOf(bench.crypto) : null,
      }),
    }),
    watchlist: Object.freeze({ hotBench: Object.freeze((Array.isArray(battle?.watchlist?.hotBench) ? battle.watchlist.hotBench : []).filter(nonEmpty)) }),
  });
}
