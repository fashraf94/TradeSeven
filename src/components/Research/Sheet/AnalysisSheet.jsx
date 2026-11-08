// src/components/Research/Sheet/AnalysisSheet.jsx
//
// Research Modal Build C — THE SHEET (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §1, BC-1–BC-15): the
// Analysis tab's content in a live agent battle, in three layers. The design of
// record is the round-3 Claude Design file, screen A (structure, behaviour and
// vocabulary only — the skin is the shipped tokens, sheetTheme.js).
//
//   Layer 0  the stance line · the archetype's latest sentence · the three
//            questions in standing order · the tucked row (About · Wall St).
//   Layer 1  a question tapped: its evidence pack, three to five items, each
//            with its source and time, each lighting its pin on the chart.
//   Layer 2  the Ask answered: the reply card (AskReply).
// The action row (the Ask · → Cockpit) is SheetActionRow, which the modal pins
// under the drawer's scroll area (AnalysisDrawer `footer`), so it never scrolls
// away. Every string comes from sheetCopy.js; every number from the view.

import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionToken } from '../../../theme/motion.js';
import { SHEET_COPY, QUESTION_TEXT } from './sheetCopy.js';
import { ST, MONO, tint } from './sheetTheme.js';
import AskReply from './AskReply.jsx';

const TONE = { green: ST.green, amber: ST.amber, purple: ST.purple };

function Stance({ view }) {
  const [open, setOpen] = useState(false);
  const { chips, idea } = view.stance;
  return (
    <div data-sheet-stance={view.stance.kind} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {chips.map((c) => {
          const color = TONE[c.tone] ?? null;
          return (
            <span key={c.text} data-sheet-chip style={{
              fontFamily: MONO, fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap', borderRadius: 6, padding: '4px 7px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: color ?? ST.ink2,
              background: color ? tint(color, 12) : tint(ST.ink, 5),
              border: `1px solid ${color ? tint(color, 40) : ST.hair}`,
            }}>
              {c.dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: color ?? ST.ink2 }} />}
              {c.text}
            </span>
          );
        })}
      </div>
      {idea && (
        <button
          type="button"
          data-sheet-idea={open ? 'open' : 'line'}
          aria-expanded={open}
          aria-label={open ? SHEET_COPY.ideaClose : SHEET_COPY.ideaOpen}
          onClick={() => setOpen((v) => !v)}
          style={{
            all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%', fontSize: 11.5, color: ST.ink2,
            fontStyle: 'italic', lineHeight: 1.35,
            ...(open ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
          }}
        >
          “{idea.statement}”
        </button>
      )}
    </div>
  );
}

function Voice({ view, collapsed }) {
  // Layer 0 shows two lines of the sentence (the fold, BC-2); a tap shows all of it (review D3).
  const [whole, setWhole] = useState(false);
  const l = view.latest;
  const quoted = typeof l.text === 'string' && l.text;
  const eyebrow = l.source === 'rationale' ? SHEET_COPY.voiceDecided
    : l.source === 'call' ? SHEET_COPY.voiceCalled
      : l.source === 'bench' ? SHEET_COPY.voiceFlagged : SHEET_COPY.voiceNothing;
  const line = quoted ? l.text
    : l.source === 'template_checked' ? SHEET_COPY.checkedNothingSaid(view.latestTime ?? '', view.symbol)
      : l.source === 'template_looked' ? SHEET_COPY.lastLookedAt(view.latestTime ?? '')
      : SHEET_COPY.notLooked(view.archetype);
  return (
    <div data-sheet-voice={l.source} style={{
      borderRadius: 12, background: ST.surface, border: `1px solid ${ST.hair}`, borderLeft: `3px solid ${ST.teal}`,
      padding: collapsed ? '6px 11px' : '8px 11px 9px', display: 'flex', flexDirection: collapsed ? 'row' : 'column', gap: collapsed ? 8 : 6,
      alignItems: collapsed ? 'center' : 'stretch', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: collapsed ? 0 : 1, minWidth: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: ST.teal, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
          {eyebrow}
          {view.latestWho && quoted && !collapsed && <span style={{ color: ST.ink3, fontWeight: 500 }}> · {view.latestWho}</span>}
        </span>
        {!collapsed && view.agentName && quoted && (
          <span data-sheet-agent-tag style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: ST.ink3, border: `1px solid ${ST.hair}`, borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%', minWidth: 0, flexShrink: 1 }}>{view.agentName}</span>
        )}
      </div>
      <div
        data-sheet-voice-line
        {...(!collapsed && quoted ? { role: 'button', tabIndex: 0, 'aria-expanded': whole, title: SHEET_COPY.voiceMore, 'data-sheet-voice-whole': whole ? '1' : '0', onClick: () => setWhole((w) => !w), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWhole((w) => !w); } } } : {})}
        style={{
          fontSize: collapsed ? 12 : 13, fontStyle: quoted ? 'italic' : 'normal', color: ST.ink2, lineHeight: 1.35, minWidth: 0,
          ...(collapsed
            ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }
            : whole ? { cursor: 'pointer', overflowWrap: 'anywhere' }
              : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', ...(quoted ? { cursor: 'pointer' } : {}) }),
        }}
      >
        {quoted ? `“${line}”` : line}
      </div>
    </div>
  );
}

