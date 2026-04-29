// src/components/discover/DiscoverPanel.jsx
//
// Discover panel — the inspiration surface of the Forge. Fetches all
// active themes from the discoverThemes Firestore collection (seeded
// by scripts/seed-discover-themes.js) and renders each as a
// ThemeCard in a responsive grid.
//
// Sprint 1 Phase 2 scope: card grid + tap stub. Phase 3 wires the
// modal and analytics writes; Sprint 3 reorganizes the layout into
// horizontal-scrolling rails (Sectors, Themes, Current Events,
// Recent Drops). For now, a single grid of 8 cards is the entire
// panel.

import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeCard from './ThemeCard';

export default function DiscoverPanel() {
  const { tokens } = useTheme();
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Phase 3 will wire this to open ThemeDetailModal and write a
  // discoverInteractions row. For now, log so a smoke test confirms
  // the click handler is reachable.
  const handleTap = (theme) => {
    console.log('[DiscoverPanel] tap card:', theme?.id, theme?.title);
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
      </div>
    </div>
  );
}
