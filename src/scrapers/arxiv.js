import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { log } from '../logger.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

// Sleep function to respect 3s rate limit
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function scrape() {
  log.info('Scraping arXiv for latest AI papers...');
  try {
    const url = 'http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=5';
    
    const response = await axios.get(url);
    const parsed = parser.parse(response.data);
    
    if (!parsed.feed || !parsed.feed.entry) {
      return [];
    }
    
    const entries = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];

    return entries.slice(0, 5).map(item => ({
      title: item.title?.trim() || 'Untitled Paper',
      description: item.summary?.trim().substring(0, 500) || '',
      url: item.id?.trim() || '',
      sourceType: 'arxiv',
      engagementRaw: 0,
      publishedAt: item.published ? new Date(item.published).toISOString() : new Date().toISOString(),
      imageUrl: null
    }));

  } catch (error) {
    log.error('arXiv scraper failed', { error: error.message });
    return [];
  }
}
