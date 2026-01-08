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

const DraftJoinScreen = ({
  user,
  draftJoinCode,
  setDraftJoinCode,
  onBack,
  onJoinDraft
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
              Join Draft
            </h1>
            <div style={{ width: '60px' }}></div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '500px', margin: '0 auto', padding: '32px 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🐍</div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
              Enter Draft Code
            </h2>
            <p style={{ color: '#8b949e' }}>
              Get the code from the draft creator
            </p>
          </div>

          <input
            type="text"
            value={draftJoinCode}
            onChange={(e) => setDraftJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g., BULL-1234"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '24px',
              fontWeight: 'bold',
              textAlign: 'center',
              letterSpacing: '4px',
              background: '#161b22',
              border: '2px solid #21262d',
              borderRadius: '12px',
              color: '#ffffff',
              marginBottom: '16px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            maxLength={10}
          />

          <button
            onClick={async () => {
              if (!draftJoinCode.trim()) {
                alert('Please enter a draft code');
                return;
              }
              try {
                const draftService = await import('../services/draftService');
                const draft = await draftService.joinDraftByCode(
                  draftJoinCode.trim(),
                  user.odUserId || user.username,
                  user.username
                );
                onJoinDraft(draft);
              } catch (error) {
                console.error('Failed to join draft:', error);
                alert(error.message || 'Failed to join draft');
              }
            }}
            disabled={!draftJoinCode.trim()}
            style={{
              width: '100%',
              padding: '16px',
              background: draftJoinCode.trim()
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : '#21262d',
              color: draftJoinCode.trim() ? '#ffffff' : '#8b949e',
              fontWeight: 'bold',
              fontSize: '16px',
              border: 'none',
              borderRadius: '12px',
              cursor: draftJoinCode.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            JOIN DRAFT
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftJoinScreen;
