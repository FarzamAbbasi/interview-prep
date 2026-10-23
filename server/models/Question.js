const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    language: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Language',
      required: [true, 'Language is required'],
    },
    type: {
      type: String,
      enum: ['qa', 'mcq'], // later: 'coding'
      required: true,
    },
    // IPP-404: slug of one of the language's topics, e.g. "oop"
    topic: { type: String, lowercase: true, trim: true, default: '' },
    question: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    // Q&A: the full answer. MCQ: the explanation shown after submit.
    answer: {
      type: String,
      required: [true, 'Answer / explanation is required'],
    },
    options: {
      type: [String],
      default: undefined,
      validate: {
        validator: function (value) {
          if (this.type !== 'mcq') return true;
          return Array.isArray(value) && value.length === 4;
        },
        message: 'MCQ must have exactly 4 options',
      },
    },
    correctOption: {
      type: Number,
      min: 0,
      max: 3,
      required: [
        function () {
          return this.type === 'mcq';
        },
        'MCQ needs a correct option (0-3)',
      ],
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    tags: [{ type: String, lowercase: true, trim: true }],
    codeSnippet: { type: String, default: '' },
    isFree: { type: Boolean, default: false }, // visible to guests / sample quiz
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Fast filtering: language + type + difficulty
questionSchema.index({ language: 1, type: 1, difficulty: 1 });
// Topic pages and topic quizzes
questionSchema.index({ language: 1, topic: 1, type: 1 });
// Keyword search.
// MongoDB treats a field named "language" as the text-search language by default,
// but ours is an ObjectId, so point that setting at an unused field instead.
questionSchema.index(
  { question: 'text', tags: 'text' },
  { name: 'question_search', language_override: 'searchLanguage', default_language: 'english' }
);

module.exports = mongoose.model('Question', questionSchema);
