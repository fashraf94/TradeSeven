// src/components/PracticeField/useIdeaBook.js
//
// Practice Field build B3 — THE SCREEN'S ONE READ (ruling B3-7). `GET /api/practice-field/book`, keyed by the signed-in
// owner and their auth epoch (src/services/authIdentity.js, the hub readers' one identity source), so an answer asked
// for one identity is never shown to the next. The entry card and the page share it.
//
// NO POLL, NO LISTENER ON A STORE, NO TICKING: marks are as of the last close. It reads on these triggers only:
//   - mount, and a change of owner or auth epoch;
//   - `refresh()` — the page's open;
//   - the window regaining focus, or the page becoming visible again (two listeners, removed on unmount; one read for a
//     focus and a visibility change together; none after a 404 for the same owner).
// With `enabled` false (the screen switch off) it reads nothing, registers nothing and stays `idle`. A 404 is the
// server's "off for you" (the mode, the switch or the mode's gate): a settled `off`, never retried as an error. A read that
// fails keeps the last good answer.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthIdentity } from '../../services/authIdentity';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

/** The view version this screen draws (api/_utils/practiceField/bookView.js BOOK_VIEW_VERSION; 2: B3-11's waiting line, B3-12's byline). */
export const IDEA_BOOK_VIEW_VERSION = 2;
export const IDEA_BOOK_PATH = '/api/practice-field/book';

/** A focus and a visibility change arrive together on a return: one read for both. */
export const REFOCUS_QUIET_MS = 2000;

const IDLE = Object.freeze({ key: null, status: 'idle', book: null, error: null });
/**
 * The last good answer, for the current owner and epoch only (another key never reads it, and a new key clears it): a card
 * that remounts — the phone Overview tab coming back — draws at once and reads again behind it, instead of popping in.
 */
const LAST_GOOD = /* @__PURE__ */ new Map();

/** One read of the endpoint: `{ status: 'ready', book }`, `{ status: 'off' }`, or a thrown error. */
export async function fetchIdeaBook() {
  const response = await fetchWithAuth(IDEA_BOOK_PATH, { method: 'GET' });
  if (response.status === 404) return { status: 'off', book: null };
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok || !body || typeof body !== 'object') {
    const err = new Error(body?.error || `status_${response.status}`);
    err.status = response.status;
    throw err;
  }
  const book = body.book ?? null;
  if (book !== null && book.version !== IDEA_BOOK_VIEW_VERSION) {
    const err = new Error('view_version');
    err.status = 200;
    throw err;
  }
  return { status: 'ready', book };
}

/**
 * @param {{ enabled: boolean, fetcher?: () => Promise<object> }} p
 * @returns {{ read: { status: 'idle'|'loading'|'ready'|'off'|'error', book: object|null }, refresh: () => void }}
 */
export default function useIdeaBook({ enabled, fetcher = fetchIdeaBook }) {
  const identity = useAuthIdentity();
  const uid = enabled && identity?.resolved === true && typeof identity.uid === 'string' ? identity.uid : null;
  const key = uid ? `${uid}:${identity.authEpoch ?? ''}` : null;
  const [read, setRead] = useState(() => (key && LAST_GOOD.get(key)) || IDLE);
  const keyRef = useRef(key);
  keyRef.current = key;
  const seqRef = useRef(0);
  const lastRef = useRef(0);
  // A 404 is settled for this owner and epoch: the window regaining focus does not ask again (review A5).
  const offRef = useRef(null);

  const load = useCallback(async () => {
    if (!key) return;
    const seq = ++seqRef.current;
    lastRef.current = Date.now();
    setRead((prev) => (prev.key === key ? prev : { ...IDLE, key, status: 'loading' }));
    try {
      const out = await fetcher();
      if (keyRef.current !== key || seq !== seqRef.current) return;
      const next = { key, status: out.status, book: out.book ?? null, error: null };
      if (out.status === 'off') offRef.current = key;
      LAST_GOOD.clear();
      if (out.status === 'ready') LAST_GOOD.set(key, next);
      setRead(next);
    } catch (err) {
      if (keyRef.current !== key || seq !== seqRef.current) return;
      setRead((prev) => (prev.key === key && prev.status === 'ready'
        ? { ...prev, error: err?.message || 'read_failed' }
        : { ...IDLE, key, status: 'error', error: err?.message || 'read_failed' }));
    }
  }, [key, fetcher]);

  useEffect(() => {
    if (!key) { setRead(IDLE); return undefined; }
    load();
    const again = () => { if (offRef.current !== key && Date.now() - lastRef.current >= REFOCUS_QUIET_MS) load(); };
    const onFocus = () => again();
    const onVisible = () => { if (document.visibilityState === 'visible') again(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, load]);

  return { read: read.key === key ? read : IDLE, refresh: load };
}
