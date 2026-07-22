// src/hooks/useMasteryProfile.js
//
// Archetype Mastery P3 — the ONE client reader of masteryProfiles/{uid}
// (spec §10: owner-read profile; firestore.rules grants owner read, server
// write only). Live onSnapshot so the RecordSheet cards and the Training
// Report level progress move the moment an award lands.
//
// DARK CONTRACT (spec §7, dark rows photographed): while
// MASTERY_SURFACE_ENABLED is false this hook performs ZERO Firestore reads
// and always returns null — the flag check precedes the subscription, so
// the off state is byte-identical to a world without the hook. A missing
// profile (new user, pre-backfill) or a read error resolves to null too:
// callers render the honest empty state, never a spinner that lies.
//
// masteryConfig.js is a pure-constants leaf (the characterState.js
// src → api/_utils precedent).

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { MASTERY_SURFACE_ENABLED, MASTERY_PROFILES_COLLECTION } from '../../api/_utils/masteryConfig.js';

export default function useMasteryProfile(userId) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!MASTERY_SURFACE_ENABLED || !userId) {
      setProfile(null);
      return undefined;
    }
    const unsub = onSnapshot(
      doc(db, MASTERY_PROFILES_COLLECTION, userId),
      (snap) => setProfile(snap.exists() ? snap.data() : null),
      () => setProfile(null), // permission/transport → honest empty state
    );
    return unsub;
  }, [userId]);

  return MASTERY_SURFACE_ENABLED ? profile : null;
}
