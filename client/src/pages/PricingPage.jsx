import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiCheck, HiX, HiOutlineBadgeCheck, HiOutlineMail, HiOutlineClipboardCopy } from 'react-icons/hi';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import useLanguages from '../hooks/useLanguages';

// Set these in client/.env (restart `npm run dev` after changing):
//   VITE_PRICE_TEXT=Rs 1,500            (all languages)
//   VITE_PRICE_ONE_TEXT=Rs CHANGE_ME    (one language, IPP-1704)
//   VITE_CONTACT_EMAIL=you@example.com
const PRICE_TEXT = (import.meta.env.VITE_PRICE_TEXT || 'Price coming soon').replace(/\s*one-time$/i, '');
const PRICE_ONE_TEXT = import.meta.env.VITE_PRICE_ONE_TEXT || 'Ask for price';
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';

// IPP-1704: three plans
const plans = {
  free: [
    { text: 'First topic of every language, with answers', included: true },
    { text: 'Sample quiz (5 questions)', included: true },
    { text: 'Quiz history and progress', included: true },
    { text: 'Locked topics', included: false },
    { text: 'Full quizzes and bookmarks', included: false },
  ],
  one: [
    { text: 'Every topic of the language you pick', included: true },
    { text: 'Full timed quizzes for it', included: true },
    { text: 'Bookmarks for it', included: true },
    { text: 'Add more languages any time', included: true },
  ],
  all: [
    { text: 'Every topic of every language', included: true },
    { text: 'Languages added later too', included: true },
    { text: 'All full timed quizzes', included: true },
    { text: 'Bookmarks everywhere', included: true },
  ],
};

