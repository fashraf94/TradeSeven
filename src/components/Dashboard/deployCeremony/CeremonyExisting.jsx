// src/components/Dashboard/deployCeremony/CeremonyExisting.jsx
//
// Deploy Ceremony · the existing-battle terminal (Command Center repair R1,
// ruling R-R1-6; spec V1.2 §5.2, the row "battleCreated:false with valid
// existingBattleId"). The server answered that the agent already has a running
// battle, so this deploy created nothing: no reveal, no "Enter the battle", no
// create callback, no synthetic id.
//
// Its one action opens the battle the server named, as the owned server
// document (existingBattle.js resolves it from the shell's live list or the
// target-scoped verifier and checks its owner). The owner is read again
// immediately before the open. A missing or foreign document reads "Couldn't
// open the running game" with Retry, which reads again and never POSTs.
//
// Command Center slice S2b (founder ruling Q-S2b-5): the optional `ownedRead`
// — `{ retry, retryAt }`, given only by the hub's root ceremony
// (src/contexts/DeployAttemptContext.jsx) — routes that Retry through the
// provider's one owned targeted read of the server's id: deduplicated per
// attempt, with its deadline, and after a failure its 30 s wait (`retryAt`),
// which the button counts down. Without it (today's shells pass nothing) Retry
// reads the live list and the verifier again, exactly as before.

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, Swords } from 'lucide-react';
import { CMD, alpha, readableOn, Mono, Eyebrow } from '../commandUI';
import { ownsExistingBattle, resolveExistingBattle } from './existingBattle';
import { signedInUid } from '../../../services/deployIdentity';

export const EXISTING_COPY = Object.freeze({
  eyebrow: 'Already running',
  headline: (name) => `${name} already has a game running.`,
  checking: 'Finding the running game…',
  open: 'Open game',
  unavailable: 'Couldn’t open the running game',
  retry: 'Retry',
  /** The owned read's wait after a failure (S2b, Q-S2b-5): CeremonyError.jsx's own words for a Retry not yet open. */
  retryIn: (secs) => `Retry available in ${secs}s`,
  subtext: 'No new game was started.',
});

const UNAVAILABLE = Object.freeze({ status: 'unavailable', battle: null });

