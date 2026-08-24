const PROJECT_ID = process.env.RECAPTCHA_PROJECT_ID;
const API_KEY = process.env.RECAPTCHA_API_KEY;
const SITE_KEY = process.env.RECAPTCHA_SITE_KEY;
const TEST_TOKEN = process.env.RECAPTCHA_TEST_TOKEN;
const MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
const ENABLED = process.env.RECAPTCHA_ENABLED === 'true';

function isConfigured() {
  return ENABLED && !!(SITE_KEY && API_KEY && PROJECT_ID);
}

async function verifyRecaptcha(token, expectedAction = 'LOGIN') {
  if (!isConfigured()) {
    return { ok: true, reason: 'recaptcha_not_configured', score: 0 };
  }
  if (!token) {
    return { ok: false, reason: 'no_token' };
  }
  if (TEST_TOKEN && token === TEST_TOKEN) {
    return { ok: true, reason: 'test_bypass', score: 1 };
  }

  try {
    const res = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/assessments?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: { token, expectedAction, siteKey: SITE_KEY }
        })
      }
    );
    const data = await res.json().catch(() => ({}));

    const props = data.tokenProperties || {};
    const score = data.riskAnalysis?.score ?? 0;
    const actionOk = !props.action || props.action === expectedAction;

    if (props.valid !== true) {
      return { ok: false, reason: props.invalidReason || 'invalid_token', score, hostname: props.hostname };
    }
    if (!actionOk) {
      return { ok: false, reason: 'action_mismatch', score, hostname: props.hostname };
    }
    if (score < MIN_SCORE) {
      return { ok: false, reason: `low_score_${score}`, score, hostname: props.hostname };
    }
    return { ok: true, reason: 'ok', score, hostname: props.hostname };
  } catch (err) {
    return { ok: false, reason: 'assessment_request_failed', error: err.message };
  }
}

module.exports = { verifyRecaptcha, isConfigured };
