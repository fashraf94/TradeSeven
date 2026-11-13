// src/components/SharedResearch/SharedResearchSheetBody.jsx
//
// Shared Research "Work an idea" — THE SHEET'S BODY (B2; spec
// docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md §7, with §15–§17
// and the B2 rulings K-1–K-11, P-1–P-5). DARK: nothing in the app imports it.
// The hub amendment (the Command Center chat's) adds the wrapper
// `CommandCenter/SharedResearchSheet.jsx` — a HubSheet with this body inside, as
// `CommandCenter/HuddleSheet.jsx` holds `Huddle/HuddleSheetBody.jsx` — the door,
// `HUB_SHEETS.RESEARCH` and the mount guard's rows.
//
// THE BOUNDARY (K-2): this directory imports nothing from
// src/components/CommandCenter/ (guarded: sharedResearch.boundary.test.js). The
// hub hands in what it owns as props: the stories it selected, the agent's name
// and id, the equipped list's label, the gate, and `overlayStack` — the object
// its wrapper gets from useHubOverlays() (null standalone), used ONLY to register
// the SignalDrop modal `within` the stack while it is open and release it after.
// The modal portals into <body> over the hub sheet at SR_DROP_LAYER (ruling P-1).
//
// Props:
//   open               boolean (default true) — false renders nothing
//   mode               'start' | 'item' | 'signaldrop' | 'session'
//   item               a story (mode 'item'): { itemRef, headline, reporterName, beat, publishedAt, context, question, reason|null }
//   direction          string|null — prefilled direction (onboarding's typed explore text)
//   sessionId          string|null — the investigation to open (mode 'session')
//   stories            the hub's selection, up to five, same shape as `item`
//   agentName          string|null — "your agent" when absent (R6)
//   agentId            string|null — the ranked agent equip targets (ruling P-4); null → no "Use it in my next game"
//   equippedListLabel  string|null — the "Replaces {list}" line
//   gated              boolean — the hub's gate verdict; a server 404 disabled gates too (K-3)
//   phone              boolean — the phone's single column
//   onClose            () => void — "Continue later", "Return to Command Center"
//   overlayStack       the hub's overlay stack, or null

import React, { useEffect, useId, useRef, useState } from 'react';
import SignalDropEntry from '../SignalDrop/SignalDropEntry';
import useSharedResearch from './useSharedResearch';
import { SR_COPY as COPY } from './sharedResearchCopy';
import { SR_DROP_LAYER, S } from './sharedResearchStyle';
import { agentNameOf, observationTextOf } from './sharedResearchView';
import { LinkButton, Notice, Running } from './parts';
import Start from './screens/Start';
import { ItemPreview, DropPreview, ExistingContinue } from './screens/Previews';
import Framing from './screens/Framing';
import Work from './screens/Work';
import Adopt from './screens/Adopt';
import Discard from './screens/Discard';

const initialView = (mode, item, sessionId) => {
  if (mode === 'session' && sessionId) return 'work';
  if (mode === 'item' && item) return 'item';
  return 'start';
};

