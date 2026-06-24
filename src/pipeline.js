import { scrapeAll } from './scrapers/index.js';
import { rankContent } from './ranker.js';
import { generatePost } from './generator.js';
import { selectImage } from './images.js';
import { publishPipeline } from './linkedin.js';
import { recordPost } from './store.js';
import { log } from './logger.js';

export async function runPipeline(options = {}) {
  log.info('🚀 Starting LinkedIn Auto-Posting Pipeline...');
  
  try {
    let topItem = null;

    if (options.manualTopic) {
      log.info(`Manual Topic Override: "${options.manualTopic}"`);
      topItem = {
        title: options.manualTopic,
        source: 'manual',
        description: `Custom topic provided via CLI: ${options.manualTopic}`,
        url: '',
        contentType: 'hot_take'
      };
    } else {
      // 1. Scrape all content sources
      const rawContent = await scrapeAll();
      
      if (rawContent.length === 0) {
        log.warn('No content found to post.');
        return;
      }

      // 2. Rank content
      const rankedItems = rankContent(rawContent);
      topItem = rankedItems[0];
    }
    
    if (!topItem) {
      log.warn('No ranked items available.');
      return;
    }

    // 3. Generate LinkedIn Post
    const postData = await generatePost(topItem);
    
    // 4. Select Image
    const imagePath = await selectImage(topItem, postData.imageQuery);

    // 5. Publish to LinkedIn
    if (options.dryRun) {
      log.info('🏃 DRY RUN MODE: Previews below');
      console.log('\n--- POST CONTENT ---');
      console.log(postData.post);
      console.log('\n--- HOOK COMMENT ---');
      console.log(postData.hookComment);
      console.log('\n--- LINK COMMENT ---');
      console.log(postData.linkComment);
      console.log('\n--- IMAGE PATH ---');
      console.log(imagePath || 'No image');
      console.log('--------------------\n');
    } else {
      const result = await publishPipeline(postData, imagePath);
      
      // 6. Record to local DB
      recordPost({
        ...topItem,
        hookType: postData.hookType,
        contentType: postData.contentType,
        sourceUrl: topItem.url,
        urn: result.urn
      });
      
      log.success('Pipeline finished successfully!');
    }
  } catch (error) {
    log.error('Pipeline failed', error.message);
  }
}
