import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, X, Send, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import useErrorCapture from './useErrorCapture';
import { useCooldown } from '../../hooks/useCooldown';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATES = {
  IDLE: 'IDLE',
  GREETING: 'GREETING',
  FOLLOW_UP: 'FOLLOW_UP',
  SUBMITTING: 'SUBMITTING',
  CONFIRMED: 'CONFIRMED',
};

const AUTO_COLLAPSE_MS = 5000;

// Screen keywords for detecting specificity in user descriptions
const SCREEN_KEYWORDS = [
  'dashboard', 'builder', 'battle', 'draft', 'bagger', 'bomb',
  'options', 'arena', 'earnings', 'research', 'technical', 'chart',
  'profile', 'settings', 'tutorial', 'money map', 'thesis', 'lobby',
];

// Contextual follow-up questions based on current screen
const SCREEN_FOLLOW_UPS = {
  battle: "Is this happening with a specific battle or all of them?",
  baggerBomb: "Is this happening with a specific battle or all of them?",
  baggerBombTraining: "Is this happening with a specific battle or all of them?",
  research: "Is this about the data loading or the AI analysis?",
  technicalResearch: "Is this about the data loading or the AI analysis?",
  draftSetup: "Is this during the draft setup or something else?",
  draftLobby: "Is this during the draft or after?",
  draftRoom: "Is this during the draft or after?",
  draftBattle: "Is this during the draft or after?",
  draftTraining: "Is this during the draft or after?",
};

const DEFAULT_FOLLOW_UP = "Which part of the app is this about?";

// =============================================================================
// STYLES (injected as <style> tag for CSS keyframes)
// =============================================================================

const KEYFRAMES_CSS = `
@keyframes clashbot-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(0,217,255,0.3); }
  50% { box-shadow: 0 0 16px rgba(0,217,255,0.5); }
}
@keyframes clashbot-dot {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
`;

// =============================================================================
// COMPONENT
// =============================================================================

