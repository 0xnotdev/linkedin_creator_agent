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
  // Start Scheduler (3x a day: 7am, 1:30pm, 10pm IST)
  log.info('Starting node-cron scheduler in Draft+Review mode...');
  
  // ~7:00 AM IST
  cron.schedule('0 7 * * *', () => {
    log.info('Triggering morning pipeline run');
    runPipeline();
  }, { timezone: 'Asia/Kolkata' });

  // ~1:30 PM IST
  cron.schedule('30 13 * * *', () => {
    log.info('Triggering midday pipeline run');
    runPipeline();
  }, { timezone: 'Asia/Kolkata' });

  // ~10:00 PM IST
  cron.schedule('0 22 * * *', () => {
    log.info('Triggering night pipeline run');
    runPipeline();
  }, { timezone: 'Asia/Kolkata' });
  
  log.success('Scheduler running. Waiting for next cron trigger...');
}
