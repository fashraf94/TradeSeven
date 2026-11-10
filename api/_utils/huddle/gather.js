// api/_utils/huddle/gather.js
//
// Huddle S1 — THE GATHER STEP (spec V1.1 §5.3 "Gather"; Amendment A §A7; Amendment C V1.2
// §C10, §C12). Reads, never writes but the shared evidence record (symbolDayEvidence):
//   - the ranked agent (the `agents` doc with this owner that is neither clone): its
//     archetype and equipped watchlist (resolveEquippedWatchlist / extractTickerSymbols,
//     the read decide.js:382-400 makes);
//   - the owner's active battles (equality filters, Q-A1), CPU seats out, each classified
//     ranked / casual / training; holdings through the fenced, CALLABLE
//     flattenPortfolioServer (never edited); ranked picks from the battle's own
//     agentContext.tournament.userPicksAtDeploy; the deploy opener (`first_message`);
//   - yesterday's huddle record;
//   - per symbol, this morning's shared evidence (price, news, sources), fetched once.
// Every fact becomes a C10 pack item with a deterministic id; the script cites them.
// NO volume or relative-volume value is gathered or passed (C12).
//
// Amendment E §E3: every fact's date is in spoken form (spoken.js: "Friday, November 6",
// never ISO, E3 d); a source the job SKIPPED makes no item and no line the script sees
// (only one it tried and could not reach does: "Couldn't reach {source} this morning.",
// E3 a — the skip is kept apart in `sourcesSkipped`); the earnings the script hears are the
// player's own names' (E3 f, with E2); one `tape` item per index (E3 g); and the names with
// the largest holding exposure (`exposureLeaders`) for the validator's order check (E3 c).

import { flattenPortfolioServer } from '../agentScoring.js';
import { resolveEquippedWatchlist, extractTickerSymbols } from '../watchlistEquip.js';
import { TICKER_RE } from './planTemplates.js';
import { buildSessionEvents } from './events.js';
import { isCpuBattle, battleKindOf } from './applyRules.js';
import { rankedAgentOf } from './confirmPlan.js';
import { huddleDayRef, sessionWindowOf, nextSessionDateOf } from './records.js';
import { getSessionForDate } from '../marketSchedule.js';
import { packItem, headlineItem, tapeItem } from '../evidence/packItem.js';
import { spokenDateOf } from './spoken.js';
import { ensureSymbolEvidence } from '../evidence/symbolDayEvidence.js';
import { fetchEodhdNews } from '../evidence/eodhdNews.js';
import { fetchStoriesSince, storiesForSymbol } from '../evidence/fantasyTimesStories.js';
import { newsfilterStatus } from '../evidence/newsfilter.js';
import { fetchLastClose } from '../evidence/lastClose.js';

export const EVIDENCE_SYMBOL_CAP = 8;
export const HEADLINES_PER_SYMBOL = 3;
const KIND_LABEL = Object.freeze({ ranked: 'ranked', casual: 'BaggerBomb', training: 'training' });
// The readable name of each source on a source_status item (the transcript's and the cards' source lines); never in the id.
const SOURCE_LABEL = Object.freeze({ eodhd: 'EODHD news', newsfilter: 'newsfilter', fantasytimes: 'FantasyTimes', marketContext: 'market context', macro: 'macro calendar', earnings: 'earnings calendar' });
// A source as said in its one sentence (E3 a: "Couldn't reach {source} this morning.").
const SOURCE_SAID = Object.freeze({ eodhd: 'EODHD news', newsfilter: 'newsfilter', fantasytimes: 'FantasyTimes', marketContext: 'the market context', macro: 'the macro calendar', earnings: 'the earnings calendar' });

const isTicker = (s) => typeof s === 'string' && TICKER_RE.test(s);

/** The opener's paragraphs (the deploy's `first_message`), at most two, each at most 400 characters. */
export function openerParagraphs(battle) {
  const ex = (Array.isArray(battle?.chatExchanges) ? battle.chatExchanges : []).find((e) => e?.messageType === 'first_message');
  const text = typeof ex?.agentResponse === 'string' ? ex.agentResponse : '';
  return { at: ex?.timestamp ?? null, paragraphs: text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).slice(0, 2).map((p) => p.slice(0, 400)) };
}

