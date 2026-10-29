const InterviewRound = require('../models/InterviewRound');
const Question = require('../models/Question');
const Problem = require('../models/Problem');
const ProblemProgress = require('../models/ProblemProgress');
const Language = require('../models/Language');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { findLanguage, getPaging, pagination } = require('../utils/questionFilters');
const { firstTopicSlug } = require('../utils/freeAccess');
const { hasLanguageAccess } = require('../utils/access');
const { LEVELS, QA_SECONDS, CODING_SECONDS, pickQuestions, pickProblem, qaCountFor } = require('../utils/interviewPicker');
const { runAnswerCheck } = require('../utils/answerCheckService');

/**
 * IPP-1724: Interview Mode API (/api/interview, logged in).
 * Paid users (access to the language) = unlimited rounds from all content.
 * Unpaid users = ONE free round in total, from the free content (first Q&A topic + free problems, IPP-1607).
 * The server keeps the round time; the browser runs the per-question timers.
 */
const RATE_SECONDS = 60; // per item: extra time to read the answer and rate yourself
const SAVE_GRACE_SECONDS = 30; // slow internet when the last answer is saved
const RECENT_ROUNDS = 3; // avoid the questions of the user's last 3 rounds of a language
const POINTS = { knew: 1, partly: 0.5, didnt: 0, skipped: 0, pending: 0 };
const VERDICT_RATING = { right: 'knew', partly: 'partly', wrong: 'didnt' }; // IPP-1730: AI verdict -> points
const SELF_RATINGS = ['knew', 'partly', 'didnt'];

const LANGUAGE_FIELDS = 'name slug topics';
const topicNameOf = (language, slug) => (language?.topics || []).find((t) => t.slug === slug)?.name || slug || 'General';
const languageInfo = (l) => (l?._id ? { _id: l._id, name: l.name, slug: l.slug } : null);

// What this user may use for a round in this language
function poolFilters(language, user) {
  const full = hasLanguageAccess(user, language._id);
  const qa = { language: language._id, type: 'qa', isActive: true };
  const coding = { language: language._id, isActive: true };
  if (!full) {
    qa.topic = firstTopicSlug(language) || '__none__';
    coding.isFree = true;
  }
  return { full, qa, coding };
}

const isExpired = (round, now = Date.now()) => now > round.expiresAt.getTime() + SAVE_GRACE_SECONDS * 1000;

// Score = points of every item that has a result. IPP-1730: 'pending' items (AI could not check) are left out
// until the user rates them on the report.
function scoreRound(round) {
  let score = 0;
  let total = 0;
  round.items.forEach((item) => {
    if (item.kind === 'qa') item.points = POINTS[item.rating] || 0;
    else item.points = item.total ? Math.min(item.passed, item.total) / item.total : 0;
    if (item.rating === 'pending') return;
    score += item.points;
    total += 1;
  });
  round.score = score;
  round.total = total;
  round.percentage = total ? Math.round((score / total) * 100) : 0;
}

// Close the round. Unanswered Q&A = skipped, unsaved coding = 0 tests.
// IPP-1730: a typed answer whose AI check never came back = 'pending' (the user rates it on the report).
function finishRound(round, now = Date.now()) {
  round.items.forEach((item) => {
    if (item.kind === 'qa' && !item.rating) item.rating = item.userAnswer ? 'pending' : 'skipped';
  });
  scoreRound(round);
  const end = Math.min(now, round.expiresAt.getTime());
  round.status = 'completed';
  round.completedAt = new Date(end);
  round.timeTaken = Math.max(0, Math.round((end - round.createdAt.getTime()) / 1000));
  return round.save();
}

