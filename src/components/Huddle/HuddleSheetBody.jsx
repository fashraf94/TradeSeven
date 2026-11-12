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
// AUDIO: never autoplays. Play asks for a playback URL (the token rotates each time it is
// issued); Pause then Play resumes where it stopped. Playback STOPS on unmount (the audio
// element's own ref cleanup — a useEffect cleanup would find the ref already cleared), when
// the page is hidden, and while the deploy ceremony covers the page (`ceremonyActive`); every
// stop also abandons a Play still waiting for its URL (review L3-4). The first play records
// `listened`, the end records `completed` (awaited writes server-side; a failure here is ignored).
// TRANSCRIPT: always shown, the current beat highlighted from the beat timings.
// PLAN: values edited or items removed — never typed text; Confirm sends the base revision
// and the replacement; a 409 or a 422 shows the server's current version and asks again.
// Amendment E §E1: one confirm covers every archetype in play; a 422 may carry a preview per
// archetype whose rule changes an item ("For your Diversifier game: Fade CCI becomes Watch
// CCI"), and the next Confirm (or Reconfirm) sends those revisions back as `acknowledged`.
// STATUS: per game, from receipts only, never spoken.

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
      <div style={{ fontSize: 12, color: ink2, fontWeight: 600 }}>{copy.beats[beat.id] ?? ''}</div>
      <div style={{ fontSize: 14, color: ink, lineHeight: 1.5 }}>{beat.text}</div>
    </div>
  );
}

/** E1's preview line names the card's own item — its level included (review HU-6) — when the change's index is that stance. */
function previewFromOf(plan, change) {
  const item = change?.kind === 'stance' ? plan?.current?.stances?.[change.index] : null;
  return item && item.ticker === change.ticker && item.kind === change.from ? item : { kind: change.from, ticker: change.ticker };
}