function Questions({ view }) {
  return (
    <div data-sheet-questions style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: ST.ink3 }}>{SHEET_COPY.askAbout(view.symbol)}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: ST.ink3, whiteSpace: 'nowrap' }}>{SHEET_COPY.askAboutRight}</span>
      </div>
      {view.order.map((q) => (
        <button
          key={q}
          type="button"
          data-sheet-question={q}
          onClick={() => view.pickQuestion(q)}
          style={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 44, padding: '0 14px', borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, color: ST.ink,
            background: tint(ST.teal, 8), border: `1px solid ${tint(ST.teal, 35)}`,
          }}
        >
          <span style={{ flex: 1 }}>{QUESTION_TEXT[q]}</span>
          <span aria-hidden="true" style={{ color: ST.teal, fontSize: 14 }}>›</span>
        </button>
      ))}
    </div>
  );
}

function Pack({ view }) {
  const reduced = useReducedMotion() === true;
  const { pack } = view;
  const asked = view.reply.status === 'answered' && view.reply.questionId === view.question;
  return (
    <motion.div
      key={view.question}
      data-sheet-pack={view.question}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionToken('fade', { reducedMotion: reduced })}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 30 }}>
        <button type="button" data-sheet-back aria-label={SHEET_COPY.backToQuestions} onClick={view.backToQuestions}
          style={{ all: 'unset', cursor: 'pointer', color: ST.ink2, fontSize: 16, padding: '0 4px' }}>‹</button>
        <span style={{ fontSize: 14.5, fontWeight: 700, flex: 1, color: ST.ink }}>{QUESTION_TEXT[view.question]}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: ST.ink3, whiteSpace: 'nowrap' }}>{asked ? SHEET_COPY.packAsked : SHEET_COPY.packFree}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span data-sheet-weighs style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, color: ST.ink3 }}>{pack.label}</span>
      </div>
      {pack.items.length === 0 && (
        <div style={{ fontSize: 12.5, color: ST.ink2 }}>{SHEET_COPY.packEmpty(view.archetype)}</div>
      )}
      {pack.items.map((it, i) => {
        const on = view.activeItem === i;
        return (
          <button
            key={`${it.kind}:${i}`}
            type="button"
            data-pack-item={it.kind}
            data-pack-status={it.status}
            aria-pressed={on}
            onClick={() => view.tapItem(i)}
            style={{
              all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '8px 11px', borderRadius: 12, background: on ? tint(ST.teal, 10) : ST.surface,
              border: `1px solid ${on ? tint(ST.teal, 55) : ST.hair}`,
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: 9, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: ST.ink, color: ST.bg, fontFamily: MONO, fontSize: 9.5, fontWeight: 800,
            }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, color: ST.ink }}>{it.fact}</span>
              <span style={{ marginTop: 3, fontFamily: MONO, fontSize: 9, color: ST.ink3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>{it.source.label}</span>
                {it.pin && view.pinsShown?.[it.pin.type] && <span style={{ color: on ? ST.teal : ST.ink3 }}>{SHEET_COPY.pinTag}</span>}
              </span>
            </span>
          </button>
        );
      })}
      <AskReply view={view} />
      <div data-sheet-or-ask style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: ST.ink3, fontWeight: 700 }}>{SHEET_COPY.orAsk}</span>
        {view.order.filter((q) => q !== view.question).map((q) => (
          <button key={q} type="button" data-sheet-question={q} onClick={() => view.pickQuestion(q)} style={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 32, padding: '0 10px', borderRadius: 999,
            fontSize: 11.5, color: ST.ink2, border: `1px solid ${ST.hair}`, display: 'inline-flex', alignItems: 'center',
          }}>{QUESTION_TEXT[q]}</button>
        ))}
      </div>
    </motion.div>
  );
}