// ---- IPP-1730: AI checks run in the background after an answer is saved (the user does not wait) ----
// Finishing a round waits for its running checks (at most CHECK_WAIT_MS). One server process (Render), so a Map is enough;
// a check lost by a restart simply ends as 'pending'.
// The checks of one round run ONE AFTER ANOTHER (a queue), so a quick user does not hit the AI's per-minute limit,
// and a busy AI is retried after 3, 8 and 15 seconds (all in the background; the user never waits for it).
const CHECK_WAIT_MS = 60000;
const RETRY_DELAYS_MS = [3000, 8000, 15000];
const RETRY_CODES = ['AI_BUSY', 'AI_FAILED'];
const roundQueues = new Map(); // roundId -> promise of the last queued check
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function queueCheck(roundId, job) {
  const key = String(roundId);
  const next = (roundQueues.get(key) || Promise.resolve()).then(job, job);
  roundQueues.set(key, next);
  next.finally(() => roundQueues.get(key) === next && roundQueues.delete(key));
  return next;
}

async function waitForChecks(roundId) {
  const last = roundQueues.get(String(roundId));
  if (!last) return;
  await Promise.race([last.catch(() => {}), sleep(CHECK_WAIT_MS)]);
}

// One AI check with retries when the AI is busy / gave an unreadable reply. Returns the result or null.
async function checkWithRetries({ user, question, answer, retries = RETRY_DELAYS_MS }) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runAnswerCheck({ user, question, answer, source: 'interview' });
    } catch (err) {
      if (err.name !== 'AppError') throw err;
      if (!RETRY_CODES.includes(err.errorCode) || attempt >= retries.length) {
        console.error(`[interview] answer not checked (${err.errorCode || err.message}) after ${attempt + 1} tries`);
        return null;
      }
      await sleep(retries[attempt]);
    }
  }
}

// Check one answer and store the result on the round (also when the round was finished meanwhile)
async function backgroundCheck({ roundId, index, user }) {
  try {
    const round = await InterviewRound.findById(roundId);
    const item = round?.items[index];
    if (!item?.userAnswer) return;
    const question = await Question.findById(item.question).select('question answer language').lean();
    const result = question ? await checkWithRetries({ user, question, answer: item.userAnswer }) : null;
    const fresh = await InterviewRound.findById(roundId); // may have changed while the AI was working
    const target = fresh?.items[index];
    if (!target || (target.rating && target.rating !== 'pending')) return;
    if (result) {
      target.aiVerdict = result.verdict;
      target.aiPoints = result.points;
      target.rating = VERDICT_RATING[result.verdict];
    } else target.rating = 'pending';
    target.points = POINTS[target.rating];
    if (fresh.status === 'completed') scoreRound(fresh);
    await fresh.save();
  } catch (err) {
    console.error(`[interview] background check failed: ${err.message}`);
  }
}

// A round left open (tab closed) is finished once its time is over, with what was saved
async function finishExpired(userId) {
  const stale = await InterviewRound.find({
    user: userId,
    status: 'in-progress',
    expiresAt: { $lt: new Date(Date.now() - SAVE_GRACE_SECONDS * 1000) },
  });
  for (const round of stale) await finishRound(round);
}

// The round while it runs: questions WITH model answers (the user rates himself), problem WITHOUT hints / solution
async function playData(round, language) {
  const qIds = round.items.filter((i) => i.kind === 'qa').map((i) => i.question);
  const pIds = round.items.filter((i) => i.kind === 'coding').map((i) => i.problem);
  const [questions, problems] = await Promise.all([
    Question.find({ _id: { $in: qIds } }).select('question answer codeSnippet').lean(),
    Problem.find({ _id: { $in: pIds } })
      .select('slug title topic topicSlug difficulty scenario description functionName starterCode examples constraints tests')
      .lean(),
  ]);
  const qById = new Map(questions.map((q) => [String(q._id), q]));
  const pById = new Map(problems.map((p) => [String(p._id), p]));

  return {
    _id: round._id,
    status: round.status,
    language: languageInfo(language),
    level: round.level,
    isTrial: round.isTrial,
    timeLimit: round.timeLimit,
    expiresAt: round.expiresAt,
    startedAt: round.createdAt,
    serverTime: new Date(), // lets the browser fix a wrong computer clock
    items: round.items.map((item, index) => {
      const base = {
        index,
        kind: item.kind,
        seconds: item.seconds,
        topic: { slug: item.topic, name: item.topicName },
        difficulty: item.difficulty,
        answeredAt: item.answeredAt,
      };
      if (item.kind === 'qa') {
        const q = qById.get(String(item.question));
        return {
          ...base,
          questionId: item.question,
          question: q?.question ?? item.text,
          codeSnippet: q?.codeSnippet || '',
          rating: item.rating, // IPP-1730: no model answer / verdict while the round runs (only in the report)
          userAnswer: item.userAnswer || '',
        };
      }
      const p = pById.get(String(item.problem));
      return { ...base, title: item.text, problem: p || null, code: item.code, passed: item.passed, total: item.total };
    }),
  };
}

