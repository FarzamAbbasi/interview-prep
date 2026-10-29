import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiChevronDown, HiOutlineLockClosed } from 'react-icons/hi';
import AnswerText from '../questions/AnswerText';
import DifficultyTag from '../practice/DifficultyTag';
import { VerdictBox } from '../questions/AnswerChecker';

const RATING = {
  knew: ['Knew', 'bg-green-50 text-green-700'],
  partly: ['Partly', 'bg-amber-50 text-amber-700'],
  didnt: ["Didn't know", 'bg-red-50 text-red-700'],
  skipped: ['Skipped', 'bg-slate-100 text-slate-600'],
  pending: ['Rate it', 'bg-brand-50 text-brand-700'], // IPP-1730: the AI could not check it
};
// IPP-1730: answers checked by the AI show its verdict
const AI_LABEL = { right: 'Right', partly: 'Partly', wrong: 'Wrong' };
const SELF_RATE = [
  { key: 'knew', label: '✅ I knew it', cls: 'border-green-300 hover:bg-green-50' },
  { key: 'partly', label: '🤏 Partly', cls: 'border-amber-300 hover:bg-amber-50' },
  { key: 'didnt', label: "❌ Didn't know", cls: 'border-red-300 hover:bg-red-50' },
];
const RESULT_TEXT = { partly: 'Partly known', didnt: "Didn't know", skipped: 'Skipped' };

const pointsTone = (points) => (points === 1 ? RATING.knew[1] : points > 0 ? RATING.partly[1] : RATING.didnt[1]);

