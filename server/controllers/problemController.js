const Problem = require('../models/Problem');
const ProblemProgress = require('../models/ProblemProgress');
const Language = require('../models/Language');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { hasLanguageAccess } = require('../utils/access');

const LIST_FIELDS = 'slug title topic topicSlug topicOrder order difficulty isFree';
const SORT = { topicOrder: 1, order: 1, _id: 1 };

// IPP-1718: this user's progress rows, by problem id (empty for guests)
async function progressMap(user, filter) {
  if (!user) return new Map();
  const rows = await ProblemProgress.find({ user: user._id, ...filter }).select('problem solved submits fails code updatedAt').lean();
  return new Map(rows.map((r) => [String(r.problem), r]));
}

const statusOf = (row) => (row ? (row.solved ? 'solved' : 'attempted') : null);

async function findActiveLanguage(slug) {
  const language = await Language.findOne({ slug: String(slug).toLowerCase(), isActive: true }, 'name slug').lean();
  if (!language) throw new AppError('Language not found', 404);
  return language;
}

/**
 * GET /api/problems?language=javascript   (IPP-1715, public; login optional)
 * All problems of a language in order, grouped info per topic.
 * Locked problems (not free + no access to this language) show only their title and level.
 */
async function getProblems(req, res) {
  const language = await findActiveLanguage(req.query.language);
  const hasAccess = hasLanguageAccess(req.user, language._id);
  const items = await Problem.find({ language: language._id, isActive: true }).select(LIST_FIELDS).sort(SORT).lean();
  const progress = await progressMap(req.user, { language: language._id }); // IPP-1718

  const topics = [];
  const solvedByLevel = { easy: 0, medium: 0, hard: 0 };
  const bySlug = new Map();
  const problems = items.map((p) => {
    if (!bySlug.has(p.topicSlug)) {
      const t = { name: p.topic, slug: p.topicSlug, total: 0, free: 0, solved: 0 };
      bySlug.set(p.topicSlug, t);
      topics.push(t);
    }
    const topic = bySlug.get(p.topicSlug);
    topic.total += 1;
    if (p.isFree) topic.free += 1;
    const row = progress.get(String(p._id));
    if (row?.solved) {
      topic.solved += 1;
      solvedByLevel[p.difficulty] += 1;
    }
    return {
      _id: p._id,
      slug: p.slug,
      title: p.title,
      topic: p.topic,
      topicSlug: p.topicSlug,
      difficulty: p.difficulty,
      isFree: p.isFree,
      isLocked: !p.isFree && !hasAccess,
      status: statusOf(row), // IPP-1718: 'solved' | 'attempted' | null
      lastTriedAt: row?.updatedAt || null,
    };
  });

  // IPP-1718: "Continue" card = the last problem tried but not solved, else the first open one not solved yet
  let continueItem = null;
  if (req.user) {
    const open = problems.filter((p) => !p.isLocked && p.status !== 'solved');
    const tried = open.filter((p) => p.status === 'attempted').sort((a, b) => new Date(b.lastTriedAt) - new Date(a.lastTriedAt))[0];
    const pick = tried || open[0];
    if (pick) {
      const row = progress.get(String(pick._id));
      continueItem = {
        kind: tried ? 'attempted' : 'next',
        slug: pick.slug,
        title: pick.title,
        topic: pick.topic,
        difficulty: pick.difficulty,
        submits: row?.submits || 0,
        lastTriedAt: row?.updatedAt || null,
      };
    }
  }

  const solved = req.user ? { total: Object.values(solvedByLevel).reduce((a, b) => a + b, 0), ...solvedByLevel } : null;
  sendSuccess(res, { language, hasAccess, topics, problems, solved, continue: continueItem });
}

/**
 * GET /api/problems/:language/:slug   (IPP-1715, public; login optional)
 * One problem with its tests (the code runs in the browser).
 * Without access to the language: free problems only, with the first hint and no solution.
 */
async function getProblem(req, res) {
  const language = await findActiveLanguage(req.params.language);
  const hasAccess = hasLanguageAccess(req.user, language._id);
  // IPP-1721: admins can also open a hidden problem, to check it before showing it
  const isAdmin = req.user?.role === 'admin';
  const problem = await Problem.findOne({ language: language._id, slug: req.params.slug, ...(isAdmin ? {} : { isActive: true }) })
    .select('-language -createdAt -updatedAt -__v')
    .lean();
  if (!problem) throw new AppError('Problem not found', 404);
  if (!problem.isFree && !hasAccess) {
    throw new AppError('This problem needs full access', 403, undefined, 'NEEDS_FULL_ACCESS');
  }

  // Position inside its topic, for the ‹ › buttons and "4 of 5"
  const siblings = await Problem.find({ language: language._id, topicSlug: problem.topicSlug, ...(isAdmin ? {} : { isActive: true }) })
    .select('slug title isFree')
    .sort(SORT)
    .lean();
  const index = siblings.findIndex((s) => s.slug === problem.slug);
  const navItem = (s) => s && { slug: s.slug, title: s.title, isLocked: !s.isFree && !hasAccess };

  const { isActive, ...rest } = problem;
  if (isAdmin) rest.isHidden = !isActive; // shown as a note on the Solve page
  const hintsTotal = problem.hints.length;
  const result = {
    ...rest,
    hints: hasAccess ? problem.hints : problem.hints.slice(0, 1),
    hintsTotal,
    solution: hasAccess ? problem.solution : null,
    solutionLocked: !hasAccess,
  };
  // IPP-1718: the user's progress (code comes back on any device)
  const row = (await progressMap(req.user, { problem: problem._id })).get(String(problem._id));
  const progress = req.user
    ? { solved: Boolean(row?.solved), submits: row?.submits || 0, fails: row?.fails || 0, code: row?.code || '' }
    : null;

  sendSuccess(res, {
    language,
    hasAccess,
    problem: result,
    progress,
    nav: {
      index: index + 1,
      total: siblings.length,
      prev: navItem(siblings[index - 1]),
      next: navItem(siblings[index + 1]),
    },
  });
}

/**
 * POST /api/problems/:language/:slug/submit   (IPP-1718, logged in)
 * Body: { passed: true | false, code: "..." }  saves the result of a Submit.
 * The code runs in the browser, so the browser reports the result (fine for practice; no ranking depends on it).
 */
async function submitProblem(req, res) {
  const language = await findActiveLanguage(req.params.language);
  const problem = await Problem.findOne({ language: language._id, slug: req.params.slug, isActive: true }).select('isFree').lean();
  if (!problem) throw new AppError('Problem not found', 404);
  if (!problem.isFree && !hasLanguageAccess(req.user, language._id)) {
    throw new AppError('This problem needs full access', 403, undefined, 'NEEDS_FULL_ACCESS');
  }

  const passed = req.body.passed;
  const key = { user: req.user._id, problem: problem._id };
  await ProblemProgress.updateOne(
    key,
    {
      $inc: { submits: 1, fails: passed ? 0 : 1 },
      $set: { code: req.body.code, language: language._id, ...(passed ? { solved: true } : {}) },
      $setOnInsert: key,
    },
    { upsert: true }
  );
  if (passed) await ProblemProgress.updateOne({ ...key, solvedAt: null }, { $set: { solvedAt: new Date() } });

  const row = await ProblemProgress.findOne(key).select('solved submits fails solvedAt').lean();
  sendSuccess(
    res,
    { progress: { solved: row.solved, submits: row.submits, fails: row.fails, solvedAt: row.solvedAt } },
    passed ? 'Solved' : 'Saved'
  );
}

module.exports = { getProblems, getProblem, submitProblem };
