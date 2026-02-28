'use strict';

const UAParser = require('ua-parser-js');

/**
 * Parse a User-Agent string and return structured info.
 * @param {string} uaString
 * @returns {{ browser, browserVersion, os, osVersion, deviceType }}
 */
const parseUserAgent = (uaString) => {
  if (!uaString) {
    return {
      browser: 'Unknown',
      browserVersion: '',
      os: 'Unknown',
      osVersion: '',
      deviceType: 'unknown',
    };
  }

  const parser = new UAParser(uaString);
  const result = parser.getResult();

  const lowerUA = uaString.toLowerCase();
  let deviceType = 'desktop';

  if (result.device.type === 'mobile') deviceType = 'mobile';
  else if (result.device.type === 'tablet') deviceType = 'tablet';
  else if (
    lowerUA.includes('bot') ||
    lowerUA.includes('crawler') ||
    lowerUA.includes('spider') ||
    lowerUA.includes('googlebot') ||
    lowerUA.includes('bingbot') ||
    lowerUA.includes('slurp')
  ) {
    deviceType = 'bot';
  }

  return {
    browser: result.browser.name || 'Unknown',
    browserVersion: result.browser.version || '',
    os: result.os.name || 'Unknown',
    osVersion: result.os.version || '',
    deviceType,
  };
};

/**
 * Extract the domain from a referrer URL.
 * @param {string} referrer
 * @returns {string}
 */
const getReferrerDomain = (referrer) => {
  if (!referrer) return 'Direct';
  try {
    const url = new URL(referrer);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return referrer;
  }
};

module.exports = { parseUserAgent, getReferrerDomain };