// The report of a finished round: every answer, coding solution (with access), and what to study next
async function buildReport(round, user) {
  const language = round.language;
  const qIds = round.items.filter((i) => i.kind === 'qa').map((i) => i.question);
  const pIds = round.items.filter((i) => i.kind === 'coding').map((i) => i.problem);
  const [questions, problems] = await Promise.all([
    Question.find({ _id: { $in: qIds } }).select('question answer codeSnippet').lean(),
    Problem.find({ _id: { $in: pIds } }).select('slug title topic topicSlug difficulty solution isActive').lean(),
  ]);
  const qById = new Map(questions.map((q) => [String(q._id), q]));
  const pById = new Map(problems.map((p) => [String(p._id), p]));
  const full = hasLanguageAccess(user, language?._id);

  const items = round.items.map((item, index) => {
    const base = {
      index,
      kind: item.kind,
      topic: { slug: item.topic, name: item.topicName },
      difficulty: item.difficulty,
      points: item.points,
    };
    if (item.kind === 'qa') {
      const q = qById.get(String(item.question));
      return {
        ...base,
        questionId: item.question,
        question: q?.question ?? item.text,
        codeSnippet: q?.codeSnippet || '',
        answer: q?.answer || 'This question was removed',
        rating: item.rating,
        userAnswer: item.userAnswer || '', // IPP-1730
        aiVerdict: item.aiVerdict || null,
        aiPoints: item.aiPoints || [],
      };
    }
    const p = pById.get(String(item.problem));
    return {
      ...base,
      title: item.text,
      problem: p ? { slug: p.slug, title: p.title, topic: p.topic, topicSlug: p.topicSlug, isActive: p.isActive } : null,
      code: item.code,
      passed: item.passed,
      total: item.total,
      solution: full && p ? p.solution : null,
      solutionLocked: !full,
    };
  });

  // Study next: Q&A topics not fully known (worst result per topic) + a coding problem not fully passed
  const weakTopics = new Map();
  items
    .filter((i) => i.kind === 'qa' && i.points < 1 && i.rating !== 'pending')
    .forEach((i) => {
      const old = weakTopics.get(i.topic.slug);
      if (!old || i.points < old.points) weakTopics.set(i.topic.slug, { kind: 'qa', topic: i.topic, result: i.rating, points: i.points });
    });
  const counts = weakTopics.size && language
    ? await Question.aggregate([
        { $match: { language: language._id, type: 'qa', isActive: true, topic: { $in: [...weakTopics.keys()] } } },
        { $group: { _id: '$topic', n: { $sum: 1 } } },
      ])
    : [];
  const countOf = new Map(counts.map((c) => [c._id, c.n]));
  const studyNext = [
    ...[...weakTopics.values()].map((t) => ({ ...t, questions: countOf.get(t.topic.slug) || 0 })),
    ...items
      .filter((i) => i.kind === 'coding' && i.points < 1)
      .map((i) => ({ kind: 'coding', topic: i.topic, problemSlug: i.problem?.slug || null, title: i.title, passed: i.passed, total: i.total, points: i.points })),
  ].sort((a, b) => a.points - b.points);

  return {
    _id: round._id,
    status: round.status,
    language: languageInfo(language),
    level: round.level,
    isTrial: round.isTrial,
    score: round.score,
    total: round.total,
    percentage: round.percentage,
    pending: round.items.filter((i) => i.rating === 'pending').length, // IPP-1730: waiting for the user's rating
    timeTaken: round.timeTaken,
    timeLimit: round.timeLimit,
    startedAt: round.createdAt,
    completedAt: round.completedAt,
    items,
    studyNext,
  };
}

