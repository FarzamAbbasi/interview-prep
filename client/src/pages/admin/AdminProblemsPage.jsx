import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineExternalLink, HiOutlineEye, HiOutlineEyeOff, HiOutlineTrash } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../../components/ui/Button';
import PageLoader from '../../components/ui/PageLoader';
import DifficultyTag from '../../components/practice/DifficultyTag';
import usePageTitle from '../../hooks/usePageTitle';

const ALL = 'all';

/**
 * /admin/problems   (IPP-1721)
 * Coding problems of one language: hide / show or delete. Problems are added from
 * data/problems/<language>.json with `npm run import:problems`, so there is no add/edit form here.
 */
export default function AdminProblemsPage() {
  usePageTitle('Admin · Problems');
  const [languages, setLanguages] = useState(null);
  const [languageSlug, setLanguageSlug] = useState('javascript');
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState({ key: null, problems: [], error: '' });
  const [topic, setTopic] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/languages', { params: { all: true } })
      .then(({ data }) => !cancelled && setLanguages(data.data.languages))
      .catch(() => !cancelled && setLanguages([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const key = `${languageSlug}|${reloadCount}`;
  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/problems', { params: { language: languageSlug } })
      .then(({ data }) => !cancelled && setState({ key, problems: data.data.problems, error: '' }))
      .catch((err) => !cancelled && setState({ key, problems: [], error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [key, languageSlug]);

  const loading = state.key !== key;
  const reload = () => setReloadCount((n) => n + 1);
  const problems = useMemo(() => (loading ? [] : state.problems), [loading, state.problems]);
  const topics = useMemo(() => [...new Map(problems.map((p) => [p.topicSlug, p.topic])).entries()], [problems]);
  const shown = problems.filter(
    (p) => (topic === ALL || p.topicSlug === topic) && (status === ALL || (status === 'hidden' ? !p.isActive : p.isActive))
  );
  const hiddenCount = problems.filter((p) => !p.isActive).length;

  const pickLanguage = (slug) => {
    setLanguageSlug(slug);
    setTopic(ALL);
  };

  const setActive = async (problem, isActive) => {
    setBusyId(problem._id);
    try {
      const { data } = await api.patch(`/admin/problems/${problem._id}`, { isActive });
      toast.success(data.message);
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (problem) => {
    setBusyId(problem._id);
    try {
      const { data } = await api.delete(`/admin/problems/${problem._id}`);
      toast.success(data.message);
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const select = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-600';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coding problems</h1>
          {!loading && !state.error && (
            <p className="mt-1 text-sm text-slate-500">
              {problems.length} problems · {problems.length - hiddenCount} active · {hiddenCount} hidden
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label>
            <span className="sr-only">Language</span>
            <select value={languageSlug} onChange={(e) => pickLanguage(e.target.value)} className={select}>
              {(languages?.length ? languages : [{ slug: 'javascript', name: 'JavaScript' }]).map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Topic</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className={select}>
              <option value={ALL}>All topics</option>
              {topics.map(([slug, name]) => (
                <option key={slug} value={slug}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
              <option value={ALL}>All statuses</option>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Problems come from <code className="font-mono">server/data/problems/{languageSlug}.json</code>. Deleting here does not
        change that file: the next <code className="font-mono">import:problems</code> adds it back. <b>Hide</b> is the safe way to
        take a problem off the site (it stays hidden after an import). Problems are also in every backup (Admin → Backup).
      </p>

      {loading ? (
        <PageLoader text="Loading problems..." />
      ) : state.error ? (
        <p className="mt-6 text-center text-sm text-slate-600">{state.error}</p>
      ) : problems.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No problems for this language yet. Add them to the JSON file and run <code className="font-mono">npm run import:problems</code>.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Problem</th>
                <th className="px-3">Topic</th>
                <th className="px-3">Level</th>
                <th className="px-3">Access</th>
                <th className="px-3">Status</th>
                <th className="px-3">Users</th>
                <th className="px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p._id} className={`border-t border-slate-100 ${p.isActive ? '' : 'bg-slate-50 text-slate-500'}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="font-mono text-xs text-slate-400">{p.slug}</div>
                  </td>
                  <td className="px-3">{p.topic}</td>
                  <td className="px-3">
                    <DifficultyTag difficulty={p.difficulty} />
                  </td>
                  <td className={`px-3 ${p.isFree ? 'text-slate-500' : 'font-semibold text-brand-600'}`}>{p.isFree ? 'Free' : 'Pro'}</td>
                  <td className="px-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                    >
                      {p.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3">
                    {p.solvedCount} solved · {p.triedCount} tried
                  </td>
                  <td className="whitespace-nowrap px-4 text-right">
                    <Link
                      to={`/practice/${languageSlug}/${p.slug}`}
                      target="_blank"
                      className="mr-3 inline-flex items-center gap-1 text-brand-700 hover:underline"
                      title="Open in a new tab"
                    >
                      Open <HiOutlineExternalLink />
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === p._id}
                      onClick={() => setActive(p, !p.isActive)}
                      className={`mr-3 inline-flex items-center gap-1 hover:underline disabled:opacity-50 ${p.isActive ? 'text-slate-600' : 'font-medium text-green-700'}`}
                    >
                      {p.isActive ? <HiOutlineEyeOff /> : <HiOutlineEye />} {p.isActive ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p._id}
                      onClick={() => setToDelete(p)}
                      className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50"
                    >
                      <HiOutlineTrash /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No problem matches these filters.</p>}
        </div>
      )}

      {/* Delete confirm (3 choices, so not the shared ConfirmDialog) */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setToDelete(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setToDelete(null)}
          >
            <h2 id="delete-title" className="text-lg font-semibold text-slate-900">
              Delete &ldquo;{toDelete.title}&rdquo;?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {toDelete.triedCount
                ? `This also deletes the progress of ${toDelete.triedCount} user${toDelete.triedCount === 1 ? '' : 's'} on it (${toDelete.solvedCount} solved). `
                : 'No user has tried it yet. '}
              It cannot be undone.
            </p>
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              It is still in {languageSlug}.json, so the next import adds it back. Remove it from the file too, or use Hide instead.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setToDelete(null)} disabled={busyId === toDelete._id}>
                Cancel
              </Button>
              {toDelete.isActive && (
                <Button variant="secondary" onClick={() => setActive(toDelete, false)} disabled={busyId === toDelete._id}>
                  Hide instead
                </Button>
              )}
              <Button onClick={() => remove(toDelete)} loading={busyId === toDelete._id} className="!bg-red-600 hover:!bg-red-700">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
