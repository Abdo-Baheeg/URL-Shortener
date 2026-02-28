'use strict';

const crypto = require('crypto');

const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a cryptographically random alphanumeric short code.
 * @param {number} length - Desired length (default 7)
 * @returns {string}
 */
const generateShortCode = (length = 7) => {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => BASE62[b % 62])
    .join('');
};

/**
 * Validate a custom alias (only alphanumeric, hyphens, underscores; 3-30 chars).
 * @param {string} alias
 * @returns {boolean}
 */
const isValidAlias = (alias) => /^[a-zA-Z0-9_-]{3,30}$/.test(alias);

module.exports = { generateShortCode, isValidAlias };
