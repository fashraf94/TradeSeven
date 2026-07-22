// src/hooks/useMasteryProfile.js
//
// Archetype Mastery P3 — the ONE client reader of masteryProfiles/{uid}
// (spec §10: owner-read profile; firestore.rules grants owner read, server
// write only). Live onSnapshot so the RecordSheet cards and the Training
// Report level progress move the moment an award lands.
//
// DARK CONTRACT (spec §7, dark rows photographed): while
// MASTERY_SURFACE_ENABLED is false this hook performs ZERO Firestore reads,
// never even LOADS firebase/config, and always returns null — the flag
// check precedes the subscription AND the firebase imports are lazy (pulled
// only inside the effect, which runs only when surface-on + a userId), so
// the off state adds no firebase dependency to any component that mounts
// this hook. A missing profile (new user, pre-backfill) or a read error
// resolves to null too: callers render the honest empty state.
//
// The lazy import is load-bearing beyond the dark contract: CharacterArea /
// ForgeOverview / the dashboards mount this hook, and their Node render
// tests mock only agentService — a static `firebase/config` import here
// would drag config-validation into every such render. masteryConfig.js is
// a pure-constants leaf (the characterState.js src -> api/_utils precedent).

import { useState, useEffect } from 'react';
import { MASTERY_SURFACE_ENABLED, MASTERY_PROFILES_COLLECTION } from '../../api/_utils/masteryConfig.js';

export default function useMasteryProfile(userId) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!MASTERY_SURFACE_ENABLED || !userId) {
      setProfile(null);
      return undefined;
    }
    let unsub = null;
    let cancelled = false;
    // Lazy — firebase is imported ONLY on the lit path (see the dark
    // contract note): module load pulls nothing firebase-adjacent.
    (async () => {
      const [{ db }, { doc, onSnapshot }] = await Promise.all([
        import('../firebase/config'),
        import('firebase/firestore'),
      ]);
      if (cancelled) return;
      unsub = onSnapshot(
        doc(db, MASTERY_PROFILES_COLLECTION, userId),
        (snap) => setProfile(snap.exists() ? snap.data() : null),
        () => setProfile(null), // permission/transport -> honest empty state
      );
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [userId]);

  return MASTERY_SURFACE_ENABLED ? profile : null;
}
