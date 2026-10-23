import LanguageCard, { LanguageCardSkeleton } from './LanguageCard';
import Button from '../ui/Button';

// Grid of language cards with loading, error and empty states
export default function LanguageGrid({ languages, loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {languages.map((language) => (
        <LanguageCard key={language._id} language={language} />
      ))}
    </div>
  );
}
