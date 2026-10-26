import { useEffect, useRef, useState } from 'react';
import { HiOutlineX, HiOutlineLockClosed, HiChevronDown, HiChevronRight } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../ui/Button';

/**
 * IPP-1703: side panel on Admin → Users. Shows one user's account info,
 * study progress (done Q&A by language → topic, bookmarks) and quiz performance.
 * <UserDetailsPanel userId={id | null} onClose={fn} />
 */

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Never';
const formatShort = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : '';
const formatSeconds = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s || 0}s`);
const pctText = (value) => (value === null || value === undefined ? '—' : `${value}%`);

function Box({ value, label }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 text-center">
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Bar({ percent, tone = 'brand' }) {
  const color = tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-brand-600';
  return (
    <span className="block h-1.5 w-20 shrink-0 overflow-hidden rounded bg-slate-200">
      <span className={`block h-1.5 rounded ${color}`} style={{ width: `${Math.min(100, percent || 0)}%` }} />
    </span>
  );
}

function SectionTitle({ children }) {
  return <h3 className="mb-2 mt-5 text-sm font-bold text-slate-900">{children}</h3>;
}

function Empty({ children }) {
  return <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">{children}</p>;
}

// ---------------- Study tab ----------------
function StudyTab({ study, bookmarksCount }) {
  const [openLang, setOpenLang] = useState(() => study.languages.find((l) => l.done > 0)?._id || null);

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        <Box value={`${study.percent}%`} label="Q&A done" />
        <Box value={study.done} label="Done total" />
        <Box value={study.thisWeek} label="This week" />
        <Box value={bookmarksCount} label="Bookmarks" />
      </div>

      <SectionTitle>By language → topic</SectionTitle>
      {study.languages.length ? (
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
          {study.languages.map((lang) => {
            const open = openLang === lang._id;
            return (
              <div key={lang._id}>
                <button
                  type="button"
                  onClick={() => setOpenLang(open ? null : lang._id)}
                  aria-expanded={open}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left font-medium hover:bg-slate-50 ${
                    lang.done ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {open ? <HiChevronDown /> : <HiChevronRight />} {lang.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <Bar percent={lang.percent} />
                    <span className="w-12 text-right text-xs">
                      {lang.done}/{lang.total}
                    </span>
                  </span>
                </button>
                {open && (
                  <ul className="border-t border-slate-100 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    {lang.topics.map((t) => (
                      <li
                        key={t.slug || 'other'}
                        className={`flex justify-between gap-3 py-1.5 pl-5 ${t.done ? '' : 'text-slate-400'}`}
                      >
                        <span className="flex items-center gap-1">
                          {t.name}
                          {t.locked && <HiOutlineLockClosed title="Needs full access" aria-label="Needs full access" />}
                        </span>
                        <span>
                          {t.done}/{t.total}
                          {t.total > 0 && t.done >= t.total ? ' ✓' : t.done === 0 ? ' · not started' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty>No questions yet.</Empty>
      )}

      <SectionTitle>Recently done</SectionTitle>
      {study.recentDone.length ? (
        <ul className="space-y-1.5 text-xs text-slate-600">
          {study.recentDone.map((d, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0">
                {d.question}{' '}
                <span className="text-slate-400">
                  · {d.language} / {d.topic}
                </span>
              </span>
              <span className="shrink-0 text-slate-400">{formatShort(d.at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Has not marked any question as done yet.</Empty>
      )}

      <SectionTitle>Bookmarks{bookmarksCount > 10 ? ' (latest 10)' : ''}</SectionTitle>
      {study.bookmarks.length ? (
        <ul className="space-y-1.5 text-xs text-slate-600">
          {study.bookmarks.map((b, i) => (
            <li key={i}>
              {b.question}{' '}
              <span className="text-slate-400">
                · {b.language} / {b.topic}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No bookmarks.</Empty>
      )}
    </div>
  );
}

// ---------------- Quizzes tab ----------------
const TREND_TEXT = {
  up: { text: 'Improving ↑', className: 'text-green-700' },
  down: { text: 'Dropping ↓', className: 'text-red-600' },
  steady: { text: 'Steady', className: 'text-slate-600' },
  'not-enough': { text: 'Needs 4+ quizzes', className: 'text-slate-400' },
};

function QuizzesTab({ quizzes }) {
  const trend = TREND_TEXT[quizzes.trend.direction] || TREND_TEXT['not-enough'];

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        <Box value={quizzes.count} label="Full quizzes" />
        <Box value={pctText(quizzes.average)} label="Average" />
        <Box value={pctText(quizzes.best)} label="Best" />
        <Box value={quizzes.sampleCount} label="Sample" />
      </div>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Score trend (last 10)</h3>
        <span className={`text-xs font-semibold ${trend.className}`}>{trend.text}</span>
      </div>
      {quizzes.trend.points.length ? (
        <div
          className="flex h-20 items-end gap-1.5 rounded-lg border border-slate-200 px-3 pb-2 pt-3"
          aria-label="Score trend"
        >
          {quizzes.trend.points.map((p, i) => (
            <div
              key={i}
              title={`${p.percentage}% · ${formatShort(p.at)}`}
              className={`flex-1 rounded-t ${p.percentage >= 70 ? 'bg-green-500' : p.percentage >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ height: `${Math.max(4, p.percentage)}%` }}
            />
          ))}
        </div>
      ) : (
        <Empty>No full quizzes yet.</Empty>
      )}

      <SectionTitle>By language</SectionTitle>
      {quizzes.languages.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 font-medium">Language</th>
              <th className="font-medium">Quizzes</th>
              <th className="font-medium">Avg</th>
              <th className="font-medium">Best</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {quizzes.languages.map((l) => (
              <tr key={l.name}>
                <td className="py-2 font-medium text-slate-900">{l.name}</td>
                <td className="text-slate-700">{l.attempts}</td>
                <td className="text-slate-700">{pctText(l.average)}</td>
                <td className="text-slate-700">{pctText(l.best)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>No full quizzes yet.</Empty>
      )}

      <SectionTitle>Weak topics</SectionTitle>
      {quizzes.weakTopics.length ? (
        <ul className="space-y-2 text-xs">
          {quizzes.weakTopics.map((t) => (
            <li key={`${t.language}-${t.topic}`} className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-slate-700">
                {t.topic} <span className="text-slate-400">· {t.language}</span>
              </span>
              <span className="flex items-center gap-2 text-slate-600">
                <Bar percent={t.accuracy} tone={t.accuracy < 40 ? 'red' : 'amber'} />
                <span className="w-24 text-right">
                  {t.correct}/{t.answered} right ({t.accuracy}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No weak topics (needs at least 3 answers in a topic).</Empty>
      )}

      <SectionTitle>Last 10 quizzes</SectionTitle>
      {quizzes.recent.length ? (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-xs">
          {quizzes.recent.map((a) => (
            <li key={a._id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="font-medium text-slate-900">{a.language}</span>
                <span className="text-slate-500">
                  {' '}
                  · {a.topic} · {a.difficulty}
                  {a.isSample ? ' · sample' : ''}
                </span>
                <span className="block text-slate-400">
                  {formatDateTime(a.at)} · {formatSeconds(a.timeTaken)}
                </span>
              </span>
              <span className="shrink-0 text-right font-semibold text-slate-900">
                {a.score}/{a.total}
                <span className="block font-normal text-slate-500">{a.percentage}%</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No quizzes yet.</Empty>
      )}
    </div>
  );
}

// ---------------- Panel ----------------
export default function UserDetailsPanel({ userId, onClose }) {
  const closeRef = useRef(null);
  const [tab, setTab] = useState('study');
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = userId ? `${userId}:${reloadCount}` : '';
  const [result, setResult] = useState({ key: '', data: null, error: '' });

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    api
      .get(`/admin/users/${userId}/details`)
      .then(({ data }) => !cancelled && setResult({ key: requestKey, data: data.data, error: '' }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({
            key: requestKey,
            data: null,
            error: getErrorMessage(err),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [userId, requestKey]);

  // Escape closes, focus the close button when opened
  useEffect(() => {
    if (!userId) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userId, onClose]);

  if (!userId) return null;
  const loading = result.key !== requestKey;
  const d = loading ? null : result.data;
  const u = d?.user;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="User details"
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-900">{u?.name || 'User details'}</p>
            {u && <p className="truncate text-sm text-slate-500">{u.email}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <HiOutlineX />
          </button>
        </div>

        {loading && <p className="py-10 text-center text-sm text-slate-500">Loading...</p>}

        {!loading && result.error && (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <p className="text-sm text-red-700">{result.error}</p>
            <Button variant="secondary" className="mt-3" onClick={() => setReloadCount((n) => n + 1)}>
              Try again
            </Button>
          </div>
        )}

        {u && (
          <>
            {/* Account */}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <dt className="text-slate-400">Joined</dt>
                <dd className="text-slate-700">{formatDate(u.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Status</dt>
                <dd className="text-slate-700">
                  {u.role === 'admin'
                    ? 'Admin'
                    : u.isPaid
                      ? u.accessScope === 'some'
                        ? (u.paidLanguages || []).map((l) => l.name).join(', ') || 'No languages'
                        : 'All languages'
                      : 'Free'}
                  {!u.isVerified ? ' · not verified' : ''}
                  {u.isBlocked ? ' · blocked' : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Last seen</dt>
                <dd className="text-slate-700">{formatDateTime(d.activity.lastSeenAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Last login</dt>
                <dd className="text-slate-700">{formatDateTime(d.activity.lastLoginAt)}</dd>
              </div>
              {u.isPaid && (
                <div className="col-span-2">
                  <dt className="text-slate-400">Full access</dt>
                  <dd className="text-slate-700">
                    Since {formatDate(u.paidAt)}
                    {u.paidBy ? ` · given by ${u.paidBy.name} (${u.paidBy.email})` : ''}
                  </dd>
                </div>
              )}
            </dl>

            {/* Last activity */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-brand-50 px-3 py-2 text-brand-800">
                Last studied
                <br />
                <b>{d.activity.lastStudied ? formatDateTime(d.activity.lastStudied.at) : 'Never'}</b>
                {d.activity.lastStudied ? ` · ${d.activity.lastStudied.language}` : ''}
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
                Last quiz
                <br />
                <b>{d.activity.lastQuiz ? formatDateTime(d.activity.lastQuiz.at) : 'Never'}</b>
                {d.activity.lastQuiz ? ` · ${d.activity.lastQuiz.language} · ${d.activity.lastQuiz.percentage}%` : ''}
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex gap-1 border-b border-slate-200 text-sm" role="tablist">
              {[
                ['study', 'Study progress'],
                ['quizzes', 'Quizzes'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 px-3 py-2 ${
                    tab === key
                      ? 'border-brand-600 font-semibold text-brand-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === 'study' ? (
                <StudyTab key={u._id} study={d.study} bookmarksCount={u.bookmarksCount} />
              ) : (
                <QuizzesTab quizzes={d.quizzes} />
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
