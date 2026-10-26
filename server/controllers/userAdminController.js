const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const Progress = require('../models/Progress');
const Question = require('../models/Question');
const Language = require('../models/Language');
const { hasLanguageAccess } = require('../utils/access');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPaging, pagination } = require('../utils/questionFilters');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/admin/users   (IPP-1004, admin)
 *   ?search=ali (name or email) &filter=paid|free|blocked|unverified|admin &page=1 &limit=20
 * Newest first. Each user also has quizCount and lastQuizAt.
 */
async function listUsers(req, res) {
  const { page, limit, skip } = getPaging(req.query, 20, 100);
  const filter = {};

  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }

  switch (req.query.filter) {
    case 'paid':
      Object.assign(filter, { role: 'user', isPaid: true });
      break;
    case 'free':
      Object.assign(filter, { role: 'user', isPaid: false });
      break;
    case 'blocked':
      filter.isBlocked = true;
      break;
    case 'unverified':
      filter.isVerified = false;
      break;
    case 'admin':
      filter.role = 'admin';
      break;
    default:
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name email role isPaid paidAt accessScope paidLanguages isVerified isBlocked createdAt')
      .populate('paidLanguages', 'name slug') // IPP-1704
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  // Quiz count + last quiz for the users on this page
  const stats = await QuizAttempt.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) }, status: 'completed' } },
    { $group: { _id: '$user', quizCount: { $sum: 1 }, lastQuizAt: { $max: '$completedAt' } } },
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));

  sendSuccess(res, {
    users: users.map((u) => ({
      ...u,
      quizCount: byUser.get(String(u._id))?.quizCount || 0,
      lastQuizAt: byUser.get(String(u._id))?.lastQuizAt || null,
    })),
    pagination: pagination(page, limit, total),
  });
}

/**
 * PUT /api/admin/users/:id/access   (IPP-502, IPP-1704, admin)
 * Body: { access: 'all' }                          every language (also ones added later)
 *       { access: 'some', languages: [ids] }       only these languages
 *       { access: 'none' }                         back to free
 * Old body { isPaid: true | false } still works (= 'all' / 'none').
 * Turned on by hand until online payment is added.
 */
async function setPaidAccess(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Admins always have full access', 400);

  const access = req.body.access || (req.body.isPaid ? 'all' : 'none');

  let languages = [];
  if (access === 'some') {
    const ids = [...new Set((req.body.languages || []).map(String))];
    languages = await Language.find({ _id: { $in: ids } }, 'name').sort({ name: 1 }).lean();
    if (!languages.length) {
      throw new AppError('Pick at least one language', 400, [{ field: 'languages', message: 'Pick at least one language' }]);
    }
  }

  const turningOn = access !== 'none';
  if (turningOn && !user.isPaid) user.paidBy = req.user._id; // IPP-1703: who turned it on
  if (!turningOn) user.paidBy = undefined;
  user.isPaid = turningOn;
  user.paidAt = turningOn ? user.paidAt || new Date() : undefined;
  user.accessScope = access === 'some' ? 'some' : 'all';
  user.paidLanguages = languages.map((l) => l._id);
  await user.save();
  await user.populate('paidLanguages', 'name slug');

  const message = {
    all: `${user.name} now has full access to all languages`,
    some: `${user.name} now has full access to ${languages.map((l) => l.name).join(', ')}`,
    none: `Full access turned off for ${user.name}`,
  }[access];
  sendSuccess(res, { user }, message);
}

/**
 * PUT /api/admin/users/:id/block   (IPP-1004, admin)
 * Body: { isBlocked: true | false }
 * A blocked user cannot log in, and requests with an old login token are refused.
 */
async function setBlocked(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Admins cannot be blocked', 400);

  user.isBlocked = req.body.isBlocked;
  await user.save();

  sendSuccess(res, { user }, req.body.isBlocked ? `${user.name} is blocked` : `${user.name} is unblocked`);
}

// ---------------- IPP-1703: one user's details ----------------

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const average = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);
const MIN_ANSWERS_FOR_WEAK_TOPIC = 3;

