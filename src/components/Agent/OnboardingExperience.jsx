// src/components/Agent/OnboardingExperience.jsx
//
// Full-screen wrapper for the new-user "build your agent" experience. The
// App-level onboarding gate renders this ahead of the main shell, so it carries
// NO nav chrome — a brand-new agent-less user can't tab away into half-built
// screens; building the agent is the whole task.
//
// It owns theme + responsive context (via useTheme/useIsMobile) so App.jsx,
// which has no `tokens` in scope, doesn't need to thread them in.
//
//   phase="loading" — neutral splash while the agent subscription resolves
//                     (prevents a flash of the dashboard before redirect).
//   phase="create"  — the AgentCreationFlow itself.

import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import AgentCreationFlow from './AgentCreationFlow';

const OnboardingExperience = ({ phase = 'create', user, onComplete }) => {
  const { tokens } = useTheme();
  const { isMobile, isDesktop } = useIsMobile();

  if (phase === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', background: tokens.bgApp,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${tokens.teal}, ${tokens.purple})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Bot size={28} color="#fff" />
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: tokens.bgApp }}>
      <AgentCreationFlow
        user={user}
        tokens={tokens}
        isDesktop={isDesktop}
        isMobile={isMobile}
        onComplete={onComplete}
      />
    </div>
  );
};

export default OnboardingExperience;
