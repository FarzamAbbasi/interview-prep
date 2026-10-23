const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { buildBackup, importContent, normalizeUpload } = require('../utils/contentBackup');

/**
 * GET /api/admin/backup/export   (IPP-1005, admin)
 * All languages and questions as JSON (same format as `npm run backup`).
 */
async function exportBackup(req, res) {
  const backup = await buildBackup();
  sendSuccess(res, { backup });
}

/**
 * POST /api/admin/backup/import?dryRun=true   (IPP-1005 / IPP-1006, admin)
 * Body: a backup file ({ languages, questions }) or an upload file for one language ({ language, questions }).
 * dryRun=true checks the file and returns counts + problems without saving anything.
 * A real import adds or updates; it never deletes.
 */
async function importBackup(req, res) {
  const { languages, questions } = normalizeUpload(req.body) || {};
  if (!Array.isArray(languages) && !Array.isArray(questions)) {
    throw new AppError('This file has no "language" + "questions" (upload file) or "languages" / "questions" lists (backup file)', 400);
  }
  const dryRun = req.query.dryRun === 'true';
  const result = await importContent({ languages, questions }, { dryRun });

  const q = result.questions;
  const message = dryRun
    ? `Check done: ${q.added} new and ${q.updated} existing questions, ${q.skipped} with problems`
    : `Import done: ${q.added} questions added, ${q.updated} updated, ${q.skipped} skipped`;
  sendSuccess(res, result, message);
}

module.exports = { exportBackup, importBackup };
