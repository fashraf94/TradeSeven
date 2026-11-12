// src/components/Research/Sheet/AnalysisSheet.jsx
//
// The two-view shell's ANALYSIS VIEW (Amendment C §3, R-23–R-34; spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-5, SB-6), built AS AN ORDERED
// LIST OF BLOCKS (R-34): each view state is a list of { key, node } rendered in
// order, so the later Battle Research build can prepend its research blocks
// (the context strip, For this question, the finding, the compare, the prepared
// answers) without touching these. No state-2 prop, branch or UI ships here.
//
// In battle (Build C's content, reused unchanged: useSheetView, packs.js,
// latestLine.js, AskReply.jsx), top to bottom:
//   stance     the holding line — Build C's stance (held, bench, looked at, not examined) and its idea
//   decided    What it decided: {Agent} · {Archetype} · {time} (R-23), the latest sentence quoted
//   questions  Ask about {SYM} · see the evidence first · free — the three rows in the
//              archetype's order; a tapped row opens its pack in place (numbered items, their
//              source lines, "see on chart ›", the answered Ask with "filed to chat")
//   wallSt     one quiet line: Wall St {rating} · {n} analysts · About {name} ›
//   tabs       the strip — What's moving · Ranks · Smart Money · Sector — stuck under the header
// In browse (SB-6): today's five preset questions folded into one row, the
// Wall St · About line, the tabs. The action row is pinned by the modal under
// the view's scroll (SheetActionRow in battle; the mount's own action in browse).
//
// Hierarchy by spacing and type weight: few borders, one accent per block. Every
// string comes from sheetCopy.js; every number from the view.

import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionToken } from '../../../theme/motion.js';
import { SHEET_COPY, SHELL_COPY, QUESTION_TEXT } from './sheetCopy.js';
import { ST, MONO, tint } from './sheetTheme.js';
import AskReply from './AskReply.jsx';

