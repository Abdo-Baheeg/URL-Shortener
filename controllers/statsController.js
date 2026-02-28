'use strict';

const Url = require('../models/Url');
const Click = require('../models/Click');

// ─── Overall Dashboard Stats ─────────────────────────────────────────────────

exports.getOverallStats = async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalUrls,
      activeUrls,
      totalClicks,
      recentClicks,
      topUrls,
      clicksByDay,
      topCountries,
      topBrowsers,
      topDevices,
      topReferrers,
    ] = await Promise.all([
      Url.countDocuments(),
      Url.countDocuments({ isActive: true }),
      Click.countDocuments(),
      Click.countDocuments({ createdAt: { $gte: since } }),

      // Top 10 URLs by click count
      Url.find()
        .sort({ clickCount: -1 })
        .limit(10)
        .select('shortCode originalUrl title clickCount lastClickedAt createdAt')
        .lean(),

      // Clicks per day (last N days)
      Click.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', count: 1, _id: 0 } },
      ]),

      // Top countries
      Click.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { country: '$_id', count: 1, _id: 0 } },
      ]),

      // Top browsers
      Click.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$browser', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { browser: '$_id', count: 1, _id: 0 } },
      ]),

      // Device types
      Click.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$deviceType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { deviceType: '$_id', count: 1, _id: 0 } },
      ]),

      // Top referrer domains
      Click.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$referrerDomain', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { referrer: '$_id', count: 1, _id: 0 } },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        summary: { totalUrls, activeUrls, totalClicks, recentClicks, periodDays: days },
        topUrls,
        clicksByDay: fillMissingDays(clicksByDay, since, days),
        topCountries,
        topBrowsers,
        topDevices,
        topReferrers,
      },
    });
  } catch (err) {
    console.error('[getOverallStats]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Per-URL Stats ────────────────────────────────────────────────────────────

exports.getUrlStats = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const urlDoc = await Url.findOne({ shortCode }).lean();
    if (!urlDoc) return res.status(404).json({ error: 'URL not found.' });

    const baseMatch = { shortCode };
    const periodMatch = { shortCode, createdAt: { $gte: since } };

    const [
      totalClicks,
      uniqueIPs,
      clicksByDay,
      topCountries,
      topBrowsers,
      topOs,
      topDevices,
      topReferrers,
      recentClicks,
      clicksByHour,
    ] = await Promise.all([
      Click.countDocuments(baseMatch),

      // Unique IP count (approximate unique visitors)
      Click.aggregate([
        { $match: periodMatch },
        { $group: { _id: '$ip' } },
        { $count: 'uniqueVisitors' },
      ]).then((r) => r[0]?.uniqueVisitors || 0),

      // Clicks per day
      Click.aggregate([
        { $match: periodMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', count: 1, _id: 0 } },
      ]),

      // Top countries
      topAgg(Click, periodMatch, '$country', 'country', 10),

      // Top browsers
      topAgg(Click, periodMatch, '$browser', 'browser', 10),

      // Top OS
      topAgg(Click, periodMatch, '$os', 'os', 10),

      // Device types
      Click.aggregate([
        { $match: periodMatch },
        { $group: { _id: '$deviceType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { deviceType: '$_id', count: 1, _id: 0 } },
      ]),

      // Top referrer domains
      topAgg(Click, periodMatch, '$referrerDomain', 'referrer', 10),

      // Most recent 50 clicks
      Click.find(baseMatch)
        .sort({ createdAt: -1 })
        .limit(50)
        .select('ip browser os deviceType country city referrerDomain createdAt language')
        .lean(),

      // Clicks by hour of day (UTC)
      Click.aggregate([
        { $match: periodMatch },
        { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { hour: '$_id', count: 1, _id: 0 } },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        url: {
          shortCode: urlDoc.shortCode,
          originalUrl: urlDoc.originalUrl,
          title: urlDoc.title,
          isActive: urlDoc.isActive,
          expiresAt: urlDoc.expiresAt,
          createdAt: urlDoc.createdAt,
        },
        summary: { totalClicks, uniqueVisitors: uniqueIPs, periodDays: days },
        clicksByDay: fillMissingDays(clicksByDay, since, days),
        clicksByHour: fillMissingHours(clicksByHour),
        topCountries,
        topBrowsers,
        topOs,
        topDevices,
        topReferrers,
        recentClicks,
      },
    });
  } catch (err) {
    console.error('[getUrlStats]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Click Logs ───────────────────────────────────────────────────────────────

exports.getClickLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    const { shortCode } = req.params;

    const urlDoc = await Url.findOne({ shortCode }).select('_id shortCode').lean();
    if (!urlDoc) return res.status(404).json({ error: 'URL not found.' });

    const filter = { shortCode };
    if (req.query.country) filter.country = req.query.country;
    if (req.query.browser) filter.browser = req.query.browser;
    if (req.query.deviceType) filter.deviceType = req.query.deviceType;

    const [clicks, total] = await Promise.all([
      Click.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Click.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: clicks,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[getClickLogs]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topAgg(Model, match, groupField, labelKey, limit) {
  return Model.aggregate([
    { $match: match },
    { $group: { _id: groupField, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { [labelKey]: '$_id', count: 1, _id: 0 } },
  ]);
}

/**
 * Fill missing days in clicksByDay so the chart has full coverage.
 */
function fillMissingDays(data, since, days) {
  const map = Object.fromEntries(data.map((d) => [d.date, d.count]));
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: map[key] || 0 });
  }
  return result;
}

/**
 * Fill all 24 hours with 0 where no clicks occurred.
 */
function fillMissingHours(data) {
  const map = Object.fromEntries(data.map((d) => [d.hour, d.count]));
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: map[h] || 0 }));
}
