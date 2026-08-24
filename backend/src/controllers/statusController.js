const LoginLog = require('../models/LoginLog');
const ShareSubmission = require('../models/ShareSubmission');
const Custodian = require('../models/Custodian');
const SessionService = require('../services/SessionService');

async function status(req, res) {
  const logs = await LoginLog.find()
    .sort({ loginTime: -1 })
    .limit(100)
    .populate('custodianId', 'name email');
  const submissions = await ShareSubmission.find().populate('custodianId', 'name email');
  const custodians = await Custodian.find().select('name role email createdAt');
  const session = await SessionService.getActiveSession();

  res.json({
    custodians,
    logs,
    session: {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      threshold: session.threshold,
      total: session.total,
      shareCount: session.shares.length,
      custodians: session.shares.map((s) => ({ name: s.name, role: s.role, submittedAt: s.submittedAt })),
      masterKeyReconstructed: !!session.masterKeyReconstructed
    },
    submissions: submissions.map((s) => ({
      custodianId: s.custodianId?._id,
      name: s.custodianId?.name,
      sessionId: s.sessionId,
      submittedAt: s.submittedAt,
      usedInReconstruction: s.usedInReconstruction
    }))
  });
}

async function resetSession(req, res) {
  await SessionService.resetSessions();
  res.json({ message: 'Session reset. Shares cleared.' });
}

module.exports = { status, resetSession };
