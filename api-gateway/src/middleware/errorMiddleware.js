/**
 * Generic Error Handler (Non-blocking)
 * Ensures cryptographic keys and stack traces NEVER leak.
 */
module.exports = (err, req, res, next) => {
    // 1. Handle HTTP constraints (e.g. body-parser payload too large)
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Payload exceeds 50kb limit to prevent memory exhaustion.' });
    }

    // 2. Handle Inter-Service Errors safely
    if (err.response) {
        // Forward the specific restricted HTTP response from Python
        return res.status(err.response.status).json(err.response.data);
    }

    // 3. Fallback sanitized server error (NO stack traces sent to client)
    console.error('[Gateway Processing Error]', err.message); // Safe internal logging only

    // Explicitly nullify the error stack to prevent memory scraping vectors caching it
    err.stack = null;

    return res.status(500).json({ error: 'Gateway Processing Error. Secure boundary intact.' });
};
