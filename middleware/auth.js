'use strict';

/**
 * API key authentication middleware.
 * Reads the key from X-API-Key header or ?apiKey query param.
 */
const auth = (req, res, next) => {
  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.query.apiKey;

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: API_KEY not set.' });
  }

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key.' });
  }

  next();
};

module.exports = auth;
