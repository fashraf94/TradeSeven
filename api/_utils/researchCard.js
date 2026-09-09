// api/_utils/researchCard.js
//
// THE RESEARCH CARD, COMPOSED BY CODE — Phase C §2 / §3 (D-117). PURE.
//
// No model call. The `composeAnticipationNote` precedent (voiceLayerGrounding.js
// §5): the facts and their labels, written by code, so what the card says is
// what the platform holds and nothing is paraphrased into existence.
//
// THREE RULES, EACH PAID FOR BY A FINDING:
//
//   1. NULL-HONEST, EVERYWHERE (C-20 / hazard 1). An indicator whose window is
//      short renders NOTHING. `debate.js:145` prints `MACD histogram: negative`
//      on every call because its 30-calendar-day window never reaches MACD's
//      35-candle minimum and `0 > 0` is false — a default rendered as data. The
//      same short window reaches this composer, and the same indicators arrive
//      null; here they are simply absent lines. Widening the fetch is D-120's
//      separate fix and is NOT done here.
//   2. EVERY SECTION CARRIES ITS OWN PROVENANCE, and the two data classes never
//      share one (D-119). Technicals are labelled with the quote time and the
//      candle date; fundamentals with the mirror's `computedAt` DATE — never a
//      cadence word (hazard 13: the mirror moves on a weekday cron, so "weekly"
//      is false).
//   3. NOTHING FORWARD-LOOKING. No archetype lens (there is no field — item 12),
//      no recommendation, no forecast, no conviction, no `suggestedAction`, no
//      defence framing. `debate.js`'s eleven forecasting lines are not inputs.
//
// The card's label strings come from the zero-import src/data/decisionRecord.js,
// which the CLIENT renders from too, so the label and its number are one source
// (BUILD_RULES §9). The composed object is persisted verbatim on the exchange.

import {
  RESEARCH_EYEBROW,
  PLATFORM_DATA_LABEL,
  technicalsLabel,
  fundamentalsLabel,
  STANDING_ON_BENCH,
  STANDING_ON_WATCHLIST,
} from '../../src/data/decisionRecord.js';
import { UNIVERSE_PLACE } from '../../src/data/battleUniverse.js';
import { vintageDate } from './voiceLayerGrounding.js';
import { etTime } from '../../src/components/Dashboard/desk/deskCopy.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const money = (v) => (num(v) === null ? null : `$${v.toFixed(2)}`);

/**
 * EODHD's real-time `timestamp` IS UNIX SECONDS (marketDataCache.js:602 passes
 * `data.timestamp` straight through), and `new Date(seconds)` is 1970 — a quote
 * time of `7:00 PM` on a January night in 1970, printed as this afternoon's. The
 * unit is disambiguated by magnitude, which is the only thing the field carries:
 * anything below 1e12 cannot be a millisecond instant in this century.
 */
export function quoteInstant(timestamp) {
  const t = num(timestamp);
  if (t === null || t <= 0) return null;
  return new Date(t < 1e12 ? t * 1000 : t).toISOString();
}

/**
 * The candle date, as a CALENDAR DATE.
 *
 * EODHD's daily rows carry a bare `YYYY-MM-DD` (marketDataCache.js:235), and a
 * bare date parses as UTC MIDNIGHT — which, rendered in America/New_York the way
 * every other vintage on this screen is, is 8 PM the PREVIOUS DAY. `vintageDate`
 * is right for an instant and wrong for a calendar date, and a card that printed
 * `as of Sep 7` for the Sep 8 candle would be a dated lie in the one place the
 * card exists to be trusted. So a bare date is formatted as the date it says it
 * is; anything else (an instant) still goes through `vintageDate`.
 */
export function candleDateLabel(raw) {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      timeZone: 'UTC', month: 'short', day: 'numeric',
    });
  }
  return vintageDate(raw ?? null);
}

/**
 * The technicals section: one fact string per indicator the platform actually
 * computed. A null indicator contributes NOTHING — no line, no placeholder, no
 * "N/A". Returns null when the whole set is unavailable.
 */
export function composeTechnicals(indicators, price) {
  // `price` is marketDataCache's own object — `current`, `timestamp`, `fallback`
  // (marketDataCache.js:594-617) — with `candleDate` added by the route from
  // `daily[0].date`, the newest candle the indicators were computed over.
  const facts = [];
  const i = indicators || {};

  const rsi = num(i.rsi?.value);
  if (rsi !== null) facts.push(`RSI ${rsi}${i.rsi?.zone ? ` · ${i.rsi.zone}` : ''}`);

  // MACD: the VALUES, never a sign word derived from a default (hazard 1).
  if (num(i.macd?.histogram) !== null) {
    facts.push(`MACD ${i.macd.macd} · signal ${i.macd.signal} · histogram ${i.macd.histogram}`);
  }

  for (const [key, label] of [['sma20', 'SMA20'], ['sma50', 'SMA50'], ['sma200', 'SMA200']]) {
    const v = num(i.sma?.[key]);
    if (v !== null) facts.push(`${label} ${v}`);
  }
  for (const [key, label] of [['ema12', 'EMA12'], ['ema26', 'EMA26'], ['ema50', 'EMA50']]) {
    const v = num(i.ema?.[key]);
    if (v !== null) facts.push(`${label} ${v}`);
  }

  const bb = i.bollingerBands;
  if (num(bb?.upper) !== null && num(bb?.lower) !== null) {
    facts.push(`Bollinger ${bb.lower}–${bb.upper}${num(bb.percentB) !== null ? ` · %B ${bb.percentB}` : ''}`);
  }

  const atr = num(i.atr?.percent);
  if (atr !== null) facts.push(`ATR ${atr}%${i.atr?.regime ? ` · ${i.atr.regime}` : ''}`);

  const vp = i.volumeProfile;
  if (num(vp?.ratio) !== null) facts.push(`Volume ${vp.ratio}×${vp.tier ? ` · ${vp.tier}` : ''}`);

  // The quote is its own fact and says when it is a FALLBACK to the daily close
  // rather than a live print (marketDataCache.js:611-617) — the honest version
  // of the undated price debate.js:142 prints.
  const last = money(price?.current);
  if (last) facts.push(price?.fallback ? `Last ${last} · daily close` : `Last ${last}`);

  if (facts.length === 0) return null;
  return {
    facts,
    label: technicalsLabel({
      quoteTime: price?.fallback ? null : etTime(quoteInstant(price?.timestamp)),
      indicatorDate: candleDateLabel(price?.candleDate ?? null),
    }),
  };
}

