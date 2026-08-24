const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: String,
  mimeType: String,
  size: Number,
  encryptedData: String,
  iv: String,
  tag: String,
  encryptedFileKey: String,
  fileKeyIv: String,
  fileKeyTag: String,
  uploadedBy: String,
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', documentSchema);
