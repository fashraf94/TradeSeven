// /src/screens/JoinScreen.jsx

import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

/**
 * JoinScreen - Join an existing battle with a code
 * Extracted from App.jsx Phase 6
 */
const JoinScreen = ({
  onBack,
  onContinueToBuilder,
  onContinueToBaggerBomb,
  colors,
  containerStyle,
  DesktopBackground,
  isDesktop
}) => {
  const { user } = useUser();

  const [joinCode, setJoinCode] = useState('');
  const [joinBattleType, setJoinBattleType] = useState('classic');

  const handleContinue = () => {
    if (joinCode.length === 6) {
      if (joinBattleType === 'baggerbomb') {
        onContinueToBaggerBomb?.(joinCode);
      } else {
        onContinueToBuilder?.(joinCode);
      }
    }
  };

  return (
    <div style={containerStyle}>
      {isDesktop && DesktopBackground && <DesktopBackground isDesktop={isDesktop} />}

      <div style={{ minHeight: '100vh', background: '#0d1117', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* HEADER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#0d1117',
          borderBottom: '1px solid #21262d',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>

          <h1 style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700', margin: 0, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            Join Battle
          </h1>

          <div style={{ width: '60px' }}></div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          {/* Challenge Code Card */}
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            {/* Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>

            <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
              Enter Challenge Code
            </h2>
            <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '24px' }}>
              Get the 6-character code from your opponent
            </p>

            {/* Code Input */}
            <input
              type="text"
              placeholder="XXXXXX"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={{
                width: '100%',
                padding: '16px 24px',
                fontSize: '28px',
                fontWeight: '700',
                textAlign: 'center',
                letterSpacing: '8px',
                border: `2px solid ${joinCode.length === 6 ? '#22c55e' : joinCode ? '#06b6d4' : '#21262d'}`,
                borderRadius: '12px',
                outline: 'none',
                textTransform: 'uppercase',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
                background: 'rgba(0, 0, 0, 0.3)',
                color: '#ffffff',
                marginBottom: '20px'
              }}
            />

            {/* Battle Type Selection */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '10px',
                textAlign: 'center'
              }}>
                Select Battle Type
              </div>
              <div style={{
                display: 'flex',
                gap: '10px'
              }}>
                {/* Classic Battle Option */}
                <button
                  onClick={() => setJoinBattleType('classic')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '14px 12px',
                    background: joinBattleType === 'classic'
                      ? 'rgba(6, 182, 212, 0.15)'
                      : 'rgba(255,255,255,0.03)',
                    border: joinBattleType === 'classic'
                      ? '2px solid #06b6d4'
                      : '2px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: joinBattleType === 'classic'
                      ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                      : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    📊
                  </div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#fff'
                  }}>
                    Classic
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.5)',
                    textAlign: 'center'
                  }}>
                    % returns
                  </div>
                </button>

                {/* BaggerBomb Battle Option */}
                <button
                  onClick={() => setJoinBattleType('baggerbomb')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '14px 12px',
                    background: joinBattleType === 'baggerbomb'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(255,255,255,0.03)',
                    border: joinBattleType === 'baggerbomb'
                      ? '2px solid #10b981'
                      : '2px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#fff',
                    fontSize: '8px',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    New
                  </div>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: joinBattleType === 'baggerbomb'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    💣
                  </div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#fff'
                  }}>
                    BaggerBomb
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.5)',
                    textAlign: 'center'
                  }}>
                    Threshold scoring
                  </div>
                </button>
              </div>
            </div>

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              disabled={joinCode.length !== 6}
              style={{
                width: '100%',
                padding: '14px 24px',
                fontSize: '16px',
                fontWeight: '700',
                border: 'none',
                borderRadius: '12px',
                cursor: joinCode.length === 6 ? 'pointer' : 'not-allowed',
                background: joinCode.length === 6
                  ? joinBattleType === 'baggerbomb'
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                  : '#21262d',
                color: joinCode.length === 6 ? '#ffffff' : '#6e7681',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: joinCode.length === 6
                  ? joinBattleType === 'baggerbomb'
                    ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                    : '0 4px 12px rgba(6, 182, 212, 0.3)'
                  : 'none'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              {joinCode.length === 6 ? 'Continue to Portfolio Builder' : `Enter ${6 - joinCode.length} more character${6 - joinCode.length !== 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Rules reminder */}
          <div style={{
            marginTop: '24px',
            padding: '16px 20px',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span style={{ color: '#a855f7', fontSize: '13px', fontWeight: '600' }}>Quick Reminder</span>
            </div>
            <p style={{ color: '#8b949e', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
              After entering the code, you'll build your portfolio with 6-12 stocks + 0-2 shorts + 1 crypto. The battle starts when both players are ready!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinScreen;
