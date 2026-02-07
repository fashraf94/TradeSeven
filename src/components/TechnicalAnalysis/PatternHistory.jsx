// src/components/TechnicalAnalysis/PatternHistory.jsx
// Shows tracked patterns for the current stock with progress bars and status badges

import React, { useEffect, useRef } from 'react';
import { Clock, CheckCircle, XCircle, CircleDot } from 'lucide-react';
import { EmptyState } from './shared';

export const TRACKING_DAYS = 14;

// Client-side resolution for expired patterns
const resolvePattern = (pattern, currentPrice) => {
  const zoneCenter = (pattern.priceLow + pattern.priceHigh) / 2;
  const breakThreshold = zoneCenter * 0.03; // 3%
  const isSupport = pattern.zoneType === 'SUPPORT';
  let outcome;
  if (isSupport) {
    outcome = currentPrice < pattern.priceLow - breakThreshold ? 'FAILED' : 'CONFIRMED';
  } else {
    outcome = currentPrice > pattern.priceHigh + breakThreshold ? 'FAILED' : 'CONFIRMED';
  }
  return {
    status: 'EXPIRED',
    outcome,
    result: {
      priceAtResolution: currentPrice,
      priceChange: (((currentPrice - pattern.priceAtCreation) / pattern.priceAtCreation) * 100).toFixed(2),
      resolvedAt: new Date().toISOString(),
    },
  };
};

const getElapsedDays = (createdAt) => {
  if (!createdAt) return 0;
  const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const now = new Date();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
};

const isExpired = (pattern) => {
  const days = getElapsedDays(pattern.createdAt);
  return days >= (pattern.trackingDuration || TRACKING_DAYS);
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Status icon component
const StatusIcon = ({ status, outcome }) => {
  if (status === 'EXPIRED' || status === 'RESOLVED') {
    if (outcome === 'CONFIRMED') {
      return <CheckCircle size={12} color="#00ff88" />;
    } else if (outcome === 'FAILED') {
      return <XCircle size={12} color="#ff4757" />;
    }
    return <CircleDot size={12} color="rgba(255,255,255,0.5)" />;
  }
  if (status === 'CANCELLED') {
    return <CircleDot size={12} color="rgba(255,255,255,0.4)" />;
  }
  // ACTIVE / RESOLVING
  return <Clock size={12} color="#ffaa00" />;
};

const PatternHistory = ({ patterns, currentPrice, onResolve }) => {
  const resolvedRef = useRef(new Set());

  // Auto-resolve expired patterns
  useEffect(() => {
    if (!patterns?.length || !currentPrice || !onResolve) return;

    patterns.forEach(pattern => {
      if (
        isExpired(pattern) &&
        !['EXPIRED', 'RESOLVED', 'CANCELLED'].includes(pattern.status) &&
        !resolvedRef.current.has(pattern.id)
      ) {
        resolvedRef.current.add(pattern.id);
        const updates = resolvePattern(pattern, currentPrice);
        onResolve(pattern.id, updates);
      }
    });
  }, [patterns, currentPrice, onResolve]);

  if (!patterns?.length) {
    return (
      <EmptyState
        icon={'\uD83D\uDCCA'}
        title="No Tracked Patterns"
        message="Track confluence zones to monitor their outcomes over time. Tap 'Track Pattern' on any zone."
      />
    );
  }

  // Sort by most recent first
  const sorted = [...patterns].sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return dateB - dateA;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {sorted.map(pattern => {
        const elapsed = getElapsedDays(pattern.createdAt);
        const duration = pattern.trackingDuration || TRACKING_DAYS;
        const progress = Math.min(elapsed / duration, 1);
        const daysLeft = Math.max(duration - elapsed, 0);
        const expired = isExpired(pattern);

        const priceChange = currentPrice && pattern.priceAtCreation
          ? (((currentPrice - pattern.priceAtCreation) / pattern.priceAtCreation) * 100)
          : null;

        // Determine display status
        let statusLabel, statusColor;
        const outcome = pattern.outcome || pattern.result?.outcome;
        if (pattern.status === 'EXPIRED' || pattern.status === 'RESOLVED') {
          if (outcome === 'CONFIRMED') {
            statusLabel = 'CONFIRMED';
            statusColor = '#00ff88';
          } else if (outcome === 'FAILED') {
            statusLabel = 'FAILED';
            statusColor = '#ff4757';
          } else {
            statusLabel = 'EXPIRED';
            statusColor = 'rgba(255,255,255,0.5)';
          }
        } else if (pattern.status === 'CANCELLED') {
          statusLabel = 'CANCELLED';
          statusColor = 'rgba(255,255,255,0.4)';
        } else {
          statusLabel = expired ? 'RESOLVING...' : 'ACTIVE';
          statusColor = '#ffaa00';
        }

        return (
          <div key={pattern.id} style={styles.card}>
            {/* Status + Pattern Name */}
            <div style={styles.cardHeader}>
              <div style={styles.headerLeft}>
                <StatusIcon status={pattern.status} outcome={outcome} />
                <span style={{ ...styles.statusBadge, color: statusColor, borderColor: statusColor + '40' }}>
                  {statusLabel}
                </span>
              </div>
              <span style={styles.date}>{formatDate(pattern.createdAt)}</span>
            </div>

            {/* Pattern Info */}
            <div style={styles.patternInfo}>
              <div style={styles.patternName}>{pattern.patternName}</div>
              <div style={styles.zoneType}>
                <span style={{ color: pattern.zoneType === 'SUPPORT' ? '#00ff88' : '#ff4757' }}>
                  {pattern.zoneType}
                </span>
                <span style={styles.priceRange}>
                  ${pattern.priceLow?.toFixed(2)} - ${pattern.priceHigh?.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Price Tracking */}
            {priceChange !== null && (
              <div style={styles.priceRow}>
                <span style={styles.priceLabel}>
                  ${pattern.priceAtCreation?.toFixed(2)} → ${currentPrice?.toFixed(2)}
                </span>
                <span style={{
                  ...styles.priceChange,
                  color: priceChange >= 0 ? '#00ff88' : '#ff4757',
                }}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              </div>
            )}

            {/* Progress Bar */}
            {!['EXPIRED', 'RESOLVED', 'CANCELLED'].includes(pattern.status) && (
              <div style={styles.progressContainer}>
                <div style={styles.progressTrack}>
                  <div style={{
                    ...styles.progressBar,
                    width: `${progress * 100}%`,
                    backgroundColor: expired ? '#ff4757' : '#00ffff',
                  }} />
                </div>
                <span style={styles.progressLabel}>
                  {expired ? 'Expired' : `${daysLeft}d left`}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statusBadge: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  date: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  patternInfo: {
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  patternName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '4px',
  },
  zoneType: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: 500,
  },
  priceRange: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  priceLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  priceChange: {
    fontSize: '13px',
    fontWeight: 600,
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
  },
  progressTrack: {
    flex: 1,
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  progressLabel: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.4)',
    whiteSpace: 'nowrap',
  },
};

export default PatternHistory;
