// src/components/League/liveDraft/LiveDraftPicker.jsx
//
// Competitive Live Draft (Phase 4) — the slot picker. The week's slots
// (config-driven, from GET /api/tournament/slot-schedule) with day/time in ET and
// a per-slot human count ("Sun 7:00pm ET · 3 humans waiting"); claim/release a
// seat via the Phase-1 endpoints. Lean and functional (not the hub); behind
// LEAGUE_LIVE_DRAFT (the endpoints 404 dark, and the caller gates the mount on the
// same flag). `tokens` is the League useTheme tokens (passed in) so this stays
// pure/smoke-testable.

import React, { useState, useEffect, useCallback } from 'react';
import { fetchSlotSchedule, claimSlot, releaseSlot, mapSlotActionError } from '../../../services/liveDraftActions';

function primaryBtn(t, enabled) {
  return { background: enabled ? t.teal : t.borderDivider, color: enabled ? '#04121f' : t.textFaint, border: 'none', borderRadius: 9, padding: '9px 16px', fontWeight: 700, cursor: enabled ? 'pointer' : 'default', whiteSpace: 'nowrap' };
}
function ghostBtn(t, enabled) {
  return { background: 'transparent', color: t.textMuted, border: `1px solid ${t.borderDivider}`, borderRadius: 9, padding: '9px 16px', fontWeight: 600, cursor: enabled ? 'pointer' : 'default', whiteSpace: 'nowrap' };
}

export default function LiveDraftPicker({ tokens, currentUserId, displayName = null, onEntered = null }) {
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try { const r = await fetchSlotSchedule(); setSlots(Array.isArray(r?.slots) ? r.slots : []); }
    catch (e) { setError(mapSlotActionError(e)); setSlots([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // `entered` fires onEntered for the CLAIM payoff only — a release must never
  // route the user into the game surface they just left.
  const run = async (fn, { entered = false } = {}) => {
    setPending(true); setError(null);
    try { await fn(); await load(); if (entered && onEntered) onEntered(); }
    catch (e) { setError(mapSlotActionError(e)); }
    finally { setPending(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>Pick a draft slot</div>
      <p style={{ color: tokens.textMuted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
        Claim a seat and the live draft fires at slot time. Empty seats fill with CPUs — a slot with at least one human always drafts.
      </p>

      {error && (
        <div style={{ color: '#ffd7de', background: '#3a1320', border: '1px solid #fb7185', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>{error}</div>
      )}

      {slots == null ? (
        <div style={{ color: tokens.textMuted, padding: 16, textAlign: 'center', fontSize: 13 }}>Loading slots…</div>
      ) : slots.length === 0 && !error ? (
        <div style={{ color: tokens.textMuted, padding: 16, textAlign: 'center', fontSize: 13 }}>No draft slots scheduled right now.</div>
      ) : (
        slots.map((slot) => {
          const mine = (slot.seats || []).some((s) => s.odUserId === currentUserId);
          return (
            <div key={slot.slotId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: tokens.bgCard, border: `1px solid ${mine ? tokens.medalGold : tokens.borderDivider}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{slot.label}</div>
                <div style={{ fontSize: 12, color: tokens.textMuted }}>
                  {slot.humanCount === 0 ? 'No one yet — be the first' : `${slot.humanCount} human${slot.humanCount === 1 ? '' : 's'} waiting`}
                  {slot.isFull ? ' · full' : ''}
                </div>
              </div>
              {mine ? (
                <button onClick={() => run(() => releaseSlot({ groupId: slot.groupId }))} disabled={pending} style={ghostBtn(tokens, !pending)}>Leave</button>
              ) : (
                <button onClick={() => run(() => claimSlot({ slotId: slot.slotId, displayName }), { entered: true })} disabled={pending || slot.isFull} style={primaryBtn(tokens, !pending && !slot.isFull)}>
                  {slot.isFull ? 'Full' : 'Claim seat'}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
