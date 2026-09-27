// api/_utils/filmTape/tapeExport.js
//
// Film Room tape — THE FOUNDER READ-OUT as markdown (spec BA-18). PURE: a tape
// document and its series documents in, a markdown string out. The script
// scripts/export-film-tape.js is a thin read-only runner over this module (the
// measure-l1-corpus / export-tick-capture precedent: a wrong number is fixed
// HERE, with a unit test).
//
// EVERY NUMBER IS LABELLED BY ITS PROVENANCE CLASS (BA-21). A number the tape
// stores is printed through `labelled()`, which resolves its class from the
// document's OWN `numberClasses` declaration — never from a table in this
// file — and prints UNCLASSIFIED when the declaration has none (a bug the
// tests fail on). A count this read-out takes of a stored list is printed
// through `counted()` as `derived` (arithmetic on recorded values). The
// closing NUMBER LEDGER lists every numeric leaf of the tape document with its
// path, value and class, so "every number is labelled" is complete by
// construction; the series documents are summarised (BA-18), and every number
// the summary prints is labelled the same way.
//
// Nothing else prints a digit outside three recognisable forms: an instant
// (ISO, or an ET clock), an identifier in a code span, and RECORDED TEXT in
// “curly quotes” — the player's words, the filed text, the agent's words at
// the time, the tape's own coverage notes — which is quotation, never a
// number of this read-out (BA-22). The test scans the whole output for a
// digit in any other form.
//
// EVERY SECTION IS HEADED BY ITS COVERAGE LINE (BA-20). The copy is the
// spec's own, verbatim where it prescribes words (BA-4, BA-7, BA-9, BA-10,
// BA-11, BA-22), so a founder reading tape days reads the product's language.

import {
  PROVENANCE_LABELS, COVERAGE_SECTIONS, classOfNumber, numbersWithClasses, formatNumberPath,
} from '../../../src/constants/filmTape.js';

const ET_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** "3:45 PM ET" from an ISO instant or epoch ms; '—' when absent. */
export function etClock(instant) {
  const ms = typeof instant === 'string' ? Date.parse(instant) : (isNum(instant) ? instant : NaN);
  return Number.isFinite(ms) ? `${ET_TIME.format(new Date(ms))} ET` : '—';
}

/**
 * A stored number with its class from the document's declaration:
 * `35 (recorded)`, `1.5% (market)`. '—' when the field holds no number.
 */
export function labelled(doc, path, value, unit = '') {
  if (!isNum(value)) return '—';
  const cls = classOfNumber(doc?.numberClasses, path);
  return `${value}${unit} (${cls ?? 'UNCLASSIFIED'})`;
}

/** A count this read-out takes of a stored list — arithmetic on recorded values. */
export function counted(n) {
  return `${n} (derived)`;
}

/** Recorded text as attributed quotation (BA-22) — verbatim, one line. */
export function quoted(text) {
  if (typeof text !== 'string' || text.trim() === '') return '—';
  return `“${text.replace(/\s*\n\s*/g, ' ')}”`;
}

/** An identifier or a machine word: a code span, never read as a number. */
export function code(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `\`${String(value).replace(/`/g, "'")}\``;
}

/** BA-20 — the coverage line a section is headed by. */
export function coverageLine(cov) {
  if (!isObj(cov)) return '> coverage: **not recorded**';
  const span = isObj(cov.span) ? `${code(cov.span.from)} → ${code(cov.span.to)}` : 'no span';
  return `> coverage: **${cov.status}** · ${span} · sources: ${(cov.sources || []).map(code).join(', ') || '—'}`
    + ` · preserved from: ${cov.preservedFrom ? code(cov.preservedFrom) : '—'}${cov.note ? ` · ${quoted(cov.note)}` : ''}`;
}

const esc = (s) => String(s ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
].join('\n');

/** An instant the tape stores as epoch ms: its ET clock, then the labelled number. */
function msInstant(doc, path, value) {
  return isNum(value) ? `${etClock(value)} · ${labelled(doc, path, value)}` : '—';
}

