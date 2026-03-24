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
// Response Renderer — formats structured API responses
// ---------------------------------------------------------------------------

function parseResponse(response) {
  if (!response) return null;
  if (typeof response === 'object') return response;
  if (typeof response === 'string' && response.trimStart().startsWith('{')) {
    try { return JSON.parse(response); } catch { return null; }
  }
  return null;
}

const ContentParagraphs = ({ text }) => {
  if (!text) return null;
  const paragraphs = String(text).split(/\n\n+/);
  return paragraphs.map((p, i) => (
    <div key={i} style={{
      fontSize: '13px',
      color: 'rgba(255,255,255,0.85)',
      lineHeight: 1.6,
      marginBottom: i < paragraphs.length - 1 ? 8 : 0,
      whiteSpace: 'pre-wrap',
    }}>
      {p}
    </div>
  ));
};

const DataPointsSection = ({ dataPoints }) => {
  if (!Array.isArray(dataPoints) || dataPoints.length === 0) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{
        fontSize: '10px',
        letterSpacing: '1.2px',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)',
        marginBottom: '8px',
        fontWeight: 600,
      }}>
        Data Points
      </div>
      {dataPoints.map((dp, i) => (
        <div key={i} style={{
          padding: '8px 0',
          borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{dp.label}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#00d9ff', flexShrink: 0 }}>{dp.value}</span>
          </div>
          {dp.context && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: '3px' }}>
              {dp.context}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const CaseCard = ({ title, text, bgColor, borderColor, titleColor }) => {
  if (!text) return null;
  return (
    <div style={{
      background: bgColor,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: '6px',
      padding: '10px 12px',
    }}>
      <div style={{
        fontSize: '10px',
        letterSpacing: '1.2px',
        textTransform: 'uppercase',
        color: titleColor,
        fontWeight: 600,
        marginBottom: '4px',
      }}>
        {title}
      </div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    </div>
  );
};

const FormattedResponse = ({ response }) => {
  const parsed = parseResponse(response);

  // Plain string fallback
  if (!parsed) {
    return <ContentParagraphs text={String(response)} />;
  }

  // Structured object with at least content or headline
  const { headline, content, dataPoints, bullCase, bearCase, educationalNote } = parsed;

  // If parsed but has no known fields, render as plain text
  if (!headline && !content && !dataPoints && !bullCase && !bearCase && !educationalNote) {
    return <ContentParagraphs text={JSON.stringify(response, null, 2)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {headline && (
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
          {headline}
        </div>
      )}
      {content && <ContentParagraphs text={content} />}
      <DataPointsSection dataPoints={dataPoints} />
      <CaseCard title="Bull Case" text={bullCase} bgColor="rgba(0,255,136,0.06)" borderColor="#00ff88" titleColor="#00ff88" />
      <CaseCard title="Bear Case" text={bearCase} bgColor="rgba(255,71,87,0.06)" borderColor="#ff4757" titleColor="#ff4757" />
      <CaseCard title="Key Insight" text={educationalNote} bgColor="rgba(168,85,247,0.06)" borderColor="#a855f7" titleColor="#a855f7" />
    </div>
  );
};

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
                <FormattedResponse response={response} />
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
