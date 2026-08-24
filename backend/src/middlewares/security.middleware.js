const helmet = require('helmet');
const hpp = require('hpp');
const cors = require('cors');

module.exports = (app) => {
    // Set security headers
    app.use(helmet());

    // Prevent HTTP Parameter Pollution
    app.use(hpp());

    // Enable CORS
    app.use(cors());
};
