import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { encryptToken } from '../src/crypto.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
  console.error("❌ ERROR: LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set in .env");
  process.exit(1);
}

app.get('/', (req, res) => {
  const scope = encodeURIComponent('w_member_social openid profile');
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scope}`;
  
  res.send(`
    <h1>LinkedIn OAuth Setup</h1>
    <p>Click the link below to authorize the app to post on your behalf.</p>
    <a href="${authUrl}">Authorize with LinkedIn</a>
  `);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.send('❌ No authorization code provided in callback.');
  }

  try {
    console.log("Fetching access token...");
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;
    
    console.log("Fetching User URN...");
    const userResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const personUrn = `urn:li:person:${userResponse.data.sub}`;

    console.log("Encrypting access token to lock it to this machine...");
    const encryptedToken = encryptToken(accessToken);

    // Update .env file
    const envPath = path.resolve('.env');
    let envFile = '';
    if (fs.existsSync(envPath)) {
      envFile = fs.readFileSync(envPath, 'utf8');
    }
    
    envFile = envFile.replace(/LINKEDIN_ACCESS_TOKEN=.*/g, `LINKEDIN_ACCESS_TOKEN=${encryptedToken}`);
    envFile = envFile.replace(/LINKEDIN_PERSON_URN=.*/g, `LINKEDIN_PERSON_URN=${personUrn}`);
    
    if (!envFile.includes('LINKEDIN_ACCESS_TOKEN=')) {
      envFile += `\nLINKEDIN_ACCESS_TOKEN=${encryptedToken}`;
      envFile += `\nLINKEDIN_PERSON_URN=${personUrn}`;
    }
    
    fs.writeFileSync(envPath, envFile);

    console.log("✅ Success! .env file updated with tokens.");
    
    res.send(`
      <h1>✅ Success!</h1>
      <p>Tokens saved to .env file.</p>
      <p><b>Access Token:</b> ${accessToken.substring(0, 10)}...</p>
      <p><b>Person URN:</b> ${personUrn}</p>
      <p>You can close this window and stop the terminal script.</p>
    `);
    
    setTimeout(() => {
      console.log("Exiting setup server...");
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error("❌ OAuth Error:", error.response?.data || error.message);
    res.send("❌ Error during OAuth flow. Check console.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Setup server running! Open http://localhost:${PORT} in your browser.`);
});
