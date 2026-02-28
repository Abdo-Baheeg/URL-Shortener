'use strict';

const Url = require('../models/Url');
const Click = require('../models/Click');
const { generateShortCode, isValidAlias } = require('../utils/shortCode');
const { getGeoInfo } = require('../utils/geoip');
const { parseUserAgent, getReferrerDomain } = require('../utils/parseUA');
const QRCode = require('qrcode');

// ─── Helpers ────────────────────────────────────────────────────────────────

const getClientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.socket?.remoteAddress ||
  req.ip;

const buildShortUrl = (req, shortCode) => {
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/${shortCode}`;
};

// ─── Create Short URL ────────────────────────────────────────────────────────

exports.createShortUrl = async (req, res) => {
  try {
    const { url, customAlias, expiresIn, title, description, tags } = req.body;

    if (!url) return res.status(400).json({ error: 'url is required.' });

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }

    let shortCode;

    if (customAlias) {
      if (!isValidAlias(customAlias)) {
        return res.status(400).json({
          error:
            'Custom alias must be 3–30 characters and contain only letters, numbers, hyphens or underscores.',
        });
      }
      const existing = await Url.findOne({ shortCode: customAlias });
      if (existing) {
        return res.status(409).json({ error: 'Custom alias is already in use.' });
      }
      shortCode = customAlias;
    } else {
      // Generate a unique code
      let attempts = 0;
      do {
        shortCode = generateShortCode(7);
        attempts++;
        if (attempts > 10) return res.status(500).json({ error: 'Failed to generate unique code.' });
      } while (await Url.findOne({ shortCode }));
    }

    // Calculate expiry
    let expiresAt = null;
    if (expiresIn) {
      const ms = parseDuration(expiresIn);
      if (!ms) return res.status(400).json({ error: 'Invalid expiresIn format. Use e.g. "7d", "24h", "30m".' });
      expiresAt = new Date(Date.now() + ms);
    }

    const urlDoc = await Url.create({
      shortCode,
      originalUrl: url,
      title: title || '',
      description: description || '',
      expiresAt,
      tags: Array.isArray(tags) ? tags : [],
      createdByIp: getClientIp(req),
      userId: req.userId || null,
      guestId: !req.userId && req.guestId ? req.guestId : null,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: urlDoc._id,
        shortCode: urlDoc.shortCode,
        shortUrl: buildShortUrl(req, urlDoc.shortCode),
        originalUrl: urlDoc.originalUrl,
        title: urlDoc.title,
        description: urlDoc.description,
        tags: urlDoc.tags,
        expiresAt: urlDoc.expiresAt,
        createdAt: urlDoc.createdAt,
      },
    });
  } catch (err) {
    console.error('[createShortUrl]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Redirect ────────────────────────────────────────────────────────────────

exports.redirect = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const urlDoc = await Url.findOne({ shortCode });

    if (!urlDoc) {
      return res.status(404).json({ error: 'Short URL not found.' });
    }

    if (!urlDoc.isActive) {
      return res.status(410).json({ error: 'This link has been deactivated.' });
    }

    if (urlDoc.expiresAt && urlDoc.expiresAt < new Date()) {
      return res.status(410).json({ error: 'This link has expired.' });
    }

    // Fire-and-forget click tracking
    trackClick(req, urlDoc).catch((e) => console.error('[trackClick]', e));

    // Increment count (non-blocking, don't await)
    Url.updateOne(
      { _id: urlDoc._id },
      { $inc: { clickCount: 1 }, $set: { lastClickedAt: new Date() } }
    ).exec();

    return res.redirect(301, urlDoc.originalUrl);
  } catch (err) {
    console.error('[redirect]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── List URLs ───────────────────────────────────────────────────────────────

exports.listUrls = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();
    const tag = req.query.tag?.trim();
    const activeOnly = req.query.active === 'true';

    const filter = {};
    // Scope to the caller's URLs
    if (req.userId) filter.userId = req.userId;
    else if (req.guestId) filter.guestId = req.guestId;
    else return res.status(401).json({ error: 'Authentication required.' });

    if (search) filter.$text = { $search: search };
    if (tag) filter.tags = tag;
    if (activeOnly) filter.isActive = true;

    const [urls, total] = await Promise.all([
      Url.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Url.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: urls.map((u) => ({ ...u, shortUrl: buildShortUrl(req, u.shortCode) })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[listUrls]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Get Single URL ──────────────────────────────────────────────────────────

exports.getUrl = async (req, res) => {
  try {
    const ownerFilter = req.userId ? { userId: req.userId } : { guestId: req.guestId };
    const urlDoc = await Url.findOne({ shortCode: req.params.shortCode, ...ownerFilter }).lean();
    if (!urlDoc) return res.status(404).json({ error: 'URL not found.' });

    return res.json({
      success: true,
      data: { ...urlDoc, shortUrl: buildShortUrl(req, urlDoc.shortCode) },
    });
  } catch (err) {
    console.error('[getUrl]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Update URL ──────────────────────────────────────────────────────────────

exports.updateUrl = async (req, res) => {
  try {
    const { originalUrl, isActive, expiresAt, title, description, tags } = req.body;
    const update = {};

    if (originalUrl !== undefined) {
      try { new URL(originalUrl); } catch { return res.status(400).json({ error: 'Invalid URL.' }); }
      update.originalUrl = originalUrl;
    }
    if (isActive !== undefined) update.isActive = Boolean(isActive);
    if (expiresAt !== undefined) update.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (tags !== undefined) update.tags = Array.isArray(tags) ? tags : [];

    const ownerFilter = req.userId ? { userId: req.userId } : { guestId: req.guestId };
    const urlDoc = await Url.findOneAndUpdate(
      { shortCode: req.params.shortCode, ...ownerFilter },
      { $set: update },
      { new: true }
    );

    if (!urlDoc) return res.status(404).json({ error: 'URL not found or not owned by you.' });

    return res.json({ success: true, data: urlDoc });
  } catch (err) {
    console.error('[updateUrl]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Delete URL ──────────────────────────────────────────────────────────────

exports.deleteUrl = async (req, res) => {
  try {
    const ownerFilter = req.userId ? { userId: req.userId } : { guestId: req.guestId };
    const urlDoc = await Url.findOneAndDelete({ shortCode: req.params.shortCode, ...ownerFilter });
    if (!urlDoc) return res.status(404).json({ error: 'URL not found or not owned by you.' });

    // Also remove all clicks for this URL
    await Click.deleteMany({ urlId: urlDoc._id });

    return res.json({ success: true, message: 'URL and its click logs deleted.' });
  } catch (err) {
    console.error('[deleteUrl]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── QR Code ─────────────────────────────────────────────────────────────────

exports.getQrCode = async (req, res) => {
  try {
    const urlDoc = await Url.findOne({ shortCode: req.params.shortCode });
    if (!urlDoc) return res.status(404).json({ error: 'URL not found.' });

    const shortUrl = buildShortUrl(req, urlDoc.shortCode);
    const format = req.query.format === 'svg' ? 'svg' : 'png';

    if (format === 'svg') {
      const svg = await QRCode.toString(shortUrl, { type: 'svg', margin: 1 });
      res.set('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    const buffer = await QRCode.toBuffer(shortUrl, { type: 'png', margin: 1, scale: 6 });
    res.set('Content-Type', 'image/png');
    return res.send(buffer);
  } catch (err) {
    console.error('[getQrCode]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function trackClick(req, urlDoc) {
  const ip = getClientIp(req);
  const uaString = req.headers['user-agent'] || '';
  const referrer = req.headers['referer'] || req.headers['referrer'] || '';
  const language = req.headers['accept-language']?.split(',')[0].trim() || '';

  const { browser, browserVersion, os, osVersion, deviceType } = parseUserAgent(uaString);
  const referrerDomain = getReferrerDomain(referrer);
  const geo = await getGeoInfo(ip);

  await Click.create({
    urlId: urlDoc._id,
    shortCode: urlDoc.shortCode,
    ip,
    userAgent: uaString.slice(0, 500),
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
    referrer: referrer || 'Direct',
    referrerDomain,
    country: geo.country || 'Unknown',
    countryCode: geo.countryCode || '',
    region: geo.region || '',
    city: geo.city || 'Unknown',
    isp: geo.isp || '',
    language,
  });
}

/**
 * Parse duration strings like "7d", "24h", "30m", "60s" into milliseconds.
 */
function parseDuration(str) {
  const match = String(str).match(/^(\d+)(d|h|m|s)$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const map = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return n * map[unit];
}
