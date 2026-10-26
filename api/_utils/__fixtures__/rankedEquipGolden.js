// Test-only comparison for the measured-thresholds follow-up, ruling F2
// (Flash, Oct 25, 2026; the stockAdmissionGolden.js / tournamentSettlementGolden.js
// precedent). The frozen deploy golden (deployCarriageOffGolden.json, captured
// from main @ 4b28cd84) stays byte-identical, SHA pin and all. Its equipped
// list (deployHarness.js watchlistDoc: NVDA, PLTR, AMD) holds PLTR, which is
// outside the harness's ranked UNIVERSE. Under F2 a tiered deploy still
// WATCHES PLTR (the Sonnet request and the battle's equippedWatchlist snapshot
// keep it) but never FOLDS it, so the baseline drops it from exactly:
//   - the Haiku request's AVAILABLE STOCKS row and its USER-EQUIPPED note;
//   - every `shortlist` and `hotBench` array, with the `totalStocks` beside a
//     hotBench and the deploy's `shortlistCount` / `shortlistSize` one lower.
// Every other byte — the Sonnet request, the snapshot, the manifest and its
// equippedConfigHash, every read, query and other write — is compared as
// captured. A deploy whose Haiku request holds no PLTR row (no equip, an
// uncommitted list, the tournament branch) is returned unchanged.

export const OFF_LIST_EQUIPPED = 'PLTR';
const ROW = `\n${OFF_LIST_EQUIPPED}|Unknown|-|-|-|-|-|-|-|-\n`;
const NOTE_BEFORE = 'watchlist: NVDA, PLTR, AMD.';
const NOTE_AFTER = 'watchlist: NVDA, AMD.';

function replaceOnce(text, from, to) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw Error(`rankedEquipGolden: expected exactly one ${JSON.stringify(from)}, found ${n}`);
  return text.replace(from, to);
}

/** One deploy capture as F2 makes it. */
export function rankedEquipCapture(capture) {
  const out = structuredClone(capture);
  const haiku = (out.modelRequests || []).find((r) => r.tool_choice?.name === 'submit_portfolio');
  if (!haiku || typeof haiku.system !== 'string' || !haiku.system.includes(ROW)) return out;
  haiku.system = replaceOnce(replaceOnce(haiku.system, ROW, '\n'), NOTE_BEFORE, NOTE_AFTER);
  let arrays = 0;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'shortlist' || key === 'hotBench') && Array.isArray(value) && value.includes(OFF_LIST_EQUIPPED)) {
        node[key] = value.filter((s) => s !== OFF_LIST_EQUIPPED);
        if (key === 'hotBench') node.totalStocks -= 1;
        arrays += 1;
      } else if (/(^|\.)shortlist(Count|Size)$/.test(key) && typeof value === 'number') {
        // `deployProgress.shortlistCount` is a dot-path key in the update payload.
        node[key] = value - 1;
      } else {
        walk(value);
      }
    }
  };
  walk(out);
  if (arrays === 0) throw Error('rankedEquipGolden: the Haiku request held PLTR but no shortlist or hotBench did');
  return out;
}

/** The whole golden fixture (both fence keys) as F2 makes it. */
export function rankedEquipGolden(golden) {
  const out = { ...golden };
  for (const key of ['scenarios', 'scenariosFenceDark']) {
    if (!golden[key]) continue;
    out[key] = Object.fromEntries(Object.entries(golden[key]).map(([name, cap]) => [name, rankedEquipCapture(cap)]));
  }
  return out;
}
