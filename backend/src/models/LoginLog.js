const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  custodianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Custodian' },
  loginTime: { type: Date, default: Date.now },
  ipAddress: String,
  deviceInfo: String,
  status: String,
  sessionId: String
});

module.exports = mongoose.model('LoginLog', loginLogSchema);
