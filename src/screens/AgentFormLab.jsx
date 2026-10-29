// src/screens/AgentFormLab.jsx
//
// The agent form lab (build S0; Phase 0 report docs/audits/20261028_PHASE0_AGENT_IDENTITY.md §5). A page
// the founder's iPhone decides the armored forms' budget on: live, half rate or stills, the draw path,
// batching, and which bloom works on iOS. Mounted only from App.jsx under `?agentFormLab=1` while
// AGENT_FORM_LAB_ENABLED is true (src/config/agentFormFlags.js) — never in the hub, the battle view or the
// picker.
//
// The readout keeps S7's lines exactly (the smoke readout of docs/audits/20261025_BUILD_COMMAND_CENTER_HUB_S7.md
// §13): the last second "fps N · cost X ms", the last 60 s "W s: F fps · avg A · p95 P ms · late L%", plus
// the same line over 5 minutes and the draw calls per frame. Cost is timed around the engine's whole frame
// (every render and every copy). "late" counts frames more than 25 ms apart at the live rate and more than
// 50 ms apart at half rate (the intended cadence); a gap across a hidden page, a lost context or a stopped
// loop is not counted. "Copy reading" copies one plain-text line with every setting and number.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import AgentForm from '../components/AgentForm/AgentForm';
import { AGENT_MOODS, ARCHETYPE_CODE_IDS, formForArchetype, hasWebGL } from '../components/AgentForm/agentFormSpec';
import { loadAgentFormEngine } from '../components/AgentForm/loadEngine';
import { cssVar } from '../theme/cssTokens';
import { readoutLine, lastSecondLine } from './agentFormLabReadout';

const FORMS = Object.freeze(['none', ...ARCHETYPE_CODE_IDS]);
const SIZES = Object.freeze([24, 40, 72, 112, 190, 200, 230, 260, 340]);
const PRESETS = Object.freeze([
  { id: 'hero200', label: '1 hero at 200', views: [200], allegiance: 'player', formMode: 'one' },
  { id: 'battle230', label: '2 at 230', views: [230, 230], allegiance: 'both', formMode: 'one' },
  { id: 'armory', label: '7 at 72 + 1 at 190', views: [190, 72, 72, 72, 72, 72, 72, 72], allegiance: 'player', formMode: 'all' },
  { id: 'chat40', label: '12 at 40', views: Array(12).fill(40), allegiance: 'player', formMode: 'all' },
  // The four glows side by side (2 × 2 fits a 390 px phone; bloom draws from 160 px up), to pick one by eye.
  { id: 'blooms', label: '4 blooms side by side', views: [180, 180, 180, 180], allegiance: 'player', formMode: 'one', blooms: ['filter', 'css', 'webgl', 'off'] },
]);
const BLOOM_NAMES = Object.freeze({ filter: 'canvas filter (design)', css: 'CSS-blurred overlay', webgl: 'WebGL', off: 'off' });
const WINDOW_MS = 300000;

function Select({ label, value, options, onChange, disabled }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: cssVar('ink-2'), minWidth: 0 }}>
      {label}
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 40, fontSize: 15, background: cssVar('bg-card'), color: cssVar('ink'), border: `1px solid ${cssVar('border-strong')}`, borderRadius: 8, padding: '0 8px' }}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

function Button({ children, onClick, active, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active == null ? undefined : !!active} style={{ minHeight: 44, padding: '0 12px', fontSize: 15, borderRadius: 10, cursor: disabled ? 'default' : 'pointer', background: active ? cssVar('teal') : cssVar('bg-card'), color: active ? cssVar('bg-dashboard') : cssVar('ink'), border: `1px solid ${active ? cssVar('teal') : cssVar('border-strong')}`, opacity: disabled ? 0.45 : 1 }}>
      {children}
    </button>
  );
}

