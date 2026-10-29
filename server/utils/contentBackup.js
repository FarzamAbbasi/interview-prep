/**
 * Content backup and import (languages + questions), shared by:
 *   - scripts/backup.js and scripts/seed.js (command line)
 *   - /api/admin/backup (admin panel, IPP-1005)
 *
 * File format (language slugs instead of database ids, so it works on any database):
 *   { exportedAt, languages: [{ name, slug, icon, description, isActive, topics: [{ name, slug }] }],
 *     questions: [{ language: "php", type, topic, question, answer, codeSnippet, difficulty, tags,
 *                   isFree, isActive, options?, correctOption? }] }
 *
 * Upload format for one language (IPP-1006, Admin -> Bulk upload), turned into the format above by normalizeUpload():
 *   { language: { name, slug?, icon?, description?, isActive?, topics: ["Basics", ...] or [{ name, slug }] },
 *     questions: [{ type, topic (name or slug), question, answer, ..., options?, correctOption? or correctAnswer? }] }
 *
 * Import only ADDS or UPDATES, it never deletes:
 *   - languages are matched by slug; topics are merged (topics missing from the file are kept)
 *   - questions are matched by language + question text (no duplicates when importing twice)
 *
 * IPP-1723: both backups also have "problems" (coding problems, same fields as data/problems/<language>.json
 * plus language slug + isActive). They are matched by language + slug: new ones are added, existing ones updated
 * (a hidden problem stays hidden). Every solution is run against its tests first; a broken problem is skipped.
 *
 * IPP-1007: a full backup also has "users" and "quizAttempts" (see utils/userBackup.js),
 * and since IPP-1722 "problemProgress" (coding problems solved / tried), since IPP-1727 "interviewRounds".
 * Languages and questions keep their original createdAt when they are restored (an existing one keeps its own date).
 * Those are only ADDED when missing; existing users and attempts are never changed.
 */
const mongoose = require('mongoose');
const Language = require('../models/Language');
const Question = require('../models/Question');
const Problem = require('../models/Problem');
const { checkProblemsList } = require('./problemCheck');
const slugify = require('./slugify');
const { buildUserBackup, importUsers, questionKey } = require('./userBackup');

const MAX_ERRORS = 50;
const MAX_ITEMS = 2000; // rows shown in the upload preview
const short = (text) => `"${String(text || '').slice(0, 50)}${String(text || '').length > 50 ? '…' : ''}"`;

/**
 * @param {{ includeUsers?: boolean }} options  includeUsers=false -> content only (no emails / passwords, safe to share)
 */
async function buildBackup({ includeUsers = true } = {}) {
  const languages = await Language.find().sort('name').lean();
  const questions = await Question.find().populate('language', 'slug').sort('createdAt').lean();
  const problems = await Problem.find().populate('language', 'slug').sort({ topicOrder: 1, order: 1, _id: 1 }).lean(); // IPP-1723

  const backup = {
    version: 2,
    scope: includeUsers ? 'full' : 'content',
    exportedAt: new Date().toISOString(),
    languages: languages.map(({ name, slug, icon, description, isActive, topics = [], createdAt }) => ({
      name,
      slug,
      icon,
      description,
      isActive,
      topics: topics.map((t) => ({ name: t.name, slug: t.slug })),
      createdAt,
    })),
    questions: questions
      .filter((q) => q.language) // skip questions whose language was deleted
      .map((q) => {
        const item = {
          language: q.language.slug,
          type: q.type,
          topic: q.topic || '',
          question: q.question,
          answer: q.answer,
          codeSnippet: q.codeSnippet,
          difficulty: q.difficulty,
          tags: q.tags,
          isFree: q.isFree,
          isActive: q.isActive,
          createdAt: q.createdAt,
        };
        if (q.type === 'mcq') {
          item.options = q.options;
          item.correctOption = q.correctOption;
        }
        return item;
      }),
    // IPP-1723: coding problems (no personal data, so in "content only" too)
    problems: problems
      .filter((p) => p.language) // skip problems whose language was deleted
      .sort((a, b) => a.language.slug.localeCompare(b.language.slug))
      .map(({ _id, __v, language, topicSlug, topicOrder, updatedAt, ...rest }) => ({ language: language.slug, ...rest })),
  };
  if (includeUsers) Object.assign(backup, await buildUserBackup());
  return backup;
}

// Same MCQ rules as the admin API (exactly 4 different, non-empty options + correct option 0-3)
function mcqProblem(q) {
  const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
  if (options.length !== 4 || options.some((o) => !o)) return 'MCQ must have exactly 4 options, none empty';
  if (new Set(options).size !== 4) return 'MCQ options must all be different';
  if (!Number.isInteger(q.correctOption) || q.correctOption < 0 || q.correctOption > 3) return 'MCQ needs a correct option (0-3)';
  return null;
}

