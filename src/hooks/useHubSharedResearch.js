// src/hooks/useHubSharedResearch.js
//
// Command Center core spec V1.2, Amendment E V1.1 §1 — THE HUB'S RESEARCH READER. It reads the owner's newest research
// records through one Firestore query (src/services/sharedResearchRecords.js: researchWork, userId == uid, createdAt desc,
// limit 20, kept to origin 'shared_research'). Two hub surfaces read its answer: the Research panel's "Research in progress"
// line with Continue (hub/researchDoorView.js), and the three research Activity rows (hub/activityRows.js).
//
// One reader, in the S1 pattern: keyed by the owner's uid and auth epoch, a SINGLE service import, called once in
// ConnectedHub. It reads ONCE per owner and epoch for a mounted hub, and again only on `refresh()` (the door's Retry). There
// is no timer, no listener, no poll and no re-read on focus or a tab switch. With `enabled` false (a player outside
// admission, or the mode 'off') it reads nothing and stays `idle`. A failed refresh keeps the last good answer. An answer read
// for another owner or epoch is never shown: the read is judged against the current key in render, before any effect runs.
//
// The read is bounded on purpose (the service says why): finding nothing open is never said as "no research".

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSharedResearchRecords } from '../services/sharedResearchRecords';

const IDLE = Object.freeze({ key: null, status: 'idle', records: null, error: null });

export default function useHubSharedResearch({ auth, enabled }) {
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
      const records = await fetchSharedResearchRecords({ uid: key.slice(0, key.lastIndexOf(':')) });
      if (keyRef.current !== key || seq !== seqRef.current) return;
      setRead({ key, status: 'ready', records: Array.isArray(records) ? records : [], error: null });
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
