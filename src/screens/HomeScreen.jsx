import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import DesktopBackground from '../components/DesktopBackground';
import MarketClashLogo from '../components/MarketClashLogo';

const HomeScreen = ({
  containerStyle,
  isDesktop,
  login,
  setScreen,
}) => {
  // Local state for login form
  const [username, setUsername] = useState('');

  const handleLogin = async () => {
    if (!username.trim()) return;
    await login(username.trim());
    setScreen('dashboard');
  };

  return (
    <div style={containerStyle}>
      {/* Animated Desktop Background */}
      <DesktopBackground isDesktop={isDesktop} />

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
          <MarketClashLogo size="large" />
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
            disabled={!username.trim()}
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
            Enter Arena
            <ArrowRight style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
