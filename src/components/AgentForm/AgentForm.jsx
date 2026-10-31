// src/components/AgentForm/AgentForm.jsx
//
// One agent form: Shadow, bare or in an archetype's armor, drawn live by the WebGL engine
// (src/components/AgentForm/engine/, loaded on first mount through loadEngine.js). Mounted by the lab
// (src/screens/AgentFormLab.jsx, build S0) and, behind their flags (src/config/agentFormFlags.js, build S1), by
// the Command Center hero (CommandCenter/HubAgentForm.jsx) and the battle view (battleView/BattleAgentForm.jsx).
//
// Props (Phase 0 report §4): archetype (an app code id), mood, coreStage and armorStage (1–3), allegiance
// ('player' teal, 'opponent' copper and mirrored), size (CSS px). Then the options the lab compares:
// reducedMotion (the caller's one source; this component reads no media query), bloom
// ('filter' | 'css' | 'webgl' | 'off'), drawPath ('shared' | 'direct'), batched, rate ('live' | 'half' |
// 'still'). `equipped` false → true plays the 900 ms suit-up, true → false the 700 ms unequip.
//
// Build S1 (the hub hero and the battle forms):
//   - `equipOnChange`: a change of archetype after mount plays the change (the engine's swap: the new set suits up,
//     or the old one comes off before bare Shadow shows, the size tweened across it — ruling R5). Without it, or at
//     mount, the new form simply shows. The caller decides which changes are real ones (the hub: a ready read of
//     the same agent).
//   - `paused`: the view holds its frame and the loop stops for it (the hub's lifetime ruling R-S7-5).
//   - `clip`: `contain: paint`, so the CSS glow stops at the box's edge as the design's in-canvas glow does
//     (ruling R3: where the spill would reach the hub's connector).
//   - a form drawn under 40 px is a still, whatever the rate (ruling R12; agentFormSpec.js rateForSize).
//   - the pixel ratio is re-read on a window resize (the S0 review's carry-over §5), not only at render.
//   - `framing="tight"` (the battle views only): each form drawn closer, to fill its small box (agentFormSpec.js
//     TIGHT_ZOOM). Without it the spec carries no zoom, and the engine draws at the design's distance.
//
// Build S2:
//   - `responseKey` and `responsePart` (the hub hero, ruling R19): each new key brightens the part it names, S7's
//     response on the engine's clock. No view exists yet at mount, so a key the form mounts with is the past.
//   - `facing` ('left' | 'right', the League's lanes, ruling R14): which way a form looks where its layout has a
//     direction. Without it the player looks right and the opponent left, as the header's two sides do.
//
// What shows: the engine's canvas while the form is live. The form's own still (its designed stillT frame,
// cached at mount) when the WebGL context is lost, or when a frame of this view threw (the engine drops the view
// to 'unavailable' and keeps every other view running). AgentFormStill when there is no WebGL at all, while the
// engine loads, when it fails to load, or when the context is lost or a frame throws before a still was cached.
// Mood, stage, allegiance and size change the running view; only the draw path remounts it.

import { useEffect, useRef, useState } from 'react';
import AgentFormStill from './AgentFormStill';
import { agentFormSpec, agentFormLabel, hasWebGL, rateForSize } from './agentFormSpec';
import { readAgentFormTheme } from './agentFormTokens';
import { loadAgentFormEngine } from './loadEngine';

const fill = { position: 'absolute', inset: 0, display: 'block' };

const readDpr = () => (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1);