/**
 * Turn an upload file into the backup format. A backup file is returned unchanged.
 *   { language: {...}, questions: [...] }  ->  { languages: [language], questions: [...with language slug] }
 */
function normalizeUpload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  if (!data.language || typeof data.language !== 'object' || Array.isArray(data.language)) return data;

  const language = { ...data.language };
  language.slug = slugify(language.slug || language.name);
  if (Array.isArray(language.topics)) {
    language.topics = language.topics.map((t) => (typeof t === 'string' ? { name: t } : t));
  } else {
    delete language.topics; // no topics in the file: keep the language's topics as they are
  }
  const questions = (Array.isArray(data.questions) ? data.questions : []).map((q) =>
    q && typeof q === 'object' ? { ...q, language: q.language || language.slug } : q
  );
  return { languages: [language], questions };
}

// createdAt from a backup file (only used when the item is created, never changes an existing one)
function fileDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const LANGUAGE_FIELDS_WITH_DEFAULTS = { icon: '', description: '', isActive: true };

/**
 * @param {{ languages?: object[], questions?: object[], users?: object[], quizAttempts?: object[] }} data
 * @param {{ dryRun?: boolean }} options  dryRun: check everything and count, but write nothing
 * @returns {{ languages: {added, updated}, questions: {added, updated, skipped}, errors: string[], dryRun,
 *             languageItems: object[], items: object[],    (items = one row per question, for the preview)
 *             users?, quizAttempts?, bookmarksMissing? }}  (only when the file has users / quizAttempts)
 */
