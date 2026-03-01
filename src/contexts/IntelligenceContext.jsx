import { createContext, useContext } from 'react';

const IntelligenceContext = createContext(null);

export function IntelligenceProvider({ value, children }) {
  return (
    <IntelligenceContext.Provider value={value}>
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligence() {
  const ctx = useContext(IntelligenceContext);
  if (!ctx) throw new Error('useIntelligence must be used within IntelligenceProvider');
  return ctx;
}

export default IntelligenceContext;
