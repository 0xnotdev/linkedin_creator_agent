import axios from 'axios';
import { log } from '../logger.js';

// Scrapes X/Twitter via Nitter RSS mirrors for real-time AI takes from key voices.
// These are the people whose opinions move the AI conversation:
// When Karpathy says something, the entire AI community reacts within hours.

const AI_INFLUENCERS = [
  { handle: 'kaborecyclage',  name: 'Andrej Karpathy' },   // @karpathy
  { handle: 'ylecun',         name: 'Yann LeCun' },
  { handle: 'sama',           name: 'Sam Altman' },
  { handle: 'jimfan',         name: 'Jim Fan' },
  { handle: 'swaborecyclass', name: 'Swyx' },
  { handle: 'antirez',        name: 'Antirez' },
  { handle: 'emaborecyclase', name: 'Emad Mostaque' }
];

// Nitter instances rotate — we try multiple fallbacks
const NITTER_INSTANCES = [
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.1d4.us'
];

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'gemini', 'agent', 'vibe coding',
  'prompt', 'transformer', 'inference', 'open source', 'rag',
  'fine-tuning', 'benchmark', 'model', 'training', 'weights',
  'mcp', 'openai', 'anthropic', 'deepmind', 'loop', 'agentic'
];

function isAIRelated(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return AI_KEYWORDS.some(kw => lower.includes(kw));
}

async function tryNitterRSS(handle, instances) {
  for (const instance of instances) {
    try {
      const url = `${instance}/${handle}/rss`;
      const response = await axios.get(url, { 
        timeout: 5000,
        headers: { 'User-Agent': 'LinkedIn-Post-Maker RSS Reader' }
      });
      return response.data;
    } catch {
      continue; // Try next instance
    }
  }
  return null;
}

export async function scrape() {
  log.info('Scraping X/Twitter via Nitter for AI influencer takes...');
  
  const results = [];
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  try {
    // Also try the search-based approach with Nitter
    for (const influencer of AI_INFLUENCERS.slice(0, 3)) { // Limit to avoid rate limits
      try {
        const rssXml = await tryNitterRSS(influencer.handle, NITTER_INSTANCES);
        if (!rssXml) continue;

        // Simple XML parsing for RSS items (avoiding heavy parser for a simple structure)
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const titleRegex = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/;
        const linkRegex = /<link>([\s\S]*?)<\/link>/;
        const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
        const descRegex = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/;

        let match;
        while ((match = itemRegex.exec(rssXml)) !== null) {
          const itemXml = match[1];
          const title = titleRegex.exec(itemXml)?.[1]?.trim() || '';
          const link = linkRegex.exec(itemXml)?.[1]?.trim() || '';
          const pubDate = pubDateRegex.exec(itemXml)?.[1]?.trim();
          const desc = descRegex.exec(itemXml)?.[1]?.trim() || '';

          if (pubDate && new Date(pubDate) < oneDayAgo) continue;
          if (!isAIRelated(title) && !isAIRelated(desc)) continue;

          results.push({
            source: `x (${influencer.name})`,
            title: title.substring(0, 200),
            description: desc.replace(/<[^>]*>/g, '').substring(0, 500), // Strip HTML
            url: link.replace(/nitter\.[^/]+/, 'x.com'),
            score: 0, // We can't get engagement from RSS, but the source authority matters
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            raw: { handle: influencer.handle, name: influencer.name },
            contentType: 'hot_take'
          });
        }
      } catch (err) {
        log.debug(`Failed to fetch tweets for ${influencer.name}: ${err.message}`);
      }
    }

    // Fallback: If Nitter fails entirely, try fetching from the syndicated Twitter RSS 
    // via third-party services
    if (results.length === 0) {
      log.warn('Nitter RSS unavailable. Falling back to web search for X/Twitter content.');
      const fallbackResults = await twitterWebFallback();
      results.push(...fallbackResults);
    }

    log.info(`X/Twitter scraper found ${results.length} AI-related tweets.`);
    return results;
  } catch (error) {
    log.error('X/Twitter scraper failed', error.message);
    return [];
  }
}

async function twitterWebFallback() {
  // Use Google CSE to search for recent tweets about AI if configured
  if (!process.env.GOOGLE_CSE_ID || !process.env.GOOGLE_CSE_API_KEY) {
    return [];
  }
  
  try {
    const query = 'site:x.com AI OR LLM OR agents OR "vibe coding"';
    const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_CSE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&dateRestrict=d1&num=5`;
    const response = await axios.get(url, { timeout: 8000 });
    
    if (!response.data.items) return [];
    
    return response.data.items.map(item => ({
      source: 'x (via search)',
      title: item.title,
      description: item.snippet || '',
      url: item.link,
      score: 0,
      publishedAt: new Date().toISOString(),
      raw: item,
      contentType: 'hot_take'
    }));
  } catch (error) {
    log.warn(`Twitter web fallback failed: ${error.message}`);
    return [];
  }
}
