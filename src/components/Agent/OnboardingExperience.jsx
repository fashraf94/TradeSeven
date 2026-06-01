// src/components/Agent/OnboardingExperience.jsx
//
// Full-screen wrapper for the new-user "build your agent" experience. The
// App-level onboarding gate renders this ahead of the main shell, so it carries
// NO nav chrome — a brand-new agent-less user can't tab away into half-built
// screens; building the agent is the whole task.
//
// It owns theme + responsive context (via useTheme/useIsMobile) so App.jsx,
// which has no `tokens` in scope, doesn't need to thread them in. The
// pre-agent loading splash is the app's shared AppLoadingScreen, rendered by
// the gate itself (not here), so auth-load and agent-load look continuous.

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import AgentCreationFlow from './AgentCreationFlow';

const OnboardingExperience = ({ user, onComplete }) => {
  const { tokens } = useTheme();
  const { isMobile } = useIsMobile();

  return (
    <div style={{ minHeight: '100vh', background: tokens.bgApp }}>
      <AgentCreationFlow
        user={user}
        tokens={tokens}
        isMobile={isMobile}
        onComplete={onComplete}
      />
    </div>
  );
};

export default OnboardingExperience;
