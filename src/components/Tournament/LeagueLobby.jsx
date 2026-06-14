// src/components/Tournament/LeagueLobby.jsx
//
// P10b — the League front door: the new LeagueScreen state BEFORE a group
// exists, behind LEAGUE_LOBBY_ENABLED (flag-off keeps the coming-soon poster).
// Quick Play (solo → instant CPU-padded group), Create a group (private lobby +
// shareable join code), Join a game (typed code, or FIFO matchmake), and the
// open-lobby waiting view (who's waiting · seats N/4 · the CPU-fill honesty ·
// "Start now"). When the lobby forms, LeagueScreen's subscribeMyGroup returns
// the group and the existing forming→board flow takes over — this unmounts.
//
// Client-honest / server-authoritative (binding, P7-B): every button goes
// through tournamentLobbyActions (POST, Bearer); the UI reaches success ONLY
// after the server's 2xx (the action machine's `confirmed` is reachable only via
// an explicit confirm), and every error is surfaced via mapLobbyError (mapped
// copy, server message fallback — never swallowed). Reads are authoritative:
// subscribeMyLobby is the live truth for the waiting room.
//
// TWO UX MUSTS (founder): state "your game starts Monday" plainly (the honest
// mid-week-join lifecycle), and explain the CPU fill so a solo joiner expects
// bots. Tokens-native; reduced-motion-aware (no JS motion; the global
// prefers-reduced-motion rule in index.css neuters any CSS animation).

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Trophy, Zap, Users, UserPlus, Cpu, Play, Copy, Check, Clock, AlertCircle, CalendarDays } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { subscribeMyLobby } from '../../services/tournamentGroupService';
import {
  quickPlay, createLobby, joinLobby, matchmakeJoin, formLobby, mapLobbyError,
} from '../../services/tournamentLobbyActions';
import { actionReducer, initialActionState, isActionPending, ACTION_STATUS } from '../../utils/tournamentActionMachine';
import { LOBBY_MODE, LOBBY_STATUS, GROUP_SIZE, lobbyOpenSeatCount } from '../../constants/leagueTournament';

const MONDAY_LINE = 'Your game starts Monday — that’s when the draft runs and the trading week begins.';
const CPU_FILL_LINE = 'Empty seats become CPU opponents — you can start anytime.';

export default function LeagueLobby({ uid, displayName = null }) {
  const { tokens } = useTheme();
  const [lobby, setLobby] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeMyLobby(uid, (l) => { setLobby(l); setLoaded(true); });
  }, [uid]);

  // Once we've seen our OWN lobby, a later null means it left the open/forming
  // set — and FORMED is the only exit (no cancel path in V1). Remember that, so
  // the handoff holds the "forming" screen instead of flashing the front door
  // while LeagueScreen's SEPARATE group subscription catches up (the two
  // onSnapshot listeners have no ordering guarantee — a lobby filled by another
  // player can deliver lobby→null before group→set).
  const sawLobby = useRef(false);
  useEffect(() => { if (lobby) sawLobby.current = true; }, [lobby]);

  // One action in flight at a time across the whole front door (client-honest).
  const [state, dispatch] = useReducer(actionReducer, undefined, initialActionState);
  const inFlight = useRef(false);
  const run = async (fn) => {
    if (inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'submit' });
    try {
      const result = await fn();
      dispatch({ type: 'confirm', result });
    } catch (err) {
      dispatch({ type: 'reject', error: mapLobbyError(err) });
    } finally {
      inFlight.current = false;
    }
  };
  const pending = isActionPending(state);
  const dn = displayName || null;

  // A formation just succeeded (Quick Play / Start now / the join that sealed
  // the 4th seat): the group exists. Show the honest transition while the parent
  // subscribeMyGroup swaps to the board flow (this component then unmounts).
  const formedGroupId = state.status === ACTION_STATUS.CONFIRMED
    ? (state.result?.groupId || state.result?.formed?.groupId || null)
    : null;

  const card = { background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 };
  const muted = { fontSize: 12, color: tokens.textMuted, lineHeight: 1.55 };

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Trophy size={20} color={tokens.medalGold} />
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', flex: 1 }}>League</div>
    </div>
  );

  if (!loaded) {
    return (
      <>
        {Header}
        <div style={{ ...card, alignItems: 'center' }}>
          <p style={muted}>Checking the lobby…</p>
        </div>
      </>
    );
  }

  // The handoff screen: our own action formed the group (formedGroupId), OR our
  // lobby just left the open/forming set (it formed — sawLobby then null). Hold
  // here until LeagueScreen's group subscription swaps in the board flow.
  if (formedGroupId || (sawLobby.current && !lobby)) {
    return (
      <>
        {Header}
        <div style={{ ...card, alignItems: 'center', textAlign: 'center' }}>
          <Trophy size={26} color={tokens.medalGold} />
          <div style={{ fontSize: 16, fontWeight: 800 }}>Your group is forming</div>
          <p style={{ ...muted, maxWidth: 360 }}>Opening your draft board… {MONDAY_LINE}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {Header}
      {lobby
        ? <OpenLobbyView tokens={tokens} lobby={lobby} uid={uid} pending={pending}
            onStartNow={() => run(() => formLobby({ lobbyId: lobby.id }))} />
        : <FrontDoorChoices tokens={tokens} pending={pending} dn={dn} run={run} />}

      {state.status === ACTION_STATUS.ERROR && state.error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: tokens.red }}>
          <AlertCircle size={13} /> {state.error}
        </div>
      )}
    </>
  );
}

