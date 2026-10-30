import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineLockClosed, HiOutlineBookmark, HiBookmark, HiChevronDown } from 'react-icons/hi';
import AnswerText from './AnswerText';
import CompanyChips from './CompanyChips';

const difficultyStyle = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

/**
 * One Q&A.
 * - Free / paid users: "Show answer" reveals the answer and code
 * - Locked (paid question, no full access): blurred placeholder + upgrade link
 * - showBookmark: logged-in users see the bookmark button (onBookmark handles paid/unpaid)
 */
export default function QuestionCard({ question, number, topicName, showBookmark, bookmarked, onBookmark, bookmarkBusy }) {
  const [open, setOpen] = useState(false);
  const { question: text, answer, codeSnippet, difficulty, tags = [], isLocked } = question;
  const answerId = `answer-${question._id}`;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="w-7 shrink-0 pt-0.5 text-right font-mono text-sm text-slate-400 tabular-nums">{number}.</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold leading-snug text-slate-900">{text}</h2>
          <CompanyChips companies={question.companies} className="mt-2" />
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${difficultyStyle[difficulty] || ''}`}>
              {difficulty}
            </span>
            {topicName && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{topicName}</span>}
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        {showBookmark && (
          <button
            type="button"
            onClick={onBookmark}
            disabled={bookmarkBusy}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 disabled:opacity-50"
          >
            {bookmarked ? <HiBookmark size={22} className="text-brand-600" /> : <HiOutlineBookmark size={22} />}
          </button>
        )}
      </div>

      <div className="mt-4 pl-10 sm:pl-11">
        {isLocked ? (
          <div className="relative overflow-hidden rounded-lg border border-slate-200">
            {/* Fake blurred text: the real answer is never sent to the browser */}
            <div aria-hidden="true" className="select-none space-y-2 p-4 blur-sm">
              <div className="h-3 w-11/12 rounded bg-slate-300" />
              <div className="h-3 w-4/5 rounded bg-slate-300" />
              <div className="h-3 w-2/3 rounded bg-slate-300" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 text-center sm:flex-row sm:gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <HiOutlineLockClosed /> Answer locked
              </span>
              <Link
                to="/pricing"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Get full access
              </Link>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={answerId}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-600 transition-colors hover:border-brand-600 hover:bg-brand-50"
            >
              {open ? 'Hide answer' : 'Show answer'}
              <HiChevronDown className={`transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div id={answerId} className="mt-3 space-y-3">
                <AnswerText text={answer} />
                {codeSnippet && (
                  <pre className="code-block">
                    <code>{codeSnippet}</code>
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export function QuestionCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex gap-3 sm:gap-4">
        <div className="h-4 w-7 rounded bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="h-3 w-1/3 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
