import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiPlus, HiOutlineCloudUpload } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import LanguageIcon from '../../components/languages/LanguageIcon';
import LanguageForm from '../../components/admin/LanguageForm';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PageLoader from '../../components/ui/PageLoader';
import usePageTitle from '../../hooks/usePageTitle';

/**
 * /admin/languages — all languages (active and inactive), add / edit / activate / delete.
 */
export default function AdminLanguagesPage() {
  usePageTitle('Admin · Languages');
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState({ key: -1, languages: [], error: '' });
  const [editing, setEditing] = useState(null); // null | 'new' | language
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/languages', { params: { all: true } })
      .then(({ data }) => !cancelled && setState({ key: reloadCount, languages: data.data.languages, error: '' }))
      .catch((err) => !cancelled && setState({ key: reloadCount, languages: [], error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const reload = () => setReloadCount((n) => n + 1);

  // Used by the form: throws the server message so the form can show it
  const save = async (body) => {
    try {
      const { data } =
        editing === 'new' ? await api.post('/languages', body) : await api.put(`/languages/${editing._id}`, body);
      toast.success(data.message);
      setEditing(null);
      reload();
    } catch (err) {
      throw getErrorMessage(err);
    }
  };

  const toggleActive = async (language) => {
    setBusyId(language._id);
    try {
      await api.put(`/languages/${language._id}`, { isActive: !language.isActive });
      toast.success(language.isActive ? `${language.name} is hidden from the site` : `${language.name} is now live`);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    const language = toDelete;
    setToDelete(null);
    setBusyId(language._id);
    try {
      const { data } = await api.delete(`/languages/${language._id}`);
      toast.success(data.message);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  if (state.key !== reloadCount && !state.languages.length) return <PageLoader />;

  // A language with questions cannot be deleted: the dialog only explains that
  const deleteBlocked = Boolean(toDelete && toDelete.qaCount + toDelete.mcqCount > 0);

  // Add / edit screen
  if (editing) {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-5 text-2xl font-bold text-slate-900">{editing === 'new' ? 'Add language' : `Edit ${editing.name}`}</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <LanguageForm initial={editing === 'new' ? null : editing} onSubmit={save} onCancel={() => setEditing(null)} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Languages</h1>
          <p className="mt-1 text-sm text-slate-600">Inactive languages are hidden from visitors.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/upload"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <HiOutlineCloudUpload /> Bulk upload
          </Link>
          <Button onClick={() => setEditing('new')}>
            <HiPlus /> Add language
          </Button>
        </div>
      </div>

      {state.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{state.error}</p>
          <Button variant="secondary" className="mt-4" onClick={reload}>
            Try again
          </Button>
        </div>
      )}

      {!state.error && !state.languages.length && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No languages yet. Add the first one.</p>
      )}

      <ul className="space-y-3">
        {state.languages.map((l) => (
          <li key={l._id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <LanguageIcon icon={l.icon} name={l.name} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{l.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {l.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">
                  /{l.slug} · {l.qaCount} Q&amp;A · {l.mcqCount} MCQs · {l.freeQaCount} free · {(l.topics || []).length} topics
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => setEditing(l)} disabled={Boolean(busyId)}>
                Edit
              </Button>
              <Button variant="secondary" className="px-3 py-2 text-xs" loading={busyId === l._id} disabled={Boolean(busyId)} onClick={() => toggleActive(l)}>
                {l.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button variant="secondary" className="px-3 py-2 text-xs text-red-600" disabled={Boolean(busyId)} onClick={() => setToDelete(l)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete ${toDelete?.name}?`}
        text={
          deleteBlocked
            ? 'This language has questions, so it cannot be deleted. Deactivate it instead, or delete its questions first.'
            : 'This cannot be undone.'
        }
        confirmText={deleteBlocked ? 'OK' : 'Delete'}
        cancelText={deleteBlocked ? 'Close' : 'Cancel'}
        onCancel={() => setToDelete(null)}
        onConfirm={deleteBlocked ? () => setToDelete(null) : remove}
      />
    </div>
  );
}
