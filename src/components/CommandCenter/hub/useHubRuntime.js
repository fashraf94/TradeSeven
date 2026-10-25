// src/components/CommandCenter/hub/useHubRuntime.js
//
// Command Center hub, slice S5 — what App hands the hub, turned into the
// sections and the actions the shells render (ruling R-S5-9: App's data and
// actions arrive through ONE `hub` prop object; S3 adds its keys to it).
//
// The agent is not on `hub` (the S3 merge with S5). It is `agentRead`, the hub's
// own owner-tagged read (hub/useHubReaders.js, selectors/readerInputs.js
// loadoutAgentOf), the same read the deploy state takes: { status, agent, retry },
// the document only when the read is ready and this identity's. A failed read is
// the Loadout's "Agent unavailable · Retry"; a ready read with no document is
// absence, "Create your agent first" (S5 report N-S5-6).
//
//   hub.activeBattles     the active poll's retained list (the one live-games key the gate reads),
//                         for the equip lock (the shells' own input)
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
//                         IDEA_ACCESS). App passes none, and the watchlist card reads the neutral "N names"
//                         unless the hub is told the player is admitted (founder ruling Q-S5-4a). Since slice S6
//                         (ruling R-S6-4) that answer comes from the hub's own idea reader (`researchRead`,
//                         hub/useHubResearch.js through hub/researchView.js researchAccessOf) whenever the reader
//                         holds one; this key stands only while it holds nothing (a frame, a suite with no
//                         reader). Anything else reads as 'unknown'.
//   researchRead          the idea reader's answer (slice S6): the Research section, "Deploying with", the idea
//                         labels and Activity's idea rows are derived from it here, with the Loadout's list.
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
import { activitySectionOf, ideaKnowledgeOf, loadoutKnowledgeOf } from './activityRows';
import { archetypeLines } from './archetypeLines';
import { hubFlags } from './hubFlags';
import { useHubModalOpen } from './HubOverlays';
import { loadoutLineOf } from './loadoutLine';
import { deployingWithOf, deriveResearch, ideaActivityOf, researchAccessOf } from './researchView';
import { deriveCareer, deriveLoadout, ideaAccessOf, IDEA_ACCESS, LOADOUT_STATUS, WATCHLIST_STATE } from './selectors/loadout';
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

export function useHubRuntime({ hub, agentRead = null, sections, rootRef, researchRead = null }) {
  const live = hub != null;
  const agent = live ? agentRead?.agent ?? null : null;
  // The read's own statuses ('loading' | 'ready' | 'error'); no read handed (a frame given `hub` alone) is a read
  // not yet answered.
  const agentStatus = agentRead?.status ?? 'loading';
  const agentLoading = live && agentStatus === 'loading';
  const agentFailed = live && agentStatus === 'error';
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
  let research = null;
  if (live) {
    const flags = hubFlags();
    // Slice S6 (ruling R-S6-4): whether the player is admitted to idea records comes from the idea reader (hub/useHubResearch.js)
    // once it holds an answer for this owner and list. `hub.ideaAccess` — S5's input, which App never sets — stands only
    // while the reader holds nothing (no reader, or none yet).
    const readerAccess = researchAccessOf(researchRead);
    const ideaAccess = readerAccess !== IDEA_ACCESS.UNKNOWN ? readerAccess : ideaAccessOf(hub.ideaAccess);
    const loadout = deriveLoadout({
      agent,
      agentLoading,
      agentFailed,
      archetype: archetypeLines(agent?.archetype),
      slots: getEquipSlots(agent),
      adjustments: getTraitSlotSummary(agent),
      committed: lists.committed,
      listsStatus: lists.status,
      listsReadFor: lists.readFor,
      activeAgentBattles: hub.activeBattles,
      ...flags,
      ideaAccess,
    });
    // The equipped list's own document (its `thesis` decides the honest line), once the lists have it among the committed ones.
    const listId = loadout.status === LOADOUT_STATUS.READY ? loadout.watchlist?.id : null;
    const listDoc = listId ? lists.committed.find((list) => list?.watchlistId === listId) ?? null : null;
    research = researchRead ? deriveResearch({ read: researchRead, loadout, listDoc }) : null;
    const watchlistCard = loadout.status === LOADOUT_STATUS.READY ? loadout.watchlist : null;
    merged = {
      ...sections,
      loadout: loadout.status === LOADOUT_STATUS.READY ? { ...loadout, summary: loadoutLineOf(loadout) } : loadout,
      career: deriveCareer({ agent, agentLoading }),
      // Slice S6: the Research panel's section and the Deploy card's idea line, both from the one held answer (hub/researchView.js).
      // With no reader (a frame, a suite that stands one in) the sections are what they were handed.
      ...(research ? { research, deployingWith: deployingWithOf({ read: researchRead, watchlist: watchlistCard }) } : null),
      // Slice S4 (R-S4-1): Activity's loadout rows are the Loadout's own — the equipped list as the card resolved it (found among the
      // committed lists, under the name the card shows), the archetype's name — so the list and the card cannot disagree
      // (BUILD_RULES §9), and an empty list is not "nothing recorded" while the loadout is still unknown.
      ...(sections.activityInputs ? {
        activity: activitySectionOf({
          ...sections.activityInputs,
          agent,
          watchlist: loadout.status === LOADOUT_STATUS.READY && loadout.watchlist?.state === WATCHLIST_STATE.READY
            ? { id: loadout.watchlist.id, name: loadout.watchlist.name }
            : null,
          archetypeName: loadout.status === LOADOUT_STATUS.READY ? loadout.archetype?.name ?? null : null,
          characterTab: flags.characterTab,
          // Slice S6: the current idea's two rows, and the reader joined to what is still unknown (H-4: "Nothing recorded yet" waits).
          idea: researchRead ? ideaActivityOf({ read: researchRead, watchlist: watchlistCard }) : null,
          knowledge: loadoutKnowledgeOf(loadout, ideaKnowledgeOf(research)),
        }),
      } : null),
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
    // Slice S6 (ruling R-S6-2): the return from the watchlist sheet also reads the idea once more, even when the equipped id is unchanged.
    if (was === HUB_SHEETS.WATCHLIST) {
      lists.refresh();
      researchRead?.invalidate?.();
    }
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
    // Slice S6: the Research panel's Forge action opens the Lists area, where the idea is kept (the Forge cannot open on a particular
    // list, so no label promises one), and its Retry is the reader's — or the agent's own, while the agent's read is what failed.
    openResearchForge: forgeDoor({ area: FORGE_AREAS.LISTS, returnTo: FORGE_RETURN.DASHBOARD }),
    retryResearch: !live || !researchRead ? undefined
      : loadout?.status === LOADOUT_STATUS.ERROR ? (typeof agentRead?.retry === 'function' ? agentRead.retry : undefined)
        : researchRead.retry,
    // The agent read's own Retry, offered only by its error state (S5 report N-S5-6).
    retryAgent: live && loadout?.status === LOADOUT_STATUS.ERROR && typeof agentRead?.retry === 'function' ? agentRead.retry : undefined,
    openProfile: live && typeof hub.setScreen === 'function' ? () => hub.setScreen('profile') : undefined,
    openMenu: live && typeof hub.setSidebarOpen === 'function' ? () => hub.setSidebarOpen(true) : undefined,
    reportBug: live ? reportBug : undefined,
  };

  const unreadCount = live ? unreadCountOf(hub.unreadCount) : 0;

  return { live, sections: merged, actions, sheets, closeSheet, lists, agent, agentLoading, modalOpen, unreadCount };
}
