const Language = require('../models/Language');
const Question = require('../models/Question');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');

const isAdmin = (req) => req.user?.role === 'admin';

/**
 * Add question counts to each language:
 *   qaCount, mcqCount, freeQaCount (only active questions)
 */
async function withCounts(languages) {
  const ids = languages.map((l) => l._id);
  const counts = await Question.aggregate([
    { $match: { isActive: true, language: { $in: ids } } },
    {
      $group: {
        _id: '$language',
        qaCount: { $sum: { $cond: [{ $eq: ['$type', 'qa'] }, 1, 0] } },
        mcqCount: { $sum: { $cond: [{ $eq: ['$type', 'mcq'] }, 1, 0] } },
        freeQaCount: {
          $sum: { $cond: [{ $and: [{ $eq: ['$type', 'qa'] }, { $eq: ['$isFree', true] }] }, 1, 0] },
        },
      },
    },
  ]);

  // IPP-404: counts per topic
  const topicCounts = await Question.aggregate([
    { $match: { isActive: true, language: { $in: ids } } },
    {
      $group: {
        _id: { language: '$language', topic: '$topic' },
        qaCount: { $sum: { $cond: [{ $eq: ['$type', 'qa'] }, 1, 0] } },
        mcqCount: { $sum: { $cond: [{ $eq: ['$type', 'mcq'] }, 1, 0] } },
      },
    },
  ]);
  const topicKey = (languageId, topic) => `${languageId}:${topic}`;
  const byTopic = new Map(topicCounts.map((c) => [topicKey(c._id.language, c._id.topic), c]));

  const byId = new Map(counts.map((c) => [String(c._id), c]));
  return languages.map((l) => {
    const c = byId.get(String(l._id));
    return {
      ...l,
      qaCount: c?.qaCount || 0,
      mcqCount: c?.mcqCount || 0,
      freeQaCount: c?.freeQaCount || 0,
      topics: (l.topics || []).map((t) => {
        const tc = byTopic.get(topicKey(l._id, t.slug));
        return { name: t.name, slug: t.slug, qaCount: tc?.qaCount || 0, mcqCount: tc?.mcqCount || 0 };
      }),
    };
  });
}

/**
 * GET /api/languages   (IPP-401, public)
 * Active languages A-Z with question counts.
 * Admin can add ?all=true to include inactive ones (for the admin panel).
 */
async function getLanguages(req, res) {
  const showAll = isAdmin(req) && req.query.all === 'true';
  const filter = showAll ? {} : { isActive: true };

  const languages = await Language.find(filter).sort({ name: 1 }).lean();
  sendSuccess(res, { languages: await withCounts(languages) });
}

/**
 * GET /api/languages/:slug   (IPP-401, public)
 * One language by slug, e.g. /api/languages/php. Inactive ones are hidden (admins can see them).
 */
async function getLanguageBySlug(req, res) {
  const language = await Language.findOne({ slug: req.params.slug.toLowerCase() }).lean();

  if (!language || (!language.isActive && !isAdmin(req))) {
    throw new AppError('Language not found', 404);
  }

  const [withCount] = await withCounts([language]);
  sendSuccess(res, { language: withCount });
}

// Only these fields can be set from the request body
function pickFields(body) {
  const fields = {};
  for (const key of ['name', 'slug', 'icon', 'description', 'isActive', 'topics']) {
    if (body[key] !== undefined) fields[key] = body[key];
  }
  // Topics: keep only { name, slug? } (slug is made from the name if missing)
  if (Array.isArray(fields.topics)) {
    fields.topics = fields.topics.map((t) => ({ name: t.name, ...(t.slug ? { slug: t.slug } : {}) }));
  }
  return fields;
}

/**
 * POST /api/languages   (IPP-401, admin)
 * Body: { name, slug?, icon?, description?, isActive? }
 * slug is made from the name if not given ("C++" -> "c-plus-plus").
 */
async function createLanguage(req, res) {
  const language = await Language.create(pickFields(req.body));
  sendSuccess(res, { language }, 'Language added', 201);
}

/**
 * PUT /api/languages/:id   (IPP-401, admin)
 * Send only the fields to change. Renaming keeps the old slug (so links keep working)
 * unless a new slug is sent.
 */
async function updateLanguage(req, res) {
  const language = await Language.findById(req.params.id);
  if (!language) throw new AppError('Language not found', 404);

  const fields = pickFields(req.body);
  const oldSlugs = (language.topics || []).map((t) => t.slug);
  Object.assign(language, fields);
  await language.validate(); // fills topic slugs

  // IPP-404: a topic that still has questions cannot be removed (rename keeps the slug, so that is fine)
  if (fields.topics) {
    const newSlugs = new Set(language.topics.map((t) => t.slug));
    for (const slug of oldSlugs.filter((s) => !newSlugs.has(s))) {
      const count = await Question.countDocuments({ language: language._id, topic: slug });
      if (count > 0) {
        throw new AppError(
          `Topic "${slug}" has ${count} questions. Move them to another topic first`,
          409,
          undefined,
          'TOPIC_HAS_QUESTIONS'
        );
      }
    }
  }

  await language.save();

  sendSuccess(res, { language }, 'Language updated');
}

/**
 * DELETE /api/languages/:id   (IPP-401, admin)
 * Refused while the language still has questions, so content is never lost by mistake.
 */
async function deleteLanguage(req, res) {
  const language = await Language.findById(req.params.id);
  if (!language) throw new AppError('Language not found', 404);

  const questionCount = await Question.countDocuments({ language: language._id });
  if (questionCount > 0) {
    throw new AppError(
      `${language.name} has ${questionCount} questions. Deactivate it instead, or delete its questions first`,
      409,
      undefined,
      'LANGUAGE_HAS_QUESTIONS'
    );
  }

  await language.deleteOne();
  sendSuccess(res, null, 'Language deleted');
}

module.exports = { getLanguages, getLanguageBySlug, createLanguage, updateLanguage, deleteLanguage };
