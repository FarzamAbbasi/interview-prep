import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { HiCheckCircle, HiXCircle, HiMinusCircle, HiOutlineClock, HiOutlineLockClosed } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import PageLoader from '../../components/ui/PageLoader';
import UpgradeModal from '../../components/ui/UpgradeModal';
import usePageTitle from '../../hooks/usePageTitle';

const LETTERS = ['A', 'B', 'C', 'D'];

const formatTime = (seconds = 0) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function verdict(percentage) {
  if (percentage >= 80) return { title: 'Great job!', text: 'You know this well. Try a harder level next.' };
  if (percentage >= 50) return { title: 'Good effort', text: 'Review the explanations below and try again.' };
  return { title: 'Keep practising', text: 'Read the explanations below, then take another quiz.' };
}

// Circle showing the percentage
function ScoreRing({ percentage }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const color = percentage >= 80 ? 'text-green-600' : percentage >= 50 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-slate-100" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percentage / 100)}
          className={color}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-900">{percentage}%</span>
    </div>
  );
}

function ReviewItem({ item, number }) {
  const skipped = item.selectedOption === null || item.selectedOption === undefined;
  const status = item.isCorrect ? 'correct' : skipped ? 'skipped' : 'wrong';
  const styles = {
    correct: { border: 'border-green-200', icon: <HiCheckCircle className="text-green-600" size={22} />, label: 'Correct' },
    wrong: { border: 'border-red-200', icon: <HiXCircle className="text-red-500" size={22} />, label: 'Wrong' },
    skipped: { border: 'border-slate-200', icon: <HiMinusCircle className="text-slate-400" size={22} />, label: 'Not answered' },
  }[status];

  return (
    <article className={`rounded-xl border-2 ${styles.border} bg-white p-5`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0" aria-label={styles.label}>
          {styles.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Question {number} · {styles.label}
          </p>
          <h3 className="mt-1 font-semibold text-slate-900">{item.question}</h3>
          {item.codeSnippet && (
            <pre className="code-block mt-3 p-3 text-xs">
              <code>{item.codeSnippet}</code>
            </pre>
          )}

          <ul className="mt-3 space-y-1.5">
            {item.options.map((option, i) => {
              const isCorrect = i === item.correctOption;
              const isChosen = i === item.selectedOption;
              let cls = 'border-slate-200 text-slate-700';
              if (isCorrect) cls = 'border-green-300 bg-green-50 text-green-800';
              else if (isChosen) cls = 'border-red-300 bg-red-50 text-red-800';
              return (
                <li key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}>
                  <span className="font-bold">{LETTERS[i]}.</span>
                  <span className="min-w-0 flex-1 break-words font-mono">{option}</span>
                  {isCorrect && <span className="shrink-0 text-xs font-semibold">Correct answer</span>}
                  {isChosen && !isCorrect && <span className="shrink-0 text-xs font-semibold">Your answer</span>}
                </li>
              );
            })}
          </ul>

          {item.explanation && (
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Why: </span>
              {item.explanation}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * /quiz/result/:attemptId — score + review.
 * Right after submit the result comes from the quiz page; after a refresh it is loaded from the API.
 */
export default function QuizResultPage() {
  usePageTitle('Quiz result');
  const { attemptId } = useParams();
  const location = useLocation();
  const passed = location.state?.result?.attemptId === attemptId ? location.state.result : null;

  const [state, setState] = useState({ id: passed ? attemptId : null, result: passed, error: '' });
  const [onlyMistakes, setOnlyMistakes] = useState(false);
  // IPP-1501: right after finishing the free sample quiz, offer full access once
  // (not again after a reload or when the result is opened from the dashboard)
  const popupKey = `askedin_sample_popup_${attemptId}`;
  const [upgradeOpen, setUpgradeOpen] = useState(() => {
    if (!passed?.isSample) return false;
    try {
      return !sessionStorage.getItem(popupKey);
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!upgradeOpen) return;
    try {
      sessionStorage.setItem(popupKey, '1');
    } catch {
      // storage blocked: the popup may show again after a reload, nothing else breaks
    }
  }, [upgradeOpen, popupKey]);

  useEffect(() => {
    if (passed) return undefined;
    let cancelled = false;
    api
      .get(`/quiz/${attemptId}`)
      .then(({ data }) => !cancelled && setState({ id: attemptId, result: data.data, error: '' }))
      .catch((err) => !cancelled && setState({ id: attemptId, result: null, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [attemptId, passed]);

  if (state.id !== attemptId) return <PageLoader text="Loading your result..." />;
  if (!state.result) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Result not available</h1>
        <p className="mt-2 text-slate-500">{state.error}</p>
        <Link to="/quiz" className="mt-6 inline-block rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Start a quiz
        </Link>
      </div>
    );
  }

  const r = state.result;
  const { title, text } = verdict(r.percentage);
  const wrongCount = r.review.filter((x) => !x.isCorrect).length;
  const items = r.review.map((item, i) => ({ item, number: i + 1 })).filter(({ item }) => !onlyMistakes || !item.isCorrect);
  const quizName = [r.language?.name, r.isSample ? 'sample quiz' : 'quiz'].filter(Boolean).join(' ');

  return (
    <div className="mx-auto max-w-3xl">
      {/* Summary */}
      <section className="flex flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:flex-row sm:text-left">
        <ScoreRing percentage={r.percentage} />
        <div className="flex-1">
          <p className="text-sm text-slate-500">{quizName || 'Quiz'} result</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-slate-600">
            You got <strong className="text-slate-900">{r.score}</strong> out of <strong className="text-slate-900">{r.total}</strong> right. {text}
          </p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-slate-500 sm:justify-start">
            <HiOutlineClock /> Time: {formatTime(r.timeTaken)} of {formatTime(r.timeLimit)}
          </p>
          {r.timedOut && <p className="mt-2 text-sm font-medium text-red-600">Time was up before submitting, so no answers were counted.</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link to="/quiz" className="rounded-md bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700">
              Try another quiz
            </Link>
            <Link to="/dashboard" className="rounded-md border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Upgrade prompt after the sample quiz */}
      {r.isSample && (
        <section className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <HiOutlineLockClosed className="mt-0.5 shrink-0" />
            That was the free sample. Get full access for random quizzes by topic and difficulty, and every answer.
          </p>
          <Link to="/pricing" className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700">
            Get full access
          </Link>
        </section>
      )}

      <UpgradeModal
        open={upgradeOpen && r.isSample}
        onClose={() => setUpgradeOpen(false)}
        title="That was the free sample quiz"
        text={`You answered ${r.score} of ${r.total} correctly. Full access gives you full timed quizzes in every language, by topic and difficulty, plus every answer and bookmarks. One-time payment, no subscription.`}
      />

      {/* Review */}
      <section className="mt-8" aria-labelledby="review-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="review-heading" className="text-xl font-bold text-slate-900">
            Review answers
          </h2>
          {wrongCount > 0 && wrongCount < r.review.length && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyMistakes}
                onChange={(e) => setOnlyMistakes(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              />
              Show only mistakes ({wrongCount})
            </label>
          )}
        </div>
        <div className="space-y-4">
          {items.map(({ item, number }) => (
            <ReviewItem key={String(item.questionId)} item={item} number={number} />
          ))}
        </div>
      </section>
    </div>
  );
}
