/**
 * IPP-1007: users + quiz history in the backup file (used by utils/contentBackup.js).
 *
 * File format (emails and language slugs + question text instead of database ids, so it works on any database):
 *   users:        [{ name, email, password (bcrypt hash), role, isVerified, isPaid, paidAt, isBlocked,
 *                    passwordChangedAt, createdAt, paidBy (admin email), lastLoginAt, lastSeenAt (IPP-1703),
 *                    accessScope 'all' | 'some', paidLanguages: ["react", ...] (IPP-1704),
 *                    bookmarks: [{ language: "php", question: "..." }],
 *                    done: [{ language: "php", question: "..." }] }]   (IPP-1601: questions marked as done)
 *   quizAttempts: [{ user: "email", language: "php", difficulty, isSample, topic, score, total, timeTaken,
 *                    timeLimit, status, expiresAt, completedAt, createdAt,
 *                    answers: [{ question: "...", selectedOption, isCorrect }] }]
 *
 * Import only ADDS what is missing, it never changes or deletes:
 *   - users are matched by email; an existing user is left exactly as it is
 *   - quiz attempts are matched by user + start time (createdAt); only completed attempts are imported
 * Email/reset tokens are never exported.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const Progress = require('../models/Progress');

const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const short = (text) => `"${String(text || '').slice(0, 50)}${String(text || '').length > 50 ? '…' : ''}"`;
const errorText = (err) => (err.errors ? Object.values(err.errors).map((e) => e.message).join(', ') : err.message);
const validDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const questionKey = (slug, text) => `${String(slug || '').toLowerCase()}|${text}`;

async function buildUserBackup() {
  const users = await User.find()
    .select('+password +passwordChangedAt')
    .populate({ path: 'bookmarks', select: 'question language', populate: { path: 'language', select: 'slug' } })
    .populate('paidBy', 'email')
    .populate('paidLanguages', 'slug')
    .sort('createdAt')
    .lean();

  // IPP-1601: done questions, grouped by user
  const doneRows = await Progress.find()
    .populate({ path: 'question', select: 'question language', populate: { path: 'language', select: 'slug' } })
    .lean();
  const doneByUser = new Map();
  doneRows
    .filter((r) => r.question?.language)
    .forEach((r) => {
      const key = String(r.user);
      if (!doneByUser.has(key)) doneByUser.set(key, []);
      doneByUser.get(key).push({ language: r.question.language.slug, question: r.question.question });
    });

  // In-progress attempts are not saved (they expire after a few minutes anyway)
  const attempts = await QuizAttempt.find({ status: 'completed' })
    .populate('user', 'email')
    .populate('language', 'slug')
    .populate('answers.question', 'question')
    .sort('createdAt')
    .lean();

  return {
    users: users.map((u) => ({
      name: u.name,
      email: u.email,
      password: u.password,
      role: u.role,
      isVerified: u.isVerified,
      isPaid: u.isPaid,
      paidAt: u.paidAt,
      isBlocked: u.isBlocked,
      passwordChangedAt: u.passwordChangedAt,
      createdAt: u.createdAt,
      paidBy: u.paidBy?.email || undefined,
      accessScope: u.accessScope || 'all',
      paidLanguages: (u.paidLanguages || []).filter(Boolean).map((l) => l.slug),
      lastLoginAt: u.lastLoginAt,
      lastSeenAt: u.lastSeenAt,
      bookmarks: (u.bookmarks || [])
        .filter((b) => b && b.language) // skip bookmarks whose question or language was deleted
        .map((b) => ({ language: b.language.slug, question: b.question })),
      done: doneByUser.get(String(u._id)) || [],
    })),
    quizAttempts: attempts
      .filter((a) => a.user && a.language && a.answers.every((x) => x.question)) // skip broken links
      .map((a) => ({
        user: a.user.email,
        language: a.language.slug,
        difficulty: a.difficulty,
        isSample: a.isSample,
        topic: a.topic || '',
        score: a.score,
        total: a.total,
        timeTaken: a.timeTaken,
        timeLimit: a.timeLimit,
        status: a.status,
        expiresAt: a.expiresAt,
        completedAt: a.completedAt,
        createdAt: a.createdAt,
        answers: a.answers.map((x) => ({ question: x.question.question, selectedOption: x.selectedOption, isCorrect: x.isCorrect })),
      })),
  };
}

/**
 * @param {{ users?: object[], quizAttempts?: object[] }} data
 * @param {{ dryRun: boolean, questionIds: Map<string, ObjectId>, slugToLanguage: Map, addError: Function }} ctx
 *   questionIds: "slug|question text" -> question id (includes questions of the same file)
 */
