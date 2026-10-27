import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineCloudUpload,
  HiOutlineDocumentDownload,
  HiOutlineExclamation,
  HiOutlineCheckCircle,
  HiOutlineDocumentText,
} from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import usePageTitle from '../../hooks/usePageTitle';

const MAX_FILE_MB = 10; // same as the server limit
const SAMPLE_URL = '/samples/bulk-upload-sample.json';

const STATUS = {
  new: { label: 'New', className: 'bg-green-100 text-green-800' },
  update: { label: 'Update', className: 'bg-brand-100 text-brand-700' },
  skip: { label: 'Problem', className: 'bg-amber-100 text-amber-800' },
  error: { label: 'Problem', className: 'bg-amber-100 text-amber-800' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'update', label: 'Update' },
  { key: 'skip', label: 'Problems' },
];

const FORMAT_ROWS = [
  ['language.name', 'Required for a new language, e.g. "JavaScript"'],
  ['language.slug', 'Web address, made from the name if empty. Same slug as an existing language = add to it'],
  ['language.icon', 'Logo key, e.g. php, javascript, python (empty = first letters)'],
  ['language.isActive', 'false = hidden from visitors until you activate it'],
  ['language.topics', 'Topic names in display order, e.g. ["Basics", "OOP"]. Existing topics are kept'],
  ['type', 'qa or mcq'],
  ['topic', 'One of the topics (name or slug)'],
  ['question / answer', 'Required. For an MCQ the answer is the explanation shown after the quiz'],
  [
    'answer parts (optional)',
    'Separate parts with an empty line and start each with a label: "Short answer:", "How it works:", "Example:", "Common mistake:", "Interview tip:" (MCQ: "Why B:", "Why not A:"). Lines like "200 OK: meaning" become a list',
  ],
  ['options', 'MCQ only: exactly 4 different options'],
  ['correctAnswer / correctOption', 'MCQ only: the correct option text, or its number 0-3'],
  ['difficulty', 'easy, medium or hard (default easy)'],
  ['isFree', 'Not used any more: the first topic of every language is free'],
  ['codeSnippet, tags', 'Optional'],
];