/**
 * GET /api/interview/setup
 * The setup page: every active language with its round format and access,
 * the free trial state, and a round still running (to continue it).
 */
async function getSetup(req, res) {
  const user = req.user;
  await finishExpired(user._id);

  const languages = await Language.find({ isActive: true }).select('name slug icon topics').sort({ name: 1 }).lean();
  const ids = languages.map((l) => l._id);
  const [qaRows, codingRows, running, trialRound] = await Promise.all([
    Question.aggregate([
      { $match: { language: { $in: ids }, type: 'qa', isActive: true } },
      { $group: { _id: { language: '$language', topic: '$topic' }, n: { $sum: 1 } } },
    ]),
    Problem.aggregate([
      { $match: { language: { $in: ids }, isActive: true } },
      { $group: { _id: { language: '$language', isFree: '$isFree' }, n: { $sum: 1 } } },
    ]),
    InterviewRound.findOne({ user: user._id, status: 'in-progress' })
      .select('language level expiresAt createdAt')
      .populate('language', 'name slug')
      .lean(),
    InterviewRound.findOne({ user: user._id, isTrial: true }).select('_id status').sort({ createdAt: -1 }).lean(),
  ]);

  const trialUsed = Boolean(user.interviewTrialAt);
  const list = languages.map((l) => {
    const full = hasLanguageAccess(user, l._id);
    const id = String(l._id);
    const first = firstTopicSlug(l);
    const qaCount = qaRows
      .filter((r) => String(r._id.language) === id && (full || r._id.topic === first))
      .reduce((n, r) => n + r.n, 0);
    const codingCount = codingRows
      .filter((r) => String(r._id.language) === id && (full || r._id.isFree))
      .reduce((n, r) => n + r.n, 0);
    const hasCoding = codingCount > 0;
    const format = { qa: Math.min(qaCountFor(hasCoding), qaCount), coding: hasCoding ? 1 : 0 };
    const access = full ? 'full' : trialUsed ? 'locked' : 'trial';
    return {
      _id: l._id,
      name: l.name,
      slug: l.slug,
      icon: l.icon,
      access, // 'full' | 'trial' (free round left) | 'locked' (free round used)
      format, // e.g. { qa: 3, coding: 1 }
      minutes: Math.round((format.qa * QA_SECONDS + format.coding * CODING_SECONDS) / 60),
      available: access !== 'locked' && format.qa + format.coding > 0,
    };
  });

  sendSuccess(res, {
    languages: list,
    levels: Object.keys(LEVELS),
    times: { qa: QA_SECONDS, coding: CODING_SECONDS },
    trial: { used: trialUsed, usedAt: user.interviewTrialAt || null, roundId: trialRound?._id || null },
    running: running
      ? { _id: running._id, language: languageInfo(running.language), level: running.level, expiresAt: running.expiresAt }
      : null,
  });
}

/**
 * POST /api/interview/start
 * Body: { language: "javascript", level: "junior" | "mid" | "senior" }
 * Picks the questions (see utils/interviewPicker.js) and starts the round.
 */
