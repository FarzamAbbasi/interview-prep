import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineLockClosed, HiOutlineSearch, HiCheck, HiOutlineViewList, HiOutlineCollection } from 'react-icons/hi';
import api, { getErrorMessage } from '../api/axios';
import useAuth from '../hooks/useAuth';
import QuestionRow, { QuestionRowSkeleton } from '../components/questions/QuestionRow';
import FlashcardView from '../components/questions/FlashcardView';
import DifficultyBar, { ProgressBar, DifficultyLegend } from '../components/languages/DifficultyBar';
import TopicStrip from '../components/languages/TopicStrip';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';
import PageLoader from '../components/ui/PageLoader';
import UpgradeModal from '../components/ui/UpgradeModal';
import usePageTitle from '../hooks/usePageTitle';

const PAGE_SIZE = 50; // a topic fits on one page
const SEARCH_DELAY_MS = 400; // wait until the user stops typing

const fieldClass =
  'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

// "35%" ring next to the language name (logged-in users)
function ProgressRing({ done, total }) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const r = 15;
  const length = 2 * Math.PI * r;
  return (
    <div className="flex shrink-0 items-center gap-2.5 text-sm text-slate-500">
      <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90" aria-hidden="true">
        <circle cx="19" cy="19" r={r} fill="none" stroke="var(--color-slate-200)" strokeWidth="5" />
        <circle
          cx="19"
          cy="19"
          r={r}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <p className="leading-tight">
        <b className="block text-lg text-slate-900">{pct}%</b>
        {done} of {total} done
      </p>
    </div>
  );
}

// One topic card: name, counts, difficulty mix, progress (IPP-1602)
function TopicCard({ topic, selected, loggedIn, hasFullAccess, onSelect }) {
  const visible = hasFullAccess ? topic.qaCount : topic.freeQaCount;
  const done = topic.doneCount || 0;
  const complete = loggedIn && visible > 0 && done >= visible;
  const locked = visible === 0 && topic.qaCount > 0;

  let note;
  if (locked) note = 'Full access';
  else note = `${topic.qaCount} ${topic.qaCount === 1 ? 'question' : 'questions'}`;
  if (loggedIn && !locked) note += complete ? ' · all done' : ` · ${done} done`;

  // IPP-1604: compact card (one line name, counts, bars) for the one-row strip
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={topic.name}
      className={`relative flex w-[72%] shrink-0 snap-start flex-col rounded-xl border bg-white px-3.5 py-3 text-left transition sm:w-[calc((100%-24px)/3)] lg:w-[calc((100%-36px)/4)] xl:w-[calc((100%-48px)/5)] ${
        selected ? 'border-brand-600 ring-1 ring-inset ring-brand-600' : 'border-slate-200 hover:border-slate-400'
      } ${locked ? 'bg-slate-50' : ''}`}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">{topic.name}</span>
        {complete && (
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <HiCheck size={11} />
          </span>
        )}
      </span>
      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
        {locked && <HiOutlineLockClosed />} {note}
      </span>
      <DifficultyBar difficulty={topic.difficulty} className="mt-2.5" />
      {loggedIn && !locked && <ProgressBar done={done} total={visible} className="mt-1" />}
    </button>
  );
}

/**
 * /languages/:slug — topic roadmap (IPP-1602): topic cards with difficulty mix and progress,
 * then the questions of the chosen topic. Filters live in the URL (?topic=oop&difficulty=easy&search=&page=2).
 * Without full access only the free questions come from the server (IPP-1501).
 */
