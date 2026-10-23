import { useMemo, useState } from 'react';
import { HiOutlineSearch } from 'react-icons/hi';
import useLanguages from '../hooks/useLanguages';
import LanguageGrid from '../components/languages/LanguageGrid';
import usePageTitle from '../hooks/usePageTitle';

const SHOW_SEARCH_FROM = 7; // search box appears once there are more than 6 languages

export default function LanguagesPage() {
  usePageTitle('Languages');
  const { languages, loading, error, reload } = useLanguages();
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return languages;
    return languages.filter(
      (l) => l.name.toLowerCase().includes(term) || (l.description || '').toLowerCase().includes(term)
    );
  }, [languages, search]);

  const showSearch = !loading && !error && languages.length >= SHOW_SEARCH_FROM;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Languages</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pick a language to see its interview questions. Free questions are open to everyone.
          </p>
        </div>

        {showSearch && (
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Search languages</span>
            <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search languages"
              className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        )}
      </div>

      {search && !shown.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No language matches &ldquo;{search}&rdquo;.
        </p>
      ) : (
        <LanguageGrid languages={shown} loading={loading} error={error} onRetry={reload} />
      )}
    </div>
  );
}
