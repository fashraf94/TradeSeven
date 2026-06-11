// src/screens/TournamentDevScreen.jsx
//
// P1a — founder smoke-test surface for the tournament user layer, reachable
// ONLY via ?tournamentDev=1 (founder-ratified June 11, 2026). This is dev
// tooling, not the product surface: battle-view composition is P7 and
// TOURNAMENT_TAB_ENABLED stays false until P9. The picks row doubles as the
// Spec §1.5 user-strip skeleton (direction badges per the SHORT precedent;
// the flip affordance arrives with the P1b flip endpoint).
//
// Admin actions (seed / resolve) take the admin secret from a field held in
// component state only — never persisted — and send it as X-Admin-Secret.

import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import BoardEditor from '../components/Tournament/BoardEditor';
import { subscribeGroup } from '../services/tournamentGroupService';
import { GROUP_STATUS } from '../constants/leagueTournament';

const STATUS_COLORS = {
  [GROUP_STATUS.FORMING]: '#f59e0b',
  [GROUP_STATUS.DRAFTING]: '#38bdf8',
  [GROUP_STATUS.BATTLE]: '#10b981',
  [GROUP_STATUS.COMPLETE]: '#a78bfa',
};

function DirectionBadge({ direction }) {
  const short = direction === 'short';
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 6,
        background: short ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
        color: short ? '#ef4444' : '#10b981',
      }}
    >
      {short ? 'SHORT ↓' : 'LONG ↑'}
    </span>
  );
}

export default function TournamentDevScreen() {
  const { tokens } = useTheme();
  const { user } = useUser();
  const uid = user?.uid;

  const [secret, setSecret] = useState('');
  const [groupId, setGroupId] = useState('');
  const [attachedGroupId, setAttachedGroupId] = useState(null);
  const [group, setGroup] = useState(null);
  const [busy, setBusy] = useState(null); // 'seed' | 'resolve' | null
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!attachedGroupId) return undefined;
    return subscribeGroup(attachedGroupId, setGroup);
  }, [attachedGroupId]);

  function appendLog(line) {
    setLog(prev => [...prev.slice(-19), `${new Date().toISOString().slice(11, 19)}  ${line}`]);
  }

  async function adminPost(path, body, label) {
    setBusy(label);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      appendLog(`${label} OK`);
      return data;
    } catch (err) {
      appendLog(`${label} FAILED: ${err.message}`);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function seed() {
    const data = await adminPost(
      '/api/admin/seed-tournament-group',
      { founderUserId: uid, autoCommitBoards: true },
      'seed'
    );
    if (data?.groupId) {
      setGroupId(data.groupId);
      setAttachedGroupId(data.groupId);
      appendLog(`group ${data.groupId} · pool ${data.poolSize} · ${data.seededBoards.length} placeholder boards`);
    }
  }

  async function resolve() {
    const data = await adminPost(
      '/api/tournament/resolve-user-draft',
      { groupId: attachedGroupId },
      'resolve'
    );
    if (data?.status) appendLog(`status -> ${data.status} (${data.events?.length ?? 0} picks)`);
  }

  const card = {
    background: tokens.bgCard,
    border: `1px solid ${tokens.borderDivider}`,
    borderRadius: 10,
    padding: 14,
  };
  const input = {
    flex: 1,
    minWidth: 0,
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${tokens.borderInput}`,
    background: tokens.bgApp,
    color: tokens.textPrimary,
    fontSize: 13,
  };
  const btn = (active) => ({
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    fontWeight: 700,
    fontSize: 13,
    cursor: active ? 'pointer' : 'not-allowed',
    background: active ? '#38bdf8' : tokens.borderInput,
    color: active ? '#082f49' : tokens.textMuted,
  });

  if (!uid) {
    return (
      <div style={{ minHeight: '100vh', background: tokens.bgApp, color: tokens.textPrimary, padding: 24 }}>
        Sign in first — the board commit runs under your account.
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: tokens.bgApp, color: tokens.textPrimary, padding: 16 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>League Tournament — P1a dev surface</div>
          <div style={{ fontSize: 12, color: tokens.textMuted }}>
            Smoke-test only. Seed a group, commit your board, resolve the 3-pick draft.
          </div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Admin actions</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={input}
              type="password"
              placeholder="Admin secret (held in memory only)"
              value={secret}
              onChange={e => setSecret(e.target.value)}
            />
            <button style={btn(!!secret && !busy)} disabled={!secret || !!busy} onClick={seed}>
              {busy === 'seed' ? 'Seeding…' : 'Seed dev group'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={input}
              placeholder="…or attach an existing groupId"
              value={groupId}
              onChange={e => setGroupId(e.target.value.trim())}
            />
            <button
              style={btn(!!groupId)}
              disabled={!groupId}
              onClick={() => setAttachedGroupId(groupId)}
            >
              Attach
            </button>
            <button
              style={btn(!!secret && !!attachedGroupId && group?.status === GROUP_STATUS.FORMING && !busy)}
              disabled={!secret || !attachedGroupId || group?.status !== GROUP_STATUS.FORMING || !!busy}
              onClick={resolve}
            >
              {busy === 'resolve' ? 'Resolving…' : 'Resolve draft'}
            </button>
          </div>
          {log.length > 0 && (
            <pre style={{ margin: 0, fontSize: 11, color: tokens.textMuted, whiteSpace: 'pre-wrap' }}>
              {log.join('\n')}
            </pre>
          )}
        </div>

        {group && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Group {group.id}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[group.status] || tokens.textMuted }}>
                {String(group.status).toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted }}>
              Round {group.roundNumber} · {group.baseLayerWeek || group.bracketGameId} · pool {group.userPool?.length ?? 0} names
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(group.players || []).map(player => (
                <div
                  key={player.odUserId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: tokens.bgApp,
                    border: `1px solid ${player.odUserId === uid ? '#38bdf8' : tokens.borderInput}`,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, width: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {player.odUserId === uid ? 'You' : player.odUserId}
                  </span>
                  {/* User strip skeleton (Spec §1.5): 3 picks + direction badge.
                      Flip affordance + per-leg badge state arrive in P1b. */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(player.picks || []).length === 0 && (
                      <span style={{ fontSize: 12, color: tokens.textFaint }}>no picks yet</span>
                    )}
                    {(player.picks || []).map(pick => (
                      <span
                        key={pick.symbol}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
                      >
                        {pick.symbol}
                        <DirectionBadge direction={pick.legs?.[pick.legs.length - 1]?.direction} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {group && (
          <BoardEditor
            key={group.id}
            groupId={group.id}
            group={group}
            uid={uid}
            onCommitted={() => appendLog('board committed')}
          />
        )}
      </div>
    </div>
  );
}
