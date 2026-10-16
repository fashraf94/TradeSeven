// src/components/CommandCenter/PhoneTabs.jsx
//
// Command Center hub, slice S1 — the phone's sticky section tabs and their
// panel (the design's MobileTabs4, MobileSection and MobileOverview,
// ff-mobile.jsx; spec V1.2 §1, §10). Four tabs in the design's order and
// words — Overview · Research · Partnership · Loadout — as a tablist with a
// roving tab stop and Arrow / Home / End; one tabpanel shows the selected
// section. The phone opens on Overview.
//
// The tab row sticks to the top of the hub's own scroll area (the hub owns a
// full-height scroll pane on the phone: App's dashboard container clips
// overflow-x, which would otherwise make it the sticky container and let the
// row scroll away).

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { motionToken } from '../../theme/motion';
import { AREA_FOR_PHONE_TAB, HUB_AREAS, PHONE_TAB_ORDER, PHONE_TABS, rovingIndex } from './hub/composition';
import { PHONE_ACTIVITY_LIMIT, splitGames } from './hub/hubModel';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { C, HAIR } from './hub/hubStyle';
import { EmptyNote, Label, LoadingLine, Mono, Row, Section } from './HubParts';
import { AreaBody, AreaHeading } from './panels/AreaPanel';
import ActivitySection from './sections/ActivitySection';
import BriefSection from './sections/BriefSection';
import { GameRow } from './sections/GamesSection';
import NextActionCard from './sections/NextActionCard';

export const phoneTabId = (idBase, tab) => `${idBase}-tab-${tab}`;
export const phonePanelId = (idBase) => `${idBase}-tab-panel`;

export function PhoneTabRow({ idBase, tab, onSelect }) {
  const refs = useRef([]);
  const onKeyDown = (event) => {
    // A modified arrow belongs to the browser (Alt+Left is Back): S1 review L3-9.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = rovingIndex(event.key, PHONE_TAB_ORDER.indexOf(tab), PHONE_TAB_ORDER.length);
    if (next == null) return;
    event.preventDefault();
    onSelect(PHONE_TAB_ORDER[next]);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={COPY.phoneTabs.listLabel}
      onKeyDown={onKeyDown}
      data-hub-phone-tabs=""
      style={{ position: 'sticky', top: 0, zIndex: 3, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', padding: '4px 10px 0', background: C.bg, borderBottom: `1px solid ${HAIR}` }}
    >
      {PHONE_TAB_ORDER.map((key, i) => {
        const on = tab === key;
        const bar = AREA_FOR_PHONE_TAB[key] === HUB_AREAS.ARCHETYPE ? C.gold : C.teal;
        return (
          <button
            key={key}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={phoneTabId(idBase, key)}
            aria-selected={on}
            aria-controls={phonePanelId(idBase)}
            tabIndex={on ? 0 : -1}
            data-hub-phone-tab={key}
            onClick={() => onSelect(key)}
            style={{ appearance: 'none', font: 'inherit', background: 'transparent', border: 'none', cursor: 'pointer', minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', fontSize: 12.5, fontWeight: 600, color: on ? C.ink : C.ink2, padding: 0, whiteSpace: 'nowrap', borderRadius: 8 }}
          >
            <Label size={12.5} weight={600}>{COPY.phoneTabs[key]}</Label>
            {on && <span aria-hidden="true" style={{ position: 'absolute', left: 6, right: 6, bottom: 0, height: 3, borderRadius: 2, background: bar }} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Overview: the live game (as the next action when it is the candidate), the
 * next action, ready reviews (without the next action's own game), the
 * history entry, a short activity list and the brief, collapsed. With games
 * resolved and empty and no candidate, the design's empty note. In S1
 * everything but the frame is loading.
 */
function PhoneOverview({ sections, actions }) {
  const { games, nextAction, deploy, activity, brief, career } = sections;
  const ready = games?.status === 'ready';
  const { live, completed } = splitGames(games);
  const candidate = nextAction?.status === 'ready' ? nextAction.candidate : null;
  const liveGame = live[0] || null;
  const liveIsCandidate = Boolean(liveGame && candidate?.key === 'openGame');
  // The next action's own game is not listed again (ff-mobile.jsx MobileOverview; S1 review L1-2).
  const reviews = completed.filter((g) => g.review && g.id !== candidate?.id);
  const record = career?.status === 'ready' && career.record ? career.record : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {!ready && <LoadingLine>{COPY.games.loading}</LoadingLine>}
      {ready && !liveGame && !candidate && completed.length === 0 && <EmptyNote icon="sword" title={COPY.games.empty} sub={COPY.games.emptySubPhone} />}
      {liveIsCandidate && <NextActionCard nextAction={nextAction} deploy={deploy} onAct={actions.nextAction} onLater={actions.laterNextAction} />}
      {liveGame && !liveIsCandidate && <GameRow game={liveGame} onOpen={actions.openGame} />}
      {candidate && !liveIsCandidate && <NextActionCard nextAction={nextAction} deploy={deploy} onAct={actions.nextAction} onLater={actions.laterNextAction} />}
      {reviews.length > 0 && (
        <Section label={COPY.games.reviewsAvailable}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reviews.map((g) => <GameRow key={g.id} game={g} onOpen={actions.openGame} />)}
          </div>
        </Section>
      )}
      {completed.length > 0 && (
        <Row
          onPress={actions.openHistory}
          ariaLabel={COPY.history.rowLabel(completed.length)}
          style={{ background: C.surface, border: `1px solid ${HAIR}`, minHeight: 56 }}
          right={record ? <Mono style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{record}</Mono> : null}
        >
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.ink }}>{COPY.history.rowTitle}</span>
          <span style={{ display: 'block', fontSize: 12, color: C.ink3, marginTop: 2 }}>{COPY.history.rowSub(completed.length)}</span>
        </Row>
      )}
      <ActivitySection activity={activity} limit={PHONE_ACTIVITY_LIMIT} onOpen={actions.openActivity} onAll={actions.openAllActivity} />
      <BriefSection brief={brief} />
    </div>
  );
}

export function PhonePanel({ idBase, tab, sections, actions, reducedMotion }) {
  const area = AREA_FOR_PHONE_TAB[tab];
  const label = tab === PHONE_TABS.LOADOUT ? COPY.phoneTabs.loadout : area == null ? null : COPY.areas.names[area];
  return (
    // tabIndex 0: in S1 a panel may hold no enabled control, and Tab must still reach its content (S1 review L3-4).
    <div role="tabpanel" tabIndex={0} id={phonePanelId(idBase)} aria-labelledby={phoneTabId(idBase, tab)} data-hub-phone-panel={tab}>
      <motion.div key={tab} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={motionToken('smooth', { reducedMotion })}>
        {area == null ? (
          <PhoneOverview sections={sections} actions={actions} />
        ) : (
          <>
            <div style={{ marginBottom: 14 }}><AreaHeading area={area} label={label} size={18} gap={9} /></div>
            <AreaBody area={area} sections={sections} actions={actions} />
          </>
        )}
      </motion.div>
    </div>
  );
}
