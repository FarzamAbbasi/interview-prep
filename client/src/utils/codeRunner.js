/**
 * IPP-1717: runs the user's code against tests in a Web Worker (a separate thread),
 * so a slow or endless loop never freezes the page. One fresh worker per Run / Submit.
 *
 *   const run = await runCode({ code, functionName, tests, onTest });
 *   run.compileError  -> { name, message, line } when the code cannot even start
 *   run.results[i]    -> { passed, output, expected, error, logs, ms, timedOut }
 *
 * Results are compared the same way as the server check (server/utils/problemCheck.js):
 * same values = same text, whatever the key order.
 */

const PER_TEST_MS = 2000; // a test taking longer is stopped (endless loop)
const MAX_LOG_LINES = 100;

// Code that runs inside the worker. Kept as a string so it needs no extra build step.
const WORKER_SOURCE = `
function canon(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v); // NaN, Infinity, -Infinity (JSON would say null)
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  return JSON.stringify(v);
}
function show(v, depth) {
  depth = depth || 0;
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
  if (depth > 4) return Array.isArray(v) ? '[...]' : '{...}';
  if (Array.isArray(v)) return '[' + v.map(function (x) { return show(x, depth + 1); }).join(', ') + ']';
  if (v instanceof Map) return 'Map(' + v.size + ')';
  if (v instanceof Set) return 'Set(' + v.size + ') ' + show(Array.from(v), depth + 1);
  if (typeof v === 'object') {
    var keys = Object.keys(v);
    if (!keys.length) return '{}';
    return '{ ' + keys.map(function (k) { return k + ': ' + show(v[k], depth + 1); }).join(', ') + ' }';
  }
  return String(v);
}
function logText(args) {
  return Array.prototype.map.call(args, function (a) { return typeof a === 'string' ? a : show(a); }).join(' ');
}
// Line number inside the user's code (Chrome/Edge: "<anonymous>:L:C", Firefox: "Function:L:C")
function errorInfo(err) {
  var stack = String((err && err.stack) || '');
  var m = stack.match(/<anonymous>:(\\d+):(\\d+)/) || stack.match(/Function:(\\d+):(\\d+)/);
  var line = m ? Number(m[1]) - 2 : null;
  return { name: (err && err.name) || 'Error', message: (err && err.message) || String(err), line: line > 0 ? line : null };
}

var logs = null;
['log', 'info', 'warn', 'error', 'debug'].forEach(function (k) {
  console[k] = function () {
    if (logs && logs.length < ${MAX_LOG_LINES}) logs.push(logText(arguments));
  };
});

self.onmessage = async function (e) {
  var code = e.data.code, name = e.data.functionName, tests = e.data.tests;
  var fn;
  try {
    fn = new Function(code + '\\n;return typeof ' + name + " === 'function' ? " + name + ' : undefined;')();
  } catch (err) {
    self.postMessage({ type: 'compile', error: errorInfo(err) });
    return;
  }
  if (!fn) {
    self.postMessage({ type: 'compile', error: { name: 'Error', message: 'Function "' + name + '" was not found. Keep the function name from the starter code.', line: null } });
    return;
  }
  for (var i = 0; i < tests.length; i++) {
    logs = [];
    self.postMessage({ type: 'start', index: i });
    var t0 = performance.now();
    try {
      var value = fn.apply(null, JSON.parse(JSON.stringify(tests[i].args)));
      if (value && typeof value.then === 'function') value = await value;
      self.postMessage({ type: 'test', index: i, passed: canon(value) === canon(tests[i].expected), output: show(value), expected: show(tests[i].expected), logs: logs, ms: performance.now() - t0 });
    } catch (err) {
      self.postMessage({ type: 'test', index: i, passed: false, error: errorInfo(err), expected: show(tests[i].expected), logs: logs, ms: performance.now() - t0 });
    }
  }
  self.postMessage({ type: 'done' });
};
`;

let workerUrl = null;
function getWorkerUrl() {
  if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  return workerUrl;
}

export function runCode({ code, functionName, tests, onTest }) {
  return new Promise((resolve) => {
    const worker = new Worker(getWorkerUrl());
    const results = [];
    let timer = null;
    let finished = false;

    const finish = (extra = {}) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.terminate();
      resolve({ results, ...extra });
    };

    // Each test gets PER_TEST_MS; when it runs out, that test is "timed out" and the rest are not run
    const watch = (index) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        results[index] = { passed: false, timedOut: true, logs: [], ms: PER_TEST_MS, expected: JSON.stringify(tests[index]?.expected) };
        onTest?.(index, results[index]);
        finish({ stoppedAt: index });
      }, PER_TEST_MS);
    };

    worker.onmessage = ({ data }) => {
      if (data.type === 'compile') finish({ compileError: data.error });
      else if (data.type === 'start') watch(data.index);
      else if (data.type === 'test') {
        const { index, ...result } = data;
        delete result.type;
        results[index] = result;
        onTest?.(index, result);
      } else if (data.type === 'done') finish();
    };
    worker.onerror = (e) => {
      e.preventDefault?.();
      finish({ compileError: { name: 'Error', message: e.message || 'The code could not run', line: e.lineno ? e.lineno - 2 : null } });
    };

    watch(0); // also covers code that never starts (e.g. an endless loop at the top level)
    worker.postMessage({ code, functionName, tests: tests.map((t) => ({ args: t.args, expected: t.expected })) });
  });
}

// Pretty text for a test's input, e.g. ["hello", 2] -> '"hello", 2'
export function showArgs(args) {
  return (args || []).map((a) => JSON.stringify(a)).join(', ');
}

