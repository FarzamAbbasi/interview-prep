import { Link } from 'react-router-dom';
import { HiOutlineArrowRight } from 'react-icons/hi';
import LanguageIcon from './LanguageIcon';

// One language: logo, name, description, counts. The whole card links to its questions page.
export default function LanguageCard({ language }) {
  const { name, slug, icon, description, qaCount = 0, mcqCount = 0, freeQaCount = 0, topics = [] } = language;

  return (
    <Link
      to={`/languages/${slug}`}
      className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
    >
      <div className="flex items-center gap-3">
        <LanguageIcon icon={icon} name={name} />
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
          {freeQaCount > 0 && <p className="text-xs font-medium text-green-700">{freeQaCount} free questions</p>}
        </div>
      </div>

      {description && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{description}</p>}

      <div className="mt-auto flex items-center justify-between pt-4">
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <li>{qaCount} Q&amp;A</li>
          <li>{mcqCount} quiz MCQs</li>
          {topics.length > 0 && <li>{topics.length} topics</li>}
        </ul>
        <HiOutlineArrowRight className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
      </div>
    </Link>
  );
}

// Grey placeholder while languages load
export function LanguageCardSkeleton() {
  return (
    <div className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-slate-200" />
        <div className="h-4 w-24 rounded bg-slate-200" />
      </div>
      <div className="mt-4 h-3 w-full rounded bg-slate-100" />
      <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
    </div>
  );
}
