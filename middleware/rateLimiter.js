'use strict';

const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    keyGenerator: (req) =>
      req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  });

// General API usage: 200 requests per 15 min
exports.generalLimiter = createLimiter(
  15 * 60 * 1000,
  200,
  'Too many requests from this IP, please try again after 15 minutes.'
);

// Shorten endpoint: 30 URLs per minute
exports.shortenLimiter = createLimiter(
  60 * 1000,
  30,
  'Too many shorten requests, please slow down.'
);

// Redirect endpoint: 120 redirects per minute
exports.redirectLimiter = createLimiter(
  60 * 1000,
  120,
  'Too many redirect requests from this IP.'
);
