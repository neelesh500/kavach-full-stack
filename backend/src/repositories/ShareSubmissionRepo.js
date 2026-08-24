const ShareSubmission = require('../models/ShareSubmission');

class ShareSubmissionRepo {
    async create(data) {
        return await ShareSubmission.create(data);
    }

    async countUniqueCustodians() {
        return await ShareSubmission.distinct('custodianEmail');
    }

    async findAll() {
        return await ShareSubmission.find();
    }

    async deleteAll() {
        return await ShareSubmission.deleteMany({});
    }
}
module.exports = new ShareSubmissionRepo();
