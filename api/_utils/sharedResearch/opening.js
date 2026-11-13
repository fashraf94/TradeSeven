// api/_utils/sharedResearch/opening.js
//
// Shared Research — THE DETERMINISTIC OPENING, pure (spec §4.2, §5.2, §8, §15
// S-1). No model, no retrieval: what the record is minted with at `open`.
//
//   item        the story as a `coverage` finding — reporter content, never
//               Source-backed (`unverified` / `reporter_content`, R3)
//   observation the player's words (`observation`, the framing exchange,
//               `unverified` / `player_words`)
//   signaldrop  the drop as the player's words (`observation`, the drop exchange
//               written at open, `player_drop`) — "Your drop" is the text, the
//               url then the note, or for an image the note or "An image you
//               dropped"; each `parse.dataPoints[]` item as an `inference`
//               (`from_drop`). Never `parse.extractedText` as the player's words,
//               never `parse.impliedTickers` as names in scope (S-1).
//   names       for each name in scope (story tickers ∩ universe; the drop's
//               validated symbols; none for an observation): the estimates row
//               and the stored-claims count as `earnings_fact`, `verified`,
//               each with its record's date
//   next        one `next_action` (source `kb` baseline@v0)
//
// The rankings and peer rows are a live projection, never written (F14):
// storedRowsOf() shapes them for the answer.

import { FINDING_FACT_MAX_LEN, SOURCE_LABEL_MAX_LEN, isInstant } from '../researchRecords/model.js';
import { gameUniverse, resolveSymbol } from './companies.js';
import { instantOf } from './stepSchema.js';
import { METHOD_SOURCE } from './method.js';

/** At most this many names in scope, and drop claims, are written at open (the record holds 100 findings). */
export const NAMES_IN_SCOPE_MAX = 10;
export const DROP_CLAIMS_MAX = 10;
/** The claims read: the newest this many for a symbol (the existing (ticker, sourceDate desc) index). */
export const CLAIMS_READ_LIMIT = 15;

const clean = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : ''); // eslint-disable-line no-control-regex
const cut = (s, max) => (s.length <= max ? s : s.slice(0, max).trimEnd());
const before = (iso, nowIso) => (isInstant(iso) && Date.parse(iso) < Date.parse(nowIso) ? iso : null);

/** The names in scope, resolved inside the universe, each once, at most NAMES_IN_SCOPE_MAX. */
export function namesInScopeOf({ entryKind, story = null, drop = null, universe = gameUniverse }) {
  let raw = [];
  if (entryKind === 'item') raw = Array.isArray(story?.tickers) ? story.tickers : [];
  if (entryKind === 'signaldrop') raw = (Array.isArray(drop?.validation?.validated) ? drop.validation.validated : []).map((v) => v?.symbol);
  const out = [];
  for (const r of raw) {
    const s = resolveSymbol(r, universe);
    if (s && !out.includes(s)) out.push(s);
  }
  return out.slice(0, NAMES_IN_SCOPE_MAX);
}

/** What the drop's player exchange holds, and the "Your drop" fact (S-1). */
export function dropTextOf(drop) {
  const input = drop?.input ?? {};
  const note = clean(input.note);
  if (input.type === 'text' && clean(input.text)) return clean(input.text);
  if (input.type === 'url' && clean(input.url)) return note ? `${clean(input.url)} · ${note}` : clean(input.url);
  return note || 'An image you dropped';
}
/** The drop's kind as the label says it. */
export const dropTypeOf = (drop) => ({ text: 'text', url: 'link', image: 'image' }[drop?.input?.type] ?? 'drop');

