import React, { useState } from 'react';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import AcademyHero from './AcademyHero';
import AcademyCategoryBar from './AcademyCategoryBar';
import AcademyVideoCard from './AcademyVideoCard';
import AcademyEmptyState from './AcademyEmptyState';

const MOCK_VIDEOS = [
  {
    id: 'implied-volatility',
    title: 'Implied Volatility',
    hook: 'Why do some stocks move 10% in a day while others barely budge?',
    category: 'trading_basics',
    difficulty: 'beginner',
    duration: 30,
    thumbnail: null,
    gameConnection: 'BaggerBomb',
    isNew: true,
  },
  {
    id: 'baggerbomb-thresholds',
    title: 'BaggerBomb Thresholds',
    hook: 'The hidden levels that turn a boring stock into a point machine.',
    category: 'game_mechanics',
    difficulty: 'beginner',
    duration: 30,
    thumbnail: null,
    gameConnection: 'BaggerBomb',
    isNew: true,
  },
  {
    id: 'sector-rotation',
    title: 'Sector Rotation',
    hook: 'The economy runs in cycles. Smart players rotate with it.',
    category: 'market_concepts',
    difficulty: 'intermediate',
    duration: 30,
    thumbnail: null,
    gameConnection: 'Snake Draft',
    isNew: false,
  },
  {
    id: 'earnings-surprise',
    title: 'Earnings Surprise',
    hook: 'Companies report earnings every quarter. Here is why it moves stocks.',
    category: 'earnings_trading',
    difficulty: 'beginner',
    duration: 30,
    thumbnail: null,
    gameConnection: 'EarningsGame',
    isNew: false,
  },
  {
    id: 'atr-average-true-range',
    title: 'Average True Range',
    hook: 'One number tells you exactly how wild a stock usually gets.',
    category: 'trading_basics',
    difficulty: 'beginner',
    duration: 30,
    thumbnail: null,
    gameConnection: 'BaggerBomb',
    isNew: false,
  },
  {
    id: 'snake-draft-strategy',
    title: 'Snake Draft Strategy',
    hook: 'First pick is not always best pick. Here is why position matters.',
    category: 'game_mechanics',
    difficulty: 'beginner',
    duration: 30,
    thumbnail: null,
    gameConnection: 'Snake Draft',
    isNew: true,
  },
  {
    id: 'iv-crush',
    title: 'IV Crush',
    hook: 'You predicted the move correctly and still lost money. Here is why.',
    category: 'options_fundamentals',
    difficulty: 'intermediate',
    duration: 30,
    thumbnail: null,
    gameConnection: 'Options Arena',
    isNew: false,
  },
  {
    id: 'fed-funds-rate',
    title: 'Federal Funds Rate',
    hook: 'One decision by 12 people moves trillions of dollars. Understand it.',
    category: 'market_concepts',
    difficulty: 'beginner',
    duration: 30,
    thumbnail: null,
    gameConnection: null,
    isNew: false,
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', color: '#00d9ff' },
  { id: 'trading_basics', label: 'Trading Basics', color: '#00d9ff' },
  { id: 'game_mechanics', label: 'Game Mechanics', color: '#8b5cf6' },
  { id: 'market_concepts', label: 'Market Concepts', color: '#f59e0b' },
  { id: 'trading_strategy', label: 'Strategy', color: '#10b981' },
  { id: 'options_fundamentals', label: 'Options', color: '#ef4444' },
  { id: 'earnings_trading', label: 'Earnings', color: '#ffc107' },
  { id: 'risk_management', label: 'Risk', color: '#3b82f6' },
  { id: 'technical_analysis', label: 'Technical', color: '#0099cc' },
];

export default function AcademyFeed({ isMobile, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVideos = MOCK_VIDEOS.filter(v => {
    const matchesCategory = selectedCategory === 'all' || v.category === selectedCategory;
    const matchesSearch = !searchTerm ||
      v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.hook.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredVideo = filteredVideos.find(v => v.isNew) || filteredVideos[0] || null;
  const gridVideos = filteredVideos.filter(v => v !== featuredVideo);

  const selectedCategoryObj = CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div style={{
      minHeight: '100vh',
      paddingBottom: isMobile ? '80px' : '40px',
    }}>
      <div style={{
        maxWidth: '780px',
        margin: '0 auto',
        padding: isMobile ? '0 16px' : '0 32px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 0',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          marginBottom: '20px',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00d9ff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8b949e'; }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GraduationCap size={24} color="#00d9ff" />
              <span style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#ffffff',
              }}>
                Academy
              </span>
            </div>
            <div style={{
              fontSize: '14px',
              color: '#8b949e',
              letterSpacing: '2px',
              marginTop: '2px',
            }}>
              Learn. Play. Win.
            </div>
          </div>
        </div>

        {/* Hero */}
        {featuredVideo && (
          <AcademyHero video={featuredVideo} categories={CATEGORIES} />
        )}

        {/* Category Filter */}
        <AcademyCategoryBar
          categories={CATEGORIES}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
        />

        {/* Video Grid */}
        {gridVideos.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '16px',
            marginTop: '8px',
          }}>
            {gridVideos.map(video => (
              <AcademyVideoCard key={video.id} video={video} categories={CATEGORIES} />
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <AcademyEmptyState
            categoryLabel={selectedCategoryObj?.label || selectedCategory}
            onViewAll={() => setSelectedCategory('all')}
          />
        ) : null}
      </div>
    </div>
  );
}
