const crypto = require('crypto');
const Document = require('../models/Document');
const { encryptAesGcm, decryptAesGcm } = require('../utils/cryptoUtils');
const SessionService = require('../services/SessionService');

async function masterKeyBuffer() {
  const session = await SessionService.getActiveSession();
  if (!session.masterKeyReconstructed) return null;
  return Buffer.from(session.masterKeyReconstructed, 'hex');
}

async function upload(req, res) {
  const { name, mimeType, data } = req.body;
  if (!name || !data) {
    return res.status(400).json({ error: 'name and base64 data required' });
  }

  const masterKey = await masterKeyBuffer();
  if (!masterKey) {
    return res.status(403).json({ error: 'Document vault locked: threshold not met' });
  }

  const fileKey = crypto.randomBytes(32);
  const buffer = Buffer.from(data, 'base64');

  const fileEnc = encryptAesGcm(buffer, fileKey);
  const keyEnc = encryptAesGcm(fileKey, masterKey);

  const doc = await Document.create({
    name,
    mimeType: mimeType || 'application/octet-stream',
    size: buffer.length,
    encryptedData: fileEnc.data,
    iv: fileEnc.iv,
    tag: fileEnc.tag,
    encryptedFileKey: keyEnc.data,
    fileKeyIv: keyEnc.iv,
    fileKeyTag: keyEnc.tag,
    uploadedBy: req.admin && req.admin.email
  });

  return res.json({
    message: 'Document uploaded and encrypted (AES-256-GCM)',
    id: doc._id,
    name: doc.name,
    size: doc.size,
    uploadedAt: doc.uploadedAt
  });
}

async function list(req, res) {
  const session = await SessionService.getActiveSession();
  const docs = await Document.find()
    .sort({ uploadedAt: -1 })
    .select('name mimeType size uploadedAt uploadedBy');
  return res.json({ documents: docs, locked: !session.masterKeyReconstructed });
}

async function decrypt(req, res) {
  const doc = await Document.findById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const masterKey = await masterKeyBuffer();
  if (!masterKey) {
    return res.status(403).json({ error: 'Document vault locked: threshold not met' });
  }

  const fileKey = decryptAesGcm(doc.encryptedFileKey, doc.fileKeyIv, doc.fileKeyTag, masterKey);
  const plaintext = decryptAesGcm(doc.encryptedData, doc.iv, doc.tag, fileKey);

  return res.json({
    id: doc._id,
    name: doc.name,
    mimeType: doc.mimeType,
    size: doc.size,
    data: plaintext.toString('base64')
  });
}

module.exports = { upload, list, decrypt };