export default function ClashBotWidget({
  user,
  screen,
  gameMode,
  currentBattle,
  colors,
  isDesktop,
}) {
  const isMobile = !isDesktop;

  // State machine
  const [phase, setPhase] = useState(STATES.IDLE);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [ticketNumber, setTicketNumber] = useState(null);
  const [submitError, setSubmitError] = useState(false);

  // Refs
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const autoCollapseTimer = useRef(null);
  const allUserMessages = useRef([]);

  // Error capture hook
  const { getRecentErrors, clearErrors } = useErrorCapture();

  // Cooldown to prevent rapid-fire submissions
  const { isOnCooldown, trigger: triggerCooldown, remainingSeconds } = useCooldown(30000);

  // ─── HELPERS ───────────────────────────────────────────────────

  const addBotMessage = useCallback((text) => {
    setMessages(prev => [...prev, { from: 'bot', text }]);
  }, []);

  const addUserMessage = useCallback((text) => {
    setMessages(prev => [...prev, { from: 'user', text }]);
    allUserMessages.current.push(text);
  }, []);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setInputValue('');
    setTicketNumber(null);
    setSubmitError(false);
    allUserMessages.current = [];
  }, []);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (phase === STATES.GREETING || phase === STATES.FOLLOW_UP) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [phase]);

  // Auto-collapse in CONFIRMED state
  useEffect(() => {
    if (phase === STATES.CONFIRMED) {
      autoCollapseTimer.current = setTimeout(() => {
        resetConversation();
        setPhase(STATES.IDLE);
      }, AUTO_COLLAPSE_MS);
    }
    return () => {
      if (autoCollapseTimer.current) {
        clearTimeout(autoCollapseTimer.current);
      }
    };
  }, [phase, resetConversation]);

  // ─── STATE TRANSITIONS ────────────────────────────────────────

  const handleOpen = () => {
    resetConversation();
    setPhase(STATES.GREETING);

    // Build greeting messages
    const recentErrors = getRecentErrors();
    setTimeout(() => {
      addBotMessage("Hey! Something not working right? Tell me what happened.");
      if (recentErrors.length > 0) {
        setTimeout(() => {
          addBotMessage("I noticed an error occurred recently — is that what you're reporting?");
        }, 400);
      }
    }, 200);
  };

  const handleClose = () => {
    resetConversation();
    setPhase(STATES.IDLE);
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;

    addUserMessage(text);
    setInputValue('');

    if (phase === STATES.GREETING) {
      handleGreetingResponse(text);
    } else if (phase === STATES.FOLLOW_UP) {
      // User answered follow-up, proceed to submit
      submitReport();
    }
  };

  const handleGreetingResponse = (text) => {
    // Too short — ask for more detail
    if (text.length < 15) {
      setPhase(STATES.FOLLOW_UP);
      setTimeout(() => {
        addBotMessage("Can you give me a bit more detail? What were you trying to do?");
      }, 300);
      return;
    }

    // Check if description mentions a specific screen/feature
    const mentionsScreen = SCREEN_KEYWORDS.some(kw =>
      text.toLowerCase().includes(kw)
    );

    if (mentionsScreen) {
      // Specific enough — submit directly
      submitReport();
      return;
    }

    // Show contextual follow-up based on current screen
    setPhase(STATES.FOLLOW_UP);
    const followUp = SCREEN_FOLLOW_UPS[screen] || DEFAULT_FOLLOW_UP;
    setTimeout(() => {
      addBotMessage(followUp);
    }, 300);
  };

  // ─── API SUBMISSION ───────────────────────────────────────────

  const submitReport = async () => {
    if (isOnCooldown) return;
    setPhase(STATES.SUBMITTING);
    setSubmitError(false);

    // Combine all user messages into a single description
    const userDescription = allUserMessages.current.join('\n');

    // Build metadata from props + browser context
    const metadata = {
      userId: user?.username || user?.uid || 'anonymous',
      screen: screen || 'unknown',
      gameMode: gameMode || null,
      battleId: currentBattle?.id || null,
      battleType: currentBattle?.gameMode || null,
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      isMobile,
      isDesktop,
      appVersion: 'beta',
      recentErrors: getRecentErrors(),
    };

    try {
      const data = await triggerCooldown(async () => {
        const response = await fetch('/api/bug-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userDescription, metadata }),
        });
        return response.json();
      });

      if (data && data.success && data.ticketNumber) {
        setTicketNumber(data.ticketNumber);
        setPhase(STATES.CONFIRMED);
        setTimeout(() => {
          addBotMessage(
            `Got it! Filed as ${data.ticketNumber}. The team will look into it. Thanks for helping make MarketClash better! 🎮`
          );
        }, 200);
      } else {
        throw new Error(data.error || 'Submission failed');
      }
    } catch (err) {
      console.error('[ClashBot] Submit error:', err.message);
      setSubmitError(true);
      setPhase(STATES.FOLLOW_UP);
      setTimeout(() => {
        addBotMessage("Hmm, I couldn't file that. Try again?");
      }, 200);
    }
  };

  const handleRetry = () => {
    submitReport();
  };

  const handleReportAnother = () => {
    resetConversation();
    setPhase(STATES.GREETING);
    setTimeout(() => {
      addBotMessage("Hey! Something not working right? Tell me what happened.");
    }, 200);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (submitError) {
        handleRetry();
      } else {
        handleSend();
      }
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────

  const isOpen = phase !== STATES.IDLE;

  return (
    <>
      {/* Inject CSS keyframes */}
      <style>{KEYFRAMES_CSS}</style>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 9998,
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating bug button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={handleOpen}
            style={{
              position: 'fixed',
              right: 16,
              bottom: isMobile ? 80 : 24,
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: colors.cardBg || '#0d1117',
              border: `2px solid ${colors.cyan || '#00d9ff'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 9999,
              animation: 'clashbot-pulse 2s ease-in-out infinite',
              outline: 'none',
              padding: 0,
            }}
            aria-label="Report a bug"
          >
            <Bug size={22} color={colors.cyan || '#00d9ff'} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              right: isMobile ? 16 : 16,
              bottom: isMobile ? 80 : 24,
              width: isMobile ? 'calc(100vw - 32px)' : 320,
              height: 420,
              backgroundColor: colors.cardBg || '#0d1117',
              border: `1px solid rgba(0, 217, 255, 0.3)`,
              borderRadius: 12,
              boxShadow: '0 0 20px rgba(0, 217, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 9999,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: `1px solid rgba(0, 217, 255, 0.15)`,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bug size={16} color={colors.cyan || '#00d9ff'} />
                <span style={{
                  color: colors.cyan || '#00d9ff',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.5px',
                }}>
                  ClashBot
                </span>
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  outline: 'none',
                }}
                aria-label="Close bug reporter"
              >
                <X size={18} color={colors.textSecondary || '#8b949e'} />
              </button>
            </div>

            {/* Chat area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              {messages.map((msg, i) => (
                <ChatBubble key={i} msg={msg} colors={colors} />
              ))}

              {/* Typing indicator during submission */}
              {phase === STATES.SUBMITTING && <TypingIndicator colors={colors} />}

              {/* Confirmed state buttons */}
              {phase === STATES.CONFIRMED && messages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.3 }}
                  style={{ display: 'flex', gap: 8, marginTop: 8 }}
                >
                  <ActionButton
                    onClick={handleReportAnother}
                    colors={colors}
                    variant="primary"
                  >
                    Report Another
                  </ActionButton>
                  <ActionButton
                    onClick={handleClose}
                    colors={colors}
                    variant="secondary"
                  >
                    Close
                  </ActionButton>
                </motion.div>
              )}

              {/* Retry button on error */}
              {submitError && phase === STATES.FOLLOW_UP && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ marginTop: 4 }}
                >
                  <ActionButton
                    onClick={handleRetry}
                    colors={colors}
                    variant="primary"
                  >
                    <AlertTriangle size={12} style={{ marginRight: 4 }} />
                    Try Again
                  </ActionButton>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input area — hidden during SUBMITTING and CONFIRMED */}
            {(phase === STATES.GREETING || phase === STATES.FOLLOW_UP) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderTop: `1px solid rgba(0, 217, 255, 0.15)`,
                flexShrink: 0,
              }}>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the issue..."
                  style={{
                    flex: 1,
                    backgroundColor: colors.cardInner || '#161b22',
                    color: colors.textPrimary || '#e6edf3',
                    border: `1px solid rgba(0, 217, 255, 0.15)`,
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isOnCooldown}
                  style={{
                    width: isOnCooldown ? 'auto' : 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: inputValue.trim() && !isOnCooldown
                      ? (colors.cyan || '#00d9ff')
                      : (colors.elevated || '#21262d'),
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: inputValue.trim() && !isOnCooldown ? 'pointer' : 'default',
                    transition: 'background-color 0.15s',
                    outline: 'none',
                    flexShrink: 0,
                    padding: isOnCooldown ? '0 8px' : 0,
                    fontSize: 11,
                    color: colors.textMuted || '#484f58',
                  }}
                  aria-label="Send message"
                >
                  {isOnCooldown ? `${remainingSeconds}s` : (
                    <Send
                      size={16}
                      color={inputValue.trim() ? '#000' : (colors.textMuted || '#6e7681')}
                    />
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ChatBubble({ msg, colors }) {
  const isBot = msg.from === 'bot';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        alignSelf: isBot ? 'flex-start' : 'flex-end',
        maxWidth: '85%',
      }}
    >
      <div style={{
        backgroundColor: isBot
          ? (colors.background || '#0d1117')
          : (colors.cardInner || '#161b22'),
        borderLeft: isBot ? `3px solid ${colors.cyan || '#00d9ff'}` : 'none',
        borderRadius: isBot ? '4px 10px 10px 4px' : '10px 4px 4px 10px',
        padding: '8px 12px',
        fontSize: 13,
        lineHeight: 1.5,
        color: colors.textPrimary || '#e6edf3',
        wordBreak: 'break-word',
      }}>
        {msg.text}
      </div>
    </motion.div>
  );
}

function TypingIndicator({ colors }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 12px',
        alignSelf: 'flex-start',
      }}
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: colors.cyan || '#00d9ff',
            display: 'inline-block',
            animation: `clashbot-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </motion.div>
  );
}

function ActionButton({ children, onClick, colors, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: isPrimary
          ? `1px solid ${colors.cyan || '#00d9ff'}`
          : `1px solid ${colors.borderSubtle || 'rgba(255,255,255,0.1)'}`,
        backgroundColor: isPrimary
          ? 'rgba(0, 217, 255, 0.1)'
          : 'transparent',
        color: isPrimary
          ? (colors.cyan || '#00d9ff')
          : (colors.textSecondary || '#8b949e'),
        display: 'flex',
        alignItems: 'center',
        outline: 'none',
        transition: 'background-color 0.15s',
      }}
    >
      {children}
    </button>
  );
}
