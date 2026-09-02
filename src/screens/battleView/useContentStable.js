// src/screens/battleView/useContentStable.js
//
// Hold a value by CONTENT rather than by identity. Firestore hands the screen a
// freshly deserialised doc on every snapshot, so `agentBattle.portfolio` is a
// new object each time even when nothing in it changed; anything memoised on
// its identity (the row enrichment, the price-poll effect) re-runs for
// nothing. This returns the previously seen object as long as the serialised
// content is unchanged, so downstream identities move only when values do
// (review finding F3).
//
// Cheap on purpose: the portfolio is a handful of positions. Not for large or
// cyclic objects — JSON.stringify would be the wrong tool there.

import { useMemo } from 'react';

export function contentKey(value) {
  if (value == null) return 'null';
  try {
    return JSON.stringify(value);
  } catch {
    // Unserialisable (cyclic): fall back to identity semantics.
    return null;
  }
}

export default function useContentStable(value) {
  const key = contentKey(value);
  // The memo is keyed on the content; the value it returns is the first
  // object seen with that content. When the key is null (unserialisable) the
  // value itself is the dependency, i.e. plain identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => value, [key === null ? value : key]);
}
