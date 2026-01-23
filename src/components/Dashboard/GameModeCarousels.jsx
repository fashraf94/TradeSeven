// /src/components/Dashboard/GameModeCarousels.jsx
// Horizontal scroll carousels for game modes - EARN COINS and COMPETE sections

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Swords, TrendingUp, Trophy, ArrowRight } from 'lucide-react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';

// Carousel container style with hidden scrollbar
const carouselContainerStyle = {
  display: 'flex',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  gap: '12px',
  padding: '0 16px 16px 16px',
  scrollbarWidth: 'none',        // Firefox
  msOverflowStyle: 'none',       // IE/Edge
  WebkitOverflowScrolling: 'touch', // Smooth iOS scroll
};

// Section header style - prominent gradient text with italic styling
const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '12px',
  padding: '0 16px',
  marginBottom: '16px',
  marginTop: '24px',
};

// Gradient text style for section titles
const getSectionTitleStyle = (accentColor, lighterAccent) => ({
  fontSize: '18px',
  fontWeight: '700',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  fontStyle: 'italic',
  background: `linear-gradient(90deg, ${accentColor} 0%, ${lighterAccent} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

const sectionSubtitleStyle = {
  fontSize: '13px',
  color: HOLO_COLORS.textMuted,
  fontWeight: '400',
  fontStyle: 'normal',
};

// Base carousel card style
const getCarouselCardStyle = (accentColor) => ({
  flex: '0 0 auto',
  width: 'calc(85vw - 32px)',
  maxWidth: '320px',
  minWidth: '260px',
  scrollSnapAlign: 'start',
  background: HOLO_COLORS.bgCard,
  borderRadius: '16px',
  border: `1px solid ${HOLO_COLORS.borderSubtle}`,
  padding: '20px',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  position: 'relative',
});

// Card component for reusability
const CarouselCard = ({
  accentColor,
  icon: Icon,
  iconEmoji,
  title,
  description,
  duration,
  onClick,
  index,
  gradientFrom,
  gradientTo
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...getCarouselCardStyle(accentColor),
        borderColor: isHovered ? accentColor : HOLO_COLORS.borderSubtle,
        boxShadow: isHovered ? `0 0 25px ${accentColor}40` : 'none',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '14px',
        background: `linear-gradient(135deg, ${gradientFrom || accentColor} 0%, ${gradientTo || accentColor} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        boxShadow: `0 4px 15px ${accentColor}40`,
      }}>
        {iconEmoji ? (
          <span style={{ fontSize: '28px' }}>{iconEmoji}</span>
        ) : Icon ? (
          <Icon size={28} color="#fff" />
        ) : null}
      </div>

      {/* Title */}
      <div style={{
        fontSize: '18px',
        fontWeight: '700',
        color: HOLO_COLORS.textPrimary,
        marginBottom: '6px',
      }}>
        {title}
      </div>

      {/* Description */}
      <div style={{
        fontSize: '13px',
        color: HOLO_COLORS.textSecondary,
        marginBottom: '12px',
        lineHeight: '1.4',
      }}>
        {description}
      </div>

      {/* Duration badge */}
      {duration && (
        <div style={{
          fontSize: '12px',
          color: accentColor,
          fontWeight: '600',
        }}>
          {duration}
        </div>
      )}
    </motion.div>
  );
};

