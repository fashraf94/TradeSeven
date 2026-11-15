// src/components/Research/BattleResearch/BattleResearchSurface.jsx
//
// Battle Research Slice 1 — THE SURFACE (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-2, §7): what the battle's
// Research pill opens while Battle Research resolves on.
//
//   phone    a full-height layer of its own (390 × 844 first; 320 with no
//            sideways scroll): the top strip, the board in its own scroller,
//            and the bottom bar — the explanation's first paragraph clamped to
//            two lines with *Read more · history*, which opens the agent's
//            column as a sheet
//   desktop  a centred panel up to ~1,100 px: the board left, the agent's
//            column right (the prototype's desktop)
//
// BEHAVIOUR (the bench sheet's own modal hook, CockpitSheet.useCockpitModal):
// focus is trapped; Escape closes and focus returns to the Research pill; while
// the research modal stands over the surface the surface is INERT and takes no
// keys (CB4-9) — Escape then closes ONLY the modal (onSuspendedEscape), and the
// screen returns focus to the row that opened it. Tokens only (BUILD_RULES §10);
// the shipped motion, instant under reduced motion (§11); every label sizes an
// inner <span> (hazard 48). The scroll position is remembered per step, so
// reopening Research (or ‹ Back to ranking) lands where the player was.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { motionToken } from '../../../theme/motion.js';
import { useCockpitModal } from '../../../screens/battleView/CockpitSheet.jsx';
import { ST, MONO, tint } from '../Sheet/sheetTheme.js';
import { BR_COPY } from './battleResearchCopy.js';
import { boardOf, startersOf, asTheyStandOf, askAboutDraft, investigationLine } from './boardView.js';
import { EVIDENCE_REUSE_MS } from './useBattleResearch.js';
import ResearchOpening from './ResearchOpening.jsx';
import ResearchBoard from './ResearchBoard.jsx';
import AgentColumn, { PhoneLeadBar } from './AgentColumn.jsx';
import { rowButton } from './ResearchRow.jsx';

/**
 * @param {object} p
 * @param {boolean} p.open
 * @param {object} p.store          useBattleResearch(...)
 * @param {object} p.battle         the screen's subscribed document
 * @param {string} p.agentName      agentNameOf(...)
 * @param {string} p.voice          *{Agent} · {Archetype}*
 * @param {{ you: string, them: string, opponent: string }|null} p.standing  the score pair as the header shows it
 * @param {boolean} p.isDesktop
 * @param {boolean} p.reducedMotion
 * @param {() => void} p.onClose
 * @param {(symbol: string) => void} p.onOpenRow
 * @param {(draft: { text, variants }) => void} p.onAskAbout
 * @param {boolean} p.suspended     the research modal stands over the surface
 * @param {() => void} p.onSuspendedEscape
 * @param {() => HTMLElement|null} [p.restoreFocus]
 */
