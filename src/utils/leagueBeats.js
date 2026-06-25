// src/utils/leagueBeats.js
//
// League Battle View V2 — client-side BEAT derivation (Phase 1, pure +
// node-clean). A "beat" is one drama event the surface lights up: a lead change,
// a flip, an agent swap, a star hit/bust, a resolved claim. ALL derived from
// data already in hand (the climb series + group feed + battle trades + claims +
// the meter's star states) — NO backend, NO new feed types.
//
// STRING ONE-HOME (BUILD_RULES §4): feed-event narration REUSES feedEventText
// (tournamentSurfaces.js) so beats never drift from the GroupFeed renderer. Lead
// ordering REUSES rankByScores (leagueTournament.js) so a tie at the top can't
// emit a phantom lead. Trade/claim/state beats carry their own minimal text
// (they are not feed events) — the component restyles; this is the data shape.
//
// Beat shape (the locked design contract):
//   { kind, text, pts, star, tone, voice? }
//   kind: 'edge'|'hit'|'swap'|'danger'|'claim'|'lead'|'flip'
//   pts:  signed points scalar or null (format with fmtPoints at render)
//   star: the symbol this beat is about, or null (lead/board may be null)
//   tone: 'good'|'bad'|'neutral'

import { feedEventText } from './tournamentSurfaces';
import { rankByScores } from '../constants/leagueTournament';

const numOrNull = (n) => (Number.isFinite(n) ? n : null);
const toneOf = (n) => (Number.isFinite(n) ? (n > 0 ? 'good' : n < 0 ? 'bad' : 'neutral') : 'neutral');

// Only RESOLVED claims become beats — a pending claim must not render as "lost".
const CLAIM_WON = new Set(['approved', 'won']);
const CLAIM_LOST = new Set(['denied', 'lost', 'rejected']);

// Normalize a timestamp to epoch millis. Accepts an ISO string, an epoch
// number, a Date, or a Firestore Timestamp ({toMillis} / {seconds}) — callers
// hydrating docs straight from Firestore pass Timestamp objects, and a naive
// Date.parse(Timestamp) → NaN would silently reorder the whole stream.
export function tsToMillis(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof raw === 'object') {
    if (typeof raw.toMillis === 'function') {
      const m = raw.toMillis();
      return Number.isFinite(m) ? m : null;
    }
    if (Number.isFinite(raw.seconds)) {
      return raw.seconds * 1000 + (Number.isFinite(raw.nanoseconds) ? Math.floor(raw.nanoseconds / 1e6) : 0);
    }
    if (typeof raw.getTime === 'function') {
      const m = raw.getTime();
      return Number.isFinite(m) ? m : null;
    }
  }
  return null;
}

// Attach a sort key (most-recent-first); event beats use their timestamp,
// transition/lead beats (no timestamp) float to the top as "now".
function withTs(beat, rawTs) {
  const m = tsToMillis(rawTs);
  beat._ts = m == null ? Number.MAX_SAFE_INTEGER : m;
  return beat;
}
function stripTs(beat) {
  const copy = { ...beat };
  delete copy._ts;
  return copy;
}

// Lead changes across the climb series' day indices.
function leadBeats(series, uid, name) {
  const ids = Object.keys(series || {});
  if (!ids.length) return [];
  const len = ids.reduce((m, id) => Math.max(m, series[id]?.length || 0), 0);
  const out = [];
  let prevLeader = null;
  for (let i = 0; i < len; i++) {
    const scores = {};
    for (const id of ids) scores[id] = series[id]?.[i] ?? 0;
    const leader = rankByScores(scores, ids)[0];
    if (i > 0 && leader && leader !== prevLeader) {
      out.push(withTs({
        kind: 'lead',
        text: `${name(leader)} took the lead`,
        pts: null,
        star: null,
        tone: leader === uid ? 'good' : 'neutral',
      }, null));
    }
    prevLeader = leader;
  }
  return out;
}

