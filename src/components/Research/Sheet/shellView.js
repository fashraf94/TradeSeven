// src/components/Research/Sheet/shellView.js
//
// The two-view shell's VIEW STATE MACHINE (Amendment C §1, §5; spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-4). PURE: the modal holds the
// state and calls these from its handlers (never from an effect), so a view
// switch and the timeframe it needs land in one render.
//
//   views     Analysis · Chart, and 💣 when the mount has Bomb mode (a bombContext).
//   open      'analysis' — or 'chart' under CP-2 (opensOnChart, OV-1 – OV-5) — except FQ-9: a measured held stock inside a zone's band at
//             open (opensInRedZone, decided once) or the Battle View's "See all levels ›"
//             door (BD-7, opensOnBomb) opens on 'bomb'; so does a mount with Bomb mode but
//             no sheet whose own defaultTab / defaultTimeframe asks for the bomb (BS-1).
//   💣        entering sets the research hook's timeframe to 'bomb' (its zone logic then
//             moves it to 'spectate' and back, as today); leaving restores the Chart view's
//             LAST timeframe (1D or 1W). Analysis ↔ Chart touches no timeframe, so the hook
//             refetches nothing it holds.

import { RESEARCH_MODAL_OPENING_VIEW, RESEARCH_MODAL_OPENING_VIEWS } from '../../../config/researchModalFlags.js';

export const SHELL_VIEWS = Object.freeze(['analysis', 'chart', 'bomb']);

/**
 * OV-4: the opening view's one named constant, read at call time — 'chart' or 'analysis'; any other value, or a mock of
 * the flags module without it, reads 'analysis' (today's opening). Never throws.
 */
export function resolveOpeningView() {
  try {
    const views = RESEARCH_MODAL_OPENING_VIEWS;
    const view = RESEARCH_MODAL_OPENING_VIEW;
    return Array.isArray(views) && views.includes(view) ? view : 'analysis';
  } catch {
    return 'analysis';
  }
}

/**
 * CP-2, OV-1 – OV-5: does a stock open on the Chart view? Only where the shell is on (the caller's gate), the opening
 * view is 'chart', the Chart view's read is not 'off' (OV-5: 'off' opens exactly as before), and the modal was not
 * opened from Battle Research — a row of a research question (state 2, `research`) or of the opening's list (state 1,
 * `rankings`), whose content is the Analysis view's (OV-2). 💣's openings are decided before this (openingView).
 * @param {{ chartReadMode: string, openingView?: string, fromBattleResearch?: boolean }} p
 */
export function opensOnChart({ chartReadMode, openingView = resolveOpeningView(), fromBattleResearch = false }) {
  return openingView === 'chart' && typeof chartReadMode === 'string' && chartReadMode !== 'off' && fromBattleResearch !== true;
}

/** The pills a mount shows: three with Bomb mode, two without (browse). */
export function shellViewsFor({ bomb }) {
  return bomb ? ['analysis', 'chart', 'bomb'] : ['analysis', 'chart'];
}

/** Where the shell opens: 💣 when FQ-9 / BD-7 / BS-1 decided so at open; else Chart when CP-2 says so (opensOnChart); else Analysis. */
export function openingView({ opensOnBomb, onChart = false }) {
  if (opensOnBomb === true) return 'bomb';
  return onChart === true ? 'chart' : 'analysis';
}

/** The Chart view's own timeframes (the 💣 view's are 'bomb' and 'spectate'). */
export const isChartTimeframe = (tf) => tf === '1D' || tf === '1W';
export const isBombTimeframe = (tf) => tf === 'bomb' || tf === 'spectate';

/**
 * BS-1 (the founder's ruling on reading 7, 2026-11-12): a mount with Bomb mode but no
 * sheet (the BaggerBomb battle view, the free-agent bar) opens on 💣 when its own
 * defaultTab or defaultTimeframe asks for the bomb, as it does off the shell; otherwise
 * on Analysis. The agent Battle View's mounts (they hand a sheetContext) are not asked
 * this: they keep FQ-9 and BD-7.
 */
export function bombOnlyOpensOnBomb({ defaultTab, defaultTimeframe }) {
  return defaultTab === 'baggerbomb' || isBombTimeframe(defaultTimeframe);
}

/**
 * R-27: the 💣 pill warms while a held stock is IN a zone — the live red zone (its
 * approach and its banked moment) or the live Danger Zone. The frozen views of a shut
 * market ('closed', 'dangerClosed') are not live (redZone.js: "the zone is never live"
 * there; Bomb mode greys its own chip), so they never warm the pill — the same live
 * modes FQ-9's opensInRedZone counts, plus the banked moment.
 */
export const isLiveZoneMode = (mode) => mode === 'approaching' || mode === 'banked' || mode === 'danger';

/**
 * The shell appeared on an open modal (a late per-battle verdict, or a stock reached from
 * an index or a sector ETF): the view that matches what today's modal was showing — 💣
 * when it was on the bomb series and Bomb mode draws it; the Chart view when it was on the
 * bomb series with Bomb mode rolled back (the legacy 💣 chart lives there); else Analysis.
 */
export function viewOnShellAppear({ timeframe, bomb }) {
  if (!isBombTimeframe(timeframe)) return 'analysis';
  return bomb ? 'bomb' : 'chart';
}

/**
 * One view switch: the view, and the timeframe to set with it (null → none).
 * @param {object} p
 * @param {'analysis'|'chart'|'bomb'} p.to
 * @param {string} p.timeframe     the research hook's timeframe now
 * @param {'1D'|'1W'} p.lastChartTf the Chart view's last timeframe
 * @returns {{ view: string, timeframe: string|null }}
 */
export function switchView({ to, timeframe, lastChartTf }) {
  if (to === 'bomb') return { view: 'bomb', timeframe: isBombTimeframe(timeframe) ? null : 'bomb' };
  if (isBombTimeframe(timeframe)) return { view: to, timeframe: isChartTimeframe(lastChartTf) ? lastChartTf : '1D' };
  return { view: to, timeframe: null };
}

/**
 * "See on chart ›" on a pack item: the timeframe its pin is drawn on, when the
 * chart is not on it now (a time pin and its caption draw on 1D only — Build C
 * BC-8; a price pin draws on 1D and 1W).
 */
export function seeOnChartTimeframe({ pin, timeframe }) {
  if (pin?.type === 'time') return timeframe === '1D' ? null : '1D';
  if (pin?.type === 'price') return isChartTimeframe(timeframe) ? null : '1D';
  return null;
}

/**
 * The Chart view's plot height (the 💣 view's plot takes the same): the view's
 * measured height less StockChart's 44 px control row and a 72 px peek of the
 * Technical content below it in the same scroll, held between 240 and 560 px.
 */
export function shellChartHeight(viewHeight) {
  const h = Number.isFinite(viewHeight) ? Math.round(viewHeight - 44 - 72) : 0;
  return Math.max(240, Math.min(560, h));
}
