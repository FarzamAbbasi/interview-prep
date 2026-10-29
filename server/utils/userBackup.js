/**
 * IPP-1007: users + quiz history in the backup file (used by utils/contentBackup.js).
 *
 * File format (emails and language slugs + question text instead of database ids, so it works on any database):
 *   users:        [{ name, email, password (bcrypt hash), role, isVerified, isPaid, paidAt, isBlocked,
 *                    passwordChangedAt, createdAt, paidBy (admin email), lastLoginAt, lastSeenAt (IPP-1703),
 *                    accessScope 'all' | 'some', paidLanguages: ["react", ...] (IPP-1704),
 *                    bookmarks: [{ language: "php", question: "..." }],
 *                    done: [{ language: "php", question: "...", at: date }] }]   (IPP-1601: questions marked as done;
 *                                                                              IPP-1707: at = when it was marked)
 *   quizAttempts: [{ user: "email", language: "php", difficulty, isSample, topic, score, total, timeTaken,
 *                    timeLimit, status, expiresAt, completedAt, createdAt,
 *                    answers: [{ question: "...", selectedOption, isCorrect }] }]
 *   problemProgress: [{ user: "email", language: "javascript", problem: "two-sum" (slug), submits, fails, solved,
 *                       solvedAt, code, createdAt, updatedAt }]   (IPP-1722: coding problems, see models/ProblemProgress.js)
 *   interviewRounds: [{ user: "email", language: "javascript", level, isTrial, status, timeLimit, expiresAt, completedAt,
 *                       timeTaken, score, total, percentage, createdAt,
 *                       items: [{ kind, question: "..." | null, problem: "two-sum" | null, text, topic, topicName,
 *                                 difficulty, seconds, rating, userAnswer, aiVerdict, aiPoints (IPP-1730),
 *                                 code, passed, total, points, answeredAt }] }]
 *                    (IPP-1727: finished Interview Mode rounds, see models/InterviewRound.js)
 *   users[].interviewTrialAt: when the free interview round was used (IPP-1727)
 *
 * Import only ADDS what is missing, it never changes or deletes:
 *   - users are matched by email; an existing user is left exactly as it is
 *   - quiz attempts are matched by user + start time (createdAt); only completed attempts are imported
 *   - coding progress is matched by user + problem; the problem must be in the same file (IPP-1723) or already
 *     in the database, otherwise that row is skipped with a message
 *   - interview rounds are matched by user + start time (createdAt); only finished rounds are imported. A question or
 *     problem that no longer exists does not skip the round: the item keeps its copied text (report shows it as removed)
 * Email/reset tokens are never exported.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const Progress = require('../models/Progress');
const Problem = require('../models/Problem');
const ProblemProgress = require('../models/ProblemProgress');
const InterviewRound = require('../models/InterviewRound');

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
      doneByUser.get(key).push({ language: r.question.language.slug, question: r.question.question, at: r.createdAt });
    });

  // In-progress attempts are not saved (they expire after a few minutes anyway)
  const attempts = await QuizAttempt.find({ status: 'completed' })
    .populate('user', 'email')
    .populate('language', 'slug')
    .populate('answers.question', 'question')
    .sort('createdAt')
    .lean();

  // IPP-1722: coding problem progress (problem by language slug + problem slug)
  const problemRows = await ProblemProgress.find()
    .populate('user', 'email')
    .populate({ path: 'problem', select: 'slug language', populate: { path: 'language', select: 'slug' } })
    .sort('createdAt')
    .lean();

  // IPP-1727: finished interview rounds (a running one is not saved, it ends within minutes)
  const rounds = await InterviewRound.find({ status: 'completed' })
    .populate('user', 'email')
    .populate('language', 'slug')
    .populate('items.question', 'question')
    .populate('items.problem', 'slug')
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
      interviewTrialAt: u.interviewTrialAt || null, // IPP-1727
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
    problemProgress: problemRows
      .filter((r) => r.user && r.problem?.language) // skip rows whose user or problem was deleted
      .map((r) => ({
        user: r.user.email,
        language: r.problem.language.slug,
        problem: r.problem.slug,
        submits: r.submits,
        fails: r.fails,
        solved: r.solved,
        solvedAt: r.solvedAt,
        code: r.code,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    interviewRounds: rounds
      .filter((r) => r.user && r.language) // skip rounds whose user or language was deleted
      .map((r) => ({
        user: r.user.email,
        language: r.language.slug,
        level: r.level,
        isTrial: r.isTrial,
        status: r.status,
        timeLimit: r.timeLimit,
        expiresAt: r.expiresAt,
        completedAt: r.completedAt,
        timeTaken: r.timeTaken,
        score: r.score,
        total: r.total,
        percentage: r.percentage,
        createdAt: r.createdAt,
        items: r.items.map((i) => ({
          kind: i.kind,
          question: i.question?.question ?? null, // question text (null = deleted)
          problem: i.problem?.slug ?? null, // problem slug (null = deleted)
          text: i.text,
          topic: i.topic,
          topicName: i.topicName,
          difficulty: i.difficulty,
          seconds: i.seconds,
          rating: i.rating,
          userAnswer: i.userAnswer || '', // IPP-1730
          aiVerdict: i.aiVerdict || null,
          aiPoints: i.aiPoints || [],
          code: i.code,
          passed: i.passed,
          total: i.total,
          points: i.points,
          answeredAt: i.answeredAt,
        })),
      })),
  };
}

/**
 * @param {{ users?: object[], quizAttempts?: object[] }} data
 * @param {{ dryRun: boolean, questionIds: Map<string, ObjectId>, slugToLanguage: Map, addError: Function }} ctx
 *   questionIds: "slug|question text" -> question id (includes questions of the same file)
 */
