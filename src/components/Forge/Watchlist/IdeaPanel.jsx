// src/components/Forge/Watchlist/IdeaPanel.jsx
//
// Pilot P1a — the "Idea" panel on the saved-watchlist screen (pilot spec
// docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md §2.1–§2.5):
// the current version's statement, time-frame, status and dates, the version
// history, and the moves legal for each version — including "save as a new
// version", the only way content ever changes.
//
// GATED TWICE, and it NEVER GUESSES (review L4-1; the useCockpitStatus.js
// precedent for the same allowlist): HYPOTHESIS_RECORDS_ENABLED false → the
// panel renders nothing and makes no request; true → it renders NOTHING until
// the server's first answer proves the gate is on for this player. A
// `disabled` answer hides it; so does a first-load failure that comes before
// the gate's verdict (rate limit, network, an untyped error) — only an error
// the server can raise AFTER admitting the player shows the error card.
//
// The offered moves come from the SAME table the routes enforce
// (src/constants/hypothesisRecords.js legalActionsFor). The server is the
// authority: after every move the panel reloads the record (and stays busy
// until it has), and a typed refusal is shown. An editor captures its
// request — opId, the pointer it was opened against, the version it targets —
// when it OPENS, so a retry after a lost response is the identical request
// and replays idempotently (review L2-1 / L4-2); a 409 conflict closes it.
// Lifecycle sentences are table C verbatim (ideaCopy.js), filled only from
// the version's own record. Colors are the existing theme tokens only.
//
// Pilot P2: the panel also says what research stands behind the list — one
// line per research record (ideaCopy.js researchLinesOf), every number a
// stage count from the record — and, when the player marked the current
// version researched themselves (founder ruling D4), says so in words
// distinct from research done with the agent. It arrives with the version
// list, behind the same gate: nothing new renders when the panel does not.

import React, { useCallback, useEffect, useState } from 'react';
import { isHypothesisRecordsOn } from '../../../config/featureFlags';
import { HORIZON_ENUMS, TERMINAL_STATUSES, STATE_REASONS, legalActionsFor } from '../../../constants/hypothesisRecords';
import {
  listHypothesisVersions, createHypothesisVersion, transitionHypothesis, reaffirmHypothesis, newOpId,
} from '../../../services/hypothesisVersionService';
import {
  LIFECYCLE_LINES, fillLine, ideaSymbolOf, windowTextOf, formatIdeaDate,
  STATUS_LABELS, ACTION_LABELS, HORIZON_LABELS, HORIZON_SOURCE_LABELS, PANEL_COPY, RESEARCH_COPY, researchLinesOf,
} from './ideaCopy';
import SectionLabel from './SectionLabel';

const STATEMENT_MAX = 1000;
const MISSING_EVIDENCE_MAX = 300;
const CLOSING = ['reject', 'cancel', 'retire'];
/** Moves that carry the idea forward (styled as the primary action). */
const FORWARD = ['ready', 'reaffirm', 'mark_researched'];
/** Typed errors the routes raise only AFTER the gate admitted the caller — proof the gate is on. */
const POST_GATE_ERRORS = new Set(['not_found', 'forbidden', 'server_error', 'pointer_corrupt', 'invalid_watchlist_id', 'invalid_version']);
/** Refusals that mean the editor's request can no longer apply as opened. */
const STALE_REQUEST = new Set(['version_conflict', 'op_conflict', 'illegal_transition']);

/**
 * The table-C sentence for a version's state, or null when none applies or a
 * placeholder has no recorded value. `invalidated` renders nothing in P1a:
 * [typed condition] is the MET condition on the record, which P3/P4 define —
 * a raw reason code is never put into a blessed sentence (review L1-6).
 */
export function lifecycleLineFor(version) {
  if (!version || version.status !== 'review_due') return null;
  const sym = ideaSymbolOf(version);
  if (version.stateReason === 'horizon_elapsed') return fillLine(LIFECYCLE_LINES.reviewDueHorizon, { sym, window: windowTextOf(version.horizonEnum) });
  if (version.stateReason === 'battle_ended') return fillLine(LIFECYCLE_LINES.reviewDueBattleEnded, { sym });
  return null;
}

/** A refusal's words: the server's typed message, else the panel's fallback (never a raw browser string). */
function messageOf(err) {
  return typeof err?.status === 'number' && err?.body && typeof err.body.message === 'string' ? err.body.message : PANEL_COPY.moveFailed;
}

function statusColor(tokens, status) {
  if (status === 'ready' || status === 'activated') return tokens.teal;
  if (status === 'review_due' || status === 'waiting_for_evidence') return tokens.amber;
  if (status === 'invalidated') return tokens.red;
  if (TERMINAL_STATUSES.includes(status)) return tokens.textFaint;
  return tokens.purpleText;
}

