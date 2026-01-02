import React from 'react';
import { TrendingUp, TrendingDown, Activity, Users, ChevronRight } from 'lucide-react';

const SectorCard = ({
  sector,
  isSelected = false,
  onSelect,
  onViewDetails,
  compact = false
}) => {
  const {
    id,
    name,
    emoji,
    color,
    performance = {},
    trend = {},
    breadth = {},
    leadership = [],
    baggerBombStats = {},
    insight = ''
  } = sector;

  const formatPercent = (value) => {
    if (value === undefined || value === null) return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const healthyLeaders = leadership.filter(l => l.healthStatus === '✅').length;

  // Compact version for selection grid
  if (compact) {
    return (
      <div
        onClick={() => onSelect?.(id)}
        style={{
          backgroundColor: isSelected ? `${color}20` : '#161b22',
          border: isSelected ? `2px solid ${color}` : '1px solid #21262d',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>{emoji}</span>
            <div>
              <div style={{ fontWeight: '600', color: '#ffffff' }}>{name}</div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>{id}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontWeight: '600',
              color: performance.month1 >= 0 ? '#10b981' : '#ef4444',
              fontSize: '16px'
            }}>
              {formatPercent(performance.month1)}
            </div>
            <div style={{ fontSize: '11px', color: '#8b949e' }}>1M</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: trend.color }}>{trend.emoji}</span>
            <span style={{ color: '#8b949e' }}>{trend.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>💣</span>
            <span style={{ color: '#8b949e' }}>{baggerBombStats.breakouts7d || 0}</span>
          </div>
        </div>

        {isSelected && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #21262d',
            textAlign: 'center'
          }}>
            <span style={{ color: color, fontWeight: '600', fontSize: '12px' }}>✓ SELECTED</span>
          </div>
        )}
      </div>
    );
  }

  // Full version with all details
  return (
    <div
      style={{
        backgroundColor: '#161b22',
        border: isSelected ? `2px solid ${color}` : '1px solid #21262d',
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            {emoji}
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '18px', color: '#ffffff' }}>{name}</div>
            <div style={{ fontSize: '13px', color: '#8b949e' }}>{id}</div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontWeight: '700',
            fontSize: '24px',
            color: performance.month1 >= 0 ? '#10b981' : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {performance.month1 >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {formatPercent(performance.month1)}
          </div>
          <div style={{ fontSize: '12px', color: '#8b949e' }}>1 Month</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

          {/* Performance Column */}
          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '12px', fontWeight: '600' }}>
              PERFORMANCE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>1W</span>
                <span style={{ color: performance.week1 >= 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                  {formatPercent(performance.week1)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>1M</span>
                <span style={{ color: performance.month1 >= 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                  {formatPercent(performance.month1)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>3M</span>
                <span style={{ color: performance.month3 >= 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                  {formatPercent(performance.month3)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #21262d' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>Trend</span>
                <span style={{ color: trend.color, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {trend.emoji} {trend.label}
                </span>
              </div>
            </div>
          </div>

          {/* BaggerBomb Stats Column */}
          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '12px', fontWeight: '600' }}>
              BAGGERBOMB STATS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>💣 Breakouts (7d)</span>
                <span style={{ color: '#10b981', fontWeight: '500' }}>{baggerBombStats.breakouts7d || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>📉 Busts (7d)</span>
                <span style={{ color: '#ef4444', fontWeight: '500' }}>{baggerBombStats.busts7d || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>Hit Rate</span>
                <span style={{ color: '#ffffff', fontWeight: '500' }}>{baggerBombStats.hitRate || 0}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #21262d' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>Avg Threshold</span>
                <span style={{ color: color, fontWeight: '600' }}>{baggerBombStats.avgThreshold || 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sector Health Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          padding: '16px',
          backgroundColor: '#0d1117',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px', fontWeight: '600' }}>
              SECTOR HEALTH
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity size={18} color={breadth.color} />
              <div>
                <div style={{ color: '#ffffff', fontWeight: '600' }}>
                  Breadth: {breadth.percent}%
                </div>
                <div style={{ fontSize: '11px', color: '#8b949e' }}>
                  Stocks above 50-day MA
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px', fontWeight: '600' }}>
              LEADERSHIP
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Users size={18} color={healthyLeaders >= 5 ? '#10b981' : healthyLeaders >= 3 ? '#f59e0b' : '#ef4444'} />
              <div>
                <div style={{ color: '#ffffff', fontWeight: '600' }}>
                  {healthyLeaders}/{leadership.length} Healthy
                </div>
                <div style={{ fontSize: '11px', color: '#8b949e' }}>
                  Leaders outperforming
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leadership List */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '12px', fontWeight: '600' }}>
            TOP LEADERS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {leadership.slice(0, 7).map((leader) => (
              <div
                key={leader.symbol}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: '#0d1117',
                  borderRadius: '20px',
                  fontSize: '13px'
                }}
              >
                <span style={{ fontWeight: '600', color: '#ffffff' }}>{leader.symbol}</span>
                <span>{leader.healthStatus}</span>
                <span style={{
                  color: leader.relativePerformance >= 0 ? '#10b981' : '#ef4444',
                  fontSize: '11px'
                }}>
                  {leader.relativePerformance >= 0 ? '+' : ''}{leader.relativePerformance?.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Insight */}
        {insight && (
          <div style={{
            padding: '14px',
            backgroundColor: `${color}10`,
            borderRadius: '10px',
            borderLeft: `3px solid ${color}`,
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>💡</span>
              <p style={{ margin: 0, color: '#c9d1d9', fontSize: '13px', lineHeight: '1.5' }}>
                {insight}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onViewDetails?.(id)}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#21262d',
              border: 'none',
              borderRadius: '8px',
              color: '#c9d1d9',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            View All Stocks <ChevronRight size={16} />
          </button>

          <button
            onClick={() => onSelect?.(id)}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: isSelected ? color : `${color}20`,
              border: isSelected ? 'none' : `1px solid ${color}`,
              borderRadius: '8px',
              color: isSelected ? '#000000' : color,
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {isSelected ? '✓ Selected' : 'Select Sector'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectorCard;
