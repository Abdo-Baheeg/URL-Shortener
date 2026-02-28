'use strict';

const jwt = require('jsonwebtoken');

// UUID v4 pattern used to validate guestId header
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * identify – non-blocking identity extraction.
 * Populates req.userId  (ObjectId string) for JWT users
 *         or req.guestId (UUID string)   for guests.
 */
const identify = (req, _res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = payload.userId;
    } catch {
      // invalid / expired token – treat as unauthenticated
    }
  }

  if (!req.userId) {
    const guestId = req.headers['x-guest-id'];
    if (guestId && UUID_RE.test(guestId)) {
      req.guestId = guestId;
    }
  }

  next();
};

/**
 * requireIdentity – blocks requests with no identity at all.
 */
const requireIdentity = (req, res, next) => {
  if (!req.userId && !req.guestId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
};

/**
 * requireUser – blocks requests without a valid JWT user session.
 */
const requireUser = (req, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Login required.' });
  }
  next();
};

module.exports = { identify, requireIdentity, requireUser };