export default function IdeaPanel({ watchlistId, tokens }) {
  const enabled = isHypothesisRecordsOn();
  // pending (first answer not in) | hidden | ready | error (only once the gate is known on)
  const [phase, setPhase] = useState(enabled ? 'pending' : 'hidden');
  const [record, setRecord] = useState({ currentVersion: 0, versions: [], research: [] });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { tone: 'ok' | 'error', text }
  const [editor, setEditor] = useState(null); // { mode, opId, expectedVersion, targetVersion, baseStatement, statement, horizonEnum }
  const [pending, setPending] = useState(null); // { action, version, expectedStatus, missingEvidence }

  const adopt = (data) => setRecord({
    currentVersion: data.currentVersion || 0,
    versions: Array.isArray(data.versions) ? data.versions : [],
    research: Array.isArray(data.research) ? data.research : [],
  });

  /** Reload after a move (the gate is already known on): a failure now is said, not hidden. */
  const reload = useCallback(async () => {
    try {
      adopt(await listHypothesisVersions(watchlistId));
      setPhase('ready');
    } catch (err) {
      setPhase(err?.code === 'disabled' ? 'hidden' : 'error');
    }
  }, [watchlistId]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setPhase('pending');
    listHypothesisVersions(watchlistId)
      .then((data) => {
        if (cancelled) return;
        adopt(data);
        setPhase('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        // Only an error raised after the gate admitted this player proves the panel belongs here.
        setPhase(POST_GATE_ERRORS.has(err?.code) ? 'error' : 'hidden');
      });
    return () => { cancelled = true; };
  }, [enabled, watchlistId]);

  if (!enabled || phase === 'hidden' || phase === 'pending') return null;

  const current = record.versions.find((v) => v.version === record.currentVersion) || null;

  const run = async (fn, { okText = null, fromEditor = false } = {}) => {
    setBusy(true);
    setNotice(null);
    let hidden = false;
    try {
      const out = await fn();
      setEditor(null);
      setPending(null);
      if (okText) setNotice({ tone: 'ok', text: okText });
      return out;
    } catch (err) {
      if (err?.code === 'disabled') { hidden = true; setPhase('hidden'); return undefined; }
      setNotice({ tone: 'error', text: messageOf(err) });
      setPending(null);
      // A request that can no longer apply closes its editor; a lost response keeps it for an identical retry.
      if (fromEditor && STALE_REQUEST.has(err?.code)) setEditor(null);
      return undefined;
    } finally {
      if (!hidden) await reload();
      setBusy(false);
    }
  };

  const openEditor = (mode) => {
    setPending(null);
    setNotice(null);
    const base = current?.statement || '';
    setEditor({
      mode, opId: newOpId(), expectedVersion: record.currentVersion, targetVersion: current?.version ?? null,
      baseStatement: base, statement: base, horizonEnum: '',
    });
  };
  const editorChanged = editor && (editor.statement.trim() !== editor.baseStatement.trim() || editor.horizonEnum !== '');
  const canSubmit = editor && !busy && editor.statement.trim() !== '' && (editor.mode === 'reaffirm' || editorChanged);
  const submitEditor = () => {
    const { mode, opId, expectedVersion, targetVersion, baseStatement, statement, horizonEnum } = editor;
    const picked = horizonEnum ? { horizonEnum } : {};
    if (mode === 'reaffirm') {
      const edited = statement.trim() !== baseStatement.trim() ? { statement } : {};
      return run(() => reaffirmHypothesis(watchlistId, { version: targetVersion, opId, expectedVersion, ...edited, ...picked }), { okText: LIFECYCLE_LINES.reaffirmed, fromEditor: true });
    }
    return run(() => createHypothesisVersion(watchlistId, { opId, expectedVersion, statement, ...picked }), { fromEditor: true });
  };
  const doAction = ({ action, version, expectedStatus, missingEvidence }) => run(() => transitionHypothesis(watchlistId, {
    version, action, expectedStatus, ...(action === 'wait' ? { missingEvidence } : {}),
  }));
  const askAction = (action, v) => setPending({ action, version: v.version, expectedStatus: v.status, missingEvidence: '' });

  const actions = current ? legalActionsFor(current.status, { isCurrent: true, hasSuccessor: current.successorVersion != null }) : [];
  const canSaveNew = !current || current.status !== 'review_due';
  const line = lifecycleLineFor(current);
  const researchLines = researchLinesOf(record.research);
  const playerMarked = current?.stateReason === STATE_REASONS.playerMarkedResearched;

  return (
    <div data-testid="idea-panel">
      <SectionLabel tokens={tokens}>{PANEL_COPY.title}</SectionLabel>
      <div style={card(tokens)}>
        {phase === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={muted(tokens)}>{PANEL_COPY.loadFailed}</p>
            <button type="button" disabled={busy} onClick={() => { setBusy(true); reload().finally(() => setBusy(false)); }} style={btn(tokens.textPrimary, tokens.borderInput, busy)}>{PANEL_COPY.retry}</button>
          </div>
        )}

        {phase === 'ready' && !current && !editor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={muted(tokens)}>{PANEL_COPY.empty}</p>
            <button type="button" disabled={busy} onClick={() => openEditor('create')} style={btn(tokens.teal, tokens.teal, busy)}>{PANEL_COPY.writeFirst}</button>
          </div>
        )}

        {phase === 'ready' && current && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span style={chip(tokens, statusColor(tokens, current.status))} data-testid="idea-status">
                v{current.version} · {STATUS_LABELS[current.status] || current.status}
              </span>
              <span style={chip(tokens, tokens.textMuted)} data-testid="idea-horizon">
                {HORIZON_LABELS[current.horizonEnum] || current.horizonEnum}
                {HORIZON_SOURCE_LABELS[current.horizonSource] ? ` · ${HORIZON_SOURCE_LABELS[current.horizonSource]}` : ''}
              </span>
            </div>
            <p style={prose(tokens)} data-testid="idea-statement">{current.statement}</p>
            <div style={meta(tokens)} data-testid="idea-dates">
              {[
                [PANEL_COPY.saved, formatIdeaDate(current.createdAt)],
                [PANEL_COPY.statusSince, formatIdeaDate(current.stateChangedAt)],
                [PANEL_COPY.firstDeployed, formatIdeaDate(current.firstDeployedAt)],
                [PANEL_COPY.reviewDue, formatIdeaDate(current.reviewDueAt)],
              ].filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </div>
            {current.status === 'waiting_for_evidence' && current.missingEvidence && (
              <div style={meta(tokens)}>{PANEL_COPY.waitingOn}: {current.missingEvidence}</div>
            )}
            {line && <div style={banner(tokens, tokens.amber)} data-testid="idea-lifecycle-line">{line}</div>}
          </div>
        )}

        {phase === 'ready' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }} data-testid="idea-research">
            {playerMarked && <div style={meta(tokens)} data-testid="idea-player-marked">{RESEARCH_COPY.playerMarked}</div>}
            {researchLines.length === 0 && <div style={meta(tokens)} data-testid="idea-research-none">{RESEARCH_COPY.none}</div>}
            {researchLines.map((r) => (
              <div key={r.id} style={meta(tokens)} data-testid="idea-research-line">
                {r.line}
                {r.state && <span data-testid="idea-research-state">{` · ${r.state}`}</span>}
              </div>
            ))}
          </div>
        )}

        {notice &&<div style={{ ...banner(tokens, notice.tone === 'ok' ? tokens.teal : tokens.red), marginTop: 10 }} data-testid="idea-notice">{notice.text}</div>}

        {phase === 'ready' && current && !editor && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }} data-testid="idea-actions">
            {actions.map((a) => (
              <button
                key={a}
                type="button"
                disabled={busy}
                onClick={() => (a === 'reaffirm' ? openEditor('reaffirm') : askAction(a, current))}
                style={btn(FORWARD.includes(a) ? tokens.teal : tokens.textPrimary, FORWARD.includes(a) ? tokens.teal : tokens.borderInput, busy)}
              >
                {ACTION_LABELS[a]}
              </button>
            ))}
            {canSaveNew && (
              <button type="button" disabled={busy} onClick={() => openEditor('create')} style={btn(tokens.purpleText, tokens.borderPurple, busy)}>
                {PANEL_COPY.saveNew}
              </button>
            )}
          </div>
        )}

        {pending && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }} data-testid="idea-confirm">
            {pending.action === 'wait' && (
              <input
                value={pending.missingEvidence}
                onChange={(e) => setPending({ ...pending, missingEvidence: e.target.value.slice(0, MISSING_EVIDENCE_MAX) })}
                placeholder={PANEL_COPY.missingEvidencePrompt}
                aria-label={PANEL_COPY.missingEvidencePrompt}
                style={input(tokens)}
              />
            )}
            {CLOSING.includes(pending.action) && <p style={muted(tokens)}>{PANEL_COPY.closeConfirm}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={busy || (pending.action === 'wait' && !pending.missingEvidence.trim())}
                onClick={() => doAction(pending)}
                style={btn(tokens.teal, tokens.teal, busy || (pending.action === 'wait' && !pending.missingEvidence.trim()))}
              >
                {PANEL_COPY.confirm}: {ACTION_LABELS[pending.action]}{pending.version !== record.currentVersion ? ` v${pending.version}` : ''}
              </button>
              <button type="button" disabled={busy} onClick={() => setPending(null)} style={btn(tokens.textMuted, tokens.borderInput, busy)}>{PANEL_COPY.keep}</button>
            </div>
          </div>
        )}

        {editor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }} data-testid="idea-editor">
            <textarea
              value={editor.statement}
              onChange={(e) => setEditor({ ...editor, statement: e.target.value.slice(0, STATEMENT_MAX) })}
              rows={3}
              maxLength={STATEMENT_MAX}
              placeholder={PANEL_COPY.statementPlaceholder}
              aria-label={PANEL_COPY.statementPlaceholder}
              style={input(tokens)}
            />
            <label style={meta(tokens)}>
              {PANEL_COPY.horizonPick}{' '}
              <select
                value={editor.horizonEnum}
                onChange={(e) => setEditor({ ...editor, horizonEnum: e.target.value })}
                aria-label={PANEL_COPY.horizonPick}
                style={{ ...input(tokens), padding: '4px 8px' }}
              >
                <option value="">{current ? PANEL_COPY.horizonKeep : PANEL_COPY.horizonDefault}</option>
                {HORIZON_ENUMS.map((h) => <option key={h} value={h}>{HORIZON_LABELS[h]}</option>)}
              </select>
            </label>
            <p style={meta(tokens)}>{PANEL_COPY.editorHint}{editor.mode === 'create' ? ` ${PANEL_COPY.draftHint}` : ''}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={!canSubmit} onClick={submitEditor} style={btn(tokens.teal, tokens.teal, !canSubmit)}>
                {editor.mode === 'reaffirm' ? ACTION_LABELS.reaffirm : PANEL_COPY.save}
              </button>
              <button type="button" disabled={busy} onClick={() => setEditor(null)} style={btn(tokens.textMuted, tokens.borderInput, busy)}>{PANEL_COPY.cancelEdit}</button>
            </div>
          </div>
        )}

        {phase === 'ready' && record.versions.length > 0 && (
          <div style={{ marginTop: 14 }} data-testid="idea-history">
            <div style={historyLabel(tokens)}>{PANEL_COPY.history} ({record.currentVersion})</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {record.versions.map((v) => {
                const isCurrent = v.version === record.currentVersion;
                // A superseded version that is still open can be closed here (the routes accept it).
                const closing = isCurrent ? [] : legalActionsFor(v.status, { isCurrent: false });
                return (
                  <li key={v.version} style={{ fontSize: 12, lineHeight: 1.5, color: isCurrent ? tokens.textSecondary : tokens.textFaint }} data-testid={`idea-history-v${v.version}`}>
                    <span>
                      v{v.version} · {STATUS_LABELS[v.status] || v.status} · {formatIdeaDate(v.createdAt)}
                      {v.successorVersion != null ? ` · → v${v.successorVersion}` : ''} — {excerpt(v.statement)}
                    </span>
                    {closing.length > 0 && !editor && (
                      <span style={{ display: 'inline-flex', gap: 6, marginLeft: 8 }}>
                        {closing.map((a) => (
                          <button key={a} type="button" disabled={busy} onClick={() => askAction(a, v)} style={{ ...btn(tokens.textMuted, tokens.borderInput, busy), padding: '1px 8px', fontSize: 11 }}>
                            {ACTION_LABELS[a]}
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function excerpt(s) {
  const t = typeof s === 'string' ? s : '';
  return t.length > 80 ? `${t.slice(0, 79)}…` : t;
}

function card(tokens) {
  return { padding: '12px 14px', borderRadius: 10, background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}` };
}
function prose(tokens) {
  return { margin: 0, fontSize: 14, lineHeight: 1.6, color: tokens.textSecondary };
}
function muted(tokens) {
  return { margin: 0, fontSize: 13, lineHeight: 1.5, color: tokens.textMuted };
}
function meta(tokens) {
  return { fontSize: 12, lineHeight: 1.5, color: tokens.textFaint };
}
function historyLabel(tokens) {
  return { fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: tokens.textFaint, marginBottom: 6 };
}
function chip(tokens, color) {
  return {
    padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
    background: tokens.bgIcon, border: `1px solid ${color}`, color,
  };
}
function banner(tokens, color) {
  return { padding: '10px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.5, background: tokens.bgCard, border: `1px solid ${color}`, color };
}
function input(tokens) {
  return {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, background: tokens.bgCard,
    border: `1px solid ${tokens.borderInput}`, color: tokens.textPrimary, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  };
}
function btn(color, borderColor, disabled) {
  return {
    padding: '6px 12px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', background: 'transparent',
    border: `1px solid ${borderColor}`, color, fontSize: 12, fontWeight: 700, opacity: disabled ? 0.45 : 1,
  };
}