function riskText(risk) {
  // BA-7: a recorded decision, never an inspection; its absence has its own words.
  if (!isObj(risk)) return 'No risk decision recorded';
  const holds = Object.entries(risk).filter(([, v]) => v?.action === 'HOLD').map(([s]) => s);
  const other = Object.entries(risk).filter(([, v]) => v?.action !== 'HOLD')
    .map(([s, v]) => `${v?.action ?? '—'} ${s}${v?.reason ? ` (${code(v.reason)})` : ''}`);
  return `Risk decision recorded: ${[holds.length ? `HOLD ${holds.join(', ')}` : null, ...other].filter(Boolean).join('; ')}`;
}

function sectionChecks(doc) {
  const rows = (doc.checks || []).map((c, i) => [
    labelled(doc, ['checks', i, 'tickSeq'], c.tickSeq),
    c.at ? `${etClock(c.at)} · ${code(c.at)}` : '—',
    c.state ?? '—',
    c.exitReason ?? '—',
    riskText(c.risk),
    c.decision ? `${c.decision.final ?? '—'}${c.decision.holdKind ? ` · ${c.decision.holdKind}` : ''}` : '—',
    c.scores ? labelled(doc, ['checks', i, 'scores', 'total'], c.scores.total) : '—',
    labelled(doc, ['checks', i, 'tickMs'], c.tickMs),
    c.evidence ? `${Object.keys(c.evidence).join(', ')} at ${etClock(c.evidenceAt)}` : '—',
  ]);
  return [
    '## Checks',
    coverageLine(doc.coverage?.checks),
    '',
    '_This does not show which protections were armed or checked._',
    '',
    table(['tickSeq', 'at', 'state', 'exit', 'risk', 'decision', 'total', 'tickMs', 'evidence'], rows),
  ].join('\n');
}

/** A null sample shows how old its bar was (BA-24): "— (last bar closed 10:31 AM ET)". */
const staleNote = (point) => (point && point.barClosedAt ? ` (last bar closed ${etClock(point.barClosedAt)})` : '');

function pathLine(doc, i, key, r) {
  const path = r[key];
  if (!Array.isArray(path)) return '—';
  return path.map((s, j) => `${s.at === r.closeAt ? 'close' : etClock(s.at)} ${labelled(doc, ['actions', i, 'replay', key, j, 'points'], s.points)}${staleNote(s)}`).join(' · ') || '—';
}

function replayLines(doc, i, r) {
  const a = doc.actions[i];
  if (!r) return [`  - replay: none — ${a.replayReason ? code(a.replayReason) : 'the candle pass has not written one'}`];
  const p = (...rest) => ['actions', i, 'replay', ...rest];
  const out = [
    `  - replay — _${r.label ?? 'hypothetical'}_`,
    `    - ${PROVENANCE_LABELS.rebuilt}; hypothetical: ${r.hypothetical ? 'yes' : 'no'}`
      + `${r.subsequentTradesInSlot > 0 ? ` · later trades in this slot (${labelled(doc, p('subsequentTradesInSlot'), r.subsequentTradesInSlot)}): both continued lines are hypothetical` : ''}`,
    `    - sold name, as if never sold: at the swap ${labelled(doc, p('ghost', 'atSwap'), r.ghost?.atSwap)} · at the close ${labelled(doc, p('ghost', 'atClose'), r.ghost?.atClose)}`,
    `    - bought name, scored from the swap: at the close ${labelled(doc, p('bought', 'atClose'), r.bought?.atClose)} · banked by the sale ${labelled(doc, p('lockedPoints'), r.lockedPoints)}`,
    `    - hold path: ${pathLine(doc, i, 'holdPath', r)}`,
    `    - swap path: ${pathLine(doc, i, 'swapPath', r)}`,
    `    - gap at the close (banked + bought − sold): ${labelled(doc, p('gapPoints'), r.gapPoints)}`,
    `    - reconciliation — agreement at the sale, not accuracy afterward: closedLegDelta ${labelled(doc, p('reconciliation', 'closedLegDelta'), r.reconciliation?.closedLegDelta)}`,
  ];
  const bve = r.reconciliation?.boughtVsEvidence;
  if (bve) {
    const b = (...rest) => p('reconciliation', 'boughtVsEvidence', ...rest);
    out.push(`    - bought name against its recorded evidence at ${etClock(bve.at)} (tickSeq ${labelled(doc, b('tickSeq'), bve.tickSeq)}): px ${labelled(doc, b('recordedPx'), bve.recordedPx)} vs ${labelled(doc, b('rebuiltPx'), bve.rebuiltPx)}, delta ${labelled(doc, b('pxDelta'), bve.pxDelta)} · chg ${labelled(doc, b('recordedChg'), bve.recordedChg, '%')} vs ${labelled(doc, b('rebuiltChg'), bve.rebuiltChg, '%')}, delta ${labelled(doc, b('chgDelta'), bve.chgDelta)}`);
  }
  const mk = Object.entries(r.marketChangeAfter || {}).map(([s, v]) => `${s} ${labelled(doc, p('marketChangeAfter', s), v, '%')}`).join(' · ');
  const sc = Object.entries(r.sectorChangeAfter || {}).map(([s, v]) => `${s} ${labelled(doc, p('sectorChangeAfter', s), v, '%')}`).join(' · ');
  out.push(`    - from the swap to the close — market: ${mk || '—'} · sector: ${sc || '—'}`);
  out.push(`    - missing inputs: ${(r.missingInputs || []).map(code).join(', ') || 'none'}`);
  return out;
}

