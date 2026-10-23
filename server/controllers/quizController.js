const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { findLanguage, getPaging, pagination } = require('../utils/questionFilters');

const FULL_QUIZ_SIZE = 6; // questions in a paid quiz
const SAMPLE_QUIZ_SIZE = 5; // free MCQs in the sample quiz
const SECONDS_PER_QUESTION = 30;
const GRACE_SECONDS = 15; // allowance for slow internet when the quiz auto-submits

const hasFullAccess = (user) => Boolean(user && (user.isPaid || user.role === 'admin'));

// Fisher-Yates shuffle (returns a new array)
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * POST /api/quiz/start   (IPP-501, logged in)
 * Body: { language: "php", difficulty?: "easy" | "medium" | "hard" | "mixed" }
 * - Unpaid users: the sample quiz (the 5 free MCQs, shuffled). difficulty is ignored.
 * - Paid users / admins: 6 random active MCQs (filtered by difficulty unless "mixed").
 * Correct answers are NOT sent. 30 seconds per question, timed by the server.
 */
async function startQuiz(req, res) {
  const language = await findLanguage(req.body.language, { onlyActive: true });
  if (!language) throw new AppError('Choose a language', 400, [{ field: 'language', message: 'Choose a language' }]);

  const isSample = !hasFullAccess(req.user);
  const difficulty = isSample ? 'mixed' : req.body.difficulty || 'mixed';

  // IPP-404: paid users can pick one topic; the sample quiz always uses the free MCQs
  let topic = null;
  if (!isSample && req.body.topic) {
    topic = (language.topics || []).find((t) => t.slug === String(req.body.topic).toLowerCase());
    if (!topic) throw new AppError('Topic not found', 400, [{ field: 'topic', message: 'Topic not found' }]);
  }

  const match = { language: language._id, type: 'mcq', isActive: true };
  if (isSample) match.isFree = true;
  if (difficulty !== 'mixed') match.difficulty = difficulty;
  if (topic) match.topic = topic.slug;

  const picked = await Question.aggregate([
    { $match: match },
    { $sample: { size: isSample ? SAMPLE_QUIZ_SIZE : FULL_QUIZ_SIZE } },
    { $project: { question: 1, options: 1, codeSnippet: 1, difficulty: 1 } }, // no correctOption / answer
  ]);

  if (!picked.length) {
    throw new AppError(
      isSample
        ? `No sample quiz is available for ${language.name} yet`
        : `No ${difficulty === 'mixed' ? '' : `${difficulty} `}quiz questions for ${topic ? topic.name : language.name} yet. Try another difficulty`,
      404
    );
  }

  const questions = shuffle(picked);
  const timeLimit = questions.length * SECONDS_PER_QUESTION;
  const attempt = await QuizAttempt.create({
    user: req.user._id,
    language: language._id,
    difficulty,
    isSample,
    topic: topic ? topic.slug : '',
    total: questions.length,
    timeLimit,
    expiresAt: new Date(Date.now() + timeLimit * 1000),
    answers: questions.map((q) => ({ question: q._id, selectedOption: null, isCorrect: false })),
  });

  sendSuccess(
    res,
    {
      attemptId: attempt._id,
      language: { _id: language._id, name: language.name, slug: language.slug },
      isSample,
      difficulty,
      topic: topic ? { name: topic.name, slug: topic.slug } : null,
      timeLimit,
      expiresAt: attempt.expiresAt,
      serverTime: new Date(), // lets the browser fix a wrong computer clock
      questions,
    },
    isSample ? 'Sample quiz started' : 'Quiz started',
    201
  );
}

/**
 * POST /api/quiz/:attemptId/submit   (IPP-501, logged in, own attempt only)
 * Body: { answers: [{ question: "<id>", selectedOption: 0-3 | null }] }
 * Only questions that were given in this quiz count. Scoring is done here, then the full review
 * (correct option + explanation) is returned. Submitting after the time limit counts no answers.
 */
async function submitQuiz(req, res) {
  // language name/slug is needed for the result page
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, user: req.user._id }).populate(
    'language',
    'name slug'
  );
  if (!attempt) throw new AppError('Quiz not found', 404);
  if (attempt.status === 'completed') {
    throw new AppError('This quiz was already submitted', 409, undefined, 'QUIZ_ALREADY_SUBMITTED');
  }

  const now = Date.now();
  const timedOut = now > attempt.expiresAt.getTime() + GRACE_SECONDS * 1000;

  // First answer per question wins; anything not in this quiz is ignored
  const chosen = new Map();
  if (!timedOut) {
    for (const a of req.body.answers || []) {
      const key = String(a.question);
      if (!chosen.has(key)) chosen.set(key, a.selectedOption ?? null);
    }
  }

  // Load correct options, including questions deactivated after the quiz started
  const byId = await loadQuestions(attempt);

  let score = 0;
  attempt.answers.forEach((a) => {
    const q = byId.get(String(a.question));
    const selected = chosen.has(String(a.question)) ? chosen.get(String(a.question)) : null;
    a.selectedOption = Number.isInteger(selected) && selected >= 0 && selected <= 3 ? selected : null;
    a.isCorrect = Boolean(q) && a.selectedOption === q.correctOption;
    if (a.isCorrect) score += 1;
  });

  attempt.score = score;
  attempt.status = 'completed';
  attempt.completedAt = new Date(now);
  attempt.timeTaken = Math.min(attempt.timeLimit, Math.round((now - attempt.createdAt.getTime()) / 1000));
  await attempt.save();

  sendSuccess(
    res,
    { ...buildResult(attempt, byId), timedOut },
    timedOut ? 'Time was up, so no answers were counted' : 'Quiz submitted'
  );
}

