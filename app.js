'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');

const connectDB = require('./config/database');
const { generalLimiter } = require('./middleware/rateLimiter');
const apiRouter = require('./routes/api');
const authRouter = require('./routes/auth');
const redirectRouter = require('./routes/redirect');

// ── Connect to MongoDB ──────────────────────────────────────────────────────
connectDB();

const app = express();

// ── Trust proxy (required for correct IP behind Railway / reverse proxy) ───
app.set('trust proxy', 1);

// ── Security & utility middleware ──────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:     ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc:      ["'self'", "'unsafe-inline'"],
        imgSrc:    ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc:   ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization', 'X-Guest-Id'],
  })
);
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(mongoSanitize());
app.use(express.static(path.join(__dirname, 'public')));

// ── Global rate limiter ────────────────────────────────────────────────────
app.use(generalLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────
// Auth routes: /api/auth/...
app.use('/api/auth', authRouter);

// API routes: /api/...
app.use('/api', apiRouter);

// Redirect route: /:shortCode  (must be last to avoid conflicts)
app.use('/', redirectRouter);

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ── Global error handler ───────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

module.exports = app;
