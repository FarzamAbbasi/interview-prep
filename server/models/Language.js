const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

// IPP-404: topics of a language, in display order. Questions store the topic slug.
const topicSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Topic name is required'], trim: true, maxlength: 50 },
    slug: { type: String, lowercase: true, trim: true },
  },
  { _id: false }
);

const languageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Language name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    icon: { type: String, default: '' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    topics: { type: [topicSchema], default: [] },
  },
  { timestamps: true }
);

// Create slug from name if not given, e.g. "C++" -> "c-plus-plus"
languageSchema.pre('validate', function () {
  if (!this.slug && this.name) this.slug = slugify(this.name);

  // Topic slugs come from their names; two topics cannot share a slug
  const seen = new Set();
  for (const topic of this.topics || []) {
    if (!topic.slug) topic.slug = slugify(topic.name);
    if (seen.has(topic.slug)) this.invalidate('topics', `Topic "${topic.name}" is listed twice`);
    seen.add(topic.slug);
  }
});

module.exports = mongoose.model('Language', languageSchema);
