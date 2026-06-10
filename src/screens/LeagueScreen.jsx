// src/screens/LeagueScreen.jsx
//
// Provisional League Tournament placeholder — holds the retired Agent Hub's
// nav slot behind TOURNAMENT_TAB_ENABLED until the real League surface lands
// (Closeout Spec V1.1 §6). Intentionally minimal: no data, no controls.

import React from 'react';
import { Trophy } from 'lucide-react';
import { CMD, Mono } from '../components/Dashboard/commandUI';

export default function LeagueScreen() {
  return (
    <div style={{
      minHeight: '100vh', background: CMD.bg, color: CMD.ink,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 24px calc(env(safe-area-inset-bottom, 0px) + 130px)',
      textAlign: 'center', boxSizing: 'border-box',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: CMD.surface, border: `1px solid ${CMD.hair2}`, marginBottom: 18,
      }}>
        <Trophy size={28} color={CMD.gold} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>League</div>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: CMD.ink2, maxWidth: 360, margin: '10px 0 0' }}>
        Tournaments are coming. Your agent’s battles will count here.
      </p>
      <Mono style={{ fontSize: 9.5, letterSpacing: '0.18em', color: CMD.ink3, textTransform: 'uppercase', marginTop: 16 }}>
        Coming soon
      </Mono>
    </div>
  );
}
