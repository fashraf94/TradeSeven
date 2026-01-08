import React from 'react';

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
            maxWidth: '600px',
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
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
              Snake Draft Battle
            </h2>
            <p style={{ color: '#8b949e', fontSize: '16px' }}>
              4 players - 9 picks each - 2 min per pick
            </p>
          </div>

          {/* Draft Type Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              color: '#8b949e',
              fontSize: '14px',
              marginBottom: '12px',
              fontWeight: '600'
            }}>
              Select Asset Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => setAssetType('stocks')}
                style={{
                  padding: '24px 16px',
                  borderRadius: '12px',
                  border: assetType === 'stocks' ? '2px solid #00d9ff' : '2px solid #21262d',
                  background: assetType === 'stocks' ? 'rgba(0, 217, 255, 0.1)' : '#161b22',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📈</div>
                <div style={{
                  color: assetType === 'stocks' ? '#00d9ff' : '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>Stocks</div>
                <div style={{ color: '#8b949e', fontSize: '13px', marginTop: '4px' }}>75 Assets</div>
              </button>
              <button
                onClick={() => setAssetType('crypto')}
                style={{
                  padding: '24px 16px',
                  borderRadius: '12px',
                  border: assetType === 'crypto' ? '2px solid #00d9ff' : '2px solid #21262d',
                  background: assetType === 'crypto' ? 'rgba(0, 217, 255, 0.1)' : '#161b22',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>₿</div>
                <div style={{
                  color: assetType === 'crypto' ? '#00d9ff' : '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>Crypto</div>
                <div style={{ color: '#8b949e', fontSize: '13px', marginTop: '4px' }}>75 Assets</div>
              </button>
            </div>
          </div>

          {/* Category Explanation */}
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
              Draft Categories
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#10b981'
                }}></div>
                <div>
                  <span style={{ color: '#10b981', fontWeight: '600' }}>Steady</span>
                  <span style={{ color: '#8b949e', marginLeft: '8px' }}>- 3 picks - Blue chips, low volatility</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#f59e0b'
                }}></div>
                <div>
                  <span style={{ color: '#f59e0b', fontWeight: '600' }}>Risky</span>
                  <span style={{ color: '#8b949e', marginLeft: '8px' }}>- 3 picks - High growth, high volatility</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#3b82f6'
                }}></div>
                <div>
                  <span style={{ color: '#3b82f6', fontWeight: '600' }}>Defensive</span>
                  <span style={{ color: '#8b949e', marginLeft: '8px' }}>- 3 picks - Utilities, stable dividend</span>
                </div>
              </div>
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
                  assetType
                );
                onCreateDraft(draft);
              } catch (error) {
                console.error('Failed to create draft:', error);
                alert('Failed to create draft. Please try again.');
              }
            }}
            style={{
              width: '100%',
              padding: '18px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '16px',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          >
            CREATE DRAFT LOBBY
          </button>

          <p style={{ textAlign: 'center', color: '#8b949e', fontSize: '14px' }}>
            Share the code with 3 friends to start
          </p>
        </div>
      </div>
    </div>
  );
};

export default DraftSetupScreen;
