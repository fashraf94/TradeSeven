// /src/screens/HomeScreen.jsx

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

/**
 * HomeScreen - Login/Registration screen
 * Extracted from App.jsx Phase 6
 */
const HomeScreen = ({
  onLoginSuccess,
  colors,
  isDesktop,
  containerStyle,
  DesktopBackground,
  MarketClashLogo
}) => {
  const { login } = useUser();

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) return;

    setLoading(true);

    try {
      // Simple username-only login for beta
      const user = {
        username: username.trim(),
        odUserId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      await login(user);
      onLoginSuccess?.();
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      {/* Animated Desktop Background */}
      {isDesktop && DesktopBackground && <DesktopBackground isDesktop={isDesktop} />}

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* LOGO ONLY - CENTERED */}
        <div style={{
          marginBottom: '40px',
          textAlign: 'center'
        }}>
          {MarketClashLogo && <MarketClashLogo size="large" />}
        </div>

        {/* LOGIN FORM */}
        <div style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#1a1f2e',
          border: '2px solid #21262d',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
        }}>

          {/* Username Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#ffffff',
              marginBottom: '8px'
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Enter your username"
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '14px',
                backgroundColor: '#0d1117',
                border: `2px solid ${username ? '#00d9ff' : '#21262d'}`,
                borderRadius: '8px',
                color: '#ffffff',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Enter Arena Button */}
          <button
            onClick={handleLogin}
            disabled={!username.trim() || loading}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: username.trim() ? '#0d1117' : '#6e7681',
              background: username.trim()
                ? 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)'
                : '#21262d',
              border: 'none',
              borderRadius: '8px',
              cursor: username.trim() ? 'pointer' : 'not-allowed',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: username.trim() ? '0 4px 12px rgba(0, 217, 255, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? 'Entering Arena...' : 'Enter Arena'}
            {!loading && <ArrowRight style={{ width: '20px', height: '20px' }} />}
          </button>
        </div>

        {/* Beta Notice */}
        <div style={{
          marginTop: '24px',
          padding: '12px 20px',
          borderRadius: '8px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          maxWidth: '400px'
        }}>
          <p style={{
            color: '#f59e0b',
            fontSize: '12px',
            textAlign: 'center',
            margin: 0
          }}>
            🚀 Beta Version - Username-only login for testing
          </p>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          color: colors?.textMuted || '#6e7681',
          fontSize: '12px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10
        }}>
          © 2026 MarketClash. Not financial advice.
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