export default function HuddleSheetBody({ copy, read, status = null, confirm, skip, needsReconfirm = false, focusPlan = false, ceremonyActive = false }) {
  const huddle = read?.huddle ?? null;
  const audioRef = useRef(null);
  const planRef = useRef(null);
  const listenedRef = useRef(false);
  // Each stop bumps the generation; a Play that was waiting for its URL starts nothing once it has moved on.
  const playGenRef = useRef(0);
  const ceremonyRef = useRef(ceremonyActive);
  ceremonyRef.current = ceremonyActive;
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [removed, setRemoved] = useState(() => new Set());
  const [levels, setLevels] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  // E1: the last per-archetype preview the server answered with, acknowledged by the next confirm
  const [previews, setPreviews] = useState([]);

  // The audio element's ref: on detach (the sheet closing) it stops and drops its source (React 19 ref cleanup).
  const audioElement = useCallback((el) => {
    audioRef.current = el;
    if (!el) return undefined;
    return () => {
      playGenRef.current += 1;
      el.pause();
      el.removeAttribute('src');
      if (audioRef.current === el) audioRef.current = null;
    };
  }, []);

  // Stop when the page is hidden.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') return;
      playGenRef.current += 1;
      audioRef.current?.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // The deploy ceremony covering the page stops playback.
  useEffect(() => {
    if (!ceremonyActive) return;
    playGenRef.current += 1;
    audioRef.current?.pause();
  }, [ceremonyActive]);

  // Opened from a Reconfirm door (C15): land on the plan card's Reconfirm. After the sheet's own focus to Close (its
  // effect runs after this one), so a microtask; the reconfirm button takes focus, which scrolls it into view.
  useEffect(() => {
    if (!focusPlan) return;
    queueMicrotask(() => {
      const target = planRef.current?.querySelector('[data-huddle-reconfirm]');
      if (target) target.focus();
      else planRef.current?.scrollIntoView?.({ block: 'nearest' });
    });
  }, [focusPlan]);

  if (!huddle) {
    return <p data-huddle-empty="" style={{ margin: 0, color: ink2 }}>{read?.status === 'error' ? copy.loadError : read?.status === 'loading' ? copy.loading : copy.none}</p>;
  }
  // Not ready (still being made, or it could not be made): no transcript, no plan card, nothing to answer (review L3-2).
  if (huddle.status !== 'ready') {
    return <p data-huddle-empty={huddle.status ?? ''} style={{ margin: 0, color: ink2 }}>{huddle.status === 'failed' ? copy.unavailable : copy.preparing}</p>;
  }

  const plan = huddle.plan;
  const items = itemsOf(plan?.current);
  const beats = huddle.script?.beats || [];
  const activeBeat = beats.find((b) => typeof b.startMs === 'number' && typeof b.endMs === 'number' && positionMs >= b.startMs && positionMs <= b.endMs)?.id ?? null;

  const markListened = () => {
    if (listenedRef.current) return;
    listenedRef.current = true;
    sendHuddleEvent({ etDate: huddle.etDate, kind: 'listened' }).catch(() => {});
  };
  const play = async () => {
    const el = audioRef.current;
    if (!el || ceremonyActive) return;
    if (playing) { el.pause(); return; }
    const gen = playGenRef.current;
    const stillWanted = () => gen === playGenRef.current && audioRef.current === el && !ceremonyRef.current && document.visibilityState === 'visible';
    try {
      // Paused part-way: resume where it stopped (review L3-10). An expired URL fails here, and a fresh one is asked for.
      if (el.getAttribute('src') && !el.ended) {
        try { await el.play(); markListened(); return; } catch { /* fall through to a fresh URL */ }
      }
      const at = el.ended ? 0 : el.currentTime || 0;
      const { url } = await issueHuddlePlayback({ etDate: huddle.etDate });
      if (!stillWanted()) return;
      el.src = url;
      if (at > 0) el.currentTime = at;
      await el.play();
      markListened();
    } catch {
      if (stillWanted()) setAudioError(true);
    }
  };

  // Confirm and Skip never leave the sheet working: a thrown request is a failure like any other (review L3-5). The
  // player's removals and levels are cleared only when the plan they were made on is gone: confirmed, or a 409 / 422
  // that put the server's current version on the card. Any other failure keeps them, so a retry sends the same edits.
  const onConfirm = async () => {
    setBusy(true);
    setNotice(null);
    let r;
    const acknowledged = previews.length ? Object.fromEntries(previews.map((p) => [p.archetype, p.revision])) : null;
    try {
      r = await confirm({ baseRevision: plan.revision, replacement: replacementOf(items, removed, levels), acknowledged });
    } catch {
      r = { ok: false, status: 0, body: null };
    }
    setBusy(false);
    const previewed = r.status === 422 && r.body?.error === 'validation_changed';
    const replaced = r.ok || r.status === 409 || previewed;
    if (replaced) { setRemoved(new Set()); setLevels({}); }
    // the previews go with the plan they were made on (confirmed, a conflict, a new preview); any other failure keeps them,
    // so the retry still sends their acknowledgement (review HU-7)
    if (replaced) setPreviews(previewed && Array.isArray(r.body?.previews) ? r.body.previews : []);
    if (r.ok) return;
    if (r.status === 409) setNotice(copy.notices.conflict);
    else if (previewed) setNotice((r.body?.drops?.length || r.body?.transforms?.length) ? copy.notices.previewed : copy.notices.previewedApproaches);
    else if (r.status === 410) setNotice(copy.notices.closed);
    else setNotice(copy.notices[r.body?.error] ?? copy.notices.failed);
  };
  const onSkip = async () => {
    setBusy(true);
    setNotice(null);
    let r;
    try {
      r = await skip();
    } catch {
      r = { ok: false, status: 0 };
    }
    setBusy(false);
    if (r.ok) { setPreviews([]); return; } // a skipped plan has nothing to preview (review HU-7)
    setNotice(r.status === 410 ? copy.notices.closed : copy.notices.failed);
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
          ref={audioElement}
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
                onChange={(e) => { setPreviews([]); setLevels((prev) => ({ ...prev, [key]: e.target.value })); }}
                style={{ width: 84, minHeight: 44, borderRadius: 10, border: `1px solid ${hair}`, background: 'transparent', color: ink, padding: '0 8px' }}
              />
            )}
            {proposed && (
              <button type="button" style={buttonStyle} onClick={() => { setPreviews([]); setRemoved((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }}>
                {removed.has(key) ? copy.keep : copy.remove}
              </button>
            )}
          </div>
        ))}
        {(plan?.dissent || []).map((d) => <p key={`${d.archetype}-${d.ticker}-${d.from}`} style={{ margin: '6px 0 0', fontSize: 12.5, color: ink2 }}>{d.reason}</p>)}
        {previews.flatMap((p) => (p.changes || []).map((c) => (
          <p key={`preview-${p.archetype}-${c.ticker}-${c.from}`} data-huddle-preview={p.archetype} style={{ margin: '6px 0 0', fontSize: 13, color: ink }}>
            {copy.previewLine(p.archetypeName, p.games, copy.itemText(previewFromOf(plan, c), {}), copy.itemText({ kind: c.to, ticker: c.ticker }, {}))}
          </p>
        )))}
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: ink2 }}>{copy.instructionNote}</p>
        {notice && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: ink }}>{notice}</p>}
        {proposed && items.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" style={{ ...buttonStyle, borderColor: teal, color: teal, flex: 1 }} onClick={onConfirm} disabled={busy} data-huddle-confirm="">{busy ? copy.working : copy.confirm}</button>
            <button type="button" style={buttonStyle} onClick={onSkip} disabled={busy} data-huddle-skip="">{copy.skip}</button>
          </div>
        )}
        {confirmed && needsReconfirm && (
          // E1: an archetype in play has no confirmation — the same confirm files the missing ones only
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
