import React, { useState, useRef, useEffect } from 'react';
import { Target, Swords, Users, GraduationCap, X } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Color mapping from HOLO_COLORS tokens
const C = {
  bg: HOLO_COLORS.bgDeep,
  card: HOLO_COLORS.bgCard,
  primary: HOLO_COLORS.primary,
  green: HOLO_COLORS.greenMuted,
  amber: HOLO_COLORS.amber,
  red: HOLO_COLORS.redMuted,
  purple: HOLO_COLORS.purple,
  gold: HOLO_COLORS.goldAccent,
  textPrimary: HOLO_COLORS.textPrimary,
  textSecondary: HOLO_COLORS.textSecondary,
  textMuted: HOLO_COLORS.textMuted,
  borderSubtle: HOLO_COLORS.borderSubtle,
};

const TABS = [
  { id: 'scoring', label: 'Scoring', icon: Target, color: C.amber },
  { id: 'baggerbomb', label: 'BaggerBomb', icon: Swords, color: C.red },
  { id: 'snake', label: 'Snake Draft', icon: Users, color: C.green },
  { id: 'training', label: 'Training', icon: GraduationCap, color: C.purple },
];

// ── Reusable style helpers ──────────────────────────────────────────

const sectionCard = (accentColor) => ({
  background: C.card,
  border: `1px solid rgba(0,217,255,0.12)`,
  borderRadius: 12,
  padding: 16,
  marginBottom: 14,
  borderLeft: `3px solid ${accentColor}`,
  position: 'relative',
});

const sectionTitle = (color) => ({
  fontSize: 14,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color,
  marginBottom: 10,
});

const thresholdRow = (color) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: `${color}08`,
  border: `1px solid ${color}18`,
  borderRadius: 8,
  padding: '8px 12px',
  marginBottom: 6,
});

const bulletItem = {
  display: 'flex',
  gap: 8,
  marginBottom: 8,
  lineHeight: 1.5,
  fontSize: 13,
  color: C.textSecondary,
};

const bulletDot = (color = C.primary) => ({
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: color,
  flexShrink: 0,
  marginTop: 7,
});

const calloutBox = (color) => ({
  background: `${color}0a`,
  border: `1px solid ${color}25`,
  borderRadius: 8,
  padding: 12,
  fontSize: 12,
  color: C.textSecondary,
  lineHeight: 1.5,
});

const formulaBox = {
  background: 'rgba(0,217,255,0.06)',
  border: '1px solid rgba(0,217,255,0.15)',
  borderRadius: 8,
  padding: 12,
  fontFamily: 'monospace',
  fontSize: 12,
  color: C.primary,
  textAlign: 'center',
  lineHeight: 1.8,
};

// ── Tab content renderers ───────────────────────────────────────────