const faqs = [
  { q: 'Is it a subscription?', a: 'No. Both plans are a one-time payment with no monthly fee.' },
  {
    q: 'How do I get full access?',
    a: 'Create a free account, pick a plan and send the request. We will reply with the payment details and unlock it for your account.',
  },
  { q: 'Can I start with one language and add more later?', a: 'Yes. Request another language, or move to All languages, any time.' },
  { q: 'Do I need an account to start?', a: 'No. The first topic of every language is open to everyone. The sample quiz needs a free account.' },
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
function RequestAccessPanel({ user, plan, onClose }) {
  const subject = `Full access request: ${plan}`;
  const message = `Hi,\n\nI would like full access to AskedIn.\n\nPlan: ${plan}\nAccount email: ${user.email}\nName: ${user.name}\n\nThank you`;
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  const mailtoLink = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

  return (
    <div className="space-y-4 rounded-lg border border-brand-100 bg-brand-50 p-4 text-left">
      <ul className="space-y-2 text-sm text-slate-700">
        <li>
          <strong>Step 1:</strong> Send us your request (your plan and account email are already in the message).
        </li>
        <li>
          <strong>Step 2:</strong> We reply with the price and payment details.
        </li>
        <li>
          <strong>Step 3:</strong> After payment we unlock it. Refresh the page to see it.
        </li>
      </ul>

      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href={gmailLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <HiOutlineMail size={18} /> Open in Gmail
        </a>
        <a
          href={mailtoLink}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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

function PlanCard({ title, price, note, features, badge, highlight, yourPlan, children }) {
  return (
    <section
      className={`relative flex flex-col rounded-2xl bg-white p-6 sm:px-7 sm:py-7 ${
        highlight ? 'border-2 border-brand-600 shadow-[0_24px_48px_-28px_rgb(109_75_216/0.45)]' : 'border border-slate-200'
      }`}
    >
      {badge && <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">{badge}</span>}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {yourPlan && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Your plan</span>}
      </div>
      <p className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">{price}</p>
      <p className="text-sm text-slate-500">{note}</p>
      <ul className="mt-5 space-y-2.5">
        {features.map((f) => (
          <FeatureRow key={f.text} text={f.text} included={f.included} />
        ))}
      </ul>
      <div className="mt-auto pt-5">{children}</div>
    </section>
  );
}

const unlockedBox = (text) => (
  <div className="flex items-center justify-center gap-2 rounded-md bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
    <HiOutlineBadgeCheck size={20} /> {text}
  </div>
);

export default function PricingPage() {
  usePageTitle('Pricing');
  const { user, hasFullAccess, hasAnyAccess, canAccess, paidLanguages } = useAuth();
  const { languages } = useLanguages();
  const [request, setRequest] = useState(null); // 'one' | 'all' while the request panel is open
  const [pickedSlug, setPickedSlug] = useState('');

  // One language: only languages the user does not have yet
  const lockedLanguages = languages.filter((l) => !canAccess(l._id));
  const picked = lockedLanguages.find((l) => l.slug === pickedSlug) || lockedLanguages[0];

  // The button / panel at the bottom of a paid card
  const action = (plan, label, primary) => {
    const buttonClass = primary
      ? 'bg-brand-600 text-white hover:bg-brand-700'
      : 'border border-brand-600 text-brand-700 hover:bg-brand-50';
    if (!user) {
      return (
        <Link to="/register" className={`block rounded-lg px-4 py-3 text-center text-sm font-semibold ${buttonClass}`}>
          Create free account to start
        </Link>
      );
    }
    if (!CONTACT_EMAIL) {
      return (
        <p className="rounded-md bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
          Online payment is coming soon. Please contact the site admin to get full access.
        </p>
      );
    }
    if (request === plan) {
      const planText = plan === 'all' ? 'All languages' : `One language (${picked?.name})`;
      return <RequestAccessPanel user={user} plan={planText} onClose={() => setRequest(null)} />;
    }
    return (
      <button
        type="button"
        onClick={() => setRequest(plan)}
        className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold ${buttonClass}`}
      >
        {label}
      </button>
    );
  };

  let oneAction;
  if (hasFullAccess) oneAction = unlockedBox('Every language is unlocked');
  else if (!lockedLanguages.length) oneAction = languages.length ? unlockedBox('Every language is unlocked') : null;
  else {
    oneAction = (
      <>
        {hasAnyAccess && (
          <p className="mb-3 flex items-start gap-1.5 text-xs font-semibold text-green-700">
            <HiCheck className="mt-0.5 shrink-0" /> {paidLanguages.map((l) => l.name).join(', ')} unlocked
          </p>
        )}
        {request !== 'one' && (
          <label className="mb-3 block">
            <span className="text-xs font-semibold text-slate-500">Pick a language</span>
            <select
              value={picked?.slug || ''}
              onChange={(e) => setPickedSlug(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            >
              {lockedLanguages.map((l) => (
                <option key={l._id} value={l.slug}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {action('one', `Request ${picked?.name || 'language'}`, false)}
      </>
    );
  }

  const currentPlan = hasFullAccess ? 'all' : hasAnyAccess ? 'one' : user ? 'free' : null;

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Pricing</h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">
          Start free. Unlock one language or all of them with one payment, no subscription.
        </p>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <PlanCard title="Free" price="Rs 0" note="No card needed" features={plans.free} yourPlan={currentPlan === 'free'}>
          <Link
            to={user ? '/languages' : '/register'}
            className="block rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {user ? 'Browse questions' : 'Sign up free'}
          </Link>
        </PlanCard>

        <PlanCard
          title="One language"
          price={PRICE_ONE_TEXT}
          note="One-time, per language"
          features={plans.one}
          yourPlan={currentPlan === 'one'}
        >
          {oneAction}
        </PlanCard>

        <PlanCard
          title="All languages"
          price={PRICE_TEXT}
          note="One-time, every language"
          features={plans.all}
          badge="Best value"
          highlight
          yourPlan={currentPlan === 'all'}
        >
          {hasFullAccess ? unlockedBox('You have full access') : action('all', 'Request full access', true)}
        </PlanCard>
      </div>

      <section className="mt-14" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-slate-900">
          Common questions
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
