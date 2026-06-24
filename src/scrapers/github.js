import axios from 'axios';
import { log } from '../logger.js';

export async function scrape() {
  log.info('Scraping GitHub for trending AI repos...');
  try {
    // Tight window: repos created in last 24 hours that are already gaining traction
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Broader topic set to catch more emerging repos
    const queries = [
      `topic:ai created:>${dateStr}`,
      `topic:llm created:>${dateStr}`,
      `topic:machine-learning created:>${dateStr}`,
      `topic:agents created:>${dateStr}`,
      `topic:rag created:>${dateStr}`
    ];

    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'LinkedIn-Post-Maker'
    };
    
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const allRepos = [];

    for (const query of queries) {
      try {
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`;
        const response = await axios.get(url, { headers, timeout: 8000 });
        
        if (response.data.items) {
          allRepos.push(...response.data.items);
        }
      } catch (err) {
        log.debug(`GitHub query "${query}" failed: ${err.message}`);
      }
    }

    // Deduplicate by repo id
    const seen = new Set();
    const unique = allRepos.filter(repo => {
      if (seen.has(repo.id)) return false;
      seen.add(repo.id);
      return true;
    });

    // Sort by stars descending
    unique.sort((a, b) => b.stargazers_count - a.stargazers_count);

    return unique.slice(0, 5).map(repo => ({
      source: 'github',
      title: repo.full_name,
      description: repo.description || 'No description provided.',
      url: repo.html_url,
      score: repo.stargazers_count,
      publishedAt: repo.created_at,
      raw: repo,
      contentType: 'repo_spotlight'
    }));

  } catch (error) {
    log.error('GitHub scraper failed', error.response?.data || error.message);
    return [];
  }
}
