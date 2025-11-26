// src/firebase/config.js
// Firebase configuration and initialization

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase configuration from environment variables
 *
 * IMPORTANT: These environment variables must be set in .env:
 * - VITE_FIREBASE_API_KEY
 * - VITE_FIREBASE_AUTH_DOMAIN
 * - VITE_FIREBASE_PROJECT_ID
 * - VITE_FIREBASE_STORAGE_BUCKET
 * - VITE_FIREBASE_MESSAGING_SENDER_ID
 * - VITE_FIREBASE_APP_ID
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

/**
 * Validate Firebase configuration
 * Throws error if required environment variables are missing
 */
function validateFirebaseConfig() {
  const requiredFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missingFields.join(', ')}\n` +
      `Please ensure these environment variables are set in .env:\n` +
      missingFields.map(field => `- VITE_FIREBASE_${field.toUpperCase().replace(/([A-Z])/g, '_$1')}`).join('\n')
    );
  }
}

// Validate config before initialization
validateFirebaseConfig();

/**
 * Initialize Firebase app
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication instance
 */
export const auth = getAuth(app);

/**
 * Firestore Database instance
 */
export const db = getFirestore(app);

/**
 * Firebase app instance (for advanced use cases)
 */
export default app;

// Log successful initialization in development
if (import.meta.env.DEV) {
  console.log('🔥 Firebase initialized successfully');
  console.log('📦 Project ID:', firebaseConfig.projectId);
  console.log('🔐 Auth Domain:', firebaseConfig.authDomain);
}