function ScoringTab() {
  return (
    <>
      {/* What Is BaggerBomb Scoring? */}
      <div style={sectionCard(C.amber)}>
        <div style={sectionTitle(C.amber)}>What Is BaggerBomb Scoring?</div>
        <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
          Think of a BaggerBomb like a touchdown in football. In football, moving the ball down the field earns yards — but crossing into the end zone earns a big bonus. BaggerBomb scoring works the same way.
        </p>
        <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: '10px 0 0' }}>
          Every stock and crypto earns base points from normal price movement — that's your yardage. But each asset also has a volatility threshold. When a price swing crosses that threshold, you score a BaggerBomb — a big bonus on top of your base points. Drop past the threshold the wrong way, and you take a Bust — the equivalent of a turnover.
        </p>
      </div>

      {/* Your Score */}
      <div style={sectionCard(C.primary)}>
        <div style={sectionTitle(C.primary)}>Your Score</div>
        <div style={formulaBox}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>TOTAL SCORE = Base Points + BaggerBombs − Busts</div>
          <div style={{ marginTop: 4, color: C.textSecondary }}>Base = price change % × 10 × conviction multiplier</div>
        </div>
      </div>

      {/* Positive Thresholds */}
      <div style={sectionCard(C.green)}>
        <div style={sectionTitle(C.green)}>Positive Thresholds</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
          When your asset's price move exceeds its threshold, bonus points lock in — even if the price reverses later.
        </p>
        {[
          { emoji: '💣', name: 'BaggerBomb', mult: '1.0×', pts: '+15', color: C.green },
          { emoji: '💣💣', name: 'Double Bagger', mult: '1.5×', pts: '+30', color: C.green },
          { emoji: '🚀💣', name: 'TenBagger', mult: '2.0×', pts: '+50', color: C.green },
        ].map((r) => (
          <div key={r.name} style={thresholdRow(r.color)}>
            <span style={{ fontSize: 13, color: C.textPrimary }}>{r.emoji} {r.name}</span>
            <span style={{ fontSize: 12, color: C.textSecondary }}>
              <span style={{ marginRight: 12 }}>{r.mult}</span>
              <span style={{ color: r.color, fontWeight: 700 }}>{r.pts}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Negative Thresholds */}
      <div style={sectionCard(C.red)}>
        <div style={sectionTitle(C.red)}>Negative Thresholds</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
          If an asset drops past its negative threshold, you take penalty points. Busts hurt — choose wisely.
        </p>
        {[
          { emoji: '📉', name: 'Bust', mult: '−1.0×', pts: '−10', color: C.red },
          { emoji: '💥', name: 'Crash', mult: '−1.5×', pts: '−20', color: C.red },
          { emoji: '🔥', name: 'Meltdown', mult: '−2.0×', pts: '−35', color: C.red },
        ].map((r) => (
          <div key={r.name} style={thresholdRow(r.color)}>
            <span style={{ fontSize: 13, color: C.textPrimary }}>{r.emoji} {r.name}</span>
            <span style={{ fontSize: 12, color: C.textSecondary }}>
              <span style={{ marginRight: 12 }}>{r.mult}</span>
              <span style={{ color: r.color, fontWeight: 700 }}>{r.pts}</span>
            </span>
          </div>
        ))}
      </div>

      {/* How Thresholds Work */}
      <div style={sectionCard(C.primary)}>
        <div style={sectionTitle(C.primary)}>How Thresholds Work</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
          Each asset's threshold is calculated using our proprietary volatility formula. It measures how much a stock or crypto typically moves, then sets a personalized target for that asset.
        </p>
        {[
          { bold: 'Unique per asset', desc: '— volatile stocks have wider thresholds, stable stocks have tighter ones' },
          { bold: 'Adapts over time', desc: '— during calm markets thresholds tighten, during wild markets they widen — keeping the game balanced' },
          { bold: 'Stocks vs Crypto', desc: '— crypto thresholds are generally wider since crypto is more volatile' },
          { bold: 'Locked at battle start', desc: '— your thresholds won\'t change mid-battle' },
        ].map((item) => (
          <div key={item.bold} style={bulletItem}>
            <div style={bulletDot()} />
            <div><span style={{ color: C.textPrimary, fontWeight: 600 }}>{item.bold}</span> <span>{item.desc}</span></div>
          </div>
        ))}
        <div style={{ ...calloutBox(C.primary), marginTop: 10 }}>
          <strong style={{ color: C.primary }}>Example:</strong> NVDA has a ~2.8% threshold. If NVDA moves +2.8% from baseline → BaggerBomb (+15 pts). If it keeps going to +4.2% (1.5×) → Double Bagger (+30 pts). If it drops −2.8% instead → Bust (−10 pts).
        </div>
      </div>

      {/* Conviction Multipliers */}
      <div style={sectionCard(C.gold)}>
        <div style={sectionTitle(C.gold)}>Conviction Multipliers</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
          In PvP, each stock in your 7-asset roster is assigned a conviction tier. Higher conviction amplifies your base points — both gains and losses.
        </p>
        {[
          { emoji: '⭐', name: 'Star', mult: '2.0×', color: C.gold },
          { emoji: '💎', name: 'Core', mult: '1.5×', color: C.primary },
          { emoji: '🛡️', name: 'Support', mult: '1.0×', color: C.textMuted },
        ].map((r) => (
          <div key={r.name} style={thresholdRow(r.color)}>
            <span style={{ fontSize: 13, color: C.textPrimary }}>{r.emoji} {r.name}</span>
            <span style={{ fontSize: 13, color: r.color, fontWeight: 700 }}>{r.mult}</span>
          </div>
        ))}
        <p style={{ fontSize: 11, color: C.textMuted, margin: '10px 0 0', lineHeight: 1.5 }}>
          Threshold bonus points (+15/+30/+50 and −10/−20/−35) are always flat — conviction only multiplies base points.
        </p>
      </div>
    </>
  );
}

