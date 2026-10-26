import { Link } from 'react-router-dom';
import LanguageIcon from './LanguageIcon';
import DifficultyBar, { ProgressBar } from './DifficultyBar';
import useAuth from '../../hooks/useAuth';

// IPP-1602: one language as a card: logo, name, topics, counts, difficulty mix and (logged in) progress
export default function LanguageCard({ language }) {
  const { user, canAccess } = useAuth();
  const { name, slug, icon, description, qaCount = 0, mcqCount = 0, freeQaCount = 0, topics = [], difficulty, doneCount } = language;
  const hasFullAccess = canAccess(language._id); // IPP-1704: this language unlocked?
  const visible = hasFullAccess ? qaCount : freeQaCount; // questions this user can read
  const done = doneCount || 0;
  const pct = visible ? Math.round((done / visible) * 100) : 0;
  const action = !user ? 'Open' : done === 0 ? 'Start' : done >= visible ? 'Review' : 'Continue';

  return (
    <Link
      to={`/languages/${slug}`}
      className="group flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-brand-600 sm:p-6"
    >
      <div className="flex items-center gap-3.5">
        <LanguageIcon icon={icon} name={name} box="h-13 w-13 rounded-xl" />
        <div className="min-w-0">
          <h3 className="text-[22px] font-bold leading-tight tracking-tight text-slate-900">{name}</h3>
          <p className="text-[13px] text-slate-500">
            {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
          </p>
        </div>
      </div>

      {description && <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{description}</p>}

      <dl className="flex gap-6 text-[13px] text-slate-500">
        <div>
          <dd className="text-lg font-semibold text-slate-900">{qaCount}</dd>
          <dt>answers</dt>
        </div>
        <div>
          <dd className="text-lg font-semibold text-slate-900">{mcqCount}</dd>
          <dt>quiz MCQs</dt>
        </div>
      </dl>

      <DifficultyBar difficulty={difficulty} className="mt-auto" />

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        {user ? (
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-slate-500">
            <b className="text-slate-900">{pct}%</b> done
            <ProgressBar done={done} total={visible} className="w-24 sm:w-28" />
          </span>
        ) : (
          <span className="text-[13px] text-slate-500">Start with the free questions</span>
        )}
        <span className="shrink-0 text-sm font-bold text-brand-600">
          {action} <span aria-hidden="true">›</span>
        </span>
      </div>
    </Link>
  );
}

// Placeholder card while languages load
export function LanguageCardSkeleton() {
  return (
    <div className="flex h-72 animate-pulse flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="h-13 w-13 rounded-xl bg-slate-200" />
        <div className="h-5 w-24 rounded bg-slate-200" />
      </div>
      <div className="h-3 w-full rounded bg-slate-100" />
      <div className="h-3 w-2/3 rounded bg-slate-100" />
      <div className="mt-auto h-1.5 w-full rounded bg-slate-200" />
    </div>
  );
}
