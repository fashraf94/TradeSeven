// /src/components/shared/StyledIcon.jsx

import React from 'react';

/**
 * StyledIcon - Premium gradient icons for UI elements
 * Used throughout research flow and metrics displays
 *
 * @param {Object} props
 * @param {string} props.type - Icon type (building, chart, money, percent, news, fundamental, technical)
 * @param {string} props.size - Icon size (small, medium, large)
 */
const StyledIcon = ({ type, size = 'medium' }) => {
  const sizes = {
    small: { container: 28, icon: 14 },
    medium: { container: 36, icon: 18 },
    large: { container: 48, icon: 24 }
  };

  const s = sizes[size];

  const iconConfigs = {
    building: {
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      shadow: 'rgba(59, 130, 246, 0.4)',
      svg: (
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/>
        </svg>
      )
    },
    chart: {
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      shadow: 'rgba(139, 92, 246, 0.4)',
      svg: (
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
          <path d="M3 3v18h18M7 16l4-4 4 4 5-6"/>
        </svg>
      )
    },
    money: {
      gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      shadow: 'rgba(34, 197, 94, 0.4)',
      svg: (
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      )
    },
    percent: {
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      shadow: 'rgba(245, 158, 11, 0.4)',
      svg: (
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
          <path d="M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
        </svg>
      )
    },
    news: {
      gradient: 'linear-gradient(135deg, #00d9ff 0%, #0ea5e9 100%)',
      shadow: 'rgba(0, 217, 255, 0.4)',
      svg: (
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
          <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2M18 14h-8M18 18h-8M18 6h-8v4h8V6z"/>
        </svg>
      )
    },
    fundamental: {
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      shadow: 'rgba(139, 92, 246, 0.4)',
      svg: (
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      )
    },
    technical: {
      gradient: 'linear-gradient(135deg, #00d9ff 0%, #0ea5e9 100%)',
      shadow: 'rgba(0, 217, 255, 0.4)',
      svg: (
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
          <path d="M3 17l6-6 4 4 8-8M17 7h4v4"/>
        </svg>
      )
    }
  };

  const config = iconConfigs[type] || iconConfigs.chart;

  return (
    <div style={{
      width: `${s.container}px`,
      height: `${s.container}px`,
      background: config.gradient,
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 4px 12px ${config.shadow}`,
      flexShrink: 0
    }}>
      {config.svg}
    </div>
  );
};

export default StyledIcon;
