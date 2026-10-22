// src/components/CommandCenter/hub/useHubRuntime.js
//
// Command Center hub, slice S5 — what App hands the hub, turned into the
// sections and the actions the shells render (ruling R-S5-9: App's data and
// actions arrive through ONE `hub` prop object; S3 adds its keys to it).
//
//   hub.agent             the ranked agent doc — App's useAgent legacy `agent`
//   hub.agentLoading      that hook's legacy `loading`
//   hub.activeAgentBattles the active-battle poll, for the equip lock (the shells' own input)
//   hub.setScreen         App's navigation, for the profile
//   hub.onOpenForge       App's Forge bridge ({ area, watchlistId, returnTo })
//
// With no `hub` (a test of the frames, the S1 fixtures) nothing here reads or
// derives anything: the sections pass through untouched and every S5 action is
// absent, so its control is disabled or not drawn — exactly the S1 behaviour.
//
// Entry points, each opening the shipped destination (spec §2):
//   header account button  -> setScreen('profile')
//   identity               -> AgentRecordSheet
//   archetype              -> ArchetypePicker
//   watchlist              -> EquipSheet (the quick sheet), and the Forge's Lists area
//   adjustments            -> TraitsSheet (where the shells have the slot), and the Forge's traits area
//   "Report a bug"         -> the ClashBot widget's own open event
// The pickers are absent (so disabled) while the loadout is locked in a live
// game; the Forge doors stay: the Forge browses and builds, and the game keeps
// the loadout it was deployed with.

import { CLASHBOT_OPEN_EVENT } from '../../ClashBot/ClashBotWidget';
import { getEquipSlots } from '../../../utils/equipSlots';
import { getTraitSlotSummary } from '../../../utils/traitSlotSummary';
import { FORGE_AREAS, FORGE_RETURN } from '../hubChrome';
import { archetypeLines } from './archetypeLines';
import { hubFlags } from './hubFlags';
import { useHubModalOpen } from './HubOverlays';
import { loadoutLineOf } from './loadoutLine';
import { deriveCareer, deriveLoadout, LOADOUT_STATUS } from './selectors/loadout';
import { useHubLoadout } from './useHubLoadout';
import { HUB_SHEETS, useHubSheets } from './useHubSheets';

/** The bug report: the widget stays mounted over the hub and opens on this event (ClashBotWidget.jsx). */
export function reportBug() {
  window.dispatchEvent(new Event(CLASHBOT_OPEN_EVENT));
}

export function useHubRuntime({ hub, sections, rootRef }) {
  const live = hub != null;
  const agent = live ? hub.agent ?? null : null;
  const agentLoading = live && hub.agentLoading === true;
  // The lists are the agent's OWNER'S: another owner's never show (hub/useHubLoadout.js ownerKey).
  const lists = useHubLoadout({ enabled: live && Boolean(agent), ownerKey: agent?.ownerId ?? agent?.id ?? null });
  const sheets = useHubSheets(rootRef);
  const modalOpen = useHubModalOpen();

  let merged = sections;
  if (live) {
    const loadout = deriveLoadout({
      agent,
      agentLoading,
      archetype: archetypeLines(agent?.archetype),
      slots: getEquipSlots(agent),
      adjustments: getTraitSlotSummary(agent),
      committed: lists.committed,
      listsStatus: lists.status,
      activeAgentBattles: hub.activeAgentBattles,
      ...hubFlags(),
    });
    merged = {
      ...sections,
      loadout: loadout.status === LOADOUT_STATUS.READY ? { ...loadout, summary: loadoutLineOf(loadout) } : loadout,
      career: deriveCareer({ agent, agentLoading }),
    };
  }

  const loadout = merged.loadout;
  const ready = live && loadout?.status === LOADOUT_STATUS.READY;
  const unlocked = ready && loadout.lockedInGame !== true;
  const canForge = live && typeof hub.onOpenForge === 'function';

  // The sheet closes and, for the watchlist sheet, the lists are read again (ruling R-S5-1: "after a return from a sheet").
  const closeSheet = () => {
    const was = sheets.sheet;
    sheets.close();
    if (was === HUB_SHEETS.WATCHLIST) lists.refresh();
  };
  const forgeDoor = (request) => (canForge ? () => { sheets.close(); hub.onOpenForge(request); } : undefined);

  const actions = {
    openRecord: ready ? sheets.open(HUB_SHEETS.RECORD) : undefined,
    changeArchetype: unlocked ? sheets.open(HUB_SHEETS.ARCHETYPE) : undefined,
    changeWatchlist: unlocked ? sheets.open(HUB_SHEETS.WATCHLIST) : undefined,
    changeAdjustments: unlocked && loadout.adjustments ? sheets.open(HUB_SHEETS.TRAITS) : undefined,
    // No target: the Forge as it opens today (App's bare `setShowForge(true)`).
    openLoadoutForge: ready ? forgeDoor({ returnTo: FORGE_RETURN.DASHBOARD }) : undefined,
    openForgeLists: ready ? forgeDoor({ area: FORGE_AREAS.LISTS, returnTo: FORGE_RETURN.DASHBOARD }) : undefined,
    openForgeCharacter: ready && loadout.adjustments ? forgeDoor({ area: FORGE_AREAS.CHARACTER, returnTo: FORGE_RETURN.DASHBOARD }) : undefined,
    retryLists: ready ? lists.retry : undefined,
    openProfile: live && typeof hub.setScreen === 'function' ? () => hub.setScreen('profile') : undefined,
    reportBug: live ? reportBug : undefined,
  };

  return { live, sections: merged, actions, sheets, closeSheet, lists, agent, agentLoading, modalOpen };
}
