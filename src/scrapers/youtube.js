import axios from 'axios';
import { log } from '../logger.js';
import dotenv from 'dotenv';
dotenv.config();

export async function scrape() {
  log.info('Scraping YouTube for trending AI videos...');
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      log.warn('YOUTUBE_API_KEY missing from .env, skipping YouTube scraper.');
      return [];
    }

    // Search for AI/LLM videos from the last 24 hours, sorted by view count
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - 1);

    const searchUrl = 'https://www.googleapis.com/youtube/v3/search';
    const response = await axios.get(searchUrl, {
      params: {
        part: 'snippet',
        q: 'AI OR LLM OR "artificial intelligence" OR "machine learning"',
        type: 'video',
        order: 'viewCount',
        publishedAfter: publishedAfter.toISOString(),
        maxResults: 5,
        key: process.env.YOUTUBE_API_KEY
      }
    });

    if (!response.data.items) return [];

    return response.data.items.map(item => ({
      title: item.snippet.title,
      description: item.snippet.description || '',
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      sourceType: 'youtube',
      engagementRaw: 0, // Search API doesn't return view count, would need a 2nd API call to videos endpoint. We'll skip for quota reasons.
      publishedAt: item.snippet.publishedAt,
      imageUrl: item.snippet.thumbnails?.high?.url || null
    }));

  } catch (error) {
    log.error('YouTube scraper failed', { error: error.response?.data || error.message });
    return [];
  }
}
