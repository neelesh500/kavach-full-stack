require('dotenv').config();
const speakeasy = require('speakeasy');
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const { ensureDns } = require('../src/utils/dns');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASSED = [];
const FAILED = [];

async function setupFirebaseTestAdmin() {
  const email = `admin-test-${Date.now()}@exam.gov`;
  const password = 'Admin@Test123';

  ensureDns();
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME || 'exam_auth' });
  await Admin.create({ email, role: 'admin' });
  await mongoose.disconnect();

  const key = process.env.FIREBASE_API_KEY;
  const api = 'https://identitytoolkit.googleapis.com/v1';
  const payload = { email, password, returnSecureToken: true };
  const headers = { 'Content-Type': 'application/json' };

  let res = await fetch(`${api}/accounts:signUp?key=${key}`, {
    method: 'POST', headers, body: JSON.stringify(payload)
  });
  let final = await res.json();
  if (final.error?.message === 'EMAIL_EXISTS') {
    res = await fetch(`${api}/accounts:signInWithPassword?key=${key}`, {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    final = await res.json();
  }
  if (final.error) {
    throw new Error('Firebase test user creation failed: ' + (final.error.message || 'unknown'));
  }
  return { email, password };
}

function check(name, ok, detail) {
  if (ok) {
    PASSED.push(name);
    console.log(`  PASS  ${name}${detail ? '  -> ' + detail : ''}`);
  } else {
    FAILED.push(name);
    console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`);
  }
}

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function totpToken(secret) {
  return speakeasy.totp({ secret, encoding: 'base32' });
}

async function custodianLogin(custodian) {
  const l = await api('POST', '/api/auth/login', { email: custodian.email, password: custodian.tempPassword });
  if (l.status !== 200 || l.json.step !== 'totp_required') {
    return { ok: false, error: 'login step failed' };
  }
  const t = await api('POST', '/api/auth/verify-totp', {
    custodianId: l.json.custodianId,
    token: await totpToken(custodian.totpSecret)
  });
  return { ok: t.status === 200, token: t.json.token, sessionId: t.json.sessionId, name: custodian.name };
}

async function submit(custodian, token) {
  return api('POST', '/api/share/submit', { passwordForShare: custodian.tempPassword }, token);
}

async function run() {
  console.log('\n=== PHASE 6: Automated flow test ===\n');

  const { email: adminEmail, password: adminPassword } = await setupFirebaseTestAdmin();

  const adminLogin = await api('POST', '/api/admin/login', {
    email: adminEmail,
    password: adminPassword,
    recaptchaToken: process.env.RECAPTCHA_TEST_TOKEN || 'recaptcha-test-bypass-token'
  });
  check('Admin login (Firebase Auth)', adminLogin.status === 200);
  if (adminLogin.status !== 200) {
    console.log('\nAdmin login failed. Make sure backend is running (npm start) and .env has MONGODB_URI.\n');
    process.exit(1);
  }
  const adminToken = adminLogin.json.token;

  const setupRes = await api('POST', '/api/admin/setup', null, adminToken);
  check('POST /api/admin/setup', setupRes.status === 200);
  if (setupRes.status !== 200) {
    console.log('\nMake sure the backend is running (npm start) and .env has MONGODB_URI.\n');
    process.exit(1);
  }
  const custodians = setupRes.json.custodians;

  const wrong = await api('POST', '/api/auth/login', { email: custodians[0].email, password: 'wrong-password' });
  check('Wrong password rejected (login fail)', wrong.status === 401);

  const badTotpLogin = await api('POST', '/api/auth/login', { email: custodians[0].email, password: custodians[0].tempPassword });
  const badTotp = await api('POST', '/api/auth/verify-totp', { custodianId: badTotpLogin.json.custodianId, token: '000000' });
  check('Wrong TOTP rejected (login fail)', badTotp.status === 401);

  const c0 = await custodianLogin(custodians[0]);
  check(`${c0.name} login + 2FA success`, c0.ok);

  const lockedUpload = await api('POST', '/api/admin/document/upload', {
    name: 'paper.pdf',
    mimeType: 'application/pdf',
    data: Buffer.from('SECRET').toString('base64')
  }, adminToken);
  check('Upload blocked while vault LOCKED (threshold not met)', lockedUpload.status === 403);

  const first = await submit(custodians[0], c0.token);
  check('First share submission accepted', first.status === 200);

  const dup = await submit(custodians[0], c0.token);
  check('Duplicate submission rejected', dup.status === 400 && /already submitted/i.test(dup.json.error || ''));

  const c1 = await custodianLogin(custodians[1]);
  check(`${c1.name} login + 2FA success`, c1.ok);
  await submit(custodians[1], c1.token);

  const two = await api('POST', '/api/admin/reconstruct', {}, adminToken);
  check('2 shares -> reconstruction BLOCKED', two.status === 400);

  const c2 = await custodianLogin(custodians[2]);
  check(`${c2.name} login + 2FA success`, c2.ok);
  const third = await submit(custodians[2], c2.token);
  check('3rd share triggers threshold', third.status === 200 && third.json.count >= 3);

  const three = await api('POST', '/api/admin/reconstruct', {}, adminToken);
  const okKey = three.status === 200 && /^[0-9a-f]{64}$/.test(three.json.masterKey || '');
  check('3 shares -> master key reconstructed (64 hex chars)', okKey, okKey ? 'masterKey: ' + three.json.masterKey.slice(0, 16) + '...' : JSON.stringify(three.json));

  const secret = 'TOP SECRET QUESTION PAPER CLASSIFIED';
  const uploadDoc = await api('POST', '/api/admin/document/upload', {
    name: 'paper.pdf',
    mimeType: 'application/pdf',
    data: Buffer.from(secret).toString('base64')
  }, adminToken);
  check('Document upload + encrypt while UNLOCKED', uploadDoc.status === 200, uploadDoc.status === 200 ? uploadDoc.json.id : JSON.stringify(uploadDoc.json));
  const docId = uploadDoc.json.id;

  const docsList = await api('GET', '/api/admin/documents', null, adminToken);
  check('Document list shows encrypted doc (locked=false)', docsList.status === 200 && !docsList.json.locked && docsList.json.documents.length >= 1);

  const decrypted = await api('POST', `/api/admin/document/${docId}/decrypt`, {}, adminToken);
  const plain = decrypted.status === 200 ? Buffer.from(decrypted.json.data, 'base64').toString('utf8') : '';
  check('Decrypt returns original content', decrypted.status === 200 && plain === secret, plain === secret ? 'verified byte-for-byte' : JSON.stringify(decrypted.json));

  const tampered = await api('POST', `/api/admin/document/${docId}/decrypt`, {}, 'fake-token');
  check('Decrypt without admin auth rejected', tampered.status === 401);

  console.log(`\n=== Results: ${PASSED.length} passed, ${FAILED.length} failed ===\n`);
  if (FAILED.length > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
