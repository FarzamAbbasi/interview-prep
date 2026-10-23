import { HiOutlineSearch, HiX } from 'react-icons/hi';

const selectClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

/**
 * Topic tabs + difficulty / tag / search.
 * values: { topic, difficulty, tag, search } (search = what is typed right now)
 */
export default function QuestionFilters({ topics, totalQa, tags, values, onChange, onClear }) {
  const hasFilters = values.topic || values.difficulty || values.tag || values.search;
  const tab = (active) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
      active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-600'
    }`;

  return (
    <div className="space-y-4">
      {topics.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Topics">
          <div className="flex gap-2 sm:flex-wrap">
            <button type="button" role="tab" aria-selected={!values.topic} className={tab(!values.topic)} onClick={() => onChange({ topic: '' })}>
              All <span className="opacity-75">({totalQa})</span>
            </button>
            {topics.map((t) => (
              <button
                key={t.slug}
                type="button"
                role="tab"
                aria-selected={values.topic === t.slug}
                className={tab(values.topic === t.slug)}
                onClick={() => onChange({ topic: t.slug, tag: '' })}
              >
                {t.name} <span className="opacity-75">({t.qaCount})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_160px_180px]">
        <label className="relative block">
          <span className="sr-only">Search questions</span>
          <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={values.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search questions"
            maxLength={100}
            className={`${selectClass} pl-9`}
          />
        </label>
        <label>
          <span className="sr-only">Difficulty</span>
          <select value={values.difficulty} onChange={(e) => onChange({ difficulty: e.target.value })} className={selectClass}>
            <option value="">All levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Tag</span>
          <select value={values.tag} onChange={(e) => onChange({ tag: e.target.value })} className={selectClass}>
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasFilters && (
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <HiX /> Clear filters
        </button>
      )}
    </div>
  );
}