const TONE = { green: ST.green, amber: ST.amber, purple: ST.purple };
// src/index.css forces every <button>'s own font-size to 16px (!important, iOS zoom): a
// button's text takes its size from an inner span, never from the button's style.
const EYEBROW = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' };
const ROW = { all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', gap: 10 };

function Chevron({ color = ST.teal, down = false }) {
  return <span aria-hidden="true" style={{ color, fontSize: 16, lineHeight: 1, flexShrink: 0, display: 'inline-block', transform: down ? 'rotate(90deg)' : 'none' }}>›</span>;
}

/** The holding line — Build C's stance (BC-9, BC-15, FQ-2) as one bold line, then its facts in one quiet line. */
function Stance({ view }) {
  const [open, setOpen] = useState(false);
  const { chips, idea } = view.stance;
  const [head, ...rest] = chips;
  const facts = rest.filter((c) => c.tone !== 'purple');
  const ideaChip = rest.find((c) => c.tone === 'purple') ?? null;
  const headColor = head ? TONE[head.tone] ?? null : null;
  return (
    <div data-sheet-stance={view.stance.kind} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {head && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {head.dot && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: headColor ?? ST.ink2, flexShrink: 0 }} />}
          <span data-sheet-chip style={{ fontSize: 16, fontWeight: 700, color: headColor && !head.dot ? headColor : ST.ink }}>{head.text}</span>
        </div>
      )}
      {facts.length > 0 && (
        <div data-shell-stance-facts style={{ fontFamily: MONO, fontSize: 11.5, color: ST.ink2, lineHeight: 1.45, paddingLeft: head?.dot ? 17 : 0 }}>
          {facts.map((c, i) => (
            <React.Fragment key={c.text}>
              {i > 0 && ' · '}
              <span data-sheet-chip style={TONE[c.tone] ? { color: TONE[c.tone], fontWeight: 700 } : undefined}>{c.text}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      {ideaChip && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: head?.dot ? 17 : 0 }}>
          <span data-sheet-chip style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ST.purple }}>{ideaChip.text}</span>
          {idea && (
            <button
              type="button"
              data-sheet-idea={open ? 'open' : 'line'}
              aria-expanded={open}
              aria-label={open ? SHEET_COPY.ideaClose : SHEET_COPY.ideaOpen}
              onClick={() => setOpen((v) => !v)}
              style={{
                all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%', color: ST.ink2,
                fontStyle: 'italic', lineHeight: 1.4,
                ...(open ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
              }}
            >
              <span style={{ fontSize: 12.5 }}>“{idea.statement}”</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** What it decided (R-23): the eyebrow, {Agent} · {Archetype} · {time}, then the latest sentence, quoted (BC-3). */
function Decided({ view, collapsed }) {
  // Two lines of the sentence on open; a tap shows all of it (Build C review D3).
  const [whole, setWhole] = useState(false);
  const l = view.latest;
  const quoted = typeof l.text === 'string' && l.text;
  const eyebrow = l.source === 'rationale' ? SHEET_COPY.voiceDecided
    : l.source === 'call' ? SHEET_COPY.voiceCalled
      : l.source === 'bench' ? SHEET_COPY.voiceFlagged
        : l.source === 'exit' ? SHEET_COPY.voiceFlaggedExit(view.latestTime ?? '') : SHEET_COPY.voiceNothing;
  const line = quoted ? l.text
    : l.source === 'template_checked' ? SHEET_COPY.checkedNothingSaid(view.latestTime ?? '', view.symbol)
      : l.source === 'template_looked' ? SHEET_COPY.lastLookedAt(view.latestTime ?? '')
        : SHEET_COPY.notLooked(view.archetype);
  // The quote's time belongs to the quote; an exit flag's eyebrow already names it.
  const label = SHELL_COPY.voiceLabel(view.agentName, view.archetype, quoted && l.source !== 'exit' ? view.latestTime : null);
  return (
    <section data-sheet-voice={l.source} style={{ display: 'flex', flexDirection: 'column', gap: collapsed ? 4 : 6, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
        <span style={{ ...EYEBROW, color: ST.teal, flexShrink: 0 }}>{eyebrow}</span>
        <span data-shell-voice-label style={{ fontFamily: MONO, fontSize: 10.5, color: ST.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{label}</span>
      </div>
      <p
        data-sheet-voice-line
        {...(!collapsed && quoted ? { role: 'button', tabIndex: 0, 'aria-expanded': whole, title: SHEET_COPY.voiceMore, 'data-sheet-voice-whole': whole ? '1' : '0', onClick: () => setWhole((w) => !w), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWhole((w) => !w); } } } : {})}
        style={{
          margin: 0, fontSize: collapsed ? 13 : 15.5, lineHeight: 1.45, fontStyle: quoted ? 'italic' : 'normal', color: quoted ? ST.ink : ST.ink2, minWidth: 0,
          ...(collapsed
            ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
            : whole ? { cursor: 'pointer', overflowWrap: 'anywhere' }
              : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', ...(quoted ? { cursor: 'pointer' } : {}) }),
        }}
      >
        {quoted ? `“${line}”` : line}
      </p>
    </section>
  );
}

/** The three questions as rows (hairlines, one chevron), in the archetype's order (BC-13). */
function Questions({ view }) {
  return (
    <section data-sheet-questions style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ ...EYEBROW, color: ST.ink3 }}>{SHEET_COPY.askAbout(view.symbol)}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: ST.ink3, whiteSpace: 'nowrap' }}>{SHEET_COPY.askAboutRight}</span>
      </div>
      <div>
        {view.order.map((q, i) => (
          <button
            key={q}
            type="button"
            data-sheet-question={q}
            onClick={() => view.pickQuestion(q)}
            style={{ ...ROW, minHeight: 46, borderTop: i ? `1px solid ${ST.hair}` : 'none', fontWeight: 600, color: ST.ink, lineHeight: 1.3 }}
          >
            <span style={{ flex: 1, fontSize: 14.5 }}>{QUESTION_TEXT[q]}</span>
            <Chevron />
          </button>
        ))}
      </div>
    </section>
  );
}

/** A question opened: its pack in place (BC-4), "see on chart ›" on every item with a pin, the Ask's answer. */
function Pack({ view, onSeeOnChart }) {
  const reduced = useReducedMotion() === true;
  const { pack } = view;
  const asked = view.reply.status === 'answered' && view.reply.questionId === view.question;
  return (
    <motion.section
      key={view.question}
      data-sheet-pack={view.question}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionToken('fade', { reducedMotion: reduced })}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
        <button type="button" data-sheet-back aria-label={SHEET_COPY.backToQuestions} onClick={view.backToQuestions}
          style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', color: ST.ink2, minWidth: 28, minHeight: 32, display: 'flex', alignItems: 'center' }}><span style={{ fontSize: 18, lineHeight: 1 }}>‹</span></button>
        <span style={{ fontSize: 15, fontWeight: 700, flex: 1, color: ST.ink }}>{QUESTION_TEXT[view.question]}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: ST.ink3, whiteSpace: 'nowrap' }}>{asked ? SHEET_COPY.packAsked : SHEET_COPY.packFree}</span>
      </div>
      <span data-sheet-weighs style={{ ...EYEBROW, fontSize: 9.5, color: ST.ink3 }}>{pack.label}</span>
      {pack.items.length === 0 && (
        <div style={{ fontSize: 13, color: ST.ink2 }}>{SHEET_COPY.packEmpty(view.archetype)}</div>
      )}
      <div>
        {pack.items.map((it, i) => {
          const on = view.activeItem === i;
          return (
            <div
              key={`${it.kind}:${i}`}
              data-pack-item={it.kind}
              data-pack-status={it.status}
              data-pack-on={on ? '1' : '0'}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? `1px solid ${ST.hair}` : 'none', ...(on ? { boxShadow: `inset 2px 0 0 ${ST.teal}`, paddingLeft: 8 } : {}) }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: 9, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: ST.ink, color: ST.bg, fontFamily: MONO, fontSize: 9.5, fontWeight: 800,
              }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: ST.ink }}>{it.fact}</span>
                <span style={{ marginTop: 3, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9.5, color: ST.ink3 }}>{it.source.label}</span>
                  {it.pin && typeof onSeeOnChart === 'function' && (
                    <button type="button" data-pack-see={i} onClick={() => onSeeOnChart(i, it)}
                      style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: ST.teal, whiteSpace: 'nowrap', minHeight: 28, display: 'inline-flex', alignItems: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: 10 }}>{SHELL_COPY.seeOnChart}</span>
                    </button>
                  )}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <AskReply view={view} />
      <div data-sheet-or-ask style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingTop: 2 }}>
        <span style={{ ...EYEBROW, fontSize: 9, color: ST.ink3 }}>{SHEET_COPY.orAsk}</span>
        {view.order.filter((q) => q !== view.question).map((q) => (
          <button key={q} type="button" data-sheet-question={q} onClick={() => view.pickQuestion(q)} style={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 34, padding: '0 12px', borderRadius: 999,
            color: ST.ink2, border: `1px solid ${ST.hair}`, display: 'inline-flex', alignItems: 'center',
          }}><span style={{ fontSize: 12 }}>{QUESTION_TEXT[q]}</span></button>
        ))}
      </div>
    </motion.section>
  );
}

