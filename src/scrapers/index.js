import { scrape as scrapeGithub } from './github.js';
import { scrape as scrapeHN } from './hackernews.js';
import { scrape as scrapeReddit } from './reddit.js';
import { scrape as scrapeRSS } from './rss.js';
import { scrape as scrapeArxiv } from './arxiv.js';
import { scrape as scrapeHF } from './huggingface.js';
import { scrape as scrapeRealtime } from './realtime.js';
import { scrape as scrapeTwitter } from './twitter.js';
import { log } from '../logger.js';

export async function scrapeAll() {
  log.info('Starting parallel content scraping (8 sources)...');
  
  // Run all scrapers concurrently
  const results = await Promise.allSettled([
    scrapeGithub(),
    scrapeHN(),
    scrapeReddit(),
    scrapeRSS(),
    scrapeArxiv(),
    scrapeHF(),
    scrapeRealtime(),
    scrapeTwitter()
  ]);

  const sourceNames = [
    'GitHub', 'HackerNews', 'Reddit', 'RSS', 
    'arXiv', 'HuggingFace', 'Realtime Web', 'X/Twitter'
  ];

  let allContent = [];
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const count = result.value.length;
      if (count > 0) log.info(`  ${sourceNames[index]}: ${count} items`);
      allContent = allContent.concat(result.value);
    } else {
      log.error(`${sourceNames[index]} scraper failed:`, result.reason);
    }
  });

  log.success(`Scraped a total of ${allContent.length} items from ${sourceNames.length} sources.`);
  return allContent;
}
