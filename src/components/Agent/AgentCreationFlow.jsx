import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ArrowLeft, Sparkles, Check } from 'lucide-react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import useAgent from '../../hooks/useAgent';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../data/archetypeIdentity';
import { seedDefaultTraits } from '../../services/seedDefaultTraits';
import { createWatchlist, patchWatchlist, commitWatchlist } from '../../services/forgeWatchlistService';
import {
  STOCK_TIERS, PICK_MIN, PICK_MAX, deriveSectorAffinity, getPickMeta,
} from '../../data/onboardingStockTiers';
import {
  AGENT_COLOR_PALETTE, DEFAULT_AGENT_COLOR_ID, getAgentColorById, deriveAvatarColors,
} from '../../data/agentColorPalette';

// ── Flow steps ────────────────────────────────────────────
// Target flow (ONBOARDING_AGENT_CREATION_SPEC.md): Welcome → Stock pick →
// Temperament ×3 → Name → Color → [Haiku derivation] → Reveal → land on home.
const STEP = {
  WELCOME: 0,
  STOCKS: 1,
  Q1: 2,
  Q2: 3,
  Q3: 4,
  NAME: 5,
  COLOR: 6,
  LOADING: 7,
  REVEAL: 8,
};
// Number of dotted "input" steps (Stocks, Q1, Q2, Q3, Name, Color).
const INPUT_STEPS = 6;

// ── Temperament questions (ARCHETYPE_IDENTITY_CONTRACT_V1.md §3) ──────────
// Question-only derivation: these three answers — and ONLY these — decide the
// archetype. Q1 risk posture, Q2 buy signal, Q3 concentration. The option
// `value`s feed both Haiku and the server-side deterministic fallback.
const QUESTIONS = [
  {
    key: 'q1',
    question: 'How should your agent treat risk?',
    options: [
      { value: 'aggressive', label: 'Swing big — chase the biggest gains, can stomach big losses' },
      { value: 'balanced', label: 'Balanced — grow steadily with measured risk' },
      { value: 'protect', label: 'Protect first — avoid big losses even if I miss some gains' },
    ],
  },
  {
    key: 'q2',
    question: 'What makes a stock worth buying?',
    options: [
      { value: 'trending', label: "It's clearly trending up" },
      { value: 'beaten_down', label: "It's beaten down and out of favor" },
      { value: 'fundamentals', label: "The company's underlying health is strong" },
      { value: 'volatile', label: "It's volatile enough to move big" },
      { value: 'broad_mix', label: "Doesn't matter — I'd rather own a broad mix" },
    ],
  },
  {
    key: 'q3',
    question: 'How do you want your positions spread?',
    options: [
      { value: 'concentrate', label: 'Go big on a few strong ideas' },
      { value: 'spread', label: 'Spread wide so no single bet matters' },
    ],
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

const StockChip = ({ pick, selected, disabled, onClick, tokens }) => (
  <motion.button
    whileTap={disabled ? undefined : { scale: 0.96 }}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
      padding: '8px 12px', borderRadius: '10px', minWidth: '92px',
      background: selected ? 'rgba(94,234,212,0.10)' : tokens.bgCard,
      border: `1px solid ${selected ? tokens.teal : tokens.borderDefault}`,
      color: selected ? tokens.teal : tokens.textPrimary,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      textAlign: 'left',
      transition: 'border-color 0.2s, background 0.2s, opacity 0.2s',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '700' }}>
      {pick.symbol}
      {selected && <Check size={12} />}
    </span>
    <span style={{
      fontSize: '10px', color: selected ? tokens.teal : tokens.textFaint,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px',
    }}>
      {pick.name}
    </span>
  </motion.button>
);

const ColorSwatch = ({ color, selected, onClick, tokens }) => {
  const [c1, c2] = deriveAvatarColors(color.primary);
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-label={color.label}
      title={color.label}
      style={{
        width: '52px', height: '52px', borderRadius: '14px', cursor: 'pointer',
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        border: selected ? `2px solid ${tokens.textWhite}` : '2px solid transparent',
        boxShadow: selected ? `0 0 16px ${c1}66` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {selected && <Check size={20} color="#fff" />}
    </motion.button>
  );
};

const ConfigBar = ({ label, value, color, tokens }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <div style={{ width: '80px', fontSize: '12px', color: tokens.textMuted, fontWeight: '500' }}>
      {label}
    </div>
    <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
      <div style={{ width: `${value}%`, height: '100%', borderRadius: '3px', background: color, transition: 'width 0.6s ease' }} />
    </div>
    <div style={{ width: '28px', fontSize: '12px', color: tokens.textMuted, textAlign: 'right' }}>
      {value}
    </div>
  </div>
);

const TraitPill = ({ trait, tokens }) => (
  <span style={{
    padding: '4px 10px', borderRadius: '12px',
    background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.2)',
    color: tokens.teal, fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap',
  }}>
    {trait}
  </span>
);

