import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';

// Page numbers to show: 1 … 4 5 6 … 10
function pageList(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap-' + p);
    result.push(p);
  });
  return result;
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const btn = 'flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium transition';

  return (
    <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${btn} text-slate-600 hover:bg-slate-100 disabled:opacity-40`}
        aria-label="Previous page"
      >
        <HiChevronLeft size={18} />
      </button>
      {pageList(page, totalPages).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`${btn} ${p === page ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={`${btn} text-slate-600 hover:bg-slate-100 disabled:opacity-40`}
        aria-label="Next page"
      >
        <HiChevronRight size={18} />
      </button>
    </nav>
  );
}
