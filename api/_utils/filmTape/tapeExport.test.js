// api/_utils/filmTape/tapeExport.test.js
//
// The founder read-out (BA-18) over a REAL tape: the close pass writes the
// captured fixture day at night, the candle pass enriches it the next morning
// from fixture bars (no network), and the formatter prints it. The rows that
// matter: every section is headed by its coverage line (BA-20); every number
// is labelled by the class the DOCUMENT declares (BA-21) — the ledger lists
// every numeric leaf, nothing prints UNCLASSIFIED, and no digit appears in the
// output outside a labelled number, an instant, an identifier or quoted
// recorded text; the spec's own words (BA-4/7/9/10/11/22); and the model's
// paraphrase of the player never appears.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of tapeExport.js,
// writeTapeDay.js and candlePass.js are the runtime guard for their surface.
// Never mock them. The flag module is mocked by spreading the real one.

import { describe, it, expect, vi, beforeAll } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { formatTapeMarkdown, labelled, coverageLine, counted, quoted, code, etClock, EXPORT_COVERAGE_SECTIONS } from './tapeExport.js';
import { writeTapeDay, markCloseFailed } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, skippedModeDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, stepRows, fetcherOf } from './__fixtures__/tapeBars.js';
import {
  numbersWithClasses, PROVENANCE_CLASSES, PROVENANCE_LABELS, TAPE_NUMBER_CLASSES, SERIES_NUMBER_CLASSES,
} from '../../../src/constants/filmTape.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z');
const PRICES = { AAPL: 231, MSFT: 423, NVDA: 121, AMD: 144, KO: 70.5, PEP: 171, TSLA: 242, NFLX: 704, XLK: 250, XLP: 80, XLC: 95, XLY: 210, SPY: 560, RSP: 180 };

const TITLES = {
  checks: 'Checks', actions: 'Actions', directives: 'Directives', plans: 'Plans', calls: 'Calls',
  rationale: 'Rationale', evidence: 'Evidence', replay: 'Replay', series: 'Series',
};

