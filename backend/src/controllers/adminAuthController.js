const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { verifyRecaptcha, isConfigured: recaptchaConfigured } = require('../utils/recaptcha');
const { signInWithPassword, isConfigured: firebaseConfigured } = require('../utils/firebase');

async function login(req, res) {
  const { email, password, recaptchaToken } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (recaptchaConfigured() && !recaptchaToken) {
    return res.status(401).json({ error: 'reCAPTCHA verification required' });
  }
  if (recaptchaToken) {
    const verdict = await verifyRecaptcha(recaptchaToken, 'LOGIN');
    if (!verdict.ok) {
      return res.status(401).json({ error: `reCAPTCHA verification failed: ${verdict.reason}` });
    }
  }

  if (!firebaseConfigured()) {
    return res.status(503).json({ error: 'Firebase Auth not configured (set FIREBASE_API_KEY and FIREBASE_PROJECT_ID)' });
  }

  const fb = await signInWithPassword(email, password);
  if (!fb.ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  let adminId = null;
  if (process.env.ADMIN_REQUIRE_MONGODB_ADMINS === 'true') {
    const admin = await Admin.findOne({ email: fb.email });
    if (!admin) {
      return res.status(403).json({ error: 'Not an authorized admin' });
    }
    adminId = admin._id;
  }

  const token = jwt.sign(
    { adminId, uid: fb.uid, email: fb.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({ token, username: fb.email });
}

module.exports = { login };