function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.skip;
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${s.className}`}>{s.label}</span>;
}

function Counts({ result }) {
  const { languages, questions, dryRun } = result;
  const tiles = [
    { label: dryRun ? 'New questions' : 'Questions added', value: questions.added, className: 'bg-green-50 text-green-800' },
    { label: dryRun ? 'Questions to update' : 'Questions updated', value: questions.updated, className: 'bg-brand-50 text-brand-700' },
    { label: dryRun ? 'With problems (skipped)' : 'Skipped', value: questions.skipped, className: 'bg-amber-50 text-amber-800' },
    { label: 'Languages', value: `${languages.added} new · ${languages.updated} existing`, className: 'bg-slate-50 text-slate-800' },
  ];
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <li key={t.label} className={`rounded-md p-3 ${t.className}`}>
          <p className="text-xs opacity-80">{t.label}</p>
          <p className="text-lg font-semibold">{t.value}</p>
        </li>
      ))}
    </ul>
  );
}

function LanguageList({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((l, i) => (
        <li key={`${l.slug}-${i}`} className="rounded-md border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={l.status} />
            <span className="font-semibold text-slate-900">{l.name || '(no name)'}</span>
            {l.slug && <span className="text-slate-500">/{l.slug}</span>}
          </div>
          {l.reason && <p className="mt-1 text-amber-800">{l.reason}</p>}
          {l.status !== 'error' && (
            <p className="mt-1 text-slate-600">
              {l.topicsNew.length ? `New topics: ${l.topicsNew.join(', ')}` : 'No new topics'} · {l.topicCount} topics in total
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function QuestionTable({ items, moreItems }) {
  const [filter, setFilter] = useState('all');
  const counts = useMemo(() => {
    const c = { all: items.length, new: 0, update: 0, skip: 0 };
    items.forEach((i) => (c[i.status] += 1));
    return c;
  }, [items]);
  const shown = filter === 'all' ? items : items.filter((i) => i.status === filter);

  if (!items.length) return <p className="text-sm text-slate-500">No questions in this file.</p>;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Filter questions">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === f.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>
      <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Topic</th>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Free</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((q) => (
              <tr key={q.row} className={q.status === 'skip' ? 'bg-amber-50/50' : ''}>
                <td className="px-3 py-2 text-slate-500">{q.row}</td>
                <td className="px-3 py-2">
                  <p className="text-slate-900">{q.question || '(empty)'}</p>
                  {q.reason && <p className="mt-0.5 text-xs text-amber-800">{q.reason}</p>}
                </td>
                <td className="px-3 py-2 uppercase text-slate-600">{q.type || '-'}</td>
                <td className="px-3 py-2 text-slate-600">{q.topic || '-'}</td>
                <td className="px-3 py-2 capitalize text-slate-600">{q.difficulty}</td>
                <td className="px-3 py-2 text-slate-600">{q.isFree ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={q.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {moreItems && <p className="mt-2 text-xs text-slate-500">Only the first 2000 questions are listed; all of them are imported.</p>}
    </div>
  );
}

/**
 * /admin/upload — IPP-1006 bulk upload: one JSON file with a language, its topics and questions.
 * The file is checked first (dry run, nothing saved) and shown row by row; import only adds or updates.
 */
export default function AdminUploadPage() {
  usePageTitle('Admin · Bulk upload');
  const fileInput = useRef(null);
  const [languages, setLanguages] = useState([]);
  const [exportSlug, setExportSlug] = useState('');
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null); // { name, data }
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    api
      .get('/languages', { params: { all: true } })
      .then(({ data }) => setLanguages(data.data.languages))
      .catch(() => setLanguages([]));
  }, []);

  // An existing language as an upload file: edit it offline, then upload it again
  const downloadLanguage = async () => {
    if (!exportSlug) return;
    setExporting(true);
    try {
      const { data } = await api.get('/admin/backup/export');
      const { languages: all, questions } = data.data.backup;
      const language = all.find((l) => l.slug === exportSlug);
      const pack = {
        language: { ...language, topics: language.topics.map((t) => t.name) },
        questions: questions
          .filter((q) => q.language === exportSlug)
          .map((q) => {
            const copy = { ...q };
            delete copy.language; // taken from "language" above
            return copy;
          }),
      };
      downloadJson(pack, `${exportSlug}-upload.json`);
      toast.success(`${language.name}: ${pack.questions.length} questions downloaded`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setFileError('');
    if (fileInput.current) fileInput.current.value = '';
  };

  // Read the file and check it on the server without saving
  const checkFile = async (chosen) => {
    setPreview(null);
    setResult(null);
    setFileError('');
    if (!chosen) return;
    if (!/\.json$/i.test(chosen.name)) {
      setFileError('Please choose a .json file');
      return;
    }
    if (chosen.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`The file is larger than ${MAX_FILE_MB} MB`);
      return;
    }
    let data;
    try {
      data = JSON.parse(await chosen.text());
    } catch (err) {
      setFileError(`This file is not valid JSON (${err.message}). Tip: check for a missing comma or quote.`);
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

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (checking || importing) return;
    checkFile(e.dataTransfer.files?.[0]);
  };

  const runImport = async () => {
    setConfirmOpen(false);
    setImporting(true);
    try {
      const { data: res } = await api.post('/admin/backup/import', file.data);
      setResult(res.data);
      setPreview(null);
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const shownResult = result || preview;
  const canImport =
    preview && preview.questions.added + preview.questions.updated + preview.languages.added + preview.languages.updated > 0;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bulk upload</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add a language with its topics and all its questions from one file. You see every row before anything is saved.
        </p>
      </div>

      {/* Step 1: prepare */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <HiOutlineDocumentText className="text-brand-600" /> 1. Prepare the file
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <a
            href={SAMPLE_URL}
            download="bulk-upload-sample.json"
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <HiOutlineDocumentDownload size={18} /> Download sample file
          </a>
          {languages.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Or edit an existing language</span>
                <select
                  value={exportSlug}
                  onChange={(e) => setExportSlug(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">Choose language</option>
                  {languages.map((l) => (
                    <option key={l.slug} value={l.slug}>
                      {l.name}
                      {l.isActive ? '' : ' (inactive)'}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="secondary" onClick={downloadLanguage} loading={exporting} disabled={!exportSlug}>
                Download as upload file
              </Button>
            </div>
          )}
        </div>

        <details className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-800">File format</summary>
          <p className="mt-2 text-slate-600">
            {'{ "language": { ... }, "questions": [ ... ] }'} — open the sample file to see a full example. A backup file from
            Admin → Backup also works.
          </p>
          <table className="mt-2 w-full text-left text-xs sm:text-sm">
            <tbody className="divide-y divide-slate-200">
              {FORMAT_ROWS.map(([field, text]) => (
                <tr key={field}>
                  <td className="whitespace-nowrap py-1.5 pr-3 font-mono text-slate-800">{field}</td>
                  <td className="py-1.5 text-slate-600">{text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-slate-600">
            <li>Same language + same question text = the question is updated, not added twice.</li>
            <li>Nothing is deleted. Fields you leave out of "language" are not changed.</li>
          </ul>
        </details>
      </section>

      {/* Step 2: upload */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <HiOutlineCloudUpload className="text-brand-600" /> 2. Upload and check
        </h2>

        {!preview && !result && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center transition ${
              dragging ? 'border-brand-600 bg-brand-50' : 'border-slate-300 hover:border-brand-600 hover:bg-slate-50'
            }`}
          >
            <HiOutlineCloudUpload size={36} className="text-brand-600" />
            <span className="mt-2 text-sm font-semibold text-slate-800">
              {checking ? 'Checking the file...' : 'Drop the .json file here or click to choose'}
            </span>
            <span className="mt-1 text-xs text-slate-500">Max {MAX_FILE_MB} MB · nothing is saved in this step</span>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              disabled={checking || importing}
              onChange={(e) => checkFile(e.target.files?.[0])}
            />
          </label>
        )}

        {fileError && (
          <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{fileError}</span>
            {file && (
              <button type="button" onClick={reset} className="font-semibold underline">
                Choose another file
              </button>
            )}
          </div>
        )}

        {shownResult && (
          <div className="mt-4 space-y-5">
            {result ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                <HiOutlineCheckCircle size={18} /> Import finished — {file.name}
              </p>
            ) : (
              <p className="text-sm text-slate-700">
                <strong>{file.name}</strong>: checked, nothing saved yet.
              </p>
            )}

            <Counts result={shownResult} />

            {shownResult.questions.skipped > 0 && !result && (
              <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                <HiOutlineExclamation className="mt-0.5 shrink-0" />
                Rows marked "Problem" will be skipped. Fix them in the file and upload it again, or import the rest now.
              </p>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Language</h3>
              <LanguageList items={shownResult.languageItems} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Questions</h3>
              <QuestionTable items={shownResult.items || []} moreItems={shownResult.moreItems} />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {preview && (
                <Button onClick={() => setConfirmOpen(true)} loading={importing} disabled={!canImport}>
                  Import now
                </Button>
              )}
              {result && (
                <Link
                  to="/admin/questions"
                  className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  View questions
                </Link>
              )}
              <Button variant="secondary" onClick={reset} disabled={importing}>
                {result ? 'Upload another file' : 'Choose another file'}
              </Button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Import this file?"
        text={
          preview
            ? `${preview.questions.added} questions will be added and ${preview.questions.updated} updated` +
              (preview.questions.skipped ? `; ${preview.questions.skipped} with problems will be skipped.` : '.') +
              ' Tip: download a backup first (Admin → Backup).'
            : ''
        }
        confirmText="Import"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={runImport}
      />
    </div>
  );
}
