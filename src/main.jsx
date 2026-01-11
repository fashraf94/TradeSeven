console.log('📱 App starting...');

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/holographic.css'
import App from './App.jsx'
import { Analytics } from '@vercel/analytics/react';
import { UserProvider } from './contexts';

// Initialize Firebase on app startup
console.log('Loading Firebase...');
import './firebase/config';
console.log('Firebase config loaded');

// Initialize debug utilities (available via window.mcDebug)
import './utils/debug';
console.log('Debug utilities loaded');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
    <Analytics />
  </StrictMode>,
)
