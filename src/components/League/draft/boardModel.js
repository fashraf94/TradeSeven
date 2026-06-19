// src/components/League/draft/boardModel.js
//
// The board's brain — pure, client-side, fence-clean. This is the one piece of
// REAL logic the redesign builds (spec §2): it turns the loaded stockRankings
// fields into the design's fit-ranked, tiered "best available" board with
// plain-language reason lines.
//
// Fit is a DIRECT READ of arch_scores[archetype] (computed nightly by the
// non-fenced api/_utils/archetypeScoring engine — we read precomputed values,
// we never recompute or edit the engine). The design invented six lens NAMES;
// the engine has six lens KEYS. ARCH maps the design's identity (label/tint/
// icon/copy) onto the real keys so the board mirrors the design faithfully.

// design label/tint/icon/copy, keyed by the REAL archetype key (= arch_scores key).
export const ARCH = {
  momentum_chaser: { key: 'momentum_chaser', name: 'Trend Follower',       tint: '#5EEAD4', icon: 'trend',   tagline: 'Goes where the momentum is.',        rewards: 'Momentum + technical strength' },
  contrarian:      { key: 'contrarian',      name: 'Contrarian',           tint: '#E8927C', icon: 'refresh', tagline: "Buys what everyone's giving up on.", rewards: 'Beaten-down, out-of-favor names' },
  diversifier:     { key: 'diversifier',     name: 'Diversifier',          tint: '#5B8DEF', icon: 'grid',    tagline: 'No single bet can sink you.',        rewards: 'Spread across sectors' },
  degen:           { key: 'degen',           name: 'Speculator',           tint: '#F0C75E', icon: 'bolt',    tagline: 'Chases the biggest moves.',          rewards: 'Widest swings / highest volatility' },
  analyst:         { key: 'analyst',         name: 'Fundamental Investor', tint: '#7BD88F', icon: 'shield',  tagline: 'Lets the fundamentals do the work.', rewards: 'Strong fundamentals, quality' },
  guardian:        { key: 'guardian',        name: 'Capital Preserver',    tint: '#6FB6C9', icon: 'anchor',  tagline: 'Protects the downside first.',       rewards: 'Defensive, low-volatility' },
};

export const DEFAULT_ARCH = 'analyst';

export function archMeta(key) {
  return ARCH[key] || ARCH[DEFAULT_ARCH];
}

// Tiers — kill the paralysis of #4 vs #5. Banded on absolute fit. Bands ported
// from the design; they were tuned to the mock's fit distribution, so they may
// want a light re-tune against live arch_scores (a founder-tunable constant).
export const TIERS = [
  { id: 'top',    min: 82, label: 'Top tier',   note: 'your agent loves these' },
  { id: 'strong', min: 68, label: 'Strong fit', note: '' },
  { id: 'solid',  min: 50, label: 'Solid',      note: '' },
  { id: 'reach',  min: 0,  label: 'Reach',      note: 'off-archetype' },
];

export function tierFor(fit) {
  return (TIERS.find((t) => fit >= t.min) || TIERS[TIERS.length - 1]).id;
}

function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

// atrPercentile (0–1) → the design's volatility text band.
export function volTextFromAtr(atrPct) {
  if (atrPct == null) return '—';
  const p = atrPct > 1 ? atrPct / 100 : atrPct; // tolerate either scale
  if (p >= 0.85) return 'Extreme';
  if (p >= 0.65) return 'High';
  if (p >= 0.40) return 'Medium';
  return 'Low';
}

// The fit a name reads off, with the Diversifier sector-doubling overlay applied
// client-side (founder-approved): arch_scores['diversifier'] is static per name,
// so we subtract a penalty for each pick you already hold in that sector.
function rawFit(archKey, row) {
  const s = row.archScores || {};
  const v = s[archKey];
  if (typeof v === 'number') return v;
  // fallback: composite (the board stays sensible if a score is missing)
  return typeof row.compositeScore === 'number' ? row.compositeScore : 0;
}

const DIVERSIFY_SECTOR_PENALTY = 26; // per already-owned pick in the sector (design value)

