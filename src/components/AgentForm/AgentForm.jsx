// src/components/AgentForm/AgentForm.jsx
//
// One agent form: Shadow, bare or in an archetype's armor, drawn live by the WebGL engine
// (src/components/AgentForm/engine/, loaded on first mount through loadEngine.js). Build S0 mounts it only
// in the lab (src/screens/AgentFormLab.jsx); nothing in the hub, the battle view or the picker renders it.
//
// Props (Phase 0 report §4): archetype (an app code id), mood, coreStage and armorStage (1–3), allegiance
// ('player' teal, 'opponent' copper and mirrored), size (CSS px). Then the options the lab compares:
// reducedMotion (the caller's one source; this component reads no media query), bloom
// ('filter' | 'css' | 'webgl' | 'off'), drawPath ('shared' | 'direct'), batched, rate ('live' | 'half' |
// 'still'). `equipped` false → true plays the 900 ms suit-up, true → false the 700 ms unequip.
//
// What shows: the engine's canvas while the form is live. The form's own still (its designed stillT frame,
// cached at mount) when the WebGL context is lost, or when a frame of this view threw (the engine drops the view
// to 'unavailable' and keeps every other view running). AgentFormStill when there is no WebGL at all, while the
// engine loads, when it fails to load, or when the context is lost or a frame throws before a still was cached.
// Mood, stage, allegiance and size change the running view; only the draw path remounts it.

import { useEffect, useRef, useState } from 'react';
import AgentFormStill from './AgentFormStill';
import { agentFormSpec, agentFormLabel, hasWebGL } from './agentFormSpec';
import { readAgentFormTheme } from './agentFormTokens';
import { loadAgentFormEngine } from './loadEngine';

const fill = { position: 'absolute', inset: 0, display: 'block' };

export default function AgentForm({
  archetype, mood = 'idle', coreStage = 1, armorStage = 1, allegiance = 'player', size = 200,
  reducedMotion = false, bloom = 'filter', drawPath = 'shared', batched = false, rate = 'live',
  equipped = true, label, onStatus, seed = 1,
}) {
  const webgl = hasWebGL();
  const spec = agentFormSpec({ archetype, mood, coreStage, armorStage, allegiance, size, seed });
  const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const options = { path: drawPath === 'direct' ? 'direct' : 'shared', bloom, batched, rate, reducedMotion, dpr };
  const [status, setStatus] = useState(webgl ? 'loading' : 'unavailable');
  const [stillReady, setStillReady] = useState(false);
  const boxRef = useRef(null), canvasRef = useRef(null), slotRef = useRef(null), stillRef = useRef(null), overlayRef = useRef(null);
  const viewRef = useRef(null);
  const latest = useRef(null);
  latest.current = { spec, options, equipped, onStatus };

  // Mount the engine view (once per draw path); unmount releases it, and the last view releases the engine.
  useEffect(() => {
    if (!webgl) return undefined;
    let live = true;
    const report = (s, info) => { if (!live) return; setStatus(s); setStillReady(!!(info && info.still)); if (latest.current.onStatus) latest.current.onStatus(s); };
    loadAgentFormEngine().then((mod) => {
      if (!live) return;
      const { spec: s, options: o, equipped: on } = latest.current;
      viewRef.current = mod.getAgentFormEngine().mount(
        { box: boxRef.current, canvas: canvasRef.current, slot: slotRef.current, stillCanvas: stillRef.current, overlay: overlayRef.current },
        { ...s, fit: on ? 1 : 0, unfit: !on }, o, { onStatus: report }, readAgentFormTheme(),
      );
    }).catch(() => report('unavailable'));
    return () => { live = false; if (viewRef.current) viewRef.current.unmount(); viewRef.current = null; };
  }, [webgl, options.path]);

  const { kind, state, core, armor, pal, face } = spec;
  useEffect(() => { if (viewRef.current) viewRef.current.update({ kind, state, core, armor, pal, face, size: spec.size, seed: spec.seed }); }, [kind, state, core, armor, pal, face, spec.size, spec.seed]);
  useEffect(() => { if (viewRef.current) viewRef.current.setOptions({ bloom, batched, rate, reducedMotion, dpr }); }, [bloom, batched, rate, reducedMotion, dpr]);
  const firstEquip = useRef(true);
  useEffect(() => { if (firstEquip.current) { firstEquip.current = false; return; } if (viewRef.current) viewRef.current.equip(equipped); }, [equipped]);

  const live = status === 'live', showStill = (status === 'lost' || status === 'unavailable') && stillReady, placeholder = !live && !showStill;
  const direct = options.path === 'direct', px = `${spec.size}px`;
  // `isolation: isolate` makes the box its own stacking context, so the overlay's plus-lighter blend adds light to
  // the form's canvas alone (the design's in-canvas 'lighter' composite) and not to whatever the page paints behind
  // the box; without it the glow depends on the backdrop and saturates over a light one (review SR-1).
  return (
    <div ref={boxRef} role="img" aria-label={label || agentFormLabel(spec)} data-agent-form="" data-agent-form-status={status} data-agent-form-path={options.path} style={{ position: 'relative', isolation: 'isolate', width: px, height: px, flexShrink: 0 }}>
      {webgl && <canvas ref={canvasRef} aria-hidden="true" data-agent-form-canvas="" style={{ ...fill, width: px, height: px, visibility: live && !direct ? 'visible' : 'hidden' }} />}
      {webgl && <div ref={slotRef} aria-hidden="true" data-agent-form-direct="" style={{ ...fill, visibility: live && direct ? 'visible' : 'hidden' }} />}
      {webgl && <canvas ref={overlayRef} aria-hidden="true" data-agent-form-overlay="" style={{ ...fill, width: px, height: px, display: 'none', mixBlendMode: 'plus-lighter', pointerEvents: 'none', visibility: live ? 'visible' : 'hidden' }} />}
      {webgl && <canvas ref={stillRef} aria-hidden="true" data-agent-form-still="" style={{ ...fill, width: px, height: px, visibility: showStill ? 'visible' : 'hidden' }} />}
      {placeholder && <AgentFormStill size={spec.size} opponent={pal === 'copper'} />}
    </div>
  );
}
