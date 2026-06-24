import { isDuplicate } from './store.js';
import { createLogger } from './logger.js';

const log = createLogger('Ranker');

// Massively expanded keyword set to catch trending AI terms
const AI_KEYWORDS = [
  'agent', 'agents', 'agentic', 'llm', 'llms', 'prompt', 'rag', 'fine-tuning',
  'transformer', 'inference', 'training', 'weights', 'parameters', 'benchmark',
  'gpt', 'claude', 'gemini', 'mistral', 'llama', 'openai', 'anthropic', 'deepmind',
  'meta ai', 'cohere', 'groq', 'perplexity',
  'vllm', 'ollama', 'langchain', 'llamaindex', 'autogen', 'crewai', 'mcp',
  'cursor', 'copilot', 'devin', 'windsurf',
  'vibe coding', 'loop engineering', 'agentic loop', 'context window',
  'open source', 'reasoning', 'chain of thought', 'tool use',
  'multimodal', 'vision model', 'code generation', 'ai safety'
];

function calculateRecencyScore(publishedAt) {
  if (!publishedAt) return 0.3;
  const now = new Date();
  const pubDate = new Date(publishedAt);
  const hoursOld = (now - pubDate) / (1000 * 60 * 60);
  
  if (hoursOld < 0) return 1.0;
  
  // Exponential decay: e^(-hoursOld / 6)
  // An item from the last hour scores near 1.0, 24h old scores low.
  return Math.exp(-hoursOld / 6);
}

function calculateRelevanceScore(text) {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  
  let matches = 0;
  for (const kw of AI_KEYWORDS) {
    if (lowerText.includes(kw)) {
      matches++;
    }
  }
  
  // Normalize based on length (simplistic density) or max matches
  return Math.min(matches / 4, 1.0);
}

// Normalizes engagementRaw within each source using Min-Max scaling
function normalizeEngagement(items) {
  const sources = [...new Set(items.map(i => i.sourceType))];
  
  const normalizedItems = [...items];

  for (const source of sources) {
    const sourceItems = normalizedItems.filter(i => i.sourceType === source);
    if (sourceItems.length === 0) continue;

    // Engagement is meaningless for RSS/arXiv/Twitter
    if (['rss', 'arxiv', 'twitter', 'realtime'].includes(source)) {
      sourceItems.forEach(i => i._engagementScore = 0);
      continue;
    }

    const min = Math.min(...sourceItems.map(i => i.engagementRaw));
    const max = Math.max(...sourceItems.map(i => i.engagementRaw));
    
    sourceItems.forEach(item => {
      if (max === min) {
        item._engagementScore = max > 0 ? 1.0 : 0;
      } else {
        item._engagementScore = (item.engagementRaw - min) / (max - min);
      }
    });
  }

  return normalizedItems;
}

export function rankContent(db, rawContentItems, recentTopics = []) {
  log.info(`Ranking ${rawContentItems.length} content items...`);
  
  if (rawContentItems.length === 0) return null;

  // Pre-calculate per-source engagement normalization
  const itemsWithEngagement = normalizeEngagement(rawContentItems);
  
  const scoredItems = itemsWithEngagement.map(item => {
    const textToSearch = `${item.title} ${item.description}`;
    
    // 1. Recency (35%)
    const recencyScore = calculateRecencyScore(item.publishedAt);
    
    // 2. Engagement (30%)
    const engagementScore = item._engagementScore;
    
    // 3. Relevance (20%)
    const relevanceScore = calculateRelevanceScore(textToSearch);
    
    // 4. Novelty (15%)
    const isDup = isDuplicate(db, item.title, 30);
    const noveltyBonus = isDup ? 0 : 1.0;

    const totalScore = (recencyScore * 0.35) + 
                       (engagementScore * 0.30) + 
                       (relevanceScore * 0.20) + 
                       (noveltyBonus * 0.15);

    return {
      ...item,
      scores: {
        total: totalScore.toFixed(3),
        recency: recencyScore.toFixed(3),
        engagement: engagementScore.toFixed(3),
        relevance: relevanceScore.toFixed(3),
        novelty: noveltyBonus,
        isDuplicate: isDup
      }
    };
  });

  // Filter out duplicates directly if we have enough content
  const novelItems = scoredItems.filter(item => !item.scores.isDuplicate);
  
  if (novelItems.length === 0) {
    log.warn('No novel items found after checking duplicates. Returning null.');
    return null;
  }

  // Sort descending by total score
  novelItems.sort((a, b) => b.scores.total - a.scores.total);
  
  // Return top 5
  const top5 = novelItems.slice(0, 5);
  
  log.info('--- TOP 5 RANKED ITEMS ---');
  top5.forEach((item, i) => {
    log.info(`  #${i+1} [${item.scores.total}] (${item.sourceType}) ${item.title.substring(0, 80)}`);
  });
  
  return top5;
}
