import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const InstitutionalView = () => {
  const { tokens } = useTheme();

  return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: tokens.textMuted, fontSize: '14px' }}>
      Institutional view placeholder — Phase 4.
    </div>
  );
};

export default InstitutionalView;
