const mongoose = require('mongoose');

/**
 * IPP-1601: a Q&A the user marked as "done" on the language page.
 * One row per user + question (no row = not done).
 */
const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    language: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
  },
  { timestamps: true }
);

progressSchema.index({ user: 1, question: 1 }, { unique: true });
progressSchema.index({ user: 1, language: 1 });

module.exports = mongoose.model('Progress', progressSchema);
