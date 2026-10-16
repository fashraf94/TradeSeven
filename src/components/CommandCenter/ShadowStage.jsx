// src/components/CommandCenter/ShadowStage.jsx
//
// Command Center hub, slice S1 — the stage: the larger Shadow, its name line,
// its status line and, on the desktop, tablet and stacked compositions, the
// three area controls with the dotted connector to the selected one (the
// design's Stage and PhoneStage, ff-stage.jsx; spec §1 keeps the enlarged
// Shadow and its readable adjacent text).
//
// Shadow is ShadowStill, a fixed box (ruling R-S1-1). The connector anchors to
// that box and to the selected control's ring, never to a filament: it runs
// from the middle of the box's right edge to the ring's left edge. One
// ResizeObserver on the stage re-measures it; with no layout (a zero-size box)
// it draws nothing.
//
// The status line is the hub's one live region. It announces phase words only
// — "Idle · nothing running", or the submitting phase — never a percentage
// (spec §5.5, §10).

import React, { useLayoutEffect, useRef, useState } from 'react';
import { cssVar, readToken } from '../../theme/cssTokens';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { AREA_TOKEN, C, HAIR, MONO, tint } from './hub/hubStyle';
import AreaControls from './AreaControls';
import ShadowStill from './ShadowStill';

export function StatusLine({ processing, small = false, wrap = false, maxWidth }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-hub-status=""
      style={{ display: 'flex', alignItems: wrap ? 'flex-start' : 'center', gap: 7, maxWidth, minWidth: 0 }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: wrap ? 4 : 0,
          background: processing ? C.teal : C.ink3, boxShadow: processing ? `0 0 8px ${C.teal}` : 'none',
        }}
      />
      <span
        style={{
          fontFamily: MONO, fontSize: small ? 10 : 10.5, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: processing ? C.teal : C.ink2, lineHeight: 1.35, whiteSpace: wrap ? 'normal' : 'nowrap', minWidth: 0,
        }}
      >
        {processing ? COPY.shadow.statusSubmitting : COPY.shadow.statusIdle}
      </span>
    </div>
  );
}

function NameLine({ stacked = false }) {
  if (stacked) {
    return (
      <div>
        <div style={{ fontSize: 23, fontWeight: 700, color: C.ink, letterSpacing: '-0.015em', lineHeight: 1.05 }}>{COPY.shadow.name}</div>
        <div style={{ fontSize: 14.5, color: C.ink2, marginTop: 5, lineHeight: 1.3, textWrap: 'pretty' }}>{COPY.shadow.role}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6, position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', color: C.ink }}>{COPY.shadow.name}</span>
      <span style={{ fontSize: 14.5, color: C.ink2 }}>{COPY.shadow.role}</span>
    </div>
  );
}

/**
 * The connector's path, from the box's right edge (its middle) to the ring's
 * left edge, in the overlay's px. `origin` is where the overlay SVG starts:
 * the stage's padding box (it is `inset: 0` inside the stage's 1 px border),
 * not its border box (S1 review L4-6).
 */
export function connectorPath(origin, boxRect, glyphRect) {
  if (!origin || !boxRect || !glyphRect || !boxRect.width || !glyphRect.width) return null;
  const sx = boxRect.right - origin.left;
  const sy = boxRect.top - origin.top + boxRect.height / 2;
  const ex = glyphRect.left - origin.left - 2;
  const ey = glyphRect.top - origin.top + glyphRect.height / 2;
  if (!(ex > sx)) return null;
  const mx = (sx + ex) / 2;
  const f = (v) => v.toFixed(1);
  return { d: `M${f(sx)} ${f(sy)} C${f(mx)} ${f(sy)}, ${f(mx)} ${f(ey)}, ${f(ex)} ${f(ey)}`, sx, sy };
}

/** Desktop, tablet and stacked: Shadow, the status line, and the three area controls. */
export function ShadowStage({ composition, size, tier, status, processing, selectedArea, onSelectArea, summaries, idBase, reducedMotion }) {
  const compact = composition !== 'desktop';
  const stageRef = useRef(null);
  const boxRef = useRef(null);
  const glyphRefs = useRef([]);
  const [path, setPath] = useState(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => {
      const glyph = glyphRefs.current[selectedArea];
      const rect = stage.getBoundingClientRect();
      const origin = { left: rect.left + stage.clientLeft, top: rect.top + stage.clientTop };
      const next = connectorPath(origin, boxRef.current?.getBoundingClientRect(), glyph?.getBoundingClientRect());
      setPath((prev) => (prev?.d === next?.d ? prev : next));
    };
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [selectedArea, composition, size]);

  const lineColor = readToken(AREA_TOKEN[selectedArea] || 'teal');
  return (
    <section
      ref={stageRef}
      aria-label={COPY.shadow.stageLabel}
      data-hub-stage={composition}
      style={{
        position: 'relative', borderRadius: 20, overflow: 'hidden',
        background: `radial-gradient(ellipse at 24% 55%, ${tint('teal', 0.07)}, transparent 55%), ${C.surface}`,
        border: `1px solid ${HAIR}`, padding: compact ? '18px 20px' : '20px 26px 22px',
      }}
    >
      <NameLine />
      {path && (
        <svg aria-hidden="true" data-hub-connector="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
          <path d={path.d} fill="none" stroke={lineColor} strokeOpacity="0.6" strokeWidth="1.2" strokeDasharray="3 4" />
          <circle cx={path.sx} cy={path.sy} r="2.6" fill={lineColor} />
        </svg>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 26 : 44, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <ShadowStill size={size} tier={tier} status={status} selectedArea={selectedArea} reducedMotion={reducedMotion} boxRef={boxRef} />
          <StatusLine processing={processing} maxWidth={size + 20} />
        </div>
        <AreaControls
          idBase={idBase}
          selected={selectedArea}
          onSelect={onSelectArea}
          summaries={summaries}
          compact={compact}
          glyphRefs={glyphRefs}
        />
      </div>
    </section>
  );
}

/**
 * The phone: Shadow at 200 px (196 under 375 px wide) beside its name and
 * status, and a read-only summary of the three areas beneath. Section
 * navigation is the tab row below the stage.
 */
export function PhoneStage({ size, tier, status, processing, selectedArea, summaries, reducedMotion }) {
  return (
    <section
      aria-label={COPY.shadow.stageLabel}
      data-hub-stage="phone"
      style={{
        position: 'relative', borderRadius: 20, overflow: 'hidden',
        background: `radial-gradient(ellipse at 30% 42%, ${tint('teal', 0.09)}, transparent 55%), ${C.surface}`,
        border: `1px solid ${HAIR}`, padding: '10px 14px 14px 6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShadowStill size={size} tier={tier} status={status} selectedArea={selectedArea} reducedMotion={reducedMotion} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <NameLine stacked />
          <StatusLine processing={processing} small wrap />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, paddingLeft: 8 }}>
        {COPY.areas.shortNames.map((name, area) => {
          const on = selectedArea === area;
          return (
            <div key={name} data-hub-summary={area} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, lineHeight: 1.35, color: on ? C.ink : C.ink2, minWidth: 0 }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6, background: on ? cssVar(AREA_TOKEN[area]) : C.ink3 }} />
              <span style={{ minWidth: 0, textWrap: 'pretty' }}>
                <span style={{ fontWeight: 600 }}>{name}</span>
                {COPY.areas.summaryTail(summaries[area])}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