async function importContent(data, { dryRun = false } = {}) {
  const fileLanguages = Array.isArray(data?.languages) ? data.languages : [];
  const fileQuestions = Array.isArray(data?.questions) ? data.questions : [];
  const errors = [];
  const addError = (message) => errors.length < MAX_ERRORS && errors.push(message);
  const languageItems = [];
  const items = [];
  const addItem = (item) => items.length < MAX_ITEMS && items.push(item);

  // ---- Languages ----
  const slugToLanguage = new Map(); // slug -> { _id, name, topicSlugs }
  const existingLanguages = await Language.find().lean();
  existingLanguages.forEach((l) =>
    slugToLanguage.set(l.slug, { _id: l._id, name: l.name, topicSlugs: new Set((l.topics || []).map((t) => t.slug)) })
  );

  const languageOps = [];
  let languagesAdded = 0;
  let languagesUpdated = 0;

  for (const [i, raw] of fileLanguages.entries()) {
    const label = `Language #${i + 1} ${short(raw?.name || raw?.slug)}`;
    const failLanguage = (reason) => {
      addError(`${label}: ${reason}`);
      languageItems.push({ name: String(raw?.name || raw?.slug || ''), slug: String(raw?.slug || ''), status: 'error', reason, topicsNew: [] });
    };
    if (!raw || typeof raw !== 'object') {
      failLanguage('not a language object');
      continue;
    }

    // Only a slug given (e.g. adding questions to PHP): take the name from the database
    const givenSlug = raw.slug ? slugify(raw.slug) : '';
    const sameSlug = givenSlug && existingLanguages.find((l) => l.slug === givenSlug);
    const doc = new Language({ ...raw, name: raw.name || sameSlug?.name });
    try {
      await doc.validate(); // fills slug + topic slugs
    } catch (err) {
      failLanguage(err.errors ? Object.values(err.errors).map((e) => e.message).join(', ') : err.message);
      continue;
    }

    const existing = existingLanguages.find((l) => l.slug === doc.slug);
    const nameTaken = existingLanguages.find((l) => l.slug !== doc.slug && l.name.toLowerCase() === doc.name.toLowerCase());
    if (nameTaken) {
      failLanguage(`the name "${doc.name}" is already used by the language with slug "${nameTaken.slug}"`);
      continue;
    }

    // Merge topics: keep existing ones, take new names from the file, add new topics at the end
    const topics = (existing?.topics || []).map((t) => ({ name: t.name, slug: t.slug }));
    const topicsNew = [];
    doc.topics.forEach((t) => {
      const same = topics.find((x) => x.slug === t.slug);
      if (same) same.name = t.name;
      else {
        topics.push({ name: t.name, slug: t.slug });
        topicsNew.push(t.name);
      }
    });

    // Fields missing from the file are not overwritten (a short upload file keeps the description and logo)
    const set = { name: doc.name, slug: doc.slug, topics };
    const setOnInsert = {};
    Object.entries(LANGUAGE_FIELDS_WITH_DEFAULTS).forEach(([key, fallback]) => {
      if (raw[key] !== undefined) set[key] = doc[key];
      else if (!existing) setOnInsert[key] = fallback;
    });
    // Dates are set here (timestamps: false below), so a restored language keeps its original createdAt
    const now = new Date();
    set.updatedAt = now;
    setOnInsert.createdAt = fileDate(raw.createdAt) || now;

    if (existing) languagesUpdated += 1;
    else languagesAdded += 1;
    languageItems.push({ name: doc.name, slug: doc.slug, status: existing ? 'update' : 'new', topicsNew, topicCount: topics.length });

    slugToLanguage.set(doc.slug, {
      _id: existing?._id || new mongoose.Types.ObjectId(), // new id is only used in dry run / for upsert
      name: doc.name,
      topicSlugs: new Set(topics.map((t) => t.slug)),
      isNew: !existing,
    });
    const update = { $set: set, $setOnInsert: setOnInsert };
    languageOps.push({ updateOne: { filter: { slug: doc.slug }, update, upsert: true, timestamps: false } });
  }

  if (!dryRun && languageOps.length) {
    await Language.bulkWrite(languageOps);
    // Use the real ids of newly created languages
    const fresh = await Language.find({ slug: { $in: [...slugToLanguage.keys()] } }, 'slug').lean();
    fresh.forEach((l) => {
      slugToLanguage.get(l.slug)._id = l._id;
    });
  }

  // ---- Questions ----
  const languageIds = [...slugToLanguage.values()].map((l) => l._id);
  const existingTexts = new Set(
    (await Question.find({ language: { $in: languageIds } }, 'language question').lean()).map((q) => `${q.language}|${q.question}`)
  );
  const seenInFile = new Set();
  const fileQuestionKeys = []; // "slug|question text" of valid questions in the file (for users' bookmarks in a dry run)
  const questionOps = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const [i, raw] of fileQuestions.entries()) {
    const label = `Question #${i + 1} ${short(raw?.question)}`;
    const row = {
      row: i + 1,
      question: String(raw?.question || '').slice(0, 160),
      type: raw?.type || '',
      topic: raw?.topic ? slugify(raw.topic) : '',
      difficulty: raw?.difficulty || 'easy',
      isFree: Boolean(raw?.isFree),
      language: String(raw?.language || '').toLowerCase(),
    };
    const skip = (reason) => {
      addError(`${label}: ${reason}`);
      addItem({ ...row, status: 'skip', reason });
      skipped += 1;
    };

    if (!raw || typeof raw !== 'object') {
      skip('not a question object');
      continue;
    }
    const lang = slugToLanguage.get(row.language);
    if (!lang) {
      skip(`unknown language "${raw.language || '(empty)'}"`);
      continue;
    }

    // MCQ: the correct option can also be given as its text ("correctAnswer": "strlen()")
    const fields = { ...raw, language: lang._id, topic: row.topic };
    if (raw.type === 'mcq' && fields.correctOption === undefined && raw.correctAnswer !== undefined) {
      const index = (Array.isArray(raw.options) ? raw.options : []).findIndex(
        (o) => String(o).trim() === String(raw.correctAnswer).trim()
      );
      if (index === -1) {
        skip(`correctAnswer "${String(raw.correctAnswer).slice(0, 40)}" is not one of the 4 options`);
        continue;
      }
      fields.correctOption = index;
    }
    delete fields.correctAnswer;

    const doc = new Question(fields);
    try {
      await doc.validate();
    } catch (err) {
      skip(err.errors ? Object.values(err.errors).map((e) => e.message).join(', ') : err.message);
      continue;
    }
    if (doc.type === 'mcq') {
      const problem = mcqProblem(doc);
      if (problem) {
        skip(problem);
        continue;
      }
    } else {
      doc.options = undefined;
      doc.correctOption = undefined;
    }
    if (lang.topicSlugs.size && !lang.topicSlugs.has(doc.topic)) {
      skip(`topic "${doc.topic || '(empty)'}" is not one of ${lang.name}'s topics`);
      continue;
    }

    const key = `${lang._id}|${doc.question}`;
    if (seenInFile.has(key)) {
      skip('appears twice in the file (second one skipped)');
      continue;
    }
    seenInFile.add(key);
    fileQuestionKeys.push(questionKey(row.language, doc.question));

    const isUpdate = existingTexts.has(key);
    if (isUpdate) updated += 1;
    else added += 1;
    addItem({ ...row, type: doc.type, difficulty: doc.difficulty, status: isUpdate ? 'update' : 'new' });

    const values = doc.toObject();
    delete values._id;
    delete values.createdAt;
    delete values.updatedAt;
    // Dates are set here (timestamps: false), so a restored question keeps its original createdAt
    const now = new Date();
    values.updatedAt = now;
    const update = { $set: values, $setOnInsert: { createdAt: fileDate(raw.createdAt) || now } };
    questionOps.push({
      updateOne: { filter: { language: lang._id, question: doc.question }, update, upsert: true, timestamps: false },
    });
  }

  if (!dryRun && questionOps.length) await Question.bulkWrite(questionOps);

  // ---- Coding problems (IPP-1723) ----
  const fileProblems = Array.isArray(data?.problems) ? data.problems : null;
  const problemsResult = fileProblems ? await importProblems(fileProblems, { dryRun, slugToLanguage, addError }) : null;

  // ---- Users + quiz history (IPP-1007, full backup only) ----
  let people = {};
  if (['users', 'quizAttempts', 'problemProgress', 'interviewRounds'].some((key) => Array.isArray(data?.[key]))) {
    const idToSlug = new Map([...slugToLanguage.entries()].map(([slug, l]) => [String(l._id), slug]));
    const questionIds = new Map();
    (await Question.find({ language: { $in: [...slugToLanguage.values()].map((l) => l._id) } }, 'language question').lean()).forEach(
      (q) => questionIds.set(questionKey(idToSlug.get(String(q.language)), q.question), q._id)
    );
    if (dryRun) {
      fileQuestionKeys.forEach((k) => questionIds.has(k) || questionIds.set(k, new mongoose.Types.ObjectId()));
    }
    people = await importUsers(data, { dryRun, questionIds, slugToLanguage, addError, newProblems: problemsResult?.newProblems });
  }

  return {
    ...people,
    dryRun,
    languages: { added: languagesAdded, updated: languagesUpdated },
    questions: { added, updated, skipped },
    ...(problemsResult ? { problems: problemsResult.counts } : {}),
    errors,
    moreErrors: errors.length >= MAX_ERRORS,
    languageItems,
    items,
    moreItems: fileQuestions.length > MAX_ITEMS,
  };
}