function BaggerBombTab() {
  return (
    <>
      {/* BaggerBomb Battle */}
      <div style={sectionCard(C.red)}>
        <div style={sectionTitle(C.red)}>BaggerBomb Battle</div>
        <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
          Head-to-head against another player. Build a 7-stock roster, assign conviction tiers, and compete using real market prices. Battles can start anytime — your starting prices depend on when you begin.
        </p>
      </div>

      {/* Build Your Roster */}
      <div style={sectionCard(C.primary)}>
        <div style={sectionTitle(C.primary)}>Build Your Roster</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
          Select exactly 7 stocks and assign each a conviction tier:
        </p>
        {[
          { emoji: '⭐', text: '1 Star pick', desc: '— your highest-conviction play', color: C.gold },
          { emoji: '💎', text: '2 Core picks', desc: '— strong secondary bets', color: C.primary },
          { emoji: '🛡️', text: '4 Support picks', desc: '— portfolio foundation', color: C.textMuted },
        ].map((r) => (
          <div key={r.text} style={bulletItem}>
            <span style={{ flexShrink: 0 }}>{r.emoji}</span>
            <div><span style={{ color: r.color, fontWeight: 600 }}>{r.text}</span> <span>{r.desc}</span></div>
          </div>
        ))}
      </div>

      {/* When Does It Start? */}
      <div style={sectionCard(C.amber)}>
        <div style={sectionTitle(C.amber)}>When Does It Start?</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
          Battles can be created anytime. Your starting prices depend on when the battle begins:
        </p>
        {[
          { emoji: '🌅', title: 'Created before market open', desc: 'Battle starts at 9:30 AM ET. Starting prices = previous close.' },
          { emoji: '⚡', title: 'Created during market hours', desc: 'Battle starts immediately. Starting prices = live price at that moment.' },
          { emoji: '🌙', title: 'Created after market close', desc: 'Battle starts next trading day at open. Starting prices = most recent close.' },
        ].map((s) => (
          <div key={s.title} style={{ ...calloutBox(C.amber), marginBottom: 8 }}>
            <div style={{ fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{s.emoji} {s.title}</div>
            <div>{s.desc}</div>
          </div>
        ))}
        <div style={{ ...calloutBox(C.primary), marginTop: 4 }}>
          <strong style={{ color: C.primary }}>Crypto Exception:</strong> Crypto prices start updating the moment the battle begins, regardless of time — crypto never sleeps.
        </div>
      </div>

      {/* Free Agent Swaps */}
      <div style={sectionCard(C.green)}>
        <div style={sectionTitle(C.green)}>Free Agent Swaps</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
          During battle, a rotating pool of free agents appears. Swap out underperformers for fresh picks.
        </p>
        {[
          { bold: '3 swaps per day', desc: '— per battle, resets at market open' },
          { bold: 'Points lock in', desc: '— swapped-out stock keeps its earned points' },
          { bold: 'New stock starts fresh', desc: '— scored from its current price at swap time' },
        ].map((item) => (
          <div key={item.bold} style={bulletItem}>
            <div style={bulletDot(C.green)} />
            <div><span style={{ color: C.textPrimary, fontWeight: 600 }}>{item.bold}</span> <span>{item.desc}</span></div>
          </div>
        ))}
      </div>

      {/* Key Rules */}
      <div style={sectionCard(C.primary)}>
        <div style={sectionTitle(C.primary)}>Key Rules</div>
        {[
          { bold: 'Uses real market prices', desc: '— tracked via live WebSocket feeds' },
          { bold: 'Overnight moves count', desc: '— earnings, news, pre-market — it all matters' },
          { bold: 'Both rosters visible', desc: '— you and your opponent can see each other\'s picks' },
          { bold: 'Weekdays only', desc: '— no weekend battles — use weekends for research' },
        ].map((item) => (
          <div key={item.bold} style={bulletItem}>
            <div style={bulletDot()} />
            <div><span style={{ color: C.textPrimary, fontWeight: 600 }}>{item.bold}</span> <span>{item.desc}</span></div>
          </div>
        ))}
      </div>

      {/* Rewards */}
      <div style={sectionCard(C.gold)}>
        <div style={sectionTitle(C.gold)}>Rewards</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...thresholdRow(C.green), flex: 1, justifyContent: 'center' }}>
            <span style={{ color: C.green, fontWeight: 700, fontSize: 14 }}>Win: 150 XP</span>
          </div>
          <div style={{ ...thresholdRow(C.red), flex: 1, justifyContent: 'center' }}>
            <span style={{ color: C.red, fontWeight: 700, fontSize: 14 }}>Loss: 50 XP</span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: C.textMuted, margin: '8px 0 0', textAlign: 'center' }}>
          Affects your W/L record.
        </p>
      </div>
    </>
  );
}

