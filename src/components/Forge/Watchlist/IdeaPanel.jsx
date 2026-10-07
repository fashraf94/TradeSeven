// src/components/Forge/Watchlist/IdeaPanel.jsx
//
// Pilot P1a — the "Idea" panel on the saved-watchlist screen (pilot spec
// docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md §2.1–§2.5):
// the current version's statement, time-frame, status and dates, the version
// history, and the moves legal for that status — including "save as a new
// version", the only way content ever changes.
//
// GATED TWICE: HYPOTHESIS_RECORDS_ENABLED false → the panel renders nothing
// and makes no request; true → it asks the server, and a `disabled` answer
// (this player is off the cockpit allowlist) also renders nothing.
//
// The offered moves come from the SAME table the routes enforce
// (src/constants/hypothesisRecords.js legalActionsFor). The server is the
// authority: after every move the panel reloads the record rather than
// patching it locally, and a typed refusal (409) is shown and reloaded.
// Lifecycle sentences are table C verbatim (ideaCopy.js). Colors are the
// existing theme tokens only.

import React, { useCallback, useEffect, useState } from 'react';
import { isHypothesisRecordsOn } from '../../../config/featureFlags';
import { HORIZON_ENUMS, TERMINAL_STATUSES, legalActionsFor } from '../../../constants/hypothesisRecords';
import {
  listHypothesisVersions, createHypothesisVersion, transitionHypothesis, reaffirmHypothesis, newOpId,
} from '../../../services/hypothesisVersionService';
import {
  LIFECYCLE_LINES, fillLine, ideaSymbolOf, windowTextOf, formatIdeaDate,
  STATUS_LABELS, ACTION_LABELS, HORIZON_LABELS, HORIZON_SOURCE_LABELS, PANEL_COPY,
} from './ideaCopy';
import SectionLabel from './SectionLabel';

const STATEMENT_MAX = 1000;
const MISSING_EVIDENCE_MAX = 300;
const CLOSING = ['reject', 'cancel', 'retire'];

/** The table-C sentence for a version's state, or null when none applies or a placeholder has no value. */
export function lifecycleLineFor(version, listTickers) {
  if (!version) return null;
  const sym = ideaSymbolOf(version, listTickers);
  if (version.status === 'review_due') {
    if (version.stateReason === 'horizon_elapsed') return fillLine(LIFECYCLE_LINES.reviewDueHorizon, { sym, window: windowTextOf(version.horizonEnum) });
    if (version.stateReason === 'battle_ended') return fillLine(LIFECYCLE_LINES.reviewDueBattleEnded, { sym });
    return null;
  }
  if (version.status === 'invalidated') return fillLine(LIFECYCLE_LINES.invalidated, { sym, condition: version.stateReason });
  return null;
}

function statusColor(tokens, status) {
  if (status === 'ready' || status === 'activated') return tokens.teal;
  if (status === 'review_due' || status === 'waiting_for_evidence') return tokens.amber;
  if (status === 'invalidated') return tokens.red;
  if (TERMINAL_STATUSES.includes(status)) return tokens.textFaint;
  return tokens.purpleText;
}

