import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { SECTORS } from '../../constants/sectors';
import RanksLeaderboard from './RanksLeaderboard';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";

const SectorETFRanksTab = ({ symbol, onNavigateToStock }) => {
  const [rankingsData, setRankingsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'indexIntelligence', 'stockRankings'));
        if (!cancelled && snap.exists()) {
          setRankingsData(snap.data());
        }
      } catch (err) {
        console.error('[SectorETFRanksTab] Failed to load stockRankings:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sectorInfo = SECTORS[symbol];

  if (loading) {
    return (
      <div style={{ padding: '16px 0' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            height: '32px', marginBottom: '8px', borderRadius: '6px',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
          }} />
        ))}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  if (!rankingsData?.stocks) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
        Rankings data unavailable
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Sector header */}
      {sectorInfo && (
        <div style={{
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '1px',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          marginBottom: '12px',
          fontFamily: MONO,
        }}>
          {sectorInfo.emoji} {sectorInfo.name} Sector Rankings
        </div>
      )}

      {/* Fundamental Leaderboard */}
      <RanksLeaderboard
        type="fundamental"
        stocks={rankingsData.stocks}
        currentSymbol={null}
        onNavigateToStock={onNavigateToStock}
        title={`${sectorInfo?.name || 'Sector'} Fundamental Leaders`}
        sectorFilter={symbol}
      />

      <div style={{ height: '16px' }} />

      {/* Technical Leaderboard */}
      <RanksLeaderboard
        type="technical"
        stocks={rankingsData.stocks}
        currentSymbol={null}
        onNavigateToStock={onNavigateToStock}
        title={`${sectorInfo?.name || 'Sector'} Technical Leaders`}
        sectorFilter={symbol}
      />
    </div>
  );
};

export default SectorETFRanksTab;
