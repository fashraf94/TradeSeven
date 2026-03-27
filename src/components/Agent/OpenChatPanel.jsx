import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Loader2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { addDirective, appendBattleLedger } from '../../services/agentService';
import { getAuth } from 'firebase/auth';
import { getLevelConfig } from '../../constants/agentProgression';

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function isMarketHoursClient() {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(now);
  const h = et.getHours();
  const m = et.getMinutes();
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = h * 60 + m;
  return mins >= 570 && mins < 960; // 9:30 AM - 4:00 PM
}

const OpenChatPanel = ({ battle, agentId, agent, tokens }) => {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [acceptedRules, setAcceptedRules] = useState({});
  const scrollRef = useRef(null);

  const chatExchanges = battle?.chatExchanges || [];
  const chatBudgetUsed = battle?.chatBudgetUsed || 0;
  const gamesPlayed = agent?.stats?.gamesPlayed || 0;
  const budget = getLevelConfig(gamesPlayed).chatBudget;
  const budgetExhausted = chatBudgetUsed >= budget;
  const duringMarket = isMarketHoursClient();
  const isActive = battle?.status === 'active';

  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatExchanges.length, expanded]);

  if (!isActive) return null;

  const handleSend = async () => {
    if (!message.trim() || sending || budgetExhausted || duringMarket) return;
    setSending(true);
    setError(null);

    try {
      const idToken = await getAuth().currentUser.getIdToken();
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, battleId: battle.id, message: message.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'market_hours') {
          setError('Strategy chat is available before and after market hours.');
        } else if (data.error === 'chat_budget_exceeded') {
          setError(data.message);
        } else {
          setError(data.message || 'Failed to send message. Try again.');
        }
        return;
      }

      setMessage('');
    } catch (err) {
      console.error('[Chat] Send failed:', err.message);
      setError('Failed to send message. Try again.');
    } finally {
      setSending(false);
    }
  };

  const handleAcceptRule = async (exchange, exchangeIndex) => {
    if (acceptedRules[exchangeIndex] || !agentId) return;
    const rule = exchange.extractedRule;
    try {
      await addDirective(agentId, { text: rule.text, source: 'open_chat' });
      await appendBattleLedger(battle.id, {
        type: 'rule_accepted',
        details: { ruleText: rule.text, source: 'open_chat' },
      });
      setAcceptedRules(prev => ({ ...prev, [exchangeIndex]: 'accepted' }));
    } catch (err) {
      console.error('[Chat] Accept rule failed:', err.message);
    }
  };

  const handleDismissRule = (exchangeIndex) => {
    setAcceptedRules(prev => ({ ...prev, [exchangeIndex]: 'dismissed' }));
  };

  const accentColor = '#3b82f6';

  return (
    <div style={{
      borderRadius: '14px',
      background: tokens.bgCard,
      border: `1px solid ${tokens.borderDefault}`,
      boxShadow: tokens.obsidianShadow,
      overflow: 'hidden',
    }}>
      {/* Header — click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={14} color={accentColor} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: tokens.textPrimary }}>
            Strategy Chat
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: tokens.textFaint }}>
            {chatBudgetUsed} of {budget} used
          </span>
          {expanded ? <ChevronUp size={14} color={tokens.textMuted} /> : <ChevronDown size={14} color={tokens.textMuted} />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 14px' }}>
              {/* Market hours message */}
              {duringMarket && (
                <div style={{
                  padding: '10px 12px', borderRadius: '10px', marginBottom: '10px',
                  background: hexToRgba('#f59e0b', 0.08), fontSize: '12px', color: '#f59e0b',
                  textAlign: 'center',
                }}>
                  Strategy chat is available before and after market hours.
                </div>
              )}

              {/* Chat history */}
              <div
                ref={scrollRef}
                style={{
                  maxHeight: '250px', overflowY: 'auto', marginBottom: '10px',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}
              >
                {chatExchanges.length === 0 && !duringMarket && (
                  <div style={{ padding: '16px', fontSize: '12px', color: tokens.textFaint, textAlign: 'center' }}>
                    Start a strategy conversation with your agent.
                  </div>
                )}
                {chatExchanges.map((exchange, i) => (
                  <div key={i}>
                    {/* User message */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                      <div style={{
                        maxWidth: '80%', padding: '8px 12px', borderRadius: '12px 12px 4px 12px',
                        background: hexToRgba(accentColor, 0.12), color: tokens.textPrimary,
                        fontSize: '12px', lineHeight: '1.4',
                      }}>
                        {exchange.userMessage}
                      </div>
                    </div>
                    {/* Agent message */}
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '4px' }}>
                      <div style={{
                        maxWidth: '80%', padding: '8px 12px', borderRadius: '12px 12px 12px 4px',
                        background: hexToRgba(tokens.teal, 0.08), color: tokens.textSecondary,
                        fontSize: '12px', lineHeight: '1.4',
                      }}>
                        {exchange.agentMessage}
                      </div>
                    </div>
                    {/* Extracted rule */}
                    {exchange.extractedRule && !acceptedRules[i] && (
                      <div style={{
                        margin: '4px 0 4px 0', padding: '8px 10px', borderRadius: '8px',
                        background: hexToRgba('#8b5cf6', 0.06), border: `1px solid ${hexToRgba('#8b5cf6', 0.15)}`,
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#8b5cf6', marginBottom: '4px' }}>
                          Proposed Rule
                        </div>
                        <div style={{ fontSize: '11px', color: tokens.textPrimary, marginBottom: '6px' }}>
                          "{exchange.extractedRule.text}"
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleAcceptRule(exchange, i)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '3px',
                              padding: '4px 10px', borderRadius: '6px', border: 'none',
                              background: hexToRgba('#10b981', 0.12), color: '#10b981',
                              fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <Check size={10} /> Accept
                          </button>
                          <button
                            onClick={() => handleDismissRule(i)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '3px',
                              padding: '4px 10px', borderRadius: '6px', border: 'none',
                              background: hexToRgba('#ef4444', 0.08), color: tokens.textFaint,
                              fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <X size={10} /> Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                    {acceptedRules[i] === 'accepted' && exchange.extractedRule && (
                      <div style={{ fontSize: '10px', color: '#10b981', marginBottom: '4px', paddingLeft: '4px' }}>
                        ✓ Rule added to Playbook
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '6px', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              {/* Budget exhausted */}
              {budgetExhausted && !duringMarket && (
                <div style={{
                  padding: '10px 12px', borderRadius: '10px', marginBottom: '10px',
                  background: hexToRgba(tokens.teal, 0.06), fontSize: '12px', color: tokens.textMuted,
                  textAlign: 'center',
                }}>
                  Your agent is processing today's insights. Strategy chat resumes next session.
                </div>
              )}

              {/* Input */}
              {!budgetExhausted && !duringMarket && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Type your message..."
                    maxLength={500}
                    disabled={sending}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: '10px',
                      border: `1px solid ${tokens.borderDefault}`, background: tokens.bgApp,
                      color: tokens.textPrimary, fontSize: '12px', fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSend}
                    disabled={!message.trim() || sending}
                    style={{
                      padding: '9px 14px', borderRadius: '10px', border: 'none',
                      background: message.trim() && !sending ? accentColor : hexToRgba(accentColor, 0.3),
                      color: '#fff', cursor: message.trim() && !sending ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', fontFamily: 'inherit',
                    }}
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OpenChatPanel;
