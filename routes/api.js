'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const { shortenLimiter } = require('../middleware/rateLimiter');
const urlController = require('../controllers/urlController');
const statsController = require('../controllers/statsController');

// ── Public: shorten a URL ──────────────────────────────────────────────────
// POST /api/shorten
router.post('/shorten', shortenLimiter, urlController.createShortUrl);

// ── Protected: URL management ──────────────────────────────────────────────
// GET  /api/urls            – list all with pagination & search
// GET  /api/urls/:shortCode – single URL details
// PUT  /api/urls/:shortCode – update URL metadata / toggle active
// DELETE /api/urls/:shortCode – delete URL + click logs
router.get('/urls', auth, urlController.listUrls);
router.get('/urls/:shortCode', auth, urlController.getUrl);
router.put('/urls/:shortCode', auth, urlController.updateUrl);
router.delete('/urls/:shortCode', auth, urlController.deleteUrl);

// ── QR code (public) ──────────────────────────────────────────────────────
// GET  /api/qr/:shortCode?format=png|svg
router.get('/qr/:shortCode', urlController.getQrCode);

// ── Protected: stats & logs ───────────────────────────────────────────────
// GET  /api/stats                     – overall dashboard stats
// GET  /api/stats/:shortCode          – per-URL stats
// GET  /api/stats/:shortCode/logs     – raw click logs
router.get('/stats', auth, statsController.getOverallStats);
router.get('/stats/:shortCode', auth, statsController.getUrlStats);
router.get('/stats/:shortCode/logs', auth, statsController.getClickLogs);

// ── Health check (public) ──────────────────────────────────────────────────
router.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

module.exports = router;
