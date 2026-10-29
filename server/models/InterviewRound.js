const mongoose = require('mongoose');

/**
 * IPP-1724: one Interview Mode round (/interview).
 * Q&A items are self-rated (knew / partly / didnt / skipped). The coding item runs in the browser,
 * so the browser reports how many tests passed (same as Practice, IPP-1718).
 * text / topicName are copied at start, so the report still reads well if the content changes later.
 */
const itemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['qa', 'coding'], required: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' }, // kind 'qa'
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }, // kind 'coding'
    text: { type: String, default: '' }, // question text / problem title
    topic: { type: String, default: '' }, // qa: topic slug, coding: problem topicSlug
    topicName: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
    seconds: { type: Number, required: true }, // time for this item (Q&A 180, coding 600)

    // Q&A answer. null = not answered yet (counts as skipped when the round finishes)
    // IPP-1730: rating comes from the AI's verdict (right = knew, partly, wrong = didnt).
    // 'pending' = answered but the AI could not check it: the user rates it on the report (not in the score until then)
    rating: { type: String, enum: ['knew', 'partly', 'didnt', 'skipped', 'pending', null], default: null },
    // IPP-1730: the typed answer + the AI's check of it
    userAnswer: { type: String, default: '', maxlength: 2000 },
    aiVerdict: { type: String, enum: ['right', 'partly', 'wrong', null], default: null },
    aiPoints: { type: [String], default: undefined },
    // Coding answer
    code: { type: String, default: '', maxlength: 20000 },
    passed: { type: Number, default: 0 },
    total: { type: Number, default: 0 }, // number of tests of the problem

    points: { type: Number, default: 0 }, // 0..1 (knew 1, partly 0.5, coding passed / total)
    answeredAt: { type: Date, default: null },
  },
  { _id: false }
);

const interviewRoundSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    language: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
    level: { type: String, enum: ['junior', 'mid', 'senior'], required: true },
    isTrial: { type: Boolean, default: false }, // the one free round of an unpaid user
    items: { type: [itemSchema], default: [] },

    status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
    timeLimit: { type: Number, required: true }, // seconds = sum of item times
    expiresAt: { type: Date, required: true }, // timeLimit + time to read answers and rate
    completedAt: { type: Date },
    timeTaken: { type: Number, default: 0 }, // seconds

    score: { type: Number, default: 0 }, // sum of points
    total: { type: Number, default: 0 }, // number of items
    percentage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Dashboard history + "is a round running?"
interviewRoundSchema.index({ user: 1, status: 1, createdAt: -1 });
// Only one running round per user (two quick "Start" clicks cannot create two)
interviewRoundSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: 'in-progress' }, name: 'one_running_round' });
// Avoid repeating the last rounds' questions of a language
interviewRoundSchema.index({ user: 1, language: 1, createdAt: -1 });

module.exports = mongoose.model('InterviewRound', interviewRoundSchema);