function SnakeDraftTab() {
  return (
    <>
      {/* Snake Draft */}
      <div style={sectionCard(C.green)}>
        <div style={sectionTitle(C.green)}>Snake Draft</div>
        <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
          4-player draft competition over 5 trading days. Draft your 9-asset roster, then compete with daily scoring and free agency swaps.
        </p>
      </div>

      {/* The Draft */}
      <div style={sectionCard(C.primary)}>
        <div style={sectionTitle(C.primary)}>The Draft</div>
        {[
          { bold: '4 players', desc: '— human or CPU opponents' },
          { bold: '9 rounds', desc: '— snake order — 1→2→3→4, then 4→3→2→1, repeat' },
          { bold: '2 min per pick', desc: '— auto-pick if timer runs out' },
          { bold: '75 assets', desc: '— in the pool (stocks or crypto)' },
        ].map((item) => (
          <div key={item.bold} style={bulletItem}>
            <div style={bulletDot()} />
            <div><span style={{ color: C.textPrimary, fontWeight: 600 }}>{item.bold}</span> <span>{item.desc}</span></div>
          </div>
        ))}
      </div>

      {/* Category Requirements */}
      <div style={sectionCard(C.amber)}>
        <div style={sectionTitle(C.amber)}>Category Requirements</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
          You must draft exactly 3 from each category:
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Steady', color: C.primary },
            { label: 'Risky', color: C.amber },
            { label: 'Defensive', color: C.green },
          ].map((cat) => (
            <div key={cat.label} style={{
              flex: 1,
              textAlign: 'center',
              background: `${cat.color}0a`,
              border: `1px solid ${cat.color}25`,
              borderRadius: 8,
              padding: '10px 0',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: cat.color }}>3</div>
              <div style={{ fontSize: 11, color: cat.color, fontWeight: 600, marginTop: 2 }}>{cat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Battle Week */}
      <div style={sectionCard(C.amber)}>
        <div style={sectionTitle(C.amber)}>Battle Week</div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
          After drafting, all 4 players compete across 5 trading days. Each day is scored independently using BaggerBomb scoring — daily totals stack into your final score.
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((d) => (
            <div key={d} style={{
              flex: 1,
              textAlign: 'center',
              background: `${C.amber}12`,
              border: `1px solid ${C.amber}25`,
              borderRadius: 6,
              padding: '6px 0',
              fontSize: 11,
              color: C.amber,
              fontWeight: 600,
            }}>
              Day {d}
            </div>
          ))}
        </div>
      </div>

      {/* Daily Scoring */}
      <div style={sectionCard(C.primary)}>
        <div style={sectionTitle(C.primary)}>Daily Scoring</div>
        {[
          { bold: 'Resets each morning', desc: '— scores based on that day\'s open price' },
          { bold: 'BaggerBomb thresholds apply daily', desc: '— same threshold, fresh baseline' },
          { bold: 'Weekly total', desc: '— sum of all 5 daily scores determines final standings' },
          { bold: 'No conviction tiers', desc: '— all 9 assets scored equally in Snake Draft' },
        ].map((item) => (
          <div key={item.bold} style={bulletItem}>
            <div style={bulletDot()} />
            <div><span style={{ color: C.textPrimary, fontWeight: 600 }}>{item.bold}</span> <span>{item.desc}</span></div>
          </div>
        ))}
      </div>

      {/* Free Agency */}
      <div style={sectionCard(C.amber)}>
        <div style={sectionTitle(C.amber)}>Free Agency</div>
        {[
          { bold: 'After market close', desc: '— each day (4:00 PM ET)' },
          { bold: '2 swaps per day', desc: '— maximum' },
          { bold: 'Category balance', desc: '— must stay 3/3/3 (Steady/Risky/Defensive)' },
          { bold: 'Points banked', desc: '— old asset\'s past days stay, new asset starts fresh' },
        ].map((item) => (
          <div key={item.bold} style={bulletItem}>
            <div style={bulletDot(C.amber)} />
            <div><span style={{ color: C.textPrimary, fontWeight: 600 }}>{item.bold}</span> <span>{item.desc}</span></div>
          </div>
        ))}
      </div>

      {/* Rewards */}
      <div style={sectionCard(C.gold)}>
        <div style={sectionTitle(C.gold)}>Rewards</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { place: '1st', xp: '200 XP', color: C.gold },
            { place: '2nd', xp: '125 XP', color: HOLO_COLORS.silver },
            { place: '3rd', xp: '75 XP', color: HOLO_COLORS.bronze },
            { place: '4th', xp: '50 XP', color: C.textMuted },
          ].map((r) => (
            <div key={r.place} style={{
              flex: 1,
              minWidth: 70,
              textAlign: 'center',
              background: `${r.color}0a`,
              border: `1px solid ${r.color}25`,
              borderRadius: 8,
              padding: '8px 0',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.place}</div>
              <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{r.xp}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: C.textMuted, margin: '8px 0 0', textAlign: 'center' }}>
          Affects your W/L record.
        </p>
      </div>
    </>
  );
}