export default function CeremonyExisting({
  accent = CMD.teal, agentName = 'Your agent', existingBattleId = null,
  liveBattles = null, verifyBattle = null, onOpenBattle, onDismiss, ownedRead = null,
}) {
  const ink = readableOn(accent);
  const [found, setFound] = useState({ status: 'checking', battle: null });
  const [run, setRun] = useState(0); // Retry re-reads; it never deploys
  // Read at resolution time, so a poll landing mid-read does not restart it.
  const liveRef = useRef(liveBattles);
  liveRef.current = liveBattles;
  // S2b (Q-S2b-5): every read here has a number, so an owned read a newer read overtook sets nothing.
  const readSeq = useRef(0);

  useEffect(() => {
    let alive = true;
    readSeq.current += 1;
    setFound({ status: 'checking', battle: null });
    resolveExistingBattle({
      existingBattleId, uid: signedInUid(), liveBattles: liveRef.current, verify: verifyBattle,
    }).then((r) => { if (alive) setFound(r); });
    return () => { alive = false; };
  }, [existingBattleId, verifyBattle, run]);

  // S2b (Q-S2b-5): the provider's owned read, when the hub gives one; its wait after a failure is counted down.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const owned = ownedRead && typeof ownedRead.retry === 'function' ? ownedRead : null;
  const retryAt = owned && Number.isFinite(owned.retryAt) ? owned.retryAt : 0;
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!retryAt) return undefined;
    setClock(Date.now());
    const iv = setInterval(() => {
      const t = Date.now();
      setClock(t);
      if (t >= retryAt) clearInterval(iv);
    }, 1000);
    // The Retry opens at the wait's end exactly, not on the next whole-second tick (review RL-3).
    const end = setTimeout(() => setClock(Date.now()), Math.max(0, retryAt - Date.now()));
    return () => { clearInterval(iv); clearTimeout(end); };
  }, [retryAt]);
  const waitSecs = retryAt ? Math.max(0, Math.ceil((retryAt - clock) / 1000)) : 0;

  const readOwned = () => {
    const seq = ++readSeq.current;
    setFound({ status: 'checking', battle: null });
    Promise.resolve().then(() => owned.retry()).then((r) => {
      if (!mounted.current || seq !== readSeq.current) return;
      // The same owner check as the live list's and the verifier's: the server's id, the signed-in owner.
      setFound(r?.status === 'found' && ownsExistingBattle(r.battle, existingBattleId, signedInUid())
        ? { status: 'found', battle: r.battle } : UNAVAILABLE);
    }, () => { if (mounted.current && seq === readSeq.current) setFound(UNAVAILABLE); });
  };

  const open = () => {
    if (found.status !== 'found') return;
    // Owner again, immediately before the navigation (spec §5.4).
    if (!ownsExistingBattle(found.battle, existingBattleId, signedInUid())) {
      setFound({ status: 'unavailable', battle: null });
      return;
    }
    onOpenBattle?.(found.battle);
  };

  const canOpen = found.status === 'found';
  const unavailable = found.status === 'unavailable';
  // ONE primary button, Retry while unavailable and Open otherwise. It is never
  // `disabled`: a focused button that becomes disabled loses focus to <body>
  // (the browser's focus fixup), so after Retry, Enter would do nothing once the
  // read found the game (review L3-2). While the read is pending it is
  // aria-disabled and its press does nothing. So is the owned read's Retry
  // during its wait (S2b, Q-S2b-5), which never happens without `ownedRead`.
  const waiting = unavailable && waitSecs > 0;
  const primaryLive = (unavailable && !waiting) || canOpen;
  const pressPrimary = () => {
    if (unavailable) {
      if (waiting) return;
      if (owned) readOwned();
      else setRun((r) => r + 1);
    } else if (canOpen) open();
  };

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: '0 22px', textAlign: 'center' }}>
      <Eyebrow color={accent} style={{ marginBottom: 8 }}>{EXISTING_COPY.eyebrow}</Eyebrow>
      <div style={{ fontSize: 18, fontWeight: 600, color: CMD.ink, lineHeight: 1.4, marginBottom: 14 }}>
        {EXISTING_COPY.headline(agentName)}
      </div>

      {found.status === 'checking' && (
        <div style={{ fontSize: 12.5, color: CMD.ink3, marginBottom: 14 }}>{EXISTING_COPY.checking}</div>
      )}
      {found.status === 'unavailable' && (
        <div role="status" style={{ fontSize: 12.5, color: CMD.ink2, marginBottom: 14 }}>{EXISTING_COPY.unavailable}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={pressPrimary}
          aria-disabled={primaryLive ? undefined : 'true'}
          style={unavailable ? {
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%',
            padding: '14px', borderRadius: 13, border: `1px solid ${alpha(accent, 0.5)}`,
            background: waiting ? 'transparent' : alpha(accent, 0.14), color: waiting ? CMD.ink3 : accent,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 14.5, cursor: waiting ? 'default' : 'pointer',
          } : {
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%',
            padding: '15px', borderRadius: 14, border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
            background: canOpen ? accent : alpha(accent, 0.18), color: canOpen ? ink : CMD.ink3,
            cursor: canOpen ? 'pointer' : 'default',
          }}
        >
          {unavailable
            ? <><RotateCcw size={16} /> {waiting ? EXISTING_COPY.retryIn(waitSecs) : EXISTING_COPY.retry}</>
            : <><Swords size={17} color={canOpen ? ink : CMD.ink3} /> {EXISTING_COPY.open}</>}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
            padding: '13px', borderRadius: 13, border: 'none', background: 'transparent', color: CMD.ink2,
            fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
          }}
        >
          <ArrowLeft size={15} /> Back to hub
        </button>
      </div>

      <Mono style={{ display: 'block', fontSize: 10.5, letterSpacing: '0.06em', color: CMD.ink3, marginTop: 14, lineHeight: 1.5 }}>
        {EXISTING_COPY.subtext}
      </Mono>
    </div>
  );
}