export default function GameModeCarousels({
  gameMode,
  colors,
  // Training handlers
  setTrainingConfirmType,
  setShowTrainingConfirmModal,
  setShowClassicTrainingConfirm,
  // Battle/Draft handlers
  setPortfolio,
  setPortfolioType,
  setPortfolioName,
  setAssetType,
  setSearchTerm,
  setSelectedCrypto,
  setJoinCode,
  setShowCreateDraftConfirm,
  setShowCreateBattleConfirm,
  setShowJoinDraftConfirm,
  setShowJoinBattleConfirm,
  // Screen navigation
  setScreen,
}) {
  // Handler for Create Draft/Battle
  const handleCreate = () => {
    // Reset portfolio state
    setPortfolio([]);
    setPortfolioType(null);
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
  };

  // Handler for Join Draft/Battle
  const handleJoin = () => {
    // Reset portfolio state
    setPortfolio([]);
    setPortfolioType(null);
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
  };

  // Define EARN COINS cards based on game mode
  const earnCoinsCards = gameMode === 'draft' ? [
    {
      id: 'training-stocks',
      accentColor: HOLO_COLORS.purple,
      gradientFrom: '#8b5cf6',
      gradientTo: '#6d28d9',
      icon: TrendingUp,
      title: 'Training: Stocks',
      description: 'Practice drafting against CPU opponents',
      duration: '~5 min',
      onClick: () => {
        setTrainingConfirmType('stocks');
        setShowTrainingConfirmModal(true);
      },
    },
    {
      id: 'training-crypto',
      accentColor: HOLO_COLORS.purple,
      gradientFrom: '#8b5cf6',
      gradientTo: '#6d28d9',
      iconEmoji: '₿',
      title: 'Training: Crypto',
      description: 'Practice drafting crypto assets',
      duration: '~5 min',
      onClick: () => {
        setTrainingConfirmType('crypto');
        setShowTrainingConfirmModal(true);
      },
    },
    {
      id: 'stonk-options',
      accentColor: HOLO_COLORS.defensive, // green
      gradientFrom: '#10b981',
      gradientTo: '#06b6d4',
      icon: TrendingUp,
      title: 'Stonk Options',
      description: 'Binary options trading game - Pick strikes & win big',
      duration: null,
      onClick: () => setScreen('stonkOptionsArena'),
    },
  ] : [
    // Classic mode - single training card + Stonk Options
    {
      id: 'training-classic',
      accentColor: HOLO_COLORS.purple,
      gradientFrom: '#8b5cf6',
      gradientTo: '#6d28d9',
      iconEmoji: '🎯',
      title: 'Training Mode',
      description: 'Practice against CPU opponent - Stocks & Crypto',
      duration: '~5 min',
      onClick: () => {
        setShowClassicTrainingConfirm(true);
      },
    },
    {
      id: 'stonk-options',
      accentColor: HOLO_COLORS.defensive, // green
      gradientFrom: '#10b981',
      gradientTo: '#06b6d4',
      icon: TrendingUp,
      title: 'Stonk Options',
      description: 'Binary options trading game - Pick strikes & win big',
      duration: null,
      onClick: () => setScreen('stonkOptionsArena'),
    },
  ];

  // Define COMPETE cards
  const competeCards = gameMode === 'draft' ? [
    {
      id: 'create-draft',
      accentColor: HOLO_COLORS.defensive, // green
      gradientFrom: '#10b981',
      gradientTo: '#059669',
      icon: Trophy,
      title: 'Create Draft',
      description: 'Start a 4-player snake draft',
      duration: null,
      onClick: handleCreate,
    },
    {
      id: 'join-draft',
      accentColor: HOLO_COLORS.defensive, // green
      gradientFrom: '#10b981',
      gradientTo: '#059669',
      icon: Swords,
      title: 'Join Draft',
      description: 'Enter a draft code to join',
      duration: null,
      onClick: handleJoin,
    },
  ] : [
    {
      id: 'create-battle',
      accentColor: HOLO_COLORS.cyan,
      gradientFrom: '#00d9ff',
      gradientTo: '#0891b2',
      icon: Trophy,
      title: 'Create Battle',
      description: 'Start a new battle & set the rules',
      duration: null,
      onClick: handleCreate,
    },
    {
      id: 'join-battle',
      accentColor: HOLO_COLORS.purple,
      gradientFrom: '#8b5cf6',
      gradientTo: '#7c3aed',
      icon: Swords,
      title: 'Join Battle',
      description: 'Find an open match & compete',
      duration: null,
      onClick: handleJoin,
    },
  ];

  return (
    <>
      {/* CSS to hide scrollbar for webkit browsers */}
      <style>{`
        .carousel-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          EARN COINS SECTION - Low-risk ways to build balance
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '24px' }}>
        {/* Section Header - Purple gradient */}
        <div style={sectionHeaderStyle}>
          <Zap size={18} color="#8b5cf6" />
          <span style={getSectionTitleStyle('#8b5cf6', '#a78bfa')}>
            EARN COINS
          </span>
          <span style={sectionSubtitleStyle}>
            — Low-risk ways to build your balance
          </span>
        </div>

        {/* Carousel */}
        <div
          className="carousel-scroll"
          style={{
            ...carouselContainerStyle,
          }}
        >
          {earnCoinsCards.map((card, index) => (
            <CarouselCard
              key={card.id}
              index={index}
              accentColor={card.accentColor}
              gradientFrom={card.gradientFrom}
              gradientTo={card.gradientTo}
              icon={card.icon}
              iconEmoji={card.iconEmoji}
              title={card.title}
              description={card.description}
              duration={card.duration}
              onClick={card.onClick}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          COMPETE SECTION - Primary game modes
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '24px' }}>
        {/* Section Header - Green gradient */}
        <div style={sectionHeaderStyle}>
          <Swords size={18} color="#10b981" />
          <span style={getSectionTitleStyle('#10b981', '#34d399')}>
            COMPETE
          </span>
          <span style={sectionSubtitleStyle}>
            — Challenge friends or rivals
          </span>
        </div>

        {/* Carousel */}
        <div
          className="carousel-scroll"
          style={{
            ...carouselContainerStyle,
          }}
        >
          {competeCards.map((card, index) => (
            <CarouselCard
              key={card.id}
              index={index}
              accentColor={card.accentColor}
              gradientFrom={card.gradientFrom}
              gradientTo={card.gradientTo}
              icon={card.icon}
              iconEmoji={card.iconEmoji}
              title={card.title}
              description={card.description}
              duration={card.duration}
              onClick={card.onClick}
            />
          ))}
        </div>
      </div>
    </>
  );
}
