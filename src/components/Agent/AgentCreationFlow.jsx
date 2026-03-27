import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ArrowLeft, Sparkles } from 'lucide-react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import useAgent from '../../hooks/useAgent';

// ── Question data ─────────────────────────────────────────

const QUESTIONS = [
  {
    key: 'q1',
    question: "The market just dropped 3%. What's your gut reaction?",
    type: 'single',
    options: [
      { value: 'buy_dip', label: "Buy the dip — this is a sale" },
      { value: 'wait', label: "Wait and see what happens first" },
      { value: 'defensive', label: "Get defensive — protect what I have" },
      { value: 'depends', label: "Depends on WHY it dropped" },
    ],
  },
  {
    key: 'q2',
    question: "Your agent just lost a game badly. What should it learn?",
    type: 'single',
    options: [
      { value: 'analyze', label: "Figure out what went wrong and don't repeat it" },
      { value: 'shake_off', label: "Shake it off — variance happens" },
      { value: 'careful', label: "Be more careful next time" },
      { value: 'show_data', label: "Show me the data — I'll decide what to change" },
    ],
  },
  {
    key: 'q3',
    question: "Pick the sectors you want your agent to focus on",
    type: 'multi',
    options: [
      { value: 'tech', label: 'Tech' },
      { value: 'energy', label: 'Energy' },
      { value: 'healthcare', label: 'Healthcare' },
      { value: 'finance', label: 'Finance' },
      { value: 'consumer', label: 'Consumer' },
      { value: 'industrial', label: 'Industrial' },
      { value: 'agent_decides', label: 'Let the agent decide' },
    ],
  },
  {
    key: 'q4',
    question: "How should your agent approach risk?",
    type: 'single',
    options: [
      { value: 'aggressive', label: "Swing for the fences — I want big wins" },
      { value: 'balanced', label: "Balanced — some safe picks, some bold ones" },
      { value: 'conservative', label: "Steady and consistent — protect the downside" },
      { value: 'contrarian', label: "Go against the crowd — contrarian plays" },
    ],
  },
  {
    key: 'name',
    question: "What should we call your agent?",
    type: 'text',
    maxLength: 20,
  },
];

const PLACEHOLDER_NAMES = ['Viper', 'Apex', 'Shadow', 'Bolt', 'Cipher'];

// ── Animations ────────────────────────────────────────────

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -200 : 200, opacity: 0 }),
};

const slideTransition = { type: 'spring', stiffness: 300, damping: 28 };

// ── Sub-components ────────────────────────────────────────

const ProgressDots = ({ current, total, tokens }) => (
  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '28px' }}>
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        style={{
          width: i === current ? '24px' : '8px',
          height: '8px',
          borderRadius: '4px',
          background: i === current ? tokens.teal : 'rgba(255,255,255,0.15)',
          transition: 'all 0.3s ease',
        }}
      />
    ))}
  </div>
);

const OptionCard = ({ label, selected, onClick, tokens }) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    style={{
      width: '100%',
      padding: '14px 16px',
      borderRadius: '12px',
      background: selected ? 'rgba(94,234,212,0.08)' : tokens.bgCard,
      border: `1px solid ${selected ? tokens.teal : tokens.borderDefault}`,
      boxShadow: selected ? `0 0 12px rgba(94,234,212,0.15)` : tokens.obsidianShadow,
      color: selected ? tokens.teal : tokens.textPrimary,
      fontSize: '14px',
      fontWeight: selected ? '600' : '500',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'border-color 0.2s, background 0.2s',
    }}
  >
    {label}
  </motion.button>
);

const ConfigBar = ({ label, value, color, tokens }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <div style={{ width: '80px', fontSize: '12px', color: tokens.textMuted, fontWeight: '500' }}>
      {label}
    </div>
    <div style={{
      flex: 1, height: '6px', borderRadius: '3px',
      background: 'rgba(255,255,255,0.06)',
    }}>
      <div style={{
        width: `${value}%`, height: '100%', borderRadius: '3px',
        background: color,
        transition: 'width 0.6s ease',
      }} />
    </div>
    <div style={{ width: '28px', fontSize: '12px', color: tokens.textMuted, textAlign: 'right' }}>
      {value}
    </div>
  </div>
);

