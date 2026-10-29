import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HiOutlineSearch, HiOutlineLockClosed, HiOutlineCode, HiCheckCircle, HiArrowRight } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import PageLoader from '../../components/ui/PageLoader';
import TopicStrip from '../../components/languages/TopicStrip';
import DifficultyBar, { DifficultyLegend, ProgressBar } from '../../components/languages/DifficultyBar';
import DifficultyTag from '../../components/practice/DifficultyTag';

const LEVELS = ['easy', 'medium', 'hard'];
const ALL = 'all';

/**
 * /practice and /practice/:language   (IPP-1716, public)
 * Coding problems of one language: topic cards, difficulty filter, search, and the list.
 * Locked problems show a lock and lead to /pricing. Logged-in users see solved / attempted and a Continue card (IPP-1718).
 */
export default function PracticeListPage() {
  const { language: languageSlug = 'javascript' } = useParams();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0); // bump to load again
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const [topicPick, setTopicPick] = useState({ language: languageSlug, slug: ALL });
  const [level, setLevel] = useState(ALL);
  const [status, setStatus] = useState(ALL); // IPP-1718: all | solved | attempted | todo
  const [search, setSearch] = useState('');

  // Load again when the language or the login changes (a paid login unlocks problems)
  const key = `${languageSlug}|${user?._id || ''}|${attempt}`;
  useEffect(() => {
    let cancelled = false;
    api
      .get('/problems', { params: { language: languageSlug } })
      .then(({ data: res }) => !cancelled && setResult({ key, data: res.data, error: '' }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({ key, data: null, error: getErrorMessage(err), notFound: err.response?.status === 404 })
      );
    return () => {
      cancelled = true;
    };
  }, [key, languageSlug]);

  const loading = result.key !== key;
  const data = loading ? null : result.data;
  const error = loading ? '' : result.error;
  const notFound = !loading && result.notFound;
  const reload = () => setAttempt((n) => n + 1);

  // The chosen topic belongs to one language; another language starts at "All topics"
  const topic = topicPick.language === languageSlug ? topicPick.slug : ALL;
  const setTopic = (slug) => setTopicPick({ language: languageSlug, slug });

  usePageTitle(data ? `${data.language.name} practice` : 'Practice');

  const problems = useMemo(() => data?.problems || [], [data]);

  const counts = useMemo(() => {
    const c = { easy: 0, medium: 0, hard: 0 };
    problems.forEach((p) => {
      c[p.difficulty] += 1;
    });
    return c;
  }, [problems]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return problems.filter(
      (p) =>
        (topic === ALL || p.topicSlug === topic) &&
        (level === ALL || p.difficulty === level) &&
        (status === ALL || (status === 'todo' ? !p.status : p.status === status)) &&
        (!term || p.title.toLowerCase().includes(term))
    );
  }, [problems, topic, level, status, search]);

  const lockedCount = problems.filter((p) => p.isLocked).length;

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-slate-600">{notFound ? 'There are no coding problems for this language.' : error}</p>
        {notFound ? (
          <Link
            to="/practice"
            className="mt-4 inline-block rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Go to JavaScript practice
          </Link>
        ) : (
          <button
            type="button"
            onClick={reload}
            className="mt-4 rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
        )}
      </div>
    );
  }
  if (!data) return <PageLoader text="Loading problems..." />;

  const chip = (active) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:border-brand-600'
    }`;

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between sm:pt-6">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand-600">
            Practice · {data.language.name}
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Coding problems</h1>
          <p className="mt-3 max-w-xl text-slate-600">
            Write code in the browser, run the tests and see exactly where it fails.
          </p>
        </div>
        {problems.length > 0 && (
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Search problems</span>
            <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problems"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        )}
      </div>

      {problems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <HiOutlineCode className="mx-auto text-slate-400" size={32} />
          <p className="mt-3 font-medium text-slate-900">No problems for {data.language.name} yet</p>
          <p className="mt-1 text-sm text-slate-500">New problems are added regularly. Check back soon.</p>
        </div>
      ) : (
        <>
          {/* IPP-1718: Continue where you left */}
          {data.continue && (
            <Link
              to={`/practice/${data.language.slug}/${data.continue.slug}`}
              className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 p-5 transition-colors hover:border-brand-600"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                  {data.continue.kind === 'attempted' ? 'Continue where you left' : 'Start here'}
                </p>
                <p className="mt-1 truncate text-lg font-semibold text-slate-900">{data.continue.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <DifficultyTag difficulty={data.continue.difficulty} />
                  {data.continue.topic}
                  {data.continue.submits > 0 && ` · ${data.continue.submits} submit${data.continue.submits === 1 ? '' : 's'}`}
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
                {data.continue.kind === 'attempted' ? 'Continue' : 'Start'} <HiArrowRight />
              </span>
            </Link>
          )}

          {/* Summary */}
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-slate-900">
                {data.solved ? `${data.solved.total} / ${problems.length} solved` : `${problems.length} problems`}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {data.solved
                    ? `easy ${data.solved.easy}/${counts.easy} · medium ${data.solved.medium}/${counts.medium} · hard ${data.solved.hard}/${counts.hard}`
                    : `${counts.easy} easy · ${counts.medium} medium · ${counts.hard} hard`}
                </span>
              </p>
              {!data.hasAccess && lockedCount > 0 && (
                <p className="text-sm text-slate-500">
                  {problems.length - lockedCount} free · {lockedCount} with full access
                </p>
              )}
            </div>
            <DifficultyBar difficulty={counts} className="mt-3" />
            {data.solved && <ProgressBar done={data.solved.total} total={problems.length} className="mt-2" />}
          </div>

          {/* Topics */}
          <TopicStrip selectedKey={topic} legend={<DifficultyLegend />}>
            {[{ slug: ALL, name: 'All topics', total: problems.length, free: problems.length - lockedCount, solved: data.solved?.total || 0 }, ...data.topics].map((t) => {
              const active = topic === t.slug;
              const allLocked = !data.hasAccess && t.slug !== ALL && t.free === 0;
              return (
                <button
                  key={t.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTopic(t.slug)}
                  className={`w-44 shrink-0 rounded-xl border p-3 text-left transition-colors ${
                    active ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-600'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium text-slate-900">
                    {t.name}
                    {allLocked && <HiOutlineLockClosed className="text-slate-400" aria-label="Full access" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {data.solved ? `${t.solved} / ${t.total} solved` : `${t.total} problem${t.total === 1 ? '' : 's'}`}
                    {!data.hasAccess && t.slug !== ALL && (t.free === t.total ? ' · free' : t.free ? ` · ${t.free} free` : '')}
                  </span>
                  {data.solved && <ProgressBar done={t.solved} total={t.total} className="mt-2" />}
                </button>
              );
            })}
          </TopicStrip>

          {/* Difficulty filter */}
          <div className="mb-3 mt-6 flex flex-wrap items-center gap-2">
            {[ALL, ...LEVELS].map((l) => (
              <button key={l} type="button" onClick={() => setLevel(l)} className={chip(level === l)}>
                {l === ALL ? 'All levels' : l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
            {data.solved && (
              <label className="ml-1 text-sm">
                <span className="sr-only">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-600"
                >
                  <option value={ALL}>Any status</option>
                  <option value="solved">Solved</option>
                  <option value="attempted">Attempted</option>
                  <option value="todo">Not started</option>
                </select>
              </label>
            )}
            <span className="ml-auto text-xs text-slate-500">
              Showing {shown.length} of {problems.length}
            </span>
          </div>

          {/* List */}
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No problem matches these filters.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {shown.map((p, i) => (
                <li key={p._id} className={i ? 'border-t border-slate-100' : ''}>
                  <Link
                    to={p.isLocked ? '/pricing' : `/practice/${data.language.slug}/${p.slug}`}
                    className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 ${p.isLocked ? 'text-slate-400' : ''}`}
                  >
                    <span className="w-5 shrink-0 text-center" aria-hidden="true">
                      {p.isLocked ? (
                        <HiOutlineLockClosed className="inline text-slate-400" />
                      ) : p.status === 'solved' ? (
                        <HiCheckCircle className="inline text-green-600" size={18} title="Solved" />
                      ) : p.status === 'attempted' ? (
                        <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-amber-500 bg-amber-500/40" title="Attempted" />
                      ) : (
                        <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-slate-300" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-medium ${p.isLocked ? 'text-slate-500' : 'text-slate-900'}`}>
                        {p.title}
                        {p.status === 'attempted' && <span className="ml-2 text-xs font-normal text-amber-700">attempted</span>}
                      </span>
                      <span className="block text-xs text-slate-500 sm:hidden">{p.topic}</span>
                    </span>
                    <span className="hidden w-44 shrink-0 truncate text-sm text-slate-500 sm:block">{p.topic}</span>
                    <span className="flex w-20 shrink-0 justify-end">
                      <DifficultyTag difficulty={p.difficulty} className={p.isLocked ? 'opacity-60' : ''} />
                    </span>
                    <span className={`hidden w-12 shrink-0 text-right text-xs sm:block ${p.isLocked ? 'font-semibold text-brand-600' : 'text-slate-400'}`}>
                      {p.isLocked ? 'Pro' : p.isFree ? 'Free' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Upgrade */}
          {!data.hasAccess && lockedCount > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 bg-white p-4">
              <HiOutlineLockClosed className="text-brand-600" size={20} />
              <p className="text-sm text-slate-700">
                <b>{lockedCount} more problems</b> with solutions and all hints come with full access.
              </p>
              <Link to="/pricing" className="ml-auto rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                See plans
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
