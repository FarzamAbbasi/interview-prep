# Deploy guide (IPP-1201)

Free hosting: **MongoDB Atlas** (database) · **Render** (API) · **Vercel** (website) · **Brevo** (emails).

```
Browser ──► Vercel (React website) ──► Render (Express API) ──► Atlas (MongoDB)
                                              └──► Brevo API (verification / reset emails)
```

Why Brevo: Render's free plan blocks SMTP ports (25, 465, 587), so Gmail SMTP cannot send from Render.
Locally nothing changes: without `BREVO_API_KEY` the API still uses Gmail SMTP.

Write down as you go: Render URL, Vercel URL, new DB password, JWT secret, Brevo key (keep them in a password manager, not in git).

---

## 0. Code on GitHub

1. Make sure `server/.env` and `client/.env` are **not** committed (`git status` must not show them; `.gitignore` already blocks them).
2. Create a **private** repo on GitHub (e.g. `interview-prep-portal`) and push the whole folder:
   ```bash
   git init            # only if not a git repo yet
   git add .
   git commit -m "IPP-1201 deploy config"
   git branch -M main
   git remote add origin https://github.com/<you>/interview-prep-portal.git
   git push -u origin main
   ```
Render and Vercel redeploy automatically on every push to `main`.

---

## 1. Atlas (database)

1. **Database Access → Add New Database User**
   - Username: `ipp-prod`, **Autogenerate Secure Password** → copy it
   - Role: *Read and write to any database*
2. **Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`). Render has no fixed IP.
3. **Connect → Drivers** → copy the connection string and make it:
   ```
   mongodb+srv://ipp-prod:<PASSWORD>@<cluster>.mongodb.net/interview-prep-prod?retryWrites=true&w=majority
   ```
   `interview-prep-prod` = a separate live database, so local test data never mixes with live data.
   If the password has `@ : / ? # %`, URL-encode it (or generate a new one without those).

The live database is empty until IPP-1202 (seed).

---

## 2. Brevo (emails)

1. Sign up free at brevo.com (300 emails/day). Fill in the profile if it asks (account activation).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: name `Interview Prep Portal`, email = the Gmail you want emails to come from → verify with the code Brevo sends.
3. **SMTP & API → API Keys → Generate a new API key** → copy it (starts with `xkeysib-`).
4. **Security → Authorized IPs**: turn the IP blocking **off** (Render's IP changes; otherwise Brevo answers 401 "unrecognised IP").
5. Optional local check: put `BREVO_API_KEY` and `EMAIL_FROM` in `server/.env`, run `npm run test:email -- you@gmail.com`, then remove `BREVO_API_KEY` again if you want local to keep using Gmail SMTP.

Note: with a Gmail sender (no own domain) some emails may land in **Spam**. An own domain later fixes this.

---

## 3. Render (API)

1. render.com → sign in with GitHub → **New → Web Service** → pick the repo.
2. Settings:

   | Field | Value |
   |---|---|
   | Name | e.g. `ipp-api` → URL `https://ipp-api.onrender.com` |
   | Region | Singapore (closest to Pakistan) |
   | Branch | `main` |
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm ci` |
   | Start Command | `npm start` |
   | Instance Type | Free |

3. **Environment Variables** (do **not** add `PORT`; Render sets it):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | the string from step 1 |
   | `JWT_SECRET` | new random value (command below) — not the local one |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_URL` | `https://<vercel-project>.vercel.app` (no `/` at the end; fix in step 5 if the real URL differs) |
   | `BREVO_API_KEY` | from step 2 |
   | `EMAIL_FROM` | the verified Brevo sender |
   | `EMAIL_FROM_NAME` | `Interview Prep Portal` |

   New JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
4. **Advanced → Health Check Path**: `/api/health`
5. **Create Web Service** → wait for "Live". Logs must show `MongoDB connected` and `Server running on port ... (production)`.
6. Open `https://<render-app>.onrender.com/api/health` → `{"success":true,"message":"API is running",...}`.

Free plan: the server sleeps after 15 idle minutes; the next visit waits ~1 minute (the website allows 60 s).

---

## 4. Vercel (website)

1. vercel.com → sign in with GitHub → **Add New → Project** → import the repo.
2. Settings:

   | Field | Value |
   |---|---|
   | Project Name | e.g. `interview-prep-portal` → `https://interview-prep-portal.vercel.app` |
   | Framework Preset | Vite |
   | Root Directory | `client` |
   | Build / Output | leave default (`npm run build`, `dist`; also in `client/vercel.json`) |

3. **Environment Variables**:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://<render-app>.onrender.com/api` |
   | `VITE_PRICE_TEXT` | `Price coming soon` (or the real price) |
   | `VITE_CONTACT_EMAIL` | `arsalmustafa62@gmail.com` |

4. **Deploy**. `client/vercel.json` sends every page to `index.html`, so refreshing `/languages` or opening an email link works.

Changing a `VITE_` value later: Settings → Environment Variables → edit → **Deployments → … → Redeploy** (values are baked in at build time).

---

## 5. Connect both

1. Copy the real Vercel URL (Project → Domains), e.g. `https://interview-prep-portal.vercel.app`.
2. Render → Environment → set `CLIENT_URL` to exactly that (no `/` at the end) → **Save, rebuild and deploy**.
3. Open the website → Languages page loads (empty list until IPP-1202 seed) with no red CORS error in the browser console (F12).

---

## 6. Check

Run `api-tests/1201-deploy.http` (put the two URLs at the top). Then in the browser:

- Home, Languages, Pricing open; refresh on any page works
- Register → email arrives (check Spam) → link opens the Vercel site → verified → login works
- Forgot password → reset email → new password works

Admin login and content come in IPP-1202 (`npm run seed` against the live `MONGO_URI`).

---

## Problems

| What you see | Fix |
|---|---|
| Render log: `Missing environment variables: ...` | Add the named variables in Render → Environment |
| Render log: `MongoDB error: ... whitelist` / `Could not connect` | Atlas Network Access must have `0.0.0.0/0`; check user/password in `MONGO_URI` |
| Render log: `bad auth` | Wrong DB password (or special characters not URL-encoded) |
| Browser console: CORS error | `CLIENT_URL` on Render must equal the Vercel URL exactly (https, no `/` at the end) |
| Website: "Cannot reach the server" | `VITE_API_URL` wrong (must end with `/api`) → fix and Redeploy on Vercel |
| Website: "The server is waking up" | Free Render was asleep; try again after a few seconds |
| Register works but `emailSent: false` | Render Logs → `[email] ...`: `Brevo 401` = wrong key or Authorized IPs still on; sender error = `EMAIL_FROM` not verified |
| Vercel 404 on page refresh | `client/vercel.json` missing or Root Directory is not `client` |
| `/api/health` shows an `ip` that is not yours | Render → Environment → `TRUST_PROXY=2` (rate limits then count real users) |
