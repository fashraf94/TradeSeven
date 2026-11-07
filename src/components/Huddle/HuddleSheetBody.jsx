// src/components/Huddle/HuddleSheetBody.jsx
//
// Huddle S1 — THE HUDDLE SHEET'S BODY (spec V1.1 §8; Amendment C V1.2 §C7, §C8, §C15;
// Command Center spec V1.2 Amendment D §D3). Rendered inside the hub's HubSheet (the
// overlay stack's background inertness, focus to Close, Escape and focus return are the
// HubSheet's), and kept OUTSIDE the hub directory because it holds what the hub may not:
// the <audio> element and its listeners, the playback-token call and one visibility
// listener. It is a static import the hub's mount guard records as a permitted terminal
// (the hub graph keeps its one lazy edge; build report RF-4), and its activity is pinned
// call by call in commandCenterHub.activity.guard.test.js.
//
// Every word on it is the hub's (`copy`, the hubCopy.js `huddle` block under the copy
// guard); nothing here writes a user-visible string of its own.
//
// AUDIO: never autoplays. Play asks for a fresh playback URL (the token rotates each time),
// and playback STOPS on unmount, when the page is hidden, and while the deploy ceremony
// covers the page (`ceremonyActive`). The first play records `listened`, the end records
// `completed` (awaited writes server-side; a failure here is ignored).
// TRANSCRIPT: always shown, the current beat highlighted from the beat timings.
// PLAN: values edited or items removed — never typed text; Confirm sends the base revision
// and the replacement; a 409 or a 422 shows the server's current version and asks again.
// STATUS: per game, from receipts only, never spoken.

import React, { useEffect, useRef, useState } from 'react';
import { cssVar } from '../../theme/cssTokens';
import { issueHuddlePlayback, sendHuddleEvent } from '../../services/huddleService';

const ink = cssVar('ink');
const ink2 = cssVar('ink-2');
const teal = cssVar('teal');
const card = cssVar('bg-agent');
const hair = cssVar('border-strong');

