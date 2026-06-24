import axios from 'axios';
import { log } from '../logger.js';

export async function scrape() {
  log.info('Scraping Hacker News for trending AI stories...');
  try {
    // Tight window: last 24 hours only — we want fresh content
    const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
    
    // Multiple targeted searches to catch different types of AI content
    const queries = [
      'AI OR LLM OR agents OR GPT OR Claude',
      'vibe coding OR agentic OR MCP OR fine-tuning',
      'OpenAI OR Anthropic OR DeepMind OR Mistral'
    ];

    const allHits = [];

    for (const query of queries) {
      try {
        const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${oneDayAgo}&hitsPerPage=10`;
        const response = await axios.get(url, { timeout: 8000 });
        
        if (response.data.hits) {
          allHits.push(...response.data.hits);
        }
      } catch (err) {
        log.debug(`HN query "${query}" failed: ${err.message}`);
      }
    }

    // Deduplicate by objectID
    const seen = new Set();
    const unique = allHits.filter(hit => {
      if (seen.has(hit.objectID)) return false;
      seen.add(hit.objectID);
      return true;
    });

    // Lower threshold to 10 points — a story gaining traction in <24h with 10+ points is noteworthy
    const trending = unique.filter(story => story.points > 10);

    // Sort by points descending
    trending.sort((a, b) => b.points - a.points);

    return trending.slice(0, 8).map(story => ({
      title: story.title,
      description: `HN discussion: ${story.num_comments || 0} comments, ${story.points} points.`,
      url: story.url || `https://news.ycombinator.com/item?id=${story.objectID}`,
      sourceType: 'hackernews',
      engagementRaw: story.points,
      publishedAt: new Date(story.created_at).toISOString(),
      imageUrl: null
    }));

  } catch (error) {
    log.error('Hacker News scraper failed', error.message);
    return [];
  }
}