async function importUsers(data, { dryRun, questionIds, slugToLanguage, addError, newProblems }) {
  const fileUsers = Array.isArray(data?.users) ? data.users : [];
  const fileAttempts = Array.isArray(data?.quizAttempts) ? data.quizAttempts : [];
  const users = { added: 0, existing: 0, skipped: 0 };
  const quizAttempts = { added: 0, existing: 0, skipped: 0 };
  const fileProgress = Array.isArray(data?.problemProgress) ? data.problemProgress : null; // IPP-1722
  const fileRounds = Array.isArray(data?.interviewRounds) ? data.interviewRounds : null; // IPP-1727
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
      interviewTrialAt: validDate(raw.interviewTrialAt), // IPP-1727 (null = free round not used)
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
      if (id && lang && !done.some((x) => String(x.question) === String(id))) {
        done.push({ question: id, language: lang._id, at: validDate(d?.at) }); // IPP-1707: keep the date (older files: none)
      }
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
      list.forEach(({ question, language, at }) => {
        const key = { user: emailToId.get(email), question };
        const when = at || new Date(); // IPP-1707: original "done" date when the file has it
        progressOps.push({
          updateOne: {
            filter: key,
            update: { $setOnInsert: { ...key, language, createdAt: when, updatedAt: when } },
            upsert: true,
            timestamps: false,
          },
        });
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

  // ---- Coding problem progress (IPP-1722) ----
  const problemProgress = fileProgress ? await importProblemProgress(fileProgress, { dryRun, emailToId, slugToLanguage, addError, newProblems }) : undefined;

  // ---- Interview rounds (IPP-1727) ----
  const interviewRounds = fileRounds
    ? await importInterviewRounds(fileRounds, { dryRun, emailToId, slugToLanguage, questionIds, addError, newProblems })
    : undefined;

  return {
    users,
    quizAttempts,
    bookmarksMissing,
    ...(problemProgress ? { problemProgress } : {}),
    ...(interviewRounds ? { interviewRounds } : {}),
  };
}

/**
 * Problems in the database by "language slug|problem slug" -> { _id, language }.
 * In a dry run, problems the same backup file will add are included too (IPP-1723).
 */
async function problemsByKey(slugToLanguage, { dryRun, newProblems }) {
  const languageIds = [...slugToLanguage.values()].map((l) => l._id);
  const idToSlug = new Map([...slugToLanguage.entries()].map(([slug, l]) => [String(l._id), slug]));
  const map = new Map(
    (await Problem.find({ language: { $in: languageIds } }, 'slug language').lean()).map((p) => [
      `${idToSlug.get(String(p.language))}|${p.slug}`,
      p,
    ])
  );
  if (dryRun && newProblems) newProblems.forEach((p, key) => map.has(key) || map.set(key, p));
  return map;
}

/**
 * IPP-1722: add coding progress rows that are missing (user + problem). Existing rows are not changed.
 */
async function importProblemProgress(rows, { dryRun, emailToId, slugToLanguage, addError, newProblems }) {
  const counts = { added: 0, existing: 0, skipped: 0 };

  const problemByKey = await problemsByKey(slugToLanguage, { dryRun, newProblems });
  const userIds = [...new Set(rows.map((r) => emailToId.get(String(r?.user || '').trim().toLowerCase())).filter(Boolean))];
  const existing = new Set(
    (await ProblemProgress.find({ user: { $in: userIds } }, 'user problem').lean()).map((r) => `${r.user}|${r.problem}`)
  );
  const seen = new Set();
  const ops = [];

  for (const [i, raw] of rows.entries()) {
    const label = `Coding progress #${i + 1} (${String(raw?.user || '?')}, ${String(raw?.problem || '?')})`;
    const skip = (reason) => {
      addError(`${label}: ${reason}`);
      counts.skipped += 1;
    };
    if (!raw || typeof raw !== 'object') {
      skip('not a progress object');
      continue;
    }
    const userId = emailToId.get(String(raw.user || '').trim().toLowerCase());
    if (!userId) {
      skip('unknown user (not in the database or in this file)');
      continue;
    }
    const problem = problemByKey.get(`${String(raw.language || '').toLowerCase()}|${String(raw.problem || '').toLowerCase()}`);
    if (!problem) {
      skip('problem not found (not in this file or the database; run npm run import:problems for that language)');
      continue;
    }
    const doc = new ProblemProgress({
      user: userId,
      problem: problem._id,
      language: problem.language,
      submits: Number(raw.submits) || 0,
      fails: Number(raw.fails) || 0,
      solved: Boolean(raw.solved),
      solvedAt: raw.solved ? validDate(raw.solvedAt) : null,
      code: typeof raw.code === 'string' ? raw.code : '',
    });
    try {
      await doc.validate();
    } catch (err) {
      skip(errorText(err));
      continue;
    }
    const key = `${userId}|${problem._id}`;
    if (seen.has(key)) {
      skip('appears twice in the file (second one skipped)');
      continue;
    }
    seen.add(key);
    if (existing.has(key)) {
      counts.existing += 1; // left unchanged
      continue;
    }
    counts.added += 1;
    const values = doc.toObject();
    delete values._id;
    values.createdAt = validDate(raw.createdAt) || new Date();
    values.updatedAt = validDate(raw.updatedAt) || values.createdAt;
    ops.push({ updateOne: { filter: { user: userId, problem: problem._id }, update: { $setOnInsert: values }, upsert: true, timestamps: false } });
  }

  if (!dryRun && ops.length) await ProblemProgress.bulkWrite(ops);
  return counts;
}

/**
 * IPP-1727: add finished interview rounds that are missing (user + start time). Existing rounds are not changed.
 */
async function importInterviewRounds(rows, { dryRun, emailToId, slugToLanguage, questionIds, addError, newProblems }) {
  const counts = { added: 0, existing: 0, skipped: 0 };
  const problemByKey = await problemsByKey(slugToLanguage, { dryRun, newProblems });
  const userIds = [...new Set(rows.map((r) => emailToId.get(String(r?.user || '').trim().toLowerCase())).filter(Boolean))];
  const existing = new Set(
    (await InterviewRound.find({ user: { $in: userIds } }, 'user createdAt').lean()).map((r) => `${r.user}|${new Date(r.createdAt).getTime()}`)
  );
  const seen = new Set();
  const ops = [];

  for (const [i, raw] of rows.entries()) {
    const label = `Interview round #${i + 1} (${String(raw?.user || '?')}, ${String(raw?.language || '?')})`;
    const skip = (reason) => {
      addError(`${label}: ${reason}`);
      counts.skipped += 1;
    };
    if (!raw || typeof raw !== 'object') {
      skip('not an interview round object');
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
      skip('only finished rounds are imported');
      continue;
    }
    const createdAt = validDate(raw.createdAt);
    if (!createdAt) {
      skip('createdAt (round start time) is missing or not a date');
      continue;
    }
    const fileItems = Array.isArray(raw.items) ? raw.items : [];
    if (!fileItems.length) {
      skip('has no questions');
      continue;
    }

    // Links by question text / problem slug; a missing one stays empty (the item keeps its text)
    const items = fileItems.map((it) => ({
      kind: it?.kind,
      question: it?.kind === 'qa' && it.question ? questionIds.get(questionKey(slug, it.question)) : undefined,
      problem: it?.kind === 'coding' && it.problem ? problemByKey.get(`${slug}|${String(it.problem).toLowerCase()}`)?._id : undefined,
      text: it?.text || it?.question || '',
      topic: it?.topic || '',
      topicName: it?.topicName || '',
      difficulty: it?.difficulty,
      seconds: it?.seconds,
      rating: it?.kind === 'qa' ? it.rating || 'skipped' : null,
      userAnswer: typeof it?.userAnswer === 'string' ? it.userAnswer.slice(0, 2000) : '', // IPP-1730
      aiVerdict: ['right', 'partly', 'wrong'].includes(it?.aiVerdict) ? it.aiVerdict : null,
      aiPoints: Array.isArray(it?.aiPoints) ? it.aiPoints.filter((x) => typeof x === 'string').slice(0, 4) : undefined,
      code: typeof it?.code === 'string' ? it.code : '',
      passed: Number(it?.passed) || 0,
      total: Number(it?.total) || 0,
      points: Number(it?.points) || 0,
      answeredAt: validDate(it?.answeredAt),
    }));

    const doc = new InterviewRound({
      user: userId,
      language: lang._id,
      level: raw.level,
      isTrial: Boolean(raw.isTrial),
      items,
      status: 'completed',
      timeLimit: raw.timeLimit,
      expiresAt: validDate(raw.expiresAt) || createdAt,
      completedAt: validDate(raw.completedAt) || createdAt,
      timeTaken: Number(raw.timeTaken) || 0,
      score: Number(raw.score) || 0,
      total: items.length,
      percentage: Number(raw.percentage) || 0,
    });
    try {
      await doc.validate();
    } catch (err) {
      skip(errorText(err));
      continue;
    }

    const key = `${userId}|${createdAt.getTime()}`;
    if (seen.has(key)) {
      skip('appears twice in the file (second one skipped)');
      continue;
    }
    seen.add(key);
    if (existing.has(key)) {
      counts.existing += 1; // left unchanged
      continue;
    }
    counts.added += 1;
    const values = doc.toObject();
    delete values._id;
    values.createdAt = createdAt;
    values.updatedAt = doc.completedAt;
    ops.push({ updateOne: { filter: { user: userId, createdAt }, update: { $setOnInsert: values }, upsert: true, timestamps: false } });
  }

  if (!dryRun && ops.length) await InterviewRound.bulkWrite(ops);
  return counts;
}

module.exports = { buildUserBackup, importUsers, questionKey };