const LEVEL_KINDS = new Set(['CHASE', 'FADE', 'CUT_IF_BELOW', 'NO_CHASE_ABOVE']);
const sectionStyle = { borderRadius: 14, background: card, padding: '12px 14px', border: `1px solid ${hair}` };
const buttonStyle = { appearance: 'none', font: 'inherit', minHeight: 44, minWidth: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${hair}`, background: 'transparent', color: ink, cursor: 'pointer' };

/** The plan as the player edits it: items by key, each with its value, or removed. */
function itemsOf(current) {
  return [
    ...(current?.stances || []).map((s, i) => ({ key: `s${i}`, group: 'stances', item: s })),
    ...(current?.lines || []).map((l, i) => ({ key: `l${i}`, group: 'lines', item: l })),
  ];
}

function replacementOf(items, removed, levels) {
  const out = { stances: [], lines: [] };
  for (const { key, group, item } of items) {
    if (removed.has(key)) continue;
    const level = levels[key];
    out[group].push(level !== undefined && level !== '' && LEVEL_KINDS.has(item.kind) ? { ...item, level: Number(level) } : item);
  }
  return out;
}

function BeatLine({ beat, active, copy }) {
  return (
    <div data-huddle-beat={beat.id} data-huddle-active={active ? '' : undefined} style={{ padding: '6px 0', borderLeft: `3px solid ${active ? teal : 'transparent'}`, paddingLeft: 10 }}>
      <div style={{ fontSize: 12, color: ink2, fontWeight: 600 }}>{copy.beats[beat.id] ?? beat.id}</div>
      <div style={{ fontSize: 14, color: ink, lineHeight: 1.5 }}>{beat.text}</div>
    </div>
  );
}

export default function HuddleSheetBody({ copy, read, status = null, confirm, skip, needsReconfirm = false, focusPlan = false, ceremonyActive = false }) {
  const huddle = read?.huddle ?? null;
  const audioRef = useRef(null);
  const planRef = useRef(null);
  const listenedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [removed, setRemoved] = useState(() => new Set());
  const [levels, setLevels] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  // Stop on unmount; stop when the page is hidden; scroll to the plan when opened to reconfirm.
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState !== 'visible') audioRef.current?.pause(); };
    document.addEventListener('visibilitychange', onVisibility);
    if (focusPlan) planRef.current?.scrollIntoView?.({ block: 'nearest' });
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      const el = audioRef.current;
      if (el) { el.pause(); el.removeAttribute('src'); }
    };
  }, [focusPlan]);

  // The deploy ceremony covering the page stops playback.
  useEffect(() => {
    if (ceremonyActive) audioRef.current?.pause();
  }, [ceremonyActive]);

  if (!huddle) {
    return <p data-huddle-empty="" style={{ margin: 0, color: ink2 }}>{read?.status === 'error' ? copy.loadError : read?.status === 'loading' ? copy.loading : copy.none}</p>;
  }

  const plan = huddle.plan;
  const items = itemsOf(plan?.current);
  const beats = huddle.script?.beats || [];
  const activeBeat = beats.find((b) => typeof b.startMs === 'number' && typeof b.endMs === 'number' && positionMs >= b.startMs && positionMs <= b.endMs)?.id ?? null;

  const play = async () => {
    const el = audioRef.current;
    if (!el || ceremonyActive) return;
    if (playing) { el.pause(); return; }
    try {
      const { url } = await issueHuddlePlayback({ etDate: huddle.etDate });
      el.src = url;
      await el.play();
      if (!listenedRef.current) { listenedRef.current = true; sendHuddleEvent({ etDate: huddle.etDate, kind: 'listened' }).catch(() => {}); }
    } catch {
      setAudioError(true);
    }
  };

  const onConfirm = async () => {
    setBusy(true);
    setNotice(null);
    const r = await confirm({ baseRevision: plan.revision, replacement: replacementOf(items, removed, levels) });
    setBusy(false);
    setRemoved(new Set());
    setLevels({});
    if (r.ok) return;
    if (r.status === 409) setNotice(copy.notices.conflict);
    else if (r.status === 422 && r.body?.error === 'validation_changed') setNotice(copy.notices.previewed);
    else if (r.status === 410) setNotice(copy.notices.closed);
    else setNotice(copy.notices[r.body?.error] ?? copy.notices.failed);
  };
  const onSkip = async () => {
    setBusy(true);
    const r = await skip();
    setBusy(false);
    if (!r.ok) setNotice(r.status === 410 ? copy.notices.closed : copy.notices.failed);
  };

  const proposed = plan?.status === 'proposed';
  const confirmed = plan?.status === 'confirmed';
  return (
    <div data-huddle-sheet="" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section style={sectionStyle} aria-label={copy.listenLabel}>
        {huddle.audio?.hasAudio && !audioError ? (
          <button type="button" style={buttonStyle} onClick={play} disabled={ceremonyActive} data-huddle-play="">{playing ? copy.pause : copy.play}</button>
        ) : (
          <p style={{ margin: 0, color: ink2, fontSize: 13 }}>{copy.audioUnavailable}</p>
        )}
        {/* the audio element: never autoplays, no preload until Play */}
        <audio
          ref={audioRef}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setPositionMs(Math.round(e.currentTarget.currentTime * 1000))}
          onEnded={() => { setPlaying(false); sendHuddleEvent({ etDate: huddle.etDate, kind: 'completed' }).catch(() => {}); }}
          onError={() => setAudioError(true)}
        />
      </section>

      <section style={sectionStyle} aria-label={copy.transcript}>
        <div style={{ fontSize: 12, color: ink2, fontWeight: 600, marginBottom: 6 }}>{copy.transcript}</div>
        {beats.map((b) => <BeatLine key={b.id} beat={b} active={b.id === activeBeat} copy={copy} />)}
      </section>

      {(huddle.cards || []).filter((c) => c.beatId === 'names' && c.title).map((c) => (
        <section key={`card-${c.title}`} style={sectionStyle} data-huddle-card={c.title}>
          <div style={{ fontWeight: 700, color: ink }}>{c.title}</div>
          {c.lines.map((line) => <div key={line} style={{ fontSize: 13.5, color: ink2, lineHeight: 1.5 }}>{line}</div>)}
          <div style={{ fontSize: 12, color: ink2, marginTop: 4 }}>{copy.sourcesOf((c.evidenceIds || []).map((id) => (huddle.evidence || []).find((e) => e.id === id)?.source?.label).filter(Boolean))}</div>
        </section>
      ))}

      <section ref={planRef} style={sectionStyle} aria-label={copy.planTitle} data-huddle-plan={plan?.status ?? ''}>
        <div style={{ fontWeight: 700, color: ink, marginBottom: 6 }}>{copy.planTitle}</div>
        {items.length === 0 && <p style={{ margin: 0, color: ink2 }}>{copy.nothingToConfirm}</p>}
        {items.map(({ key, item }) => (
          <div key={key} data-huddle-item={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: removed.has(key) ? 0.45 : 1 }}>
            <span style={{ flex: 1, color: ink }}>{copy.itemText(item, plan.eventLabels || {})}</span>
            {proposed && LEVEL_KINDS.has(item.kind) && (
              <input
                aria-label={copy.levelLabel(item.ticker)}
                inputMode="decimal"
                value={levels[key] ?? (typeof item.level === 'number' ? String(item.level) : '')}
                onChange={(e) => setLevels((prev) => ({ ...prev, [key]: e.target.value }))}
                style={{ width: 84, minHeight: 44, borderRadius: 10, border: `1px solid ${hair}`, background: 'transparent', color: ink, padding: '0 8px' }}
              />
            )}
            {proposed && (
              <button type="button" style={buttonStyle} onClick={() => setRemoved((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })}>
                {removed.has(key) ? copy.keep : copy.remove}
              </button>
            )}
          </div>
        ))}
        {(plan?.dissent || []).map((d) => <p key={`${d.ticker}-${d.from}`} style={{ margin: '6px 0 0', fontSize: 12.5, color: ink2 }}>{d.reason}</p>)}
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: ink2 }}>{copy.instructionNote}</p>
        {notice && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: ink }}>{notice}</p>}
        {proposed && items.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" style={{ ...buttonStyle, borderColor: teal, color: teal, flex: 1 }} onClick={onConfirm} disabled={busy} data-huddle-confirm="">{busy ? copy.working : copy.confirm}</button>
            <button type="button" style={buttonStyle} onClick={onSkip} disabled={busy} data-huddle-skip="">{copy.skip}</button>
          </div>
        )}
        {confirmed && needsReconfirm && (
          // C15: the equipped archetype changed since the plan was confirmed — the same confirm, under the new archetype
          <div style={{ marginTop: 10 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: ink }}>{copy.reconfirmLine}</p>
            <button type="button" style={{ ...buttonStyle, borderColor: teal, color: teal }} onClick={onConfirm} disabled={busy} data-huddle-reconfirm="">{busy ? copy.working : copy.reconfirm}</button>
          </div>
        )}
        <div data-huddle-status="" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, color: ink }}>{status?.plan}</div>
          {(status?.battles || []).map((b) => <div key={b.battleId} data-huddle-battle={b.battleId} style={{ fontSize: 13, color: ink2 }}>{b.text}</div>)}
        </div>
      </section>
    </div>
  );
}