function TrainingTab() {
  return (
    <>
      {/* Training Mode */}
      <div style={sectionCard(C.purple)}>
        <div style={sectionTitle(C.purple)}>Training Mode</div>
        <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
          Practice against a CPU opponent with simplified scoring. No pressure — training doesn't affect your W/L record.
        </p>
      </div>

      {/* How It Works */}
      <div style={sectionCard(C.primary)}>
        <div style={sectionTitle(C.primary)}>How It Works</div>
        {[
          { bold: '1 vs CPU', desc: '— no other human players' },
          { bold: 'Market hours only', desc: '— 9:30 AM – 8:00 PM ET, Mon–Fri' },
          { bold: 'Same roster rules', desc: '— 7 stocks with conviction tiers' },
          { bold: 'Shorter duration', desc: '— single session, not a full trading day' },
        ].map((item) => (
          <div key={item.bold} style={bulletItem}>
            <div style={bulletDot()} />
            <div><span style={{ color: C.textPrimary, fontWeight: 600 }}>{item.bold}</span> <span>{item.desc}</span></div>
          </div>
        ))}
      </div>

      {/* Simplified Scoring */}
      <div style={sectionCard(C.amber)}>
        <div style={sectionTitle(C.amber)}>Simplified Scoring</div>
        {[
          { bold: 'Thresholds reduced ~30%', desc: '— more breakouts in less time' },
          { bold: 'BaggerBomb: +15 pts', desc: '— per positive threshold crossed' },
          { bold: 'Bust: −10 pts', desc: '— per negative threshold crossed' },
          { bold: 'Conviction multipliers apply', desc: '— Star 2×, Core 1.5×, Support 1×' },
        ].map((item) => (
          <div key={item.bold} style={bulletItem}>
            <div style={bulletDot(C.amber)} />
            <div><span style={{ color: C.textPrimary, fontWeight: 600 }}>{item.bold}</span> <span>{item.desc}</span></div>
          </div>
        ))}
      </div>

      {/* Rewards */}
      <div style={sectionCard(C.purple)}>
        <div style={sectionTitle(C.purple)}>Rewards</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...thresholdRow(C.purple), flex: 1, justifyContent: 'center' }}>
            <span style={{ color: C.purple, fontWeight: 700, fontSize: 14 }}>Win: 10 XP</span>
          </div>
          <div style={{ ...thresholdRow(C.purple), flex: 1, justifyContent: 'center' }}>
            <span style={{ color: C.purple, fontWeight: 700, fontSize: 14 }}>Loss: 5 XP</span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: C.textMuted, margin: '8px 0 0', textAlign: 'center' }}>
          Does NOT affect your W/L record.
        </p>
      </div>

      {/* Disclaimer */}
      <div style={{
        background: `linear-gradient(135deg, ${C.purple}0a, ${C.primary}0a)`,
        border: `1px solid ${C.purple}25`,
        borderRadius: 8,
        padding: 12,
        fontSize: 12,
        color: C.textSecondary,
        lineHeight: 1.5,
      }}>
        Training uses simplified single-session scoring with reduced thresholds. Real PvP battles run a full trading day with full thresholds and free agent swaps.
      </div>
    </>
  );
}

