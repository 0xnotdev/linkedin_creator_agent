import cron from 'node-cron';
import { runPipeline } from './pipeline.js';
import { log } from './logger.js';
import dotenv from 'dotenv';
dotenv.config();

const args = process.argv.slice(2);

// Check for CLI flags
const isNow = args.includes('--now');
const isDryRun = args.includes('--dry-run');

const topicIndex = args.indexOf('--topic');
const manualTopic = topicIndex !== -1 && args[topicIndex + 1] ? args.slice(topicIndex + 1).join(' ') : null;

if (isNow || manualTopic) {
  log.info(`Running immediate post${manualTopic ? ` for topic: ${manualTopic}` : ''}`);
  runPipeline({ dryRun: isDryRun, manualTopic });
} 
else if (isDryRun) {
  log.info('Running dry-run pipeline');
  runPipeline({ dryRun: true });
} 
else {
  // Start Scheduler
  log.info('Starting LinkedIn Post Maker Scheduler...');
  log.info('Using optimal 2026 scheduling (Afternoon peak)');
  
  const tz = process.env.TZ || 'Asia/Kolkata';

  // Tuesday-Thursday: 4:00 PM
  cron.schedule('0 16 * * 2-4', () => {
    log.info('Triggering scheduled post (Tue-Thu 4PM)');
    runPipeline();
  }, { timezone: tz });

  // Monday & Friday: 12:30 PM
  cron.schedule('30 12 * * 1,5', () => {
    log.info('Triggering scheduled post (Mon/Fri 12:30PM)');
    runPipeline();
  }, { timezone: tz });

  log.success(`Scheduler active. Timezone: ${tz}`);
}