export default function IdeaPanel({ watchlistId, tokens, listTickers = [] }) {
  const enabled = isHypothesisRecordsOn();
  const [phase, setPhase] = useState(enabled ? 'loading' : 'hidden'); // loading | hidden | error | ready
  const [record, setRecord] = useState({ currentVersion: 0, versions: [] });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { tone: 'ok' | 'error', text }
  const [editor, setEditor] = useState(null); // { mode: 'create' | 'reaffirm', opId, statement, horizonEnum }
  const [pending, setPending] = useState(null); // { action, missingEvidence? } awaiting a confirm

  const load = useCallback(async () => {
    try {
      const data = await listHypothesisVersions(watchlistId);
      setRecord({ currentVersion: data.currentVersion || 0, versions: Array.isArray(data.versions) ? data.versions : [] });
      setPhase('ready');
    } catch (err) {
      setPhase(err?.code === 'disabled' ? 'hidden' : 'error');
    }
  }, [watchlistId]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setPhase('loading');
    listHypothesisVersions(watchlistId)
      .then((data) => {
        if (cancelled) return;
        setRecord({ currentVersion: data.currentVersion || 0, versions: Array.isArray(data.versions) ? data.versions : [] });
        setPhase('ready');
      })
      .catch((err) => {
        if (!cancelled) setPhase(err?.code === 'disabled' ? 'hidden' : 'error');
      });
    return () => { cancelled = true; };
  }, [enabled, watchlistId]);

  if (!enabled || phase === 'hidden') return null;

  const current = record.versions.find((v) => v.version === record.currentVersion) || null;
  const run = async (fn, okText = null) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setEditor(null);
      setPending(null);
      if (okText) setNotice({ tone: 'ok', text: okText });
    } catch (err) {
      if (err?.code === 'disabled') { setPhase('hidden'); return; }
      setNotice({ tone: 'error', text: err?.message || 'That change did not go through.' });
    } finally {
      setBusy(false);
      await load();
    }
  };

  const openEditor = (mode) => {
    setPending(null);
    setNotice(null);
    setEditor({ mode, opId: newOpId(), statement: current?.statement || '', horizonEnum: '' });
  };
  const submitEditor = () => {
    const { mode, opId, statement, horizonEnum } = editor;
    const picked = horizonEnum ? { horizonEnum } : {};
    if (mode === 'reaffirm') {
      const edited = statement.trim() !== (current?.statement || '') ? { statement } : {};
      return run(() => reaffirmHypothesis(watchlistId, { version: current.version, opId, expectedVersion: record.currentVersion, ...edited, ...picked }), LIFECYCLE_LINES.reaffirmed);
    }
    return run(() => createHypothesisVersion(watchlistId, { opId, expectedVersion: record.currentVersion, statement, ...picked }));
  };
  const doAction = (action, missingEvidence) => run(() => transitionHypothesis(watchlistId, {
    version: current.version, action, expectedStatus: current.status, ...(action === 'wait' ? { missingEvidence } : {}),
  }));

  const actions = current ? legalActionsFor(current.status, { isCurrent: true, hasSuccessor: current.successorVersion != null }) : [];
  const canSaveNew = !current || current.status !== 'review_due';
  const line = lifecycleLineFor(current, listTickers);

  return (
    <div data-testid="idea-panel">
      <SectionLabel tokens={tokens}>{PANEL_COPY.title}</SectionLabel>
      <div style={card(tokens)}>
        {phase === 'loading' && <p style={muted(tokens)}>Loading…</p>}
        {phase === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={muted(tokens)}>{PANEL_COPY.loadFailed}</p>
            <button type="button" onClick={() => { setPhase('loading'); load(); }} style={btn(tokens.textPrimary, tokens.borderInput, false)}>{PANEL_COPY.retry}</button>
          </div>
        )}

        {phase === 'ready' && !current && !editor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={muted(tokens)}>{PANEL_COPY.empty}</p>
            <button type="button" onClick={() => openEditor('create')} style={btn(tokens.teal, tokens.teal, false)}>{PANEL_COPY.writeFirst}</button>
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
                ['Saved', formatIdeaDate(current.createdAt)],
                ['Status since', formatIdeaDate(current.stateChangedAt)],
                ['First deployed', formatIdeaDate(current.firstDeployedAt)],
                ['Review due', formatIdeaDate(current.reviewDueAt)],
              ].filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </div>
            {current.status === 'waiting_for_evidence' && current.missingEvidence && (
              <div style={meta(tokens)}>{PANEL_COPY.waitingOn}: {current.missingEvidence}</div>
            )}
            {line && <div style={banner(tokens, tokens.amber)} data-testid="idea-lifecycle-line">{line}</div>}
          </div>
        )}

        {notice && <div style={{ ...banner(tokens, notice.tone === 'ok' ? tokens.teal : tokens.red), marginTop: 10 }} data-testid="idea-notice">{notice.text}</div>}

        {phase === 'ready' && current && !editor && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }} data-testid="idea-actions">
            {actions.map((a) => (
              <button
                key={a}
                type="button"
                disabled={busy}
                onClick={() => (a === 'reaffirm' ? openEditor('reaffirm') : setPending({ action: a, missingEvidence: '' }))}
                style={btn(a === 'ready' || a === 'reaffirm' ? tokens.teal : tokens.textPrimary, a === 'ready' || a === 'reaffirm' ? tokens.teal : tokens.borderInput, busy)}
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
                onClick={() => doAction(pending.action, pending.missingEvidence)}
                style={btn(tokens.teal, tokens.teal, busy || (pending.action === 'wait' && !pending.missingEvidence.trim()))}
              >
                {PANEL_COPY.confirm}: {ACTION_LABELS[pending.action]}
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
                <option value="">{current ? PANEL_COPY.horizonKeep : HORIZON_LABELS.unspecified}</option>
                {HORIZON_ENUMS.map((h) => <option key={h} value={h}>{HORIZON_LABELS[h]}</option>)}
              </select>
            </label>
            <p style={meta(tokens)}>{PANEL_COPY.editorHint}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={busy || !editor.statement.trim()}
                onClick={submitEditor}
                style={btn(tokens.teal, tokens.teal, busy || !editor.statement.trim())}
              >
                {editor.mode === 'reaffirm' ? ACTION_LABELS.reaffirm : PANEL_COPY.save}
              </button>
              <button type="button" disabled={busy} onClick={() => setEditor(null)} style={btn(tokens.textMuted, tokens.borderInput, busy)}>{PANEL_COPY.cancelEdit}</button>
            </div>
          </div>
        )}

        {phase === 'ready' && record.versions.length > 0 && (
          <div style={{ marginTop: 14 }} data-testid="idea-history">
            <div style={historyLabel(tokens)}>{PANEL_COPY.history} ({record.versions.length})</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {record.versions.map((v) => (
                <li key={v.version} style={{ fontSize: 12, lineHeight: 1.5, color: v.version === record.currentVersion ? tokens.textSecondary : tokens.textFaint }}>
                  v{v.version} · {STATUS_LABELS[v.status] || v.status} · {formatIdeaDate(v.createdAt)}
                  {v.successorVersion != null ? ` · → v${v.successorVersion}` : ''} — {excerpt(v.statement)}
                </li>
              ))}
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
