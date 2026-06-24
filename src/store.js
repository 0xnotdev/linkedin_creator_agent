import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { log } from './logger.js';

const dataDir = path.resolve('data');
const dbFile = path.join(dataDir, 'posts.db');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function initStore() {
  const db = new Database(dbFile);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Check schema version
  const tableExists = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='schema_version'").get();
  
  if (tableExists.count === 0) {
    log.info('Initializing SQLite database schema...');
    
    // Create schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
      INSERT INTO schema_version (version) VALUES (1);

      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_hash TEXT UNIQUE NOT NULL,
        hook_type TEXT NOT NULL,
        content_type TEXT NOT NULL,
        source_url TEXT NOT NULL,
        post_content TEXT NOT NULL,
        image_path TEXT,
        status TEXT NOT NULL DEFAULT 'draft', -- draft | approved | rejected | posted | failed
        created_at TEXT DEFAULT (datetime('now')),
        posted_at TEXT,
        linkedin_post_urn TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_posts_topic_hash ON posts(topic_hash);
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    `);
  }

  return db;
}

function generateHash(text) {
  if (!text) return '';
  return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
}

export function isDuplicate(db, title, windowDays = 90) {
  const hash = generateHash(title);
  
  const stmt = db.prepare(`
    SELECT count(*) as count 
    FROM posts 
    WHERE topic_hash = ? 
    AND created_at > datetime('now', ?)
  `);
  
  const result = stmt.get(hash, `-${windowDays} days`);
  return result.count > 0;
}

export function recordPost(db, { title, hookType, contentType, sourceUrl, post, imagePath, status = 'draft', urn = null }) {
  const hash = generateHash(title);
  
  const stmt = db.prepare(`
    INSERT INTO posts (topic_hash, hook_type, content_type, source_url, post_content, image_path, status, linkedin_post_urn)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  try {
    stmt.run(hash, hookType, contentType, sourceUrl, post, imagePath, status, urn);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      log.warn(`Attempted to record duplicate post: ${hash}`);
    } else {
      throw err;
    }
  }
}

export function getRecentHookTypes(db, n = 10) {
  const stmt = db.prepare(`
    SELECT hook_type 
    FROM posts 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(n).map(row => row.hook_type).filter(Boolean);
}

export function getRecentTopics(db, days = 30) {
  const stmt = db.prepare(`
    SELECT topic_hash 
    FROM posts 
    WHERE created_at > datetime('now', ?)
  `);
  return stmt.all(`-${days} days`).map(row => row.topic_hash).filter(Boolean);
}

export function updatePostStatus(db, id, status, linkedinPostUrn = null) {
  const stmt = db.prepare(`
    UPDATE posts 
    SET status = ?, linkedin_post_urn = ?, posted_at = CASE WHEN ? = 'posted' THEN datetime('now') ELSE posted_at END
    WHERE id = ?
  `);
  stmt.run(status, linkedinPostUrn, status, id);
}
