const mongoose = require('mongoose');

/**
 * Small key -> value store for app-wide settings (IPP-1008).
 * Keys used now:
 *   lastFullBackup: { at: Date, by: "admin email" or "command line", users, questions, quizAttempts }
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
