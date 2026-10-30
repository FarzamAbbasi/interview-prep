import { Link } from 'react-router-dom';
import { HiOutlineLockClosed, HiOutlineOfficeBuilding } from 'react-icons/hi';

const difficultyStyle = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

/**
 * IPP-1732: company questions a guest / unpaid user cannot open.
 * The server sends only { _id, topic, difficulty, companies }: no question text, answer or code.
 * It replaces the "more questions with full access" box, so it has the same button,
 * and otherCount = the other paid questions in this list (shown as one line).
 */
export default function LockedCompanyQuestions({ items, topics = [], loggedIn, otherCount = 0 }) {
  if (!items?.length) return null;
  const topicName = (slug) => topics.find((t) => t.slug === slug)?.name || slug;

  return (
    <section aria-labelledby="locked-company-title" className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="locked-company-title" className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
          <HiOutlineOfficeBuilding className="text-brand-600" size={20} aria-hidden="true" />
          Company interview questions
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{items.length} locked</span>
        </h2>
        <Link
          to={loggedIn ? '/pricing' : '/register'}
          className="rounded-lg bg-brand-600 px-3.5 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
        >
          {loggedIn ? 'Get full access' : 'Create free account'}
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">Questions candidates reported from real interviews at these companies.</p>

      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((q) => (
          <li key={q._id} className="flex items-center gap-3 py-2.5 text-sm">
            <HiOutlineLockClosed className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="text-slate-500">Asked at </span>
              <b className="text-slate-900">{q.companies.join(', ')}</b>
              <span className="text-slate-400"> · {topicName(q.topic)}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${difficultyStyle[q.difficulty] || ''}`}>
              {q.difficulty}
            </span>
          </li>
        ))}
      </ul>

      {otherCount > 0 && (
        <p className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
          <HiOutlineLockClosed className="shrink-0 text-slate-400" aria-hidden="true" />
          + {otherCount} more {otherCount === 1 ? 'question' : 'questions'} with full access
        </p>
      )}
    </section>
  );
}