/** Every string value in the documents — what a “quoted” span may legitimately be. */
function storedStrings(...docs) {
  const out = new Set();
  const walk = (v) => {
    if (typeof v === 'string') out.add(v.replace(/\s*\n\s*/g, ' '));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  docs.forEach(walk);
  return out;
}

/**
 * Every digit the read-out prints that is NOT inside a labelled number, an
 * instant, an identifier (code span) or quoted recorded text — and neither of
 * those two can hide a stored number (review L4-F7): a code span is blanked
 * only when it is not a bare number, a “quoted” span only when its text is a
 * string the documents actually store. The fixed copy that carries digits is
 * the spec's own labels.
 */
function strayDigits(markdown, docs = []) {
  const strings = storedStrings(...docs);
  let s = markdown;
  s = s.replace(/`([^`]*)`/g, (m, inner) => (/^[-+]?\d+(\.\d+)?%?$/.test(inner.trim()) ? m : ' '));   // identifiers, paths, instants — never a bare number
  s = s.replace(/“([^”]*)”/g, (m, inner) => (strings.has(inner) ? ' ' : m));                           // recorded text the documents store (BA-22)
  s = s.replace(/-?\d+(\.\d+)?%? \((recorded|derived|rebuilt|market)\)/g, ' '); // labelled numbers
  s = s.replace(/\b\d{1,2}:\d{2} (AM|PM) ET\b/g, ' ');                       // ET clock
  // the spec's own class labels that spell a digit ("1-minute bars"), and the series interval in words
  for (const label of Object.values(PROVENANCE_LABELS).filter((l) => /\d/.test(l))) s = s.split(label).join(' ');
  s = s.replace(/\b10-minute\b/g, ' ');
  const lines = s.split('\n').filter((l) => /\d/.test(l));
  return lines;
}

let fullTape;
let seriesDocs;
let md;

beforeAll(async () => {
  flags.writer = true;
  const fx = await capturedDay();
  const t = makeTapeDb(seedDay({}, fx));
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT });
  const bars = {};
  for (const [s, p] of Object.entries(PRICES)) bars[s] = flatRows(D, p);
  // a moving name so the rebuilt numbers are not all equal
  bars.TSLA = stepRows(D, 242, 250, '17:00', { extras: false });
  const fetcher = fetcherOf(bars);
  await runCandlePass({ db: t.db, fetchCandles: fetcher.fetchCandles, clock: () => MORNING, startMs: MORNING });
  fullTape = t.store.get(`agentBattles/${fx.battleId}/tape/${D}`);
  seriesDocs = [...t.store.entries()].filter(([k]) => k.startsWith(`agentBattles/${fx.battleId}/tape/${D}/series/`)).map(([, v]) => v);
  md = formatTapeMarkdown(fullTape, seriesDocs);
});

describe('the fixture is a full tape day (so the read-out is exercised on every section)', () => {
  it('has checks, actions with a replay, directives, plans with prices, calls, rationale and series', () => {
    expect(fullTape.passes.candles.status).toBe('written');
    expect(fullTape.actions.length).toBeGreaterThan(0);
    expect(fullTape.actions.every((a) => a.replay && a.replay.hypothetical === true)).toBe(true);
    expect(fullTape.directives.length).toBe(3);
    expect(fullTape.plans.every((p) => p.price && p.price.atPlan)).toBe(true);
    expect(fullTape.calls.length).toBeGreaterThan(0);
    expect(fullTape.rationale.length).toBeGreaterThan(0);
    expect(seriesDocs.length).toBe(fullTape.passes.candles.symbolsRequested.length);
  });
});

describe('BA-20 — every section is headed by its coverage line', () => {
  it.each(EXPORT_COVERAGE_SECTIONS)('%s: the line after its heading is its coverage, with the stored status', (section) => {
    const lines = md.split('\n');
    const at = lines.indexOf(`## ${TITLES[section]}`);
    expect(at, `heading for ${section}`).toBeGreaterThan(-1);
    expect(lines[at + 1]).toBe(coverageLine(fullTape.coverage[section]));
    expect(lines[at + 1].startsWith(`> coverage: **${fullTape.coverage[section].status}**`)).toBe(true);
  });

  it('a preserved section names the run it was preserved from; a note is quoted as the tape\'s own words', () => {
    const line = coverageLine({ status: 'partial', span: { from: 'a', to: 'b' }, sources: ['ticks'], preservedFrom: '2026-09-25T02:15:30.000Z', note: '3 check(s) have no record' });
    expect(line).toBe('> coverage: **partial** · `a` → `b` · sources: `ticks` · preserved from: `2026-09-25T02:15:30.000Z` · “3 check(s) have no record”');
    expect(coverageLine(undefined)).toBe('> coverage: **not recorded**');
  });
});

describe('BA-21 — every number labelled by the class its document declares', () => {
  it('nothing in the read-out is UNCLASSIFIED', () => {
    expect(md).not.toContain('UNCLASSIFIED');
  });

  it('the ledger lists every numeric leaf of the tape document with one of the four classes', () => {
    const nums = numbersWithClasses(fullTape, fullTape.numberClasses);
    expect(nums.length).toBeGreaterThan(100);
    const ledger = md.slice(md.indexOf('## Number ledger'));
    const rows = ledger.split('\n').filter((l) => l.startsWith('| `'));
    expect(rows).toHaveLength(nums.length);
    for (const row of rows) expect(row).toMatch(new RegExp(`\\| -?[\\d.e+-]+ \\((${PROVENANCE_CLASSES.join('|')})\\) \\|$`));
  });

  it('no digit is printed outside a labelled number, an instant, an identifier or quoted recorded text', () => {
    expect(strayDigits(md, [fullTape, ...seriesDocs])).toEqual([]);
  });

  it('the scan is live: an unlabelled number in the output is caught', () => {
    expect(strayDigits(`${md}\n- total 42`, [fullTape, ...seriesDocs])).toEqual(['- total 42']);
    // …and a stored number cannot hide in a code span or in quotes (review L4-F7)
    expect(strayDigits(`${md}\n- banked \`-12.5\``, [fullTape, ...seriesDocs])).toEqual(['- banked `-12.5`']);
    expect(strayDigits(`${md}\n- banked “-12.5”`, [fullTape, ...seriesDocs])).toEqual(['- banked “-12.5”']);
  });

  it('the class comes from the DOCUMENT: drop a declaration and the number prints UNCLASSIFIED', () => {
    const { 'score.lastCheck.total': _dropped, ...rest } = TAPE_NUMBER_CLASSES;
    const doc = { ...fullTape, numberClasses: rest };
    const out = formatTapeMarkdown(doc, seriesDocs);
    expect(out).toContain(`${fullTape.score.lastCheck.total} (UNCLASSIFIED)`);
    expect(labelled(doc, ['score', 'lastCheck', 'total'], fullTape.score.lastCheck.total)).toBe(`${fullTape.score.lastCheck.total} (UNCLASSIFIED)`);
  });

  it('series numbers are labelled from the series document\'s own declaration (market)', () => {
    const spy = seriesDocs.find((s) => s.symbol === 'SPY');
    expect(md).toContain(`| SPY | market | \`10m\` | ${spy.sessionOpen.value} (market) |`);
  });

  it('the helpers: a missing number is a dash; a count is derived; recorded text is quoted verbatim', () => {
    expect(labelled(fullTape, ['score', 'lastCheck', 'total'], null)).toBe('—');
    expect(labelled(fullTape, ['actions', 0, 'lockedGainPct'], 1.5, '%')).toBe('1.5% (recorded)');
    expect(counted(39)).toBe('39 (derived)');
    expect(quoted('line one\nline two')).toBe('“line one line two”');
    expect(quoted('')).toBe('—');
    expect(code('b-1')).toBe('`b-1`');
    expect(etClock('2026-09-24T14:07:30.000Z')).toBe('10:07 AM ET');
    expect(etClock(Date.parse('2026-09-24T20:00:00.000Z'))).toBe('4:00 PM ET');
    expect(etClock(null)).toBe('—');
  });
});

