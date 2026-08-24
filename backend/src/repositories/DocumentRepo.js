const Document = require('../models/Document');

class DocumentRepo {
    async create(data) {
        return await Document.create(data);
    }

    async findById(id) {
        return await Document.findById(id);
    }

    async findAllSelectLean(sortQuery, selectFields) {
        return await Document.find().sort(sortQuery).select(selectFields).lean();
    }
}

module.exports = new DocumentRepo();
