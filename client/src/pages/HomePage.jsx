import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useLanguages from '../hooks/useLanguages';
import LanguageGrid from '../components/languages/LanguageGrid';
import HeroQuestion from '../components/home/HeroQuestion';
import usePageTitle from '../hooks/usePageTitle';

// How practice works: a real sequence, so the steps are numbered
const steps = [
  { title: 'Read the answer', text: 'Each question has a short answer and a code example, grouped by topic and difficulty.' },
  { title: 'Take a timed quiz', text: 'Multiple-choice questions with 30 seconds each, like the pressure of a real interview.' },
  { title: 'See what to revise', text: 'Every answer is explained after the quiz, and your scores stay on your dashboard.' },
];

// Same rules as the server: guest / free account / full access
const plans = [
  { key: 'guest', name: 'Guest', note: 'no account' },
  { key: 'free', name: 'Free account', note: 'sign up free' },
  { key: 'full', name: 'Full access', note: 'one-time payment' },
];
const access = [
  { label: 'Questions with answers', guest: 'First topic', free: 'First topic', full: 'All topics' },
  { label: 'Timed quiz', guest: null, free: '5-question sample', full: 'Full quizzes' },
  { label: 'Quiz history', guest: null, free: 'Yes', full: 'Yes' },
  { label: 'Bookmarks', guest: null, free: null, full: 'Yes' },
];

const primaryBtn =
  'inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-5 text-[15px] font-semibold text-white hover:bg-brand-700';
const secondaryBtn =
  'inline-flex h-12 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-[15px] font-semibold text-slate-900 hover:bg-slate-100';

// ['PHP', 'React', 'Python'] -> "PHP, React and Python"
function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function SectionHead({ id, title, text }) {
  return (
    <div className="mb-8">
      <h2 id={id} className="text-3xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      {text && <p className="mt-2 max-w-xl text-slate-600">{text}</p>}
    </div>
  );
}

export default function HomePage() {
  usePageTitle('');
  const { user, hasFullAccess, hasAnyAccess } = useAuth();
  const { languages, loading, error, reload } = useLanguages();

  // Quiz needs an account: guests go to register first
  const quizLink = user ? '/quiz' : '/register';
  const quizText = hasAnyAccess ? 'Start a quiz' : user ? 'Take the free sample quiz' : 'Try the free sample quiz';
  const totalQuestions = languages.reduce((n, l) => n + (l.qaCount || 0) + (l.mcqCount || 0), 0);
  const names = joinNames(languages.map((l) => l.name));
  const currentPlan = hasFullAccess ? 'full' : hasAnyAccess ? 'some' : user ? 'free' : 'guest'; // IPP-1704

  return (
    <div className="-mt-8">
      {/* Hero: a real question you can answer right away */}
      <section className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
        <div>
          <h1 className="max-w-[11ch] text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-slate-900 sm:text-6xl lg:text-[4rem]">
            Know the answer before they ask.
          </h1>
          <p className="mt-6 max-w-[34ch] text-lg text-slate-600 sm:text-xl">
            Real interview questions{names ? ` for ${names}` : ''}, answered in plain words with code. Try one right here.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={quizLink} className={primaryBtn}>
              {quizText}
            </Link>
            <Link to="/languages" className={secondaryBtn}>
              Browse free questions
            </Link>
          </div>
          {!loading && !error && totalQuestions > 0 && (
            <p className="mt-6 text-sm text-slate-500">
              {totalQuestions} questions in {languages.length} {languages.length === 1 ? 'language' : 'languages'}. The first topic of each is open,
              no account needed.
            </p>
          )}
        </div>

        <HeroQuestion
          nextLink={quizLink}
          nextText={hasFullAccess ? 'Take a full quiz' : user ? 'Try 5 more in the sample quiz' : 'Create a free account and try 5 more'}
        />
      </section>

      <section aria-labelledby="how-heading" className="border-t border-slate-200 py-14 sm:py-16">
        <SectionHead id="how-heading" title="How practice works" text="Read, test yourself, then go back to what you got wrong." />
        <ol className="grid gap-8 sm:grid-cols-3 sm:gap-10">
          {steps.map((step, i) => (
            <li key={step.title}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-900 font-extrabold text-slate-900">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-1 text-[15px] text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="languages-heading" className="border-t border-slate-200 py-14 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <SectionHead id="languages-heading" title="Languages" text="Start with the free questions in any language." />
          {languages.length > 6 && (
            <Link to="/languages" className="mb-8 shrink-0 text-sm font-semibold text-brand-600 hover:underline">
              See all {languages.length}
            </Link>
          )}
        </div>
        <LanguageGrid languages={languages.slice(0, 6)} loading={loading} error={error} onRetry={reload} showMore />
      </section>

      <section aria-labelledby="access-heading" className="border-t border-slate-200 py-14 sm:py-16">
        <SectionHead id="access-heading" title="What you get" text="Free to start. Full access is a one-time payment, no subscription." />
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[34rem] text-left text-[15px]">
            <thead>
              <tr>
                <td className="p-4" />
                {plans.map((p) => (
                  <th
                    key={p.key}
                    scope="col"
                    className={`p-4 align-bottom font-semibold ${p.key === 'full' ? 'bg-brand-50 text-brand-700' : 'text-slate-900'}`}
                  >
                    {p.name}
                    <span className="block text-[13px] font-normal text-slate-500">
                      {currentPlan === p.key ? 'Your plan' : p.note}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {access.map((row) => (
                <tr key={row.label} className="border-t border-slate-200">
                  <th scope="row" className="p-4 font-normal text-slate-700">
                    {row.label}
                  </th>
                  {plans.map((p) => (
                    <td key={p.key} className={`p-4 ${row[p.key] ? 'font-semibold text-green-700' : 'text-slate-400'}`}>
                      {row[p.key] || 'No'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link to="/pricing" className={`${secondaryBtn} mt-6`}>
          {hasFullAccess ? 'See pricing' : 'See pricing and get full access'}
        </Link>
      </section>
    </div>
  );
}
