const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { buildBackup, importContent, normalizeUpload } = require('../utils/contentBackup');
const { recordFullBackup, getLastFullBackup } = require('../utils/backupLog');

/**
 * GET /api/admin/backup/export?scope=full|content   (IPP-1005 / IPP-1007, admin)
 * full (default): languages, questions, users (with hashed passwords + bookmarks) and completed quiz attempts.
 * content: only languages and questions (no personal data, safe to share).
 * Same format as `npm run backup`.
 */
async function exportBackup(req, res) {
  const full = req.query.scope !== 'content';
  const backup = await buildBackup({ includeUsers: full });
  const lastBackup = full ? await recordFullBackup(backup, req.user.email) : undefined; // IPP-1008
  sendSuccess(res, { backup, lastBackup });
}

/**
 * GET /api/admin/backup/last   (IPP-1008, admin)
 * When the last full backup was made, and how much changed since then (null = never).
 */
async function getLastBackup(req, res) {
  sendSuccess(res, { lastBackup: await getLastFullBackup() });
}

/**
 * POST /api/admin/backup/import?dryRun=true   (IPP-1005 / IPP-1006, admin)
 * Body: a backup file ({ languages, questions, users?, quizAttempts? }) or an upload file for one language ({ language, questions }).
 * dryRun=true checks the file and returns counts + problems without saving anything.
 * A real import adds or updates content; users and quiz attempts are only added when missing. Nothing is deleted.
 */
async function importBackup(req, res) {
  const { languages, questions, users, quizAttempts } = normalizeUpload(req.body) || {};
  if (![languages, questions, users, quizAttempts].some(Array.isArray)) {
    throw new AppError('This file has no "language" + "questions" (upload file) or "languages" / "questions" lists (backup file)', 400);
  }
  const dryRun = req.query.dryRun === 'true';
  const result = await importContent({ languages, questions, users, quizAttempts }, { dryRun });

  const q = result.questions;
  let message = dryRun
    ? `Check done: ${q.added} new and ${q.updated} existing questions, ${q.skipped} with problems`
    : `Import done: ${q.added} questions added, ${q.updated} updated, ${q.skipped} skipped`;
  if (result.users) {
    message += dryRun ? `; ${result.users.added} new users` : `; ${result.users.added} users added`;
  }
  if (result.quizAttempts) {
    message += dryRun ? `, ${result.quizAttempts.added} new quiz results` : `, ${result.quizAttempts.added} quiz results added`;
  }
  sendSuccess(res, result, message);
}

module.exports = { exportBackup, importBackup, getLastBackup };