function sectionActions(doc) {
  const lines = ['## Actions', coverageLine(doc.coverage?.actions), ''];
  if (!(doc.actions || []).length) lines.push('_No action recorded for this day._');
  (doc.actions || []).forEach((a, i) => {
    const p = (...rest) => ['actions', i, ...rest];
    lines.push(
      // who made the exit comes before its result
      `- **${a.symbolOut} → ${a.symbolIn}** at ${etClock(a.at)} · ${code(a.at)} — who made the exit: ${a.source ?? 'unrecorded'} · ${code(a.mechanism)} · line: ${a.exitReason ? code(a.exitReason) : 'unrecorded'}`,
      `  - result: banked ${labelled(doc, p('lockedPoints'), a.lockedPoints)} · entry ${labelled(doc, p('entryPrice'), a.entryPrice)} · exit ${labelled(doc, p('exitPrice'), a.exitPrice)} · ${labelled(doc, p('lockedGainPct'), a.lockedGainPct, '%')}`,
      `  - tier ${a.tier ?? '—'} · slot ${labelled(doc, p('slotIndex'), a.slotIndex)} · tickSeq ${labelled(doc, p('tickSeq'), a.tickSeq)} · trade matched: ${a.tradeMatched ? 'yes' : 'no'} · receipt matched: ${a.receiptMatched ? 'yes' : 'no'}`
        + ` · held ${labelled(doc, p('holdingMs'), a.holdingMs)} ms (${a.holdingBasis ? code(a.holdingBasis) : '—'}) · later trades in this slot: ${labelled(doc, p('subsequentTradesInSlot'), a.subsequentTradesInSlot)}`,
      `  - bought at ${a.inBasis ? labelled(doc, p('inBasis', 'price'), a.inBasis.price) : '—'} · replay inputs missing: ${(a.replayMissing || []).map(code).join(', ') || 'none'}`,
      ...replayLines(doc, i, a.replay),
    );
  });
  return lines.join('\n');
}

function sectionDirectives(doc) {
  const lines = ['## Directives', coverageLine(doc.coverage?.directives), ''];
  if (!(doc.directives || []).length) lines.push('_No directive card for this day._');
  (doc.directives || []).forEach((d, i) => {
    const p = (...rest) => ['directives', i, ...rest];
    const filed = d.cardState === 'committed'
      ? `**Directive filed**: ${quoted(d.canonicalText)} (${code(d.adjustmentId)}, version ${labelled(doc, p('canonicalTextVersion'), d.canonicalTextVersion)}, expiry ${d.expiry ? code(d.expiry) : '—'})`
      : `No new directive filed${d.cardState === 'no_change' ? ` — retained: ${d.retainedDirectiveText ? quoted(d.retainedDirectiveText) : 'none in force'}` : ''} (gate: ${d.gateStatus ? code(d.gateStatus) : '—'})`;
    const heard = d.heard
      ? `Reached the agent's inputs at ${etClock(d.heard.at)} (tickSeq ${labelled(doc, p('heard', 'tickSeq'), d.heard.tickSeq)}, from the ${d.heard.source})`
      : (d.cardState === 'committed' ? 'Receipt unconfirmed' : '—');
    lines.push(
      `- **You asked** at ${etClock(d.filedAt)} (${code(d.threadId)}): ${quoted(d.playerText)}`,
      `  - ${filed}`,
      `  - ${heard}`,
      `  - after it: ${labelled(doc, p('after', 'checks'), d.after?.checks)} checks, ${labelled(doc, p('after', 'holds'), d.after?.holds)} holds, ${labelled(doc, p('after', 'swaps'), d.after?.swaps)} swaps`,
      `  - Chat reply at the time · not verified${d.agentReplyDiffers ? ' · the filing status above is authoritative' : ''}: ${quoted(d.agentReply)}`,
    );
  });
  return lines.join('\n');
}

