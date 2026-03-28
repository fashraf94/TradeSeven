// api/test/forge-prompt-check.js
// TEMPORARY — Verifies prompt assembly output with equipped forge rules.
// Builds a mock battle context from the agent's activeRules and calls
// buildAgentIdentityBlock() to inspect the prompt text.
// Auth: CRON_SECRET header. Remove after integration testing.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { buildAgentIdentityBlock, buildEvalSystemPrompt } from '../_utils/agentEvalPromptAssembly.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getFirebaseAdmin();
    const agentId = req.query.agentId;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId query param required' });
    }

    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists) {
      return res.status(404).json({ error: `Agent ${agentId} not found` });
    }
    const agentData = agentSnap.data();
    const activeRules = agentData.activeRules || [];

    if (activeRules.length === 0) {
      return res.status(200).json({
        agentId,
        activeRulesCount: 0,
        warning: 'No activeRules on agent. Run forge-validation first.',
      });
    }

    // Build mock battle context matching what buildAgentIdentityBlock reads
    const mockBattle = {
      agentContext: {
        agentName: agentData.name || 'TestAgent',
        archetype: agentData.archetype || 'growth_trader',
        strategyBrief: agentData.lastDecision?.strategyBrief || 'Test strategy brief for forge validation.',
        innerMonologue: agentData.lastDecision?.innerMonologue || {},
        activeDirectives: (agentData.directives || []).filter(d => d.isActive !== false).slice(0, 20),
        activeRules,
        equippedBundleIds: agentData.equippedBundleIds || [],
        riskTolerance: agentData.config?.risk || 50,
        evaluationInterval: 15,
        consolidatedInsight: agentData.consolidatedInsight || null,
      },
    };

    // Generate the identity prompt block
    const identityPrompt = buildAgentIdentityBlock(mockBattle);

    // Also generate the system prompt for completeness
    const systemPrompt = buildEvalSystemPrompt(
      agentData.name || 'TestAgent',
      agentData.archetype || 'growth_trader'
    );

    // Validate prompt structure
    const validation = {
      hasConstraintsSection: identityPrompt.includes('== CONSTRAINTS (must obey) =='),
      hasStrategySection: identityPrompt.includes('== STRATEGY PREFERENCES (should follow) =='),
      constraintLabels: [],
      strategyLabels: [],
      hasInstructionBlock: identityPrompt.includes('Check ALL constraints before executing'),
      hasForgeRulesHeader: identityPrompt.includes('YOUR FORGE RULES:'),
      systemPromptHasForgeSection: systemPrompt.includes('FORGE RULES'),
    };

    // Extract C1, C2, S1, S2 labels
    const cMatches = identityPrompt.match(/C\d+\./g) || [];
    const sMatches = identityPrompt.match(/S\d+\./g) || [];
    validation.constraintLabels = [...new Set(cMatches.map(m => m.replace('.', '')))];
    validation.strategyLabels = [...new Set(sMatches.map(m => m.replace('.', '')))];

    return res.status(200).json({
      agentId,
      agentName: agentData.name,
      activeRulesCount: activeRules.length,
      identityPrompt,
      systemPromptForgeSection: extractForgeSection(systemPrompt),
      validation,
    });
  } catch (error) {
    console.error('[forge-prompt-check] Failed:', error.message, error.stack);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/** Extract just the FORGE RULES section from the system prompt for readability */
function extractForgeSection(systemPrompt) {
  const start = systemPrompt.indexOf('━━━ FORGE RULES ━━━');
  if (start === -1) return null;
  const end = systemPrompt.indexOf('━━━', start + 20);
  if (end === -1) return systemPrompt.substring(start);
  return systemPrompt.substring(start, end).trim();
}
