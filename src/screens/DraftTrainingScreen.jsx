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

const DraftTrainingScreen = ({
  user,
  assetType,
  setAssetType,
  onBack,
  onStartTraining
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
              Draft Training
            </h1>
            <div style={{ width: '60px' }}></div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🤖</div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
              Practice Draft Mode
            </h2>
            <p style={{ color: '#8b949e' }}>
              Play against 3 CPU opponents
            </p>
          </div>

          {/* Type Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={() => setAssetType('stocks')}
              style={{
                padding: '24px 16px',
                borderRadius: '12px',
                border: assetType === 'stocks' ? '2px solid #f59e0b' : '2px solid #21262d',
                background: assetType === 'stocks' ? 'rgba(245, 158, 11, 0.1)' : '#161b22',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📈</div>
              <div style={{ color: assetType === 'stocks' ? '#f59e0b' : '#ffffff', fontWeight: 'bold' }}>Stocks</div>
            </button>
            <button
              onClick={() => setAssetType('crypto')}
              style={{
                padding: '24px 16px',
                borderRadius: '12px',
                border: assetType === 'crypto' ? '2px solid #f59e0b' : '2px solid #21262d',
                background: assetType === 'crypto' ? 'rgba(245, 158, 11, 0.1)' : '#161b22',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>₿</div>
              <div style={{ color: assetType === 'crypto' ? '#f59e0b' : '#ffffff', fontWeight: 'bold' }}>Crypto</div>
            </button>
          </div>

          {/* XP Notice */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid #f59e0b',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#f59e0b', fontSize: '14px', margin: 0 }}>
              Training rewards: +10 XP (win) / +5 XP (loss)
            </p>
          </div>

          <button
            onClick={async () => {
              try {
                const draftService = await import('../services/draftService');
                const draft = await draftService.createTrainingDraft(
                  user.odUserId || user.username,
                  user.username,
                  assetType
                );
                onStartTraining(draft);
              } catch (error) {
                console.error('Failed to create training draft:', error);
                alert('Failed to start training. Please try again.');
              }
            }}
            style={{
              width: '100%',
              padding: '18px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#000000',
              fontWeight: 'bold',
              fontSize: '16px',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
          >
            START TRAINING DRAFT
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftTrainingScreen;
