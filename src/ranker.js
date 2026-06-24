import { isDuplicate } from './store.js';
import { log } from './logger.js';

// Massively expanded keyword set to catch trending AI terms
const AI_KEYWORDS = [
  // Core concepts
  'agent', 'agents', 'agentic', 'llm', 'llms', 'prompt', 'rag', 'fine-tuning',
  'transformer', 'inference', 'training', 'weights', 'parameters', 'benchmark',
  // Models & companies
  'gpt', 'claude', 'gemini', 'mistral', 'llama', 'openai', 'anthropic', 'deepmind',
  'meta ai', 'cohere', 'groq', 'perplexity',
  // Tools & frameworks
  'vllm', 'ollama', 'langchain', 'llamaindex', 'autogen', 'crewai', 'mcp',
  'cursor', 'copilot', 'devin', 'windsurf',
  // Trending terms (these rotate — update periodically)
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
  
  // Much steeper decay — aggressively favor fresh content
  // 0h = 1.0, 3h = 0.74, 6h = 0.55, 12h = 0.30, 24h = 0.09
  return Math.exp(-0.1 * hoursOld);
}

function calculateEngagementScore(item) {
  const score = item.score || 0;
  let normalized = 0;

  // Normalize engagement per source
  if (item.source === 'github') {
    normalized = Math.min(score / 300, 1.0);
  } else if (item.source === 'hackernews') {
    normalized = Math.min(score / 80, 1.0);
  } else if (item.source.startsWith('reddit')) {
    normalized = Math.min(score / 150, 1.0);
  } else if (item.source === 'huggingface') {
    normalized = Math.min(score / 30, 1.0);
  } else if (item.source === 'devto') {
    normalized = Math.min(score / 50, 1.0);
  } else if (item.source.startsWith('x (')) {
    // X/Twitter influencer posts get a flat authority bonus
    // because engagement data isn't available via RSS
    normalized = 0.7;
  } else {
    // RSS, Google CSE, Currents — no engagement data
    normalized = 0.3;
  }
  return normalized;
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
  
  // Max out at 4 distinct keywords found
  return Math.min(matches / 4, 1.0);
}

// Bonus for sources that are inherently more "postable" on LinkedIn
function calculateSourceAuthorityBonus(item) {
  if (item.source.startsWith('x (')) return 0.9;       // Influencer hot takes are goldmine
  if (item.source === 'hackernews') return 0.7;          // HN signals real community interest
  if (item.source === 'google_realtime') return 0.8;     // Breaking news
  if (item.source === 'huggingface') return 0.6;         // Research community signal
  if (item.source === 'github') return 0.6;              // New tools/repos
  if (item.source.startsWith('reddit')) return 0.5;      // Community pulse
  if (item.source === 'currents_api') return 0.5;        // News
  if (item.source.startsWith('TechCrunch')) return 0.7;  // Major tech news
  if (item.source.startsWith('VentureBeat')) return 0.6; // AI news
  if (item.source === 'devto') return 0.4;               // Developer community
  if (item.source === 'arxiv') return 0.5;               // Research papers
  return 0.3;
}

export function rankContent(rawContentItems) {
  log.info(`Ranking ${rawContentItems.length} content items...`);
  
  const scoredItems = rawContentItems.map(item => {
    const textToSearch = `${item.title} ${item.description}`;
    
    // Recency (40%) — THE most important signal. We want TODAY's content.
    const recencyScore = calculateRecencyScore(item.publishedAt);
    
    // Engagement (20%) — Social proof
    const engagementScore = calculateEngagementScore(item);
    
    // Relevance (15%) — Keyword match
    const relevanceScore = calculateRelevanceScore(textToSearch);
    
    // Source Authority (10%) — Some sources produce more "postable" content
    const authorityScore = calculateSourceAuthorityBonus(item);

    // Novelty (15%) — Haven't posted about this recently
    const isDup = isDuplicate(item.title);
    const noveltyBonus = isDup ? 0 : 1.0;

    const totalScore = (recencyScore * 0.40) + 
                       (engagementScore * 0.20) + 
                       (relevanceScore * 0.15) + 
                       (authorityScore * 0.10) +
                       (noveltyBonus * 0.15);

    return {
      ...item,
      scores: {
        total: totalScore.toFixed(3),
        recency: recencyScore.toFixed(3),
        engagement: engagementScore.toFixed(3),
        relevance: relevanceScore.toFixed(3),
        authority: authorityScore.toFixed(3),
        novelty: noveltyBonus,
        isDuplicate: isDup
      }
    };
  });

  // Filter out duplicates if we have enough content
  const novelItems = scoredItems.filter(item => !item.scores.isDuplicate);
  const itemsToRank = novelItems.length >= 5 ? novelItems : scoredItems;

  // Sort descending by total score
  itemsToRank.sort((a, b) => b.scores.total - a.scores.total);
  
  // Return top 5
  const top5 = itemsToRank.slice(0, 5);
  
  if (top5.length > 0) {
    log.info('--- TOP 5 RANKED ITEMS ---');
    top5.forEach((item, i) => {
      log.info(`  #${i+1} [${item.scores.total}] (${item.source}) ${item.title.substring(0, 80)}`);
    });
  }
  
  return top5;
}
