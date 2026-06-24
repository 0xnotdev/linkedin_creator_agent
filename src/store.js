import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { log } from './logger.js';

const dataDir = path.resolve('data');
const dbFile = path.join(dataDir, 'posts.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize JSON db if it doesn't exist
if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, JSON.stringify({ posts: [] }, null, 2), 'utf8');
}

function loadDB() {
  try {
    const data = fs.readFileSync(dbFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    log.error('Failed to load JSON database', error.message);
    return { posts: [] };
  }
}

function saveDB(db) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    log.error('Failed to save JSON database', error.message);
  }
}

function generateHash(text) {
  return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
}

export function isDuplicate(title) {
  const db = loadDB();
  const hash = generateHash(title);
  
  // Check if we've posted this topic in the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  return db.posts.some(post => {
    const postDate = new Date(post.posted_at);
    return post.topic_hash === hash && postDate > ninetyDaysAgo;
  });
}

export function recordPost(data) {
  const db = loadDB();
  
  db.posts.push({
    id: Date.now().toString(),
    topic_hash: generateHash(data.title || data.topic),
    hook_type: data.hookType,
    content_type: data.contentType,
    source_url: data.sourceUrl,
    posted_at: new Date().toISOString(),
    linkedin_urn: data.urn
  });
  
  saveDB(db);
}

export function getRecentHookTypes(n = 10) {
  const db = loadDB();
  const sorted = [...db.posts].sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at));
  return sorted.slice(0, n).map(p => p.hook_type).filter(Boolean);
}

export function getRecentTopics(days = 30) {
  const db = loadDB();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const recent = db.posts.filter(p => new Date(p.posted_at) > cutoff);
  return recent.map(p => p.topic_hash);
}

export function getRecentContentTypes(days = 7) {
  const db = loadDB();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const recent = db.posts.filter(p => new Date(p.posted_at) > cutoff);
  return recent.map(p => p.content_type).filter(Boolean);
}
