import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const SearchDiscover = ({ user, isMobile, isDesktop, setScreen, stocksData, sidebarCollapsed }) => {
  const { tokens } = useTheme();

  return (
    <div style={{
      minHeight: '100vh',
      background: tokens.bgApp,
      padding: isMobile ? '16px' : '24px',
      paddingBottom: isMobile ? '80px' : '24px',
    }}>
      <h1 style={{ color: tokens.textPrimary, fontSize: '20px', fontWeight: 700 }}>
        Discover
      </h1>
      <p style={{ color: tokens.textMuted, fontSize: '14px', marginTop: '8px' }}>
        Search & Discover screen — coming next phase.
      </p>
    </div>
  );
};

export default SearchDiscover;
