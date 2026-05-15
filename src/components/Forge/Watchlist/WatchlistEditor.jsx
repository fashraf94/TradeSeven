// src/components/Forge/Watchlist/WatchlistEditor.jsx
//
// Sprint 6 Phase 4B — the watchlist editor surface. Loads a watchlist by id,
// renders its anatomy (thesis, conditions, notes) and its sector/industry-
// grouped tickers, and — for a draft — makes all of it editable with
// debounced auto-save, manual ticker add, slide-to-delete, and a commit
// ceremony. A committed watchlist is read-only until the edit-unlock flow
// reopens it.

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  getWatchlist,
  commitWatchlist,
  uncommitWatchlist,
} from '../../../services/forgeWatchlistService';
import { groupWatchlistTickers } from './groupWatchlistTickers';
import { useWatchlistAutosave } from './useWatchlistAutosave';
import SectionLabel from './SectionLabel';
import OffUniverseSection from './OffUniverseSection';
import TickerChip from './TickerChip';
import SaveStateIndicator from './SaveStateIndicator';
import TickerSearchAdd from './TickerSearchAdd';
import CommitModal from './CommitModal';
import UncommitModal from './UncommitModal';

const TICKER_CAP = 40;
const NAME_MAX = 100;
const THESIS_MAX = 1000;
const NOTES_MAX = 2000;
const CONDITION_MAX = 200;
const CONDITIONS_MAX = 3;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export default function WatchlistEditor({ watchlistId, onClose }) {
  const { tokens } = useTheme();
  const { saveState, queueSave, retry, setBaseline } = useWatchlistAutosave(watchlistId);

  const [loadState, setLoadState] = useState('loading'); // loading | error | loaded
  const [errorMessage, setErrorMessage] = useState('');

  const [name, setName] = useState('');
  const [thesis, setThesis] = useState('');
  const [notes, setNotes] = useState('');
  const [activation, setActivation] = useState([]);
  const [invalidation, setInvalidation] = useState([]);
  const [tickers, setTickers] = useState([]);
  const [status, setStatus] = useState('draft');

  const [commitOpen, setCommitOpen] = useState(false);
  const [uncommitOpen, setUncommitOpen] = useState(false);
  const [ceremonyError, setCeremonyError] = useState('');

  const readOnly = status === 'committed';

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setErrorMessage('');
    getWatchlist(watchlistId)
      .then((wl) => {
        if (cancelled) return;
        const t = Array.isArray(wl.tickers) ? wl.tickers : [];
        const act = Array.isArray(wl.activationConditions) ? wl.activationConditions : [];
        const inv = Array.isArray(wl.invalidationConditions) ? wl.invalidationConditions : [];
        setName(wl.name || '');
        setThesis(wl.thesis || '');
        setNotes(wl.notes || '');
        setActivation(act);
        setInvalidation(inv);
        setTickers(t);
        setStatus(wl.status || 'draft');
        setBaseline({
          name: wl.name || '',
          thesis: wl.thesis || '',
          notes: wl.notes || '',
          activationConditions: act,
          invalidationConditions: inv,
          tickers: t,
        });
        setLoadState('loaded');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err?.message || 'Could not load this watchlist.');
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [watchlistId, setBaseline]);

  // ── edit handlers — update local state, then queue a debounced save ──
  function editName(v) {
    const next = v.slice(0, NAME_MAX);
    setName(next);
    queueSave({ name: next });
  }
  function editThesis(v) {
    const next = v.slice(0, THESIS_MAX);
    setThesis(next);
    queueSave({ thesis: next });
  }
  function editNotes(v) {
    const next = v.slice(0, NOTES_MAX);
    setNotes(next);
    queueSave({ notes: next });
  }
  function editActivation(next) {
    setActivation(next);
    queueSave({ activationConditions: next });
  }
  function editInvalidation(next) {
    setInvalidation(next);
    queueSave({ invalidationConditions: next });
  }
  function addTicker(symbol) {
    if (tickers.length >= TICKER_CAP || tickers.some((t) => t.symbol === symbol)) return;
    const next = [
      ...tickers,
      { symbol, reasoning: '', category: '', addedBy: 'user', addedAt: new Date().toISOString() },
    ];
    setTickers(next);
    queueSave({ tickers: next });
  }
  function removeTicker(symbol) {
    const next = tickers.filter((t) => t.symbol !== symbol);
    setTickers(next);
    queueSave({ tickers: next });
  }

  // ── commit / edit-unlock ceremonies ──
  async function doCommit() {
    setCeremonyError('');
    try {
      await commitWatchlist(watchlistId);
      setStatus('committed');
    } catch (err) {
      setCeremonyError(err?.message || 'Could not commit the watchlist.');
    } finally {
      setCommitOpen(false);
    }
  }
  async function doUncommit() {
    setCeremonyError('');
    try {
      await uncommitWatchlist(watchlistId);
      setStatus('draft');
      // The current values become the auto-save baseline for the reopened draft.
      setBaseline({
        name,
        thesis,
        notes,
        activationConditions: activation,
        invalidationConditions: invalidation,
        tickers,
      });
    } catch (err) {
      setCeremonyError(err?.message || 'Could not unlock the watchlist.');
    } finally {
      setUncommitOpen(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: tokens.bgApp, color: tokens.textPrimary }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: tokens.bgCard,
          borderBottom: `1px solid ${tokens.borderDivider}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 8px' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close watchlist editor"
            style={iconBtn(tokens)}
          >
            <ArrowLeft size={16} />
          </button>
          <input
            value={name}
            onChange={(e) => editName(e.target.value)}
            disabled={readOnly || loadState !== 'loaded'}
            placeholder="Untitled watchlist"
            maxLength={NAME_MAX}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: tokens.textWhite,
              fontSize: 16,
              fontWeight: 700,
            }}
          />
          {loadState === 'loaded' && <StatusBadge tokens={tokens} status={status} />}
        </div>
        {loadState === 'loaded' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 10px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted, fontFamily: MONO }}>
              {tickers.length} / {TICKER_CAP}
            </span>
            {!readOnly && (
              <SaveStateIndicator tokens={tokens} saveState={saveState} onRetry={retry} />
            )}
            <div style={{ flex: 1 }} />
            {readOnly ? (
              <button
                type="button"
                onClick={() => setUncommitOpen(true)}
                style={actionBtn(tokens.purpleText, tokens.borderPurple, false)}
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCommitOpen(true)}
                disabled={tickers.length === 0}
                title={tickers.length === 0 ? 'Add at least one ticker to commit' : undefined}
                style={actionBtn(tokens.teal, tokens.teal, tickers.length === 0)}
              >
                Commit
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 80px' }}>
        {loadState === 'loading' && <CenterNote tokens={tokens}>Loading watchlist…</CenterNote>}
        {loadState === 'error' && (
          <CenterNote tokens={tokens}>
            <div style={{ marginBottom: 12 }}>{errorMessage}</div>
            <button type="button" onClick={onClose} style={actionBtn(tokens.textPrimary, tokens.borderInput, false)}>
              Back
            </button>
          </CenterNote>
        )}
        {loadState === 'loaded' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {ceremonyError && <div style={banner(tokens, tokens.red)}>{ceremonyError}</div>}
            {readOnly && (
              <div style={banner(tokens, tokens.purpleText)}>
                This watchlist is committed. Tap “Edit” to unlock it for changes.
              </div>
            )}

            <div>
              <SectionLabel tokens={tokens}>Thesis</SectionLabel>
              {readOnly ? (
                <p style={prose(tokens)}>{thesis || 'No thesis written.'}</p>
              ) : (
                <textarea
                  value={thesis}
                  onChange={(e) => editThesis(e.target.value)}
                  maxLength={THESIS_MAX}
                  rows={3}
                  placeholder="What's the idea behind this watchlist?"
                  style={textareaStyle(tokens)}
                />
              )}
            </div>

            <div>
              <SectionLabel tokens={tokens}>Activation conditions</SectionLabel>
              <ConditionsEditor
                tokens={tokens}
                items={activation}
                readOnly={readOnly}
                onChange={editActivation}
              />
            </div>

            <div>
              <SectionLabel tokens={tokens}>Invalidation conditions</SectionLabel>
              <ConditionsEditor
                tokens={tokens}
                items={invalidation}
                readOnly={readOnly}
                onChange={editInvalidation}
              />
            </div>

            <div>
              <SectionLabel tokens={tokens}>Tickers ({tickers.length})</SectionLabel>
              {!readOnly && (
                <div style={{ marginBottom: 12 }}>
                  <TickerSearchAdd
                    tokens={tokens}
                    existingSymbols={tickers.map((t) => t.symbol)}
                    atCap={tickers.length >= TICKER_CAP}
                    onAdd={addTicker}
                  />
                </div>
              )}
              {tickers.length === 0 ? (
                <p style={prose(tokens)}>
                  No tickers yet{readOnly ? '.' : ' — search above to add one.'}
                </p>
              ) : (
                <TickerGroups
                  tokens={tokens}
                  tickers={tickers}
                  onRemove={readOnly ? null : removeTicker}
                />
              )}
            </div>

            <div>
              <SectionLabel tokens={tokens}>Notes</SectionLabel>
              {readOnly ? (
                <p style={prose(tokens)}>{notes || 'No notes.'}</p>
              ) : (
                <textarea
                  value={notes}
                  onChange={(e) => editNotes(e.target.value)}
                  maxLength={NOTES_MAX}
                  rows={3}
                  placeholder="Private notes for this watchlist"
                  style={textareaStyle(tokens)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <CommitModal
        show={commitOpen}
        watchlist={{
          tickers,
          activationConditions: activation,
          invalidationConditions: invalidation,
        }}
        onConfirm={doCommit}
        onClose={() => setCommitOpen(false)}
      />
      <UncommitModal
        show={uncommitOpen}
        onConfirm={doUncommit}
        onClose={() => setUncommitOpen(false)}
      />
    </div>
  );
}

function TickerGroups({ tokens, tickers, onRemove }) {
  const grouped = groupWatchlistTickers(tickers);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {grouped.sectors.map((sector) => (
        <SectorGroup key={sector.sectorId} tokens={tokens} sector={sector} onRemove={onRemove} />
      ))}
      {grouped.offUniverse.length > 0 && (
        <OffUniverseSection
          unsupported={grouped.offUniverse.map((t) => t.symbol)}
          tokens={tokens}
          copyVariant="editor"
        />
      )}
    </div>
  );
}

function SectorGroup({ tokens, sector, onRemove }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: tokens.textWhite, marginBottom: 4 }}>
        {sector.name} <span style={{ color: tokens.textFaint }}>({sector.count})</span>
      </div>
      {sector.etfGroup.length > 0 && (
        <TickerSubGroup tokens={tokens} label="Sector ETF" tickers={sector.etfGroup} onRemove={onRemove} />
      )}
      {sector.industryGroups.map((ig) => (
        <TickerSubGroup
          key={ig.industry}
          tokens={tokens}
          label={ig.industry}
          tickers={ig.tickers}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function TickerSubGroup({ tokens, label, tickers, onRemove }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: tokens.textFaint,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tickers.map((t) => (
          <TickerChip
            key={t.symbol}
            symbol={t.symbol}
            type={t.type}
            tokens={tokens}
            onRemove={onRemove ? () => onRemove(t.symbol) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ConditionsEditor({ tokens, items, readOnly, onChange }) {
  if (readOnly) {
    if (items.length === 0) return <p style={prose(tokens)}>None set.</p>;
    return (
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((c, i) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: tokens.textSecondary }}>
            {c}
          </li>
        ))}
      </ul>
    );
  }

  const update = (i, value) =>
    onChange(items.map((c, idx) => (idx === i ? value.slice(0, CONDITION_MAX) : c)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => {
    if (items.length < CONDITIONS_MAX) onChange([...items, '']);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={c}
            onChange={(e) => update(i, e.target.value)}
            maxLength={CONDITION_MAX}
            placeholder="Describe a condition"
            style={{ ...inputBox(tokens), flex: 1 }}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove condition"
            style={iconBtn(tokens)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      {items.length < CONDITIONS_MAX && (
        <button type="button" onClick={add} style={addBtn(tokens)}>
          <Plus size={13} /> Add condition
        </button>
      )}
    </div>
  );
}

function StatusBadge({ tokens, status }) {
  const committed = status === 'committed';
  return (
    <span
      style={{
        flexShrink: 0,
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        background: tokens.bgIcon,
        border: `1px solid ${committed ? tokens.teal : tokens.borderPurple}`,
        color: committed ? tokens.teal : tokens.purpleText,
      }}
    >
      {committed ? 'Committed' : 'Draft'}
    </span>
  );
}

function CenterNote({ tokens, children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '40vh',
        color: tokens.textMuted,
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}

function prose(tokens) {
  return { margin: 0, fontSize: 14, lineHeight: 1.6, color: tokens.textSecondary };
}

function iconBtn(tokens) {
  return {
    width: 32,
    height: 32,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    cursor: 'pointer',
    background: tokens.bgIcon,
    border: `1px solid ${tokens.borderInput}`,
    color: tokens.textPrimary,
  };
}

function inputBox(tokens) {
  return {
    padding: '8px 10px',
    borderRadius: 8,
    background: tokens.bgCard,
    border: `1px solid ${tokens.borderInput}`,
    color: tokens.textPrimary,
    fontSize: 13,
    outline: 'none',
  };
}

function textareaStyle(tokens) {
  return {
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    padding: '10px 12px',
    borderRadius: 8,
    background: tokens.bgCard,
    border: `1px solid ${tokens.borderInput}`,
    color: tokens.textPrimary,
    fontSize: 14,
    lineHeight: 1.5,
    outline: 'none',
    fontFamily: 'inherit',
  };
}

function addBtn(tokens) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    padding: '6px 10px',
    borderRadius: 7,
    cursor: 'pointer',
    background: 'transparent',
    border: `1px dashed ${tokens.borderInput}`,
    color: tokens.textMuted,
    fontSize: 12,
    fontWeight: 700,
  };
}

function actionBtn(color, borderColor, disabled) {
  return {
    padding: '6px 14px',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: 'transparent',
    border: `1px solid ${borderColor}`,
    color,
    fontSize: 13,
    fontWeight: 700,
    opacity: disabled ? 0.45 : 1,
  };
}

function banner(tokens, color) {
  return {
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
    background: tokens.bgCard,
    border: `1px solid ${color}`,
    color,
  };
}
