// src/components/Search/ScreenerView.jsx
//
// Research Engine — Phase 3: the screener's front door inside the Search surface.
//
// A single-screen research console (NOT a growing chat log): a prompt bar, a
// starter empty-state of recipe chips, and — after a screen — the engine's short
// narration, a plain-language spec + freshness line, an honesty caveat when one
// applies, the ranked results through the EXISTING RankRow, and refinement chips.
// A follow-up (typed or a chip) continues the session via the held sessionId, so
// the current screen MUTATES in place rather than restarting.
//
// It calls POST /api/screener/chat via fetchWithAuth and handles every shape the
// endpoint returns (results · empty match · clarifying · honest decline ·
// budget · error/timeout · 401/403/404/409/503) — never a blank screen.
// The endpoint's `message` is the only narration; there is no second model call.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, AlertCircle, X, Clock, Bookmark, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { STOCKS } from '../../data/assets';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import RankRow from './RankRow';
import ReturnRow from './ReturnRow';
import IndustryRow from './IndustryRow';
import {
  buildRankRows,
  buildReturnRows,
  buildIndustryRows,
  isReturnField,
  specToPlainLanguage,
  rejectedFiltersToLines,
} from './screenerAdapter';

const REQUEST_TIMEOUT_MS = 25_000;
const CONCURRENT_RETRY_DELAY_MS = 500;
const MESSAGE_CHAR_CAP = 2000;

// Starter recipes: short chip label → the fuller NL prompt POSTed as userMessage.
// The Speculator label derives from getArchetypeDisplayName so it tracks renames.
const SPECULATOR = getArchetypeDisplayName('degen');
const STARTER_CHIPS = [
  { label: 'Top BaggerBomb fit', prompt: 'Rank the universe by BaggerBomb fit' },
  { label: 'Leading momentum', prompt: 'Show me the strongest momentum names right now' },
  { label: 'Tight, coiled setups (NR7)', prompt: 'Find tight, coiled NR7 setups' },
  { label: `Screen like a ${SPECULATOR}`, prompt: `Screen like a ${SPECULATOR}` },
];

