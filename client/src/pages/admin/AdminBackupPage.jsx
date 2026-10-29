import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineDownload, HiOutlineUpload, HiOutlineExclamation, HiOutlineCheckCircle } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import usePageTitle from '../../hooks/usePageTitle';
import { backupAge, formatBackupDate } from '../../utils/backupAge';

const MAX_FILE_MB = 10; // same as the server limit

const pad = (n) => String(n).padStart(2, '0');
function fileStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function Summary({ result }) {
  const { languages, questions, problems, users, quizAttempts, problemProgress, interviewRounds, bookmarksMissing, errors, moreErrors, dryRun } =
    result;
  const skipped =
    questions.skipped +
    (problems?.skipped || 0) +
    (users?.skipped || 0) +
    (quizAttempts?.skipped || 0) +
    (problemProgress?.skipped || 0) +
    (interviewRounds?.skipped || 0);
  return (
    <div className="space-y-3">
      <ul className={`grid gap-2 text-sm ${problems ? 'sm:grid-cols-2 md:grid-cols-4' : 'sm:grid-cols-3'}`}>
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
        {problems && (
          <li className="rounded-md bg-slate-50 p-3">
            <p className="text-slate-500">Coding problems</p>
            <p className="font-semibold text-slate-900">
              {problems.added} new · {problems.updated} existing
              {problems.skipped > 0 && ` · ${problems.skipped} skipped`}
            </p>
          </li>
        )}
      </ul>
      {(users || quizAttempts || problemProgress || interviewRounds) && (
        <ul className={`grid gap-2 text-sm sm:grid-cols-2 ${problemProgress || interviewRounds ? 'md:grid-cols-4' : ''}`}>
          {users && (
            <li className="rounded-md bg-violet-50 p-3">
              <p className="text-violet-700">Users {dryRun ? 'to add' : 'added'}</p>
              <p className="font-semibold text-violet-800">
                {users.added} new · {users.existing} already there (not changed)
              </p>
            </li>
          )}
          {quizAttempts && (
            <li className="rounded-md bg-violet-50 p-3">
              <p className="text-violet-700">Quiz results {dryRun ? 'to add' : 'added'}</p>
              <p className="font-semibold text-violet-800">
                {quizAttempts.added} new · {quizAttempts.existing} already there
              </p>
            </li>
          )}
          {problemProgress && (
            <li className="rounded-md bg-violet-50 p-3">
              <p className="text-violet-700">Coding progress {dryRun ? 'to add' : 'added'}</p>
              <p className="font-semibold text-violet-800">
                {problemProgress.added} new · {problemProgress.existing} already there
                {problemProgress.skipped > 0 && ` · ${problemProgress.skipped} skipped`}
              </p>
            </li>
          )}
          {interviewRounds && (
            <li className="rounded-md bg-violet-50 p-3">
              <p className="text-violet-700">Interview rounds {dryRun ? 'to add' : 'added'}</p>
              <p className="font-semibold text-violet-800">
                {interviewRounds.added} new · {interviewRounds.existing} already there
                {interviewRounds.skipped > 0 && ` · ${interviewRounds.skipped} skipped`}
              </p>
            </li>
          )}
        </ul>
      )}
      {bookmarksMissing > 0 && (
        <p className="text-sm text-amber-700">
          {bookmarksMissing} bookmark{bookmarksMissing === 1 ? '' : 's'} point to questions that do not exist and will be left out.
        </p>
      )}
      {errors.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <HiOutlineExclamation /> {skipped} item(s) {dryRun ? 'will be skipped' : 'were skipped'}
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
  const [scope, setScope] = useState('full'); // IPP-1007: 'full' (content + users + quiz results) or 'content'
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);
  const [lastFull, setLastFull] = useState(undefined); // IPP-1008: last full backup (null = never, undefined = loading)

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/backup/last')
      .then(({ data }) => !cancelled && setLastFull(data.data.lastBackup))
      .catch(() => !cancelled && setLastFull(undefined));
    return () => {
      cancelled = true;
    };
  }, []);
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
      const { data } = await api.get('/admin/backup/export', { params: { scope } });
      const backup = data.data.backup;
      if (data.data.lastBackup) setLastFull(data.data.lastBackup);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${scope}-${fileStamp()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastExport({
        languages: backup.languages.length,
        questions: backup.questions.length,
        problems: backup.problems?.length, // IPP-1723
        users: backup.users?.length,
        quizAttempts: backup.quizAttempts?.length,
        problemProgress: backup.problemProgress?.length, // IPP-1722
        interviewRounds: backup.interviewRounds?.length, // IPP-1727
      });
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
    if (
      !['languages', 'questions', 'problems', 'users', 'quizAttempts', 'problemProgress', 'interviewRounds'].some((key) => Array.isArray(data?.[key]))
    ) {
      setFileError('This does not look like a backup file (no "languages", "questions" or "users" list)');
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

  const canImport =
    preview &&
    preview.questions.added +
      preview.questions.updated +
      preview.languages.added +
      preview.languages.updated +
      (preview.problems?.added || 0) +
      (preview.problems?.updated || 0) +
      (preview.users?.added || 0) +
      (preview.quizAttempts?.added || 0) +
      (preview.problemProgress?.added || 0) +
      (preview.interviewRounds?.added || 0) >
      0;

  const scopes = [
    { value: 'full', label: 'Full backup', text: 'Content + users (paid / blocked, bookmarks) + quiz results + coding progress + interview rounds' },
    { value: 'content', label: 'Content only', text: 'Languages, questions and coding problems, no personal data (safe to share)' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Backup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Download everything (content, users and quiz results), or bring it back from a backup file.
        </p>
      </div>

      {/* Export */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <HiOutlineDownload className="text-brand-600" /> Export
        </h2>
        <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">What to download</legend>
          {scopes.map((s) => (
            <label
              key={s.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
                scope === s.value ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={s.value}
                checked={scope === s.value}
                onChange={() => setScope(s.value)}
                className="mt-0.5 accent-brand-600"
              />
              <span>
                <span className="block font-semibold text-slate-900">{s.label}</span>
                <span className="text-slate-600">{s.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {scope === 'full' && (
          <p className="mt-3 flex gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <HiOutlineExclamation className="mt-0.5 shrink-0" size={16} />
            This file has every user's email and hashed password. Keep it private (for example Google Drive), never share it
            or put it on GitHub.
          </p>
        )}
        {lastFull !== undefined && (
          <p className="mt-3 text-sm text-slate-600">
            {lastFull
              ? `Last full backup: ${backupAge(lastFull.at).text} (${formatBackupDate(lastFull.at)}${lastFull.by ? `, by ${lastFull.by}` : ''})`
              : 'No full backup has been downloaded yet.'}
          </p>
        )}
        <Button className="mt-4" loading={exporting} onClick={download}>
          Download {scope === 'full' ? 'full backup' : 'content backup'}
        </Button>
        {lastExport && (
          <p className="mt-3 text-sm text-slate-500">
            Last download: {lastExport.languages} languages, {lastExport.questions} questions
            {lastExport.problems !== undefined && `, ${lastExport.problems} coding problems`}
            {lastExport.users !== undefined && `, ${lastExport.users} users, ${lastExport.quizAttempts} quiz results`}
            {lastExport.problemProgress !== undefined && `, ${lastExport.problemProgress} coding progress rows`}
            {lastExport.interviewRounds !== undefined && `, ${lastExport.interviewRounds} interview rounds`}.
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
          <li>Coding problems: new ones are added, existing ones updated (same language + slug); a hidden problem stays hidden.</li>
          <li>Nothing is deleted. Topics missing from the file are kept.</li>
          <li>
            Full backup: only <strong>missing</strong> users and quiz results are added (users matched by email). Existing users
            are not changed, so their password, paid access and block stay as they are now.
          </li>
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
              <strong>{file.name}</strong>: {file.data.languages?.length || 0} languages, {file.data.questions?.length || 0} questions
              {Array.isArray(file.data.problems) && `, ${file.data.problems.length} coding problems`}
              {Array.isArray(file.data.users) && `, ${file.data.users.length} users`}
              {Array.isArray(file.data.quizAttempts) && `, ${file.data.quizAttempts.length} quiz results`}
              {Array.isArray(file.data.problemProgress) && `, ${file.data.problemProgress.length} coding progress rows`}
              {Array.isArray(file.data.interviewRounds) && `, ${file.data.interviewRounds.length} interview rounds`} in the file.
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
            ? `${preview.questions.added} questions will be added and ${preview.questions.updated} updated` +
              (preview.problems ? `, ${preview.problems.added} coding problems added and ${preview.problems.updated} updated` : '') +
              (preview.users ? `, ${preview.users.added} users added` : '') +
              (preview.quizAttempts ? `, ${preview.quizAttempts.added} quiz results added` : '') +
              (preview.problemProgress ? `, ${preview.problemProgress.added} coding progress rows added` : '') +
              (preview.interviewRounds ? `, ${preview.interviewRounds.added} interview rounds added` : '') +
              '. Tip: download a backup first.'
            : ''
        }
        confirmText="Import"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={runImport}
      />
    </div>
  );
}
