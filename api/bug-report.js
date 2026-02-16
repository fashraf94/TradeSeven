// api/bug-report.js
// ClashBot Bug Reporter API endpoint
// Modes: SUBMIT (POST), CLASSIFY (POST action), LIST (GET), UPDATE (POST action)

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { applySecurityMiddleware } from './_utils/security.js';
import { classifyBugReport } from './_utils/bugReportClassifier.js';

// =============================================================================
// FIREBASE ADMIN INITIALIZATION
// =============================================================================

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

// =============================================================================
// VALID STATUS VALUES
// =============================================================================

const VALID_STATUSES = ['new', 'triaging', 'diagnosed', 'in_progress', 'fixed', 'wontfix', 'duplicate'];

// =============================================================================
// HANDLER ENTRY POINT
// =============================================================================

export default async function handler(req, res) {
  // Apply security middleware: 10 requests/min rate limit
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  // Route by HTTP method
  if (req.method === 'GET') {
    return handleList(req, res);
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};

    if (action === 'classify') {
      return handleClassify(req, res);
    }

    if (action === 'update') {
      return handleUpdate(req, res);
    }

    // Default POST = SUBMIT
    return handleSubmit(req, res);
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

// =============================================================================
// MODE 1: SUBMIT — Create a new bug report
// =============================================================================

async function handleSubmit(req, res) {
  try {
    const { userDescription, metadata } = req.body;

    // Validate required fields
    if (!userDescription || typeof userDescription !== 'string' || userDescription.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userDescription is required and must be a non-empty string',
      });
    }

    if (userDescription.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'userDescription must be 5000 characters or fewer',
      });
    }

    const db = getFirebaseAdmin();

    // Generate ticket number atomically using a transaction
    const counterRef = db.collection('bugReports').doc('_counter');
    const ticketNumber = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let currentCount = 0;
      if (counterDoc.exists) {
        currentCount = counterDoc.data().count || 0;
      }

      const newCount = currentCount + 1;
      transaction.set(counterRef, { count: newCount }, { merge: true });

      return `CB-${String(newCount).padStart(4, '0')}`;
    });

    // Build the report document per schema
    const reportData = {
      ticketNumber,
      userId: metadata?.userId || 'anonymous',
      status: 'new',

      // Raw user input
      userDescription: userDescription.trim(),

      // AI classification — populated asynchronously after submission
      aiClassification: null,

      // Auto-captured metadata from the widget
      metadata: {
        screen: metadata?.screen || 'unknown',
        gameMode: metadata?.gameMode || null,
        battleId: metadata?.battleId || null,
        battleType: metadata?.battleType || null,
        userAgent: metadata?.userAgent || '',
        screenWidth: metadata?.screenWidth || 0,
        screenHeight: metadata?.screenHeight || 0,
        isMobile: metadata?.isMobile || false,
        isDesktop: metadata?.isDesktop || false,
        timestamp: FieldValue.serverTimestamp(),
        appVersion: metadata?.appVersion || 'beta',
        recentErrors: Array.isArray(metadata?.recentErrors)
          ? metadata.recentErrors.slice(0, 5)
          : [],
      },

      // Admin fields
      resolution: null,
      resolvedBy: null,
      duplicateOf: null,

      // Timestamps
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      classifiedAt: null,
    };

    const docRef = await db.collection('bugReports').add(reportData);

    console.log(`[BugReport] Created ${ticketNumber} (${docRef.id})`);

    // Fire-and-forget: classify in the background without blocking the response
    classifyBugReport(userDescription, reportData.metadata)
      .then(async (classification) => {
        try {
          await db.collection('bugReports').doc(docRef.id).update({
            aiClassification: classification,
            classifiedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`[BugReport] Classified ${ticketNumber}: ${classification.severity} ${classification.category}`);
        } catch (updateError) {
          console.error(`[BugReport] Failed to save classification for ${ticketNumber}:`, updateError.message);
        }
      })
      .catch((classifyError) => {
        console.error(`[BugReport] Classification failed for ${ticketNumber}:`, classifyError.message);
      });

    // Return immediately without waiting for classification
    return res.status(201).json({
      success: true,
      reportId: docRef.id,
      ticketNumber,
    });

  } catch (error) {
    console.error('[BugReport] Submit error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// =============================================================================
// MODE 2: CLASSIFY — Trigger AI classification for an existing report
// =============================================================================

async function handleClassify(req, res) {
  try {
    const { reportId } = req.body;

    if (!reportId || typeof reportId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'reportId is required',
      });
    }

    const db = getFirebaseAdmin();
    const reportRef = db.collection('bugReports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Bug report not found',
      });
    }

    const report = reportDoc.data();

    // Run classification synchronously (caller awaits the result)
    const classification = await classifyBugReport(
      report.userDescription,
      report.metadata
    );

    // Update the Firestore document
    await reportRef.update({
      aiClassification: classification,
      classifiedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[BugReport] Classified ${report.ticketNumber}: ${classification.severity} ${classification.category}`);

    return res.status(200).json({
      success: true,
      reportId,
      classification,
    });

  } catch (error) {
    console.error('[BugReport] Classify error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// =============================================================================
// MODE 3: LIST — Retrieve bug reports with optional filters
// =============================================================================

async function handleList(req, res) {
  try {
    const db = getFirebaseAdmin();
    const { status, severity, limit: limitParam } = req.query;

    const maxLimit = Math.min(parseInt(limitParam) || 50, 100);

    let query = db.collection('bugReports')
      .orderBy('createdAt', 'desc');

    // Apply optional filters
    if (status) {
      query = query.where('status', '==', status);
    }

    if (severity) {
      query = query.where('aiClassification.severity', '==', severity);
    }

    query = query.limit(maxLimit);

    const snapshot = await query.get();

    const reports = [];
    snapshot.forEach((doc) => {
      // Exclude the _counter document
      if (doc.id === '_counter') return;

      reports.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return res.status(200).json({
      success: true,
      reports,
      count: reports.length,
    });

  } catch (error) {
    console.error('[BugReport] List error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// =============================================================================
// MODE 4: UPDATE — Update report status/resolution
// =============================================================================

async function handleUpdate(req, res) {
  try {
    const { reportId, status, resolution, resolvedBy, duplicateOf } = req.body;

    if (!reportId || typeof reportId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'reportId is required',
      });
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const db = getFirebaseAdmin();
    const reportRef = db.collection('bugReports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Bug report not found',
      });
    }

    // Build update object with only provided fields
    const updateData = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (status !== undefined) updateData.status = status;
    if (resolution !== undefined) updateData.resolution = resolution;
    if (resolvedBy !== undefined) updateData.resolvedBy = resolvedBy;
    if (duplicateOf !== undefined) updateData.duplicateOf = duplicateOf;

    await reportRef.update(updateData);

    console.log(`[BugReport] Updated ${reportDoc.data().ticketNumber}: ${JSON.stringify(updateData)}`);

    return res.status(200).json({
      success: true,
      reportId,
      updated: updateData,
    });

  } catch (error) {
    console.error('[BugReport] Update error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
