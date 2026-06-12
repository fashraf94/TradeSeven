// src/components/Tournament/BoardEditor.jsx
//
// P1a — pre-committed draft board editor (Spec §1.5 / V2.1 §3). Built on the
// Forge watchlist-editor bones (TickerSearchAdd for adds) plus the ranking
// affordance the legacy editor doesn't have (up/down reorder). Prefill is the
// player's equipped-watchlist names + latest scout alerts (founder-confirmed
// June 11, 2026), freely editable; the as-suggested snapshot rides along to
// the commit endpoint, which computes and stores the rider-#1 delta
// server-side. All writes go through POST /api/tournament/commit-board — the
// tournamentGroups rules are client-read-only.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, X, ClipboardCheck } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import TickerSearchAdd from '../Forge/Watchlist/TickerSearchAdd';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { assembleBoardPrefill } from '../../services/tournamentGroupService';
import { TOURNAMENT_TUNING, GROUP_STATUS } from '../../constants/leagueTournament';

const { BOARD_DEPTH_MIN, BOARD_DEPTH_MAX } = TOURNAMENT_TUNING;

export default function BoardEditor({ groupId, group, uid, onCommitted }) {
  const { tokens } = useTheme();
  const [board, setBoard] = useState([]);
  const [prefill, setPrefill] = useState([]);
  const [loadingPrefill, setLoadingPrefill] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(null);
  const [error, setError] = useState(null);
  const seededRef = useRef(false);

  const poolSet = useMemo(() => new Set(group?.userPool || []), [group]);
  const isForming = group?.status === GROUP_STATUS.FORMING;

  // Seed once per group, when the group (and so its pool) is available.
  // Prefill names outside the draftable pool are dropped — they couldn't be
  // drafted; the ∩ pool step lives in the shared prefill core (P5), so the
  // server auto-commit twin derives the identical suggestion. Deps are the
  // stable group id, not the group object: live subscription updates to the
  // same group must neither cancel an in-flight prefill nor clobber the
  // user's edits with a re-seed.
  useEffect(() => {
    if (seededRef.current || !group || !uid) return undefined;
    seededRef.current = true;
    const userPool = group.userPool || [];
    let cancelled = false;
    (async () => {
      const suggested = await assembleBoardPrefill(uid, { userPool });
      if (!cancelled) {
        setPrefill(suggested);
        setBoard(suggested);
        setLoadingPrefill(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id, uid]);

  function move(index, dir) {
    setBoard(prev => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function remove(index) {
    setBoard(prev => prev.filter((_, i) => i !== index));
  }

  function add(symbol) {
    const upper = String(symbol || '').trim().toUpperCase();
    if (!upper) return;
    if (!poolSet.has(upper)) {
      setError(`${upper} is not in this group's draftable pool.`);
      return;
    }
    setError(null);
    setBoard(prev => (prev.includes(upper) || prev.length >= BOARD_DEPTH_MAX ? prev : [...prev, upper]));
  }

  async function commit() {
    setCommitting(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/tournament/commit-board', {
        method: 'POST',
        body: JSON.stringify({ groupId, board, prefillAsSuggested: prefill }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Commit failed (${res.status})`);
      }
      setCommitted(data);
      if (onCommitted) onCommitted(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  }

  const depthOk = board.length >= BOARD_DEPTH_MIN && board.length <= BOARD_DEPTH_MAX;
  const canCommit = isForming && depthOk && !committing;

  const card = {
    background: tokens.bgCard,
    border: `1px solid ${tokens.borderDivider}`,
    borderRadius: 10,
    padding: 14,
  };
  const iconBtn = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: tokens.textMuted,
    padding: 2,
    lineHeight: 0,
  };

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 700, color: tokens.textPrimary }}>Your draft board</div>
        <div style={{ fontSize: 12, color: depthOk ? tokens.textMuted : '#f59e0b' }}>
          {board.length} ranked · needs {BOARD_DEPTH_MIN}–{BOARD_DEPTH_MAX}
        </div>
      </div>

      {loadingPrefill && (
        <div style={{ fontSize: 13, color: tokens.textMuted }}>Assembling your suggested board…</div>
      )}

      {!loadingPrefill && board.length === 0 && (
        <div style={{ fontSize: 13, color: tokens.textMuted }}>
          No suggestions found — search below to build your board from scratch.
        </div>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {board.map((symbol, i) => (
          <li
            key={symbol}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 8,
              background: tokens.bgApp,
              border: `1px solid ${tokens.borderInput}`,
            }}
          >
            <span style={{ width: 22, fontSize: 12, color: tokens.textFaint, textAlign: 'right' }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 600, color: tokens.textPrimary, fontSize: 13 }}>{symbol}</span>
            {prefill.includes(symbol) && (
              <span style={{ fontSize: 10, color: tokens.textFaint }}>suggested</span>
            )}
            <button style={iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${symbol} up`}>
              <ArrowUp size={14} />
            </button>
            <button style={iconBtn} onClick={() => move(i, +1)} disabled={i === board.length - 1} aria-label={`Move ${symbol} down`}>
              <ArrowDown size={14} />
            </button>
            <button style={{ ...iconBtn, color: '#ef4444' }} onClick={() => remove(i)} aria-label={`Remove ${symbol}`}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ol>

      <TickerSearchAdd
        tokens={tokens}
        existingSymbols={board}
        atCap={board.length >= BOARD_DEPTH_MAX}
        onAdd={add}
      />

      {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}

      {committed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981' }}>
          <ClipboardCheck size={15} />
          Board committed {committed.committedAt} — re-commit while the group is forming to revise.
        </div>
      ) : null}

      <button
        onClick={commit}
        disabled={!canCommit}
        style={{
          padding: '10px 14px',
          borderRadius: 8,
          border: 'none',
          fontWeight: 700,
          cursor: canCommit ? 'pointer' : 'not-allowed',
          background: canCommit ? '#10b981' : tokens.borderInput,
          color: canCommit ? '#06281e' : tokens.textMuted,
        }}
      >
        {committing ? 'Committing…' : committed ? 'Re-commit board' : 'Commit board'}
      </button>
      {!isForming && (
        <div style={{ fontSize: 12, color: tokens.textMuted }}>
          Boards lock once the group leaves forming.
        </div>
      )}
    </div>
  );
}