const formatDuration = (seconds = 0) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min${s ? ` ${s} s` : ''}` : `${s} s`;
};
const formatDay = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function verdict(report) {
  // IPP-1730: nothing scored yet (the AI could not check the answers): ask for the ratings instead of showing 0%
  if (!report.total && report.pending) {
    return { title: 'Rate your answers', text: 'The AI could not check your answers this time. Rate them below to get your score.' };
  }
  const p = report.percentage;
  const weak = report.studyNext[0]?.topic.name;
  const strong = report.items.find((i) => i.points === 1)?.topic.name;
  if (p >= 80) return { title: 'Great round 🎉', text: weak ? `Ready for a harder level. Have one more look at ${weak}.` : 'Ready for a harder level.' };
  if (p >= 50) {
    return {
      title: 'Good round 👍',
      text: `${strong ? `Strong on ${strong}. ` : ''}${weak ? `${weak} needs another look before a real interview.` : ''}`,
    };
  }
  return { title: 'Keep practising', text: 'Study the topics below, then try another round at the same level.' };
}

// Circle with the score (same idea as the quiz result page)
function ScoreRing({ percentage, empty }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const color = percentage >= 80 ? 'text-green-600' : percentage >= 50 ? 'text-brand-600' : 'text-red-500';
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
          strokeDashoffset={circumference * (1 - (empty ? 0 : percentage) / 100)}
          className={empty ? 'text-slate-100' : color}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="text-2xl text-slate-900">{empty ? '–' : `${percentage}%`}</b>
        <span className="text-xs text-slate-500">score</span>
      </span>
    </div>
  );
}

// One answer of the round; opens to show the question, model answer or code + solution
function AnswerRow({ item, language, onRate, onRecheck }) {
  const [rating, setRating] = useState(null); // the button being saved ('ai' = Check with AI again)
  const isCoding = item.kind === 'coding';
  const pending = item.rating === 'pending';
  const [label, tone] = isCoding
    ? [`${item.passed} / ${item.total} tests`, pointsTone(item.points)]
    : item.aiVerdict
      ? [AI_LABEL[item.aiVerdict], (RATING[item.rating] || RATING.skipped)[1]]
      : RATING[item.rating] || RATING.skipped;
  const problemUrl = item.problem?.slug && `/practice/${language?.slug}/${item.problem.slug}`;

  const rate = async (key) => {
    setRating(key);
    await onRate(item.index, key);
    setRating(null);
  };
  const recheck = async () => {
    setRating('ai');
    await onRecheck(item.index);
    setRating(null);
  };

  return (
    <details className="group border-t border-slate-100 first:border-t-0" open={pending || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${tone}`}>{label}</span>
        <span className="min-w-0 flex-1 text-sm text-slate-800">{isCoding ? `Coding: ${item.title}` : item.question}</span>
        <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{item.topic.name}</span>
        <HiChevronDown className="shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="mb-4 rounded-xl bg-slate-50 p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          <DifficultyTag difficulty={item.difficulty} />
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600">{item.topic.name}</span>
        </div>

        {!isCoding ? (
          <>
            {item.codeSnippet && (
              <pre className="code-block mb-3 text-xs">
                <code>{item.codeSnippet}</code>
              </pre>
            )}
            {item.userAnswer && (
              <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <p className="font-semibold text-slate-900">Your answer</p>
                <p className="mt-1 whitespace-pre-line text-slate-700">{item.userAnswer}</p>
              </div>
            )}
            {item.aiVerdict && (
              <div className="mb-3">
                <VerdictBox result={{ verdict: item.aiVerdict, points: item.aiPoints }} />
              </div>
            )}
            <p className="text-sm font-semibold text-slate-900">Model answer</p>
            <AnswerText text={item.answer} className="mt-1 text-[15px]" />
            {pending && (
              <div className="mt-4 rounded-lg border border-brand-100 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-700">The AI could not check this answer yet (it was busy).</p>
                  <button
                    type="button"
                    onClick={recheck}
                    disabled={Boolean(rating)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {rating === 'ai' ? 'Checking...' : '✨ Check with AI again'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-500">Or compare it with the model answer and rate it yourself:</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {SELF_RATE.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      disabled={Boolean(rating)}
                      onClick={() => rate(r.key)}
                      className={`rounded-lg border-[1.5px] bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900 transition disabled:opacity-60 ${r.cls}`}
                    >
                      {rating === r.key ? 'Saving...' : r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-900">Your code</p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-[#1d1934] p-3 font-mono text-[13px] leading-relaxed text-[#ece9fb]">
              {item.code || '// No code was submitted'}
            </pre>
            {item.solution?.code ? (
              <>
                <p className="mt-4 text-sm font-semibold text-slate-900">Solution</p>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-[#1d1934] p-3 font-mono text-[13px] leading-relaxed text-[#ece9fb]">
                  {item.solution.code}
                </pre>
                <AnswerText text={item.solution.explanation} className="mt-3 text-[15px]" />
              </>
            ) : item.solutionLocked ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <HiOutlineLockClosed /> The solution and explanation come with{' '}
                <Link to="/pricing" className="font-semibold text-brand-700 hover:underline">
                  full access
                </Link>
                .
              </p>
            ) : null}
            {problemUrl && item.problem.isActive !== false && (
              <Link to={problemUrl} className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
                Solve it again in Practice →
              </Link>
            )}
          </>
        )}
      </div>
    </details>
  );
}

/**
 * IPP-1726: report of a finished interview round (/interview/:roundId).
 * Score ring + verdict, every answer (opens to the model answer / code + solution), and "Study next".
 */
export default function InterviewReport({ report, onRate, onRecheck, checking }) {
  const { language } = report;
  const v = verdict(report);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ScoreRing percentage={report.percentage} empty={!report.total && report.pending > 0} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{v.title}</h1>
            <p className="text-sm text-slate-500">
              {language?.name || 'Interview'} · <span className="capitalize">{report.level}</span> · {formatDuration(report.timeTaken)} ·{' '}
              {formatDay(report.completedAt || report.startedAt)}
              {report.isTrial ? ' · Free round' : ''}
            </p>
            {v.text && <p className="mt-2 text-[15px] text-slate-700">{v.text}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/interview" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Try another round
              </Link>
              <Link to="/dashboard" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {report.pending > 0 && (
        <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-slate-800">
          {checking && (
            <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent align-[-2px]" />
          )}
          <b>
            {report.pending} {report.pending === 1 ? 'answer is' : 'answers are'} not checked yet.
          </b>{' '}
          {checking
            ? 'The AI is still working on it; this page updates by itself.'
            : 'Open the rows marked "Rate it": check with AI again or rate yourself.'}{' '}
          Not in the score until then.
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="answers-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="answers-heading" className="text-lg font-bold text-slate-900">
            Your answers
          </h2>
          <span className="text-xs text-slate-500">
            {report.total ? `${report.score} of ${report.total} points · ` : ''}tap a row to review
          </span>
        </div>
        <div className="mt-2">
          {report.items.map((item) => (
            <AnswerRow key={item.index} item={item} language={language} onRate={onRate} onRecheck={onRecheck} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="next-heading">
        <h2 id="next-heading" className="text-lg font-bold text-slate-900">
          Study next
        </h2>
        {report.studyNext.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Nothing to fix in this round. Try a harder level next.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.studyNext.map((s) =>
              s.kind === 'qa' ? (
                <div key={`qa-${s.topic.slug}`} className="rounded-xl bg-slate-50 p-4">
                  <b className="text-slate-900">{s.topic.name}</b>
                  <p className="text-sm text-slate-500">
                    {RESULT_TEXT[s.result] || 'Review'}
                    {s.questions ? ` · ${s.questions} ${s.questions === 1 ? 'question' : 'questions'}` : ''}
                  </p>
                  <Link
                    to={`/languages/${language?.slug}?topic=${s.topic.slug}`}
                    className="mt-1 inline-block text-sm font-semibold text-brand-700 hover:underline"
                  >
                    Open topic →
                  </Link>
                </div>
              ) : (
                <div key={`coding-${s.problemSlug || s.title}`} className="rounded-xl bg-slate-50 p-4">
                  <b className="text-slate-900">{s.topic.name} (coding)</b>
                  <p className="text-sm text-slate-500">
                    {s.title}: {s.passed} / {s.total} tests passed
                  </p>
                  <Link to={`/practice/${language?.slug}`} className="mt-1 inline-block text-sm font-semibold text-brand-700 hover:underline">
                    Practice problems →
                  </Link>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {report.isTrial && (
        <section className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <HiOutlineLockClosed className="mt-0.5 shrink-0" />
            That was your free round. Full access gives unlimited rounds from every question and coding problem.
          </p>
          <Link to="/pricing" className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700">
            Get full access
          </Link>
        </section>
      )}
    </div>
  );
}