async function importUsers(data, { dryRun, questionIds, slugToLanguage, addError }) {
  const fileUsers = Array.isArray(data?.users) ? data.users : [];
  const fileAttempts = Array.isArray(data?.quizAttempts) ? data.quizAttempts : [];
  const users = { added: 0, existing: 0, skipped: 0 };
  const quizAttempts = { added: 0, existing: 0, skipped: 0 };
  let bookmarksMissing = 0;

  // ---- Users ----
  const emailToId = new Map((await User.find({}, 'email').lean()).map((u) => [u.email, u._id]));
  const seenEmails = new Set();
  const newEmails = [];
  const newUserDone = new Map(); // email -> [{ question id, language id }] (IPP-1601)
  const newUserPaidBy = new Map(); // email -> admin email (IPP-1703)
  const userOps = [];

  for (const [i, raw] of fileUsers.entries()) {
    const label = `User #${i + 1} ${short(raw?.email)}`;
    const skip = (reason) => {
      addError(`${label}: ${reason}`);
      users.skipped += 1;
    };
    if (!raw || typeof raw !== 'object') {
      skip('not a user object');
      continue;
    }
    if (typeof raw.password !== 'string' || !BCRYPT_HASH.test(raw.password)) {
      skip('password must be the hashed password from a backup file (plain passwords are not accepted)');
      continue;
    }

    const bookmarks = [];
    (Array.isArray(raw.bookmarks) ? raw.bookmarks : []).forEach((b) => {
      const id = questionIds.get(questionKey(b?.language, b?.question));
      if (!id) bookmarksMissing += 1;
      else if (!bookmarks.some((x) => String(x) === String(id))) bookmarks.push(id);
    });

    const doc = new User({
      name: raw.name,
      email: raw.email,
      password: raw.password, // already hashed: saved as it is (bulkWrite does not run the hashing hook)
      role: raw.role,
      isVerified: raw.isVerified,
      isPaid: raw.isPaid,
      paidAt: validDate(raw.paidAt) || undefined,
      isBlocked: raw.isBlocked,
      passwordChangedAt: validDate(raw.passwordChangedAt) || undefined,
      lastLoginAt: validDate(raw.lastLoginAt) || undefined,
      lastSeenAt: validDate(raw.lastSeenAt) || undefined,
      // IPP-1704: languages by slug; missing ones are dropped. 'some' with none left = no access.
      accessScope: raw.accessScope === 'some' ? 'some' : 'all',
      paidLanguages: (Array.isArray(raw.paidLanguages) ? raw.paidLanguages : [])
        .map((slug) => slugToLanguage.get(String(slug || '').toLowerCase())?._id)
        .filter(Boolean),
      bookmarks,
    });
    try {
      await doc.validate();
    } catch (err) {
      skip(errorText(err));
      continue;
    }
    if (seenEmails.has(doc.email)) {
      skip('appears twice in the file (second one skipped)');
      continue;
    }
    seenEmails.add(doc.email);

    if (emailToId.has(doc.email)) {
      users.existing += 1; // left unchanged
      continue;
    }
    users.added += 1;
    newEmails.push(doc.email);
    const done = [];
    (Array.isArray(raw.done) ? raw.done : []).forEach((d) => {
      const slug = String(d?.language || '').toLowerCase();
      const id = questionIds.get(questionKey(slug, d?.question));
      const lang = slugToLanguage.get(slug);
      if (id && lang && !done.some((x) => String(x.question) === String(id))) done.push({ question: id, language: lang._id });
    });
    if (done.length) newUserDone.set(doc.email, done);
    if (raw.paidBy) newUserPaidBy.set(doc.email, String(raw.paidBy).trim().toLowerCase()); // IPP-1703

    const values = doc.toObject();
    delete values._id;
    values.createdAt = validDate(raw.createdAt) || new Date();
    values.updatedAt = new Date();
    userOps.push({ updateOne: { filter: { email: doc.email }, update: { $setOnInsert: values }, upsert: true, timestamps: false } });
  }

  if (!dryRun && userOps.length) {
    await User.bulkWrite(userOps);
    (await User.find({ email: { $in: newEmails } }, 'email').lean()).forEach((u) => emailToId.set(u.email, u._id));
    const progressOps = [];
    newUserDone.forEach((list, email) =>
      list.forEach(({ question, language }) => {
        const key = { user: emailToId.get(email), question };
        progressOps.push({ updateOne: { filter: key, update: { $setOnInsert: { ...key, language } }, upsert: true } });
      })
    );
    if (progressOps.length) await Progress.bulkWrite(progressOps);
    // IPP-1703: "access given by" (admin email -> id, only if that admin exists)
    const paidByOps = [];
    newUserPaidBy.forEach((adminEmail, email) => {
      const adminId = emailToId.get(adminEmail);
      if (adminId) paidByOps.push({ updateOne: { filter: { email }, update: { $set: { paidBy: adminId } }, timestamps: false } });
    });
    if (paidByOps.length) await User.bulkWrite(paidByOps);
  } else {
    newEmails.forEach((email) => emailToId.set(email, new mongoose.Types.ObjectId())); // dry run only
  }

  // ---- Quiz attempts ----
  const attemptEmails = [...new Set(fileAttempts.map((a) => String(a?.user || '').trim().toLowerCase()))];
  const attemptUserIds = attemptEmails.map((e) => emailToId.get(e)).filter(Boolean);
  const existingAttempts = new Set(
    (await QuizAttempt.find({ user: { $in: attemptUserIds } }, 'user createdAt').lean()).map(
      (a) => `${a.user}|${new Date(a.createdAt).getTime()}`
    )
  );
  const seenAttempts = new Set();
  const attemptOps = [];

  for (const [i, raw] of fileAttempts.entries()) {
    const label = `Quiz attempt #${i + 1} (${String(raw?.user || '?')}, ${String(raw?.language || '?')})`;
    const skip = (reason) => {
      addError(`${label}: ${reason}`);
      quizAttempts.skipped += 1;
    };
    if (!raw || typeof raw !== 'object') {
      skip('not a quiz attempt object');
      continue;
    }
    const userId = emailToId.get(String(raw.user || '').trim().toLowerCase());
    if (!userId) {
      skip('unknown user (not in the database or in this file)');
      continue;
    }
    const slug = String(raw.language || '').toLowerCase();
    const lang = slugToLanguage.get(slug);
    if (!lang) {
      skip(`unknown language "${raw.language || '(empty)'}"`);
      continue;
    }
    if (raw.status !== 'completed') {
      skip('only completed quizzes are imported');
      continue;
    }
    const createdAt = validDate(raw.createdAt);
    if (!createdAt) {
      skip('createdAt (quiz start time) is missing or not a date');
      continue;
    }

    const answers = [];
    let missing = null;
    for (const a of Array.isArray(raw.answers) ? raw.answers : []) {
      const id = questionIds.get(questionKey(slug, a?.question));
      if (!id) {
        missing = a?.question;
        break;
      }
      answers.push({ question: id, selectedOption: a.selectedOption ?? null, isCorrect: Boolean(a.isCorrect) });
    }
    if (missing !== null) {
      skip(`question ${short(missing)} was not found in ${lang.name}`);
      continue;
    }
    if (!answers.length) {
      skip('has no answers');
      continue;
    }

    const doc = new QuizAttempt({
      user: userId,
      language: lang._id,
      difficulty: raw.difficulty,
      isSample: raw.isSample,
      topic: raw.topic || '',
      answers,
      score: raw.score,
      total: raw.total,
      timeTaken: raw.timeTaken,
      status: 'completed',
      timeLimit: raw.timeLimit,
      expiresAt: validDate(raw.expiresAt),
      completedAt: validDate(raw.completedAt) || undefined,
    });
    try {
      await doc.validate();
    } catch (err) {
      skip(errorText(err));
      continue;
    }

    const key = `${userId}|${createdAt.getTime()}`;
    if (seenAttempts.has(key)) {
      skip('appears twice in the file (second one skipped)');
      continue;
    }
    seenAttempts.add(key);
    if (existingAttempts.has(key)) {
      quizAttempts.existing += 1;
      continue;
    }
    quizAttempts.added += 1;

    const values = doc.toObject();
    delete values._id;
    values.createdAt = createdAt;
    values.updatedAt = doc.completedAt || createdAt;
    attemptOps.push({
      updateOne: { filter: { user: userId, createdAt }, update: { $setOnInsert: values }, upsert: true, timestamps: false },
    });
  }

  if (!dryRun && attemptOps.length) await QuizAttempt.bulkWrite(attemptOps);

  return { users, quizAttempts, bookmarksMissing };
}

module.exports = { buildUserBackup, importUsers, questionKey };
