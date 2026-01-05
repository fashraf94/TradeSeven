import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Activity,
  Users,
  Target,
  BarChart3,
  Check
} from 'lucide-react';

const SectorCard = ({
  sector,
  isSelected = false,
  onSelect,
  onViewDetails,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

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
    insight = '',
    etfTechnicals = {}
  } = sector;

  const formatPercent = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const healthyLeaders = leadership.filter(l => l.healthStatus === '✅').length;

  const handleCardClick = (e) => {
    // Don't trigger select if clicking expand button
    if (e.target.closest('.expand-button')) return;
    onSelect?.(id);
  };

  const handleExpandClick = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        width: '340px',
        backgroundColor: isSelected ? `${color}15` : '#161b22',
        border: isSelected ? `2px solid ${color}` : '1px solid #21262d',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Main Card Content */}
      <div style={{ padding: '16px' }}>
        {/* Header Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: `${color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              {emoji}
            </div>
            <div>
              <div style={{ fontWeight: '600', color: '#ffffff', fontSize: '15px' }}>{name}</div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>{id}</div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontWeight: '600',
              fontSize: '16px',
              color: performance.month1 >= 0 ? '#10b981' : '#ef4444'
            }}>
              {formatPercent(performance.month1)}
            </div>
            <div style={{ fontSize: '11px', color: '#8b949e' }}>1M</div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: trend.color || '#8b949e'
            }} />
            <span style={{ fontSize: '12px', color: '#8b949e' }}>{trend.label || 'Neutral'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px' }}>💣</span>
              <span style={{ fontSize: '12px', color: '#8b949e' }}>
                {baggerBombStats.breakouts7d || 0}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={12} color="#8b949e" />
              <span style={{ fontSize: '12px', color: '#8b949e' }}>
                {breadth.percent || 50}%
              </span>
            </div>
          </div>
        </div>

        {/* Selected Badge */}
        {isSelected && (
          <div style={{
            padding: '6px 12px',
            backgroundColor: color,
            borderRadius: '6px',
            textAlign: 'center',
            marginBottom: '12px'
          }}>
            <span style={{ color: '#000', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Check size={14} /> SELECTED
            </span>
          </div>
        )}

        {/* Expand Button */}
        <button
          className="expand-button"
          onClick={handleExpandClick}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#21262d',
            border: 'none',
            borderRadius: '6px',
            color: '#8b949e',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          {isExpanded ? 'Hide Details' : 'View Details'}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div style={{
          padding: '16px',
          borderTop: '1px solid #21262d',
          backgroundColor: '#0d1117'
        }}>
          {/* Performance Grid */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: '600' }}>
              PERFORMANCE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#161b22', borderRadius: '6px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: performance.week1 >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatPercent(performance.week1)}
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>1W</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#161b22', borderRadius: '6px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: performance.month1 >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatPercent(performance.month1)}
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>1M</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#161b22', borderRadius: '6px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: performance.month3 >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatPercent(performance.month3)}
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>3M</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#161b22', borderRadius: '6px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: trend.color }}>
                  {trend.emoji} {trend.label}
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>Trend</div>
              </div>
            </div>
          </div>

          {/* ETF Technicals */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: '600' }}>
              {id} ETF TECHNICALS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div style={{
                padding: '10px',
                backgroundColor: '#161b22',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <BarChart3 size={16} color={etfTechnicals.above50SMA ? '#10b981' : '#ef4444'} />
                <div>
                  <div style={{ fontSize: '12px', color: '#fff' }}>
                    {etfTechnicals.above50SMA ? 'Above' : 'Below'} 50-day MA
                  </div>
                  <div style={{ fontSize: '10px', color: '#8b949e' }}>
                    {etfTechnicals.distanceFrom50SMA ? `${etfTechnicals.distanceFrom50SMA > 0 ? '+' : ''}${etfTechnicals.distanceFrom50SMA.toFixed(1)}%` : '--'}
                  </div>
                </div>
              </div>
              <div style={{
                padding: '10px',
                backgroundColor: '#161b22',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Target size={16} color={etfTechnicals.above200SMA ? '#10b981' : '#ef4444'} />
                <div>
                  <div style={{ fontSize: '12px', color: '#fff' }}>
                    {etfTechnicals.above200SMA ? 'Above' : 'Below'} 200-day MA
                  </div>
                  <div style={{ fontSize: '10px', color: '#8b949e' }}>
                    {etfTechnicals.distanceFrom200SMA ? `${etfTechnicals.distanceFrom200SMA > 0 ? '+' : ''}${etfTechnicals.distanceFrom200SMA.toFixed(1)}%` : '--'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sector Health */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: '600' }}>
              SECTOR HEALTH
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div style={{ padding: '10px', backgroundColor: '#161b22', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Activity size={14} color={breadth.color || '#8b949e'} />
                  <span style={{ fontSize: '12px', color: '#fff' }}>Breadth</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: breadth.color || '#8b949e' }}>
                  {breadth.percent || 50}%
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>Stocks above 50-day</div>
              </div>
              <div style={{ padding: '10px', backgroundColor: '#161b22', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Users size={14} color={healthyLeaders >= 5 ? '#10b981' : '#f59e0b'} />
                  <span style={{ fontSize: '12px', color: '#fff' }}>Leadership</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: healthyLeaders >= 5 ? '#10b981' : '#f59e0b' }}>
                  {healthyLeaders}/{leadership.length}
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>Leaders healthy</div>
              </div>
            </div>
          </div>

          {/* BaggerBomb Stats */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: '600' }}>
              BAGGERBOMB STATS (7 DAYS)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#161b22', borderRadius: '6px' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>
                  {baggerBombStats.breakouts7d || 0}
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>💣 Breakouts</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#161b22', borderRadius: '6px' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>
                  {baggerBombStats.busts7d || 0}
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>📉 Busts</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#161b22', borderRadius: '6px' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
                  {baggerBombStats.hitRate || 0}%
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>Hit Rate</div>
              </div>
            </div>
          </div>

          {/* Leadership List */}
          {leadership.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: '600' }}>
                TOP LEADERS
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {leadership.slice(0, 7).map((leader) => (
                  <div
                    key={leader.symbol}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      backgroundColor: '#161b22',
                      borderRadius: '14px',
                      fontSize: '12px'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#fff' }}>{leader.symbol}</span>
                    <span>{leader.healthStatus}</span>
                    <span style={{
                      color: leader.relativePerformance >= 0 ? '#10b981' : '#ef4444',
                      fontSize: '10px'
                    }}>
                      {leader.relativePerformance >= 0 ? '+' : ''}{leader.relativePerformance?.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insight */}
          {insight && (
            <div style={{
              padding: '12px',
              backgroundColor: `${color}10`,
              borderRadius: '8px',
              borderLeft: `3px solid ${color}`
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>💡</span>
                <p style={{ margin: 0, color: '#c9d1d9', fontSize: '12px', lineHeight: '1.5' }}>
                  {insight}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SectorCard;
