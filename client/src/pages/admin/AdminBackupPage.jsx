import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineDownload, HiOutlineUpload, HiOutlineExclamation, HiOutlineCheckCircle } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import usePageTitle from '../../hooks/usePageTitle';

const MAX_FILE_MB = 10; // same as the server limit

const pad = (n) => String(n).padStart(2, '0');
function fileStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function Summary({ result }) {
  const { languages, questions, errors, moreErrors, dryRun } = result;
  return (
    <div className="space-y-3">
      <ul className="grid gap-2 text-sm sm:grid-cols-3">
        <li className="rounded-md bg-slate-50 p-3">
          <p className="text-slate-500">Languages</p>
          <p className="font-semibold text-slate-900">
            {languages.added} new · {languages.updated} existing
          </p>
        </li>
        <li className="rounded-md bg-green-50 p-3">
          <p className="text-green-700">Questions {dryRun ? 'to add' : 'added'}</p>
          <p className="font-semibold text-green-800">{questions.added}</p>
        </li>
        <li className="rounded-md bg-brand-50 p-3">
          <p className="text-brand-700">Questions {dryRun ? 'to update' : 'updated'}</p>
          <p className="font-semibold text-brand-800">{questions.updated}</p>
        </li>
      </ul>
      {errors.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <HiOutlineExclamation /> {questions.skipped} item(s) {dryRun ? 'will be skipped' : 'were skipped'}
          </p>
          <ul className="mt-2 max-h-56 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-amber-900">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {moreErrors && <p className="mt-1 text-xs text-amber-700">Only the first 50 problems are shown.</p>}
        </div>
      )}
    </div>
  );
}

/**
 * /admin/backup — download all content as JSON, or import a JSON backup.
 * Import is checked first (dry run) and only adds or updates; it never deletes.
 */
export default function AdminBackupPage() {
  usePageTitle('Admin · Backup');
  const fileInput = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);
  const [file, setFile] = useState(null); // { name, data }
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fileError, setFileError] = useState('');

  const download = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/admin/backup/export');
      const backup = data.data.backup;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${fileStamp()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastExport({ languages: backup.languages.length, questions: backup.questions.length });
      toast.success('Backup downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setFileError('');
    if (fileInput.current) fileInput.current.value = '';
  };

  // Read the chosen file and check it on the server without saving
  const chooseFile = async (e) => {
    const chosen = e.target.files?.[0];
    setPreview(null);
    setImportResult(null);
    setFileError('');
    if (!chosen) return;
    if (chosen.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`The file is larger than ${MAX_FILE_MB} MB`);
      return;
    }
    let data;
    try {
      data = JSON.parse(await chosen.text());
    } catch {
      setFileError('This file is not valid JSON');
      return;
    }
    if (!Array.isArray(data?.languages) && !Array.isArray(data?.questions)) {
      setFileError('This does not look like a backup file (no "languages" or "questions" list)');
      return;
    }
    setFile({ name: chosen.name, data });
    setChecking(true);
    try {
      const { data: res } = await api.post('/admin/backup/import', data, { params: { dryRun: true } });
      setPreview(res.data);
    } catch (err) {
      setFileError(getErrorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const runImport = async () => {
    setConfirmOpen(false);
    setImporting(true);
    try {
      const { data: res } = await api.post('/admin/backup/import', file.data);
      setImportResult(res.data);
      setPreview(null);
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const canImport = preview && preview.questions.added + preview.questions.updated + preview.languages.added + preview.languages.updated > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Backup</h1>
        <p className="mt-1 text-sm text-slate-600">Download all languages and questions, or bring them back from a backup file.</p>
      </div>

      {/* Export */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <HiOutlineDownload className="text-brand-600" /> Export
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          A JSON file with every language (with topics) and question. Users and quiz results are not included.
        </p>
        <Button className="mt-4" loading={exporting} onClick={download}>
          Download backup
        </Button>
        {lastExport && (
          <p className="mt-3 text-sm text-slate-500">
            Last download: {lastExport.languages} languages, {lastExport.questions} questions.
          </p>
        )}
      </section>

      {/* Import */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <HiOutlineUpload className="text-brand-600" /> Import
        </h2>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
          <li>Adds new questions and updates existing ones (same language + same question text).</li>
          <li>Nothing is deleted. Topics missing from the file are kept.</li>
          <li>The file is checked first; you see the result before anything is saved.</li>
        </ul>

        <label className="mt-4 block">
          <span className="sr-only">Backup file</span>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            onChange={chooseFile}
            disabled={checking || importing}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
          />
        </label>

        {fileError && (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {fileError}
          </p>
        )}
        {checking && <p className="mt-3 text-sm text-slate-500">Checking the file...</p>}

        {preview && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-700">
              <strong>{file.name}</strong>: {file.data.languages?.length || 0} languages, {file.data.questions?.length || 0} questions in the file.
            </p>
            <Summary result={preview} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setConfirmOpen(true)} loading={importing} disabled={!canImport}>
                Import now
              </Button>
              <Button variant="secondary" onClick={reset} disabled={importing}>
                Choose another file
              </Button>
            </div>
          </div>
        )}

        {importResult && (
          <div className="mt-4 space-y-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
              <HiOutlineCheckCircle size={18} /> Import finished
            </p>
            <Summary result={importResult} />
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Import this file?"
        text={
          preview
            ? `${preview.questions.added} questions will be added and ${preview.questions.updated} updated. Tip: download a backup first.`
            : ''
        }
        confirmText="Import"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={runImport}
      />
    </div>
  );
}
