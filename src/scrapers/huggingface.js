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

    return response.data.map(item => {
      const paper = item.paper;
      return {
        source: 'huggingface',
        title: paper.title,
        description: paper.summary.substring(0, 500) + '...',
        url: `https://huggingface.co/papers/${paper.id}`,
        score: paper.upvotes,
        publishedAt: paper.publishedAt,
        authors: paper.authors.map(a => a.name).join(', '),
        raw: paper,
        contentType: 'paper_breakdown'
      };
    });

  } catch (error) {
    log.error('Hugging Face scraper failed', error.message);
    return [];
  }
}
