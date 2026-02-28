'use strict';

const router = require('express').Router();
const { identify, requireIdentity, requireUser } = require('../middleware/jwtAuth');
const { shortenLimiter } = require('../middleware/rateLimiter');
const urlController = require('../controllers/urlController');
const statsController = require('../controllers/statsController');

// Apply identity extraction to all API routes
router.use(identify);

// ── Public: shorten a URL (identity optional – attaches owner if present) ──
// POST /api/shorten
router.post('/shorten', shortenLimiter, urlController.createShortUrl);

// ── Protected: URL management (user OR guest) ──────────────────────────────
// GET  /api/urls            – list caller's URLs with pagination & search
// GET  /api/urls/:shortCode – single URL details (owner only)
// PUT  /api/urls/:shortCode – update URL metadata / toggle active (owner only)
// DELETE /api/urls/:shortCode – delete URL + click logs (owner only)
router.get('/urls', requireIdentity, urlController.listUrls);
router.get('/urls/:shortCode', requireIdentity, urlController.getUrl);
router.put('/urls/:shortCode', requireIdentity, urlController.updateUrl);
router.delete('/urls/:shortCode', requireIdentity, urlController.deleteUrl);

// ── QR code (public) ──────────────────────────────────────────────────────
// GET  /api/qr/:shortCode?format=png|svg
router.get('/qr/:shortCode', urlController.getQrCode);

// ── Stats & logs ──────────────────────────────────────────────────────────
// GET  /api/stats                     – overall stats  (JWT user only)
// GET  /api/stats/:shortCode          – per-URL stats  (owner only)
// GET  /api/stats/:shortCode/logs     – raw click logs (owner only)
router.get('/stats', requireUser, statsController.getOverallStats);
router.get('/stats/:shortCode', requireIdentity, statsController.getUrlStats);
router.get('/stats/:shortCode/logs', requireIdentity, statsController.getClickLogs);

// ── Health check (public) ──────────────────────────────────────────────────
router.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

module.exports = router;
