/**
 * IPP-1607: what guests and unpaid users may open = the FIRST topic of every language
 * (all its Q&A, and its MCQs for the sample quiz). Everything else needs full access.
 * The order of topics is the order the admin set in Admin -> Languages.
 * A language without topics has nothing free.
 * IPP-1704: a user with access to only some languages sees everything in those, first topic in the rest.
 * IPP-1732: a question with companies ("Asked at Amazon") is never free, even in the first topic.
 */
const { hasFullAccess, hasLanguageAccess } = require('./access');

const firstTopicSlug = (language) => language?.topics?.[0]?.slug || null;

const hasCompanies = (question) => Array.isArray(question?.companies) && question.companies.length > 0;

const isFreeFor = (question, language) => {
  const first = firstTopicSlug(language);
  return Boolean(first) && question.topic === first && !hasCompanies(question);
};

// MongoDB condition: no companies (IPP-1732)
const NO_COMPANIES = { 'companies.0': { $exists: false } };

// MongoDB condition: questions in the first topic of these languages (matches nothing when none has topics)
function freeCondition(languages) {
  const parts = languages
    .map((l) => ({ language: l._id, topic: firstTopicSlug(l), ...NO_COMPANIES }))
    .filter((p) => p.topic);
  return parts.length ? { $or: parts } : { _id: null };
}

// IPP-1704: can this user open this question? (free topic, or the language is unlocked)
const canOpen = (question, language, user) => isFreeFor(question, language) || hasLanguageAccess(user, language?._id);

/**
 * IPP-1704: MongoDB condition for what this user may open in these languages.
 * null = no limit (access to every language).
 */
function visibleCondition(languages, user) {
  if (hasFullAccess(user)) return null;
  const parts = [];
  languages.forEach((l) => {
    if (hasLanguageAccess(user, l._id)) parts.push({ language: l._id });
    else if (firstTopicSlug(l)) parts.push({ language: l._id, topic: firstTopicSlug(l), ...NO_COMPANIES });
  });
  return parts.length ? { $or: parts } : { _id: null };
}

module.exports = { firstTopicSlug, hasCompanies, NO_COMPANIES, isFreeFor, freeCondition, canOpen, visibleCondition };
