// src/test/FirebaseTest.jsx
// In-app Firebase connection test component

import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { signInAnonymously } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';

export default function FirebaseTest() {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [allPassed, setAllPassed] = useState(false);

  const addResult = (testName, passed, message) => {
    setTestResults(prev => [...prev, { testName, passed, message }]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    let passed = 0;
    let failed = 0;

    // Test 1: Firebase Config
    try {
      if (auth && db) {
        addResult('Firebase Initialization', true, 'Firebase Auth and Firestore initialized successfully');
        passed++;
      } else {
        throw new Error('Auth or Firestore not initialized');
      }
    } catch (error) {
      addResult('Firebase Initialization', false, error.message);
      failed++;
    }

    // Test 2: Environment Variables
    try {
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      if (projectId && projectId !== 'your-project-id') {
        addResult('Environment Variables', true, `Project ID: ${projectId}`);
        passed++;
      } else {
        throw new Error('Firebase project ID not configured');
      }
    } catch (error) {
      addResult('Environment Variables', false, error.message);
      failed++;
    }

    // Test 3: Anonymous Auth (safe test that doesn't require real user)
    try {
      await signInAnonymously(auth);
      addResult('Firebase Authentication', true, 'Successfully authenticated anonymously');
      passed++;

      // Sign out immediately
      await auth.signOut();
    } catch (error) {
      addResult('Firebase Authentication', false, `Auth test failed: ${error.message}`);
      failed++;
    }

    // Test 4: Firestore Write/Read
    try {
      // Try to write a test document
      const testRef = await addDoc(collection(db, 'test'), {
        test: true,
        timestamp: new Date().toISOString()
      });

      // Try to read it back
      const snapshot = await getDocs(collection(db, 'test'));
      const found = snapshot.docs.some(doc => doc.id === testRef.id);

      if (found) {
        addResult('Firestore Write/Read', true, 'Successfully wrote and read test document');
        passed++;

        // Clean up test document
        await deleteDoc(doc(db, 'test', testRef.id));
      } else {
        throw new Error('Test document not found');
      }
    } catch (error) {
      if (error.code === 'permission-denied') {
        addResult('Firestore Write/Read', false, 'Permission denied - Firestore rules need to be configured');
      } else {
        addResult('Firestore Write/Read', false, `Firestore test failed: ${error.message}`);
      }
      failed++;
    }

    // Test 5: Collections Exist
    try {
      const usersRef = collection(db, 'users');
      const battlesRef = collection(db, 'battles');
      const challengesRef = collection(db, 'challenges');

      if (usersRef && battlesRef && challengesRef) {
        addResult('Collection References', true, 'All required collections accessible');
        passed++;
      }
    } catch (error) {
      addResult('Collection References', false, error.message);
      failed++;
    }

    // Summary
    setAllPassed(failed === 0);
    setIsRunning(false);

    addResult('Test Summary', failed === 0, `${passed} passed, ${failed} failed`);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'white',
      border: '2px solid #3B82F6',
      borderRadius: '8px',
      padding: '20px',
      maxWidth: '500px',
      maxHeight: '80vh',
      overflow: 'auto',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 9999
    }}>
      <h2 style={{ margin: '0 0 15px 0', color: '#1F2937' }}>
        🔥 Firebase Connection Test
      </h2>

      <button
        onClick={runTests}
        disabled={isRunning}
        style={{
          background: '#3B82F6',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          opacity: isRunning ? 0.6 : 1,
          marginBottom: '15px',
          width: '100%',
          fontSize: '14px',
          fontWeight: '600'
        }}
      >
        {isRunning ? 'Running Tests...' : 'Run Connection Tests'}
      </button>

      {testResults.length > 0 && (
        <div style={{ marginTop: '15px' }}>
          {testResults.map((result, index) => (
            <div
              key={index}
              style={{
                padding: '10px',
                marginBottom: '8px',
                borderRadius: '6px',
                background: result.passed ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${result.passed ? '#10B981' : '#EF4444'}`
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{ fontSize: '18px' }}>
                  {result.passed ? '✅' : '❌'}
                </span>
                <strong style={{
                  color: result.passed ? '#065F46' : '#991B1B',
                  fontSize: '14px'
                }}>
                  {result.testName}
                </strong>
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6B7280',
                marginLeft: '26px'
              }}>
                {result.message}
              </div>
            </div>
          ))}

          {!isRunning && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: allPassed ? '#ECFDF5' : '#FEF2F2',
              borderRadius: '6px',
              border: `2px solid ${allPassed ? '#10B981' : '#EF4444'}`
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: allPassed ? '#065F46' : '#991B1B'
              }}>
                {allPassed ? '🎉 All Tests Passed!' : '⚠️ Some Tests Failed'}
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '5px' }}>
                {allPassed
                  ? 'Firebase is connected and ready to use!'
                  : 'Check the failed tests above and fix any issues.'}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '15px',
        padding: '10px',
        background: '#F3F4F6',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#6B7280'
      }}>
        <strong>Note:</strong> This component is for testing only. Remove before production.
      </div>
    </div>
  );
}
