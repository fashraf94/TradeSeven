// /src/components/Dashboard/WeeklyChallengesPanel.jsx
// Extracted from App.jsx - Weekly Challenges Section

import { motion } from 'framer-motion';
import { ChevronDown, Zap, Trophy } from 'lucide-react';

// XP Rewards
const CHALLENGE_XP = {
  easy: 100,
  medium: 250,
  hard: 500,
  weeklyBonus: 250 // Complete all 4 challenges
};

// Challenge colors for UI
const CHALLENGE_COLORS = {
  weekly: '#A855F7',    // Purple for weekly challenges
  inBattle: '#FB923C', // Orange for in-battle challenges
  easy: '#22C55E',     // Green
  medium: '#EAB308',   // Yellow/Gold
  hard: '#EF4444',     // Red
  completed: '#00d9ff' // Cyan (brand color)
};

// Get today's date string for daily tracking
const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

// Check if user can accept a new challenge today
const canAcceptChallengeToday = (activeDailyChallenge) => {
  if (!activeDailyChallenge) return true;
  return activeDailyChallenge.acceptedDate !== getTodayDateString();
};

// Check if challenge is already completed this week
const isChallengeCompleted = (challengeId, completedChallenges) => {
  return completedChallenges.some(c => c.id === challengeId);
};

// Calculate time until weekly reset (next Monday)
const getTimeUntilReset = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  const diff = nextMonday - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return { days, hours, total: diff };
};

// Get difficulty color
const getDifficultyColor = (difficulty) => {
  return CHALLENGE_COLORS[difficulty] || '#ffffff';
};

// Get game mode badge color
const getGameModeColor = (gameMode) => {
  switch(gameMode) {
    case 'classic': return '#00d9ff'; // Cyan
    case 'snake': return '#A855F7';   // Purple
    case 'universal': return '#22C55E'; // Green
    default: return '#FB923C';         // Orange for wild card
  }
};