/** The pixel ratio, re-read when the window resizes (a zoom or a move to another screen changes it). */
function usePixelRatio() {
  const [dpr, setDpr] = useState(readDpr);
  useEffect(() => {
    const onResize = () => setDpr(readDpr());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return dpr;
}

export default function AgentForm({
  archetype, mood = 'idle', coreStage = 1, armorStage = 1, allegiance = 'player', size = 200,
  reducedMotion = false, bloom = 'filter', drawPath = 'shared', batched = false, rate = 'live',
  equipped = true, label, onStatus, seed = 1, equipOnChange = false, paused = false, clip = false, framing,
  responseKey = 0, responsePart = 'all', facing,
}) {
  const webgl = hasWebGL();
  const spec = agentFormSpec({ archetype, mood, coreStage, armorStage, allegiance, size, seed, framing, facing });
  const dpr = usePixelRatio();
  const drawRate = rateForSize(rate, spec.size);
  const options = { path: drawPath === 'direct' ? 'direct' : 'shared', bloom, batched, rate: drawRate, reducedMotion, dpr, paused };
  const [status, setStatus] = useState(webgl ? 'loading' : 'unavailable');
  const [stillReady, setStillReady] = useState(false);
  const boxRef = useRef(null), canvasRef = useRef(null), slotRef = useRef(null), stillRef = useRef(null), overlayRef = useRef(null);
  const viewRef = useRef(null);
  // The kind the mounted view draws (or is headed for), so a change can be told from the mount.
  const kindRef = useRef(null);
  const latest = useRef(null);
  latest.current = { spec, options, equipped, onStatus, equipOnChange, responsePart };

  // Mount the engine view (once per draw path); unmount releases it, and the last view releases the engine.
  useEffect(() => {
    if (!webgl) return undefined;
    let live = true;
    const report = (s, info) => { if (!live) return; setStatus(s); setStillReady(!!(info && info.still)); if (latest.current.onStatus) latest.current.onStatus(s); };
    loadAgentFormEngine().then((mod) => {
      if (!live) return;
      const { spec: s, options: o, equipped: on } = latest.current;
      kindRef.current = s.kind;
      viewRef.current = mod.getAgentFormEngine().mount(
        { box: boxRef.current, canvas: canvasRef.current, slot: slotRef.current, stillCanvas: stillRef.current, overlay: overlayRef.current },
        { ...s, fit: on ? 1 : 0, unfit: !on }, o, { onStatus: report }, readAgentFormTheme(),
      );
    }).catch(() => report('unavailable'));
    return () => { live = false; if (viewRef.current) viewRef.current.unmount(); viewRef.current = null; };
  }, [webgl, options.path]);

  const { kind, state, core, armor, pal, face } = spec;
  // The zoom goes with every patch (the engine's own 1 when the spec has none), so a new kind never keeps the old one's.
  const zoom = spec.zoom ?? 1;
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const patch = { kind, state, core, armor, pal, face, size: spec.size, seed: spec.seed, zoom };
    if (latest.current.equipOnChange && kindRef.current !== kind) view.swap(patch); else view.update(patch);
    kindRef.current = kind;
  }, [kind, state, core, armor, pal, face, spec.size, spec.seed, zoom]);
  useEffect(() => { if (viewRef.current) viewRef.current.setOptions({ bloom, batched, rate: drawRate, reducedMotion, dpr, paused }); }, [bloom, batched, drawRate, reducedMotion, dpr, paused]);
  const firstEquip = useRef(true);
  useEffect(() => { if (firstEquip.current) { firstEquip.current = false; return; } if (viewRef.current) viewRef.current.equip(equipped); }, [equipped]);
  useEffect(() => { if (viewRef.current) viewRef.current.respond(latest.current.responsePart); }, [responseKey]);

  const live = status === 'live', showStill = (status === 'lost' || status === 'unavailable') && stillReady, placeholder = !live && !showStill;
  const direct = options.path === 'direct', px = `${spec.size}px`;
  // `isolation: isolate` makes the box its own stacking context, so the overlay's plus-lighter blend adds light to
  // the form's canvas alone (the design's in-canvas 'lighter' composite) and not to whatever the page paints behind
  // the box; without it the glow depends on the backdrop and saturates over a light one (review SR-1).
  // `label={null}` makes the form decorative (build S1: the battle's forms sit beside the name they would repeat).
  const decorative = label === null;
  return (
    <div ref={boxRef} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label || agentFormLabel(spec)} aria-hidden={decorative ? 'true' : undefined} data-agent-form="" data-agent-form-status={status} data-agent-form-path={options.path} style={{ position: 'relative', isolation: 'isolate', ...(clip ? { contain: 'paint' } : null), width: px, height: px, flexShrink: 0 }}>
      {webgl && <canvas ref={canvasRef} aria-hidden="true" data-agent-form-canvas="" style={{ ...fill, width: px, height: px, visibility: live && !direct ? 'visible' : 'hidden' }} />}
      {webgl && <div ref={slotRef} aria-hidden="true" data-agent-form-direct="" style={{ ...fill, visibility: live && direct ? 'visible' : 'hidden' }} />}
      {webgl && <canvas ref={overlayRef} aria-hidden="true" data-agent-form-overlay="" style={{ ...fill, width: px, height: px, display: 'none', mixBlendMode: 'plus-lighter', pointerEvents: 'none', visibility: live ? 'visible' : 'hidden' }} />}
      {webgl && <canvas ref={stillRef} aria-hidden="true" data-agent-form-still="" style={{ ...fill, width: px, height: px, visibility: showStill ? 'visible' : 'hidden' }} />}
      {placeholder && <AgentFormStill size={spec.size} opponent={pal === 'copper'} />}
    </div>
  );
}
