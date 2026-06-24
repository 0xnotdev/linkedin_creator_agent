import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { log } from './logger.js';
import dotenv from 'dotenv';
dotenv.config();

const imagesDir = path.resolve('data', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

async function extractOgImage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'LinkedIn-Post-Maker'
      },
      timeout: 5000
    });
    const $ = cheerio.load(response.data);
    const ogImage = $('meta[property="og:image"]').attr('content');
    return ogImage || null;
  } catch (error) {
    log.debug(`Failed to extract OG image from ${url}: ${error.message}`);
    return null;
  }
}

async function fetchUnsplashImage(query) {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    log.debug('Unsplash key missing, skipping Unsplash fallback.');
    return null;
  }
  
  try {
    log.info(`Searching Unsplash for: ${query}`);
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${process.env.UNSPLASH_ACCESS_KEY}`;
    const response = await axios.get(url);
    if (response.data && response.data.urls && response.data.urls.regular) {
      return response.data.urls.regular;
    }
    return null;
  } catch (error) {
    log.warn(`Unsplash fallback failed: ${error.message}`);
    return null;
  }
}

async function downloadImage(url, filename) {
  const filepath = path.join(imagesDir, filename);
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });
    
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);
      let error = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) resolve(filepath);
      });
    });
  } catch (error) {
    log.error(`Failed to download image from ${url}`, error.message);
    return null;
  }
}

export async function selectImage(contentItem, imageQuery) {
  log.info(`Selecting image for content: ${contentItem.title}`);
  
  let imageUrl = null;

  // 1. Try to use the pre-extracted image URL (e.g. from RSS)
  if (contentItem.imageUrl) {
    log.debug('Using pre-extracted image URL');
    imageUrl = contentItem.imageUrl;
  } 
  // 2. Try to scrape the OG Image
  else if (contentItem.url) {
    log.debug(`Attempting to extract OG image from ${contentItem.url}`);
    imageUrl = await extractOgImage(contentItem.url);
  }

  // 3. Fallback to Unsplash
  if (!imageUrl && imageQuery) {
    log.debug('Using Unsplash fallback');
    imageUrl = await fetchUnsplashImage(imageQuery);
  }

  if (!imageUrl) {
    log.warn('Could not find any relevant image for post.');
    return null;
  }

  log.info(`Downloading selected image: ${imageUrl}`);
  const filename = `img_${Date.now()}.jpg`;
  const localPath = await downloadImage(imageUrl, filename);
  
  if (localPath) {
    log.success(`Image saved to ${localPath}`);
  }
  
  return localPath;
}
