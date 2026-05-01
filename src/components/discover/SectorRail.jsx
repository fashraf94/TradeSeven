// src/components/discover/SectorRail.jsx
//
// Horizontal rail of 11 SPDR sector cards for the Discover surface.
// Sits below the themes grid in DiscoverPanel.
//
// Data sources:
//   - discoverSectors Firestore collection (registry: ticker, name,
//     status, displayOrder) — auth-gated read, ordered by displayOrder
//   - indexIntelligence/marketContext Firestore doc — sectorSnapshot
//     array provides 1d (changePercent) and 5d (weekChange) per ETF.
//     Single doc read returns all 11 sectors. Refresh cadence: daily
//     cron via api/cron/compute-index-intelligence.js.
//   - SECTOR_CONTENT in sectorContent.js — editorial content (used by
//     SectorDetailModal in Phase 3; in Phase 2 only used as a parity
//     check to detect drift between Firestore registry and constants)
//   - SECTORS in src/constants/sectors.js — static topHoldings arrays
//     (top 5 displayed per card).
//
// "What's Hot This Week" leaderboard:
//   Sort sectors by 5-day weekChange desc. Top 3 receive medal ranks
//   1/2/3 (gold/silver/bronze). Tie-breaker: displayOrder asc.
//   Render order: [hot 3 in rank order] + [remaining 8 in displayOrder].
//
// Loading: while sectorSnapshot is loading, render in displayOrder
// with no medals and null %s. When data arrives, in-place reorder
// via Framer Motion `layout` on each SectorCard.
//
// Error: if either Firestore read fails, render in displayOrder with
// no medals; do not crash the rail. Single console.warn per failure.
//
// Phase 2 tap stub: writes tap_sector_card analytics (Option A schema:
// themeId field stores sector ticker) and shows a toast directing
// users to Phase 3. Phase 3 will replace the stub with the real
// SectorDetailModal.

import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useTheme } from '../../contexts/ThemeContext';
import { SECTORS as SECTOR_HOLDINGS_MAP } from '../../constants/sectors';
import { SECTOR_CONTENT } from './sectorContent';
import SectorCard from './SectorCard';
import SectorDetailModal from './SectorDetailModal';

// Fire-and-forget analytics write. Mirrors DiscoverPanel.jsx
// logInteraction. The `themeId` field name is preserved from Sprint 1
// for backwards compatibility with existing analytics queries — for
// Sprint 2 sector writes it functions as a generic primary entity ID
// (sector ticker for tap_sector_card and tap_top_holding; theme docId
// for tap_linked_theme_from_sector). Don't rename.
async function logSectorInteraction({ themeId, action, extra }) {
  try {
    const uid = auth?.currentUser?.uid;
    if (!uid || !themeId || !action) return;
    await addDoc(collection(db, 'discoverInteractions'), {
      userId: uid,
      themeId,
      action,
      timestamp: serverTimestamp(),
      source: 'discoverSectors',
      ...(extra || {}),
    });
  } catch (err) {
    console.error('[SectorRail] Failed to log interaction:', err);
  }
}

