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

import { flattenPortfolioServer } from '../agentScoring.js';
import { resolveEquippedWatchlist, extractTickerSymbols } from '../watchlistEquip.js';
import { TICKER_RE } from './planTemplates.js';
import { buildSessionEvents } from './events.js';
import { isCpuBattle, battleKindOf } from './applyRules.js';
import { rankedAgentOf } from './confirmPlan.js';
import { huddleDayRef } from './records.js';
import { getSessionForDate } from '../marketSchedule.js';
import { packItem, headlineItem } from '../evidence/packItem.js';
import { ensureSymbolEvidence } from '../evidence/symbolDayEvidence.js';
import { fetchEodhdNews } from '../evidence/eodhdNews.js';
import { fetchStoriesSince, storiesForSymbol } from '../evidence/fantasyTimesStories.js';
import { newsfilterStatus } from '../evidence/newsfilter.js';
import { fetchLastClose } from '../evidence/lastClose.js';

export const EVIDENCE_SYMBOL_CAP = 8;
export const HEADLINES_PER_SYMBOL = 3;
export const STRIP_LISTED = 8;
const KIND_LABEL = Object.freeze({ ranked: 'ranked', casual: 'BaggerBomb', training: 'training' });

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
      add(packItem({ kind: 'close', fact: `${symbol} closed at ${price.lastClose.toFixed(2)} on ${price.lastCloseAsOf} (the prior session's close).`, recordKind: 'symbolDayEvidence.price', recordId, label: 'EODHD daily bars', at: price.lastCloseAsOf, asOf: price.lastCloseAsOf }));
    } else {
      add(packItem({ kind: 'close', fact: `${symbol}'s prior close is not available this morning.`, recordKind: 'symbolDayEvidence.price', recordId, label: 'EODHD daily bars', at: etDate, status: 'unavailable', reason: skipped?.includes('price') ? 'skipped' : 'no_close' }));
    }
    for (const n of (record?.news || []).slice(0, HEADLINES_PER_SYMBOL)) add(headlineItem(n));
    for (const [k, set] of Object.entries(sourceTotals)) set.add(skipped?.includes('news') ? 'skipped' : (record?.sources?.[k] ?? 'skipped'));
  }
  for (const [source, statuses] of Object.entries(sourceTotals)) {
    const worst = statuses.has('error') ? 'error' : statuses.has('skipped') ? 'skipped' : statuses.has('ok') ? 'ok' : null;
    if (worst && worst !== 'ok') {
      sourceFailures.push(`${source}:${worst}`);
      add(packItem({ kind: 'source_status', fact: `${source === 'eodhd' ? 'EODHD news' : source === 'newsfilter' ? 'newsfilter' : 'FantasyTimes'} was ${worst === 'error' ? 'unavailable (an error)' : 'not checked'} this morning.`, recordKind: 'source', recordId: source, label: source, at: etDate, status: 'unavailable', reason: worst }));
    }
  }
  for (const [k, v] of Object.entries(shared?.sources || {})) {
    if (v !== 'ok') {
      sourceFailures.push(`${k}:${v}`);
      add(packItem({ kind: 'source_status', fact: `The ${k === 'earnings' ? 'earnings calendar' : k === 'macro' ? 'macro calendar' : 'market context'} was ${v === 'error' ? 'unavailable (an error)' : 'not checked'} this morning.`, recordKind: 'source', recordId: k, label: k, at: etDate, status: 'unavailable', reason: v }));
    }
  }

  // ---- today's events: macro, and the earnings of names in the universe first ----
  const earnings = Array.isArray(shared?.earnings) ? shared.earnings : [];
  const ordered = [...earnings.filter((r) => universe.has(r.symbol)), ...earnings.filter((r) => !universe.has(r.symbol))];
  const listedEarnings = ordered.slice(0, STRIP_LISTED);
  const events = buildSessionEvents({ etDate, macroEvents: shared?.macroEvents || [], earnings: listedEarnings });
  for (const e of events.strip) {
    add(packItem({ kind: 'event', fact: `${e.label.charAt(0).toUpperCase()}${e.label.slice(1)} is scheduled today.`, recordKind: e.source === 'macro' ? 'calendar.macro' : 'calendar.earnings', recordId: e.eventId || e.label, label: e.source === 'macro' ? 'macro calendar' : 'EODHD earnings calendar', at: etDate, asOf: etDate }));
  }

  // ---- yesterday's plan ----
  let priorPlan = null;
  if (previousEtDate) {
    try {
      const prev = await huddleDayRef(db, uid, previousEtDate).get();
      const plan = prev.exists ? prev.data()?.plan : null;
      if (plan) {
        priorPlan = { etDate: previousEtDate, status: plan.status, stances: (plan.confirmed?.current ?? plan.current)?.stances?.map((s) => `${s.kind} ${s.ticker}`) ?? [] };
        add(packItem({ kind: 'prior_plan', fact: `Yesterday's plan (${previousEtDate}) was ${plan.status}${priorPlan.stances.length ? `: ${priorPlan.stances.join(', ')}` : ''}. It has no grade yet.`, recordKind: 'huddle', recordId: previousEtDate, label: 'your huddle record', at: previousEtDate, asOf: previousEtDate }));
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
    eventsListed: { listed: events.strip.length, earningsListed: listedEarnings.length, earningsTotal: earnings.length },
    tape: shared?.tape ?? null,
    evidence,
    priorPlan,
    sourceFailures: [...new Set(sourceFailures)],
    watchlistTickers,
  };
}