/**
 * GET /api/admin/users/:id/details   (IPP-1703, admin)
 * Account info, study progress (done Q&A by language -> topic, bookmarks) and quiz performance
 * (avg / best by language, score trend, weak topics, last 10 quizzes).
 * Done counts only active Q&A. Avg / best / trend use full quizzes only (sample quizzes are counted apart).
 */
async function getUserDetails(req, res) {
  const user = await User.findById(req.params.id)
    .select(
      'name email role isPaid paidAt accessScope paidLanguages paidBy isVerified isBlocked createdAt lastLoginAt lastSeenAt bookmarks'
    )
    .populate('paidBy', 'name email')
    .populate('paidLanguages', 'name slug')
    .lean();
  if (!user) throw new AppError('User not found', 404);

  const weekAgo = new Date(Date.now() - WEEK_MS);
  const [languages, qaCounts, doneRows, attempts] = await Promise.all([
    Language.find({}, 'name slug topics isActive').sort({ name: 1 }).lean(),
    Question.aggregate([
      { $match: { type: 'qa', isActive: true } },
      {
        $group: {
          _id: { language: '$language', topic: '$topic' },
          n: { $sum: 1 },
        },
      },
    ]),
    Progress.find({ user: user._id })
      .populate('question', 'question topic language type isActive')
      .sort({ createdAt: -1 })
      .lean(),
    QuizAttempt.find({ user: user._id, status: 'completed' })
      .select('language topic difficulty isSample score total timeTaken completedAt answers')
      .sort({ completedAt: -1 })
      .limit(500)
      .lean(),
  ]);

  // Names for ids / slugs
  const langById = new Map(languages.map((l) => [String(l._id), l]));
  const langName = (id) => langById.get(String(id))?.name || 'Deleted language';
  const topicName = (langId, slug) => {
    if (!slug) return 'Other';
    return langById.get(String(langId))?.topics.find((t) => t.slug === slug)?.name || slug;
  };

  // ---- Study progress ----
  const totalByTopic = new Map(qaCounts.map(({ _id, n }) => [`${_id.language}:${_id.topic || ''}`, n]));
  const doneByTopic = new Map();
  const counted = doneRows.filter((r) => r.question && r.question.type === 'qa' && r.question.isActive);
  counted.forEach((r) => {
    const key = `${r.question.language}:${r.question.topic || ''}`;
    doneByTopic.set(key, (doneByTopic.get(key) || 0) + 1);
  });

  const studyLanguages = languages
    .map((lang) => {
      const id = String(lang._id);
      const slugs = lang.topics.map((t) => t.slug);
      const languageAccess = hasLanguageAccess(user, lang._id); // IPP-1704
      // Questions with no / an old topic slug are shown as "Other"
      const extra = [...totalByTopic.keys()]
        .filter((k) => k.startsWith(`${id}:`) && !slugs.includes(k.slice(id.length + 1)))
        .map((k) => k.slice(id.length + 1));
      const topics = [...slugs, ...extra]
        .map((slug, i) => ({
          slug,
          name: topicName(id, slug),
          done: doneByTopic.get(`${id}:${slug}`) || 0,
          total: totalByTopic.get(`${id}:${slug}`) || 0,
          locked: !languageAccess && i > 0, // IPP-1607: only the first topic is open
        }))
        .filter((t) => t.total > 0 || t.done > 0);
      const done = topics.reduce((a, t) => a + t.done, 0);
      const total = topics.reduce((a, t) => a + t.total, 0);
      return {
        _id: id,
        name: lang.name,
        isActive: lang.isActive,
        hasAccess: languageAccess,
        done,
        total,
        percent: percent(done, total),
        topics,
      };
    })
    .filter((l) => (l.isActive && l.total > 0) || l.done > 0);

  const studyDone = studyLanguages.reduce((a, l) => a + l.done, 0);
  const studyTotal = studyLanguages.reduce((a, l) => a + l.total, 0);

  const bookmarkQuestions = await Question.find(
    { _id: { $in: user.bookmarks || [] } },
    'question language topic',
  ).lean();

  // ---- Quizzes ----
  const pct = (a) => percent(a.score, a.total);
  const full = attempts.filter((a) => !a.isSample);

  const perLanguage = new Map();
  full.forEach((a) => {
    const key = String(a.language);
    if (!perLanguage.has(key)) perLanguage.set(key, []);
    perLanguage.get(key).push(pct(a));
  });

  // Trend: last 10 full quizzes, oldest first. Newer half vs older half (5 points = real change).
  const points = full
    .slice(0, 10)
    .reverse()
    .map((a) => ({ percentage: pct(a), at: a.completedAt }));
  let direction = 'not-enough';
  if (points.length >= 4) {
    const half = Math.floor(points.length / 2);
    const diff =
      average(points.slice(-half).map((p) => p.percentage)) - average(points.slice(0, half).map((p) => p.percentage));
    direction = diff >= 5 ? 'up' : diff <= -5 ? 'down' : 'steady';
  }

  // Weak topics: lowest share of right answers across all quizzes (skipped = wrong)
  const answerIds = [...new Set(attempts.flatMap((a) => a.answers.map((x) => String(x.question))))];
  const answerQuestions = await Question.find({ _id: { $in: answerIds } }, 'language topic').lean();
  const questionTopic = new Map(answerQuestions.map((q) => [String(q._id), q]));
  const topicScores = new Map();
  attempts.forEach((a) =>
    a.answers.forEach((x) => {
      const q = questionTopic.get(String(x.question));
      if (!q) return;
      const key = `${q.language}:${q.topic || ''}`;
      const row = topicScores.get(key) || {
        language: q.language,
        topic: q.topic || '',
        answered: 0,
        correct: 0,
      };
      row.answered += 1;
      if (x.isCorrect) row.correct += 1;
      topicScores.set(key, row);
    }),
  );
  const weakTopics = [...topicScores.values()]
    .filter((t) => t.answered >= MIN_ANSWERS_FOR_WEAK_TOPIC && t.correct < t.answered)
    .map((t) => ({
      language: langName(t.language),
      topic: topicName(t.language, t.topic),
      answered: t.answered,
      correct: t.correct,
      accuracy: percent(t.correct, t.answered),
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered)
    .slice(0, 5);

  const lastDone = doneRows.find((r) => r.question);
  const lastQuiz = attempts[0];
  const { bookmarks, ...account } = user;

  sendSuccess(res, {
    user: { ...account, bookmarksCount: bookmarkQuestions.length },
    activity: {
      lastSeenAt: user.lastSeenAt || null,
      lastLoginAt: user.lastLoginAt || null,
      lastStudied: lastDone
        ? {
            at: lastDone.createdAt,
            language: langName(lastDone.question.language),
          }
        : null,
      lastQuiz: lastQuiz
        ? {
            at: lastQuiz.completedAt,
            language: langName(lastQuiz.language),
            percentage: pct(lastQuiz),
            isSample: lastQuiz.isSample,
          }
        : null,
    },
    study: {
      done: studyDone,
      total: studyTotal,
      percent: percent(studyDone, studyTotal),
      thisWeek: counted.filter((r) => r.createdAt >= weekAgo).length,
      languages: studyLanguages,
      recentDone: counted.slice(0, 5).map((r) => ({
        question: r.question.question,
        language: langName(r.question.language),
        topic: topicName(r.question.language, r.question.topic),
        at: r.createdAt,
      })),
      bookmarks: bookmarkQuestions.slice(0, 10).map((q) => ({
        question: q.question,
        language: langName(q.language),
        topic: topicName(q.language, q.topic),
      })),
    },
    quizzes: {
      count: full.length,
      sampleCount: attempts.length - full.length,
      average: average(full.map(pct)),
      best: full.length ? Math.max(...full.map(pct)) : null,
      trend: { direction, points },
      languages: [...perLanguage.entries()]
        .map(([id, list]) => ({
          name: langName(id),
          attempts: list.length,
          average: average(list),
          best: Math.max(...list),
        }))
        .sort((a, b) => b.attempts - a.attempts),
      weakTopics,
      recent: attempts.slice(0, 10).map((a) => ({
        _id: a._id,
        language: langName(a.language),
        topic: a.topic ? topicName(a.language, a.topic) : 'All topics',
        difficulty: a.difficulty,
        isSample: a.isSample,
        score: a.score,
        total: a.total,
        percentage: pct(a),
        timeTaken: a.timeTaken,
        at: a.completedAt,
      })),
    },
  });
}

module.exports = { listUsers, getUserDetails, setPaidAccess, setBlocked };
