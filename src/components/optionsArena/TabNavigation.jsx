/**
 * TabNavigation
 * Tab navigation between Build Portfolio and Active Portfolios views
 */

import React from 'react';

const TabNavigation = ({
  activeTab,
  setActiveTab,
  hasEntries,
  entryCount
}) => {
  return (
    <div style={{
      display: 'flex',
      gap: '0',
      marginBottom: '16px',
      borderBottom: '2px solid #2d3748'
    }}>
      <button
        onClick={() => setActiveTab('build')}
        style={{
          flex: 1,
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          borderBottom: activeTab === 'build' ? '2px solid #00d9ff' : '2px solid transparent',
          marginBottom: '-2px',
          color: activeTab === 'build' ? '#00d9ff' : '#6b7280',
          fontWeight: '600',
          fontSize: '15px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        🎯 Build Portfolio
      </button>
      <button
        onClick={() => setActiveTab('portfolios')}
        style={{
          flex: 1,
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          borderBottom: activeTab === 'portfolios' ? '2px solid #10b981' : '2px solid transparent',
          marginBottom: '-2px',
          color: activeTab === 'portfolios' ? '#10b981' : '#6b7280',
          fontWeight: '600',
          fontSize: '15px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        📊 Active
        {hasEntries && (
          <span style={{
            background: '#10b981',
            color: '#000',
            fontSize: '11px',
            fontWeight: '700',
            padding: '2px 6px',
            borderRadius: '10px',
            minWidth: '20px'
          }}>
            {entryCount}
          </span>
        )}
      </button>
      <button
        onClick={() => setActiveTab('history')}
        style={{
          flex: 1,
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          borderBottom: activeTab === 'history' ? '2px solid #f59e0b' : '2px solid transparent',
          marginBottom: '-2px',
          color: activeTab === 'history' ? '#f59e0b' : '#6b7280',
          fontWeight: '600',
          fontSize: '15px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        🏆 History
      </button>
    </div>
  );
};

export default TabNavigation;
