import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiChevronLeft,
  HiChevronRight,
  HiOutlineViewList,
  HiOutlinePlay,
  HiOutlinePause,
  HiOutlineRefresh,
  HiOutlineArrowsExpand,
} from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import PageLoader from '../../components/ui/PageLoader';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import UpgradePrompt from '../../components/routes/UpgradePrompt';
import CodeEditor from '../../components/practice/CodeEditor';
import ProblemPanel from '../../components/practice/ProblemPanel';
import ResultPanel from '../../components/practice/ResultPanel';
import AcceptedDialog from '../../components/practice/AcceptedDialog';
import { runCode } from '../../utils/codeRunner';
import { loadCode, saveCode, clearCode, loadStats, saveStats, loadFontSize, saveFontSize } from '../../utils/practiceStorage';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const SYMBOLS = ['(', ')', '{', '}', '[', ']', ';', '=>', "'", '.', '='];

/**
 * /practice/:language/:slug   (IPP-1717, public; login optional)
 * Loads the problem, then shows the workspace. Locked problems show the upgrade card.
 */
export default function SolvePage() {
  const { language: languageSlug, slug } = useParams();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null });

  const key = `${languageSlug}|${slug}|${user?._id || ''}|${attempt}`;
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/problems/${languageSlug}/${slug}`)
      .then(({ data: res }) => !cancelled && setResult({ key, data: res.data }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({ key, error: getErrorMessage(err), status: err.response?.status, code: err.response?.data?.code })
      );
    return () => {
      cancelled = true;
    };
  }, [key, languageSlug, slug]);

  usePageTitle(result.key === key && result.data ? result.data.problem.title : 'Practice');

  if (result.key !== key) return <PageLoader text="Loading problem..." />;
  if (result.code === 'NEEDS_FULL_ACCESS') {
    return (
      <div className="py-10">
        <UpgradePrompt
          title="This problem needs full access"
          text="Get full access to open every coding problem with all hints, solutions and explanations."
        />
        <p className="mt-4 text-center text-sm">
          <Link to={`/practice/${languageSlug}`} className="text-brand-700 hover:underline">
            Back to the free problems
          </Link>
        </p>
      </div>
    );
  }
  if (result.error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-slate-600">{result.status === 404 ? 'This problem does not exist.' : result.error}</p>
        {result.status === 404 ? (
          <Link
            to="/practice"
            className="mt-4 inline-block rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            All problems
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-4 rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
        )}
      </div>
    );
  }
  // key: another problem = a fresh workspace (editor, results, timer)
  return <Workspace key={`${languageSlug}/${slug}`} data={result.data} />;
}

function Workspace({ data }) {
  const { language, hasAccess, problem, nav, progress } = data; // progress: null for guests (IPP-1718)
  const location = useLocation();
  const lang = language.slug;
  const visible = problem.tests.filter((t) => t.visible);
  const listUrl = `/practice/${lang}`;
  const urlOf = (item) => item && `/practice/${lang}/${item.slug}`;

  const editorRef = useRef(null);
  const saveTimer = useRef(null);
  // Code: this browser first, then the last submit saved on the server (another device), then the starter code
  const [initialCode] = useState(() => loadCode(lang, problem.slug) ?? (progress?.code || problem.starterCode));
  const [saved, setSaved] = useState(true);
  const [fontSize, setFontSize] = useState(loadFontSize);
  const [stats, setStats] = useState(() => {
    const local = loadStats(lang, problem.slug);
    return { fails: Math.max(local.fails, progress?.fails || 0), solved: Boolean(local.solved || progress?.solved) };
  });
  const [revealed, setRevealed] = useState(false);
  const [leftTab, setLeftTab] = useState('description');
  const [resultTab, setResultTab] = useState('testcase');
  const [run, setRun] = useState(null);
  const [selected, setSelected] = useState(0);
  const [custom, setCustom] = useState({ enabled: false, selected: 0, text: JSON.stringify(visible[0]?.args ?? []), error: '' });
  const [errorLine, setErrorLine] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [wide, setWide] = useState(false);
  const [mobileTab, setMobileTab] = useState('problem');
  const [accepted, setAccepted] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  // Timer (pauses when solved or when the user pauses it)
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);

  // Save the code shortly after typing stops; also when leaving the page
  const onCodeChange = (code) => {
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveCode(lang, problem.slug, code);
      setSaved(true);
    }, 600);
  };
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      const code = editorRef.current?.getValue();
      if (code !== undefined) saveCode(lang, problem.slug, code);
    },
    [lang, problem.slug]
  );

  const changeFont = (delta) => {
    const size = Math.min(20, Math.max(12, fontSize + delta));
    setFontSize(size);
    saveFontSize(size);
  };

  const updateStats = (next) => {
    setStats(next);
    saveStats(lang, problem.slug, next);
  };

  const execute = async (mode) => {
    if (run?.running || !editorRef.current) return;
    const code = editorRef.current.getValue();

    let cases;
    if (mode === 'submit') {
      let hidden = 0;
      let shown = 0;
      cases = problem.tests.map((t) => ({
        label: t.visible ? `Case ${++shown}` : `Hidden ${++hidden}`,
        args: t.args,
        test: t,
      }));
    } else {
      cases = visible.map((t, i) => ({ label: `Case ${i + 1}`, args: t.args, test: t }));
      if (custom.enabled) {
        let args;
        try {
          args = JSON.parse(custom.text);
        } catch {
          args = null;
        }
        if (!Array.isArray(args)) {
          setCustom({ ...custom, selected: 'custom', error: 'Write the arguments as a JSON array, e.g. ["hello"]' });
          setResultTab('testcase');
          setMobileTab('result');
          return;
        }
        setCustom({ ...custom, error: '' });
        cases.push({ label: 'Your input', args, custom: true, test: { args, expected: null } });
      }
    }

    setRun({ mode, running: true, cases, results: [] });
    setResultTab('result');
    setMobileTab('result');
    setErrorLine(null);

    const out = await runCode({ code, functionName: problem.functionName, tests: cases.map((c) => c.test) });
    let compileError = out.compileError || null;
    if (compileError?.name === 'SyntaxError' && !compileError.line) {
      compileError = { ...compileError, line: editorRef.current?.syntaxErrorLine() || null };
    }
    const firstFail = cases.findIndex((c, i) => !c.custom && !out.results[i]?.passed);
    setSelected(firstFail >= 0 ? firstFail : 0);
    setErrorLine(compileError?.line || (firstFail >= 0 ? out.results[firstFail]?.error?.line : null) || null);
    setRun({ mode, running: false, cases, results: out.results, compileError });

    if (mode === 'submit') {
      const allPassed = !compileError && cases.every((c, i) => out.results[i]?.passed);
      const local = allPassed ? { ...stats, solved: true } : { ...stats, fails: stats.fails + 1 };
      updateStats(local);
      if (allPassed) {
        setPaused(true);
        setAccepted({ attempts: stats.fails + 1, runtimeMs: out.results.reduce((n, r) => n + (r?.ms || 0), 0) });
      }
      // IPP-1718: logged-in users keep their progress on the server (every device)
      if (progress) {
        try {
          const { data: res } = await api.post(`/problems/${lang}/${problem.slug}/submit`, { passed: allPassed, code: code.slice(0, 20000) });
          const saved = res.data.progress;
          updateStats({ fails: Math.max(local.fails, saved.fails), solved: local.solved || saved.solved });
        } catch (err) {
          toast.error(`Progress not saved: ${getErrorMessage(err)}`);
        }
      }
    }
  };

  const running = Boolean(run?.running);
  const btn = 'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60';
  const navBtn = 'flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100';
  const show = (tab) => (mobileTab === tab ? 'flex' : 'hidden');

  return (
    <div className="pb-20 lg:pb-0">
      {/* Top bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <Link to={listUrl} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
          <HiOutlineViewList /> <span className="hidden sm:inline">Problems</span>
        </Link>
        {nav.prev ? (
          <Link to={nav.prev.isLocked ? '/pricing' : urlOf(nav.prev)} className={navBtn} aria-label={`Previous: ${nav.prev.title}`} title={nav.prev.title}>
            <HiChevronLeft />
          </Link>
        ) : (
          <span className={`${navBtn} opacity-40`} aria-hidden="true">
            <HiChevronLeft />
          </span>
        )}
        {nav.next ? (
          <Link to={nav.next.isLocked ? '/pricing' : urlOf(nav.next)} className={navBtn} aria-label={`Next: ${nav.next.title}`} title={nav.next.title}>
            <HiChevronRight />
          </Link>
        ) : (
          <span className={`${navBtn} opacity-40`} aria-hidden="true">
            <HiChevronRight />
          </span>
        )}
        <span className="ml-1 hidden text-sm text-slate-500 md:inline">
          {problem.topic} · {nav.index} of {nav.total}
        </span>
        {problem.isHidden && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800" title="Only admins can open it">
            Hidden from users
          </span>
        )}

        <div className="mx-auto hidden items-center gap-2 lg:flex">
          <button type="button" disabled={running} onClick={() => execute('run')} className={`${btn} border border-slate-300 text-slate-800 hover:bg-slate-100`} title="Ctrl + Enter">
            <HiOutlinePlay /> Run
          </button>
          <button type="button" disabled={running} onClick={() => execute('submit')} className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}>
            Submit
          </button>
        </div>

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="ml-auto flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-sm text-slate-800 lg:ml-0"
          aria-label={paused ? 'Resume timer' : 'Pause timer'}
          title={paused ? 'Resume timer' : 'Pause timer'}
        >
          {formatTime(seconds)} {paused ? <HiOutlinePlay className="text-slate-500" /> : <HiOutlinePause className="text-slate-500" />}
        </button>
      </div>

      {/* Mobile tabs */}
      <div className="mb-3 grid grid-cols-3 rounded-xl border border-slate-200 bg-white text-center text-sm lg:hidden">
        {[
          ['problem', 'Problem'],
          ['code', 'Code'],
          ['result', 'Result'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMobileTab(k)}
            className={`border-b-2 py-2.5 ${mobileTab === k ? 'border-brand-600 font-semibold text-slate-900' : 'border-transparent text-slate-500'}`}
          >
            {label}
            {k === 'result' && run && !run.running && run.mode && (
              <span className={`ml-1.5 inline-block h-2 w-2 rounded-full ${run.compileError || run.results.some((r, i) => !run.cases[i].custom && !r?.passed) ? 'bg-red-500' : 'bg-green-500'}`} />
            )}
          </button>
        ))}
      </div>

      {/* Workspace */}
      <div className={`grid h-[calc(100vh-17rem)] min-h-[420px] grid-cols-1 gap-3 lg:h-[calc(100vh-9.5rem)] lg:min-h-[560px] ${wide ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'}`}>
        <div className={`${show('problem')} min-h-0 min-w-0 flex-col lg:flex ${wide ? 'lg:hidden' : ''}`}>
          <ProblemPanel
            problem={problem}
            language={language}
            hasAccess={hasAccess}
            index={nav.index}
            tab={leftTab}
            onTab={setLeftTab}
            stats={stats}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
          />
        </div>

        <div className={`${mobileTab === 'problem' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col gap-3 lg:flex`}>
          {/* Editor */}
          <div className={`${show('code')} min-h-0 flex-[3] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:flex`}>
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-1.5 text-sm">
              <span className="font-mono font-medium text-slate-900">solution.js</span>
              <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 sm:inline">JavaScript</span>
              <span className="ml-auto hidden text-xs text-slate-400 sm:inline">{saved ? 'Saved' : 'Saving...'}</span>
              <button type="button" onClick={() => changeFont(-1)} className="ml-auto rounded border sm:ml-0 border-slate-300 px-1.5 text-xs text-slate-700" aria-label="Smaller text">
                A−
              </button>
              <button type="button" onClick={() => changeFont(1)} className="rounded border border-slate-300 px-1.5 text-xs text-slate-700" aria-label="Bigger text">
                A+
              </button>
              <button type="button" onClick={() => setResetOpen(true)} className="flex items-center gap-1 text-slate-600 hover:text-slate-900" title="Back to the starter code">
                <HiOutlineRefresh /> <span className="hidden sm:inline">Reset</span>
              </button>
              <button type="button" onClick={() => setWide((w) => !w)} className="hidden text-slate-600 hover:text-slate-900 lg:block" title={wide ? 'Show the problem' : 'Wide editor'} aria-label={wide ? 'Show the problem' : 'Wide editor'}>
                <HiOutlineArrowsExpand />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor
                initialValue={initialCode}
                onChange={onCodeChange}
                fontSize={fontSize}
                errorLine={errorLine}
                onRun={() => execute('run')}
                editorRef={editorRef}
              />
            </div>
            {/* Phone keyboards make these characters hard to type */}
            <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-slate-200 bg-slate-100 px-2 py-1.5 lg:hidden">
              {SYMBOLS.map((s) => (
                <button key={s} type="button" onClick={() => editorRef.current?.insert(s)} className="min-w-9 rounded bg-white px-2 py-1 font-mono text-sm text-slate-800">
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className={`${show('result')} min-h-0 flex-[2] flex-col lg:flex`}>
            <ResultPanel
              problem={problem}
              run={run}
              tab={resultTab}
              onTab={setResultTab}
              selected={selected}
              onSelect={setSelected}
              custom={custom}
              onCustom={setCustom}
            />
          </div>
        </div>
      </div>

      {/* Mobile Run / Submit */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-slate-200 bg-white p-3 lg:hidden">
        <button type="button" disabled={running} onClick={() => execute('run')} className={`${btn} flex-1 justify-center border border-slate-300 py-2.5 text-slate-800`}>
          <HiOutlinePlay /> Run
        </button>
        <button type="button" disabled={running} onClick={() => execute('submit')} className={`${btn} flex-1 justify-center bg-brand-600 py-2.5 text-white`}>
          Submit
        </button>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Reset the code?"
        text="Your code for this problem will be replaced by the starter code."
        confirmText="Reset"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          editorRef.current?.setValue(problem.starterCode);
          clearCode(lang, problem.slug);
          setErrorLine(null);
        }}
      />

      <AcceptedDialog
        open={Boolean(accepted)}
        title={problem.title}
        tests={problem.tests.length}
        seconds={seconds}
        attempts={accepted?.attempts}
        runtimeMs={accepted?.runtimeMs || 0}
        next={nav.next && { ...nav.next, url: urlOf(nav.next) }}
        listUrl={listUrl}
        loggedIn={Boolean(progress)}
        loginState={{ from: location }}
        onClose={() => setAccepted(null)}
        onSolution={() => {
          setAccepted(null);
          setLeftTab('solution');
          setMobileTab('problem');
          setWide(false);
        }}
      />
    </div>
  );
}
