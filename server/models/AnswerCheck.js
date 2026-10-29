const mongoose = require('mongoose');

/**
 * IPP-1728: one AI answer check (used for the daily limit and the admin numbers).
 * The user's answer text is NOT stored here (only the verdict).
 * day = the date in Pakistan time ("2026-10-29"), so the limit resets at midnight PKT.
 * Rows are removed automatically after 120 days.
 */
const answerCheckSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    language: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
    verdict: { type: String, enum: ['right', 'partly', 'wrong'], required: true },
    source: { type: String, enum: ['questions', 'interview'], default: 'questions' },
    day: { type: String, required: true }, // YYYY-MM-DD, Asia/Karachi
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

answerCheckSchema.index({ user: 1, day: 1 }); // "how many today?"
answerCheckSchema.index({ day: 1 }); // admin numbers
answerCheckSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60 });

module.exports = mongoose.model('AnswerCheck', answerCheckSchema);