async function startRound(req, res) {
  const user = req.user;
  const language = await findLanguage(req.body.language, { onlyActive: true });
  if (!language) throw new AppError('Choose a language', 400, [{ field: 'language', message: 'Choose a language' }]);
  const { level } = req.body;

  const { full, qa, coding } = poolFilters(language, user);
  if (!full && user.interviewTrialAt) {
    throw new AppError("You've used your free interview round. Get full access for unlimited rounds", 403, undefined, 'INTERVIEW_TRIAL_USED');
  }

  await finishExpired(user._id);
  if (await InterviewRound.exists({ user: user._id, status: 'in-progress' })) {
    throw new AppError('You already have a round running. Finish it first', 409, undefined, 'ROUND_IN_PROGRESS');
  }

  // Seen = in the user's last rounds of this language, or a problem already solved
  const [recent, qaPool, problemPool, solved] = await Promise.all([
    InterviewRound.find({ user: user._id, language: language._id })
      .sort({ createdAt: -1 })
      .limit(RECENT_ROUNDS)
      .select('items.question items.problem')
      .lean(),
    Question.find(qa).select('topic difficulty').lean(),
    Problem.find(coding).select('difficulty').lean(),
    ProblemProgress.find({ user: user._id, language: language._id, solved: true }).select('problem').lean(),
  ]);
  const seen = new Set([
    ...recent.flatMap((r) => r.items.map((i) => String(i.question || i.problem))),
    ...solved.map((r) => String(r.problem)),
  ]);

  const problemPick = pickProblem(problemPool, level, seen);
  const qaPicks = pickQuestions(qaPool, level, qaCountFor(Boolean(problemPick)), seen);
  if (!qaPicks.length && !problemPick) {
    throw new AppError(`No interview questions for ${language.name} yet`, 404);
  }

  const [questions, problem] = await Promise.all([
    Question.find({ _id: { $in: qaPicks.map((q) => q._id) } }).select('question topic difficulty').lean(),
    problemPick ? Problem.findById(problemPick._id).select('title topic topicSlug difficulty tests').lean() : null,
  ]);
  const qById = new Map(questions.map((q) => [String(q._id), q]));
  const items = qaPicks
    .map((pick) => qById.get(String(pick._id)))
    .filter(Boolean) // removed between pick and load (very rare)
    .map((q) => ({
      kind: 'qa',
      question: q._id,
      text: q.question,
      topic: q.topic,
      topicName: topicNameOf(language, q.topic),
      difficulty: q.difficulty,
      seconds: QA_SECONDS,
    }));
  if (problem) {
    items.push({
      kind: 'coding',
      problem: problem._id,
      text: problem.title,
      topic: problem.topicSlug,
      topicName: problem.topic,
      difficulty: problem.difficulty,
      seconds: CODING_SECONDS,
      total: problem.tests.length,
    });
  }

  const timeLimit = items.reduce((n, i) => n + i.seconds, 0);
  let round;
  try {
    round = await InterviewRound.create({
      user: user._id,
      language: language._id,
      level,
      isTrial: !full,
      items,
      total: items.length,
      timeLimit,
      expiresAt: new Date(Date.now() + (timeLimit + items.length * RATE_SECONDS) * 1000),
    });
  } catch (err) {
    if (err.code === 11000) throw new AppError('You already have a round running. Finish it first', 409, undefined, 'ROUND_IN_PROGRESS');
    throw err;
  }

  // Free user: use up the free round (atomic, so two quick clicks cannot get two free rounds)
  if (!full) {
    const { modifiedCount } = await User.updateOne({ _id: user._id, interviewTrialAt: null }, { $set: { interviewTrialAt: new Date() } });
    if (!modifiedCount) {
      await InterviewRound.deleteOne({ _id: round._id });
      throw new AppError("You've used your free interview round. Get full access for unlimited rounds", 403, undefined, 'INTERVIEW_TRIAL_USED');
    }
  }

  sendSuccess(res, await playData(round, language), full ? 'Interview started' : 'Free interview round started', 201);
}

