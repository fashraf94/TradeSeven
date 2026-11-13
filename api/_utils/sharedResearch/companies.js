// api/_utils/sharedResearch/companies.js
//
// Shared Research — COMPANIES CONNECTED and THE READ PROJECTION, pure (spec
// §6.7, §9 Correction A, §15 S-5).
//
// companiesOf(record, { universe, names }) reads the record's CURRENT findings
// and the game universe, and nothing else: a company is SUPPORTED only when its
// symbol resolved inside the universe AND a current `verified` `relationship`
// finding carries that symbol. Everything else a step named is a LEAD. Nothing
// here reads `stepsUsed`, exchanges or step counts — the Correction A regression
// (companies.test.js) pins it.
//
// The role is record-derived: the validator writes every relationship fact as
// "{Role} · {fact}" with Role from RELATIONSHIP_ROLES, and a fact about a
// company with no resolved symbol as "{Role} · {name}: {fact}" (a product fact:
// "{name}: {fact}") — so the role and a lead's name are read from a prefix the
// server wrote, never parsed out of prose.
//
// projectionOf(record, …) is what the route returns instead of the raw record
// (spec §6.7), without the record's symbol keys (§15 S-5) and without exchange
// ids (contract §4).

import { ALL_TICKERS, isRetiredStock } from '../rankingConfig.js';
import { currentFindingsOf } from '../researchRecords/model.js';
import { RELATIONSHIP_ROLES, ROLE_SEPARATOR } from '../../../src/constants/sharedResearch.js';
import { etDateOf } from './session.js';

const TICKER_SET = new Set(ALL_TICKERS);
/** The game's universe as code holds it (spec F12): membership and retirement. Injectable for tests. */
export const gameUniverse = Object.freeze({
  has: (s) => TICKER_SET.has(s),
  retired: (s) => isRetiredStock(s),
});

/** A candidate symbol resolved INSIDE the universe (upper case, hyphen form; not retired) — else null (spec §6.4 rule 2). */
export function resolveSymbol(raw, universe = gameUniverse) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase().replace(/\./g, '-');
  if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(s)) return null;
  return universe.has(s) && !universe.retired(s) ? s : null;
}

/** Words too common in company names to identify one ("Meta Platforms" is named by "Meta", not "Platforms"). */
const GENERIC_NAME_WORDS = new Set([
  'international', 'holdings', 'holding', 'group', 'systems', 'technologies', 'technology', 'platforms', 'financial', 'corporation',
  'company', 'energy', 'services', 'global', 'american', 'general', 'bank', 'industries', 'capital', 'partners', 'brands',
  'therapeutics', 'pharmaceuticals', 'communications', 'resources', 'solutions', 'networks', 'motors', 'entertainment', 'chase',
]);
/**
 * The core of a company's name for matching ("Shopify Inc." → "Shopify";
 * "Amazon.com, Inc." → "Amazon"; "JPMorgan Chase & Co." → "JPMorgan Chase";
 * "The Coca-Cola Company" → "Coca-Cola").
 */
export function coreNameOf(name) {
  let s = String(name ?? '').trim().replace(/^the\s+/i, '');
  const SUFFIX = /(?:[\s,]+(?:inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|plc|holdings?|group|n\.?v\.?|s\.?a\.?|ag|se|class\s+[a-c]|\(the\))|\s*&|\s+and|\.com)$/i;
  for (let i = 0; i < 6 && SUFFIX.test(s); i++) s = s.replace(SUFFIX, '').trim();
  return s;
}
const escapeName = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordIn = (t, w, flags = 'i') => new RegExp(`(^|[^A-Za-z0-9])${escapeName(w)}([^A-Za-z0-9]|$)`, flags).test(t);
/**
 * Does the text name the company? Its symbol as a word (symbols of three or
 * more letters only: "C" and "V" are ordinary letters, "Series C" names no
 * bank), its core name, or a distinctive word of it (four or more letters, not
 * a generic one: "Disney" names "The Walt Disney Company").
 */
export function namesCompany(text, { symbol, name }) {
  const t = String(text ?? '');
  if (typeof symbol === 'string' && symbol.length >= 3 && new RegExp(`(^|[^A-Za-z0-9-])${escapeName(symbol)}([^A-Za-z0-9-]|$)`).test(t)) return true;
  const core = coreNameOf(name);
  if (core.length < 2 || core === symbol) return false;
  if (wordIn(t, core)) return true;
  return core.split(/[\s,]+/).filter((w) => w.length >= 4 && !GENERIC_NAME_WORDS.has(w.toLowerCase())).some((w) => wordIn(t, w));
}

/** "{Role} · {rest}" → { role, rest }; a fact without a known role prefix reads role null. */
export function splitRole(fact) {
  const f = typeof fact === 'string' ? fact : '';
  const i = f.indexOf(ROLE_SEPARATOR);
  const role = i > 0 ? f.slice(0, i) : null;
  return RELATIONSHIP_ROLES.includes(role) ? { role, rest: f.slice(i + ROLE_SEPARATOR.length) } : { role: null, rest: f };
}

/** "{name}: {rest}" → the name the validator wrote for a company with no resolved symbol; null when there is none. */
export function leadNameOf(text) {
  const m = /^([^:]{1,80}):\s/.exec(typeof text === 'string' ? text : '');
  return m ? m[1].trim() : null;
}

const STATUS_RANK = { verified: 3, unverified: 2, unavailable: 1 };
const COMPANY_KINDS = new Set(['relationship', 'product']);