/**
 * One quiet line above the tabs: Wall St {rating} · {n} analysts · About {name} ›.
 * About opens the profile the modal already fetched, inline (BC-14).
 * @param {object} p
 * @param {string|null} p.wallSt     the consensus text (SHELL_COPY.wallSt / wallStNone), or null
 * @param {string|null} p.aboutName  the company's name for "About {name}", or null with no profile
 * @param {node|null}   p.about      the profile block
 */
export function WallStLine({ wallSt = null, aboutName = null, about = null }) {
  const [open, setOpen] = useState(false);
  const canAbout = !!about && typeof aboutName === 'string' && aboutName;
  if (!wallSt && !canAbout) return null;
  return (
    <div data-sheet-tucked style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: ST.ink2, lineHeight: 1.4, minHeight: 44 }}>
        {wallSt && <span data-shell-wallst>{wallSt}</span>}
        {wallSt && canAbout && <span aria-hidden="true" style={{ color: ST.ink3 }}>·</span>}
        {canAbout && (
          <button type="button" data-sheet-about={open ? 'open' : 'closed'} aria-expanded={open} onClick={() => setOpen((v) => !v)}
            style={{ all: 'unset', cursor: 'pointer', color: ST.ink2, display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44 }}>
            <span style={{ fontSize: 13 }}>{open ? SHELL_COPY.aboutHide : SHELL_COPY.aboutName(aboutName)}</span>
            <Chevron color={ST.ink3} down={open} />
          </button>
        )}
      </div>
      {open && about}
    </div>
  );
}

