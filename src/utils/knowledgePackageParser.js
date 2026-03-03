/**
 * Knowledge Package Parser
 *
 * Parses raw markdown knowledge packages from stockIntelligenceData
 * into structured data suitable for charts and visual components.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a section from the markdown by heading name.
 * Returns the text between `## SECTION_NAME` and the next `## `.
 */
function extractSection(markdown, sectionName) {
  if (!markdown) return '';
  // Match section header (case-insensitive, allow optional extra text after name)
  const pattern = new RegExp(
    `##\\s*${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*\\n`,
    'i'
  );
  const match = markdown.match(pattern);
  if (!match) return '';
  const start = match.index + match[0].length;
  // Find the next `## ` heading (but not `### `)
  const rest = markdown.slice(start);
  const nextSection = rest.search(/\n## [^#]/);
  return nextSection >= 0 ? rest.slice(0, nextSection).trim() : rest.trim();
}

/**
 * Parse a numeric value from a markdown cell.
 * Handles: $, %, commas, B/M/K suffixes, N/D, asterisk footnotes, parenthetical negatives.
 */
function parseNumericValue(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (trimmed === 'N/D' || trimmed === 'N/A' || trimmed === '—' || trimmed === '-') return null;

  // Remove asterisks/footnotes
  let cleaned = trimmed.replace(/\*+$/, '').trim();

  // Handle parenthetical negatives: (3,846) => -3846
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);

  // Remove $ sign
  cleaned = cleaned.replace(/^\$/, '');

  // Remove commas
  cleaned = cleaned.replace(/,/g, '');

  // Remove % at end (caller decides if the number is a percentage)
  cleaned = cleaned.replace(/%$/, '');

  // Handle B/M/K suffixes (e.g., "157.0" in "$B" context or standalone "1.2B")
  let multiplier = 1;
  if (/[Bb]$/.test(cleaned)) {
    multiplier = 1000; // Convert billions to millions for consistent unit
    cleaned = cleaned.replace(/[Bb]$/, '');
  } else if (/[Mm]$/.test(cleaned)) {
    cleaned = cleaned.replace(/[Mm]$/, '');
  } else if (/[Kk]$/.test(cleaned)) {
    multiplier = 0.001;
    cleaned = cleaned.replace(/[Kk]$/, '');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return (isNeg ? -num : num) * multiplier;
}

// ---------------------------------------------------------------------------
// 1. parseQuarterlyData
// ---------------------------------------------------------------------------

/**
 * Parse the 8-quarter markdown table from the knowledge package.
 *
 * @param {string} markdown - Full knowledge package text
 * @returns {{ quarters: string[], metrics: Object.<string, (number|null)[]> }}
 */
export function parseQuarterlyData(markdown) {
  const section = extractSection(markdown, '8-QUARTER FINANCIAL TRENDS');
  if (!section) return { quarters: [], metrics: {} };

  const lines = section.split('\n');

  // Find markdown table lines (start with |)
  const tableLines = lines.filter(l => l.trim().startsWith('|'));
  if (tableLines.length < 3) return { quarters: [], metrics: {} };

  // Header row — extract quarter labels
  const headerCells = tableLines[0].split('|').map(c => c.trim()).filter(Boolean);
  // First cell is "Metric", rest are quarter labels
  const quarters = headerCells.slice(1).map(q => {
    // Shorten: "Q1 2024 (Mar 31)" → "Q1 2024" or "Q4 FY24 (Jan 28, 2024)" → "Q4 FY24"
    return q.replace(/\s*\(.*\)/, '').trim();
  });

  // Skip separator row (|---|---|...)
  const dataLines = tableLines.slice(2); // skip header + separator

  const metrics = {};
  for (const line of dataLines) {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const metricName = cells[0];
    // Skip separator-looking rows
    if (/^[-:]+$/.test(metricName)) continue;

    const values = cells.slice(1).map(cell => {
      // Determine if this is a percentage metric
      const isPercent = metricName.includes('(%)') || metricName.includes('Margin');
      const isPct = cell.includes('%');
      return parseNumericValue(cell);
    });

    metrics[metricName] = values;
  }

  return { quarters, metrics };
}

// ---------------------------------------------------------------------------
// 2. parseRevenueSegments
// ---------------------------------------------------------------------------

/**
 * Parse revenue segments from REVENUE ARCHITECTURE section.
 *
 * @param {string} markdown - Full knowledge package text
 * @returns {{ totalRevenue: string|null, segments: Array<{name, revenue, growth, pctOfTotal}> }}
 */
export function parseRevenueSegments(markdown) {
  const section = extractSection(markdown, 'REVENUE ARCHITECTURE');
  if (!section) return { totalRevenue: null, segments: [] };

  // Extract total revenue from first line
  const totalMatch = section.match(
    /[Tt]otal.*?revenue.*?\$([\d,.]+)\s*(billion|million|trillion|B|M|T)/i
  );
  const totalRevenue = totalMatch ? `$${totalMatch[1]} ${totalMatch[2]}` : null;

  // Extract named segments
  // Pattern: "SegmentName: $XXX.X billion/million ... (+XX% YoY) ... XX.X% of revenue/total"
  const segments = [];
  const segmentPattern =
    /^([A-Z][\w\s\/&.-]+?):\s*\$?([\d,.]+)\s*(billion|million|B|M)/gim;

  let match;
  while ((match = segmentPattern.exec(section)) !== null) {
    const name = match[1].trim();
    const rawValue = match[2].replace(/,/g, '');
    const unit = match[3].toLowerCase();
    let revenue = parseFloat(rawValue);
    if (isNaN(revenue)) continue;

    // Normalize to millions
    if (unit === 'billion' || unit === 'b') revenue *= 1000;
    if (unit === 'trillion' || unit === 't') revenue *= 1000000;

    // Look for YoY growth in nearby text (within 200 chars after match)
    const afterMatch = section.slice(match.index, match.index + 300);
    const growthMatch = afterMatch.match(/\(?([+-]?\d+(?:\.\d+)?)\s*%\s*(?:YoY|year)/i);
    const growth = growthMatch ? parseFloat(growthMatch[1]) : null;

    // Look for % of total/revenue
    const pctMatch = afterMatch.match(/([\d.]+)\s*%\s*of\s*(?:total|revenue)/i);
    const pctOfTotal = pctMatch ? parseFloat(pctMatch[1]) : null;

    // Skip lines that are clearly not segments (like "Total FY2025 revenue")
    if (/^total/i.test(name)) continue;

    segments.push({ name, revenue, growth, pctOfTotal });
  }

  return { totalRevenue, segments };
}

// ---------------------------------------------------------------------------
// 3. parseCompetitivePosition
// ---------------------------------------------------------------------------

/**
 * Parse competitive position data from COMPETITIVE POSITION section.
 *
 * @param {string} markdown - Full knowledge package text
 * @returns {{ arenas: Array<{name, players: Array<{name, share, isCompany}>}> }}
 */
export function parseCompetitivePosition(markdown) {
  const section = extractSection(markdown, 'COMPETITIVE POSITION');
  if (!section) return { arenas: [] };

  // Split into paragraphs/arenas by double newline or topic sentence
  const paragraphs = section.split(/\n\n+/).filter(p => p.trim().length > 30);

  const arenas = [];
  // Words that are clearly not company/entity names
  const stopWords = new Set([
    'the', 'a', 'an', 'this', 'that', 'these', 'those', 'its', 'their',
    'however', 'but', 'also', 'both', 'all', 'each', 'every',
    'bloomberg', 'techinsights', 'ubs', 'jon peddie research', 'synergy',
    'nielsen', 'justwatch', 'research', 'intelligence', 'estimates',
    'projects', 'reported', 'shows', 'according',
  ]);

  for (const para of paragraphs) {
    // Try to extract a topic name from the first phrase (case-insensitive for "AI accelerator market:")
    const topicMatch = para.match(
      /^([A-Za-z][\w\s/&-]+?)(?:\s*\(|\s*:|\s*—|\s+market|\s+infrastructure|\s+positioning)/
    );
    if (!topicMatch) continue;
    let arenaName = topicMatch[1].trim().replace(/^(US\s+)?/i, '');
    // Clean up arena name — capitalize first letter
    arenaName = arenaName.charAt(0).toUpperCase() + arenaName.slice(1);
    if (arenaName.length > 40) arenaName = arenaName.slice(0, 40).trim();

    // Extract "Entity XX%" patterns — multiple strategies for entity + share extraction
    // Pattern 1: "Entity XX%" or "Entity holds/claims XX%"
    const sharePattern = /([A-Z][\w.'&-]*(?:\s+[A-Z][\w.'&-]*){0,3})(?:'s)?(?:\s+[\w]+)?\s+(?:holds?\s+|claims?\s+|controls?\s+|at\s+|with\s+)?(?:approximately\s+|roughly\s+|about\s+)?(\d{1,3}(?:\.\d+)?)\s*%/g;
    const players = [];
    const seen = new Set();
    let shareMatch;

    while ((shareMatch = sharePattern.exec(para)) !== null) {
      let playerName = shareMatch[1].trim();
      const share = parseFloat(shareMatch[2]);

      // Filter out nonsense values
      if (share > 100 || share < 0.5) continue;

      // Filter out research firm names and non-entity words
      const lowerName = playerName.toLowerCase();
      if (stopWords.has(lowerName)) continue;
      if (/\b(research|intelligence|estimates|projects|reported)\b/i.test(playerName)) continue;

      // Deduplicate
      if (seen.has(lowerName)) continue;
      seen.add(lowerName);

      players.push({ name: playerName, share, isCompany: false });
    }

    if (players.length >= 2) {
      arenas.push({ name: arenaName, players });
    }
  }

  return { arenas };
}

/**
 * Mark the subject company in competitive arenas.
 *
 * @param {{ arenas: Array }} competitive - Parsed competitive data
 * @param {string} companyName - Short company name to match
 */
export function markSubjectCompany(competitive, companyName) {
  if (!competitive?.arenas || !companyName) return competitive;
  const lower = companyName.toLowerCase();
  for (const arena of competitive.arenas) {
    for (const player of arena.players) {
      if (player.name.toLowerCase().includes(lower)) {
        player.isCompany = true;
      }
    }
  }
  return competitive;
}

// ---------------------------------------------------------------------------
// 4. parseRisks
// ---------------------------------------------------------------------------

// Word lists for scoring
const HIGH_IMPACT_WORDS = [
  'critical', 'massive', 'fundamental', 'existential', 'permanently',
  'structural', 'catastrophic', 'dominant', 'extreme', 'collapse',
  'dramatically', 'profound', 'devastating', 'immense', 'revolutionary',
];
const MED_IMPACT_WORDS = [
  'significant', 'meaningful', 'growing', 'increasing', 'substantial',
  'considerable', 'notable', 'important', 'major', 'escalating',
];
const LOW_IMPACT_WORDS = [
  'moderate', 'manageable', 'minor', 'incremental', 'limited',
  'modest', 'gradual', 'slight',
];

const HIGH_PROB_WORDS = [
  'already', 'ongoing', 'currently', 'has', 'proven', 'demonstrates',
  'continues', 'consistently', 'routinely', 'established',
];
const MED_PROB_WORDS = [
  'could', 'may', 'potential', 'risk', 'threatens', 'emerging',
  'possible', 'likely', 'plausible',
];
const LOW_PROB_WORDS = [
  'unlikely', 'remote', 'theoretical', 'hypothetical', 'speculative',
  'improbable',
];

function scoreFromWords(text, highWords, medWords, lowWords, defaultVal) {
  const lower = text.toLowerCase();
  let highCount = 0, medCount = 0, lowCount = 0;
  for (const w of highWords) if (lower.includes(w)) highCount++;
  for (const w of medWords) if (lower.includes(w)) medCount++;
  for (const w of lowWords) if (lower.includes(w)) lowCount++;

  if (highCount >= 2) return 0.85 + Math.min(highCount - 2, 3) * 0.03;
  if (highCount === 1) return 0.7 + medCount * 0.03;
  if (medCount >= 2) return 0.5 + Math.min(medCount - 2, 3) * 0.05;
  if (medCount === 1) return 0.45;
  if (lowCount >= 1) return 0.25;
  return defaultVal;
}

const CATEGORY_KEYWORDS = {
  regulatory: ['regulatory', 'antitrust', 'tariff', 'government', 'compliance', 'ftc', 'sec', 'eu ', 'gdpr'],
  geopolitical: ['china', 'geopolitical', 'export', 'trade', 'sanctions', 'border', 'sovereign'],
  technical: ['technical', 'technology', 'architecture', 'engineering', 'silicon', 'chip', 'software'],
  market: ['market', 'valuation', 'cycle', 'recession', 'bubble', 'pricing', 'competition'],
};

function classifyRiskCategory(text) {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cat;
    }
  }
  return 'business';
}

/**
 * Parse risk assessments from QUALITATIVE INTELLIGENCE section.
 *
 * @param {string} markdown - Full knowledge package text
 * @returns {{ risks: Array<{name, description, impact, probability, category}> }}
 */
export function parseRisks(markdown) {
  const section = extractSection(markdown, 'QUALITATIVE INTELLIGENCE');
  if (!section) return { risks: [] };

  const paragraphs = section.split(/\n\n+/).filter(p => p.trim().length > 50);

  const risks = [];
  for (const para of paragraphs) {
    // Extract title: bold header or first sentence
    let name;
    const boldMatch = para.match(/\*\*([^*]+)\*\*/);
    if (boldMatch) {
      name = boldMatch[1];
    } else {
      // First sentence up to colon or period
      const sentenceMatch = para.match(/^(.+?)(?:[:.]\s)/);
      name = sentenceMatch ? sentenceMatch[1] : para.slice(0, 60);
    }

    // Clean up name — remove "The " prefix, trim
    name = name.replace(/^The\s+/i, '').replace(/\s*—\s*$/, '').trim();
    if (name.length > 80) name = name.slice(0, 77) + '...';

    // Description: first 200 chars of paragraph
    const description = para.replace(/\*\*/g, '').trim().slice(0, 200);

    const impact = scoreFromWords(para, HIGH_IMPACT_WORDS, MED_IMPACT_WORDS, LOW_IMPACT_WORDS, 0.5);
    const probability = scoreFromWords(para, HIGH_PROB_WORDS, MED_PROB_WORDS, LOW_PROB_WORDS, 0.45);
    const category = classifyRiskCategory(para);

    risks.push({ name, description, impact, probability, category });
  }

  return { risks };
}

// ---------------------------------------------------------------------------
// 5. parseFinancialHealth
// ---------------------------------------------------------------------------

/**
 * Parse financial health metrics from FINANCIAL HEALTH section.
 *
 * @param {string} markdown - Full knowledge package text
 * @returns {{ ocf, fcf, opMargin, grossMargin, capex, rdSpending, rdPctRevenue }}
 */
export function parseFinancialHealth(markdown) {
  const section = extractSection(markdown, 'FINANCIAL HEALTH');
  if (!section) return {};

  const result = {};

  // Gross margin (handles "gross margin: 73.4%" and "gross margin: approximately 54.5%")
  const gmMatch = section.match(/[Gg]ross margin:?\s*(?:approximately\s+)?([\d.]+)%/);
  if (gmMatch) result.grossMargin = parseFloat(gmMatch[1]);

  // Operating margin
  const omMatch = section.match(/[Oo]perating margin:?\s*([\d.]+)%/);
  if (omMatch) result.opMargin = parseFloat(omMatch[1]);

  // Also look for "Overall operating margin: XX.X%"
  if (!result.opMargin) {
    const omMatch2 = section.match(/operating margin:?\s*([\d.]+)%/i);
    if (omMatch2) result.opMargin = parseFloat(omMatch2[1]);
  }

  // Operating cash flow
  const ocfMatch = section.match(
    /[Oo]perating cash flow[^:]*?:?\s*\$?([\d,.]+)\s*(billion|million|B|M)/i
  );
  if (ocfMatch) {
    let val = parseFloat(ocfMatch[1].replace(/,/g, ''));
    const unit = ocfMatch[2].toLowerCase();
    if (unit === 'billion' || unit === 'b') val *= 1000;
    result.ocf = val;
  }

  // Free cash flow
  const fcfMatch = section.match(
    /[Ff]ree cash flow[^:]*?:?\s*\$?([\d,.]+)\s*(billion|million|B|M)/i
  );
  if (fcfMatch) {
    let val = parseFloat(fcfMatch[1].replace(/,/g, ''));
    const unit = fcfMatch[2].toLowerCase();
    if (unit === 'billion' || unit === 'b') val *= 1000;
    result.fcf = val;
  }

  // Capital expenditure
  const capexMatch = section.match(
    /[Cc]apital expenditure[^:]*?:?\s*\$?([\d,.]+)\s*(billion|million|B|M)/i
  );
  if (capexMatch) {
    let val = parseFloat(capexMatch[1].replace(/,/g, ''));
    const unit = capexMatch[2].toLowerCase();
    if (unit === 'billion' || unit === 'b') val *= 1000;
    result.capex = val;
  }

  // R&D spending — use tighter match to avoid capturing other metrics
  const rdMatch = section.match(
    /R&D\s*(?:spending|investment|expense)?[^.]*?\$\s*([\d,.]+)\s*(billion|million|B|M)/i
  );
  if (rdMatch) {
    let val = parseFloat(rdMatch[1].replace(/,/g, ''));
    const unit = rdMatch[2].toLowerCase();
    if (unit === 'billion' || unit === 'b') val *= 1000;
    result.rdSpending = val;
  }

  // R&D as % of revenue
  const rdPctMatch = section.match(/R&D.*?([\d.]+)%\s*of\s*revenue/i);
  if (rdPctMatch) result.rdPctRevenue = parseFloat(rdPctMatch[1]);

  return result;
}

// ---------------------------------------------------------------------------
// Master parser
// ---------------------------------------------------------------------------

/**
 * Parse an entire knowledge package into structured data.
 *
 * @param {string} markdown - Full knowledge package text
 * @returns {{ quarterly, revenue, competitive, risks, health }}
 */
export function parseKnowledgePackage(markdown) {
  if (!markdown) return null;
  return {
    quarterly: parseQuarterlyData(markdown),
    revenue: parseRevenueSegments(markdown),
    competitive: parseCompetitivePosition(markdown),
    risks: parseRisks(markdown),
    health: parseFinancialHealth(markdown),
  };
}
