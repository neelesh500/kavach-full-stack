import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api.js';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const RECAPTCHA_ENABLED = import.meta.env.VITE_RECAPTCHA_ENABLED === 'true' && !!RECAPTCHA_SITE_KEY;

function loadRecaptchaScript() {
  return new Promise((resolve) => {
    if (window.grecaptcha?.enterprise) return resolve(true);
    const existing = document.getElementById('recaptcha-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const s = document.createElement('script');
    s.id = 'recaptcha-script';
    s.src = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

async function getRecaptchaToken() {
  if (!RECAPTCHA_ENABLED) return '';
  const loaded = await loadRecaptchaScript();
  if (!loaded || !window.grecaptcha?.enterprise) return '';
  return new Promise((resolve) => {
    window.grecaptcha.enterprise.ready(async () => {
      try {
        const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action: 'LOGIN' });
        resolve(token);
      } catch (err) {
        resolve('');
      }
    });
  });
}

function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const recaptchaToken = await getRecaptchaToken();
      const data = await api('POST', '/api/admin/login', { email, password, recaptchaToken });
      onSuccess(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card login">
      <h2>Admin Login</h2>
      <p className="note">Protected area — email/password verified via Firebase Auth.</p>
      <form onSubmit={doLogin}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@exam.gov" autoFocus />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Firebase password" />
        <button disabled={busy}>{busy ? 'Verifying...' : 'Login to Dashboard'}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [masterKey, setMasterKey] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [vaultBusy, setVaultBusy] = useState(false);

  function base64ToBlob(b64, mimeType) {
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mimeType || 'application/octet-stream' });
  }

  async function loadDocs() {
    const data = await api('GET', '/api/admin/documents', null, token);
    setDocs(data.documents || []);
  }

  async function doUpload(e) {
    e.preventDefault();
    if (!selectedFile) return;
    setVaultBusy(true);
    setNotice('');
    try {
      const reader = new FileReader();
      const b64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      await api('POST', '/api/admin/document/upload', {
        name: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
        data: b64
      }, token);
      setSelectedFile(null);
      e.target.reset();
      setNotice('Document uploaded and encrypted with the reconstructed master key.');
      await loadDocs();
    } catch (err) {
      setNotice('Upload failed: ' + err.message);
    } finally {
      setVaultBusy(false);
    }
  }

  async function doDecrypt(doc) {
    setVaultBusy(true);
    setNotice('');
    try {
      const d = await api('POST', `/api/admin/document/${doc._id}/decrypt`, {}, token);
      const url = URL.createObjectURL(base64ToBlob(d.data, d.mimeType));
      const a = document.createElement('a');
      a.href = url;
      a.download = d.name;
      a.click();
      URL.revokeObjectURL(url);
      setNotice(`"${d.name}" decrypted and downloaded (${Math.round(d.size / 1024)} KB).`);
    } catch (err) {
      setNotice('Decrypt failed: ' + err.message);
    } finally {
      setVaultBusy(false);
    }
  }

  async function refreshStatus() {
    const data = await api('GET', '/api/admin/status', null, token);
    setStatus(data);
    return data;
  }

  function backfillHistory(data) {
    const past = [];
    (data.logs || []).forEach((l) => {
      past.push({
        label: l.status === 'success' ? 'LOGIN' : 'LOGIN FAIL',
        time: new Date(l.loginTime),
        color: l.status === 'success' ? 'green' : 'red',
        data: { name: l.custodianId?.name || l.email || 'unknown', message: l.ipAddress || l.status }
      });
    });
    (data.submissions || []).forEach((s) => {
      past.push({
        label: 'SHARE',
        time: new Date(s.submittedAt),
        color: 'blue',
        data: { name: s.name || 'unknown', message: 'share recorded' }
      });
    });
    past.sort((a, b) => b.time - a.time);
    setEvents(past.slice(0, 40));
  }

  useEffect(() => {
    refreshStatus().then(backfillHistory).catch(() => {});
    const socket = io();
    const add = (label, color) => (data) =>
      setEvents((prev) => [{ label, time: new Date(), data, color }, ...prev].slice(0, 40));
    socket.on('custodian_login', add('LOGIN', 'green'));
    socket.on('share_submitted', add('SHARE', 'blue'));
    socket.on('threshold_met', add('THRESHOLD MET', 'orange'));
    socket.on('key_reconstructed', add('KEY RECONSTRUCTED', 'red'));
    ['custodian_login', 'share_submitted', 'threshold_met', 'key_reconstructed'].forEach((ev) =>
      socket.on(ev, () => refreshStatus().catch(() => {}))
    );
    const poll = setInterval(() => refreshStatus().catch(() => {}), 5000);
    return () => {
      socket.disconnect();
      clearInterval(poll);
    };
  }, [token]);

  async function doSetup() {
    setBusy(true);
    setNotice('');
    try {
      const data = await api('POST', '/api/admin/setup', null, token);
      setCredentials(data.custodians);
      setNotice(data.message);
      await refreshStatus();
    } catch (err) {
      setNotice('Setup failed: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    setBusy(true);
    try {
      await api('POST', '/api/admin/reset-session', null, token);
      setEvents([]);
      setMasterKey('');
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function doReconstruct() {
    setBusy(true);
    setNotice('');
    try {
      const data = await api('POST', '/api/admin/reconstruct', {}, token);
      setMasterKey(data.masterKey);
      setNotice(`Key reconstructed using shares from: ${data.usedShares.join(', ')}`);
      await refreshStatus();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  const active = status?.session || null;

  const vaultUnlocked = !!active?.masterKeyReconstructed;

  useEffect(() => {
    if (vaultUnlocked) loadDocs().catch(() => {});
  }, [vaultUnlocked, token]);

  return (
    <div className="dashboard">
      <div className="card">
        <h2>Admin Dashboard <span className="muted small">(authenticated)</span></h2>
        <div className="row">
          <button onClick={doSetup} disabled={busy}>Setup 5 Custodians + Split Key</button>
          <button onClick={doReset} disabled={busy} className="ghost">Clear Demo Shares (RAM only)</button>
          <button onClick={doReconstruct} disabled={busy || !active || active.shareCount < active.threshold} className="primary">
            Reconstruct Key ({active ? active.shareCount : 0}/{active ? active.threshold : 3})
          </button>
          <button onClick={onLogout} className="ghost">Logout</button>
        </div>
        <p className="note">Login history is permanent — Setup never deletes it. "Clear Demo Shares" only resets the in-memory share counter, not the logs.</p>
        {notice && <p className="note">{notice}</p>}
        {masterKey && (
          <div className="keybox">
            <h3>Reconstructed Master Key</h3>
            <code>{masterKey}</code>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Live Shares Collected</h3>
        {active ? (
          <div className="meter">
            {Array.from({ length: active.total }, (_, i) => (
              <span key={i} className={i < active.shareCount ? 'filled' : 'empty'} title={`Share ${i + 1}`} />
            ))}
            <p>{active.shareCount} of {active.total} shares · need {active.threshold} · {active.shareCount >= active.threshold ? 'UNLOCKED' : 'LOCKED'}</p>
          </div>
        ) : (
          <p className="note">No active session yet.</p>
        )}
        {active?.masterKeyReconstructed && <p className="success">Master key has been reconstructed.</p>}
      </div>

      <div className="card vault">
        <h3>Document Vault <span className="muted small">(encrypted with reconstructed master key)</span></h3>
        {vaultUnlocked ? (
          <>
            <p className="note">Vault is <span className="success">UNLOCKED</span> — threshold met. Uploaded documents are stored encrypted (AES-256-GCM) and only decryptable while the key is available.</p>
            <form onSubmit={doUpload} className="row">
              <input type="file" onChange={(e) => setSelectedFile(e.target.files[0] || null)} />
              <button type="submit" disabled={vaultBusy || !selectedFile} className="primary">
                {vaultBusy ? 'Working...' : 'Upload & Encrypt'}
              </button>
            </form>
            {docs.length === 0 && <p className="note">No documents in the vault yet.</p>}
            <ul className="events">
              {docs.map((doc) => (
                <li key={doc._id}>
                  <span className="pill blue">ENCRYPTED</span>
                  <span>{doc.name}</span>
                  <span className="muted">{Math.round(doc.size / 1024)} KB · {new Date(doc.uploadedAt).toLocaleString()}</span>
                  <button onClick={() => doDecrypt(doc)} disabled={vaultBusy} className="ghost small-btn">
                    Decrypt & Download
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="note">Vault is <b>LOCKED</b>. When {active ? active.threshold : 3} custodians submit their shares, the master key is reconstructed and the vault unlocks automatically — then you can upload the paper/document here encrypted.</p>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <h3>Live Events (Socket.io)</h3>
          {events.length === 0 && <p className="note">Waiting for custodian activity...</p>}
          <ul className="events">
            {events.map((ev, i) => (
              <li key={i} style={{ borderLeft: `4px solid var(--${ev.color})` }}>
                <span className={`pill ${ev.color}`}>{ev.label}</span>
                <span>{ev.time.toLocaleTimeString()}</span>
                <span className="muted">
                  {ev.data?.name ? ev.data.name + ' · ' : ''}
                  {ev.data?.message || (ev.data?.count !== undefined ? `count ${ev.data.count}` : '')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>Login Log <span className="muted small">(permanent, never deleted)</span></h3>
          {status?.logs?.length === 0 && <p className="note">No login attempts yet.</p>}
          <ul className="events">
            {status?.logs?.map((l, i) => (
              <li key={i}>
                <span className={`pill ${l.status === 'success' ? 'green' : 'red'}`}>{l.status}</span>
                <span>{new Date(l.loginTime).toLocaleString()}</span>
                <span className="muted">
                  {l.custodianId?.name || 'unknown'} · {l.custodianId?.email || ''} · {l.ipAddress || ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {credentials.length > 0 && (
        <div className="card">
          <h3>Custodian Credentials (demo only — production sends via secure channel)</h3>
          <div className="grid creds">
            {credentials.map((c) => (
              <div key={c.email} className="cred">
                <p><b>{c.name}</b> <span className="muted">({c.role})</span></p>
                <p className="muted">{c.email}</p>
                <p>Password: <code>{c.tempPassword}</code></p>
                <img src={c.qrDataUrl} alt="TOTP QR" width="120" height="120" />
                <p className="muted small">Secret: {c.totpSecret}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '');

  if (!token) {
    return (
      <AdminLogin
        onSuccess={(t) => {
          localStorage.setItem('admin_token', t);
          setToken(t);
        }}
      />
    );
  }

  return (
    <Dashboard
      token={token}
      onLogout={() => {
        localStorage.removeItem('admin_token');
        setToken('');
      }}
    />
  );
}
