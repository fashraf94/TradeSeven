// src/components/Research/BattleResearch/ResearchBoard.jsx
//
// Battle Research Slice 1 — THE BOARD (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md §7, BRS-11 – BRS-15, BRS-20; the
// prototype's Br2Board), after a question: the question as the title with
// its *then: …* chain, the note line, the banner after a refinement or a
// refresh, the one quiet notice with Refresh, the toolbar, the conditions
// (active as removable chips, then the prepared ones under *Refine this
// result · no message cost*), the list (the dashed reference line where its
// value falls; the placed rows, top 5 on the phone and 6 on desktop, then
// *Show all*; Left out; Not ranked) and the footer (the caveat; Ask {Agent}
// about this result · 1 msg when sent). Renders boardView.boardOf's model;
// formats nothing. Every tap here costs no message.

import React from 'react';
import { ST, MONO, tint } from '../Sheet/sheetTheme.js';
import { BR_COPY } from './battleResearchCopy.js';
import { rowButton, ResearchRow, ReferenceLine } from './ResearchRow.jsx';

const EYEBROW = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 };

/** A toolbar or condition chip: ≥ 44 px tall, its label in an inner span (hazard 48). */
export function Chip({ children, on = false, disabled = false, onClick, tone = ST.teal, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={on ? 'true' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      onClick={() => { if (!disabled) onClick?.(); }}
      style={{
        ...rowButton, boxSizing: 'border-box', minHeight: 44, padding: '0 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6,
        border: `1px solid ${on ? tone : ST.hair}`, background: on ? tint(tone, 14) : 'transparent', color: disabled ? ST.ink3 : on ? tone : ST.ink2,
        cursor: disabled ? 'default' : 'pointer', maxWidth: '100%',
      }}
      {...rest}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{children}</span>
    </button>
  );
}

function Section({ title, children, testid }) {
  return (
    <section data-br-section={testid} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ ...EYEBROW, color: ST.ink3 }}>{title}</span>
      <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</ul>
    </section>
  );
}

/**
 * @param {object} p
 * @param {object} p.board       boardView.boardOf(...)
 * @param {object} p.actions     { setOrder, addCondition, removeCondition, switchGroup, undo, previous, startOver, refresh, openRow, showAll, askAbout }
 * @param {boolean} p.narrow     the phone
 * @param {boolean} p.showAll
 */
