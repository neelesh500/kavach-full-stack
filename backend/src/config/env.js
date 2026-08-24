require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME,
  jwtSecret: process.env.JWT_SECRET,
  adminRequireMongoDbAdmins: process.env.ADMIN_REQUIRE_MONGODB_ADMINS === 'true',

  firebase: {
    apiKey: process.env.FIREBASE_API_KEY,
    projectId: process.env.FIREBASE_PROJECT_ID,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    adminEmail: process.env.FIREBASE_ADMIN_EMAIL,
  },

  recaptcha: {
    enabled: process.env.RECAPTCHA_ENABLED === 'true',
    siteKey: process.env.RECAPTCHA_SITE_KEY,
    projectId: process.env.RECAPTCHA_PROJECT_ID,
    apiKey: process.env.RECAPTCHA_API_KEY,
    minScore: parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5'),
    testToken: process.env.RECAPTCHA_TEST_TOKEN,
  },
  
  redis: {
    url: process.env.REDIS_URL || null,
  }
};