/** The estimates row's fact for one symbol, or null when the cache holds nothing usable for it. */
export function estimatesFactOf(symbol, entry) {
  const num = (v) => {
    if (v == null || (typeof v === 'string' && v.trim() === '')) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const pct = (v) => { const n = num(v); return n == null ? null : Math.round(n * 1000) / 10; };
  const fe = entry?.forwardEstimates ?? {};
  const cy = pct(fe.currentYear?.growth);
  const ny = pct(fe.nextYear?.growth);
  const analysts = num(fe.nextYear?.numAnalysts);
  const parts = [];
  if (cy !== null) parts.push(`${cy}% for the current fiscal year`);
  if (ny !== null) parts.push(`${ny}% for the next`);
  if (parts.length === 0) return null;
  return `Analyst consensus growth for ${symbol}: ${parts.join(' and ')}${analysts !== null ? ` (${analysts} analysts on the next year)` : ''}.`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const writtenDate = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };

/**
 * The opening's findings, in record order (spec §4.2).
 * @param {object} p
 * @param {'item'|'observation'|'signaldrop'} p.entryKind
 * @param {object} [p.story]   { id, headline, reporterName, reporterBeat, publishedAt (instant), primaryTicker, tickers }
 * @param {object} [p.drop]    the stored drop record
 * @param {object} [p.playerExchange]  the observation's (or the drop's) player exchange { exchangeId, text, at }
 * @param {object} [p.frame]   the framing ({ check }) for an observation
 * @param {string[]} p.names   the names in scope
 * @param {object} p.stored    { estimates: { computedAt, stocks } | null, claims: { [symbol]: { count, newest } } }
 * @param {string} p.nowIso    the open instant
 * @returns {object[]} raw finding inputs (buildFinding's shape, no id)
 */
export function openingFindingsOf({ entryKind, story = null, drop = null, playerExchange = null, frame = null, names, stored, nowIso, universe = gameUniverse }) {
  const out = [];
  if (entryKind === 'item') {
    const published = instantOf(story.publishedAt);
    const label = cut(['FantasyTimes', clean(story.reporterName) || 'reporter', clean(story.reporterBeat)].filter(Boolean).join(' · '), SOURCE_LABEL_MAX_LEN);
    out.push({
      kind: 'coverage', symbol: resolveSymbol(story.primaryTicker, universe),
      fact: cut(clean(story.headline), FINDING_FACT_MAX_LEN),
      source: { recordKind: 'fantasyTimesStories', recordId: story.id, label },
      at: published ?? nowIso, asOf: published ? before(published, nowIso) : null,
      status: 'unverified', statusReason: 'reporter_content',
    });
  } else if (entryKind === 'observation') {
    out.push({
      kind: 'observation', symbol: null, fact: cut(clean(playerExchange.text), FINDING_FACT_MAX_LEN),
      source: { recordKind: 'exchange', recordId: playerExchange.exchangeId, label: 'Your words' },
      at: playerExchange.at, asOf: null, status: 'unverified', statusReason: 'player_words',
    });
  } else if (entryKind === 'signaldrop') {
    const said = instantOf(drop?.droppedAt);
    const at = said && Date.parse(said) <= Date.parse(nowIso) ? said : playerExchange.at;
    out.push({
      kind: 'observation', symbol: null, fact: cut(dropTextOf(drop), FINDING_FACT_MAX_LEN),
      source: { recordKind: 'exchange', recordId: playerExchange.exchangeId, label: `Your drop · ${dropTypeOf(drop)}` },
      at, asOf: null, status: 'unverified', statusReason: 'player_drop',
    });
    const claims = (Array.isArray(drop?.parse?.dataPoints) ? drop.parse.dataPoints : []).map(clean).filter(Boolean).slice(0, DROP_CLAIMS_MAX);
    for (const c of claims) {
      out.push({
        kind: 'inference', symbol: names.find((s) => new RegExp(`(^|[^A-Z0-9-])${s}([^A-Z0-9-]|$)`).test(c)) ?? null,
        fact: cut(c, FINDING_FACT_MAX_LEN),
        source: { recordKind: 'exchange', recordId: playerExchange.exchangeId, label: 'From your drop' },
        at, asOf: null, status: 'unverified', statusReason: 'from_drop',
      });
    }
  }
  // The stored facts for each name in scope.
  const computedAt = before(instantOf(stored?.estimates?.computedAt), nowIso);
  for (const symbol of names) {
    const fact = computedAt ? estimatesFactOf(symbol, stored.estimates.stocks?.[symbol]) : null;
    if (fact) {
      out.push({
        kind: 'earnings_fact', symbol, fact, source: { recordKind: 'estimatesCache', recordId: 'latest', label: 'Analyst consensus · the estimates cache' },
        at: computedAt, asOf: computedAt, status: 'verified', statusReason: null,
      });
    }
    const c = stored?.claims?.[symbol];
    const newest = typeof c?.newest === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.newest) ? before(`${c.newest}T00:00:00.000Z`, nowIso) : null;
    if (c && Number.isSafeInteger(c.count) && c.count > 0 && newest) {
      const n = c.count >= CLAIMS_READ_LIMIT ? `${CLAIMS_READ_LIMIT} or more` : String(c.count);
      out.push({
        kind: 'earnings_fact', symbol,
        fact: `${n} stored claims about ${symbol} are in the app's records (earnings calls, Fed events and analyst commentary); the newest is dated ${writtenDate(c.newest)}.`,
        source: { recordKind: 'ingestedClaims', recordId: `count:${symbol}`, label: `Stored claims · ${symbol}` },
        at: newest, asOf: newest, status: 'verified', statusReason: null,
      });
    }
  }
  // The one next action.
  let next;
  if (entryKind === 'item') next = 'Find the primary source of what this story reports — A story is reporter content; the first step looks for the filing, release or report it rests on.';
  else if (entryKind === 'observation') next = clean(frame?.check) ? cut(clean(frame.check), 300) : 'Find a source that names the problem your observation points at.';
  else next = drop?.input?.type === 'url' ? 'Read the page your drop links to and find its primary source.' : 'Find the primary source behind your drop.';
  out.push({
    kind: 'next_action', symbol: null, fact: next, source: { ...METHOD_SOURCE },
    at: nowIso, asOf: null, status: 'unverified', statusReason: 'proposed',
  });
  return out;
}

/** The rankings and peer rows for the names in scope — a live projection, never written (F14). */
export function storedRowsOf(names, { peers = {}, rankings = {} } = {}) {
  return names.map((symbol) => {
    const p = peers[symbol] ?? null;
    const r = rankings[symbol] ?? null;
    return {
      symbol,
      name: typeof p?.name === 'string' && p.name ? p.name : symbol,
      peer: p ? { sector: p.sector ?? null, metrics: p.metrics ?? null, asOf: p.updatedAt ?? p.computedAt ?? null } : null,
      ranking: r ? { score: r.compositeScore ?? r.score ?? null, percentile: r.percentile ?? null, tier: r.tier ?? null, asOf: r.updatedAt ?? r.computedAt ?? null } : null,
    };
  });
}
