// api/economic-calendar.js
// Read endpoint: returns cached economic calendar from Firebase Firestore
// Called by frontend ResearchLandingPage to get enriched event data

import { applySecurityMiddleware } from './_utils/security.js';

// Firebase Admin lazy init
let firestoreInstance = null;
async function getFirestore() {
  if (firestoreInstance) return firestoreInstance;

  const { getFirestore: getFs } = await import('firebase-admin/firestore');
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  firestoreInstance = getFs();
  return firestoreInstance;
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await getFirestore();
    const doc = await db.collection('economicCalendar').doc('latest').get();

    if (!doc.exists) {
      return res.status(200).json({
        success: true,
        data: { events: [], weekOf: null, weekSummary: '', updatedAt: null },
      });
    }

    const { events, weekOf, weekSummary, updatedAt } = doc.data();

    return res.status(200).json({
      success: true,
      data: { events: events || [], weekOf, weekSummary: weekSummary || '', updatedAt },
    });
  } catch (error) {
    console.error('[EconomicCalendar] Error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}
