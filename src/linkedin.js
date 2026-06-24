import axios from 'axios';
import fs from 'fs';
import { createLogger } from './logger.js';
import { decryptToken } from './crypto.js';
import dotenv from 'dotenv';
dotenv.config();

const log = createLogger('LinkedIn');

const API_VERSION = '202401';
const BASE_HEADERS = {
  'LinkedIn-Version': API_VERSION,
  'X-Restli-Protocol-Version': '2.0.0'
};

function getHeaders() {
  const encryptedToken = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!encryptedToken) throw new Error('LINKEDIN_ACCESS_TOKEN is missing');
  
  const token = decryptToken(encryptedToken);
  
  return {
    ...BASE_HEADERS,
    'Authorization': `Bearer ${token}`
  };
}

export async function verifyToken() {
  try {
    const urn = process.env.LINKEDIN_PERSON_URN;
    if (!urn) {
      log.warn('LINKEDIN_PERSON_URN is missing. Will try to fetch it.');
      const token = decryptToken(process.env.LINKEDIN_ACCESS_TOKEN);
      const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      log.info(`Fetched URN. Please add this to .env: LINKEDIN_PERSON_URN=urn:li:person:${response.data.sub}`);
      return `urn:li:person:${response.data.sub}`;
    }
    return urn;
  } catch (error) {
    log.error('Failed to verify LinkedIn token. It may be expired.', { error: error.response?.data || error.message });
    throw error;
  }
}

async function uploadImage(imagePath, personUrn) {
  log.info('Step 1: Initializing image upload...');
  try {
    const initResponse = await axios.post(
      'https://api.linkedin.com/rest/images?action=initializeUpload',
      {
        initializeUploadRequest: { owner: personUrn }
      },
      { headers: { ...getHeaders(), 'Content-Type': 'application/json' } }
    );

    const uploadUrl = initResponse.data.value.uploadUrl;
    const imageUrn = initResponse.data.value.image;

    log.info('Step 2: Uploading image binary...');
    const token = decryptToken(process.env.LINKEDIN_ACCESS_TOKEN);
    const imageBuffer = fs.readFileSync(imagePath);
    await axios.put(uploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream'
      }
    });

    log.success('Image uploaded successfully.');
    return imageUrn;
  } catch (error) {
    log.error('Failed to upload image', error.response?.data || error.message);
    throw error;
  }
}

async function createPost(text, imageUrn, personUrn) {
  log.info('Step 3: Publishing post...');
  try {
    const payload = {
      author: personUrn,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false
    };

    if (imageUrn) {
      payload.content = {
        media: { id: imageUrn }
      };
    }

    const response = await axios.post('https://api.linkedin.com/rest/posts', payload, {
      headers: { ...getHeaders(), 'Content-Type': 'application/json' }
    });

    // Extract the post URN from the Location header or x-restli-id
    const postUrn = response.headers['x-restli-id'] || response.headers.location?.split('/').pop();
    log.success(`Post published! URN: ${postUrn}`);
    return postUrn;
  } catch (error) {
    log.error('Failed to create post', { error: error.response?.data || error.message });
    throw error;
  }
}

async function addComment(postUrn, text, personUrn) {
  try {
    const payload = {
      actor: personUrn,
      object: postUrn,
      message: { text: text }
    };
    
    // The comments API uses socialActions
    const url = `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(postUrn)}/comments`;
    const response = await axios.post(url, payload, {
      headers: { ...getHeaders(), 'Content-Type': 'application/json' }
    });
    
    // Return the new comment URN so we can reply to it (for the 2-comment link workaround)
    return response.headers['x-restli-id'];
  } catch (error) {
    log.error('Failed to add comment', { error: error.response?.data || error.message });
    return null;
  }
}

export async function saveDraft(text, imagePath, meta) {
  log.info('Saving post as draft for manual review...', meta);
  // The actual DB writing happens in pipeline.js via store.js
  // This function is mostly a placeholder to mirror the publish function structure
  // but it verifies the token so you don't get a nasty surprise later.
  await verifyToken();
  return { status: 'draft' };
}

export async function publishPipeline(postData, imagePath) {
  log.info('--- STARTING LINKEDIN PUBLISH PIPELINE ---');
  try {
    const personUrn = await verifyToken();
    let imageUrn = null;

    if (imagePath) {
      imageUrn = await uploadImage(imagePath, personUrn);
    }

    const postUrn = await createPost(postData.post, imageUrn, personUrn);

    if (postUrn && postData.hookComment) {
      log.info('Adding hook comment (teaser)...');
      const hookCommentUrn = await addComment(postUrn, postData.hookComment, personUrn);
      
      // Wait a few seconds to make it look natural
      await new Promise(r => setTimeout(r, 2000));
      
      if (postData.linkComment) {
        log.info('Adding link comment...');
        // To reply to our own comment, we just use the same addComment API but pass the comment URN as the object
        // Actually, the easiest workaround that avoids threading complexity is just adding a second top-level comment.
        await addComment(postUrn, postData.linkComment, personUrn);
      }
    }

    return { urn: postUrn };
  } catch (error) {
    log.error('Publish pipeline failed');
    throw error;
  }
}
