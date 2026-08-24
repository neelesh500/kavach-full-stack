const mongoose = require('mongoose');

const custodianSchema = new mongoose.Schema({
  name: String,
  role: String,
  email: { type: String, unique: true },
  passwordHash: String,
  totpSecret: String,
  encryptedShare: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Custodian', custodianSchema);
