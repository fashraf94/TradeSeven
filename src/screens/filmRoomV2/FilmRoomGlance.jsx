// src/screens/filmRoomV2/FilmRoomGlance.jsx
//
// Glance (spec V1.2 §7, BA-4; Amendment E F5, BA-44). The recorded score with
// its time and the day change with its basis; the score at each check (option
// B's path) over the check strip; the checks as runs (option C: state, time
// span, count); a tapped check's record; and the battle's final result APART
// from the day, only for a completed battle, with the platform's own words.

import React from 'react';
import { valueAt, etClock, checkStateOf, checkRuns, isNum, exitMakerOf, toMs } from './filmRoomModel';
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';
import { C, card, eyebrow, foot, mono, plain, TapeNum, CountNum, When, Rec, Section, Row, Quote, StateTag } from './FilmRoomKit';
import CheckDetail from './FilmRoomCheckDetail';

// ── the pips: one per check row, by tone ───────────────────────────────────
const TONE = {
  plan: { color: C.gold, fill: true },
  planPending: { color: C.gold, fill: false },
  hold: { color: C.ink2, fill: true },
  swap: { color: C.teal, fill: true },
  failed: { color: C.copper, fill: false },
  skipped: { color: C.ink3, fill: false, dashed: true },
  quiet: { color: C.ink3, fill: false },
  gap: { color: C.ink3, fill: false, dashed: true },
};
export function Pip({ tone, selected, size }) {
  const t = TONE[tone] || TONE.gap;
  return <span aria-hidden="true" data-pip={tone} style={{ display: 'block', width: size || '100%', height: size || '100%', borderRadius: 2, boxSizing: 'border-box', background: t.fill ? t.color : 'transparent', border: `1.5px ${t.dashed ? 'dashed' : 'solid'} ${t.color}`, boxShadow: selected ? `0 0 0 2px ${C.surface}, 0 0 0 3px ${C.ink}` : 'none' }} />;
}

/** The cockpit rail's caret: solid teal for the agent's swap, hollow grey for a platform rule's. */
export function SwapCaret({ by, size = 11 }) {
  const agent = by === 'agent';
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 14 11" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M1.5 1.5h11L7 9.5z" style={{ fill: agent ? C.teal : 'none', stroke: agent ? C.teal : C.ink2, strokeWidth: 1.6, strokeLinejoin: 'round' }} />
    </svg>
  );
}

/** The check row a swap was made in: its own tickSeq, else the first check at or after it. */
export function checkIndexOfAction(tape, action) {
  const checks = Array.isArray(tape?.checks) ? tape.checks : [];
  if (Number.isInteger(action?.tickSeq)) {
    const i = checks.findIndex((c) => c.tickSeq === action.tickSeq);
    if (i >= 0) return i;
  }
  const ms = toMs(action?.at);
  if (ms === null) return -1;
  const i = checks.findIndex((c) => (toMs(c.at) ?? -Infinity) >= ms);
  return i >= 0 ? i : checks.length - 1;
}

function ScoreCard({ tape, big = 44 }) {
  const last = tape.score?.lastCheck || null;
  const first = tape.score?.firstCheck || null;
  const basis = tape.score?.dayChange?.basis || 'unavailable';
  return (
    <div data-region="recorded-score" style={{ ...card, gap: 8 }}>
      <span style={{ ...eyebrow, color: C.ink2 }}>{last ? <When>{COPY.recordedScoreAt(etClock(last.at))}</When> : COPY.recordedScore}</span>
      {last ? <TapeNum doc={tape} path={['score', 'lastCheck', 'total']} size={big} /> : <span style={mono(big, C.ink3, { fontWeight: 700, lineHeight: 1 })}>—</span>}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Row
          border={false}
          k={COPY.dayChange}
          sub={COPY.dayChangeBasis[basis] || COPY.dayChangeBasis.unavailable}
          v={isNum(tape.score?.dayChange?.value) ? <TapeNum doc={tape} path={['score', 'dayChange', 'value']} size={13} /> : <span style={mono(11, C.ink3)}>{COPY.dayChangeBasis.unavailable}</span>}
        />
        <Row
          k={first ? <When>{COPY.firstCheckAt(etClock(first.at))}</When> : COPY.noChecks}
          v={first ? <TapeNum doc={tape} path={['score', 'firstCheck', 'total']} size={13} /> : <span style={mono(11, C.ink3)}>—</span>}
        />
      </div>
    </div>
  );
}

