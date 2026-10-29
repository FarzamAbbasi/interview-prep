const Question = require('../models/Question');
const AnswerCheck = require('../models/AnswerCheck');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { canOpen } = require('../utils/freeAccess');
const { aiStatus } = require('../utils/aiProvider');
const { dayKey, getLimits, setLimits, usageFor } = require('../utils/answerCheckLimits');
const { runAnswerCheck } = require('../utils/answerCheckService');

/**
 * GET /api/answer-check/status?source=questions|interview   (IPP-1728, logged in)
 * For the "2 of 3 checks left today" line: { enabled, kind: practice | interview, limit, used, remaining, plan }
 * IPP-1729: practice (language pages) and interview have separate daily counts.
 */
async function getStatus(req, res) {
  const usage = await usageFor(req.user, req.query.source || 'questions');
  sendSuccess(res, { enabled: aiStatus().configured && usage.limit > 0, ...usage });
}

/**
 * POST /api/answer-check   (IPP-1728, logged in)
 * Body: { question: "<id>", answer: "own words", source?: "questions" | "interview" }
 * The AI compares the answer with the model answer. Returns
 *   { verdict: right | partly | wrong, points: [...], answer: model answer, usage: { limit, used, remaining } }
 * Only Q&A questions the user may open (free topic or language access). A failed AI call is not counted.
 */
async function check(req, res) {
  const question = await Question.findOne({ _id: req.body.question, type: 'qa', isActive: true })
    .select('question answer topic language')
    .populate('language', 'name slug isActive topics')
    .lean();
  if (!question || !question.language?.isActive) throw new AppError('Question not found', 404);
  if (!canOpen(question, question.language, req.user)) {
    throw new AppError('This question needs full access', 403, undefined, 'NEEDS_FULL_ACCESS');
  }

  const result = await runAnswerCheck({ user: req.user, question, answer: req.body.answer, source: req.body.source || 'questions' });
  sendSuccess(res, { ...result, answer: question.answer });
}

/**
 * GET /api/admin/answer-check   (IPP-1728, admin)
 * { ai: { provider, model, configured }, limits: { practice: { free, paid }, interview: { free, paid } },
 *   today: { checks, users, right, partly, wrong, practice, interview }, month: { checks } }
 */
async function getAdminStats(req, res) {
  const today = dayKey();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [limits, todayRows, monthChecks] = await Promise.all([
    getLimits(),
    AnswerCheck.aggregate([
      { $match: { day: today } },
      { $group: { _id: { verdict: '$verdict', source: '$source' }, checks: { $sum: 1 }, users: { $addToSet: '$user' } } },
    ]),
    AnswerCheck.countDocuments({ day: { $gte: monthStart } }),
  ]);

  const users = new Set();
  const byVerdict = { right: 0, partly: 0, wrong: 0 };
  const bySource = { practice: 0, interview: 0 };
  todayRows.forEach((r) => {
    byVerdict[r._id.verdict] += r.checks;
    bySource[r._id.source === 'interview' ? 'interview' : 'practice'] += r.checks;
    r.users.forEach((u) => users.add(String(u)));
  });
  sendSuccess(res, {
    ai: aiStatus(),
    limits,
    today: { checks: byVerdict.right + byVerdict.partly + byVerdict.wrong, users: users.size, ...byVerdict, ...bySource },
    month: { checks: monthChecks },
  });
}

/**
 * PATCH /api/admin/answer-check   (IPP-1728, admin)
 * Body: { practice: { free: 2, paid: 30 }, interview: { free: 3, paid: 50 } }  daily checks per user (0 = off)
 */
async function updateLimits(req, res) {
  const { practice, interview } = req.body;
  const limits = await setLimits({ practice: { free: practice.free, paid: practice.paid }, interview: { free: interview.free, paid: interview.paid } });
  sendSuccess(res, { limits }, 'Answer check limits saved');
}

module.exports = { getStatus, check, getAdminStats, updateLimits };
