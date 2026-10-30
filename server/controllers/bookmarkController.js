const Question = require('../models/Question');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { hasLanguageAccess } = require('../utils/access');

const MAX_BOOKMARKS = 500;

/**
 * POST /api/bookmarks/:questionId   (IPP-502, paid users)
 * Toggle: adds the Q&A if not saved yet, removes it if already saved.
 * Response: { bookmarked: true | false }
 */
async function toggleBookmark(req, res) {
  const { questionId } = req.params;
  const isSaved = req.user.bookmarks.some((id) => String(id) === questionId);

  if (isSaved) {
    await User.updateOne({ _id: req.user._id }, { $pull: { bookmarks: questionId } });
    return sendSuccess(res, { bookmarked: false }, 'Removed from bookmarks');
  }

  const question = await Question.findOne({ _id: questionId, type: 'qa', isActive: true }, 'language').lean();
  if (!question) throw new AppError('Question not found', 404);
  // IPP-1704: only questions of languages the user has access to
  if (!hasLanguageAccess(req.user, question.language)) {
    throw new AppError('Bookmarks are only for languages you have full access to', 403, undefined, 'NEEDS_FULL_ACCESS');
  }
  if (req.user.bookmarks.length >= MAX_BOOKMARKS) {
    throw new AppError(`You can save up to ${MAX_BOOKMARKS} questions. Remove some first`, 400);
  }

  await User.updateOne({ _id: req.user._id }, { $addToSet: { bookmarks: questionId } });
  sendSuccess(res, { bookmarked: true }, 'Saved to bookmarks');
}

/**
 * GET /api/bookmarks   (IPP-502, paid users)
 * Saved Q&A with full answers, grouped-ready (each has its language), newest saved first.
 * Questions that were deactivated or deleted are left out, and so are languages the user no longer has (IPP-1704).
 */
async function getBookmarks(req, res) {
  const ids = req.user.bookmarks;
  const questions = (
    await Question.find({ _id: { $in: ids }, type: 'qa', isActive: true })
      .select('language topic question answer codeSnippet difficulty tags companies isFree')
      .populate('language', 'name slug')
      .lean()
  ).filter((q) => q.language && hasLanguageAccess(req.user, q.language._id));

  // Keep the order in which they were saved (latest first)
  const order = new Map(ids.map((id, i) => [String(id), i]));
  questions.sort((a, b) => order.get(String(b._id)) - order.get(String(a._id)));

  sendSuccess(res, {
    questions: questions.map((q) => ({ ...q, isBookmarked: true, isLocked: false })),
    total: questions.length,
  });
}

module.exports = { toggleBookmark, getBookmarks };
