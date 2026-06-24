import cron from 'node-cron';
import { runPipeline } from './pipeline.js';
import { createLogger } from './logger.js';

const log = createLogger('Scheduler');
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
  // Start Scheduler (1x a day, 5 days a week IST)
  log.info('Starting node-cron scheduler in Draft+Review mode (1x/day schedule)...');
  
  // Tuesday-Thursday: 4:00 PM IST (the 2026 peak engagement slot)
  cron.schedule('30 10 * * 2-4', () => {
    log.info('Triggering afternoon pipeline run');
    runPipeline();
  }, { timezone: 'Asia/Kolkata' });

  // Monday & Friday: 12:30 PM IST (secondary peak)
  cron.schedule('0 7 * * 1,5', () => {
    log.info('Triggering midday pipeline run');
    runPipeline();
  }, { timezone: 'Asia/Kolkata' });
  
  log.success('Scheduler running. Waiting for next cron trigger...');
}
