import { useEffect, useRef, useState } from 'react';
import { HiOutlinePlay } from 'react-icons/hi';
import CodeEditor from '../practice/CodeEditor';
import ResultPanel from '../practice/ResultPanel';
import ConfirmDialog from '../ui/ConfirmDialog';
import Button from '../ui/Button';
import InterviewProblem from './InterviewProblem';
import { runCode } from '../../utils/codeRunner';
import { loadFontSize } from '../../utils/practiceStorage';
import { loadRoundState, saveRoundCode } from '../../utils/interviewStorage';

/**
 * IPP-1725: the coding question of a round. Same editor + runner as the Solve page,
 * without hints / solution. Run = visible tests (+ your input). Submit = every test, then the round goes on.
 *
 *   handleRef.current.collect() -> runs every test on the current code -> { code, passed }
 *   (the round uses it when the time is up or the user ends the round early)
 */
export default function CodingStep({ roundId, item, isLast, busy, onSubmit, handleRef }) {
  const problem = item.problem;
  const visible = problem.tests.filter((t) => t.visible);
  const editorRef = useRef(null);
  const saveTimer = useRef(null);
  // Code: this browser first (refresh), then what was saved on the server, then the starter code
  const [initialCode] = useState(() => loadRoundState(roundId)?.code ?? (item.code || problem.starterCode));
  const [fontSize] = useState(loadFontSize);
  const [run, setRun] = useState(null);
  const [resultTab, setResultTab] = useState('testcase');
  const [selected, setSelected] = useState(0);
  const [custom, setCustom] = useState({ enabled: false, selected: 0, text: JSON.stringify(visible[0]?.args ?? []), error: '' });
  const [errorLine, setErrorLine] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onCodeChange = (code) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveRoundCode(roundId, code), 500);
  };
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // Runs tests and shows them in the result panel. mode 'run' = visible (+ custom), 'submit' = all
  const execute = async (mode) => {
    const code = editorRef.current?.getValue() ?? initialCode;
    let cases;
    if (mode === 'submit') {
      let hidden = 0;
      let shown = 0;
      cases = problem.tests.map((t) => ({ label: t.visible ? `Case ${++shown}` : `Hidden ${++hidden}`, args: t.args, test: t }));
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
          return null;
        }
        setCustom({ ...custom, error: '' });
        cases.push({ label: 'Your input', args, custom: true, test: { args, expected: null } });
      }
    }

    setRun({ mode, running: true, cases, results: [] });
    setResultTab('result');
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

    const passed = compileError ? 0 : cases.filter((c, i) => !c.custom && out.results[i]?.passed).length;
    return { code: code.slice(0, 20000), passed };
  };

  // Lets the round collect the answer (time up / End round)
  useEffect(() => {
    if (handleRef) handleRef.current = { collect: () => execute('submit') };
  });

  const running = Boolean(run?.running);
  const submit = async () => {
    setConfirmOpen(false);
    const answer = await execute('submit');
    if (answer) onSubmit(answer);
  };

  return (
    <div className="mt-5 grid gap-3 lg:h-[calc(100vh-15rem)] lg:min-h-[560px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="max-h-[45vh] min-h-0 lg:max-h-none">
        <InterviewProblem problem={problem} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <div className="flex h-[360px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:h-auto lg:min-h-0 lg:flex-[3]">
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-1.5 text-sm">
            <span className="font-mono font-medium text-slate-900">solution.js</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">JavaScript</span>
            <span className="ml-auto hidden text-xs text-slate-400 sm:inline">Ctrl + Enter = Run</span>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor
              initialValue={initialCode}
              onChange={onCodeChange}
              fontSize={fontSize}
              errorLine={errorLine}
              onRun={() => !running && execute('run')}
              editorRef={editorRef}
            />
          </div>
        </div>

        <div className="h-[300px] lg:h-auto lg:min-h-0 lg:flex-[2]">
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

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => execute('run')} disabled={running || busy}>
            <HiOutlinePlay /> Run
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={running} loading={busy}>
            {isLast ? 'Submit & finish' : 'Submit & continue'}
          </Button>
          <span className="text-xs text-slate-500">Submit runs all {problem.tests.length} tests. You can&apos;t change the code after.</span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit your code?"
        text="Every test runs once and the score is saved. You can't change the code after this."
        confirmText="Submit"
        cancelText="Keep coding"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submit}
      />
    </div>
  );
}