/** The recorded score at each check, stepped (a score holds between checks). Points are taps into the check's record. */
function ScorePath({ tape, selected, onSelect, height = 130 }) {
  const checks = Array.isArray(tape.checks) ? tape.checks : [];
  const n = checks.length;
  const pts = checks.map((c, i) => ({ i, v: valueAt(tape, ['checks', i, 'scores', 'total']) })).filter((p) => isNum(p.v));
  if (!pts.length) return <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono(10.5, C.ink3) }}>{COPY.noChecks}</div>;
  const lo = Math.min(...pts.map((p) => p.v), 0);
  const hi = Math.max(...pts.map((p) => p.v), 0);
  const span = Math.max(1, hi - lo);
  const padT = 12; const padB = 6; const ih = height - padT - padB;
  const xPct = (i) => ((i + 0.5) / n) * 100;
  const y = (v) => padT + ((hi + span * 0.08 - v) / (span * 1.16)) * ih;
  let d = '';
  pts.forEach((p, k) => { d += k ? ` H${xPct(p.i) * 10} V${y(p.v).toFixed(1)}` : `M${xPct(p.i) * 10} ${y(p.v).toFixed(1)}`; });
  return (
    <div data-region="score-path" style={{ position: 'relative', width: '100%', height }}>
      <svg width="100%" height={height} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-label={COPY.scorePath} style={{ display: 'block', overflow: 'visible', width: '100%', height }}>
        <line x1="0" x2="1000" y1={y(0)} y2={y(0)} style={{ stroke: C.hair2, strokeDasharray: '3 3' }} vectorEffect="non-scaling-stroke" />
        <path d={d} style={{ fill: 'none', stroke: C.ink, strokeWidth: 1.5 }} vectorEffect="non-scaling-stroke" />
      </svg>
      <span style={{ position: 'absolute', right: 0, top: Math.max(0, y(0) - 14), ...mono(9, C.ink3) }}>{COPY.battleStartLine}</span>
      {pts.map((p) => (
        <button
          key={p.i}
          type="button"
          data-score-point={p.i}
          aria-label={`${COPY.checkAt(etClock(checks[p.i].at))}`}
          onClick={() => onSelect(selected === p.i ? null : p.i)}
          style={{ ...plain, position: 'absolute', left: `calc(${xPct(p.i)}% - 6px)`, top: y(p.v) - 6, width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span style={{ width: p.i === pts[pts.length - 1].i ? 8 : 5, height: p.i === pts[pts.length - 1].i ? 8 : 5, borderRadius: '50%', background: p.i === pts[pts.length - 1].i ? C.surface : C.ink, boxShadow: selected === p.i ? `0 0 0 2px ${C.surface}, 0 0 0 3px ${C.ink2}` : `inset 0 0 0 1.5px ${C.ink}` }} />
        </button>
      ))}
    </div>
  );
}

/** The check strip: a pip per check row, swap carets above, time ends below. */
export function CheckStrip({ tape, selected, onSelect }) {
  const checks = Array.isArray(tape.checks) ? tape.checks : [];
  const n = checks.length;
  const actions = Array.isArray(tape.actions) ? tape.actions : [];
  return (
    <div data-region="check-strip" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ position: 'relative', height: 11 }}>
        {actions.map((a, k) => {
          const i = checkIndexOfAction(tape, a);
          if (i < 0) return null;
          const who = exitMakerOf(a);
          return <div key={a.key || k} data-swap-caret={who.by} title={`${etClock(a.at) ?? ''} · ${a.symbolOut} → ${a.symbolIn}`} style={{ position: 'absolute', left: `calc(${((i + 0.5) / n) * 100}% - 5px)`, top: 0 }}><SwapCaret by={who.by} /></div>;
        })}
      </div>
      <div style={{ position: 'relative', height: 14 }}>
        {checks.map((c, i) => {
          const st = checkStateOf(c);
          return (
            <button
              key={c.key || i}
              type="button"
              data-check-pip={i}
              aria-label={`${COPY.checkAt(etClock(c.at) ?? '')} · ${st.label}`}
              aria-pressed={selected === i}
              onClick={() => onSelect(selected === i ? null : i)}
              style={{ ...plain, position: 'absolute', left: `calc(${i} * 100% / ${n})`, width: `calc(100% / ${n} - 3px)`, top: -6, height: 26, display: 'flex', alignItems: 'center' }}
            >
              <span style={{ display: 'block', width: '100%', height: 12 }}><Pip tone={st.tone} selected={selected === i} /></span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...mono(9, C.ink3) }}>
        <When>{n ? etClock(checks[0].at) : ''}</When>
        <When>{n ? etClock(checks[n - 1].at) : ''}</When>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 10px', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><SwapCaret by="agent" size={9} /><span style={mono(9, C.ink3)}>{COPY.swapByAgent}</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><SwapCaret by="platform" size={9} /><span style={mono(9, C.ink3)}>{COPY.swapByRule}</span></span>
        <span style={mono(9, C.ink3)}>· {COPY.tapForDetail}</span>
      </div>
    </div>
  );
}

/** F5 — the checks as runs: the state, the time span, the count. */
function RunList({ tape }) {
  const runs = checkRuns(tape);
  if (!runs.length) return <span style={foot}>{COPY.noChecks}</span>;
  return (
    <div data-region="check-runs" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {runs.map((r, k) => {
        const span = r.from && r.to && r.from !== r.to ? <><When>{etClock(r.from)}</When>–<When>{etClock(r.to)}</When></> : <When>{etClock(r.from) ?? ''}</When>;
        const kinds = r.group === 'completed'
          ? Object.entries(r.kinds).map(([kind, count]) => <span key={kind}> · <CountNum value={count} aggregate="count(checks[] in a run)" /> {COPY.runKinds[kind] || kind}</span>)
          : null;
        return (
          <div key={k} data-run={r.group} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ width: 9, height: 9, flexShrink: 0, marginTop: 3 }}><Pip tone={r.tone} /></span>
            <span style={mono(10, C.ink2, { lineHeight: 1.6 })}>
              {span} · {r.group === 'completed' ? COPY.runCompleted : r.label} · <CountNum value={r.count} aggregate="count(checks[] in a run)" /> {COPY.checksIn}{kinds}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The battle's final result, apart from the day; only for a completed battle (BA-4, BA-39). */
export function ResultCard({ tape }) {
  const b = tape.battle;
  if (!b || b.status !== 'completed') return null;
  const value = b.result?.value ?? null;
  const basis = b.result?.basis ?? 'unavailable';
  return (
    <div data-region="final-result" style={{ ...card, background: C.raised, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...eyebrow, color: C.ink2 }}>{COPY.finalResult}</span>
        <span style={mono(9.5, C.ink3)}>{COPY.apartFromDay}</span>
      </div>
      <span style={mono(10.5, C.ink3)}>{COPY.resultBasis[basis] || COPY.resultBasis.unavailable}{b.result?.note ? <> · <Rec>{b.result.note}</Rec></> : null}</span>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span data-result={value} style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1 }}>{COPY.resultWord[value] || value}</span>
          {b.final ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...mono(11.5, C.ink2) }}>
              {COPY.agentVsCpu.agent} <TapeNum doc={tape} path={['battle', 'final', 'total']} size={13} />
              <span style={{ color: C.ink3 }}>{COPY.agentVsCpu.vs}</span> {COPY.agentVsCpu.cpu} <TapeNum doc={tape} path={['battle', 'final', 'opponent']} size={13} />
            </span>
          ) : null}
        </div>
      ) : <span data-result="unavailable" style={{ fontSize: 15, fontWeight: 600, color: C.ink2 }}>{COPY.resultBasis.unavailable}</span>}
      {b.completionMessage?.text ? <Quote label={<>{COPY.platformAtCompletion}{b.completionMessage.at ? <> · <When>{etClock(b.completionMessage.at)}</When></> : null}</>}>{b.completionMessage.text}</Quote> : null}
    </div>
  );
}

