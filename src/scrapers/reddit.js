import snoowrap from 'snoowrap';
import { log } from '../logger.js';

export async function scrape() {
  log.info('Scraping Reddit AI subreddits...');
  try {
    if (!process.env.REDDIT_CLIENT_ID) {
      log.warn('Reddit credentials missing. Skipping Reddit scraper.');
      return [];
    }

    const r = new snoowrap({
      userAgent: 'LinkedIn-Post-Maker/1.0.0',
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      username: process.env.REDDIT_USERNAME,
      password: process.env.REDDIT_PASSWORD
    });

    const subreddits = ['MachineLearning', 'artificial', 'LocalLLaMA', 'singularity'];
    const results = [];

    for (const sub of subreddits) {
      const hotPosts = await r.getSubreddit(sub).getHot({ limit: 5 });
      
      for (const post of hotPosts) {
        if (post.score > 50 && !post.stickied) {
          results.push({
            title: post.title,
            description: post.selftext ? post.selftext.substring(0, 500) : `Reddit discussion with ${post.num_comments} comments.`,
            url: `https://reddit.com${post.permalink}`,
            sourceType: 'reddit',
            engagementRaw: post.score,
            publishedAt: new Date(post.created_utc * 1000).toISOString(),
            imageUrl: null
          });
        }
      }
    }

    // Sort by score descending and take top 5
    return results.sort((a, b) => b.engagementRaw - a.engagementRaw).slice(0, 5);

  } catch (error) {
    log.error('Reddit scraper failed', error.message);
    return [];
  }
}