// Reorder logic. Pure function so it stays unit-testable.
// `sectors` is the Firestore registry, already in displayOrder asc.
// `sectorSnapshot` is the indexIntelligence sectorSnapshot array (or null).
function computeRenderOrder(sectors, sectorSnapshot) {
  const snapshotByTicker =
    sectorSnapshot && Array.isArray(sectorSnapshot)
      ? Object.fromEntries(sectorSnapshot.map((s) => [s.etf, s]))
      : {};

  const enriched = sectors.map((s) => {
    const snap = snapshotByTicker[s.ticker];
    return {
      ...s,
      oneDayPct: snap?.changePercent ?? null,
      fiveDayPct: snap?.weekChange ?? null,
      medalRank: null,
    };
  });

  const hasFiveDayData = enriched.some((s) => s.fiveDayPct != null);
  if (!hasFiveDayData) {
    return [...enriched].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  const sortedByFiveDay = enriched
    .filter((s) => s.fiveDayPct != null)
    .sort((a, b) => {
      if (b.fiveDayPct !== a.fiveDayPct) return b.fiveDayPct - a.fiveDayPct;
      // Tie-breaker: displayOrder ascending — deterministic across renders.
      return a.displayOrder - b.displayOrder;
    });

  const hot3 = sortedByFiveDay.slice(0, 3);
  hot3.forEach((s, i) => {
    s.medalRank = i + 1;
  });

  const hotTickers = new Set(hot3.map((s) => s.ticker));
  const remaining = enriched
    .filter((s) => !hotTickers.has(s.ticker))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return [...hot3, ...remaining];
}

export default function SectorRail({ showToast, themes, onLinkedThemeTap }) {
  const { tokens } = useTheme();
  const [sectors, setSectors] = useState([]);
  const [sectorsLoading, setSectorsLoading] = useState(true);
  const [sectorsError, setSectorsError] = useState(null);
  const [sectorSnapshot, setSectorSnapshot] = useState(null);
  const [selectedSectorTicker, setSelectedSectorTicker] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSectors() {
      try {
        const sectorsQ = query(
          collection(db, 'discoverSectors'),
          where('status', '==', 'active'),
          orderBy('displayOrder', 'asc')
        );
        const snap = await getDocs(sectorsQ);
        if (cancelled) return;
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Defensive: skip any sector that has a Firestore doc but no
        // SECTOR_CONTENT entry (drift between registry and constants).
        const filtered = docs.filter((s) => {
          if (SECTOR_CONTENT[s.ticker]) return true;
          console.warn(
            `[SectorRail] No SECTOR_CONTENT entry for ticker "${s.ticker}" — skipping card.`
          );
          return false;
        });
        setSectors(filtered);
        setSectorsLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[SectorRail] Failed to load sectors:', err);
        setSectorsError(err);
        setSectorsLoading(false);
      }
    }
    loadSectors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSnapshot() {
      try {
        const snap = await getDoc(doc(db, 'indexIntelligence', 'marketContext'));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setSectorSnapshot(
            Array.isArray(data?.sectorSnapshot) ? data.sectorSnapshot : null
          );
        } else {
          console.warn('[SectorRail] indexIntelligence/marketContext doc missing.');
          setSectorSnapshot(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[SectorRail] Failed to load sectorSnapshot:', err);
        setSectorSnapshot(null);
      }
    }
    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const renderItems = useMemo(
    () => computeRenderOrder(sectors, sectorSnapshot),
    [sectors, sectorSnapshot]
  );

  const selectedItem = useMemo(
    () =>
      selectedSectorTicker
        ? renderItems.find((i) => i.ticker === selectedSectorTicker) || null
        : null,
    [renderItems, selectedSectorTicker]
  );

  const handleCardTap = (ticker) => {
    if (!ticker) return;
    logSectorInteraction({ themeId: ticker, action: 'tap_sector_card' });
    setSelectedSectorTicker(ticker);
  };

  const handleCloseSectorModal = () => {
    setSelectedSectorTicker(null);
  };

  // Cross-modal handoff: SectorDetailModal → ThemeDetailModal. Close
  // the sector modal first, then ask DiscoverPanel to open the theme
  // modal. Both happen in the same render cycle so there's no
  // dual-modal flash. Analytics + sourceSectorTicker are written by
  // SectorDetailModal before this callback fires.
  const handleLinkedThemeTap = (themeId) => {
    setSelectedSectorTicker(null);
    onLinkedThemeTap?.(themeId);
  };

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: tokens.textPrimary,
            lineHeight: 1.2,
          }}
        >
          Sectors
        </h3>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: tokens.textMuted,
            lineHeight: 1.5,
          }}
        >
          Macro lens — what each corner of the market reflects.
        </p>
      </div>

      {sectorsLoading && (
        <div
          style={{
            color: tokens.textMuted,
            fontSize: 13,
            padding: '20px 0',
          }}
        >
          Loading sectors…
        </div>
      )}

      {!sectorsLoading && sectorsError && (
        <div
          style={{
            color: tokens.red,
            fontSize: 13,
            padding: '20px 0',
          }}
        >
          Couldn&apos;t load sectors. Refresh to try again.
        </div>
      )}

      {!sectorsLoading && !sectorsError && renderItems.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
            paddingBottom: 8,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {renderItems.map((item) => {
            const holdings =
              SECTOR_HOLDINGS_MAP[item.ticker]?.topHoldings?.slice(0, 5) || [];
            return (
              <SectorCard
                key={item.ticker}
                ticker={item.ticker}
                name={item.name}
                oneDayPct={item.oneDayPct}
                fiveDayPct={item.fiveDayPct}
                medalRank={item.medalRank}
                topHoldings={holdings}
                sparklineData={null}
                onTap={handleCardTap}
              />
            );
          })}
        </div>
      )}

      <SectorDetailModal
        ticker={selectedItem?.ticker || null}
        isOpen={Boolean(selectedItem)}
        oneDayPct={selectedItem?.oneDayPct ?? null}
        fiveDayPct={selectedItem?.fiveDayPct ?? null}
        medalRank={selectedItem?.medalRank ?? null}
        themes={themes}
        onClose={handleCloseSectorModal}
        onLinkedThemeTap={handleLinkedThemeTap}
        showToast={showToast}
      />
    </div>
  );
}