/** Browse (SB-6, SQ-3): today's five preset questions folded into one row, *Ask about this stock*. */
export function BrowseAsk({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <section data-shell-browse-ask={open ? 'open' : 'closed'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        style={{ ...ROW, minHeight: 46, borderTop: `1px solid ${ST.hair}`, borderBottom: open ? 'none' : `1px solid ${ST.hair}`, fontWeight: 600, color: ST.ink }}>
        <span style={{ flex: 1, fontSize: 14.5 }}>{SHELL_COPY.browseAsk}</span>
        <Chevron down={open} />
      </button>
      {open && children}
    </section>
  );
}

/**
 * The blocks in order, each in a keyed box the later research build can find and prepend to (R-34).
 * `layer` (battle only: 0 the questions, 1 a pack) marks Build C's sheet root; browse has none.
 */
export function AnalysisBlocks({ blocks, layer = null }) {
  return (
    <div data-shell-analysis={layer === null ? 'browse' : 'battle'} {...(layer === null ? {} : { 'data-sheet-root': '', 'data-sheet-layer': layer })} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {blocks.map((b) => <div key={b.key} data-shell-block={b.key}>{b.node}</div>)}
    </div>
  );
}

/**
 * State 1 in battle: the ordered blocks (Amendment C §3). Pure.
 * @param {object} p
 * @param {object} p.view           useSheetView's answer
 * @param {node}   [p.wallSt]       the Wall St · About line (WallStLine)
 * @param {node}   [p.tabs]         the tab strip and its content (ShellTabs)
 * @param {(i: number, item: object) => void} [p.onSeeOnChart]  a pack item's "see on chart ›"
 */
export function battleBlocks({ view, wallSt = null, tabs = null, onSeeOnChart = null }) {
  const layer = view.question ? 1 : 0;
  return [
    { key: 'stance', node: <Stance view={view} /> },
    { key: 'decided', node: <Decided view={view} collapsed={layer > 0} /> },
    { key: 'questions', node: layer === 0 ? <Questions view={view} /> : <Pack view={view} onSeeOnChart={onSeeOnChart} /> },
    { key: 'wallSt', node: wallSt },
    { key: 'tabs', node: tabs },
  ].filter((b) => b.node);
}

/** State 1 in browse (SB-6). Pure. */
export function browseBlocks({ ask = null, wallSt = null, tabs = null }) {
  return [
    { key: 'browseAsk', node: ask },
    { key: 'wallSt', node: wallSt },
    { key: 'tabs', node: tabs },
  ].filter((b) => b.node);
}

/** The Analysis view in battle: the archetype's lens on the stock (Build C's content, laid out as round 5 A draws it). */
export default function AnalysisSheet({ view, wallSt = null, tabs = null, onSeeOnChart = null }) {
  return <AnalysisBlocks blocks={battleBlocks({ view, wallSt, tabs, onSeeOnChart })} layer={view.question ? 1 : 0} />;
}

/**
 * The action row (R-4′, BC-7, BC-12; R-29), pinned by the modal under every view.
 * As Build C built it — the preset Ask with its cost, → Cockpit — addressed to the
 * player's agent by name (R-23, R-29: *Ask {Agent}: …*), the archetype when the
 * battle names no agent.
 */
export function SheetActionRow({ view }) {
  const q = view.question;
  const out = view.budget.left <= 0;
  const who = typeof view.agentName === 'string' && view.agentName ? view.agentName : view.archetype;
  const label = out ? SHEET_COPY.askOut
    : view.answering ? SHEET_COPY.askSending(who)
      : view.askedThis ? SHEET_COPY.askAsked(who)
        : q ? SHEET_COPY.askQuestion(who, QUESTION_TEXT[q]) : SHEET_COPY.askPick(who);
  return (
    <div data-sheet-actions style={{
      flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px 12px', borderTop: `1px solid ${ST.hair}`, background: ST.surface,
    }}>
      <button
        type="button"
        data-sheet-ask={out ? 'out' : view.canAsk ? 'ready' : view.askedThis ? 'asked' : 'disabled'}
        disabled={!view.canAsk}
        onClick={view.ask}
        style={{
          all: 'unset', boxSizing: 'border-box', flex: 1, minWidth: 0, minHeight: 48, padding: '6px 12px', borderRadius: 12,
          cursor: view.canAsk ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
          background: view.canAsk ? tint(ST.purple, 22) : tint(ST.ink, 4),
          border: `1px solid ${view.canAsk ? tint(ST.purple, 60) : ST.hair}`,
          color: view.canAsk ? ST.ink : ST.ink3,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{label}</span>
        {!out && q && !view.answering && !view.askedThis && (
          <span data-sheet-cost style={{ fontFamily: MONO, fontSize: 10, color: view.canAsk ? ST.ink2 : ST.ink3 }}>{SHEET_COPY.askCost(view.budget.left)}</span>
        )}
      </button>
      {view.cockpit && (
        <button
          type="button"
          data-sheet-cockpit
          onClick={view.cockpit}
          style={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 48, padding: '0 14px', borderRadius: 12,
            display: 'flex', alignItems: 'center', fontWeight: 700, color: ST.teal,
            border: `1px solid ${tint(ST.teal, 45)}`, whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 13 }}>{SHEET_COPY.toCockpit}</span>
        </button>
      )}
    </div>
  );
}