function planPrice(doc, i, which, point) {
  if (!point) return '—';
  return `${labelled(doc, ['plans', i, 'price', which, 'value'], point.value)} @ ${etClock(point.at)} · ${code(point.basis)}`;
}

function sectionPlans(doc) {
  const rows = (doc.plans || []).map((pl, i) => [
    etClock(pl.at), labelled(doc, ['plans', i, 'tickSeq'], pl.tickSeq), pl.symbol ?? '—', pl.direction ?? '—',
    quoted(pl.signalSummary), quoted(pl.threshold),
    pl.price ? (pl.price.atPlan ? planPrice(doc, i, 'atPlan', pl.price.atPlan) : `— (${(pl.price.missingInputs || []).map(code).join(', ') || 'no bar'})`) : 'pending',
    pl.price ? planPrice(doc, i, 'atClose', pl.price.atClose) : 'pending',
  ]);
  return ['## Plans', coverageLine(doc.coverage?.plans), '', "_Prices shown to the day's close, which is not the plan's horizon._", '',
    table(['at', 'tickSeq', 'symbol', 'direction', 'signal', 'threshold (as written)', 'price at plan', 'price at close'], rows)].join('\n');
}

function sectionCalls(doc) {
  const rows = (doc.calls || []).map((c, i) => [
    code(c.callId), c.kind ?? '—', c.origin ?? '—', c.symbol ?? '—', c.direction ?? '—', c.state ?? '—',
    msInstant(doc, ['calls', i, 'mintedAt'], c.mintedAt), msInstant(doc, ['calls', i, 'expiresAt'], c.expiresAt),
    msInstant(doc, ['calls', i, 'resolvedAt'], c.resolvedAt), code(c.copiedAt),
    `${code(c.contractVersion)} · tape ${c.tapeWriteMode ? code(c.tapeWriteMode) : '—'} · record ${c.recordMode ? code(c.recordMode) : '—'}`,
  ]);
  return ['## Calls', coverageLine(doc.coverage?.calls), '', '_Copied: the source recorded this — not validated here. State as observed at copiedAt._', '',
    table(['callId', 'kind', 'origin', 'symbol', 'direction', 'state (as copied)', 'mintedAt', 'expiresAt', 'resolvedAt', 'copiedAt', 'modes'], rows)].join('\n');
}

function sectionRationale(doc) {
  const lines = ['## Rationale', coverageLine(doc.coverage?.rationale), ''];
  (doc.rationale || []).forEach((r, i) => lines.push(
    `- Recorded rationale at ${etClock(r.at)} · the agent's words at the time · not verified (tickSeq ${labelled(doc, ['rationale', i, 'tickSeq'], r.tickSeq)}): ${quoted(r.rationale)}`
      + `${r.hypothesis ? ` — hypothesis: ${quoted(r.hypothesis)}` : ''}`,
  ));
  if (!(doc.rationale || []).length) lines.push('_None copied._');
  return lines.join('\n');
}

function sectionEvidence(doc) {
  const withEvidence = (doc.checks || []).map((c, i) => ({ c, i })).filter(({ c }) => c.evidence);
  return ['## Evidence', coverageLine(doc.coverage?.evidence), '',
    withEvidence.length
      ? `${counted(withEvidence.length)} checks carry the recorded evidence stamp — every value is in the ledger below: tickSeq `
        + withEvidence.map(({ c, i }) => labelled(doc, ['checks', i, 'tickSeq'], c.tickSeq)).join(', ')
      : '_No check carries an evidence stamp._'].join('\n');
}

