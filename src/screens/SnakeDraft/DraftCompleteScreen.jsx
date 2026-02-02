import React, { useMemo } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';
import { UserIcon, BotIcon } from '../../components/draft/HoloIcons';
import {
  STEADY_STOCKS,
  RISKY_STOCKS,
  DEFENSIVE_STOCKS,
  STEADY_CRYPTO,
  RISKY_CRYPTO,
  DEFENSIVE_CRYPTO
} from '../../services/draftAssets';

// ============================================
// SECTOR MAPPINGS
// ============================================

const SECTOR_ABBREVIATIONS = {
  'Technology': 'TECH',
  'Financials': 'FIN',
  'Financial Services': 'FIN',
  'Healthcare': 'H-CARE',
  'Health Care': 'H-CARE',
  'Automotive': 'AUTO',
  'Consumer Staples': 'CONS',
  'Consumer Discretionary': 'CONS',
  'Consumer Defensive': 'CONS',
  'Retail': 'CONS',
  'Utilities': 'UTIL',
  'REIT': 'REIT',
  'Real Estate': 'REIT',
  'Communication Services': 'COMM',
  'Communication': 'COMM',
  'Energy': 'ENER',
  'Entertainment': 'ENT',
  'Semiconductors': 'SEMI',
  'Biotech': 'BIO',
  'Biotechnology': 'BIO',
  'Industrials': 'IND',
  'Conglomerate': 'CONG',
  'Fintech': 'FTECH',
  'Defense': 'DEF',
  'Materials': 'MAT',
  // Crypto sectors
  'Cryptocurrency': 'CRYPTO',
  'DeFi': 'DEFI',
  'Meme': 'MEME',
  'Layer 1': 'L1',
  'Layer 2': 'L2',
  'Other': 'OTHER'
};

