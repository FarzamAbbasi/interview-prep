const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedOption: { type: Number, default: null }, // null = skipped
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    language: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'mixed' },
    isSample: { type: Boolean, default: false }, // free sample quiz?
    topic: { type: String, default: '' }, // IPP-404: topic slug, '' = all topics
    // Filled with the quiz questions at start (selectedOption null), answers saved on submit
    answers: [answerSchema],
    score: { type: Number, default: 0 },
    total: { type: Number, required: true },
    timeTaken: { type: Number, default: 0 }, // seconds

    // IPP-501: the server keeps the time, so the browser cannot cheat the timer
    status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
    timeLimit: { type: Number, required: true }, // seconds (30 per question)
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Dashboard history: latest attempts of a user first
quizAttemptSchema.index({ user: 1, createdAt: -1 });
// "Is this MCQ used in any quiz?" (IPP-402 delete check)
quizAttemptSchema.index({ 'answers.question': 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
