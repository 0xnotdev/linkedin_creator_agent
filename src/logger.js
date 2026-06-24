import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Ensure data and logs directories exist
const dataDir = path.resolve('data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const logFile = path.join(dataDir, 'app.log');

function redact(text) {
  if (typeof text !== 'string') return text;
  // Redact Bearer tokens and generic tokens
  return text
    .replace(/Bearer\s+[A-Za-z0-9-_.=]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/token\s+[A-Za-z0-9-_.=]+/gi, 'token [REDACTED_TOKEN]');
}

function writeToFile(level, message) {
  const timestamp = new Date().toISOString();
  const safeMessage = redact(message);
  const logLine = `[${timestamp}] [${level}] ${safeMessage}\n`;
  fs.appendFileSync(logFile, logLine, 'utf8');
}

export const log = {
  info: (msg) => {
    console.log(chalk.blue('ℹ INFO: ') + msg);
    writeToFile('INFO', msg);
  },
  success: (msg) => {
    console.log(chalk.green('✅ SUCCESS: ') + msg);
    writeToFile('SUCCESS', msg);
  },
  warn: (msg) => {
    console.log(chalk.yellow('⚠ WARN: ') + msg);
    writeToFile('WARN', msg);
  },
  error: (msg, err = '') => {
    const errorStr = err ? `\n${err.stack || err}` : '';
    console.log(chalk.red('❌ ERROR: ') + msg + chalk.red(errorStr));
    writeToFile('ERROR', `${msg}${errorStr}`);
  },
  debug: (msg) => {
    if (process.env.DEBUG === 'true') {
      console.log(chalk.gray('🐛 DEBUG: ') + msg);
      writeToFile('DEBUG', msg);
    }
  }
};