/**
 * IPP-1723: add / update coding problems from a backup (matched by language + slug, never deletes).
 * Returns counts and, for a dry run, the problems that would be new ("language slug|problem slug" -> { _id, language })
 * so the coding progress of the same file can be checked against them.
 */
async function importProblems(rows, { dryRun, slugToLanguage, addError }) {
  const counts = { added: 0, updated: 0, skipped: 0 };
  const newProblems = new Map();
  const ops = [];

  // Group by language (the checker works on one language at a time: slugs must be unique per language)
  const byLanguage = new Map();
  rows.forEach((raw, i) => {
    const slug = String(raw?.language || '').toLowerCase();
    if (!byLanguage.has(slug)) byLanguage.set(slug, []);
    byLanguage.get(slug).push({ raw, row: i + 1 });
  });

  for (const [languageSlug, list] of byLanguage) {
    const lang = slugToLanguage.get(languageSlug);
    if (!lang) {
      list.forEach(({ raw, row }) => addError(`Coding problem #${row} ${short(raw?.slug)}: unknown language "${languageSlug || '(empty)'}"`));
      counts.skipped += list.length;
      continue;
    }
    const existing = new Set((await Problem.find({ language: lang._id }, 'slug').lean()).map((p) => p.slug));

    for (const [i, result] of checkProblemsList(list.map((x) => x.raw)).entries()) {
      const { raw } = list[i];
      if (result.errors.length || !result.problem) {
        result.errors.forEach((e) => addError(`Coding problem (${languageSlug}) ${e}`));
        counts.skipped += 1;
        continue;
      }
      const p = result.problem;
      const isUpdate = existing.has(p.slug);
      if (isUpdate) counts.updated += 1;
      else {
        counts.added += 1;
        newProblems.set(`${languageSlug}|${p.slug}`, { _id: new mongoose.Types.ObjectId(), language: lang._id });
      }

      // isActive from the file (a hidden problem stays hidden); an old file without it keeps the current value
      const now = new Date();
      const set = { ...p, language: lang._id, updatedAt: now };
      const setOnInsert = { createdAt: fileDate(raw.createdAt) || now };
      if (typeof raw.isActive === 'boolean') set.isActive = raw.isActive;
      else setOnInsert.isActive = true;
      ops.push({
        updateOne: { filter: { language: lang._id, slug: p.slug }, update: { $set: set, $setOnInsert: setOnInsert }, upsert: true, timestamps: false },
      });
    }
  }

  if (!dryRun && ops.length) await Problem.bulkWrite(ops);
  return { counts, newProblems };
}

module.exports = { buildBackup, importContent, normalizeUpload };
