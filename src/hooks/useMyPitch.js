// src/hooks/useMyPitch.js
//
// Backing Beta PR 4 — the viewer's own scouting line (design brief rev3 §3:
// "one line, two homes"). Both edit homes — the inline editor on their own
// team card and the profile-area editor — call this hook, which subscribes
// to teamPitches/{uid} (authed-read) and saves through POST /api/team/pitch.
// Neither home writes Firestore: the doc is `write: if false` for every
// client, so the server-validated text is the only text that can exist, and
// the subscription is what makes an edit in one home appear in the other.

import { useCallback, useEffect, useState } from 'react';
import { savePitch as savePitchRequest, subscribePitch } from '../services/backingService';

export default function useMyPitch(uid, enabled = true) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !uid) { setText(''); setLoaded(true); return undefined; }
    setLoaded(false);
    const unsub = subscribePitch(uid, (data) => {
      setText(typeof data?.text === 'string' ? data.text : '');
      setLoaded(true);
    });
    return () => unsub();
  }, [enabled, uid]);

  const save = useCallback(async (next) => {
    setSaving(true);
    setError(null);
    try {
      const body = await savePitchRequest(next);
      // The server's text, not the draft: it trimmed and stripped it.
      if (body?.pitch && typeof body.pitch.text === 'string') setText(body.pitch.text);
      return true;
    } catch (err) {
      setError(err?.code || 'server_error');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { text, loaded, saving, error, save };
}
