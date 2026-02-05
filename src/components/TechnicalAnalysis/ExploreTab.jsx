// src/components/TechnicalAnalysis/ExploreTab.jsx
// Conversational Q&A tab for technical analysis exploration

import React from 'react';
import { motion } from 'framer-motion';
import { getExploreQuestions } from '../../services/technicalAnalysisAI';

const ExploreTab = ({ indicators, conversation, isLoading, onAskQuestion, onReset }) => {
  const questions = getExploreQuestions();

  return (
    <div>
      {/* Indicator Summary Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        marginBottom: '20px',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>RSI</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
            {typeof indicators?.rsi?.value === 'number' ? indicators.rsi.value.toFixed(0) : '--'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>MACD</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: indicators?.macd?.histogram > 0 ? '#00ff88' : '#ff4757' }}>
            {indicators?.macd?.histogram > 0 ? '+' : ''}{typeof indicators?.macd?.histogram === 'number' ? indicators.macd.histogram.toFixed(2) : '--'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>50 SMA</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
            {indicators?.sma50?.position || '--'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>ATR</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
            {indicators?.atr?.percent ? `${indicators.atr.percent.toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>

      {/* Conversation Display */}
      {conversation.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          {conversation.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: 'rgba(0, 255, 255, 0.05)',
                border: '1px solid rgba(0, 255, 255, 0.2)',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#00ffff', marginBottom: '8px', fontWeight: '600' }}>
                Q: {item.question}
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.6' }}>
                {item.answer}
              </div>

              {/* Follow-up Suggestions */}
              {item.followUps && item.followUps.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {item.followUps.map((followUp, j) => {
                    // Find the question ID that matches this follow-up
                    const matchingQ = questions.find(q =>
                      q.question.toLowerCase().includes(followUp.toLowerCase().slice(0, 20)) ||
                      followUp.toLowerCase().includes(q.shortLabel.toLowerCase())
                    );
                    return (
                      <button
                        key={j}
                        onClick={() => matchingQ && onAskQuestion(matchingQ.id)}
                        disabled={isLoading || !matchingQ}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: 'rgba(0, 255, 255, 0.1)',
                          border: '1px solid rgba(0, 255, 255, 0.3)',
                          borderRadius: '16px',
                          color: '#00ffff',
                          cursor: matchingQ ? 'pointer' : 'default',
                          opacity: matchingQ ? 1 : 0.5,
                        }}
                      >
                        {followUp}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ))}

          {/* Reset Button */}
          <button
            onClick={onReset}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              marginBottom: '16px',
            }}
          >
            Start Over
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'rgba(0, 255, 255, 0.05)',
          borderRadius: '12px',
          marginBottom: '16px',
        }}>
          <motion.div
            style={{
              width: '100px',
              height: '3px',
              backgroundColor: 'rgba(0, 255, 255, 0.2)',
              borderRadius: '2px',
              margin: '0 auto',
              overflow: 'hidden',
            }}
          >
            <motion.div
              style={{ height: '100%', backgroundColor: '#00ffff', borderRadius: '2px' }}
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
            />
          </motion.div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '12px 0 0' }}>
            Analyzing...
          </p>
        </div>
      )}

      {/* Question Buttons (2x3 grid) */}
      {!isLoading && (
        <>
          <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
            {conversation.length > 0 ? 'Ask Another Question' : 'Ask a Question'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => onAskQuestion(q.id)}
                style={{
                  padding: '14px 12px',
                  fontSize: '13px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 255, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                {q.question}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ExploreTab;
