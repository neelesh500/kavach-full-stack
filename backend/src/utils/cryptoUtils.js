const crypto = require('crypto');

function encryptShareWithPassword(share, password) {
  const key = crypto.createHash('sha256').update(password).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(share, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    data: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: authTag.toString('hex')
  });
}

function decryptShareWithPassword(encryptedShareJson, password) {
  const { data, iv, tag } = JSON.parse(encryptedShareJson);
  const key = crypto.createHash('sha256').update(password).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

function encryptAesGcm(buffer, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return {
    data: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex')
  };
}

function decryptAesGcm(base64Data, ivHex, tagHex, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(base64Data, 'base64')),
    decipher.final()
  ]);
}

module.exports = {
  encryptShareWithPassword,
  decryptShareWithPassword,
  encryptAesGcm,
  decryptAesGcm
};
