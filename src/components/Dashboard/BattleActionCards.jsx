import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Plus, Swords, ArrowRight } from 'lucide-react';

export default function BattleActionCards({
  gameMode,
  hasActiveBattle,
  colors,
  // Reset handlers
  setPortfolio,
  setPortfolioType,
  setPortfolioName,
  setAssetType,
  setSearchTerm,
  setSelectedCrypto,
  setJoinCode,
  // Modal handlers
  setShowCreateDraftConfirm,
  setShowCreateBattleConfirm,
  setShowJoinDraftConfirm,
  setShowJoinBattleConfirm
}) {
  return (
    <div
      id="tour-battle-cards"
      style={{
        display: 'flex',
        gap: '16px',
        padding: '0 16px',
        justifyContent: 'center',
        alignItems: 'stretch',
        marginBottom: '16px'
      }}
    >
      {/* CREATE BATTLE Card */}
      {(() => {
        const createColor = gameMode === 'draft' ? '#10b981' : colors.cyan;
        return (
          <motion.div
            id="tour-create-battle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            onClick={() => {
              // Reset portfolio state
              setPortfolio([]); setPortfolioType(null);
              setPortfolioName('');
              setAssetType('stocks');
              setSearchTerm('');
              setSelectedCrypto(null);

              // Show confirmation popup based on game mode
              if (gameMode === 'draft') {
                setShowCreateDraftConfirm(true);
              } else {
                setShowCreateBattleConfirm(true);
              }
            }}
            style={{
              position: 'relative',
              flex: 1,
              maxWidth: '180px',
              background: colors.cardBg,
              borderRadius: '16px',
              padding: hasActiveBattle ? '24px 20px' : '32px 24px',
              border: `1px solid ${colors.border}`,
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = createColor;
              e.currentTarget.style.boxShadow = `0 0 30px ${createColor}30`;
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Background Pattern - Chart Lines */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.08,
              background: `
                linear-gradient(90deg, transparent 0%, ${createColor}20 50%, transparent 100%),
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 20px,
                  ${createColor}10 20px,
                  ${createColor}10 21px
                )
              `,
              pointerEvents: 'none'
            }} />

            {/* Gradient Overlay */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '40%',
              height: '100%',
              background: `linear-gradient(90deg, ${createColor}10 0%, transparent 100%)`,
              pointerEvents: 'none'
            }} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <Trophy style={{
                height: hasActiveBattle ? '40px' : '56px',
                width: hasActiveBattle ? '40px' : '56px',
                color: createColor,
                marginBottom: '16px'
              }} />
              <h3 style={{
                fontSize: hasActiveBattle ? '20px' : '24px',
                fontWeight: 'bold',
                color: colors.textPrimary,
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                {gameMode === 'draft' ? 'Create Draft' : 'Create Battle'}
              </h3>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                margin: '0 0 20px 0'
              }}>
                {gameMode === 'draft' ? 'Start a 4-player snake draft.' : 'Start a new battle & set the rules.'}
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: gameMode === 'draft' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                border: gameMode === 'draft' ? 'none' : `2px solid ${createColor}`,
                borderRadius: '10px',
                color: gameMode === 'draft' ? '#ffffff' : createColor,
                fontSize: '14px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: gameMode === 'draft' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
              }}>
                {gameMode === 'draft' ? '🐍 CREATE DRAFT' : 'CREATE BATTLE'}
                {gameMode !== 'draft' && <Plus style={{ height: '16px', width: '16px' }} />}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* JOIN BATTLE Card */}
      {(() => {
        const joinColor = gameMode === 'draft' ? '#10b981' : colors.purple;
        return (
          <motion.div
            id="tour-join-battle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            onClick={() => {
              // Reset portfolio state
              setPortfolio([]); setPortfolioType(null);
              setPortfolioName('');
              setAssetType('stocks');
              setSearchTerm('');
              setJoinCode('');

              // Show confirmation popup based on game mode
              if (gameMode === 'draft') {
                setShowJoinDraftConfirm(true);
              } else {
                setShowJoinBattleConfirm(true);
              }
            }}
            style={{
              position: 'relative',
              flex: 1,
              maxWidth: '180px',
              background: colors.cardBg,
              borderRadius: '16px',
              padding: hasActiveBattle ? '24px 20px' : '32px 24px',
              border: `1px solid ${colors.border}`,
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = joinColor;
              e.currentTarget.style.boxShadow = `0 0 30px ${joinColor}30`;
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Background Pattern - Target/Crosshair */}
            <div style={{
              position: 'absolute',
              top: '50%',
              right: '10%',
              transform: 'translateY(-50%)',
              width: '120px',
              height: '120px',
              opacity: 0.06,
              border: `3px solid ${joinColor}`,
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
            <div style={{
              position: 'absolute',
              top: '50%',
              right: 'calc(10% + 30px)',
              transform: 'translateY(-50%)',
              width: '60px',
              height: '60px',
              opacity: 0.08,
              border: `2px solid ${joinColor}`,
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />

            {/* Gradient Overlay */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '40%',
              height: '100%',
              background: `linear-gradient(270deg, ${joinColor}10 0%, transparent 100%)`,
              pointerEvents: 'none'
            }} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <Swords style={{
                height: hasActiveBattle ? '40px' : '56px',
                width: hasActiveBattle ? '40px' : '56px',
                color: joinColor,
                marginBottom: '16px'
              }} />
              <h3 style={{
                fontSize: hasActiveBattle ? '20px' : '24px',
                fontWeight: 'bold',
                color: colors.textPrimary,
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                {gameMode === 'draft' ? 'Join Draft' : 'Join Battle'}
              </h3>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                margin: '0 0 20px 0'
              }}>
                {gameMode === 'draft' ? 'Enter a draft code to join.' : 'Find an open match & compete.'}
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'transparent',
                border: `2px solid ${joinColor}`,
                borderRadius: '10px',
                color: joinColor,
                fontSize: '14px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {gameMode === 'draft' ? '🎯 JOIN DRAFT' : 'JOIN BATTLE'}
                <ArrowRight style={{ height: '16px', width: '16px' }} />
              </div>
            </div>
          </motion.div>
        );
      })()}
    </div>
  );
}
