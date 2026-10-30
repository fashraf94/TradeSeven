// src/screens/SmokeLeagueForms.jsx
//
// SMOKE ONLY (claude/agent-form-s2-smoke, NEVER MERGE): the League's real arena on recorded fixtures, for a founder with
// no live League game. `?leagueForms=1` opens it full screen, ahead of sign-in, as the S0 lab does. Nothing here is a new
// renderer: ArenaMobile, ArenaDesktop and ClimbArena are the shipped components, and the chips only change the data they
// are handed, so every mood and every set can be seen by choosing a standing.

import React from 'react';
import '../components/League/battleArena/battleArena.css';
import { ArenaMobile } from '../components/League/battleArena/ArenaMobile';
import { ArenaDesktop } from '../components/League/battleArena/ArenaDesktop';
import { ClimbArena } from '../components/League/battleArena/ClimbArena';
import { buildFixtureModel } from '../components/League/battleArena/buildFixtureModel';
import { LeagueAgentFormScope } from '../components/League/battleArena/leagueAgentFormSlot';
import { AD_W, AD_H } from '../components/League/battleArena/arenaLayout';
import { useSmokeReadout } from '../components/CommandCenter/HubAgentForm';

const YOU = 'atlas';
const SETS = [['momentum_chaser', 'Trend Follower'], ['diversifier', 'Diversifier'], ['degen', 'Speculator'], ['contrarian', 'Contrarian'], ['guardian', 'Capital Preserver'], ['analyst', 'Fundamental Inv.'], [null, 'No armor']];
const ORDERS = {
  'You first': ['atlas', 'vela', 'helios', 'ember'],
  'You second': ['vela', 'atlas', 'helios', 'ember'],
  'You third': ['vela', 'helios', 'atlas', 'ember'],
  'You last': ['vela', 'helios', 'ember', 'atlas'],
  'All level': null,
};
// Each seat's total, top of the board first. Today's move is a fifth of it.
const SCORES = { Spread: [44.2, 31.5, 18.9, 6.4], Bunched: [44.2, 44, 43.8, 43.6], 'High day': [400, 360, 325, 250] };
const STATES = { Live: ['live', false], 'Game over': ['complete', false], Voided: ['complete', true], 'Before the bell': ['awaiting', false] };

function model({ set, order, scores, unknownRival, state }) {
  const base = buildFixtureModel(state);
  const archOf = { vela: unknownRival ? null : 'analyst', atlas: set, helios: 'contrarian', ember: 'guardian' };
  const seats = base.seats.map((s) => ({ ...s, archId: archOf[s.id] }));
  const ids = seats.map((s) => s.id);
  const value = (id) => (order ? SCORES[scores][order.indexOf(id)] : 20);
  const values = Object.fromEntries(ids.map((id) => [id, value(id)]));
  const seeds = Object.fromEntries(ids.map((id) => [id, value(id) * 0.8]));
  const rank = order ? order.indexOf(YOU) + 1 : 1;
  // A finished group, as a real one reads: five banked closes and no live trail.
  if (state === 'complete') {
    const climb = Object.fromEntries(ids.map((id) => [id, [1, 2, 3, 4, 5].map((d) => (values[id] * d) / 5)]));
    return { ...base, seats, climb, beats: [], youRank: rank, trail: null };
  }
  const climb = Object.fromEntries(ids.map((id) => [id, [seeds[id]]]));
  const t = Date.parse('2026-10-29T18:00:00Z');
  return { ...base, seats, climb, beats: [], youRank: rank, trail: { seeds, samples: {}, head: { t, values } } };
}

const chip = (on) => ({ cursor: 'pointer', flexShrink: 0, padding: '5px 8px', borderRadius: 7, font: '11px/1 ui-monospace, monospace', whiteSpace: 'nowrap', color: on ? '#050609' : '#cfd6e0', background: on ? '#5EEAD4' : 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)' });

function Row({ title, items, value, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
      <span style={{ font: '9px/1 ui-monospace, monospace', color: '#8a93a1', width: 44, flexShrink: 0 }}>{title}</span>
      {items.map(([key, label]) => <span key={String(key)} role="button" tabIndex={0} onClick={() => onPick(key)} style={chip(key === value)}>{label}</span>)}
    </div>
  );
}

export default function SmokeLeagueForms() {
  useSmokeReadout('live'); // the hub's corner readout, here too: this page draws four live forms at once
  const [set, setSet] = React.useState('momentum_chaser');
  const [orderName, setOrder] = React.useState('You second');
  const [scores, setScores] = React.useState('Spread');
  const [stateName, setState] = React.useState('Live');
  const [mode, setMode] = React.useState('ranked');
  const [view, setView] = React.useState('fuse');
  const [unknownRival, setUnknown] = React.useState(false);
  const [state, voided] = STATES[stateName];
  const data = React.useMemo(() => model({ set, order: ORDERS[orderName], scores, unknownRival, state }), [set, orderName, scores, unknownRival, state]);
  const wide = typeof window !== 'undefined' && window.innerWidth >= 768;
  const scale = wide ? Math.min(1, (window.innerWidth - 32) / AD_W) : 1;
  const bar = (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 8px calc(8px + env(safe-area-inset-bottom))', background: 'rgba(5,6,9,.94)', borderTop: '1px solid rgba(255,255,255,.14)' }}>
      <Row title="standing" items={Object.keys(ORDERS).map((k) => [k, k])} value={orderName} onPick={setOrder} />
      <Row title="scores" items={Object.keys(SCORES).map((k) => [k, k])} value={scores} onPick={setScores} />
      <Row title="game" items={Object.keys(STATES).map((k) => [k, k])} value={stateName} onPick={setState} />
      <Row title="armor" items={SETS} value={set} onPick={setSet} />
      <Row title="view" items={[['ranked', 'Ranked'], ['training', 'Training'], ['fuse', 'The arena'], ['climb', 'Lobby climb']]} value={view === 'climb' ? 'climb' : mode} onPick={(k) => { if (k === 'climb' || k === 'fuse') setView(k); else { setMode(k); setView('fuse'); } }} />
      <Row title="rival" items={[[false, 'Their armor known'], [true, 'One unknown']]} value={unknownRival} onPick={setUnknown} />
    </div>
  );
  // The lobby's preview reads no battle, so your seat has no archetype of its own: it comes from the scope, as on the real tab.
  const arena = view === 'climb' ? (
    <div style={{ padding: 12 }}>
      <ClimbArena key={stateName + mode} state={state} mode={mode} seats={data.seats.map((s) => (s.id === YOU ? { ...s, archId: null } : s))} climb={data.climb} youId={YOU} w={wide ? 800 : Math.max(280, window.innerWidth - 24)} h={wide ? 336 : 300} dayIdx={state === 'complete' ? 4 : 0} compact={!wide} voided={voided} />
    </div>
  ) : wide ? (
    <div style={{ width: AD_W * scale, height: AD_H * scale, overflow: 'hidden' }}>
      <div style={{ width: AD_W, height: AD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <ArenaDesktop key={state + mode} state={state} mode={mode} data={data} voided={voided} />
      </div>
    </div>
  ) : <ArenaMobile key={state + mode} state={state} mode={mode} data={data} voided={voided} />;
  return (
    <div style={{ minHeight: '100vh', background: '#050609', paddingBottom: 196 }}>
      <LeagueAgentFormScope battle={{ status: 'active', cronState: { evaluatingAt: null } }} youRank={data.youRank} youArchetype={set}>{arena}</LeagueAgentFormScope>
      {bar}
    </div>
  );
}
