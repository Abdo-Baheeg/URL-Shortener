'use strict';

const axios = require('axios');

/**
 * Look up geo information for an IP address using the free ip-api.com service.
 * Returns an empty object on failure (timeout / private IP / rate limit).
 * @param {string} ip
 * @returns {Promise<Object>}
 */
const getGeoInfo = async (ip) => {
  // Skip private / loopback addresses
  if (
    !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.')
  ) {
    return { country: 'Localhost', city: 'Localhost', regionName: '', isp: '', countryCode: '' };
  }

  try {
    const { data } = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp`,
      { timeout: 3000 }
    );

    if (data.status === 'success') {
      return {
        country: data.country || 'Unknown',
        countryCode: data.countryCode || '',
        region: data.regionName || '',
        city: data.city || 'Unknown',
        isp: data.isp || '',
      };
    }
    return {};
  } catch {
    return {};
  }
};

module.exports = { getGeoInfo };
