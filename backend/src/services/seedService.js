const crypto = require('crypto');
const secrets = require('secrets.js-grempe');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const Custodian = require('../models/Custodian');
const { encryptShareWithPassword } = require('../utils/cryptoUtils');
const { resetSessions } = require('../utils/sessionStore');

const CUSTODIANS = [
  { name: 'A Sharma', role: 'Exam Controller', email: 'a@exam.gov' },
  { name: 'B Singh', role: 'Center Head', email: 'b@exam.gov' },
  { name: 'C Kumar', role: 'Police Observer', email: 'c@exam.gov' },
  { name: 'D Rao', role: 'District Officer', email: 'd@exam.gov' },
  { name: 'E Verma', role: 'State Rep', email: 'e@exam.gov' }
];

async function seedCustodiansAndShares() {
  await Custodian.deleteMany({});
  resetSessions();

  const masterKey = crypto.randomBytes(32).toString('hex');
  const shares = secrets.share(masterKey, CUSTODIANS.length, 3);

  const result = [];

  for (let i = 0; i < CUSTODIANS.length; i++) {
    const tempPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const totpSecret = speakeasy.generateSecret({ name: `ExamAuth:${CUSTODIANS[i].email}`, length: 20 });
    const encryptedShare = encryptShareWithPassword(shares[i], tempPassword);
    const qrDataUrl = await qrcode.toDataURL(totpSecret.otpauth_url);

    await Custodian.create({
      ...CUSTODIANS[i],
      passwordHash,
      totpSecret: totpSecret.base32,
      encryptedShare
    });

    result.push({
      name: CUSTODIANS[i].name,
      role: CUSTODIANS[i].role,
      email: CUSTODIANS[i].email,
      tempPassword,
      totpSecret: totpSecret.base32,
      qrDataUrl
    });
  }

  return {
    totalShares: CUSTODIANS.length,
    threshold: 3,
    custodians: result
  };
}

module.exports = { seedCustodiansAndShares };
