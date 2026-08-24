# Threshold Multi-Custodian Authentication — Paper Leak Prevention System

A **(5,3) Shamir Secret Sharing (SSS)** based multi-custodian authentication system that prevents
**question-paper leakage**. No single person — not even the admin — can unlock the exam key or the
uploaded paper. At least **3 out of 5 custodians** must verify themselves (password + TOTP 2FA)
and submit their shares. Only then is the master key reconstructed and the **Document Vault** unlocked.

---

## 1. Problem we are solving by dushyant 😲

In a typical exam body, one person (or one password) holds the paper — that is a single point of
failure. If that person is bribed, coerced, or hacked, the paper leaks.

**Our solution:** distribute trust. The master key is split into **5 shares**. To reconstruct it you
need any **3**. This means:

- 1 or 2 custodians can do nothing on their own.
- If one custodian is compromised, the key is safe.
- At least 3 people must cooperate (and all 3 must pass password **and** TOTP 2FA) to unlock anything.

---

## 2. What we used (tech stack & libraries)

### Backend — `backend/`
| Tech / library | Why we used it |
|---|---|
| **Node.js + Express 5** | REST API server |
| **MongoDB Atlas (cloud)** + **Mongoose 9** | Cloud database (models, logs, shares, documents) |
| **secrets.js-grempe** | Shamir's Secret Sharing — `share()` splits the key, `combine()` reconstructs it |
| **crypto (Node built-in)** | AES-256-GCM encryption/decryption (shares + documents) |
| **bcrypt** | Hashing custodian temp passwords (never stored plaintext) |
| **speakeasy** | TOTP generation & verification (Google Authenticator compatible) |
| **qrcode** | Renders the TOTP secret as a scannable QR code |
| **jsonwebtoken (JWT)** | 2-hour session tokens for custodians, 8-hour tokens for admin |
| **socket.io** | Real-time events to the Admin Dashboard (`custodian_login`, `share_submitted`, `threshold_met`, `key_reconstructed`) |
| **Firebase Auth (Identity Toolkit REST API)** | Admin email/password verification (`signInWithPassword`) |
| **Google reCAPTCHA Enterprise** | Optional bot protection on the admin login (can be toggled off for demo) |
| **dotenv** | Loads secrets from `.env` |

### Frontend — `frontend/`
| Tech | Why we used it |
|---|---|
| **Vite + React** | Fast single-page app |
| **socket.io-client** | Live-updating Admin Dashboard |
| **react-router (hash routing)** | `/admin` and `/custodian` pages |
| **Google reCAPTCHA Enterprise script** | Enterprise score token on admin login (toggleable) |

---

## 3. How it works — step by step

### 3.1 Key splitting (Setup)
1. Admin clicks **"Setup 5 Custodians + Split Key"** (`POST /api/admin/setup`).
2. Server generates a random **256-bit master key** (32 bytes → 64 hex chars).
3. `secrets.share(masterKey, 5, 3)` splits it into **5 shares** — any **3** can rebuild it.
4. For each of the 5 custodians:
   - a random **temp password** is generated (stored only as a **bcrypt hash**),
   - a **TOTP secret** is generated and shown as a **QR code**,
   - their **share is encrypted with AES-256-GCM** using a key derived from that custodian's temp password,
   - all of this is stored in the `custodians` collection (the master key itself is **never stored**).
5. The active share session is reset to `0 / 5` collected, `masterKeyReconstructed = null`.

### 3.2 Custodian login (password + 2FA)
1. Custodian enters email + password → `POST /api/auth/login`.
   - Server `bcrypt.compare`s the hash; wrong password or unknown email → **401** and a **fail** is logged.
2. Server asks for a TOTP code → custodian enters the 6-digit code from Google Authenticator.
   - `POST /api/auth/verify-totp` verifies with `speakeasy.totp.verify`.
   - Wrong code → **401**, logged as **fail**.
   - Correct code → a **JWT (2h)** + login session, a **success** is logged, and `custodian_login` is emitted live.

