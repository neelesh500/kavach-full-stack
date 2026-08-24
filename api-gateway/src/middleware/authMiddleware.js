const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secure-fallback-secret-kavach';
// Time Gates bounds - strictly reject if execution hits outside of these slots
const EXAM_START_TIME = process.env.EXAM_START_TIME ? new Date(process.env.EXAM_START_TIME) : new Date(Date.now() - 3600000);
const EXAM_END_TIME = process.env.EXAM_END_TIME ? new Date(process.env.EXAM_END_TIME) : new Date(Date.now() + 3600000);

/**
 * 1. RBAC & JWT Verification
 * Cryptographically verifies tokens and asserts role privileges gracefully.
 */
exports.verifyTokenAndRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
            }

            const token = authHeader.split(' ')[1];

            // Decodes and mathematically verifies authenticity
            const decoded = jwt.verify(token, JWT_SECRET);

            if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
                return res.status(403).json({ error: 'RBAC Violation: Role unauthorized for this operation.' });
            }

            req.user = decoded; // Attach strictly for downstream controller access
            next();
        } catch (error) {
            return res.status(403).json({ error: 'Token Validation Failed. Access Denied.' });
        }
    }
};

/**
 * 2. Time-Window Gate
 * Ensures exams and decryption vectors can only act during the designated national timeslot.
 */
exports.timeWindowGate = (req, res, next) => {
    const now = new Date();
    if (now < EXAM_START_TIME || now > EXAM_END_TIME) {
        return res.status(403).json({ error: 'Time-Window Violation: Outside of authorized operational hours.' });
    }
    next();
};