function sectionReplay(doc) {
  return ['## Replay', coverageLine(doc.coverage?.replay), '', '_Per action, under Actions._'].join('\n');
}

function sectionSeries(doc, seriesDocs) {
  const rows = seriesDocs.map((s) => {
    const bars = Array.isArray(s.bars) ? s.bars : [];
    const last = bars.length ? bars[bars.length - 1] : null;
    return [s.symbol ?? '—', s.role ?? '—', code(s.interval),
      labelled(s, ['sessionOpen', 'value'], s.sessionOpen?.value),
      last ? `${labelled(s, ['bars', bars.length - 1, 'c'], last.c)} @ ${etClock(last.t)}` : '—',
      counted(bars.length), counted(Array.isArray(s.atChecks) ? s.atChecks.length : 0)];
  });
  return ['## Series', coverageLine(doc.coverage?.series), '', `_${PROVENANCE_LABELS.market}._`, '',
    seriesDocs.length
      ? table(['symbol', 'role', 'interval', 'session open', 'last 10-minute close', 'bars', 'check prices'], rows)
      : '_No series documents._'].join('\n');
}

function ledger(doc) {
  const nums = numbersWithClasses(doc, doc.numberClasses);
  return ['## Number ledger — every number in the tape document, with its class', '',
    table(['path', 'value (class)'], nums.map((n) => [code(formatNumberPath(n.path)), `${n.value} (${n.cls ?? 'UNCLASSIFIED'})`]))].join('\n');
}

/**
 * The whole read-out for one tape day.
 *
 * @param {object} doc          the tape document
 * @param {object[]} [seriesDocs] its series documents
 * @returns {string} markdown
 */