export default function QuestionsPage() {
  const { slug } = useParams();
  const { user, canAccess, accessKey } = useAuth();
  const [params, setParams] = useSearchParams();

  const filters = {
    view: params.get('view') === 'cards' ? 'cards' : 'list', // IPP-1603: list or one by one
    topic: params.get('topic') || '',
    difficulty: params.get('difficulty') || '',
    search: params.get('search') || '',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
  const [searchInput, setSearchInput] = useState(filters.search);

  // ---- language (topics with counts + done counts); refreshed after "done" changes ----
  const [langReload, setLangReload] = useState(0);
  const [langState, setLangState] = useState({ slug: null, language: null, error: '' });
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/languages/${slug}`)
      .then(({ data }) => !cancelled && setLangState({ slug, language: data.data.language, error: '' }))
      .catch(
        (err) =>
          !cancelled &&
          setLangState((s) =>
            s.slug === slug && s.language ? s : { slug, language: null, error: getErrorMessage(err), notFound: err.response?.status === 404 }
          )
      );
    return () => {
      cancelled = true;
    };
  }, [slug, langReload, user?._id, accessKey]);
  const language = langState.slug === slug ? langState.language : null;
  // IPP-1704: "full access" on this page = this language is unlocked (all languages, or picked by the admin)
  const hasFullAccess = Boolean(language && (canAccess(language._id)));
  const langLoading = langState.slug !== slug;
  usePageTitle(language ? `${language.name} interview questions` : 'Questions');

  const topics = useMemo(() => language?.topics || [], [language]);
  const visibleOf = useCallback((t) => (hasFullAccess ? t.qaCount : t.freeQaCount), [hasFullAccess]);

  // Chosen topic: from the URL, else the first one the user has not finished, else the first with questions
  const defaultTopic = useMemo(() => {
    if (!topics.length) return '';
    const open = topics.find((t) => visibleOf(t) > 0 && (t.doneCount || 0) < visibleOf(t));
    return (open || topics.find((t) => visibleOf(t) > 0) || topics[0]).slug;
    // only pick once per language load, not after every "done" click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, topics.length, hasFullAccess]);
  const topicSlug = filters.topic || defaultTopic;
  const topic = topics.find((t) => t.slug === topicSlug) || null;

  // ---- questions of the chosen topic ----
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = JSON.stringify([slug, topicSlug, filters.difficulty, filters.search, filters.page, user?._id, hasFullAccess, reloadCount]);
  const [result, setResult] = useState({ key: '', data: null, error: '' });
  useEffect(() => {
    if (langLoading) return undefined;
    let cancelled = false;
    const [, topicValue, difficulty, search, page] = JSON.parse(requestKey);
    api
      .get('/questions', {
        params: {
          language: slug,
          topic: topicValue || undefined,
          difficulty: difficulty || undefined,
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
  }, [slug, requestKey, langLoading]);
  const loading = result.key !== requestKey;

  // ---- URL updates (page goes back to 1 when a filter changes) ----
  const setFilters = (changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (resetPage) next.delete('page');
    setParams(next, { replace: !('page' in changes) && !('topic' in changes) });
  };

  useEffect(() => {
    if (searchInput.trim() === filters.search) return undefined;
    const timer = setTimeout(() => setFilters({ search: searchInput.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const chooseTopic = (value) => {
    setSearchInput('');
    setExpanded(null);
    setFilters({ topic: value, search: '', difficulty: '' });
  };

  const goToPage = (page) => {
    setFilters({ page: page > 1 ? String(page) : '' }, { resetPage: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- open answer, "done", bookmarks ----
  const [expanded, setExpanded] = useState(null);
  const [doneOverrides, setDoneOverrides] = useState({}); // id -> true / false after a click
  const [doneBusy, setDoneBusy] = useState(null);
  const isDone = (q) => doneOverrides[q._id] ?? Boolean(q.isDone);
  const setDone = async (q, value) => {
    const current = isDone(q);
    if (current === value) return;
    setDoneBusy(q._id);
    setDoneOverrides((o) => ({ ...o, [q._id]: value })); // show it right away
    try {
      await api.put(`/progress/${q._id}`, { done: value });
      setLangReload((n) => n + 1); // new counts for the ring and topic cards
    } catch (err) {
      setDoneOverrides((o) => ({ ...o, [q._id]: current }));
      toast.error(getErrorMessage(err));
    } finally {
      setDoneBusy(null);
    }
  };
  const toggleDone = (q) => setDone(q, !isDone(q));

  const [bookmarkOverrides, setBookmarkOverrides] = useState({});
  const [bookmarkBusy, setBookmarkBusy] = useState(null);
  const toggleBookmark = async (q) => {
    const current = bookmarkOverrides[q._id] ?? Boolean(q.isBookmarked);
    setBookmarkBusy(q._id);
    setBookmarkOverrides((o) => ({ ...o, [q._id]: !current }));
    try {
      const { data } = await api.post(`/bookmarks/${q._id}`);
      setBookmarkOverrides((o) => ({ ...o, [q._id]: data.data.bookmarked }));
      toast.success(data.message);
    } catch (err) {
      setBookmarkOverrides((o) => ({ ...o, [q._id]: current }));
      toast.error(getErrorMessage(err));
    } finally {
      setBookmarkBusy(null);
    }
  };

  const openNext = (id) => {
    setExpanded(id);
    setTimeout(() => document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  // ---- IPP-1501: popup when a user without full access scrolls past the free questions ----
  const endRef = useRef(null);
  const popupShown = useRef(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const hiddenCount = !loading ? result.data?.hiddenCount || 0 : 0;
  const showEnd = !hasFullAccess && hiddenCount > 0;
  const listView = filters.view !== 'cards';
  useEffect(() => {
    // One by one mode scrolls by itself (IPP-1606), so the popup only follows scrolling in the list view
    if (!showEnd || !listView) return undefined;
    const check = () => {
      const node = endRef.current;
      if (!node || popupShown.current || window.scrollY < 50) return;
      if (node.getBoundingClientRect().top < window.innerHeight * 0.85) {
        popupShown.current = true; // once per visit of this page
        setUpgradeOpen(true);
      }
    };
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [showEnd, listView]);

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
  const onLastPage = pagination && pagination.page >= pagination.totalPages;
  const languageVisible = hasFullAccess ? language.qaCount : language.freeQaCount;
  const topicVisible = topic ? visibleOf(topic) : 0;
  const topicComplete = user && hasFullAccess && topic && topicVisible > 0 && (topic.doneCount || 0) >= topicVisible;
  const listTitle = topic ? topic.name : 'All questions';
  const quizLink = hasFullAccess
    ? `/quiz?language=${language.slug}${topic ? `&topic=${topic.slug}` : ''}`
    : `/quiz?language=${language.slug}`;

  return (
    <div>
      {/* Header */}
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link to="/languages" className="hover:text-slate-900 hover:underline">
          Languages
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-slate-700">{language.name}</span>
      </nav>
      <div className="mb-4 mt-1.5 flex items-center justify-between gap-4 sm:gap-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.03em] text-slate-900 sm:text-4xl">{language.name}</h1>
          <p className="mt-1 line-clamp-1 max-w-[80ch] text-[15px] text-slate-600" title={language.description || undefined}>
            {language.description || 'Work through it topic by topic.'}
          </p>
        </div>
        {user ? (
          <ProgressRing done={language.doneCount || 0} total={languageVisible} />
        ) : (
          <Link to="/register" className="shrink-0 text-sm font-semibold text-brand-600 hover:underline">
            Sign up to track progress
          </Link>
        )}
      </div>


      {/* Topic cards */}
      {topics.length > 0 && (
        <>
          <TopicStrip selectedKey={topicSlug} legend={<DifficultyLegend withProgress={Boolean(user)} />}>
            {topics.map((t) => (
              <TopicCard
                key={t.slug}
                topic={t}
                selected={t.slug === topicSlug}
                loggedIn={Boolean(user)}
                hasFullAccess={hasFullAccess}
                onSelect={() => chooseTopic(t.slug)}
              />
            ))}
          </TopicStrip>
          <div className="mb-6" />
        </>
      )}

      {/* Topic finished */}
      {topicComplete && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border-2 border-brand-600 bg-white p-5 sm:flex-row sm:items-center">
          <span className="text-3xl" aria-hidden="true">
            🎉
          </span>
          <p className="flex-1 text-sm text-slate-600">
            <b className="block text-[17px] text-slate-900">{topic.name} done</b>
            You have read all {topicVisible} questions. Check yourself with a timed quiz on this topic.
          </p>
          <Link to={quizLink} className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700">
            Quiz this topic
          </Link>
        </div>
      )}

      {/* List toolbar */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <h2 className="mr-auto text-xl font-bold tracking-tight text-slate-900 sm:text-[22px]">{listTitle}</h2>
        {user && !topicComplete && (
          <Link
            to={quizLink}
            className="order-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 sm:order-3"
          >
            {hasFullAccess ? (
              <>
                <span className="sm:hidden">Quiz</span>
                <span className="hidden sm:inline">Quiz this topic</span>
              </>
            ) : (
              'Sample quiz'
            )}
          </Link>
        )}
        <div className="order-1 flex rounded-lg border border-slate-200 bg-white p-0.5 sm:order-0" role="group" aria-label="View">
          {[
            { value: 'list', label: 'List', icon: HiOutlineViewList },
            { value: 'cards', label: 'One by one', icon: HiOutlineCollection },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.view === value}
              aria-label={label}
              title={label}
              onClick={() => {
                setExpanded(null);
                setFilters({ view: value === 'cards' ? 'cards' : '' }, { resetPage: false });
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors ${
                filters.view === value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon size={16} /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <label className={`relative order-3 w-full sm:order-1 sm:w-64 ${filters.view === 'cards' ? 'hidden' : ''}`}>
          <span className="sr-only">Search in this topic</span>
          <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={topic ? 'Search in this topic' : 'Search questions'}
            maxLength={100}
            className={`${fieldClass} w-full pl-9`}
          />
        </label>
        <label className={`order-4 hidden sm:order-2 ${filters.view === 'cards' ? '' : 'sm:block'}`}>
          <span className="sr-only">Difficulty</span>
          <select value={filters.difficulty} onChange={(e) => setFilters({ difficulty: e.target.value })} className={fieldClass}>
            <option value="">All levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>

      {/* Questions */}
      <div className="space-y-2">
        {loading && [1, 2, 3].map((n) => <QuestionRowSkeleton key={n} />)}

        {!loading && result.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{result.error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => setReloadCount((n) => n + 1)}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !result.error && !questions.length && !showEnd && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">{filters.search || filters.difficulty ? 'No questions match these filters.' : 'No questions in this topic yet.'}</p>
            {(filters.search || filters.difficulty) && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setFilters({ search: '', difficulty: '' });
                }}
                className="mt-3 text-sm font-semibold text-brand-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!loading && filters.view === 'cards' && questions.length > 0 && (
          <FlashcardView
            key={requestKey}
            questions={questions}
            isDone={isDone}
            onSetDone={(q, value) => (user ? setDone(q, value) : undefined)}
            loggedIn={Boolean(user)}
            total={pagination?.total || questions.length}
          />
        )}

        {!loading &&
          filters.view === 'list' &&
          questions.map((q, i) => {
            const next = questions[i + 1];
            return (
              <QuestionRow
                key={q._id}
                question={q}
                open={expanded === q._id}
                onToggle={() => setExpanded((id) => (id === q._id ? null : q._id))}
                done={isDone(q)}
                onDone={user ? () => toggleDone(q) : undefined}
                doneBusy={doneBusy === q._id}
                bookmarked={bookmarkOverrides[q._id] ?? Boolean(q.isBookmarked)}
                onBookmark={hasFullAccess ? () => toggleBookmark(q) : undefined}
                bookmarkBusy={bookmarkBusy === q._id}
                onNext={next ? () => openNext(next._id) : undefined}
              />
            );
          })}
      </div>

      {/* IPP-1501: end of the free questions (paid ones are not sent to the browser at all) */}
      {!loading && showEnd && onLastPage && (
        <div
          ref={endRef}
          className="mt-4 flex flex-col gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div className="flex items-start gap-3">
            <HiOutlineLockClosed className="mt-1 shrink-0 text-slate-500" size={20} />
            <div>
              <p className="font-semibold text-slate-900">
                {hiddenCount} more {topic ? topic.name : language.name} {hiddenCount === 1 ? 'question' : 'questions'} with full access
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                {questions.length ? "You've reached the end of the free questions" : 'This only has questions in full access'}.
                {user ? ' Unlock every answer, full quizzes and bookmarks.' : ' Create a free account, then get full access.'}
              </p>
            </div>
          </div>
          <Link
            to={user ? '/pricing' : '/register'}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
          >
            {user ? 'Get full access' : 'Create free account'}
          </Link>
        </div>
      )}

      <UpgradeModal
        open={upgradeOpen}
        isGuest={!user}
        onClose={() => setUpgradeOpen(false)}
        title={`That's all the free ${language.name} questions here`}
        text={`${hiddenCount} more ${hiddenCount === 1 ? 'question' : 'questions'} with answers and code are part of full access, along with full quizzes and bookmarks.${
          user ? ' It is a one-time payment, no subscription.' : ' Create a free account first, then request full access.'
        }`}
      />

      {!loading && pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={goToPage} />}
    </div>
  );
}
