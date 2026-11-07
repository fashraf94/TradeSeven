// src/components/CommandCenter/HuddleSheet.jsx
//
// Huddle S1 — THE HUDDLE SHEET (Huddle spec Amendment C V1.2 §C8; Command Center spec V1.2
// Amendment D §D3): a HubSheet on the hub's overlay stack (the background inert, focus to
// Close, Escape, focus return — all the HubSheet's). Its body, which holds the <audio>
// element, its listeners and the playback-token call, is src/components/Huddle/
// HuddleSheetBody.jsx: outside this directory, a static import the mount guard records as a
// permitted terminal. Every word is handed in from hubCopy.js; this file holds no read,
// effect, timer or listener.

import React from 'react';
import HubSheet from './HubSheet';
import HuddleSheetBody from '../Huddle/HuddleSheetBody';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { huddleStatusOf } from './hub/huddleView';

export default function HuddleSheet({ huddle, phone = false, onClose, opener = null, fallbackFocus = null, reducedMotion = false, ceremonyActive = false }) {
  const huddleRecord = huddle?.read?.huddle ?? null;
  return (
    <HubSheet title={COPY.huddle.sheetTitle} eyebrow={COPY.huddle.sheetEyebrow} label={COPY.huddle.sheetLabel} phone={phone} onClose={onClose} opener={opener} fallbackFocus={fallbackFocus} reducedMotion={reducedMotion}>
      <HuddleSheetBody
        copy={COPY.huddle}
        read={huddle?.read ?? null}
        status={huddleStatusOf(huddleRecord)}
        confirm={huddle?.confirm}
        skip={huddle?.skip}
        needsReconfirm={huddle?.needsReconfirm === true}
        // C15: the sheet lands on the plan only when a Reconfirm door opened it (the Deploy card line), never from the chip
        focusPlan={huddle?.focusPlan === true && Boolean(opener?.closest?.('[data-hub-huddle-reconfirm]'))}
        ceremonyActive={ceremonyActive}
      />
    </HubSheet>
  );
}
