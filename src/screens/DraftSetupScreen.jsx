import React, { useState } from 'react';
import { TrendingUp, Bitcoin, Clock, Rocket, Shield, Flame, Target } from 'lucide-react';

// Time options for scheduled start
const TIME_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '7 hours', value: 420 },
  { label: '10 hours', value: 600 },
];

// Style override to neutralize App.css
const containerStyle = {
  maxWidth: '100vw',
  width: '100%',
  margin: 0,
  padding: 0,
  textAlign: 'left',
  minHeight: '100vh',
  background: '#0d1117',
  overflowX: 'hidden'
};

const DraftSetupScreen = ({
  user,
  assetType,
  setAssetType,
  onBack,
  onCreateDraft
}) => {
  const [selectedTime, setSelectedTime] = useState(30); // Default 30 minutes

  // Calculate scheduled start time for preview
  const scheduledStartTime = new Date(Date.now() + selectedTime * 60000);

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        {/* Header */}
        <div style={{
          background: '#161b22',
          borderBottom: '2px solid #21262d',
          padding: '16px'
        }}>
          <div style={{
            maxWidth: '700px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#00d9ff',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
              Create Draft
            </h1>
            <div style={{ width: '60px' }}></div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
              Snake Draft Battle
            </h2>
            <p style={{ color: '#8b949e', fontSize: '15px' }}>
              4 players • 9 picks each • 2 min per pick
            </p>
          </div>

          {/* Draft Type Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#8b949e',
              fontSize: '13px',
              marginBottom: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Select Asset Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => setAssetType('stocks')}
                style={{
                  padding: '20px 16px',
                  borderRadius: '12px',
                  border: assetType === 'stocks' ? '2px solid #00d9ff' : '2px solid #21262d',
                  background: assetType === 'stocks' ? 'rgba(0, 217, 255, 0.1)' : '#161b22',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <TrendingUp size={32} color={assetType === 'stocks' ? '#00d9ff' : '#8b949e'} />
                <div style={{
                  color: assetType === 'stocks' ? '#00d9ff' : '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>Stocks</div>
                <div style={{ color: '#8b949e', fontSize: '13px' }}>75 Assets</div>
              </button>
              <button
                onClick={() => setAssetType('crypto')}
                style={{
                  padding: '20px 16px',
                  borderRadius: '12px',
                  border: assetType === 'crypto' ? '2px solid #00d9ff' : '2px solid #21262d',
                  background: assetType === 'crypto' ? 'rgba(0, 217, 255, 0.1)' : '#161b22',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Bitcoin size={32} color={assetType === 'crypto' ? '#00d9ff' : '#f7931a'} />
                <div style={{
                  color: assetType === 'crypto' ? '#00d9ff' : '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>Crypto</div>
                <div style={{ color: '#8b949e', fontSize: '13px' }}>75 Assets</div>
              </button>
            </div>
          </div>

          {/* Category Explanation - Horizontal 3-column */}
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
              Draft Categories
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px',
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <Target size={20} color="#10b981" style={{ marginBottom: '6px' }} />
                <span style={{ color: '#10b981', fontWeight: '600', fontSize: '13px' }}>Steady</span>
                <span style={{ color: '#8b949e', fontSize: '11px', textAlign: 'center', marginTop: '4px' }}>3 picks • Blue chips</span>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.2)'
              }}>
                <Flame size={20} color="#f59e0b" style={{ marginBottom: '6px' }} />
                <span style={{ color: '#f59e0b', fontWeight: '600', fontSize: '13px' }}>Risky</span>
                <span style={{ color: '#8b949e', fontSize: '11px', textAlign: 'center', marginTop: '4px' }}>3 picks • High growth</span>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <Shield size={20} color="#3b82f6" style={{ marginBottom: '6px' }} />
                <span style={{ color: '#3b82f6', fontWeight: '600', fontSize: '13px' }}>Defensive</span>
                <span style={{ color: '#8b949e', fontSize: '11px', textAlign: 'center', marginTop: '4px' }}>3 picks • Stable</span>
              </div>
            </div>
          </div>

          {/* Scheduled Start Time */}
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <h3 style={{
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Clock size={18} color="#8b949e" />
              When should the draft start?
            </h3>
            <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '14px' }}>
              Players have until this time to join. Draft auto-cancels if not full.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '12px'
            }}>
              {TIME_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedTime(option.value)}
                  style={{
                    padding: '14px 8px',
                    background: selectedTime === option.value
                      ? 'rgba(20, 184, 166, 0.15)'
                      : '#161b22',
                    border: selectedTime === option.value
                      ? '2px solid #14b8a6'
                      : '2px solid #21262d',
                    borderRadius: '10px',
                    color: selectedTime === option.value ? '#14b8a6' : '#8b949e',
                    fontSize: '13px',
                    fontWeight: selectedTime === option.value ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div style={{
              background: 'rgba(20, 184, 166, 0.1)',
              border: '1px solid rgba(20, 184, 166, 0.3)',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Rocket size={18} color="#14b8a6" />
              <span style={{ color: '#14b8a6', fontSize: '14px', fontWeight: '600' }}>
                Draft starts at: {scheduledStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={async () => {
              try {
                const draftService = await import('../services/draftService');
                const draft = await draftService.createMultiplayerDraft(
                  user.odUserId || user.username,
                  user.username,
                  assetType,
                  selectedTime
                );
                onCreateDraft(draft);
              } catch (error) {
                console.error('Failed to create draft:', error);
                alert('Failed to create draft. Please try again.');
              }
            }}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '16px',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              marginBottom: '12px',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}
          >
            CREATE DRAFT LOBBY
          </button>

          <p style={{ textAlign: 'center', color: '#8b949e', fontSize: '13px' }}>
            Share the code with 3 friends to start
          </p>
        </div>
      </div>
    </div>
  );
};

export default DraftSetupScreen;
