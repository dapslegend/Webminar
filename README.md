# Mind You Mental Health — Webinar Registration

Faith and Mental Health webinar registration app for **Mind You Mental Health**.

## Stack

- Node.js + Express
- PostgreSQL (`pg`)
- Static frontend in `public/`

## Environment variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `EXPORT_API_KEY` | Recommended | Secret key for exporting registrations |
| `PORT` | No | Defaults to `3000` |
| `HOST` | No | Defaults to `0.0.0.0` (needed on Render) |
| `NODE_ENV` | No | `production` on Render |
| `DATABASE_SSL` | No | Set `false` for local non-SSL Postgres |
| `SMTP_HOST` | For email | SMTP server host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | No | Defaults to `587` |
| `SMTP_SECURE` | No | `true` for port 465 |
| `SMTP_USER` | For email | SMTP username |
| `SMTP_PASS` | For email | SMTP password / app password |
| `SMTP_FROM` | No | From address (defaults to `SMTP_USER`) |
| `NOTIFY_EMAIL` | No | Defaults to `mind@gmail.com` |

## Registration email notifications

After each successful registration the server emails **NOTIFY_EMAIL** a password-protected ZIP containing that user's CSV.

- Attachment password = `EXPORT_API_KEY`
- Requires `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `EXPORT_API_KEY`
- Registration still succeeds if email sending fails (error is logged)

Gmail example: enable 2FA and create an App Password, then set:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM="Mind You Mental Health <your@gmail.com>"
NOTIFY_EMAIL=mind@gmail.com
```

## Local setup

1. Create a Postgres database.
2. Set `DATABASE_URL` in `.env`.
3. Install and run:

```bash
npm install
npm start
```

The app creates the `registrations` table automatically on startup.

## Export registrations

Protected endpoint:

```bash
# CSV download
curl -H "x-api-key: YOUR_EXPORT_API_KEY" \
  "https://YOUR-APP.onrender.com/api/export" \
  -o registrations.csv

# JSON
curl -H "x-api-key: YOUR_EXPORT_API_KEY" \
  "https://YOUR-APP.onrender.com/api/export?format=json"
```

You can also pass `?key=YOUR_EXPORT_API_KEY` if needed.

## Render deployment

1. Create a **Web Service** from this repo.
2. Add a **Render PostgreSQL** database.
3. In the web service environment:
   - `DATABASE_URL` = internal DB URL from Render Postgres
   - `EXPORT_API_KEY` = long random secret (also ZIP password for emails)
   - `NODE_ENV=production`
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (and optional `SMTP_FROM`, `NOTIFY_EMAIL`)
4. Build command: `npm install`
5. Start command: `npm start`

Render sets `PORT` automatically. The server binds to `0.0.0.0`.

## Health check

`GET /api/health`
