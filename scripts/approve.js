import Database from 'better-sqlite3';
import path from 'path';
import { publishPipeline } from '../src/linkedin.js';
import { updatePostStatus } from '../src/store.js';
import { createLogger } from '../src/logger.js';

const log = createLogger('Approve');
const dbFile = path.resolve('data', 'posts.db');

async function run() {
  const args = process.argv.slice(2);
  const postId = args[0];

  if (!postId) {
    console.log('Usage: npm run approve <post_id>');
    process.exit(1);
  }

  log.info(`Attempting to approve and publish draft ID: ${postId}`);

  const db = new Database(dbFile);

  try {
    const stmt = db.prepare('SELECT * FROM posts WHERE id = ?');
    const post = stmt.get(postId);

    if (!post) {
      log.error(`No post found with ID ${postId}`);
      process.exit(1);
    }

    if (post.status !== 'draft') {
      log.error(`Post ${postId} is not a draft (current status: ${post.status})`);
      process.exit(1);
    }

    // Convert the DB row back into the format publishPipeline expects
    const postData = {
      post: post.post_content,
      hookComment: "Full source + my breakdown in the thread 👇", // Standard template since DB doesn't store this separately
      linkComment: `Here is the original source: ${post.source_url}`, 
    };

    const imagePath = post.image_path || null;

    log.info('Publishing to LinkedIn...');
    const result = await publishPipeline(postData, imagePath);

    log.info(`Updating database status to 'posted'...`);
    updatePostStatus(db, postId, 'posted', result.urn);

    log.success(`Successfully published draft ${postId}! LinkedIn URN: ${result.urn}`);

  } catch (error) {
    log.error('Approval failed', { error: error.message });
    process.exit(1);
  } finally {
    db.close();
  }
}

run();
