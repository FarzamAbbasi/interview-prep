# Interview Prep Portal

A website for preparing programming interviews: questions with answers, timed quizzes, progress tracking and an admin panel to manage everything.

**Stack:** MongoDB Atlas · Express 5 · React 19 (Vite) · Node.js · Tailwind CSS v4

---

## Features

| Visitor | What they get |
|---|---|
| **Guest** | Languages, 5 free Q&A per language, pricing page |
| **Free user** (account, no full access) | Everything above + 5-question sample quiz, quiz history |
| **Full access** (paid, turned on by the admin) | All answers, quizzes by language / topic / difficulty, bookmarks |
| **Admin** | Dashboard stats, users (full access, block), languages and topics, questions (Q&A + MCQ), backup |

- Sign up with email verification, login, forgot / reset password
- Questions: topic tabs, difficulty, tags, search, pages; paid answers locked for others
- Quiz: 6 random MCQs (sample: 5 free MCQs), 30 seconds each, timer kept by the server, auto-submit, review with explanations
- Dashboard: scores per language and quiz history
- Admin backup: download all content as JSON, import with a preview (never deletes)

---

## Project structure

```
interview-prep-portal/
├── server/                Express API
│   ├── config/db.js       MongoDB connection
│   ├── controllers/       request handlers (auth, languages, questions, quiz, bookmarks, admin)
│   ├── middleware/        auth (protect / admin / paid), validation, rate limits, errors
│   ├── models/            User, Language, Question, QuizAttempt
│   ├── routes/            URL → controller
│   ├── utils/             email, tokens, filters, backup/import
│   ├── scripts/           seed, backup, test email, dev token
│   ├── data/              languages.json, questions.json, backups/
│   ├── app.js             Express app (routes + middleware)
│   └── server.js          starts the app after the database connects
├── client/                React website
│   └── src/
│       ├── api/axios.js   API calls (adds the login token, logs out on 401)
│       ├── context/       login state (AuthContext)
│       ├── components/    layout, UI pieces, questions, admin, route guards
│       ├── pages/         one file per page (auth/, quiz/, admin/)
│       └── hooks/         useAuth, useLanguages, usePageTitle
├── api-tests/             .http files for VS Code REST Client, one per ticket
└── docs/
    ├── TEST-CHECKLIST.md  manual test list for every role
    └── DEPLOY.md          hosting guide (Atlas, Render, Vercel, Brevo)
```

---

## Run locally

Needs **Node.js 24**, a **MongoDB Atlas** cluster and a **Gmail App Password**.

```bash
# 1. API
cd server
npm install
cp .env.example .env        # then fill in the values
npm run seed                # languages, questions and the first admin
npm run dev                 # http://localhost:5000/api/health

# 2. Website (second terminal)
cd client
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

If the API says **"Could not connect to any servers"**, your internet IP changed: Atlas → Network Access → Add Current IP Address.

---

## Environment variables

**server/.env** (see `server/.env.example`)

| Name | Purpose |
|---|---|
| `PORT` | API port (5000) |
| `NODE_ENV` | `development` locally, `production` on the server |
| `CLIENT_URL` | Website address, used for CORS and email links |
| `MONGO_URI` | Atlas connection string (database `interview-prep`) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Login token secret (long and random) and lifetime (`7d`) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin, created by `npm run seed` |
| `BREVO_API_KEY`, `EMAIL_FROM` | Brevo email API (used on Render; when set, SMTP is ignored). `EMAIL_FROM` = verified sender |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Gmail SMTP for verification and reset emails (local) |
| `EMAIL_FROM_NAME` | Sender name in emails |
| `TRUST_PROXY` | Optional, default `1`. Proxy hops in front of the API (see DEPLOY.md) |

**client/.env** (see `client/.env.example`)

| Name | Purpose |
|---|---|
| `VITE_API_URL` | API address ending in `/api` |
| `VITE_PRICE_TEXT` | Price shown on the pricing page |
| `VITE_CONTACT_EMAIL` | Where "Request full access" emails go |

---

## Scripts (server)

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with auto-restart |
| `npm start` | Start the API (production) |
| `npm run seed` | Add / update languages and questions from `data/*.json`, create the first admin. Safe to run again (no duplicates, never deletes) |
| `npm run seed -- --file=data/backups/<file>.json` | Restore from a backup file |
| `npm run seed:fresh` | **Deletes** all languages, questions and quiz results, then seeds |
| `npm run backup` | Save all content to `data/backups/backup-<date>.json` |
| `npm run test:email -- you@email.com` | Check the email settings (Brevo or Gmail) and send test emails |
| `npm run dev:token -- user@email.com` | Print a login token for testing |

---

## Admin guide

- **Give full access after payment:** Admin → Users → find the user → *Give full access*. The user refreshes the page.
- **Block a user:** Admin → Users → *Block* (they are logged out and cannot log in).
- **Add a language:** Admin → Languages → *Add language* (name, logo, description, topics).
- **Add questions:** Admin → Questions → *Add question*. Choose Q&A or MCQ; an MCQ needs 4 different options and the correct one. Mark *Free* to show it to everyone (free MCQs form the sample quiz).
- **Hide instead of delete:** a language with questions, or an MCQ used in a quiz, cannot be deleted. Use *Deactivate*.
- **Backup:** Admin → Backup → *Download backup* regularly. Import shows a preview first and never deletes.

---

## API overview

All responses: `{ success, message?, data }`. Errors: `{ success: false, message, errors?, code? }`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `GET /verify-email/:token`, `POST /resend-verification`, `POST /login`, `GET /me`, `POST /forgot-password`, `POST /reset-password/:token` |
| Languages | `GET /api/languages`, `GET /api/languages/:slug`; admin: `POST`, `PUT /:id`, `DELETE /:id` |
| Questions | `GET /api/questions`, `GET /api/questions/tags`, `GET /api/questions/:id` |
| Quiz | `POST /api/quiz/start`, `POST /api/quiz/:id/submit`, `GET /api/quiz/history`, `GET /api/quiz/:id` |
| Bookmarks (full access) | `GET /api/bookmarks`, `POST /api/bookmarks/:questionId` (toggle) |
| Admin | `/api/admin/stats`, `/api/admin/users` (+ `/:id/access`, `/:id/block`), `/api/admin/questions`, `/api/admin/backup/export`, `/api/admin/backup/import` |

Example requests for every ticket are in `api-tests/` (open in VS Code with the REST Client extension).

---

## Testing

- `api-tests/*.http` — API requests with the expected result above each one
- `docs/TEST-CHECKLIST.md` — click-through checklist for guest, new user, free user, paid user, admin and phone size

---

## Deployment (free tiers)

- **API → Render** (Web Service, root `server`, build `npm ci`, start `npm start`, health check `/api/health`)
- **Website → Vercel** (root `client`, Vite; `client/vercel.json` makes page links work on refresh)
- **Database → Atlas** (live database `interview-prep-prod`, Network Access `0.0.0.0/0`, strong password)
- **Emails → Brevo API** on Render (`BREVO_API_KEY`, `EMAIL_FROM`), because Render's free plan blocks SMTP. Locally Gmail SMTP still works.
- Step-by-step guide and fixes: [`docs/DEPLOY.md`](docs/DEPLOY.md)
