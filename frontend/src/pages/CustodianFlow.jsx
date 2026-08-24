import { useState } from 'react';
import { api } from '../api.js';

const STEPS = ['Login', '2FA Verify', 'Submit Share'];

export default function CustodianFlow() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('POST', '/api/auth/login', { email, password });
      setSession({ custodianId: data.custodianId, name: data.name });
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doTotp(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('POST', '/api/auth/verify-totp', {
        custodianId: session.custodianId,
        token: totp
      });
      setSession((s) => ({ ...s, token: data.token, sessionId: data.sessionId, email: data.email }));
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doShare(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('POST', '/api/share/submit', { passwordForShare: sharePassword }, session.token);
      setSession((s) => ({ ...s, result: data }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Custodian Sign-In</h2>
      <div className="steps">
        {STEPS.map((s, i) => (
          <span key={s} className={i <= step ? 'done' : ''}>
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {step === 0 && (
        <form onSubmit={doLogin}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="a@exam.gov" autoFocus />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temp password (from setup)" />
          <button disabled={busy}>{busy ? 'Checking...' : 'Login'}</button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={doTotp}>
          <p className="note">Password OK — now enter the 6-digit code from Google Authenticator.</p>
          <label>TOTP code</label>
          <input value={totp} onChange={(e) => setTotp(e.target.value)} placeholder="123456" maxLength={6} autoFocus />
          <button disabled={busy}>{busy ? 'Verifying...' : 'Verify 2FA'}</button>
        </form>
      )}

      {step === 2 && !session?.result && (
        <form onSubmit={doShare}>
          <p className="note">Authenticated as <b>{session.name}</b>. Enter your share password to decrypt and submit your SSS share.</p>
          <label>Share password</label>
          <input type="password" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} placeholder="Same as login password" autoFocus />
          <button disabled={busy}>{busy ? 'Submitting...' : 'Submit Share'}</button>
        </form>
      )}

      {session?.result?.keyReconstructed ? (
        <div className="celebrate">
          <div className="celebrate-badge">&#10003;</div>
          <h2 className="celebrate-title">KEY RECONSTRUCTED</h2>
          <p className="note">
            <b>{session.result.count} of {session.result.total}</b> custodians successfully verified their
            identity. The Shamir Secret Sharing master key has been reconstructed from their combined shares.
          </p>
          <div className="keybox">
            <h3>Reconstructed Master Key</h3>
            <code>{session.result.masterKey}</code>
          </div>
          <p className="success">
            Document Vault on the Admin Dashboard is now <b>UNLOCKED</b> — the exam paper can be uploaded and
            encrypted.
          </p>
          <button onClick={() => { setSession(null); setStep(0); setTotp(''); setSharePassword(''); setPassword(''); }}>Continue</button>
        </div>
      ) : session?.result ? (
        <div className="success">
          <p>Share submitted successfully.</p>
          <p>Shares collected in this session: <b>{session.result.count}</b> / {session.result.threshold} required.</p>
          <p className="note">
            {session.result.count < session.result.threshold
              ? `Still need ${session.result.threshold - session.result.count} more share(s). No single custodian can unlock the key.`
              : 'Threshold met! The key can now be reconstructed by the Admin Dashboard.'}
          </p>
          <button onClick={() => { setSession(null); setStep(0); setTotp(''); setSharePassword(''); setPassword(''); }}>Sign out</button>
        </div>
      ) : null}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