/** Pure: the session universe and the names by exposure, from the battles, picks and watchlist. */
export function universeOf({ battles, watchlistTickers }) {
  const exposure = new Map();
  const sources = new Map();
  const note = (sym, src, weight) => {
    if (!isTicker(sym)) return;
    exposure.set(sym, (exposure.get(sym) || 0) + weight);
    if (!sources.has(sym)) sources.set(sym, src);
  };
  for (const b of battles) for (const h of b.holdings) note(h.symbol, 'activeBattle', h.allocation || 0);
  for (const b of battles) for (const p of b.picks) note(p, 'rankedPicks', 1);
  for (const t of watchlistTickers || []) note(t, 'watchlist', 0);
  const names = [...exposure.entries()]
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
    .map(([ticker, ex]) => ({ ticker, source: sources.get(ticker), exposure: ex }));
  return { universe: new Set(names.map((n) => n.ticker)), names };
}

/**
 * E3 c (R-24): the names with the LARGEST holding exposure across the player's games — summed allocation, ties all kept;
 * empty when nothing is held (the check is then vacuous).
 */
export function exposureLeadersOf(battles) {
  const held = new Map();
  for (const b of Array.isArray(battles) ? battles : []) {
    for (const h of b.holdings || []) {
      const a = typeof h.allocation === 'number' && Number.isFinite(h.allocation) ? h.allocation : 0;
      if (isTicker(h.symbol)) held.set(h.symbol, (held.get(h.symbol) || 0) + a);
    }
  }
  const top = Math.max(0, ...held.values());
  return top > 0 ? [...held.entries()].filter(([, a]) => a === top).map(([s]) => s).sort() : [];
}

function picksOf(battle) {
  const raw = battle?.agentContext?.tournament?.userPicksAtDeploy;
  return (Array.isArray(raw) ? raw : []).map((p) => (typeof p === 'string' ? p : p?.symbol)).filter(isTicker);
}

/**
 * @param {object} db
 * @param {{ uid, etDate, session, shared, owner, signal?, nowMs?, deps? }} p
 */
