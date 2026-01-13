// /src/components/Dashboard/TrainingModePanel.jsx
// Extracted from App.jsx - Training Mode Section with draft and classic variants

import { motion } from 'framer-motion';

const TrainingModePanel = ({
  gameMode,
  colors,
  setTrainingConfirmType,
  setShowTrainingConfirmModal,
  setShowClassicTrainingConfirm
}) => {
  return (
    <>
      {/* Training Mode Section - Different design for draft vs classic */}
      {gameMode === 'draft' ? (
        /* SNAKE DRAFT TRAINING SECTION - Redesigned with circular buttons */
        <motion.div
          id="tour-training-mode"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
            border: '2px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            padding: '20px',
            marginTop: '12px',
            marginBottom: '24px'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '6px'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '14px' }}>🎯</span>
            </div>
            <h3 style={{
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '700',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Training Mode
            </h3>
          </div>

          {/* Subheader */}
          <p style={{
            color: '#a78bfa',
            fontSize: '14px',
            fontWeight: '600',
            margin: '0 0 20px 0'
          }}>
            Start drafting now!
          </p>

          {/* CSS Animations for Training Buttons */}
          <style>{`
            @keyframes pulse-glow {
              0%, 100% { opacity: 0.5; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.08); }
            }
            @keyframes pulse-ring {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.12); opacity: 0.2; }
            }
            @keyframes rotate-arc {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>

          {/* Circular Buttons Container */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '40px'
          }}>
            {/* Stocks Training Button - Polished */}
            <button
              onClick={() => {
                setTrainingConfirmType('stocks');
                setShowTrainingConfirmModal(true);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                padding: '8px',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                {/* Outer glow */}
                <div style={{
                  position: 'absolute',
                  inset: '-12px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
                  animation: 'pulse-glow 2s ease-in-out infinite'
                }} />
                {/* Pulsing ring */}
                <div style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '50%',
                  border: '2px solid #22c55e',
                  animation: 'pulse-ring 2s ease-in-out infinite'
                }} />
                {/* Main circle with gradient */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 24px rgba(34, 197, 94, 0.5), inset 0 2px 10px rgba(255,255,255,0.2)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Shine overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)',
                    borderRadius: '50% 50% 0 0'
                  }} />
                  {/* Trending Up Chart SVG Icon */}
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                    <path
                      d="M3 17L9 11L13 15L21 7"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M15 7H21V13"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                {/* Rotating arc */}
                <svg style={{
                  position: 'absolute',
                  top: '-6px',
                  left: '-6px',
                  width: '102px',
                  height: '102px',
                  animation: 'rotate-arc 4s linear infinite',
                  pointerEvents: 'none'
                }}>
                  <circle
                    cx="51"
                    cy="51"
                    r="47"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeDasharray="50 250"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                </svg>
              </div>
              <span style={{
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '800',
                letterSpacing: '1px',
                textShadow: '0 0 12px rgba(34, 197, 94, 0.6)'
              }}>
                STOCKS
              </span>
              <span style={{ color: '#8b949e', fontSize: '12px' }}>~5 min</span>
            </button>

            {/* Crypto Training Button - Polished */}
            <button
              onClick={() => {
                setTrainingConfirmType('crypto');
                setShowTrainingConfirmModal(true);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                padding: '8px',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                {/* Outer glow */}
                <div style={{
                  position: 'absolute',
                  inset: '-12px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)',
                  animation: 'pulse-glow 2s ease-in-out infinite'
                }} />
                {/* Pulsing ring */}
                <div style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '50%',
                  border: '2px solid #f59e0b',
                  animation: 'pulse-ring 2s ease-in-out infinite'
                }} />
                {/* Main circle with gradient */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 24px rgba(245, 158, 11, 0.5), inset 0 2px 10px rgba(255,255,255,0.2)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Shine overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)',
                    borderRadius: '50% 50% 0 0'
                  }} />
                  {/* Bitcoin SVG Icon */}
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                    <path
                      d="M9.5 6.5V5M9.5 19V17.5M14.5 6.5V5M14.5 19V17.5"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 6.5H14C15.6569 6.5 17 7.84315 17 9.5C17 11.1569 15.6569 12.5 14 12.5H8V6.5Z"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <path
                      d="M8 12.5H15C16.6569 12.5 18 13.8431 18 15.5C18 17.1569 16.6569 18.5 15 18.5H8V12.5Z"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <path
                      d="M8 6.5V18.5"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                {/* Rotating arc */}
                <svg style={{
                  position: 'absolute',
                  top: '-6px',
                  left: '-6px',
                  width: '102px',
                  height: '102px',
                  animation: 'rotate-arc 4s linear infinite',
                  pointerEvents: 'none'
                }}>
                  <circle
                    cx="51"
                    cy="51"
                    r="47"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="50 250"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                </svg>
              </div>
              <span style={{
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '800',
                letterSpacing: '1px',
                textShadow: '0 0 12px rgba(245, 158, 11, 0.6)'
              }}>
                CRYPTO
              </span>
              <span style={{ color: '#8b949e', fontSize: '12px' }}>~5 min</span>
            </button>
          </div>

          {/* Helper Text */}
          <p style={{
            color: '#8b949e',
            fontSize: '11px',
            textAlign: 'center',
            margin: '16px 0 0 0'
          }}>
            Practice against CPU opponents - No pressure, just learning
          </p>
        </motion.div>
      ) : (
        /* Classic Mode Training Section - Unified style matching Snake Draft
           NOTE: Same ID as Snake Draft version - only one renders at a time (mutually exclusive)
           so DOM won't have duplicates. Spotlight Tour targets this ID. */
        <motion.div
          id="tour-training-mode"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
            border: '2px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            padding: '20px',
            marginTop: '12px',
            marginBottom: '24px'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '6px'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '14px' }}>🎯</span>
            </div>
            <h3 style={{
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '700',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Training Mode
            </h3>
          </div>

          {/* Subheader */}
          <p style={{
            color: '#a78bfa',
            fontSize: '14px',
            fontWeight: '600',
            margin: '0 0 20px 0'
          }}>
            Practice against CPU opponent!
          </p>

          {/* CSS Animations for Classic Training Button */}
          <style>{`
            @keyframes classic-pulse-glow {
              0%, 100% { opacity: 0.5; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.08); }
            }
            @keyframes classic-pulse-ring {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.12); opacity: 0.2; }
            }
            @keyframes classic-rotate-arc {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>

          {/* Single Training Button - Centered */}
          <div style={{
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => {
                setShowClassicTrainingConfirm(true);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                padding: '8px',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                {/* Outer glow */}
                <div style={{
                  position: 'absolute',
                  inset: '-12px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
                  animation: 'classic-pulse-glow 2s ease-in-out infinite'
                }} />
                {/* Pulsing ring */}
                <div style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '50%',
                  border: '2px solid #8b5cf6',
                  animation: 'classic-pulse-ring 2s ease-in-out infinite'
                }} />
                {/* Main circle with gradient */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 24px rgba(139, 92, 246, 0.5), inset 0 2px 10px rgba(255,255,255,0.2)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Shine overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)',
                    borderRadius: '50% 50% 0 0'
                  }} />
                  {/* Brain/Target Icon */}
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                    <circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="12" cy="12" r="6" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="12" cy="12" r="2" fill="#ffffff" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                {/* Rotating arc */}
                <svg style={{
                  position: 'absolute',
                  top: '-6px',
                  left: '-6px',
                  width: '102px',
                  height: '102px',
                  animation: 'classic-rotate-arc 4s linear infinite',
                  pointerEvents: 'none'
                }}>
                  <circle
                    cx="51"
                    cy="51"
                    r="47"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeDasharray="50 250"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                </svg>
              </div>
              <span style={{
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '800',
                letterSpacing: '1px',
                textShadow: '0 0 12px rgba(139, 92, 246, 0.6)'
              }}>
                START TRAINING
              </span>
              <span style={{ color: '#8b949e', fontSize: '12px' }}>~5 min • Stocks & Crypto</span>
            </button>
          </div>

          {/* Helper Text */}
          <p style={{
            color: '#8b949e',
            fontSize: '11px',
            textAlign: 'center',
            margin: '16px 0 0 0'
          }}>
            Practice against CPU opponent - No pressure, just learning
          </p>
        </motion.div>
      )}
    </>
  );
};

export default TrainingModePanel;
