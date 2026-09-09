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
  STANDING_PROVENANCE,
} from '../../src/data/decisionRecord.js';
import { UNIVERSE_PLACE } from '../../src/data/battleUniverse.js';
import { vintageDate } from './voiceLayerGrounding.js';
// `etStamp` — "Fri 3:45 PM ET" — not `etTime`'s bare "3:45 PM" (review A-3). The
// card is persisted in the tape and re-read days later, and a Friday close read
// on a Sunday must not say "this afternoon". The card is the one surface that
// exists to be trusted about vintage.
import { etStamp } from '../../src/components/Dashboard/desk/deskCopy.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// 0 is NOT a price: `marketDataCache` uses it as its own no-data sentinel
// (`current: data.close || data.previousClose || 0`), so admitting it would
// print `Last $0.00` as though it were a quote — the hazard-1 class this module
// exists to prevent, one level down (review A-7a).
const money = (v) => (num(v) === null || v <= 0 ? null : `$${v.toFixed(2)}`);

// `quoteInstant` (the EODHD seconds-vs-milliseconds disambiguator) came OUT with
// the uncached real-time fetch it existed for: the card no longer reads
// `price.timestamp`, so a function guarding a field nobody passes would be dead
// code pretending to be a guard.

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

// ==================== BUILD_RULES §9 — THE WORD COMES FROM THE PRINTED NUMBER ====================
//
// `calculateRSI` returns `value` ROUNDED to 2dp and `zone` derived from the RAW
// value; `calculateATR` and `calculateVolumeProfile` split the same way. So a raw
// RSI of 69.9997 arrives as `{ value: 70, zone: 'neutral' }`, and a card printing
// both prints the overbought threshold value beside the neutral word — the
// "RSI-rounds-before-zoning" family §9 is named after, on the first surface that
// renders a number and its word together.
//
// The words below are therefore re-derived HERE, from the value the card
// actually prints. The thresholds are the upstream functions' own, restated at
// the one place the pair is rendered; the upstream `zone`/`regime`/`tier` fields
// are deliberately NOT used. Fixing it upstream would change what the decider
// and the debate route see, which is out of this build's scope.

// The thresholds are the upstream functions' OWN, copied exactly
// (technicalCalculations.js `calculateRSI`, `calculateATR`,
// `calculateVolumeProfile`) — the only change is the value they are applied to.
const rsiZone = (v) => (v >= 70 ? 'overbought' : v <= 30 ? 'oversold' : 'neutral');
const atrRegime = (v) => (v > 4 ? 'extreme' : v > 3 ? 'high' : v > 1.5 ? 'normal' : 'low');
const volumeTier = (v) => (
  v > 4 ? 'CLIMAX'
    : v >= 2.5 ? 'INSTITUTIONAL'
      : v >= 1.25 ? 'ELEVATED'
        : v >= 0.75 ? 'NORMAL'
          : v >= 0.5 ? 'LOW'
            : 'VERY_LOW'
);

/**
 * The technicals section: one fact string per indicator the platform actually
 * computed. A null indicator contributes NOTHING — no line, no placeholder, no
 * "N/A". Returns null when the whole set is unavailable.
 */
export function composeTechnicals(indicators, price) {
  // `price` is the ROUTE's composed quote: `{ current, asOf }` from the cache
  // brief, or `{ current, fromClose: true }` from the newest daily close, plus
  // `candleDate` — the candle the indicators were computed over.
  const facts = [];
  const i = indicators || {};

  const rsi = num(i.rsi?.value);
  if (rsi !== null) facts.push(`RSI ${rsi} · ${rsiZone(rsi)}`);

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
  if (atr !== null) facts.push(`ATR ${atr}% · ${atrRegime(atr)}`);

  const vp = i.volumeProfile;
  if (num(vp?.ratio) !== null) facts.push(`Volume ${vp.ratio}× · ${volumeTier(vp.ratio)}`);

  // The quote, from ONE of two sources, each carrying its own date and never
  // mixed: the cache's 15-minute price at the cache doc's vintage, or the newest
  // daily close said to be a close. Neither costs an external call (hazard 2).
  const last = money(price?.current);
  if (last) facts.push(price?.fromClose ? `Last ${last} · daily close` : `Last ${last}`);

  if (facts.length === 0) return null;
  return {
    facts,
    label: technicalsLabel({
      // `etStamp`, not `etTime` (review A-3): a weekday and a zone, because this
      // card is persisted and re-read days later, and a Friday close must not
      // read as "this afternoon" on a Sunday.
      quoteTime: price?.fromClose ? null : etStamp(price?.asOf ?? null),
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
  // The unit and the sign, as `buildFundamentalsLine` and `fundamentalsRender`
  // both render the SAME field — a bare number reads as a count (review A-6).
  if (num(f.earningsRevisions30d) !== null) {
    facts.push(`EPS revisions 30d ${f.earningsRevisions30d > 0 ? '+' : ''}${f.earningsRevisions30d}%`);
  }
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
export function composeStanding(place, position, deployedAt = null, startingPrice = null) {
  if (place === UNIVERSE_PLACE.BENCH) return { place, line: STANDING_ON_BENCH, facts: [], provenance: null };
  if (place === UNIVERSE_PLACE.WATCHLIST) return { place, line: STANDING_ON_WATCHLIST, facts: [], provenance: null };
  if (place !== UNIVERSE_PLACE.BOOK) return null;

  const facts = [];
  if (typeof position?.tier === 'string' && position.tier) facts.push(position.tier);
  // THE ENTRY PRICE IS `swapPrice`, THEN THE BATTLE'S STARTING PRICE (review A-2).
  //
  // `openPrice` is a CLIENT-SIDE derivation (`enrichAsset` in
  // AgentBattleScreen.jsx) and appears on no persisted asset: reading it printed
  // no entry price at all, for any name, ever — and the tests could not see that
  // because their fixtures invented the field. The canonical server derivation is
  // `asset.swapPrice || battle.portfolio.startingPrices[symbol]`
  // (agentEvalPromptAssembly.js), and it is what the board's own row resolves to.
  const entry = money(position?.swapPrice ?? startingPrice ?? null);
  if (entry) facts.push(`Entry ${entry}`);
  const since = etStamp(position?.swappedInAt ?? deployedAt ?? null);
  if (since) facts.push(`Held since ${since}`);
  // THE STANDING IS THE RECORD'S, NOT THE PLATFORM'S (review B-4). An entry price
  // is the trading process's own execution fact, so it cannot sit unlabelled
  // beside data headed "not what the check saw". Its provenance says whose it is;
  // the prompt block drops the section entirely for the same reason.
  return { place, line: null, facts, provenance: facts.length ? STANDING_PROVENANCE : null };
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
  startingPrice = null,
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
    standing: composeStanding(place, position, deployedAt, startingPrice),
    // §3's door. D-54's forward path is Equip; hazard 7 is why this is a FLAG the
    // route computes rather than a promise the card makes: a name a rival agent
    // holds is kept out of the bench, so "Equip" is offered only where the route
    // established it is available.
    equip: equipAvailable === true,
  };
}
