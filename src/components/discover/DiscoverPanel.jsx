// src/components/discover/DiscoverPanel.jsx
//
// Discover panel — the inspiration surface of the Forge. Fetches all
// active themes from the discoverThemes Firestore collection (seeded
// by scripts/seed-discover-themes.js) and renders each as a
// ThemeCard in a responsive grid.
//
// Phase 3 wires the rich-detail modal + analytics:
//   - Tap card → write 'tap_card' interaction + open ThemeDetailModal
//   - Modal "Start in Workshop" → write 'tap_start_workshop'
//     interaction + show toast (Sprint 6 will replace the toast with
//     the real Workshop seed-context handoff)
//
// Sprint 3 will reorganize this single grid into horizontal-scrolling
// rails (Sectors, Themes, Current Events, Recent Drops).

import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeCard from './ThemeCard';
import ThemeDetailModal from './ThemeDetailModal';
import SectorRail from './SectorRail';

// Fire-and-forget analytics write. We never want the UX to wait on
// the round-trip and we never want a logging failure to surface to
// the user. The discoverInteractions rules block (manual deploy) is
// scoped to allow only authenticated user-owned creates.
async function logInteraction({ themeId, action }) {
  try {
    const uid = auth?.currentUser?.uid;
    if (!uid || !themeId || !action) return;
    await addDoc(collection(db, 'discoverInteractions'), {
      userId: uid,
      themeId,
      action,
      timestamp: serverTimestamp(),
      source: 'discoverThemes',
    });
  } catch (err) {
    console.error('[DiscoverPanel] Failed to log interaction:', err);
  }
}

export default function DiscoverPanel({ showToast }) {
  const { tokens } = useTheme();
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadThemes() {
      try {
        const themesQ = query(
          collection(db, 'discoverThemes'),
          where('status', '==', 'active'),
          orderBy('displayOrder', 'asc')
        );
        const snap = await getDocs(themesQ);
        if (cancelled) return;
        setThemes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[DiscoverPanel] Failed to load themes:', err);
        setError(err);
        setLoading(false);
      }
    }
    loadThemes();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTap = (theme) => {
    if (!theme) return;
    logInteraction({ themeId: theme.id, action: 'tap_card' });
    setSelectedTheme(theme);
  };

  const handleCloseModal = () => {
    setSelectedTheme(null);
  };

  const handleStartWorkshop = (theme) => {
    if (!theme) return;
    logInteraction({ themeId: theme.id, action: 'tap_start_workshop' });
    if (typeof showToast === 'function') {
      showToast('Workshop integration ships in Sprint 6.');
    }
  };

  // Cross-modal handoff target for SectorDetailModal: open the theme
  // modal for a given themeId. SectorRail will have already closed its
  // own modal before invoking this. If the themeId no longer resolves
  // to an active theme (data drift), warn and no-op rather than render
  // an empty modal.
  const handleOpenThemeById = (themeId) => {
    if (!themeId) return;
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) {
      console.warn(
        `[DiscoverPanel] openThemeById: "${themeId}" not in active themes — ignoring.`
      );
      return;
    }
    setSelectedTheme(theme);
  };

  return (
    <div style={{ padding: '24px 4px' }}>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          color: tokens.textPrimary,
          lineHeight: 1.2,
        }}
      >
        Discover
      </h2>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 14,
          color: tokens.textMuted,
          lineHeight: 1.5,
        }}
      >
        Explore investable themes.
      </p>

      <div style={{ marginTop: 24 }}>
        {loading && (
          <div
            style={{
              color: tokens.textMuted,
              fontSize: 13,
              textAlign: 'center',
              padding: '32px 0',
            }}
          >
            Loading themes…
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              color: tokens.red,
              fontSize: 13,
              textAlign: 'center',
              padding: '32px 0',
            }}
          >
            Couldn&apos;t load themes. Refresh to try again.
          </div>
        )}

        {!loading && !error && themes.length === 0 && (
          <div
            style={{
              color: tokens.textMuted,
              fontSize: 13,
              textAlign: 'center',
              padding: '32px 0',
            }}
          >
            No themes available.
          </div>
        )}

        {!loading && !error && themes.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: 16,
            }}
          >
            {themes.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} onTap={handleTap} />
            ))}
          </div>
        )}

        <SectorRail
          showToast={showToast}
          themes={themes}
          onLinkedThemeTap={handleOpenThemeById}
        />
      </div>

      <ThemeDetailModal
        isOpen={Boolean(selectedTheme)}
        theme={selectedTheme}
        onClose={handleCloseModal}
        onStartWorkshop={handleStartWorkshop}
      />
    </div>
  );
}
