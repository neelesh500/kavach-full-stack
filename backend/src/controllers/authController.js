const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const Custodian = require('../models/Custodian');
const LoginLog = require('../models/LoginLog');
const { getIo } = require('../utils/socket');

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const custodian = await Custodian.findOne({ email });

  if (!custodian) {
    await LoginLog.create({ status: 'fail', ipAddress: req.ip, deviceInfo: req.headers['user-agent'] });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, custodian.passwordHash);
  if (!isMatch) {
    await LoginLog.create({ custodianId: custodian._id, status: 'fail', ipAddress: req.ip, deviceInfo: req.headers['user-agent'] });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  return res.json({ step: 'totp_required', custodianId: custodian._id, name: custodian.name });
}

async function verifyTotp(req, res) {
  const { custodianId, token } = req.body;
  if (!custodianId || !token) {
    return res.status(400).json({ error: 'custodianId and token required' });
  }

  const custodian = await Custodian.findById(custodianId);
  if (!custodian) {
    return res.status(401).json({ error: 'Custodian not found' });
  }

  const verified = speakeasy.totp.verify({
    secret: custodian.totpSecret,
    encoding: 'base32',
    token,
    window: 1
  });

  if (!verified) {
    await LoginLog.create({ custodianId, status: 'fail', ipAddress: req.ip, deviceInfo: req.headers['user-agent'] });
    return res.status(401).json({ error: 'Invalid TOTP' });
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  await LoginLog.create({
    custodianId,
    status: 'success',
    ipAddress: req.ip,
    deviceInfo: req.headers['user-agent'],
    sessionId
  });

  const jwtToken = jwt.sign(
    { custodianId, sessionId, name: custodian.name, email: custodian.email },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  getIo().emit('custodian_login', { custodianId, name: custodian.name, time: new Date() });

  return res.json({ token: jwtToken, sessionId, name: custodian.name, email: custodian.email });
}

module.exports = { login, verifyTotp };
