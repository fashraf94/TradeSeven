// src/screens/filmRoomV2/FilmRoomScreenV2.jsx
//
// Film Room v2 (A2) — THE SHELL (spec V1.2 §7; Amendment E BA-40 … BA-49;
// design of record docs/design/20261008_FILM_ROOM_A2_MOCKUP.html). Reached
// only through FilmRoomRoute, and only where FILM_ROOM_V2_MODE resolves on for
// the battle's owner; everyone else gets the legacy screen byte for byte.
//
//   reads     one getDoc of tape/{etDate} per selected day; series only when
//             the Deep dive opens; never a battle-document subscription — the
//             route already holds the battle (filmRoomData.js)
//   header    back, the day's pills, the title, the depth control, ONE
//             number-kind legend (BA-42), the day picker for a multi-day
//             battle, and the named EMPTY later-release regions (BA-47)
//   body      the first-open notice once per viewer (BA-49), then Glance,
//             Study or Deep dive; a day with no tape says so, and names a
//             scheduled pass only when one is actually scheduled (§7)

import React, { useEffect, useMemo, useState } from 'react';
import { FILM_TAPE_WRITE_ENABLED } from '../../config/featureFlags';
import { filmRoomBattleId } from '../../utils/filmRoomGate';
import { isSessionDate, isBattleDay, closePassStartMs, closePassEndMs, closePassWillTape, validFinalTradingDay, etDateOf } from '../../utils/tapeSchedule';
import { etClock, etDateLabel } from './filmRoomModel';
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';
import { useTapeDay, useSeriesDay, firestoreReaders } from './filmRoomData';
import { hasSeenFirstOpen, markFirstOpenSeen } from './filmRoomSeen';
import { C, card, eyebrow, body, mono, plain, Label, KindLegend, Segmented, Chip, PrimaryButton, When, Rec, EmptyCard } from './FilmRoomKit';
import FilmRoomGlance from './FilmRoomGlance';
import FilmRoomStudy from './FilmRoomStudy';
import FilmRoomDeepDive from './FilmRoomDeepDive';

const DESKTOP_QUERY = '(min-width: 1024px)';

/** Desktop layout at ≥ 1024 px; the phone layout otherwise (and wherever matchMedia is absent). */
const mediaQuery = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DESKTOP_QUERY) : null);
function useDesktop() {
  const [desktop, setDesktop] = useState(() => Boolean(mediaQuery()?.matches));
  useEffect(() => {
    const mq = mediaQuery();
    if (!mq) return undefined;
    const on = () => setDesktop(Boolean(mq.matches));
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', on); else if (typeof mq.addListener === 'function') mq.addListener(on);
    return () => { if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', on); else if (typeof mq.removeListener === 'function') mq.removeListener(on); };
  }, []);
  return desktop;
}

/** The battle's trading days: the timeline it records, else the one day its own instants name. */
export function battleDays(battle) {
  const days = battle?.timing?.tradingDays;
  if (Array.isArray(days) && days.length) return days.filter((d) => typeof d === 'string');
  const one = etDateOf(battle?.completedAt ?? battle?.activatedAt ?? battle?.createdAt);
  return one ? [one] : [];
}

/** The day the screen opens on: a completed battle's last day; an active battle's latest day that has begun. */
export function defaultDay(battle, days, nowMs) {
  if (!days.length) return null;
  if (battle?.status === 'completed') return days[days.length - 1];
  const today = etDateOf(nowMs);
  const begun = days.filter((d) => !today || d <= today);
  return begun.length ? begun[begun.length - 1] : days[0];
}

/** §7: when a day has no tape, name its close pass only when one is actually scheduled. */
export function noTapeLine(battle, etDate, nowMs) {
  if (!FILM_TAPE_WRITE_ENABLED || !etDate) return COPY.noTapeUnavailable;
  if (isSessionDate(etDate) && isBattleDay(battle, etDate) && nowMs < closePassEndMs(etDate)) {
    return COPY.noTapeScheduled(etClock(new Date(closePassStartMs(etDate)).toISOString()));
  }
  if (validFinalTradingDay(battle) === etDate && closePassWillTape(battle, nowMs)) return COPY.noTapeLater;
  return COPY.noTapeUnavailable;
}

function Reserved({ names, region }) {
  // BA-47: named, EMPTY regions for the later release — nothing renders in them.
  return (
    <div data-reserved-region={region} aria-hidden="true">
      {names.map((n) => <div key={n} data-reserved-slot={n} />)}
    </div>
  );
}

function FirstOpenNotice({ onDismiss }) {
  return (
    <div data-region="first-open" style={{ ...card, gap: 8, borderLeft: `3px solid ${C.gold}` }}>
      <span style={{ ...eyebrow, color: C.gold }}>{COPY.firstOpenEyebrow}</span>
      <p style={body}>{COPY.firstOpen}</p>
      <div style={{ display: 'flex' }}><PrimaryButton onClick={onDismiss}>{COPY.gotIt}</PrimaryButton></div>
    </div>
  );
}

const pill = (accent) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, ...mono(10, accent || C.ink2, { fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }), background: C.wash, border: `1px solid ${accent || C.hair2}` });

