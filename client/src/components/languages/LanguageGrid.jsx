import LanguageCard, { LanguageCardSkeleton } from './LanguageCard';
import { DifficultyLegend } from './DifficultyBar';
import Button from '../ui/Button';

const gridClass = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5';

// Language cards with loading, error and empty states (IPP-1602).
// showMore: last card says more languages are coming (home and languages page)
export default function LanguageGrid({ languages, loading, error, onRetry, showMore = false }) {
  if (loading) {
    return (
      <div className={gridClass}>
        {[1, 2, 3].map((n) => (
          <LanguageCardSkeleton key={n} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!languages.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No languages yet. Please check back soon.
      </p>
    );
  }

  return (
    <>
      <div className={gridClass}>
        {languages.map((language) => (
          <LanguageCard key={language._id} language={language} />
        ))}
        {showMore && (
          <div className="flex min-h-48 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
            <span className="text-2xl text-slate-500" aria-hidden="true">
              +
            </span>
            <p className="font-semibold text-slate-900">More languages coming</p>
            <p className="text-sm text-slate-500">New languages are added regularly.</p>
          </div>
        )}
      </div>
      <DifficultyLegend className="mt-4" />
    </>
  );
}