// ── Main Modal ──────────────────────────────────────────────────────

export default function MarketClashRulesModal({ onClose, defaultTab = 'scoring' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'scoring': return <ScoringTab />;
      case 'baggerbomb': return <BaggerBombTab />;
      case 'snake': return <SnakeDraftTab />;
      case 'training': return <TrainingTab />;
      default: return <ScoringTab />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'rgba(0,0,0,0.85)',
    }} onClick={onClose}>
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: C.bg,
          borderRadius: 16,
          border: `1px solid ${C.borderSubtle}`,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: `1px solid ${C.borderSubtle}`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
            MarketClash Rules
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.textMuted,
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Bar */}
        <div style={{
          display: 'flex',
          padding: '8px 12px',
          gap: 4,
          borderBottom: `1px solid ${C.borderSubtle}`,
        }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '8px 2px',
                  borderRadius: 8,
                  border: isActive ? `1px solid ${tab.color}40` : '1px solid transparent',
                  background: isActive ? `linear-gradient(180deg, ${tab.color}15, transparent)` : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={16} color={isActive ? tab.color : C.textMuted} />
                <span style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? tab.color : C.textMuted,
                  whiteSpace: 'nowrap',
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
          }}
        >
          {renderContent()}
        </div>

        {/* Bottom CTA */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.borderSubtle}` }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, ${HOLO_COLORS.cyan})`,
              color: '#000',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: `0 0 20px rgba(0,217,255,0.4)`,
            }}
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
}