const GRID_SECTOR_COLORS = {
  'TECH': '#22d3ee',     // cyan
  'FIN': '#a855f7',      // purple
  'SEMI': '#f472b6',     // pink
  'CONS': '#fbbf24',     // amber/yellow
  'ENER': '#f97316',     // orange
  'H-CARE': '#4ade80',   // green
  'COMM': '#ef4444',     // red
  'AUTO': '#06b6d4',     // teal
  'AI': '#8b5cf6',       // violet
  'UTIL': '#94a3b8',     // slate
  'REIT': '#f59e0b',     // amber
  'BIO': '#ec4899',      // pink
  'IND': '#78716c',      // stone
  'ENT': '#f43f5e',      // rose
  'FTECH': '#a855f7',    // purple
  'DEF': '#64748b',      // slate
  'CONG': '#6366f1',     // indigo
  'MAT': '#84cc16',      // lime
  // Crypto
  'CRYPTO': '#f7931a',   // bitcoin orange
  'DEFI': '#8b5cf6',     // violet
  'MEME': '#fbbf24',     // yellow
  'L1': '#3b82f6',       // blue
  'L2': '#6366f1',       // indigo
  // Default
  'OTHER': '#64748b'     // gray
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Build asset lookup from all draft assets
const buildAssetLookup = () => {
  const lookup = {};
  const allStocks = [...STEADY_STOCKS, ...RISKY_STOCKS, ...DEFENSIVE_STOCKS];
  const allCrypto = [...STEADY_CRYPTO, ...RISKY_CRYPTO, ...DEFENSIVE_CRYPTO];

  allStocks.forEach(asset => {
    lookup[asset.symbol] = asset;
  });
  allCrypto.forEach(asset => {
    lookup[asset.symbol] = asset;
  });

  return lookup;
};

const ASSET_LOOKUP = buildAssetLookup();

/**
 * Get sector for a symbol from various data sources
 */
const getSectorForSymbol = (symbol, draft) => {
  // 1. Check pickHistory for sector
  if (draft?.pickHistory) {
    const pick = draft.pickHistory.find(p => p.symbol === symbol);
    if (pick?.sector) return pick.sector;
  }

  // 2. Check availableAssets (may have been removed but still has data)
  if (draft?.availableAssets) {
    const allAvailable = [
      ...(draft.availableAssets.steady || []),
      ...(draft.availableAssets.risky || []),
      ...(draft.availableAssets.defensive || [])
    ];
    const asset = allAvailable.find(a => a.symbol === symbol);
    if (asset?.sector) return asset.sector;
  }

  // 3. Fallback to draftAssets lookup
  const asset = ASSET_LOOKUP[symbol];
  if (asset?.sector) return asset.sector;

  return 'Other';
};

/**
 * Get sector abbreviation from full sector name
 */
const getSectorAbbreviation = (sector) => {
  return SECTOR_ABBREVIATIONS[sector] || 'OTHER';
};

/**
 * Get sector color from abbreviation
 */
const getSectorColor = (sectorAbbrev) => {
  return GRID_SECTOR_COLORS[sectorAbbrev] || GRID_SECTOR_COLORS.OTHER;
};

/**
 * Reorder players so current user is first column
 */
const getPlayerColumnOrder = (players, currentUserId) => {
  if (!players || players.length === 0) return [];

  const currentUser = players.find(p => p.odUserId === currentUserId);
  const others = players.filter(p => p.odUserId !== currentUserId);

  return currentUser ? [currentUser, ...others] : [...players];
};

/**
 * Calculate pick number based on snake pattern
 * @param roundIndex 0-indexed round (0-8)
 * @param originalPlayerIndex original position in draft order
 * @param numPlayers total players (default 4)
 */
const calculatePickNumber = (roundIndex, originalPlayerIndex, numPlayers = 4) => {
  const basePick = roundIndex * numPlayers;

  // Snake: odd rounds (index 1, 3, 5, 7) go backward
  if (roundIndex % 2 === 0) {
    return basePick + originalPlayerIndex + 1;
  } else {
    return basePick + (numPlayers - 1 - originalPlayerIndex) + 1;
  }
};

/**
 * Build grid matrix from draft data
 * Returns: { grid: 9x4 array, playerOrder: reordered players array }
 */
const buildGridMatrix = (draft, currentUserId) => {
  if (!draft?.players) {
    return { grid: [], playerOrder: [] };
  }

  const numRounds = 9;
  const numPlayers = draft.players.length;

  // Initialize empty grid
  const grid = Array(numRounds).fill(null).map(() => Array(numPlayers).fill(null));

  // Reorder players with current user first
  const playerOrder = getPlayerColumnOrder(draft.players, currentUserId);

  // Create mapping from odUserId to display column index
  const userIdToColumn = {};
  playerOrder.forEach((player, colIndex) => {
    userIdToColumn[player.odUserId] = colIndex;
  });

  // Also need to map original player index to their odUserId
  const originalIndexToUserId = {};
  draft.players.forEach((player, idx) => {
    originalIndexToUserId[idx] = player.odUserId;
  });

  // Try to use pickHistory first (has pick numbers)
  if (draft.pickHistory && draft.pickHistory.length > 0) {
    draft.pickHistory.forEach(pick => {
      const roundIndex = pick.round - 1;
      const colIndex = userIdToColumn[pick.playerId];

      if (roundIndex >= 0 && roundIndex < numRounds && colIndex !== undefined) {
        const sector = getSectorForSymbol(pick.symbol, draft);
        const sectorAbbrev = getSectorAbbreviation(sector);

        grid[roundIndex][colIndex] = {
          symbol: pick.symbol,
          sector,
          sectorAbbrev,
          pickNumber: pick.pick || pick.pickNumber
        };
      }
    });
  } else {
    // Fallback: build from player.picks arrays
    playerOrder.forEach((player, colIndex) => {
      const picks = player.picks || [];

      // Find this player's original index in draft.players
      const originalIndex = draft.players.findIndex(p => p.odUserId === player.odUserId);

      picks.forEach((symbol, roundIndex) => {
        if (roundIndex < numRounds) {
          const sector = getSectorForSymbol(symbol, draft);
          const sectorAbbrev = getSectorAbbreviation(sector);
          const pickNumber = calculatePickNumber(roundIndex, originalIndex, numPlayers);

          grid[roundIndex][colIndex] = {
            symbol,
            sector,
            sectorAbbrev,
            pickNumber
          };
        }
      });
    });
  }

  return { grid, playerOrder };
};

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Player header with avatar and name
 */
const PlayerHeader = ({ player, isCurrentUser }) => {
  const displayName = isCurrentUser
    ? 'YOU'
    : (player.displayName || player.odUsername || 'Player').slice(0, 10);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(4px, 1.5vw, 8px) clamp(2px, 1vw, 4px)',
      background: isCurrentUser
        ? 'rgba(0, 255, 255, 0.08)'
        : 'transparent',
      borderBottom: `2px solid ${isCurrentUser ? HOLO_COLORS.cyan : HOLO_COLORS.borderSubtle}`,
      minHeight: 'clamp(40px, 12vw, 52px)',
      minWidth: '0' // Allow shrinking below content size
    }}>
      {isCurrentUser ? (
        <UserIcon size={18} color={HOLO_COLORS.cyan} />
      ) : (
        <BotIcon size={14} color={HOLO_COLORS.textMuted} />
      )}
      <span style={{
        color: isCurrentUser ? HOLO_COLORS.cyan : HOLO_COLORS.textPrimary,
        fontWeight: isCurrentUser ? '700' : '500',
        fontSize: 'clamp(9px, 2.5vw, 12px)',
        marginTop: 'clamp(2px, 0.5vw, 4px)',
        textAlign: 'center',
        letterSpacing: isCurrentUser ? '0.5px' : '0',
        textShadow: isCurrentUser ? `0 0 8px ${HOLO_COLORS.cyan}` : 'none',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%'
      }}>
        {displayName}
      </span>
    </div>
  );
};

