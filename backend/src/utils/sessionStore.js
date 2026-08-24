const crypto = require('crypto');

const TOTAL_SHARES = 5;
const THRESHOLD = 3;
let active = null;

function newSession() {
  return {
    sessionId: crypto.randomBytes(12).toString('hex'),
    shares: [],
    threshold: THRESHOLD,
    total: TOTAL_SHARES,
    masterKeyReconstructed: null,
    startedAt: new Date()
  };
}

function getActiveSession() {
  if (!active) active = newSession();
  return active;
}

function resetSessions() {
  active = newSession();
}

module.exports = {
  TOTAL_SHARES,
  THRESHOLD,
  getActiveSession,
  resetSessions
};