// ── Main Component ────────────────────────────────────────

const AgentCreationFlow = ({ user, tokens, isMobile, onComplete }) => {
  const [step, setStep] = useState(STEP.WELCOME);
  const [answers, setAnswers] = useState({ q1: null, q2: null, q3: null, name: '' });
  const [freeform, setFreeform] = useState({ q1: '', q2: '', q3: '' });
  const [picks, setPicks] = useState([]);
  const [colorId, setColorId] = useState(DEFAULT_AGENT_COLOR_ID);
  const [derivedProfile, setDerivedProfile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [direction, setDirection] = useState(1);
  const [typedName, setTypedName] = useState('');
  const [placeholderIndex] = useState(() => Math.floor(Math.random() * PLACEHOLDER_NAMES.length));

  const { createAgent } = useAgent(user?.odUserId);

  // Typing animation for the loading screen
  useEffect(() => {
    if (step !== STEP.LOADING) return;
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

  // Trigger Haiku derivation when entering the loading step.
  useEffect(() => {
    if (step === STEP.LOADING) {
      deriveProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const deriveProfile = async () => {
    setCreating(true);
    setError(null);
    try {
      // Question-only: send the three temperament answers + name. The stock
      // picks are deliberately NOT sent — they must not influence the archetype.
      const response = await fetchWithAuth('/api/agent/create-profile', {
        method: 'POST',
        body: JSON.stringify({
          q1: freeform.q1 || answers.q1,
          q2: freeform.q2 || answers.q2,
          q3: freeform.q3 || answers.q3,
          name: answers.name || 'Agent',
        }),
      });
      const data = await response.json();
      if (data.success && data.profile) {
        setDerivedProfile(data.profile);
        setStep(STEP.REVEAL);
      } else {
        setError('Failed to create profile. Try again.');
        setStep(STEP.COLOR);
      }
    } catch (err) {
      console.error('[AgentCreation] Profile derivation error:', err);
      setError('Something went wrong. Try again.');
      setStep(STEP.COLOR);
    }
    setCreating(false);
  };

  // Build the committed starter watchlist from the picks. Returns the equip
  // descriptor ({ watchlistId, name }) or null on any failure — building the
  // watchlist is best-effort and never blocks agent creation (the user can
  // build/equip one later in the Forge).
  const buildStarterWatchlist = async () => {
    if (!picks.length) return null;
    try {
      const wlName = `${answers.name || 'Agent'}'s Starter`;
      const created = await createWatchlist();
      const watchlistId = created.watchlistId;
      await patchWatchlist(watchlistId, {
        name: wlName,
        tickers: picks.map((symbol) => ({
          symbol,
          category: getPickMeta(symbol)?.tierLabel || '',
          reasoning: '',
          addedBy: 'user',
        })),
      });
      await commitWatchlist(watchlistId);
      return { watchlistId, name: wlName };
    } catch (wlErr) {
      console.error('[AgentCreation] Starter watchlist build failed (non-blocking):', wlErr);
      return null;
    }
  };

  const handleFinalize = async () => {
    if (!derivedProfile || !user?.odUserId) return;
    setCreating(true);
    setError(null);
    try {
      const primaryColor = getAgentColorById(colorId).primary;
      const avatarColors = deriveAvatarColors(primaryColor);
      const sectorAffinity = deriveSectorAffinity(picks);

      // 1. Build + commit the starter watchlist (best-effort) BEFORE creating
      //    the agent, so the agent can be born already equipped — one atomic
      //    write, no post-create equip that the App routing gate could
      //    interrupt when `hasAgent` flips true.
      const equip = await buildStarterWatchlist();
      const nowIso = new Date().toISOString();

      // 2. Create the agent. The chosen color overrides the model's auto-derived
      //    avatarColors; sectorAffinity comes from the picks (not the archetype).
      const agentId = await createAgent({
        name: answers.name || 'Agent',
        archetype: derivedProfile.archetype,
        config: derivedProfile.config,
        personality: {
          ...derivedProfile.personality,
          sectorAffinity,
          creationAnswers: {
            q1: freeform.q1 || answers.q1,
            q2: freeform.q2 || answers.q2,
            q3: freeform.q3 || answers.q3,
          },
        },
        primaryColor,
        avatarColors,
        equippedBundleIds: [],
        ...(equip
          ? {
              equippedWatchlistId: equip.watchlistId,
              equippedWatchlistName: equip.name,
              equippedAt: nowIso,
            }
          : {}),
      });

      if (!agentId) {
        setError('Failed to create agent.');
        setCreating(false);
        return;
      }

      // 3. Seed the archetype's default trait loadout (draft; goes live via the
      //    deploy-time activeRules projection). Never blocks creation.
      try {
        await seedDefaultTraits(agentId, derivedProfile.archetype);
      } catch (seedErr) {
        console.error('[AgentCreation] seedDefaultTraits failed (non-blocking):', seedErr);
      }

      onComplete(agentId);
    } catch (err) {
      console.error('[AgentCreation] Finalize error:', err);
      setError('Failed to create agent.');
      setCreating(false);
    }
  };

  // ── Navigation ────────────────────────────────────────
  const goNext = () => { setDirection(1); setStep((s) => s + 1); };
  const goBack = () => { setDirection(-1); setStep((s) => s - 1); };

  const handleSelect = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const togglePick = (symbol) => {
    setPicks((prev) => {
      if (prev.includes(symbol)) return prev.filter((s) => s !== symbol);
      if (prev.length >= PICK_MAX) return prev;
      return [...prev, symbol];
    });
  };

  const isStepValid = () => {
    if (step === STEP.STOCKS) return picks.length >= PICK_MIN && picks.length <= PICK_MAX;
    if (step === STEP.Q1 || step === STEP.Q2 || step === STEP.Q3) {
      const q = QUESTIONS[step - STEP.Q1];
      return !!answers[q.key] || !!freeform[q.key]?.trim();
    }
    if (step === STEP.NAME) return !!answers.name?.trim();
    if (step === STEP.COLOR) return !!colorId;
    return true;
  };

  // ── Shared step frame (progress + back + title + body + CTA) ──────────
  const renderStepFrame = ({ title, subtitle, body, ctaLabel, onCta, ctaGradient }) => {
    const valid = isStepValid();
    const gradient = ctaGradient || `linear-gradient(135deg, ${tokens.teal}, ${tokens.purple})`;
    return (
      <motion.div
        key={`step-${step}`}
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={slideTransition}
        style={{
          display: 'flex', flexDirection: 'column',
          maxWidth: '480px', margin: '0 auto', width: '100%',
          padding: isMobile ? '24px 16px' : '40px 24px', minHeight: '70vh',
        }}
      >
        <ProgressDots current={step - STEP.STOCKS} total={INPUT_STEPS} tokens={tokens} />

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={goBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', color: tokens.textMuted,
            fontSize: '13px', cursor: 'pointer', padding: '0', marginBottom: '20px',
          }}
        >
          <ArrowLeft size={16} /> Back
        </motion.button>

        <div style={{
          fontSize: '20px', fontWeight: '700', color: tokens.textWhite,
          lineHeight: '1.35', marginBottom: subtitle ? '8px' : '24px',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: '13px', color: tokens.textMuted, lineHeight: '1.5', marginBottom: '22px' }}>
            {subtitle}
          </div>
        )}

        <div style={{ flex: '1 1 auto' }}>{body}</div>

        {error && (
          <div style={{ marginTop: '12px', color: '#ef4444', fontSize: '13px' }}>{error}</div>
        )}

        <div style={{ marginTop: '24px', paddingTop: '8px' }}>
          <motion.button
            whileTap={valid ? { scale: 0.97 } : {}}
            onClick={() => { if (valid) { setError(null); onCta(); } }}
            disabled={!valid}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              background: valid ? gradient : 'rgba(255,255,255,0.06)',
              border: 'none',
              color: valid ? '#fff' : tokens.textMuted,
              fontSize: '15px', fontWeight: '600', cursor: valid ? 'pointer' : 'default',
              opacity: valid ? 1 : 0.5, transition: 'opacity 0.2s, background 0.2s',
            }}
          >
            {ctaLabel}
          </motion.button>
        </div>
      </motion.div>
    );
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
        justifyContent: 'center', minHeight: '70vh', gap: '20px',
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
      <div style={{ fontSize: '22px', fontWeight: '700', color: tokens.textWhite }}>
        Let's build your agent
      </div>
      <div style={{ fontSize: '14px', color: tokens.textSecondary, maxWidth: '340px', lineHeight: '1.6' }}>
        Pick a few names you like, set its temperament, then name it and choose its color.
        We'll match it to a trading style and send it out to compete on your behalf.
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={goNext}
        style={{
          background: `linear-gradient(135deg, ${tokens.teal}, ${tokens.purple})`,
          border: 'none', borderRadius: '12px', padding: '14px 28px',
          color: '#fff', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '8px',
        }}
      >
        Get started
      </motion.button>
    </motion.div>
  );

  const renderStockPick = () => {
    const enough = picks.length >= PICK_MIN;
    return renderStepFrame({
      title: 'Which names do you like?',
      subtitle: "Your agent will lean toward these — not be limited to them. Pick 3–8.",
      body: (
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '10px', marginBottom: '16px',
            background: enough ? 'rgba(94,234,212,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${enough ? 'rgba(94,234,212,0.25)' : tokens.borderDefault}`,
            color: enough ? tokens.teal : tokens.textMuted, fontSize: '12px', fontWeight: '600',
          }}>
            {picks.length} selected{!enough ? ` · pick ${PICK_MIN - picks.length} more` : ''}
          </div>
          {STOCK_TIERS.map((tier) => (
            <div key={tier.id} style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: tokens.textPrimary }}>{tier.label}</span>
                <span style={{ fontSize: '11px', color: tokens.textFaint }}>{tier.blurb}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tier.picks.map((p) => {
                  const selected = picks.includes(p.symbol);
                  return (
                    <StockChip
                      key={p.symbol}
                      pick={p}
                      selected={selected}
                      disabled={!selected && picks.length >= PICK_MAX}
                      onClick={() => togglePick(p.symbol)}
                      tokens={tokens}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ),
      ctaLabel: 'Next',
      onCta: goNext,
    });
  };

  const renderQuestion = (qIndex) => {
    const q = QUESTIONS[qIndex];
    return renderStepFrame({
      title: q.question,
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {q.options.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              selected={answers[q.key] === opt.value && !freeform[q.key]?.trim()}
              onClick={() => {
                handleSelect(q.key, opt.value);
                if (freeform[q.key]) setFreeform((p) => ({ ...p, [q.key]: '' }));
              }}
              tokens={tokens}
            />
          ))}
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
                color: tokens.textSecondary, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(94,234,212,0.3)'; }}
              onBlur={(e) => { e.target.style.borderColor = tokens.borderDefault; }}
            />
          </div>
        </div>
      ),
      ctaLabel: 'Next',
      onCta: goNext,
    });
  };

  const renderName = () => renderStepFrame({
    title: 'What should we call your agent?',
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="text"
          value={answers.name}
          onChange={(e) => setAnswers((p) => ({ ...p, name: e.target.value.slice(0, 20) }))}
          placeholder={PLACEHOLDER_NAMES[placeholderIndex]}
          maxLength={20}
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
          {answers.name.length}/20
        </div>
      </div>
    ),
    ctaLabel: 'Next',
    onCta: goNext,
  });

  const renderColor = () => {
    const chosen = getAgentColorById(colorId);
    const [c1, c2] = deriveAvatarColors(chosen.primary);
    return renderStepFrame({
      title: "Pick your agent's color.",
      subtitle: "This is its identity — the avatar gradient and your dashboard accent.",
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          {/* Live preview orb */}
          <div style={{
            width: '88px', height: '88px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${c1}, ${c2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 26px ${c1}40`,
          }}>
            <Bot size={40} color="#fff" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center' }}>
            {AGENT_COLOR_PALETTE.map((color) => (
              <ColorSwatch
                key={color.id}
                color={color}
                selected={colorId === color.id}
                onClick={() => setColorId(color.id)}
                tokens={tokens}
              />
            ))}
          </div>
          <div style={{ fontSize: '12px', color: tokens.textMuted }}>{chosen.label}</div>
        </div>
      ),
      ctaLabel: 'Build Agent',
      ctaGradient: `linear-gradient(135deg, ${c1}, ${c2})`,
      onCta: () => { setDirection(1); setStep(STEP.LOADING); },
    });
  };

  const renderLoading = () => (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '70vh', gap: '24px',
        padding: '40px 20px', textAlign: 'center',
      }}
    >
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
      <div style={{ fontSize: '24px', fontWeight: '700', color: tokens.teal, minHeight: '32px' }}>
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
    const { archetype, config: cfg, personality, greeting } = derivedProfile;
    const primary = getAgentColorById(colorId).primary;
    const [color1, color2] = deriveAvatarColors(primary);
    const archetypeLabel = getArchetypeDisplayName(archetype);
    const identity = getArchetypeIdentity(archetype);
    const name = answers.name || 'Agent';

    return (
      <motion.div
        key="reveal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.1 }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: '480px', margin: '0 auto', width: '100%',
          padding: isMobile ? '32px 16px' : '40px 24px', gap: '16px',
        }}
      >
        {/* Avatar in the chosen color */}
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

        {/* Payoff: Meet [Name] */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ fontSize: '13px', color: tokens.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          Meet
        </motion.div>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
          style={{ fontSize: '26px', fontWeight: '700', color: tokens.textWhite, marginTop: '-8px' }}
        >
          {name}
        </motion.div>

        {/* Archetype badge + disposition (the derived identity) */}
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
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55 }}
          style={{ fontSize: '14px', color: tokens.textSecondary, textAlign: 'center', maxWidth: '360px', lineHeight: '1.5' }}
        >
          {identity.disposition}
        </motion.div>

        {/* The agent's first words */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            fontSize: '14px', color: tokens.textMuted, fontStyle: 'italic',
            textAlign: 'center', lineHeight: '1.6', maxWidth: '360px',
          }}
        >
          "{greeting}"
        </motion.div>

        {/* Teaching: how it trades (plain language, names the tradeoff) */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: '12px',
            background: tokens.bgCard, border: `1px solid ${tokens.borderDefault}`,
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
            How {name} trades
          </div>
          <div style={{ fontSize: '13px', color: tokens.textSecondary, lineHeight: '1.6' }}>
            {identity.reveal}
          </div>
        </motion.div>

        {/* Bridge: the loadout the user just built (mirrors the dashboard bench) */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.78 }}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: '12px',
            background: tokens.bgCard, border: `1px solid ${tokens.borderDefault}`,
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {name}'s loadout
          </div>
          <LoadoutRow label="Style" tokens={tokens}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: tokens.textPrimary }}>{archetypeLabel}</span>
          </LoadoutRow>
          <LoadoutRow label="Watchlist" tokens={tokens}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {picks.map((sym) => (
                <span key={sym} style={{
                  padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '600',
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${tokens.borderDefault}`, color: tokens.textPrimary,
                }}>
                  {sym}
                </span>
              ))}
            </div>
          </LoadoutRow>
          <LoadoutRow label="Color" tokens={tokens}>
            <span style={{
              display: 'inline-block', width: '20px', height: '20px', borderRadius: '6px',
              background: `linear-gradient(135deg, ${color1}, ${color2})`,
            }} />
          </LoadoutRow>
          <div style={{ fontSize: '11px', color: tokens.textFaint, lineHeight: '1.5' }}>
            Rules slot is open — add strategy rules later in the Forge.
          </div>
        </motion.div>

        {/* Personality traits */}
        {personality?.traits?.length > 0 && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.84 }}
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
          transition={{ delay: 0.9 }}
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

        {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}

        {/* CTA → home with the agent equipped */}
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.96 }}
          whileTap={!creating ? { scale: 0.97 } : {}}
          onClick={handleFinalize}
          disabled={creating}
          style={{
            width: '100%', maxWidth: '320px', padding: '14px', borderRadius: '12px',
            background: creating ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${color1}, ${color2})`,
            border: 'none', color: '#fff', fontSize: '15px', fontWeight: '600',
            cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.6 : 1, marginTop: '4px',
          }}
        >
          {creating ? 'Setting up...' : 'Enter the arena'}
        </motion.button>
      </motion.div>
    );
  };

  // ── Main render ───────────────────────────────────────
  return (
    <AnimatePresence mode="wait" custom={direction}>
      {step === STEP.WELCOME && renderWelcome()}
      {step === STEP.STOCKS && renderStockPick()}
      {(step === STEP.Q1 || step === STEP.Q2 || step === STEP.Q3) && renderQuestion(step - STEP.Q1)}
      {step === STEP.NAME && renderName()}
      {step === STEP.COLOR && renderColor()}
      {step === STEP.LOADING && renderLoading()}
      {step === STEP.REVEAL && renderReveal()}
    </AnimatePresence>
  );
};

// Small label/value row used in the reveal loadout card.
const LoadoutRow = ({ label, children, tokens }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
    <div style={{ width: '72px', flexShrink: 0, fontSize: '12px', color: tokens.textMuted, fontWeight: '500', paddingTop: '2px' }}>
      {label}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

export default AgentCreationFlow;
