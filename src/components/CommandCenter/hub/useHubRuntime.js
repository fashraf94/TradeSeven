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
//   hub.setSidebarOpen    App's drawer opener, for the phone header's menu button (founder ruling Q-S5-1)
//   hub.unreadCount       App's unread-notification count, for that button's badge
//   hub.onOpenForge       App's Forge bridge ({ area, watchlistId, returnTo }). Call it from a
//                         mounted hub's gesture handler: the hub is unmounted while the Forge
//                         shows, and App does not guard a call made while the Forge is already
//                         open (the area it names would be read at the NEXT open). Of the
//                         request only `area` is read; a `watchlistId` alone means the Lists
//                         area (the Forge cannot open on a particular list) and `returnTo` is
//                         not read at all, so no label may promise either.
//   hub.ideaAccess        optional: 'admitted' | 'not_admitted' | 'unknown' (hub/selectors/loadout.js
//                         IDEA_ACCESS). App passes none in S5, so it is 'unknown' and the watchlist card
//                         reads the neutral "N names" for everyone (founder ruling Q-S5-4a); slice S6 supplies
//                         the server's answer from its gated reader. Anything else reads as 'unknown'.
//
// With no `hub` (a test of the frames, the S1 fixtures) nothing here reads or
// derives anything: the sections pass through untouched and every S5 action is
// absent, so its control is disabled or not drawn — exactly the S1 behaviour.
//
// Entry points, each opening the shipped destination (spec §2):
//   header account button  -> setScreen('profile')
//   header menu (phone)    -> setSidebarOpen(true): App's drawer (Battle History, Notifications, Rules, Logout)
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
import { deriveCareer, deriveLoadout, ideaAccessOf, LOADOUT_STATUS } from './selectors/loadout';
import { useHubLoadout } from './useHubLoadout';
import { HUB_SHEETS, useHubSheets } from './useHubSheets';

/** The menu badge's number: a positive safe integer as given, else none (an absent or malformed count draws no badge). */
export function unreadCountOf(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

/** The bug report: the widget stays mounted over the hub and opens on this event (ClashBotWidget.jsx). */
export function reportBug() {
  window.dispatchEvent(new Event(CLASHBOT_OPEN_EVENT));
}

export function useHubRuntime({ hub, sections, rootRef }) {
  const live = hub != null;
  const agent = live ? hub.agent ?? null : null;
  const agentLoading = live && hub.agentLoading === true;
  // Lists read for another account never show (hub/useHubLoadout.js ownerKey); an equip made elsewhere to a list
  // this hub has not read is read for once (equippedId).
  const lists = useHubLoadout({
    enabled: live && Boolean(agent),
    ownerKey: agent?.ownerId ?? agent?.id ?? null,
    equippedId: agent?.equippedWatchlistId || null,
  });
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
      listsReadFor: lists.readFor,
      activeAgentBattles: hub.activeAgentBattles,
      ...hubFlags(),
      ideaAccess: ideaAccessOf(hub.ideaAccess),
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
    openMenu: live && typeof hub.setSidebarOpen === 'function' ? () => hub.setSidebarOpen(true) : undefined,
    reportBug: live ? reportBug : undefined,
  };

  const unreadCount = live ? unreadCountOf(hub.unreadCount) : 0;

  return { live, sections: merged, actions, sheets, closeSheet, lists, agent, agentLoading, modalOpen, unreadCount };
}