/**
 * PATCH /api/interview/:roundId/items/:index
 * Save one answer while the round runs (can be changed until the round is finished).
 *   Q&A:    { rating: "knew" | "partly" | "didnt" | "skipped" }
 *   Coding: { code: "...", passed: 4 }   (tests passed on Submit; the browser runs the tests)
 */
async function saveItem(req, res) {
  const round = await InterviewRound.findOne({ _id: req.params.roundId, user: req.user._id });
  if (!round) throw new AppError('Round not found', 404);
  if (round.status === 'completed') throw new AppError('This round is already finished', 409, undefined, 'ROUND_FINISHED');
  if (isExpired(round)) {
    await finishRound(round);
    throw new AppError('Time is up for this round. Your saved answers were counted', 409, undefined, 'ROUND_EXPIRED');
  }

  const index = Number(req.params.index);
  const item = round.items[index];
  if (!item) throw new AppError('Question not found in this round', 404);

  if (item.kind === 'qa') {
    const { rating } = req.body;
    if (!Object.hasOwn(POINTS, rating)) {
      throw new AppError('Rate your answer: knew, partly, didnt or skipped', 400, [{ field: 'rating', message: 'Rate your answer: knew, partly, didnt or skipped' }]);
    }
    item.rating = rating;
    item.points = POINTS[rating];
  } else {
    if (typeof req.body.code !== 'string' || req.body.passed === undefined) {
      throw new AppError('Send the code and the number of passed tests', 400, [{ field: 'code', message: 'Send the code and the number of passed tests' }]);
    }
    item.code = req.body.code;
    item.passed = Math.min(Math.max(Number(req.body.passed) || 0, 0), item.total);
    item.points = item.total ? item.passed / item.total : 0;
  }
  item.answeredAt = new Date();
  await round.save();

  sendSuccess(
    res,
    {
      item: {
        index,
        kind: item.kind,
        rating: item.rating,
        passed: item.passed,
        total: item.total,
        points: item.points,
        answeredAt: item.answeredAt,
      },
      answered: round.items.filter((i) => i.answeredAt).length,
      total: round.items.length,
    },
    'Saved'
  );
}

/**
 * POST /api/interview/:roundId/items/:index/answer   (IPP-1730)
 * Body: { answer: "own words" }  the typed answer of a Q&A question; the round then goes on.
 * Saved at once; the AI checks it in the background (interview daily count) and its verdict gives the points:
 * right = 1, partly = 0.5, wrong = 0. If the AI cannot check it (off, daily limit, busy), it becomes 'pending'
 * and the user rates it on the report. Results are shown only in the report.
 */
async function answerItem(req, res) {
  const round = await InterviewRound.findOne({ _id: req.params.roundId, user: req.user._id });
  if (!round) throw new AppError('Round not found', 404);
  if (round.status === 'completed') throw new AppError('This round is already finished', 409, undefined, 'ROUND_FINISHED');
  if (isExpired(round)) {
    await finishRound(round);
    throw new AppError('Time is up for this round. Your saved answers were counted', 409, undefined, 'ROUND_EXPIRED');
  }
  const index = Number(req.params.index);
  const item = round.items[index];
  if (!item || item.kind !== 'qa') throw new AppError('Only Q&A questions take a written answer', 400);
  if (item.answeredAt) throw new AppError('This question was already answered', 409, undefined, 'ALREADY_ANSWERED');

  item.userAnswer = String(req.body.answer).trim();
  item.answeredAt = new Date();
  await round.save();

  // The AI check runs after the response, so the next question opens at once
  queueCheck(round._id, () => backgroundCheck({ roundId: round._id, index, user: req.user }));
  sendSuccess(res, { index, answered: round.items.filter((i) => i.answeredAt).length, total: round.items.length }, 'Answer saved');
}

/**
 * PATCH /api/interview/:roundId/items/:index/rate   (IPP-1730, finished round)
 * Body: { rating: "knew" | "partly" | "didnt" }  for an answer the AI could not check ('pending').
 * Returns the updated report (score now includes this question).
 */