export default function BattleResearchSurface({
  open, store, battle, agentName, voice, standing = null, isDesktop = false, reducedMotion = false,
  onClose, onOpenRow, onAskAbout, suspended = false, onSuspendedEscape = null, restoreFocus = null,
}) {
  const { panelRef, onKeyDown } = useCockpitModal({ open, onClose, restoreFocus, suspended, onSuspendedEscape });
  const [sheet, setSheet] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const scrollRef = useRef(null);
  const s = store.state;
  const inv = s.view === 'board' ? store.active : null;

  // The opening's evidence: read once when the surface opens on the proposal (a bundle a minute old is reused).
  const openingAt = s.opening.result?.takenAt ?? null;
  useEffect(() => {
    if (!open || s.view !== 'opening') return;
    if (s.opening.status === 'loading') return;
    if (s.opening.status === 'ready' && openingAt !== null && Date.now() - openingAt < EVIDENCE_REUSE_MS) return;
    store.open();
  }, [open, s.view]); // eslint-disable-line react-hooks/exhaustive-deps -- read on open / on returning to the proposal only

  const board = useMemo(
    () => (inv && battle ? boardOf({ inv, battle, nowMs, desktop: isDesktop, showAll, refresh: s.refresh, agentName }) : null),
    [inv, battle, nowMs, isDesktop, showAll, s.refresh, agentName],
  );
  // A clock only while the Refresh button counts down (BRS-14: *Refresh in 0:42*) — never otherwise.
  const counting = !!board && !board.toolbar.refresh.allowed && !board.toolbar.refresh.inFlight;
  useEffect(() => {
    if (!open || !counting) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, counting]);
  useEffect(() => { if (open) setNowMs(Date.now()); }, [open, inv?.investigationId, board?.stepId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The scroll position, remembered per step (and for the opening) — restored on reopen and on ‹ Back to ranking.
  const scrollKey = inv ? `${inv.investigationId}|${board?.stepId}` : 'opening';
  useLayoutEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = s.scroll[scrollKey] ?? 0;
  }, [open, scrollKey]); // eslint-disable-line react-hooks/exhaustive-deps -- restore when the step (or the surface) changes
  const onScroll = (e) => { const top = e.currentTarget.scrollTop; store.rememberScroll(scrollKey, top); };
  // A new step starts with the short list.
  useEffect(() => { setShowAll(false); }, [board?.stepId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const actions = {
    setOrder: store.setOrder,
    addCondition: store.addCondition,
    removeCondition: store.removeCondition,
    switchGroup: store.switchGroup,
    undo: store.undo,
    previous: store.previous,
    startOver: () => { setSheet(false); store.startOver(); },
    refresh: store.refresh,
    openRow: onOpenRow,
    showAll: setShowAll,
    askAbout: () => { if (inv) onAskAbout(askAboutDraft(inv, Date.now())); },
    goTo: (id) => { setSheet(false); store.goTo(id); },
    reopen: (id) => { setSheet(false); store.reopen(id); },
  };
  const earlier = s.session.list.filter((x) => x.investigationId !== inv?.investigationId).reverse().map((x) => ({ id: x.investigationId, line: investigationLine(x) }));
  const opening = s.view === 'opening' || !inv;
  const st = opening ? startersOf(battle, s.opening, store.noWeakest, nowMs) : null;
  const phone = !isDesktop;
  const keyDown = (e) => {
    // The history sheet is the top layer inside the surface: Escape closes it first.
    if (sheet && e.key === 'Escape' && !suspended) { e.preventDefault(); e.stopPropagation(); setSheet(false); return; }
    onKeyDown(e);
  };

  const content = opening ? (
    <ResearchOpening
      proposal={st.proposal}
      agentName={agentName}
      starters={st.starters}
      onAsk={store.ask}
      pending={s.pending?.questionId ?? null}
      failure={s.failure}
      asTheyStand={asTheyStandOf(battle, s.opening)}
      onOpenRow={onOpenRow}
      narrow={phone}
    />
  ) : (
    <ResearchBoard board={board} actions={actions} narrow={phone} showAll={showAll} />
  );

  return (
    <div
      data-br-layer={isDesktop ? 'desktop' : 'phone'}
      {...(suspended ? { inert: true, 'data-br-suspended': '1' } : {})}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: isDesktop ? 'center' : 'stretch', justifyContent: 'center' }}
    >
      {isDesktop ? <div aria-hidden="true" data-br-backdrop onClick={onClose} style={{ position: 'absolute', inset: 0, background: `rgba(var(--ft-shadow-rgb), 0.6)` }} /> : null}
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal={suspended ? undefined : 'true'}
        aria-label={BR_COPY.title}
        data-br-surface={opening ? 'opening' : 'board'}
        tabIndex={-1}
        onKeyDown={keyDown}
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionToken('smooth', { reducedMotion })}
        style={{
          position: 'relative', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: ST.bg, color: ST.ink, overflow: 'hidden',
          ...(isDesktop
            ? { width: 'min(1100px, calc(100vw - 48px))', height: 'min(880px, calc(100vh - 48px))', borderRadius: 16, border: `1px solid ${ST.hair}` }
            : { width: '100%', height: '100%', maxWidth: '100vw' }),
        }}
      >
        <header data-br-top style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: `1px solid ${ST.hair}`, minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: ST.ink }}>{BR_COPY.title}</span>
            <span data-br-voice style={{ fontFamily: MONO, color: ST.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ fontSize: 10.5 }}>{voice}</span></span>
          </div>
          {standing ? (
            <span data-br-standing style={{ fontFamily: MONO, color: ST.ink2, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 11.5 }}>{`You ${standing.you} · ${standing.opponent} ${standing.them}`}</span>
            </span>
          ) : null}
          <button type="button" data-br-close aria-label={BR_COPY.close} onClick={onClose}
            style={{ ...rowButton, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ST.ink2 }}>
            <X size={18} />
          </button>
        </header>
        {isDesktop && !opening ? (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) clamp(300px, 31vw, 400px)' }}>
            <div ref={scrollRef} data-br-scroll onScroll={onScroll} style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '18px 20px 28px' }}>{content}</div>
            <aside aria-label={voice} style={{ minHeight: 0, overflowY: 'auto', borderLeft: `1px solid ${ST.hair}`, background: ST.surface, padding: 16 }}>
              <AgentColumn board={board} voice={voice} earlier={earlier} droppedInvestigations={s.session.dropped} actions={actions} />
            </aside>
          </div>
        ) : (
          <>
            <div ref={scrollRef} data-br-scroll onScroll={onScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: phone ? '12px 12px 20px' : '18px 20px 28px' }}>{content}</div>
            {phone && !opening ? <PhoneLeadBar lead={board.lead} voice={agentName} onMore={() => setSheet(true)} /> : null}
          </>
        )}
        {phone && !opening && sheet ? (
          <div data-br-history-sheet style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div aria-hidden="true" onClick={() => setSheet(false)} style={{ position: 'absolute', inset: 0, background: `rgba(var(--ft-shadow-rgb), 0.6)` }} />
            <div role="dialog" aria-label={BR_COPY.readMore} style={{ position: 'relative', maxHeight: '85%', overflowY: 'auto', overflowX: 'hidden', background: ST.surface, borderRadius: '16px 16px 0 0', padding: '12px 14px 20px', borderTop: `1px solid ${tint(ST.teal, 35)}` }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" data-br-sheet-close aria-label={BR_COPY.close} onClick={() => setSheet(false)} style={{ ...rowButton, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ST.ink2 }}><X size={18} /></button>
              </div>
              <AgentColumn board={board} voice={voice} earlier={earlier} droppedInvestigations={s.session.dropped} actions={actions} />
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