export default function ResearchBoard({ board, actions, narrow = false, showAll = false }) {
  const t = board.toolbar;
  const moveOn = t.order.measure === 'today_move';
  return (
    <div data-br-board={board.stepId} style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 id="br-board-title" data-br-title style={{ margin: 0, fontSize: narrow ? 20 : 24, fontWeight: 800, lineHeight: 1.2, color: ST.ink, overflowWrap: 'anywhere' }}>{board.title}</h2>
        {board.refinements.length ? (
          <div data-br-then style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {board.refinements.map((w, i) => <span key={`${w}:${i}`} style={{ color: ST.ink2 }}><span style={{ fontSize: 12.5 }}>{w}</span></span>)}
          </div>
        ) : null}
        <span data-br-note style={{ fontFamily: MONO, color: ST.ink3, lineHeight: 1.45, overflowWrap: 'anywhere' }}><span style={{ fontSize: 11 }}>{board.note}</span></span>
      </header>

      {board.banner ? (
        <div role="status" data-br-banner={board.banner.kind} style={{ padding: '10px 12px', borderRadius: 10, background: tint(ST.teal, 8), border: `1px solid ${tint(ST.teal, 35)}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ST.ink }}>{board.banner.title}</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: ST.ink2 }}>{board.banner.body}</span>
        </div>
      ) : null}

      {board.notice ? (
        <div role="status" data-br-notice={board.notice.kind} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 10, border: `1px dashed ${tint(ST.amber, 55)}` }}>
          <span style={{ flex: '1 1 200px', fontSize: 12.5, lineHeight: 1.45, color: ST.ink2 }}>{board.notice.text}</span>
          <Chip data-br-notice-refresh disabled={!t.refresh.allowed} onClick={actions.refresh}>{t.refresh.text}</Chip>
        </div>
      ) : null}
      {t.refreshError ? (
        <div role="status" data-br-refresh-error style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 10, border: `1px solid ${tint(ST.red, 45)}` }}>
          <span style={{ flex: '1 1 200px', fontSize: 12.5, lineHeight: 1.45, color: ST.ink2 }}>{t.refreshError}</span>
          {t.refresh.allowed ? <Chip data-br-refresh-retry onClick={actions.refresh}>{BR_COPY.tryAgain}</Chip> : null}
        </div>
      ) : null}

      <div role="toolbar" aria-label={BR_COPY.title} data-br-toolbar style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Chip data-br-order="technical_rank" on={!moveOn} onClick={() => actions.setOrder({ measure: 'technical_rank', direction: 'best_first' })}>{BR_COPY.orderRank}</Chip>
        <Chip data-br-order="today_move" on={moveOn} disabled={t.moveOrderDisabled} onClick={() => actions.setOrder({ measure: 'today_move', direction: 'best_first' })}>{BR_COPY.orderMove}</Chip>
        {moveOn ? (
          <Chip data-br-drop-first on={t.order.direction === 'worst_first'} onClick={() => actions.setOrder({ measure: 'today_move', direction: t.order.direction === 'worst_first' ? 'best_first' : 'worst_first' })}>{BR_COPY.orderDropFirst}</Chip>
        ) : null}
        {t.groupSwitch ? <Chip data-br-group-switch={t.groupSwitch.to} onClick={() => actions.switchGroup(t.groupSwitch.to)}>{t.groupSwitch.label}</Chip> : null}
        <Chip data-br-undo disabled={!t.canUndo} onClick={actions.undo}>{BR_COPY.undo}</Chip>
        <Chip data-br-previous disabled={!t.canPrevious} onClick={actions.previous}>{BR_COPY.previous}</Chip>
        <Chip data-br-start-over onClick={actions.startOver}>{BR_COPY.startOver}</Chip>
        <Chip data-br-refresh disabled={!t.refresh.allowed} onClick={actions.refresh}>{`${t.refresh.text} · ${board.resultLabel}`}</Chip>
      </div>
      {t.moveLine ? <span data-br-move-line style={{ fontFamily: MONO, color: ST.ink3 }}><span style={{ fontSize: 10.5 }}>{t.moveLine}</span></span> : null}

      <div data-br-conditions style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {board.conditions.active.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {board.conditions.active.map((c) => (
              <Chip key={`${c.id}:${c.value ?? ''}`} data-br-active-condition={c.id} on aria-label={`${c.label} — remove`} onClick={() => actions.removeCondition(c.id)}>{`${c.label} ×`}</Chip>
            ))}
          </div>
        ) : null}
        <span style={{ ...EYEBROW, color: ST.ink3 }}>{BR_COPY.refineHead}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {board.conditions.prepared.map((c) => (
            <Chip key={`${c.id}:${c.value ?? ''}`} data-br-condition={c.id} data-br-condition-value={c.value ?? undefined} disabled={c.disabled} title={c.line ?? undefined} onClick={() => actions.addCondition(c.value ? { id: c.id, value: c.value } : { id: c.id })}>{c.label}</Chip>
          ))}
        </div>
      </div>

      {board.empty ? <p data-br-empty style={{ margin: 0, fontSize: 13, color: ST.ink2 }}>{board.empty}</p> : null}
      <ol data-br-list style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {board.list.map((x) => (x.kind === 'reference'
          ? <ReferenceLine key={`ref:${x.reference.symbol}`} reference={x.reference} onOpen={() => actions.openRow(x.reference.symbol)} />
          : <ResearchRow key={x.symbol} facts={x.facts} position={x.position} was={x.was} lead={x.position === 1} onOpen={() => actions.openRow(x.symbol)} />))}
      </ol>
      {board.hiddenCount > 0 || showAll ? (
        <Chip data-br-show-all onClick={() => actions.showAll(!showAll)}>{showAll ? BR_COPY.showFewer : BR_COPY.showAll(board.total)}</Chip>
      ) : null}

      {board.removed.length || board.notAssessed.length ? (
        <Section title={BR_COPY.leftOut} testid="left-out">
          {board.removed.map((r) => <ResearchRow key={`rm:${r.facts.symbol}`} facts={r.facts} note={r.note} onOpen={() => actions.openRow(r.facts.symbol)} />)}
          {board.notAssessed.map((r) => <ResearchRow key={`na:${r.facts.symbol}`} facts={r.facts} note={r.note} onOpen={() => actions.openRow(r.facts.symbol)} />)}
        </Section>
      ) : null}
      {board.unranked.length ? (
        <Section title={BR_COPY.notRanked} testid="not-ranked">
          {board.unranked.map((r) => <ResearchRow key={`nr:${r.facts.symbol}`} facts={r.facts} note={r.note} onOpen={() => actions.openRow(r.facts.symbol)} />)}
        </Section>
      ) : null}

      <footer style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6, borderTop: `1px solid ${ST.hair}` }}>
        <p data-br-caveat style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: ST.ink3 }}>{BR_COPY.caveat}</p>
        <button
          type="button"
          data-br-ask-about
          aria-disabled={board.askAbout.disabled ? 'true' : undefined}
          onClick={() => { if (!board.askAbout.disabled) actions.askAbout(); }}
          style={{ ...rowButton, boxSizing: 'border-box', minHeight: 48, padding: '8px 14px', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 2, border: `1px solid ${tint(ST.purple, 55)}`, background: tint(ST.purple, 14), color: board.askAbout.disabled ? ST.ink3 : ST.ink }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{board.askAbout.label}</span>
          <span style={{ fontFamily: MONO, color: ST.ink2 }}><span style={{ fontSize: 10.5 }}>{board.askAbout.cost}</span></span>
        </button>
      </footer>
    </div>
  );
}
