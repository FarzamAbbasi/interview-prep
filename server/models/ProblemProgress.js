const mongoose = require('mongoose');

/**
 * IPP-1718: one row per user + coding problem, created on the first Submit.
 * solved = at least one Submit passed every test. fails = failed submits (used to offer hints / the solution).
 * code = the last submitted code, so the user gets it back on another device.
 */
const problemProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    language: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
    submits: { type: Number, default: 0 },
    fails: { type: Number, default: 0 },
    solved: { type: Boolean, default: false },
    solvedAt: { type: Date, default: null },
    code: { type: String, default: '', maxlength: 20000 },
  },
  { timestamps: true }
);

problemProgressSchema.index({ user: 1, problem: 1 }, { unique: true });
problemProgressSchema.index({ user: 1, language: 1, updatedAt: -1 });

module.exports = mongoose.model('ProblemProgress', problemProgressSchema);
