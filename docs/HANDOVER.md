# Interview Prep Portal — Hand-over

Fill in the blanks before sending. **Send the admin password in a separate message**, never in this file or in git.

---

## Links

| What | Address |
|---|---|
| Website | https://askedin.vercel.app |
| API (health check) | https://ipp-api.onrender.com/api/health |
| Code (private GitHub) | https://github.com/Arsal471/interview-prep-portal |

## Admin login

- Email: `askedin143@gmail.com`
- Password: sent separately. Change it after the first login: *Forgot password* on the login page, or ask the developer.

## Service accounts

| Service | Used for | Login / owner | Free limit |
|---|---|---|---|
| MongoDB Atlas | Database (`interview-prep-prod`) | ______________ | 512 MB storage |
| Render | API server | ______________ | Sleeps after 15 min idle; first visit then waits ~1 minute |
| Vercel | Website | ______________ | Hobby plan |
| Brevo | Verification and password emails | ______________ | 300 emails per day. The API key expires after 1 year or 90 days unused: then create a new one and update `BREVO_API_KEY` on Render |

Recommended: move each account to the client's own email (or add the client as owner) so the project does not depend on the developer.

---

## Daily admin work

- **Give full access after payment:** Admin → Users → search the email → *Give full access*. The user refreshes the page.
- **Remove access / block:** Admin → Users → *Remove full access* or *Block* (a blocked user is logged out at once).
- **Add many questions:** Admin → Bulk upload → *Download sample file* (or *Download as upload file* for an existing language) → edit → upload → check the preview → *Import now*.
- **Add or fix one question:** Admin → Questions → *Add question* / *Edit*.
- **New language:** Admin → Languages → *Add language* (keep it inactive until its questions are ready), or use Bulk upload.
- **Hide instead of delete:** a language with questions, a topic with questions, or an MCQ used in a quiz cannot be deleted. Use *Deactivate*.
- **Backup:** Admin → Backup → *Download backup* — at least once a week and before every big import. Keep the files somewhere safe (Google Drive).

## What users get

| Visitor | Access |
|---|---|
| Guest | Languages, 5 free Q&A per language, pricing page |
| Free account | + 5-question sample quiz and quiz history |
| Full access | All answers, full quizzes (6 random MCQs, 30 s each, by language / topic / level), bookmarks |

Payment is manual for now: the user sends a request from the Pricing page, pays, and the admin gives full access.

---

## Good to know

- The first visit after a quiet period can take up to a minute (free Render server waking up). A paid Render plan (~$7/month) removes this.
- Emails come from a Gmail address through Brevo and can land in **Spam**; an own domain later fixes this.
- Current content: PHP (20 Q&A + 20 MCQs), React (100 Q&A + 60 MCQs, active after review).
- Planned later: more languages, online payment, own name / logo / domain.

## Support

Developer: Arsal — arsalmustafa62@gmail.com
