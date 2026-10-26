const Question = require('../models/Question');
const Language = require('../models/Language');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPaging, findLanguage, baseFilter, pagination } = require('../utils/questionFilters');
const { doneIdSet } = require('../utils/progress');
const { isFreeFor, visibleCondition } = require('../utils/freeAccess');
const { hasFullAccess, hasLanguageAccess } = require('../utils/access');

// Fields the public may see (answer is added only when unlocked)
const PUBLIC_FIELDS = 'language topic question answer codeSnippet difficulty tags isFree createdAt';

/**
 * Hide the answer of paid questions for guests and unpaid users.
 * isFree = in the first topic of its language (IPP-1607), not the stored isFree flag.
 */
function lockIfNeeded(question, fullAccess, bookmarkIds, language) {
  const isFree = isFreeFor(question, language);
  const isLocked = !isFree && !fullAccess;
  const result = { ...question, isFree, isLocked };
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
  // Languages (with topics) behind this list: needed for the first-topic rule (IPP-1607)
  const languages = language ? [language] : await Language.find({ isActive: true }, 'name slug topics').lean();
  return { filter, language, languages };
}

/**
 * GET /api/questions   (IPP-403, public; login optional)
 *   ?language=php &difficulty=easy &tag=oop &search=array &page=1 &limit=10
 * Full access: every question. Guests and unpaid users (IPP-1501): ONLY the free questions;
 * paid questions are not sent at all, hiddenCount says how many more full access would show.
 */
async function getQuestions(req, res) {
  const { page, limit, skip } = getPaging(req.query);
  const { filter, language, languages } = await publicFilter(req.query);
  // IPP-1704: with one language picked, "full access" means access to THAT language
  const fullAccess = language ? hasLanguageAccess(req.user, language._id) : hasFullAccess(req.user);
  const limitTo = visibleCondition(languages, req.user); // IPP-1607: first topic only where locked
  const visible = limitTo ? { $and: [filter, limitTo] } : filter;
  const byId = new Map(languages.map((l) => [String(l._id), l]));

  const [items, total, allMatching] = await Promise.all([
    Question.find(visible)
      .select(PUBLIC_FIELDS)
      .populate('language', 'name slug')
      .sort({ createdAt: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Question.countDocuments(visible),
    limitTo ? Question.countDocuments(filter) : null,
  ]);

  const bookmarkIds = new Set((req.user?.bookmarks || []).map(String));
  const doneIds = await doneIdSet(req.user, items.map((q) => q._id)); // IPP-1601
  sendSuccess(res, {
    language: language && { _id: language._id, name: language.name, slug: language.slug },
    hasFullAccess: fullAccess,
    hiddenCount: limitTo ? Math.max(0, allMatching - total) : 0, // IPP-1501
    questions: items.map((q) => {
      const lang = byId.get(String(q.language?._id || q.language));
      const item = lockIfNeeded(q, hasLanguageAccess(req.user, lang?._id), bookmarkIds, lang);
      if (req.user) item.isDone = doneIds.has(String(q._id));
      return item;
    }),
    pagination: pagination(page, limit, total),
  });
}

/**
 * GET /api/questions/tags?language=php   (IPP-403, public)
 * All tags used by active Q&A (for the tag filter), A-Z. Without full access: tags of free questions only (IPP-1501).
 */
async function getTags(req, res) {
  const { filter, languages } = await publicFilter({ language: req.query.language, topic: req.query.topic });
  const limitTo = visibleCondition(languages, req.user);
  const visible = limitTo ? { $and: [filter, limitTo] } : filter;
  const tags = await Question.distinct('tags', visible);
  sendSuccess(res, { tags: tags.filter(Boolean).sort() });
}

/**
 * GET /api/questions/:id   (IPP-403, public; login optional)
 * One Q&A. A paid question needs full access (IPP-1501: guests / unpaid users never get its text).
 */
async function getQuestionById(req, res) {
  const question = await Question.findOne({ _id: req.params.id, type: 'qa', isActive: true })
    .select(PUBLIC_FIELDS)
    .populate('language', 'name slug isActive topics')
    .lean();

  if (!question || !question.language?.isActive) throw new AppError('Question not found', 404);
  const language = { ...question.language };
  delete question.language.isActive;
  delete question.language.topics;
  const languageAccess = hasLanguageAccess(req.user, language._id); // IPP-1704
  if (!isFreeFor(question, language) && !languageAccess) {
    throw new AppError('This question needs full access', 403, undefined, 'NEEDS_FULL_ACCESS');
  }

  const bookmarkIds = new Set((req.user?.bookmarks || []).map(String));
  sendSuccess(res, { question: lockIfNeeded(question, languageAccess, bookmarkIds, language) });
}

module.exports = { getQuestions, getTags, getQuestionById };
