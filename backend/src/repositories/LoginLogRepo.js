const LoginLog = require('../models/LoginLog');

class LoginLogRepo {
    async create(data) {
        return await LoginLog.create(data);
    }
    async findRecent(limit = 50) {
        return await LoginLog.find().sort({ timestamp: -1 }).limit(limit);
    }
}
module.exports = new LoginLogRepo();
