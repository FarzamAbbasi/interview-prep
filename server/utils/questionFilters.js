const mongoose = require('mongoose');
const Language = require('../models/Language');
const AppError = require('./AppError');

// Make user text safe to use inside a RegExp
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Read paging from the query string: ?page=2&limit=10
 * (Express 5 query values are read-only strings, so parse here.)
 */
function getPaging(query, defaultLimit = 10, maxLimit = 50) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Find the language from ?language=php (slug) or ?language=<id>.
 * Returns null when no language was asked for.
 * onlyActive: hide inactive languages (public pages).
 */
async function findLanguage(value, { onlyActive }) {
  if (!value) return null;
  const query = mongoose.isValidObjectId(value) ? { _id: value } : { slug: String(value).toLowerCase() };
  const language = await Language.findOne(query).select('name slug isActive topics').lean();
  if (!language || (onlyActive && !language.isActive)) throw new AppError('Language not found', 404);
  return language;
}

/**
 * Build the MongoDB filter shared by the public and admin lists.
 *   ?difficulty=easy|medium|hard  ?tag=oop  ?search=array
 * search looks in the question text and tags (case-insensitive, part of a word works).
 */
function baseFilter(query) {
  const filter = {};
  if (['easy', 'medium', 'hard'].includes(query.difficulty)) filter.difficulty = query.difficulty;
  if (query.tag) filter.tags = String(query.tag).toLowerCase().trim();
  if (query.topic) filter.topic = String(query.topic).toLowerCase().trim(); // IPP-404

  const search = String(query.search || '').trim().slice(0, 100);
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ question: regex }, { tags: regex }];
  }
  return filter;
}

const pagination = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

module.exports = { getPaging, findLanguage, baseFilter, pagination };
