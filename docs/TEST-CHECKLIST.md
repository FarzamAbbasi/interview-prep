# AskedIn — Test checklist (IPP-1101)

Run on your computer with the real database (`server`: `npm run dev`, `client`: `npm run dev`).
Tick each line. If something fails, note the page, the account and what you saw.

Accounts used below:
- **Admin**: ADMIN_EMAIL / ADMIN_PASSWORD from `server/.env`
- **Unpaid user**: a verified user with no full access (e.g. `+ipp2`, turn access off in Admin → Users)
- **Paid user**: the same user after Admin → Users → "Give full access"
- **New user**: a fresh email you can open (e.g. `yourname+test9@gmail.com`)

Tip: use a normal window for one account and an Incognito window for another.

---

## 1. Guest (not logged in)
- [ ] Home page shows the PHP card, "Start sample quiz" and "Browse questions"
- [ ] Languages page shows PHP with counts
- [ ] PHP questions: 5 free answers open, others show "Answer locked"
- [ ] Topic tabs, level, tag, search and pages work; a link like `/languages/php?topic=oop&page=1` opens the same view
- [ ] Pricing: "Create free account to start"
- [ ] `/quiz`, `/dashboard`, `/bookmarks`, `/admin` all go to the login page
- [ ] A wrong address (e.g. `/abc`) shows "Page not found"

## 2. New user: sign up and log in
- [ ] Register with wrong data shows field errors; correct data shows "Check your email"
- [ ] The email arrives (check spam); the link opens "Email verified"
- [ ] Logging in before verifying shows "Please verify your email" and a resend button
- [ ] Log in → goes to the dashboard; reload the page → still logged in
- [ ] Logout → back to guest
- [ ] Forgot password → email → new password → old password no longer works, new one does

## 3. Unpaid user
- [ ] Questions page: paid answers still locked, banner "Get full access"
- [ ] Bookmark icon shows "Bookmarks are part of full access"
- [ ] Quiz: only "Start sample quiz" (5 questions, 2:30)
- [ ] Answer some, refresh during the quiz → answers and timer continue
- [ ] Submit with unanswered questions → confirm box → result with review and upgrade prompt
- [ ] Let one quiz run out of time → submitted automatically
- [ ] Dashboard shows the quiz in history; clicking it opens the result
- [ ] `/bookmarks` shows the upgrade prompt; `/admin` shows "No access"
- [ ] Pricing → "Request full access" → "Open in Gmail" opens a ready email

## 4. Paid user (turn on in Admin → Users)
- [ ] Refresh → dashboard says "Full access"; all answers open
- [ ] Bookmark 2 questions → Bookmarks page shows them; remove one → Undo works
- [ ] Quiz setup: language + topic + difficulty; OOP → 3 questions; Mixed → 6 questions
- [ ] OOP + Hard → "No hard quiz questions for OOP yet"
- [ ] Result and dashboard update after each quiz

## 5. Admin
- [ ] Admin dashboard numbers look right (questions 40 = 20 Q&A + 20 MCQs)
- [ ] Users: search, filters, give/remove full access, block/unblock (blocked user cannot log in and sees a message)
- [ ] Languages: add a test language with 2 topics, edit, deactivate (hidden from the site), delete
- [ ] PHP delete explains it has questions
- [ ] Questions: filters, add a test MCQ and a test Q&A, edit, make free/paid, deactivate, delete
- [ ] An MCQ used in a quiz cannot be deleted ("Deactivate it instead")
- [ ] Backup: download; import the same file → preview "0 to add, 40 to update"; import works
- [ ] Full backup (IPP-1007): file has users + quiz results; import the same file → "0 new users · N already there"; *Content only* file has no users
- [ ] Restore on an empty database (`npm run seed -- --file=...`): old user logs in with the same password, sees bookmarks + quiz history; questions keep their old dates
- [ ] AskedIn look (IPP-1401/1402): logo + tab title "AskedIn"; moon/sun button switches dark mode on every page (public, quiz, dashboard, admin) and stays after reload; code blocks readable in both
- [ ] Home: answer the PHP question in the hero (right answer turns yellow, explanation shows); timer runs out → "Time's up"; languages list + "What you get" table; phone width looks fine
- [ ] Free limit (IPP-1501): guest + unpaid see ONLY the 5 free questions per language; scrolling to the end opens the "Get full access" popup; sample quiz result shows the popup once
- [ ] Delete history (IPP-1502): dashboard trash icon removes one quiz; "Clear history" removes all (paid and unpaid users)
- [ ] Language pages (IPP-1601/1602): language cards with difficulty bar and % done; topic cards; tick a question as done -> ring + card update; finished topic -> "Quiz this topic"; whole site violet
- [ ] One by one (IPP-1603): language page -> "One by one" -> Space shows the answer, ← → move, "I knew this" marks done + next, "Review again" un-marks + next; works on phone
- [ ] First topic free (IPP-1607): guest/unpaid open only the first topic of each language, others show "Full access"; sample quiz uses the first topic; topic cards are whole (none cut at the edges)
- [ ] Backup reminder (IPP-1008): dashboard box "No full backup yet" → download full → green "today" → give full access to a user → amber "1 new paid user" → download → green
- [ ] Clean up: delete the test language/questions

## 6. Phone / small window
- [ ] Every page above works at phone width (menu button, no sideways scrolling)

---

## Before going live (IPP-1201)
- `server/.env` on Render: `NODE_ENV=production`, `CLIENT_URL=https://<your-vercel-site>`, new strong `JWT_SECRET`
- `client` on Vercel: `VITE_API_URL=https://<your-render-api>/api`, `VITE_CONTACT_EMAIL`, `VITE_PRICE_TEXT`
- Vercel needs a rewrite so pages like `/languages/php` work on refresh (added in IPP-1201)
- Atlas Network Access must allow Render (`0.0.0.0/0`) with a strong database password
