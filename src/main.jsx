console.log('📱 App starting...');

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme/tokens.css'
import './styles/holographic.css'
import App from './App.jsx'
import { Analytics } from '@vercel/analytics/react';
import { UserProvider } from './contexts';
import { ThemeProvider } from './contexts/ThemeContext';
import { FantasyTimesProvider } from './contexts/FantasyTimesContext';
import ErrorBoundary from './components/ErrorBoundary';
import { backingPreviewRequested } from './components/League/backing/backingPreview';

// Initialize Firebase on app startup
console.log('Loading Firebase...');
import './firebase/config';
console.log('Firebase config loaded');

// Initialize debug utilities (available via window.mcDebug)
import './utils/debug';
console.log('Debug utilities loaded');

const root = createRoot(document.getElementById('root'));

// Backing Beta PR 4 — the dev-only Backing design preview (?preview=backing):
// the repo's ?preview= dev-screen gate (App.jsx's ?preview=baggerbomb), taken
// one level up so the app shell — auth, the user doc, the agent listeners —
// never mounts under it and the page opens no read. It mounts only under the
// Vite dev server or on a Vercel preview host, never on production
// (src/components/League/backing/backingPreview.js decides); anywhere else the
// app renders exactly as before. The page is its own lazily loaded chunk.
if (backingPreviewRequested(window.location, { DEV: import.meta.env.DEV, VITE_VERCEL_ENV: import.meta.env.VITE_VERCEL_ENV })) {
  import('./screens/BackingPreviewScreen')
    .then((preview) => {
      const BackingPreviewScreen = preview.default;
      root.render(
        <StrictMode>
          <BackingPreviewScreen />
        </StrictMode>,
      );
    })
    .catch((err) => console.error('[BackingPreview] the preview page failed to load:', err));
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary name="FantasyTrades App">
        <UserProvider>
          <ThemeProvider>
            <FantasyTimesProvider>
              <App />
            </FantasyTimesProvider>
          </ThemeProvider>
        </UserProvider>
      </ErrorBoundary>
      <Analytics />
    </StrictMode>,
  );
}
