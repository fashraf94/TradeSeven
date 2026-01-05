import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Plus, Check } from 'lucide-react';
import { getSectorStocks } from '../../services/sectorDataService';

const SectorDetailModal = ({
  sector,
  onClose,
  onSelectSector,
  isSelected = false
}) => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('performance'); // 'performance' | 'name' | 'threshold'

  useEffect(() => {
    loadStocks();
  }, [sector?.id]);

  const loadStocks = async () => {
    if (!sector?.id) return;

    try {
      setLoading(true);
      const stockData = await getSectorStocks(sector.id);
      setStocks(stockData);
    } catch (error) {
      console.error('Error loading stocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedStocks = [...stocks].sort((a, b) => {
    switch (sortBy) {
      case 'performance':
        return (b.change1W || 0) - (a.change1W || 0);
      case 'name':
        return a.symbol.localeCompare(b.symbol);
      default:
        return 0;
    }
  });

  const formatPercent = (value) => {
    if (value === undefined || value === null) return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#161b22',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
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
              backgroundColor: `${sector.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {sector.emoji}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
                {sector.name}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
                {sector.description}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Quick Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: '#0d1117'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              color: sector.performance?.month1 >= 0 ? '#10b981' : '#ef4444'
            }}>
              {formatPercent(sector.performance?.month1)}
            </div>
            <div style={{ fontSize: '11px', color: '#8b949e' }}>1M Return</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: sector.breadth?.color }}>
              {sector.breadth?.percent}%
            </div>
            <div style={{ fontSize: '11px', color: '#8b949e' }}>Breadth</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
              {sector.baggerBombStats?.breakouts7d || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#8b949e' }}>💣 7d</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>
              {sector.baggerBombStats?.hitRate || 0}%
            </div>
            <div style={{ fontSize: '11px', color: '#8b949e' }}>Hit Rate</div>
          </div>
        </div>

        {/* Sort Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: '1px solid #21262d'
        }}>
          <div style={{ fontSize: '14px', color: '#8b949e' }}>
            {stocks.length} stocks in sector
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSortBy('performance')}
              style={{
                padding: '4px 10px',
                backgroundColor: sortBy === 'performance' ? '#21262d' : 'transparent',
                border: '1px solid #21262d',
                borderRadius: '4px',
                color: sortBy === 'performance' ? '#fff' : '#8b949e',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Performance
            </button>
            <button
              onClick={() => setSortBy('name')}
              style={{
                padding: '4px 10px',
                backgroundColor: sortBy === 'name' ? '#21262d' : 'transparent',
                border: '1px solid #21262d',
                borderRadius: '4px',
                color: sortBy === 'name' ? '#fff' : '#8b949e',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              A-Z
            </button>
          </div>
        </div>

        {/* Stocks List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
              Loading stocks...
            </div>
          ) : sortedStocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
              No stock data available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedStocks.map((stock) => (
                <div
                  key={stock.symbol}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    backgroundColor: '#0d1117',
                    borderRadius: '8px',
                    border: '1px solid #21262d'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: stock.above50SMA ? '#10b981' : '#ef4444'
                    }} />
                    <div>
                      <div style={{ fontWeight: '600', color: '#ffffff' }}>{stock.symbol}</div>
                      <div style={{ fontSize: '12px', color: '#8b949e' }}>
                        ${stock.price?.toFixed(2) || '--'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: stock.change1W >= 0 ? '#10b981' : '#ef4444',
                        fontWeight: '500'
                      }}>
                        {stock.change1W >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {formatPercent(stock.change1W)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8b949e' }}>1W</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        color: stock.change1M >= 0 ? '#10b981' : '#ef4444',
                        fontWeight: '500'
                      }}>
                        {formatPercent(stock.change1M)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8b949e' }}>1M</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #21262d'
        }}>
          <button
            onClick={() => {
              onSelectSector?.(sector.id);
              onClose();
            }}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: isSelected ? '#21262d' : sector.color,
              border: 'none',
              borderRadius: '10px',
              color: isSelected ? '#ffffff' : '#000000',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isSelected ? (
              <>
                <Check size={18} /> Sector Selected
              </>
            ) : (
              <>
                <Plus size={18} /> Add {sector.name} to Game Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectorDetailModal;
