import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { HiPlus, HiOutlineSearch } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import QuestionForm from '../../components/admin/QuestionForm';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PageLoader from '../../components/ui/PageLoader';
import usePageTitle from '../../hooks/usePageTitle';

const SEARCH_DELAY_MS = 400;
const selectClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';
const emptyFilters = { language: '', topic: '', type: '', difficulty: '', isActive: '', isFree: '', search: '', page: 1 };

const difficultyStyle = { easy: 'bg-green-50 text-green-700', medium: 'bg-amber-50 text-amber-700', hard: 'bg-red-50 text-red-700' };

/**
 * /admin/questions — table of all questions (incl. MCQs and inactive) with filters,
 * one form for Q&A and MCQ, quick free/active toggles and delete.
 */
export default function AdminQuestionsPage() {
  usePageTitle('Admin · Questions');
  // Languages (with topics) for filters and the form
  const [langState, setLangState] = useState({ loaded: false, languages: [], error: '' });
  useEffect(() => {
    let cancelled = false;
    api
      .get('/languages', { params: { all: true } })
      .then(({ data }) => !cancelled && setLangState({ loaded: true, languages: data.data.languages, error: '' }))
      .catch((err) => !cancelled && setLangState({ loaded: true, languages: [], error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, []);
  const languages = langState.languages;

  const [filters, setFilters] = useState(emptyFilters);
  const [searchInput, setSearchInput] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = JSON.stringify([filters, reloadCount]);
  const [result, setResult] = useState({ key: '', data: null, error: '' });
  const [editing, setEditing] = useState(null); // null | 'new' | question
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (searchInput.trim() === filters.search) return undefined;
    const timer = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput.trim(), page: 1 })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  useEffect(() => {
    let cancelled = false;
    const [f] = JSON.parse(requestKey);
    const params = { page: f.page, limit: 20 };
    ['language', 'topic', 'type', 'difficulty', 'isActive', 'isFree', 'search'].forEach((k) => {
      if (f[k]) params[k] = f[k];
    });
    api
      .get('/admin/questions', { params })
      .then(({ data }) => !cancelled && setResult({ key: requestKey, data: data.data, error: '' }))
      .catch((err) => !cancelled && setResult({ key: requestKey, data: null, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const loading = result.key !== requestKey;
  const reload = () => setReloadCount((n) => n + 1);
  const setFilter = (changes) => setFilters((f) => ({ ...f, ...changes, page: 1 }));

  const topicsOf = useMemo(() => {
    const map = new Map(languages.map((l) => [l._id, l.topics || []]));
    return (languageId) => map.get(languageId) || [];
  }, [languages]);
  const topicName = (q) => topicsOf(q.language?._id).find((t) => t.slug === q.topic)?.name || q.topic;

  const save = async (body) => {
    try {
      const { data } =
        editing === 'new' ? await api.post('/admin/questions', body) : await api.put(`/admin/questions/${editing._id}`, body);
      toast.success(data.message);
      setEditing(null);
      reload();
    } catch (err) {
      throw getErrorMessage(err);
    }
  };

  const quickUpdate = async (q, changes, message) => {
    setBusy(q._id);
    try {
      await api.put(`/admin/questions/${q._id}`, changes);
      toast.success(message);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const q = toDelete;
    setToDelete(null);
    setBusy(q._id);
    try {
      const { data } = await api.delete(`/admin/questions/${q._id}`);
      toast.success(data.message);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 6000 });
    } finally {
      setBusy(null);
    }
  };

  if (!langState.loaded) return <PageLoader />;

  // ---- Add / edit screen ----
  if (editing) {
    return (
      <div className="max-w-3xl">
        <h1 className="mb-5 text-2xl font-bold text-slate-900">{editing === 'new' ? 'Add question' : 'Edit question'}</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          {languages.length ? (
            <QuestionForm
              initial={editing === 'new' ? null : editing}
              languages={languages}
              defaultLanguageId={filters.language}
              onSubmit={save}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <p className="text-sm text-slate-600">Add a language first (Admin → Languages).</p>
          )}
        </div>
      </div>
    );
  }

  const questions = result.data?.questions || [];
  const pagination = result.data?.pagination;
  const filterTopics = topicsOf(filters.language);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Questions</h1>
          <p className="mt-1 text-sm text-slate-600">All Q&amp;A and quiz MCQs, including inactive ones.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <HiPlus /> Add question
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="relative block">
          <span className="sr-only">Search questions</span>
          <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search question text or tags"
            maxLength={100}
            className={`${selectClass} py-2.5 pl-9`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <select aria-label="Language" value={filters.language} onChange={(e) => setFilter({ language: e.target.value, topic: '' })} className={selectClass}>
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>
          <select aria-label="Topic" value={filters.topic} onChange={(e) => setFilter({ topic: e.target.value })} className={selectClass} disabled={!filterTopics.length}>
            <option value="">All topics</option>
            {filterTopics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          <select aria-label="Type" value={filters.type} onChange={(e) => setFilter({ type: e.target.value })} className={selectClass}>
            <option value="">Q&amp;A + MCQ</option>
            <option value="qa">Q&amp;A only</option>
            <option value="mcq">MCQ only</option>
          </select>
          <select aria-label="Difficulty" value={filters.difficulty} onChange={(e) => setFilter({ difficulty: e.target.value })} className={selectClass}>
            <option value="">All levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select aria-label="Status" value={filters.isActive} onChange={(e) => setFilter({ isActive: e.target.value })} className={selectClass}>
            <option value="">Active + inactive</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        {(JSON.stringify({ ...filters, page: 1 }) !== JSON.stringify(emptyFilters) || searchInput) && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              setFilters(emptyFilters);
            }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {result.error && !loading && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{result.error}</p>
          <Button variant="secondary" className="mt-4" onClick={reload}>
            Try again
          </Button>
        </div>
      )}

      {!result.error && (
        <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
          {loading && !result.data && <p className="p-6 text-center text-sm text-slate-500">Loading questions...</p>}
          {!loading && !questions.length && <p className="p-8 text-center text-sm text-slate-500">No questions match these filters.</p>}
          <ul className="divide-y divide-slate-200">
            {questions.map((q) => (
              <li key={q._id} className={`flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-start ${q.isActive ? '' : 'bg-slate-50'}`}>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium text-slate-900">{q.question}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${q.type === 'mcq' ? 'bg-purple-50 text-purple-700' : 'bg-brand-50 text-brand-700'}`}>
                      {q.type === 'mcq' ? 'MCQ' : 'Q&A'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${difficultyStyle[q.difficulty]}`}>{q.difficulty}</span>
                    <span className="text-slate-500">
                      {q.language?.name}
                      {q.topic ? ` · ${topicName(q)}` : ''}
                    </span>
                    {!q.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600">Inactive</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={Boolean(busy)} onClick={() => setEditing(q)}>
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    loading={busy === q._id}
                    disabled={Boolean(busy)}
                    onClick={() => quickUpdate(q, { isActive: !q.isActive }, q.isActive ? 'Question hidden' : 'Question is live')}
                  >
                    {q.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button variant="secondary" className="px-3 py-1.5 text-xs text-red-600" disabled={Boolean(busy)} onClick={() => setToDelete(q)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pagination && (
        <>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
          <p className="mt-3 text-center text-xs text-slate-500">{pagination.total} questions</p>
        </>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this question?"
        text={
          toDelete?.type === 'mcq'
            ? 'If this MCQ was used in any quiz, it cannot be deleted (old results need it). Deactivate it instead.'
            : 'This cannot be undone. It is also removed from users’ bookmarks.'
        }
        confirmText="Delete"
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}