/**
 * Individual grid cell with ticker, pick number, and sector
 */
const GridCell = ({ pick, isUserColumn }) => {
  if (!pick) {
    return (
      <div style={{
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        border: `1px dashed ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 'clamp(4px, 1.5vw, 8px)',
        minWidth: '0' // Critical: allows grid items to shrink below content size
      }}>
        <span style={{ color: HOLO_COLORS.textMuted, fontSize: 'clamp(8px, 2vw, 10px)' }}>-</span>
      </div>
    );
  }

  const sectorColor = getSectorColor(pick.sectorAbbrev);

  return (
    <div style={{
      aspectRatio: '1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(2px, 1vw, 8px)',
      background: isUserColumn
        ? `rgba(0, 255, 255, 0.06)`
        : 'rgba(255, 255, 255, 0.03)',
      border: `${isUserColumn ? '2px' : '1px'} solid ${sectorColor}`,
      borderRadius: 'clamp(4px, 1.5vw, 8px)',
      position: 'relative',
      minWidth: '0', // Critical: allows grid items to shrink below content size
      boxShadow: isUserColumn
        ? `0 0 12px ${sectorColor}40, inset 0 0 20px ${sectorColor}15`
        : `inset 0 0 10px ${sectorColor}10`
    }}>
      {/* Ticker with superscript pick number */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center'
      }}>
        <span style={{
          color: HOLO_COLORS.textPrimary,
          fontWeight: '700',
          fontSize: 'clamp(11px, 3.2vw, 16px)',
          letterSpacing: '0.3px'
        }}>
          {pick.symbol}
        </span>
        <sup style={{
          color: HOLO_COLORS.textMuted,
          fontSize: 'clamp(7px, 1.8vw, 10px)',
          marginLeft: '1px',
          marginTop: '-1px',
          fontWeight: '500'
        }}>
          {pick.pickNumber}
        </sup>
      </div>

      {/* Sector abbreviation */}
      <span style={{
        color: sectorColor,
        fontSize: 'clamp(7px, 2vw, 11px)',
        fontWeight: '600',
        marginTop: 'clamp(1px, 0.5vw, 3px)',
        textTransform: 'uppercase',
        letterSpacing: '0.2px'
      }}>
        {pick.sectorAbbrev}
      </span>
    </div>
  );
};

/**
 * Round label (R1-R9)
 */
const RoundLabel = ({ roundNumber }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(4px, 1.5vw, 8px) clamp(2px, 0.5vw, 4px)',
    background: 'transparent',
    minWidth: 'clamp(24px, 7vw, 36px)'
  }}>
    <span style={{
      color: HOLO_COLORS.textSecondary,
      fontSize: 'clamp(9px, 2.5vw, 12px)',
      fontWeight: '600',
      letterSpacing: '0.3px'
    }}>
      R{roundNumber}
    </span>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const DraftCompleteScreen = ({
  containerStyle,
  currentDraft,
  user,
  onBack,
  onNavigate
}) => {
  // Safety check - if no draft data, show fallback
  if (!currentDraft) {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          background: HOLO_COLORS.bgDeep,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x23F3;</div>
          <p style={{ color: HOLO_COLORS.textPrimary, fontSize: '18px', marginBottom: '16px' }}>
            Loading draft results...
          </p>
          <button
            onClick={onBack}
            style={{
              padding: '12px 24px',
              background: HOLO_COLORS.cyan,
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentUserId = user?.odUserId || user?.username;

  // Build grid matrix using useMemo for performance
  const { grid, playerOrder } = useMemo(() => {
    return buildGridMatrix(currentDraft, currentUserId);
  }, [currentDraft, currentUserId]);

  // Calculate total picks
  const totalPicks = grid.flat().filter(Boolean).length;

  // Confetti pieces for celebration effect
  const confettiColors = ['#10b981', '#8b5cf6', '#00d9ff', '#f59e0b', '#ffffff'];
  const confettiPieces = Array.from({ length: 25 }, (_, i) => ({
    id: i,
    left: (i * 4) % 100,
    color: confettiColors[i % confettiColors.length],
    delay: (i * 0.1) % 2,
    duration: 2.5 + (i % 3),
    size: 6 + (i % 6)
  }));

  return (
    <div style={containerStyle}>
      <div style={{
        minHeight: '100vh',
        background: HOLO_COLORS.bgDeep,
        paddingBottom: '24px'
      }}>
        {/* Header Section with Confetti */}
        <div style={{
          position: 'relative',
          width: '100%',
          padding: '32px 16px 24px',
          overflow: 'hidden',
          background: `linear-gradient(180deg, ${HOLO_COLORS.bgElevated} 0%, ${HOLO_COLORS.bgDeep} 100%)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          {/* Confetti pieces */}
          {confettiPieces.map(piece => (
            <div
              key={piece.id}
              style={{
                position: 'absolute',
                left: `${piece.left}%`,
                top: '-10px',
                width: `${piece.size}px`,
                height: `${piece.size}px`,
                backgroundColor: piece.color,
                borderRadius: piece.id % 2 === 0 ? '50%' : '2px',
                pointerEvents: 'none',
                animation: `confetti-fall ${piece.duration}s ease-out ${piece.delay}s infinite`
              }}
            />
          ))}

          {/* Sparkles */}
          <span style={{ position: 'absolute', left: '15%', top: '20px', fontSize: '16px', animation: 'sparkle 1.5s ease-in-out infinite', pointerEvents: 'none' }}>&#x2728;</span>
          <span style={{ position: 'absolute', right: '15%', top: '30px', fontSize: '14px', animation: 'sparkle 1.5s ease-in-out infinite 0.5s', pointerEvents: 'none' }}>&#x2B50;</span>

          {/* Title */}
          <h1 style={{
            fontSize: '28px',
            fontWeight: '800',
            color: HOLO_COLORS.textPrimary,
            margin: '0 0 8px 0',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            textShadow: `0 0 20px ${HOLO_COLORS.cyan}40`,
            animation: 'fade-in-up 0.6s ease-out'
          }}>
            Draft Complete!
          </h1>

          {/* Subtitle */}
          <p style={{
            color: HOLO_COLORS.textSecondary,
            fontSize: '14px',
            margin: '0',
            animation: 'fade-in-up 0.6s ease-out 0.2s both'
          }}>
            {totalPicks} Picks made. Portfolio value: $100,000 Initial.
          </p>
        </div>

        {/* Grid Section */}
        <div style={{
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
          padding: '0 8px',
          boxSizing: 'border-box'
        }}>
          {/* Grid Container */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `auto repeat(${playerOrder.length}, 1fr)`,
            gap: 'clamp(2px, 1vw, 6px)',
            background: HOLO_COLORS.bgCard,
            borderRadius: 'clamp(10px, 3vw, 16px)',
            padding: 'clamp(6px, 2vw, 12px)',
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {/* Empty corner cell */}
            <div style={{ minWidth: 'clamp(24px, 7vw, 36px)' }} />

            {/* Player header row */}
            {playerOrder.map((player, colIndex) => (
              <PlayerHeader
                key={player.odUserId}
                player={player}
                isCurrentUser={colIndex === 0}
              />
            ))}

            {/* Grid rows */}
            {grid.map((row, roundIndex) => (
              <React.Fragment key={`round-${roundIndex}`}>
                <RoundLabel roundNumber={roundIndex + 1} />
                {row.map((cell, colIndex) => (
                  <GridCell
                    key={`cell-${roundIndex}-${colIndex}`}
                    pick={cell}
                    isUserColumn={colIndex === 0}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* View Battle Standings Button */}
          <button
            onClick={() => onNavigate('draftBattle')}
            style={{
              width: '100%',
              marginTop: '24px',
              padding: '18px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '16px',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.3)';
            }}
          >
            <span style={{ fontSize: '18px' }}>&#x1F4CA;</span>
            VIEW BATTLE STANDINGS
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftCompleteScreen;
