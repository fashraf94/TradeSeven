// src/components/CommandCenter/AreaControls.jsx
//
// Command Center hub, slice S1 — the three area controls beside Shadow on the
// desktop, tablet and stacked compositions (the design's AreaControl and the
// stage's tablist, ff-stage.jsx). A vertical tablist in the design's order and
// words — Partnership · Shared Research · Equipped Archetype — with a roving
// tab stop and Arrow / Home / End (spec §10). Selecting a control selects the
// area panel below it; the panel carries the matching tabpanel id.
//
// Each control's second line is its area's summary. In S1 that is the
// loading line for Research and the loadout, and "Not in this release" for
// Partnership; the design's live summaries ("Speculator · ready to deploy")
// are data, so they arrive with S5/S6 (fixtures carry them for layout).

import React, { useRef } from 'react';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { HUB_AREA_ORDER, rovingIndex } from './hub/composition';
import { AREA_TOKEN, C, HAIR, tint } from './hub/hubStyle';
import { RingGlyph } from './HubParts';

export const areaTabId = (idBase, area) => `${idBase}-area-tab-${area}`;
export const areaPanelId = (idBase) => `${idBase}-area-panel`;

export default function AreaControls({ idBase, selected, onSelect, summaries, compact = false, glyphRefs }) {
  const tabRefs = useRef([]);
  const onKeyDown = (event) => {
    // A modified arrow belongs to the browser (Alt+Left is Back): S1 review L3-9.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = HUB_AREA_ORDER.indexOf(selected);
    const next = rovingIndex(event.key, index < 0 ? 0 : index, HUB_AREA_ORDER.length, { vertical: true });
    if (next == null) return;
    event.preventDefault();
    onSelect(HUB_AREA_ORDER[next]);
    tabRefs.current[next]?.focus();
  };
  const indent = compact ? 16 : 34;
  return (
    <div
      role="tablist"
      aria-label={COPY.areas.tablistLabel}
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0, justifyContent: 'center' }}
    >
      {HUB_AREA_ORDER.map((area, i) => {
        const on = selected === area;
        const tone = AREA_TOKEN[area];
        return (
          <button
            key={area}
            ref={(el) => { tabRefs.current[i] = el; }}
            type="button"
            role="tab"
            id={areaTabId(idBase, area)}
            aria-selected={on}
            aria-controls={areaPanelId(idBase)}
            tabIndex={on ? 0 : -1}
            data-hub-area={area}
            onClick={() => onSelect(area)}
            style={{
              appearance: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 14, minHeight: 74, padding: '14px 18px', borderRadius: 16,
              background: on ? tint(tone, 0.08) : C.bg,
              border: `1px solid ${on ? tint(tone, 0.4) : HAIR}`,
              marginLeft: i === 1 ? 0 : indent,
              marginRight: i === 1 ? indent : 0,
            }}
          >
            <span ref={(el) => { if (glyphRefs) glyphRefs.current[area] = el; }} style={{ display: 'flex' }}>
              <RingGlyph on={on} area={area} />
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.ink, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                {COPY.areas.names[area]}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: on ? C.ink2 : C.ink3, marginTop: 3, lineHeight: 1.3, textWrap: 'pretty' }}>
                {summaries[area]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
