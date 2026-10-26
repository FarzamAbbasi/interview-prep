/**
 * IPP-1008: remember when the last FULL backup was made (content-only backups do not count,
 * because they do not have users / paid access / quiz results).
 * Used by the admin dashboard reminder ("Last full backup: 3 days ago").
 */
const Setting = require('../models/Setting');
const User = require('../models/User');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');

const KEY = 'lastFullBackup';

async function recordFullBackup(backup, by) {
  const value = {
    at: new Date(),
    by,
    users: backup.users?.length || 0,
    questions: backup.questions?.length || 0,
    quizAttempts: backup.quizAttempts?.length || 0,
  };
  await Setting.updateOne({ key: KEY }, { $set: { value } }, { upsert: true });
  return value;
}

/**
 * @returns {Promise<null | { at, by, users, questions, quizAttempts,
 *   changesSince: { usersChanged, newPaid, questionsChanged, quizzes } }>}
 */
async function getLastFullBackup() {
  const setting = await Setting.findOne({ key: KEY }).lean();
  if (!setting?.value?.at) return null;
  const at = new Date(setting.value.at);

  // What a new backup would add: anything created or changed after the last one
  const [usersChanged, newPaid, questionsChanged, quizzes] = await Promise.all([
    User.countDocuments({ updatedAt: { $gt: at } }),
    User.countDocuments({ isPaid: true, paidAt: { $gt: at } }),
    Question.countDocuments({ updatedAt: { $gt: at } }),
    QuizAttempt.countDocuments({ status: 'completed', completedAt: { $gt: at } }),
  ]);
  return { ...setting.value, at, changesSince: { usersChanged, newPaid, questionsChanged, quizzes } };
}

module.exports = { recordFullBackup, getLastFullBackup };