describe('the class each printed number carries is its own field\'s (review L4-F7)', () => {
  it('replay, reconciliation, comparables and plan prices print the class their field declares', () => {
    const a = fullTape.actions.find((x) => x.replay && x.replay.gapPoints !== null);
    const r = a.replay;
    expect(md).toContain(`result: banked ${a.lockedPoints} (recorded)`);
    expect(md).toContain(`gap at the close (banked + bought − sold): ${r.gapPoints} (rebuilt)`);
    expect(md).toContain(`closedLegDelta ${r.reconciliation.closedLegDelta} (rebuilt)`);
    expect(md).toContain(`sold name, as if never sold: at the swap ${r.ghost.atSwap} (rebuilt) · at the close ${r.ghost.atClose} (rebuilt)`);
    expect(md).toContain(`market: SPY ${r.marketChangeAfter.SPY}% (market)`);
    const p = fullTape.plans.find((x) => x.price?.atPlan);
    expect(md).toContain(`${p.price.atPlan.value} (market) @`);
  });

  it('THE DECLARATION IS PINNED — every path and its class; a flipped class fails here, not in a founder\'s read-out', () => {
    expect(TAPE_NUMBER_CLASSES).toEqual({
      tapeVersion: 'recorded',
      runCount: 'derived',
      dayNumber: 'derived',
      'passes.close.tickSeqRange[]': 'recorded',
      'passes.close.gaps[]': 'recorded',
      'passes.close.unattributedGaps[]': 'recorded',
      'passes.close.sources.*': 'derived',
      'passes.candles.attempts': 'derived',
      'score.lastCheck.tickSeq': 'recorded',
      'score.lastCheck.active': 'recorded',
      'score.lastCheck.banked': 'recorded',
      'score.lastCheck.total': 'recorded',
      'score.lastCheck.opponent': 'recorded',
      'score.lastCheck.bankedBadgePoints': 'recorded',
      'score.firstCheck.tickSeq': 'recorded',
      'score.firstCheck.total': 'recorded',
      'score.dayChange.value': 'derived',
      'score.dayChange.reference': 'recorded',
      'battle.final.total': 'recorded',
      'battle.final.opponent': 'recorded',
      'checks[].tickSeq': 'recorded',
      'checks[].scores.active': 'recorded',
      'checks[].scores.banked': 'recorded',
      'checks[].scores.total': 'recorded',
      'checks[].tickMs': 'recorded',
      'checks[].guardrail.deployedCount': 'recorded',
      'checks[].evidence.*.px': 'recorded',
      'checks[].evidence.*.chg': 'recorded',
      'checks[].evidence.*.atrX': 'recorded',
      'checks[].evidence.*.vwapDev': 'recorded',
      'checks[].evidence.*.bbPct': 'recorded',
      'actions[].tickSeq': 'recorded',
      'actions[].slotIndex': 'recorded',
      'actions[].entryPrice': 'recorded',
      'actions[].exitPrice': 'recorded',
      'actions[].lockedPoints': 'recorded',
      'actions[].lockedGainPct': 'recorded',
      'actions[].inBasis.price': 'recorded',
      'actions[].holdingMs': 'derived',
      'actions[].subsequentTradesInSlot': 'derived',
      'actions[].replayInputs.ghost.entryPrice': 'recorded',
      'actions[].replayInputs.ghost.atr': 'recorded',
      'actions[].replayInputs.ghost.thresholdHistory.maxMultiplier': 'recorded',
      'actions[].replayInputs.ghost.thresholdHistory.minMultiplier': 'recorded',
      'actions[].replayInputs.ghost.thresholdBaseline.value': 'recorded',
      'actions[].replayInputs.bought.entryPrice': 'recorded',
      'actions[].replayInputs.bought.atr': 'recorded',
      'actions[].replayInputs.bought.thresholdHistory.maxMultiplier': 'recorded',
      'actions[].replayInputs.bought.thresholdHistory.minMultiplier': 'recorded',
      'actions[].replayInputs.bought.thresholdBaseline.value': 'recorded',
      'actions[].replay.ghost.atSwap': 'rebuilt',
      'actions[].replay.ghost.atClose': 'rebuilt',
      'actions[].replay.ghost.series[].tickSeq': 'recorded',
      'actions[].replay.ghost.series[].points': 'rebuilt',
      'actions[].replay.bought.atClose': 'rebuilt',
      'actions[].replay.bought.series[].tickSeq': 'recorded',
      'actions[].replay.bought.series[].points': 'rebuilt',
      'actions[].replay.holdPath[].tickSeq': 'recorded',
      'actions[].replay.holdPath[].points': 'rebuilt',
      'actions[].replay.swapPath[].tickSeq': 'recorded',
      'actions[].replay.swapPath[].points': 'rebuilt',
      'actions[].replay.gapPoints': 'rebuilt',
      'actions[].replay.lockedPoints': 'recorded',
      'actions[].replay.subsequentTradesInSlot': 'derived',
      'actions[].replay.reconciliation.closedLegDelta': 'rebuilt',
      'actions[].replay.reconciliation.boughtVsEvidence.tickSeq': 'recorded',
      'actions[].replay.reconciliation.boughtVsEvidence.recordedPx': 'recorded',
      'actions[].replay.reconciliation.boughtVsEvidence.recordedChg': 'recorded',
      'actions[].replay.reconciliation.boughtVsEvidence.rebuiltPx': 'market',
      'actions[].replay.reconciliation.boughtVsEvidence.rebuiltChg': 'rebuilt',
      'actions[].replay.reconciliation.boughtVsEvidence.pxDelta': 'rebuilt',
      'actions[].replay.reconciliation.boughtVsEvidence.chgDelta': 'rebuilt',
      'actions[].replay.marketChangeAfter.*': 'market',
      'actions[].replay.sectorChangeAfter.*': 'market',
      'directives[].canonicalTextVersion': 'recorded',
      'directives[].heard.tickSeq': 'recorded',
      'directives[].after.checks': 'derived',
      'directives[].after.holds': 'derived',
      'directives[].after.swaps': 'derived',
      'plans[].tickSeq': 'recorded',
      'plans[].price.atPlan.value': 'market',
      'plans[].price.atClose.value': 'market',
      'calls[].mintedAt': 'recorded',
      'calls[].expiresAt': 'recorded',
      'calls[].resolvedAt': 'recorded',
      'calls[].horizon.expiresAt': 'recorded',
      'calls[].hypothesisRef.hypothesisVersion': 'recorded',
      'rationale[].tickSeq': 'recorded',
    });
    expect(SERIES_NUMBER_CLASSES).toEqual({
      tapeVersion: 'recorded',
      'sessionOpen.value': 'market',
      'bars[].o': 'market',
      'bars[].h': 'market',
      'bars[].l': 'market',
      'bars[].c': 'market',
      'bars[].v': 'market',
      'bars[].n': 'market',
      'atChecks[].tickSeq': 'recorded',
      'atChecks[].price': 'market',
    });
  });
});