/**
 * The fundamentals section, from the rankings mirror the cache brief already
 * carries. Null-honest field by field, and NULL WHOLE when the mirror carries
 * no `computedAt`: an undated fundamentals number is exactly the thing D-119
 * forbids, so it is not printed at all rather than printed bare.
 */
export function composeFundamentals(fundamentals) {
  const f = fundamentals;
  if (!f || typeof f !== 'object') return null;
  const label = fundamentalsLabel(vintageDate(f.computedAt ?? null));
  if (!label) return null;

  const facts = [];
  const pe = num(f.trailingPE?.value);
  if (pe !== null) {
    const med = num(f.trailingPE?.sectorMedian);
    facts.push(`P/E ${pe}${med !== null ? ` · sector median ${med}` : ''}`);
  }
  if (num(f.priceBookMRQ) !== null) facts.push(`P/B ${f.priceBookMRQ}`);
  if (num(f.revenueGrowthPct) !== null) facts.push(`Revenue growth ${f.revenueGrowthPct}%`);
  if (typeof f.marketCapClass === 'string' && f.marketCapClass) facts.push(`${f.marketCapClass}-cap`);
  if (num(f.earningsRevisions30d) !== null) facts.push(`EPS revisions 30d ${f.earningsRevisions30d}`);
  if (num(f.beatRate) !== null) facts.push(`Beat rate ${f.beatRate}%`);
  if (num(f.surpriseMagPercentile) !== null) facts.push(`Surprise magnitude ${f.surpriseMagPercentile}th pctile`);

  if (facts.length === 0) return null;
  return { facts, label };
}

/**
 * The standing: THE ROW'S OWN NUMBERS when the name is held — the same values
 * the board renders, read off the position, never recomputed (BUILD_RULES §9 —
 * no P&L is derived here, because the row's P&L is the row's) — or the ruled
 * absence line for a bench or watchlist name.
 */
export function composeStanding(place, position, deployedAt = null) {
  if (place === UNIVERSE_PLACE.BENCH) return { place, line: STANDING_ON_BENCH, facts: [] };
  if (place === UNIVERSE_PLACE.WATCHLIST) return { place, line: STANDING_ON_WATCHLIST, facts: [] };
  if (place !== UNIVERSE_PLACE.BOOK) return null;

  const facts = [];
  if (typeof position?.tier === 'string' && position.tier) facts.push(position.tier);
  // THE ROW'S OWN TWO FIELDS, in the row's own precedence: the board renders
  // `entryPrice={leftAsset.openPrice}` and `heldSince={leftAsset.swappedInAt ||
  // battle.activatedAt}` (AgentBattleScreen.jsx). Reading a different field, or
  // falling back differently, is how a card and the row it sits beside come to
  // print two entry prices for one piece (BUILD_RULES §9).
  const entry = money(position?.openPrice ?? position?.entryPrice ?? null);
  if (entry) facts.push(`Entry ${entry}`);
  const since = etTime(position?.swappedInAt ?? deployedAt ?? null);
  if (since) facts.push(`Held since ${since}`);
  return { place, line: null, facts };
}

/**
 * The whole card. Every section is presence-gated; a card with no technicals AND
 * no fundamentals is still a card — it says where the name stands and that the
 * platform holds nothing else on it, which is a true thing to show and the
 * honest alternative to a fabricated line.
 */
export function composeResearchCard({
  symbol,
  place,
  position = null,
  deployedAt = null,
  indicators = null,
  price = null,
  fundamentals = null,
  equipAvailable = false,
}) {
  return {
    symbol,
    eyebrow: RESEARCH_EYEBROW,
    // Sol C-4: the label is a FIELD OF THE CARD, so it travels with the numbers
    // it governs and cannot be left behind by a container that renders them.
    platformDataLabel: PLATFORM_DATA_LABEL,
    technicals: composeTechnicals(indicators, price),
    fundamentals: composeFundamentals(fundamentals),
    standing: composeStanding(place, position, deployedAt),
    // §3's door. D-54's forward path is Equip; hazard 7 is why this is a FLAG the
    // route computes rather than a promise the card makes: a name a rival agent
    // holds is kept out of the bench, so "Equip" is offered only where the route
    // established it is available.
    equip: equipAvailable === true,
  };
}