export default function FilmRoomGlance({ tape, desktop, selected, onSelect }) {
  const checksBlock = (
    <Section id="glance-checks" title={COPY.checks} coverage={tape.coverage?.checks} note={COPY.riskNote}>
      <div style={{ ...card, gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...eyebrow, color: C.ink2 }}>{COPY.scorePath}</span>
          <span style={mono(9, C.ink3)}>{COPY.scorePathNote}</span>
        </div>
        <ScorePath tape={tape} selected={selected} onSelect={onSelect} height={desktop ? 190 : 130} />
        <CheckStrip tape={tape} selected={selected} onSelect={onSelect} />
        {selected != null && tape.checks?.[selected] ? <CheckDetail tape={tape} index={selected} onClose={() => onSelect(null)} /> : null}
        <span style={{ ...eyebrow, color: C.ink2 }}>{COPY.runsTitle}</span>
        <RunList tape={tape} />
      </div>
    </Section>
  );
  if (desktop) {
    return (
      <div data-depth="glance" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2.3fr) minmax(0,1.1fr)', gap: 16, alignItems: 'start' }}>
        <ScoreCard tape={tape} big={56} />
        {checksBlock}
        <ResultCard tape={tape} />
      </div>
    );
  }
  return (
    <div data-depth="glance" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ScoreCard tape={tape} />
      {checksBlock}
      <ResultCard tape={tape} />
    </div>
  );
}

export { StateTag };
