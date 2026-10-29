const Problem = require('../models/Problem');
const ProblemProgress = require('../models/ProblemProgress');
const Language = require('../models/Language');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * IPP-1721: Admin -> Problems. Problems themselves come from data/problems/<language>.json
 * (npm run import:problems); here the admin can only hide / show or delete them.
 */

/**
 * GET /api/admin/problems?language=javascript   (admin)
 * Every problem of the language (active and hidden) with how many users solved / tried it.
 */
async function listProblems(req, res) {
  const language = await Language.findOne({ slug: String(req.query.language).toLowerCase() }, 'name slug').lean();
  if (!language) throw new AppError('Language not found', 404);

  const [problems, counts] = await Promise.all([
    Problem.find({ language: language._id })
      .select('slug title topic topicSlug topicOrder order difficulty isFree isActive')
      .sort({ topicOrder: 1, order: 1, _id: 1 })
      .lean(),
    ProblemProgress.aggregate([
      { $match: { language: language._id } },
      { $group: { _id: '$problem', tried: { $sum: 1 }, solved: { $sum: { $cond: ['$solved', 1, 0] } } } },
    ]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c]));

  sendSuccess(res, {
    language,
    problems: problems.map((p) => ({
      ...p,
      solvedCount: byId.get(String(p._id))?.solved || 0,
      triedCount: byId.get(String(p._id))?.tried || 0,
    })),
  });
}

/**
 * PATCH /api/admin/problems/:id   (admin)
 * Body: { isActive: true | false }  hide a problem from the site, or show it again.
 * Users' progress is kept; the next import keeps a hidden problem hidden.
 */
async function setProblemActive(req, res) {
  const problem = await Problem.findByIdAndUpdate(req.params.id, { $set: { isActive: req.body.isActive } }, { returnDocument: 'after' })
    .select('slug title isActive')
    .lean();
  if (!problem) throw new AppError('Problem not found', 404);
  sendSuccess(res, { problem }, problem.isActive ? 'Problem is visible again' : 'Problem hidden');
}

/**
 * DELETE /api/admin/problems/:id   (admin)
 * Deletes the problem and every user's progress on it. It stays in the JSON file,
 * so the next import adds it again (remove it from the file too, or hide it instead).
 */
async function deleteProblem(req, res) {
  const problem = await Problem.findById(req.params.id).select('slug title').lean();
  if (!problem) throw new AppError('Problem not found', 404);
  const { deletedCount } = await ProblemProgress.deleteMany({ problem: problem._id });
  await Problem.deleteOne({ _id: problem._id });
  sendSuccess(res, { problem, progressDeleted: deletedCount }, `"${problem.title}" deleted`);
}

module.exports = { listProblems, setProblemActive, deleteProblem };
