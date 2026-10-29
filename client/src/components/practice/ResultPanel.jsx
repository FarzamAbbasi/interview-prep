import { HiOutlineLightBulb } from 'react-icons/hi';
import { showArgs } from '../../utils/codeRunner';

/**
 * IPP-1717: bottom part of the Solve page: Testcase / Test result / Console.
 *   run = null | { mode: 'run' | 'submit', running, compileError, results: [], cases: [{ label, args, test, custom }] }
 */

// One word summary of a finished run
function runStatus(run) {
  if (!run || run.running) return null;
  if (run.compileError) {
    return { title: run.compileError.name === 'SyntaxError' ? 'Syntax Error' : 'Error', tone: 'bad' };
  }
  const graded = run.cases.map((c, i) => ({ c, r: run.results[i] })).filter(({ c }) => !c.custom);
  if (graded.some(({ r }) => r?.timedOut)) return { title: 'Time Limit Exceeded', tone: 'warn' };
  if (graded.some(({ r }) => r?.error)) return { title: 'Runtime Error', tone: 'bad' };
  if (graded.some(({ r }) => !r?.passed)) return { title: 'Wrong Answer', tone: 'bad' };
  return { title: run.mode === 'submit' ? 'Accepted' : 'All test cases passed', tone: 'ok' };
}

const TONE = {
  ok: 'text-green-700',
  bad: 'text-red-700',
  warn: 'text-amber-700',
};

const Box = ({ label, children, tone = 'plain' }) => {
  const styles = {
    plain: 'bg-slate-100 text-slate-900',
    ok: 'bg-green-50 text-green-800',
    bad: 'bg-red-50 text-red-800',
    warn: 'bg-amber-50 text-amber-800',
  };
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <pre className={`overflow-x-auto whitespace-pre-wrap break-words rounded-md p-2.5 font-mono text-[13px] ${styles[tone]}`}>{children}</pre>
    </div>
  );
};

const errorText = (e) => `${e.name}: ${e.message}${e.line ? `  (line ${e.line})` : ''}`;