export async function gatherForPlayer(db, { uid, etDate, session, shared, owner, signal, nowMs = Date.now(), deps = {} }) {
  const fetchNews = deps.fetchEodhdNews || fetchEodhdNews;
  const fetchClose = deps.fetchLastClose || fetchLastClose;
  const fetchStories = deps.fetchStoriesSince || fetchStoriesSince;
  const sourceFailures = [];
  const sourcesSkipped = [];
  const evidence = [];
  const add = (item) => { if (!evidence.some((e) => e.id === item.id)) evidence.push(item); return item; };

  // ---- the ranked agent, its archetype and watchlist ----
  const agentsSnap = await db.collection('agents').where('ownerId', '==', uid).get();
  const agent = rankedAgentOf(agentsSnap.docs);
  const archetype = typeof agent?.archetype === 'string' ? agent.archetype : null;
  let watchlistTickers = [];
  if (agent?.equippedWatchlistId) {
    try {
      const wl = await db.collection('watchlists').doc(agent.equippedWatchlistId).get();
      const resolved = resolveEquippedWatchlist(wl.exists ? wl.data() : null);
      watchlistTickers = resolved ? extractTickerSymbols(resolved.tickers) : [];
    } catch {
      sourceFailures.push('watchlist');
    }
  }

  // ---- the owner's active battles ----
  const battlesSnap = await db.collection('agentBattles').where('ownerId', '==', uid).where('status', '==', 'active').get();
  const battles = battlesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => !isCpuBattle(b)).map((b) => ({
    id: b.id,
    kind: battleKindOf(b),
    createdAt: b.activatedAt || b.createdAt || null,
    holdings: flattenPortfolioServer(b.portfolio).map((a) => ({ symbol: a?.symbol, tier: a?.tier, allocation: a?.allocation })).filter((h) => isTicker(h.symbol)),
    picks: battleKindOf(b) === 'ranked' ? picksOf(b) : [],
    opener: openerParagraphs(b),
    tradingDay: b.timing?.tradingDays?.[0] ?? null,
  }));
  for (const b of battles) {
    for (const h of b.holdings) {
      // one item per holding: the record id names the battle AND the symbol (a battle id alone gave every holding of a
      // game one pack id, and the dedup kept only the first; found by the verification run, build report RF-12)
      add(packItem({ kind: 'holding', fact: `${h.symbol} is held in your ${KIND_LABEL[b.kind]} game (${h.tier}).`, recordKind: 'agentBattle', recordId: `${b.id}#${h.symbol}`, label: 'your game', at: b.createdAt ? String(b.createdAt) : etDate, asOf: etDate }));
    }
    for (const p of b.picks) add(packItem({ kind: 'agent_pick', fact: `${p} is one of your picks in today's ranked game.`, recordKind: 'agentBattle.tournament', recordId: `${b.id}#${p}`, label: 'your ranked picks', at: b.createdAt ? String(b.createdAt) : etDate, asOf: etDate }));
    b.opener.paragraphs.forEach((para, i) => {
      add(packItem({ kind: 'opener', fact: `Your agent's opener said: "${para}"`, recordKind: 'agentBattle.opener', recordId: `${b.id}#${i}`, label: "your agent's opener", at: b.opener.at ?? etDate, asOf: b.opener.at ?? null }));
    });
  }

  const { universe, names } = universeOf({ battles, watchlistTickers });

  // ---- per symbol: this morning's shared evidence (price, news, sources) ----
  const previousEtDate = session?.previousEtDate ?? null;
  // "since the prior close" (concept V1.2 §6): the previous session's own close instant, early closes included
  const sinceMs = previousEtDate ? (getSessionForDate(previousEtDate)?.closeMs ?? null) : null;
  let storiesMemo = null;
  const storiesFor = async () => {
    if (!storiesMemo) storiesMemo = fetchStories(db, { since: new Date(sinceMs ?? nowMs - 86_400_000) });
    return storiesMemo;
  };
  const closes = new Map();
  const targets = names.slice(0, EVIDENCE_SYMBOL_CAP).map((n) => n.ticker);
  const perSymbol = new Map();
  await Promise.all(targets.map(async (symbol) => {
    const fetchGroup = async (group) => {
      if (group === 'price') {
        const r = await fetchClose({ symbol, previousEtDate });
        return { fields: { price: { lastClose: r.lastClose, lastCloseAsOf: r.lastCloseAsOf } }, state: r.status === 'error' ? 'failed' : 'ready' };
      }
      const [eod, stories] = await Promise.all([
        fetchNews({ symbol, sinceMs, fromDate: previousEtDate, signal }),
        storiesFor(),
      ]);
      const ft = stories.status === 'ok' ? storiesForSymbol(stories.stories, symbol) : [];
      const nf = newsfilterStatus();
      const news = [...eod.items, ...ft].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)).slice(0, 10);
      return { fields: { news, sources: { eodhd: eod.status, newsfilter: nf.status, fantasytimes: stories.status } }, state: 'ready' };
    };
    try {
      const { record, skipped } = await ensureSymbolEvidence(db, { etDate, symbol, owner, fetchGroup });
      perSymbol.set(symbol, { record, skipped });
    } catch {
      perSymbol.set(symbol, { record: null, skipped: ['price', 'news'] });
    }
  }));

  const sourceTotals = { eodhd: new Set(), newsfilter: new Set(), fantasytimes: new Set() };
  for (const symbol of targets) {
    const { record, skipped } = perSymbol.get(symbol) || {};
    const price = record?.price ?? null;
    const recordId = `${etDate}_${symbol}`;
    if (typeof price?.lastClose === 'number') {
      closes.set(symbol, price.lastClose);
      const on = spokenDateOf(price.lastCloseAsOf);
      add(packItem({ kind: 'close', fact: `${symbol} closed at ${price.lastClose.toFixed(2)}${on ? ` on ${on}` : ''} (the prior session's close).`, recordKind: 'symbolDayEvidence.price', recordId, label: 'EODHD daily bars', at: price.lastCloseAsOf, asOf: price.lastCloseAsOf }));
    } else {
      add(packItem({ kind: 'close', fact: `No prior close for ${symbol} is on file this morning.`, recordKind: 'symbolDayEvidence.price', recordId, label: 'EODHD daily bars', at: etDate, status: 'unavailable', reason: skipped?.includes('price') ? 'skipped' : 'no_close' }));
    }
    for (const n of (record?.news || []).slice(0, HEADLINES_PER_SYMBOL)) add(headlineItem(n));
    for (const [k, set] of Object.entries(sourceTotals)) set.add(skipped?.includes('news') ? 'skipped' : (record?.sources?.[k] ?? 'skipped'));
  }
  // E3 a: a source the job TRIED and could not reach is one item, "Couldn't reach {source} this morning."; a source it
  // skipped (no key, switched off — newsfilter every morning in S1) is silent: no item, no failure line, only sourcesSkipped.
  const sourceStatus = (key, outcome) => {
    if (outcome === 'error') {
      sourceFailures.push(`${key}:error`);
      add(packItem({ kind: 'source_status', fact: `Couldn't reach ${SOURCE_SAID[key] ?? key} this morning.`, recordKind: 'source', recordId: key, label: SOURCE_LABEL[key] ?? key, at: etDate, status: 'unavailable', reason: 'error' }));
    } else if (outcome === 'skipped') {
      sourcesSkipped.push(key);
    }
  };
  for (const [source, statuses] of Object.entries(sourceTotals)) {
    sourceStatus(source, statuses.has('error') ? 'error' : statuses.has('skipped') ? 'skipped' : null);
  }
  for (const [k, v] of Object.entries(shared?.sources || {})) if (v !== 'ok') sourceStatus(k, v === 'error' ? 'error' : 'skipped');

  // E3 g (R-25): one tape item per index from the morning's market context — the prior session's close, said with its
  // date — so a tape sentence's index figures cite an item. Only a pre-market context carries closes (an intraday one is a
  // live price, never a close), and none is made without the prior session's date.
  const tape = shared?.tape ?? null;
  const tapeDate = previousEtDate;
  if (tape && tape.mode === 'premarket' && spokenDateOf(tapeDate) && Array.isArray(tape.indices)) {
    for (const i of tape.indices) add(tapeItem({ ...i, asOf: tapeDate, asOfSaid: spokenDateOf(tapeDate) }));
  }

  // ---- the events: today's macro prints, and the player's OWN names' reports — today's and the next session's before
  // the open (Amendment E §E2: NO_ADDS_TO_BEFORE_REPORT's names; §E3 f: whether and when the player's names report, never
  // the calendar's size). The session window decides which macro prints a NO_ADDS_BEFORE line may name (E2). ----
  const earnings = Array.isArray(shared?.earnings) ? shared.earnings : [];
  const listedEarnings = earnings.filter((r) => universe.has(r.symbol));
  const window = sessionWindowOf(session);
  const nextEtDate = shared?.nextEtDate ?? nextSessionDateOf(etDate);
  const events = buildSessionEvents({ etDate, macroEvents: shared?.macroEvents || [], earnings: listedEarnings, window, nextEtDate });
  for (const e of events.strip) {
    const said = `${e.label.charAt(0).toUpperCase()}${e.label.slice(1)}`;
    add(packItem({ kind: 'event', fact: e.next ? `${said} is scheduled.` : `${said} is scheduled today.`, recordKind: e.source === 'macro' ? 'calendar.macro' : 'calendar.earnings', recordId: e.eventId || e.label, label: e.source === 'macro' ? 'macro calendar' : 'EODHD earnings calendar', at: e.etDate ?? etDate, asOf: e.etDate ?? etDate }));
  }

  // ---- yesterday's plan ----
  let priorPlan = null;
  if (previousEtDate) {
    try {
      const prev = await huddleDayRef(db, uid, previousEtDate).get();
      const plan = prev.exists ? prev.data()?.plan : null;
      if (plan) {
        priorPlan = { etDate: previousEtDate, status: plan.status, stances: (plan.confirmed?.current ?? plan.current)?.stances?.map((s) => `${s.kind} ${s.ticker}`) ?? [] };
        add(packItem({ kind: 'prior_plan', fact: `Your plan for ${spokenDateOf(previousEtDate) ?? 'the prior session'} was ${plan.status}${priorPlan.stances.length ? `: ${priorPlan.stances.join(', ')}` : ''}. It has no grade yet.`, recordKind: 'huddle', recordId: previousEtDate, label: 'your huddle record', at: previousEtDate, asOf: previousEtDate }));
      }
    } catch {
      sourceFailures.push('prior_huddle');
    }
  }

  return {
    agentId: agent?.id ?? null,
    archetype,
    battles: battles.map(({ opener, ...b }) => b),
    universe,
    names: names.map((n) => ({ ...n, hasClose: closes.has(n.ticker) })),
    closes,
    events,
    window,
    nextEtDate,
    exposureLeaders: exposureLeadersOf(battles),
    eventsListed: { listed: events.strip.length, earningsListed: listedEarnings.length, earningsTotal: earnings.length },
    tape: shared?.tape ?? null,
    evidence,
    priorPlan,
    sourceFailures: [...new Set(sourceFailures)],
    sourcesSkipped: [...new Set(sourcesSkipped)],
    watchlistTickers,
  };
}
