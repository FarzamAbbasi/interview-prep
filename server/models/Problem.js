const mongoose = require('mongoose');

/**
 * IPP-1715: a coding problem (Practice page). The user's code runs in the browser
 * against `tests`; the server only stores and serves problems.
 * Content comes from data/problems/<language>.json via `npm run import:problems`.
 */
const exampleSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String, default: '' },
  },
  { _id: false }
);

const testSchema = new mongoose.Schema(
  {
    args: { type: [mongoose.Schema.Types.Mixed], default: [] }, // arguments for functionName(...args)
    expected: { type: mongoose.Schema.Types.Mixed }, // compared with deep equal
    visible: { type: Boolean, default: false }, // true = used by Run; Submit uses all tests
    failHint: { type: String, default: '' }, // shown when this test fails
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    language: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: [true, 'Title is required'], trim: true },
    topic: { type: String, required: [true, 'Topic is required'], trim: true }, // e.g. "Strings"
    topicSlug: { type: String, lowercase: true, trim: true }, // e.g. "strings"
    topicOrder: { type: Number, default: 0 }, // topic position in the file
    order: { type: Number, default: 0 }, // problem position inside its topic
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
    isFree: { type: Boolean, default: false }, // open for guests and unpaid users
    scenario: { type: String, default: '' },
    description: { type: String, required: [true, 'Description is required'] },
    functionName: { type: String, required: true, match: [/^[A-Za-z_$][\w$]*$/, 'Invalid function name'] },
    starterCode: { type: String, required: true },
    examples: { type: [exampleSchema], default: [] },
    constraints: { type: [String], default: [] },
    tests: { type: [testSchema], default: [] },
    hints: { type: [String], default: [] },
    solution: {
      code: { type: String, default: '' },
      explanation: { type: String, default: '' },
    },
    followUp: { type: String, default: '' },
    relatedTopic: { type: String, default: '' }, // a Q&A topic name of the same language
    companies: { type: [String], default: [] }, // only real interview data
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

problemSchema.index({ language: 1, slug: 1 }, { unique: true });
problemSchema.index({ language: 1, topicOrder: 1, order: 1 });

module.exports = mongoose.model('Problem', problemSchema);
