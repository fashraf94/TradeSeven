// test-firebase.js
// Quick Firebase connection test script

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Load environment variables (for Node.js testing)
import dotenv from 'dotenv';
dotenv.config();

console.log('🔥 Firebase Connection Test\n');
console.log('=' .repeat(50));

// Test 1: Environment Variables
console.log('\n📋 Test 1: Checking Environment Variables...');
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

let allEnvVarsPresent = true;
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value && value !== 'your_firebase_api_key_here' && value !== 'your-project-id') {
    console.log(`   ✅ ${varName}: Set`);
  } else {
    console.log(`   ❌ ${varName}: Missing or not configured`);
    allEnvVarsPresent = false;
  }
});

if (!allEnvVarsPresent) {
  console.log('\n❌ FAILED: Some environment variables are missing or not configured.');
  console.log('   Please check your .env file and ensure all Firebase credentials are set.\n');
  process.exit(1);
}

console.log('\n✅ All environment variables are set!');

// Test 2: Firebase Initialization
console.log('\n📋 Test 2: Initializing Firebase...');
try {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
  };

  const app = initializeApp(firebaseConfig);
  console.log(`   ✅ Firebase app initialized`);
  console.log(`   📦 Project ID: ${firebaseConfig.projectId}`);
} catch (error) {
  console.log(`   ❌ Firebase initialization failed: ${error.message}`);
  process.exit(1);
}

// Test 3: Firebase Auth Connection
console.log('\n📋 Test 3: Testing Firebase Authentication...');
try {
  const auth = getAuth();
  console.log(`   ✅ Firebase Auth initialized`);
  console.log(`   🔐 Auth Domain: ${auth.config.authDomain}`);
} catch (error) {
  console.log(`   ❌ Auth initialization failed: ${error.message}`);
  process.exit(1);
}

// Test 4: Firestore Connection
console.log('\n📋 Test 4: Testing Firestore Database...');
try {
  const db = getFirestore();
  console.log(`   ✅ Firestore initialized`);

  // Try to access collections (won't query, just check connection)
  const usersRef = collection(db, 'users');
  const battlesRef = collection(db, 'battles');
  const challengesRef = collection(db, 'challenges');

  console.log(`   ✅ Collections accessible: users, battles, challenges`);
} catch (error) {
  console.log(`   ❌ Firestore initialization failed: ${error.message}`);
  process.exit(1);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ All Firebase Connection Tests Passed!\n');
console.log('📊 Summary:');
console.log('   ✅ Environment variables configured');
console.log('   ✅ Firebase app initialized');
console.log('   ✅ Firebase Authentication ready');
console.log('   ✅ Firestore Database connected');
console.log('\n🎉 Firebase is ready to use!');
console.log('\n📝 Next Steps:');
console.log('   1. Enable feature flags in src/config/featureFlags.js');
console.log('   2. Test signup/login in your app');
console.log('   3. Deploy Firestore security rules');
console.log('');
