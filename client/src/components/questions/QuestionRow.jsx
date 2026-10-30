import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiCheck, HiChevronDown, HiOutlineStar, HiStar, HiOutlineLockClosed } from 'react-icons/hi';
import AnswerText from './AnswerText';
import AnswerChecker from './AnswerChecker';
import CompanyChips from './CompanyChips';
import { checksLeftText } from '../../utils/answerCheck';

const difficultyStyle = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

/**
 * IPP-1602: one Q&A on the language page.
 * Click the question to open the answer. Logged-in users get the "done" circle,
 * full-access users the bookmark star. onDone / onBookmark / onNext are left out when not available.
 * IPP-1729: checker = { usage, onUsage } when the AI answer check is on: "Practice with AI" under the answer
 * hides it, the user writes in own words and gets it checked. loginToCheck = guest hint.
 */
export default function QuestionRow({
  question,
  open,
  onToggle,
  done,
  onDone,
  doneBusy,
  bookmarked,
  onBookmark,
  bookmarkBusy,
  onNext,
  checker,
  loginToCheck,
}) {
  const { _id, question: text, answer, codeSnippet, difficulty, isLocked, companies } = question;
  const answerId = `answer-${_id}`;
  const actionBtn =
    'inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60';

  return (
    <article id={`q-${_id}`} className={`scroll-mt-24 rounded-xl border bg-white ${open ? 'border-slate-300' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3 px-4 py-3.5 sm:items-center sm:gap-3.5 sm:px-5">
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            disabled={doneBusy}
            aria-pressed={done}
            aria-label={done ? 'Mark as not done' : 'Mark as done'}
            title={done ? 'Done' : 'Mark as done'}
            className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:mt-0 ${
              done ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:border-brand-600'
            }`}
          >
            {done && <HiCheck size={13} />}
          </button>
        ) : (
          <span className="mt-0.5 h-[22px] w-[22px] shrink-0 rounded-full border-2 border-slate-200 sm:mt-0" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={answerId}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-snug text-slate-900">{text}</h3>
            <CompanyChips companies={companies} className="mt-1.5" />
          </span>
          <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize sm:inline ${difficultyStyle[difficulty] || ''}`}>
            {difficulty}
          </span>
        </button>

        {onBookmark && (
          <button
            type="button"
            onClick={onBookmark}
            disabled={bookmarkBusy}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
            className="hidden shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:text-brand-600 disabled:opacity-50 sm:block"
          >
            {bookmarked ? <HiStar size={19} className="text-brand-600" /> : <HiOutlineStar size={19} />}
          </button>
        )}
        <button type="button" onClick={onToggle} tabIndex={-1} aria-hidden="true" className="shrink-0 p-1 text-slate-400">
          <HiChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div id={answerId} className="space-y-3.5 px-4 pb-5 pl-[52px] sm:px-5 sm:pl-[58px]">
          {isLocked ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <HiOutlineLockClosed /> This answer is part of full access.
            </p>
          ) : (
            <AnswerArea id={_id} answer={answer} codeSnippet={codeSnippet} checker={checker} loginToCheck={loginToCheck} />
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {onDone && (
              <button type="button" onClick={onDone} disabled={doneBusy} className={actionBtn}>
                <HiCheck className={done ? 'text-brand-600' : 'text-slate-400'} /> {done ? 'Done' : 'Mark as done'}
              </button>
            )}
            {onBookmark && (
              <button type="button" onClick={onBookmark} disabled={bookmarkBusy} className={actionBtn}>
                {bookmarked ? <HiStar className="text-brand-600" /> : <HiOutlineStar />} {bookmarked ? 'Bookmarked' : 'Bookmark'}
              </button>
            )}
            {onNext && (
              <button type="button" onClick={onNext} className={actionBtn}>
                Next question <span aria-hidden="true">›</span>
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// The opened answer (as before) + IPP-1729 "Practice with AI": hides the answer until a check or "Show answer".
// Remounts every time the row opens, so it starts with the answer visible again.
function AnswerArea({ id, answer, codeSnippet, checker, loginToCheck }) {
  const [practice, setPractice] = useState(false);
  const [revealed, setRevealed] = useState(true);

  return (
    <>
      {practice && (
        <AnswerChecker questionId={id} usage={checker.usage} onUsage={checker.onUsage} revealed={revealed} onReveal={() => setRevealed(true)} />
      )}
      {revealed && (
        <>
          {practice && <p className="pt-1 text-sm font-semibold text-slate-900">Model answer</p>}
          <AnswerText text={answer} />
          {codeSnippet && (
            <pre className="code-block">
              <code>{codeSnippet}</code>
            </pre>
          )}
        </>
      )}
      {!practice && checker && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-brand-50 px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setPractice(true);
              setRevealed(false);
            }}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            ✨ Practice with AI
          </button>
          <span className="text-xs text-slate-600">Hide the answer, say it in your own words, get it checked.</span>
          <span className="ml-auto text-xs text-slate-500">{checksLeftText(checker.usage)}</span>
        </div>
      )}
      {loginToCheck && (
        <p className="text-sm text-slate-500">
          ✨{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>{' '}
          to practice this answer in your own words with AI.
        </p>
      )}
    </>
  );
}

export function QuestionRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3.5 rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="h-[22px] w-[22px] rounded-full bg-slate-200" />
      <div className="h-4 flex-1 rounded bg-slate-200" />
    </div>
  );
}
