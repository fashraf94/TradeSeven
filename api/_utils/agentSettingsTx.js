// api/_utils/agentSettingsTx.js
//
// Release 2 (spec changelog #7) — the ONE way to write snapshot-feeding agent
// settings inside a transaction. Every settings endpoint routes its agent-doc
// update through this helper, so the monotonic settingsRev increment is
// structural — a future endpoint cannot forget it (the invariant previously
// lived in per-endpoint comments; a new endpoint scaffolded from a pre-D3
// pattern file would silently ship without the bump, and the Phase-2
// snapshot-staleness check would read "unchanged" after a real config change).

import { FieldValue } from 'firebase-admin/firestore';

/**
 * tx.update(agentRef, fields) + the settingsRev increment, atomically.
 * Callers keep authoring their own fields (including updatedAt and dotted
 * paths like 'dials.tempo') — this merges ONLY the revision discipline.
 */
export function txUpdateAgentSettings(tx, agentRef, fields) {
  tx.update(agentRef, {
    ...fields,
    settingsRev: FieldValue.increment(1),
  });
}
