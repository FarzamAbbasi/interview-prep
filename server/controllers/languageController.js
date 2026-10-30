const Language = require('../models/Language');
const Question = require('../models/Question');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { doneCounts } = require('../utils/progress');
const { firstTopicSlug } = require('../utils/freeAccess');
const { hasLanguageAccess } = require('../utils/access');

const isAdmin = (req) => req.user?.role === 'admin';

const qa = { $eq: ['$type', 'qa'] };
const sumIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
const COUNT_FIELDS = {
  qaCount: sumIf(qa),
  mcqCount: sumIf({ $eq: ['$type', 'mcq'] }),
  // IPP-1602: difficulty mix of the Q&A (green / yellow / red bar)
  easy: sumIf({ $and: [qa, { $eq: ['$difficulty', 'easy'] }] }),
  medium: sumIf({ $and: [qa, { $eq: ['$difficulty', 'medium'] }] }),
  hard: sumIf({ $and: [qa, { $eq: ['$difficulty', 'hard'] }] }),
  // IPP-1732: Q&A without companies (company questions are never free)
  openQaCount: sumIf({ $and: [qa, { $eq: [{ $size: { $ifNull: ['$companies', []] } }, 0] }] }),
};
const pickCounts = (c, done) => {
  const counts = {
    qaCount: c?.qaCount || 0,
    mcqCount: c?.mcqCount || 0,
    freeQaCount: c?.freeQaCount || 0,
    difficulty: { easy: c?.easy || 0, medium: c?.medium || 0, hard: c?.hard || 0 },
  };
  if (done !== undefined) counts.doneCount = done; // IPP-1601: only for logged-in users
  return counts;
};

/**
 * Add question counts to each language and each topic (only active questions):
 *   qaCount, mcqCount, freeQaCount, difficulty { easy, medium, hard }
 *   + doneCount when a user is logged in (IPP-1601)
 */
async function withCounts(languages, user) {
  const ids = languages.map((l) => l._id);
  const match = { $match: { isActive: true, language: { $in: ids } } };
  const [counts, topicCounts, done] = await Promise.all([
    Question.aggregate([match, { $group: { _id: '$language', ...COUNT_FIELDS } }]),
    Question.aggregate([match, { $group: { _id: { language: '$language', topic: '$topic' }, ...COUNT_FIELDS } }]), // IPP-404
    doneCounts(user, ids),
  ]);
  const topicKey = (languageId, topic) => `${languageId}:${topic || ''}`;
  const byTopic = new Map(topicCounts.map((c) => [topicKey(c._id.language, c._id.topic), c]));
  const byId = new Map(counts.map((c) => [String(c._id), c]));

  // IPP-1607: free = the first topic, so freeQaCount = that topic's Q&A count
  return languages.map((l) => {
    const first = firstTopicSlug(l);
    const firstCounts = first ? byTopic.get(topicKey(l._id, first)) : null;
    return {
      ...l,
      hasAccess: hasLanguageAccess(user, l._id), // IPP-1704: every topic open for this user?
      ...pickCounts(byId.get(String(l._id)), done ? done.byLanguage.get(String(l._id)) || 0 : undefined),
      freeQaCount: firstCounts?.openQaCount || 0, // IPP-1732: minus company questions
      topics: (l.topics || []).map((t) => {
        const key = topicKey(l._id, t.slug);
        const c = byTopic.get(key);
        return {
          name: t.name,
          slug: t.slug,
          ...pickCounts(c, done ? done.byTopic.get(key) || 0 : undefined),
          freeQaCount: t.slug === first ? c?.openQaCount || 0 : 0,
        };
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
  sendSuccess(res, { languages: await withCounts(languages, req.user) });
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

  const [withCount] = await withCounts([language], req.user);
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
