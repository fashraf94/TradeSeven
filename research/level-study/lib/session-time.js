// research/level-study/lib/session-time.js
//
// Exchange-time (America/New_York) utilities. THE DST CORRECTNESS BACKBONE.
//
// EODHD 5-min bars are labelled in UTC (gmtoffset:0 on every bar; S1 §4/§6). The NYSE
// regular session (09:30–16:00 ET) therefore maps to DIFFERENT UTC windows in winter
// (EST, UTC−5) vs summer (EDT, UTC−4): the 16:00 ET closing-auction print sits at
// 20:00 UTC in summer but 21:00 UTC in winter. Every session-boundary, hourly-anchor,
// and auction-bar decision in this study is made in EXCHANGE TIME, derived from each
// bar's UTC epoch via Intl with timeZone 'America/New_York' — NEVER a hardcoded offset.
// (S2 prompt §4 DST warning; parent §3.5/§4.4.)
//
// Zero imports. Pure functions.

const ET_PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23', // force 00–23 (avoids the '24:00' midnight quirk of hour12:false)
});

const ET_TZ_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', timeZoneName: 'short', year: 'numeric',
});

/**
 * Convert a UTC epoch (seconds) to America/New_York wall-clock parts.
 * @param {number} epochSeconds
 * @returns {{year:number,month:number,day:number,hour:number,minute:number,second:number,etDate:string,etMinutes:number}}
 *   etDate = 'YYYY-MM-DD' in ET; etMinutes = minutes since ET midnight (09:30 → 570, 16:00 → 960).
 */
export function etParts(epochSeconds) {
  const parts = ET_PARTS_FMT.formatToParts(new Date(epochSeconds * 1000));
  const m = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;
  const hour = Number(m.hour);
  const minute = Number(m.minute);
  return {
    year: Number(m.year), month: Number(m.month), day: Number(m.day),
    hour, minute, second: Number(m.second),
    etDate: `${m.year}-${m.month}-${m.day}`,
    etMinutes: hour * 60 + minute,
  };
}

/**
 * Return 'EDT' or 'EST' for a UTC epoch — the DST regime, for proofs/reporting.
 * @param {number} epochSeconds
 * @returns {string}
 */
export function etTzAbbrev(epochSeconds) {
  const parts = ET_TZ_FMT.formatToParts(new Date(epochSeconds * 1000));
  const tz = parts.find((p) => p.type === 'timeZoneName');
  return tz ? tz.value : '';
}

// ── Calendar-date arithmetic (UTC-anchored; counts calendar days, DST-agnostic) ──

/** 'YYYY-MM-DD' → Date at UTC midnight. */
function isoToUtcDate(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

/** UNIX epoch-seconds for 'YYYY-MM-DD' at 00:00:00 UTC — the EODHD intraday from/to encoding (S1 capture.mjs). */
export function dateToUtcEpoch(iso) {
  return Math.floor(isoToUtcDate(iso).getTime() / 1000);
}

/** Add n calendar days to an ISO date, return ISO date. */
export function addDays(iso, n) {
  const d = isoToUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Calendar days from aIso to bIso (b − a); negative if b precedes a. */
export function diffDays(aIso, bIso) {
  return Math.round((isoToUtcDate(bIso).getTime() - isoToUtcDate(aIso).getTime()) / 86400000);
}

/** Lexicographic ISO-date compare works because the format is zero-padded; expose intent explicitly. */
export function isoBefore(aIso, bIso) { return aIso < bIso; }
export function isoOnOrAfter(aIso, bIso) { return aIso >= bIso; }
