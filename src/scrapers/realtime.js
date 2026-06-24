import axios from 'axios';
import { log } from '../logger.js';

// This scraper uses Google's "Programmable Search Engine" (free, 100 queries/day)
// to find what's trending RIGHT NOW in AI/tech — the kind of stuff people
// are actually talking about this very day: hot takes, announcements, viral moments.
// This is the scraper that catches things like "Karpathy says vibe coding is dead."

const TRENDING_QUERIES = [
  'AI news today',
  'LLM announcement today',
  'new AI model released',
  'AI engineering trending',
  'AI agent framework released'
];

export async function scrape() {
  log.info('Scraping real-time web for trending AI discussions...');
  
  const results = [];

  try {
    // Strategy 1: Google Programmable Search Engine (if configured)
    if (process.env.GOOGLE_CSE_ID && process.env.GOOGLE_CSE_API_KEY) {
      const cseResults = await searchGoogleCSE();
      results.push(...cseResults);
    }
    
    // Strategy 2: Currents API (free, no key needed for limited use)
    const currentsResults = await searchCurrentsAPI();
    results.push(...currentsResults);

    // Strategy 3: Dev.to trending (no API key needed, catches community pulse)
    const devtoResults = await searchDevTo();
    results.push(...devtoResults);

    log.success(`Real-time web scraper found ${results.length} items.`);
    return results;
  } catch (error) {
    log.error('Real-time web scraper failed', error.message);
    return [];
  }
}

async function searchGoogleCSE() {
  log.info('Querying Google Custom Search...');
  const results = [];
  
  try {
    // Pick 2 random queries to stay within free daily limit (100/day)
    const shuffled = TRENDING_QUERIES.sort(() => 0.5 - Math.random());
    const selectedQueries = shuffled.slice(0, 2);

    for (const query of selectedQueries) {
      const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_CSE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&dateRestrict=d1&num=5`;
      
      const response = await axios.get(url);
      
      if (response.data.items) {
        for (const item of response.data.items) {
          results.push({
            title: item.title,
            description: item.snippet || '',
            url: item.link,
            sourceType: 'realtime',
            engagementRaw: 0,
            publishedAt: new Date().toISOString(), // These are from today by dateRestrict=d1
            imageUrl: item.pagemap?.cse_image?.[0]?.src || null
          });
        }
      }
    }
  } catch (error) {
    log.warn(`Google CSE search failed: ${error.message}`);
  }
  
  return results;
}

async function searchCurrentsAPI() {
  log.info('Querying Currents API for breaking AI news...');
  try {
    const apiKey = process.env.CURRENTS_API_KEY;
    if (!apiKey) {
      log.debug('CURRENTS_API_KEY not set, skipping.');
      return [];
    }

    const url = `https://api.currentsapi.services/v1/search?keywords=artificial+intelligence+OR+LLM+OR+AI+agent&language=en&apiKey=${apiKey}`;
    const response = await axios.get(url, { timeout: 8000 });

    if (!response.data.news || response.data.news.length === 0) {
      return [];
    }

    return response.data.news.slice(0, 5).map(article => ({
      title: article.title,
      description: article.description || '',
      url: article.url,
      sourceType: 'realtime',
      engagementRaw: 0,
      publishedAt: article.published || new Date().toISOString(),
      imageUrl: article.image !== 'None' ? article.image : null
    }));
  } catch (error) {
    log.warn(`Currents API search failed: ${error.message}`);
    return [];
  }
}

async function searchDevTo() {
  log.info('Querying Dev.to for trending AI posts...');
  try {
    // Dev.to API is completely free, no key needed
    // top=1 means "trending in the last 1 day"
    const url = 'https://dev.to/api/articles?tag=ai&top=1&per_page=5';
    const response = await axios.get(url, { timeout: 8000 });

    if (!Array.isArray(response.data) || response.data.length === 0) {
      return [];
    }

    return response.data.map(article => ({
      title: article.title,
      description: article.description || '',
      url: article.url,
      sourceType: 'realtime',
      engagementRaw: article.public_reactions_count || 0,
      publishedAt: article.published_at,
      imageUrl: article.social_image || article.cover_image || null
    }));
  } catch (error) {
    log.warn(`Dev.to search failed: ${error.message}`);
    return [];
  }
}