// ── No lobby yet: the three choices ─────────────────────────────────────────
function FrontDoorChoices({ tokens, pending, dn, run }) {
  const [code, setCode] = useState('');
  const card = { background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 };
  const primaryBtn = (enabled) => ({
    padding: '12px 14px', borderRadius: 10, border: 'none', cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? tokens.teal : tokens.bgElevated, color: enabled ? '#06201c' : tokens.textFaint, fontWeight: 800, fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  });
  const ghostBtn = (enabled) => ({
    padding: '11px 14px', borderRadius: 10, border: `1px solid ${tokens.borderInput}`, cursor: enabled ? 'pointer' : 'not-allowed',
    background: 'transparent', color: enabled ? tokens.textPrimary : tokens.textFaint, fontWeight: 700, fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  });
  const heading = { fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 };
  const note = { fontSize: 11.5, color: tokens.textFaint, lineHeight: 1.5 };
  const input = { flex: 1, background: tokens.bgApp, border: `1px solid ${tokens.borderInput}`, borderRadius: 9, color: tokens.textPrimary, padding: '10px 12px', fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Quick Play — the solo cold-start (primary) */}
      <div style={card}>
        <div style={heading}><Zap size={15} color={tokens.teal} /> Quick Play</div>
        <p style={note}>Jump in solo. {CPU_FILL_LINE} {MONDAY_LINE}</p>
        <button style={primaryBtn(!pending)} disabled={pending} onClick={() => run(() => quickPlay({ displayName: dn }))}>
          <Zap size={15} /> {pending ? 'Starting…' : 'Play now'}
        </button>
      </div>

      {/* Create a group — invite friends */}
      <div style={card}>
        <div style={heading}><Users size={15} color={tokens.medalGold} /> Create a group</div>
        <p style={note}>Open a private game and share the code with friends. Any seats still empty at start become CPUs.</p>
        <button style={ghostBtn(!pending)} disabled={pending} onClick={() => run(() => createLobby({ displayName: dn, mode: LOBBY_MODE.PRIVATE }))}>
          <Users size={14} /> {pending ? 'Creating…' : 'Create a group'}
        </button>
      </div>

      {/* Join a game — by code, or matchmake */}
      <div style={card}>
        <div style={heading}><UserPlus size={15} color={tokens.purpleText} /> Join a game</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={input}
            value={code}
            maxLength={12}
            placeholder="Enter code"
            onChange={(e) => setCode(e.target.value.trim())}
            onKeyDown={(e) => { if (e.key === 'Enter' && code && !pending) run(() => joinLobby({ joinCode: code, displayName: dn })); }}
          />
          <button style={ghostBtn(!pending && !!code)} disabled={pending || !code} onClick={() => run(() => joinLobby({ joinCode: code, displayName: dn }))}>
            {pending ? '…' : 'Join'}
          </button>
        </div>
        <p style={note}>Or let us match you into the next open game:</p>
        <button style={ghostBtn(!pending)} disabled={pending} onClick={() => run(() => matchmakeJoin({ displayName: dn }))}>
          <UserPlus size={14} /> {pending ? 'Finding…' : 'Find me a game'}
        </button>
      </div>
    </div>
  );
}