describe('the spec\'s own words', () => {
  it('BA-4: the recorded score carries its time; the battle result is shown apart', () => {
    expect(md).toMatch(/\*\*Recorded score at \d{1,2}:\d{2} (AM|PM) ET\*\*: -?[\d.]+ \(recorded\)/);
    expect(md).toContain("## Battle (shown apart from the day's score)");
  });

  it('BA-7: a recorded risk decision, and its absence in its own words; never "armed"', () => {
    expect(md).toContain('Risk decision recorded: ');
    expect(md).toContain('No risk decision recorded');
    expect(md).toContain('_This does not show which protections were armed or checked._');
  });

  it('BA-9: the player\'s words and the filed text are two fields; the three card states; the reply unverified', () => {
    expect(md).toContain('**You asked** at ');
    expect(md).toContain('“Be patient with the winners today.”');
    expect(md).toContain('**Directive filed**: ');
    expect(md).toContain('No new directive filed — retained: ');
    expect(md).toMatch(/No new directive filed \(gate: `fit_mismatch`\)/);
    expect(md).toContain('Chat reply at the time · not verified');
  });

  it('BA-22 / invariant 3: the model\'s paraphrase of the player never appears; rationale only under its fixed label', () => {
    expect(md).not.toContain('PARAPHRASE-OF-PLAYER');
    expect(md).not.toContain('COUNTER-OFFER-TEXT');
    expect(md).not.toMatch(/why\?/i);
    for (const r of fullTape.rationale) expect(md).toContain(`the agent's words at the time · not verified (tickSeq ${r.tickSeq} (recorded)): “${r.rationale}”`);
  });

  it('BA-10: plans get prices, never a verdict, with the horizon caveat', () => {
    expect(md).toContain("_Prices shown to the day's close, which is not the plan's horizon._");
    const plans = md.slice(md.indexOf('## Plans'), md.indexOf('## Calls'));
    expect(plans).not.toMatch(/\b(correct|wrong|right|hit|missed|worked|failed|success)\b/i);
  });

  it('BA-11: the replay is labelled hypothetical and rebuilt; the reconciliation is agreement at the sale', () => {
    expect(md).toContain(fullTape.actions[0].replay.label);
    expect(md).toContain(`${PROVENANCE_LABELS.rebuilt}; hypothetical: yes`);
    expect(md).toContain('reconciliation — agreement at the sale, not accuracy afterward: closedLegDelta ');
    expect(md).toMatch(/gap at the close \(banked \+ bought − sold\): -?[\d.]+ \(rebuilt\)/);
  });

  it('BA-16: calls are copied, never judged', () => {
    expect(md).toContain('_Copied: the source recorded this — not validated here. State as observed at copiedAt._');
  });

  it('who made the exit comes before its result', () => {
    for (const line of md.split('\n').filter((l) => l.startsWith('- **') && l.includes(' → '))) {
      expect(line).toContain('who made the exit: ');
    }
    const a = md.indexOf('who made the exit: ');
    expect(a).toBeLessThan(md.indexOf('  - result: banked '));
  });

  it('BA-14: diagnostics are labelled as never seen by the agent', () => {
    expect(md).toContain('_Diagnostic · recorded at the check · not seen by the agent_');
  });
});

