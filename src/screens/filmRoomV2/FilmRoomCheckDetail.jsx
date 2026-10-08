// src/screens/filmRoomV2/FilmRoomCheckDetail.jsx
//
// Check detail (Amendment E BA-44): a tapped check — from the strip, the score
// path or the timeline — shows its time, its state, its decision, its recorded
// risk decisions (BA-7: "Risk decision recorded: HOLD", or the recorded action
// with its reason; "No risk decision recorded" when the check has none), its
// scores and its evidence stamp, every number from the check's own path. A
// check held by default says so as the platform's record of the check (F3) —
// never as agent words. The "protections" note is the hosting section's, once
// per screen, never repeated here.

import React from 'react';
import { valueAt, etClock, checkStateOf, riskLines, fmtPlain, fmtPrice } from './filmRoomModel';
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';
import { C, card, eyebrow, foot, mono, TapeNum, When, Rec, Row, StateTag, TextButton } from './FilmRoomKit';

const EVIDENCE_NUMBERS = ['px', 'chg', 'atrX', 'vwapDev', 'bbPct'];

/** One symbol's evidence stamp at a check (BA-43's list), each number by its path. */
export function EvidenceStamp({ tape, index, symbol }) {
  const e = valueAt(tape, ['checks', index, 'evidence', symbol]);
  if (!e) return null;
  const at = valueAt(tape, ['checks', index, 'evidenceAt']);
  const risk = e.risk ? (e.risk.action === 'HOLD' ? 'HOLD' : `${e.risk.action}${e.risk.reason ? ` · ${e.risk.reason}` : ''}`) : COPY.notRecorded;
  return (
    <div data-evidence={`${index}:${symbol}`} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
        <span style={mono(11.5, C.ink, { fontWeight: 700 })}><Rec>{symbol}</Rec></span>
        {at ? <When style={mono(9.5, C.ink3)}>{etClock(at)}</When> : null}
      </div>
      {EVIDENCE_NUMBERS.map((f) => (
        <Row key={f} k={COPY.evidenceFields[f]} v={<TapeNum doc={tape} path={['checks', index, 'evidence', symbol, f]} fmt={f === 'px' ? fmtPrice : fmtPlain} size={11.5} />} />
      ))}
      <Row k={COPY.evidenceFields.nr7} v={<span style={mono(11, C.ink)}>{e.nr7 === true ? COPY.yes : e.nr7 === false ? COPY.no : COPY.notRecorded}</span>} />
      <Row k={COPY.evidenceFields.regime} v={<span style={mono(11, C.ink)}><Rec>{e.regime ?? COPY.notRecorded}</Rec></span>} />
      <Row k={COPY.evidenceFields.risk} v={<span style={mono(11, C.ink)}><Rec>{risk}</Rec></span>} />
    </div>
  );
}

export default function CheckDetail({ tape, index, onClose }) {
  const c = tape.checks[index];
  const st = checkStateOf(c);
  const risk = riskLines(c);
  const evidenceSyms = c.evidence ? Object.keys(c.evidence).sort() : [];
  return (
    <div data-check-detail={index} style={{ ...card, background: C.wash, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...eyebrow, color: C.ink2 }}><When>{COPY.checkAt(etClock(c.at) ?? '')}</When></span>
        {onClose ? <TextButton onClick={onClose}>{COPY.close}</TextButton> : null}
      </div>
      <StateTag color={st.tone === 'swap' ? C.teal : st.tone === 'failed' ? C.copper : C.ink2}>{st.label}</StateTag>
      {st.key === 'default_hold' ? <span data-default-hold-note="" style={foot}>{COPY.defaultHoldNote}</span> : null}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Row border={false} k={COPY.decision} v={<span style={mono(11, C.ink)}>{c.decision?.final ? COPY.decisionOf(c.decision.original, c.decision.final) : COPY.decisionNone}</span>} />
        {c.scores ? (
          <>
            <Row k={`${COPY.scores} · ${COPY.scoreParts.total}`} v={<TapeNum doc={tape} path={['checks', index, 'scores', 'total']} size={12} />} />
            <Row k={COPY.scoreParts.active} v={<TapeNum doc={tape} path={['checks', index, 'scores', 'active']} size={11.5} />} />
            <Row k={COPY.scoreParts.banked} v={<TapeNum doc={tape} path={['checks', index, 'scores', 'banked']} size={11.5} />} />
          </>
        ) : null}
      </div>
      <span style={{ ...eyebrow, color: C.ink3 }}>{COPY.riskTitle}</span>
      <div data-risk-rows={index} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {risk
          ? risk.map((r) => <span key={r.symbol} style={mono(10.5, C.ink2)}><Rec>{r.symbol}</Rec> · <Rec>{r.text}</Rec></span>)
          : <span style={mono(10.5, C.ink2)}>{COPY.noRisk}</span>}
      </div>
      <span style={{ ...eyebrow, color: C.ink3 }}>{COPY.evidenceTitle}</span>
      {evidenceSyms.length ? (
        <>
          <span style={foot}>{COPY.evidenceLabel}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px 16px' }}>
            {evidenceSyms.map((s) => <EvidenceStamp key={s} tape={tape} index={index} symbol={s} />)}
          </div>
        </>
      ) : <span style={foot}>{COPY.evidenceNone}</span>}
    </div>
  );
}
