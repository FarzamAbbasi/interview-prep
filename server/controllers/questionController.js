const Question = require('../models/Question');
const Language = require('../models/Language');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPaging, findLanguage, baseFilter, pagination } = require('../utils/questionFilters');

const hasFullAccess = (user) => Boolean(user && (user.isPaid || user.role === 'admin'));

// Fields the public may see (answer is added only when unlocked)
const PUBLIC_FIELDS = 'language topic question answer codeSnippet difficulty tags isFree createdAt';

/**
 * Hide the answer of paid questions for guests and unpaid users.
 * Locked questions still show the question text, so users know what they unlock.
 */
function lockIfNeeded(question, fullAccess, bookmarkIds) {
  const isLocked = !question.isFree && !fullAccess;
  const result = { ...question, isLocked };
  // IPP-502: lets the page show a filled bookmark icon (paid users only)
  if (fullAccess && bookmarkIds) result.isBookmarked = bookmarkIds.has(String(question._id));
  if (isLocked) {
    delete result.answer;
    delete result.codeSnippet; // the code is usually part of the answer
  }
  return result;
}

// Public browsing shows only active Q&A from active languages (MCQs appear only in quizzes)
async function publicFilter(query) {
  const filter = { ...baseFilter(query), type: 'qa', isActive: true };
  const language = await findLanguage(query.language, { onlyActive: true });
  if (language) {
    filter.language = language._id;
  } else {
    filter.language = { $in: await Language.find({ isActive: true }).distinct('_id') };
  }
  return { filter, language };
}

/**
 * GET /api/questions   (IPP-403, public; login optional)
 *   ?language=php &difficulty=easy &tag=oop &search=array &page=1 &limit=10
 * Free questions first. Paid answers are locked for guests and unpaid users.
 */
async function getQuestions(req, res) {
  const { page, limit, skip } = getPaging(req.query);
  const { filter, language } = await publicFilter(req.query);

  const [items, total] = await Promise.all([
    Question.find(filter)
      .select(PUBLIC_FIELDS)
      .populate('language', 'name slug')
      .sort({ isFree: -1, createdAt: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Question.countDocuments(filter),
  ]);

  const fullAccess = hasFullAccess(req.user);
  const bookmarkIds = new Set((req.user?.bookmarks || []).map(String));
  sendSuccess(res, {
    language: language && { _id: language._id, name: language.name, slug: language.slug },
    hasFullAccess: fullAccess,
    questions: items.map((q) => lockIfNeeded(q, fullAccess, bookmarkIds)),
    pagination: pagination(page, limit, total),
  });
}

/**
 * GET /api/questions/tags?language=php   (IPP-403, public)
 * All tags used by active Q&A (for the tag filter), A-Z.
 */
async function getTags(req, res) {
  const { filter } = await publicFilter({ language: req.query.language, topic: req.query.topic });
  const tags = await Question.distinct('tags', filter);
  sendSuccess(res, { tags: tags.filter(Boolean).sort() });
}

/**
 * GET /api/questions/:id   (IPP-403, public; login optional)
 * One Q&A, with the same locking rules.
 */
async function getQuestionById(req, res) {
  const question = await Question.findOne({ _id: req.params.id, type: 'qa', isActive: true })
    .select(PUBLIC_FIELDS)
    .populate('language', 'name slug isActive')
    .lean();

  if (!question || !question.language?.isActive) throw new AppError('Question not found', 404);
  delete question.language.isActive;

  const bookmarkIds = new Set((req.user?.bookmarks || []).map(String));
  sendSuccess(res, { question: lockIfNeeded(question, hasFullAccess(req.user), bookmarkIds) });
}

module.exports = { getQuestions, getTags, getQuestionById };
