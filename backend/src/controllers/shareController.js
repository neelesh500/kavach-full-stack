const secrets = require('secrets.js-grempe');
const Custodian = require('../models/Custodian');
const ShareSubmission = require('../models/ShareSubmission');
const { decryptShareWithPassword } = require('../utils/cryptoUtils');
const { getIo } = require('../utils/socket');
const SessionService = require('../services/SessionService');

async function submitShare(req, res) {
  const { custodianId } = req.custodian;
  const { passwordForShare } = req.body;
  if (!passwordForShare) {
    return res.status(400).json({ error: 'passwordForShare required' });
  }

  const custodian = await Custodian.findById(custodianId);
  if (!custodian) {
    return res.status(404).json({ error: 'Custodian not found' });
  }

  const session = await SessionService.getActiveSession();

  const alreadySubmitted = await ShareSubmission.findOne({ custodianId, sessionId: session.sessionId });
  if (alreadySubmitted) {
    return res.status(400).json({ error: 'Share already submitted for this session' });
  }

  let decryptedShare;
  try {
    decryptedShare = decryptShareWithPassword(custodian.encryptedShare, passwordForShare);
  } catch (err) {
    return res.status(401).json({ error: 'Wrong password for share decryption' });
  }

  await ShareSubmission.create({ custodianId, sessionId: session.sessionId });
  session.shares.push({
    custodianId,
    name: custodian.name,
    role: custodian.role,
    share: decryptedShare,
    submittedAt: new Date()
  });

  await SessionService.saveSession(session);

  getIo().emit('share_submitted', {
    custodianId,
    name: custodian.name,
    role: custodian.role,
    time: new Date(),
    count: session.shares.length,
    threshold: session.threshold
  });

  let reconstructed = false;
  let masterKey = null;
  let usedShares = [];

  if (session.shares.length >= session.threshold) {
    getIo().emit('threshold_met', {
      message: 'Minimum threshold met! Key can now be reconstructed.',
      count: session.shares.length,
      threshold: session.threshold
    });
    if (!session.masterKeyReconstructed) {
      session.masterKeyReconstructed = secrets.combine(
        session.shares.slice(0, session.threshold).map((s) => s.share)
      );
      for (const s of session.shares.slice(0, session.threshold)) {
        await ShareSubmission.updateOne(
          { custodianId: s.custodianId, sessionId: session.sessionId },
          { usedInReconstruction: true }
        );
      }
      await SessionService.saveSession(session);
      reconstructed = true;
      masterKey = session.masterKeyReconstructed;
      usedShares = session.shares.slice(0, session.threshold).map((s) => s.name);
      getIo().emit('key_reconstructed', {
        message: 'Master key reconstructed automatically (threshold met)',
        time: new Date(),
        usedShares
      });
    }
  }

  return res.json({
    message: 'Share submitted',
    count: session.shares.length,
    threshold: session.threshold,
    total: session.total,
    keyReconstructed: reconstructed,
    masterKey,
    usedShares
  });
}

async function reconstruct(req, res) {
  const session = await SessionService.getActiveSession();

  if (session.shares.length < session.threshold) {
    return res.status(400).json({
      error: `Need at least ${session.threshold} shares, got ${session.shares.length}`
    });
  }

  if (session.masterKeyReconstructed) {
    const alreadyUsed = session.shares.slice(0, session.threshold).map((s) => s.name);
    return res.json({ message: 'Master key already reconstructed', masterKey: session.masterKeyReconstructed, usedShares: alreadyUsed });
  }

  const sharesToUse = session.shares.slice(0, session.threshold).map((s) => s.share);
  const masterKey = secrets.combine(sharesToUse);
  session.masterKeyReconstructed = masterKey;
  await SessionService.saveSession(session);

  const usedShares = session.shares.slice(0, session.threshold).map((s) => s.name);
  for (const s of session.shares.slice(0, session.threshold)) {
    await ShareSubmission.updateOne(
      { custodianId: s.custodianId, sessionId: session.sessionId },
      { usedInReconstruction: true }
    );
  }

  getIo().emit('key_reconstructed', {
    message: 'Master key reconstructed successfully',
    time: new Date(),
    usedShares
  });

  return res.json({ message: 'Master key reconstructed', masterKey, usedShares });
}

module.exports = { submitShare, reconstruct };