### 3.3 Share submission
1. Custodian enters their **share password** (same as temp password) → `POST /api/share/submit`.
2. Server decrypts the stored encrypted share with that password (`decryptShareWithPassword`).
   - Wrong password → **401**.
   - Same custodian submitting twice in this session → **400** (duplicate blocked).
3. Server records the share in the **in-memory session** and permanently in the
   `sharesubmissions` collection. It emits `share_submitted` live.

### 3.4 Threshold met → KEY RECONSTRUCTED (automatic)
- When the **3rd** share arrives:
  - `threshold_met` is emitted,
  - the server **automatically** runs `secrets.combine(3 shares)` → `masterKeyReconstructed`,
  - the shares used are marked `usedInReconstruction: true`,
  - `key_reconstructed` is emitted,
  - **the 3rd custodian's screen opens a new interface** ("KEY RECONSTRUCTED") showing the
    reconstructed master key and confirming the vault is unlocked.
- With only 1 or 2 shares, reconstruction is **blocked (400)**.

### 3.5 Document Vault (encrypt the paper)
- The vault is **LOCKED** until `masterKeyReconstructed` is true.
- While unlocked, the admin can upload a document (`POST /api/admin/document/upload`):
  1. A random 256-bit **file key** encrypts the document (**AES-256-GCM**).
  2. That file key is itself **encrypted with the reconstructed master key** (envelope encryption).
  3. Only ciphertext (base64 `encryptedData`, `iv`, `tag`, encrypted file key) is stored in the
     `documents` collection — **no plaintext ever touches the database**.
- "Decrypt & Download" (`POST /api/admin/document/:id/decrypt`) works **only while the master key
  is still in memory** (threshold met). If the session is reset / server restarts, the key is gone
  and the document stays encrypted — no one, not even the admin, can open it.

### 3.6 Admin Dashboard
- **Admin login** (`POST /api/admin/login`): email + password are verified by **Firebase Auth**
  (`signInWithPassword` via Identity Toolkit), then a **JWT (8h)** is issued.
  - Optional: `ADMIN_REQUIRE_MONGODB_ADMINS=true` requires the email to also exist in the MongoDB
    `admins` collection (default `false` — any valid Firebase user is allowed).
  - Optional reCAPTCHA Enterprise verification on login (`RECAPTCHA_ENABLED`).
- Dashboard shows **live** via Socket.io:
  - `LOGIN` / `LOGIN FAIL` events (permanent `LoginLog`),
  - `SHARE` submissions,
  - share meter **LOCKED / UNLOCKED**,
  - `KEY RECONSTRUCTED`,
  - the **Document Vault** (unlocked after threshold).
- **Setup** re-seeds custodians but **never deletes** LoginLog / ShareSubmission (audit trail is permanent).
- **Clear Demo Shares** only resets the in-memory share counter (RAM), not the logs.

---

## 4. Project structure

```
├── backend/
│   ├── models/            Custodian, Admin, LoginLog, ShareSubmission, Document
│   ├── controllers/       adminAuth, admin, auth, share, status, document
│   ├── services/          adminService (admin seed/index cleanup), seedService (key split + shares)
│   ├── routes/            adminRoutes, authRoutes, shareRoutes
│   ├── utils/
│   │   ├── cryptoUtils.js      AES-256-GCM encrypt/decrypt (shares + documents)
│   │   ├── sessionStore.js     in-memory active session (threshold 3, total 5)
│   │   ├── authMiddleware.js   custodian JWT guard
│   │   ├── adminAuthMiddleware.js  admin JWT guard
│   │   ├── socket.js           Socket.io singleton
│   │   ├── firebase.js         Firebase email/password sign-in + ID-token claim check
│   │   ├── recaptcha.js        reCAPTCHA Enterprise assessment (toggleable)
│   │   └── dns.js              forces public DNS for MongoDB Atlas SRV (network fix)
│   ├── scripts/           setup.js (CLI seed), test-flow.js (e2e), crypto-check.js
│   ├── app.js             Express + Socket.io factory, serves frontend/dist
│   ├── server.js          entry point — connects Atlas, ensures admin, listens :3000
│   └── .env / .env.example
└── frontend/
    ├── src/
    │   ├── pages/AdminDashboard.jsx   admin login + live dashboard + Document Vault
    │   ├── pages/CustodianFlow.jsx    3-step custodian flow + KEY RECONSTRUCTED screen
    │   └── ...                         api.js, App.jsx, index.css
    └── .env / .env.example
```

