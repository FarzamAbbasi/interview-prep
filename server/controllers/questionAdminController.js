const Question = require('../models/Question');
const Language = require('../models/Language');
const QuizAttempt = require('../models/QuizAttempt');
const Progress = require('../models/Progress');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPaging, findLanguage, baseFilter, pagination } = require('../utils/questionFilters');

// Fields the admin can set. "type" can only be set when creating.
const EDITABLE = ['language', 'topic', 'question', 'answer', 'options', 'correctOption', 'difficulty', 'tags', 'companies', 'codeSnippet', 'isFree', 'isActive'];

function pickFields(body, allowType) {
  const fields = {};
  for (const key of allowType ? ['type', ...EDITABLE] : EDITABLE) {
    if (body[key] !== undefined) fields[key] = body[key];
  }
  return fields;
}

/**
 * MCQ rules, checked on the final question (after an edit is merged in):
 * exactly 4 different, non-empty options and a correct option 0-3.
 * Q&A questions must not keep options.
 */
function checkQuestionShape(q) {
  if (q.type === 'qa') {
    q.options = undefined;
    q.correctOption = undefined;
    return;
  }

  const errors = [];
  const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
  if (options.length !== 4 || options.some((o) => !o)) {
    errors.push({ field: 'options', message: 'MCQ must have exactly 4 options, none empty' });
  } else if (new Set(options).size !== 4) {
    errors.push({ field: 'options', message: 'MCQ options must all be different' });
  }
  if (!Number.isInteger(q.correctOption) || q.correctOption < 0 || q.correctOption > 3) {
    errors.push({ field: 'correctOption', message: 'Choose the correct option (0 to 3)' });
  }
  if (errors.length) throw new AppError(errors[0].message, 400, errors);
  q.options = options;
}

/**
 * The language must exist, and the topic must be one of its topics (IPP-404).
 * If the language has topics, every question needs one.
 */
async function checkLanguageAndTopic(question) {
  const language = await Language.findById(question.language).select('topics').lean();
  if (!language) throw new AppError('Language not found', 400, [{ field: 'language', message: 'Language not found' }]);

  const slugs = (language.topics || []).map((t) => t.slug);
  if (!slugs.length) return; // language without topics: topic stays optional
  if (!question.topic) {
    throw new AppError('Choose a topic', 400, [{ field: 'topic', message: 'Choose a topic' }]);
  }
  if (!slugs.includes(question.topic)) {
    throw new AppError('This topic does not belong to the chosen language', 400, [
      { field: 'topic', message: `Topic must be one of: ${slugs.join(', ')}` },
    ]);
  }
}

/**
 * GET /api/admin/questions   (IPP-403, for the admin table in IPP-1003)
 * Everything, including MCQs, inactive questions and answers.
 *   ?language=php|<id> &type=qa|mcq &difficulty= &tag= &search= &isFree=true|false &isActive=true|false &page= &limit=
 * Newest first, 20 per page by default.
 */
async function listQuestions(req, res) {
  const { page, limit, skip } = getPaging(req.query, 20, 100);
  const filter = baseFilter(req.query);

  const language = await findLanguage(req.query.language, { onlyActive: false });
  if (language) filter.language = language._id;
  if (['qa', 'mcq'].includes(req.query.type)) filter.type = req.query.type;
  for (const key of ['isFree', 'isActive']) {
    if (req.query[key] === 'true') filter[key] = true;
    if (req.query[key] === 'false') filter[key] = false;
  }

  const [questions, total] = await Promise.all([
    Question.find(filter).populate('language', 'name slug').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Question.countDocuments(filter),
  ]);

  sendSuccess(res, { questions, pagination: pagination(page, limit, total) });
}

/**
 * GET /api/admin/questions/:id   (IPP-402)
 * Full question with the answer, for the admin edit form.
 */
async function getQuestion(req, res) {
  const question = await Question.findById(req.params.id).populate('language', 'name slug');
  if (!question) throw new AppError('Question not found', 404);
  sendSuccess(res, { question });
}

/**
 * POST /api/admin/questions   (IPP-402)
 * Q&A:  { language, type: "qa",  question, answer, difficulty?, tags?, companies?, codeSnippet?, isFree?, isActive? }
 * MCQ:  { language, type: "mcq", question, answer (= explanation), options: [4], correctOption: 0-3, ... }
 */
async function createQuestion(req, res) {
  const question = new Question(pickFields(req.body, true));
  checkQuestionShape(question);
  await checkLanguageAndTopic(question);
  await question.save();
  sendSuccess(res, { question }, 'Question added', 201);
}

/**
 * PUT /api/admin/questions/:id   (IPP-402)
 * Send only the fields to change, e.g. { "isFree": true } or { "isActive": false }.
 * The type (qa / mcq) cannot be changed: create a new question instead.
 */
async function updateQuestion(req, res) {
  if (req.body.type !== undefined) {
    throw new AppError('Question type cannot be changed. Create a new question instead', 400, [
      { field: 'type', message: 'Question type cannot be changed' },
    ]);
  }

  const question = await Question.findById(req.params.id);
  if (!question) throw new AppError('Question not found', 404);

  const fields = pickFields(req.body, false);
  Object.assign(question, fields);
  checkQuestionShape(question);
  if (fields.language || fields.topic !== undefined) await checkLanguageAndTopic(question);

  await question.save();
  sendSuccess(res, { question }, 'Question updated');
}

/**
 * DELETE /api/admin/questions/:id   (IPP-402)
 * An MCQ that is part of any quiz result cannot be deleted (old results would break):
 * deactivate it instead. Deleted questions are also removed from users' bookmarks.
 */
async function deleteQuestion(req, res) {
  const question = await Question.findById(req.params.id);
  if (!question) throw new AppError('Question not found', 404);

  if (question.type === 'mcq') {
    const usedInQuiz = await QuizAttempt.exists({ 'answers.question': question._id });
    if (usedInQuiz) {
      throw new AppError(
        'This MCQ is part of quiz results, so it cannot be deleted. Deactivate it instead',
        409,
        undefined,
        'QUESTION_IN_USE'
      );
    }
  }

  await question.deleteOne();
  await User.updateMany({ bookmarks: question._id }, { $pull: { bookmarks: question._id } });
  await Progress.deleteMany({ question: question._id }); // IPP-1601

  sendSuccess(res, null, 'Question deleted');
}

module.exports = { listQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion };
