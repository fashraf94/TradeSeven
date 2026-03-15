import React, { createContext, useContext, useState, useMemo } from 'react';
import { DARK_TOKENS, LIGHT_TOKENS } from '../theme/tokens';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark'); // dark is primary

  const value = useMemo(() => ({
    mode,
    setMode,
    tokens: mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS,
    toggleMode: () => setMode(prev => prev === 'dark' ? 'light' : 'dark'),
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
