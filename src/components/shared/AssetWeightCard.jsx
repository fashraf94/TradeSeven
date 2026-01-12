import React, { useState } from 'react';

const AssetWeightCard = ({ asset, onWeightChange, onRemove }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  // Preset weight options (2.5% increments)
  const weightOptions = [7.5, 10, 12.5, 15, 17.5, 20];

  return (
    <div style={{
      backgroundColor: '#161b22',
      border: '2px solid #8b5cf6',
      borderRadius: '12px',
      padding: '16px'
    }}>

      {/* ASSET HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: '4px'
          }}>
            {asset.symbol}
          </h3>
          <p style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#00d9ff'
          }}>
            ${asset.price?.toFixed(2) || '0.00'}
          </p>
        </div>

        {/* REMOVE BUTTON */}
        <button
          onClick={onRemove}
          style={{
            width: '36px',
            height: '36px',
            backgroundColor: 'transparent',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          ×
        </button>
      </div>

      {/* WEIGHT SELECTION */}
      <div>
        {/* DROPDOWN */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              width: '100%',
              backgroundColor: '#0d1117',
              border: '2px solid #8b5cf6',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            <span>{asset.allocation}%</span>
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="#8b5cf6"
              viewBox="0 0 24 24"
              style={{
                transform: showDropdown ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* DROPDOWN MENU */}
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              backgroundColor: '#161b22',
              border: '2px solid #8b5cf6',
              borderRadius: '8px',
              overflow: 'hidden',
              zIndex: 100,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
            }}>
              {weightOptions.map((weight) => (
                <button
                  key={weight}
                  onClick={() => {
                    onWeightChange(weight);
                    setShowDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: asset.allocation === weight ? '#8b5cf6' : 'transparent',
                    color: asset.allocation === weight ? '#000000' : '#ffffff',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: asset.allocation === weight ? 'bold' : '600',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  {weight}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SLIDER */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ color: '#8b949e', fontSize: '13px' }}>Fine tune</span>
            <span style={{ color: '#8b5cf6', fontSize: '14px', fontWeight: 'bold' }}>
              {asset.allocation}%
            </span>
          </div>

          <input
            type="range"
            min="7.5"
            max="20"
            step="0.1"
            value={asset.allocation}
            onChange={(e) => onWeightChange(parseFloat(e.target.value))}
            className="custom-slider"
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundColor: '#21262d',
              outline: 'none',
              cursor: 'pointer'
            }}
          />

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '6px'
          }}>
            <span style={{ color: '#6e7681', fontSize: '11px' }}>7.5%</span>
            <span style={{ color: '#6e7681', fontSize: '11px' }}>20%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetWeightCard;
