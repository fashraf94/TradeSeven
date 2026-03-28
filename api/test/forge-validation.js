// api/test/forge-validation.js
// TEMPORARY — Forge data layer validation endpoint.
// Creates test rules, bundles them, forges, equips, and verifies agent doc state.
// Auth: CRON_SECRET header. Remove after integration testing.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

export const config = { maxDuration: 15 };

const TEST_RULES = [
  { text: 'Never allocate more than 30% to any single sector', category: 'allocation', source: 'discover', visibility: 'public' },
  { text: 'Exit any position that drops below -2x ATR from entry', category: 'risk', source: 'discover', visibility: 'public' },
  { text: 'Prefer stocks showing Bollinger Band squeeze with volume confirmation', category: 'technical', source: 'discover', visibility: 'public' },
  { text: 'Favor companies with positive earnings surprise in last 2 quarters', category: 'fundamental', source: 'discover', visibility: 'public' },
  { text: 'In defensive market conditions, rotate toward low-beta utility and consumer staples stocks', category: 'technical', source: 'forge_custom', visibility: 'private' },
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const report = {};

  try {
    const db = getFirebaseAdmin();
    const agentId = req.query.agentId;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId query param required' });
    }

    // Verify agent exists
    const agentRef = db.collection('agents').doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) {
      return res.status(404).json({ error: `Agent ${agentId} not found` });
    }

    // Check for active battle (equip will be skipped if one exists)
    const activeBattles = await db.collection('agentBattles')
      .where('agentId', '==', agentId)
      .where('status', '==', 'active')
      .get();
    const hasActiveBattle = !activeBattles.empty;

    // ---- Step 1: Create 5 test rules ----
    const rulesCol = agentRef.collection('rules');
    const ruleIds = [];
    for (const rule of TEST_RULES) {
      const ruleDoc = await rulesCol.add({
        text: rule.text,
        source: rule.source,
        sourceRef: null,
        visibility: rule.visibility,
        category: rule.category,
        params: null,
        isRefined: false,
        isDeleted: false,
        bundleIds: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      ruleIds.push(ruleDoc.id);
    }
    report.step1_rules_created = { success: true, ruleIds, count: ruleIds.length };

    // ---- Step 2: Create a draft bundle ----
    const bundlesCol = agentRef.collection('bundles');
    const bundleDoc = await bundlesCol.add({
      name: 'Forge Validation Bundle',
      version: 1,
      previousVersionId: null,
      status: 'draft',
      ruleIds: [],
      ruleSnapshots: [],
      conflictCheckResult: null,
      createdAt: FieldValue.serverTimestamp(),
      forgedAt: null,
      equippedAt: null,
      archivedAt: null,
      performanceData: { battlesEquipped: 0, totalCitations: 0, successfulCitations: 0 },
    });
    const bundleId = bundleDoc.id;
    report.step2_bundle_created = { success: true, bundleId };

    // ---- Step 3: Add all rule IDs to the bundle ----
    await bundlesCol.doc(bundleId).update({
      ruleIds,
      updatedAt: FieldValue.serverTimestamp(),
    });
    report.step3_rules_added = { success: true, ruleCount: ruleIds.length };

    // ---- Step 4: Forge the bundle — read rules, build snapshots ----
    const ruleSnapshots = [];
    for (const ruleId of ruleIds) {
      const ruleSnap = await rulesCol.doc(ruleId).get();
      if (ruleSnap.exists) {
        const ruleData = ruleSnap.data();
        ruleSnapshots.push({
          id: ruleId,
          text: ruleData.text,
          category: ruleData.category,
          visibility: ruleData.visibility,
        });
      }
    }

    await bundlesCol.doc(bundleId).update({
      ruleSnapshots,
      status: 'forged',
      forgedAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const categoriesFound = [...new Set(ruleSnapshots.map(r => r.category).filter(Boolean))];
    report.step4_bundle_forged = {
      success: true,
      snapshotCount: ruleSnapshots.length,
      categoriesFound,
    };

    // ---- Step 5: Equip the bundle (skip if active battle) ----
    if (hasActiveBattle) {
      report.step5_bundle_equipped = {
        success: false,
        skipped: true,
        reason: 'Agent has an active battle — cannot equip mid-battle. Writing activeRules directly for testing.',
      };
      // Write activeRules directly to agent doc for testing (bypasses battle check)
      const activeRules = ruleSnapshots.map(snap => ({
        ruleId: snap.id,
        text: snap.text,
        category: snap.category || null,
        bundleName: 'Forge Validation Bundle',
      }));
      await agentRef.update({
        activeRules,
        equippedBundleIds: [bundleId],
        updatedAt: FieldValue.serverTimestamp(),
      });
      await bundlesCol.doc(bundleId).update({
        status: 'equipped',
        equippedAt: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Normal equip flow
      const agentData = agentSnap.data();
      const currentEquipped = agentData?.equippedBundleIds || [];

      // Gather snapshots from already-equipped bundles
      const allSnapshots = [];
      for (const eid of currentEquipped) {
        const eSnap = await bundlesCol.doc(eid).get();
        if (eSnap.exists) {
          const eData = eSnap.data();
          allSnapshots.push(...(eData.ruleSnapshots || []).map(r => ({
            ...r, bundleName: eData.name,
          })));
        }
      }
      allSnapshots.push(...ruleSnapshots.map(r => ({
        ...r, bundleName: 'Forge Validation Bundle',
      })));

      const activeRules = allSnapshots.map(snap => ({
        ruleId: snap.id,
        text: snap.text,
        category: snap.category || null,
        bundleName: snap.bundleName,
      }));

      const batch = db.batch();
      batch.update(bundlesCol.doc(bundleId), {
        status: 'equipped',
        equippedAt: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(agentRef, {
        equippedBundleIds: [...currentEquipped, bundleId],
        activeRules,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();

      report.step5_bundle_equipped = {
        success: true,
        activeRulesCount: activeRules.length,
        equippedBundleIds: [...currentEquipped, bundleId],
      };
    }

    // ---- Step 6: Read back agent doc and verify ----
    const updatedAgent = await agentRef.get();
    const updatedData = updatedAgent.data();
    const activeRules = updatedData.activeRules || [];
    const constraintCount = activeRules.filter(r => r.category === 'risk' || r.category === 'allocation').length;
    const strategyCount = activeRules.filter(r => r.category === 'technical' || r.category === 'fundamental' || !r.category).length;

    report.step6_agent_doc_check = {
      activeRules,
      constraintCount,
      strategyCount,
      equippedBundleIds: updatedData.equippedBundleIds || [],
      hasActiveBattle,
    };

    return res.status(200).json({ success: true, ...report });
  } catch (error) {
    console.error('[forge-validation] Failed:', error.message, error.stack);
    return res.status(500).json({ success: false, error: error.message, report });
  }
}