describe('documents without day sections', () => {
  it('a skipped-mode tape prints its passes and its ledger, and says why there are no sections', async () => {
    const fx = await skippedModeDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT });
    const doc = t.store.get(`agentBattles/${fx.battleId}/tape/${fx.etDate}`);
    const out = formatTapeMarkdown(doc, []);
    expect(out).toContain('- **close** — skipped_mode (`mode_not_supported`)');
    expect(out).toContain("_No day sections: the close pass has not written this day's record (skipped_mode)._");
    expect(out).toContain('## Number ledger');
    expect(out).not.toContain('UNCLASSIFIED');
    expect(strayDigits(out, [doc])).toEqual([]);
  });

  it('a failed close pass prints its failure and last error, never an empty day', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await markCloseFailed(t.db, { ...fx.battle, id: fx.battleId }, fx.etDate, 'ticks_read_failed: boom', { now: NIGHT });
    const doc = t.store.get(`agentBattles/${fx.battleId}/tape/${fx.etDate}`);
    const out = formatTapeMarkdown(doc, []);
    expect(out).toContain('- **close** — failed');
    expect(out).toContain('ticks_read_failed: boom');
    expect(out).not.toContain('UNCLASSIFIED');
    expect(strayDigits(out, [doc])).toEqual([]);
  });

  it('no document at all', () => {
    expect(formatTapeMarkdown(null)).toBe('# Film tape — no document\n');
  });
});