async function rateItem(req, res) {
  const round = await InterviewRound.findOne({ _id: req.params.roundId, user: req.user._id }).populate('language', LANGUAGE_FIELDS);
  if (!round) throw new AppError('Round not found', 404);
  if (round.status !== 'completed') throw new AppError('Finish the round first', 409, undefined, 'ROUND_IN_PROGRESS');
  const item = round.items[Number(req.params.index)];
  if (!item || item.rating !== 'pending') throw new AppError('This answer does not need a rating', 400);
  if (!SELF_RATINGS.includes(req.body.rating)) throw new AppError('Rate your answer: knew, partly or didnt', 400);

  item.rating = req.body.rating;
  scoreRound(round);
  await round.save();
  sendSuccess(res, await buildReport(round, req.user), 'Rating saved');
}

/**
 * POST /api/interview/:roundId/items/:index/recheck   (IPP-1730, finished round)
 * "Check with AI again" for an answer that is still 'pending' (the AI was busy). One more try now (with the
 * fallback model); on success the verdict gives the points. Returns the updated report.
 */
async function recheckItem(req, res) {
  const round = await InterviewRound.findOne({ _id: req.params.roundId, user: req.user._id }).populate('language', LANGUAGE_FIELDS);
  if (!round) throw new AppError('Round not found', 404);
  if (round.status !== 'completed') throw new AppError('Finish the round first', 409, undefined, 'ROUND_IN_PROGRESS');
  const index = Number(req.params.index);
  const item = round.items[index];
  if (!item || item.kind !== 'qa' || !item.userAnswer) throw new AppError('This answer cannot be checked', 400);

  if (item.rating === 'pending') {
    await waitForChecks(round._id); // a background check of this round may still be running
    const fresh = await InterviewRound.findById(round._id).populate('language', LANGUAGE_FIELDS);
    const target = fresh.items[index];
    if (target.rating === 'pending') {
      const question = await Question.findById(target.question).select('question answer language').lean();
      if (!question) throw new AppError('This question was removed. Please rate it yourself', 400);
      const result = await runAnswerCheck({ user: req.user, question, answer: target.userAnswer, source: 'interview' });
      target.aiVerdict = result.verdict;
      target.aiPoints = result.points;
      target.rating = VERDICT_RATING[result.verdict];
      scoreRound(fresh);
      await fresh.save();
    }
    return sendSuccess(res, await buildReport(fresh, req.user), 'Checked by AI');
  }
  sendSuccess(res, await buildReport(round, req.user), 'Already checked');
}

/**
 * POST /api/interview/:roundId/finish
 * Ends the round (last answer, time up, or "End round") and returns the report.
 * Calling it again just returns the report (the browser may auto-finish and the user click at once).
 */
async function finishRoundHandler(req, res) {
  const round = await InterviewRound.findOne({ _id: req.params.roundId, user: req.user._id }).populate('language', LANGUAGE_FIELDS);
  if (!round) throw new AppError('Round not found', 404);
  const wasRunning = round.status === 'in-progress';
  let report = round;
  if (wasRunning) {
    await waitForChecks(round._id); // IPP-1730: the answers' AI checks first
    report = await InterviewRound.findById(round._id).populate('language', LANGUAGE_FIELDS);
    if (report.status === 'in-progress') await finishRound(report);
  }
  sendSuccess(res, await buildReport(report, req.user), wasRunning ? 'Round finished' : 'Round already finished');
}

/**
 * GET /api/interview/:roundId
 * Running round -> the questions (continue after a reload). Finished round -> the report.
 * Check data.status: 'in-progress' | 'completed'.
 */