/**
 * The companies the record supports and the leads it names.
 * @param {object} record  a stored research record
 * @param {{ universe?: object, names?: Record<string,string> }} ctx  names: symbol → company name (peerRankings)
 * @returns {{ supported: object[], leads: object[] }}
 */
export function companiesOf(record, { universe = gameUniverse, names = {} } = {}) {
  const current = currentFindingsOf(record);
  const supported = [];
  const bySymbol = new Map();
  for (const f of current) {
    if (f?.kind === 'relationship' && f.status === 'verified' && typeof f.symbol === 'string') bySymbol.set(f.symbol, f); // the latest wins
  }
  for (const [symbol, rel] of bySymbol) {
    const withSymbol = current.filter((f) => f?.symbol === symbol);
    const { role, rest } = splitRole(rel.fact);
    const open = withSymbol.filter((f) => f.status === 'unavailable').at(-1) ?? null;
    const claim = withSymbol.filter((f) => f.kind === 'idea').at(-1) ?? null;
    supported.push({
      symbol,
      name: typeof names[symbol] === 'string' && names[symbol] ? names[symbol] : symbol,
      role: role ?? 'Other',
      relationship: rest,
      relationshipFindingId: rel.findingId,
      evidence: withSymbol.filter((f) => f.status === 'verified' && f.kind !== 'idea').map((f) => f.findingId),
      openQuestion: open ? { findingId: open.findingId, fact: open.fact, statusReason: open.statusReason } : null,
      claim: claim ? { findingId: claim.findingId, fact: claim.fact } : null,
      eligibility: universe.has(symbol) && !universe.retired(symbol) ? 'eligible' : 'outside',
    });
  }
  // Leads: a company a relationship or product finding names that is not supported.
  const leads = new Map();
  for (const f of current) {
    if (!COMPANY_KINDS.has(f?.kind)) continue;
    if (typeof f.symbol === 'string' && bySymbol.has(f.symbol)) continue;
    const text = f.kind === 'relationship' ? splitRole(f.fact).rest : f.fact;
    const name = typeof f.symbol === 'string' ? (names[f.symbol] || f.symbol) : leadNameOf(text);
    if (!name) continue;
    const key = typeof f.symbol === 'string' ? `s:${f.symbol}` : `n:${name.toLowerCase()}`;
    const prior = leads.get(key);
    const better = !prior || (STATUS_RANK[f.status] ?? 0) > (STATUS_RANK[prior.status] ?? 0);
    const entry = prior ?? { name, symbol: typeof f.symbol === 'string' ? f.symbol : null, findingIds: [] };
    entry.findingIds.push(f.findingId);
    if (better) Object.assign(entry, { status: f.status, statusReason: f.statusReason ?? null });
    if (entry.symbol === null) entry.unresolved = 'identity_unresolved';
    leads.set(key, entry);
  }
  return { supported, leads: [...leads.values()] };
}

/** A finding as the client reads it: an exchange source names no exchange id (contract §4). */
export function findingViewOf(f) {
  const source = { recordKind: f.source?.recordKind ?? null, recordId: f.source?.recordKind === 'exchange' ? null : (f.source?.recordId ?? null), label: f.source?.label ?? null };
  if (typeof f.source?.url === 'string') source.url = f.source.url;
  return {
    findingId: f.findingId, kind: f.kind, symbol: f.symbol ?? null, fact: f.fact, source,
    at: f.at ?? null, asOf: f.asOf ?? null, status: f.status, statusReason: f.statusReason ?? null, supersedes: f.supersedes ?? null,
  };
}

/** Whole ET calendar days from `fromIso` to `nowIso`; null when either is not an instant. */
export function etDaysBetween(fromIso, nowIso) {
  const a = etDateOf(fromIso);
  const b = etDateOf(nowIso);
  if (!a || !b) return null;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * The read projection (spec §6.7, as amended by §15 S-5: no symbol keys).
 * @param {object} record  the stored research record
 * @param {{ lines?: object, nowIso: string }} ctx  lines: the latest step's refs (session.latestLinesOf)
 */
export function projectionOf(record, { lines = null, nowIso }) {
  if (!record) return null;
  const all = Array.isArray(record.findings) ? record.findings : [];
  const current = currentFindingsOf(record);
  const currentIds = new Set(current.map((f) => f.findingId));
  const summary = record.summary ?? null;
  const next = current.filter((f) => f.kind === 'next_action').at(-1) ?? null;
  return {
    researchWorkId: record.researchWorkId,
    question: record.question ?? null,
    state: record.state,
    terminalReason: record.terminalReason ?? null,
    endedAt: record.endedAt ?? null,
    createdAt: record.createdAt,
    lastTurnAt: record.telemetry?.lastTurnAt ?? null,
    summary: summary ? { rev: summary.rev, text: summary.text, at: summary.at, basedOn: [...(summary.basedOn ?? [])] } : null,
    summaryRevisions: (Array.isArray(record.summaryRevisions) ? record.summaryRevisions : []).map((r) => ({ rev: r.rev, text: r.text, at: r.at })),
    findings: current.map(findingViewOf),
    superseded: all.filter((f) => !currentIds.has(f?.findingId)).map(findingViewOf),
    lines: lines ?? { support: null, complication: null, missing: null },
    nextAction: next ? findingViewOf(next) : null,
    age: summary ? etDaysBetween(summary.at, nowIso) : null,
  };
}
