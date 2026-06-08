// src/components/Forge/Watchlist/WatchlistAnalysisView.jsx
//
// Analysis Hand-off — Phase 2: the dedicated surface for reasoning about a
// saved cohort. Opens a watchlist, shows the deterministic cohort digest at a
// glance, and hosts a grounded conversation with Gemma over that digest
// (api/forge/watchlist-analysis). Optionally saves a summary into the
// watchlist's notes (api/forge/watchlists/[id]/notes — works even when the
// watchlist is committed).
//
// Mirrors the ScreenerView console idiom: hold a sessionId, POST via the
// service layer, narrate over a deterministic core. The digest is the substrate
// — Gemma only describes it. notes is user-facing; it never reaches the agent.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, AlertCircle, Check, Save, Sparkles } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { postWatchlistAnalysis, saveWatchlistNotes } from '../../../services/forgeWatchlistService';

const MESSAGE_CHAR_CAP = 2000;
const REQUEST_TIMEOUT_MS = 28_000;

// signed-percent → "+12.3%" / "-3.1%" / "—"
function pct(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : ''}${r}%`;
}
function num(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${Math.round(v * 10) / 10}`;
}
function money(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `$${(v / 1e9).toFixed(1)}B`;
}

export default function WatchlistAnalysisView({ watchlist, onClose }) {
  const { tokens } = useTheme();
  const watchlistId = watchlist?.watchlistId;
  const name = watchlist?.name?.trim() || 'Untitled watchlist';

  const [turns, setTurns] = useState([]); // { role: 'user' | 'analyst', text }
  const [digest, setDigest] = useState(null);
  const [suggested, setSuggested] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [tier2Included, setTier2Included] = useState(false);

  const [input, setInput] = useState('');
  const [opening, setOpening] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState(null);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  // Open the thread: deterministic digest + narration (no model call).
  useEffect(() => {
    let cancelled = false;
    if (!watchlistId) return undefined;
    setOpening(true);
    postWatchlistAnalysis({ watchlistId, userMessage: '' })
      .then((data) => {
        if (cancelled) return;
        setSessionId(data.sessionId || null);
        setDigest(data.digest || null);
        setSuggested(Array.isArray(data.suggestedActions) ? data.suggestedActions : []);
        setTurns(data.message ? [{ role: 'analyst', text: data.message }] : []);
        setOpening(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[WatchlistAnalysis] open failed:', err?.message || err);
        setError('Could not open the analysis for this set. Try again.');
        setOpening(false);
      });
    return () => {
      cancelled = true;
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch { /* best-effort */ }
      }
    };
  }, [watchlistId]);

  // Auto-scroll the transcript on new turns.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, sending]);

  const send = useCallback(
    async (raw) => {
      const message = (raw || '').trim();
      if (!message || sending || opening) return;
      setError(null);
      setNotesSaved(false);
      setSending(true);
      setInput('');
      setTurns((prev) => [...prev, { role: 'user', text: message }]);

      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const data = await postWatchlistAnalysis(
          { watchlistId, userMessage: message, sessionId },
          { signal: controller.signal },
        );
        if (typeof data.sessionId === 'string') setSessionId(data.sessionId);
        else if (data.sessionId === null) setSessionId(null); // budget exhausted → fresh thread
        if (data.digest) setDigest(data.digest);
        setTier2Included(data.tier2Included === true);
        setSuggested(Array.isArray(data.suggestedActions) ? data.suggestedActions : []);
        setTurns((prev) => [...prev, { role: 'analyst', text: data.message || '…' }]);
      } catch (err) {
        console.error('[WatchlistAnalysis] send failed:', err?.message || err);
        setError(
          err?.name === 'AbortError'
            ? 'That took too long — try asking again.'
            : 'I hit a snag analyzing that — try again.',
        );
        setInput(message); // restore so the user can retry
        setTurns((prev) => prev.slice(0, -1)); // drop the optimistic user turn
      } finally {
        clearTimeout(timeoutId);
        abortRef.current = null;
        setSending(false);
      }
    },
    [watchlistId, sessionId, sending, opening],
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  // Save the most recent analyst answer as the watchlist's notes summary.
  const lastAnalyst = [...turns].reverse().find((t) => t.role === 'analyst');
  const saveSummary = useCallback(async () => {
    if (!lastAnalyst || savingNotes) return;
    setSavingNotes(true);
    setNotesError(null);
    try {
      await saveWatchlistNotes(watchlistId, lastAnalyst.text.slice(0, 2000));
      setNotesSaved(true);
    } catch (err) {
      console.error('[WatchlistAnalysis] save notes failed:', err?.message || err);
      setNotesError('Could not save the summary. Try again.');
    } finally {
      setSavingNotes(false);
    }
  }, [lastAnalyst, savingNotes, watchlistId]);

  const canSend = !sending && !opening && input.trim().length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.bgApp,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          borderBottom: `1px solid ${tokens.borderDefault}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          style={{ background: 'transparent', border: 'none', color: tokens.textSecondary, cursor: 'pointer', display: 'flex', padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: tokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: tokens.textMuted }}>
            Set analysis{digest?.size ? ` · ${digest.size} names` : ''}
          </div>
        </div>
      </div>

      {/* Scroll region: digest panel + transcript */}
      <div ref={scrollRef} className="fw-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <DigestPanel digest={digest} tier2Included={tier2Included} tokens={tokens} />

        {/* Transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {opening && <div style={{ color: tokens.textMuted, fontSize: 13 }}>Reading the set…</div>}
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <div
                key={i}
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  background: `${tokens.teal}1a`,
                  border: `1px solid ${tokens.teal}33`,
                  borderRadius: '12px 12px 4px 12px',
                  padding: '9px 12px',
                  color: tokens.textPrimary,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                {t.text}
              </div>
            ) : (
              <div
                key={i}
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '90%',
                  background: tokens.bgCard,
                  borderLeft: `3px solid ${tokens.teal}`,
                  borderRadius: '0 12px 12px 12px',
                  padding: '11px 13px',
                  color: tokens.textPrimary,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                }}
              >
                {t.text}
              </div>
            ),
          )}
          {sending && (
            <div style={{ alignSelf: 'flex-start', color: tokens.textMuted, fontSize: 13, padding: '4px 2px' }}>
              Analyzing…
            </div>
          )}
        </div>

        {/* Save-summary affordance (only once there's an analyst answer) */}
        {lastAnalyst && !opening && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={saveSummary}
              disabled={savingNotes || notesSaved}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 12px',
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: 600,
                background: 'transparent',
                color: notesSaved ? tokens.green : tokens.textSecondary,
                border: `1px solid ${notesSaved ? tokens.green : tokens.borderDefault}`,
                cursor: savingNotes || notesSaved ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {notesSaved ? <Check size={14} /> : <Save size={14} />}
              {notesSaved ? 'Saved to notes' : savingNotes ? 'Saving…' : 'Save summary to notes'}
            </button>
            {notesError && <span style={{ color: tokens.red, fontSize: 12 }}>{notesError}</span>}
          </div>
        )}

        {/* Suggested follow-ups */}
        {suggested.length > 0 && !sending && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {suggested.map((s, i) => (
              <button
                key={`${s}-${i}`}
                type="button"
                onClick={() => send(s)}
                disabled={sending || opening}
                style={{
                  padding: '7px 12px',
                  borderRadius: 18,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: tokens.bgCard,
                  color: tokens.teal,
                  border: `1px solid ${tokens.teal}33`,
                  cursor: sending || opening ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 14,
              padding: '10px 12px',
              background: 'rgba(239,68,68,0.08)',
              border: `1px solid ${tokens.red}`,
              borderRadius: 10,
              color: tokens.red,
              fontSize: 12.5,
              lineHeight: 1.5,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>{error}</div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
          borderTop: `1px solid ${tokens.borderDefault}`,
          background: tokens.bgCard,
          flexShrink: 0,
        }}
      >
        <Sparkles size={18} color={tokens.teal} style={{ flexShrink: 0, marginBottom: 9 }} />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MESSAGE_CHAR_CAP))}
          onKeyDown={handleKeyDown}
          placeholder={opening ? 'Reading the set…' : 'Ask about this set — what they share, how their fundamentals compare…'}
          rows={1}
          disabled={opening}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: tokens.textPrimary,
            fontSize: 14,
            lineHeight: 1.4,
            maxHeight: 110,
            fontFamily: 'inherit',
            padding: '8px 0',
          }}
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={!canSend}
          aria-label="Ask"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: 'none',
            background: canSend ? tokens.teal : `${tokens.teal}26`,
            color: canSend ? tokens.bgApp : tokens.teal,
            cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

// ── Cohort-at-a-glance panel (the deterministic substrate) ────────────
function DigestPanel({ digest, tier2Included, tokens }) {
  if (!digest || !digest.covered) return null;
  const ret = (f) => digest.returns?.[f];
  const stat = (s, fmt) => (s && s.count ? fmt(s.median) : '—');
  const cell = (label, value, color) => (
    <div style={{ minWidth: 78 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: tokens.textMuted }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || tokens.textPrimary, fontFamily: "'SF Mono','Monaco','Consolas',monospace" }}>{value}</div>
    </div>
  );
  const retColor = (s) => (s && s.count ? (s.median >= 0 ? tokens.green : tokens.red) : tokens.textMuted);

  const wl = digest.winnersLosers;

  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderDefault}`, borderRadius: 14, padding: 14 }}>
      {/* Sector mix */}
      {digest.sectors?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {digest.sectors.slice(0, 6).map((s) => (
            <span
              key={s.name}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 14,
                background: tokens.bgElevated || tokens.bgApp,
                color: tokens.textSecondary,
                border: `1px solid ${tokens.borderDefault}`,
              }}
            >
              {s.name} · {s.count}
            </span>
          ))}
        </div>
      )}

      {/* Stat row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, rowGap: 12 }}>
        {cell('1M return', stat(ret('return1M'), pct), retColor(ret('return1M')))}
        {cell('3M return', stat(ret('return3M'), pct), retColor(ret('return3M')))}
        {cell('Momentum', digest.momentum?.count ? num(digest.momentum.medianScore) : '—')}
        {cell(
          'Above 200d',
          digest.trend && (digest.trend.aboveCount || digest.trend.belowCount)
            ? `${digest.trend.aboveCount}/${digest.trend.aboveCount + digest.trend.belowCount}`
            : '—',
        )}
        {digest.nr7Count ? cell('NR7 coiled', `${digest.nr7Count}`) : null}
      </div>

      {/* Winners vs losers contrast */}
      {wl && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <ContrastCol label="Winners" group={wl.winners} field={wl.splitField} accent={tokens.green} tokens={tokens} />
          <ContrastCol label="Laggards" group={wl.losers} field={wl.splitField} accent={tokens.red} tokens={tokens} />
        </div>
      )}

      {/* Fundamentals (Tier-2, only when loaded) */}
      {tier2Included && digest.fundamentals && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${tokens.borderDefault}`, display: 'flex', flexWrap: 'wrap', gap: 16, rowGap: 12 }}>
          {digest.fundamentals.trailingPE?.count ? cell('P/E (med)', num(digest.fundamentals.trailingPE.median)) : null}
          {digest.fundamentals.debtToEquity?.count ? cell('Debt/Eq', num(digest.fundamentals.debtToEquity.median)) : null}
          {digest.fundamentals.revenueGrowthYOY?.count ? cell('Rev growth', pct(digest.fundamentals.revenueGrowthYOY.median)) : null}
          {digest.fundamentals.profitMarginTTM?.count ? cell('Net margin', pct(digest.fundamentals.profitMarginTTM.median)) : null}
          {digest.fundamentals.marketCap?.count ? cell('Mkt cap (med)', money(digest.fundamentals.marketCap.median)) : null}
        </div>
      )}
    </div>
  );
}

function ContrastCol({ label, group, field, accent, tokens }) {
  return (
    <div style={{ flex: 1, background: tokens.bgApp, border: `1px solid ${tokens.borderDefault}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: accent, marginBottom: 6 }}>
        {label} · {group.count}
      </div>
      <div style={{ fontSize: 12, color: tokens.textSecondary, lineHeight: 1.6 }}>
        <div>{field.replace('return', '')} median <strong style={{ color: accent }}>{pct(group.medianReturn)}</strong></div>
        <div>momentum {num(group.medianMomentum)}</div>
        <div>{group.pctAbove200 == null ? '—' : `${group.pctAbove200}%`} above 200d</div>
        {group.topSectors?.[0] && <div style={{ color: tokens.textMuted }}>{group.topSectors[0].name} {group.topSectors[0].count}</div>}
      </div>
    </div>
  );
}