---

## 5. API reference

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/admin/login` | — | Admin login (Firebase + optional reCAPTCHA) → JWT |
| POST | `/api/admin/setup` | Admin JWT | Create 5 custodians + split key |
| GET | `/api/admin/status` | Admin JWT | Live status, logs, submissions, session |
| POST | `/api/admin/reset-session` | Admin JWT | Clear in-memory shares (RAM only) |
| POST | `/api/admin/reconstruct` | Admin JWT | Manually reconstruct key (auto-reconstruct also happens) |
| POST | `/api/admin/document/upload` | Admin JWT | Upload + encrypt document (needs unlocked vault) |
| GET | `/api/admin/documents` | Admin JWT | List documents + locked state |
| POST | `/api/admin/document/:id/decrypt` | Admin JWT | Decrypt & download (needs unlocked vault) |
| POST | `/api/auth/login` | — | Custodian password check → asks for TOTP |
| POST | `/api/auth/verify-totp` | — | TOTP verify → custodian JWT |
| POST | `/api/share/submit` | Custodian JWT | Decrypt & submit SSS share |

---

## 6. Setup

### 6.1 MongoDB Atlas (free tier)
1. Create a free cluster at <https://www.mongodb.com/atlas>.
2. **Connect → Drivers** → copy the connection string, put your DB user/password in it.
3. Paste it as `MONGODB_URI` in `backend/.env`.

> If your network blocks `mongodb.net` SRV lookups, `utils/dns.js` automatically forces public DNS
> (8.8.8.8 / 1.1.1.1) before connecting.

### 6.2 Backend
```bash
cd backend
npm install
copy .env.example .env
# edit .env → set MONGODB_URI, JWT_SECRET, Firebase keys, reCAPTCHA keys
npm start                # http://localhost:3000
```

### 6.3 Frontend (dev mode, optional)
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173 (proxies /api to :3000)
```
Or build once so the backend serves everything at `http://localhost:3000`:
```bash
cd frontend && npm run build
```

### 6.4 Firebase (admin login)
1. <https://console.firebase.google.com> → your project (`sih-project-125e9`).
2. **Authentication → Sign-in method → Email/Password → Enable**.
3. **Authentication → Users → Add user** with `admin@exam.gov` (or any email) and a password.
4. Copy the **Web API key** into `FIREBASE_API_KEY` in `backend/.env`.

### 6.5 reCAPTCHA Enterprise (optional, for live demo you can keep it OFF)
1. <https://cloud.google.com/recaptcha-enterprise> → create a Website key with checkbox score.
2. Put `RECAPTCHA_SITE_KEY`, `RECAPTCHA_PROJECT_ID`, `RECAPTCHA_API_KEY` in `backend/.env`
   and the site key as `VITE_RECAPTCHA_SITE_KEY` in `frontend/.env`.
3. Set `RECAPTCHA_ENABLED=true` in `backend/.env` and `VITE_RECAPTCHA_ENABLED=true` in `frontend/.env`,
   then rebuild the frontend.

---

## 7. Demo flow (for judges)

