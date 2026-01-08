// /src/screens/StonkOptionsArenaScreen.jsx

import React, { Suspense, lazy } from 'react';

// Lazy load the Options Arena component
const StonkOptionsArenaV2 = lazy(() => import('../components/StonkOptionsArenaV2'));

/**
 * StonkOptionsArenaScreen - Wrapper for Options Arena game
 *
 * @param {Object} props
 * @param {Function} props.onBack - Handler to go back to dashboard
 * @param {Array} props.stocksData - Stock data for the game
 * @param {Object} props.stockAPI - Stock API instance
 */
const StonkOptionsArenaScreen = ({
  onBack,
  stocksData,
  stockAPI
}) => {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#0a0a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#00d9ff'
      }}>
        Loading Options Arena...
      </div>
    }>
      <StonkOptionsArenaV2
        onBack={onBack}
        stocksData={stocksData}
        stockAPI={stockAPI}
        initialCash={10000}
      />
    </Suspense>
  );
};

export default StonkOptionsArenaScreen;
