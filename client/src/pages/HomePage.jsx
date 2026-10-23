import { Link } from 'react-router-dom';
import { HiOutlineBookOpen, HiOutlineClock, HiOutlineChartBar, HiOutlineCheckCircle } from 'react-icons/hi';
import useAuth from '../hooks/useAuth';
import useLanguages from '../hooks/useLanguages';
import LanguageGrid from '../components/languages/LanguageGrid';
import usePageTitle from '../hooks/usePageTitle';

const features = [
  {
    icon: HiOutlineBookOpen,
    title: 'Real interview questions',
    text: 'Clear answers with code examples, grouped by topic and difficulty.',
  },
  {
    icon: HiOutlineClock,
    title: 'Timed quizzes',
    text: 'Test yourself with multiple-choice questions, 30 seconds each, and see explanations after.',
  },
  {
    icon: HiOutlineChartBar,
    title: 'Track your progress',
    text: 'Your quiz history and scores per language, so you know what to practise next.',
  },
];

const primaryBtn =
  'inline-flex items-center justify-center rounded-md bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700';
const secondaryBtn =
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50';

export default function HomePage() {
  usePageTitle('');
  const { user, hasFullAccess } = useAuth();
  const { languages, loading, error, reload } = useLanguages();

  // Quiz needs an account: guests go to register first
  const quizLink = user ? '/quiz' : '/register';
  const totalQuestions = languages.reduce((n, l) => n + (l.qaCount || 0) + (l.mcqCount || 0), 0);

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero */}
      <section className="pt-4 text-center sm:pt-10">
        <p className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Free questions for every language
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Prepare for your next programming interview
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
          Learn the questions interviewers really ask, then check yourself with quick quizzes.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to={quizLink} className={primaryBtn}>
            {hasFullAccess ? 'Start a quiz' : 'Start sample quiz'}
          </Link>
          <Link to="/languages" className={secondaryBtn}>
            Browse questions
          </Link>
        </div>
        {!loading && !error && totalQuestions > 0 && (
          <p className="mt-6 text-sm text-slate-500">
            {totalQuestions} questions in {languages.length} {languages.length === 1 ? 'language' : 'languages'}
          </p>
        )}
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">
          Features
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon size={22} />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Languages */}
      <section aria-labelledby="languages-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="languages-heading" className="text-2xl font-bold text-slate-900">
              Choose a language
            </h2>
            <p className="mt-1 text-sm text-slate-600">Start with the free questions, no account needed.</p>
          </div>
          <Link to="/languages" className="shrink-0 text-sm font-semibold text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        <LanguageGrid languages={languages.slice(0, 6)} loading={loading} error={error} onRetry={reload} />
      </section>

      {/* Call to action (guests only) */}
      {!user && (
        <section className="rounded-2xl bg-brand-600 px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-2xl font-bold">Ready to practise?</h2>
          <ul className="mx-auto mt-4 flex max-w-xl flex-col gap-2 text-sm text-brand-50 sm:flex-row sm:justify-center sm:gap-6">
            {['Free sample quiz', 'Free questions', 'No card needed'].map((item) => (
              <li key={item} className="flex items-center justify-center gap-1.5">
                <HiOutlineCheckCircle size={18} /> {item}
              </li>
            ))}
          </ul>
          <Link
            to="/register"
            className="mt-6 inline-flex rounded-md bg-white px-5 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Create free account
          </Link>
        </section>
      )}
    </div>
  );
}
