// src/components/ResearchAdvisor.jsx
// AI-powered research assistant for MarketClash

import React, { useState, useRef, useEffect } from 'react';

const QUICK_ACTIONS = [
  { id: 'whats-hot', label: "What's Hot", icon: '🔥' },
  { id: 'sectors', label: 'Sectors', icon: '📊' },
  { id: 'risk-check', label: 'Risk Check', icon: '⚠️' },
  { id: 'game-plan', label: 'Game Plan', icon: '🎯' },
];

// Follow-up buttons based on the last topic
const FOLLOW_UP_OPTIONS = {
  'whats-hot': [
    { label: '🔥 Top 5 Stock Movers', prompt: 'Show me the top 5 stocks by momentum with analysis' },
    { label: '₿ Top 5 Crypto Movers', prompt: 'Show me the top 5 crypto by momentum with analysis' },
    { label: '⚔️ Battle-Ready Picks', prompt: 'Which assets are best for a 24-hour battle right now?' },
    { label: '📉 Avoid These', prompt: 'Which assets should I avoid for battles today and why?' },
  ],
  'sectors': [
    { label: '📈 Best in Top Sector', prompt: 'What are the best individual stocks in the leading sector?' },
    { label: '🔄 Sector Rotation Play', prompt: 'Is there a sector rotation happening? How can I profit?' },
    { label: '₿ Crypto Categories', prompt: 'Break down crypto by category: DeFi, L1s, Memecoins - which is hottest?' },
    { label: '⚡ Momentum Leaders', prompt: 'Which 3 stocks have the strongest momentum right now?' },
  ],
  'risk-check': [
    { label: '⚖️ Balance Portfolio', prompt: 'How should I balance risk while keeping upside potential?' },
    { label: '🛡️ Safer Alternatives', prompt: 'Suggest lower-volatility alternatives that still have momentum' },
    { label: '🎲 High Risk/Reward', prompt: 'I want to be aggressive - what are the highest upside plays?' },
    { label: '📊 Correlation Check', prompt: 'Which assets are least correlated for better diversification?' },
  ],
  'game-plan': [
    { label: '🏆 Final Portfolio', prompt: 'Based on my notes, give me a final 7-asset battle portfolio' },
    { label: '➕ What Am I Missing?', prompt: 'What sectors or assets are missing from my research?' },
    { label: '⚡ Quick Picks to Add', prompt: 'Suggest 3 assets I should research next' },
    { label: '🆚 Compare Top 2', prompt: 'Compare my top 2 most-researched assets head-to-head' },
  ],
  'general': [
    { label: '🔥 What\'s Hot Now', prompt: 'What are the top momentum plays right now in stocks and crypto?' },
    { label: '📊 Sector Analysis', prompt: 'Give me a momentum breakdown of stock sectors' },
    { label: '₿ Crypto Breakdown', prompt: 'Break down crypto momentum by category' },
    { label: '🎯 Build Portfolio', prompt: 'Help me build a balanced 8-asset battle portfolio' },
  ],
};

// Get follow-up buttons based on topic
const getFollowUpButtons = (topic) => {
  return FOLLOW_UP_OPTIONS[topic] || FOLLOW_UP_OPTIONS['general'];
};

