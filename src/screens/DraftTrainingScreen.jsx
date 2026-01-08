// /src/screens/DraftTrainingScreen.jsx

import React from 'react';

/**
 * DraftTrainingScreen - Practice draft against CPU opponents
 *
 * @param {Object} props
 * @param {Function} props.onBack - Handler to go back to dashboard
 * @param {string} props.assetType - Selected asset type ('stocks' or 'crypto')
 * @param {Function} props.setAssetType - Handler to change asset type
 * @param {Object} props.user - Current user object
 * @param {Function} props.setCurrentDraft - Handler to set the current draft
 * @param {Function} props.setScreen - Handler to change screen
 * @param {Object} props.containerStyle - Container style from App
 */
const DraftTrainingScreen = ({
  onBack,
  assetType,
  setAssetType,
  user,
  setCurrentDraft,
  setScreen,
  containerStyle
}) => {
  const handleStartTraining = async () => {
    try {
      const draftService = await import('../services/draftService');
      const draft = await draftService.createTrainingDraft(
        user.odUserId || user.username,
        user.username,
        assetType
      );
      setCurrentDraft(draft);
      setScreen('draftRoom');
    } catch (error) {
      console.error('Failed to create training draft:', error);
      alert('Failed to start training. Please try again.');
    }
  };

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
            onClick={handleStartTraining}
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