// A star transitioning INTO a notable disposition vs the prior snapshot.
const TRANSITION = {
  hit: ['hit', 'good'],
  busted: ['danger', 'bad'], // busted maps to the loudest down-beat kind
  edge: ['edge', 'good'],
  danger: ['danger', 'bad'],
};
function stateBeats(starStates, prevStarStates) {
  const byTk = (rows) => {
    const m = {};
    for (const r of rows || []) if (r?.tk) m[r.tk] = r;
    return m;
  };
  const out = [];
  for (const id of Object.keys(starStates || {})) {
    const cur = byTk(starStates[id]);
    const prev = byTk(prevStarStates?.[id]);
    for (const tk of Object.keys(cur)) {
      const row = cur[tk];
      const before = prev[tk]?.state;
      const map = TRANSITION[row.state];
      if (map && row.state !== before) {
        const [kind, tone] = map;
        out.push(withTs({
          kind,
          text: row.badge ? `${tk} hit ${row.badge}` : `${tk} ${kind}`,
          pts: numOrNull(row.points),
          star: tk,
          tone,
        }, null));
      }
    }
  }
  return out;
}

/**
 * Derive the beat stream from already-assembled inputs. Pure; most-recent-first.
 *
 * @param {Object} args
 * @param {Object<string,number[]>} args.series      from buildClimbSeries (lead changes)
 * @param {Object[]}                args.feed        group.feed[] (flip / double_down / board_auto_commit)
 * @param {Object[]}                args.trades      battle.trades[] (agent swap closes)
 * @param {Object[]}                args.claims      resolved claim records (status approved/denied)
 * @param {Object<string,Object[]>} args.starStates  {id: StarRow[]} CURRENT (hit/bust transitions)
 * @param {Object<string,Object[]>} args.prevStarStates {id: StarRow[]} PRIOR
 * @param {Object<string,string>}   args.seatNames   {id: displayName} for lead text
 * @param {string|null}             args.uid
 * @returns {Object[]} beat[]
 */
export function deriveBeats({
  series = {},
  feed = [],
  trades = [],
  claims = [],
  starStates = {},
  prevStarStates = {},
  seatNames = {},
  uid = null,
} = {}) {
  const name = (id) => seatNames[id] || (id === uid ? 'You' : id);
  const beats = [];

  beats.push(...leadBeats(series, uid, name));

  for (const ev of feed || []) {
    if (ev?.type === 'flip') {
      beats.push(withTs({
        kind: 'flip',
        text: feedEventText(ev, uid),
        pts: numOrNull(ev.bankedLegScore),
        star: ev.symbol ?? null,
        tone: toneOf(ev.bankedLegScore),
      }, ev.timestamp));
    } else if (ev?.type === 'double_down') {
      beats.push(withTs({
        kind: 'swap',
        text: feedEventText(ev, uid),
        pts: null,
        star: ev.symbol ?? null,
        tone: 'neutral',
      }, ev.timestamp));
    } else if (ev?.type === 'board_auto_commit') {
      beats.push(withTs({
        kind: 'swap',
        text: feedEventText(ev, uid),
        pts: null,
        star: null,
        tone: 'neutral',
      }, ev.timestamp));
    }
  }

  for (const t of trades || []) {
    if (!t?.symbolIn && !t?.symbolOut) continue;
    beats.push(withTs({
      kind: 'swap',
      text: `swapped ${t.symbolOut ?? '—'} → ${t.symbolIn ?? '—'}`,
      pts: numOrNull(t.lockedPoints),
      star: t.symbolIn ?? t.symbolOut ?? null,
      tone: toneOf(t.lockedPoints),
    }, t.swappedOutAt));
  }

  for (const c of claims || []) {
    const won = CLAIM_WON.has(c?.status);
    const lost = CLAIM_LOST.has(c?.status);
    if (!won && !lost) continue; // only RESOLVED claims beat — never a pending one as "lost"
    const star = c?.addSymbol ?? c?.symbol ?? null;
    beats.push(withTs({
      kind: 'claim',
      text: `${name(c?.odUserId)} ${won ? 'won' : 'lost'} the ${star ?? 'name'} claim`,
      pts: null,
      star,
      tone: won ? 'good' : 'neutral',
    }, c?.processedAt ?? c?.submittedAt));
  }

  beats.push(...stateBeats(starStates, prevStarStates));

  beats.sort((a, b) => b._ts - a._ts);
  return beats.map(stripTs);
}