/**
 * Result + review for a completed attempt (used by submit and by the result page).
 * byId: Map of question id -> { question, options, correctOption, answer, codeSnippet }
 */
function buildResult(attempt, byId) {
  return {
    attemptId: attempt._id,
    language: attempt.language?.name ? { _id: attempt.language._id, name: attempt.language.name, slug: attempt.language.slug } : undefined,
    isSample: attempt.isSample,
    difficulty: attempt.difficulty,
    topic: attempt.topic || '',
    score: attempt.score,
    total: attempt.total,
    percentage: Math.round((attempt.score / attempt.total) * 100),
    timeTaken: attempt.timeTaken,
    timeLimit: attempt.timeLimit,
    completedAt: attempt.completedAt,
    review: attempt.answers.map((a) => {
      const q = byId.get(String(a.question));
      return {
        questionId: a.question,
        question: q?.question ?? 'This question was removed',
        codeSnippet: q?.codeSnippet || '',
        options: q?.options || [],
        selectedOption: a.selectedOption,
        correctOption: q?.correctOption ?? null,
        isCorrect: a.isCorrect,
        explanation: q?.answer || '',
      };
    }),
  };
}

async function loadQuestions(attempt) {
  const ids = attempt.answers.map((a) => a.question);
  const questions = await Question.find({ _id: { $in: ids } })
    .select('question options correctOption answer codeSnippet difficulty')
    .lean();
  return new Map(questions.map((q) => [String(q._id), q]));
}

/**
 * GET /api/quiz/history?page=1   (IPP-502, logged in)
 * The user's submitted quizzes, newest first (10 per page), plus overall stats for the dashboard.
 */
async function getHistory(req, res) {
  const { page, limit, skip } = getPaging(req.query, 10, 50);
  const filter = { user: req.user._id, status: 'completed' };

  const [attempts, total, statsRows] = await Promise.all([
    QuizAttempt.find(filter)
      .select('language topic isSample difficulty score total timeTaken completedAt createdAt')
      .populate('language', 'name slug icon')
      .sort({ completedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    QuizAttempt.countDocuments(filter),
    QuizAttempt.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$language',
          attempts: { $sum: 1 },
          questionsAnswered: { $sum: '$total' },
          correct: { $sum: '$score' },
          bestPercentage: { $max: { $multiply: [{ $divide: ['$score', '$total'] }, 100] } },
        },
      },
      { $lookup: { from: 'languages', localField: '_id', foreignField: '_id', as: 'language' } },
      { $unwind: { path: '$language', preserveNullAndEmptyArrays: true } },
    ]),
  ]);

  const byLanguage = statsRows.map((r) => ({
    language: r.language ? { _id: r.language._id, name: r.language.name, slug: r.language.slug, icon: r.language.icon } : null,
    attempts: r.attempts,
    questionsAnswered: r.questionsAnswered,
    averagePercentage: r.questionsAnswered ? Math.round((r.correct / r.questionsAnswered) * 100) : 0,
    bestPercentage: Math.round(r.bestPercentage || 0),
  }));
  const sum = (key) => byLanguage.reduce((n, r) => n + r[key], 0);
  const answered = sum('questionsAnswered');
  const correct = statsRows.reduce((n, r) => n + r.correct, 0);

  sendSuccess(res, {
    stats: {
      totalAttempts: sum('attempts'),
      questionsAnswered: answered,
      averagePercentage: answered ? Math.round((correct / answered) * 100) : 0,
      byLanguage,
    },
    attempts: attempts.map((a) => ({ ...a, percentage: Math.round((a.score / a.total) * 100) })),
    pagination: pagination(page, limit, total),
  });
}

/**
 * GET /api/quiz/:attemptId   (IPP-502, logged in, own attempt only)
 * Full result of a submitted quiz with correct answers and explanations (result page after reload).
 */
async function getAttempt(req, res) {
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, user: req.user._id }).populate(
    'language',
    'name slug'
  );
  if (!attempt) throw new AppError('Quiz not found', 404);
  if (attempt.status !== 'completed') {
    throw new AppError('This quiz has not been submitted yet', 409, undefined, 'QUIZ_IN_PROGRESS');
  }

  sendSuccess(res, buildResult(attempt, await loadQuestions(attempt)));
}

module.exports = { startQuiz, submitQuiz, getHistory, getAttempt };