// Follow-up buttons component
const FollowUpButtons = ({ topic, onSelectPrompt, isLoading }) => {
  const buttons = getFollowUpButtons(topic);

  return (
    <div style={{
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid #21262d',
    }}>
      <div style={{
        fontSize: '11px',
        color: '#8b949e',
        marginBottom: '8px',
        fontWeight: '600',
      }}>
        💬 Dig Deeper:
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
      }}>
        {buttons.map((btn, index) => (
          <button
            key={index}
            onClick={() => onSelectPrompt(btn.prompt)}
            disabled={isLoading}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              color: '#e6edf3',
              padding: '6px 10px',
              borderRadius: '16px',
              fontSize: '11px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isLoading ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.background = '#30363d';
                e.target.style.borderColor = '#00d9ff';
                e.target.style.color = '#00d9ff';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#21262d';
              e.target.style.borderColor = '#30363d';
              e.target.style.color = '#e6edf3';
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Parse AI response into sections for pinning
const parseResponseIntoSections = (responseText) => {
  if (!responseText) return [];

  const sections = [];
  const lines = responseText.split('\n');
  let currentSection = { header: '', content: [] };

  lines.forEach(line => {
    // Check if line is a header (bold markdown, numbered headers, or starts with emoji)
    const isHeader = /^\*\*[^*]+\*\*:?$/.test(line.trim()) ||
                     /^#+\s/.test(line.trim()) ||
                     /^\d+\.\s+\*\*[^*]+\*\*/.test(line.trim()) ||
                     /^[A-Z][^:]{2,30}:$/.test(line.trim());

    if (isHeader && currentSection.content.length > 0) {
      // Save previous section
      sections.push({
        id: `section-${sections.length}`,
        header: currentSection.header,
        content: currentSection.content.join('\n').trim(),
      });
      currentSection = { header: line.trim(), content: [] };
    } else if (isHeader) {
      currentSection.header = line.trim();
    } else if (line.trim()) {
      currentSection.content.push(line);
    }
  });

  // Don't forget the last section
  if (currentSection.content.length > 0 || currentSection.header) {
    sections.push({
      id: `section-${sections.length}`,
      header: currentSection.header,
      content: currentSection.content.join('\n').trim(),
    });
  }

  // If no sections found, return the whole response as one section
  if (sections.length === 0 && responseText.trim()) {
    sections.push({
      id: 'section-0',
      header: '',
      content: responseText.trim(),
    });
  }

  return sections;
};

// Toast notification
const showToast = (message) => {
  const existingToast = document.querySelector('.ai-toast-notification');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'ai-toast-notification';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: #00d9ff;
    color: #000;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    z-index: 9999;
    animation: slideUp 0.3s ease;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
};

// AI Response with pinnable sections
const AIResponse = ({ content, onPinSection, colors }) => {
  const [sections, setSections] = useState([]);
  const [pinnedIds, setPinnedIds] = useState(new Set());

  useEffect(() => {
    const parsed = parseResponseIntoSections(content);
    setSections(parsed);
    setPinnedIds(new Set());
  }, [content]);

  const handlePin = (section) => {
    const noteContent = section.header
      ? `${section.header}\n${section.content}`
      : section.content;

    onPinSection({
      content: noteContent,
      source: 'Research Advisor',
      timestamp: new Date().toISOString(),
      type: 'ai_insight',
    });

    setPinnedIds(prev => new Set([...prev, section.id]));
    showToast('Saved to Notes ✓');
  };

  // If only one section with no header, render as simple message
  if (sections.length === 1 && !sections[0].header) {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
        <button
          onClick={() => handlePin(sections[0])}
          disabled={pinnedIds.has(sections[0].id)}
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: pinnedIds.has(sections[0].id) ? 'rgba(0, 217, 255, 0.2)' : '#21262d',
            border: pinnedIds.has(sections[0].id) ? '1px solid #00d9ff' : '1px solid #30363d',
            color: pinnedIds.has(sections[0].id) ? '#00d9ff' : '#8b949e',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: pinnedIds.has(sections[0].id) ? 'default' : 'pointer',
          }}
        >
          {pinnedIds.has(sections[0].id) ? '✓' : '📌'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {sections.map(section => (
        <div
          key={section.id}
          style={{
            background: '#0d1117',
            border: '1px solid #21262d',
            borderRadius: '8px',
            padding: '10px 12px',
            position: 'relative',
          }}
        >
          {section.header && (
            <div style={{
              fontWeight: '600',
              color: colors?.cyan || '#00d9ff',
              marginBottom: '6px',
              fontSize: '13px',
            }}>
              {section.header.replace(/\*\*/g, '')}
            </div>
          )}
          <div style={{
            color: '#e6edf3',
            fontSize: '13px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
          }}>
            {section.content}
          </div>
          <button
            onClick={() => handlePin(section)}
            disabled={pinnedIds.has(section.id)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: pinnedIds.has(section.id) ? 'rgba(0, 217, 255, 0.2)' : '#21262d',
              border: pinnedIds.has(section.id) ? '1px solid #00d9ff' : '1px solid #30363d',
              color: pinnedIds.has(section.id) ? '#00d9ff' : '#8b949e',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: pinnedIds.has(section.id) ? 'default' : 'pointer',
              opacity: 0.8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { if (!pinnedIds.has(section.id)) e.target.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.target.style.opacity = '0.8'; }}
          >
            {pinnedIds.has(section.id) ? '✓ Saved' : '📌 Save'}
          </button>
        </div>
      ))}
    </div>
  );
};

export default function ResearchAdvisor({
  portfolio = [],
  weekAheadEvents = [],
  userNotes = [],
  stocksData = [],
  cryptoData = [],
  onPinNote,
  colors
}) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastTopic, setLastTopic] = useState('general');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText, action = null) => {
    if (!messageText && !action) return;

    const actionLabel = QUICK_ACTIONS.find(a => a.id === action)?.label;
    const userMessage = messageText || `[${actionLabel}]`;

    // Track topic for follow-up buttons
    if (action) {
      setLastTopic(action);
    }

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      // Build market data for context
      const marketData = {
        stocks: stocksData.map(s => ({
          symbol: s.symbol,
          name: s.name,
          sector: s.sector,
          price: s.price,
          change24h: s.change24h || s.changePercent || s.dailyChange,
        })),
        crypto: cryptoData.map(c => ({
          symbol: c.symbol,
          name: c.name,
          price: c.price,
          change24h: c.change24h || c.changePercent || c.dailyChange,
        })),
      };

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
            userNotes: action === 'game-plan' ? userNotes : undefined,
            marketData: marketData,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Handle empty state for game-plan
      if (data.emptyState) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.emptyStateMessage,
          isEmptyState: true
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      }
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

  const handleFollowUp = (prompt) => {
    // Send follow-up prompt (keeps same topic context)
    sendMessage(prompt);
  };

  const handlePinSection = (noteData) => {
    if (onPinNote) {
      onPinNote(noteData);
    }
  };

  // Check if should show follow-up buttons (after last assistant message, not loading)
  const lastMessage = messages[messages.length - 1];
  const showFollowUps = !isLoading && lastMessage?.role === 'assistant' && !lastMessage?.isEmptyState;

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
              padding: '8px 12px',
              borderRadius: '20px',
              border: '1px solid #30363d',
              background: '#0d1117',
              color: '#e6edf3',
              fontSize: '12px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
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
              maxWidth: msg.role === 'user' ? '85%' : '100%',
              width: msg.role === 'assistant' ? '100%' : 'auto',
            }}
          >
            {msg.role === 'user' ? (
              <div style={{
                padding: '12px 16px',
                borderRadius: '16px 16px 4px 16px',
                background: colors?.cyan || '#00d9ff',
                color: '#000',
                fontSize: '14px',
                lineHeight: '1.5',
              }}>
                {msg.content}
              </div>
            ) : msg.isEmptyState ? (
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: '#21262d',
                color: '#e6edf3',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              }}>
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>📝</div>
                {msg.content}
              </div>
            ) : (
              <AIResponse
                content={msg.content}
                onPinSection={handlePinSection}
                colors={colors}
              />
            )}
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

        {/* Follow-up buttons after last AI response */}
        {showFollowUps && (
          <FollowUpButtons
            topic={lastTopic}
            onSelectPrompt={handleFollowUp}
            isLoading={isLoading}
          />
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
