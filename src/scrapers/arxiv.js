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

    return entries.map(entry => {
      let authors = '';
      if (Array.isArray(entry.author)) {
        authors = entry.author.map(a => a.name).join(', ');
      } else if (entry.author) {
        authors = entry.author.name;
      }

      // Extract PDF link
      let pdfLink = entry.id;
      if (Array.isArray(entry.link)) {
        const pdf = entry.link.find(l => l['@_title'] === 'pdf');
        if (pdf) pdfLink = pdf['@_href'];
      }

      return {
        source: 'arxiv',
        title: entry.title.replace(/\n/g, ' ').trim(),
        description: entry.summary.replace(/\n/g, ' ').trim().substring(0, 500) + '...',
        url: entry.id, // Abstract page
        pdfUrl: pdfLink,
        score: 0, // arXiv doesn't have a score system
        publishedAt: entry.published,
        authors: authors,
        raw: entry,
        contentType: 'paper_breakdown'
      };
    });

  } catch (error) {
    log.error('arXiv scraper failed', error.message);
    return [];
  }
}
