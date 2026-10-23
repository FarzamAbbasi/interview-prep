import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineLockClosed } from 'react-icons/hi';
import api, { getErrorMessage } from '../api/axios';
import useAuth from '../hooks/useAuth';
import LanguageIcon from '../components/languages/LanguageIcon';
import QuestionFilters from '../components/questions/QuestionFilters';
import QuestionCard, { QuestionCardSkeleton } from '../components/questions/QuestionCard';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';
import PageLoader from '../components/ui/PageLoader';
import usePageTitle from '../hooks/usePageTitle';

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 400; // wait until the user stops typing

/**
 * /languages/:slug — Q&A of one language.
 * Filters live in the URL (?topic=oop&difficulty=easy&tag=&search=&page=2) so links can be shared.
 */
export default function QuestionsPage() {
  const { slug } = useParams();
  const { user, hasFullAccess } = useAuth();
  const [params, setParams] = useSearchParams();

  const filters = {
    topic: params.get('topic') || '',
    difficulty: params.get('difficulty') || '',
    tag: params.get('tag') || '',
    search: params.get('search') || '',
    page: Math.max(1, Number(params.get('page')) || 1),
  };

  // What is typed in the search box (sent to the URL after a short pause)
  const [searchInput, setSearchInput] = useState(filters.search);

  // ---- language (name, topics with counts) ----
  const [langState, setLangState] = useState({ slug: null, language: null, error: '' });
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/languages/${slug}`)
      .then(({ data }) => !cancelled && setLangState({ slug, language: data.data.language, error: '' }))
      .catch((err) => !cancelled && setLangState({ slug, language: null, error: getErrorMessage(err), notFound: err.response?.status === 404 }));
    return () => {
      cancelled = true;
    };
  }, [slug]);
  const language = langState.slug === slug ? langState.language : null;
  const langLoading = langState.slug !== slug;
  usePageTitle(language ? `${language.name} interview questions` : 'Questions');

  // ---- tags for the current topic ----
  const [tagState, setTagState] = useState({ key: '', tags: [] });
  const tagKey = `${slug}|${filters.topic}`;
  useEffect(() => {
    let cancelled = false;
    api
      .get('/questions/tags', { params: { language: slug, topic: filters.topic || undefined } })
      .then(({ data }) => !cancelled && setTagState({ key: tagKey, tags: data.data.tags }))
      .catch(() => !cancelled && setTagState({ key: tagKey, tags: [] }));
    return () => {
      cancelled = true;
    };
  }, [slug, filters.topic, tagKey]);

  // ---- questions (reload when filters, page or login change) ----
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = JSON.stringify([slug, filters, user?._id, hasFullAccess, reloadCount]);
  const [result, setResult] = useState({ key: '', data: null, error: '' });
  useEffect(() => {
    let cancelled = false;
    const { topic, difficulty, tag, search, page } = JSON.parse(requestKey)[1];
    api
      .get('/questions', {
        params: {
          language: slug,
          topic: topic || undefined,
          difficulty: difficulty || undefined,
          tag: tag || undefined,
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
        },
      })
      .then(({ data }) => !cancelled && setResult({ key: requestKey, data: data.data, error: '' }))
      .catch((err) => !cancelled && setResult({ key: requestKey, data: null, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [slug, requestKey]);
  const loading = result.key !== requestKey;

  // ---- update the URL (page goes back to 1 when a filter changes) ----
  const setFilters = (changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (resetPage) next.delete('page');
    setParams(next, { replace: !('page' in changes) });
  };

  // Debounced search: copy the typed text to the URL after a pause
  useEffect(() => {
    if (searchInput.trim() === filters.search) return undefined;
    const timer = setTimeout(() => setFilters({ search: searchInput.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const handleFilterChange = (changes) => {
    if ('search' in changes) {
      setSearchInput(changes.search);
      return;
    }
    setFilters(changes);
  };

  const clearFilters = () => {
    setSearchInput('');
    setParams(new URLSearchParams(), { replace: true });
  };

  const goToPage = (page) => {
    setFilters({ page: page > 1 ? String(page) : '' }, { resetPage: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- bookmarks (paid users) ----
  const [bookmarkOverrides, setBookmarkOverrides] = useState({}); // id -> true/false after a click
  const [busyId, setBusyId] = useState(null);
  const toggleBookmark = async (question) => {
    if (!hasFullAccess) {
      toast('Bookmarks are part of full access', { icon: '🔒' });
      return;
    }
    const current = bookmarkOverrides[question._id] ?? question.isBookmarked;
    setBusyId(question._id);
    setBookmarkOverrides((o) => ({ ...o, [question._id]: !current })); // show the change right away
    try {
      const { data } = await api.post(`/bookmarks/${question._id}`);
      setBookmarkOverrides((o) => ({ ...o, [question._id]: data.data.bookmarked }));
      toast.success(data.message);
    } catch (err) {
      setBookmarkOverrides((o) => ({ ...o, [question._id]: current })); // undo
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const topicName = useMemo(() => {
    const map = new Map((language?.topics || []).map((t) => [t.slug, t.name]));
    return (slugValue) => map.get(slugValue) || '';
  }, [language]);

  // ---- render ----
  if (langLoading) return <PageLoader />;
  if (!language) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{langState.notFound ? 'Language not found' : 'Could not load this page'}</h1>
        <p className="mt-2 text-slate-500">{langState.notFound ? 'It may have been removed.' : langState.error}</p>
        <Link to="/languages" className="mt-6 inline-block font-semibold text-brand-600 hover:underline">
          See all languages
        </Link>
      </div>
    );
  }

  const data = loading ? null : result.data;
  const questions = data?.questions || [];
  const pagination = data?.pagination;
  const lockedCount = questions.filter((q) => q.isLocked).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <LanguageIcon icon={language.icon} name={language.name} />
        <div>
          <p className="text-sm text-slate-500">
            <Link to="/languages" className="hover:underline">
              Languages
            </Link>{' '}
            / {language.name}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{language.name} interview questions</h1>
          <p className="mt-1 text-sm text-slate-600">
            {language.qaCount} questions · {language.freeQaCount} free
            {hasFullAccess && ' · full access'}
          </p>
        </div>
      </div>

      <QuestionFilters
        topics={language.topics || []}
        totalQa={language.qaCount}
        tags={tagState.key === tagKey ? tagState.tags : []}
        values={{ ...filters, search: searchInput }}
        onChange={handleFilterChange}
        onClear={clearFilters}
      />

      {/* Upgrade banner for users without full access */}
      {!hasFullAccess && lockedCount > 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-amber-800">
            <HiOutlineLockClosed className="shrink-0" />
            {user ? 'Unlock every answer with full access.' : 'Free answers are open. Create an account and get full access to unlock the rest.'}
          </p>
          <Link
            to={user ? '/pricing' : '/register'}
            className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
          >
            {user ? 'Get full access' : 'Create free account'}
          </Link>
        </div>
      )}

      {/* List */}
      <div className="mt-6 space-y-4">
        {loading &&
          [1, 2, 3, 4].map((n) => <QuestionCardSkeleton key={n} />)}

        {!loading && result.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{result.error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => setReloadCount((n) => n + 1)}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !result.error && !questions.length && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">No questions match these filters.</p>
            <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-brand-600 hover:underline">
              Clear filters
            </button>
          </div>
        )}

        {!loading &&
          questions.map((q, i) => (
            <QuestionCard
              key={q._id}
              question={q}
              number={(pagination.page - 1) * pagination.limit + i + 1}
              topicName={filters.topic ? '' : topicName(q.topic)}
              showBookmark={Boolean(user)}
              bookmarked={bookmarkOverrides[q._id] ?? Boolean(q.isBookmarked)}
              bookmarkBusy={busyId === q._id}
              onBookmark={() => toggleBookmark(q)}
            />
          ))}
      </div>

      {!loading && pagination && (
        <>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={goToPage} />
          {pagination.total > 0 && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
          )}
        </>
      )}
    </div>
  );
}