export default function SharedResearchSheetBody({
  open = true, mode = 'start', item = null, direction = null, sessionId = null, stories = [],
  agentName = null, agentId = null, equippedListLabel = null, gated = false, phone = false, onClose = () => {}, overlayStack = null,
}) {
  const sr = useSharedResearch({ gated });
  const name = agentNameOf(agentName, COPY.agentFallback);
  const rootRef = useRef(null);
  const dropOverlayId = `sr-signaldrop${useId()}`;
  const heldRef = useRef(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [view, setView] = useState(() => initialView(mode, item, sessionId));
  const [story, setStory] = useState(mode === 'item' ? item : null);
  const [drop, setDrop] = useState(null);
  const [prefill, setPrefill] = useState('');
  const [preselect, setPreselect] = useState(null);
  const [adoptEpoch, setAdoptEpoch] = useState(0);
  const [earlier, setEarlier] = useState(null); // { returnTo } while the earlier investigation is on screen (ruling P-2)
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  // ── the SignalDrop modal, registered `within` the hub's stack while open (spec §4.1; P-1) ──
  const openDropModal = (event) => {
    const opener = event?.currentTarget ?? null;
    if (overlayStack && !heldRef.current) {
      overlayStack.open(dropOverlayId, { opener, within: rootRef.current });
      heldRef.current = true;
    }
    setDropOpen(true);
  };
  const releaseDrop = (focus) => {
    if (overlayStack && heldRef.current) {
      overlayStack.close(dropOverlayId, { fallback: rootRef.current?.closest?.('[role="dialog"]') ?? null, focus });
      heldRef.current = false;
    }
  };
  const closeDropModal = () => { releaseDrop(true); setDropOpen(false); };
  const onDropResult = ({ parseResult, dropId }) => {
    releaseDrop(false); // focus goes to the drop preview's question below, not back to a button that is leaving
    setDropOpen(false);
    sr.beginPreview();
    setDrop({ parseResult, dropId, at: new Date().toISOString() });
    setView('drop');
  };
  useEffect(() => () => { releaseDrop(false); }, []);

  // ── first load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'session' && sessionId) sr.loadSession(sessionId);
    else sr.loadList();
    // After the sheet's own registration (a parent's effect runs after this child's): the modal then sits ABOVE the sheet
    // in the stack, so its close hands focus back into the sheet (review c2; HuddleSheetBody's microtask precedent).
    if (mode === 'signaldrop' && !gated) Promise.resolve().then(() => { if (live.current) openDropModal(null); });
  }, []);
  // Gated while the modal is open (a server 404 disabled): the modal goes, and its hold on the stack with it.
  useEffect(() => {
    if (sr.gated && dropOpen) { releaseDrop(false); setDropOpen(false); }
  }, [sr.gated]);

  // A different investigation on screen (an open, a Continue, the earlier one): show its work.
  useEffect(() => {
    if (sr.epoch > 0 && view !== 'adopt' && view !== 'discard') setView('work');
  }, [sr.epoch]);
  // Focus never falls out of the sheet (review c1): a control that disables while its request runs, or a screen that
  // replaces the one the player was on, would drop focus to <body> — where Escape no longer reaches the sheet. After any
  // render that leaves focus on <body>, the body's root takes it (it is inside the dialog, so its keys still work).
  useEffect(() => {
    if (document.activeElement === document.body && rootRef.current?.isConnected && !rootRef.current.closest('[inert]')) rootRef.current.focus({ preventScroll: true });
  });
  // The drop preview takes focus when it replaces the modal.
  useEffect(() => {
    if (view === 'drop') rootRef.current?.querySelector('#sr-drop-q')?.focus();
  }, [view]);

  if (!open) return null;

  const current = sr.inv?.session?.sessionId ?? null;
  const toStart = (text = '') => { setPrefill(text); setStory(null); setDrop(null); setEarlier(null); sr.clearFailure(); setView('start'); if (sr.list.status !== 'loading') sr.loadList(); };
  const pickStory = (s) => { sr.beginPreview(); setStory(s); setView('item'); };
  const frame = (text) => { setPrefill(text); sr.frame(text); setView('framing'); };
  const editWords = async () => { const words = await sr.editWords(); toStart(words || prefill); };
  const toAdopt = (symbol) => {
    setPreselect(symbol);
    sr.resetSave();
    setAdoptEpoch((n) => n + 1);
    setView('adopt');
    if (current) sr.loadSession(current); // the preview is the GET's (spec §4.6): read fresh
  };
  const newInvestigation = () => {
    const kind = sr.inv?.session?.entry?.kind;
    const ref = sr.inv?.session?.entry?.itemRef;
    const again = kind === 'item' ? (stories ?? []).find((s) => s.itemRef?.recordId === ref?.recordId) ?? (item?.itemRef?.recordId === ref?.recordId ? item : null) : null;
    if (again) { pickStory(again); return; }
    toStart(kind === 'observation' ? observationTextOf(sr.inv?.session) : '');
  };
  // The earlier investigation is marked as such only once its read has answered; a read that fails or is not sent
  // leaves the screen as it was, with the failure said (review b6).
  const openEarlier = async (id) => { const returnTo = current; const answer = await sr.loadSession(id); if (answer?.ok) setEarlier({ returnTo }); };
  const backToCurrent = async () => { const to = earlier?.returnTo; if (!to) return; const answer = await sr.loadSession(to); if (answer?.ok) setEarlier(null); };

  let body;
  if (view === 'item' && story) {
    body = <ItemPreview key={story.itemRef?.recordId} sr={sr} story={story} direction={direction} gated={sr.gated} phone={phone} onBack={() => toStart()} onClose={onClose} />;
  } else if (view === 'drop' && drop) {
    body = <DropPreview key={drop.dropId} sr={sr} drop={drop} gated={sr.gated} phone={phone} onBack={() => toStart()} onClose={onClose} />;
  } else if (view === 'framing' && sr.frameState) {
    body = <Framing sr={sr} phone={phone} onEditWords={editWords} onClose={onClose} />;
  } else if (view === 'adopt') {
    body = sr.inv?.adoptPreview || ['saved', 'recovered'].includes(sr.save.status) || sr.pending?.kind !== 'read'
      ? <Adopt key={adoptEpoch} sr={sr} agentName={name} agentId={agentId} equippedListLabel={equippedListLabel} preselect={preselect} phone={phone} onBack={() => setView('work')} onClose={onClose} />
      : <Running>{COPY.opening}</Running>;
  } else if (view === 'discard' && sr.inv?.record) {
    body = <Discard sr={sr} phone={phone} onBack={() => setView('work')} onDone={() => setView('work')} />;
  } else if (view === 'work' && sr.inv?.record) {
    body = sr.existing
      ? <ExistingContinue sr={sr} phone={phone} onClose={onClose} />
      : (
        <Work sr={sr} agentName={name} phone={phone} viewingEarlier={earlier !== null} onBackToCurrent={backToCurrent} onOpenEarlier={openEarlier}
          onAdopt={toAdopt} onDiscard={() => setView('discard')} onNewInvestigation={newInvestigation} onClose={onClose} />
      );
  } else if (view === 'work' && sr.inv?.session && !sr.inv.record) {
    // A framing that never finished (no record yet): the words go back to the box.
    body = (
      <div style={S.col}>
        <Notice role="status" tone="gold">{COPY.framingUnfinished}</Notice>
        <div><LinkButton onClick={() => toStart(observationTextOf(sr.inv.session))}>{COPY.editWords}</LinkButton></div>
      </div>
    );
  } else if (view === 'work') {
    const failed = sr.failure?.action === 'read';
    body = failed
      ? (
        <div style={S.col}>
          <Notice role="alert">{sr.failure.code === 'network' ? COPY.loadFailed : sr.failure.message}</Notice>
          <div style={S.actions}>
            {sr.failure.code !== 'disabled' && <LinkButton disabled={sr.pending !== null || sr.waiting} onClick={() => sr.loadSession(sr.failure.sessionId)}>{COPY.retry}</LinkButton>}
            <LinkButton onClick={() => toStart()}>{COPY.backStart}</LinkButton>
          </div>
        </div>
      )
      : <Running>{COPY.opening}</Running>;
  } else {
    body = (
      <Start sr={sr} stories={stories} gated={sr.gated} phone={phone} prefill={prefill} onPickStory={pickStory} onFrame={frame}
        onUseDrop={openDropModal} onContinue={(id) => sr.loadSession(id)} onClose={onClose} />
    );
  }

  return (
    <div ref={rootRef} tabIndex={-1} data-shared-research-body="" style={{ minWidth: 0, outline: 'none' }}>
      {body}
      {!sr.gated && (
        <SignalDropEntry open={dropOpen} onClose={closeDropModal} onStartDialogue={onDropResult} ctaLabel={COPY.investigateCta} zIndex={SR_DROP_LAYER} />
      )}
    </div>
  );
}
