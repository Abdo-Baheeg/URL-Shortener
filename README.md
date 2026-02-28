# URL Shortener

A self-hosted, personal URL shortener built with **Node.js + Express + MongoDB**. Shortens links, tracks every click, and exposes detailed analytics — ready to deploy on [Railway](https://railway.app) in minutes.

---

## Features

- **Shorten** any URL with an auto-generated or custom alias
- **Link management** — update, deactivate, delete with full metadata support
- **Expiry** — set TTL via human-friendly strings (`7d`, `24h`, `30m`)
- **QR codes** — PNG or SVG, served on demand
- **Click tracking** — every redirect logs IP, browser, OS, device type, country, city, referrer, and language
- **Analytics** — per-URL and global dashboard with time-series, top-N breakdowns
- **Rate limiting** — per-route limits via `express-rate-limit`
- **Security** — Helmet headers, CORS, Mongo sanitization
- **API key auth** — simple `X-API-Key` guard on all write/read management endpoints

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Database | MongoDB (Mongoose) |
| Geo lookup | ip-api.com (free, no key) |
| UA parsing | ua-parser-js |
| QR codes | qrcode |
| Deploy | Railway |

---

## Project Structure

```
├── app.js                         # Express app setup
├── bin/www                        # HTTP server entry point
├── railway.toml                   # Railway deploy config
├── .env.example                   # Environment variable template
│
├── config/
│   └── database.js                # Mongoose connection
│
├── models/
│   ├── Url.js                     # URL document (TTL + text indexes)
│   └── Click.js                   # Click event document
│
├── controllers/
│   ├── urlController.js           # CRUD, redirect, QR generation
│   └── statsController.js         # Aggregation-based analytics
│
├── routes/
│   ├── api.js                     # /api/* route definitions
│   └── redirect.js                # /:shortCode redirect handler
│
├── middleware/
│   ├── auth.js                    # X-API-Key authentication
│   └── rateLimiter.js             # Per-route rate limits
│
└── utils/
    ├── shortCode.js               # Crypto-random base-62 code generator
    ├── geoip.js                   # IP → geo lookup (ip-api.com)
    └── parseUA.js                 # User-Agent → browser/OS/device
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)

### Local Setup

```bash
# 1. Clone & install
git clone https://github.com/Abdo-Baheeg/URL-Shortener.git
cd URL-Shortener
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set MONGODB_URI, API_KEY, BASE_URL

# 3. Run (dev with auto-reload)
npm run dev

# 4. Run (production)
npm start
```

### Generate a secure API key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `API_KEY` | ✅ | Secret key for protected endpoints |
| `BASE_URL` | ✅ | Public base URL (e.g. `https://yourapp.up.railway.app`) |
| `PORT` | No | HTTP port (default `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default `*`) |

---

## API Reference

### Authentication

Protected endpoints require an API key in one of:
- Header: `X-API-Key: <key>`
- Header: `Authorization: Bearer <key>`
- Query param: `?apiKey=<key>`

---

### Endpoints

#### Public

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check |
| `POST` | `/api/shorten` | Create a short URL |
| `GET` | `/:shortCode` | Redirect to original URL (logs click) |
| `GET` | `/api/qr/:shortCode` | QR code image (`?format=png\|svg`) |

#### URL Management *(auth required)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/urls` | List all URLs (paginated) |
| `GET` | `/api/urls/:shortCode` | Get a single URL |
| `PUT` | `/api/urls/:shortCode` | Update metadata / toggle active |
| `DELETE` | `/api/urls/:shortCode` | Delete URL and all its click logs |

#### Analytics *(auth required)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Global dashboard (`?days=30`) |
| `GET` | `/api/stats/:shortCode` | Per-URL analytics (`?days=30`) |
| `GET` | `/api/stats/:shortCode/logs` | Raw paginated click logs |

---

### POST `/api/shorten`

```jsonc
// Request body
{
  "url": "https://example.com/very/long/path",   // required
  "customAlias": "my-alias",                      // optional, 3–30 chars [a-zA-Z0-9_-]
  "expiresIn": "7d",                              // optional: 7d | 24h | 30m | 60s
  "title": "My Link",                             // optional
  "description": "Some context",                  // optional
  "tags": ["marketing", "q4"]                     // optional
}
```

```jsonc
// 201 Response
{
  "success": true,
  "data": {
    "id": "64f1...",
    "shortCode": "aB3xY7z",
    "shortUrl": "https://yourapp.up.railway.app/aB3xY7z",
    "originalUrl": "https://example.com/very/long/path",
    "title": "My Link",
    "tags": ["marketing", "q4"],
    "expiresAt": "2026-03-07T12:00:00.000Z",
    "createdAt": "2026-02-28T12:00:00.000Z"
  }
}
```

### GET `/api/stats` — Dashboard response shape

```jsonc
{
  "success": true,
  "data": {
    "summary": { "totalUrls": 15, "activeUrls": 12, "totalClicks": 1042, "recentClicks": 280, "periodDays": 30 },
    "topUrls": [ /* top 10 by click count */ ],
    "clicksByDay": [ { "date": "2026-02-01", "count": 12 }, /* ... full series */ ],
    "topCountries": [ { "country": "Egypt", "count": 320 } ],
    "topBrowsers":  [ { "browser": "Chrome", "count": 610 } ],
    "topDevices":   [ { "deviceType": "mobile", "count": 540 } ],
    "topReferrers": [ { "referrer": "twitter.com", "count": 95 } ]
  }
}
```

### List URLs — query params

| Param | Default | Description |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `20` | Items per page (max 100) |
| `search` | — | Full-text search (URL, title, tags) |
| `tag` | — | Filter by exact tag |
| `active` | — | `true` to return active URLs only |

---

## Deploying to Railway

1. Push the repo to GitHub.
2. Go to [Railway](https://railway.app) → **New Project → Deploy from GitHub**.
3. Add a **MongoDB** plugin from the Railway dashboard.
4. Set the following **service variables**:

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | `${{MongoDB.MONGODB_URL}}` |
   | `API_KEY` | *(your generated secret)* |
   | `BASE_URL` | `https://<your-railway-domain>` |
   | `NODE_ENV` | `production` |

5. Railway auto-detects `npm start` via `railway.toml` and deploys.

---

## Rate Limits

| Scope | Limit |
|---|---|
| All endpoints | 200 req / 15 min per IP |
| `POST /api/shorten` | 30 req / min per IP |
| `GET /:shortCode` | 120 req / min per IP |

---

## Postman Collection

Import `URL-Shortener.postman_collection.json` into Postman, then set the two collection variables:

| Variable | Description |
|---|---|
| `baseUrl` | Your app URL (e.g. `http://localhost:3000`) |
| `apiKey` | Value of your `API_KEY` env variable |

The **Shorten URL** request automatically saves the returned `shortCode` as a collection variable, so all subsequent requests pre-fill it.
