import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Swords, AlertTriangle, BarChart3, Newspaper } from 'lucide-react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

// ---------------------------------------------------------------------------
// Question Card Definitions
// ---------------------------------------------------------------------------

const QUESTIONS = [
  {
    id: 'company_overview',
    label: 'What does this company do?',
    Icon: Building2,
    prompt: 'Give a concise overview of {COMPANY} ({SYMBOL}). What do they do, what are their main business segments, and what is their competitive position?',
  },
  {
    id: 'competitors',
    label: 'Who are the competitors?',
    Icon: Swords,
    prompt: 'Who are the main competitors of {COMPANY} ({SYMBOL})? Compare their market position, strengths, and key differentiators.',
  },
  {
    id: 'risks',
    label: 'What are the key risks?',
    Icon: AlertTriangle,
    prompt: 'What are the most significant risks facing {COMPANY} ({SYMBOL}) right now? Include both company-specific and macro/sector risks.',
  },
  {
    id: 'earnings',
    label: 'Summarize latest earnings',
    Icon: BarChart3,
    prompt: 'Summarize the most recent earnings report for {COMPANY} ({SYMBOL}). Include revenue, EPS, guidance, and market reaction. How did it compare to expectations?',
  },
  {
    id: 'news_sentiment',
    label: 'Generate news sentiment',
    Icon: Newspaper,
    prompt: 'What is the current news sentiment around {COMPANY} ({SYMBOL})? Summarize the most important recent developments and their potential impact on the stock.',
  },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const shimmerKeyframes = `@keyframes qaShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;

const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
  backgroundSize: '200% 100%',
  animation: 'qaShimmer 1.5s infinite',
  borderRadius: '6px',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ShimmerSkeleton = () => (
  <div style={{ padding: '12px 16px' }}>
    <div style={{ height: '12px', width: '90%', marginBottom: '8px', ...shimmerStyle }} />
    <div style={{ height: '12px', width: '70%', marginBottom: '8px', ...shimmerStyle }} />
    <div style={{ height: '12px', width: '80%', ...shimmerStyle }} />
    <style>{shimmerKeyframes}</style>
  </div>
);

const ErrorState = ({ onRetry }) => (
  <div
    onClick={onRetry}
    style={{
      padding: '12px 16px',
      color: 'rgba(248, 81, 73, 0.8)',
      fontSize: '13px',
      cursor: 'pointer',
    }}
  >
    Couldn't load analysis. Tap to retry.
  </div>
);

// ---------------------------------------------------------------------------
// QuestionCard
// ---------------------------------------------------------------------------

const QuestionCard = ({ question, isActive, isLoading, response, error, onTap, onRetry, isCached }) => {
  const { Icon, label } = question;

  return (
    <div style={{
      background: isActive ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'background 0.2s',
    }}>
      {/* Header — tappable */}
      <button
        onClick={onTap}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '0 16px',
          height: '56px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Cached dot */}
        {isCached && (
          <span style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#00d9ff',
            flexShrink: 0,
          }} />
        )}

        {/* Icon */}
        <Icon
          size={20}
          style={{ color: 'rgba(255, 255, 255, 0.5)', flexShrink: 0 }}
        />

        {/* Label */}
        <span style={{
          flex: 1,
          fontSize: '14px',
          fontWeight: 500,
          color: '#ffffff',
        }}>
          {label}
        </span>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: isActive ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {'\u25B6'}
        </motion.span>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {isLoading && <ShimmerSkeleton />}
            {error && <ErrorState onRetry={onRetry} />}
            {response && !isLoading && !error && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(0, 217, 255, 0.03)',
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: 'rgba(255, 255, 255, 0.85)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {response}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// AnalysisQATab (Main Export)
// ---------------------------------------------------------------------------

const AnalysisQATab = ({ symbol, companyName }) => {
  const [activeCard, setActiveCard] = useState(null);
  const [loadingCard, setLoadingCard] = useState(null);
  const [responses, setResponses] = useState(() => new Map());
  const [errors, setErrors] = useState(() => new Set());

  const handleCardTap = useCallback(async (questionId) => {
    // Toggle off if already active
    if (activeCard === questionId) {
      setActiveCard(null);
      return;
    }

    setActiveCard(questionId);

    // Already cached — just expand
    if (responses.has(questionId)) return;

    // Clear previous error for this card
    setErrors(prev => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });

    setLoadingCard(questionId);

    try {
      const question = QUESTIONS.find(q => q.id === questionId);
      const filledPrompt = question.prompt
        .replace('{COMPANY}', companyName || symbol)
        .replace('{SYMBOL}', symbol);

      const res = await fetchWithAuth('/api/ai-advisor', {
        method: 'POST',
        body: JSON.stringify({
          advisorType: 'technical-analysis',
          prompt: filledPrompt,
          mode: 'deep',
          maxTokens: 1500,
        }),
      });

      const data = await res.json();

      if (data.response) {
        setResponses(prev => new Map(prev).set(questionId, data.response));
      } else {
        setErrors(prev => new Set(prev).add(questionId));
      }
    } catch (err) {
      console.error('Intelligence query failed:', err);
      setErrors(prev => new Set(prev).add(questionId));
    } finally {
      setLoadingCard(null);
    }
  }, [activeCard, responses, symbol, companyName]);

  const handleRetry = useCallback((questionId) => {
    setErrors(prev => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    handleCardTap(questionId);
  }, [handleCardTap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
      {QUESTIONS.map(q => (
        <QuestionCard
          key={q.id}
          question={q}
          isActive={activeCard === q.id}
          isLoading={loadingCard === q.id}
          response={responses.get(q.id)}
          error={errors.has(q.id)}
          isCached={responses.has(q.id)}
          onTap={() => handleCardTap(q.id)}
          onRetry={() => handleRetry(q.id)}
        />
      ))}
    </div>
  );
};

export default AnalysisQATab;
