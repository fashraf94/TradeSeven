// src/components/CommandCenter/__fixtures__/legacySheetStubs.jsx
//
// Command Center hub, slice S5 — stand-ins for the four SHIPPED sheets the
// Loadout opens (AgentRecordSheet, ArchetypePicker, EquipSheet, TraitsSheet),
// for TESTS ONLY. The sheets are reused unchanged and have their own suites;
// what the hub's rows need to see is which sheet opened and what it was handed.
// Each stub records the props it last rendered with, draws a plain marked box
// while `open`, and the watchlist stub draws what EquipSheet draws — the rows,
// the loading line, the children and the footer — so a row can click them.
// The box claims no dialog semantics: the real sheets' role, label, focus and
// Escape are theirs to show, on the real sheets (the S8 review's S8-8, ruling
// R-S8F-6; CommandCenterHub.realSheets.jsdom.test.jsx). A stub that claimed
// role="dialog" let no hub row see that the real ones had none.
// Nothing in the hub's import graph reaches this file (the mount guard's
// fixtures fence).

import React, { useState } from 'react';

export const seen = { record: null, archetype: null, equip: null, traits: null, traitsMounts: 0 };

export function resetSeen() {
  seen.record = null;
  seen.archetype = null;
  seen.equip = null;
  seen.traits = null;
  seen.traitsMounts = 0;
}

const dialog = (name, props, children = null) => (
  props.open
    ? <div data-stub={name} data-dock={props.dock} data-accent={props.accent}>{children}</div>
    : null
);

export function AgentRecordSheetStub(props) {
  seen.record = props;
  return dialog('record', props);
}

export function ArchetypePickerStub(props) {
  seen.archetype = props;
  return dialog('archetype', props);
}

export function TraitsSheetStub(props) {
  seen.traits = props;
  // A mount counter without an effect: the initializer runs once per mount.
  useState(() => { seen.traitsMounts += 1; return null; });
  return dialog('traits', props);
}

export function EquipSheetStub(props) {
  seen.equip = props;
  const { loading, rows = [], children, footer, title, subtitle, emptyLabel } = props;
  return dialog('equip', props, (
    <>
      <h2>{title}</h2>
      <p data-stub-subtitle="">{subtitle}</p>
      {children != null ? children : loading ? <p data-stub-loading="">loading</p> : rows.length === 0 ? <p>{emptyLabel}</p> : rows.map((row) => (
        <button key={row.id} type="button" data-row={row.id} data-selected={row.selected ? '' : undefined} disabled={row.disabled} onClick={row.onClick}>{row.title}</button>
      ))}
      {rows.map((row) => <span key={`s-${row.id}`} data-row-sub={row.id}>{row.subtitle}</span>)}
      <div data-stub-footer="">{footer}</div>
    </>
  ));
}
