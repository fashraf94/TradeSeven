// src/components/Tournament/BoardCommitFlow.jsx
//
// P5 — the board-commit surface's stateful wrapper (ratified proposal C):
// subscribes to the caller's OWN committed board doc and renders either
//   - the COMMITTED STATE: the ranked board read-only, committedAt, the
//     autoCommitted badge when the Monday deadline defaulted it (rider-#1
//     flag), and Edit & re-commit while the group is still forming — the
//     editor reopens seeded from the COMMITTED board while carrying the
//     ORIGINAL prefill snapshot forward (the rider delta keeps measuring
//     against what was suggested, not against the previous commit), or
//   - the EDITOR (BoardEditor): first-time flow with the core-derived
//     prefill, confirmation-gated commit.
// Once the group leaves forming the board renders locked with the
// draft-has-run copy — the playback CTA is the parent's (LeagueScreen).

import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Clock3, PencilLine } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import BoardEditor from './BoardEditor';
import { subscribeOwnBoard } from '../../services/tournamentGroupService';
import { GROUP_STATUS } from '../../constants/leagueTournament';

export default function BoardCommitFlow({ groupId, group, uid }) {
  const { tokens } = useTheme();
  const [ownBoard, setOwnBoard] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!groupId || !uid) return undefined;
    return subscribeOwnBoard(groupId, uid, (board) => {
      setOwnBoard(board);
      setLoaded(true);
    });
  }, [groupId, uid]);

  const isForming = group?.status === GROUP_STATUS.FORMING;

  if (!loaded) {
    return (
      <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: 14, fontSize: 13, color: tokens.textMuted }}>
        Loading your board…
      </div>
    );
  }

  if (!ownBoard || (editing && isForming)) {
    return (
      <BoardEditor
        key={`${groupId}-${editing ? 'recommit' : 'first'}`}
        groupId={groupId}
        group={group}
        uid={uid}
        initialBoard={editing && ownBoard ? ownBoard.board : null}
        initialPrefill={editing && ownBoard ? (ownBoard.prefillAsSuggested ?? []) : null}
        onCommitted={() => setEditing(false)}
      />
    );
  }

  const committedAt = String(ownBoard.committedAt ?? '').slice(0, 16).replace('T', ' ');

  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, color: tokens.textPrimary }}>Your draft board</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: tokens.emerald }}>
          <ClipboardCheck size={14} /> Committed {committedAt}
        </div>
      </div>

      {ownBoard.autoCommitted === true && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '8px 10px',
          borderRadius: 8, color: tokens.amber, border: `1px solid ${tokens.borderInput}`, background: tokens.bgElevated,
        }}>
          <Clock3 size={14} />
          {isForming
            ? 'Auto-committed at the deadline from your suggested names — edit below to make it yours.'
            : 'Auto-committed at the deadline from your suggested names.'}
        </div>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {(ownBoard.board || []).map((symbol, i) => (
          <li key={symbol} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, padding: '4px 8px', borderRadius: 6, background: tokens.bgElevated }}>
            <span style={{ width: 22, fontSize: 12, color: tokens.textFaint, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            <span style={{ fontWeight: 600, color: tokens.textPrimary }}>{symbol}</span>
          </li>
        ))}
      </ol>

      {isForming ? (
        <button
          onClick={() => setEditing(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 8, border: `1px solid ${tokens.borderInput}`,
            background: 'transparent', color: tokens.textSecondary, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <PencilLine size={14} /> Edit & re-commit
        </button>
      ) : (
        <div style={{ fontSize: 12, color: tokens.textMuted }}>
          Boards locked — the draft has run.
        </div>
      )}
    </div>
  );
}
