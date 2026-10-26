const Question = require('../models/Question');
const Progress = require('../models/Progress');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { canOpen } = require('../utils/freeAccess');

/**
 * PUT /api/progress/:questionId   (IPP-1601, logged in)
 * Body: { done: true | false }  marks a Q&A as done (or not) for the progress bars.
 * Only questions the user can read: the first topic of the language (IPP-1607), or every one of an unlocked language.
 */
async function setDone(req, res) {
  const question = await Question.findOne({ _id: req.params.questionId, type: 'qa', isActive: true }).populate(
    'language',
    'isActive topics'
  );
  if (!question || !question.language?.isActive) throw new AppError('Question not found', 404);
  if (!canOpen(question, question.language, req.user)) { // IPP-1704: free topic or unlocked language
    throw new AppError('This question needs full access', 403, undefined, 'NEEDS_FULL_ACCESS');
  }

  const done = req.body.done;
  const key = { user: req.user._id, question: question._id };
  if (done) {
    await Progress.updateOne(key, { $setOnInsert: { ...key, language: question.language._id } }, { upsert: true });
  } else {
    await Progress.deleteOne(key);
  }
  sendSuccess(res, { questionId: question._id, done }, done ? 'Marked as done' : 'Marked as not done');
}

module.exports = { setDone };
