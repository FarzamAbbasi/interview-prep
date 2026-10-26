import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { HiOutlineAcademicCap, HiOutlineCollection, HiOutlineChartBar, HiChevronRight, HiOutlineTrash } from 'react-icons/hi';
import api, { getErrorMessage } from '../api/axios';
import useAuth from '../hooks/useAuth';
import useLanguages from '../hooks/useLanguages';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageLoader from '../components/ui/PageLoader';
import LanguageIcon from '../components/languages/LanguageIcon';
import usePageTitle from '../hooks/usePageTitle';

const formatDate = (value) =>
  new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatTime = (seconds = 0) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const scoreColor = (p) => (p >= 80 ? 'text-green-700 bg-green-50' : p >= 50 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50');
const barColor = (p) => (p >= 80 ? 'bg-green-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-500');

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon className="text-brand-600" size={18} /> {label}
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

/**
 * /dashboard — stats, progress per language and quiz history (GET /api/quiz/history).
 */
export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { user, hasFullAccess, hasAnyAccess, paidLanguages } = useAuth();
  // IPP-1704: "Full access" / "React, Node.js" / "Free"
  const planText = hasFullAccess ? 'Full access' : hasAnyAccess ? paidLanguages.map((l) => l.name).join(', ') : 'Free';
  const { languages } = useLanguages(); // only used to show topic names
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${page}|${reloadCount}`;
  const [result, setResult] = useState({ key: '', data: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/quiz/history', { params: { page: Number(requestKey.split('|')[0]) } })
      .then(({ data }) => !cancelled && setResult({ key: requestKey, data: data.data, error: '' }))
      .catch((err) => !cancelled && setResult({ key: requestKey, data: null, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const topicName = useMemo(() => {
    const map = new Map();
    languages.forEach((l) => (l.topics || []).forEach((t) => map.set(`${l._id}:${t.slug}`, t.name)));
    return (languageId, slug) => (slug ? map.get(`${languageId}:${slug}`) || slug : '');
  }, [languages]);

  // ---- IPP-1502: delete one quiz or the whole history ----
  const [confirm, setConfirm] = useState(null); // { attempt } for one quiz, { all: true } for everything
  const [deleting, setDeleting] = useState(false);
  const closeConfirm = useCallback(() => !deleting && setConfirm(null), [deleting]);
  const runDelete = async () => {
    setDeleting(true);
    try {
      const { data } = confirm.all ? await api.delete('/quiz/history') : await api.delete(`/quiz/${confirm.attempt._id}`);
      toast.success(data.message);
      const onlyOneOnPage = (result.data?.attempts || []).length === 1;
      if (confirm.all) setPage(1);
      else if (onlyOneOnPage && page > 1) setPage(page - 1);
      setReloadCount((n) => n + 1);
      setConfirm(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const loading = result.key !== requestKey;
  const firstLoad = loading && !result.data;
  if (firstLoad) return <PageLoader text="Loading your dashboard..." />;

  const { stats, attempts = [], pagination } = result.data || {};
  const hasHistory = stats?.totalAttempts > 0;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            Your plan:
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                hasAnyAccess ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {planText}
            </span>
            {!hasFullAccess && (
              <Link to="/pricing" className="font-semibold text-brand-600 hover:underline">
                {hasAnyAccess ? 'Add languages' : 'Upgrade'}
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/quiz" className="rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            Start a quiz
          </Link>
          <Link to="/languages" className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Browse questions
          </Link>
          {hasAnyAccess && (
            <Link to="/bookmarks" className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Bookmarks
            </Link>
          )}
        </div>
      </section>

      {result.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{result.error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => setReloadCount((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}

      {stats && !hasHistory && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <HiOutlineAcademicCap className="mx-auto text-brand-600" size={40} />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">No quizzes yet</h2>
          <p className="mt-1 text-sm text-slate-600">Take your first quiz to see your scores and progress here.</p>
          <Link to="/quiz" className="mt-5 inline-block rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            Start your first quiz
          </Link>
        </section>
      )}

      {hasHistory && (
        <>
          {/* Stats */}
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Your stats">
            <StatTile icon={HiOutlineAcademicCap} label="Quizzes taken" value={stats.totalAttempts} />
            <StatTile icon={HiOutlineCollection} label="Questions answered" value={stats.questionsAnswered} />
            <StatTile icon={HiOutlineChartBar} label="Average score" value={`${stats.averagePercentage}%`} />
          </section>

          {/* Per language */}
          <section aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="mb-3 text-lg font-bold text-slate-900">
              Progress by language
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {stats.byLanguage.map((row) => (
                <div key={row.language?._id || 'removed'} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <LanguageIcon icon={row.language?.icon} name={row.language?.name || '?'} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{row.language?.name || 'Removed language'}</p>
                      <p className="text-xs text-slate-500">
                        {row.attempts} {row.attempts === 1 ? 'quiz' : 'quizzes'} · {row.questionsAnswered} questions · best {row.bestPercentage}%
                      </p>
                    </div>
                    <span className={`rounded-md px-2 py-1 text-sm font-bold ${scoreColor(row.averagePercentage)}`}>{row.averagePercentage}%</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div className={`h-full rounded-full ${barColor(row.averagePercentage)}`} style={{ width: `${row.averagePercentage}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Average score</p>
                </div>
              ))}
            </div>
          </section>

          {/* History */}
          <section aria-labelledby="history-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="history-heading" className="text-lg font-bold text-slate-900">
                Quiz history
              </h2>
              <button
                type="button"
                onClick={() => setConfirm({ all: true })}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-700"
              >
                <HiOutlineTrash size={16} /> Clear history
              </button>
            </div>
            <ul className={`divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white ${loading ? 'opacity-60' : ''}`}>
              {attempts.map((a) => {
                const topic = topicName(a.language?._id, a.topic);
                const details = [
                  a.isSample ? 'Sample quiz' : 'Full quiz',
                  topic,
                  a.difficulty && a.difficulty !== 'mixed' ? a.difficulty : '',
                ].filter(Boolean);
                return (
                  <li key={a._id} className="flex items-center">
                    <Link
                      to={`/quiz/result/${a._id}`}
                      className="flex min-w-0 flex-1 items-center gap-4 py-3 pl-4 pr-2 transition hover:bg-slate-50 sm:pl-5"
                    >
                      <span className={`w-14 shrink-0 rounded-md py-1 text-center text-sm font-bold ${scoreColor(a.percentage)}`}>
                        {a.percentage}%
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">
                          {a.language?.name || 'Quiz'} <span className="font-normal capitalize text-slate-500">· {details.join(' · ')}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(a.completedAt || a.createdAt)} · {a.score}/{a.total} correct · {formatTime(a.timeTaken)}
                        </p>
                      </div>
                      <HiChevronRight className="shrink-0 text-slate-400" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirm({ attempt: a })}
                      aria-label={`Delete ${a.language?.name || ''} quiz from ${formatDate(a.completedAt || a.createdAt)}`}
                      title="Delete from history"
                      className="mr-2 shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-700 sm:mr-3"
                    >
                      <HiOutlineTrash size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={setPage} />}
          </section>
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.all ? 'Clear your quiz history?' : 'Delete this quiz?'}
        text={
          confirm?.all
            ? `All ${stats?.totalAttempts || ''} quiz results and your scores per language will be deleted. This cannot be undone.`
            : confirm
              ? `${confirm.attempt.language?.name || 'Quiz'} from ${formatDate(confirm.attempt.completedAt || confirm.attempt.createdAt)} (${confirm.attempt.score}/${confirm.attempt.total}) will be removed from your history and stats. This cannot be undone.`
              : ''
        }
        confirmText={confirm?.all ? 'Clear history' : 'Delete'}
        loading={deleting}
        onCancel={closeConfirm}
        onConfirm={runDelete}
      />
    </div>
  );
}
