import React from 'react';
import { Bug } from 'lucide-react';
import DesktopBackground from '../components/DesktopBackground';
import { ADMIN_USERS } from '../components/ClashBot/BugReportAdmin';

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

const ProfileScreen = ({
  user,
  isDesktop,
  onBack,
  setScreen,
}) => {
  const userStats = {
    xp: user.xp || 0,
    wins: user.wins || 0,
    losses: user.losses || 0,
    totalBattles: (user.wins || 0) + (user.losses || 0),
    rank: (user.xp || 0) >= 5000 ? 'Master' : (user.xp || 0) >= 2000 ? 'Expert' : (user.xp || 0) >= 500 ? 'Veteran' : 'Beginner'
  };

  return (
    <div style={containerStyle}>
      {/* Animated Desktop Background */}
      <DesktopBackground isDesktop={isDesktop} />

      <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', position: 'relative', zIndex: 1 }}>

        {/* HEADER */}
        <div style={{
          background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
          borderBottom: '1px solid #21262d',
          padding: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 10
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
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>

            <h1 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#ffffff'
            }}>
              Profile
            </h1>

            <div style={{ width: '60px' }}></div>
          </div>
        </div>

        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '0 16px 40px 16px'
        }}>

          {/* USER CARD */}
          <div style={{
            background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
            border: '2px solid #00d9ff',
            borderRadius: '16px',
            padding: '24px',
            marginTop: '24px',
            marginBottom: '24px',
            boxShadow: '0 10px 40px rgba(0, 217, 255, 0.1)'
          }}>
            {/* Avatar and Username */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                border: '3px solid #00d9ff',
                boxShadow: '0 0 30px rgba(0, 217, 255, 0.4)',
                marginBottom: '16px'
              }}>
                👤
              </div>

              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: '8px'
              }}>
                {user?.username || 'Player'}
              </h2>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#8b5cf6',
                padding: '6px 16px',
                borderRadius: '20px'
              }}>
                <span style={{ fontSize: '18px' }}>🏅</span>
                <span style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#ffffff'
                }}>
                  {userStats.rank}
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginTop: '20px'
            }}>
              {/* XP */}
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #21262d',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#8b949e',
                  marginBottom: '6px',
                  fontWeight: '600'
                }}>
                  EXPERIENCE
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#00d9ff',
                  marginBottom: '4px'
                }}>
                  {userStats.xp}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#6e7681'
                }}>
                  {1000 - (userStats.xp % 1000)} to next level
                </div>
              </div>

              {/* Win Rate */}
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #21262d',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#8b949e',
                  marginBottom: '6px',
                  fontWeight: '600'
                }}>
                  WIN RATE
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: userStats.totalBattles > 0 && (userStats.wins / userStats.totalBattles) >= 0.5 ? '#22c55e' : '#ef4444',
                  marginBottom: '4px'
                }}>
                  {userStats.totalBattles > 0
                    ? `${Math.round((userStats.wins / userStats.totalBattles) * 100)}%`
                    : '0%'}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#6e7681'
                }}>
                  {userStats.totalBattles} battles
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginTop: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: '600' }}>
                  LEVEL PROGRESS
                </span>
                <span style={{ fontSize: '12px', color: '#00d9ff', fontWeight: 'bold' }}>
                  {Math.floor(((userStats.xp % 1000) / 1000) * 100)}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#21262d',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${((userStats.xp % 1000) / 1000) * 100}%`,
                  background: 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>

          {/* BATTLE RECORD */}
          <h3 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: '12px',
            marginTop: '24px'
          }}>
            Battle Record
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            marginBottom: '24px'
          }}>
            {/* Wins */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #22c55e',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏆</div>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#22c55e',
                marginBottom: '4px'
              }}>
                {userStats.wins}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Wins</div>
            </div>

            {/* Losses */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #ef4444',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>💀</div>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#ef4444',
                marginBottom: '4px'
              }}>
                {userStats.losses}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Losses</div>
            </div>

            {/* Total */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #8b5cf6',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚔️</div>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#8b5cf6',
                marginBottom: '4px'
              }}>
                {userStats.totalBattles}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Total</div>
            </div>
          </div>

          {/* ACHIEVEMENTS */}
          <h3 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: '12px'
          }}>
            Achievements
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '12px'
          }}>
            {/* First Win */}
            <div style={{
              backgroundColor: '#161b22',
              border: `2px solid ${userStats.wins >= 1 ? '#fbbf24' : '#21262d'}`,
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              opacity: userStats.wins >= 1 ? 1 : 0.5
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {userStats.wins >= 1 ? '🏆' : '🔒'}
              </div>
              <div style={{
                fontSize: '11px',
                color: userStats.wins >= 1 ? '#fbbf24' : '#6e7681',
                fontWeight: '600'
              }}>
                First Win
              </div>
            </div>

            {/* 10 Wins */}
            <div style={{
              backgroundColor: '#161b22',
              border: `2px solid ${userStats.wins >= 10 ? '#fbbf24' : '#21262d'}`,
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              opacity: userStats.wins >= 10 ? 1 : 0.5
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {userStats.wins >= 10 ? '🔥' : '🔒'}
              </div>
              <div style={{
                fontSize: '11px',
                color: userStats.wins >= 10 ? '#fbbf24' : '#6e7681',
                fontWeight: '600'
              }}>
                10 Wins
              </div>
            </div>

            {/* 50 Battles */}
            <div style={{
              backgroundColor: '#161b22',
              border: `2px solid ${userStats.totalBattles >= 50 ? '#fbbf24' : '#21262d'}`,
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              opacity: userStats.totalBattles >= 50 ? 1 : 0.5
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {userStats.totalBattles >= 50 ? '⚔️' : '🔒'}
              </div>
              <div style={{
                fontSize: '11px',
                color: userStats.totalBattles >= 50 ? '#fbbf24' : '#6e7681',
                fontWeight: '600'
              }}>
                50 Battles
              </div>
            </div>

            {/* Master Rank */}
            <div style={{
              backgroundColor: '#161b22',
              border: `2px solid ${userStats.rank === 'Master' ? '#fbbf24' : '#21262d'}`,
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              opacity: userStats.rank === 'Master' ? 1 : 0.5
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {userStats.rank === 'Master' ? '👑' : '🔒'}
              </div>
              <div style={{
                fontSize: '11px',
                color: userStats.rank === 'Master' ? '#fbbf24' : '#6e7681',
                fontWeight: '600'
              }}>
                Master Rank
              </div>
            </div>

            {/* Perfect Week */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #21262d',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              opacity: 0.5
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
              <div style={{
                fontSize: '11px',
                color: '#6e7681',
                fontWeight: '600'
              }}>
                Perfect Week
              </div>
            </div>

            {/* Comeback King */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #21262d',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              opacity: 0.5
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
              <div style={{
                fontSize: '11px',
                color: '#6e7681',
                fontWeight: '600'
              }}>
                Comeback
              </div>
            </div>
          </div>

          {/* ADMIN TOOLS — only visible for admin users */}
          {ADMIN_USERS.includes(user?.username) && setScreen && (
            <>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: '12px',
                marginTop: '24px'
              }}>
                Admin Tools
              </h3>

              <button
                onClick={() => setScreen('bugReportAdmin')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: '#161b22',
                  border: '2px solid #8b5cf6',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  outline: 'none',
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Bug size={20} color="#8b5cf6" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>
                    Bug Reports
                  </div>
                  <div style={{ fontSize: '12px', color: '#8b949e', marginTop: 2 }}>
                    Review and triage ClashBot reports
                  </div>
                </div>
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
