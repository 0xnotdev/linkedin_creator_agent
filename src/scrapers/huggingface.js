import axios from 'axios';
import { log } from '../logger.js';

export async function scrape() {
  log.info('Scraping Hugging Face Daily Papers...');
  try {
    const url = 'https://huggingface.co/api/daily_papers?page=0&limit=5';
    const response = await axios.get(url);
    
    if (!Array.isArray(response.data) || response.data.length === 0) {
      return [];
    }

    return response.data.map(paper => ({
      title: paper.paper?.title || 'Untitled',
      description: paper.paper?.summary?.substring(0, 500) || 'No abstract available.',
      url: `https://huggingface.co/papers/${paper.paper?.id}`,
      sourceType: 'huggingface',
      engagementRaw: paper.paper?.upvotes || 0,
      publishedAt: paper.paper?.publishedAt || new Date().toISOString(),
      imageUrl: null
    }));

  } catch (error) {
    log.error('Hugging Face scraper failed', error.message);
    return [];
  }
}
