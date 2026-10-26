/**
 * IPP-1601: "done" counts for the language pages.
 * Only questions the user can still see are counted (active Q&A; first topic only in locked languages),
 * so a progress bar never goes above 100%.
 */
const Progress = require('../models/Progress');
const Question = require('../models/Question');
const { hasFullAccess } = require('./access');
const Language = require('../models/Language');
const { visibleCondition } = require('./freeAccess');

/**
 * @returns {Promise<null | { byLanguage: Map<string, number>, byTopic: Map<string, number> }>}
 *   byTopic key: `${languageId}:${topicSlug}`
 */
async function doneCounts(user, languageIds) {
  if (!user) return null;
  const result = { byLanguage: new Map(), byTopic: new Map() };
  const rows = await Progress.find({ user: user._id, language: { $in: languageIds } }, 'question').lean();
  if (!rows.length) return result;

  let match = { _id: { $in: rows.map((r) => r.question) }, isActive: true, type: 'qa' };
  if (!hasFullAccess(user)) {
    const languages = await Language.find({ _id: { $in: languageIds } }, 'topics').lean();
    match = { $and: [match, visibleCondition(languages, user)] }; // IPP-1607 / 1704: first topic where locked
  }
  const counted = await Question.aggregate([
    { $match: match },
    { $group: { _id: { language: '$language', topic: '$topic' }, n: { $sum: 1 } } },
  ]);
  counted.forEach(({ _id, n }) => {
    const lang = String(_id.language);
    result.byLanguage.set(lang, (result.byLanguage.get(lang) || 0) + n);
    result.byTopic.set(`${lang}:${_id.topic || ''}`, n);
  });
  return result;
}

// Set of question ids (strings) the user marked as done, out of the given ones
async function doneIdSet(user, questionIds) {
  if (!user || !questionIds.length) return new Set();
  const rows = await Progress.find({ user: user._id, question: { $in: questionIds } }, 'question').lean();
  return new Set(rows.map((r) => String(r.question)));
}

module.exports = { doneCounts, doneIdSet };