export default function ResultPanel({ problem, run, tab, onTab, selected, onSelect, custom, onCustom }) {
  const visible = problem.tests.filter((t) => t.visible);
  const status = runStatus(run);
  const caseIndex = run && selected < run.cases.length ? selected : 0;
  const current = run?.cases[caseIndex];
  const result = run?.results[caseIndex];
  const passedCount = run ? run.cases.filter((c, i) => !c.custom && run.results[i]?.passed).length : 0;
  const gradedCount = run ? run.cases.filter((c) => !c.custom).length : 0;
  const totalMs = run ? run.results.reduce((n, r) => n + (r?.ms || 0), 0) : 0;
  const logCount = run ? run.results.reduce((n, r) => n + (r?.logs?.length || 0), 0) : 0;

  const tabs = [
    { key: 'testcase', label: 'Testcase' },
    { key: 'result', label: 'Test result' },
    { key: 'console', label: `Console${logCount ? ` (${logCount})` : ''}` },
  ];

  // Testcase tab: which visible case (or the custom one) is open
  const tcIndex = custom.selected;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex shrink-0 gap-5 border-b border-slate-200 px-4 text-sm" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => onTab(t.key)}
            className={`border-b-2 py-2 ${tab === t.key ? 'border-brand-600 font-semibold text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* ---- Testcase ---- */}
        {tab === 'testcase' && (
          <div>
            <div className="flex flex-wrap gap-2 text-sm">
              {visible.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onCustom({ ...custom, selected: i })}
                  className={`rounded-md px-3 py-1 ${tcIndex === i ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Case {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onCustom({ ...custom, selected: 'custom', enabled: true })}
                className={`rounded-md border border-dashed px-3 py-1 ${tcIndex === 'custom' ? 'border-brand-600 text-brand-700' : 'border-slate-300 text-brand-700'}`}
              >
                + Your input
              </button>
            </div>

            {tcIndex === 'custom' ? (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-slate-500" htmlFor="custom-args">
                  Arguments as a JSON array, e.g. {showArgs([visible[0]?.args])}
                </label>
                <textarea
                  id="custom-args"
                  value={custom.text}
                  onChange={(e) => onCustom({ ...custom, text: e.target.value })}
                  rows={3}
                  spellCheck="false"
                  className="w-full rounded-md border border-slate-300 bg-slate-100 p-2.5 font-mono text-[13px] text-slate-900 outline-none focus:border-brand-600"
                />
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className={custom.error ? 'text-red-600' : 'text-slate-500'}>
                    {custom.error || 'Run shows what your function returns for this input (no expected answer).'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCustom({ ...custom, enabled: false, selected: 0 })}
                    className="shrink-0 text-slate-500 hover:text-slate-900"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              visible[tcIndex] &&
              visible[tcIndex].args.map((arg, i) => (
                <div key={i} className="mt-3">
                  <Box label={`Argument ${i + 1}`}>{JSON.stringify(arg)}</Box>
                </div>
              ))
            )}
            <p className="mt-4 text-xs text-slate-500">
              Run = these cases{custom.enabled ? ' + your input' : ''} · Submit = all {problem.tests.length} tests (hidden ones too) · Ctrl+Enter = Run
            </p>
          </div>
        )}

        {/* ---- Test result ---- */}
        {tab === 'result' &&
          (!run ? (
            <p className="py-6 text-center text-sm text-slate-500">Run your code to see the results here.</p>
          ) : run.running ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              Running {run.mode === 'submit' ? 'all tests' : 'your code'}...
            </p>
          ) : run.compileError ? (
            <div>
              <p className={`text-lg font-bold ${TONE.bad}`}>{status.title}</p>
              <div className="mt-3">
                <Box label="Message" tone="bad">
                  {errorText(run.compileError)}
                </Box>
              </div>
              <p className="mt-2 text-xs text-slate-500">The code could not start. Check brackets, commas and the function name.</p>
            </div>
          ) : (
            <div>
              <p className={`text-lg font-bold ${TONE[status.tone]}`}>
                {status.title}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {passedCount} / {gradedCount} passed · {Math.round(totalMs)} ms
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {run.cases.map((c, i) => {
                  const r = run.results[i];
                  const notRun = !r;
                  const cls = c.custom
                    ? 'bg-slate-100 text-slate-700'
                    : notRun
                      ? 'bg-slate-100 text-slate-400'
                      : r.passed
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700';
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSelect(i)}
                      className={`rounded-md px-3 py-1 ${cls} ${caseIndex === i ? 'ring-2 ring-brand-600' : ''}`}
                    >
                      {c.custom ? '●' : notRun ? '–' : r.passed ? '✔' : '✗'} {c.label}
                    </button>
                  );
                })}
              </div>

              {current && (
                <div className="mt-4 space-y-3">
                  <Box label="Input">{showArgs(current.args)}</Box>
                  {!result ? (
                    <p className="text-sm text-slate-500">Not run: an earlier test was stopped.</p>
                  ) : result.timedOut ? (
                    <Box label="Result" tone="warn">
                      Stopped after 2 seconds. A loop probably never ends, or the code is far too slow.
                    </Box>
                  ) : result.error ? (
                    <Box label="Error" tone="bad">
                      {errorText(result.error)}
                    </Box>
                  ) : (
                    <div className={`grid gap-3 ${current.custom ? '' : 'sm:grid-cols-2'}`}>
                      {!current.custom && <Box label="Expected" tone="ok">{result.expected}</Box>}
                      <Box label="Your output" tone={current.custom ? 'plain' : result.passed ? 'ok' : 'bad'}>
                        {result.output}
                      </Box>
                    </div>
                  )}
                  {!current.custom && result && !result.passed && current.test?.failHint && (
                    <p className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900">
                      <HiOutlineLightBulb className="mt-0.5 shrink-0" />
                      {current.test.failHint}
                    </p>
                  )}
                  {result?.logs?.length > 0 && <Box label="Console">{result.logs.join('\n')}</Box>}
                </div>
              )}
            </div>
          ))}

        {/* ---- Console ---- */}
        {tab === 'console' &&
          (!run || run.running || !logCount ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Use console.log() in your code. Its output shows here, case by case.
            </p>
          ) : (
            <pre className="whitespace-pre-wrap break-words rounded-md bg-slate-100 p-3 font-mono text-[13px] leading-6 text-slate-900">
              {run.cases
                .map((c, i) => (run.results[i]?.logs || []).map((line) => `${c.label} › ${line}`).join('\n'))
                .filter(Boolean)
                .join('\n')}
            </pre>
          ))}
      </div>
    </section>
  );
}
