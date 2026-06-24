import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { log } from '../logger.js';

const parser = new Parser({
  customFields: {
    item: ['media:content', 'content:encoded']
  }
});

const FEEDS = [
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' }
];

const AI_KEYWORDS = ['ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'machine learning', 'openai', 'anthropic'];

function containsAIKeywords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return AI_KEYWORDS.some(kw => lower.includes(kw));
}

function extractImage(item) {
  // Try media:content
  if (item['media:content'] && item['media:content'].$) {
    return item['media:content'].$.url;
  }
  // Try parsing content:encoded with cheerio
  if (item['content:encoded']) {
    const $ = cheerio.load(item['content:encoded']);
    const img = $('img').first().attr('src');
    if (img) return img;
  }
  return null;
}

export async function scrape() {
  log.info('Scraping RSS feeds...');
  const results = [];
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  try {
    for (const feed of FEEDS) {
      try {
        const parsed = await parser.parseURL(feed.url);
        
        for (const item of parsed.items) {
          const pubDate = new Date(item.pubDate);
          if (pubDate < oneDayAgo) continue;
          
          // Filter feeds that aren't exclusively AI (like Ars Technica)
          if (!feed.name.includes('AI') && !containsAIKeywords(item.title) && !containsAIKeywords(item.contentSnippet)) {
            continue;
          }

          results.push({
            title: item.title,
            description: item.contentSnippet || item.content || '',
            url: item.link,
            sourceType: 'rss',
            engagementRaw: 0,
            publishedAt: pubDate.toISOString(),
            imageUrl: extractImage(item)
          });
        }
      } catch (err) {
        log.warn(`Failed to parse feed ${feed.name}: ${err.message}`);
      }
    }

    return results.slice(0, 10);
  } catch (error) {
    log.error('RSS scraper failed', error.message);
    return [];
  }
}
