// api/_utils/firebaseAdmin.js
// Shared Firebase Admin SDK singleton for serverless functions.
// Avoids duplicating init logic across endpoints.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let dbInstance = null;
let authInstance = null;

function ensureInitialized() {
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
}

export function getFirebaseAdmin() {
  if (dbInstance) return dbInstance;

  ensureInitialized();

  dbInstance = getFirestore();
  return dbInstance;
}

export function getFirebaseAuth() {
  if (authInstance) return authInstance;

  ensureInitialized();

  authInstance = getAuth();
  return authInstance;
}
