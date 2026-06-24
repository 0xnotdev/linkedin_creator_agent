import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve('data');
const logFile = path.join(dataDir, 'app.log');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function redact(text) {
  if (typeof text !== 'string') return text;
  // Redact Bearer tokens and generic tokens
  return text
    .replace(/Bearer\s+[A-Za-z0-9-_.=]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/token\s+[A-Za-z0-9-_.=]+/gi, 'token [REDACTED_TOKEN]');
}

function writeToFile(level, name, message, meta) {
  try {
    const timestamp = new Date().toISOString();
    const safeMessage = redact(message);
    let logLine = `[${timestamp}] [${level}] [${name}] ${safeMessage}`;
    if (meta && Object.keys(meta).length > 0) {
      logLine += ` ${JSON.stringify(meta)}`;
    }
    logLine += '\n';
    fs.appendFileSync(logFile, logLine, 'utf8');
  } catch (err) {
    // Fail silently so logging doesn't crash the app
  }
}

export function createLogger(name = 'System') {
  return {
    info: (message, meta = {}) => {
      console.log(chalk.blue('ℹ INFO: ') + redact(message), meta && Object.keys(meta).length > 0 ? meta : '');
      writeToFile('INFO', name, message, meta);
    },
    success: (message, meta = {}) => {
      console.log(chalk.green('✅ SUCCESS: ') + redact(message), meta && Object.keys(meta).length > 0 ? meta : '');
      writeToFile('SUCCESS', name, message, meta);
    },
    warn: (message, meta = {}) => {
      console.log(chalk.yellow('⚠ WARN: ') + redact(message), meta && Object.keys(meta).length > 0 ? meta : '');
      writeToFile('WARN', name, message, meta);
    },
    error: (message, meta = {}) => {
      console.log(chalk.red('❌ ERROR: ') + redact(message));
      if (meta && meta.error instanceof Error) {
        console.log(chalk.red(`  ${meta.error.message}`));
        console.log(chalk.red(`  ${meta.error.stack}`));
      } else if (meta && Object.keys(meta).length > 0) {
        console.log(chalk.red(`  ${JSON.stringify(meta)}`));
      }
      
      const errorMeta = meta && meta.error instanceof Error 
        ? { message: meta.error.message, stack: meta.error.stack, ...meta, error: undefined } 
        : meta;
        
      writeToFile('ERROR', name, message, errorMeta);
    }
  };
}

// Global default logger for legacy compatibility during refactor
export const log = createLogger('Global');
