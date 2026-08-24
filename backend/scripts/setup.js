require('dotenv').config();
const mongoose = require('mongoose');
const { seedCustodiansAndShares } = require('../services/seedService');
const { ensureDns } = require('../src/utils/dns');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in backend/.env');
    process.exit(1);
  }

  ensureDns();
  await mongoose.connect(uri, { dbName: process.env.DB_NAME || 'exam_auth' });
  const data = await seedCustodiansAndShares();

  console.log('Master key split into 5 shares, threshold 3. Custodians created:\n');
  for (const c of data.custodians) {
    console.log(`  ${c.name.padEnd(16)} | ${c.role.padEnd(16)} | ${c.email.padEnd(14)} | password=${c.tempPassword} | TOTP=${c.totpSecret}`);
  }
  console.log('\nQR codes shown in the Admin Dashboard (Setup tab).');
  console.log('In production these credentials go via a secure channel, never printed.\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
