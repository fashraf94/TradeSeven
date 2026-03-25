import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { SECTORS } from '../../constants/sectors';
import RanksLeaderboard from './RanksLeaderboard';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";

const SectorETFRanksTab = ({ symbol, onNavigateToStock }) => {
  const [rankingsData, setRankingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboardTab, setLeaderboardTab] = useState('fundamental');

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

  // Pre-filter to check data availability for this sector
  const sectorStocks = useMemo(() => {
    if (!rankingsData?.stocks) return [];
    return rankingsData.stocks.filter(s => s.sectorId === symbol);
  }, [rankingsData, symbol]);

  const hasFundamental = sectorStocks.some(s => s.fundamentalScore != null);
  const hasTechnical = sectorStocks.some(s => s.technicalScore != null);

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

  if (sectorStocks.length === 0) {
    return (
      <div style={{ padding: '8px 0' }}>
        {sectorInfo && (
          <div style={{
            fontSize: '10px', fontWeight: '700', letterSpacing: '1px',
            color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
            marginBottom: '12px', fontFamily: MONO,
          }}>
            {sectorInfo.emoji} {sectorInfo.name} Sector Rankings
          </div>
        )}
        <div style={{
          padding: '16px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.03)',
          fontSize: '12px', color: '#8b949e', textAlign: 'center',
        }}>
          No ranking data available for {sectorInfo?.name || 'this sector'} stocks
        </div>
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

      {/* Pill toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: '4px',
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setLeaderboardTab('fundamental')}
            style={{
              padding: '4px 12px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: leaderboardTab === 'fundamental' ? 'rgba(94, 234, 212, 0.15)' : 'transparent',
              color: leaderboardTab === 'fundamental' ? '#5eead4' : '#6e7681',
              transition: 'all 0.15s',
            }}
          >
            Fundamental
          </button>
          <button
            onClick={() => setLeaderboardTab('technical')}
            style={{
              padding: '4px 12px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: leaderboardTab === 'technical' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
              color: leaderboardTab === 'technical' ? '#a78bfa' : '#6e7681',
              transition: 'all 0.15s',
            }}
          >
            Technical
          </button>
        </div>
      </div>

      {/* Conditional leaderboard render */}
      {leaderboardTab === 'fundamental' ? (
        hasFundamental ? (
          <RanksLeaderboard
            type="fundamental"
            stocks={rankingsData.stocks}
            currentSymbol={null}
            onNavigateToStock={onNavigateToStock}
            title={`${sectorInfo?.name || 'Sector'} Fundamental Leaders`}
            sectorFilter={symbol}
          />
        ) : (
          <div style={{
            padding: '16px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)',
            fontSize: '12px', color: '#8b949e', textAlign: 'center', marginTop: '12px',
          }}>
            No fundamental rankings available for {sectorInfo?.name || 'this sector'}
          </div>
        )
      ) : (
        hasTechnical ? (
          <RanksLeaderboard
            type="technical"
            stocks={rankingsData.stocks}
            currentSymbol={null}
            onNavigateToStock={onNavigateToStock}
            title={`${sectorInfo?.name || 'Sector'} Technical Leaders`}
            sectorFilter={symbol}
          />
        ) : (
          <div style={{
            padding: '16px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)',
            fontSize: '12px', color: '#8b949e', textAlign: 'center', marginTop: '12px',
          }}>
            No technical rankings available for {sectorInfo?.name || 'this sector'}
          </div>
        )
      )}
    </div>
  );
};

export default SectorETFRanksTab;
