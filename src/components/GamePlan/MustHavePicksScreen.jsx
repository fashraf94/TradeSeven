import React, { useEffect } from 'react';

// Placeholder for Phase 3
const MustHavePicksScreen = ({ onBack, onNext, selectedSectors, riskStyle }) => {
  // For Phase 1, skip directly to results
  useEffect(() => {
    onNext([]);
  }, [onNext]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#8b949e'
    }}>
      Loading...
    </div>
  );
};

export default MustHavePicksScreen;
