const Admin = require('../models/Admin');

async function dropLegacyUsernameIndex() {
  try {
    const indexes = await Admin.collection.indexes();
    const legacy = indexes.find((i) => Object.keys(i.key).includes('username'));
    if (legacy) {
      await Admin.collection.dropIndex(legacy.name);
      console.log('Dropped legacy unique index on username');
    }
  } catch (err) {
    console.warn('Could not clean legacy admin index:', err.message);
  }
}

async function ensureDefaultAdmin() {
  await dropLegacyUsernameIndex();

  const email = process.env.FIREBASE_ADMIN_EMAIL || 'admin@exam.gov';
  const existing = await Admin.findOne({ email });
  if (existing) return;

  await Admin.create({ email, role: 'admin' });
  console.log(`Authorized admin email: ${email}`);
  console.log('Create this user in Firebase Console -> Authentication -> Add user (Email/Password), then set the password in the console.');
}

module.exports = { ensureDefaultAdmin };
