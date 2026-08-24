const API_KEY = process.env.FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

function isConfigured() {
  return !!(API_KEY && PROJECT_ID);
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch (err) {
    return null;
  }
}

async function signInWithPassword(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, code: data.error?.message || 'unknown_error' };
  }

  const claims = decodeJwt(data.idToken);
  const audOk = claims && claims.aud === PROJECT_ID;
  const expOk = claims && claims.exp && claims.exp * 1000 > Date.now();
  if (!audOk || !expOk) {
    return { ok: false, code: 'invalid_token_claims' };
  }

  return { ok: true, uid: data.localId, email: data.email, idToken: data.idToken };
}

module.exports = { signInWithPassword, isConfigured };
