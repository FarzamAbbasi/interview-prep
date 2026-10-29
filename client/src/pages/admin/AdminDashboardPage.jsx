import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineUsers,
  HiOutlineBadgeCheck,
  HiOutlineQuestionMarkCircle,
  HiOutlineTranslate,
  HiOutlineAcademicCap,
} from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../../components/ui/Button';
import BackupReminder from '../../components/admin/BackupReminder';
import AiCheckCard from '../../components/admin/AiCheckCard';
import PageLoader from '../../components/ui/PageLoader';
import usePageTitle from '../../hooks/usePageTitle';

function Tile({ icon: Icon, label, value, note, to }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon className="text-brand-600" size={18} /> {label}
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </>
  );
  const cls = 'block rounded-xl border border-slate-200 bg-white p-5';
  return to ? (
    <Link to={to} className={`${cls} transition hover:border-brand-600`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const formatDate = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * /admin — numbers at a glance (GET /api/admin/stats) and the latest sign-ups.
 */
export default function AdminDashboardPage() {
  usePageTitle('Admin');
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState({ key: -1, data: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/stats')
      .then(({ data }) => !cancelled && setState({ key: reloadCount, data: data.data, error: '' }))
      .catch((err) => !cancelled && setState({ key: reloadCount, data: null, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  if (state.key !== reloadCount) return <PageLoader />;
  if (state.error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{state.error}</p>
        <Button variant="secondary" className="mt-4" onClick={() => setReloadCount((n) => n + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  const { users, languages, questions, quizzes, recentUsers, lastBackup } = state.data;
  const paidShare = users.total ? Math.round((users.paid / users.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Everything at a glance. Click a box to manage it.</p>
      </div>

      <BackupReminder lastBackup={lastBackup} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Numbers">
        <Tile icon={HiOutlineUsers} label="Users" value={users.total} note={`${users.newThisWeek} new this week · ${users.unverified} not verified`} to="/admin/users" />
        <Tile icon={HiOutlineBadgeCheck} label="Paid users" value={users.paid} note={`${paidShare}% of users${users.blocked ? ` · ${users.blocked} blocked` : ''}`} to="/admin/users" />
        <Tile icon={HiOutlineQuestionMarkCircle} label="Questions" value={questions.total} note={`${questions.qa} Q&A · ${questions.mcq} MCQs${questions.inactive ? ` · ${questions.inactive} inactive` : ''}`} to="/admin/questions" />
        <Tile icon={HiOutlineTranslate} label="Languages" value={languages.total} note={`${languages.active} active`} to="/admin/languages" />
        <Tile icon={HiOutlineAcademicCap} label="Quizzes taken" value={quizzes.total} note={`${quizzes.thisWeek} this week`} />
      </section>

      {/* IPP-1730: AI answer check (status, numbers, daily limits) */}
      <AiCheckCard />

      <section aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="text-lg font-bold text-slate-900">
            Latest sign-ups
          </h2>
          <Link to="/admin/users" className="text-sm font-semibold text-brand-600 hover:underline">
            All users
          </Link>
        </div>
        {recentUsers.length ? (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {recentUsers.map((u) => (
              <li key={u._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{u.name}</p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {!u.isVerified && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">Not verified</span>}
                  <span className={`rounded-full px-2 py-0.5 font-medium ${u.isPaid ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {u.isPaid ? (u.accessScope === 'some' ? 'Some languages' : 'Full access') : 'Free'}
                  </span>
                  <span className="text-slate-400">{formatDate(u.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No users yet.</p>
        )}
      </section>
    </div>
  );
}