function Tucked({ about, wallSt }) {
  const [open, setOpen] = useState(false);
  if (!about && !wallSt) return null;
  return (
    <div data-sheet-tucked style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {about && (
          <button type="button" data-sheet-about={open ? 'open' : 'closed'} aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 28, padding: '0 10px', borderRadius: 8,
            fontSize: 12, color: ST.ink2, border: `1px solid ${ST.hair}`, display: 'inline-flex', alignItems: 'center',
          }}>{open ? SHEET_COPY.aboutClose : SHEET_COPY.about} ›</button>
        )}
        {wallSt}
      </div>
      {open && about}
    </div>
  );
}

/**
 * @param {object} p
 * @param {object} p.view    useSheetView's answer
 * @param {node}   [p.about] the modal's profile block (the profile it already fetches)
 * @param {node}   [p.wallSt] the modal's labelled consensus chip
 */
export default function AnalysisSheet({ view, about = null, wallSt = null }) {
  const layer = view.question ? 1 : 0;
  return (
    <div data-sheet-root data-sheet-layer={layer} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 0 4px' }}>
      <Stance view={view} />
      <Voice view={view} collapsed={layer > 0} />
      {layer === 0 ? <Questions view={view} /> : <Pack view={view} />}
      <Tucked about={about} wallSt={wallSt} />
    </div>
  );
}

/** The action row (R-4′, BC-7, BC-12), pinned under the drawer's scroll area. */
export function SheetActionRow({ view }) {
  const q = view.question;
  const out = view.budget.left <= 0;
  const label = out ? SHEET_COPY.askOut
    : view.answering ? SHEET_COPY.askSending(view.archetype)
      : view.askedThis ? SHEET_COPY.askAsked(view.archetype)
        : q ? SHEET_COPY.askQuestion(view.archetype, QUESTION_TEXT[q]) : SHEET_COPY.askPick(view.archetype);
  return (
    <div data-sheet-actions style={{
      display: 'flex', gap: 8, padding: '8px 12px 10px', borderTop: `1px solid ${ST.hair}`, background: ST.surface,
    }}>
      <button
        type="button"
        data-sheet-ask={out ? 'out' : view.canAsk ? 'ready' : view.askedThis ? 'asked' : 'disabled'}
        disabled={!view.canAsk}
        onClick={view.ask}
        style={{
          all: 'unset', boxSizing: 'border-box', flex: 1, minWidth: 0, minHeight: 44, padding: '6px 12px', borderRadius: 12,
          cursor: view.canAsk ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          background: view.canAsk ? tint(ST.purple, 22) : tint(ST.ink, 4),
          border: `1px solid ${view.canAsk ? tint(ST.purple, 60) : ST.hair}`,
          color: view.canAsk ? ST.ink : ST.ink3,
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25 }}>{label}</span>
        {!out && q && !view.answering && !view.askedThis && (
          <span data-sheet-cost style={{ fontFamily: MONO, fontSize: 9.5, color: view.canAsk ? ST.purple : ST.ink3 }}>{SHEET_COPY.askCost(view.budget.left)}</span>
        )}
      </button>
      {view.cockpit && (
        <button
          type="button"
          data-sheet-cockpit
          onClick={view.cockpit}
          style={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 44, padding: '0 14px', borderRadius: 12,
            display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: ST.teal,
            border: `1px solid ${tint(ST.teal, 45)}`, background: tint(ST.teal, 8), whiteSpace: 'nowrap',
          }}
        >
          {SHEET_COPY.toCockpit}
        </button>
      )}
    </div>
  );
}