const WeeklyChallengesPanel = ({
  showWeeklyChallenges,
  setShowWeeklyChallenges,
  weeklyChallenges,
  activeDailyChallenge,
  challengeProgress,
  completedWeeklyChallenges,
  expandedChallengeId,
  setExpandedChallengeId,
  acceptChallenge,
  colors
}) => {
  return (
    <motion.div
      id="tour-weekly-challenges"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
      style={{
        marginBottom: '24px',
        background: colors.cardBg,
        borderRadius: '16px',
        border: `1px solid ${colors.border}`,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        onClick={() => setShowWeeklyChallenges(!showWeeklyChallenges)}
        style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), transparent)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🎯</span>
          <div>
            <h3 style={{
              color: '#fff',
              fontSize: '16px',
              fontWeight: '700',
              margin: 0
            }}>
              Weekly Challenges
            </h3>
            <p style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '12px',
              margin: 0
            }}>
              {completedWeeklyChallenges.length}/4 completed • Resets in {getTimeUntilReset().days}d {getTimeUntilReset().hours}h
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: showWeeklyChallenges ? 180 : 0 }}
          style={{ color: '#A855F7' }}
        >
          <ChevronDown size={20} />
        </motion.div>
      </div>

      {/* Expandable Challenge Cards */}
      {showWeeklyChallenges && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{ padding: '0 16px 16px' }}>
            {/* Active Challenge Indicator */}
            {activeDailyChallenge && (
              <div style={{
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid #A855F7',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Zap size={16} style={{ color: '#A855F7' }} />
                <span style={{ color: '#fff', fontSize: '13px' }}>
                  Active Today: <strong>{activeDailyChallenge.name}</strong>
                </span>
              </div>
            )}

            {/* Challenge Cards */}
            {weeklyChallenges.map((challenge, index) => {
              const isCompleted = isChallengeCompleted(challenge.id, completedWeeklyChallenges);
              const isActive = activeDailyChallenge?.id === challenge.id;
              const isExpanded = expandedChallengeId === challenge.id;
              const progress = challengeProgress[challenge.id] || 0;
              const progressPercent = Math.min((progress / challenge.target) * 100, 100);
              const canAccept = canAcceptChallengeToday(activeDailyChallenge) && !isCompleted;

              return (
                <motion.div
                  key={challenge.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  style={{
                    background: isCompleted
                      ? 'rgba(0, 217, 255, 0.1)'
                      : isActive
                        ? 'rgba(168, 85, 247, 0.15)'
                        : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${
                      isCompleted
                        ? '#00d9ff'
                        : isActive
                          ? '#A855F7'
                          : colors.borderSubtle
                    }`,
                    borderRadius: '12px',
                    marginBottom: '10px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Collapsed View */}
                  <div
                    onClick={() => setExpandedChallengeId(isExpanded ? null : challenge.id)}
                    style={{
                      padding: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: `${getGameModeColor(challenge.gameMode)}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      flexShrink: 0
                    }}>
                      {isCompleted ? '✅' : challenge.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{
                          color: isCompleted ? '#00d9ff' : '#fff',
                          fontWeight: '600',
                          fontSize: '14px'
                        }}>
                          {challenge.name}
                        </span>
                        <span style={{
                          background: getGameModeColor(challenge.gameMode),
                          color: '#000',
                          fontSize: '9px',
                          fontWeight: '700',
                          padding: '2px 5px',
                          borderRadius: '4px'
                        }}>
                          {challenge.slotLabel}
                        </span>
                      </div>

                      {/* Mini Progress Bar */}
                      {!isCompleted && (
                        <div style={{
                          height: '4px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            style={{
                              height: '100%',
                              background: isActive ? '#A855F7' : getDifficultyColor(challenge.difficulty),
                              borderRadius: '2px'
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* XP / Status */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {isCompleted ? (
                        <span style={{ color: '#00d9ff', fontSize: '12px', fontWeight: '600' }}>DONE</span>
                      ) : (
                        <span style={{
                          color: getDifficultyColor(challenge.difficulty),
                          fontSize: '13px',
                          fontWeight: '700'
                        }}>
                          +{challenge.xp}
                        </span>
                      )}
                    </div>

                    {/* Expand Arrow */}
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}
                    >
                      <ChevronDown size={16} />
                    </motion.div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{
                        padding: '0 14px 14px',
                        borderTop: `1px solid ${colors.borderSubtle}`
                      }}>
                        <p style={{
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: '13px',
                          margin: '12px 0',
                          lineHeight: '1.5'
                        }}>
                          {challenge.description}
                        </p>

                        {/* Progress Section */}
                        {!isCompleted && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '6px'
                            }}>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Progress</span>
                              <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }}>
                                {progress} / {challenge.target}
                              </span>
                            </div>
                            <div style={{
                              height: '8px',
                              background: 'rgba(255,255,255,0.1)',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.5 }}
                                style={{
                                  height: '100%',
                                  background: `linear-gradient(90deg, ${getDifficultyColor(challenge.difficulty)}, ${getDifficultyColor(challenge.difficulty)}aa)`,
                                  borderRadius: '4px'
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Difficulty Badge & Accept Button */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span style={{
                            background: getDifficultyColor(challenge.difficulty),
                            color: '#000',
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            textTransform: 'uppercase'
                          }}>
                            {challenge.difficulty} • {challenge.xp} XP
                          </span>

                          {!isCompleted && canAccept && !isActive && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                acceptChallenge(challenge);
                              }}
                              style={{
                                background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                                color: '#fff',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              ACCEPT
                            </motion.button>
                          )}

                          {isActive && !isCompleted && (
                            <span style={{ color: '#A855F7', fontSize: '12px', fontWeight: '600' }}>
                              <Zap size={14} style={{ marginRight: '4px' }} />ACTIVE
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}

            {/* Weekly Bonus Progress */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(168, 85, 247, 0.1)',
              borderRadius: '10px',
              border: '1px solid rgba(168, 85, 247, 0.3)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
                  <Trophy size={14} style={{ marginRight: '6px', color: '#A855F7' }} />
                  Weekly Bonus
                </span>
                <span style={{ color: '#A855F7', fontSize: '13px', fontWeight: '700' }}>
                  +{CHALLENGE_XP.weeklyBonus} XP
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      background: completedWeeklyChallenges.length > i
                        ? '#A855F7'
                        : 'rgba(255,255,255,0.1)'
                    }}
                  />
                ))}
              </div>
              <p style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '11px',
                margin: '8px 0 0',
                textAlign: 'center'
              }}>
                Complete all 4 challenges for bonus XP!
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default WeeklyChallengesPanel;
