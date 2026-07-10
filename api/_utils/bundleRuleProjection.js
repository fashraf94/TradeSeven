// api/_utils/bundleRuleProjection.js
//
// Release 2 (settingsRev migration) — the ONE frozen-snapshot → activeRules
// projection, shared by api/agent/equip-bundle.js and unequip-bundle.js so
// the agent doc's activeRules shape can never depend on which endpoint last
// wrote it (the BUILD_RULES §4 local-copy drift class — the same reason
// ruleCompatClassify.js was extracted). Byte-identical to the client
// implementation both endpoints replaced (forgeService @ 4a0f43e).

/**
 * Project bundle rule snapshots (already tagged with bundleName) into the
 * agent.activeRules entry shape.
 */
export function snapshotsToActiveRules(allSnapshots) {
  return (allSnapshots || []).map((snap) => ({
    ruleId: snap.id,
    text: snap.text,
    textTemplate: snap.textTemplate || null,
    params: snap.params || null,
    paramValues: snap.paramValues || null,
    category: snap.category || null,
    bundleName: snap.bundleName,
    // Carried for the conflict reconciler (see forgeBundle snapshot note).
    sourceRef: snap.sourceRef || null,
    provenance: snap.provenance || null,
  }));
}

/**
 * Transactionally gather the tagged rule snapshots of a set of bundles
 * (each snapshot gains its bundle's name — the projection input shape).
 * Missing bundle docs are skipped, mirroring the client behavior.
 *
 * @param {Object} tx        Firestore transaction (getAll capable)
 * @param {Object} bundlesCol the agent's bundles subcollection ref
 * @param {string[]} bundleIds
 */
export async function gatherBundleSnapshots(tx, bundlesCol, bundleIds) {
  if (!bundleIds || bundleIds.length === 0) return [];
  const snaps = await tx.getAll(...bundleIds.map((id) => bundlesCol.doc(id)));
  const out = [];
  for (const snap of snaps) {
    if (snap.exists) {
      const data = snap.data();
      out.push(...(data.ruleSnapshots || []).map((r) => ({ ...r, bundleName: data.name })));
    }
  }
  return out;
}
