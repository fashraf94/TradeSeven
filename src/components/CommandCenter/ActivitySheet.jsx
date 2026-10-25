// src/components/CommandCenter/ActivitySheet.jsx
//
// Command Center hub, slice S4 (ruling R-S4-1; spec V1.2 §8.2) — the activity
// sheet behind "All activity · N": the whole projection, in the same rows as the
// section. It is the History sheet's twin: the hub's own HubSheet, which
// registers with the hub's overlay stack when it mounts (S5, ruling R-S5-6), so
// the background stays inert and focus returns where it came from.
//
// It adds no read and no source. Its rows are the section's rows, so opening it
// changes neither them nor their count (a sheet is presentation, never a trigger).

import React from 'react';
import { readyRows } from './hub/hubModel';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { C } from './hub/hubStyle';
import HubSheet from './HubSheet';
import { ActivityAgeNote, ActivityRows } from './sections/ActivitySection';

export default function ActivitySheet({ activity, phone, onClose, opener, fallbackFocus, reducedMotion, onOpen }) {
  const ready = activity?.status === 'ready';
  const rows = readyRows(activity);
  return (
    <HubSheet
      phone={phone}
      onClose={onClose}
      opener={opener}
      fallbackFocus={fallbackFocus}
      reducedMotion={reducedMotion}
      eyebrow={ready ? COPY.activity.sheetEyebrow(rows.length) : COPY.activity.sheetLabel}
      title={COPY.activity.sheetTitle}
      label={COPY.activity.sheetLabel}
    >
      <div style={{ marginBottom: 10, fontSize: 12.5, color: C.ink3, lineHeight: 1.45 }}>{COPY.activity.label}</div>
      <ActivityAgeNote activity={activity} style={{ marginBottom: 10 }} />
      {ready && rows.length > 0 && <ActivityRows items={rows} onOpen={onOpen} />}
      {ready && rows.length === 0 && <div style={{ fontSize: 13, color: C.ink3 }}>{COPY.activity.empty}</div>}
      {!ready && <div style={{ fontSize: 13, color: C.ink2 }}>{activity?.status === 'error' ? COPY.activity.unavailable : COPY.activity.loading}</div>}
    </HubSheet>
  );
}