async function getRound(req, res) {
  const round = await InterviewRound.findOne({ _id: req.params.roundId, user: req.user._id }).populate('language', LANGUAGE_FIELDS);
  if (!round) throw new AppError('Round not found', 404);
  let current = round;
  if (round.status === 'in-progress' && isExpired(round)) {
    await waitForChecks(round._id); // IPP-1730
    current = await InterviewRound.findById(round._id).populate('language', LANGUAGE_FIELDS);
    if (current.status === 'in-progress') await finishRound(current);
  }
  sendSuccess(res, current.status === 'in-progress' ? await playData(current, current.language) : await buildReport(current, req.user));
}

/**
 * GET /api/interview/history?page=1
 * Dashboard box: finished rounds (10 per page, newest first), rounds count, average, weakest topic.
 * Weakest topic = lowest average points over all rounds (topics answered 2+ times come first).
 */
async function getHistory(req, res) {
  const user = req.user;
  await finishExpired(user._id);
  const { page, limit, skip } = getPaging(req.query, 10, 50);
  const filter = { user: user._id, status: 'completed' };

  const [rounds, total, statsRows, topicRows] = await Promise.all([
    InterviewRound.find(filter)
      .select('language level isTrial score total percentage timeTaken completedAt')
      .populate('language', 'name slug icon')
      .sort({ completedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InterviewRound.countDocuments(filter),
    InterviewRound.aggregate([
      { $match: filter },
      { $group: { _id: null, rounds: { $sum: 1 }, average: { $avg: '$percentage' }, best: { $max: '$percentage' } } },
    ]),
    InterviewRound.aggregate([
      { $match: filter },
      { $unwind: '$items' },
      { $match: { 'items.rating': { $ne: 'pending' } } }, // IPP-1730: not rated yet
      {
        $group: {
          _id: { language: '$language', kind: '$items.kind', topic: '$items.topic' },
          topicName: { $last: '$items.topicName' },
          average: { $avg: '$items.points' },
          answered: { $sum: 1 },
        },
      },
      { $match: { average: { $lt: 1 } } },
    ]),
  ]);

  let weakestTopic = null;
  const weakest = topicRows.sort((a, b) => (b.answered >= 2) - (a.answered >= 2) || a.average - b.average || b.answered - a.answered)[0];
  if (weakest) {
    const language = await Language.findById(weakest._id.language).select('name slug').lean();
    weakestTopic = {
      kind: weakest._id.kind,
      language: languageInfo(language),
      topic: { slug: weakest._id.topic, name: weakest.topicName },
      averagePercentage: Math.round(weakest.average * 100),
      answered: weakest.answered,
    };
  }

  const stats = statsRows[0];
  sendSuccess(res, {
    stats: {
      rounds: stats?.rounds || 0,
      averagePercentage: Math.round(stats?.average || 0),
      bestPercentage: stats?.best || 0,
      weakestTopic,
    },
    rounds,
    pagination: pagination(page, limit, total),
  });
}

/**
 * DELETE /api/interview/:roundId   (own round; a running round is cancelled)
 * The free round stays used even when its round is deleted.
 */
async function deleteRound(req, res) {
  const { deletedCount } = await InterviewRound.deleteOne({ _id: req.params.roundId, user: req.user._id });
  if (!deletedCount) throw new AppError('Round not found', 404);
  sendSuccess(res, null, 'Round deleted from your history');
}

/**
 * DELETE /api/interview/history   (all finished rounds; a running round is kept)
 */
async function clearHistory(req, res) {
  const { deletedCount } = await InterviewRound.deleteMany({ user: req.user._id, status: 'completed' });
  sendSuccess(
    res,
    { deleted: deletedCount },
    deletedCount ? `Interview history cleared (${deletedCount} ${deletedCount === 1 ? 'round' : 'rounds'})` : 'Your interview history is already empty'
  );
}

module.exports = {
  getSetup,
  startRound,
  saveItem,
  answerItem,
  rateItem,
  recheckItem,
  finishRound: finishRoundHandler,
  getRound,
  getHistory,
  deleteRound,
  clearHistory,
};
