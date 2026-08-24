const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

const connectDB = async () => {
    try {
        if (!env.mongodbUri) {
            logger.warn('No MONGODB_URI set in environment. Database features will fail, but server will remain up to serve UI.');
            return;
        }
        await mongoose.connect(env.mongodbUri, {
            dbName: env.dbName || 'exam_auth',
        });
        logger.info(`MongoDB Connected: ${mongoose.connection.host}`);
    } catch (error) {
        logger.error('Error connecting to MongoDB: ', error);
    }
};

module.exports = connectDB;
