/**
 * IPP-1715: checks a problems file before it goes into the database.
 *   checkProblemsFile(json) -> { problems: [...ready to save], errors: [...] }
 * Every problem's solution is run against its own tests (in a sandbox with a 1 second limit),
 * so a wrong test or a wrong solution never reaches users.
 */
const vm = require('vm');
const slugify = require('./slugify');

const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Same value -> same text, whatever the key order (used to compare results)
const CANONICAL = `function __canon(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v); // NaN, Infinity, -Infinity (JSON would say null)
  if (Array.isArray(v)) return '[' + v.map(__canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + __canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}`;
const canonical = new vm.Script(`${CANONICAL}; __canon`).runInNewContext();

// Run `functionName(...args)` from `code` in a fresh sandbox. Returns { ok, got } or { error }.
function runTest(code, functionName, test) {
  try {
    const context = { __args: JSON.parse(JSON.stringify(test.args)) };
    const got = vm.runInNewContext(`${CANONICAL}\n${code}\n;__canon(${functionName}(...__args));`, context, {
      timeout: 1000,
    });
    return { ok: got === canonical(test.expected), got };
  } catch (error) {
    return { error: error.message };
  }
}

function checkOne(p, index, topicOrderOf, seen) {
  const errors = [];
  const at = `#${index + 1} ${p?.slug || p?.title || ''}`.trim();
  const need = ['title', 'slug', 'topic', 'description', 'functionName', 'starterCode', 'tests', 'solution'];
  need.forEach((k) => {
    if (p?.[k] === undefined || p?.[k] === '') errors.push(`${at}: "${k}" is missing`);
  });
  if (errors.length) return { errors };

  const slug = slugify(p.slug);
  if (seen.has(slug)) errors.push(`${at}: slug "${slug}" is used twice`);
  seen.add(slug);
  if (!DIFFICULTIES.includes(p.difficulty)) errors.push(`${at}: difficulty must be easy, medium or hard`);
  if (!/^[A-Za-z_$][\w$]*$/.test(p.functionName)) errors.push(`${at}: invalid functionName`);
  if (!Array.isArray(p.tests) || p.tests.length === 0) errors.push(`${at}: needs tests`);
  else {
    if (!p.tests.some((t) => t.visible)) errors.push(`${at}: needs at least one visible test`);
    p.tests.forEach((t, i) => {
      if (!Array.isArray(t.args)) errors.push(`${at}: test ${i + 1} "args" must be an array`);
    });
  }

  // The solution must pass every test, and the starter code must not
  if (!errors.length) {
    for (const [i, t] of p.tests.entries()) {
      const r = runTest(p.solution.code, p.functionName, t);
      if (r.error) {
        errors.push(`${at}: solution throws on test ${i + 1}: ${r.error}`);
        break; // one error is enough (a timeout would repeat for every test)
      }
      if (!r.ok) errors.push(`${at}: solution fails test ${i + 1} (got ${r.got})`);
    }
    const starterPassesAll = p.tests.every((t) => runTest(p.starterCode, p.functionName, t).ok);
    if (starterPassesAll) errors.push(`${at}: starter code already passes all tests`);
  }

  if (!topicOrderOf.has(p.topic)) topicOrderOf.set(p.topic, topicOrderOf.size + 1);
  const problem = {
    slug,
    title: String(p.title).trim(),
    topic: String(p.topic).trim(),
    topicSlug: slugify(p.topic),
    topicOrder: topicOrderOf.get(p.topic),
    order: Number(p.order) || index + 1,
    difficulty: p.difficulty,
    isFree: Boolean(p.isFree),
    scenario: p.scenario || '',
    description: p.description,
    functionName: p.functionName,
    starterCode: p.starterCode,
    examples: p.examples || [],
    constraints: p.constraints || [],
    tests: p.tests.map((t) => ({
      args: t.args,
      expected: t.expected,
      visible: Boolean(t.visible),
      failHint: t.failHint || '',
    })),
    hints: p.hints || [],
    solution: { code: p.solution.code || '', explanation: p.solution.explanation || '' },
    followUp: p.followUp || '',
    relatedTopic: p.relatedTopic || '',
    companies: p.companies || [],
  };
  return { problem, errors };
}

/**
 * Check every problem of ONE language. Returns one result per problem: { raw, problem?, errors }
 * (IPP-1723: the backup import uses this to skip only the broken problems).
 */
function checkProblemsList(list) {
  const topicOrderOf = new Map();
  const seen = new Set();
  return list.map((p, i) => ({ raw: p, ...checkOne(p, i, topicOrderOf, seen) }));
}

function checkProblemsFile(json) {
  const list = Array.isArray(json?.problems) ? json.problems : null;
  if (!list) return { problems: [], errors: ['The file needs a "problems" array'] };
  const problems = [];
  const errors = [];
  checkProblemsList(list).forEach((r) => {
    errors.push(...r.errors);
    if (r.problem) problems.push(r.problem);
  });
  return { problems, errors };
}

module.exports = { checkProblemsFile, checkProblemsList, runTest };
