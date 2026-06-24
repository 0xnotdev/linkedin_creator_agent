import { scrapeAll } from './scrapers/index.js';
import { rankContent } from './ranker.js';
import { generatePost } from './generator.js';
import { selectImage } from './images.js';
import { saveDraft } from './linkedin.js';
import { initStore, recordPost, getRecentTopics, getRecentHookTypes } from './store.js';
import { createLogger } from './logger.js';
import notifier from 'node-notifier';
import path from 'path';

const log = createLogger('Pipeline');

function notifyForReview(draft) {
  log.info('Triggering system notification for review...');
  notifier.notify({
    title: 'LinkedIn Agent: Draft Ready',
    message: `New draft ready: ${draft.title.substring(0, 50)}...\nOpen database or run approval script to post.`,
    icon: path.join(process.cwd(), 'data', 'icon.png'), // Optional, won't break if missing
    sound: true, // play a sound
    wait: false
  });
}

export async function runPipeline(options = {}) {
  log.info('🚀 Starting LinkedIn Auto-Posting Pipeline...');
  
  // Initialize SQLite database
  const db = initStore();

  try {
    let topItem = null;

    if (options.manualTopic) {
      log.info(`Manual Topic Override: "${options.manualTopic}"`);
      topItem = {
        title: options.manualTopic,
        sourceType: 'manual',
        description: `Custom topic provided via CLI: ${options.manualTopic}`,
        url: '',
        engagementRaw: 0,
        publishedAt: new Date().toISOString(),
        imageUrl: null
      };
    } else {
      // 1. Scrape all content sources
      const rawContent = await scrapeAll();
      
      if (rawContent.length === 0) {
        log.warn('No content found to post.');
        return;
      }

      // 2. Rank content
      const recentTopics = getRecentTopics(db, 30);
      const rankedItems = rankContent(db, rawContent, recentTopics);
      
      if (!rankedItems) {
        log.info('No novel high-quality content found, skipping run');
        return;
      }

      topItem = rankedItems[0];
    }
    
    // 3. Generate LinkedIn Post Draft
    const recentHooks = getRecentHookTypes(db, 10);
    const recentTopics = getRecentTopics(db, 10);
    const postData = await generatePost(topItem, recentHooks, recentTopics);
    
    // 4. Select Image
    const imagePath = await selectImage(topItem, postData.imageQuery);

    if (options.dryRun) {
      log.info('🏃 DRY RUN MODE: Previews below', { post: postData.post, imagePath });
      console.log('\n--- POST CONTENT ---');
      console.log(postData.post);
      console.log('\n--- HOOK COMMENT ---');
      console.log(postData.hookComment);
      console.log('\n--- LINK COMMENT ---');
      console.log(postData.linkComment);
      console.log('\n--- IMAGE PATH ---');
      console.log(imagePath || 'No image');
      console.log('--------------------\n');
      return;
    }

    // 5. Save Draft & Notify (instead of auto-publishing)
    const draftStatus = await saveDraft(postData.post, imagePath, { 
      hookType: postData.hookType, 
      sourceUrl: topItem.url 
    });
    
    // Notify the user
    notifyForReview(topItem);

    // 6. Record to local DB as draft
    recordPost(db, {
      title: topItem.title,
      hookType: postData.hookType,
      contentType: postData.contentType,
      sourceUrl: topItem.url,
      post: postData.post,
      imagePath: imagePath,
      status: draftStatus.status,
      urn: null
    });
    
    log.success('Pipeline finished successfully! Draft saved and waiting for review.');
  } catch (error) {
    log.error('Pipeline failed', { error });
  } finally {
    db.close();
  }
}