1. Start backend: `cd backend && npm start` → open `http://localhost:3000`.
2. Go to **`#/admin`** → login with the Firebase email/password (e.g. `admin@exam.gov`).
3. Click **Setup 5 Custodians + Split Key** → shows 5 custodians with temp passwords + TOTP QR codes.
4. Scan any QR into **Google Authenticator** (or use the shown base32 secret).
5. Open **`#/custodian`** in a new tab → login as custodian 1 (email + temp password → TOTP → share password).
   - Admin dashboard shows `LOGIN` + `SHARE` events; meter shows **1/3 — LOCKED**.
6. Repeat for custodian 2 → meter **2/3 — LOCKED**, reconstruction still blocked.
7. Log in as custodian 3 → **"KEY RECONSTRUCTED" interface opens on the custodian screen**,
   and the admin dashboard meter flips to **3/3 — UNLOCKED** with the reconstructed master key.
8. In the **Document Vault**, upload the exam paper → it is stored **encrypted**.
9. Click **Decrypt & Download** while the vault is unlocked → original file comes back byte-for-byte.
10. Click **Clear Demo Shares** → vault re-locks and the document can no longer be decrypted
    (proves nothing plaintext is stored).

---

## 8. Automated tests

Backend must be running, then:
```bash
cd backend
npm test        # e2e: 17 checks — admin login, setup, wrong password/TOTP, duplicate share,
                # 2 shares blocked, 3rd share reconstructs, vault upload/decrypt, auth guards
```

Pure crypto sanity check (no server/DB needed):
```bash
cd backend && node scripts/crypto-check.js   # 7 checks: SSS split/combine + AES-256-GCM round-trip
```

---

## 9. Environment variables

### `backend/.env`
| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `DB_NAME` | Database name (e.g. `Dushyant`) |
| `JWT_SECRET` | Signing secret for JWTs |
| `PORT` | Server port (3000) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Legacy/seed admin values (kept for reference) |
| `ADMIN_REQUIRE_MONGODB_ADMINS` | `true` = Firebase email must also exist in MongoDB `admins`; `false` = any Firebase user allowed |
| `FIREBASE_API_KEY` | Firebase Web API key |
| `FIREBASE_PROJECT_ID` | Firebase project id |
| `FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `FIREBASE_ADMIN_EMAIL` | Default admin email shown in setup |
| `RECAPTCHA_ENABLED` | `true`/`false` toggle for reCAPTCHA Enterprise |
| `RECAPTCHA_SITE_KEY` | reCAPTCHA site key |
| `RECAPTCHA_PROJECT_ID` | GCP project id |
| `RECAPTCHA_API_KEY` | GCP API key for assessments |
| `RECAPTCHA_MIN_SCORE` | Minimum risk score (default 0.5) |
| `RECAPTCHA_TEST_TOKEN` | Bypass token accepted in dev/test |

### `frontend/.env`
| Variable | Purpose |
|---|---|
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA site key used by the browser |
| `VITE_RECAPTCHA_ENABLED` | `true`/`false` toggle (must match backend) |

---

## 10. Security notes (for the report)

- **No single point of failure** — threshold 3 of 5; collusion of ≥3 custodians is required.
- **2FA everywhere** — password + time-based OTP for every custodian; failures are logged.
- **Shares encrypted at rest** — AES-256-GCM, keyed by each custodian's own password.
- **Master key never stored** — only reconstructed in memory when threshold is met, then discarded.
- **Documents stored encrypted** — envelope encryption (file key encrypted by master key);
  no plaintext in the database.
- **Audit trail** — every login success/fail with IP + user agent, permanent (Setup/Reset never delete it).
- **Admin panel** — Firebase Auth (+ optional reCAPTCHA Enterprise score gate).
- **Demo caveats / production improvements**:
  - Send temp passwords + TOTP secrets via a secure channel (never print them).
  - Store the in-memory share session in a shared store (Redis) if running multiple server instances.
  - Encrypt the reconstructed key session at rest, and expire it immediately after use.
  - `request.json` documents the exact reCAPTCHA assessment payload.
