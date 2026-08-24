const Admin = require('../models/Admin');

class AdminRepo {
    async findByEmail(email) {
        return await Admin.findOne({ email });
    }

    async countAll() {
        return await Admin.countDocuments();
    }

    async create(data) {
        return await Admin.create(data);
    }
}
module.exports = new AdminRepo();
