// src/components/Forge/Watchlist/useWatchlistAutosave.js
//
// Sprint 6 Phase 4B — debounced auto-save hook for the watchlist editor.
// Wraps the pure rules in autosaveLogic.js with the imperative machinery:
// a 1s debounce timer, an AbortController that cancels a superseded PATCH,
// a client-side rate-limit guard, and the 3-state save indicator.
//
// The hook owns `baselineRef` — the last server-confirmed field set — which
// is the no-op-skip reference. Timer callbacks reach the latest `flush`
// through `flushRef` so `flush` never has to depend on itself.

import { useState, useRef, useCallback, useEffect } from 'react';
import { patchWatchlist } from '../../../services/forgeWatchlistService';
import {
  fieldsEqual,
  mergePending,
  pruneTimestamps,
  canSaveNow,
  nextSaveState,
} from './autosaveLogic';

const DEBOUNCE_MS = 1000;
const SAVED_VISIBLE_MS = 2000;
const RATE_LIMIT = { limit: 28, windowMs: 60_000 };

export function useWatchlistAutosave(watchlistId) {
  const [saveState, setSaveState] = useState('idle');
  // C4: why the last save failed, when the server named a cause a retry cannot
  // fix (a retired ticker). Null for every other failure, while saving, and once saved.
  const [saveError, setSaveError] = useState(null);

  const baselineRef = useRef({}); // last server-confirmed field set
  const pendingRef = useRef(null); // queued unsaved fields
  const debounceRef = useRef(null);
  const fadeRef = useRef(null);
  const controllerRef = useRef(null);
  const timestampsRef = useRef([]);
  const flushRef = useRef(null);

  // Seed the baseline once the watchlist has loaded.
  const setBaseline = useCallback((fields) => {
    baselineRef.current = { ...fields };
  }, []);

  const flush = useCallback(() => {
    const payload = pendingRef.current;
    if (!payload) return;

    // No-op skip — the queued edit already matches the server state.
    if (fieldsEqual(payload, baselineRef.current)) {
      pendingRef.current = null;
      // C4: undoing the edit that was refused leaves nothing to save — clear its error.
      setSaveState((s) => nextSaveState(s, 'noop'));
      setSaveError(null);
      return;
    }

    // Rate-limit guard — defer rather than risk the endpoint's 429.
    const now = Date.now();
    timestampsRef.current = pruneTimestamps(timestampsRef.current, now, RATE_LIMIT.windowMs);
    if (!canSaveNow(timestampsRef.current, now, RATE_LIMIT)) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => flushRef.current?.(), DEBOUNCE_MS);
      return;
    }
    timestampsRef.current.push(now);

    // Supersede any in-flight PATCH.
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setSaveState((s) => nextSaveState(s, 'flush_start'));
    setSaveError(null);

    patchWatchlist(watchlistId, payload, { signal: controller.signal })
      .then(() => {
        if (controllerRef.current !== controller) return; // superseded
        baselineRef.current = { ...baselineRef.current, ...payload };
        // Clear the queue only if nothing new arrived while this save ran.
        if (pendingRef.current === payload) pendingRef.current = null;
        controllerRef.current = null;
        setSaveState((s) => nextSaveState(s, 'success'));
        clearTimeout(fadeRef.current);
        fadeRef.current = setTimeout(
          () => setSaveState((s) => nextSaveState(s, 'fade')),
          SAVED_VISIBLE_MS,
        );
      })
      .catch((err) => {
        if (controllerRef.current !== controller) return; // superseded — swallow
        if (err?.name === 'AbortError') return;
        controllerRef.current = null;
        const retired = err?.code === 'retired_ticker' && Array.isArray(err.symbols) && err.symbols.length > 0;
        if (retired && pendingRef.current === null) {
          // Review CL2-3: a no-op flush cleared the queue while this PATCH was in flight, i.e. the refused
          // edit (the retired ticker) was undone in the meantime. The line would name a ticker that is gone
          // and offer no Retry, so there is nothing to show.
          setSaveError(null);
          setSaveState((s) => nextSaveState(s, 'stale_refusal'));
          return;
        }
        setSaveError(retired ? { code: 'retired_ticker', symbols: err.symbols } : null);
        setSaveState((s) => nextSaveState(s, 'error'));
      });
  }, [watchlistId]);

  // Keep flushRef pointed at the latest flush for the timer / cleanup paths.
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Queue a partial edit and (re)arm the debounce timer.
  const queueSave = useCallback((patch) => {
    pendingRef.current = mergePending(pendingRef.current, patch);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flushRef.current?.(), DEBOUNCE_MS);
  }, []);

  // Re-attempt the failed save immediately (the error indicator's button).
  const retry = useCallback(() => {
    clearTimeout(debounceRef.current);
    flushRef.current?.();
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      clearTimeout(fadeRef.current);
      // Flush a queued edit so navigating away mid-debounce still saves.
      // flush() is a no-op when nothing is pending; an in-flight PATCH is
      // left to complete (a setState on the unmounted hook is harmless).
      flushRef.current?.();
    };
  }, []);

  return { saveState, saveError, queueSave, retry, setBaseline };
}

export default useWatchlistAutosave;
