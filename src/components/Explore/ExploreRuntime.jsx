// src/components/Explore/ExploreRuntime.jsx
//
// Explore Build 1 — THE PAGE'S READS, held once per Search page (spec
// docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §5.3, §6; build prompt K-4, K-5, K-6, K-11).
//
// SearchDiscover mounts this lazily whenever the switch is not 'off' (never at 'off': then no
// Explore chunk is requested). It draws nothing. It holds the three reads at the PAGE's level —
// the tab content remounts on every tab switch, and a read there would repeat — and hands one
// snapshot up through `onChange`:
//   research   useExploreResearch: the one research read (loading · ready · gated · failed)
//   admitted   whether the Explore tab exists: always at 'on'; at 'allowlist' from the first ready
//              read on (and kept for the page's life, so a later failed read shows inside the tab)
//   stories    idle until admitted, then ONE getDocs; Try again is one more. `complete`: the read holds every
//              published story (fewer came back than its limit)
//   bookmarks  idle until admitted (and a player is signed in), then ONE read; a write per toggle
// Stories and bookmarks are never read for a player the read has not admitted at 'allowlist'.

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useExploreResearch from './useExploreResearch';
import { ExploreSourcesContext } from './exploreSources';
import { BOOKMARKS_MAX, RESEARCH } from './exploreView';

const IDLE = Object.freeze({ status: 'idle', list: [] });

function useLive() {
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  return live;
}

/** The stories: one read once `enabled`, and one per retry. */
function useStories({ enabled, readStories }) {
  const [state, setState] = useState(IDLE);
  const live = useLive();
  const seq = useRef(0);
  const load = useCallback(() => {
    seq.current += 1;
    const n = seq.current;
    setState({ status: 'loading', list: [], complete: false });
    Promise.resolve().then(() => readStories()).then(
      (out) => {
        if (!live.current || n !== seq.current) return;
        setState({ status: 'ready', list: Array.isArray(out?.list) ? out.list : [], complete: out?.complete === true });
      },
      () => { if (live.current && n === seq.current) setState({ status: 'failed', list: [], complete: false }); },
    );
  }, [readStories, live]);
  const started = useRef(false);
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    load();
  }, [enabled, load]);
  return useMemo(() => ({ ...state, retry: load }), [state, load]);
}

/**
 * The bookmarks: one read once `enabled`; a save or a remove per toggle (spec §3.8, K-11).
 *   - The toggles act only once the read has answered (saveBusyOf, exploreView.js): a write never races the first
 *     read, and the cap is never judged on a list not yet known (reviews A-5, B-3, B-4).
 *   - The cap of BOOKMARKS_MAX is the client's (the rules do not count): saves still in flight count toward it (B-3).
 *   - A write that fails leaves the list as it was and records, for THAT story, what failed and which control was
 *     tapped (`origin`): its one line shows next to that control, and a later write on another story never clears it
 *     (B-5, B-9). A new write on the same story clears its own line.
 */
function useBookmarks({ enabled, uid, sources }) {
  const [state, setState] = useState(() => ({ ...IDLE, pending: [], errors: {} }));
  const live = useLive();
  const seq = useRef(0);
  const pending = useRef(new Map()); // storyId → 'save' | 'remove'
  const load = useCallback(() => {
    seq.current += 1;
    const n = seq.current;
    setState((s) => ({ ...s, status: 'loading', list: [], errors: {} }));
    Promise.resolve().then(() => sources.readBookmarks(uid)).then(
      (list) => { if (live.current && n === seq.current) setState((s) => ({ ...s, status: 'ready', list: Array.isArray(list) ? list : [] })); },
      () => { if (live.current && n === seq.current) setState((s) => ({ ...s, status: 'failed', list: [] })); },
    );
  }, [sources, uid, live]);
  const started = useRef(false);
  useEffect(() => {
    if (!enabled || !uid || started.current) return;
    started.current = true;
    load();
  }, [enabled, uid, load]);

  const withoutError = (errors, storyId) => {
    if (!Object.hasOwn(errors, storyId)) return errors;
    const next = { ...errors };
    delete next[storyId];
    return next;
  };
  const write = useCallback((storyId, kind, origin, run, apply) => {
    if (pending.current.has(storyId)) return;
    pending.current.set(storyId, kind);
    setState((s) => ({ ...s, pending: [...pending.current.keys()], errors: withoutError(s.errors, storyId) }));
    Promise.resolve().then(run).then(
      (out) => {
        pending.current.delete(storyId);
        if (live.current) setState((s) => ({ ...s, list: apply(s.list, out), pending: [...pending.current.keys()] }));
      },
      () => {
        pending.current.delete(storyId);
        if (live.current) setState((s) => ({ ...s, pending: [...pending.current.keys()], errors: { ...s.errors, [storyId]: { kind, origin } } }));
      },
    );
  }, [live]);

  const toggle = useCallback((story, origin = null) => {
    if (!uid || !story || state.status !== 'ready') return;
    const saved = state.list.some((b) => b.storyId === story.id);
    if (saved) {
      write(story.id, 'remove', origin, () => sources.removeBookmark(uid, story.id), (list) => list.filter((b) => b.storyId !== story.id));
      return;
    }
    const savesInFlight = [...pending.current.values()].filter((k) => k === 'save').length;
    if (state.list.length + savesInFlight >= BOOKMARKS_MAX) {
      setState((s) => ({ ...s, errors: { ...s.errors, [story.id]: { kind: 'cap', origin } } }));
      return;
    }
    write(story.id, 'save', origin, () => sources.saveBookmark(uid, story), (list, added) => [added, ...list.filter((b) => b.storyId !== story.id)]);
  }, [uid, state.status, state.list, sources, write]);

  const remove = useCallback((storyId, origin = null) => {
    if (!uid || state.status !== 'ready') return;
    write(storyId, 'remove', origin, () => sources.removeBookmark(uid, storyId), (list) => list.filter((b) => b.storyId !== storyId));
  }, [uid, state.status, sources, write]);

  return useMemo(() => ({ ...state, retry: load, toggle, remove }), [state, load, toggle, remove]);
}

export default function ExploreRuntime({ uid = null, mode = 'off', onChange }) {
  const sources = useContext(ExploreSourcesContext);
  const research = useExploreResearch({ ownerKey: uid });
  const [admittedOnce, setAdmittedOnce] = useState(false);
  useEffect(() => {
    if (mode === 'allowlist' && research.status === RESEARCH.READY && !admittedOnce) setAdmittedOnce(true);
  }, [mode, research.status, admittedOnce]);
  const admitted = mode === 'on' || (mode === 'allowlist' && (admittedOnce || research.status === RESEARCH.READY));
  const stories = useStories({ enabled: admitted, readStories: sources.readStories });
  const bookmarks = useBookmarks({ enabled: admitted, uid, sources });

  useEffect(() => {
    onChange?.({ research, admitted, stories, bookmarks });
  }, [research, admitted, stories, bookmarks, onChange]);
  useEffect(() => () => { onChange?.(null); }, [onChange]);
  return null;
}