/**
 * @param {object}   props.battle    the battle the route opened (never re-read here)
 * @param {Function} props.onBack
 * @param {string}   [props.viewerId] the signed-in viewer's uid (the first-open notice is per viewer)
 * @param {object}   [props.readers]  test seam: { readTape, readSeries }
 * @param {number}   [props.nowMs]    test seam: the instant "scheduled" is judged at
 */
export default function FilmRoomScreenV2({ battle, onBack, viewerId = null, readers = firestoreReaders, nowMs }) {
  const now = useMemo(() => (Number.isFinite(nowMs) ? nowMs : Date.now()), [nowMs]);
  const battleId = filmRoomBattleId(battle);
  const days = useMemo(() => battleDays(battle), [battle]);
  const [day, setDay] = useState(() => defaultDay(battle, days, now));
  const [depth, setDepth] = useState('glance');
  const [selected, setSelected] = useState(null);
  const [sym, setSym] = useState(null);
  const [notice, setNotice] = useState(() => !hasSeenFirstOpen(viewerId));
  const desktop = useDesktop();
  useEffect(() => { if (notice) markFirstOpenSeen(viewerId); }, [notice, viewerId]);

  const tapeState = useTapeDay(battleId, day, readers);
  const tape = tapeState.status === 'ready' ? tapeState.tape : null;
  const written = Boolean(tape && Array.isArray(tape.checks));
  const seriesState = useSeriesDay(battleId, day, tape?.ownerId ?? null, depth === 'deep' && written, readers);

  const changeDay = (d) => { setDay(d); setSelected(null); setSym(null); };
  const openDeep = (s) => { setSym(s); setDepth('deep'); };
  const jump = (id) => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const agentName = battle?.agentContext?.agentName || battle?.agentName || null;
  // The battle's status, not the day's: an earlier day's tape was written while the battle was live (review A2L1-3).
  const complete = battle?.status === 'completed' || tape?.battle?.status === 'completed';
  const lastDay = days.length ? days[days.length - 1] : null;
  const finalDay = complete && lastDay && day !== lastDay && tape?.battle?.status !== 'completed'
    ? { label: etDateLabel(lastDay, { short: true }), open: () => changeDay(lastDay) }
    : null;

  let content;
  if (!battleId || !day) content = <EmptyCard>{COPY.noTape} · {COPY.noTapeUnavailable}</EmptyCard>;
  else if (tapeState.status === 'loading') content = <div data-state="loading" style={mono(12, C.ink3, { padding: 24, textAlign: 'center' })}>{COPY.loading}</div>;
  else if (tapeState.status === 'error') content = <div data-state="error"><EmptyCard>{COPY.readError}</EmptyCard></div>;
  else if (tapeState.status === 'missing') content = <div data-state="missing"><EmptyCard>{COPY.noTape} · {noTapeLine(battle, day, now)}</EmptyCard></div>;
  else if (tape?.passes?.close?.status === 'skipped_mode') content = <div data-state="skipped-mode"><EmptyCard>{COPY.skippedMode}</EmptyCard></div>;
  else if (!written) content = <div data-state="not-written"><EmptyCard><Rec>{COPY.closeNotWritten(tape?.passes?.close?.status || 'unknown')}</Rec></EmptyCard></div>;
  else if (depth === 'glance') content = <FilmRoomGlance tape={tape} desktop={desktop} selected={selected} onSelect={setSelected} finalDay={finalDay} />;
  else if (depth === 'study') content = <FilmRoomStudy tape={tape} desktop={desktop} onDeep={openDeep} selected={selected} onSelect={setSelected} jump={jump} />;
  else content = <FilmRoomDeepDive tape={tape} seriesState={seriesState} sym={sym} onSym={setSym} desktop={desktop} />;

  return (
    <div data-screen="film-room-v2" style={{ minHeight: '100vh', background: C.bg, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: C.raised }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: desktop ? 1240 : undefined, margin: '0 auto', boxSizing: 'border-box', padding: desktop ? '8px 24px 12px' : '6px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" onClick={onBack} style={{ ...plain, display: 'flex', alignItems: 'center', gap: 4, color: C.teal, padding: '8px 6px', minHeight: 44, borderRadius: 8 }}>
            <Label size={13}><span aria-hidden="true">‹</span> {COPY.back}</Label>
          </button>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={pill(C.teal)}>{COPY.title}</span>
            <span style={pill()}><When>{etDateLabel(day, { short: true }) ?? ''}</When> · {complete ? COPY.battleComplete : COPY.battleActive}</span>
          </div>
        </div>
        <Reserved region="header" names={COPY.reservedHeader} />
        <div style={{ display: 'flex', alignItems: desktop ? 'center' : 'stretch', flexDirection: desktop ? 'row' : 'column', gap: desktop ? 16 : 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: desktop ? 18 : 16, fontWeight: 800, letterSpacing: '-0.01em', color: C.ink, lineHeight: 1.1 }}>{COPY.title}</h1>
            <span style={mono(9.5, C.ink3, { letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>
              {agentName ? <><Rec>{agentName}</Rec> · </> : null}<When>{etDateLabel(day) ?? ''}</When>
            </span>
          </div>
          <div style={{ width: desktop ? 400 : 'auto', marginLeft: desktop ? 24 : 0, flexShrink: 0 }}>
            <Segmented value={depth} onChange={setDepth} options={COPY.depths} />
          </div>
          <KindLegend style={desktop ? { marginLeft: 'auto', justifyContent: 'flex-end', maxWidth: 520 } : undefined} />
        </div>
        {days.length > 1 ? (
          <div data-region="day-picker" style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
            <span style={mono(9.5, C.ink3, { letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0 })}>{COPY.dayPicker}</span>
            {days.map((d) => <Chip key={d} on={d === day} onClick={() => changeDay(d)}><When>{etDateLabel(d, { short: true })}</When></Chip>)}
          </div>
        ) : null}
        </div>
      </header>
      <main style={{ flex: 1, width: '100%', maxWidth: desktop ? 1240 : undefined, margin: '0 auto', boxSizing: 'border-box', padding: desktop ? '18px 24px 48px' : '12px 12px 40px', display: 'flex', flexDirection: 'column', gap: desktop ? 18 : 14 }}>
        {notice ? <FirstOpenNotice onDismiss={() => setNotice(false)} /> : null}
        {/* Keyed by the day: a depth's own state (an opened marker, a plan filter, an opened rationale) never carries into another day's tape (review A2L3-3, A2L3-4). */}
        <div key={day || 'none'} role="tabpanel" aria-label={COPY.depths.find((d) => d.id === depth)?.label} style={{ display: 'flex', flexDirection: 'column', gap: desktop ? 18 : 14 }}>{content}</div>
      </main>
      <footer style={{ padding: 0 }}>
        <Reserved region="footer" names={COPY.reservedFooter} />
      </footer>
    </div>
  );
}