// ISO → "Jun 4" (freshness chip). Null on anything unparseable.
function formatAsOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const ScreenerView = ({ onOpenResearch, isMobile }) => {
  const { tokens } = useTheme();

  const [sessionId, setSessionId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [screen, setScreen] = useState(null); // normalized last response
  const [errorBanner, setErrorBanner] = useState(null);

  // "Save as watchlist" hand-off. saveStatus: 'idle' | 'saving' | 'saved' | 'error'.
  // The modal collects a name; confirmSave creates a populated draft then commits.
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);

  const abortRef = useRef(null);
  const concurrentRetryRef = useRef(false);
  const textareaRef = useRef(null);

  // Auto-resize the composer textarea.
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Abort any in-flight request on unmount.
  useEffect(() => () => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* best-effort */ }
    }
  }, []);

  // The actual POST + response handling. Recurses ONCE on a 409 (so the
  // auto-retry isn't blocked it deliberately carries no isSending guard — the
  // sendPrompt wrapper owns that). On every failure it sets a banner and
  // restores the composer text so the user can retry without retyping.
  const postScreen = useCallback(async (message, isRetry) => {
    const fail = (msg) => { setErrorBanner(msg); setInputText(message); };

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res;
    try {
      res = await fetchWithAuth('/api/screener/chat', {
        method: 'POST',
        body: JSON.stringify({ userMessage: message, sessionId }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      abortRef.current = null;
      fail(err?.name === 'AbortError'
        ? 'That took too long — try sending it again.'
        : 'Connection issue — check your network and try again.');
      return;
    }
    clearTimeout(timeoutId);
    abortRef.current = null;

    let data = null;
    try { data = await res.json(); } catch { data = null; }

    // 401 — no/expired token.
    if (res.status === 401) {
      setErrorBanner('Please sign in again to run a screen.');
      return;
    }

    // 404 / 403 — session gone or not ours: drop the stale id, retry fresh.
    if (res.status === 404 || res.status === 403) {
      setSessionId(null);
      fail('That research session expired — your next prompt starts a fresh screen.');
      return;
    }

    // 409 concurrent_modification — single silent auto-retry.
    if (res.status === 409 && data?.errorReason === 'concurrent_modification') {
      if (!isRetry && !concurrentRetryRef.current) {
        concurrentRetryRef.current = true;
        await new Promise((r) => setTimeout(r, CONCURRENT_RETRY_DELAY_MS));
        await postScreen(message, true);
        concurrentRetryRef.current = false;
        return;
      }
      setErrorBanner('Your screen was modified by another request — try that again.');
      return;
    }

    // 503 — rankings universe not loaded yet.
    if (res.status === 503) {
      setErrorBanner(
        (typeof data?.error === 'string' && data.error) ||
          'Rankings aren’t available right now — try again shortly.',
      );
      return;
    }

    // Hard non-OK without a structured body.
    if (!res.ok && !(data && (data.error === true || typeof data.message === 'string'))) {
      fail(`Request failed (${res.status}). Try again.`);
      return;
    }

    // Adopt / reset the session id. Budget-cap and the catch-all send
    // sessionId:null → reset so the next prompt starts a fresh session.
    if (typeof data?.sessionId === 'string') setSessionId(data.sessionId);
    else if (data && 'sessionId' in data && data.sessionId === null) setSessionId(null);

    // Structured error (200/504 error:true / parse error) — banner, keep prior
    // results visible, restore the prompt.
    if (data?.error === true) {
      fail(data.message || 'I hit a snag building that screen — try again.');
      return;
    }

    // Budget exhausted — graceful "fresh screen" note (sessionId already reset).
    if (data?.sessionEnded === true) {
      setScreen({
        message: data.message || 'Start a fresh screen and we’ll keep going.',
        suggestedActions: [],
        screened: false,
        results: [],
        appliedSpec: null,
        rejectedFilters: [],
        matchCount: null,
        universeSize: null,
        dataAsOf: null,
      });
      return;
    }

    // Happy path: screened (results / empty match / honest decline) OR clarifying.
    setScreen({
      message: typeof data?.message === 'string' ? data.message : '',
      suggestedActions: Array.isArray(data?.suggestedActions)
        ? data.suggestedActions.filter((s) => typeof s === 'string' && s.trim())
        : [],
      screened: data?.screened === true,
      results: Array.isArray(data?.results) ? data.results : [],
      resultType: typeof data?.resultType === 'string' ? data.resultType : 'stocks',
      appliedSpec: data?.appliedSpec || null,
      rejectedFilters: Array.isArray(data?.rejectedFilters) ? data.rejectedFilters : [],
      matchCount: typeof data?.matchCount === 'number' ? data.matchCount : null,
      universeSize: typeof data?.universeSize === 'number' ? data.universeSize : null,
      dataAsOf: data?.dataAsOf || null,
    });
  }, [sessionId]);

  // Wrapper: owns the optimistic UI + the single isSending guard.
  const sendPrompt = useCallback(async (rawText) => {
    const message = (rawText || '').trim();
    if (!message || isSending) return;
    setErrorBanner(null);
    setIsSending(true);
    setInputText('');
    concurrentRetryRef.current = false;
    try {
      await postScreen(message, false);
    } finally {
      setIsSending(false);
    }
  }, [isSending, postScreen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt(inputText);
    }
  };

  // Tap a result → reuse the exact RankingsView handoff into AssetResearchModal
  // (static STOCKS join for the company name; price fields are filled live there).
  const handleTap = (stock) => {
    const assetInfo = STOCKS.find((s) => s.symbol === stock.symbol);
    onOpenResearch?.({
      symbol: stock.symbol,
      name: assetInfo?.name || stock.symbol,
      sector: assetInfo?.sector || stock.sectorName || '',
      price: 0,
      percentChange: 0,
      change: 0,
    });
  };

  // Open the naming modal, seeding the name from the screen's plain-language
  // spec (capped to the server's 100-char name limit).
  const openSaveModal = useCallback(() => {
    if (!screen?.results?.length) return;
    const seed = specToPlainLanguage(screen.appliedSpec) || 'Screened watchlist';
    setSaveName(seed.slice(0, 100));
    setSaveError(null);
    setSaveStatus('idle');
    setSaveModalOpen(true);
  }, [screen]);

  const closeSaveModal = useCallback(() => {
    if (saveStatus === 'saving') return; // don't drop a request mid-flight
    setSaveModalOpen(false);
  }, [saveStatus]);

  // Create a populated draft from the screened set, then commit it. Worst-case
  // partial state (create ok, commit fails) is a valid populated draft the user
  // can finalize later — benign, not an orphan. We do NOT auto-equip: equip is
  // the user's explicit next step on the existing equip surface (and can't run
  // on a draft or a mid-battle agent).
  const confirmSave = useCallback(async () => {
    if (!screen?.results?.length || saveStatus === 'saving') return;
    setSaveStatus('saving');
    setSaveError(null);

    // Map screened rows → the watchlist ticker shape. The server re-validates
    // and caps (≤40, per-field) via capTickersArray and defaults addedBy:'user'.
    const tickers = screen.results
      .filter((r) => r && typeof r.symbol === 'string')
      .map((r) => ({ symbol: r.symbol, reasoning: '', category: r.sectorName || '' }));

    try {
      const createRes = await fetchWithAuth('/api/forge/watchlists', {
        method: 'POST',
        body: JSON.stringify({
          tickers,
          name: saveName.trim().slice(0, 100),
          sourceScreenSpec: screen.appliedSpec || null,
        }),
      });
      const createData = await createRes.json().catch(() => null);
      if (!createRes.ok || !createData?.watchlistId) {
        setSaveError(createData?.message || 'Could not save the watchlist. Try again.');
        setSaveStatus('error');
        return;
      }

      const watchlistId = createData.watchlistId;
      const commitRes = await fetchWithAuth(`/api/forge/watchlists/${watchlistId}/commit`, {
        method: 'POST',
      });
      if (!commitRes.ok) {
        // The draft exists and is populated — finalizing it later is benign.
        setSaveError('Saved as a draft, but finalizing failed — you can commit it from your watchlists.');
        setSaveStatus('error');
        return;
      }

      setSaveStatus('saved');
    } catch {
      setSaveError('Connection issue — check your network and try again.');
      setSaveStatus('error');
    }
  }, [screen, saveName, saveStatus]);

  const canSend = !isSending && inputText.trim().length > 0;
  const canSaveScreen =
    !!screen?.screened && (screen?.results?.length || 0) > 0 && screen?.resultType !== 'industries';

  // ── styles ────────────────────────────────────────────────────────
  const chipStyle = {
    padding: '8px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    background: tokens.bgCard,
    color: tokens.teal,
    border: `1px solid ${tokens.teal}33`,
    cursor: isSending ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    opacity: isSending ? 0.5 : 1,
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      {/* Prompt bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
          background: tokens.bgCard,
          border: `1px solid ${tokens.teal}26`,
          borderRadius: '14px',
          padding: '10px 10px 10px 14px',
        }}
      >
        <Sparkles size={18} color={tokens.teal} style={{ flexShrink: 0, marginBottom: 10 }} />
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value.slice(0, MESSAGE_CHAR_CAP))}
          onKeyDown={handleKeyDown}
          placeholder={
            isSending
              ? 'Screening…'
              : isMobile
                ? 'Describe what to screen for…'
                : 'Describe what to screen for — e.g. “tech names leading on momentum”'
          }
          rows={1}
          disabled={isSending}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: tokens.textPrimary,
            fontSize: '14px',
            lineHeight: 1.4,
            minHeight: '24px',
            maxHeight: '120px',
            fontFamily: 'inherit',
            padding: '8px 0',
          }}
        />
        <button
          type="button"
          onClick={() => sendPrompt(inputText)}
          disabled={!canSend}
          aria-label="Run screen"
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

      {/* Error banner (transient; prior screen stays visible underneath) */}
      <AnimatePresence>
        {errorBanner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginTop: 12,
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.08)',
              border: `1px solid ${tokens.red}`,
              borderRadius: 10,
              color: tokens.red,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>{errorBanner}</div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              aria-label="Dismiss"
              style={{ background: 'transparent', border: 'none', color: tokens.red, cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state — intro + starter recipes */}
      {!screen && !isSending && (
        <div style={{ marginTop: 20 }}>
          <div style={{ color: tokens.textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
            Screen the whole universe in plain language. Ask for a sector, a setup, a
            game-mode fit, or an archetype — then refine the result in place.
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: tokens.textMuted, marginBottom: 10 }}>
            Try one
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {STARTER_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => sendPrompt(chip.prompt)}
                disabled={isSending}
                style={chipStyle}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton on the FIRST run (no prior screen to keep visible) */}
      {isSending && !screen && <SkeletonList tokens={tokens} />}

      {/* Result region */}
      {screen && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: isSending ? 0.55 : 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{ marginTop: 18, pointerEvents: isSending ? 'none' : 'auto' }}
        >
          {/* Narration (always — the engine's only narration AND honesty channel) */}
          {screen.message && (
            <div
              style={{
                background: tokens.bgCard,
                borderLeft: `3px solid ${tokens.teal}`,
                borderRadius: '0 12px 12px 12px',
                padding: '12px 14px',
                color: tokens.textPrimary,
                fontSize: 14,
                lineHeight: 1.55,
                marginBottom: 12,
              }}
            >
              {screen.message}
            </div>
          )}

          {/* Honest-decline caveat (amber — a data gap, not a loss) */}
          {screen.rejectedFilters.length > 0 && (
            <div
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 12,
                color: tokens.amber,
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Couldn’t screen on:</div>
              {rejectedFiltersToLines(screen.rejectedFilters).map((line, i) => (
                <div key={i}>• {line}</div>
              ))}
            </div>
          )}

          {/* Transparency strip — plain-language spec + match count + freshness */}
          {screen.screened && screen.appliedSpec && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '6px 10px',
                marginBottom: 12,
                fontSize: 12,
                color: tokens.textMuted,
              }}
            >
              <span style={{ color: tokens.textSecondary, fontWeight: 600 }}>
                {specToPlainLanguage(screen.appliedSpec)}
              </span>
              {typeof screen.matchCount === 'number' && typeof screen.universeSize === 'number' && screen.resultType !== 'industries' && (
                <span>· {screen.matchCount} of {screen.universeSize} match</span>
              )}
              {formatAsOf(screen.dataAsOf) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> as of {formatAsOf(screen.dataAsOf)}
                </span>
              )}
            </div>
          )}

          {/* Save-as-watchlist action — turns the screened cohort into a
              finalized, equippable watchlist (create-from-tickers → commit). */}
          {canSaveScreen && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                type="button"
                onClick={openSaveModal}
                disabled={isSending}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: `${tokens.teal}1a`,
                  color: tokens.teal,
                  border: `1px solid ${tokens.teal}66`,
                  cursor: isSending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: isSending ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <Bookmark size={15} /> Save as watchlist
              </button>
            </div>
          )}

          {/* Results list (RankRow) · empty-match note · or nothing (clarifying) */}
          {screen.screened && screen.results.length > 0 && (
            <ResultsList
              results={screen.results}
              appliedSpec={screen.appliedSpec}
              resultType={screen.resultType}
              onTap={handleTap}
              tokens={tokens}
            />
          )}

          {screen.screened && screen.results.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 16px',
                background: tokens.bgCard,
                border: `0.5px solid ${tokens.borderDefault}`,
                borderRadius: 14,
                color: tokens.textMuted,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {screen.resultType === 'industries'
                ? 'No industry rankings are available yet — the daily rankings may still be updating. Check back shortly.'
                : 'No names matched this screen. Try loosening a filter or widening the sector.'}
            </div>
          )}

          {/* Refinement chips (continue the session) */}
          {screen.suggestedActions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {screen.suggestedActions.map((action, i) => (
                <button
                  key={`${action}-${i}`}
                  type="button"
                  onClick={() => sendPrompt(action)}
                  disabled={isSending}
                  style={chipStyle}
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Save-as-watchlist modal — name → create-from-tickers → commit */}
      <AnimatePresence>
        {saveModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeSaveModal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 16,
            }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 420,
                background: tokens.bgCard,
                border: `1px solid ${tokens.teal}33`,
                borderRadius: 16,
                padding: 20,
              }}
            >
              {saveStatus === 'saved' ? (
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: `${tokens.teal}1a`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Check size={22} color={tokens.teal} />
                  </div>
                  <div style={{ color: tokens.textPrimary, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                    Saved to your watchlists
                  </div>
                  <div style={{ color: tokens.textSecondary, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                    Finalize and equip it from the Forge when your agent isn’t in a battle.
                  </div>
                  <button
                    type="button"
                    onClick={() => setSaveModalOpen(false)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: tokens.teal,
                      color: tokens.bgApp,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: tokens.textPrimary, fontSize: 16, fontWeight: 700 }}>
                      <Bookmark size={16} color={tokens.teal} /> Save as watchlist
                    </div>
                    <button
                      type="button"
                      onClick={closeSaveModal}
                      aria-label="Close"
                      style={{ background: 'transparent', border: 'none', color: tokens.textMuted, cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: tokens.textMuted, marginBottom: 6 }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={saveName}
                    maxLength={100}
                    autoFocus
                    onChange={(e) => setSaveName(e.target.value.slice(0, 100))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && saveName.trim()) confirmSave(); }}
                    placeholder="Name this watchlist"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: tokens.bgApp,
                      border: `1px solid ${tokens.teal}33`,
                      borderRadius: 10,
                      color: tokens.textPrimary,
                      fontSize: 14,
                      padding: '10px 12px',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />

                  <div style={{ color: tokens.textMuted, fontSize: 12, marginTop: 8 }}>
                    {(() => {
                      const n = screen?.results?.length || 0;
                      return n > 40
                        ? `Saving the top 40 of ${n} names from this screen.`
                        : `${n} name${n === 1 ? '' : 's'} from this screen.`;
                    })()}
                  </div>

                  {saveError && (
                    <div style={{ color: tokens.red, fontSize: 12.5, lineHeight: 1.5, marginTop: 10 }}>
                      {saveError}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                    <button
                      type="button"
                      onClick={closeSaveModal}
                      disabled={saveStatus === 'saving'}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 10,
                        border: `1px solid ${tokens.borderDefault}`,
                        background: 'transparent',
                        color: tokens.textSecondary,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmSave}
                      disabled={saveStatus === 'saving' || !saveName.trim()}
                      style={{
                        padding: '9px 18px',
                        borderRadius: 10,
                        border: 'none',
                        background: saveStatus === 'saving' || !saveName.trim() ? `${tokens.teal}40` : tokens.teal,
                        color: tokens.bgApp,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: saveStatus === 'saving' || !saveName.trim() ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {saveStatus === 'saving' ? 'Saving…' : 'Save & finalize'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Ranked results via the adapter. Three shapes: an INDUSTRY rollup (resultType
// "industries") renders the new IndustryRow; a return-ranked stock screen (rankBy ∈ the
// five return fields) renders ReturnRow's signed diverging bar; every other stock screen
// stays on the untouched RankRow.
function ResultsList({ results, appliedSpec, resultType, onTap, tokens }) {
  const isIndustries = resultType === 'industries';
  const isReturn = isReturnField(appliedSpec?.rankBy?.field);
  const industryData = isIndustries ? buildIndustryRows(results, appliedSpec) : null;
  const rankData = !isIndustries && !isReturn ? buildRankRows(results, appliedSpec) : null;
  const returnData = !isIndustries && isReturn ? buildReturnRows(results, appliedSpec) : null;

  return (
    <div
      style={{
        borderRadius: 14,
        background: tokens.bgCard,
        boxShadow: tokens.obsidianShadow,
        border: `0.5px solid ${tokens.borderDefault}`,
        overflow: 'hidden',
      }}
    >
      {/* List header (mirrors RankingsView) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 8px 8px',
          fontSize: '10px',
          color: tokens.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <span style={{ width: '24px', textAlign: 'right' }}>#</span>
        {isIndustries ? (
          <>
            <span style={{ flex: 1 }}>Industry</span>
            <span style={{ width: '54px', textAlign: 'right' }}>{isReturn ? 'Return' : 'Score'}</span>
          </>
        ) : (
          <>
            <span style={{ width: '48px' }}>Ticker</span>
            <span>Sector</span>
            <span style={{ flex: 1 }} />
            <span style={{ width: isReturn ? '54px' : '28px', textAlign: 'right' }}>
              {isReturn ? 'Return' : 'Score'}
            </span>
          </>
        )}
      </div>

      {isIndustries
        ? industryData.rows.map((row, i) => (
          <IndustryRow
            key={row.industry.name}
            displayName={row.displayName}
            totalStocks={row.totalStocks}
            rank={i + 1}
            value={row.value}
            isReturn={industryData.isReturn}
            maxAbs={industryData.maxAbs}
            maxScore={industryData.maxScore}
            tokens={tokens}
          />
        ))
        : isReturn
          ? returnData.rows.map((row, i) => (
            <ReturnRow
              key={row.stock.symbol}
              stock={row.stock}
              rank={i + 1}
              value={row.value}
              maxAbs={returnData.maxAbs}
              onTap={onTap}
              tokens={tokens}
            />
          ))
          : rankData.rows.map((row, i) => (
            <RankRow
              key={row.stock.symbol}
              stock={row.stock}
              rank={i + 1}
              type={row.type}
              maxScore={rankData.maxScore}
              onTap={onTap}
            />
          ))}
    </div>
  );
}

function SkeletonList({ tokens }) {
  return (
    <div
      style={{
        marginTop: 18,
        borderRadius: 14,
        background: tokens.bgCard,
        border: `0.5px solid ${tokens.borderDefault}`,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.35 }}
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.08 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 8px',
            borderBottom: '0.5px solid rgba(255,255,255,0.04)',
          }}
        >
          <div style={{ width: 24, height: 10, borderRadius: 4, background: tokens.bgElevated }} />
          <div style={{ width: 48, height: 12, borderRadius: 4, background: tokens.bgElevated }} />
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: tokens.bgElevated }} />
          <div style={{ width: 28, height: 12, borderRadius: 4, background: tokens.bgElevated }} />
        </motion.div>
      ))}
    </div>
  );
}

export default ScreenerView;
