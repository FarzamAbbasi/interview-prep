import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiCheck, HiX, HiOutlineBadgeCheck, HiOutlineMail, HiOutlineClipboardCopy } from 'react-icons/hi';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';

// Set these in client/.env (restart `npm run dev` after changing):
//   VITE_PRICE_TEXT=Rs 1,500 one-time
//   VITE_CONTACT_EMAIL=you@example.com
const PRICE_TEXT = import.meta.env.VITE_PRICE_TEXT || 'Price coming soon';
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';

const features = [
  { text: '5 free questions with answers in every language', free: true },
  { text: 'Sample quiz (5 questions)', free: true },
  { text: 'All questions and answers, with code examples', free: false },
  { text: 'Full timed quizzes by language, topic and difficulty', free: false },
  { text: 'Bookmarks to save questions', free: false },
  { text: 'Quiz history and progress', free: true },
];

const faqs = [
  { q: 'Is it a subscription?', a: 'No. Full access is a one-time payment with no monthly fee.' },
  {
    q: 'How do I get full access?',
    a: 'Create a free account, then use "Request full access". We will reply with the payment details and turn on full access for your account.',
  },
  { q: 'Do I need an account for the free questions?', a: 'No. Free questions are open to everyone. The sample quiz needs a free account.' },
];

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Could not copy. Please select the text and copy it');
  }
}

/**
 * Shown after "Request full access": steps + ways to send the request.
 * mailto alone does nothing on computers without an email app, so Gmail web and copy buttons are offered too.
 */
function RequestAccessPanel({ user, onClose }) {
  const subject = 'Full access request';
  const message = `Hi,\n\nI would like full access to Interview Prep Portal.\n\nAccount email: ${user.email}\nName: ${user.name}\n\nThank you`;
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  const mailtoLink = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

  return (
    <div className="space-y-4 rounded-lg border border-brand-100 bg-brand-50 p-4 text-left">
      <ul className="space-y-2 text-sm text-slate-700">
        <li>
          <strong>Step 1:</strong> Send us your request (your account email is already in the message).
        </li>
        <li>
          <strong>Step 2:</strong> We reply with the price and payment details.
        </li>
        <li>
          <strong>Step 3:</strong> After payment we turn on full access. Refresh the page to see it.
        </li>
      </ul>

      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href={gmailLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <HiOutlineMail size={18} /> Open in Gmail
        </a>
        <a
          href={mailtoLink}
          className="flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Other email app
        </a>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
        <p className="text-slate-500">Or send this from any email to:</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="break-all font-semibold text-slate-900">{CONTACT_EMAIL}</span>
          <button
            type="button"
            onClick={() => copyText(CONTACT_EMAIL, 'Email address')}
            className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
          >
            <HiOutlineClipboardCopy /> Copy
          </button>
        </div>
        <button
          type="button"
          onClick={() => copyText(message, 'Message')}
          className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
        >
          <HiOutlineClipboardCopy /> Copy the message
        </button>
      </div>

      <button type="button" onClick={onClose} className="w-full text-center text-xs text-slate-500 hover:text-slate-800">
        Close
      </button>
    </div>
  );
}

function FeatureRow({ text, included }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {included ? (
        <HiCheck className="mt-0.5 shrink-0 text-green-600" size={18} aria-label="Included" />
      ) : (
        <HiX className="mt-0.5 shrink-0 text-slate-300" size={18} aria-label="Not included" />
      )}
      <span className={included ? 'text-slate-700' : 'text-slate-400'}>{text}</span>
    </li>
  );
}

export default function PricingPage() {
  usePageTitle('Pricing');
  const { user, hasFullAccess } = useAuth();
  const [showRequest, setShowRequest] = useState(false);

  let fullAction;
  if (hasFullAccess) {
    fullAction = (
      <div className="flex items-center justify-center gap-2 rounded-md bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
        <HiOutlineBadgeCheck size={20} /> You have full access
      </div>
    );
  } else if (!user) {
    fullAction = (
      <Link to="/register" className="block rounded-md bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700">
        Create free account to start
      </Link>
    );
  } else if (CONTACT_EMAIL) {
    fullAction = showRequest ? (
      <RequestAccessPanel user={user} onClose={() => setShowRequest(false)} />
    ) : (
      <button
        type="button"
        onClick={() => setShowRequest(true)}
        className="block w-full rounded-md bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700"
      >
        Request full access
      </button>
    );
  } else {
    fullAction = (
      <p className="rounded-md bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
        Online payment is coming soon. Please contact the site admin to get full access.
      </p>
    );
  }

  const currentPlan = hasFullAccess ? 'full' : user ? 'free' : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Get full access</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          Start free. Unlock every answer, full quizzes and bookmarks with a one-time payment.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {/* Free */}
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Free</h2>
            {currentPlan === 'free' && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Your plan</span>
            )}
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">Rs 0</p>
          <p className="text-sm text-slate-500">No card needed</p>
          <ul className="mt-6 space-y-3">
            {features.map((f) => (
              <FeatureRow key={f.text} text={f.text} included={f.free} />
            ))}
          </ul>
          <div className="mt-auto pt-6">
            {user ? (
              <Link to="/languages" className="block rounded-md border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Browse questions
              </Link>
            ) : (
              <Link to="/register" className="block rounded-md border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Sign up free
              </Link>
            )}
          </div>
        </section>

        {/* Full access */}
        <section className="relative flex flex-col rounded-2xl border-2 border-brand-600 bg-white p-6 shadow-md">
          <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
            Best for interviews
          </span>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Full access</h2>
            {currentPlan === 'full' && (
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">Your plan</span>
            )}
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{PRICE_TEXT}</p>
          <p className="text-sm text-slate-500">One-time payment, no subscription</p>
          <ul className="mt-6 space-y-3">
            {features.map((f) => (
              <FeatureRow key={f.text} text={f.text} included />
            ))}
          </ul>
          <div className="mt-auto pt-6">{fullAction}</div>
        </section>
      </div>

      <section className="mt-14" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-xl font-bold text-slate-900">
          Questions
        </h2>
        <dl className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {faqs.map(({ q, a }) => (
            <div key={q} className="p-5">
              <dt className="font-semibold text-slate-900">{q}</dt>
              <dd className="mt-1 text-sm text-slate-600">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
