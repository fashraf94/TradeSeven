// src/components/CommandCenter/hub/useHubSheets.js
//
// Command Center hub, slice S5 — the hub's open sheet (S1's `useHubSheet`,
// grown for the legacy sheets). One sheet is open at a time per shell:
//
//   'history'     the hub's own HubSheet, which registers itself with the
//                 overlay stack when it mounts;
//   'activity'    the same, for "All activity · N" (slice S4);
//   'record' 'archetype' 'watchlist' 'traits'
//                 the shipped sheets (AgentRecordSheet, ArchetypePicker,
//                 EquipSheet, TraitsSheet), reused unchanged. They manage
//                 neither inertness nor focus, so THIS hook registers them with
//                 the stack — in the click handler that opens them — and
//                 releases them on close and on unmount. It registers them
//                 `within` the hub: only the app root the hub sits in goes inert,
//                 never "every child of <body>". The sheets portal into <body> and
//                 keep their DOM there while they animate out; re-opened inside
//                 that window a sheet re-uses that node, and marking every body
//                 child would mark the very sheet being opened (review E3-1).
//
// `open(kind)` is a click handler. It keeps the control that was clicked, so
// focus returns there when the sheet closes (Safari does not focus a clicked
// button), with the hub root as the fallback if that control is gone by then
// (S1 review L3-3).
//
// The traits sheet is mounted fresh on every open: `traitsEpoch` is bumped at
// each open and used as its React key, exactly as EquipStation and
// desktop/EquipBench do. LOAD-BEARING there — half of TraitsSheet's
// orphan-cleanup safety invariant is a per-open remount — and the hub keeps it.

import { useEffect, useRef, useState } from 'react';
import { useHubOverlays } from './HubOverlays';
import { AGENT_FORM_ARMORY_ENABLED } from '../../../config/agentFormFlags';

export const HUB_SHEETS = Object.freeze({
  HISTORY: 'history',
  ACTIVITY: 'activity',
  RECORD: 'record',
  ARCHETYPE: 'archetype',
  WATCHLIST: 'watchlist',
  TRAITS: 'traits',
  // Slice S2b (ruling R-S2b-7): the Scouting Board, the shipped EquipSheet wrapper — registered `within`, like the
  // four shipped sheets above (S5 §13: it repeats the exit-animation defect otherwise).
  SCOUTING: 'scouting',
  // Huddle S1 (Huddle C §C8; Command Center Amendment D §D3): the Huddle sheet, a HubSheet, which registers itself.
  HUDDLE: 'huddle',
});

const LEGACY = new Set([HUB_SHEETS.RECORD, HUB_SHEETS.ARCHETYPE, HUB_SHEETS.WATCHLIST, HUB_SHEETS.TRAITS, HUB_SHEETS.SCOUTING]);

export function useHubSheets(rootRef) {
  const stack = useHubOverlays();
  const [sheet, setSheet] = useState(null);
  const [traitsEpoch, setTraitsEpoch] = useState(0);
  const openerRef = useRef(null);
  const heldRef = useRef(null);

  const release = (focus) => {
    if (!heldRef.current) return;
    stack.close(heldRef.current, { fallback: rootRef.current, focus });
    heldRef.current = null;
  };

  // The hub going away (the Forge opened, a site flip) frees the background and moves no focus: the provider
  // (hub/HubOverlays.jsx) hands it to the new hub's shell if focus fell to <body>.
  useEffect(() => () => { release(false); }, []);

  return {
    sheet,
    traitsEpoch,
    open: (kind) => (event) => {
      const opener = event?.currentTarget ?? null;
      openerRef.current = opener;
      release(false);
      // Agent form build A1: with the armory on, the archetype sheet is not a shipped sheet. The wide dialog is a HubSheet,
      // which registers itself; the phone's armory is the hero's own box, inside the hub, so it is no overlay at all.
      if (AGENT_FORM_ARMORY_ENABLED ? kind !== HUB_SHEETS.ARCHETYPE && LEGACY.has(kind) : LEGACY.has(kind)) {
        heldRef.current = `legacy:${kind}`;
        stack.open(heldRef.current, { opener, within: rootRef.current });
      }
      if (kind === HUB_SHEETS.TRAITS) setTraitsEpoch((epoch) => epoch + 1);
      setSheet(kind);
    },
    close: () => {
      release(true);
      setSheet(null);
    },
    opener: openerRef.current,
    fallback: rootRef.current,
  };
}