// One-line plain reason, keyed to the archetype's dominant real pillar(s) and
// banded by the name's fit so the copy never contradicts the score. Concrete,
// no jargon — it teaches a newcomer WHY a name fits (spec §2).
export function reasonFor(archKey, row, fit, ownedSectorCounts) {
  const sector = row.sectorName || 'Other';
  const momRank = row.momentumRank;
  const ret1W = row.return1W;
  const ytd = row.returnYTD;
  const comp = row.compositeScore;
  const vol = volTextFromAtr(row.atrPercentile);
  const volKnown = vol !== '—';

  switch (archKey) {
    case 'momentum_chaser':
      if (fit >= 82) return momRank != null ? `Strongest trend on the board — #${momRank} in momentum` : 'Strongest trend on the board';
      if (fit >= 68) return ret1W != null && ret1W >= 0 ? `Powerful uptrend, up ${ret1W}% this week` : 'Powerful uptrend, technically strong';
      if (fit >= 50) return momRank != null ? `Trend intact — #${momRank} in momentum` : 'Trend intact and holding up';
      return 'Momentum has cooled — a lukewarm fit';
    case 'contrarian':
      if (fit >= 82) return ytd != null && ytd < 0 ? `Deeply out of favor — down ${Math.abs(ytd)}% on the year` : 'Deeply out of favor, sentiment washed out';
      if (fit >= 68) return 'Beaten down, sentiment washed out';
      if (fit >= 50) return 'Cheap and overlooked';
      return 'Too loved already — thin contrarian edge';
    case 'degen':
      if (fit >= 82) return volKnown ? `Wildest swings on the board — ${vol.toLowerCase()} volatility` : 'Wildest swings on the board';
      if (fit >= 68) return 'High volatility — big moves both ways';
      if (fit >= 50) return 'Lively enough to move the needle';
      return 'Too quiet to chase';
    case 'analyst':
      if (fit >= 82) return comp != null ? `Best-in-class fundamentals — ${Math.round(comp)} composite` : 'Best-in-class fundamentals';
      if (fit >= 68) return 'Strong quality and balance sheet';
      if (fit >= 50) return 'Solid fundamentals, dependable';
      return 'Shaky fundamentals — a weak fit';
    case 'guardian':
      if (fit >= 82) return 'Rock-steady — the lowest drawdown risk here';
      if (fit >= 68) return volKnown ? `Defensive ballast — ${vol.toLowerCase()} volatility` : 'Defensive ballast — steady and low-risk';
      if (fit >= 50) return 'Reasonably defensive';
      return 'Too volatile to protect capital';
    case 'diversifier':
      if (ownedSectorCounts && ownedSectorCounts[sector]) return `Doubles your ${sector} bet — a diversification cost`;
      if (fit >= 82) return `Quality name in a fresh sector (${sector})`;
      if (fit >= 68) return `Adds ${sector} — a new sector for the book`;
      return `Broadens the book into ${sector}`;
    default:
      return comp != null ? `${Math.round(comp)} composite` : '';
  }
}

// Build the human's board for a lens: rank the AVAILABLE pool names by
// arch_scores[archKey] desc (the ADP spine), tier by absolute fit, and stamp the
// reason. Re-call on every pick (availableRows shrinks as `taken` grows) so the
// board re-ranks live. Pure; never mutates inputs.
//
// availableRows: [{ symbol, sectorName, archScores, compositeScore, momentumScore,
//   momentumRank, fundamentalScore, technicalScore, atrPercentile,
//   return1W, return1M, return3M, returnYTD }] — already filtered to available.
// ownedSectorCounts: { [sectorName]: count } from your own picks (Diversifier overlay).
export function buildFitBoard({ availableRows = [], archKey = DEFAULT_ARCH, ownedSectorCounts = {} } = {}) {
  const key = ARCH[archKey] ? archKey : DEFAULT_ARCH;
  const rows = availableRows.map((row) => {
    let fit = rawFit(key, row);
    if (key === 'diversifier' && ownedSectorCounts[row.sectorName]) {
      fit = clamp(fit - DIVERSIFY_SECTOR_PENALTY * ownedSectorCounts[row.sectorName]);
    } else {
      fit = clamp(fit);
    }
    return {
      ...row,
      fit,
      tier: tierFor(fit),
      reason: reasonFor(key, row, fit, ownedSectorCounts),
      volTxt: volTextFromAtr(row.atrPercentile),
    };
  });
  rows.sort((a, b) => (b.fit - a.fit) || ((b.compositeScore ?? -1) - (a.compositeScore ?? -1)) || a.symbol.localeCompare(b.symbol));
  return rows.map((r, i) => ({ ...r, boardRank: i + 1 }));
}

// Group a built board into tier sections, in tier order, dropping empties.
export function tierGroupsOf(board) {
  return TIERS
    .map((t) => ({ tier: t.id, items: board.filter((s) => s.tier === t.id) }))
    .filter((g) => g.items.length);
}
