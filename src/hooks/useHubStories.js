// src/hooks/useHubStories.js
//
// Command Center core spec V1.2, Amendment E V1.1 §1 (ruling R-D2) — THE HUB'S STORIES READER. It calls fetchFeed()
// (/api/fantasytimes/feed, the route the FantasyTimes page's data comes from; published, unexpired, newest first, up to 100,
// CDN-cached). The story selector (src/selectors/storySelection.js) turns the answer into the sheet's Recent stories.
//
// One reader, in the S1 pattern: keyed by the owner's uid and auth epoch, a SINGLE service import, called once in
// ConnectedHub. It reads ONCE per owner and epoch for a mounted hub, and again only on `refresh()` (a Retry). There is no
// timer, no listener and no re-read on focus or a tab switch. With `enabled` false (a player outside admission, or the mode
// 'off') it reads nothing and stays `idle`. A failed refresh keeps the last good answer. An answer read for another owner
// or epoch is never shown: the read is judged against the current key in render, before any effect runs.
//
// It is not the root FantasyTimes context (src/contexts/FantasyTimesContext.jsx), which re-reads every 120 s and throws
// without its provider (ruling R-D2).

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFeed } from '../services/fantasyTimesClient';

const IDLE = Object.freeze({ key: null, status: 'idle', stories: null, error: null });

export default function useHubStories({ auth, enabled }) {
  const uid = enabled === true && auth?.signedIn === true && typeof auth.uid === 'string' && auth.uid ? auth.uid : null;
  const key = uid ? `${uid}:${auth.authEpoch ?? ''}` : null;
  const [read, setRead] = useState(IDLE);
  const keyRef = useRef(key);
  keyRef.current = key;
  // Each load is numbered: an older read landing after a newer one is dropped (the useHuddleHistory precedent).
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    if (!key) return;
    const seq = ++seqRef.current;
    setRead((prev) => (prev.key === key ? prev : { ...IDLE, key, status: 'loading' }));
    try {
      const stories = await fetchFeed();
      if (keyRef.current !== key || seq !== seqRef.current) return;
      setRead({ key, status: 'ready', stories: Array.isArray(stories) ? stories : [], error: null });
    } catch (err) {
      if (keyRef.current !== key || seq !== seqRef.current) return;
      setRead((prev) => (prev.key === key && prev.status === 'ready'
        ? { ...prev, error: err?.message || 'read_failed', stale: true }
        : { ...IDLE, key, status: 'error', error: err?.message || 'read_failed' }));
    }
  }, [key]);

  // Once per owner and epoch.
  useEffect(() => {
    if (!key) { setRead(IDLE); return; }
    load();
  }, [key, load]);

  return { read: read.key === key ? read : IDLE, refresh: load };
}
