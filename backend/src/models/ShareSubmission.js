const mongoose = require('mongoose');

const shareSubmissionSchema = new mongoose.Schema({
  custodianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Custodian' },
  sessionId: String,
  submittedAt: { type: Date, default: Date.now },
  usedInReconstruction: { type: Boolean, default: false }
});

shareSubmissionSchema.index({ custodianId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model('ShareSubmission', shareSubmissionSchema);
