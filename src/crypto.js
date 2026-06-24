import crypto from 'crypto';
import os from 'os';

// Derive a hardware-bound key using MAC address and CPU model.
// This ensures that if the files are copied to another machine, the tokens cannot be decrypted.
function getMachineKey() {
  const interfaces = os.networkInterfaces();
  let macAddress = '00:00:00:00:00:00';
  
  // Find first non-internal MAC address
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
        macAddress = iface.mac;
        break;
      }
    }
    if (macAddress !== '00:00:00:00:00:00') break;
  }

  const cpuModel = os.cpus()[0]?.model || 'unknown_cpu';
  
  // Create a 32-byte key using SHA-256
  const secretString = `linkedin_post_maker_${macAddress}_${cpuModel}`;
  return crypto.createHash('sha256').update(secretString).digest();
}

const ALGORITHM = 'aes-256-gcm';

export function encryptToken(text) {
  if (!text) return text;
  
  const iv = crypto.randomBytes(12);
  const key = getMachineKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Return format: iv:authTag:encryptedText
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptToken(encryptedString) {
  if (!encryptedString) return encryptedString;
  if (!encryptedString.includes(':')) return encryptedString; // Legacy plaintext fallback
  
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) return encryptedString;
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const key = getMachineKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt token. This token may belong to a different machine, or the hardware has changed.');
  }
}
