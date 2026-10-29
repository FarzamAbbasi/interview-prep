import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { HiOutlineClock, HiOutlineLockClosed, HiOutlinePlay } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import Button from '../../components/ui/Button';
import PageLoader from '../../components/ui/PageLoader';
import LanguageIcon from '../../components/languages/LanguageIcon';

const LEVELS = [
  { key: 'junior', label: 'Junior', text: 'Mostly easy' },
  { key: 'mid', label: 'Mid', text: 'Easy + medium, 1 hard' },
  { key: 'senior', label: 'Senior', text: 'Medium + hard' },
];

const formatOf = (f) => `${f.qa} Q&A${f.coding ? ` + ${f.coding} coding` : ''}`;

// One selectable card (language or level)
function Option({ selected, disabled, onClick, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border-[1.5px] p-3.5 text-left transition ${
        selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-600'
      } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200`}
    >
      {children}
    </button>
  );
}

/**
 * /interview   (IPP-1725, logged in)
 * Choose a language and level, then start a timed mock round.
 * Unpaid users get one free round (free content); after that the "Get full access" box.
 * ?language=javascript preselects a language.
 */
export default function InterviewSetupPage() {
  usePageTitle('Interview Mode');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null });
  const [choice, setChoice] = useState({ language: params.get('language') || '', level: 'mid' });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const key = `${user?._id}|${attempt}`;
  useEffect(() => {
    let cancelled = false;
    api
      .get('/interview/setup')
      .then(({ data: res }) => !cancelled && setResult({ key, data: res.data }))
      .catch((err) => !cancelled && setResult({ key, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (result.key !== key) return <PageLoader />;
  if (result.error) {
    return (
      <div role="alert" className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{result.error}</p>
        <Button variant="secondary" className="mt-4" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  const { languages, times, trial, running } = result.data;
  const usable = languages.filter((l) => l.available);
  // Fall back to the first usable language when nothing (or an unusable one) is chosen
  const language = usable.find((l) => l.slug === choice.language) || usable[0];
  const isTrial = language?.access === 'trial';
  const allLocked = trial.used && !usable.length;

  const start = async () => {
    if (!language) return;
    setStarting(true);
    setStartError('');
    try {
      const { data: res } = await api.post('/interview/start', { language: language.slug, level: choice.level });
      navigate(`/interview/${res.data._id}`, { state: { round: res.data } });
    } catch (err) {
      const code = err.response?.data?.code;
      setStarting(false);
      // A round started in another tab, or the free round was used: show the fresh state
      if (code === 'ROUND_IN_PROGRESS' || code === 'INTERVIEW_TRIAL_USED') setAttempt((n) => n + 1);
      else setStartError(getErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {running && (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-brand-600 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-800">
            <b>You have a round running:</b> {running.language?.name} · <span className="capitalize">{running.level}</span>
          </p>
          <Link
            to={`/interview/${running._id}`}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <HiOutlinePlay /> Continue round
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">NEW</span>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Interview Mode</h1>
        <p className="mt-1 text-sm text-slate-600">
          A timed mock round, like a real first interview. Type each answer like you would say it; AI checks your answers and the
          report at the end shows your score and the model answers.
        </p>

        {allLocked ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
            <p className="flex items-center gap-2 font-semibold">
              <HiOutlineLockClosed /> You&apos;ve used your free interview round.
            </p>
            <p className="mt-1 text-sm">
              Full access gives unlimited rounds from every question and coding problem, plus the full report.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/pricing" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Get full access
              </Link>
              {trial.roundId && (
                <Link
                  to={`/interview/${trial.roundId}`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  See my trial report
                </Link>
              )}
            </div>
          </div>
        ) : !language ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No interview questions are available yet. Please check back soon.
          </p>
        ) : (
          <>
            <h2 className="mt-6 text-base font-semibold text-slate-900">Language</h2>
            <div role="radiogroup" aria-label="Language" className="mt-2 grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
              {languages.map((l) => (
                <Option
                  key={l.slug}
                  selected={l.slug === language.slug}
                  disabled={!l.available}
                  onClick={() => setChoice((c) => ({ ...c, language: l.slug }))}
                >
                  <LanguageIcon icon={l.icon} name={l.name} size={20} box="h-9 w-9 rounded-md" />
                  <span className="min-w-0">
                    <b className="block truncate text-sm text-slate-900">{l.name}</b>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      {l.access === 'locked' && <HiOutlineLockClosed aria-label="Needs full access" />}
                      {l.format.qa + l.format.coding > 0 ? formatOf(l.format) : 'No questions yet'}
                    </span>
                  </span>
                </Option>
              ))}
            </div>

            <h2 className="mt-6 text-base font-semibold text-slate-900">Level</h2>
            <div role="radiogroup" aria-label="Level" className="mt-2 grid gap-2.5 sm:grid-cols-3">
              {LEVELS.map((lv) => (
                <Option key={lv.key} selected={choice.level === lv.key} onClick={() => setChoice((c) => ({ ...c, level: lv.key }))}>
                  <span>
                    <b className="block text-sm text-slate-900">{lv.label}</b>
                    <span className="text-xs text-slate-500">{lv.text}</span>
                  </span>
                </Option>
              ))}
            </div>

            <ul className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <li className="flex items-center gap-1.5">
                <HiOutlineClock className="text-brand-600" /> About <b>{language.minutes} minutes</b>
              </li>
              <li>Q&amp;A: {times.qa / 60} min each</li>
              {language.format.coding > 0 && <li>Coding: {times.coding / 60} min</li>}
              <li>{isTrial ? 'Questions from the free topic' : 'Questions picked from all topics'}</li>
            </ul>

            {isTrial && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This is your <b>one free round</b>. It uses the free questions; full access unlocks unlimited rounds.
              </p>
            )}

            {startError && (
              <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {startError}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={start} loading={starting} disabled={Boolean(running)}>
                {isTrial ? 'Start free round' : 'Start interview'}
              </Button>
              <span className="text-xs text-slate-500">
                {running ? 'Finish your running round first.' : "You can't pause once it starts."}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