const TraitPill = ({ trait, tokens }) => (
  <span style={{
    padding: '4px 10px',
    borderRadius: '12px',
    background: 'rgba(94,234,212,0.1)',
    border: '1px solid rgba(94,234,212,0.2)',
    color: tokens.teal,
    fontSize: '12px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  }}>
    {trait}
  </span>
);

// ── Main Component ────────────────────────────────────────

const AgentCreationFlow = ({ user, tokens, isDesktop, isMobile, onComplete }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ q1: null, q2: null, q3: [], q4: null, name: '' });
  const [freeform, setFreeform] = useState({ q1: '', q2: '', q3: '', q4: '' });
  const [derivedProfile, setDerivedProfile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [direction, setDirection] = useState(1);
  const [typedName, setTypedName] = useState('');
  const [placeholderIndex] = useState(() => Math.floor(Math.random() * PLACEHOLDER_NAMES.length));

  const { createAgent } = useAgent(user?.odUserId);

  // Typing animation for the loading screen
  useEffect(() => {
    if (step !== 6) return;
    const name = answers.name || 'Agent';
    let i = 0;
    setTypedName('');
    const interval = setInterval(() => {
      i++;
      setTypedName(name.slice(0, i));
      if (i >= name.length) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [step, answers.name]);

  // Trigger Haiku call when entering step 6
  useEffect(() => {
    if (step === 6) {
      deriveProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const deriveProfile = async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await fetchWithAuth('/api/agent/create-profile', {
        method: 'POST',
        body: JSON.stringify({
          q1: freeform.q1 || answers.q1,
          q2: freeform.q2 || answers.q2,
          q3: answers.q3,
          q4: freeform.q4 || answers.q4,
          name: answers.name || 'Agent',
        }),
      });
      const data = await response.json();
      if (data.success && data.profile) {
        setDerivedProfile(data.profile);
        setStep(7);
      } else {
        setError('Failed to create profile. Try again.');
        setStep(5);
      }
    } catch (err) {
      console.error('[AgentCreation] Profile derivation error:', err);
      setError('Something went wrong. Try again.');
      setStep(5);
    }
    setCreating(false);
  };

  const handleFinalize = async () => {
    if (!derivedProfile || !user?.odUserId) return;
    setCreating(true);
    setError(null);
    try {
      const agentId = await createAgent({
        name: answers.name || 'Agent',
        archetype: derivedProfile.archetype,
        config: derivedProfile.config,
        personality: {
          ...derivedProfile.personality,
          creationAnswers: {
            q1: freeform.q1 || answers.q1,
            q2: freeform.q2 || answers.q2,
            q3: answers.q3,
            q4: freeform.q4 || answers.q4,
          },
        },
        avatarColors: derivedProfile.avatarColors,
      });
      if (agentId) {
        onComplete(agentId);
      } else {
        setError('Failed to create agent.');
      }
    } catch (err) {
      console.error('[AgentCreation] Finalize error:', err);
      setError('Failed to create agent.');
    }
    setCreating(false);
  };

  const goNext = () => {
    setDirection(1);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const handleSelect = (key, value, type) => {
    if (type === 'multi') {
      setAnswers((prev) => {
        const current = prev[key] || [];
        if (value === 'agent_decides') {
          return { ...prev, [key]: current.includes('agent_decides') ? [] : ['agent_decides'] };
        }
        const filtered = current.filter((v) => v !== 'agent_decides');
        return {
          ...prev,
          [key]: filtered.includes(value) ? filtered.filter((v) => v !== value) : [...filtered, value],
        };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [key]: value }));
    }
  };

  const isStepValid = () => {
    if (step === 0) return true;
    if (step >= 1 && step <= 4) {
      const q = QUESTIONS[step - 1];
      if (q.type === 'multi') return answers[q.key]?.length > 0;
      if (q.type === 'single') return !!answers[q.key] || !!freeform[q.key]?.trim();
      return true;
    }
    if (step === 5) return !!(answers.name?.trim());
    return true;
  };

  // ── Render steps ──────────────────────────────────────

  const renderWelcome = () => (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: '20px',
        padding: '40px 20px', textAlign: 'center',
      }}
    >
      <div style={{
        width: '80px', height: '80px', borderRadius: '50%',
        background: `linear-gradient(135deg, ${tokens.teal}, ${tokens.purple})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6,
      }}>
        <Bot size={36} color="#fff" />
      </div>
      <div style={{ fontSize: '20px', fontWeight: '700', color: tokens.textWhite }}>
        Build your trading agent
      </div>
      <div style={{
        fontSize: '14px', color: tokens.textSecondary,
        maxWidth: '340px', lineHeight: '1.6',
      }}>
        Answer 5 quick questions. We'll create an AI agent that matches your trading style and competes on your behalf.
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={goNext}
        style={{
          background: `linear-gradient(135deg, ${tokens.teal}, ${tokens.purple})`,
          border: 'none', borderRadius: '12px', padding: '14px 28px',
          color: '#fff', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
          marginTop: '8px',
        }}
      >
        Create Agent
      </motion.button>
    </motion.div>
  );

  const renderQuestion = (qIndex) => {
    const q = QUESTIONS[qIndex];
    const isNameStep = q.type === 'text';

    return (
      <motion.div
        key={`q-${qIndex}`}
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={slideTransition}
        style={{
          display: 'flex', flexDirection: 'column',
          maxWidth: '480px', margin: '0 auto', width: '100%',
          padding: isMobile ? '24px 16px' : '40px 24px',
          minHeight: '60vh',
        }}
      >
        <ProgressDots current={qIndex} total={5} tokens={tokens} />

        {/* Back button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={goBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', color: tokens.textMuted,
            fontSize: '13px', cursor: 'pointer', padding: '0', marginBottom: '24px',
          }}
        >
          <ArrowLeft size={16} /> Back
        </motion.button>

        {/* Question */}
        <div style={{
          fontSize: '18px', fontWeight: '700', color: tokens.textWhite,
          lineHeight: '1.4', marginBottom: '24px',
        }}>
          {q.question}
        </div>

        {/* Options or text input */}
        {isNameStep ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              value={answers.name}
              onChange={(e) => setAnswers((p) => ({ ...p, name: e.target.value.slice(0, q.maxLength) }))}
              placeholder={PLACEHOLDER_NAMES[placeholderIndex]}
              maxLength={q.maxLength}
              autoFocus
              style={{
                width: '100%', padding: '14px 16px', borderRadius: '12px',
                background: tokens.bgCard, border: `1px solid ${tokens.borderInput}`,
                color: tokens.textWhite, fontSize: '16px', fontWeight: '600',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = tokens.teal; }}
              onBlur={(e) => { e.target.style.borderColor = tokens.borderInput; }}
            />
            <div style={{ fontSize: '12px', color: tokens.textMuted, textAlign: 'right' }}>
              {answers.name.length}/{q.maxLength}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {q.options.map((opt) => {
              const selected = q.type === 'multi'
                ? (answers[q.key] || []).includes(opt.value)
                : answers[q.key] === opt.value;
              return (
                <OptionCard
                  key={opt.value}
                  label={opt.label}
                  selected={selected}
                  onClick={() => handleSelect(q.key, opt.value, q.type)}
                  tokens={tokens}
                />
              );
            })}

            {/* Freeform input for Q1-Q4 */}
            {q.type !== 'multi' && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  value={freeform[q.key] || ''}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 100);
                    setFreeform((p) => ({ ...p, [q.key]: val }));
                    if (val.trim()) setAnswers((p) => ({ ...p, [q.key]: null }));
                  }}
                  placeholder="Say something else..."
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${tokens.borderDefault}`,
                    color: tokens.textSecondary, fontSize: '13px',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(94,234,212,0.3)'; }}
                  onBlur={(e) => { e.target.style.borderColor = tokens.borderDefault; }}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: '12px', color: '#ef4444', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Next button */}
        <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
          <motion.button
            whileTap={isStepValid() ? { scale: 0.97 } : {}}
            onClick={() => {
              if (!isStepValid()) return;
              setError(null);
              if (step === 5) {
                // Last question — go to loading
                setDirection(1);
                setStep(6);
              } else {
                goNext();
              }
            }}
            disabled={!isStepValid()}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              background: isStepValid()
                ? `linear-gradient(135deg, ${tokens.teal}, ${tokens.purple})`
                : 'rgba(255,255,255,0.06)',
              border: 'none',
              color: isStepValid() ? '#fff' : tokens.textMuted,
              fontSize: '15px', fontWeight: '600', cursor: isStepValid() ? 'pointer' : 'default',
              opacity: isStepValid() ? 1 : 0.5,
              transition: 'opacity 0.2s, background 0.2s',
            }}
          >
            {step === 5 ? 'Build Agent' : 'Next'}
          </motion.button>
        </div>
      </motion.div>
    );
  };

  const renderLoading = () => (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: '24px',
        padding: '40px 20px', textAlign: 'center',
      }}
    >
      {/* Pulsing avatar */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: '100px', height: '100px', borderRadius: '50%',
          background: `linear-gradient(135deg, ${tokens.teal}, ${tokens.purple})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Sparkles size={40} color="#fff" />
      </motion.div>

      <div style={{ fontSize: '18px', fontWeight: '600', color: tokens.textWhite }}>
        Building your agent...
      </div>

      {/* Typed name */}
      <div style={{
        fontSize: '24px', fontWeight: '700', color: tokens.teal,
        minHeight: '32px',
      }}>
        {typedName}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{ color: tokens.teal }}
        >
          |
        </motion.span>
      </div>
    </motion.div>
  );

  const renderReveal = () => {
    if (!derivedProfile) return null;
    const { archetype, config: cfg, personality, avatarColors, greeting } = derivedProfile;
    const [color1, color2] = avatarColors || [tokens.teal, tokens.purple];
    const archetypeLabel = archetype?.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) || 'Unknown';

    return (
      <motion.div
        key="reveal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.1 }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: '480px', margin: '0 auto', width: '100%',
          padding: isMobile ? '32px 16px' : '40px 24px',
          gap: '20px',
        }}
      >
        {/* Avatar with glow */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.2 }}
          style={{
            width: '100px', height: '100px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${color1}, ${color2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 30px ${color1}40, 0 0 60px ${color2}20`,
          }}
        >
          <Bot size={44} color="#fff" />
        </motion.div>

        {/* Name */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ fontSize: '24px', fontWeight: '700', color: tokens.textWhite }}
        >
          {answers.name || 'Agent'}
        </motion.div>

        {/* Archetype badge */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            padding: '4px 14px', borderRadius: '12px',
            background: `${color1}18`, border: `1px solid ${color1}40`,
            color: color1, fontSize: '13px', fontWeight: '600',
          }}
        >
          {archetypeLabel}
        </motion.div>

        {/* Greeting */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            fontSize: '14px', color: tokens.textSecondary, fontStyle: 'italic',
            textAlign: 'center', lineHeight: '1.6', maxWidth: '360px',
          }}
        >
          "{greeting}"
        </motion.div>

        {/* Traits */}
        {personality?.traits?.length > 0 && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}
          >
            {personality.traits.map((t, i) => (
              <TraitPill key={i} trait={t} tokens={tokens} />
            ))}
          </motion.div>
        )}

        {/* Config bars */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            width: '100%', maxWidth: '320px',
            display: 'flex', flexDirection: 'column', gap: '10px',
            padding: '16px', borderRadius: '12px',
            background: tokens.bgCard, border: `1px solid ${tokens.borderDefault}`,
          }}
        >
          <ConfigBar label="Risk" value={cfg?.risk ?? 50} color="#ef4444" tokens={tokens} />
          <ConfigBar label="Focus" value={cfg?.concentration ?? 50} color={tokens.teal} tokens={tokens} />
          <ConfigBar label="Momentum" value={cfg?.momentum ?? 50} color={tokens.purple} tokens={tokens} />
        </motion.div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>
        )}

        {/* Go to Dashboard */}
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          whileTap={!creating ? { scale: 0.97 } : {}}
          onClick={handleFinalize}
          disabled={creating}
          style={{
            width: '100%', maxWidth: '320px', padding: '14px', borderRadius: '12px',
            background: creating
              ? 'rgba(255,255,255,0.06)'
              : `linear-gradient(135deg, ${color1}, ${color2})`,
            border: 'none', color: '#fff', fontSize: '15px', fontWeight: '600',
            cursor: creating ? 'default' : 'pointer',
            opacity: creating ? 0.6 : 1,
            marginTop: '4px',
          }}
        >
          {creating ? 'Creating...' : 'Go to Dashboard'}
        </motion.button>
      </motion.div>
    );
  };

  // ── Main render ───────────────────────────────────────

  return (
    <AnimatePresence mode="wait" custom={direction}>
      {step === 0 && renderWelcome()}
      {step >= 1 && step <= 5 && renderQuestion(step - 1)}
      {step === 6 && renderLoading()}
      {step === 7 && renderReveal()}
    </AnimatePresence>
  );
};

export default AgentCreationFlow;
