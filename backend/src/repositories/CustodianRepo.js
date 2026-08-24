const Custodian = require('../models/Custodian');

class CustodianRepo {
    async countAll() {
        return await Custodian.countDocuments();
    }

    async findByEmail(email) {
        return await Custodian.findOne({ email });
    }

    async create(data) {
        return await Custodian.create(data);
    }

    async findAll() {
        return await Custodian.find();
    }
}
module.exports = new CustodianRepo();