export function formatTapeMarkdown(doc, seriesDocs = []) {
  if (!isObj(doc)) return '# Film tape — no document\n';
  const header = [
    `# Film tape — ${code(doc.battleId)} · ${code(doc.etDate)}`,
    '',
    `> ${code(`agentBattles/${doc.battleId}/tape/${doc.etDate}`)} · tapeVersion ${labelled(doc, ['tapeVersion'], doc.tapeVersion)} · every number carries its class: `
      + Object.entries(PROVENANCE_LABELS).map(([k, v]) => `**${k}** — ${v}`).join(' · '),
    '',
    `- owner ${code(doc.ownerId)} · agent ${code(doc.agentId)} · archetype ${doc.archetype ?? '—'} · mode ${doc.gameMode ?? '—'}`,
    `- day ${labelled(doc, ['dayNumber'], doc.dayNumber)} · final day: ${doc.isFinalDay === true ? 'yes' : (doc.isFinalDay === false ? 'no' : '—')} · battle status at write: ${doc.battleStatusAtWrite ?? '—'}`,
    `- written ${code(doc.writtenAt)} · runs ${labelled(doc, ['runCount'], doc.runCount)} · first written ${code(doc.firstWrittenAt)}`,
  ];
  const close = doc.passes?.close || {};
  const candles = doc.passes?.candles || {};
  const list = (arr, base) => (Array.isArray(arr) && arr.length ? arr.map((v, i) => labelled(doc, [...base, i], v)).join(', ') : 'none');
  const passes = [
    '## Passes',
    `- **close** — ${close.status ?? '—'}${close.reason ? ` (${code(close.reason)})` : ''} · capture ${close.capture ?? '—'}`
      + ` · tickSeq range ${Array.isArray(close.tickSeqRange) ? close.tickSeqRange.map((v, i) => labelled(doc, ['passes', 'close', 'tickSeqRange', i], v)).join(' – ') : '—'}`
      + ` · no record for tickSeq: ${list(close.gaps, ['passes', 'close', 'gaps'])}`
      + ` · day unknown for tickSeq: ${list(close.unattributedGaps, ['passes', 'close', 'unattributedGaps'])}`
      + ` · deferrals truncated: ${close.deferralsTruncated ? 'yes' : 'no'}`
      + `${close.lastError ? ` · last error at ${code(close.lastError.at)}: ${code(close.lastError.reason)}` : ''}`,
    `  - read: ${Object.entries(close.sources || {}).map(([k, v]) => `${k} ${labelled(doc, ['passes', 'close', 'sources', k], v)}`).join(' · ') || '—'}`,
    `- **candles** — ${candles.status ?? '—'}${candles.reason ? ` (${code(candles.reason)})` : ''} · attempts ${labelled(doc, ['passes', 'candles', 'attempts'], candles.attempts)}`
      + ` · source ${candles.source ? code(candles.source) : '—'} · written ${code(candles.writtenAt)}`
      + ` · requested: ${(candles.symbolsRequested || []).join(', ') || 'none'} · missing: ${(candles.symbolsMissing || []).join(', ') || 'none'}`
      + ` · incomplete: ${(candles.symbolsIncomplete || []).join(', ') || 'none'}`
      + `${Array.isArray(candles.changedInputs) && candles.changedInputs.length ? ` · inputs changed since it was built: ${candles.changedInputs.join(', ')}` : ''}`,
  ];
  const out = [...header, '', ...passes];
  if (Array.isArray(doc.checks)) {
    const lc = doc.score?.lastCheck;
    const dc = doc.score?.dayChange;
    const s = (...rest) => ['score', ...rest];
    out.push('', '## Score',
      lc
        ? `- **Recorded score at ${etClock(lc.at)}**: ${labelled(doc, s('lastCheck', 'total'), lc.total)} (tickSeq ${labelled(doc, s('lastCheck', 'tickSeq'), lc.tickSeq)} · active ${labelled(doc, s('lastCheck', 'active'), lc.active)} · banked ${labelled(doc, s('lastCheck', 'banked'), lc.banked)}`
          + ` · badges carried ${labelled(doc, s('lastCheck', 'bankedBadgePoints'), lc.bankedBadgePoints)} · opponent ${labelled(doc, s('lastCheck', 'opponent'), lc.opponent)})`
        : '- No recorded score for this day',
      doc.score?.firstCheck ? `- first recorded score at ${etClock(doc.score.firstCheck.at)}: ${labelled(doc, s('firstCheck', 'total'), doc.score.firstCheck.total)} (tickSeq ${labelled(doc, s('firstCheck', 'tickSeq'), doc.score.firstCheck.tickSeq)})` : '- no first check',
      `- day change: ${isNum(dc?.value) ? labelled(doc, s('dayChange', 'value'), dc.value) : 'unavailable'} · basis ${dc?.basis ? code(dc.basis) : '—'}`
        + `${isNum(dc?.reference) ? ` · against ${labelled(doc, s('dayChange', 'reference'), dc.reference)}${dc.referenceEtDate ? ` of ${code(dc.referenceEtDate)}` : ''}` : ''}`,
      '', "## Battle (shown apart from the day's score)",
      `- status ${doc.battle?.status ?? '—'} · completed ${code(doc.battle?.completedAt)} · result: ${doc.battle?.result?.value ?? '—'} (basis ${doc.battle?.result?.basis ? code(doc.battle.result.basis) : '—'})`
        + (doc.battle?.final ? ` · final ${labelled(doc, ['battle', 'final', 'total'], doc.battle.final.total)} vs ${labelled(doc, ['battle', 'final', 'opponent'], doc.battle.final.opponent)}` : ''),
      '', sectionChecks(doc), '', sectionActions(doc), '', sectionDirectives(doc), '', sectionPlans(doc), '', sectionCalls(doc),
      '', sectionRationale(doc), '', sectionEvidence(doc), '', sectionReplay(doc), '', sectionSeries(doc, seriesDocs),
      '', '## Comparables and diagnostics',
      `- market: ${(doc.comparables?.market || []).join(', ') || '—'} · sectors: ${Object.entries(doc.comparables?.sectors || {}).map(([sym, etf]) => `${sym}→${etf ?? '—'}`).join(', ') || '—'}`,
      `- intraday views: ${doc.diagnostics?.intradayViews ?? '—'} — _Diagnostic · recorded at the check · not seen by the agent_`);
  } else {
    out.push('', `_No day sections: the close pass has not written this day's record (${close.status ?? 'no status'})._`);
  }
  out.push('', ledger(doc));
  return `${out.join('\n')}\n`;
}

/** Every coverage section that heads a section in the read-out. */
export const EXPORT_COVERAGE_SECTIONS = COVERAGE_SECTIONS;
