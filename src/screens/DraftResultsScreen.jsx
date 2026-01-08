// /src/screens/DraftResultsScreen.jsx

import React from 'react';

/**
 * DraftResultsScreen - Shows completed draft results and battle options
 *
 * @param {Object} props
 * @param {Object} props.currentDraft - The completed draft data
 * @param {Object} props.user - Current user object
 * @param {Function} props.setScreen - Handler to change screen
 * @param {Function} props.setCurrentDraft - Handler to clear/update draft
 * @param {Function} props.setPortfolio - Handler to set portfolio for battle
 * @param {Function} props.setPortfolioType - Handler to set portfolio type
 * @param {Function} props.setPortfolioName - Handler to set portfolio name
 * @param {Function} props.setDraftBattleOpponent - Handler to set draft battle opponent
 * @param {Object} props.battleTimer - Battle timer utilities
 * @param {Array} props.battles - Current battles array
 * @param {Function} props.setBattles - Handler to update battles
 * @param {Function} props.saveBattlesSafe - Handler to safely save battles
 * @param {Function} props.debugBattles - Debug utility for battles
 * @param {Object} props.containerStyle - Container style from App
 */
const DraftResultsScreen = ({
  currentDraft,
  user,
  setScreen,
  setCurrentDraft,
  setPortfolio,
  setPortfolioType,
  setPortfolioName,
  setDraftBattleOpponent,
  battleTimer,
  battles,
  setBattles,
  saveBattlesSafe,
  debugBattles,
  containerStyle
}) => {
  // Safety check - if no draft data, show fallback
  if (!currentDraft) {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          background: '#0d1117',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#ffffff', fontSize: '18px', marginBottom: '16px' }}>Loading draft results...</p>
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              padding: '12px 24px',
              background: '#00d9ff',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const draftData = currentDraft;
  const currentUserId = user?.odUserId || user?.username;
  const myPlayer = draftData?.players?.find(p => p.odUserId === currentUserId);

  const handleCreateBattle = async () => {
    if (!myPlayer || !myPlayer.picks || myPlayer.picks.length !== 9) {
      alert('Invalid portfolio from draft');
      return;
    }

    const equalWeight = 100 / 9;

    const battlePortfolio = myPlayer.picks.map(symbol => {
      const allAssets = [
        ...draftData.availableAssets?.steady || [],
        ...draftData.availableAssets?.risky || [],
        ...draftData.availableAssets?.defensive || []
      ];
      const assetData = allAssets.find(a => a.symbol === symbol) || { symbol, name: symbol };

      return {
        symbol: assetData.symbol,
        name: assetData.name || assetData.symbol,
        percentage: equalWeight
      };
    });

    setPortfolio(battlePortfolio);
    setPortfolioType(draftData.type);
    setPortfolioName(`Draft Portfolio - ${new Date().toLocaleDateString()}`);
    setScreen('createBattle');

    setTimeout(() => {
      alert('Your draft portfolio has been loaded! You can now create a battle or make adjustments.');
    }, 100);
  };

  const handleChallengeDraftOpponent = (opponent) => {
    if (opponent.isCPU) {
      alert('Cannot challenge CPU opponents to multiplayer battles. Start a Training battle instead!');
      return;
    }

    setDraftBattleOpponent(opponent);

    const equalWeight = 100 / 9;

    const myPortfolio = myPlayer.picks.map(symbol => ({
      symbol,
      percentage: equalWeight,
      amount: (equalWeight / 100) * 1000000
    }));

    const opponentPortfolio = opponent.picks.map(symbol => ({
      symbol,
      percentage: equalWeight,
      amount: (equalWeight / 100) * 1000000
    }));

    const battleId = Date.now().toString();
    const now = new Date();
    const BATTLE_DURATION = battleTimer.TEST_MODE
      ? 5 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    const newBattle = {
      id: battleId,
      challengeCode: `DRAFT-${battleId.slice(-4)}`,
      creator: currentUserId,
      opponent: opponent.odUserId,
      creatorPortfolio: myPortfolio,
      opponentPortfolio: opponentPortfolio,
      portfolioName: `Draft Battle - ${draftData.code}`,
      portfolioType: draftData.type,
      status: 'active',
      startDate: now.toISOString(),
      endDate: new Date(now.getTime() + BATTLE_DURATION).toISOString(),
      isDraftBattle: true,
      draftId: draftData.id,
      draftCode: draftData.code,
      createdAt: now.toISOString()
    };

    debugBattles?.('Before draft battle creation', battles);
    setBattles(prevBattles => {
      const exists = prevBattles.some(b => b.id === newBattle.id);
      if (exists) {
        console.log('⚠️ Draft battle already exists, skipping add');
        return prevBattles;
      }
      const updatedBattles = [...prevBattles, newBattle];
      debugBattles?.('After draft battle creation', updatedBattles);
      saveBattlesSafe?.(updatedBattles);
      return updatedBattles;
    });

    setScreen('dashboard');
    setCurrentDraft(null);
  };

  // Static confetti data
  const confettiColors = ['#10b981', '#8b5cf6', '#00d9ff', '#f59e0b', '#ffffff'];
  const confettiPieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: (i * 3.3) % 100,
    color: confettiColors[i % confettiColors.length],
    delay: (i * 0.1) % 2,
    duration: 2.5 + (i % 3),
    size: 8 + (i % 8)
  }));

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        {/* Celebration Animation Header */}
        <style>{`
          @keyframes confettiFall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(250px) rotate(360deg); opacity: 0; }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes sparkle {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
        <div style={{
          position: 'relative',
          width: '100%',
          padding: '40px 20px',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0d1117 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          {/* Confetti pieces */}
          {confettiPieces.map(piece => (
            <div
              key={piece.id}
              style={{
                position: 'absolute',
                left: `${piece.left}%`,
                top: '-20px',
                width: `${piece.size}px`,
                height: `${piece.size}px`,
                backgroundColor: piece.color,
                borderRadius: piece.id % 2 === 0 ? '50%' : '2px',
                pointerEvents: 'none',
                animation: `confettiFall ${piece.duration}s ease-out ${piece.delay}s infinite`
              }}
            />
          ))}

          {/* Sparkles */}
          <span style={{ position: 'absolute', left: '10%', top: '20px', fontSize: '20px', animation: 'sparkle 1.5s ease-in-out infinite', pointerEvents: 'none' }}>✨</span>
          <span style={{ position: 'absolute', left: '30%', top: '60px', fontSize: '16px', animation: 'sparkle 1.5s ease-in-out infinite 0.3s', pointerEvents: 'none' }}>⭐</span>
          <span style={{ position: 'absolute', left: '70%', top: '30px', fontSize: '18px', animation: 'sparkle 1.5s ease-in-out infinite 0.6s', pointerEvents: 'none' }}>✨</span>
          <span style={{ position: 'absolute', left: '90%', top: '50px', fontSize: '14px', animation: 'sparkle 1.5s ease-in-out infinite 0.9s', pointerEvents: 'none' }}>⭐</span>

          {/* Rocket emojis */}
          <div style={{
            fontSize: '40px',
            marginBottom: '16px',
            animation: 'bounce 1s ease-in-out infinite',
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'center',
            gap: '8px'
          }}>
            🚀 🎉 🚀
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: '28px',
            fontWeight: '800',
            color: '#ffffff',
            margin: '0 0 8px 0',
            padding: 0,
            animation: 'fadeIn 0.6s ease-out',
            position: 'relative',
            zIndex: 10,
            width: '100%',
            textAlign: 'center'
          }}>
            Draft Complete!
          </h1>
          <p style={{
            color: '#8b949e',
            fontSize: '14px',
            margin: '0',
            animation: 'fadeIn 0.6s ease-out 0.2s both',
            position: 'relative',
            zIndex: 10,
            width: '100%',
            textAlign: 'center'
          }}>
            All players have made their picks
          </p>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          {/* Your Portfolio */}
          <div style={{
            background: '#161b22',
            border: '2px solid #00d9ff',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h2 style={{ color: '#00d9ff', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
              Your Portfolio
            </h2>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {myPlayer?.picks?.map((symbol, i) => (
                <span key={i} style={{
                  padding: '8px 14px',
                  background: '#0d1117',
                  border: '1px solid #21262d',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {symbol}
                </span>
              ))}
            </div>
          </div>

          {/* Challenge an Opponent */}
          {!draftData?.isTraining && (
            <div style={{
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                Challenge an Opponent
              </h2>
              <p style={{ color: '#8b949e', fontSize: '13px', marginBottom: '16px' }}>
                Start a head-to-head battle using your drafted portfolios
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {draftData?.players?.filter(p => p.odUserId !== currentUserId).map((player) => (
                  <div
                    key={player.odUserId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: '#0d1117',
                      borderRadius: '8px',
                      border: '1px solid #21262d'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{player.isCPU ? '🤖' : '👤'}</span>
                      <div>
                        <div style={{ color: '#ffffff', fontWeight: '600' }}>
                          {player.displayName}
                        </div>
                        <div style={{ color: '#8b949e', fontSize: '12px' }}>
                          {player.picks?.length || 0} assets drafted
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleChallengeDraftOpponent(player)}
                      disabled={player.isCPU}
                      style={{
                        padding: '8px 16px',
                        background: player.isCPU
                          ? '#21262d'
                          : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: player.isCPU ? '#6e7681' : '#ffffff',
                        fontWeight: '600',
                        fontSize: '13px',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: player.isCPU ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {player.isCPU ? '🤖 CPU' : 'Challenge'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Players Summary */}
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
              All Portfolios
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draftData?.players?.map((player) => {
                const isMe = player.odUserId === currentUserId;
                return (
                  <div
                    key={player.odUserId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: isMe ? 'rgba(0, 217, 255, 0.1)' : '#0d1117',
                      borderRadius: '8px',
                      border: isMe ? '1px solid #00d9ff' : '1px solid #21262d'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{player.isCPU ? '🤖' : '👤'}</span>
                      <span style={{ color: isMe ? '#00d9ff' : '#ffffff', fontWeight: '600' }}>
                        {isMe ? 'You' : player.displayName}
                      </span>
                    </div>
                    <div style={{ color: '#8b949e', fontSize: '13px' }}>
                      {player.picks?.length || 0} picks
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Battle Status Banner */}
          {draftData?.status === 'battle' && (
            <div style={{
              background: 'transparent',
              border: '2px solid #8b5cf6',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {draftData.type === 'stocks' ? '📈' : '🪙'}
              </div>
              <div style={{ color: '#8b5cf6', fontWeight: 'bold', fontSize: '20px', marginBottom: '8px' }}>
                BATTLE IN PROGRESS
              </div>
              <div style={{ color: '#8b949e', fontSize: '14px', marginBottom: '12px' }}>
                {draftData.type === 'stocks'
                  ? 'Battle ends Friday at 3 PM CT'
                  : `Battle ends ${new Date(draftData.battleEndTime).toLocaleDateString()} at ${new Date(draftData.battleEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                }
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                fontSize: '13px',
                color: '#8b949e'
              }}>
                <span>Free Agents: {Object.values(draftData.freeAgents || {}).flat().length}</span>
                <span>|</span>
                <span>Swaps: {draftData.swapHistory?.length || 0}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Battle Mode Buttons */}
            {draftData?.status === 'battle' && (
              <>
                <button
                  onClick={() => setScreen('draftBattle')}
                  style={{
                    width: '100%',
                    padding: '18px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <span>📊</span> View Battle Standings
                </button>

                <button
                  onClick={() => setScreen('freeAgency')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'transparent',
                    color: '#8b5cf6',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    border: '2px solid #8b5cf6',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>🔄</span> Free Agency
                </button>
              </>
            )}

            {!draftData?.isTraining && draftData?.status !== 'battle' && (
              <button
                onClick={handleCreateBattle}
                style={{
                  width: '100%',
                  padding: '18px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                CREATE BATTLE WITH PORTFOLIO
              </button>
            )}

            <button
              onClick={() => {
                setCurrentDraft(null);
                setScreen('dashboard');
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                border: '1px solid #21262d',
                borderRadius: '12px',
                color: '#8b949e',
                cursor: 'pointer'
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftResultsScreen;