// ── In a lobby: the waiting room ────────────────────────────────────────────
function OpenLobbyView({ tokens, lobby, uid, pending, onStartNow }) {
  const members = lobby.members || [];
  const filled = members.length;
  const openSeats = lobbyOpenSeatCount(lobby);
  const isOwner = lobby.createdBy === uid;
  const isPrivate = lobby.mode === LOBBY_MODE.PRIVATE && !!lobby.joinCode;
  const isForming = lobby.status === LOBBY_STATUS.FORMING;

  const card = { background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={15} color={tokens.amber} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{isForming ? 'Forming your group…' : 'Waiting room'}</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted }}>{filled}/{GROUP_SIZE} seats</span>
      </div>

      {/* Roster: humans waiting, then the CPU seats that will fill the rest */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {members.map((m) => (
          <SeatRow
            key={m.odUserId}
            tokens={tokens}
            kind="human"
            label={m.odUserId === uid ? `${m.displayName || 'You'} (you)` : (m.displayName || 'Player')}
          />
        ))}
        {Array.from({ length: openSeats }).map((_, i) => (
          <SeatRow key={`cpu-${i}`} tokens={tokens} kind="cpu" label="CPU opponent" />
        ))}
      </div>

      {/* The CPU-fill honesty + the Monday lifecycle (the two UX musts) */}
      <div style={{ fontSize: 11.5, color: tokens.textFaint, lineHeight: 1.55, borderTop: `1px solid ${tokens.borderDivider}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><Cpu size={13} style={{ marginTop: 1, flexShrink: 0 }} /> {CPU_FILL_LINE}</span>
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><CalendarDays size={13} style={{ marginTop: 1, flexShrink: 0 }} /> {MONDAY_LINE}</span>
      </div>

      {isPrivate && <ShareBlock tokens={tokens} lobby={lobby} />}

      {isOwner && !isForming && (
        <button
          onClick={onStartNow}
          disabled={pending}
          style={{ padding: '12px 14px', borderRadius: 10, border: 'none', cursor: pending ? 'not-allowed' : 'pointer', background: pending ? tokens.bgElevated : tokens.teal, color: pending ? tokens.textFaint : '#06201c', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Play size={15} /> {pending ? 'Starting…' : 'Start now'}
        </button>
      )}
      {!isOwner && !isForming && (
        <p style={{ fontSize: 11.5, color: tokens.textMuted, textAlign: 'center' }}>Waiting for the host to start, or for the game to fill up.</p>
      )}
    </div>
  );
}

// ── One seat in the waiting-room roster (a human, or a CPU-to-be) ───────────
function SeatRow({ tokens, label, kind }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, background: tokens.bgElevated, border: `1px solid ${tokens.borderDivider}` }}>
      {kind === 'cpu' ? <Cpu size={14} color={tokens.textMuted} /> : <Users size={14} color={tokens.teal} />}
      <span style={{ fontSize: 13, fontWeight: kind === 'cpu' ? 500 : 700, color: kind === 'cpu' ? tokens.textFaint : tokens.textPrimary }}>{label}</span>
    </div>
  );
}

// ── Share the private join code ─────────────────────────────────────────────
// The 6-char code IS the share path (founder ruling): a friend enters it under
// "Join a game" and the server resolves it (findLobbyByJoinCode). No deep-link
// is shipped — an un-routed link would be decorative, so the code stands alone.
function ShareBlock({ tokens, lobby }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(lobby.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the code is visible to copy by hand */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: tokens.bgApp, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 700 }}>Invite friends with this code</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.22em', color: tokens.textPrimary }}>{lobby.joinCode}</span>
        <button
          onClick={copy}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 8, border: `1px solid ${tokens.borderInput}`, background: 'transparent', cursor: 'pointer', color: copied ? tokens.emerald : tokens.textMuted, fontSize: 11, fontWeight: 700 }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: tokens.textFaint, lineHeight: 1.5 }}>They enter it under “Join a game.”</div>
    </div>
  );
}
