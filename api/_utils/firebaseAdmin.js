// api/_utils/firebaseAdmin.js
// Shared Firebase Admin SDK singleton for serverless functions.
// Avoids duplicating init logic across endpoints.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let dbInstance = null;

export function getFirebaseAdmin() {
  if (dbInstance) return dbInstance;

  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  dbInstance = getFirestore();
  return dbInstance;
}
