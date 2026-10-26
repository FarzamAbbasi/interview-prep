import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { HiOutlineClock, HiOutlineCollection, HiOutlineLockClosed, HiOutlineLightningBolt } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import useLanguages from '../../hooks/useLanguages';
import { saveActiveQuiz } from '../../utils/activeQuiz';
import Button from '../../components/ui/Button';
import PageLoader from '../../components/ui/PageLoader';
import usePageTitle from '../../hooks/usePageTitle';

const FULL_QUIZ_SIZE = 6; // same as the server
const SAMPLE_QUIZ_SIZE = 5;
const SECONDS_PER_QUESTION = 30;

const selectClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50';

// Fixes a wrong computer clock: server time minus this computer's time (ms)
function clockOffsetFrom(serverTime) {
  return new Date(serverTime).getTime() - Date.now();
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

/**
 * /quiz — choose and start a quiz.
 * Unpaid users: sample quiz (5 free MCQs) per language. Paid users: language + topic + difficulty.
 * ?language=php&topic=oop preselects a language and topic (used by links from other pages).
 */
export default function QuizSetupPage() {
  usePageTitle('Quiz');
  const { user, hasFullAccess: hasAllAccess, canAccess } = useAuth();
  const { languages, loading, error, reload } = useLanguages();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // ?language=php&topic=oop preselects (IPP-1602: "Quiz this topic" on the language page)
  const [choice, setChoice] = useState({ language: params.get('language') || '', topic: params.get('topic') || '', difficulty: 'mixed' });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const quizLanguages = languages.filter((l) => l.mcqCount > 0);
  // Fall back to the first language when nothing (or an unknown one) is chosen
  const language = quizLanguages.find((l) => l.slug === choice.language) || quizLanguages[0];
  const topics = language?.topics || [];
  const topic = topics.find((t) => t.slug === choice.topic);
  // IPP-1704: full quiz only for an unlocked language
  const hasFullAccess = language ? Boolean(canAccess(language._id)) : hasAllAccess;

  const update = (changes) => {
    setStartError('');
    setChoice((c) => ({ ...c, ...changes }));
  };

  const questionCount = hasFullAccess ? Math.min(FULL_QUIZ_SIZE, topic ? topic.mcqCount : FULL_QUIZ_SIZE) : SAMPLE_QUIZ_SIZE;
  const minutes = Math.ceil((questionCount * SECONDS_PER_QUESTION) / 60);

  const startQuiz = async () => {
    if (!language) return;
    setStarting(true);
    setStartError('');
    try {
      const body = { language: language.slug };
      if (hasFullAccess) {
        body.difficulty = choice.difficulty;
        if (topic) body.topic = topic.slug;
      }
      const { data } = await api.post('/quiz/start', body);
      saveActiveQuiz({ ...data.data, userId: user._id, clockOffset: clockOffsetFrom(data.data.serverTime), answers: {}, current: 0 });
      navigate('/quiz/play');
    } catch (err) {
      setStartError(getErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Button variant="secondary" className="mt-4" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (!language) {
    return (
      <p className="mx-auto max-w-lg rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No quizzes are available yet. Please check back soon.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{hasFullAccess ? 'Start a quiz' : 'Try the sample quiz'}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {hasFullAccess
          ? 'Pick a language, and if you like a topic and level. Questions are random each time.'
          : 'Five free questions to see how the quiz works. Full quizzes come with full access.'}
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className={`grid gap-4 ${hasFullAccess ? 'sm:grid-cols-3' : ''}`}>
          <Field label="Language">
            <select
              value={language.slug}
              onChange={(e) => update({ language: e.target.value, topic: '' })}
              className={selectClass}
            >
              {quizLanguages.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>

          {hasFullAccess && (
            <>
              <Field label="Topic">
                <select value={topic?.slug || ''} onChange={(e) => update({ topic: e.target.value })} className={selectClass}>
                  <option value="">All topics</option>
                  {topics.map((t) => (
                    <option key={t.slug} value={t.slug} disabled={!t.mcqCount}>
                      {t.name} ({t.mcqCount})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Difficulty">
                <select value={choice.difficulty} onChange={(e) => update({ difficulty: e.target.value })} className={selectClass}>
                  <option value="mixed">Mixed</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
            </>
          )}
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-1.5">
            <HiOutlineCollection className="text-brand-600" /> {hasFullAccess && topic ? `Up to ${questionCount}` : questionCount} questions
          </li>
          <li className="flex items-center gap-1.5">
            <HiOutlineClock className="text-brand-600" /> {SECONDS_PER_QUESTION} seconds each (about {minutes} min)
          </li>
          <li className="flex items-center gap-1.5">
            <HiOutlineLightningBolt className="text-brand-600" /> Answers and explanations at the end
          </li>
        </ul>
        {hasFullAccess && topic && topic.mcqCount < FULL_QUIZ_SIZE && (
          <p className="mt-2 text-xs text-slate-500">This topic has {topic.mcqCount} quiz questions so far.</p>
        )}

        {startError && (
          <div role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {startError}
          </div>
        )}

        <Button className="mt-6 w-full sm:w-auto" loading={starting} onClick={startQuiz}>
          {hasFullAccess ? 'Start quiz' : 'Start sample quiz'}
        </Button>
        <p className="mt-3 text-xs text-slate-500">The timer starts as soon as you press start and keeps running if you leave the page.</p>
      </div>

      {!hasFullAccess && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <HiOutlineLockClosed className="mt-0.5 shrink-0" />
            Want full {language ? `${language.name} ` : ''}quizzes by topic and difficulty? They are part of full access.
          </p>
          <Link to="/pricing" className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700">
            Get full access
          </Link>
        </div>
      )}
    </div>
  );
}