export default function AgentFormLab() {
  const phoneReduced = !!useReducedMotion();
  const [preset, setPreset] = useState('hero200');
  const [views, setViews] = useState(PRESETS[0].views);
  const [form, setForm] = useState('momentum_chaser');
  const [formMode, setFormMode] = useState('one');
  const [mood, setMood] = useState('idle');
  const [coreStage, setCoreStage] = useState(1);
  const [armorStage, setArmorStage] = useState(1);
  const [allegiance, setAllegiance] = useState('player');
  const [drawPath, setDrawPath] = useState('shared');
  const [batched, setBatched] = useState(false);
  const [bloom, setBloom] = useState('filter');
  const [bloomSet, setBloomSet] = useState(null);
  const [rate, setRate] = useState('live');
  const [motion, setMotion] = useState('phone');
  const [equipped, setEquipped] = useState(true);
  const [names, setNames] = useState(null);
  const [copied, setCopied] = useState('');
  const reducedMotion = motion === 'phone' ? phoneReduced : motion === 'on';
  const readoutRef = useRef(null), statusRef = useRef(new Map()), engineRef = useRef(null), samplesRef = useRef([]), lastRef = useRef({});

  const applyPreset = (p) => { setPreset(p.id); setViews(p.views); setAllegiance(p.allegiance); setFormMode(p.formMode); setBloomSet(p.blooms || null); if (p.views.length > 1) setDrawPath('shared'); samplesRef.current = []; };
  const setCustom = (count, size) => { setPreset('custom'); setBloomSet(null); setViews(Array(count).fill(size)); if (count > 1) setDrawPath('shared'); samplesRef.current = []; };
  const single = views.length === 1;

  // The frame samples and the readout, written straight to the DOM every 500 ms (no React render per frame).
  useEffect(() => {
    let off = () => {}, timer = 0, live = true;
    // Without WebGL every view is its still and there is nothing to time: the engine chunk is not fetched (review SR-16).
    if (hasWebGL()) loadAgentFormEngine().then((mod) => {
      if (!live) return;
      const engine = mod.getAgentFormEngine();
      engineRef.current = engine;
      setNames(Object.fromEntries(Object.entries(mod.META).map(([k, m]) => [k, m.name])));
      off = engine.onFrame((s) => { const a = samplesRef.current; a.push(s); while (a.length && s.t - a[0].t > WINDOW_MS) a.shift(); });
    }).catch(() => {});
    timer = setInterval(() => {
      const el = readoutRef.current, engine = engineRef.current;
      if (!el) return;
      const a = samplesRef.current, now = a.length ? a[a.length - 1].t : 0, lateMs = lastRef.current.rate === 'half' ? 50 : 25;
      const info = engine ? engine.info() : null, calls = a.length ? a[a.length - 1].calls : 0;
      const statuses = {}, keys = lastRef.current.keys || [];
      for (const k of keys) { const s = statusRef.current.get(k) || 'loading'; statuses[s] = (statuses[s] || 0) + 1; }
      const r1 = a.length ? lastSecondLine(a, now) : 'fps 0 · cost 0.00 ms', r60 = readoutLine(a, now, 60000, lateMs).text, r300 = readoutLine(a, now, WINDOW_MS, lateMs).text;
      const loop = info && info.views && !info.looping ? ' · no frames (still, reduced motion or hidden)' : '';
      const ctx = Object.entries(statuses).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
      const lines = [r1, r60, r300, `calls ${calls}/frame · late > ${lateMs} ms · multiDraw ${info && info.multiDraw != null ? (info.multiDraw ? 'yes' : 'no') : '—'}${loop}`, `views ${ctx} · lost ${info ? info.lost : 0} · restored ${info ? info.restored : 0}`];
      el.textContent = lines.join('\n');
      lastRef.current.lines = { r1, r60, r300, calls, info, ctx, lateMs };
    }, 500);
    return () => { live = false; off(); clearInterval(timer); };
  }, []);

  const startIndex = Math.max(0, FORMS.indexOf(form));
  const layout = useMemo(() => views.map((size, i) => ({
    key: `${i}`, size,
    archetype: formMode === 'all' ? FORMS[(startIndex + i) % FORMS.length] : form,
    allegiance: allegiance === 'both' ? (i % 2 ? 'opponent' : 'player') : allegiance,
    bloom: bloomSet ? bloomSet[i % bloomSet.length] : bloom,
  })), [views, formMode, form, startIndex, allegiance, bloomSet, bloom]);
  lastRef.current.rate = rate;
  lastRef.current.keys = layout.map((v) => `${v.key}-${drawPath}`);

  const formName = (id) => (names ? names[formForArchetype(id)] : null) || (id === 'none' ? 'Shadow (bare)' : id);
  const settingsLine = () => [
    `preset ${preset}`, `views ${views.length}× ${[...new Set(views)].join('/')} px`, `form ${formMode === 'all' ? 'all seven' : formForArchetype(form)}`, `mood ${mood}`, `core ${coreStage}`, `armor ${armorStage}`,
    `allegiance ${allegiance}`, `path ${drawPath}`, `batched ${batched ? 'on' : 'off'}`, `bloom ${bloomSet ? `side by side (${bloomSet.join('/')})` : bloom}`, `rate ${rate}`, `reduced motion ${reducedMotion ? 'on' : 'off'} (${motion})`, `equipped ${equipped ? 'yes' : 'no'}`,
  ].join(' · ');
  const copyReading = async () => {
    const L = lastRef.current.lines || {}, info = L.info || {};
    const vp = typeof innerWidth === 'number' ? `${innerWidth}x${innerHeight}` : '?';
    const line = ['AgentFormLab S0', settingsLine(), `last second: ${L.r1 || '—'}`, `60 s window: ${L.r60 || '—'}`, `5 min window: ${L.r300 || '—'}`, `calls ${L.calls ?? '—'}/frame`, `late > ${rate === 'half' ? 50 : 25} ms`,
      `multiDraw ${info.multiDraw == null ? '—' : info.multiDraw ? 'yes' : 'no'}`, `views ${L.ctx || '—'}`, `lost ${info.lost || 0} restored ${info.restored || 0}`, `gpu ${info.gpu || '—'}`,
      `dpr ${typeof devicePixelRatio === 'number' ? devicePixelRatio : '?'}`, `viewport ${vp}`, `ua ${typeof navigator === 'object' ? navigator.userAgent : '?'}`].join(' | ');
    setCopied(line);
    try { await navigator.clipboard.writeText(line); setCopied(`${line}`); } catch { /* the textarea below holds it for a manual copy */ }
  };
  const loseContext = () => {
    const engine = engineRef.current;
    for (const r of engine ? engine.renderers() : []) {
      const ext = r.getContext().getExtension('WEBGL_lose_context');
      if (ext) { ext.loseContext(); setTimeout(() => ext.restoreContext(), 1500); }
    }
  };

  const option = (list, text = (x) => String(x)) => list.map((x) => [String(x), text(x)]);
  return (
    <div data-agent-form-lab="" style={{ minHeight: '100dvh', background: cssVar('bg-dashboard'), color: cssVar('ink'), fontFamily: 'system-ui, sans-serif', paddingBottom: 32 }}>
      <pre ref={readoutRef} data-agent-form-readout="" style={{ position: 'sticky', top: 0, zIndex: 2, margin: 0, padding: '6px 10px', background: cssVar('bg-card'), borderBottom: `1px solid ${cssVar('border-strong')}`, font: '11px/1.4 ui-monospace, Menlo, monospace', whiteSpace: 'pre-wrap', color: cssVar('ink') }}>collecting…</pre>
      {!hasWebGL() && <p style={{ margin: 12, color: cssVar('ink-2') }}>This browser has no WebGL: every view shows its still.</p>}
      <div data-agent-form-stage="" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center', padding: '14px 8px' }}>
        {layout.map((v) => (
          <figure key={`${v.key}-${drawPath}`} style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <AgentForm archetype={v.archetype} mood={mood} coreStage={coreStage} armorStage={armorStage} allegiance={v.allegiance} size={v.size}
              reducedMotion={reducedMotion} bloom={v.bloom} drawPath={single ? drawPath : 'shared'} batched={batched} rate={rate} equipped={equipped}
              onStatus={(s) => { statusRef.current.set(`${v.key}-${drawPath}`, s); }} />
            {bloomSet && <figcaption data-agent-form-caption="" style={{ fontSize: 12, color: cssVar('ink-2') }}>{BLOOM_NAMES[v.bloom]}</figcaption>}
          </figure>
        ))}
      </div>
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p) => <Button key={p.id} active={preset === p.id} onClick={() => applyPreset(p)}>{p.label}</Button>)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button onClick={copyReading}>Copy reading</Button>
          <Button onClick={() => { samplesRef.current = []; }}>Reset readout</Button>
          <Button onClick={() => setEquipped(false)} disabled={!equipped}>Play unequip</Button>
          <Button onClick={() => setEquipped(true)} disabled={equipped}>Play equip</Button>
          <Button onClick={loseContext}>Lose context (1.5 s)</Button>
        </div>
        {copied && <textarea readOnly value={copied} aria-label="The copied reading" rows={4} style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, background: cssVar('bg-card'), color: cssVar('ink'), border: `1px solid ${cssVar('border-strong')}`, borderRadius: 8 }} />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <Select label="Views" value={String(views.length)} options={option(Array.from({ length: 12 }, (_, i) => i + 1))} onChange={(n) => setCustom(Number(n), views[views.length - 1])} />
          <Select label="Size (px)" value={String(views[views.length - 1])} options={option(SIZES)} onChange={(s) => setCustom(views.length, Number(s))} />
          <Select label="Form" value={form} options={FORMS.map((f) => [f, formName(f)])} onChange={setForm} />
          <Select label="Forms across views" value={formMode} options={[['one', 'the same form'], ['all', 'all seven, in turn']]} onChange={setFormMode} />
          <Select label="Mood" value={mood} options={option(AGENT_MOODS)} onChange={setMood} />
          <Select label="Core stage" value={String(coreStage)} options={option([1, 2, 3])} onChange={(s) => setCoreStage(Number(s))} />
          <Select label="Armor stage" value={String(armorStage)} options={option([1, 2, 3])} onChange={(s) => setArmorStage(Number(s))} />
          <Select label="Allegiance" value={allegiance} options={[['player', 'yours (teal)'], ['opponent', 'opponent (copper)'], ['both', 'both, alternating']]} onChange={setAllegiance} />
          <Select label="Draw path" value={single ? drawPath : 'shared'} disabled={!single} options={[['shared', 'shared renderer + copy'], ['direct', 'direct canvas (1 view)']]} onChange={setDrawPath} />
          <Select label="Plates" value={batched ? 'on' : 'off'} options={[['off', 'one draw per plate'], ['on', 'batched']]} onChange={(v) => setBatched(v === 'on')} />
          <Select label="Bloom" value={bloom} options={Object.entries(BLOOM_NAMES)} onChange={(b) => { setBloom(b); setBloomSet(null); }} />
          <Select label="Rate" value={rate} options={[['live', 'live (every frame)'], ['half', 'half (every other)'], ['still', 'still']]} onChange={setRate} />
          <Select label="Reduced motion" value={motion} options={[['phone', `the phone's setting (${phoneReduced ? 'on' : 'off'})`], ['on', 'force on'], ['off', 'force off']]} onChange={setMotion} />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: cssVar('ink-2'), lineHeight: 1.5 }}>{settingsLine()}</p>
      </div>
    </div>
  );
}
