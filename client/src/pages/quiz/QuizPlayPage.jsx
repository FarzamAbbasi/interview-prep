import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineClock, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import { loadActiveQuiz, saveActiveQuiz, clearActiveQuiz } from '../../utils/activeQuiz';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import usePageTitle from '../../hooks/usePageTitle';

const LETTERS = ['A', 'B', 'C', 'D'];

const formatTime = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * /quiz/play — one question at a time, timer, progress, submit.
 * The quiz (questions + answers so far) lives in sessionStorage, so a refresh continues where you left off.
 * The timer follows the server's expiresAt; at 0 the quiz is submitted automatically.
 */
export default function QuizPlayPage() {
  usePageTitle('Quiz in progress');
  const navigate = useNavigate();
  const { user } = useAuth();
  // read once; a quiz saved by another account in this browser is ignored
  const [quiz] = useState(() => {
    const saved = loadActiveQuiz();
    return saved && (!saved.userId || saved.userId === user?._id) ? saved : null;
  });
  const [answers, setAnswers] = useState(() => quiz?.answers || {}); // questionId -> 0..3
  const [current, setCurrent] = useState(() => Math.min(quiz?.current || 0, (quiz?.questions?.length || 1) - 1));
  const [now, setNow] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submittedRef = useRef(false);
  const answersRef = useRef(answers); // latest answers for the auto-submit timer

  const total = quiz?.questions?.length || 0;
  const offset = quiz?.clockOffset || 0;
  const endsAt = quiz ? new Date(quiz.expiresAt).getTime() : 0;
  const secondsLeft = quiz ? (endsAt - (now + offset)) / 1000 : 0;
  const answeredCount = Object.keys(answers).length;

  // Keep progress in sessionStorage (and the ref used by auto-submit)
  useEffect(() => {
    answersRef.current = answers;
    if (quiz && !submittedRef.current) saveActiveQuiz({ ...quiz, answers, current });
  }, [quiz, answers, current]);

  const submit = useCallback(
    async (reason) => {
      if (!quiz || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const payload = {
          answers: quiz.questions.map((q) => ({ question: q._id, selectedOption: answersRef.current[q._id] ?? null })),
        };
        const { data } = await api.post(`/quiz/${quiz.attemptId}/submit`, payload);
        clearActiveQuiz();
        if (reason === 'timeout') toast("Time's up! Your quiz was submitted", { icon: '⏰' });
        navigate(`/quiz/result/${quiz.attemptId}`, { replace: true, state: { result: data.data } });
      } catch (err) {
        if (err.response?.data?.code === 'QUIZ_ALREADY_SUBMITTED') {
          clearActiveQuiz();
          navigate(`/quiz/result/${quiz.attemptId}`, { replace: true });
          return;
        }
        submittedRef.current = false;
        setSubmitting(false);
        toast.error(getErrorMessage(err));
      }
    },
    [quiz, navigate]
  );

  // Tick every 250 ms; submit automatically when time runs out
  useEffect(() => {
    if (!quiz) return undefined;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (endsAt - (t + offset) <= 0) {
        clearInterval(timer);
        submit('timeout');
      }
    }, 250);
    return () => clearInterval(timer);
  }, [quiz, endsAt, offset, submit]);

  // Warn before closing the tab while the quiz is running
  useEffect(() => {
    if (!quiz) return undefined;
    const onBeforeUnload = (e) => {
      if (submittedRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [quiz]);

  const question = quiz?.questions?.[current];
  const choose = useCallback(
    (index) => {
      if (!question || submittedRef.current) return;
      setAnswers((a) => ({ ...a, [question._id]: index }));
    },
    [question]
  );
  const go = useCallback((index) => setCurrent(Math.max(0, Math.min(total - 1, index))), [total]);

  // Keyboard: 1-4 or A-D to choose, arrows to move
  useEffect(() => {
    const onKey = (e) => {
      if (confirmOpen || e.target.closest('input, textarea, select')) return;
      const key = e.key.toLowerCase();
      if (['1', '2', '3', '4'].includes(key)) choose(Number(key) - 1);
      else if (['a', 'b', 'c', 'd'].includes(key)) choose(key.charCodeAt(0) - 97);
      else if (key === 'arrowright') go(current + 1);
      else if (key === 'arrowleft') go(current - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, go, current, confirmOpen]);

  const askSubmit = () => {
    if (answeredCount < total) setConfirmOpen(true);
    else submit('manual');
  };

  // ---- No quiz in progress (e.g. opened directly) ----
  if (!quiz || !total) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">No quiz in progress</h1>
        <p className="mt-2 text-slate-500">Start a new quiz to begin.</p>
        <Link to="/quiz" className="mt-6 inline-block rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Start a quiz
        </Link>
      </div>
    );
  }

  const lowTime = secondsLeft <= 30;
  const timePercent = Math.max(0, Math.min(100, (secondsLeft / quiz.timeLimit) * 100));
  const isLast = current === total - 1;
  const selected = answers[question._id];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Top bar: title, timer, progress */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 pb-3 pt-1 backdrop-blur sm:mx-0 sm:rounded-b-xl sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {quiz.language?.name} {quiz.isSample ? 'sample quiz' : 'quiz'}
              {quiz.topic?.name ? ` · ${quiz.topic.name}` : ''}
            </p>
            <p className="text-xs text-slate-500">
              Question {current + 1} of {total} · {answeredCount} answered
            </p>
          </div>
          <div
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-lg font-semibold ${
              lowTime ? 'bg-red-50 text-red-600' : 'bg-white text-slate-900'
            }`}
            role="timer"
            aria-live={lowTime ? 'polite' : 'off'}
            aria-label={`Time left ${formatTime(secondsLeft)}`}
          >
            <HiOutlineClock /> {formatTime(secondsLeft)}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${lowTime ? 'bg-red-500' : 'bg-brand-600'}`}
            style={{ width: `${timePercent}%` }}
          />
        </div>
        {/* Question numbers */}
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Questions">
          {quiz.questions.map((q, i) => {
            const done = answers[q._id] !== undefined;
            return (
              <button
                key={q._id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Question ${i + 1}${done ? ', answered' : ''}`}
                aria-current={i === current ? 'step' : undefined}
                className={`h-8 w-8 rounded-md text-xs font-semibold transition ${
                  i === current
                    ? 'bg-brand-600 text-white'
                    : done
                      ? 'bg-brand-100 text-brand-700'
                      : 'border border-slate-300 bg-white text-slate-600 hover:border-brand-600'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="question-text">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Question {current + 1} · <span className="capitalize">{question.difficulty}</span>
        </p>
        <h1 id="question-text" className="mt-2 text-lg font-semibold text-slate-900">
          {question.question}
        </h1>
        {question.codeSnippet && (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
            <code>{question.codeSnippet}</code>
          </pre>
        )}

        <div role="radiogroup" aria-labelledby="question-text" className="mt-5 space-y-2.5">
          {question.options.map((option, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => choose(i)}
                disabled={submitting}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                    : 'border-slate-200 bg-white hover:border-brand-600 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span className="break-words pt-0.5 font-mono text-slate-800">{option}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Navigation */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => go(current - 1)} disabled={current === 0 || submitting}>
          <HiChevronLeft /> Previous
        </Button>
        {isLast ? (
          <Button onClick={askSubmit} loading={submitting}>
            Submit quiz
          </Button>
        ) : (
          <Button onClick={() => go(current + 1)} disabled={submitting}>
            Next <HiChevronRight />
          </Button>
        )}
      </div>
      <div className="mt-4 flex flex-col items-center gap-1 text-center">
        {!isLast && (
          <button type="button" onClick={askSubmit} disabled={submitting} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Finish early and submit
          </button>
        )}
        <p className="hidden text-xs text-slate-400 sm:block">Tip: press 1–4 to choose, ← → to move</p>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit the quiz?"
        text={`You have answered ${answeredCount} of ${total}. Unanswered questions count as wrong.`}
        confirmText="Submit"
        cancelText="Keep going"
        loading={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          submit('manual');
        }}
      />
    </div>
  );
}
