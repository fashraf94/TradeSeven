// src/components/ResearchAdvisor.jsx
// AI-powered research assistant for MarketClash

import React, { useState, useRef, useEffect } from 'react';

const QUICK_ACTIONS = [
  { id: 'whats-hot', label: "What's Hot", icon: '🔥' },
  { id: 'sectors', label: 'Sectors', icon: '📊' },
  { id: 'risk-check', label: 'Risk Check', icon: '⚠️' },
];

export default function ResearchAdvisor({ portfolio = [], weekAheadEvents = [], colors }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText, action = null) => {
    if (!messageText && !action) return;

    const userMessage = messageText || `[${QUICK_ACTIONS.find(a => a.id === action)?.label}]`;

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisorType: 'research',
          message: messageText,
          action: action,
          context: {
            portfolio: portfolio.map(p => p.symbol || p.name),
            weekAheadEvents: weekAheadEvents.slice(0, 5),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (err) {
      console.error('[ResearchAdvisor] Error:', err);
      setError('Failed to get AI response. Please try again.');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (actionId) => {
    sendMessage(null, actionId);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(inputValue.trim());
    }
  };

  return (
    <div style={{
      background: '#161b22',
      borderRadius: '16px',
      border: '1px solid #21262d',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '500px'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ fontSize: '20px' }}>🤖</span>
        <div>
          <h3 style={{ margin: 0, color: '#ffffff', fontSize: '16px', fontWeight: '700' }}>
            Research Advisor
          </h3>
          <p style={{ margin: 0, color: '#8b949e', fontSize: '12px' }}>
            AI-powered market insights
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => handleQuickAction(action.id)}
            disabled={isLoading}
            style={{
              padding: '8px 14px',
              borderRadius: '20px',
              border: '1px solid #30363d',
              background: '#0d1117',
              color: '#e6edf3',
              fontSize: '13px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isLoading ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            <span>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#6e7681',
            padding: '40px 20px'
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
              Ask me anything about the market
            </p>
            <p style={{ margin: 0, fontSize: '12px' }}>
              Or try a quick action above
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? colors?.cyan || '#00d9ff' : '#21262d',
              color: msg.role === 'user' ? '#000' : '#e6edf3',
              fontSize: '14px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}
          >
            {msg.content}
          </div>
        ))}

        {isLoading && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '12px 16px',
            borderRadius: '16px 16px 16px 4px',
            background: '#21262d',
            color: '#8b949e',
            fontSize: '14px'
          }}>
            <span style={{ animation: 'pulse 1.5s infinite' }}>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        padding: '12px 16px',
        borderTop: '1px solid #21262d',
        display: 'flex',
        gap: '8px'
      }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about markets, sectors, risks..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '24px',
            border: '1px solid #30363d',
            background: '#0d1117',
            color: '#e6edf3',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          style={{
            padding: '12px 20px',
            borderRadius: '24px',
            border: 'none',
            background: colors?.cyan || '#00d9ff',
            color: '#000',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !inputValue.trim() ? 0.5 : 1
          }}
        >
          Send
        </button>
      </form>

      {error && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(248, 81, 73, 0.1)',
          color: '#f85149',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
