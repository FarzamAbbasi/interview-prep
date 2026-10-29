import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineTrash, HiOutlineMicrophone } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import Pagination from '../ui/Pagination';

const formatDay = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const barColor = (p) => (p >= 80 ? 'bg-green-500' : p >= 50 ? 'bg-brand-600' : 'bg-red-500');

function Tile({ label, children }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * IPP-1726: Dashboard box "Interview rounds" (GET /api/interview/history).
 * Rounds count, average, weakest topic, and the rounds (each opens its report, each can be deleted).
 */
export default function InterviewRoundsBox() {
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const key = `${page}|${reloadCount}`;
  const [result, setResult] = useState({ key: null });
  const [confirm, setConfirm] = useState(null); // { round } or { all: true }
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/interview/history', { params: { page: Number(key.split('|')[0]) } })
      .then(({ data: res }) => !cancelled && setResult({ key, data: res.data }))
      .catch((err) => !cancelled && setResult({ key, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const runDelete = async () => {
    setDeleting(true);
    try {
      const { data: res } = confirm.all ? await api.delete('/interview/history') : await api.delete(`/interview/${confirm.round._id}`);
      toast.success(res.message);
      const onlyOneOnPage = (result.data?.rounds || []).length === 1;
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

  const loading = result.key !== key;
  const { stats, rounds = [], pagination } = result.data || {};
  const weakest = stats?.weakestTopic;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="interview-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="interview-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <HiOutlineMicrophone className="text-brand-600" /> Interview rounds
        </h2>
        <div className="flex items-center gap-1">
          {stats?.rounds > 0 && (
            <button
              type="button"
              onClick={() => setConfirm({ all: true })}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-700"
            >
              <HiOutlineTrash size={16} /> Clear
            </button>
          )}
          <Link to="/interview" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Start a round
          </Link>
        </div>
      </div>

      {loading && !result.data ? (
        <p className="py-6 text-center text-sm text-slate-500">Loading...</p>
      ) : result.error ? (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          {result.error}
          <Button variant="secondary" className="mt-3" onClick={() => setReloadCount((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : !stats?.rounds ? (
        <p className="mt-3 text-sm text-slate-600">
          No rounds yet. A round is a timed mock interview: Q&amp;A questions and a coding problem, then a report with what to study next.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Tile label="Rounds">
              <b className="text-2xl text-slate-900">{stats.rounds}</b>
            </Tile>
            <Tile label="Average">
              <b className="text-2xl text-slate-900">{stats.averagePercentage}%</b>
            </Tile>
            <Tile label="Weakest topic">
              {weakest ? (
                <>
                  <b className="block truncate text-slate-900" title={weakest.topic.name}>
                    {weakest.topic.name}
                    {weakest.kind === 'coding' ? ' (coding)' : ''}
                  </b>
                  <span className="text-xs text-slate-500">
                    {weakest.language?.name} · {weakest.averagePercentage}%
                  </span>
                </>
              ) : (
                <b className="text-slate-900">None yet 🎉</b>
              )}
            </Tile>
          </div>

          <ul className={`mt-4 divide-y divide-slate-100 ${loading ? 'opacity-60' : ''}`}>
            {rounds.map((r) => (
              <li key={r._id} className="flex items-center">
                <Link to={`/interview/${r._id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 text-sm hover:bg-slate-50 sm:gap-4">
                  <span className="w-14 shrink-0 text-slate-500">{formatDay(r.completedAt)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
                    {r.language?.name || 'Removed language'}{' '}
                    <span className="font-normal capitalize text-slate-500">
                      · {r.level}
                      {r.isTrial ? ' · free' : ''}
                    </span>
                  </span>
                  <span className="hidden h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:block" aria-hidden="true">
                    <span className={`block h-full rounded-full ${barColor(r.percentage)}`} style={{ width: `${r.percentage}%` }} />
                  </span>
                  <b className="w-11 shrink-0 text-right text-slate-900">{r.percentage}%</b>
                  <span className="shrink-0 font-semibold text-brand-700">Report</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirm({ round: r })}
                  aria-label={`Delete ${r.language?.name || ''} round from ${formatDay(r.completedAt)}`}
                  title="Delete from history"
                  className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
                >
                  <HiOutlineTrash size={18} />
                </button>
              </li>
            ))}
          </ul>
          {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={setPage} />}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.all ? 'Clear your interview history?' : 'Delete this round?'}
        text={
          confirm?.all
            ? `All ${stats?.rounds || ''} rounds and their reports will be deleted. This cannot be undone.`
            : confirm
              ? `${confirm.round.language?.name || 'Round'} from ${formatDay(confirm.round.completedAt)} (${confirm.round.percentage}%) and its report will be deleted. This cannot be undone.`
              : ''
        }
        confirmText={confirm?.all ? 'Clear history' : 'Delete'}
        loading={deleting}
        onCancel={() => !deleting && setConfirm(null)}
        onConfirm={runDelete}
      />
    </section>
  );
}
