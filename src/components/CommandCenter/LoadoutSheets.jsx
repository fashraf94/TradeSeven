// src/components/CommandCenter/LoadoutSheets.jsx
//
// Command Center hub, slice S5 — the shipped sheets the Loadout's entry points
// open (spec V1.2 §2: "Retained entry points"; ruling R-S5-4): the agent
// record (AgentRecordSheet), the archetype picker (ArchetypePicker), the
// watchlist sheet (EquipSheet) and the traits sheet (TraitsSheet). They are
// reused UNCHANGED — their writes (changeArchetype, equip / unequip a
// watchlist, the trait writes) are today's approved writes — and take the same
// props the shells hand them. The hub registers each with its overlay stack
// when it opens one (hub/useHubSheets.js), because they manage neither
// inertness nor focus.
//
// The watchlist rows and the equip handler are EquipStation's / EquipBench's
// own, step for step (and, as theirs does, the sheet takes the fixed teal, not the
// player's colour): a "No watchlist" row, one row per committed list,
// `equipWatchlist` / `unequipWatchlist` from agentService, a failure logged
// and the sheet closed either way. (The shells swallow an equip failure; so
// does this, to be exactly their write path.) The footer's Forge door opens
// the Forge on its Lists area.
//
// Mounted like the shells mount them: the sheets stay mounted between opens
// so their exit animation plays, except the traits sheet, which is keyed by
// `traitsEpoch` so it remounts on every open (its orphan-cleanup invariant).

import React, { useState } from 'react';
import { equipWatchlist, unequipWatchlist } from '../../services/agentService';
import { getLevelConfig, getNextLevelInfo } from '../../constants/agentProgression';
import useMasteryProfile from '../../hooks/useMasteryProfile';
import { readToken } from '../../theme/cssTokens';
import AgentRecordSheet from '../Dashboard/AgentRecordSheet';
import ArchetypePicker from '../Dashboard/ArchetypePicker';
import EquipSheet from '../Dashboard/EquipSheet';
import TraitsSheet from '../Dashboard/TraitsSheet';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { HUB_SHEETS } from './hub/useHubSheets';
import { LISTS_STATUS, symbolsOf } from './hub/selectors/loadout';
import { HubButton } from './HubParts';

/** The shipped sheets' two docks: the phone's bottom sheet, and the wide site's centred dialog. */
export const SHEET_DOCK = Object.freeze({ PHONE: 'bottom', WIDE: 'center' });

/**
 * The accent the shells hand their sheets: the player's own colour, else the first avatar colour, else the
 * teal token as a computed hex (the sheets parse hex; a var() reference would silently drop — BUILD_RULES §10).
 */
export function accentOf(agent) {
  return agent?.primaryColor || agent?.avatarColors?.[0] || readToken('teal');
}

function RecordSheet({ open, onClose, dock, agent, agentLoading, accent }) {
  // The shells call this at their root: zero reads and null while the mastery surface is dark.
  const masteryProfile = useMasteryProfile(agent?.ownerId || null);
  const gamesPlayed = agent?.stats?.gamesPlayed || 0;
  return (
    <AgentRecordSheet
      open={open}
      onClose={onClose}
      agent={agent}
      loading={agentLoading}
      accent={accent}
      levelConfig={getLevelConfig(gamesPlayed)}
      nextLevelInfo={getNextLevelInfo(gamesPlayed)}
      masteryProfile={masteryProfile}
      dock={dock}
    />
  );
}

function WatchlistSheet({ open, onClose, dock, agent, lists, onOpenForgeLists }) {
  const [working, setWorking] = useState(false);
  const equippedId = agent?.equippedWatchlistId || null;

  const equip = async (watchlistId) => {
    if (!agent?.id || working) return;
    setWorking(true);
    try {
      if (watchlistId) await equipWatchlist(agent.id, watchlistId);
      else await unequipWatchlist(agent.id);
    } catch (error) {
      console.error('[CommandCenterHub] watchlist equip/unequip failed:', error);
    } finally {
      setWorking(false);
      onClose();
    }
  };

  const rows = [
    { id: '__none__', title: COPY.watchlistSheet.none, subtitle: COPY.watchlistSheet.noneSub, selected: !equippedId, disabled: working, onClick: () => equip(null) },
    ...lists.committed.map((list) => ({
      id: list.watchlistId,
      title: list.name || COPY.watchlistSheet.untitled,
      subtitle: COPY.watchlistSheet.tickers(symbolsOf(list).length),
      selected: list.watchlistId === equippedId,
      disabled: working,
      onClick: () => equip(list.watchlistId),
    })),
  ];
  // A failed read is not an empty list: say so, and offer the retry, instead of showing "No watchlist" alone.
  const failed = lists.status === LISTS_STATUS.ERROR;

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      dock={dock}
      title={COPY.watchlistSheet.title}
      subtitle={COPY.watchlistSheet.subtitle}
      loading={lists.status === LISTS_STATUS.LOADING}
      rows={rows}
      emptyLabel={COPY.watchlistSheet.empty}
      footer={<HubButton kind="accent" full onPress={onOpenForgeLists}>{COPY.watchlistSheet.createInForge}</HubButton>}
      accent={readToken('teal')}
    >
      {failed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', padding: '14px 4px' }}>
          <span>{COPY.loadout.listsError}</span>
          <HubButton small onPress={lists.retry}>{COPY.loadout.retry}</HubButton>
        </div>
      ) : null}
    </EquipSheet>
  );
}

/**
 * @param {string|null} props.sheet       the open sheet (hub/useHubSheets.js HUB_SHEETS), or null
 * @param {number}      props.traitsEpoch bumped at every traits open; the traits sheet's key
 * @param {'bottom'|'center'} props.dock  the phone's bottom sheet, or the wide site's centred dialog
 * @param {{ status: string, committed: Array, retry: Function }} props.lists  hub/useHubLoadout.js
 */
export default function LoadoutSheets({ sheet, traitsEpoch, onClose, dock, agent, agentLoading, lists, onOpenForgeLists }) {
  const accent = accentOf(agent);
  return (
    <>
      <RecordSheet open={sheet === HUB_SHEETS.RECORD} onClose={onClose} dock={dock} agent={agent} agentLoading={agentLoading} accent={accent} />
      <ArchetypePicker open={sheet === HUB_SHEETS.ARCHETYPE} onClose={onClose} agent={agent} accent={accent} dock={dock} />
      <WatchlistSheet
        open={sheet === HUB_SHEETS.WATCHLIST}
        onClose={onClose}
        dock={dock}
        agent={agent}
        lists={lists}
        onOpenForgeLists={onOpenForgeLists}
      />
      {traitsEpoch > 0 && (
        <TraitsSheet key={traitsEpoch} open={sheet === HUB_SHEETS.TRAITS} onClose={onClose} agent={agent} accent={accent} dock={dock} />
      )}
    </>
  );
}
